import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne, execute, withTransaction } from '../../db/pool.js';
import { NotFoundError } from '../../core/http-error.js';
import { authenticate, currentUser } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';
import { logActivity } from '../activity-logs/activity-log.service.js';
import { createCarrierClient } from '../../integrations/carrier/carrier-client.js';

const createLabelSchema = z.object({
  order_id: z.number().int().positive(),
  package_id: z.number().int().positive(),
  carrier: z.string().min(1).max(50),
  service: z.string().max(100).nullable().optional(),
});

const carrierClient = createCarrierClient();

export const autoLabelsRouter = Router();
autoLabelsRouter.use('/auto-labels', authenticate, authorize('system.auto_label'));

autoLabelsRouter.get('/auto-labels', async (req, res) => {
  const orderId = req.query.order_id ? Number(req.query.order_id) : undefined;
  const rows = await query(
    pool,
    `SELECT al.*, o.order_code FROM auto_labels al
     JOIN orders o ON o.id = al.order_id
     ${orderId ? 'WHERE al.order_id = ?' : ''}
     ORDER BY al.id DESC LIMIT 200`,
    orderId ? [orderId] : [],
  );
  res.json({ data: rows });
});

/**
 * Tạo label qua carrier API. Tracking sync rule (docs database-schema.md):
 * auto_labels là source of truth — khi generated, ghi tracking sang
 * order_packages.tracking_number trong CÙNG transaction.
 */
autoLabelsRouter.post('/auto-labels', async (req, res) => {
  const input = createLabelSchema.parse(req.body);
  const user = currentUser(req);

  const order = await queryOne<{
    id: number; order_code: string; receiver_name: string | null; address_line1: string | null;
    address_line2: string | null; city: string | null; state: string | null; zipcode: string | null;
    country: string | null; phone: string | null;
  }>(pool, 'SELECT * FROM orders WHERE id = ?', [input.order_id]);
  if (!order) throw new NotFoundError('Không tìm thấy order');

  const pkg = await queryOne<{ id: number; weight: number | null }>(
    pool,
    'SELECT id, weight FROM order_packages WHERE id = ? AND order_id = ?',
    [input.package_id, input.order_id],
  );
  if (!pkg) throw new NotFoundError('Không tìm thấy kiện hàng của order này');

  const inserted = await execute(
    pool,
    `INSERT INTO auto_labels (order_id, package_id, carrier, service, status, created_by)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
    [input.order_id, input.package_id, input.carrier, input.service ?? null, user.id],
  );
  const labelId = inserted.insertId;

  try {
    const label = await carrierClient.createLabel({
      carrier: input.carrier,
      service: input.service ?? undefined,
      receiver: {
        name: order.receiver_name, address_line1: order.address_line1, address_line2: order.address_line2,
        city: order.city, state: order.state, zipcode: order.zipcode, country: order.country, phone: order.phone,
      },
      weight_gram: pkg.weight,
    });

    await withTransaction(async (conn) => {
      await execute(
        conn,
        "UPDATE auto_labels SET status = 'generated', tracking_number = ?, label_url = ? WHERE id = ?",
        [label.tracking_number, label.label_url, labelId],
      );
      await execute(conn, 'UPDATE order_packages SET tracking_number = ?, carrier = ? WHERE id = ?', [
        label.tracking_number, input.carrier, input.package_id,
      ]);
      await logActivity(conn, 'auto_label', labelId, user.id,
        `${user.name}: Tạo label ${input.carrier} cho đơn ${order.order_code} — tracking ${label.tracking_number}`);
    });
    res.status(201).json({ id: labelId, ...label });
  } catch (err) {
    await execute(pool, "UPDATE auto_labels SET status = 'failed' WHERE id = ?", [labelId]);
    throw err;
  }
});

autoLabelsRouter.post('/auto-labels/:id/printed', async (req, res) => {
  const id = Number(req.params.id);
  const label = await queryOne<{ status: string }>(pool, 'SELECT status FROM auto_labels WHERE id = ?', [id]);
  if (!label) throw new NotFoundError('Không tìm thấy label');
  await execute(pool, "UPDATE auto_labels SET status = 'printed' WHERE id = ? AND status = 'generated'", [id]);
  res.json({ ok: true });
});
