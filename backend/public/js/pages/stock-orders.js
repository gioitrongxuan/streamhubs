// Order xưởng (/stock/order trong docs): lệnh sản xuất cho Production Staff —
// gắn máy/operator, bắt đầu/kết thúc thêu, ghi nhận lỗi trên từng order_item.
import { get, post, patch } from '../api.js';
import { esc, fmtDate, badge, spinner, openModal, options, toast, tryDo, paginationHtml, bindPagination } from '../ui.js';
import { ORDER_STATUS, ITEM_STATUS, ERROR_AT, PRODUCTION_STATUSES } from '../constants.js';
import { state } from '../app.js';
import { hasPerm } from '../perm.js';

export async function renderStockOrders(root) {
  root.innerHTML = spinner();
  const [machines, users] = await Promise.all([
    hasPerm(state.user.permissions, 'warehouse.machine') ? get('/machines') : Promise.resolve({ data: [] }),
    get('/users/options'),
  ]);
  const canUpdate = hasPerm(state.user.permissions, 'warehouse.production_update');
  const filters = { page: 1, q: '', urgent: false };

  root.innerHTML = `
    <h5 class="mb-3">Order xưởng — Lệnh sản xuất</h5>
    <div class="sh-card mb-3 filters-bar no-print">
      <input class="form-control form-control-sm" data-f="q" placeholder="Order ID / SKU">
      <label class="form-check"><input type="checkbox" class="form-check-input" data-f="urgent">
        <span class="form-check-label">Làm gấp</span></label>
      <button class="btn btn-sm btn-primary" data-search>Lọc</button>
    </div>
    <div id="stock-list">${spinner()}</div>`;

  const load = async () => {
    const listEl = root.querySelector('#stock-list');
    listEl.innerHTML = spinner();
    const params = new URLSearchParams({
      status: PRODUCTION_STATUSES.join(','), page: filters.page, per_page: 10, with_items: 1,
    });
    if (filters.q) params.set('q', filters.q);
    if (filters.urgent) params.set('label', 'lam_gap');
    const { data, meta } = await get(`/orders?${params}`);

    const blocks = data.map(orderBlock);
    listEl.innerHTML = `${blocks.join('') || '<div class="sh-card text-center text-muted py-4">Không có lệnh sản xuất</div>'}
      ${paginationHtml(meta)}`;
    bindPagination(listEl, (page) => { filters.page = page; load(); });
    bindActions(listEl);
  };

  function orderBlock(order) {
    return `<div class="sh-card mb-3">
      <div class="d-flex justify-content-between flex-wrap gap-2">
        <div>
          <a class="row-link" href="#/orders/${order.id}">${esc(order.order_code)}</a>
          ${badge(order.status, ORDER_STATUS)}
          ${order.labels?.includes('lam_gap') ? '<span class="sh-badge ms-1" style="background:#fee4e2;color:#b42318">Làm gấp</span>' : ''}
          <div class="text-muted-sm">Đẩy xưởng: ${fmtDate(order.pushed_at)} · ${esc(order.country ?? '')} · Xưởng: ${esc(order.supplier_name ?? '—')}</div>
        </div>
        <button class="btn btn-sm btn-outline-secondary no-print" onclick="window.print()">🖨 Lệnh sản xuất</button>
      </div>
      <table class="sh-table mt-2"><thead><tr>
        <th>SKU</th><th>Loại SP</th><th>SL</th><th>Personalization</th><th>Máy</th><th>KTV</th><th>Trạng thái</th><th class="no-print"></th>
      </tr></thead><tbody>
        ${order.items.map((item) => `<tr>
          <td>${esc(item.sku ?? '—')}</td>
          <td>${esc(item.product_type_name)}</td>
          <td>${item.qty}</td>
          <td class="text-truncate" style="max-width:200px">${esc(item.personalization ?? '—')}</td>
          <td>${esc(item.machine_name ?? '—')}</td>
          <td>${esc(item.operator_name ?? '—')}</td>
          <td>${badge(item.status, ITEM_STATUS)}
            ${item.error_reason ? `<div class="text-danger text-muted-sm">⚠ ${esc(item.error_reason)}</div>` : ''}</td>
          <td class="no-print text-end" style="white-space:nowrap">
            ${canUpdate ? `
              <button class="btn btn-sm btn-light" data-assign="${item.id}">Gắn máy</button>
              ${item.status === 'pending' ? `<button class="btn btn-sm btn-primary" data-set="${item.id}:in_progress">▶ Bắt đầu</button>` : ''}
              ${item.status === 'in_progress' ? `<button class="btn btn-sm btn-success" data-set="${item.id}:done">✓ Xong</button>` : ''}
              <button class="btn btn-sm btn-outline-danger" data-error="${item.id}">Lỗi</button>` : ''}
          </td>
        </tr>`).join('')}
      </tbody></table>
    </div>`;
  }

  function bindActions(listEl) {
    listEl.querySelectorAll('[data-set]').forEach((btn) => {
      btn.onclick = () => tryDo(async () => {
        const [itemId, status] = btn.dataset.set.split(':');
        await patch(`/order-items/${itemId}`, { status });
        toast('Đã cập nhật'); load();
      });
    });

    listEl.querySelectorAll('[data-assign]').forEach((btn) => {
      btn.onclick = () => openModal({
        title: 'Gắn máy thêu & kỹ thuật viên',
        body: `<div class="row g-2">
          <div class="col-6"><label class="form-label">Máy thêu</label>
            <select class="form-select" id="as-machine">${options(machines.data)}</select></div>
          <div class="col-6"><label class="form-label">Kỹ thuật viên</label>
            <select class="form-select" id="as-operator">${options(users.data)}</select></div></div>`,
        footer: '<button class="btn btn-light" data-close>Hủy</button><button class="btn btn-primary" data-ok>Lưu</button>',
        onMount: (el, close) => {
          el.querySelector('[data-ok]').onclick = () => tryDo(async () => {
            await patch(`/order-items/${btn.dataset.assign}`, {
              machine_id: Number(el.querySelector('#as-machine').value) || null,
              operator_id: Number(el.querySelector('#as-operator').value) || null,
            });
            toast('Đã gắn máy'); close(); load();
          });
        },
      });
    });

    listEl.querySelectorAll('[data-error]').forEach((btn) => {
      btn.onclick = () => openModal({
        title: 'Ghi nhận lỗi sản xuất',
        body: `<div class="mb-2"><label class="form-label">Nguồn gốc lỗi</label>
            <select class="form-select" id="er-at">${Object.entries(ERROR_AT)
              .map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          <label class="form-label">Lý do</label><textarea class="form-control" id="er-reason" rows="2"></textarea>`,
        footer: '<button class="btn btn-light" data-close>Hủy</button><button class="btn btn-danger" data-ok>Ghi nhận + Làm lại</button>',
        onMount: (el, close) => {
          el.querySelector('[data-ok]').onclick = () => tryDo(async () => {
            await patch(`/order-items/${btn.dataset.error}`, {
              status: 'redo',
              error_at: el.querySelector('#er-at').value,
              error_reason: el.querySelector('#er-reason').value,
            });
            await post(`/order-items/${btn.dataset.error}/notes`, {
              note: `Lý do làm lại: ${el.querySelector('#er-reason').value}`,
            });
            toast('Đã ghi nhận lỗi'); close(); load();
          });
        },
      });
    });
  }

  root.querySelector('[data-search]').onclick = () => {
    filters.q = root.querySelector('[data-f="q"]').value;
    filters.urgent = root.querySelector('[data-f="urgent"]').checked;
    filters.page = 1;
    load();
  };
  await load();
}
