import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne, execute } from '../../db/pool.js';
import { NotFoundError } from '../../core/http-error.js';
import { buildSet } from '../../core/sql.js';
import { authenticate, currentUser } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';
import { logActivity } from '../activity-logs/activity-log.service.js';

const machineSchema = z.object({
  name: z.string().min(1).max(100),
  model: z.string().max(100).nullable().optional(),
  supplier_id: z.number().int().positive().nullable().optional(),
  status: z.enum(['idle', 'active', 'error', 'maintenance']).default('idle'),
  heads: z.number().int().min(1).default(1),
});

export const machinesRouter = Router();
machinesRouter.use('/machines', authenticate, authorize('warehouse.machine'));

machinesRouter.get('/machines', async (_req, res) => {
  const rows = await query(
    pool,
    `SELECT m.*, s.short_name AS supplier_name
     FROM machines m LEFT JOIN suppliers s ON s.id = m.supplier_id ORDER BY m.id`,
  );
  res.json({ data: rows });
});

machinesRouter.post('/machines', async (req, res) => {
  const input = machineSchema.parse(req.body);
  const result = await execute(
    pool,
    'INSERT INTO machines (name, model, supplier_id, status, heads) VALUES (?, ?, ?, ?, ?)',
    [input.name, input.model ?? null, input.supplier_id ?? null, input.status, input.heads],
  );
  res.status(201).json({ id: result.insertId });
});

machinesRouter.patch('/machines/:id', async (req, res) => {
  const id = Number(req.params.id);
  const input = machineSchema.partial().parse(req.body);
  const machine = await queryOne(pool, 'SELECT id FROM machines WHERE id = ?', [id]);
  if (!machine) throw new NotFoundError('Không tìm thấy máy thêu');

  const { clause, params } = buildSet(input);
  if (clause) {
    await execute(pool, `UPDATE machines SET ${clause} WHERE id = ?`, [...params, id]);
    if (input.status !== undefined) {
      await logActivity(pool, 'machine', id, currentUser(req).id, `Đổi trạng thái máy → ${input.status}`);
    }
  }
  res.json({ ok: true });
});
