import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { pool, queryOne, execute } from '../../db/pool.js';
import { BadRequestError, UnauthorizedError } from '../../core/http-error.js';
import { authenticate, currentUser } from '../../middlewares/auth.js';
import { loginRateLimit } from '../../middlewares/rate-limit.js';
import { logActivity } from '../activity-logs/activity-log.service.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(72),
});

export const authRouter = Router();

authRouter.post('/auth/login', loginRateLimit, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await queryOne<{ id: number; name: string; email: string; password_hash: string }>(
    pool,
    'SELECT id, name, email, password_hash FROM users WHERE email = ? AND is_active = 1',
    [email],
  );
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new UnauthorizedError('Email hoặc mật khẩu không đúng');
  }

  const token = jwt.sign({ sub: String(user.id) }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  } as jwt.SignOptions);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

authRouter.get('/auth/me', authenticate, (req, res) => {
  res.json(currentUser(req));
});

/** Tự đổi mật khẩu — yêu cầu mật khẩu hiện tại, không cần quyền system.users. */
authRouter.post('/auth/change-password', authenticate, async (req, res) => {
  const { current_password, new_password } = changePasswordSchema.parse(req.body);
  const user = currentUser(req);

  const row = await queryOne<{ password_hash: string }>(
    pool,
    'SELECT password_hash FROM users WHERE id = ?',
    [user.id],
  );
  if (!row || !(await bcrypt.compare(current_password, row.password_hash))) {
    throw new BadRequestError('Mật khẩu hiện tại không đúng');
  }

  await execute(pool, 'UPDATE users SET password_hash = ? WHERE id = ?', [
    await bcrypt.hash(new_password, 10),
    user.id,
  ]);
  await logActivity(pool, 'user', user.id, user.id, `${user.name}: Tự đổi mật khẩu`);
  res.json({ ok: true });
});
