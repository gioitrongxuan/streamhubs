import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { pool, query, queryOne, execute } from '../../db/pool.js';
import { ConflictError, NotFoundError } from '../../core/http-error.js';
import { buildSet } from '../../core/sql.js';
import { authenticate, currentUser } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';
import { logActivity } from '../activity-logs/activity-log.service.js';

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(150),
  password: z.string().min(8),
  role_id: z.number().int().positive(),
  shop_id: z.number().int().positive().nullable().optional(),
  avatar: z.string().max(255).nullable().optional(),
});

const updateUserSchema = createUserSchema.partial().extend({
  is_active: z.boolean().optional(),
});

const USER_COLUMNS = `u.id, u.name, u.email, u.role_id, r.name AS role_name,
  u.shop_id, u.avatar, u.is_active, u.created_at`;

export const usersRouter = Router();

// Dropdown chọn người (designer, operator, người duyệt...) — mọi user đăng nhập đều cần
usersRouter.get('/users/options', authenticate, async (_req, res) => {
  const rows = await query(
    pool,
    `SELECT u.id, u.name, r.name AS role_name FROM users u
     JOIN roles r ON r.id = u.role_id WHERE u.is_active = 1 ORDER BY u.name`,
  );
  res.json({ data: rows });
});

usersRouter.use('/users', authenticate, authorize('system.users'));

usersRouter.get('/users', async (_req, res) => {
  const rows = await query(pool, `SELECT ${USER_COLUMNS} FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.id`);
  res.json({ data: rows });
});

usersRouter.get('/users/:id', async (req, res) => {
  const row = await queryOne(
    pool,
    `SELECT ${USER_COLUMNS} FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    [Number(req.params.id)],
  );
  if (!row) throw new NotFoundError('Không tìm thấy người dùng');
  res.json(row);
});

usersRouter.post('/users', async (req, res) => {
  const input = createUserSchema.parse(req.body);
  const existing = await queryOne(pool, 'SELECT id FROM users WHERE email = ?', [input.email]);
  if (existing) throw new ConflictError('Email đã được sử dụng');

  const result = await execute(
    pool,
    `INSERT INTO users (name, email, password_hash, role_id, shop_id, avatar)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.name, input.email, await bcrypt.hash(input.password, 10), input.role_id, input.shop_id ?? null, input.avatar ?? null],
  );
  await logActivity(pool, 'user', result.insertId, currentUser(req).id, `Tạo người dùng ${input.email}`);
  res.status(201).json({ id: result.insertId });
});

usersRouter.patch('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const input = updateUserSchema.parse(req.body);
  const user = await queryOne(pool, 'SELECT id FROM users WHERE id = ?', [id]);
  if (!user) throw new NotFoundError('Không tìm thấy người dùng');

  const { password, ...columns } = input;
  const { clause, params } = buildSet({
    ...columns,
    ...(password !== undefined ? { password_hash: await bcrypt.hash(password, 10) } : {}),
  });
  if (clause) {
    await execute(pool, `UPDATE users SET ${clause} WHERE id = ?`, [...params, id]);
    await logActivity(pool, 'user', id, currentUser(req).id, 'Cập nhật thông tin người dùng');
  }
  res.json({ ok: true });
});
