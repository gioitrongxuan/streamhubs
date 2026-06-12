import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from '../../db/pool.js';
import { authenticate } from '../../middlewares/auth.js';

const listSchema = z.object({
  entity_type: z.string(),
  entity_id: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const activityLogsRouter = Router();

activityLogsRouter.get('/activity-logs', authenticate, async (req, res) => {
  const { entity_type, entity_id, limit } = listSchema.parse(req.query);
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
