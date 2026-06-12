import { z } from 'zod';
import { paginationSchema } from '../../core/pagination.js';
import { ORDER_STATUSES } from './order-status.js';

export const orderItemInputSchema = z.object({
  product_type_id: z.number().int().positive(),
  listing_user_id: z.number().int().positive().nullable().optional(),
  sku: z.string().max(50).nullable().optional(),
  qty: z.number().int().min(1).default(1),
  price_sale: z.number().nonnegative().nullable().optional(),
  sup_cost: z.number().nonnegative().nullable().optional(),
  design_cost: z.number().nonnegative().nullable().optional(),
  variants: z.record(z.string()).nullable().optional(),
  personalization: z.string().nullable().optional(),
  hscode: z.string().max(20).nullable().optional(),
  hs_name: z.string().max(100).nullable().optional(),
  hs_price: z.number().nonnegative().nullable().optional(),
});

export const createOrderSchema = z.object({
  shop_id: z.number().int().positive(),
  listing_name: z.string().max(255).nullable().optional(),
  fulfill_type: z.enum(['internal', 'external']).default('internal'),
  supplier_id: z.number().int().positive().nullable().optional(),
  designer_id: z.number().int().positive().nullable().optional(),
  cs_id: z.number().int().positive().nullable().optional(),
  labels: z.string().max(255).nullable().optional(),
  is_digital: z.boolean().default(false),
  shop_note: z.string().nullable().optional(),
  streamer_note: z.string().nullable().optional(),
  ioss_number: z.string().max(50).nullable().optional(),
  discount: z.number().nonnegative().default(0),
  shipping_fee: z.number().nonnegative().default(0),
  delivery_fee: z.number().nonnegative().default(0),
  sales_tax: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  currency: z.string().length(3).default('USD'),
  receiver_name: z.string().max(150).nullable().optional(),
  address_line1: z.string().max(255).nullable().optional(),
  address_line2: z.string().max(255).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  zipcode: z.string().max(20).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  items: z.array(orderItemInputSchema).min(1),
});

export const updateOrderSchema = createOrderSchema.omit({ items: true, shop_id: true }).partial().extend({
  is_dup: z.boolean().optional(),
});

export const listOrdersSchema = paginationSchema.extend({
  status: z.string().optional(),          // comma-separated, VD: "designing,pending_review"
  shop_id: z.coerce.number().int().positive().optional(),
  designer_id: z.coerce.number().int().positive().optional(),
  supplier_id: z.coerce.number().int().positive().optional(),
  fulfill_type: z.enum(['internal', 'external']).optional(),
  label: z.string().max(50).optional(),   // VD: lam_gap
  q: z.string().max(100).optional(),      // order_code / etsy_order_id / receiver_name
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
});

export const changeStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().nullable().optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(1),
});

export const mergeOrdersSchema = z.object({
  child_order_ids: z.array(z.number().int().positive()).min(1),
});

export const packageSchema = z.object({
  tracking_number: z.string().max(100).nullable().optional(),
  carrier: z.string().max(50).nullable().optional(),
  weight: z.number().nonnegative().nullable().optional(),
  note: z.string().nullable().optional(),
});

export const updateOrderItemSchema = z.object({
  machine_id: z.number().int().positive().nullable().optional(),
  operator_id: z.number().int().positive().nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'done', 'in_finishing', 'redo', 'qc_failed', 'qc_passed']).optional(),
  error_at: z.enum(['xuong', 'designer', 'phoi']).nullable().optional(),
  error_reason: z.string().nullable().optional(),
  image_qc: z.boolean().optional(),
});

export const itemNoteSchema = z.object({
  note: z.string().min(1),
  images: z.array(z.string()).nullable().optional(),
});

export const designFileSchema = z.object({
  position: z.string().min(1).max(50),
  file_type: z.enum(['emb', 'dst', 'pdf', 'jpg', 'png']),
  file_path: z.string().min(1).max(255),
});
