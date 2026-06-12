import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne, execute } from '../../db/pool.js';
import { NotFoundError } from '../../core/http-error.js';
import { offsetOf, paginated } from '../../core/pagination.js';
import { authenticate, currentUser } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';
import {
  approvalSchema, createPaymentRequestSchema, listPaymentRequestsSchema, markPaidSchema,
} from './payment-requests.schemas.js';
import { createPaymentRequest, loadPaymentRequestDetail, markPaid, recordApproval } from './payment-requests.service.js';

const fileSchema = z.object({ file_path: z.string().min(1).max(255) });

export const paymentRequestsRouter = Router();
paymentRequestsRouter.use('/payment-requests', authenticate);

/**
 * Thống kê KPI cho dashboard thanh toán (đăng ký trước /:id để không bị nuốt route):
 * đếm + tổng tiền theo trạng thái, quá hạn (derived), danh sách sắp đến hạn.
 */
paymentRequestsRouter.get('/payment-requests/stats', authorize('payment.view'), async (req, res) => {
  const range = z
    .object({ date_from: z.string().date().optional(), date_to: z.string().date().optional() })
    .parse(req.query);
  const where: string[] = [];
  const params: unknown[] = [];
  if (range.date_from) { where.push('created_at >= ?'); params.push(`${range.date_from} 00:00:00`); }
  if (range.date_to) { where.push('created_at <= ?'); params.push(`${range.date_to} 23:59:59`); }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [byStatus, overdue, dueSoon] = await Promise.all([
    query<{ status: string; cnt: number; total_vnd: number; total_usd: number }>(
      pool,
      `SELECT status, COUNT(*) AS cnt,
              SUM(IF(currency = 'VND', total_amount, 0)) AS total_vnd,
              SUM(IF(currency = 'USD', total_amount, 0)) AS total_usd
       FROM payment_requests ${whereSql} GROUP BY status`,
      params,
    ),
    queryOne<{ cnt: number; total_vnd: number; total_usd: number }>(
      pool,
      `SELECT COUNT(*) AS cnt,
              SUM(IF(currency = 'VND', total_amount, 0)) AS total_vnd,
              SUM(IF(currency = 'USD', total_amount, 0)) AS total_usd
       FROM payment_requests
       ${whereSql ? `${whereSql} AND` : 'WHERE'} due_date < CURDATE() AND status NOT IN ('paid', 'rejected')`,
      params,
    ),
    query(
      pool,
      `SELECT pr.id, pr.serial_number, pr.total_amount, pr.currency, pr.due_date, u.name AS created_by_name,
              DATEDIFF(CURDATE(), pr.due_date) AS overdue_days
       FROM payment_requests pr JOIN users u ON u.id = pr.created_by
       WHERE pr.status NOT IN ('paid', 'rejected') AND pr.due_date IS NOT NULL
       ORDER BY pr.due_date ASC LIMIT 10`,
    ),
  ]);
  res.json({ by_status: byStatus, overdue, due_soon: dueSoon });
});

paymentRequestsRouter.get('/payment-requests', authorize('payment.view'), async (req, res) => {
  const filters = listPaymentRequestsSchema.parse(req.query);
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.status) { where.push('pr.status = ?'); params.push(filters.status); }
  if (filters.payment_group) { where.push('pr.payment_group = ?'); params.push(filters.payment_group); }
  if (filters.supplier_id) { where.push('pr.supplier_id = ?'); params.push(filters.supplier_id); }
  if (filters.q) {
    where.push('(pr.serial_number LIKE ? OR pr.content LIKE ?)');
    params.push(`%${filters.q}%`, `%${filters.q}%`);
  }
  if (filters.overdue) {
    where.push("pr.due_date < CURDATE() AND pr.status NOT IN ('paid', 'rejected')");
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countRow = await queryOne<{ total: number }>(
    pool, `SELECT COUNT(*) AS total FROM payment_requests pr ${whereSql}`, params,
  );
  const rows = await query(
    pool,
    `SELECT pr.id, pr.serial_number, pr.payment_group, pr.total_amount, pr.currency, pr.status,
            pr.due_date, pr.paid_date, pr.created_at, s.name AS supplier_name, u.name AS created_by_name,
            (pr.due_date < CURDATE() AND pr.status NOT IN ('paid', 'rejected')) AS is_overdue,
            (SELECT GROUP_CONCAT(au.name SEPARATOR ', ') FROM payment_request_approvers pa
             JOIN users au ON au.id = pa.user_id WHERE pa.payment_request_id = pr.id) AS approver_names
     FROM payment_requests pr
     LEFT JOIN suppliers s ON s.id = pr.supplier_id
     JOIN users u ON u.id = pr.created_by
     ${whereSql}
     ORDER BY pr.id DESC LIMIT ? OFFSET ?`,
    [...params, filters.per_page, offsetOf(filters)],
  );
  res.json(paginated(rows, countRow?.total ?? 0, filters));
});

paymentRequestsRouter.get('/payment-requests/:id', authorize('payment.view'), async (req, res) => {
  const detail = await loadPaymentRequestDetail(pool, Number(req.params.id));
  if (!detail) throw new NotFoundError('Không tìm thấy đề nghị thanh toán');
  res.json(detail);
});

paymentRequestsRouter.post('/payment-requests', authorize('payment.create'), async (req, res) => {
  const input = createPaymentRequestSchema.parse(req.body);
  const result = await createPaymentRequest(input, currentUser(req));
  res.status(201).json(result);
});

paymentRequestsRouter.post('/payment-requests/:id/approval', authorize('payment.approve'), async (req, res) => {
  const input = approvalSchema.parse(req.body);
  await recordApproval(Number(req.params.id), input, currentUser(req));
  res.json({ ok: true });
});

paymentRequestsRouter.post('/payment-requests/:id/mark-paid', authorize('payment.mark_paid'), async (req, res) => {
  const input = markPaidSchema.parse(req.body);
  await markPaid(Number(req.params.id), input, currentUser(req));
  res.json({ ok: true });
});

paymentRequestsRouter.post('/payment-requests/:id/files', authorize('payment.create'), async (req, res) => {
  const id = Number(req.params.id);
  const input = fileSchema.parse(req.body);
  const request = await queryOne(pool, 'SELECT id FROM payment_requests WHERE id = ?', [id]);
  if (!request) throw new NotFoundError('Không tìm thấy đề nghị thanh toán');

  const result = await execute(
    pool,
    'INSERT INTO payment_request_files (payment_request_id, file_path, created_by) VALUES (?, ?, ?)',
    [id, input.file_path, currentUser(req).id],
  );
  res.status(201).json({ id: result.insertId });
});
