// QC Order (/by-qrcode trong docs quan-ly-kho-xuong.md mục 8): quét QR sản phẩm
// → đối chiếu order + yêu cầu cá nhân hóa → xác nhận đạt (qc_passed)
// hoặc lỗi (item qc_failed + order trả lại SX, hiện ở trang Đơn lỗi).
import { get, post } from '../api.js';
import { esc, fmtDateTime, spinner, openModal, badge, toast, tryDo } from '../ui.js';
import { ORDER_STATUS, ITEM_STATUS, ERROR_AT } from '../constants.js';

export async function renderQc(root) {
  root.innerHTML = `
    <h5 class="mb-3">QC Order</h5>
    <div class="sh-card mb-3">
      <form id="qc-find" class="filters-bar">
        <input class="form-control" name="code" placeholder="Scan QR / nhập Order ID (VD: ME20260612013140)"
          style="min-width:320px" autofocus autocomplete="off">
        <button class="btn btn-primary">Tìm đơn</button>
      </form>
    </div>
    <div id="qc-order"></div>
    <div class="sh-card p-0">
      <div class="p-3 pb-0 section-title">Lịch sử QC gần đây</div>
      <div id="qc-history">${spinner()}</div>
    </div>`;

  const loadHistory = async () => {
    const rows = (await get('/qc/recent')).data;
    root.querySelector('#qc-history').innerHTML = `<table class="sh-table">
      <thead><tr><th>Order</th><th>Sản phẩm</th><th>SL</th><th>Kết quả</th><th>Lỗi</th><th>Thời gian</th></tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td><a class="row-link" href="#/orders/${r.order_id}">${esc(r.order_code)}</a></td>
        <td>${esc(r.product_type_name)}<div class="text-muted-sm">${esc(r.sku ?? '')}</div></td>
        <td>${r.qty}</td>
        <td>${badge(r.status, ITEM_STATUS)}</td>
        <td>${r.error_at ? `${esc(ERROR_AT[r.error_at] ?? r.error_at)} — ${esc(r.error_reason ?? '')}` : '—'}</td>
        <td>${fmtDateTime(r.updated_at)}</td>
      </tr>`).join('') || '<tr><td colspan="6" class="text-muted text-center py-3">Chưa có</td></tr>'}</tbody></table>`;
  };

  const itemVariants = (item) => (item.variants
    ? Object.entries(typeof item.variants === 'string' ? JSON.parse(item.variants) : item.variants)
        .map(([k, v]) => `${esc(k)}: <b>${esc(v)}</b>`).join(' · ')
    : '');

  function showOrder(order) {
    const canVerify = order.status === 'in_finishing';
    root.querySelector('#qc-order').innerHTML = `<div class="sh-card mb-3">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
        <div>
          <a class="row-link" href="#/orders/${order.id}"><b>${esc(order.order_code)}</b></a>
          ${badge(order.status, ORDER_STATUS)}
          <div class="text-muted-sm">${esc(order.shop_name)} · ${esc(order.receiver_name ?? '')} ${esc(order.country ?? '')}</div>
        </div>
        <div class="no-print">
          ${canVerify
            ? `<button class="btn btn-success" data-qc-pass>✓ QC đạt</button>
               <button class="btn btn-outline-danger" data-qc-fail>✗ QC lỗi</button>`
            : `<span class="sh-badge" style="background:#fef0c7;color:#b54708">Đơn không ở trạng thái hậu kỳ — không thể QC</span>`}
        </div>
      </div>
      ${order.items.map((item) => `<div class="border rounded p-3 mb-2">
        <b>${esc(item.product_type_name)}</b> ${badge(item.status, ITEM_STATUS)}
        <div class="text-muted-sm">SKU: ${esc(item.sku ?? '—')} · SL: ${item.qty}</div>
        ${itemVariants(item) ? `<div class="text-muted-sm">${itemVariants(item)}</div>` : ''}
        ${item.personalization ? `<div class="mt-1"><b>Personalization:</b> ${esc(item.personalization)}</div>` : ''}
      </div>`).join('')}
      ${order.shop_note ? `<div class="text-muted-sm">Note shop: ${esc(order.shop_note)}</div>` : ''}
    </div>`;

    root.querySelector('[data-qc-pass]')?.addEventListener('click', () => tryDo(async () => {
      await post('/qc/verify', { order_id: order.id, passed: true });
      toast(`QC đạt — đơn ${order.order_code} sẵn sàng xuất kho`);
      root.querySelector('#qc-order').innerHTML = '';
      root.querySelector('[name=code]').focus();
      loadHistory();
    }));
    root.querySelector('[data-qc-fail]')?.addEventListener('click', () => openFailModal(order));
  }

  function openFailModal(order) {
    openModal({
      title: `QC lỗi — ${order.order_code}`,
      size: 'lg',
      body: `<p class="text-muted-sm">Chọn item lỗi, nguồn gốc và lý do. Đơn sẽ trả lại sản xuất (redo) và hiện ở trang Đơn lỗi.</p>
        <table class="sh-table"><thead><tr><th></th><th>Item</th><th>Nguồn lỗi</th><th>Lý do</th></tr></thead>
        <tbody>${order.items.map((item) => `<tr data-qc-item="${item.id}">
          <td><input type="checkbox" class="form-check-input" data-qc="check" checked></td>
          <td>${esc(item.product_type_name)}<div class="text-muted-sm">${esc(item.sku ?? '')}</div></td>
          <td><select class="form-select form-select-sm" data-qc="at">${Object.entries(ERROR_AT)
            .map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></td>
          <td><input class="form-control form-control-sm" data-qc="reason" placeholder="VD: chỉ sai màu, lệch vị trí thêu..."></td>
        </tr>`).join('')}</tbody></table>
        <label class="form-label mt-2">Ghi chú chung</label>
        <input class="form-control" id="qc-note">`,
      footer: '<button class="btn btn-light" data-close>Hủy</button><button class="btn btn-danger" data-ok>Xác nhận QC lỗi</button>',
      onMount: (el, close) => {
        el.querySelector('[data-ok]').onclick = () => tryDo(async () => {
          const items = [...el.querySelectorAll('[data-qc-item]')]
            .filter((row) => row.querySelector('[data-qc="check"]').checked)
            .map((row) => ({
              order_item_id: Number(row.dataset.qcItem),
              error_at: row.querySelector('[data-qc="at"]').value,
              error_reason: row.querySelector('[data-qc="reason"]').value.trim(),
            }));
          if (!items.length) { toast('Chọn ít nhất 1 item lỗi', 'error'); return; }
          if (items.some((i) => !i.error_reason)) { toast('Nhập lý do lỗi cho item đã chọn', 'error'); return; }
          await post('/qc/verify', {
            order_id: order.id, passed: false,
            note: el.querySelector('#qc-note').value || null, items,
          });
          toast(`Đã ghi nhận QC lỗi — đơn ${order.order_code} trả lại sản xuất`);
          close();
          root.querySelector('#qc-order').innerHTML = '';
          root.querySelector('[name=code]').focus();
          loadHistory();
        });
      },
    });
  }

  root.querySelector('#qc-find').onsubmit = (e) => {
    e.preventDefault();
    const code = new FormData(e.target).get('code').trim();
    if (!code) return;
    tryDo(async () => {
      root.querySelector('#qc-order').innerHTML = spinner();
      try {
        showOrder(await get(`/qc/order?code=${encodeURIComponent(code)}`));
      } catch (err) {
        root.querySelector('#qc-order').innerHTML = '';
        throw err;
      }
      e.target.querySelector('[name=code]').value = '';
    });
  };

  await loadHistory();
}
