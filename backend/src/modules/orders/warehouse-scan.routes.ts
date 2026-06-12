import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne } from '../../db/pool.js';
import { NotFoundError } from '../../core/http-error.js';
import { authenticate, currentUser } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';
import { createEtsyClient } from '../../integrations/etsy/etsy-client.js';
import { loadOrderDetail } from './orders.repository.js';
import { attachTracking, findOrderByCode, qcVerify } from './warehouse-scan.service.js';

/**
 * Trang QC Order `/qc` và Scan Track `/scan-track`
 * (docs/05-module-nghiep-vu/quan-ly-kho-xuong.md mục 8, 9).
 */
const qcVerifySchema = z.object({
  order_id: z.number().int().positive(),
  passed: z.boolean(),
  note: z.string().nullable().optional(),
  items: z
    .array(z.object({
      order_item_id: z.number().int().positive(),
      error_at: z.enum(['xuong', 'designer', 'phoi']),
      error_reason: z.string().min(1),
    }))
    .optional(),
});

const scanTrackSchema = z.object({
  code: z.string().min(1).max(100),
  tracking_number: z.string().min(1).max(100),
  carrier: z.string().max(50).nullable().optional(),
});

export const warehouseScanRouter = Router();
warehouseScanRouter.use(authenticate);

// --- QC Order ---------------------------------------------------------------

/** Quét QR / nhập mã → trả chi tiết order để QC đối chiếu cá nhân hóa. */
warehouseScanRouter.get('/qc/order', authorize('warehouse.qc_scan'), async (req, res) => {
  const code = String(req.query.code ?? '').trim();
  const order = code ? await findOrderByCode(pool, code) : undefined;
  if (!order) throw new NotFoundError(`Không tìm thấy order với mã "${code}"`);
  res.json(await loadOrderDetail(pool, order.id));
});

warehouseScanRouter.get('/qc/recent', authorize('warehouse.qc_scan'), async (_req, res) => {
  const rows = await query(
    pool,
    `SELECT oi.id, oi.order_id, o.order_code, oi.sku, oi.qty, oi.status,
            oi.error_at, oi.error_reason, oi.updated_at, pt.name AS product_type_name
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN product_types pt ON pt.id = oi.product_type_id
     WHERE oi.status IN ('qc_passed', 'qc_failed')
     ORDER BY oi.updated_at DESC LIMIT 30`,
  );
  res.json({ data: rows });
});

warehouseScanRouter.post('/qc/verify', authorize('warehouse.qc_scan'), async (req, res) => {
  await qcVerify(qcVerifySchema.parse(req.body), currentUser(req));
  res.json({ ok: true });
});

// --- Scan Tracking ----------------------------------------------------------

warehouseScanRouter.post('/scan-track', authorize('warehouse.scan_track'), async (req, res) => {
  const input = scanTrackSchema.parse(req.body);
  const order = await attachTracking(input, currentUser(req));

  // Đơn Etsy: đẩy tracking lên Etsy sau khi commit — lỗi sync không chặn nghiệp vụ kho
  if (order.order_type === 'etsy' && order.etsy_order_id) {
    try {
      const shop = await queryOne<{ etsy_shop_id: string | null }>(
        pool, 'SELECT etsy_shop_id FROM shops WHERE id = ?', [order.shop_id],
      );
      if (shop?.etsy_shop_id) {
        await createEtsyClient().pushTracking(
          shop.etsy_shop_id, String(order.etsy_order_id), input.tracking_number, input.carrier ?? '',
        );
      }
    } catch (err) {
      console.error('Đẩy tracking lên Etsy thất bại:', err);
    }
  }
  res.json({ ok: true, order_id: order.id, order_code: order.order_code });
});

warehouseScanRouter.get('/scan-track/recent', authorize('warehouse.scan_track'), async (_req, res) => {
  const rows = await query(
    pool,
    `SELECT p.id, p.tracking_number, p.carrier, p.created_at,
            o.id AS order_id, o.order_code, o.order_type, o.shipped_at
     FROM order_packages p
     JOIN orders o ON o.id = p.order_id
     WHERE p.tracking_number IS NOT NULL AND o.shipped_at IS NOT NULL
     ORDER BY o.shipped_at DESC, p.id DESC LIMIT 30`,
  );
  res.json({ data: rows });
});
