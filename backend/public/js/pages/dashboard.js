import { get } from '../api.js';
import { esc, spinner, donutChart, badge } from '../ui.js';
import { ORDER_STATUS } from '../constants.js';
import { state } from '../app.js';
import { hasPerm } from '../perm.js';

const GROUPS = [
  { label: 'Cần xử lý design', statuses: ['new', 'need_confirm', 'designing', 'pending_review'], color: '#f79009' },
  { label: 'Đang sản xuất', statuses: ['designed', 'in_production', 'producing', 'redo', 'fixing', 'factory_return'], color: '#2e90fa' },
  { label: 'Hậu kỳ / QC', statuses: ['produced', 'in_finishing', 'qc_passed'], color: '#7a5af8' },
  { label: 'Vận chuyển', statuses: ['out_stock', 'shipped', 'in_transit'], color: '#06aed4' },
  { label: 'Hoàn tất', statuses: ['complete'], color: '#12b76a' },
];

export async function renderDashboard(root) {
  root.innerHTML = spinner();
  if (!hasPerm(state.user.permissions, 'orders.view')) {
    root.innerHTML = `<div class="sh-card">Xin chào <b>${esc(state.user.name)}</b> — dùng menu bên trái để bắt đầu.</div>`;
    return;
  }
  const { by_status } = await get('/orders/stats');
  const countOf = (statuses) => by_status.filter((r) => statuses.includes(r.status)).reduce((s, r) => s + r.cnt, 0);

  root.innerHTML = `
    <h5 class="mb-3">Dashboard</h5>
    <div class="row g-3 mb-3">
      ${GROUPS.map((g) => `
        <div class="col"><div class="sh-card kpi-card">
          <div class="icon" style="background:${g.color}22;color:${g.color}">●</div>
          <div><div class="num">${countOf(g.statuses)}</div><div class="label">${esc(g.label)}</div></div>
        </div></div>`).join('')}
    </div>
    <div class="row g-3">
      <div class="col-md-5"><div class="sh-card">
        <div class="section-title">Phân bố trạng thái order</div>
        <div class="d-flex align-items-center gap-4">
          ${donutChart(GROUPS.map((g) => ({ value: countOf(g.statuses), color: g.color })), 'Tổng')}
          <div class="flex-grow-1">${GROUPS.map((g) => `
            <div class="d-flex justify-content-between py-1">
              <span><span style="color:${g.color}">●</span> ${esc(g.label)}</span><b>${countOf(g.statuses)}</b>
            </div>`).join('')}
          </div>
        </div>
      </div></div>
      <div class="col-md-7"><div class="sh-card">
        <div class="section-title">Chi tiết theo trạng thái</div>
        <div class="d-flex flex-wrap gap-2">
          ${by_status
            .sort((a, b) => b.cnt - a.cnt)
            .map((r) => `<a class="text-decoration-none" href="#/orders?status=${r.status}">
              ${badge(r.status, ORDER_STATUS)} <b class="me-2">${r.cnt}</b></a>`)
            .join('') || '<span class="text-muted-sm">Chưa có order</span>'}
        </div>
      </div></div>
    </div>`;
}
