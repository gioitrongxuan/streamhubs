import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne, execute, withTransaction } from '../../db/pool.js';
import { NotFoundError } from '../../core/http-error.js';
import { authenticate, currentUser } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';
import { logActivity } from '../activity-logs/activity-log.service.js';
import { assertTransition, type OrderStatus } from '../orders/order-status.js';

const receiveSchema = z.object({
  order_id: z.number().int().positive(),
  supplier_id: z.number().int().positive(),
  received_date: z.string().date(),
  shipping_fee: z.number().nonnegative().default(0),
  note: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        order_item_id: z.number().int().positive().nullable().optional(),
        sent_qty: z.number().int().min(0),
        received_qty: z.number().int().min(0),
        note: z.string().nullable().optional(),
      }),
    )
    .min(1),
});

export const receiveOrdersRouter = Router();
receiveOrdersRouter.use('/receive-orders', authenticate, authorize('warehouse.receive_order'));

receiveOrdersRouter.get('/receive-orders', async (req, res) => {
  const orderId = req.query.order_id ? Number(req.query.order_id) : undefined;
  const sessions = await query(
    pool,
    `SELECT rs.*, o.order_code, s.short_name AS supplier_name, u.name AS received_by_name
     FROM receive_sessions rs
     JOIN orders o ON o.id = rs.order_id
     JOIN suppliers s ON s.id = rs.supplier_id
     JOIN users u ON u.id = rs.received_by
     ${orderId ? 'WHERE rs.order_id = ?' : ''}
     ORDER BY rs.id DESC LIMIT 200`,
    orderId ? [orderId] : [],
  );
  res.json({ data: sessions });
});

/**
 * Một phiên nhận hàng = 1 transaction:
 * insert receive_sessions (header, giữ shipping_fee 1 lần duy nhất)
 * + receive_order_logs (detail), rồi chuyển order/items → in_finishing.
 * Luồng theo docs/01-phan-tich-quy-trinh/workflow.md mục 6.2.
 */
receiveOrdersRouter.post('/receive-orders', async (req, res) => {
  const input = receiveSchema.parse(req.body);
  const user = currentUser(req);

  const sessionId = await withTransaction(async (conn) => {
    const order = await queryOne<{ id: number; status: OrderStatus; order_code: string }>(
      conn,
      'SELECT id, status, order_code FROM orders WHERE id = ? FOR UPDATE',
      [input.order_id],
    );
    if (!order) throw new NotFoundError('Không tìm thấy order');
    assertTransition(order.status, 'in_finishing');

    const session = await execute(
      conn,
      `INSERT INTO receive_sessions (order_id, supplier_id, received_date, shipping_fee, received_by, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.order_id, input.supplier_id, input.received_date, input.shipping_fee, user.id, input.note ?? null],
    );

    for (const item of input.items) {
      await execute(
        conn,
        `INSERT INTO receive_order_logs (session_id, order_id, order_item_id, sent_qty, received_qty, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [session.insertId, input.order_id, item.order_item_id ?? null, item.sent_qty, item.received_qty, item.note ?? null],
      );
    }

    await execute(conn, "UPDATE orders SET status = 'in_finishing' WHERE id = ?", [input.order_id]);
    await execute(conn, "UPDATE order_items SET status = 'in_finishing' WHERE order_id = ?", [input.order_id]);
    await logActivity(conn, 'receive_session', session.insertId, user.id,
      `${user.name}: Nhận hàng từ xưởng cho đơn ${order.order_code}`);
    await logActivity(conn, 'order', input.order_id, user.id,
      `${user.name}: Nhận hàng từ xưởng — chuyển in_finishing`);
    return session.insertId;
  });

  res.status(201).json({ id: sessionId });
});
