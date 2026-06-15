import { Router } from 'express';
import { pool, query, queryOne, execute } from '../../db/pool.js';
import { NotFoundError } from '../../core/http-error.js';
import { authenticate, currentUser } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';
import { logActivity } from '../activity-logs/activity-log.service.js';
import {
  createLotSchema, generateQrSchema, importReportQuerySchema, logPrintSchema, pushPaymentSchema,
  scanInSchema, scanOutSchema,
} from './inventory.schemas.js';
import {
  generateQrcodes, importReport, inventoryReport, listPrintHistory, logPrint, pushReportToPayment,
  scanIn, scanOut,
} from './inventory.service.js';

export const inventoryRouter = Router();
inventoryRouter.use(authenticate);

// --- Lô phôi ----------------------------------------------------------------

inventoryRouter.get('/inventory/lots', authorize('warehouse.inventory_view'), async (_req, res) => {
  res.json({ data: await inventoryReport() });
});

inventoryRouter.get('/inventory/lots/:id', authorize('warehouse.inventory_view'), async (req, res) => {
  const id = Number(req.params.id);
  const lot = await queryOne(pool, 'SELECT * FROM inventory_lots WHERE id = ?', [id]);
  if (!lot) throw new NotFoundError('Không tìm thấy lô phôi');
  const items = await query(pool, 'SELECT id, qrcode, shelf_id, status, created_at FROM inventory_items WHERE lot_id = ?', [id]);
  res.json({ ...lot, items });
});

inventoryRouter.post('/inventory/lots', authorize('warehouse.inventory_in'), async (req, res) => {
  const input = createLotSchema.parse(req.body);
  const result = await execute(
    pool,
    `INSERT INTO inventory_lots (lot_number, supplier_id, product_type_id, color, size, quantity,
                                 remaining_qty, unit_price_vnd, unit_price_usd, min_threshold, qr_prefix)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    [input.lot_number, input.supplier_id, input.product_type_id, input.color ?? null, input.size ?? null,
     input.quantity, input.unit_price_vnd ?? null, input.unit_price_usd ?? null,
     input.min_threshold ?? null, input.qr_prefix],
  );
  await logActivity(pool, 'inventory_lot', result.insertId, currentUser(req).id,
    `${currentUser(req).name}: Tạo lô phôi ${input.lot_number}`);
  res.status(201).json({ id: result.insertId });
});

// --- QR + Nhập/Xuất ----------------------------------------------------------

inventoryRouter.post('/inventory/lots/:id/qrcodes', authorize('warehouse.gen_qrcode'), async (req, res) => {
  const input = generateQrSchema.parse(req.body ?? {});
  const qrcodes = await generateQrcodes(Number(req.params.id), input, currentUser(req));
  res.status(201).json({ qrcodes });
});

inventoryRouter.post('/inventory/in', authorize('warehouse.inventory_in'), async (req, res) => {
  const info = await scanIn(scanInSchema.parse(req.body), currentUser(req));
  res.status(201).json(info);
});

inventoryRouter.post('/inventory/out', authorize('warehouse.inventory_out'), async (req, res) => {
  await scanOut(scanOutSchema.parse(req.body), currentUser(req));
  res.status(201).json({ ok: true });
});

// --- Báo cáo nhập + phiếu in + đẩy thanh toán --------------------------------

inventoryRouter.get('/inventory/in/report', authorize('warehouse.inventory_view'), async (req, res) => {
  const filters = importReportQuerySchema.parse(req.query);
  res.json(await importReport(filters));
});

inventoryRouter.post('/inventory/print-history', authorize('warehouse.inventory_view'), async (req, res) => {
  res.status(201).json(await logPrint(logPrintSchema.parse(req.body), currentUser(req)));
});

inventoryRouter.get('/inventory/print-history', authorize('warehouse.inventory_view'), async (_req, res) => {
  res.json({ data: await listPrintHistory() });
});

inventoryRouter.post('/inventory/in/payment-request', authorize('payment.create'), async (req, res) => {
  res.status(201).json(await pushReportToPayment(pushPaymentSchema.parse(req.body), currentUser(req)));
});

// --- Lịch sử ------------------------------------------------------------------

inventoryRouter.get('/inventory/in', authorize('warehouse.inventory_view'), async (_req, res) => {
  const rows = await query(
    pool,
    `SELECT i.id, i.date, i.note, ii.qrcode, sh.name AS shelf_name, u.name AS created_by_name
     FROM inventory_in i
     JOIN inventory_items ii ON ii.id = i.inventory_item_id
     JOIN shelves sh ON sh.id = i.shelf_id
     JOIN users u ON u.id = i.created_by
     ORDER BY i.id DESC LIMIT 200`,
  );
  res.json({ data: rows });
});

inventoryRouter.get('/inventory/out', authorize('warehouse.inventory_view'), async (_req, res) => {
  const rows = await query(
    pool,
    `SELECT o.id, o.date, o.type, ii.qrcode, o.order_item_id, u.name AS created_by_name
     FROM inventory_out o
     JOIN inventory_items ii ON ii.id = o.inventory_item_id
     JOIN users u ON u.id = o.created_by
     ORDER BY o.id DESC LIMIT 200`,
  );
  res.json({ data: rows });
});
