import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from '../../db/pool.js';
import { authenticate } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';

const rangeSchema = z.object({
  date_from: z.string().date(),
  date_to: z.string().date(),
  supplier_id: z.coerce.number().int().positive().optional(),
});

export const dashboardRouter = Router();
dashboardRouter.use('/dashboard', authenticate, authorize('warehouse.dashboard'));

/**
 * Dashboard Kho Xưởng (docs/01-phan-tich-quy-trinh/workflow.md mục 8):
 * trạng thái máy real-time, sản lượng theo máy, thống kê theo kỹ thuật viên.
 */
dashboardRouter.get('/dashboard/supplier', async (req, res) => {
  const { date_from, date_to, supplier_id } = rangeSchema.parse(req.query);
  const range = [`${date_from} 00:00:00`, `${date_to} 23:59:59`];
  const supplierFilter = supplier_id ? 'AND m.supplier_id = ?' : '';
  const supplierParams = supplier_id ? [supplier_id] : [];

  const [machines, byMachine, byOperator] = await Promise.all([
    // Grid máy: màu theo status + % hoàn thành trong kỳ
    query(
      pool,
      `SELECT m.id, m.name, m.status, m.heads,
              COUNT(oi.id) AS total_items,
              SUM(oi.status = 'done') AS done_items
       FROM machines m
       LEFT JOIN order_items oi ON oi.machine_id = m.id
         AND oi.production_started_at BETWEEN ? AND ?
       WHERE 1=1 ${supplierFilter}
       GROUP BY m.id`,
      [...range, ...supplierParams],
    ),
    // Bar chart: số item hoàn thành theo máy
    query(
      pool,
      `SELECT m.id, m.name, COUNT(oi.id) AS done_count
       FROM machines m
       JOIN order_items oi ON oi.machine_id = m.id
       WHERE oi.status = 'done' AND oi.production_finished_at BETWEEN ? AND ? ${supplierFilter}
       GROUP BY m.id ORDER BY done_count DESC`,
      [...range, ...supplierParams],
    ),
    // Bảng kỹ thuật viên: tổng SP, đang SX, xong, % lỗi, AVG time (phút)
    query(
      pool,
      `SELECT u.id, u.name,
              COUNT(oi.id) AS total_items,
              SUM(oi.status = 'in_progress') AS in_progress_items,
              SUM(oi.status = 'done') AS done_items,
              ROUND(100 * SUM(oi.error_reason IS NOT NULL) / COUNT(oi.id), 1) AS error_rate,
              ROUND(AVG(TIMESTAMPDIFF(MINUTE, oi.production_started_at, oi.production_finished_at)), 1) AS avg_minutes
       FROM users u
       JOIN order_items oi ON oi.operator_id = u.id
       LEFT JOIN machines m ON m.id = oi.machine_id
       WHERE oi.production_started_at BETWEEN ? AND ? ${supplier_id ? 'AND m.supplier_id = ?' : ''}
       GROUP BY u.id ORDER BY done_items DESC`,
      [...range, ...supplierParams],
    ),
  ]);

  res.json({ machines, by_machine: byMachine, by_operator: byOperator });
});
