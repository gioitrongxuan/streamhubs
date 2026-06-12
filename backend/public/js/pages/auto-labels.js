import { get, post } from '../api.js';
import { esc, fmtDateTime, spinner, openModal, toast, tryDo } from '../ui.js';

const LABEL_STATUS = {
  pending: ['Chờ tạo', '#fef0c7', '#b54708'], generated: ['Đã tạo', '#d1fadf', '#067647'],
  printed: ['Đã in', '#d1e9ff', '#175cd3'], failed: ['Thất bại', '#fee4e2', '#b42318'],
};

export async function renderAutoLabels(root) {
  root.innerHTML = spinner();
  const labels = (await get('/auto-labels')).data;

  root.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="m-0">Auto Label — Nhãn vận chuyển</h5>
      <button class="btn btn-primary btn-sm" data-create>＋ Tạo label</button>
    </div>
    <div class="sh-card p-0"><div class="table-responsive"><table class="sh-table">
      <thead><tr><th>Order</th><th>Carrier</th><th>Service</th><th>Tracking</th><th>Label</th><th>Trạng thái</th><th>Tạo lúc</th><th></th></tr></thead>
      <tbody>${labels.map((l) => {
        const [statusLabel, bg, color] = LABEL_STATUS[l.status] ?? [l.status, '#eef2f6', '#475467'];
        return `<tr>
          <td><a class="row-link" href="#/orders/${l.order_id}">${esc(l.order_code)}</a></td>
          <td>${esc(l.carrier)}</td><td>${esc(l.service ?? '—')}</td>
          <td><b>${esc(l.tracking_number ?? '—')}</b></td>
          <td>${l.label_url ? `<a href="${esc(l.label_url)}" target="_blank">📄 PDF</a>` : '—'}</td>
          <td><span class="sh-badge" style="background:${bg};color:${color}">${statusLabel}</span></td>
          <td>${fmtDateTime(l.created_at)}</td>
          <td>${l.status === 'generated' ? `<button class="btn btn-sm btn-light" data-printed="${l.id}">Đã in</button>` : ''}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="8" class="text-center text-muted py-4">Chưa có label nào</td></tr>'}</tbody>
    </table></div></div>`;

  root.querySelectorAll('[data-printed]').forEach((btn) => {
    btn.onclick = () => tryDo(async () => {
      await post(`/auto-labels/${btn.dataset.printed}/printed`, {});
      toast('Đã đánh dấu in'); renderAutoLabels(root);
    });
  });

  root.querySelector('[data-create]').onclick = () => openModal({
    title: 'Tạo shipping label',
    body: `<div class="row g-2">
      <div class="col-6"><label class="form-label">Order ID (số) *</label>
        <input type="number" class="form-control" id="al-order"></div>
      <div class="col-6"><label class="form-label">Package ID *</label>
        <input type="number" class="form-control" id="al-package">
        <div class="text-muted-sm">Lấy từ mục Package trong Order Detail</div></div>
      <div class="col-6"><label class="form-label">Carrier *</label>
        <select class="form-select" id="al-carrier"><option>USPS</option><option>FedEx</option><option>UPS</option></select></div>
      <div class="col-6"><label class="form-label">Service</label>
        <input class="form-control" id="al-service" placeholder="First Class / Priority Mail"></div>
    </div>`,
    footer: '<button class="btn btn-light" data-close>Hủy</button><button class="btn btn-primary" data-ok>Tạo label</button>',
    onMount: (el, close) => {
      el.querySelector('[data-ok]').onclick = () => tryDo(async () => {
        const result = await post('/auto-labels', {
          order_id: Number(el.querySelector('#al-order').value),
          package_id: Number(el.querySelector('#al-package').value),
          carrier: el.querySelector('#al-carrier').value,
          service: el.querySelector('#al-service').value || null,
        });
        toast(`Đã tạo label — tracking ${result.tracking_number}`);
        close(); renderAutoLabels(root);
      });
    },
  });
}
