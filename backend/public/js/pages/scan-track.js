// Scan Tracking (/scan-track trong docs quan-ly-kho-xuong.md mục 9): quét tracking
// từ nhãn vận chuyển → gắn vào order → status shipped + đồng bộ tracking lên Etsy.
import { get, post } from '../api.js';
import { esc, fmtDateTime, spinner, toast, tryDo } from '../ui.js';

export async function renderScanTrack(root) {
  root.innerHTML = `
    <h5 class="mb-3">Scan Tracking</h5>
    <div class="row g-3 mb-3"><div class="col-lg-6"><div class="sh-card">
      <div class="section-title">Gắn tracking — bàn giao vận chuyển</div>
      <form id="form-track">
        <div class="mb-2"><label class="form-label">Order ID / mã QR đơn *</label>
          <input class="form-control" name="code" placeholder="ME20260612013140" autofocus required autocomplete="off"></div>
        <div class="mb-2"><label class="form-label">Tracking number *</label>
          <input class="form-control" name="tracking_number" placeholder="Scan từ nhãn vận chuyển" required autocomplete="off"></div>
        <div class="mb-3"><label class="form-label">Đơn vị vận chuyển</label>
          <input class="form-control" name="carrier" placeholder="USPS, DHL, VNPost..." autocomplete="off"></div>
        <button class="btn btn-primary w-100">⤴ Gắn tracking → Shipped</button>
        <div class="text-muted-sm mt-2">Đơn phải ở trạng thái "Đã xuất kho". Đơn Etsy sẽ tự đồng bộ tracking lên Etsy.</div>
      </form>
    </div></div></div>
    <div class="sh-card p-0">
      <div class="p-3 pb-0 section-title">Đã bàn giao gần đây</div>
      <div id="track-history">${spinner()}</div>
    </div>`;

  const loadHistory = async () => {
    const rows = (await get('/scan-track/recent')).data;
    root.querySelector('#track-history').innerHTML = `<table class="sh-table">
      <thead><tr><th>Order</th><th>Tracking</th><th>Carrier</th><th>Loại đơn</th><th>Thời gian ship</th></tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td><a class="row-link" href="#/orders/${r.order_id}">${esc(r.order_code)}</a></td>
        <td style="font-family:monospace">${esc(r.tracking_number)}</td>
        <td>${esc(r.carrier ?? '—')}</td>
        <td>${r.order_type === 'etsy' ? 'Etsy' : 'Nội bộ'}</td>
        <td>${fmtDateTime(r.shipped_at)}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="text-muted text-center py-3">Chưa có</td></tr>'}</tbody></table>`;
  };

  root.querySelector('#form-track').onsubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    tryDo(async () => {
      const res = await post('/scan-track', {
        code: form.get('code').trim(),
        tracking_number: form.get('tracking_number').trim(),
        carrier: form.get('carrier').trim() || null,
      });
      toast(`Đã gắn tracking — đơn ${res.order_code} chuyển Shipped`);
      e.target.reset();
      e.target.querySelector('[name=code]').focus();
      loadHistory();
    });
  };

  await loadHistory();
}
