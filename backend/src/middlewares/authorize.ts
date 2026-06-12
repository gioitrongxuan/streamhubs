import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../core/http-error.js';
import { hasPermission } from '../core/rbac.js';

/**
 * Middleware kiểm tra quyền theo key "module.action" (theo ma trận RBAC trong docs).
 * Quyền giá trị "own" vẫn được cho qua — service chịu trách nhiệm kiểm tra ownership.
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
