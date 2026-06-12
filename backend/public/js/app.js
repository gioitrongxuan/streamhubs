// Bootstrap ứng dụng: shell (topbar + sidebar), hash router, menu theo quyền RBAC.
import { get, getToken } from './api.js';
import { esc } from './ui.js';
import { hasPerm } from './perm.js';
import { renderLogin } from './pages/login.js';
import { routes } from './routes.js';

/** State toàn cục tối thiểu: user hiện tại (id, name, permissions). */
export const state = { user: null };

const MENU = [
  { group: 'Tổng quan' },
  { hash: '#/dashboard', label: 'Dashboard' },
  { group: 'Đơn hàng' },
  { hash: '#/orders', label: 'Orders', perm: 'orders.view' },
  { hash: '#/orders/create', label: 'Tạo order', perm: 'orders.create' },
  { hash: '#/stock-orders', label: 'Order xưởng', perm: 'warehouse.stock_order_view' },
  { hash: '#/errors', label: 'Đơn lỗi', perm: 'orders.view' },
  { hash: '#/auto-labels', label: 'Auto Label', perm: 'system.auto_label' },
  { group: 'Kho xưởng' },
  { hash: '#/inventory', label: 'Tồn kho phôi', perm: 'warehouse.inventory_view' },
  { hash: '#/scan', label: 'Nhập / Xuất kho', perm: 'warehouse.inventory_in' },
  { hash: '#/shelves', label: 'Kệ hàng', perm: 'warehouse.shelf' },
  { hash: '#/threads', label: 'Chỉ thêu', perm: 'warehouse.thread' },
  { hash: '#/machines', label: 'Máy thêu', perm: 'warehouse.machine' },
  { hash: '#/receive-orders', label: 'Nhận hàng xưởng', perm: 'warehouse.receive_order' },
  { group: 'Thanh toán' },
  { hash: '#/payments', label: 'Đề nghị thanh toán', perm: 'payment.view' },
  { hash: '#/payments/create', label: 'Tạo đề nghị TT', perm: 'payment.create' },
  { group: 'Sản phẩm' },
  { hash: '#/product-types', label: 'Loại sản phẩm', perm: 'products.view' },
  { hash: '#/products', label: 'Sản phẩm', perm: 'products.view' },
  { hash: '#/design-levels', label: 'Cấp độ thiết kế', perm: 'mdm.design_levels' },
  { group: 'Hệ thống' },
  { hash: '#/suppliers', label: 'Nhà cung cấp' },
  { hash: '#/users', label: 'Người dùng', perm: 'system.users' },
  { hash: '#/shops', label: 'Shops Etsy', perm: 'system.shops' },
  { hash: '#/system-configs', label: 'Cấu hình', perm: 'system.configs' },
  { hash: '#/documents', label: 'Tài liệu', perm: 'system.documents_view' },
];

function renderShell() {
  const menuHtml = MENU.filter((m) => m.group || !m.perm || hasPerm(state.user.permissions, m.perm))
    .map((m) =>
      m.group
        ? `<div class="group-label">${esc(m.group)}</div>`
        : `<a href="${m.hash}" data-menu="${m.hash}">${esc(m.label)}</a>`,
    )
    .join('');

  document.getElementById('app').innerHTML = `
    <div class="sh-topbar">
      <div class="sh-logo">stream<span>hub</span><small class="text-muted">.co</small></div>
      <div class="ms-auto d-flex align-items-center gap-3">
        <span class="text-muted-sm">${esc(state.user.name)} · ${esc(state.user.roleName)}</span>
        <button class="btn btn-sm btn-light" id="btn-logout">Đăng xuất</button>
      </div>
    </div>
    <div class="sh-layout">
      <nav class="sh-sidebar">${menuHtml}</nav>
      <main class="sh-content"><div id="page"></div></main>
    </div>`;

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
