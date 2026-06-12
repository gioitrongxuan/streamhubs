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

paymentRequestsRouter.get('/payment-requests', authorize('payment.view'), async (req, res) => {
  const filters = listPaymentRequestsSchema.parse(req.query);
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.status) { where.push('pr.status = ?'); params.push(filters.status); }
  if (filters.payment_group) { where.push('pr.payment_group = ?'); params.push(filters.payment_group); }
  if (filters.supplier_id) { where.push('pr.supplier_id = ?'); params.push(filters.supplier_id); }
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
            (pr.due_date < CURDATE() AND pr.status NOT IN ('paid', 'rejected')) AS is_overdue
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
