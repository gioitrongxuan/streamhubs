/**
 * State machine vòng đời Order — nguồn sự thật duy nhất cho quy tắc chuyển trạng thái.
 * Nguồn thiết kế: docs/01-phan-tich-quy-trinh/workflow.md (mục 1, 3c, 6).
 *
 * Mọi thay đổi orders.status phải đi qua assertTransition — không if/else rải rác.
 */
import { ConflictError } from '../../core/http-error.js';

export const ORDER_STATUSES = [
  'new', 'need_confirm', 'designing', 'pending_review', 'designed',
  'in_production', 'producing', 'redo', 'fixing', 'factory_return',
  'produced', 'in_finishing', 'qc_passed', 'out_stock', 'shipped',
  'in_transit', 'complete', 'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Các trạng thái KHÔNG được hủy: hàng đã bàn giao carrier hoặc đã kết thúc. */
const NON_CANCELLABLE: ReadonlySet<OrderStatus> = new Set(['out_stock', 'shipped', 'in_transit', 'complete', 'cancelled']);

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  new:            ['need_confirm', 'designing'],
  need_confirm:   ['new', 'designing'],
  designing:      ['pending_review'],
  pending_review: ['designing', 'designed'],            // không đạt → quay lại design
  designed:       ['in_production'],                    // đẩy xưởng
  in_production:  ['producing', 'factory_return'],
  producing:      ['produced', 'redo', 'factory_return'],
  redo:           ['producing', 'in_production'],
  fixing:         ['in_production'],
  factory_return: ['in_production', 'fixing'],          // đổi xưởng hoặc sửa file/phôi
  produced:       ['in_finishing'],                     // nhận hàng từ xưởng
  in_finishing:   ['qc_passed', 'redo'],                // QC không đạt → trả lại SX
  qc_passed:      ['out_stock'],
  out_stock:      ['shipped'],
  shipped:        ['in_transit'],
  in_transit:     ['complete'],
  complete:       [],
  cancelled:      [],
};

/** Cột timestamp được ghi khi vào trạng thái tương ứng. */
const TIMESTAMP_ON_ENTER: Partial<Record<OrderStatus, string>> = {
  designing: 'design_assigned_at',
  in_production: 'pushed_at',
  qc_passed: 'qc_passed_at',
  shipped: 'shipped_at',
  complete: 'completed_at',
  cancelled: 'cancelled_at',
};

export function canCancel(from: OrderStatus): boolean {
  return !NON_CANCELLABLE.has(from);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (to === 'cancelled') return canCancel(from);
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictError(`Không thể chuyển trạng thái order từ "${from}" sang "${to}"`);
  }
}

export function timestampColumnFor(to: OrderStatus): string | null {
  return TIMESTAMP_ON_ENTER[to] ?? null;
}
