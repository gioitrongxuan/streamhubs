import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne, execute } from '../../db/pool.js';
import { NotFoundError } from '../../core/http-error.js';
import { buildSet } from '../../core/sql.js';
import { authenticate } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';

const shelfSchema = z.object({
  name: z.string().min(1).max(50),
  capacity: z.number().int().min(0).default(0),
  location: z.string().max(100).nullable().optional(),
});

export const shelvesRouter = Router();
shelvesRouter.use('/shelves', authenticate, authorize('warehouse.shelf'));

shelvesRouter.get('/shelves', async (_req, res) => {
  // current_count là denormalized — chỉ inventory service được phép cập nhật
  const rows = await query(pool, 'SELECT * FROM shelves ORDER BY id');
  res.json({ data: rows });
});

shelvesRouter.post('/shelves', async (req, res) => {
  const input = shelfSchema.parse(req.body);
  const result = await execute(
    pool,
    'INSERT INTO shelves (name, capacity, location) VALUES (?, ?, ?)',
    [input.name, input.capacity, input.location ?? null],
  );
  res.status(201).json({ id: result.insertId });
});

shelvesRouter.patch('/shelves/:id', async (req, res) => {
  const id = Number(req.params.id);
  const input = shelfSchema.partial().parse(req.body);
  const shelf = await queryOne(pool, 'SELECT id FROM shelves WHERE id = ?', [id]);
  if (!shelf) throw new NotFoundError('Không tìm thấy kệ hàng');

  const { clause, params } = buildSet(input);
  if (clause) await execute(pool, `UPDATE shelves SET ${clause} WHERE id = ?`, [...params, id]);
  res.json({ ok: true });
});
