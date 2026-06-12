import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne, execute } from '../../db/pool.js';
import { NotFoundError } from '../../core/http-error.js';
import { buildSet } from '../../core/sql.js';
import { authenticate } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';

const supplierSchema = z.object({
  name: z.string().min(1).max(100),
  short_name: z.string().max(50).nullable().optional(),
  type: z.enum(['internal', 'external_fulfill', 'material']),
  contact_name: z.string().max(100).nullable().optional(),
  contact_phone: z.string().max(20).nullable().optional(),
  bank_account: z.string().max(100).nullable().optional(),
  bank_name: z.string().max(100).nullable().optional(),
  bank_holder: z.string().max(100).nullable().optional(),
  payment_days: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

export const suppliersRouter = Router();
suppliersRouter.use('/suppliers', authenticate, authorize('mdm.suppliers'));

suppliersRouter.get('/suppliers', async (_req, res) => {
  const rows = await query(pool, 'SELECT * FROM suppliers ORDER BY id');
  res.json({ data: rows });
});

suppliersRouter.post('/suppliers', async (req, res) => {
  const input = supplierSchema.parse(req.body);
  const result = await execute(
    pool,
    `INSERT INTO suppliers (name, short_name, type, contact_name, contact_phone,
                            bank_account, bank_name, bank_holder, payment_days, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.name, input.short_name ?? null, input.type, input.contact_name ?? null,
     input.contact_phone ?? null, input.bank_account ?? null, input.bank_name ?? null,
     input.bank_holder ?? null, input.payment_days, input.is_active ? 1 : 0],
  );
  res.status(201).json({ id: result.insertId });
});

suppliersRouter.patch('/suppliers/:id', async (req, res) => {
  const id = Number(req.params.id);
  const input = supplierSchema.partial().parse(req.body);
  const supplier = await queryOne(pool, 'SELECT id FROM suppliers WHERE id = ?', [id]);
  if (!supplier) throw new NotFoundError('Không tìm thấy nhà cung cấp');

  const { clause, params } = buildSet(input);
  if (clause) await execute(pool, `UPDATE suppliers SET ${clause} WHERE id = ?`, [...params, id]);
  res.json({ ok: true });
});
