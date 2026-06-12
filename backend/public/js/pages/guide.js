// Hướng dẫn vận hành (#/guide): trang onboarding cho người mới — luồng đơn hàng
// đầu-cuối, vai trò từng bộ phận, bản đồ chức năng và vòng đời trạng thái.
// Nội dung bám docs/01-phan-tich-quy-trinh/{workflow,co-cau-to-chuc}.md;
// các bước thuộc quyền của user đang đăng nhập được đánh dấu "Việc của bạn".
import { esc, badge } from '../ui.js';
import { ORDER_STATUS, ORDER_TRANSITIONS } from '../constants.js';
import { state } from '../app.js';
import { hasPerm } from '../perm.js';

/* Luồng chính của 1 đơn hàng fulfill nội bộ (workflow.md mục 1, 6). */
const FLOW = [
  {
    title: 'Nhận đơn', icon: 'cloud-download', who: 'Hệ thống / CS', perm: 'orders.create',
    statuses: ['new', 'need_confirm'],
    screens: [['#/orders', 'Orders'], ['#/orders/create', 'Tạo order']],
    desc: 'Đơn Etsy đồng bộ tự động về hệ thống, hoặc tạo thủ công. Đơn thiếu thông tin chuyển "Need Confirm" để xác nhận lại với khách trước khi thiết kế.',
    branch: 'Đơn fulfill external (EGfulfill, NCC ngoài): bỏ qua kho + sản xuất nội bộ, chỉ gửi file cho NCC rồi chờ tracking → Shipped.',
  },
  {
    title: 'Thiết kế', icon: 'palette', who: 'Designer', perm: 'orders.upload_design',
    statuses: ['designing', 'pending_review'],
    screens: [['#/orders', 'Orders → chi tiết đơn']],
    desc: 'Designer nhận đơn, làm file thêu theo personalization của khách và upload EMB / DST / PDF vào từng item, sau đó chuyển "Chờ duyệt Design".',
  },
  {
    title: 'Duyệt design', icon: 'check2-square', who: 'Designer Senior / Manager', perm: 'orders.approve_design',
    statuses: ['designed'],
    screens: [['#/orders', 'Orders → chi tiết đơn']],
    desc: 'Senior xem xét file thiết kế: đạt thì duyệt để sẵn sàng sản xuất, không đạt trả về Designer làm lại.',
  },
  {
    title: 'Đẩy xưởng & xuất phôi', icon: 'box-arrow-right', who: 'Manager + Kho', perm: 'orders.push_factory',
    statuses: ['in_production'],
    screens: [['#/stock-orders', 'Order xưởng'], ['#/scan', 'Nhập / Xuất kho']],
    desc: 'Manager đẩy đơn sang xưởng tạo lệnh sản xuất. Kho quét QR phôi xuất cho sản xuất — phôi gắn vào từng order item, tồn kho trừ tự động.',
  },
  {
    title: 'Sản xuất thêu', icon: 'gear-wide-connected', who: 'Tổ Sản xuất', perm: 'warehouse.production_update',
    statuses: ['producing', 'produced'],
    screens: [['#/stock-orders', 'Order xưởng'], ['#/machines', 'Máy thêu']],
    desc: 'Gắn máy thêu + kỹ thuật viên cho từng item rồi bắt đầu thêu. Thêu xong chuyển "Sản xuất xong" — thời gian SX dùng tính AVG Time trên dashboard.',
    branch: 'Lỗi trong sản xuất: ghi note + nguồn lỗi → đơn chuyển "Làm lại" / "Sửa lại". Xưởng không làm được → "Xưởng trả lại" để đổi xưởng hoặc sửa file.',
  },
  {
    title: 'Nhận hàng & hậu kỳ', icon: 'truck', who: 'Tổ Hậu kỳ', perm: 'warehouse.receive_order',
    statuses: ['in_finishing'],
    screens: [['#/receive-orders', 'Nhận hàng xưởng']],
    desc: 'Scan Order ID nhận hàng xưởng gửi về: ghi xưởng gửi, phí ship, số lượng gửi / nhận từng item. Sau đó hậu kỳ: cắt chỉ → kiểm tra → ủi → đóng gói.',
  },
  {
    title: 'QC Order', icon: 'patch-check', who: 'Tổ Hậu kỳ', perm: 'warehouse.qc_scan',
    statuses: ['qc_passed'],
    screens: [['#/qc', 'QC Order']],
    desc: 'Quét QR đơn → đối chiếu sản phẩm với yêu cầu cá nhân hóa. Đạt thì xác nhận QC — bắt buộc trước khi xuất kho.',
    branch: 'QC lỗi: chọn item lỗi + nguồn lỗi (xưởng / designer / phôi) + lý do → đơn trả lại sản xuất và xuất hiện ở trang Đơn lỗi.',
  },
  {
    title: 'Xuất kho & label', icon: 'box-seam', who: 'Kho', perm: 'warehouse.inventory_out',
    statuses: ['out_stock'],
    screens: [['#/auto-labels', 'Auto Label']],
    desc: 'Hàng QC đạt chuyển khu xuất kho. Tạo nhãn vận chuyển tự động qua API carrier (USPS / FedEx / UPS) — tracking sinh ra gắn sẵn vào kiện hàng.',
  },
  {
    title: 'Scan tracking', icon: 'send-check', who: 'Kho', perm: 'warehouse.scan_track',
    statuses: ['shipped'],
    screens: [['#/scan-track', 'Scan Track']],
    desc: 'Bàn giao vận chuyển: quét tracking trên nhãn → gắn vào đơn, chuyển Shipped và tự đẩy tracking lên Etsy cho khách theo dõi.',
  },
  {
    title: 'Vận chuyển & hoàn tất', icon: 'flag', who: 'Tự động (carrier / Etsy)',
    statuses: ['in_transit', 'complete'],
    screens: [],
    desc: 'Carrier scan nhận hàng → InTransit (webhook / poll Etsy). Giao thành công → Complete. Đơn kết thúc vòng đời.',
  },
];

/* Luồng phụ trợ chạy song song luồng đơn (workflow.md mục 2, 3, 4, 5). */
const SIDE_FLOWS = [
  {
    title: 'Kho phôi & QR code', icon: 'qr-code',
    steps: ['Tạo lô phôi nhập từ NCC (Tồn kho phôi)', 'Sinh QR cho từng chiếc phôi → in nhãn dán (Tạo QR Code)',
      'Quét QR nhập kho lên kệ (Nhập / Xuất kho)', 'Quét QR xuất phôi cho lệnh sản xuất', 'Tồn kho + kệ cập nhật tự động, cảnh báo khi dưới ngưỡng'],
    screens: [['#/inventory', 'Tồn kho phôi'], ['#/gen-qrcode', 'Tạo QR Code'], ['#/scan', 'Nhập / Xuất kho']],
  },
  {
    title: 'Đơn lỗi & làm lại', icon: 'exclamation-triangle',
    steps: ['Lỗi phát hiện ở sản xuất hoặc QC → ghi nguồn lỗi + lý do trên item', 'Lỗi phôi: kho xuất phôi thay thế · Lỗi file: designer sửa và upload lại · Lỗi xưởng: xưởng làm lại',
      'Tái sản xuất theo luồng bình thường đến khi QC đạt'],
    screens: [['#/errors', 'Đơn lỗi']],
  },
  {
    title: 'Thanh toán nhà cung cấp', icon: 'cash-coin',
    steps: ['Kế toán / kho tạo đề nghị thanh toán theo nhóm chi phí (phôi, chỉ, ship, fulfill ngoài...)', 'Manager duyệt: xác nhận hoặc từ chối chỉnh sửa lại',
      'Ghi nhận thanh toán đủ hoặc từng phần — hệ thống cảnh báo phiếu sắp đến hạn / quá hạn'],
    screens: [['#/payments', 'Đề nghị thanh toán'], ['#/payments/create', 'Tạo đề nghị TT']],
  },
];

/* Vai trò các bộ phận (co-cau-to-chuc.md). */
const ROLES = [
  { name: 'Admin / Quản lý', icon: 'shield-lock', desc: 'Toàn quyền hệ thống: cấu hình, phân quyền người dùng, xem mọi báo cáo.' },
  { name: 'Manager', icon: 'person-badge', desc: 'Theo dõi tiến độ đơn trên dashboard, duyệt design, đẩy xưởng, duyệt đề nghị thanh toán, xử lý hủy / gộp đơn.' },
  { name: 'Designer / Senior', icon: 'palette', desc: 'Designer làm file thêu theo đơn và upload EMB/DST/PDF. Senior thêm quyền duyệt design và hỗ trợ kỹ thuật cho team.' },
  { name: 'Tổ Sản xuất', icon: 'gear-wide-connected', desc: 'Nhận lệnh SX tại Order xưởng, gắn máy + kỹ thuật viên, cập nhật tiến độ thêu từng item, ghi nhận lỗi sản xuất.' },
  { name: 'Tổ Hậu kỳ', icon: 'patch-check', desc: 'Nhận hàng xưởng gửi về, hậu kỳ (cắt chỉ → kiểm tra → ủi → đóng gói), QC quét QR xác nhận đạt / lỗi.' },
  { name: 'Nhân viên Kho', icon: 'boxes', desc: 'Quản lý phôi: tạo QR, nhập / xuất kho, kệ hàng, chỉ thêu. Xuất kho hàng QC đạt và scan tracking bàn giao vận chuyển.' },
  { name: 'Kế toán', icon: 'cash-coin', desc: 'Tạo và theo dõi đề nghị thanh toán nhà cung cấp, đối soát công nợ theo kỳ.' },
];

/* Bản đồ chức năng — theo nhóm menu, kèm quyền để đánh dấu mục user dùng được. */
const MODULE_MAP = [
  { group: 'Đơn hàng', items: [
    ['#/orders', 'Orders', 'Danh sách toàn bộ đơn, lọc theo trạng thái / shop / designer, vào chi tiết để thao tác', 'orders.view'],
    ['#/orders/create', 'Tạo order', 'Tạo đơn thủ công (ngoài Etsy) kèm items + địa chỉ giao', 'orders.create'],
    ['#/stock-orders', 'Order xưởng', 'Lệnh sản xuất cho xưởng: gắn máy, cập nhật tiến độ thêu, in lệnh SX', 'warehouse.stock_order_view'],
    ['#/errors', 'Đơn lỗi', 'Item bị ghi nhận lỗi từ sản xuất / QC, lọc theo nguồn lỗi và xưởng', 'orders.view'],
    ['#/auto-labels', 'Auto Label', 'Tạo nhãn vận chuyển tự động qua API carrier khi đơn xuất kho', 'system.auto_label'],
  ]},
  { group: 'Kho xưởng', items: [
    ['#/inventory', 'Tồn kho phôi', 'Lô phôi theo NCC / màu / size, tồn thực tế từng kệ, cảnh báo sắp hết', 'warehouse.inventory_view'],
    ['#/scan', 'Nhập / Xuất kho', 'Quét QR phôi nhập lên kệ hoặc xuất cho sản xuất / hoàn kho lỗi', 'warehouse.inventory_in'],
    ['#/gen-qrcode', 'Tạo QR Code', 'Sinh mã QR cho từng chiếc phôi trong lô và in nhãn dán', 'warehouse.gen_qrcode'],
    ['#/shelves', 'Kệ hàng', 'Danh sách kệ, sức chứa và số phôi đang nằm trên từng kệ', 'warehouse.shelf'],
    ['#/threads', 'Chỉ thêu', 'Kho chỉ theo màu, nhập thêm / ghi xuất dùng, cảnh báo dưới ngưỡng', 'warehouse.thread'],
    ['#/machines', 'Máy thêu', 'Danh sách máy, trạng thái hoạt động / bảo trì, phân công sản xuất', 'warehouse.machine'],
    ['#/receive-orders', 'Nhận hàng xưởng', 'Scan đơn nhận hàng thêu xưởng gửi về, ghi số lượng gửi / nhận', 'warehouse.receive_order'],
    ['#/qc', 'QC Order', 'Quét QR kiểm tra chất lượng sau hậu kỳ — đạt mới được xuất kho', 'warehouse.qc_scan'],
    ['#/scan-track', 'Scan Track', 'Quét tracking bàn giao vận chuyển, đơn chuyển Shipped + sync Etsy', 'warehouse.scan_track'],
  ]},
  { group: 'Thanh toán', items: [
    ['#/payments', 'Đề nghị thanh toán', 'Danh sách phiếu đề nghị, duyệt và ghi nhận thanh toán', 'payment.view'],
    ['#/payments/create', 'Tạo đề nghị TT', 'Lập phiếu thanh toán NCC theo nhóm chi phí', 'payment.create'],
  ]},
  { group: 'Sản phẩm & Hệ thống', items: [
    ['#/product-types', 'Loại sản phẩm / Sản phẩm', 'Danh mục sản phẩm bán và loại phôi tương ứng', 'products.view'],
    ['#/suppliers', 'Nhà cung cấp', 'Xưởng thêu, đối tác fulfill, NCC nguyên liệu kèm thông tin ngân hàng', null],
    ['#/users', 'Người dùng & phân quyền', 'Tài khoản nhân viên, gán vai trò quyết định menu và thao tác được phép', 'system.users'],
    ['#/shops', 'Shops Etsy', 'Shop bán hàng, prefix mã đơn và chu kỳ đồng bộ Etsy', 'system.shops'],
    ['#/documents', 'Tài liệu', 'Kho tài liệu hướng dẫn nội bộ: quy trình, sales case, tài liệu QC...', 'system.documents_view'],
  ]},
];

/* Mô tả + người phụ trách từng trạng thái (bảng workflow.md mục 1). */
const STATUS_INFO = {
  new: ['Order vừa nhận về / vừa tạo', 'Hệ thống'],
  need_confirm: ['Thiếu thông tin, cần xác nhận với khách', 'Manager / CS'],
  designing: ['Đã giao Designer làm file', 'Designer'],
  pending_review: ['File đã upload, chờ duyệt', 'Designer Senior'],
  designed: ['Design được duyệt, sẵn sàng SX', 'Manager'],
  in_production: ['Đã đẩy xưởng, chờ làm', 'Tổ Sản xuất'],
  producing: ['Đang thêu trên máy', 'Tổ Sản xuất'],
  redo: ['QC / kiểm tra không đạt, làm lại', 'Tổ Sản xuất'],
  fixing: ['Đang sửa file / thay phôi', 'Designer / Kho'],
  factory_return: ['Xưởng trả lại — đổi xưởng hoặc sửa', 'Kho / Manager'],
  produced: ['Thêu xong, chờ gửi về kho', 'Tổ Sản xuất'],
  in_finishing: ['Đã nhận hàng, đang hậu kỳ', 'Tổ Hậu kỳ'],
  qc_passed: ['QC quét QR xác nhận đạt', 'Tổ Hậu kỳ'],
  out_stock: ['Đã xuất kho, chờ bàn giao ship', 'Kho'],
  shipped: ['Đã có tracking, sync lên Etsy', 'Kho (scan track)'],
  in_transit: ['Carrier đã nhận hàng', 'Tự động'],
  complete: ['Giao thành công, đơn kết thúc', 'Tự động / Manager'],
  cancelled: ['Đơn hủy (khách / hết hàng) — đã xuất phôi thì phải hoàn kho', 'Manager / Admin'],
};

const statusBadges = (keys) => keys.map((k) => badge(k, ORDER_STATUS)).join(' ');
const screenLinks = (screens) => screens
  .map(([hash, label]) => `<a class="gd-link" href="${hash}"><i class="bi bi-box-arrow-up-right"></i> ${esc(label)}</a>`)
  .join('');

export async function renderGuide(root) {
  const can = (perm) => !perm || hasPerm(state.user.permissions, perm);
  const mine = (perm) => (perm && can(perm)
    ? '<span class="sh-badge gd-mine"><i class="bi bi-person-check"></i> Việc của bạn</span>' : '');

  const flowHtml = FLOW.map((step, i) => `
    <div class="gd-step">
      <div class="gd-step-rail"><div class="gd-step-dot"><i class="bi bi-${step.icon}"></i></div>
        ${i < FLOW.length - 1 ? '<div class="gd-step-line"></div>' : ''}</div>
      <div class="gd-step-card sh-card">
        <div class="d-flex justify-content-between flex-wrap gap-2">
          <b>${i + 1}. ${esc(step.title)}</b>
          <span class="text-muted-sm"><i class="bi bi-person"></i> ${esc(step.who)} ${mine(step.perm)}</span>
        </div>
        <div class="my-1">${statusBadges(step.statuses)}</div>
        <div class="text-muted-sm">${esc(step.desc)}</div>
        ${step.branch ? `<div class="gd-branch"><i class="bi bi-signpost-split"></i> ${esc(step.branch)}</div>` : ''}
        ${step.screens.length ? `<div class="mt-2">${screenLinks(step.screens)}</div>` : ''}
      </div>
    </div>`).join('');

  const sideHtml = SIDE_FLOWS.map((flow) => `
    <div class="col-md-4"><div class="sh-card h-100">
      <div class="section-title"><i class="bi bi-${flow.icon}"></i> ${esc(flow.title)}</div>
      <ol class="gd-mini-steps">${flow.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <div>${screenLinks(flow.screens)}</div>
    </div></div>`).join('');

  const rolesHtml = ROLES.map((role) => `
    <div class="col-md-6 col-xl-4"><div class="sh-card h-100">
      <div class="d-flex align-items-center gap-2 mb-1">
        <span class="gd-role-icon"><i class="bi bi-${role.icon}"></i></span><b>${esc(role.name)}</b>
      </div>
      <div class="text-muted-sm">${esc(role.desc)}</div>
    </div></div>`).join('');

  const modulesHtml = MODULE_MAP.map((section) => `
    <div class="sh-card mb-3">
      <div class="section-title">${esc(section.group)}</div>
      <table class="sh-table"><tbody>${section.items.map(([hash, label, desc, perm]) => `
        <tr class="${can(perm) ? '' : 'gd-locked'}">
          <td style="width:200px;white-space:nowrap">
            ${can(perm) ? `<a class="row-link" href="${hash}"><b>${esc(label)}</b></a>` : `<b>${esc(label)}</b> <i class="bi bi-lock text-muted" title="Bạn chưa có quyền truy cập"></i>`}
          </td>
          <td class="text-muted-sm">${esc(desc)}</td>
        </tr>`).join('')}</tbody></table>
    </div>`).join('');

  const statusesHtml = `<div class="sh-card p-0"><div class="table-responsive"><table class="sh-table">
    <thead><tr><th>Trạng thái</th><th>Ý nghĩa</th><th>Người phụ trách</th><th>Chuyển tiếp đến</th></tr></thead>
    <tbody>${Object.keys(ORDER_STATUS).map((key) => `<tr>
      <td>${badge(key, ORDER_STATUS)}<div class="text-muted-sm" style="font-family:monospace">${key}</div></td>
      <td>${esc(STATUS_INFO[key]?.[0] ?? '')}</td>
      <td class="text-muted-sm">${esc(STATUS_INFO[key]?.[1] ?? '')}</td>
      <td>${statusBadges(ORDER_TRANSITIONS[key] ?? [])
        || '<span class="text-muted-sm">— kết thúc</span>'}</td>
    </tr>`).join('')}</tbody></table></div>
    <div class="p-3 text-muted-sm">Mọi trạng thái trước "Đã xuất kho" đều hủy được; đơn đã bàn giao carrier thì không.
      Đơn hủy sau khi đã xuất phôi phải quét hoàn kho tại Nhập / Xuất kho (loại "Hoàn kho phôi lỗi").</div>`;

  const TABS = [
    ['flow', 'Luồng đơn hàng', `
      <div class="gd-flow mb-4">${flowHtml}</div>
      <div class="section-title">Luồng phụ trợ chạy song song</div>
      <div class="row g-3">${sideHtml}</div>`],
    ['roles', 'Vai trò & bộ phận', `
      <p class="text-muted-sm">Mỗi tài khoản gắn một vai trò — vai trò quyết định menu nhìn thấy và thao tác được phép.
        Một đơn hàng đi qua tay lần lượt: Designer → Manager → Sản xuất → Hậu kỳ → Kho.</p>
      <div class="row g-3">${rolesHtml}</div>`],
    ['modules', 'Bản đồ chức năng', `
      <p class="text-muted-sm">Toàn bộ màn hình trong hệ thống và việc của từng màn. Mục có <i class="bi bi-lock"></i> là bạn chưa có quyền — liên hệ Admin nếu cần.</p>
      ${modulesHtml}`],
    ['statuses', 'Vòng đời trạng thái', statusesHtml],
  ];

  root.innerHTML = `
    <h5 class="mb-1">Hướng dẫn vận hành</h5>
    <p class="text-muted-sm mb-3">StreamHub quản lý trọn vòng đời đơn hàng thêu trên Etsy: từ nhận đơn, thiết kế,
      sản xuất, hậu kỳ / QC đến xuất kho và bàn giao vận chuyển — kèm kho phôi QR, thanh toán NCC và đơn lỗi.</p>
    <div class="gd-tabs mb-3">${TABS.map(([id, label], i) =>
      `<button type="button" class="btn btn-sm ${i === 0 ? 'btn-primary' : 'btn-light'}" data-tab="${id}">${esc(label)}</button>`).join('')}</div>
    ${TABS.map(([id, , body], i) => `<div data-tab-panel="${id}" ${i === 0 ? '' : 'hidden'}>${body}</div>`).join('')}
    <style>
      .gd-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
      .gd-step { display: flex; gap: 14px; }
      .gd-step-rail { display: flex; flex-direction: column; align-items: center; }
      .gd-step-dot { width: 40px; height: 40px; border-radius: 50%; flex: none;
        background: #e0eaff; color: #3538cd; display: flex; align-items: center; justify-content: center; font-size: 18px; }
      .gd-step-line { width: 2px; flex: 1; background: #d0d5dd; margin: 4px 0; min-height: 18px; }
      .gd-step-card { flex: 1; margin-bottom: 14px; }
      .gd-branch { background: #fffaeb; color: #b54708; border-radius: 6px; padding: 6px 10px; margin-top: 8px; font-size: 13px; }
      .gd-mine { background: #d1fadf; color: #067647; }
      .gd-link { margin-right: 12px; font-size: 13px; text-decoration: none; }
      .gd-mini-steps { padding-left: 18px; font-size: 13px; color: #475467; }
      .gd-mini-steps li { margin-bottom: 6px; }
      .gd-role-icon { width: 34px; height: 34px; border-radius: 8px; flex: none; background: #eef2f6; color: #344054;
        display: flex; align-items: center; justify-content: center; font-size: 16px; }
      .gd-locked { opacity: .55; }
    </style>`;

  root.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.onclick = () => {
      root.querySelectorAll('[data-tab]').forEach((b) =>
        b.classList.replace(b === btn ? 'btn-light' : 'btn-primary', b === btn ? 'btn-primary' : 'btn-light'));
      root.querySelectorAll('[data-tab-panel]').forEach((p) => { p.hidden = p.dataset.tabPanel !== btn.dataset.tab; });
    };
  });
}
