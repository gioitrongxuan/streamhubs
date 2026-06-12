import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../core/http-error.js';
import { hasPermission, resolvePermission } from '../core/rbac.js';
import type { AuthUser } from './auth.js';

/**
 * Middleware kiểm tra quyền theo key "module.action" (theo ma trận RBAC trong docs).
 * Quyền giá trị "own" vẫn được cho qua — handler PHẢI gọi assertOwnership
 * sau khi đã load được bản ghi để biết ai phụ trách.
 */
export function authorize(permissionKey: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError();
    if (!hasPermission(req.user.permissions, permissionKey)) {
      throw new ForbiddenError(`Thiếu quyền: ${permissionKey}`);
    }
    next();
  };
}

/**
 * Chặn quyền "own" thao tác lên bản ghi của người khác.
 * Gọi trong handler sau khi đã có ownerId của bản ghi (VD: orders.designer_id).
 */
export function assertOwnership(user: AuthUser, permissionKey: string, ownerId: number | null): void {
  const value = resolvePermission(user.permissions, permissionKey);
  if (value === false) throw new ForbiddenError(`Thiếu quyền: ${permissionKey}`);
  if (value === 'own' && ownerId !== user.id) {
    throw new ForbiddenError('Chỉ được thao tác trên bản ghi do bạn phụ trách');
  }
}
