/**
 * Nghiệp vụ QC Order (/qc) và Scan Tracking (/scan-track) —
 * docs/05-module-nghiep-vu/quan-ly-kho-xuong.md mục 8, 9.
 * Đi qua cùng state machine order-status.ts; mỗi thao tác là 1 transaction.
 */
import { execute, queryOne, withTransaction, type Queryable } from '../../db/pool.js';
import { BadRequestError, NotFoundError } from '../../core/http-error.js';
import type { AuthUser } from '../../middlewares/auth.js';
import { logActivity } from '../activity-logs/activity-log.service.js';
import { assertTransition, timestampColumnFor } from './order-status.js';
import { findOrderById, type OrderRow } from './orders.repository.js';

/** Tìm order theo mã quét được: order_code, etsy_order_id hoặc id số. */
export async function findOrderByCode(db: Queryable, code: string): Promise<OrderRow | undefined> {
  const order = await queryOne<OrderRow>(
    db,
    'SELECT * FROM orders WHERE order_code = ? OR etsy_order_id = ? LIMIT 1',
    [code, code],
  );
  if (order) return order;
  if (/^\d+$/.test(code)) return findOrderById(db, Number(code));
  return undefined;
}

export interface QcVerifyInput {
  order_id: number;
  passed: boolean;
  note?: string | null;
  items?: { order_item_id: number; error_at: 'xuong' | 'designer' | 'phoi'; error_reason: string }[];
}

/**
 * QC xác nhận đạt / lỗi:
 * - Đạt: order in_finishing → qc_passed, toàn bộ items → qc_passed.
 * - Lỗi: items được chọn → qc_failed kèm error_at/error_reason (hiện ở trang Đơn lỗi),
 *   order → redo trả lại sản xuất.
 */
export async function qcVerify(input: QcVerifyInput, user: AuthUser): Promise<void> {
  await withTransaction(async (conn) => {
    const order = await findOrderById(conn, input.order_id, true);
    if (!order) throw new NotFoundError('Không tìm thấy order');

    const to = input.passed ? 'qc_passed' : 'redo';
    assertTransition(order.status, to);

    if (input.passed) {
      await execute(conn, "UPDATE order_items SET status = 'qc_passed' WHERE order_id = ?", [order.id]);
    } else {
      if (!input.items?.length) throw new BadRequestError('QC lỗi phải chọn ít nhất 1 item kèm lý do');
      for (const item of input.items) {
        const result = await execute(
          conn,
          `UPDATE order_items SET status = 'qc_failed', error_at = ?, error_reason = ?
           WHERE id = ? AND order_id = ?`,
          [item.error_at, item.error_reason, item.order_item_id, order.id],
        );
        if (result.affectedRows === 0) {
          throw new NotFoundError(`Item #${item.order_item_id} không thuộc order này`);
        }
      }
    }

    const timestampColumn = timestampColumnFor(to);
    await execute(
      conn,
      `UPDATE orders SET status = ?${timestampColumn ? `, ${timestampColumn} = NOW()` : ''} WHERE id = ?`,
      [to, order.id],
    );
    await logActivity(conn, 'order', order.id, user.id,
      `${user.name}: QC ${input.passed ? 'đạt' : 'lỗi → trả lại SX'}${input.note ? ` (${input.note})` : ''}`);
  });
}

export interface ScanTrackInput {
  code: string;
  tracking_number: string;
  carrier?: string | null;
}

/**
 * Gắn tracking khi bàn giao vận chuyển: ghi vào order_packages
 * (cập nhật kiện chưa có tracking, hoặc tạo kiện mới) và chuyển out_stock → shipped.
 * Trả về order để caller đẩy tracking lên Etsy sau khi commit.
 */
export async function attachTracking(input: ScanTrackInput, user: AuthUser): Promise<OrderRow> {
  return withTransaction(async (conn) => {
    const found = await findOrderByCode(conn, input.code);
    if (!found) throw new NotFoundError(`Không tìm thấy order với mã "${input.code}"`);
    const order = (await findOrderById(conn, found.id, true)) as OrderRow;
    assertTransition(order.status, 'shipped');

    const emptyPackage = await queryOne<{ id: number }>(
      conn,
      'SELECT id FROM order_packages WHERE order_id = ? AND tracking_number IS NULL ORDER BY id LIMIT 1 FOR UPDATE',
      [order.id],
    );
    if (emptyPackage) {
      await execute(conn, 'UPDATE order_packages SET tracking_number = ?, carrier = ? WHERE id = ?', [
        input.tracking_number, input.carrier ?? null, emptyPackage.id,
      ]);
    } else {
      await execute(conn, 'INSERT INTO order_packages (order_id, tracking_number, carrier) VALUES (?, ?, ?)', [
        order.id, input.tracking_number, input.carrier ?? null,
      ]);
    }

    await execute(conn, "UPDATE orders SET status = 'shipped', shipped_at = NOW() WHERE id = ?", [order.id]);
    await logActivity(conn, 'order', order.id, user.id,
      `${user.name}: Scan tracking ${input.tracking_number}${input.carrier ? ` (${input.carrier})` : ''} → shipped`);
    return order;
  });
}
