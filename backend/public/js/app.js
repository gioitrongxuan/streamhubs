// Bootstrap ứng dụng: shell (topbar + sidebar), hash router, menu theo quyền RBAC.
import { get, post, getToken } from './api.js';
import { esc, openModal, toast, tryDo } from './ui.js';
import { hasPerm } from './perm.js';
import { renderLogin } from './pages/login.js';
import { routes } from './routes.js';

/** State toàn cục tối thiểu: user hiện tại (id, name, permissions). */
export const state = { user: null };

const MENU = [
  { group: 'Tổng quan' },
  { hash: '#/dashboard', label: 'Dashboard', icon: 'speedometer2' },
  { hash: '#/guide', label: 'Hướng dẫn vận hành', icon: 'signpost-split' },
  { group: 'Đơn hàng' },
  { hash: '#/orders', label: 'Orders', icon: 'receipt', perm: 'orders.view' },
  { hash: '#/orders/create', label: 'Tạo order', icon: 'cart-plus', perm: 'orders.create' },
  { hash: '#/stock-orders', label: 'Order xưởng', icon: 'box-seam', perm: 'warehouse.stock_order_view' },
  { hash: '#/errors', label: 'Đơn lỗi', icon: 'exclamation-triangle', perm: 'orders.view' },
  { hash: '#/auto-labels', label: 'Auto Label', icon: 'tags', perm: 'system.auto_label' },
  { group: 'Kho xưởng' },
  { hash: '#/inventory', label: 'Tồn kho phôi', icon: 'boxes', perm: 'warehouse.inventory_view' },
  { hash: '#/scan', label: 'Nhập / Xuất kho', icon: 'upc-scan', perm: 'warehouse.inventory_in' },
  { hash: '#/gen-qrcode', label: 'Tạo QR Code', icon: 'qr-code', perm: 'warehouse.gen_qrcode' },
  { hash: '#/shelves', label: 'Kệ hàng', icon: 'bookshelf', perm: 'warehouse.shelf' },
  { hash: '#/threads', label: 'Chỉ thêu', icon: 'palette', perm: 'warehouse.thread' },
  { hash: '#/machines', label: 'Máy thêu', icon: 'gear-wide-connected', perm: 'warehouse.machine' },
  { hash: '#/receive-orders', label: 'Nhận hàng xưởng', icon: 'truck', perm: 'warehouse.receive_order' },
  { hash: '#/qc', label: 'QC Order', icon: 'patch-check', perm: 'warehouse.qc_scan' },
  { hash: '#/scan-track', label: 'Scan Track', icon: 'send-check', perm: 'warehouse.scan_track' },
  { group: 'Thanh toán' },
  { hash: '#/payments', label: 'Đề nghị thanh toán', icon: 'cash-coin', perm: 'payment.view' },
  { hash: '#/payments/create', label: 'Tạo đề nghị TT', icon: 'wallet2', perm: 'payment.create' },
  { group: 'Sản phẩm' },
  { hash: '#/product-types', label: 'Loại sản phẩm', icon: 'collection', perm: 'products.view' },
  { hash: '#/products', label: 'Sản phẩm', icon: 'box', perm: 'products.view' },
  { hash: '#/design-levels', label: 'Cấp độ thiết kế', icon: 'layers', perm: 'mdm.design_levels' },
  { group: 'Hệ thống' },
  { hash: '#/suppliers', label: 'Nhà cung cấp', icon: 'building' },
  { hash: '#/users', label: 'Người dùng', icon: 'people', perm: 'system.users' },
  { hash: '#/shops', label: 'Shops Etsy', icon: 'shop', perm: 'system.shops' },
  { hash: '#/system-configs', label: 'Cấu hình', icon: 'gear', perm: 'system.configs' },
  { hash: '#/documents', label: 'Tài liệu', icon: 'file-earmark-text', perm: 'system.documents_view' },
];

/* Trạng thái sidebar lưu trong localStorage: thu gọn toàn bộ + nhóm đang đóng. */
const NAV_COLLAPSED_KEY = 'streamhub_nav_collapsed';
const NAV_GROUPS_KEY = 'streamhub_nav_groups';
const readClosedGroups = () => {
  try { return JSON.parse(localStorage.getItem(NAV_GROUPS_KEY)) ?? {}; } catch { return {}; }
};

function renderShell() {
  // Gom menu theo nhóm, bỏ mục không đủ quyền và nhóm rỗng.
  const sections = [];
  for (const m of MENU) {
    if (m.group) { sections.push({ label: m.group, items: [] }); continue; }
    if (m.perm && !hasPerm(state.user.permissions, m.perm)) continue;
    if (!sections.length) sections.push({ label: '', items: [] });
    sections[sections.length - 1].items.push(m);
  }
  const closedGroups = readClosedGroups();
  const menuHtml = sections
    .filter((s) => s.items.length)
    .map((s) => {
      const closed = s.label && closedGroups[s.label];
      const header = s.label
        ? `<button type="button" class="group-label" data-group="${esc(s.label)}" aria-expanded="${!closed}">
             <span>${esc(s.label)}</span><i class="bi bi-chevron-down chev"></i>
           </button>`
        : '';
      const links = s.items
        .map((m) => `<a href="${m.hash}" data-menu="${m.hash}" title="${esc(m.label)}">
            <i class="bi bi-${m.icon ?? 'app'}"></i><span class="label">${esc(m.label)}</span>
          </a>`)
        .join('');
      return `<div class="sh-group${closed ? ' closed' : ''}">${header}<div class="group-items">${links}</div></div>`;
    })
    .join('');

  const collapsed = localStorage.getItem(NAV_COLLAPSED_KEY) === '1';
  document.getElementById('app').innerHTML = `
    <div class="sh-topbar">
      <button type="button" class="sh-nav-toggle" id="btn-nav-toggle" title="Thu gọn / mở rộng menu" aria-label="Thu gọn / mở rộng menu"><i class="bi bi-list"></i></button>
      <div class="sh-logo">stream<span>hub</span><small class="text-muted">.co</small></div>
      <div class="ms-auto d-flex align-items-center gap-3">
        <span class="text-muted-sm">${esc(state.user.name)} · ${esc(state.user.roleName)}</span>
        <button class="btn btn-sm btn-light" id="btn-change-password" title="Đổi mật khẩu"><i class="bi bi-key"></i></button>
        <button class="btn btn-sm btn-light" id="btn-logout">Đăng xuất</button>
      </div>
    </div>
    <div class="sh-layout${collapsed ? ' nav-collapsed' : ''}">
      <nav class="sh-sidebar" aria-label="Menu chính">${menuHtml}</nav>
      <div class="sh-sidebar-backdrop"></div>
      <main class="sh-content"><div id="page"></div></main>
    </div>`;

  const layout = document.querySelector('.sh-layout');
  const isMobile = () => window.matchMedia('(max-width: 991.98px)').matches;
  document.getElementById('btn-nav-toggle').onclick = () => {
    if (isMobile()) { layout.classList.toggle('nav-open'); return; }
    localStorage.setItem(NAV_COLLAPSED_KEY, layout.classList.toggle('nav-collapsed') ? '1' : '0');
  };
  document.querySelector('.sh-sidebar-backdrop').onclick = () => layout.classList.remove('nav-open');
  document.querySelector('.sh-sidebar').addEventListener('click', (e) => {
    const groupBtn = e.target.closest('.group-label');
    if (groupBtn) {
      const isClosed = groupBtn.closest('.sh-group').classList.toggle('closed');
      groupBtn.setAttribute('aria-expanded', String(!isClosed));
      const saved = readClosedGroups();
      if (isClosed) saved[groupBtn.dataset.group] = 1;
      else delete saved[groupBtn.dataset.group];
      localStorage.setItem(NAV_GROUPS_KEY, JSON.stringify(saved));
      return;
    }
    if (e.target.closest('a[data-menu]') && isMobile()) layout.classList.remove('nav-open');
  });

  document.getElementById('btn-change-password').onclick = () => openModal({
    title: 'Đổi mật khẩu',
    body: `
      <div class="mb-2"><label class="form-label">Mật khẩu hiện tại</label>
        <input type="password" class="form-control" id="cp-current" autocomplete="current-password"></div>
      <div class="mb-2"><label class="form-label">Mật khẩu mới (tối thiểu 8 ký tự)</label>
        <input type="password" class="form-control" id="cp-new" autocomplete="new-password"></div>
      <div><label class="form-label">Nhập lại mật khẩu mới</label>
        <input type="password" class="form-control" id="cp-confirm" autocomplete="new-password"></div>`,
    footer: '<button class="btn btn-light" data-close>Hủy</button><button class="btn btn-primary" data-ok>Đổi mật khẩu</button>',
    onMount: (el, close) => {
      el.querySelector('[data-ok]').onclick = () => tryDo(async () => {
        const newPassword = el.querySelector('#cp-new').value;
        if (newPassword !== el.querySelector('#cp-confirm').value) {
          toast('Mật khẩu nhập lại không khớp', 'error');
          return;
        }
        await post('/auth/change-password', {
          current_password: el.querySelector('#cp-current').value,
          new_password: newPassword,
        });
        toast('Đã đổi mật khẩu');
        close();
      });
    },
  });

  document.getElementById('btn-logout').onclick = () => {
    localStorage.removeItem('streamhub_token');
    location.hash = '#/login';
    location.reload();
  };
}

function matchRoute(hash) {
  const path = (hash || '#/dashboard').replace(/^#/, '').split('?')[0];
  for (const route of routes) {
    const pattern = route.path.split('/');
    const parts = path.split('/');
    if (pattern.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i].startsWith(':')) params[pattern[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (pattern[i] !== parts[i]) { ok = false; break; }
    }
    if (ok) return { route, params };
  }
  return null;
}

async function navigate() {
  if (!getToken() || location.hash === '#/login') {
    renderLogin(document.getElementById('app'), boot);
    return;
  }
  if (!state.user) {
    try {
      state.user = await get('/auth/me');
    } catch {
      return; // api.js đã chuyển hướng #/login khi 401
    }
    renderShell();
  }
  const matched = matchRoute(location.hash) ?? matchRoute('#/dashboard');
  document.querySelectorAll('[data-menu]').forEach((a) => {
    a.classList.toggle('active', location.hash.startsWith(a.dataset.menu) && a.dataset.menu !== '#/dashboard'
      ? location.hash.split('?')[0] === a.dataset.menu || location.hash.startsWith(`${a.dataset.menu}/`)
      : location.hash.split('?')[0] === a.dataset.menu);
  });
  const page = document.getElementById('page');
  page.innerHTML = '';
  await matched.route.render(page, matched.params);
}

function boot() {
  state.user = null;
  navigate();
}

window.addEventListener('hashchange', navigate);
boot();
