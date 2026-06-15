// Nhập kho (tách segment theo issue #12):
//   1) Nhập kho phôi        — scan tem phôi → nhận diện lô + đơn giá, cộng dồn SL & tiền realtime
//   2) Nhập kho sản phẩm khác — (chờ backend) khung placeholder
//   3) Lịch sử nhập kho      — báo cáo theo ngày / lô, in phiếu (lưu lịch sử), đẩy đề nghị thanh toán
//   4) Lịch sử in phiếu      — danh sách phiếu in báo cáo nhập
import { get, post } from '../api.js';
import { esc, fmtMoney, fmtDate, fmtDateTime, spinner, options, toast, tryDo, openModal } from '../ui.js';
import { state } from '../app.js';
import { hasPerm } from '../perm.js';

const todayStr = () => new Date().toISOString().slice(0, 10);
const variantOf = (r) => [r.color, r.size].filter(Boolean).join(' / ') || '—';

export async function renderScanIn(root) {
  root.innerHTML = spinner();
  const [shelves, lots] = await Promise.all([get('/shelves'), get('/inventory/lots')]);
  const canPay = hasPerm(state.user.permissions, 'payment.create');

  // Phiên scan hiện tại (chỉ ở client) — cộng dồn các phôi vừa nhập.
  const session = [];
  // Phạm vi báo cáo đang xem + id phiếu in gần nhất để liên kết khi đẩy thanh toán.
  let scope = { date: todayStr(), lot_id: null };
  let lastPrint = null;

  const TABS = [
    ['phoi', 'Nhập kho phôi'],
    ['other', 'Nhập kho sản phẩm khác'],
    ['history', 'Lịch sử nhập kho'],
    ['prints', 'Lịch sử in phiếu'],
  ];

  const panelPhoi = `
    <div class="row g-3">
      <div class="col-md-5"><div class="sh-card">
        <div class="section-title">Scan QR phôi</div>
        <form id="form-in">
          <div class="mb-2"><label class="form-label">Kệ đích *</label>
            <select class="form-select" name="shelf_id" required>${options(shelves.data, {
              label: 'name', empty: '— Chọn kệ —',
            })}</select></div>
          <div class="mb-2"><label class="form-label">Mã QR phôi *</label>
            <input class="form-control" name="qrcode" placeholder="CH-HDI-0042-0001" autocomplete="off"></div>
          <button class="btn btn-primary w-100">⤵ Nhập kho</button>
        </form>
      </div></div>
      <div class="col-md-7"><div class="sh-card p-0">
        <div class="p-3 pb-2 d-flex justify-content-between align-items-center">
          <span class="section-title m-0">Phiên scan hiện tại</span>
          <button class="btn btn-sm btn-light" id="btn-clear-session">Xóa danh sách</button>
        </div>
        <div id="session-box"></div>
      </div></div>
    </div>`;

  const panelOther = `
    <div class="sh-card text-center text-muted py-5">
      <div style="font-size:32px">📦</div>
      <p class="mb-1 mt-2">Nhập kho cho các sản phẩm khác (không phải phôi)</p>
      <p class="text-muted-sm m-0">Tính năng đang được phát triển — sẽ bổ sung loại hàng và quy trình scan riêng.</p>
    </div>`;

  const panelHistory = `
    <div class="sh-card">
      <div class="filters-bar d-flex flex-wrap align-items-end gap-2 mb-3 no-print">
        <div><label class="form-label">Ngày nhập</label>
          <input type="date" class="form-control" id="rp-date" value="${todayStr()}"></div>
        <div><label class="form-label">Lô nhập</label>
          <select class="form-select" id="rp-lot">
            <option value="">— Tất cả lô —</option>
            ${lots.data.map((l) => `<option value="${l.id}">${esc(l.lot_number)} · ${esc(l.product_type_name)} (${esc(variantOf(l))})</option>`).join('')}
          </select></div>
        <button class="btn btn-primary" id="btn-view-report">Xem báo cáo</button>
        <div class="ms-auto d-flex gap-2">
          <button class="btn btn-light" id="btn-print" disabled>🖨 In &amp; lưu lịch sử</button>
          ${canPay ? '<button class="btn btn-success" id="btn-push-pay" disabled>💳 Tạo đề nghị thanh toán</button>' : ''}
        </div>
      </div>
      <div id="report-result"><div class="text-muted text-center py-4 no-print">Chọn ngày / lô rồi bấm “Xem báo cáo”.</div></div>
    </div>`;

  const panelPrints = `
    <div class="sh-card p-0">
      <div class="p-3 pb-0 section-title">Phiếu in báo cáo nhập gần đây</div>
      <div id="print-history">${spinner()}</div>
    </div>`;

  const panels = { phoi: panelPhoi, other: panelOther, history: panelHistory, prints: panelPrints };

  root.innerHTML = `
    <h5 class="mb-3">Nhập kho</h5>
    <div class="sh-tabs mb-3 no-print">${TABS.map(([id, label], i) =>
      `<button type="button" class="btn btn-sm ${i === 0 ? 'btn-primary' : 'btn-light'}" data-tab="${id}">${esc(label)}</button>`).join('')}</div>
    ${TABS.map(([id], i) => `<div data-tab-panel="${id}" ${i === 0 ? '' : 'hidden'}>${panels[id]}</div>`).join('')}
    <style>.sh-tabs { display: flex; gap: 8px; flex-wrap: wrap; }</style>`;

  root.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.onclick = () => {
      root.querySelectorAll('[data-tab]').forEach((b) =>
        b.classList.replace(b === btn ? 'btn-light' : 'btn-primary', b === btn ? 'btn-primary' : 'btn-light'));
      root.querySelectorAll('[data-tab-panel]').forEach((p) => { p.hidden = p.dataset.tabPanel !== btn.dataset.tab; });
      if (btn.dataset.tab === 'phoi') root.querySelector('#form-in [name=qrcode]')?.focus();
    };
  });

  // --- Tab 1: Nhập kho phôi --------------------------------------------------
  const renderSession = () => {
    const total = session.reduce((s, r) => s + Number(r.unit_price ?? 0), 0);
    root.querySelector('#session-box').innerHTML = `<table class="sh-table">
      <thead><tr><th>QR</th><th>Lô</th><th class="text-end">Đơn giá</th></tr></thead>
      <tbody>${session.map((r) => `<tr>
        <td style="font-family:monospace">${esc(r.qrcode)}</td>
        <td>${esc(r.lot_number)} <span class="text-muted-sm">${esc(r.variant)}</span></td>
        <td class="text-end">${fmtMoney(r.unit_price)}</td></tr>`).join('') ||
        '<tr><td colspan="3" class="text-muted text-center py-3">Chưa scan phôi nào</td></tr>'}</tbody>
      <tfoot><tr><td><b>${session.length} phôi</b></td><td class="text-end"><b>Tổng tiền</b></td>
        <td class="text-end"><b>${fmtMoney(total)}</b></td></tr></tfoot></table>`;
  };
  renderSession();

  root.querySelector('#btn-clear-session').onclick = () => { session.length = 0; renderSession(); };

  root.querySelector('#form-in').onsubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const input = e.target.querySelector('[name=qrcode]');
    tryDo(async () => {
      const info = await post('/inventory/in', {
        qrcode: form.get('qrcode').trim(),
        shelf_id: Number(form.get('shelf_id')),
      });
      session.unshift({
        qrcode: info.qrcode, lot_number: info.lot_number,
        variant: variantOf(info), unit_price: info.unit_price_vnd,
      });
      renderSession();
      toast(`Đã nhập ${info.qrcode} · ${fmtMoney(info.unit_price_vnd)}`);
      input.value = '';
      input.focus();
    });
  };

  // --- Tab 3: Lịch sử nhập kho (báo cáo) -------------------------------------
  const qs = () => {
    const params = new URLSearchParams();
    if (scope.date) params.set('date', scope.date);
    if (scope.lot_id) params.set('lot_id', scope.lot_id);
    return params.toString();
  };

  const setActionsEnabled = (on) => {
    root.querySelector('#btn-print').disabled = !on;
    if (root.querySelector('#btn-push-pay')) root.querySelector('#btn-push-pay').disabled = !on;
  };

  const renderReport = async () => {
    scope = {
      date: root.querySelector('#rp-date').value || null,
      lot_id: root.querySelector('#rp-lot').value ? Number(root.querySelector('#rp-lot').value) : null,
    };
    lastPrint = null;
    const box = root.querySelector('#report-result');
    box.innerHTML = spinner();
    const { rows, summary } = await get(`/inventory/in/report?${qs()}`);
    const scopeLabel = scope.date ? `Ngày ${fmtDate(scope.date)}` : 'Tất cả các ngày';
    const lotLabel = scope.lot_id
      ? ` · Lô ${esc(rows[0]?.lot_number ?? root.querySelector('#rp-lot').selectedOptions[0].text)}`
      : '';
    box.innerHTML = `
      <div class="d-flex justify-content-between align-items-baseline mb-2">
        <h6 class="m-0">Báo cáo nhập kho phôi</h6>
        <span class="text-muted-sm">${scopeLabel}${lotLabel}</span>
      </div>
      <div class="table-responsive"><table class="sh-table">
        <thead><tr><th>Lô</th><th>Loại SP</th><th>Màu / Size</th><th>NCC</th>
          <th class="text-end">SL</th><th class="text-end">Đơn giá</th><th class="text-end">Thành tiền</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td><b>${esc(r.lot_number)}</b></td><td>${esc(r.product_type_name)}</td>
          <td>${esc(variantOf(r))}</td><td>${esc(r.supplier_name)}</td>
          <td class="text-end">${r.qty}</td><td class="text-end">${fmtMoney(r.unit_price_vnd)}</td>
          <td class="text-end">${fmtMoney(r.amount)}</td></tr>`).join('') ||
          '<tr><td colspan="7" class="text-muted text-center py-3">Không có lượt nhập nào trong phạm vi này</td></tr>'}</tbody>
        <tfoot><tr><td colspan="4"><b>Tổng cộng</b></td>
          <td class="text-end"><b>${summary.total_qty}</b></td><td></td>
          <td class="text-end"><b>${fmtMoney(summary.total_amount)}</b></td></tr></tfoot>
      </table></div>`;
    setActionsEnabled(rows.length > 0);
  };

  root.querySelector('#btn-view-report').onclick = () => tryDo(renderReport);

  root.querySelector('#btn-print').onclick = () => tryDo(async () => {
    const res = await post('/inventory/print-history', { date: scope.date ?? undefined, lot_id: scope.lot_id ?? undefined });
    lastPrint = { ...scope, id: res.id };
    toast(`Đã lưu lịch sử phiếu in · ${fmtMoney(res.total_amount)}`);
    loadPrintHistory();
    window.print();
  });

  const pushBtn = root.querySelector('#btn-push-pay');
  if (pushBtn) {
    pushBtn.onclick = () => tryDo(async () => {
      const users = await get('/users/options');
      openModal({
        title: 'Tạo đề nghị thanh toán từ báo cáo nhập',
        body: `<p class="text-muted-sm">Mỗi lô trong báo cáo sẽ thành một khoản chi (phân loại “Phôi sản phẩm”).</p>
          <label class="form-label">Người xác nhận *</label>
          <select class="form-select" id="pp-approvers" multiple size="5">${users.data
            .map((u) => `<option value="${u.id}">${esc(u.name)} (${esc(u.role_name)})</option>`).join('')}</select>
          <div class="text-muted-sm mt-1">Giữ Ctrl để chọn nhiều người duyệt</div>`,
        footer: '<button class="btn btn-light" data-close>Hủy</button><button class="btn btn-success" data-ok>Tạo phiếu</button>',
        onMount: (el, close) => {
          el.querySelector('[data-ok]').onclick = () => tryDo(async () => {
            const approverIds = [...el.querySelector('#pp-approvers').selectedOptions].map((o) => Number(o.value));
            if (!approverIds.length) { toast('Chọn ít nhất một người xác nhận', 'error'); return; }
            const linkId = lastPrint && lastPrint.date === scope.date && lastPrint.lot_id === scope.lot_id
              ? lastPrint.id : null;
            const { serial_number } = await post('/inventory/in/payment-request', {
              date: scope.date ?? undefined,
              lot_id: scope.lot_id ?? undefined,
              approver_ids: approverIds,
              print_history_id: linkId ?? undefined,
            });
            toast(`Đã tạo đề nghị thanh toán ${serial_number}`);
            close();
            loadPrintHistory();
            location.hash = '#/payments';
          });
        },
      });
    });
  }

  // --- Tab 4: Lịch sử in phiếu -----------------------------------------------
  const loadPrintHistory = async () => {
    const { data } = await get('/inventory/print-history');
    root.querySelector('#print-history').innerHTML = `<table class="sh-table">
      <thead><tr><th>Thời gian</th><th>Phạm vi</th><th class="text-end">SL</th><th class="text-end">Tổng tiền</th>
        <th>Người in</th><th>Đề nghị TT</th></tr></thead>
      <tbody>${data.map((r) => `<tr>
        <td>${fmtDateTime(r.created_at)}</td>
        <td>${r.report_type === 'lot' ? `Lô ${esc(r.lot_number ?? '—')}` : `Ngày ${fmtDate(r.report_date)}${r.lot_number ? ` · Lô ${esc(r.lot_number)}` : ''}`}</td>
        <td class="text-end">${r.total_qty}</td><td class="text-end">${fmtMoney(r.total_amount)}</td>
        <td>${esc(r.printed_by_name)}</td>
        <td>${r.serial_number ? `<a href="#/payments">${esc(r.serial_number)}</a>` : '—'}</td></tr>`).join('') ||
        '<tr><td colspan="6" class="text-muted text-center py-3">Chưa có phiếu in nào</td></tr>'}</tbody></table>`;
  };

  root.querySelector('#form-in [name=qrcode]').focus();
  await Promise.all([renderReport(), loadPrintHistory()]);
}
