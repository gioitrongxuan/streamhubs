import type { z } from 'zod';
import { execute, pool, query, queryOne, withTransaction } from '../../db/pool.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/http-error.js';
import type { AuthUser } from '../../middlewares/auth.js';
import { logActivity } from '../activity-logs/activity-log.service.js';
import { createPaymentRequest } from '../payment-requests/payment-requests.service.js';
import type { createPaymentRequestSchema } from '../payment-requests/payment-requests.schemas.js';
import type {
  generateQrSchema,
  importReportQuerySchema,
  logPrintSchema,
  pushPaymentSchema,
  scanInSchema,
  scanOutSchema,
} from './inventory.schemas.js';

interface InventoryItemRow {
  id: number;
  lot_id: number;
  qrcode: string;
  shelf_id: number | null;
  status: 'created' | 'in_stock' | 'out' | 'return_error' | 'damaged';
}

/** Một dòng báo cáo nhập kho — gộp theo lô trong phạm vi ngày/lô đã lọc. */
interface ImportReportRow {
  lot_id: number;
  lot_number: string;
  color: string | null;
  size: string | null;
  unit_price_vnd: string | null;
  product_type_name: string;
  supplier_id: number;
  supplier_name: string;
  qty: number;
  amount: string;
}

/** Thông tin lô trả về sau khi scan nhập — để client cộng dồn số lượng & tiền. */
export interface ScanInResult {
  qrcode: string;
  lot_id: number;
  lot_number: string;
  color: string | null;
  size: string | null;
  product_type_name: string;
  unit_price_vnd: string | null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Sinh QR cho từng chiếc phôi trong lô: mỗi item = {qr_prefix}{seq}.
 * Item sinh ra ở trạng thái `created` — chỉ thành `in_stock` khi scan nhập kho.
 */
export async function generateQrcodes(
  lotId: number,
  input: z.infer<typeof generateQrSchema>,
  user: AuthUser,
): Promise<string[]> {
  return withTransaction(async (conn) => {
    const lot = await queryOne<{ id: number; quantity: number; qr_prefix: string }>(
      conn,
      'SELECT id, quantity, qr_prefix FROM inventory_lots WHERE id = ? FOR UPDATE',
      [lotId],
    );
    if (!lot) throw new NotFoundError('Không tìm thấy lô phôi');

    const existing = await queryOne<{ cnt: number }>(
      conn,
      'SELECT COUNT(*) AS cnt FROM inventory_items WHERE lot_id = ?',
      [lotId],
    );
    const startSeq = (existing?.cnt ?? 0) + 1;
    const count = input.quantity ?? lot.quantity - (existing?.cnt ?? 0);
    if (count <= 0) throw new ConflictError('Lô đã sinh đủ QR cho toàn bộ số lượng');

    const qrcodes: string[] = [];
    for (let i = 0; i < count; i++) {
      const qrcode = `${lot.qr_prefix}${String(startSeq + i).padStart(4, '0')}`;
      await execute(conn, 'INSERT INTO inventory_items (lot_id, qrcode) VALUES (?, ?)', [lotId, qrcode]);
      qrcodes.push(qrcode);
    }
    await logActivity(conn, 'inventory_lot', lotId, user.id, `${user.name}: Sinh ${count} QR code`);
    return qrcodes;
  });
}

/**
 * Scan nhập kho 1 chiếc phôi. Atomic trong 1 transaction:
 * item → in_stock + gán kệ, lot.remaining_qty +1, shelf.current_count +1, ghi inventory_in.
 */
export async function scanIn(input: z.infer<typeof scanInSchema>, user: AuthUser): Promise<ScanInResult> {
  return withTransaction(async (conn) => {
    const item = await queryOne<InventoryItemRow>(
      conn,
      'SELECT * FROM inventory_items WHERE qrcode = ? FOR UPDATE',
      [input.qrcode],
    );
    if (!item) throw new NotFoundError(`Không tìm thấy phôi với QR "${input.qrcode}"`);
    if (item.status === 'in_stock') throw new ConflictError('Phôi này đang ở trong kho — đã nhập trước đó');
    if (item.status === 'damaged') throw new ConflictError('Phôi đã đánh dấu hỏng/thất lạc');

    const shelf = await queryOne<{ id: number; capacity: number; current_count: number }>(
      conn,
      'SELECT id, capacity, current_count FROM shelves WHERE id = ? FOR UPDATE',
      [input.shelf_id],
    );
    if (!shelf) throw new NotFoundError('Không tìm thấy kệ hàng');
    if (shelf.capacity > 0 && shelf.current_count >= shelf.capacity) {
      throw new ConflictError('Kệ đã đầy — chọn kệ khác');
    }

    await execute(conn, "UPDATE inventory_items SET status = 'in_stock', shelf_id = ? WHERE id = ?", [input.shelf_id, item.id]);
    await execute(conn, 'UPDATE inventory_lots SET remaining_qty = remaining_qty + 1 WHERE id = ?', [item.lot_id]);
    await execute(conn, 'UPDATE shelves SET current_count = current_count + 1 WHERE id = ?', [input.shelf_id]);

    const result = await execute(
      conn,
      'INSERT INTO inventory_in (inventory_item_id, shelf_id, date, created_by, note) VALUES (?, ?, ?, ?, ?)',
      [item.id, input.shelf_id, input.date ?? today(), user.id, input.note ?? null],
    );
    await logActivity(conn, 'inventory_in', result.insertId, user.id, `${user.name}: Nhập kho phôi ${input.qrcode}`);

    // Trả về thông tin lô + đơn giá để màn Nhập kho cộng dồn số lượng & thành tiền realtime.
    const lot = await queryOne<Omit<ScanInResult, 'qrcode'>>(
      conn,
      `SELECT l.id AS lot_id, l.lot_number, l.color, l.size, l.unit_price_vnd, pt.name AS product_type_name
       FROM inventory_lots l JOIN product_types pt ON pt.id = l.product_type_id WHERE l.id = ?`,
      [item.lot_id],
    );
    return { qrcode: input.qrcode, ...lot! };
  });
}

/**
 * Scan xuất kho 1 chiếc phôi (cho sản xuất hoặc hoàn kho lỗi). Atomic:
 * item → out/return_error, lot.remaining_qty -1, shelf.current_count -1, ghi inventory_out.
 */
export async function scanOut(input: z.infer<typeof scanOutSchema>, user: AuthUser): Promise<void> {
  if (input.type === 'order' && !input.order_item_id) {
    throw new BadRequestError('Xuất cho sản xuất phải kèm order_item_id');
  }

  await withTransaction(async (conn) => {
    const item = await queryOne<InventoryItemRow>(
      conn,
      'SELECT * FROM inventory_items WHERE qrcode = ? FOR UPDATE',
      [input.qrcode],
    );
    if (!item) throw new NotFoundError(`Không tìm thấy phôi với QR "${input.qrcode}"`);
    if (item.status !== 'in_stock') throw new ConflictError('Phôi không ở trong kho — không thể xuất');

    const newStatus = input.type === 'order' ? 'out' : 'return_error';
    await execute(conn, 'UPDATE inventory_items SET status = ? WHERE id = ?', [newStatus, item.id]);
    await execute(conn, 'UPDATE inventory_lots SET remaining_qty = remaining_qty - 1 WHERE id = ?', [item.lot_id]);
    if (item.shelf_id) {
      await execute(conn, 'UPDATE shelves SET current_count = current_count - 1 WHERE id = ?', [item.shelf_id]);
    }

    if (input.type === 'order' && input.order_item_id) {
      // Gắn phôi vào item nếu chưa có (qty > 1 thì tra đầy đủ qua inventory_out)
      await execute(
        conn,
        'UPDATE order_items SET inventory_item_id = ? WHERE id = ? AND inventory_item_id IS NULL',
        [item.id, input.order_item_id],
      );
    }

    const result = await execute(
      conn,
      'INSERT INTO inventory_out (inventory_item_id, order_item_id, type, date, created_by) VALUES (?, ?, ?, ?, ?)',
      [item.id, input.order_item_id ?? null, input.type, input.date ?? today(), user.id],
    );
    await logActivity(conn, 'inventory_out', result.insertId, user.id,
      `${user.name}: Xuất phôi ${input.qrcode} (${input.type})`);
  });
}

/** Báo cáo tồn kho theo lô, kèm cờ cảnh báo dưới ngưỡng. */
export async function inventoryReport() {
  return query(
    pool,
    `SELECT l.id, l.lot_number, l.color, l.size, l.quantity, l.remaining_qty, l.min_threshold, l.qr_prefix,
            pt.name AS product_type_name, s.short_name AS supplier_name,
            (l.min_threshold IS NOT NULL AND l.remaining_qty <= l.min_threshold) AS is_low_stock,
            (SELECT COUNT(*) FROM inventory_items ii WHERE ii.lot_id = l.id) AS qrcode_count
     FROM inventory_lots l
     JOIN product_types pt ON pt.id = l.product_type_id
     JOIN suppliers s ON s.id = l.supplier_id
     ORDER BY is_low_stock DESC, l.id DESC`,
  );
}

/**
 * Báo cáo nhập kho theo ngày và/hoặc theo lô: gộp các lượt scan nhập (inventory_in)
 * theo lô, kèm số lượng và thành tiền = số lượng × đơn giá lô. Trả thêm tổng cộng.
 */
export async function importReport(
  filters: z.infer<typeof importReportQuerySchema>,
): Promise<{ rows: ImportReportRow[]; summary: { total_qty: number; total_amount: number } }> {
  const date = filters.date ?? null;
  const lotId = filters.lot_id ?? null;
  const rows = await query<ImportReportRow>(
    pool,
    `SELECT l.id AS lot_id, l.lot_number, l.color, l.size, l.unit_price_vnd,
            pt.name AS product_type_name, s.id AS supplier_id, s.short_name AS supplier_name,
            COUNT(i.id) AS qty,
            COUNT(i.id) * COALESCE(l.unit_price_vnd, 0) AS amount
     FROM inventory_in i
     JOIN inventory_items ii ON ii.id = i.inventory_item_id
     JOIN inventory_lots l ON l.id = ii.lot_id
     JOIN product_types pt ON pt.id = l.product_type_id
     JOIN suppliers s ON s.id = l.supplier_id
     WHERE (? IS NULL OR i.date = ?) AND (? IS NULL OR l.id = ?)
     GROUP BY l.id, l.lot_number, l.color, l.size, l.unit_price_vnd, pt.name, s.id, s.short_name
     ORDER BY l.lot_number`,
    [date, date, lotId, lotId],
  );
  const summary = rows.reduce(
    (acc, r) => ({ total_qty: acc.total_qty + Number(r.qty), total_amount: acc.total_amount + Number(r.amount) }),
    { total_qty: 0, total_amount: 0 },
  );
  return { rows, summary };
}

/** Ghi lịch sử một lần in báo cáo nhập kho. Tổng được tính lại từ DB, không tin số client gửi. */
export async function logPrint(
  input: z.infer<typeof logPrintSchema>,
  user: AuthUser,
): Promise<{ id: number; total_qty: number; total_amount: number }> {
  const { summary } = await importReport(input);
  const reportType: 'day' | 'lot' = input.lot_id && !input.date ? 'lot' : 'day';
  const result = await execute(
    pool,
    `INSERT INTO inventory_print_history (report_type, report_date, lot_id, total_qty, total_amount, printed_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [reportType, input.date ?? null, input.lot_id ?? null, summary.total_qty, summary.total_amount, user.id],
  );
  await logActivity(pool, 'inventory_print', result.insertId, user.id,
    `${user.name}: In báo cáo nhập kho (${reportType === 'lot' ? 'theo lô' : 'theo ngày'}) — ${summary.total_qty} phôi`);
  return { id: result.insertId, ...summary };
}

/** Danh sách lịch sử phiếu in báo cáo nhập kho gần đây. */
export async function listPrintHistory() {
  return query(
    pool,
    `SELECT ph.id, ph.report_type, ph.report_date, ph.lot_id, l.lot_number,
            ph.total_qty, ph.total_amount, ph.payment_request_id, pr.serial_number,
            u.name AS printed_by_name, ph.created_at
     FROM inventory_print_history ph
     LEFT JOIN inventory_lots l ON l.id = ph.lot_id
     LEFT JOIN payment_requests pr ON pr.id = ph.payment_request_id
     JOIN users u ON u.id = ph.printed_by
     ORDER BY ph.id DESC LIMIT 50`,
  );
}

/**
 * Đẩy báo cáo nhập kho (theo ngày/lô) sang đề nghị thanh toán: mỗi lô = 1 khoản chi,
 * tham chiếu reference_type='inventory_lot'. Nếu kèm print_history_id thì liên kết phiếu in đó.
 */
export async function pushReportToPayment(
  input: z.infer<typeof pushPaymentSchema>,
  user: AuthUser,
): Promise<{ id: number; serial_number: string }> {
  const { rows } = await importReport(input);
  const [first] = rows;
  if (!first) throw new BadRequestError('Không có dữ liệu nhập kho trong phạm vi đã chọn');

  const supplierIds = new Set(rows.map((r) => r.supplier_id));
  const supplierId = input.supplier_id ?? (supplierIds.size === 1 ? first.supplier_id : null);

  const items: z.infer<typeof createPaymentRequestSchema>['items'] = rows.map((r) => {
    const variant = [r.color, r.size].filter(Boolean).join(' / ');
    return {
      description: `Nhập kho lô ${r.lot_number}${variant ? ` (${variant})` : ''} — ${r.product_type_name}`,
      qty: Number(r.qty),
      unit: 'cái',
      unit_price: Number(r.unit_price_vnd ?? 0),
      reference_type: 'inventory_lot',
      reference_id: r.lot_id,
    };
  });

  const scopeLabel = input.date
    ? `ngày ${input.date.split('-').reverse().join('-')}`
    : `lô ${first.lot_number}`;

  const created = await createPaymentRequest(
    {
      supplier_id: supplierId,
      payment_group: 'material',
      content: `Đề nghị thanh toán phôi nhập kho (${scopeLabel})`,
      currency: 'VND',
      items,
      approver_ids: input.approver_ids,
    },
    user,
  );

  if (input.print_history_id) {
    await execute(pool, 'UPDATE inventory_print_history SET payment_request_id = ? WHERE id = ?', [
      created.id, input.print_history_id,
    ]);
  }
  return created;
}
