import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne, execute } from '../../db/pool.js';
import { BadRequestError, NotFoundError } from '../../core/http-error.js';
import { authenticate, currentUser } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';

const updateSchema = z.object({ value: z.string() });

interface ConfigRow {
  key: string;
  value: string;
  type: 'int' | 'float' | 'string' | 'json';
}

/** Validate value mới theo type đã khai báo của config — tránh lưu rác. */
function assertValueMatchesType(row: ConfigRow, value: string): void {
  switch (row.type) {
    case 'int':
      if (!/^-?\d+$/.test(value)) throw new BadRequestError(`${row.key} phải là số nguyên`);
      return;
    case 'float':
      if (Number.isNaN(Number(value))) throw new BadRequestError(`${row.key} phải là số`);
      return;
    case 'json':
      try {
        JSON.parse(value);
      } catch {
        throw new BadRequestError(`${row.key} phải là JSON hợp lệ`);
      }
      return;
    case 'string':
      return;
  }
}

export const systemConfigsRouter = Router();
systemConfigsRouter.use('/system-configs', authenticate, authorize('system.configs'));

systemConfigsRouter.get('/system-configs', async (_req, res) => {
  const rows = await query(pool, 'SELECT `key`, value, type, `group`, description, updated_at FROM system_configs ORDER BY `group`, `key`');
  res.json({ data: rows });
});

systemConfigsRouter.put('/system-configs/:key', async (req, res) => {
  const { value } = updateSchema.parse(req.body);
  const row = await queryOne<ConfigRow>(pool, 'SELECT `key`, value, type FROM system_configs WHERE `key` = ?', [req.params.key]);
  if (!row) throw new NotFoundError('Không tìm thấy tham số cấu hình');

  assertValueMatchesType(row, value);
  await execute(pool, 'UPDATE system_configs SET value = ?, updated_by = ? WHERE `key` = ?', [
    value,
    currentUser(req).id,
    row.key,
  ]);
  res.json({ ok: true });
});
