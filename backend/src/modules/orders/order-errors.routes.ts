import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne } from '../../db/pool.js';
import { offsetOf, paginated, paginationSchema } from '../../core/pagination.js';
import { authenticate } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';

/**
 * Trang Đơn lỗi `/errors` (docs/01-phan-tich-quy-trinh/workflow.md mục 5):
 * liệt kê order_items bị ghi nhận lỗi trong sản xuất / QC,
 * lọc theo nguồn gốc lỗi (xuong | designer | phoi) và xưởng.
 */
const listErrorsSchema = paginationSchema.extend({
  error_at: z.enum(['xuong', 'designer', 'phoi']).optional(),
  supplier_id: z.coerce.number().int().positive().optional(),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
});

export const orderErrorsRouter = Router();

orderErrorsRouter.get('/errors', authenticate, authorize('orders.view'), async (req, res) => {
  const filters = listErrorsSchema.parse(req.query);
  const where: string[] = ['oi.error_reason IS NOT NULL'];
  const params: unknown[] = [];

  if (filters.error_at) { where.push('oi.error_at = ?'); params.push(filters.error_at); }
  if (filters.supplier_id) { where.push('o.supplier_id = ?'); params.push(filters.supplier_id); }
  if (filters.date_from) { where.push('oi.updated_at >= ?'); params.push(`${filters.date_from} 00:00:00`); }
  if (filters.date_to) { where.push('oi.updated_at <= ?'); params.push(`${filters.date_to} 23:59:59`); }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const countRow = await queryOne<{ total: number }>(
    pool,
    `SELECT COUNT(*) AS total FROM order_items oi JOIN orders o ON o.id = oi.order_id ${whereSql}`,
    params,
  );
  const rows = await query(
    pool,
    `SELECT oi.id, oi.order_id, o.order_code, oi.sku, oi.qty, oi.status,
            oi.error_at, oi.error_reason, oi.updated_at,
            pt.name AS product_type_name, sp.short_name AS supplier_name
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN product_types pt ON pt.id = oi.product_type_id
     LEFT JOIN suppliers sp ON sp.id = o.supplier_id
     ${whereSql}
     ORDER BY oi.updated_at DESC
     LIMIT ? OFFSET ?`,
    [...params, filters.per_page, offsetOf(filters)],
  );
  res.json(paginated(rows, countRow?.total ?? 0, filters));
});
