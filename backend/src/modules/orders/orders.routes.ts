import { Router } from 'express';
import { pool, query, queryOne, execute, withTransaction } from '../../db/pool.js';
import { ForbiddenError, NotFoundError } from '../../core/http-error.js';
import { paginated } from '../../core/pagination.js';
import { resolvePermission } from '../../core/rbac.js';
import { buildSet } from '../../core/sql.js';
import { authenticate, currentUser } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';
import { logActivity } from '../activity-logs/activity-log.service.js';
import type { OrderStatus } from './order-status.js';
import { listOrders, loadOrderDetail, findOrderById } from './orders.repository.js';
import {
  cancelOrderSchema, changeStatusSchema, createOrderSchema, designFileSchema, itemNoteSchema,
  listOrdersSchema, mergeOrdersSchema, packageSchema, updateOrderItemSchema, updateOrderSchema,
} from './orders.schemas.js';
import { changeOrderStatus, createInternalOrder, mergeOrders } from './orders.service.js';

/**
 * Quyền cần có cho từng trạng thái đích — theo ma trận RBAC
 * (docs/03-quan-tri-he-thong/phan-quyen-rbac.md). Mặc định: orders.edit.
 */
const STATUS_PERMISSION: Partial<Record<OrderStatus, string>> = {
  designed: 'orders.approve_design',
  in_production: 'orders.push_factory',
  producing: 'warehouse.production_update',
  produced: 'warehouse.production_update',
  redo: 'warehouse.production_update',
  fixing: 'warehouse.production_update',
  factory_return: 'warehouse.production_update',
  in_finishing: 'warehouse.receive_order',
  qc_passed: 'warehouse.qc_scan',
  out_stock: 'warehouse.inventory_out',
  shipped: 'warehouse.scan_track',
  cancelled: 'orders.cancel',
};

export const ordersRouter = Router();
ordersRouter.use(authenticate);

ordersRouter.get('/orders', authorize('orders.view'), async (req, res) => {
  const filters = listOrdersSchema.parse(req.query);
  const { rows, total } = await listOrders(pool, filters);
  res.json(paginated(rows, total, filters));
});

/** Đếm order theo trạng thái — cho dashboard tổng quan. */
ordersRouter.get('/orders/stats', authorize('orders.view'), async (_req, res) => {
  const rows = await query<{ status: string; cnt: number }>(
    pool,
    'SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status',
  );
  res.json({ by_status: rows });
});

ordersRouter.get('/orders/:id', authorize('orders.view'), async (req, res) => {
  const detail = await loadOrderDetail(pool, Number(req.params.id));
  if (!detail) throw new NotFoundError('Không tìm thấy order');
  res.json(detail);
});

ordersRouter.post('/orders', authorize('orders.create'), async (req, res) => {
  const input = createOrderSchema.parse(req.body);
  const id = await createInternalOrder(input, currentUser(req));
  res.status(201).json({ id });
});

ordersRouter.patch('/orders/:id', authorize('orders.edit'), async (req, res) => {
  const id = Number(req.params.id);
  const user = currentUser(req);
  const input = updateOrderSchema.parse(req.body);

  const order = await findOrderById(pool, id);
  if (!order) throw new NotFoundError('Không tìm thấy order');

  // Quyền edit = "own": designer chỉ sửa order mình phụ trách
  if (resolvePermission(user.permissions, 'orders.edit') === 'own' && order.designer_id !== user.id) {
    throw new ForbiddenError('Chỉ được sửa order do bạn phụ trách');
  }

  const { clause, params } = buildSet({
    ...input,
    // Giao designer lần đầu → ghi mốc SLA design_assigned_at
    ...(input.designer_id && !order.design_assigned_at ? { design_assigned_at: new Date() } : {}),
  });
  if (clause) {
    await execute(pool, `UPDATE orders SET ${clause} WHERE id = ?`, [...params, id]);
    await logActivity(pool, 'order', id, user.id, `${user.name}: Cập nhật thông tin order`);
  }
  res.json({ ok: true });
});

ordersRouter.post('/orders/:id/status', async (req, res) => {
  const { status, note } = changeStatusSchema.parse(req.body);
  const user = currentUser(req);
  const permissionKey = STATUS_PERMISSION[status] ?? 'orders.edit';
  if (resolvePermission(user.permissions, permissionKey) === false) {
    throw new ForbiddenError(`Thiếu quyền: ${permissionKey}`);
  }
  await changeOrderStatus(Number(req.params.id), status, user, note);
  res.json({ ok: true });
});

ordersRouter.post('/orders/:id/cancel', authorize('orders.cancel'), async (req, res) => {
  const { reason } = cancelOrderSchema.parse(req.body);
  await changeOrderStatus(Number(req.params.id), 'cancelled', currentUser(req), reason);
  res.json({ ok: true });
});

ordersRouter.post('/orders/:id/merge', authorize('orders.edit'), async (req, res) => {
  const input = mergeOrdersSchema.parse(req.body);
  await mergeOrders(Number(req.params.id), input, currentUser(req));
  res.json({ ok: true });
});

// --- Packages -------------------------------------------------------------

ordersRouter.post('/orders/:id/packages', authorize('orders.edit'), async (req, res) => {
  const orderId = Number(req.params.id);
  const input = packageSchema.parse(req.body);
  const order = await findOrderById(pool, orderId);
  if (!order) throw new NotFoundError('Không tìm thấy order');

  const result = await execute(
    pool,
    'INSERT INTO order_packages (order_id, tracking_number, carrier, weight, note) VALUES (?, ?, ?, ?, ?)',
    [orderId, input.tracking_number ?? null, input.carrier ?? null, input.weight ?? null, input.note ?? null],
  );
  res.status(201).json({ id: result.insertId });
});

ordersRouter.patch('/orders/:id/packages/:packageId', authorize('orders.edit'), async (req, res) => {
  const input = packageSchema.partial().parse(req.body);
  const pkg = await queryOne(pool, 'SELECT id FROM order_packages WHERE id = ? AND order_id = ?', [
    Number(req.params.packageId),
    Number(req.params.id),
  ]);
  if (!pkg) throw new NotFoundError('Không tìm thấy kiện hàng');

  const { clause, params } = buildSet(input);
  if (clause) await execute(pool, `UPDATE order_packages SET ${clause} WHERE id = ?`, [...params, Number(req.params.packageId)]);
  res.json({ ok: true });
});

// --- Order items (sản xuất) ------------------------------------------------

ordersRouter.patch('/order-items/:id', authorize('warehouse.production_update'), async (req, res) => {
  const id = Number(req.params.id);
  const user = currentUser(req);
  const input = updateOrderItemSchema.parse(req.body);
  const item = await queryOne<{ id: number; status: string; production_started_at: string | null }>(
    pool,
    'SELECT id, status, production_started_at FROM order_items WHERE id = ?',
    [id],
  );
  if (!item) throw new NotFoundError('Không tìm thấy order item');

  const { clause, params } = buildSet({
    ...input,
    // Mốc thời gian SX cho AVG Time trên dashboard
    ...(input.status === 'in_progress' && !item.production_started_at ? { production_started_at: new Date() } : {}),
    ...(input.status === 'done' ? { production_finished_at: new Date() } : {}),
  });
  if (clause) {
    await execute(pool, `UPDATE order_items SET ${clause} WHERE id = ?`, [...params, id]);
    await logActivity(pool, 'order_item', id, user.id,
      `${user.name}: Cập nhật sản xuất${input.status ? ` → ${input.status}` : ''}`);
  }
  res.json({ ok: true });
});

ordersRouter.post('/order-items/:id/notes', authorize('orders.view'), async (req, res) => {
  const id = Number(req.params.id);
  const input = itemNoteSchema.parse(req.body);
  const item = await queryOne(pool, 'SELECT id FROM order_items WHERE id = ?', [id]);
  if (!item) throw new NotFoundError('Không tìm thấy order item');

  const result = await execute(
    pool,
    'INSERT INTO order_item_notes (order_item_id, note, images, created_by) VALUES (?, ?, ?, ?)',
    [id, input.note, input.images ? JSON.stringify(input.images) : null, currentUser(req).id],
  );
  res.status(201).json({ id: result.insertId });
});

ordersRouter.post('/order-items/:id/design-files', authorize('orders.upload_design'), async (req, res) => {
  const id = Number(req.params.id);
  const input = designFileSchema.parse(req.body);
  const user = currentUser(req);
  const item = await queryOne(pool, 'SELECT id FROM order_items WHERE id = ?', [id]);
  if (!item) throw new NotFoundError('Không tìm thấy order item');

  // Re-upload sau redo/fixing: file cũ cùng vị trí + loại bị vô hiệu, luôn chỉ 1 file active
  const fileId = await withTransaction(async (conn) => {
    await execute(
      conn,
      'UPDATE order_item_design_files SET is_active = 0 WHERE order_item_id = ? AND position = ? AND file_type = ?',
      [id, input.position, input.file_type],
    );
    const result = await execute(
      conn,
      `INSERT INTO order_item_design_files (order_item_id, position, file_type, file_path, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
      [id, input.position, input.file_type, input.file_path, user.id],
    );
    await logActivity(conn, 'order_item', id, user.id, `${user.name}: Upload file ${input.file_type} (${input.position})`);
    return result.insertId;
  });
  res.status(201).json({ id: fileId });
});
