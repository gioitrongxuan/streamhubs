import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../core/http-error.js';

/**
 * Rate limit in-memory theo IP (fixed window) — đủ cho triển khai 1 instance.
 * Khi scale ngang nhiều instance → chuyển sang Redis.
 */
export function rateLimit(options: { windowMs: number; max: number; message: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, _res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      // Dọn các entry hết hạn để Map không phình vô hạn
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      }
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > options.max) throw new HttpError(429, options.message);
    next();
  };
}

/** Chống brute-force đăng nhập: tối đa 10 lần / 15 phút mỗi IP. */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Đăng nhập sai quá nhiều lần — thử lại sau 15 phút',
});
