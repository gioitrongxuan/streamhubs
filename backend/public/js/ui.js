// Bộ helper UI dùng chung: escape, format, badge, modal, toast, panel, pagination.

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function fmtMoney(value, currency = 'VND') {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (currency === 'USD') return `$${number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${number.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ₫`;
}

export const fmtDate = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('-') : '—');
export const fmtDateTime = (s) => (s ? `${String(s).slice(11, 16)} ${fmtDate(s)}` : '—');

export function badge(statusKey, map) {
  const meta = map[statusKey];
  if (!meta) return `<span class="sh-badge" style="background:#eef2f6;color:#475467">${esc(statusKey)}</span>`;
  return `<span class="sh-badge" style="background:${meta.bg};color:${meta.color}">${esc(meta.label)}</span>`;
}

export function toast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `sh-toast ${type}`;
  el.textContent = message;
  document.getElementById('toast-root').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/** Bọc thao tác async: bắt lỗi API → toast đỏ. */
export async function tryDo(fn) {
  try {
    return await fn();
  } catch (err) {
    toast(err.message ?? 'Lỗi hệ thống', 'error');
    return undefined;
  }
}

export function openModal({ title, body, footer = '', size = '' , onMount }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sh-modal-backdrop';
  backdrop.innerHTML = `
    <div class="sh-modal ${size}">
      <div class="sh-modal-header"><div>${esc(title)}</div>
        <button class="btn-close" data-close></button></div>
      <div class="sh-modal-body">${body}</div>
      ${footer ? `<div class="sh-modal-footer">${footer}</div>` : ''}
    </div>`;
  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-close]')) close();
  });
  document.getElementById('modal-root').appendChild(backdrop);
  onMount?.(backdrop, close);
  return { el: backdrop, close };
}

export function confirmDialog(message) {
  return new Promise((resolve) => {
    openModal({
      title: 'Xác nhận',
      body: `<p>${esc(message)}</p>`,
      footer: `<button class="btn btn-light" data-close>Hủy</button>
               <button class="btn btn-primary" data-yes>Đồng ý</button>`,
      onMount: (el, close) => {
        el.querySelector('[data-yes]').onclick = () => { close(); resolve(true); };
        el.addEventListener('click', (e) => {
          if (e.target === el || e.target.closest('[data-close]')) resolve(false);
        });
      },
    });
  });
}

/** Panel chi tiết trượt từ phải — như màn "Chi tiết phiếu yêu cầu thanh toán". */
export function openPanel({ title, body, onMount }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sh-panel-backdrop';
  const panel = document.createElement('div');
  panel.className = 'sh-panel';
  panel.innerHTML = `
    <div class="sh-panel-header"><strong>${esc(title)}</strong>
      <button class="btn-close" data-close></button></div>
    <div class="p-3">${body}</div>`;
  const close = () => { backdrop.remove(); panel.remove(); };
  backdrop.onclick = close;
  panel.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.getElementById('modal-root').append(backdrop, panel);
  onMount?.(panel, close);
  return { el: panel, close };
}

export function paginationHtml(meta) {
  if (!meta || meta.total_pages <= 1) return '';
  const btn = (page, label, disabled = false, active = false) =>
    `<button class="btn btn-sm ${active ? 'btn-primary' : 'btn-light'}" data-page="${page}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  const pages = [];
  const start = Math.max(1, meta.page - 2);
  const end = Math.min(meta.total_pages, meta.page + 2);
  for (let p = start; p <= end; p++) pages.push(btn(p, p, false, p === meta.page));
  return `<div class="d-flex gap-1 align-items-center mt-3 no-print">
    ${btn(meta.page - 1, '‹', meta.page <= 1)}${pages.join('')}${btn(meta.page + 1, '›', meta.page >= meta.total_pages)}
    <span class="text-muted-sm ms-2">${meta.total} bản ghi</span></div>`;
}

export function bindPagination(root, onPage) {
  root.querySelectorAll('[data-page]').forEach((el) => {
    el.onclick = () => onPage(Number(el.dataset.page));
  });
}

/** Render <select> options từ danh sách. */
export function options(rows, { value = 'id', label = 'name', selected, empty = '— Chọn —' } = {}) {
  const opts = rows.map(
    (r) => `<option value="${esc(r[value])}" ${String(r[value]) === String(selected) ? 'selected' : ''}>${esc(r[label])}</option>`,
  );
  return `<option value="">${esc(empty)}</option>${opts.join('')}`;
}

/** Donut chart SVG theo phong cách mockup (Phân bố trạng thái). */
export function donutChart(segments, centerLabel) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return '<div class="text-muted-sm text-center py-4">Chưa có dữ liệu</div>';
  const R = 60, C = 2 * Math.PI * R;
  let offset = 0;
  const circles = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const len = (s.value / total) * C;
      const circle = `<circle r="${R}" cx="75" cy="75" fill="none" stroke="${s.color}" stroke-width="18"
        stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 75 75)"/>`;
      offset += len;
      return circle;
    })
    .join('');
  return `<svg viewBox="0 0 150 150" width="160" height="160">${circles}
    <text x="75" y="70" text-anchor="middle" font-size="22" font-weight="700" fill="#344054">${total}</text>
    <text x="75" y="90" text-anchor="middle" font-size="12" fill="#8a94a6">${esc(centerLabel)}</text></svg>`;
}

export const spinner = () => '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
