import { z } from 'zod';

export const createLotSchema = z.object({
  lot_number: z.string().min(1).max(50),
  supplier_id: z.number().int().positive(),
  product_type_id: z.number().int().positive(),
  color: z.string().max(50).nullable().optional(),
  size: z.string().max(20).nullable().optional(),
  quantity: z.number().int().min(1),
  unit_price_vnd: z.number().nonnegative().nullable().optional(),
  unit_price_usd: z.number().nonnegative().nullable().optional(),
  min_threshold: z.number().int().min(0).nullable().optional(),
  qr_prefix: z.string().min(1).max(50),
});

export const generateQrSchema = z.object({
  quantity: z.number().int().min(1).max(1000).optional(), // mặc định = quantity còn thiếu của lô
});

export const scanInSchema = z.object({
  qrcode: z.string().min(1).max(100),
  shelf_id: z.number().int().positive(),
  date: z.string().date().optional(),
  note: z.string().nullable().optional(),
});

export const scanOutSchema = z.object({
  qrcode: z.string().min(1).max(100),
  type: z.enum(['order', 'return_error']).default('order'),
  order_item_id: z.number().int().positive().nullable().optional(),
  date: z.string().date().optional(),
});

// Báo cáo nhập kho theo ngày và/hoặc theo lô nhập.
export const importReportQuerySchema = z.object({
  date: z.string().date().optional(),
  lot_id: z.coerce.number().int().positive().optional(),
});

// In báo cáo → ghi lịch sử phiếu in. Bắt buộc chọn ngày hoặc lô.
export const logPrintSchema = z
  .object({
    date: z.string().date().optional(),
    lot_id: z.number().int().positive().optional(),
  })
  .refine((v) => Boolean(v.date || v.lot_id), { message: 'Cần chọn ngày hoặc lô để in báo cáo' });

// Đẩy báo cáo nhập kho sang đề nghị thanh toán.
export const pushPaymentSchema = z
  .object({
    date: z.string().date().optional(),
    lot_id: z.number().int().positive().optional(),
    approver_ids: z.array(z.number().int().positive()).min(1),
    supplier_id: z.number().int().positive().nullable().optional(),
    print_history_id: z.number().int().positive().nullable().optional(),
  })
  .refine((v) => Boolean(v.date || v.lot_id), {
    message: 'Cần chọn ngày hoặc lô để tạo đề nghị thanh toán',
  });
