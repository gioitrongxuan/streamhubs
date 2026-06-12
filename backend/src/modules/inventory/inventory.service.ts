import type { z } from 'zod';
import { execute, pool, query, queryOne, withTransaction } from '../../db/pool.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/http-error.js';
import type { AuthUser } from '../../middlewares/auth.js';
import { logActivity } from '../activity-logs/activity-log.service.js';
import type { generateQrSchema, scanInSchema, scanOutSchema } from './inventory.schemas.js';

interface InventoryItemRow {
  id: number;
  lot_id: number;
  qrcode: string;
  shelf_id: number | null;
  status: 'created' | 'in_stock' | 'out' | 'return_error' | 'damaged';
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
export async function scanIn(input: z.infer<typeof scanInSchema>, user: AuthUser): Promise<void> {
  await withTransaction(async (conn) => {
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
