import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne, execute, withTransaction } from '../../db/pool.js';
import { ConflictError, NotFoundError } from '../../core/http-error.js';
import { authenticate, currentUser } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';
import { logActivity } from '../activity-logs/activity-log.service.js';

const createThreadLotSchema = z.object({
  lot_number: z.string().min(1).max(50),
  thread_code: z.string().min(1).max(50),
  supplier_id: z.number().int().positive(),
  thread_type: z.string().max(100).nullable().optional(),
  unit: z.string().max(20).default('cuộn'),
  length_per_unit: z.number().positive().nullable().optional(),
  quantity: z.number().int().min(1),
  min_threshold: z.number().int().min(0).nullable().optional(),
  unit_price_vnd: z.number().nonnegative().nullable().optional(),
});

const threadInSchema = z.object({
  thread_lot_id: z.number().int().positive(),
  qty: z.number().int().min(1),
  date: z.string().date().optional(),
  note: z.string().nullable().optional(),
});

const threadOutSchema = z.object({
  thread_lot_id: z.number().int().positive(),
  order_item_id: z.number().int().positive().nullable().optional(),
  qty: z.number().positive(),
  date: z.string().date().optional(),
  note: z.string().nullable().optional(),
});

const today = () => new Date().toISOString().slice(0, 10);

export const threadsRouter = Router();
threadsRouter.use('/threads', authenticate, authorize('warehouse.thread'));

threadsRouter.get('/threads/lots', async (_req, res) => {
  const rows = await query(
    pool,
    `SELECT t.*, s.short_name AS supplier_name,
            (t.min_threshold IS NOT NULL AND t.remaining_qty <= t.min_threshold) AS is_low_stock
     FROM thread_lots t JOIN suppliers s ON s.id = t.supplier_id
     ORDER BY is_low_stock DESC, t.id DESC`,
  );
  res.json({ data: rows });
});

threadsRouter.post('/threads/lots', async (req, res) => {
  const input = createThreadLotSchema.parse(req.body);
  // Lô mới: remaining = quantity (chỉ nhập theo lô, không track từng cuộn như phôi)
  const result = await execute(
    pool,
    `INSERT INTO thread_lots (lot_number, thread_code, supplier_id, thread_type, unit, length_per_unit,
                              quantity, remaining_qty, min_threshold, unit_price_vnd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.lot_number, input.thread_code, input.supplier_id, input.thread_type ?? null, input.unit,
     input.length_per_unit ?? null, input.quantity, input.quantity, input.min_threshold ?? null,
     input.unit_price_vnd ?? null],
  );
  await logActivity(pool, 'thread_lot', result.insertId, currentUser(req).id,
    `${currentUser(req).name}: Tạo lô chỉ ${input.lot_number}`);
  res.status(201).json({ id: result.insertId });
});

threadsRouter.post('/threads/in', async (req, res) => {
  const input = threadInSchema.parse(req.body);
  const user = currentUser(req);
  await withTransaction(async (conn) => {
    const lot = await queryOne(conn, 'SELECT id FROM thread_lots WHERE id = ? FOR UPDATE', [input.thread_lot_id]);
    if (!lot) throw new NotFoundError('Không tìm thấy lô chỉ');

    await execute(conn, 'UPDATE thread_lots SET remaining_qty = remaining_qty + ? WHERE id = ?', [
      input.qty, input.thread_lot_id,
    ]);
    const result = await execute(
      conn,
      'INSERT INTO thread_in (thread_lot_id, qty, date, created_by, note) VALUES (?, ?, ?, ?, ?)',
      [input.thread_lot_id, input.qty, input.date ?? today(), user.id, input.note ?? null],
    );
    await logActivity(conn, 'thread_in', result.insertId, user.id, `${user.name}: Nhập ${input.qty} cuộn chỉ`);
  });
  res.status(201).json({ ok: true });
});

threadsRouter.post('/threads/out', async (req, res) => {
  const input = threadOutSchema.parse(req.body);
  const user = currentUser(req);
  await withTransaction(async (conn) => {
    const lot = await queryOne<{ remaining_qty: number }>(
      conn,
      'SELECT remaining_qty FROM thread_lots WHERE id = ? FOR UPDATE',
      [input.thread_lot_id],
    );
    if (!lot) throw new NotFoundError('Không tìm thấy lô chỉ');
    if (lot.remaining_qty < input.qty) throw new ConflictError('Số lượng chỉ còn lại không đủ');

    await execute(conn, 'UPDATE thread_lots SET remaining_qty = remaining_qty - ? WHERE id = ?', [
      input.qty, input.thread_lot_id,
    ]);
    const result = await execute(
      conn,
      'INSERT INTO thread_out (thread_lot_id, order_item_id, qty, date, created_by, note) VALUES (?, ?, ?, ?, ?, ?)',
      [input.thread_lot_id, input.order_item_id ?? null, input.qty, input.date ?? today(), user.id, input.note ?? null],
    );
    await logActivity(conn, 'thread_out', result.insertId, user.id, `${user.name}: Xuất ${input.qty} chỉ`);
  });
  res.status(201).json({ ok: true });
});
