import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from '../../db/pool.js';
import { ForbiddenError } from '../../core/http-error.js';
import { hasPermission } from '../../core/rbac.js';
import { authenticate, currentUser } from '../../middlewares/auth.js';
import type { EntityType } from './activity-log.service.js';

/**
 * Quyền cần có để đọc log của từng loại entity — log kế thừa quyền xem
 * của nghiệp vụ tương ứng, tránh user role hạn chế đọc lén hoạt động
 * của module mình bị chặn (VD: payment).
 */
const ENTITY_VIEW_PERMISSION: Record<EntityType, string> = {
  order: 'orders.view',
  order_item: 'orders.view',
  payment_request: 'payment.view',
  inventory_lot: 'warehouse.inventory_view',
  inventory_in: 'warehouse.inventory_view',
  inventory_out: 'warehouse.inventory_view',
  thread_lot: 'warehouse.thread',
  thread_in: 'warehouse.thread',
  thread_out: 'warehouse.thread',
  receive_session: 'warehouse.receive_order',
  auto_label: 'system.auto_label',
  machine: 'warehouse.machine',
  user: 'system.users',
};

const ENTITY_TYPES = Object.keys(ENTITY_VIEW_PERMISSION) as [EntityType, ...EntityType[]];

const listSchema = z.object({
  entity_type: z.enum(ENTITY_TYPES),
  entity_id: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const activityLogsRouter = Router();

activityLogsRouter.get('/activity-logs', authenticate, async (req, res) => {
  const { entity_type, entity_id, limit } = listSchema.parse(req.query);

  const requiredPermission = ENTITY_VIEW_PERMISSION[entity_type];
  if (!hasPermission(currentUser(req).permissions, requiredPermission)) {
    throw new ForbiddenError(`Thiếu quyền: ${requiredPermission}`);
  }

  const rows = await query(
    pool,
    `SELECT l.id, l.entity_type, l.entity_id, l.activity, l.created_at, u.name AS user_name
     FROM activity_logs l LEFT JOIN users u ON u.id = l.user_id
     WHERE l.entity_type = ? AND l.entity_id = ?
     ORDER BY l.id DESC LIMIT ?`,
    [entity_type, entity_id, limit],
  );
  res.json({ data: rows });
});
