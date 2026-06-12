// Trang Đề nghị thanh toán (/request-payment) — bám sát mockup:
// KPI cards + donut "Phân bố trạng thái" + "Sắp đến hạn" + bảng có filter.
import { get } from '../api.js';
import {
  esc, fmtMoney, fmtDate, badge, spinner, donutChart, paginationHtml, bindPagination, options,
} from '../ui.js';
import { PAYMENT_STATUS, PAYMENT_GROUPS } from '../constants.js';
import { openPaymentDetail } from './payment-detail.js';

export async function renderPayments(root) {
  root.innerHTML = spinner();
  const suppliers = (await get('/suppliers')).data;
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 29 * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  const range = { date_from: iso(monthAgo), date_to: iso(today) };
  const filters = { page: 1, status: '', payment_group: '', supplier_id: '', q: '' };

  root.innerHTML = `
    <div class="filters-bar mb-3 no-print">
      <input type="date" class="form-control form-control-sm" data-r="date_from" value="${range.date_from}">
      <span>—</span>
      <input type="date" class="form-control form-control-sm" data-r="date_to" value="${range.date_to}">
      <button class="btn btn-sm btn-light" data-load-stats>Áp dụng</button>
    </div>
    <div id="pay-stats">${spinner()}</div>

    <div class="sh-card mt-3">
      <div class="filters-bar mb-3 no-print">
        <select class="form-select form-select-sm" data-f="supplier_id">${options(suppliers, { empty: 'Tất cả nhà cung cấp' })}</select>
        <select class="form-select form-select-sm" data-f="payment_group">
          <option value="">Phân loại</option>
          ${Object.entries(PAYMENT_GROUPS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
        </select>
        <select class="form-select form-select-sm" data-f="status">
          <option value="">Trạng thái</option>
          ${Object.entries(PAYMENT_STATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
        </select>
        <input class="form-control form-control-sm" data-f="q" placeholder="Seri Number / Keyword">
        <button class="btn btn-sm btn-primary" data-search>Lọc</button>
        <a class="btn btn-sm btn-primary ms-auto" href="#/payments/create">✎ Tạo mới</a>
      </div>
      <div id="pay-table">${spinner()}</div>
    </div>`;

  const loadStats = async () => {
    const statsEl = root.querySelector('#pay-stats');
    statsEl.innerHTML = spinner();
    const stats = await get(`/payment-requests/stats?date_from=${range.date_from}&date_to=${range.date_to}`);
    const of = (status) => stats.by_status.find((r) => r.status === status) ?? { cnt: 0, total_vnd: 0, total_usd: 0 };
    const totals = stats.by_status.reduce(
      (acc, r) => ({ cnt: acc.cnt + r.cnt, vnd: acc.vnd + Number(r.total_vnd ?? 0), usd: acc.usd + Number(r.total_usd ?? 0) }),
      { cnt: 0, vnd: 0, usd: 0 },
    );

    const kpi = (num, label, sub, color, icon) => `
      <div class="col-md-4 col-xl-2"><div class="sh-card kpi-card h-100">
        <div class="icon" style="background:${color}22;color:${color}">${icon}</div>
        <div class="flex-grow-1"><div class="num">${num}</div><div class="label">${label}</div>
          <div class="sub">${sub}</div></div>
      </div></div>`;

    statsEl.innerHTML = `
      <div class="row g-3 mb-3">
        ${kpi(totals.cnt, 'Tổng đề nghị', `<span>${fmtMoney(totals.vnd)}</span><span>${fmtMoney(totals.usd, 'USD')}</span>`, '#2e90fa', '🧾')}
        ${kpi(of('accepted').cnt, 'Đã xác nhận', `<span>${fmtMoney(of('accepted').total_vnd)}</span><span>${fmtMoney(of('accepted').total_usd, 'USD')}</span>`, '#12b76a', '✓')}
        ${kpi(of('pending').cnt, 'Chờ xác nhận', `<span>${fmtMoney(of('pending').total_vnd)}</span>`, '#f79009', '⏳')}
        ${kpi(of('paid').cnt, 'Đã thanh toán', `<span>${fmtMoney(of('paid').total_vnd)}</span><span>${fmtMoney(of('paid').total_usd, 'USD')}</span>`, '#079455', '✓')}
        ${kpi(of('partial').cnt, 'Đã TT 1 phần', `<span>${fmtMoney(of('partial').total_vnd)}</span>`, '#06aed4', '◐')}
        ${kpi(stats.overdue?.cnt ?? 0, 'Quá hạn', `<span>${fmtMoney(stats.overdue?.total_vnd ?? 0)}</span><span>${fmtMoney(stats.overdue?.total_usd ?? 0, 'USD')}</span>`, '#f04438', '⚠')}
      </div>
      <div class="row g-3">
        <div class="col-md-6"><div class="sh-card h-100">
          <div class="section-title">Phân bố trạng thái</div>
          <div class="d-flex align-items-center gap-4 flex-wrap">
            ${donutChart(Object.entries(PAYMENT_STATUS).map(([k, v]) => ({ value: of(k).cnt, color: v.chart })), 'Tổng')}
            <div class="flex-grow-1">${Object.entries(PAYMENT_STATUS).map(([k, v]) => `
              <div class="d-flex justify-content-between py-1">
                <span><span style="color:${v.chart}">●</span> ${v.label}</span><b>${of(k).cnt}</b></div>`).join('')}
              <div class="d-flex justify-content-between py-1 border-top">
                <span><span style="color:#f04438">●</span> Quá hạn</span><b>${stats.overdue?.cnt ?? 0}</b></div>
            </div>
          </div>
        </div></div>
        <div class="col-md-6"><div class="sh-card h-100">
          <div class="section-title">⚡ Sắp đến hạn thanh toán</div>
          <div style="max-height:260px;overflow-y:auto">
            ${stats.due_soon.map((d) => `<div class="due-item d-flex justify-content-between align-items-center cursor-pointer" data-open="${d.id}">
              <div><b class="text-danger">${esc(d.serial_number)}</b>
                <div class="text-muted-sm">${esc(d.created_by_name)} · Hạn: ${fmtDate(d.due_date)}</div></div>
              <div class="text-end"><b>${fmtMoney(d.total_amount, d.currency)}</b>
                ${d.overdue_days > 0 ? `<div><span class="sh-badge" style="background:#f04438;color:#fff">Quá ${d.overdue_days}n</span></div>` : ''}</div>
            </div>`).join('') || '<div class="text-muted-sm">Không có phiếu nào sắp đến hạn 🎉</div>'}
          </div>
        </div></div>
      </div>`;
    statsEl.querySelectorAll('[data-open]').forEach((el) => {
      el.onclick = () => openPaymentDetail(el.dataset.open, loadAll);
    });
  };

  const loadTable = async () => {
    const tableEl = root.querySelector('#pay-table');
    tableEl.innerHTML = spinner();
    const params = new URLSearchParams({ page: filters.page, per_page: 25 });
    for (const key of ['status', 'payment_group', 'supplier_id', 'q']) {
      if (filters[key]) params.set(key, filters[key]);
    }
    const { data, meta } = await get(`/payment-requests?${params}`);

    tableEl.innerHTML = `<div class="table-responsive"><table class="sh-table">
      <thead><tr><th>STT</th><th>Seri Number</th><th>Người tạo</th><th>Người xác nhận</th>
      <th>Nhà cung cấp</th><th>Phân loại</th><th>Tổng số tiền</th><th>Ngày tạo</th><th>Ngày hết hạn</th><th>Trạng thái</th></tr></thead>
      <tbody>${data.map((r, i) => `<tr>
        <td class="text-muted-sm">${(meta.page - 1) * meta.per_page + i + 1}</td>
        <td><a class="row-link cursor-pointer" data-open="${r.id}">${esc(r.serial_number)}</a></td>
        <td>${esc(r.created_by_name)}</td>
        <td class="text-truncate" style="max-width:220px">${esc(r.approver_names ?? '—')}</td>
        <td>${esc(r.supplier_name ?? 'Khác')}</td>
        <td>${PAYMENT_GROUPS[r.payment_group] ?? esc(r.payment_group)}</td>
        <td><b>${fmtMoney(r.total_amount, r.currency)}</b></td>
        <td>${fmtDate(r.created_at)}</td>
        <td>${fmtDate(r.due_date)} ${r.is_overdue ? '<span class="sh-badge" style="background:#f04438;color:#fff">Quá hạn</span>' : ''}</td>
        <td>${badge(r.status, PAYMENT_STATUS)}</td>
      </tr>`).join('') || '<tr><td colspan="10" class="text-center text-muted py-4">Không có phiếu nào</td></tr>'}</tbody>
    </table></div>${paginationHtml(meta)}`;

    bindPagination(tableEl, (page) => { filters.page = page; loadTable(); });
    tableEl.querySelectorAll('[data-open]').forEach((el) => {
      el.onclick = () => openPaymentDetail(el.dataset.open, loadAll);
    });
  };

  const loadAll = () => { loadStats(); loadTable(); };

  root.querySelector('[data-load-stats]').onclick = () => {
    root.querySelectorAll('[data-r]').forEach((el) => { range[el.dataset.r] = el.value; });
    loadStats();
  };
  root.querySelector('[data-search]').onclick = () => {
    root.querySelectorAll('[data-f]').forEach((el) => { filters[el.dataset.f] = el.value; });
    filters.page = 1;
    loadTable();
  };
  loadAll();
}
