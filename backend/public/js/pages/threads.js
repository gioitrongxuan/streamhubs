import { get, post } from '../api.js';
import { esc, fmtMoney, spinner, openModal, options, toast, tryDo } from '../ui.js';

export async function renderThreads(root) {
  root.innerHTML = spinner();
  const [lots, suppliers] = await Promise.all([get('/threads/lots'), get('/suppliers')]);

  root.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="m-0">Quản lý chỉ thêu</h5>
      <button class="btn btn-primary btn-sm" data-create>＋ Tạo lô chỉ</button>
    </div>
    <div class="sh-card p-0"><div class="table-responsive"><table class="sh-table">
      <thead><tr><th>Lô</th><th>Mã chỉ</th><th>Loại</th><th>NCC</th><th>Đơn vị</th>
      <th>Còn lại</th><th>Đơn giá</th><th class="no-print"></th></tr></thead>
      <tbody>${lots.data.map((lot) => `
        <tr ${lot.is_low_stock ? 'style="background:#fef3f2"' : ''}>
          <td><b>${esc(lot.lot_number)}</b>
            ${lot.is_low_stock ? '<span class="sh-badge ms-1" style="background:#fee4e2;color:#b42318">Sắp hết</span>' : ''}</td>
          <td>${esc(lot.thread_code)}</td><td>${esc(lot.thread_type ?? '—')}</td>
          <td>${esc(lot.supplier_name)}</td><td>${esc(lot.unit)}</td>
          <td><b>${lot.remaining_qty}</b> / ${lot.quantity}</td>
          <td>${fmtMoney(lot.unit_price_vnd)}</td>
          <td class="no-print text-end">
            <button class="btn btn-sm btn-light" data-in="${lot.id}">＋ Nhập</button>
            <button class="btn btn-sm btn-light" data-out="${lot.id}">− Xuất</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="8" class="text-center text-muted py-4">Chưa có lô chỉ</td></tr>'}</tbody>
    </table></div></div>`;

  root.querySelector('[data-create]').onclick = () => openModal({
    title: 'Tạo lô chỉ thêu',
    body: `<div class="row g-3">
      <div class="col-md-4"><label class="form-label">Số lô *</label><input class="form-control" id="th-lot"></div>
      <div class="col-md-4"><label class="form-label">Mã chỉ *</label><input class="form-control" id="th-code"></div>
      <div class="col-md-4"><label class="form-label">Loại chỉ</label><input class="form-control" id="th-type" placeholder="polyester"></div>
      <div class="col-md-4"><label class="form-label">NCC *</label><select class="form-select" id="th-supplier">${options(suppliers.data)}</select></div>
      <div class="col-md-4"><label class="form-label">Số cuộn *</label><input type="number" class="form-control" id="th-qty" min="1"></div>
      <div class="col-md-4"><label class="form-label">Ngưỡng cảnh báo</label><input type="number" class="form-control" id="th-threshold"></div>
      <div class="col-md-4"><label class="form-label">Đơn giá (VND)</label><input type="number" class="form-control" id="th-price"></div>
    </div>`,
    footer: '<button class="btn btn-light" data-close>Hủy</button><button class="btn btn-primary" data-ok>Tạo</button>',
    onMount: (el, close) => {
      el.querySelector('[data-ok]').onclick = () => tryDo(async () => {
        const val = (id) => el.querySelector(`#${id}`).value;
        await post('/threads/lots', {
          lot_number: val('th-lot'), thread_code: val('th-code'),
          thread_type: val('th-type') || null,
          supplier_id: Number(val('th-supplier')), quantity: Number(val('th-qty')),
          min_threshold: val('th-threshold') ? Number(val('th-threshold')) : null,
          unit_price_vnd: val('th-price') ? Number(val('th-price')) : null,
        });
        toast('Đã tạo lô chỉ'); close(); renderThreads(root);
      });
    },
  });

  const movementModal = (lotId, direction) => openModal({
    title: direction === 'in' ? 'Nhập thêm chỉ' : 'Xuất chỉ cho sản xuất',
    body: `<div class="row g-2">
      <div class="col-6"><label class="form-label">Số lượng *</label>
        <input type="number" class="form-control" id="mv-qty" min="1" step="any"></div>
      ${direction === 'out' ? `<div class="col-6"><label class="form-label">Order Item ID</label>
        <input type="number" class="form-control" id="mv-item"></div>` : ''}
      <div class="col-12"><label class="form-label">Ghi chú</label><input class="form-control" id="mv-note"></div>
    </div>`,
    footer: `<button class="btn btn-light" data-close>Hủy</button>
             <button class="btn btn-primary" data-ok>${direction === 'in' ? 'Nhập' : 'Xuất'}</button>`,
    onMount: (el, close) => {
      el.querySelector('[data-ok]').onclick = () => tryDo(async () => {
        const body = {
          thread_lot_id: Number(lotId),
          qty: Number(el.querySelector('#mv-qty').value),
          note: el.querySelector('#mv-note').value || null,
        };
        if (direction === 'out') {
          body.order_item_id = el.querySelector('#mv-item').value ? Number(el.querySelector('#mv-item').value) : null;
        }
        await post(`/threads/${direction}`, body);
        toast('Đã ghi nhận'); close(); renderThreads(root);
      });
    },
  });

  root.querySelectorAll('[data-in]').forEach((btn) => { btn.onclick = () => movementModal(btn.dataset.in, 'in'); });
  root.querySelectorAll('[data-out]').forEach((btn) => { btn.onclick = () => movementModal(btn.dataset.out, 'out'); });
}
