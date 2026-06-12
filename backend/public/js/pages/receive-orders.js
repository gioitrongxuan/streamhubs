// Nhận hàng từ xưởng (/receive-order): scan/nhập Order ID → modal chọn xưởng,
// phí ship, số lượng gửi/nhận từng item → 1 phiên nhận (workflow.md mục 6.2).
import { get, post } from '../api.js';
import { esc, fmtDate, fmtMoney, spinner, openModal, options, toast, tryDo } from '../ui.js';

export async function renderReceiveOrders(root) {
  root.innerHTML = spinner();
  const suppliers = (await get('/suppliers')).data;

  root.innerHTML = `
    <h5 class="mb-3">Nhận hàng từ xưởng</h5>
    <div class="sh-card mb-3">
      <form id="find-order" class="filters-bar">
        <input class="form-control" name="code" placeholder="Scan / nhập Order ID (VD: ME20260612013140)" style="min-width:320px" autofocus>
        <button class="btn btn-primary">Tìm đơn</button>
      </form>
    </div>
    <div class="sh-card p-0">
      <div class="p-3 pb-0 section-title">Lịch sử nhận hàng</div>
      <div id="history">${spinner()}</div>
    </div>`;

  const loadHistory = async () => {
    const sessions = (await get('/receive-orders')).data;
    root.querySelector('#history').innerHTML = `<table class="sh-table">
      <thead><tr><th>Order</th><th>Gửi từ xưởng</th><th>Ngày nhận</th><th>Phí ship</th><th>Người nhận</th><th>Ghi chú</th></tr></thead>
      <tbody>${sessions.map((s) => `<tr>
        <td><a class="row-link" href="#/orders/${s.order_id}">${esc(s.order_code)}</a></td>
        <td>${esc(s.supplier_name)}</td><td>${fmtDate(s.received_date)}</td>
        <td>${fmtMoney(s.shipping_fee)}</td><td>${esc(s.received_by_name)}</td><td>${esc(s.note ?? '')}</td>
      </tr>`).join('') || '<tr><td colspan="6" class="text-muted text-center py-3">Chưa có phiên nhận nào</td></tr>'}</tbody></table>`;
  };

  root.querySelector('#find-order').onsubmit = (e) => {
    e.preventDefault();
    const code = new FormData(e.target).get('code').trim();
    tryDo(async () => {
      const { data } = await get(`/orders?q=${encodeURIComponent(code)}&per_page=1`);
      if (!data.length) { toast('Không tìm thấy order', 'error'); return; }
      const order = await get(`/orders/${data[0].id}`);
      openReceiveModal(order);
    });
  };

  function openReceiveModal(order) {
    openModal({
      title: `Add thông tin đơn hàng — ${order.order_code}`,
      size: 'lg',
      body: `<div class="row g-3 mb-2">
          <div class="col-md-4"><label class="form-label">Gửi từ xưởng *</label>
            <select class="form-select" id="rc-supplier">${options(suppliers, { selected: order.supplier_id })}</select></div>
          <div class="col-md-4"><label class="form-label">Ngày nhận *</label>
            <input type="date" class="form-control" id="rc-date" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div class="col-md-4"><label class="form-label">Phí ship (VND)</label>
            <input type="number" class="form-control" id="rc-fee" value="0"></div>
          <div class="col-12"><label class="form-label">Ghi chú</label><input class="form-control" id="rc-note"></div>
        </div>
        <table class="sh-table"><thead><tr><th>Item</th><th>SL đặt</th><th>SL gửi</th><th>SL nhận</th><th>Ghi chú</th></tr></thead>
        <tbody>${order.items.map((item) => `<tr data-rc-item="${item.id}">
          <td>${esc(item.product_type_name)}<div class="text-muted-sm">${esc(item.sku ?? '')}</div></td>
          <td>${item.qty}</td>
          <td><input type="number" class="form-control form-control-sm" data-rc="sent" value="${item.qty}" min="0" style="width:80px"></td>
          <td><input type="number" class="form-control form-control-sm" data-rc="received" value="${item.qty}" min="0" style="width:80px"></td>
          <td><input class="form-control form-control-sm" data-rc="note" placeholder="Sai lệch..."></td>
        </tr>`).join('')}</tbody></table>`,
      footer: '<button class="btn btn-light" data-close>Hủy</button><button class="btn btn-primary" data-ok>Xác nhận nhận hàng</button>',
      onMount: (el, close) => {
        el.querySelector('[data-ok]').onclick = () => tryDo(async () => {
          const items = [...el.querySelectorAll('[data-rc-item]')].map((row) => ({
            order_item_id: Number(row.dataset.rcItem),
            sent_qty: Number(row.querySelector('[data-rc="sent"]').value),
            received_qty: Number(row.querySelector('[data-rc="received"]').value),
            note: row.querySelector('[data-rc="note"]').value || null,
          }));
          await post('/receive-orders', {
            order_id: order.id,
            supplier_id: Number(el.querySelector('#rc-supplier').value),
            received_date: el.querySelector('#rc-date').value,
            shipping_fee: Number(el.querySelector('#rc-fee').value) || 0,
            note: el.querySelector('#rc-note').value || null,
            items,
          });
          toast(`Đã nhận hàng đơn ${order.order_code} — chuyển hậu kỳ`);
          close(); loadHistory();
        });
      },
    });
  }

  await loadHistory();
}
