import type { z } from 'zod';
import { execute, queryOne, withTransaction } from '../../db/pool.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/http-error.js';
import type { AuthUser } from '../../middlewares/auth.js';
import { logActivity } from '../activity-logs/activity-log.service.js';
import { buildOrderCode } from './order-code.js';
import { assertTransition, timestampColumnFor, type OrderStatus } from './order-status.js';
import { findOrderById, insertOrderItem } from './orders.repository.js';
import type { createOrderSchema, mergeOrdersSchema } from './orders.schemas.js';

type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** Tạo order nội bộ kèm items; sinh order_code từ prefix của shop. */
export async function createInternalOrder(input: CreateOrderInput, user: AuthUser): Promise<number> {
  return withTransaction(async (conn) => {
    const shop = await queryOne<{ order_prefix: string }>(conn, 'SELECT order_prefix FROM shops WHERE id = ? AND is_active = 1', [
      input.shop_id,
    ]);
    if (!shop) throw new NotFoundError('Không tìm thấy shop');

    const itemTotal = input.items.reduce((sum, item) => sum + (item.price_sale ?? 0) * item.qty, 0);
    const orderTotal = itemTotal - input.discount + input.shipping_fee + input.delivery_fee + input.sales_tax + input.tax;

    const result = await execute(
      conn,
      `INSERT INTO orders (order_code, order_type, shop_id, listing_name, fulfill_type, supplier_id,
                           designer_id, design_assigned_at, cs_id, labels, is_digital, shop_note, streamer_note,
                           ioss_number, item_total, discount, shipping_fee, delivery_fee, sales_tax, tax,
                           order_total, currency, receiver_name, address_line1, address_line2, city, state,
                           zipcode, country, phone)
       VALUES (?, 'internal', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [buildOrderCode(shop.order_prefix), input.shop_id, input.listing_name ?? null, input.fulfill_type,
       input.supplier_id ?? null, input.designer_id ?? null, input.designer_id ? new Date() : null,
       input.cs_id ?? null, input.labels ?? null, input.is_digital ? 1 : 0,
       input.shop_note ?? null, input.streamer_note ?? null, input.ioss_number ?? null,
       itemTotal, input.discount, input.shipping_fee, input.delivery_fee, input.sales_tax, input.tax,
       orderTotal, input.currency, input.receiver_name ?? null, input.address_line1 ?? null,
       input.address_line2 ?? null, input.city ?? null, input.state ?? null, input.zipcode ?? null,
       input.country ?? null, input.phone ?? null],
    );
    const orderId = result.insertId;

    for (const item of input.items) {
      await insertOrderItem(conn, orderId, item);
    }
    await logActivity(conn, 'order', orderId, user.id, `${user.name}: Tạo order thủ công`);
    return orderId;
  });
}

/**
 * Chuyển trạng thái order qua state machine, ghi timestamp tương ứng.
 * Lock row (FOR UPDATE) để hai người thao tác đồng thời không đua trạng thái.
 */
export async function changeOrderStatus(
  orderId: number,
  to: OrderStatus,
  user: AuthUser,
  note?: string | null,
): Promise<void> {
  await withTransaction(async (conn) => {
    const order = await findOrderById(conn, orderId, true);
    if (!order) throw new NotFoundError('Không tìm thấy order');
    assertTransition(order.status, to);

    const timestampColumn = timestampColumnFor(to);
    await execute(
      conn,
      `UPDATE orders SET status = ?${timestampColumn ? `, ${timestampColumn} = NOW()` : ''} WHERE id = ?`,
      [to, orderId],
    );

    if (to === 'cancelled') {
      // Nếu đã xuất phôi, kho phải scan hoàn kho (inventory_out type=return_error) — nhắc qua log
      const outRow = await queryOne(
        conn,
        `SELECT io.id FROM inventory_out io
         JOIN order_items oi ON oi.id = io.order_item_id
         WHERE oi.order_id = ? AND io.type = 'order' LIMIT 1`,
        [orderId],
      );
      if (outRow) {
        await logActivity(conn, 'order', orderId, null, 'Order hủy sau khi đã xuất phôi — cần scan hoàn kho (return_error)');
      }
    }

    await logActivity(
      conn,
      'order',
      orderId,
      user.id,
      `${user.name}: Chuyển trạng thái ${order.status} → ${to}${note ? ` (${note})` : ''}`,
    );
  });
}

/**
 * Gộp đơn — docs/01-phan-tich-quy-trinh/workflow.md mục 3b.
 * Quy tắc: tất cả fulfill internal, cùng địa chỉ, không gộp chuỗi nhiều cấp.
 */
export async function mergeOrders(
  mainOrderId: number,
  input: z.infer<typeof mergeOrdersSchema>,
  user: AuthUser,
): Promise<void> {
  await withTransaction(async (conn) => {
    const main = await findOrderById(conn, mainOrderId, true);
    if (!main) throw new NotFoundError('Không tìm thấy order chính');
    if (main.merged_order_id !== null) {
      throw new ConflictError('Đơn đã được gộp vào đơn khác — không thể làm đơn chính');
    }
    if (main.fulfill_type !== 'internal') {
      throw new BadRequestError('Chỉ gộp được đơn fulfill internal');
    }

    for (const childId of input.child_order_ids) {
      if (childId === mainOrderId) throw new BadRequestError('Không thể gộp đơn vào chính nó');
      const child = await findOrderById(conn, childId, true);
      if (!child) throw new NotFoundError(`Không tìm thấy order #${childId}`);
      if (child.merged_order_id !== null) throw new ConflictError(`Order ${child.order_code} đã được gộp trước đó`);
      if (child.fulfill_type !== 'internal') throw new BadRequestError(`Order ${child.order_code} không phải fulfill internal`);
      if (child.address_line1 !== main.address_line1 || child.zipcode !== main.zipcode) {
        throw new BadRequestError(`Order ${child.order_code} khác địa chỉ giao — không thể gộp`);
      }

      await execute(conn, 'UPDATE orders SET merged_order_id = ? WHERE id = ?', [mainOrderId, childId]);
      await logActivity(conn, 'order', childId, user.id, `${user.name}: Gộp vào đơn ${main.order_code}`);
    }
    await logActivity(conn, 'order', mainOrderId, user.id, `${user.name}: Gộp ${input.child_order_ids.length} đơn phụ vào đơn này`);
  });
}
