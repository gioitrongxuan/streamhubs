// Panel "Chi tiết phiếu yêu cầu thanh toán" trượt từ phải — bám sát mockup:
// Thông tin cơ bản / Nội dung / Phương thức TT / File / Tổng tiền / Người xác nhận / Logs.
import { get, post } from '../api.js';
import { esc, fmtMoney, fmtDate, fmtDateTime, badge, openPanel, openModal, toast, tryDo } from '../ui.js';
import { PAYMENT_STATUS, PAYMENT_GROUPS } from '../constants.js';
import { state } from '../app.js';
import { hasPerm } from '../perm.js';

export async function openPaymentDetail(id, onChange) {
  await tryDo(async () => {
    const [request, logs] = await Promise.all([
      get(`/payment-requests/${id}`),
      get(`/activity-logs?entity_type=payment_request&entity_id=${id}&limit=30`),
    ]);

    const perms = state.user.permissions;
    const myApproval = request.approvers.find((a) => a.user_id === state.user.id);
    const canApprove = hasPerm(perms, 'payment.approve') && myApproval && myApproval.status === 'pending' && request.status === 'pending';
    const canMarkPaid = hasPerm(perms, 'payment.mark_paid') && ['accepted', 'partial'].includes(request.status);
    const canEdit = hasPerm(perms, 'payment.create') && request.status === 'pending';

    const infoRow = (k, v) => `<div class="info-row"><div class="k">${k}</div><div>${v}</div></div>`;
    const approverBadge = { pending: ['Chờ duyệt', '#fef0c7', '#b54708'], accepted: ['Đã xác nhận', '#d1fadf', '#067647'], reject: ['Từ chối', '#fee4e2', '#b42318'] };

    const panel = openPanel({
      title: 'Chi tiết phiếu yêu cầu thanh toán',
      body: `<div class="row g-3">
        <div class="col-lg-8">
          <div class="sh-card mb-3">
            <div class="section-title d-flex justify-content-between align-items-center">
              <span>Thông tin cơ bản</span>
              ${canEdit ? '<button class="btn btn-sm btn-outline-primary" data-edit>✎ Sửa</button>' : ''}
            </div>
            ${infoRow('Ngày tạo', fmtDate(request.created_at))}
            ${infoRow('Hạn thanh toán', fmtDate(request.due_date))}
            ${infoRow('Người tạo', esc(request.created_by_name))}
            ${infoRow('Phân loại', PAYMENT_GROUPS[request.payment_group] ?? esc(request.payment_group))}
            ${infoRow('Nhà cung cấp', esc(request.supplier_name ?? 'Khác'))}
            ${infoRow('Seri', `<b>${esc(request.serial_number)}</b>`)}
            ${infoRow('Trạng thái', badge(request.status, PAYMENT_STATUS))}
          </div>
          <div class="sh-card mb-3">
            <div class="section-title">Nội dung</div>
            <div>${esc(request.content ?? '—')}</div>
          </div>
          ${request.items.length ? `<div class="sh-card mb-3">
            <div class="section-title">Chi tiết khoản chi</div>
            <table class="sh-table"><thead><tr><th>Nội dung</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
            <tbody>${request.items.map((item) => `<tr>
              <td>${esc(item.description)}</td><td>${Number(item.qty)}</td>
              <td>${fmtMoney(item.unit_price, request.currency)}</td>
              <td><b>${fmtMoney(item.total, request.currency)}</b></td></tr>`).join('')}</tbody></table>
          </div>` : ''}
          ${request.supplier_id ? `<div class="sh-card mb-3">
            <div class="section-title">Phương thức thanh toán</div>
            <div class="border rounded p-3">
              Chủ tài khoản: <b>${esc(request.bank_holder ?? '—')}</b><br>
              Số tài khoản: <b>${esc(request.bank_account ?? '—')}</b><br>
              Ngân hàng: <b>${esc(request.bank_name ?? '—')}</b>
            </div>
          </div>` : ''}
          <div class="sh-card mb-3">
            <div class="section-title">File đính kèm chính <span class="badge bg-secondary">${request.file_main ? 1 : 0}</span></div>
            ${request.file_main ? `<a href="${esc(request.file_main)}" target="_blank">📄 View File</a>` : '<span class="text-muted-sm">Không có</span>'}
          </div>
          <div class="sh-card">
            <div class="section-title">Các file đính kèm phụ <span class="badge bg-secondary">${request.files.length}</span></div>
            ${request.files.map((f) => `<div><a href="${esc(f.file_path)}" target="_blank">📄 ${esc(f.file_path.split('/').pop())}</a></div>`).join('') ||
              '<span class="text-muted-sm">Không có</span>'}
          </div>
        </div>
        <div class="col-lg-4">
          <div class="sh-card mb-3">
            <div class="section-title">Tổng số tiền</div>
            <div class="rounded p-3 text-white" style="background:#2f80ed">
              <div class="text-white-50">Tổng thanh toán</div>
              <div style="font-size:24px;font-weight:700">${fmtMoney(request.total_amount, request.currency)}</div>
            </div>
            ${canMarkPaid ? `<div class="d-grid gap-2 mt-2">
              <button class="btn btn-success btn-sm" data-paid>✓ Đã thanh toán đủ</button>
              <button class="btn btn-outline-success btn-sm" data-partial>◐ Thanh toán 1 phần</button>
            </div>` : ''}
          </div>
          <div class="sh-card mb-3">
            <div class="section-title">Người xác nhận</div>
            ${request.approvers.map((a) => {
              const [label, bg, color] = approverBadge[a.status];
              return `<div class="d-flex justify-content-between align-items-center py-1">
                <span>${esc(a.user_name)}</span>
                <span class="sh-badge" style="background:${bg};color:${color}">${label}</span></div>
              ${a.comment ? `<div class="text-muted-sm mb-1">↳ ${esc(a.comment)}</div>` : ''}`;
            }).join('')}
            ${canApprove ? `<div class="d-grid gap-2 mt-2 border-top pt-2">
              <button class="btn btn-primary btn-sm" data-approve>✓ Xác nhận</button>
              <button class="btn btn-outline-danger btn-sm" data-reject>✕ Từ chối</button>
            </div>` : ''}
          </div>
          <div class="sh-card">
            <div class="section-title">Logs</div>
            <div class="sh-timeline">${logs.data.map((l) => `
              <div class="item"><div class="time">${fmtDateTime(l.created_at)}</div><div>${esc(l.activity)}</div></div>`).join('')}
            </div>
          </div>
        </div>
      </div>`,
      onMount: (el, close) => {
        const refresh = () => { close(); onChange?.(); openPaymentDetail(id, onChange); };

        el.querySelector('[data-edit]')?.addEventListener('click', () => {
          close();
          location.hash = `#/payments/${id}/edit`;
        });

        el.querySelector('[data-approve]')?.addEventListener('click', () =>
          tryDo(async () => {
            await post(`/payment-requests/${id}/approval`, { status: 'accepted' });
            toast('Đã xác nhận phiếu'); refresh();
          }));

        el.querySelector('[data-reject]')?.addEventListener('click', () => {
          openModal({
            title: 'Từ chối phiếu thanh toán',
            body: '<label class="form-label">Lý do từ chối</label><textarea class="form-control" id="rj-comment" rows="2"></textarea>',
            footer: '<button class="btn btn-light" data-close>Hủy</button><button class="btn btn-danger" data-ok>Từ chối</button>',
            onMount: (modal, closeModal) => {
              modal.querySelector('[data-ok]').onclick = () => tryDo(async () => {
                await post(`/payment-requests/${id}/approval`, {
                  status: 'reject',
                  comment: modal.querySelector('#rj-comment').value || null,
                });
                toast('Đã từ chối phiếu'); closeModal(); refresh();
              });
            },
          });
        });

        const markPaid = (partial) => tryDo(async () => {
          await post(`/payment-requests/${id}/mark-paid`, {
            paid_date: new Date().toISOString().slice(0, 10),
            partial,
          });
          toast(partial ? 'Đã ghi nhận thanh toán 1 phần' : 'Đã thanh toán đủ');
          refresh();
        });
        el.querySelector('[data-paid]')?.addEventListener('click', () => markPaid(false));
        el.querySelector('[data-partial]')?.addEventListener('click', () => markPaid(true));
      },
    });
    return panel;
  });
}
