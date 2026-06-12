import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne, execute } from '../../db/pool.js';
import { NotFoundError } from '../../core/http-error.js';
import { buildSet } from '../../core/sql.js';
import { authenticate } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';

const shopSchema = z.object({
  name: z.string().min(1).max(100),
  order_prefix: z.string().min(1).max(5),
  etsy_shop_id: z.string().max(50).nullable().optional(),
  etsy_api_key: z.string().max(255).nullable().optional(),
  sync_interval: z.number().int().min(1).max(1440).default(10),
  default_designer_id: z.number().int().positive().nullable().optional(),
  sender_name: z.string().max(100).nullable().optional(),
  sender_address: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
});

export const shopsRouter = Router();
shopsRouter.use('/shops', authenticate, authorize('system.shops'));

shopsRouter.get('/shops', async (_req, res) => {
  // Không trả etsy_api_key ra danh sách
  const rows = await query(
    pool,
    `SELECT id, name, order_prefix, etsy_shop_id, sync_interval, default_designer_id,
            sender_name, sender_address, is_active
     FROM shops ORDER BY id`,
  );
  res.json({ data: rows });
});

shopsRouter.post('/shops', async (req, res) => {
  const input = shopSchema.parse(req.body);
  const result = await execute(
    pool,
    `INSERT INTO shops (name, order_prefix, etsy_shop_id, etsy_api_key, sync_interval,
                        default_designer_id, sender_name, sender_address, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.name, input.order_prefix, input.etsy_shop_id ?? null, input.etsy_api_key ?? null,
     input.sync_interval, input.default_designer_id ?? null, input.sender_name ?? null,
     input.sender_address ?? null, input.is_active ? 1 : 0],
  );
  res.status(201).json({ id: result.insertId });
});

shopsRouter.patch('/shops/:id', async (req, res) => {
  const id = Number(req.params.id);
  const input = shopSchema.partial().parse(req.body);
  const shop = await queryOne(pool, 'SELECT id FROM shops WHERE id = ?', [id]);
  if (!shop) throw new NotFoundError('Không tìm thấy shop');

  const { clause, params } = buildSet(input);
  if (clause) {
    await execute(pool, `UPDATE shops SET ${clause} WHERE id = ?`, [...params, id]);
  }
  res.json({ ok: true });
});
