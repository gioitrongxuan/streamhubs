import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { pool, queryOne } from '../../db/pool.js';
import { UnauthorizedError } from '../../core/http-error.js';
import { authenticate, currentUser } from '../../middlewares/auth.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post('/auth/login', async (req, res) => {
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
