import { execute, type Queryable } from '../../db/pool.js';

export type EntityType =
  | 'order'
  | 'order_item'
  | 'payment_request'
  | 'inventory_lot'
  | 'inventory_in'
  | 'inventory_out'
  | 'thread_lot'
  | 'thread_in'
  | 'thread_out'
  | 'receive_session'
  | 'auto_label'
  | 'machine'
  | 'user';

/**
 * Ghi activity log dùng chung cho mọi module.
 * Truyền PoolConnection khi cần log nằm trong cùng transaction với nghiệp vụ.
 */
export async function logActivity(
  db: Queryable,
  entityType: EntityType,
  entityId: number,
  userId: number | null,
  activity: string,
): Promise<void> {
  await execute(
    db,
    'INSERT INTO activity_logs (entity_type, entity_id, user_id, activity) VALUES (?, ?, ?, ?)',
    [entityType, entityId, userId, activity],
  );
}
