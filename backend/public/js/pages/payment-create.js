// Tạo yêu cầu thanh toán (/add-request-payment) — bám sát mockup:
// Người xác nhận, NCC, Phân loại, Hạn TT, Nội dung, File, Phương thức TT, khoản chi.
import { get, post } from '../api.js';
import { esc, fmtMoney, options, toast, tryDo, spinner } from '../ui.js';
import { PAYMENT_GROUPS } from '../constants.js';

export async function renderPaymentCreate(root) {
  root.innerHTML = spinner();
  const [users, suppliers] = await Promise.all([get('/users/options'), get('/suppliers')]);

  let itemSeq = 0;
  const itemRow = () => `
    <tr data-pay-item="${itemSeq++}">
      <td><input class="form-control form-control-sm" data-pi="description" placeholder="VD: Phôi hoodie đen size M"></td>
      <td><input type="number" class="form-control form-control-sm" data-pi="qty" value="1" min="0" step="any" style="width:90px"></td>
      <td><input class="form-control form-control-sm" data-pi="unit" placeholder="cái" style="width:90px"></td>
      <td><input type="number" class="form-control form-control-sm" data-pi="unit_price" value="0" min="0" step="any" style="width:140px"></td>
      <td class="text-end align-middle" data-pi-total>0</td>
      <td><button type="button" class="btn btn-sm btn-outline-danger" data-remove>✕</button></td>
    </tr>`;

  root.innerHTML = `
    <div class="mx-auto" style="max-width:980px">
    <div class="sh-card">
      <h5 class="mb-4">Tạo yêu cầu thanh toán</h5>
      <form id="pay-form">
        <div class="row g-3">
          <div class="col-md-6"><label class="form-label">Người xác nhận *</label>
            <select class="form-select" name="approvers" multiple size="4">${users.data
              .map((u) => `<option value="${u.id}">${esc(u.name)} (${esc(u.role_name)})</option>`).join('')}</select>
            <div class="text-muted-sm">Giữ Ctrl để chọn nhiều người duyệt</div></div>
          <div class="col-md-6">
            <div class="mb-3"><label class="form-label">Nhà cung cấp</label>
              <select class="form-select" name="supplier_id" id="pay-supplier">${options(suppliers.data, { empty: 'Chọn nhà cung cấp' })}</select></div>
            <div><label class="form-label">Hạn thanh toán</label>
              <input type="date" class="form-control" name="due_date"></div>
          </div>
          <div class="col-md-6"><label class="form-label">Phân loại *</label>
            <select class="form-select" name="payment_group" required>
              <option value="">Chọn loại thanh toán</option>
              ${Object.entries(PAYMENT_GROUPS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
            </select></div>
          <div class="col-md-6"><label class="form-label">Đơn vị tiền tệ</label>
            <select class="form-select" name="currency"><option>VND</option><option>USD</option></select></div>

          <div class="col-12"><label class="form-label">Nội dung thanh toán</label>
            <textarea class="form-control" name="content" rows="3"
              placeholder="Thêm nội dung yêu cầu thanh toán"></textarea></div>

          <div class="col-12"><label class="form-label">File đính kèm chính</label>
            <input class="form-control" name="file_main" placeholder="/files/invoices/hoa-don.pdf">
            <div class="text-muted-sm">Upload trực tiếp sẽ có ở bản sau — hiện nhập đường dẫn file đã lưu</div></div>

          <div class="col-12">
            <label class="form-label">Phương thức thanh toán</label>
            <div class="border rounded p-3 text-muted-sm" id="pay-bank">Chọn nhà cung cấp để hiển thị tài khoản ngân hàng</div>
          </div>

          <div class="col-12">
            <div class="d-flex justify-content-between align-items-center">
              <label class="form-label m-0">Chi tiết khoản chi *</label>
              <button type="button" class="btn btn-sm btn-light" data-add-item>＋ Thêm dòng</button>
            </div>
            <table class="sh-table mt-2"><thead><tr>
              <th>Nội dung</th><th>SL</th><th>Đơn vị</th><th>Đơn giá</th><th class="text-end">Thành tiền</th><th></th>
            </tr></thead><tbody id="pay-items">${itemRow()}</tbody>
            <tfoot><tr><td colspan="4" class="text-end"><b>Tổng tiền</b></td>
              <td class="text-end"><b id="pay-total">0</b></td><td></td></tr></tfoot></table>
          </div>

          <div class="col-12 text-center">
            <button class="btn btn-success px-4">✎ Thêm yêu cầu</button>
          </div>
        </div>
      </form>
    </div></div>`;

  const itemsEl = root.querySelector('#pay-items');
  const currencyEl = root.querySelector('[name=currency]');

  const recalc = () => {
    let total = 0;
    itemsEl.querySelectorAll('[data-pay-item]').forEach((row) => {
      const qty = Number(row.querySelector('[data-pi="qty"]').value) || 0;
      const price = Number(row.querySelector('[data-pi="unit_price"]').value) || 0;
      const lineTotal = qty * price;
      total += lineTotal;
      row.querySelector('[data-pi-total]').textContent = fmtMoney(lineTotal, currencyEl.value);
    });
    root.querySelector('#pay-total').textContent = fmtMoney(total, currencyEl.value);
  };

  const bindRows = () => {
    itemsEl.querySelectorAll('input').forEach((input) => { input.oninput = recalc; });
    itemsEl.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.onclick = () => {
        if (itemsEl.querySelectorAll('[data-pay-item]').length > 1) { btn.closest('tr').remove(); recalc(); }
      };
    });
  };
  bindRows();
  currencyEl.onchange = recalc;

  root.querySelector('[data-add-item]').onclick = () => {
    itemsEl.insertAdjacentHTML('beforeend', itemRow());
    bindRows();
  };

  root.querySelector('#pay-supplier').onchange = (e) => {
    const supplier = suppliers.data.find((s) => String(s.id) === e.target.value);
    root.querySelector('#pay-bank').innerHTML = supplier
      ? `Chủ tài khoản: <b>${esc(supplier.bank_holder ?? '—')}</b><br>
         Số tài khoản: <b>${esc(supplier.bank_account ?? '—')}</b><br>
         Ngân hàng: <b>${esc(supplier.bank_name ?? '—')}</b>`
      : 'Chọn nhà cung cấp để hiển thị tài khoản ngân hàng';
  };

  root.querySelector('#pay-form').onsubmit = (e) => {
    e.preventDefault();
    tryDo(async () => {
      const form = new FormData(e.target);
      const approverIds = [...e.target.querySelector('[name=approvers]').selectedOptions].map((o) => Number(o.value));
      const items = [...itemsEl.querySelectorAll('[data-pay-item]')]
        .map((row) => ({
          description: row.querySelector('[data-pi="description"]').value,
          qty: Number(row.querySelector('[data-pi="qty"]').value) || 1,
          unit: row.querySelector('[data-pi="unit"]').value || null,
          unit_price: Number(row.querySelector('[data-pi="unit_price"]').value) || 0,
        }))
        .filter((item) => item.description.trim());
      if (!items.length) { toast('Cần ít nhất một khoản chi có nội dung', 'error'); return; }
      if (!approverIds.length) { toast('Chọn ít nhất một người xác nhận', 'error'); return; }

      const { serial_number } = await post('/payment-requests', {
        supplier_id: form.get('supplier_id') ? Number(form.get('supplier_id')) : null,
        payment_group: form.get('payment_group'),
        content: form.get('content') || null,
        currency: form.get('currency'),
        due_date: form.get('due_date') || null,
        file_main: form.get('file_main') || null,
        items,
        approver_ids: approverIds,
      });
      toast(`Đã tạo phiếu ${serial_number}`);
      location.hash = '#/payments';
    });
  };
}
