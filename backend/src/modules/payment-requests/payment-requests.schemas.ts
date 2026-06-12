import { z } from 'zod';
import { paginationSchema } from '../../core/pagination.js';

export const PAYMENT_GROUPS = ['external_fulfill', 'material', 'thread', 'shipping', 'design', 'other'] as const;

export const createPaymentRequestSchema = z.object({
  supplier_id: z.number().int().positive().nullable().optional(),
  payment_group: z.enum(PAYMENT_GROUPS),
  content: z.string().nullable().optional(),
  currency: z.string().length(3).default('VND'),
  file_main: z.string().max(255).nullable().optional(),
  due_date: z.string().date().nullable().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        qty: z.number().positive().default(1),
        unit: z.string().max(20).nullable().optional(),
        unit_price: z.number().nonnegative(),
        reference_type: z.enum(['order', 'inventory_lot', 'thread_lot']).nullable().optional(),
        reference_id: z.number().int().positive().nullable().optional(),
      }),
    )
    .min(1),
  approver_ids: z.array(z.number().int().positive()).min(1),
});

export const listPaymentRequestsSchema = paginationSchema.extend({
  status: z.enum(['pending', 'accepted', 'partial', 'paid', 'rejected']).optional(),
  payment_group: z.enum(PAYMENT_GROUPS).optional(),
  supplier_id: z.coerce.number().int().positive().optional(),
  overdue: z.coerce.boolean().optional(), // derived: due_date < today AND status NOT IN (paid, rejected)
});

export const approvalSchema = z.object({
  status: z.enum(['accepted', 'reject']),
  comment: z.string().nullable().optional(),
});

export const markPaidSchema = z.object({
  paid_date: z.string().date(),
  partial: z.boolean().default(false),
});
