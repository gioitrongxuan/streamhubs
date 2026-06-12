import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne, execute } from '../../db/pool.js';
import { NotFoundError } from '../../core/http-error.js';
import { buildSet } from '../../core/sql.js';
import { authenticate } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';

const designLevelSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().nullable().optional(),
});

export const designLevelsRouter = Router();
designLevelsRouter.use('/design-levels', authenticate, authorize('mdm.design_levels'));

designLevelsRouter.get('/design-levels', async (_req, res) => {
  const rows = await query(pool, 'SELECT * FROM design_levels ORDER BY id');
  res.json({ data: rows });
});

designLevelsRouter.post('/design-levels', async (req, res) => {
  const input = designLevelSchema.parse(req.body);
  const result = await execute(
    pool,
    'INSERT INTO design_levels (name, description) VALUES (?, ?)',
    [input.name, input.description ?? null],
  );
  res.status(201).json({ id: result.insertId });
});

designLevelsRouter.patch('/design-levels/:id', async (req, res) => {
  const id = Number(req.params.id);
  const input = designLevelSchema.partial().parse(req.body);
  const level = await queryOne(pool, 'SELECT id FROM design_levels WHERE id = ?', [id]);
  if (!level) throw new NotFoundError('Không tìm thấy cấp độ thiết kế');

  const { clause, params } = buildSet(input);
  if (clause) await execute(pool, `UPDATE design_levels SET ${clause} WHERE id = ?`, [...params, id]);
  res.json({ ok: true });
});
