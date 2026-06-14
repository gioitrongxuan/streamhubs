import type { z } from 'zod';
import { execute, queryOne, query, withTransaction, type Queryable } from '../../db/pool.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../core/http-error.js';
import type { AuthUser } from '../../middlewares/auth.js';
import { logActivity } from '../activity-logs/activity-log.service.js';
import type {
  approvalSchema, createPaymentRequestSchema, markPaidSchema, updatePaymentRequestSchema,
} from './payment-requests.schemas.js';

/**
 * Sinh serial_number dạng YYYYMM + seq 4 chữ số (VD: 2026060023).
 * Dùng bảng sequences với INSERT ... ON DUPLICATE KEY UPDATE để tăng counter
 * một cách atomic — tránh race condition khi nhiều request đến cùng lúc.
 */
async function nextSerialNumber(conn: Queryable, at: Date = new Date()): Promise<string> {
  const prefix = `${at.getFullYear()}${String(at.getMonth() + 1).padStart(2, '0')}`;
  const key = `payment_request_${prefix}`;
  await execute(
    conn,
    'INSERT INTO sequences (name, current_val) VALUES (?, 1) ON DUPLICATE KEY UPDATE current_val = current_val + 1',
    [key],
  );
  const row = await queryOne<{ current_val: number }>(
    conn,
    'SELECT current_val FROM sequences WHERE name = ?',
    [key],
  );
  return `${prefix}${String(row!.current_val).padStart(4, '0')}`;
}

export async function createPaymentRequest(
  input: z.infer<typeof createPaymentRequestSchema>,
  user: AuthUser,
): Promise<{ id: number; serial_number: string }> {
  return withTransaction(async (conn) => {
    const serialNumber = await nextSerialNumber(conn);
    const totalAmount = input.items.reduce((sum, item) => sum + item.qty * item.unit_price, 0);

    const result = await execute(
      conn,
      `INSERT INTO payment_requests (serial_number, supplier_id, payment_group, content, total_amount,
                                     currency, file_main, created_by, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [serialNumber, input.supplier_id ?? null, input.payment_group, input.content ?? null,
       totalAmount, input.currency, input.file_main ?? null, user.id, input.due_date ?? null],
    );
    const requestId = result.insertId;

    for (const item of input.items) {
      await execute(
        conn,
        `INSERT INTO payment_request_items (payment_request_id, description, qty, unit, unit_price, total,
                                            reference_type, reference_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [requestId, item.description, item.qty, item.unit ?? null, item.unit_price,
         item.qty * item.unit_price, item.reference_type ?? null, item.reference_id ?? null],
      );
    }
    for (const approverId of input.approver_ids) {
      await execute(
        conn,
        'INSERT INTO payment_request_approvers (payment_request_id, user_id) VALUES (?, ?)',
        [requestId, approverId],
      );
    }
    await logActivity(conn, 'payment_request', requestId, user.id,
      `${user.name}: Tạo mới yêu cầu thanh toán ${serialNumber}`);
    return { id: requestId, serial_number: serialNumber };
  });
}

/**
 * Sửa phiếu — chỉ cho phép khi còn ở trạng thái "pending" (chưa ai duyệt/thanh toán).
 * Ghi đè toàn bộ khoản chi và danh sách người duyệt, tính lại tổng tiền; giữ nguyên serial_number.
 */
export async function updatePaymentRequest(
  requestId: number,
  input: z.infer<typeof updatePaymentRequestSchema>,
  user: AuthUser,
): Promise<{ id: number; serial_number: string }> {
  return withTransaction(async (conn) => {
    const request = await queryOne<{ id: number; status: string; serial_number: string }>(
      conn,
      'SELECT id, status, serial_number FROM payment_requests WHERE id = ? FOR UPDATE',
      [requestId],
    );
    if (!request) throw new NotFoundError('Không tìm thấy đề nghị thanh toán');
    if (request.status !== 'pending') {
      throw new ConflictError(`Phiếu đang ở trạng thái "${request.status}" — chỉ sửa được phiếu đang chờ duyệt`);
    }

    const totalAmount = input.items.reduce((sum, item) => sum + item.qty * item.unit_price, 0);
    await execute(
      conn,
      `UPDATE payment_requests SET supplier_id = ?, payment_group = ?, content = ?, total_amount = ?,
                                   currency = ?, file_main = ?, due_date = ?
       WHERE id = ?`,
      [input.supplier_id ?? null, input.payment_group, input.content ?? null, totalAmount,
       input.currency, input.file_main ?? null, input.due_date ?? null, requestId],
    );

    await execute(conn, 'DELETE FROM payment_request_items WHERE payment_request_id = ?', [requestId]);
    for (const item of input.items) {
      await execute(
        conn,
        `INSERT INTO payment_request_items (payment_request_id, description, qty, unit, unit_price, total,
                                            reference_type, reference_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [requestId, item.description, item.qty, item.unit ?? null, item.unit_price,
         item.qty * item.unit_price, item.reference_type ?? null, item.reference_id ?? null],
      );
    }

    // Ghi đè người duyệt — phiếu đang pending nên mọi quyết định trước đó (nếu có) đều reset.
    await execute(conn, 'DELETE FROM payment_request_approvers WHERE payment_request_id = ?', [requestId]);
    for (const approverId of input.approver_ids) {
      await execute(
        conn,
        'INSERT INTO payment_request_approvers (payment_request_id, user_id) VALUES (?, ?)',
        [requestId, approverId],
      );
    }

    await logActivity(conn, 'payment_request', requestId, user.id,
      `${user.name}: Sửa đề nghị thanh toán ${request.serial_number}`);
    return { id: requestId, serial_number: request.serial_number };
  });
}

/**
 * Ghi quyết định của một người duyệt.
 * Tất cả approver accepted → phiếu accepted; bất kỳ ai reject → phiếu rejected.
 */
export async function recordApproval(
  requestId: number,
  input: z.infer<typeof approvalSchema>,
  user: AuthUser,
): Promise<void> {
  await withTransaction(async (conn) => {
    const request = await queryOne<{ id: number; status: string; serial_number: string }>(
      conn,
      'SELECT id, status, serial_number FROM payment_requests WHERE id = ? FOR UPDATE',
      [requestId],
    );
    if (!request) throw new NotFoundError('Không tìm thấy đề nghị thanh toán');
    if (request.status !== 'pending') {
      throw new ConflictError(`Phiếu đang ở trạng thái "${request.status}" — không thể duyệt`);
    }

    const approver = await queryOne<{ id: number }>(
      conn,
      'SELECT id FROM payment_request_approvers WHERE payment_request_id = ? AND user_id = ?',
      [requestId, user.id],
    );
    if (!approver) throw new ForbiddenError('Bạn không nằm trong danh sách người duyệt phiếu này');

    await execute(
      conn,
      'UPDATE payment_request_approvers SET status = ?, comment = ? WHERE id = ?',
      [input.status, input.comment ?? null, approver.id],
    );

    if (input.status === 'reject') {
      await execute(conn, "UPDATE payment_requests SET status = 'rejected' WHERE id = ?", [requestId]);
    } else {
      const pending = await queryOne<{ cnt: number }>(
        conn,
        "SELECT COUNT(*) AS cnt FROM payment_request_approvers WHERE payment_request_id = ? AND status != 'accepted'",
        [requestId],
      );
      if ((pending?.cnt ?? 0) === 0) {
        await execute(conn, "UPDATE payment_requests SET status = 'accepted' WHERE id = ?", [requestId]);
      }
    }
    await logActivity(conn, 'payment_request', requestId, user.id,
      `${user.name}: ${input.status === 'accepted' ? 'Duyệt' : 'Từ chối'} phiếu ${request.serial_number}` +
      (input.comment ? ` (${input.comment})` : ''));
  });
}

/** Đánh dấu đã thanh toán (đủ hoặc một phần) — chỉ áp dụng cho phiếu đã duyệt. */
export async function markPaid(
  requestId: number,
  input: z.infer<typeof markPaidSchema>,
  user: AuthUser,
): Promise<void> {
  await withTransaction(async (conn) => {
    const request = await queryOne<{ status: string; serial_number: string }>(
      conn,
      'SELECT status, serial_number FROM payment_requests WHERE id = ? FOR UPDATE',
      [requestId],
    );
    if (!request) throw new NotFoundError('Không tìm thấy đề nghị thanh toán');
    if (!['accepted', 'partial'].includes(request.status)) {
      throw new ConflictError('Chỉ thanh toán được phiếu đã xác nhận');
    }

    const newStatus = input.partial ? 'partial' : 'paid';
    await execute(conn, 'UPDATE payment_requests SET status = ?, paid_date = ? WHERE id = ?', [
      newStatus, input.paid_date, requestId,
    ]);
    await logActivity(conn, 'payment_request', requestId, user.id,
      `${user.name}: ${input.partial ? 'Thanh toán một phần' : 'Đã thanh toán'} phiếu ${request.serial_number}`);
  });
}

export async function loadPaymentRequestDetail(db: Queryable, id: number) {
  const request = await queryOne(
    db,
    `SELECT pr.*, s.name AS supplier_name, u.name AS created_by_name,
            s.bank_holder, s.bank_account, s.bank_name
     FROM payment_requests pr
     LEFT JOIN suppliers s ON s.id = pr.supplier_id
     JOIN users u ON u.id = pr.created_by
     WHERE pr.id = ?`,
    [id],
  );
  if (!request) return undefined;

  const [items, files, approvers] = await Promise.all([
    query(db, 'SELECT * FROM payment_request_items WHERE payment_request_id = ?', [id]),
    query(db, 'SELECT * FROM payment_request_files WHERE payment_request_id = ?', [id]),
    query(
      db,
      `SELECT a.*, u.name AS user_name FROM payment_request_approvers a
       JOIN users u ON u.id = a.user_id WHERE a.payment_request_id = ?`,
      [id],
    ),
  ]);
  return { ...request, items, files, approvers };
}
