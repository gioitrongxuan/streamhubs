import { get } from '../api.js';
import { esc, fmtDateTime, badge, spinner, paginationHtml, bindPagination, options } from '../ui.js';
import { ITEM_STATUS, ERROR_AT } from '../constants.js';

export async function renderErrors(root) {
  root.innerHTML = spinner();
  const suppliers = (await get('/suppliers')).data;
  const filters = { page: 1, error_at: '', supplier_id: '' };

  root.innerHTML = `
    <h5 class="mb-3">Đơn lỗi</h5>
    <div class="sh-card mb-3 filters-bar no-print">
      <select class="form-select form-select-sm" data-f="error_at">
        <option value="">Nguồn gốc lỗi</option>
        ${Object.entries(ERROR_AT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
      </select>
      <select class="form-select form-select-sm" data-f="supplier_id">${options(suppliers, { empty: 'Tất cả xưởng' })}</select>
      <button class="btn btn-sm btn-primary" data-search>Lọc</button>
    </div>
    <div id="errors-table">${spinner()}</div>`;

  const load = async () => {
    const el = root.querySelector('#errors-table');
    el.innerHTML = spinner();
    const params = new URLSearchParams({ page: filters.page, per_page: 25 });
    if (filters.error_at) params.set('error_at', filters.error_at);
    if (filters.supplier_id) params.set('supplier_id', filters.supplier_id);
    const { data, meta } = await get(`/errors?${params}`);

    el.innerHTML = `<div class="sh-card p-0"><div class="table-responsive"><table class="sh-table">
      <thead><tr><th>Order ID</th><th>SKU</th><th>Loại SP</th><th>SL</th><th>Xưởng</th>
      <th>Nguồn lỗi</th><th>Lý do</th><th>Trạng thái</th><th>Cập nhật</th></tr></thead>
      <tbody>${data.map((r) => `<tr>
        <td><a class="row-link" href="#/orders/${r.order_id}">${esc(r.order_code)}</a></td>
        <td>${esc(r.sku ?? '—')}</td><td>${esc(r.product_type_name)}</td><td>${r.qty}</td>
        <td>${esc(r.supplier_name ?? '—')}</td>
        <td><span class="sh-badge" style="background:#fee4e2;color:#b42318">${ERROR_AT[r.error_at] ?? esc(r.error_at ?? '—')}</span></td>
        <td>${esc(r.error_reason)}</td>
        <td>${badge(r.status, ITEM_STATUS)}</td>
        <td>${fmtDateTime(r.updated_at)}</td>
      </tr>`).join('') || '<tr><td colspan="9" class="text-center text-muted py-4">Không có đơn lỗi 🎉</td></tr>'}</tbody>
    </table></div></div>${paginationHtml(meta)}`;
    bindPagination(el, (page) => { filters.page = page; load(); });
  };

  root.querySelector('[data-search]').onclick = () => {
    root.querySelectorAll('[data-f]').forEach((i) => { filters[i.dataset.f] = i.value; });
    filters.page = 1;
    load();
  };
  await load();
}
