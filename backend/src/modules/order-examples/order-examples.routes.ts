import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne, execute } from '../../db/pool.js';
import { NotFoundError } from '../../core/http-error.js';
import { buildSet } from '../../core/sql.js';
import { authenticate, currentUser } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';

/**
 * Đơn hàng mẫu (docs/02-kien-truc-csdl/database-schema.md — order_examples):
 * lưu cấu hình mẫu để tạo nhanh đơn mới không cần nhập lại từ đầu.
 */
const orderExampleSchema = z.object({
  name: z.string().min(1).max(100),
  product_type_id: z.number().int().positive(),
  image: z.string().max(255).nullable().optional(),
  description: z.string().nullable().optional(),
  content: z
    .object({
      variants: z.record(z.string()).optional(),
      positions: z.array(z.string()).optional(),
      personalization_template: z.string().optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
  is_active: z.boolean().default(true),
});

export const orderExamplesRouter = Router();
orderExamplesRouter.use('/order-examples', authenticate);

orderExamplesRouter.get('/order-examples', authorize('orders.view'), async (_req, res) => {
  const rows = await query(
    pool,
    `SELECT oe.*, pt.name AS product_type_name, u.name AS created_by_name
     FROM order_examples oe
     JOIN product_types pt ON pt.id = oe.product_type_id
     JOIN users u ON u.id = oe.created_by
     WHERE oe.is_active = 1 ORDER BY oe.id DESC`,
  );
  res.json({ data: rows });
});

orderExamplesRouter.post('/order-examples', authorize('orders.create'), async (req, res) => {
  const input = orderExampleSchema.parse(req.body);
  const result = await execute(
    pool,
    `INSERT INTO order_examples (name, product_type_id, image, description, content, created_by, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [input.name, input.product_type_id, input.image ?? null, input.description ?? null,
     input.content ? JSON.stringify(input.content) : null, currentUser(req).id, input.is_active ? 1 : 0],
  );
  res.status(201).json({ id: result.insertId });
});

orderExamplesRouter.patch('/order-examples/:id', authorize('orders.create'), async (req, res) => {
  const id = Number(req.params.id);
  const input = orderExampleSchema.partial().parse(req.body);
  const example = await queryOne(pool, 'SELECT id FROM order_examples WHERE id = ?', [id]);
  if (!example) throw new NotFoundError('Không tìm thấy đơn hàng mẫu');

  const { content, ...rest } = input;
  const { clause, params } = buildSet({
    ...rest,
    ...(content !== undefined ? { content: content ? JSON.stringify(content) : null } : {}),
  });
  if (clause) await execute(pool, `UPDATE order_examples SET ${clause} WHERE id = ?`, [...params, id]);
  res.json({ ok: true });
});
