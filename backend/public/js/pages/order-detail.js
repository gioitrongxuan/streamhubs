import { get, post, patch } from '../api.js';
import {
  esc, fmtMoney, fmtDate, fmtDateTime, badge, spinner, openModal, toast, tryDo, confirmDialog,
} from '../ui.js';
import { ORDER_STATUS, ORDER_TRANSITIONS, ITEM_STATUS, ERROR_AT, NON_CANCELLABLE_STATUSES } from '../constants.js';
import { state } from '../app.js';
import { hasPerm } from '../perm.js';

// Quyền cần cho nút chuyển trạng thái — đồng bộ STATUS_PERMISSION phía backend
const STATUS_PERM = {
  designed: 'orders.approve_design', in_production: 'orders.push_factory',
  producing: 'warehouse.production_update', produced: 'warehouse.production_update',
  redo: 'warehouse.production_update', fixing: 'warehouse.production_update',
  factory_return: 'warehouse.production_update', in_finishing: 'warehouse.receive_order',
  qc_passed: 'warehouse.qc_scan', out_stock: 'warehouse.inventory_out', shipped: 'warehouse.scan_track',
  in_transit: 'warehouse.scan_track', complete: 'warehouse.scan_track',
};

export async function renderOrderDetail(root, { id }) {
  root.innerHTML = spinner();
  const order = await get(`/orders/${id}`);
  const logs = (await get(`/activity-logs?entity_type=order&entity_id=${id}&limit=30`)).data;
  const perms = state.user.permissions;

  const nextStatuses = (ORDER_TRANSITIONS[order.status] ?? []).filter(
    (s) => hasPerm(perms, STATUS_PERM[s] ?? 'orders.edit'),
  );
  const canCancel = hasPerm(perms, 'orders.cancel') && !NON_CANCELLABLE_STATUSES.includes(order.status);

  const infoRow = (k, v) => `<div class="info-row"><div class="k">${k}</div><div>${v}</div></div>`;

  root.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <h5 class="m-0"><a href="#/orders" class="text-decoration-none text-muted">Orders /</a> ${esc(order.order_code)}
        ${badge(order.status, ORDER_STATUS)}</h5>
      <div class="d-flex gap-2 no-print">
        ${nextStatuses.map((s) =>
          `<button class="btn btn-sm btn-primary" data-status="${s}">→ ${ORDER_STATUS[s].label}</button>`).join('')}
        ${canCancel ? '<button class="btn btn-sm btn-outline-danger" data-cancel>Hủy đơn</button>' : ''}
      </div>
    </div>

    <div class="row g-3">
      <div class="col-lg-8">
        <div class="sh-card mb-3">
          <div class="section-title">Thông tin cơ bản</div>
          <div class="row"><div class="col-md-6">
            ${infoRow('Shop', esc(order.shop_name))}
            ${infoRow('Loại', order.order_type === 'etsy' ? 'Etsy' : 'Nội bộ')}
            ${infoRow('Fulfill', order.fulfill_type === 'internal' ? 'Internal' : 'External')}
            ${infoRow('Designer', esc(order.designer_name ?? '—'))}
            ${infoRow('Xưởng', esc(order.supplier_name ?? '—'))}
            ${infoRow('Ngày tạo', fmtDateTime(order.created_at))}
            ${infoRow('Đẩy xưởng', fmtDateTime(order.pushed_at))}
          </div><div class="col-md-6">
            ${infoRow('Người nhận', esc(order.receiver_name ?? '—'))}
            ${infoRow('Địa chỉ', esc([order.address_line1, order.address_line2, order.city, order.state, order.zipcode, order.country].filter(Boolean).join(', ') || '—'))}
            ${infoRow('Điện thoại', esc(order.phone ?? '—'))}
            ${infoRow('Tổng tiền', `<b>${fmtMoney(order.order_total, order.currency)}</b>`)}
            ${infoRow('IOSS', esc(order.ioss_number ?? '—'))}
          </div></div>
          ${order.shop_note ? `<div class="alert alert-warning py-2 mt-2 mb-0"><b>Shop's Note:</b> ${esc(order.shop_note)}</div>` : ''}
          ${order.streamer_note ? `<div class="alert alert-info py-2 mt-2 mb-0"><b>Personalization:</b> ${esc(order.streamer_note)}</div>` : ''}
        </div>

        <div class="sh-card mb-3">
          <div class="section-title">Sản phẩm (${order.items.length})</div>
          ${order.items.map((item) => itemCard(item, order)).join('')}
        </div>

        <div class="sh-card">
          <div class="d-flex justify-content-between"><div class="section-title">Package</div>
            <button class="btn btn-sm btn-light no-print" data-add-package>＋ Add Package</button></div>
          <table class="sh-table"><thead><tr><th>Tracking</th><th>Carrier</th><th>Khối lượng (g)</th><th>Ghi chú</th></tr></thead>
          <tbody>${order.packages.map((p) => `<tr>
            <td><b>${esc(p.tracking_number ?? '—')}</b></td><td>${esc(p.carrier ?? '—')}</td>
            <td>${esc(p.weight ?? '—')}</td><td>${esc(p.note ?? '')}</td></tr>`).join('') ||
            '<tr><td colspan="4" class="text-muted text-center py-3">Chưa có kiện hàng</td></tr>'}</tbody></table>
        </div>
      </div>

      <div class="col-lg-4">
        ${order.merged_children.length ? `<div class="sh-card mb-3">
          <div class="section-title">Đơn gộp vào đơn này</div>
          ${order.merged_children.map((c) => `<div class="py-1">
            <a class="row-link" href="#/orders/${c.id}">${esc(c.order_code)}</a> ${badge(c.status, ORDER_STATUS)}</div>`).join('')}
        </div>` : ''}
        <div class="sh-card">
          <div class="section-title">Logs</div>
          <div class="sh-timeline">${logs.map((l) => `
            <div class="item"><div class="time">${fmtDateTime(l.created_at)}</div>
            <div>${esc(l.activity)}</div></div>`).join('') || '<span class="text-muted-sm">Chưa có log</span>'}
          </div>
        </div>
      </div>
    </div>`;

  // --- Hành vi ---------------------------------------------------------------
  const reload = () => renderOrderDetail(root, { id });

  root.querySelectorAll('[data-status]').forEach((btn) => {
    btn.onclick = () => tryDo(async () => {
      await post(`/orders/${id}/status`, { status: btn.dataset.status });
      toast(`Đã chuyển sang "${ORDER_STATUS[btn.dataset.status].label}"`);
      reload();
    });
  });

  root.querySelector('[data-cancel]')?.addEventListener('click', () => {
    openModal({
      title: 'Hủy đơn hàng',
      body: '<label class="form-label">Lý do hủy</label><textarea class="form-control" id="cancel-reason" rows="2"></textarea>',
      footer: '<button class="btn btn-light" data-close>Đóng</button><button class="btn btn-danger" data-ok>Hủy đơn</button>',
      onMount: (el, close) => {
        el.querySelector('[data-ok]').onclick = () => tryDo(async () => {
          await post(`/orders/${id}/cancel`, { reason: el.querySelector('#cancel-reason').value || 'Không ghi lý do' });
          toast('Đã hủy đơn'); close(); reload();
        });
      },
    });
  });

  root.querySelector('[data-add-package]')?.addEventListener('click', () => {
    openModal({
      title: 'Thêm kiện hàng',
      body: `<div class="row g-2">
        <div class="col-6"><label class="form-label">Tracking</label><input class="form-control" id="pk-tracking"></div>
        <div class="col-6"><label class="form-label">Carrier</label><input class="form-control" id="pk-carrier"></div>
        <div class="col-6"><label class="form-label">Khối lượng (gram)</label><input type="number" class="form-control" id="pk-weight"></div>
        <div class="col-12"><label class="form-label">Ghi chú</label><input class="form-control" id="pk-note"></div></div>`,
      footer: '<button class="btn btn-light" data-close>Hủy</button><button class="btn btn-primary" data-ok>Thêm</button>',
      onMount: (el, close) => {
        el.querySelector('[data-ok]').onclick = () => tryDo(async () => {
          await post(`/orders/${id}/packages`, {
            tracking_number: el.querySelector('#pk-tracking').value || null,
            carrier: el.querySelector('#pk-carrier').value || null,
            weight: Number(el.querySelector('#pk-weight').value) || null,
            note: el.querySelector('#pk-note').value || null,
          });
          toast('Đã thêm kiện hàng'); close(); reload();
        });
      },
    });
  });

  root.querySelectorAll('[data-add-note]').forEach((btn) => {
    btn.onclick = () => {
      openModal({
        title: 'Thêm ghi chú sản xuất',
        body: '<textarea class="form-control" id="note-text" rows="3" placeholder="VD: Design lỗi — đổi sang chỉ navy..."></textarea>',
        footer: '<button class="btn btn-light" data-close>Hủy</button><button class="btn btn-primary" data-ok>Lưu</button>',
        onMount: (el, close) => {
          el.querySelector('[data-ok]').onclick = () => tryDo(async () => {
            await post(`/order-items/${btn.dataset.addNote}/notes`, { note: el.querySelector('#note-text').value });
            toast('Đã thêm ghi chú'); close(); reload();
          });
        },
      });
    };
  });

  root.querySelectorAll('[data-upload]').forEach((btn) => {
    btn.onclick = () => {
      const item = order.items.find((i) => String(i.id) === btn.dataset.upload);
      openModal({
        title: 'Thêm file thiết kế',
        body: `<div class="row g-2">
          <div class="col-6"><label class="form-label">Vị trí</label>
            <input class="form-control" id="df-pos" placeholder="Trước / Mặt sau / Left Chest" value="Trước"></div>
          <div class="col-6"><label class="form-label">Loại file</label>
            <select class="form-select" id="df-type">${['emb', 'dst', 'pdf', 'jpg', 'png']
              .map((t) => `<option>${t}</option>`).join('')}</select></div>
          <div class="col-12"><label class="form-label">Đường dẫn file</label>
            <input class="form-control" id="df-path" placeholder="/files/designs/...">
            <div class="text-muted-sm">Upload trực tiếp sẽ có ở bản sau — hiện nhập đường dẫn file đã lưu</div></div></div>`,
        footer: '<button class="btn btn-light" data-close>Hủy</button><button class="btn btn-primary" data-ok>Lưu</button>',
        onMount: (el, close) => {
          el.querySelector('[data-ok]').onclick = () => tryDo(async () => {
            await post(`/order-items/${item.id}/design-files`, {
              position: el.querySelector('#df-pos').value,
              file_type: el.querySelector('#df-type').value,
              file_path: el.querySelector('#df-path').value,
            });
            toast('Đã lưu file thiết kế'); close(); reload();
          });
        },
      });
    };
  });

  function itemCard(item, orderData) {
    const files = orderData.design_files.filter((f) => f.order_item_id === item.id);
    const notes = orderData.item_notes.filter((n) => n.order_item_id === item.id);
    const variants = item.variants
      ? Object.entries(typeof item.variants === 'string' ? JSON.parse(item.variants) : item.variants)
          .map(([k, v]) => `${esc(k)}: <b>${esc(v)}</b>`).join(' · ')
      : '';
    const byPosition = {};
    for (const f of files) (byPosition[f.position] ??= []).push(f);

    return `<div class="border rounded p-3 mb-2">
      <div class="d-flex justify-content-between flex-wrap gap-2">
        <div>
          <b>${esc(item.product_type_name)}</b> ${badge(item.status, ITEM_STATUS)}
          ${item.error_at ? `<span class="sh-badge ms-1" style="background:#fee4e2;color:#b42318">${ERROR_AT[item.error_at]}</span>` : ''}
          <div class="text-muted-sm">SKU: ${esc(item.sku ?? '—')} · SL: ${item.qty} · ${fmtMoney(item.price_sale, 'USD')}</div>
          ${variants ? `<div class="text-muted-sm">${variants}</div>` : ''}
          ${item.personalization ? `<div class="mt-1"><b>Personalization:</b> ${esc(item.personalization)}</div>` : ''}
          ${item.error_reason ? `<div class="text-danger mt-1">⚠ ${esc(item.error_reason)}</div>` : ''}
        </div>
        <div class="text-end no-print">
          ${hasPerm(state.user.permissions, 'orders.upload_design')
            ? `<button class="btn btn-sm btn-light" data-upload="${item.id}">＋ File design</button>` : ''}
          <button class="btn btn-sm btn-light" data-add-note="${item.id}">＋ Note</button>
        </div>
      </div>
      ${Object.entries(byPosition).map(([pos, posFiles]) => `
        <div class="mt-2"><b>${esc(pos)}:</b> ${posFiles.map((f) =>
          `<a class="btn btn-sm btn-outline-primary me-1" href="${esc(f.file_path)}" target="_blank">${f.file_type.toUpperCase()}</a>`).join('')}
        </div>`).join('')}
      ${notes.length ? `<div class="mt-2 border-top pt-2">${notes.map((n) => `
        <div class="text-muted-sm">${fmtDateTime(n.created_at)} — <b>${esc(n.created_by_name)}</b>: ${esc(n.note)}</div>`).join('')}
      </div>` : ''}
    </div>`;
  }
}
