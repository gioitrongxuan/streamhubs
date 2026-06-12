import { get, post } from '../api.js';
import { esc, fmtMoney, spinner, openModal, options, toast, tryDo } from '../ui.js';
import { state } from '../app.js';
import { hasPerm } from '../perm.js';

export async function renderInventory(root) {
  root.innerHTML = spinner();
  const [lots, suppliers, productTypes] = await Promise.all([
    get('/inventory/lots'), get('/suppliers'), get('/product-types'),
  ]);
  const canIn = hasPerm(state.user.permissions, 'warehouse.inventory_in');
  const canQr = hasPerm(state.user.permissions, 'warehouse.gen_qrcode');

  root.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="m-0">Tồn kho phôi</h5>
      ${canIn ? '<button class="btn btn-primary btn-sm" data-create-lot>＋ Tạo lô nhập</button>' : ''}
    </div>
    <div class="sh-card p-0"><div class="table-responsive"><table class="sh-table">
      <thead><tr><th>Lô</th><th>Loại SP</th><th>Màu</th><th>Size</th><th>NCC</th>
      <th>Nhập</th><th>Còn lại</th><th>Đơn giá</th><th class="no-print"></th></tr></thead>
      <tbody>${lots.data.map((lot) => `
        <tr ${lot.is_low_stock ? 'style="background:#fef3f2"' : ''}>
          <td><b>${esc(lot.lot_number)}</b>
            ${lot.is_low_stock ? '<span class="sh-badge ms-1" style="background:#fee4e2;color:#b42318">Sắp hết</span>' : ''}</td>
          <td>${esc(lot.product_type_name)}</td>
          <td>${esc(lot.color ?? '—')}</td><td>${esc(lot.size ?? '—')}</td>
          <td>${esc(lot.supplier_name)}</td>
          <td>${lot.quantity}</td>
          <td><b>${lot.remaining_qty}</b>${lot.min_threshold != null ? `<span class="text-muted-sm"> / ngưỡng ${lot.min_threshold}</span>` : ''}</td>
          <td>${fmtMoney(lot.unit_price_vnd)}</td>
          <td class="no-print text-end">
            ${canQr ? `<button class="btn btn-sm btn-light" data-gen-qr="${lot.id}">QR</button>` : ''}
            <button class="btn btn-sm btn-light" data-view="${lot.id}">Chi tiết</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="9" class="text-center text-muted py-4">Chưa có lô nào</td></tr>'}</tbody>
    </table></div></div>`;

  root.querySelector('[data-create-lot]')?.addEventListener('click', () => {
    openModal({
      title: 'Tạo lô nhập phôi',
      size: 'lg',
      body: `<div class="row g-3">
        <div class="col-md-4"><label class="form-label">Số lô *</label><input class="form-control" id="lt-number" required></div>
        <div class="col-md-4"><label class="form-label">NCC *</label>
          <select class="form-select" id="lt-supplier">${options(suppliers.data)}</select></div>
        <div class="col-md-4"><label class="form-label">Loại SP *</label>
          <select class="form-select" id="lt-type">${options(productTypes.data)}</select></div>
        <div class="col-md-3"><label class="form-label">Màu</label><input class="form-control" id="lt-color"></div>
        <div class="col-md-3"><label class="form-label">Size</label><input class="form-control" id="lt-size"></div>
        <div class="col-md-3"><label class="form-label">Số lượng *</label><input type="number" class="form-control" id="lt-qty" min="1"></div>
        <div class="col-md-3"><label class="form-label">Ngưỡng cảnh báo</label><input type="number" class="form-control" id="lt-threshold"></div>
        <div class="col-md-4"><label class="form-label">Đơn giá (VND)</label><input type="number" class="form-control" id="lt-price"></div>
        <div class="col-md-4"><label class="form-label">QR prefix *</label>
          <input class="form-control" id="lt-prefix" placeholder="CH-HDI-0042-"></div>
      </div>`,
      footer: '<button class="btn btn-light" data-close>Hủy</button><button class="btn btn-primary" data-ok>Tạo lô</button>',
      onMount: (el, close) => {
        el.querySelector('[data-ok]').onclick = () => tryDo(async () => {
          const val = (id) => el.querySelector(`#${id}`).value;
          await post('/inventory/lots', {
            lot_number: val('lt-number'),
            supplier_id: Number(val('lt-supplier')),
            product_type_id: Number(val('lt-type')),
            color: val('lt-color') || null, size: val('lt-size') || null,
            quantity: Number(val('lt-qty')),
            min_threshold: val('lt-threshold') ? Number(val('lt-threshold')) : null,
            unit_price_vnd: val('lt-price') ? Number(val('lt-price')) : null,
            qr_prefix: val('lt-prefix'),
          });
          toast('Đã tạo lô'); close(); renderInventory(root);
        });
      },
    });
  });

  root.querySelectorAll('[data-gen-qr]').forEach((btn) => {
    btn.onclick = () => tryDo(async () => {
      const { qrcodes } = await post(`/inventory/lots/${btn.dataset.genQr}/qrcodes`, {});
      openModal({
        title: `Đã sinh ${qrcodes.length} QR code`,
        body: `<div class="d-flex flex-wrap gap-2">${qrcodes
          .map((qr) => `<span class="sh-badge" style="background:#eef2f6;color:#344054;font-family:monospace">${esc(qr)}</span>`)
          .join('')}</div>
          <div class="text-muted-sm mt-3">In nhãn QR (40x30mm) rồi dán lên từng chiếc phôi. Scan tại trang Nhập / Xuất kho.</div>`,
        footer: '<button class="btn btn-light" data-close>Đóng</button><button class="btn btn-primary" onclick="window.print()">🖨 In</button>',
      });
      renderInventory(root);
    });
  });

  root.querySelectorAll('[data-view]').forEach((btn) => {
    btn.onclick = () => tryDo(async () => {
      const lot = await get(`/inventory/lots/${btn.dataset.view}`);
      const STATUS = {
        created: ['Chưa nhập kho', '#eef2f6', '#475467'], in_stock: ['Trong kho', '#d1fadf', '#067647'],
        out: ['Đã xuất', '#e0eaff', '#3538cd'], return_error: ['Hoàn kho lỗi', '#fee4e2', '#b42318'],
        damaged: ['Hỏng', '#fee4e2', '#b42318'],
      };
      openModal({
        title: `Lô ${lot.lot_number} — ${lot.items.length} phôi`,
        size: 'lg',
        body: `<div class="table-responsive" style="max-height:420px;overflow-y:auto"><table class="sh-table">
          <thead><tr><th>QR</th><th>Kệ</th><th>Trạng thái</th></tr></thead>
          <tbody>${lot.items.map((item) => {
            const [label, bg, color] = STATUS[item.status] ?? [item.status, '#eef2f6', '#475467'];
            return `<tr><td style="font-family:monospace">${esc(item.qrcode)}</td>
              <td>${esc(item.shelf_id ?? '—')}</td>
              <td><span class="sh-badge" style="background:${bg};color:${color}">${label}</span></td></tr>`;
          }).join('') || '<tr><td colspan="3" class="text-muted text-center">Chưa sinh QR</td></tr>'}</tbody>
        </table></div>`,
      });
    });
  });
}
