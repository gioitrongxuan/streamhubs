import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool, queryOne } from '../db/pool.js';
import { UnauthorizedError } from '../core/http-error.js';
import type { Permissions } from '../core/rbac.js';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  roleId: number;
  roleName: string;
  shopId: number | null;
  permissions: Permissions;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface UserRow {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  shop_id: number | null;
  permissions: Permissions | string;
}

/**
 * Xác thực JWT Bearer, nạp user + permissions từ DB gắn vào req.user.
 * Nạp từ DB mỗi request để đổi quyền/khóa user có hiệu lực ngay.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new UnauthorizedError();

  let userId: number;
  try {
    const payload = jwt.verify(header.slice('Bearer '.length), env.jwt.secret) as { sub: string };
    userId = Number(payload.sub);
  } catch {
    throw new UnauthorizedError('Token không hợp lệ hoặc đã hết hạn');
  }

  const row = await queryOne<UserRow>(
    pool,
    `SELECT u.id, u.name, u.email, u.role_id, u.shop_id, r.name AS role_name, r.permissions
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? AND u.is_active = 1`,
    [userId],
  );
  if (!row) throw new UnauthorizedError('Tài khoản không tồn tại hoặc đã bị khóa');

  req.user = {
    id: row.id,
    name: row.name,
    email: row.email,
    roleId: row.role_id,
    roleName: row.role_name,
    shopId: row.shop_id,
    permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
  };
  next();
}

/** Lấy req.user khi chắc chắn đã qua authenticate. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}
