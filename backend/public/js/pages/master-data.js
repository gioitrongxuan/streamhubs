// Toàn bộ trang master-data khai báo qua crudPage — thêm trang mới = thêm 1 cấu hình.
import { crudPage } from './crud.js';
import { esc, badge, fmtMoney, fmtDate } from '../ui.js';
import { SUPPLIER_TYPES, MACHINE_STATUS, DOCUMENT_CATEGORIES } from '../constants.js';

const activeBadge = (row) =>
  row.is_active
    ? '<span class="sh-badge" style="background:#d1fadf;color:#067647">Hoạt động</span>'
    : '<span class="sh-badge" style="background:#f2f4f7;color:#667085">Ngừng</span>';

export const suppliersPage = crudPage({
  title: 'Nhà cung cấp',
  endpoint: '/suppliers',
  writePerm: 'mdm.suppliers',
  columns: [
    { key: 'name', label: 'Tên' },
    { key: 'short_name', label: 'Viết tắt' },
    { key: 'type', label: 'Loại', render: (r) => SUPPLIER_TYPES[r.type] ?? esc(r.type) },
    { key: 'contact_name', label: 'Liên hệ' },
    { key: 'bank_account', label: 'STK', render: (r) => `${esc(r.bank_account ?? '—')}<div class="text-muted-sm">${esc(r.bank_name ?? '')}</div>` },
    { key: 'payment_days', label: 'Công nợ (ngày)' },
    { key: 'is_active', label: 'Trạng thái', render: activeBadge },
  ],
  fields: [
    { name: 'name', label: 'Tên NCC', required: true },
    { name: 'short_name', label: 'Tên viết tắt' },
    { name: 'type', label: 'Loại', type: 'select', options: SUPPLIER_TYPES, numeric: false, required: true },
    { name: 'contact_name', label: 'Người liên hệ' },
    { name: 'contact_phone', label: 'Điện thoại' },
    { name: 'payment_days', label: 'Số ngày công nợ', type: 'number', default: 0 },
    { name: 'bank_holder', label: 'Chủ tài khoản' },
    { name: 'bank_account', label: 'Số tài khoản' },
    { name: 'bank_name', label: 'Ngân hàng' },
    { name: 'is_active', label: 'Đang hoạt động', type: 'checkbox' },
  ],
});

export const shelvesPage = crudPage({
  title: 'Kệ hàng',
  endpoint: '/shelves',
  writePerm: 'warehouse.shelf',
  columns: [
    { key: 'name', label: 'Tên kệ' },
    { key: 'location', label: 'Vị trí' },
    { key: 'current_count', label: 'Đang chứa', render: (r) => `<b>${r.current_count}</b> / ${r.capacity || '∞'}` },
  ],
  fields: [
    { name: 'name', label: 'Tên kệ', required: true },
    { name: 'capacity', label: 'Sức chứa (0 = không giới hạn)', type: 'number', default: 0 },
    { name: 'location', label: 'Vị trí trong kho' },
  ],
});

export const machinesPage = crudPage({
  title: 'Máy thêu',
  endpoint: '/machines',
  writePerm: 'warehouse.machine',
  columns: [
    { key: 'name', label: 'Tên máy' },
    { key: 'model', label: 'Model' },
    { key: 'supplier_name', label: 'Xưởng' },
    { key: 'heads', label: 'Số đầu' },
    { key: 'status', label: 'Trạng thái', render: (r) => badge(r.status, MACHINE_STATUS) },
  ],
  fields: [
    { name: 'name', label: 'Tên máy', required: true },
    { name: 'model', label: 'Model' },
    { name: 'supplier_id', label: 'Xưởng sở hữu', type: 'select', optionsEndpoint: '/suppliers' },
    { name: 'heads', label: 'Số đầu thêu', type: 'number', default: 1 },
    { name: 'status', label: 'Trạng thái', type: 'select', numeric: false,
      options: Object.fromEntries(Object.entries(MACHINE_STATUS).map(([k, v]) => [k, v.label])) },
  ],
});

export const productsPage = crudPage({
  title: 'Sản phẩm (Etsy Listing)',
  endpoint: '/products',
  writePerm: 'products.manage',
  columns: [
    { key: 'name', label: 'Tên' },
    { key: 'sku', label: 'SKU' },
    { key: 'product_type_name', label: 'Loại SP' },
    { key: 'shop_name', label: 'Shop' },
    { key: 'etsy_listing_id', label: 'Etsy Listing' },
    { key: 'price', label: 'Giá', render: (r) => fmtMoney(r.price, r.currency) },
    { key: 'is_active', label: 'Trạng thái', render: activeBadge },
  ],
  fields: [
    { name: 'name', label: 'Tên sản phẩm', required: true, col: 12 },
    { name: 'product_type_id', label: 'Loại sản phẩm', type: 'select', optionsEndpoint: '/product-types', required: true },
    { name: 'shop_id', label: 'Shop', type: 'select', optionsEndpoint: '/shops/options', required: true },
    { name: 'sku', label: 'SKU' },
    { name: 'etsy_listing_id', label: 'Etsy Listing ID' },
    { name: 'price', label: 'Giá bán', type: 'number', step: '0.01' },
    { name: 'currency', label: 'Tiền tệ', type: 'select', numeric: false, options: { USD: 'USD', VND: 'VND' } },
    { name: 'is_active', label: 'Đang bán', type: 'checkbox' },
  ],
});

export const productTypesPage = crudPage({
  title: 'Loại sản phẩm',
  endpoint: '/product-types',
  writePerm: 'products.manage',
  columns: [
    { key: 'name', label: 'Tên' },
    { key: 'short_name', label: 'Mã' },
    { key: 'parent_name', label: 'Danh mục cha' },
    { key: 'design_level_name', label: 'Cấp độ TK' },
    { key: 'hscode', label: 'HS Code' },
    { key: 'positions', label: 'Vị trí in/thêu', render: (r) => {
      const positions = typeof r.positions === 'string' ? JSON.parse(r.positions ?? '[]') : (r.positions ?? []);
      return positions?.map((p) => `<span class="sh-badge me-1" style="background:#eef2f6;color:#475467">${esc(p)}</span>`).join('') || '—';
    } },
    { key: 'is_active', label: 'Trạng thái', render: activeBadge },
  ],
  fields: [
    { name: 'name', label: 'Tên loại SP', required: true },
    { name: 'short_name', label: 'Mã nội bộ (VD: EQZ)' },
    { name: 'parent_id', label: 'Danh mục cha', type: 'select', optionsEndpoint: '/product-types' },
    { name: 'design_level_id', label: 'Cấp độ thiết kế', type: 'select', optionsEndpoint: '/design-levels' },
    { name: 'default_supplier_id', label: 'NCC mặc định', type: 'select', optionsEndpoint: '/suppliers' },
    { name: 'hscode', label: 'HS Code' },
    { name: 'hs_name', label: 'Tên hàng theo HS' },
    { name: 'hs_price', label: 'Giá khai hải quan (USD)', type: 'number', step: '0.01' },
    { name: 'positions_text', label: 'Vị trí in/thêu (phân cách bằng dấu phẩy)', col: 12,
      hint: 'VD: Trước, Mặt sau, Left Chest',
      fromRow: (r) => {
        const positions = typeof r.positions === 'string' ? JSON.parse(r.positions ?? '[]') : (r.positions ?? []);
        return positions?.join(', ') ?? '';
      } },
    { name: 'is_active', label: 'Đang dùng', type: 'checkbox' },
  ],
  toPayload: ({ positions_text, ...rest }) => ({
    ...rest,
    ...(positions_text !== undefined && positions_text !== null
      ? { positions: positions_text ? positions_text.split(',').map((s) => s.trim()).filter(Boolean) : null }
      : {}),
  }),
});

export const designLevelsPage = crudPage({
  title: 'Cấp độ thiết kế',
  endpoint: '/design-levels',
  writePerm: 'mdm.design_levels',
  columns: [
    { key: 'name', label: 'Tên' },
    { key: 'description', label: 'Mô tả' },
  ],
  fields: [
    { name: 'name', label: 'Tên cấp độ', required: true },
    { name: 'description', label: 'Mô tả', type: 'textarea', col: 12 },
  ],
});

export const usersPage = crudPage({
  title: 'Người dùng',
  endpoint: '/users',
  writePerm: 'system.users',
  columns: [
    { key: 'name', label: 'Tên' },
    { key: 'email', label: 'Email' },
    { key: 'role_name', label: 'Vai trò' },
    { key: 'created_at', label: 'Ngày tạo', render: (r) => fmtDate(r.created_at) },
    { key: 'is_active', label: 'Trạng thái', render: activeBadge },
  ],
  fields: [
    { name: 'name', label: 'Tên hiển thị', required: true },
    { name: 'email', label: 'Email', required: true },
    { name: 'password', label: 'Mật khẩu (≥ 8 ký tự, bỏ trống nếu không đổi)', type: 'text' },
    { name: 'role_id', label: 'Vai trò', type: 'select', optionsEndpoint: '/roles', required: true },
    { name: 'shop_id', label: 'Shop phụ trách', type: 'select', optionsEndpoint: '/shops/options' },
    { name: 'is_active', label: 'Đang hoạt động', type: 'checkbox' },
  ],
  toPayload: (values) => {
    const payload = { ...values };
    if (!payload.password) delete payload.password;
    return payload;
  },
});

export const shopsPage = crudPage({
  title: 'Shops Etsy',
  endpoint: '/shops',
  writePerm: 'system.shops',
  columns: [
    { key: 'name', label: 'Tên shop' },
    { key: 'order_prefix', label: 'Prefix' },
    { key: 'etsy_shop_id', label: 'Etsy Shop ID' },
    { key: 'sync_interval', label: 'Sync (phút)' },
    { key: 'sender_name', label: 'Người gửi' },
    { key: 'is_active', label: 'Trạng thái', render: activeBadge },
  ],
  fields: [
    { name: 'name', label: 'Tên shop', required: true },
    { name: 'order_prefix', label: 'Prefix mã đơn (VD: ME)', required: true },
    { name: 'etsy_shop_id', label: 'Etsy Shop ID' },
    { name: 'etsy_api_key', label: 'Etsy API Key' },
    { name: 'sync_interval', label: 'Tần suất sync (phút)', type: 'number', default: 10 },
    { name: 'default_designer_id', label: 'Designer mặc định', type: 'select', optionsEndpoint: '/users/options' },
    { name: 'sender_name', label: 'Tên người gửi (label)' },
    { name: 'sender_address', label: 'Địa chỉ gửi hàng', type: 'textarea', col: 12 },
    { name: 'is_active', label: 'Đang hoạt động', type: 'checkbox' },
  ],
});

export const documentsPage = crudPage({
  title: 'Tài liệu nội bộ',
  endpoint: '/documents',
  writePerm: 'system.documents_upload',
  editable: false, // API documents chỉ có tạo/xóa

  columns: [
    { key: 'title', label: 'Tiêu đề' },
    { key: 'category', label: 'Phân loại', render: (r) => DOCUMENT_CATEGORIES[r.category] ?? esc(r.category) },
    { key: 'description', label: 'Mô tả' },
    { key: 'file_path', label: 'File', render: (r) => `<a href="${esc(r.file_path)}" target="_blank">📄 Xem</a>` },
    { key: 'uploaded_by_name', label: 'Người tải lên' },
    { key: 'created_at', label: 'Ngày', render: (r) => fmtDate(r.created_at) },
  ],
  fields: [
    { name: 'title', label: 'Tiêu đề', required: true, col: 12 },
    { name: 'category', label: 'Phân loại', type: 'select', numeric: false, options: DOCUMENT_CATEGORIES, required: true },
    { name: 'file_path', label: 'Đường dẫn file', required: true },
    { name: 'description', label: 'Mô tả', type: 'textarea', col: 12 },
  ],
});
