// Nhập / Xuất kho phôi bằng QR (/in-out, /output-order trong docs).
// Nhập QR bằng máy scan cầm tay hoặc gõ tay; camera scan sẽ bổ sung sau.
import { get, post } from '../api.js';
import { esc, fmtDate, spinner, options, toast, tryDo } from '../ui.js';

export async function renderScan(root) {
  root.innerHTML = spinner();
  const shelves = (await get('/shelves')).data;

  root.innerHTML = `
    <h5 class="mb-3">Nhập / Xuất kho phôi</h5>
    <div class="row g-3 mb-3">
      <div class="col-md-6"><div class="sh-card">
        <div class="section-title">Nhập kho (scan QR)</div>
        <form id="form-in">
          <div class="mb-2"><label class="form-label">Kệ đích *</label>
            <select class="form-select" name="shelf_id" required>${options(shelves, {
              label: 'name', empty: '— Chọn kệ —',
            })}</select></div>
          <div class="mb-2"><label class="form-label">Mã QR phôi *</label>
            <input class="form-control" name="qrcode" placeholder="CH-HDI-0042-0001" autofocus required
              autocomplete="off"></div>
          <button class="btn btn-primary w-100">⤵ Nhập kho</button>
        </form>
      </div></div>
      <div class="col-md-6"><div class="sh-card">
        <div class="section-title">Xuất kho (scan QR)</div>
        <form id="form-out">
          <div class="mb-2"><label class="form-label">Loại xuất</label>
            <select class="form-select" name="type">
              <option value="order">Xuất cho sản xuất</option>
              <option value="return_error">Hoàn kho phôi lỗi</option>
            </select></div>
          <div class="mb-2"><label class="form-label">Order Item ID (khi xuất cho SX)</label>
            <input type="number" class="form-control" name="order_item_id"></div>
          <div class="mb-2"><label class="form-label">Mã QR phôi *</label>
            <input class="form-control" name="qrcode" required autocomplete="off"></div>
          <button class="btn btn-primary w-100">⤴ Xuất kho</button>
        </form>
      </div></div>
    </div>
    <div class="row g-3">
      <div class="col-md-6"><div class="sh-card p-0">
        <div class="p-3 pb-0 section-title">Lịch sử nhập gần đây</div>
        <div id="history-in">${spinner()}</div>
      </div></div>
      <div class="col-md-6"><div class="sh-card p-0">
        <div class="p-3 pb-0 section-title">Lịch sử xuất gần đây</div>
        <div id="history-out">${spinner()}</div>
      </div></div>
    </div>`;

  const loadHistory = async () => {
    const [hin, hout] = await Promise.all([get('/inventory/in'), get('/inventory/out')]);
    root.querySelector('#history-in').innerHTML = `<table class="sh-table">
      <thead><tr><th>QR</th><th>Kệ</th><th>Ngày</th><th>Người nhập</th></tr></thead>
      <tbody>${hin.data.slice(0, 15).map((r) => `<tr>
        <td style="font-family:monospace">${esc(r.qrcode)}</td><td>${esc(r.shelf_name)}</td>
        <td>${fmtDate(r.date)}</td><td>${esc(r.created_by_name)}</td></tr>`).join('') ||
        '<tr><td colspan="4" class="text-muted text-center py-3">Chưa có</td></tr>'}</tbody></table>`;
    root.querySelector('#history-out').innerHTML = `<table class="sh-table">
      <thead><tr><th>QR</th><th>Loại</th><th>Item</th><th>Ngày</th><th>Người xuất</th></tr></thead>
      <tbody>${hout.data.slice(0, 15).map((r) => `<tr>
        <td style="font-family:monospace">${esc(r.qrcode)}</td>
        <td>${r.type === 'order' ? 'SX' : '<span class="text-danger">Hoàn lỗi</span>'}</td>
        <td>${esc(r.order_item_id ?? '—')}</td>
        <td>${fmtDate(r.date)}</td><td>${esc(r.created_by_name)}</td></tr>`).join('') ||
        '<tr><td colspan="5" class="text-muted text-center py-3">Chưa có</td></tr>'}</tbody></table>`;
  };

  root.querySelector('#form-in').onsubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    tryDo(async () => {
      await post('/inventory/in', {
        qrcode: form.get('qrcode').trim(),
        shelf_id: Number(form.get('shelf_id')),
      });
      toast(`Đã nhập kho ${form.get('qrcode')}`);
      e.target.querySelector('[name=qrcode]').value = '';
      e.target.querySelector('[name=qrcode]').focus();
      loadHistory();
    });
  };

  root.querySelector('#form-out').onsubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    tryDo(async () => {
      await post('/inventory/out', {
        qrcode: form.get('qrcode').trim(),
        type: form.get('type'),
        order_item_id: form.get('order_item_id') ? Number(form.get('order_item_id')) : null,
      });
      toast(`Đã xuất kho ${form.get('qrcode')}`);
      e.target.querySelector('[name=qrcode]').value = '';
      e.target.querySelector('[name=qrcode]').focus();
      loadHistory();
    });
  };

  await loadHistory();
}
