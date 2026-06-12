import { Router } from 'express';
import { z } from 'zod';
import { pool, query, execute, queryOne } from '../../db/pool.js';
import { NotFoundError } from '../../core/http-error.js';
import { authenticate } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';

const updateRoleSchema = z.object({
  permissions: z.record(z.unknown()),
});

export const rolesRouter = Router();
rolesRouter.use('/roles', authenticate, authorize('system.users'));

rolesRouter.get('/roles', async (_req, res) => {
  const rows = await query(pool, 'SELECT id, name, permissions FROM roles ORDER BY id');
  res.json({ data: rows });
});

rolesRouter.patch('/roles/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { permissions } = updateRoleSchema.parse(req.body);
  const role = await queryOne(pool, 'SELECT id FROM roles WHERE id = ?', [id]);
  if (!role) throw new NotFoundError('Không tìm thấy role');
  await execute(pool, 'UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(permissions), id]);
  res.json({ ok: true });
});
