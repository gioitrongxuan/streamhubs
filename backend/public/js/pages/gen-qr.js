// Tạo QR Code phôi (/gen-qrcode trong docs quan-ly-kho-xuong.md mục 7):
// chọn lô → sinh QR theo format {qr_prefix}{seq} → in nhãn dán lên từng chiếc phôi.
import { get, post } from '../api.js';
import { esc, spinner, openModal, toast, tryDo } from '../ui.js';

// Thư viện vẽ QR nạp lười từ CDN — offline thì in nhãn dạng chữ (vẫn scan được bằng tay)
let qrLib;
async function loadQrLib() {
  if (qrLib !== undefined) return qrLib;
  qrLib = await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm')
    .then((m) => m.default ?? m)
    .catch(() => null);
  return qrLib;
}

export async function renderGenQr(root) {
  root.innerHTML = spinner();
  const lots = (await get('/inventory/lots')).data;

  root.innerHTML = `
    <div class="no-print">
      <h5 class="mb-3">Tạo QR Code phôi</h5>
      <div class="sh-card p-0 mb-3"><div class="table-responsive"><table class="sh-table">
        <thead><tr><th>Lô</th><th>Loại SP</th><th>Màu / Size</th><th>QR prefix</th>
        <th>SL nhập</th><th>Đã sinh QR</th><th class="text-end"></th></tr></thead>
        <tbody>${lots.map((lot) => {
          const remaining = lot.quantity - lot.qrcode_count;
          return `<tr>
            <td><b>${esc(lot.lot_number)}</b></td>
            <td>${esc(lot.product_type_name)}</td>
            <td>${esc(lot.color ?? '—')} / ${esc(lot.size ?? '—')}</td>
            <td style="font-family:monospace">${esc(lot.qr_prefix)}</td>
            <td>${lot.quantity}</td>
            <td><b>${lot.qrcode_count}</b> / ${lot.quantity}
              ${remaining > 0 ? `<span class="sh-badge ms-1" style="background:#fef0c7;color:#b54708">thiếu ${remaining}</span>`
                : '<span class="sh-badge ms-1" style="background:#d1fadf;color:#067647">đủ</span>'}</td>
            <td class="text-end">
              ${remaining > 0 ? `<button class="btn btn-sm btn-primary" data-gen="${lot.id}" data-remaining="${remaining}">＋ Sinh QR</button>` : ''}
              ${lot.qrcode_count > 0 ? `<button class="btn btn-sm btn-light" data-print="${lot.id}">🖨 In nhãn</button>` : ''}
            </td>
          </tr>`;
        }).join('') || '<tr><td colspan="7" class="text-center text-muted py-4">Chưa có lô phôi nào — tạo lô tại trang Tồn kho phôi</td></tr>'}</tbody>
      </table></div></div>
      <div class="text-muted-sm mb-3">Nhãn QR in ra dán lên từng chiếc phôi; scan tại trang Nhập / Xuất kho.</div>
    </div>
    <div id="qr-print"></div>
    <style>
      .qr-labels { display: flex; flex-wrap: wrap; gap: 4mm; }
      .qr-label { width: 40mm; height: 30mm; border: 1px dashed #d0d5dd; border-radius: 4px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 1.5mm; padding: 2mm; page-break-inside: avoid; }
      .qr-label svg { width: 18mm; height: 18mm; }
      .qr-label .qr-text { font-family: monospace; font-size: 9px; word-break: break-all; text-align: center; }
      @media print { .qr-label { border-color: #000; } }
    </style>`;

  // Vẽ danh sách nhãn vào vùng in; có QR svg nếu thư viện nạp được
  async function showLabels(title, qrcodes) {
    const area = root.querySelector('#qr-print');
    area.innerHTML = spinner();
    const lib = await loadQrLib();
    const labels = await Promise.all(qrcodes.map(async (code) => {
      const svg = lib ? await lib.toString(code, { type: 'svg', margin: 0 }).catch(() => '') : '';
      return `<div class="qr-label">${svg}<div class="qr-text">${esc(code)}</div></div>`;
    }));
    area.innerHTML = `<div class="sh-card">
      <div class="d-flex justify-content-between align-items-center mb-3 no-print">
        <div class="section-title m-0">${esc(title)} — ${qrcodes.length} nhãn</div>
        <button class="btn btn-primary btn-sm" onclick="window.print()">🖨 In nhãn</button>
      </div>
      <div class="qr-labels">${labels.join('')}</div>
    </div>`;
    area.scrollIntoView({ behavior: 'smooth' });
  }

  root.querySelectorAll('[data-gen]').forEach((btn) => {
    btn.onclick = () => {
      const lot = lots.find((l) => l.id === Number(btn.dataset.gen));
      openModal({
        title: `Sinh QR — Lô ${lot.lot_number}`,
        body: `<label class="form-label">Số lượng QR cần sinh</label>
          <input type="number" class="form-control" id="gq-qty" min="1" max="${btn.dataset.remaining}"
            value="${btn.dataset.remaining}">
          <div class="text-muted-sm mt-2">Format: <code>${esc(lot.qr_prefix)}0001</code> — đánh số nối tiếp phần đã sinh.</div>`,
        footer: '<button class="btn btn-light" data-close>Hủy</button><button class="btn btn-primary" data-ok>Sinh QR</button>',
        onMount: (el, close) => {
          el.querySelector('[data-ok]').onclick = () => tryDo(async () => {
            const qty = Number(el.querySelector('#gq-qty').value);
            const { qrcodes } = await post(`/inventory/lots/${lot.id}/qrcodes`, qty ? { quantity: qty } : {});
            toast(`Đã sinh ${qrcodes.length} QR cho lô ${lot.lot_number}`);
            close();
            await showLabels(`Lô ${lot.lot_number}`, qrcodes);
          });
        },
      });
    };
  });

  root.querySelectorAll('[data-print]').forEach((btn) => {
    btn.onclick = () => tryDo(async () => {
      const lot = await get(`/inventory/lots/${btn.dataset.print}`);
      await showLabels(`Lô ${lot.lot_number} (in lại toàn bộ)`, lot.items.map((item) => item.qrcode));
    });
  });
}
