import { get } from '../api.js';
import { esc, fmtMoney, fmtDate, badge, paginationHtml, bindPagination, spinner, options } from '../ui.js';
import { ORDER_STATUS } from '../constants.js';

export async function renderOrders(root) {
  const hashQuery = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const filters = {
    status: hashQuery.get('status') ?? '',
    shop_id: '', q: '', date_from: '', date_to: '', page: 1,
  };
  const shops = (await get('/shops/options')).data;

  root.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="m-0">Orders</h5>
      <a class="btn btn-primary btn-sm" href="#/orders/create">＋ Tạo order</a>
    </div>
    <div class="sh-card mb-3 filters-bar no-print">
      <select class="form-select form-select-sm" data-f="status">
        <option value="">Trạng thái</option>
        ${Object.entries(ORDER_STATUS).map(([k, v]) =>
          `<option value="${k}" ${filters.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
      </select>
      <select class="form-select form-select-sm" data-f="shop_id">${options(shops, { empty: 'Tất cả shop' })}</select>
      <input class="form-control form-control-sm" data-f="q" placeholder="Order ID / Tracking / Tên KH">
      <input type="date" class="form-control form-control-sm" data-f="date_from">
      <input type="date" class="form-control form-control-sm" data-f="date_to">
      <button class="btn btn-sm btn-primary" data-search>Lọc</button>
    </div>
    <div id="orders-table">${spinner()}</div>`;

  const load = async () => {
    const tableEl = root.querySelector('#orders-table');
    tableEl.innerHTML = spinner();
    const params = new URLSearchParams({ page: filters.page, per_page: 25 });
    for (const key of ['status', 'shop_id', 'q', 'date_from', 'date_to']) {
      if (filters[key]) params.set(key, filters[key]);
    }
    const { data, meta } = await get(`/orders?${params}`);

    tableEl.innerHTML = `
      <div class="sh-card p-0"><div class="table-responsive"><table class="sh-table">
        <thead><tr><th>Order ID</th><th>Shop</th><th>Listing</th><th>Trạng thái</th><th>Designer</th>
        <th>Xưởng</th><th>Tổng tiền</th><th>Country</th><th>Ngày tạo</th><th>Đẩy xưởng</th></tr></thead>
        <tbody>${data.map((o) => `<tr>
          <td><a class="row-link" href="#/orders/${o.id}">${esc(o.order_code)}</a>
            ${o.labels?.includes('lam_gap') ? '<span class="sh-badge ms-1" style="background:#fee4e2;color:#b42318">Gấp</span>' : ''}
            ${o.merged_order_id ? '<span class="sh-badge ms-1" style="background:#eef2f6;color:#475467">Gộp</span>' : ''}</td>
          <td>${esc(o.shop_name)}</td>
          <td class="text-truncate" style="max-width:220px">${esc(o.listing_name ?? '—')}</td>
          <td>${badge(o.status, ORDER_STATUS)}</td>
          <td>${esc(o.designer_name ?? '—')}</td>
          <td>${esc(o.supplier_name ?? '—')}</td>
          <td><b>${fmtMoney(o.order_total, o.currency)}</b></td>
          <td>${esc(o.country ?? '—')}</td>
          <td>${fmtDate(o.created_at)}</td>
          <td>${fmtDate(o.pushed_at)}</td>
        </tr>`).join('') || '<tr><td colspan="10" class="text-center text-muted py-4">Không có order nào</td></tr>'}</tbody>
      </table></div></div>
      ${paginationHtml(meta)}`;
    bindPagination(tableEl, (page) => { filters.page = page; load(); });
  };

  root.querySelector('[data-search]').onclick = () => {
    root.querySelectorAll('[data-f]').forEach((el) => { filters[el.dataset.f] = el.value; });
    filters.page = 1;
    load();
  };
  await load();
}
