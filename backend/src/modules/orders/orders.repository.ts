import { query, queryOne, execute, type Queryable } from '../../db/pool.js';
import type { OrderStatus } from './order-status.js';
import type { z } from 'zod';
import type { listOrdersSchema, orderItemInputSchema } from './orders.schemas.js';
import { offsetOf } from '../../core/pagination.js';

export interface OrderRow {
  id: number;
  order_code: string;
  order_type: 'etsy' | 'internal';
  shop_id: number;
  status: OrderStatus;
  designer_id: number | null;
  supplier_id: number | null;
  fulfill_type: 'internal' | 'external';
  merged_order_id: number | null;
  address_line1: string | null;
  zipcode: string | null;
  design_assigned_at: string | null;
  [key: string]: unknown;
}

export async function findOrderById(db: Queryable, id: number, forUpdate = false): Promise<OrderRow | undefined> {
  return queryOne<OrderRow>(db, `SELECT * FROM orders WHERE id = ?${forUpdate ? ' FOR UPDATE' : ''}`, [id]);
}

export async function listOrders(db: Queryable, filters: z.infer<typeof listOrdersSchema>) {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    const statuses = filters.status.split(',').map((s) => s.trim()).filter(Boolean);
    if (statuses.length > 0) {
      where.push(`o.status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
  }
  if (filters.shop_id) { where.push('o.shop_id = ?'); params.push(filters.shop_id); }
  if (filters.designer_id) { where.push('o.designer_id = ?'); params.push(filters.designer_id); }
  if (filters.supplier_id) { where.push('o.supplier_id = ?'); params.push(filters.supplier_id); }
  if (filters.fulfill_type) { where.push('o.fulfill_type = ?'); params.push(filters.fulfill_type); }
  if (filters.label) {
    // Tạm chấp nhận LIKE — xem migration plan sang order_labels trong docs khi >200K orders
    where.push("CONCAT(',', COALESCE(o.labels, ''), ',') LIKE ?");
    params.push(`%,${filters.label},%`);
  }
  if (filters.q) {
    where.push('(o.order_code LIKE ? OR o.etsy_order_id LIKE ? OR o.receiver_name LIKE ?)');
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }
  if (filters.date_from) { where.push('o.created_at >= ?'); params.push(`${filters.date_from} 00:00:00`); }
  if (filters.date_to) { where.push('o.created_at <= ?'); params.push(`${filters.date_to} 23:59:59`); }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countRow = await queryOne<{ total: number }>(db, `SELECT COUNT(*) AS total FROM orders o ${whereSql}`, params);
  const rows = await query(
    db,
    `SELECT o.id, o.order_code, o.order_type, o.etsy_order_id, o.shop_id, sh.name AS shop_name,
            o.listing_name, o.status, o.fulfill_type, o.labels, o.is_dup, o.is_digital,
            o.designer_id, du.name AS designer_name, o.supplier_id, sp.short_name AS supplier_name,
            o.order_total, o.currency, o.country, o.merged_order_id,
            o.created_at, o.pushed_at, o.shipped_at, o.qc_passed_at
     FROM orders o
     JOIN shops sh ON sh.id = o.shop_id
     LEFT JOIN users du ON du.id = o.designer_id
     LEFT JOIN suppliers sp ON sp.id = o.supplier_id
     ${whereSql}
     ORDER BY o.created_at DESC, o.id DESC
     LIMIT ? OFFSET ?`,
    [...params, filters.per_page, offsetOf(filters)],
  );
  return { rows, total: countRow?.total ?? 0 };
}

export async function loadOrderDetail(db: Queryable, id: number) {
  const order = await queryOne(
    db,
    `SELECT o.*, sh.name AS shop_name, du.name AS designer_name, cu.name AS cs_name,
            sp.short_name AS supplier_name
     FROM orders o
     JOIN shops sh ON sh.id = o.shop_id
     LEFT JOIN users du ON du.id = o.designer_id
     LEFT JOIN users cu ON cu.id = o.cs_id
     LEFT JOIN suppliers sp ON sp.id = o.supplier_id
     WHERE o.id = ?`,
    [id],
  );
  if (!order) return undefined;

  const items = await query<{ id: number }>(
    db,
    `SELECT oi.*, pt.name AS product_type_name, m.name AS machine_name, op.name AS operator_name
     FROM order_items oi
     JOIN product_types pt ON pt.id = oi.product_type_id
     LEFT JOIN machines m ON m.id = oi.machine_id
     LEFT JOIN users op ON op.id = oi.operator_id
     WHERE oi.order_id = ?`,
    [id],
  );
  const itemIds = items.map((i) => i.id);
  const inClause = itemIds.map(() => '?').join(',');

  const [designFiles, notes, packages, mergedChildren] = await Promise.all([
    itemIds.length
      ? query(db, `SELECT * FROM order_item_design_files WHERE order_item_id IN (${inClause}) AND is_active = 1`, itemIds)
      : Promise.resolve([]),
    itemIds.length
      ? query(
          db,
          `SELECT n.*, u.name AS created_by_name FROM order_item_notes n
           JOIN users u ON u.id = n.created_by
           WHERE n.order_item_id IN (${inClause}) ORDER BY n.id DESC`,
          itemIds,
        )
      : Promise.resolve([]),
    query(db, 'SELECT * FROM order_packages WHERE order_id = ?', [id]),
    query(db, 'SELECT id, order_code, status FROM orders WHERE merged_order_id = ?', [id]),
  ]);

  return { ...order, items, design_files: designFiles, item_notes: notes, packages, merged_children: mergedChildren };
}

export async function insertOrderItem(
  db: Queryable,
  orderId: number,
  item: z.infer<typeof orderItemInputSchema>,
): Promise<number> {
  const result = await execute(
    db,
    `INSERT INTO order_items (order_id, product_type_id, listing_user_id, sku, qty, price_sale,
                              sup_cost, design_cost, variants, personalization, hscode, hs_name, hs_price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, item.product_type_id, item.listing_user_id ?? null, item.sku ?? null, item.qty,
     item.price_sale ?? null, item.sup_cost ?? null, item.design_cost ?? null,
     item.variants ? JSON.stringify(item.variants) : null, item.personalization ?? null,
     item.hscode ?? null, item.hs_name ?? null, item.hs_price ?? null],
  );
  return result.insertId;
}
