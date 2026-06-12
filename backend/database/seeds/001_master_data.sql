-- StreamHub — Seed dữ liệu gốc
-- Roles theo docs/03-quan-tri-he-thong/phan-quyen-rbac.md
-- System configs theo docs/02-kien-truc-csdl/database-schema.md

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Roles & permissions
-- Quy ước permissions JSON: module → action → true | false | "own"
-- Giá trị "*": toàn quyền (chỉ dùng cho admin).
-- ---------------------------------------------------------------------------

INSERT INTO roles (name, permissions) VALUES
('admin', JSON_OBJECT('*', true)),

('manager', JSON_OBJECT(
  'orders', JSON_OBJECT('view', true, 'create', true, 'edit', true, 'delete', false,
    'upload_design', true, 'approve_design', true, 'push_factory', true, 'cancel', true, 'export', true),
  'warehouse', JSON_OBJECT('inventory_in', true, 'inventory_out', true, 'inventory_view', true,
    'shelf', true, 'gen_qrcode', true, 'qc_scan', false, 'receive_order', true, 'export_hk', true,
    'scan_track', false, 'stock_order_view', true, 'production_update', true, 'thread', true,
    'machine', true, 'dashboard', true),
  'payment', JSON_OBJECT('create', true, 'view', true, 'approve', true, 'mark_paid', true, 'delete', false),
  'products', JSON_OBJECT('view', true, 'manage', true),
  'mdm', JSON_OBJECT('suppliers', true, 'design_levels', true),
  'system', JSON_OBJECT('users', false, 'configs', false, 'shops', true, 'documents_view', true,
    'documents_upload', true, 'auto_label', true)
)),

('designer_senior', JSON_OBJECT(
  'orders', JSON_OBJECT('view', true, 'create', false, 'edit', 'own', 'delete', false,
    'upload_design', true, 'approve_design', true, 'push_factory', false, 'cancel', false, 'export', true),
  'warehouse', false,
  'payment', false,
  'products', JSON_OBJECT('view', true, 'manage', false),
  'mdm', JSON_OBJECT('suppliers', false, 'design_levels', true),
  'system', JSON_OBJECT('documents_view', true, 'documents_upload', true)
)),

('designer', JSON_OBJECT(
  'orders', JSON_OBJECT('view', true, 'create', false, 'edit', 'own', 'delete', false,
    'upload_design', true, 'approve_design', false, 'push_factory', false, 'cancel', false, 'export', true),
  'warehouse', false,
  'payment', false,
  'products', JSON_OBJECT('view', true, 'manage', false),
  'mdm', JSON_OBJECT('suppliers', false, 'design_levels', true),
  'system', JSON_OBJECT('documents_view', true, 'documents_upload', true)
)),

('warehouse', JSON_OBJECT(
  'orders', JSON_OBJECT('view', true, 'create', false, 'edit', false, 'delete', false,
    'upload_design', false, 'approve_design', false, 'push_factory', false, 'cancel', false, 'export', true),
  'warehouse', JSON_OBJECT('inventory_in', true, 'inventory_out', true, 'inventory_view', true,
    'shelf', true, 'gen_qrcode', true, 'qc_scan', true, 'receive_order', false, 'export_hk', false,
    'scan_track', true, 'stock_order_view', true, 'production_update', false, 'thread', true,
    'machine', false, 'dashboard', true),
  'payment', JSON_OBJECT('create', true, 'view', true, 'approve', false, 'mark_paid', false, 'delete', false),
  'products', JSON_OBJECT('view', true, 'manage', false),
  'mdm', false,
  'system', JSON_OBJECT('documents_view', true, 'documents_upload', true, 'auto_label', true)
)),

('production', JSON_OBJECT(
  'orders', JSON_OBJECT('view', true, 'create', false, 'edit', false, 'delete', false,
    'upload_design', false, 'approve_design', false, 'push_factory', false, 'cancel', false, 'export', false),
  'warehouse', JSON_OBJECT('inventory_in', false, 'inventory_out', false, 'inventory_view', true,
    'shelf', false, 'gen_qrcode', false, 'qc_scan', false, 'receive_order', false, 'export_hk', false,
    'scan_track', false, 'stock_order_view', true, 'production_update', true, 'thread', false,
    'machine', true, 'dashboard', true),
  'payment', false,
  'products', JSON_OBJECT('view', true, 'manage', false),
  'mdm', false,
  'system', JSON_OBJECT('documents_view', true, 'documents_upload', false)
)),

('finishing', JSON_OBJECT(
  'orders', JSON_OBJECT('view', true, 'create', false, 'edit', false, 'delete', false,
    'upload_design', false, 'approve_design', false, 'push_factory', false, 'cancel', false, 'export', false),
  'warehouse', JSON_OBJECT('inventory_in', false, 'inventory_out', false, 'inventory_view', false,
    'shelf', false, 'gen_qrcode', false, 'qc_scan', true, 'receive_order', true, 'export_hk', true,
    'scan_track', false, 'stock_order_view', true, 'production_update', false, 'thread', false,
    'machine', false, 'dashboard', true),
  'payment', false,
  'products', false,
  'mdm', false,
  'system', JSON_OBJECT('documents_view', true, 'documents_upload', false)
)),

('finance', JSON_OBJECT(
  'orders', JSON_OBJECT('view', true, 'create', false, 'edit', false, 'delete', false,
    'upload_design', false, 'approve_design', false, 'push_factory', false, 'cancel', false, 'export', true),
  'warehouse', false,
  'payment', JSON_OBJECT('create', true, 'view', true, 'approve', false, 'mark_paid', true, 'delete', false),
  'products', false,
  'mdm', JSON_OBJECT('suppliers', true, 'design_levels', false),
  'system', JSON_OBJECT('documents_view', true, 'documents_upload', true)
));

-- ---------------------------------------------------------------------------
-- Admin user mặc định (đổi mật khẩu ngay sau lần đăng nhập đầu)
-- Mật khẩu: Admin@123
-- ---------------------------------------------------------------------------

INSERT INTO users (name, email, password_hash, role_id)
VALUES ('System Admin', 'admin@streamhub.co',
        '$2b$10$eY0wS9qNf22q6udodBhkAent/mGXKV2kyl9XnTCuQlPht2Yk/inyC',
        (SELECT id FROM roles WHERE name = 'admin'));

-- ---------------------------------------------------------------------------
-- System configs (defaults theo docs)
-- ---------------------------------------------------------------------------

INSERT INTO system_configs (`key`, value, type, `group`, description) VALUES
('alert_design_overdue_days',      '2',     'int',    'alert',        'Số ngày order chưa Design → cảnh báo đỏ'),
('alert_production_overdue_days',  '3',     'int',    'alert',        'Số ngày order chưa SX xong → cảnh báo đỏ'),
('alert_shipping_overdue_days',    '4',     'int',    'alert',        'Số ngày order chưa Ship → cảnh báo đỏ'),
('alert_qc_unshipped_hours',       '24',    'int',    'alert',        'Số giờ QC đạt mà chưa ship → cảnh báo'),
('alert_intransit_overdue_days',   '5',     'int',    'alert',        'Số ngày QC đạt mà chưa InTransit → cảnh báo'),
('alert_stock_order_overdue_days', '1',     'int',    'alert',        'Số ngày chưa SX xong tại Stock/Order → cảnh báo'),
('payment_due_warning_days',       '3',     'int',    'alert',        'Số ngày trước hạn TT → cảnh báo vàng'),
('order_per_page',                 '50',    'int',    'pagination',   'Số order mỗi trang'),
('stock_order_per_page',           '20',    'int',    'pagination',   'Số lệnh SX mỗi trang'),
('payment_per_page',               '25',    'int',    'pagination',   'Số ĐNTT mỗi trang'),
('usd_vnd_rate',                   '25500', 'float',  'currency',     'Tỷ giá USD/VND (cập nhật thủ công)'),
('default_currency',               'VND',   'string', 'currency',     'Tiền tệ nội bộ mặc định'),
('qr_prefix',                      'CH-',   'string', 'qrcode',       'Prefix mã QR phôi'),
('qr_print_size',                  '40x30', 'string', 'qrcode',       'Kích thước nhãn QR in (mm)'),
('notification_payment_new',       '["manager","admin"]',   'json', 'notification', 'Role nhận thông báo khi có ĐNTT mới'),
('notification_order_overdue',     '["manager","admin"]',   'json', 'notification', 'Role nhận thông báo order quá hạn'),
('notification_stock_low',         '["warehouse","manager"]','json', 'notification', 'Role nhận thông báo tồn kho thấp'),
('notification_order_cancelled',   '["manager","admin"]',   'json', 'notification', 'Role nhận thông báo khi order bị hủy'),
('notification_payment_overdue',   '["finance","manager"]', 'json', 'notification', 'Role nhận thông báo ĐNTT quá hạn');

-- ---------------------------------------------------------------------------
-- Dữ liệu gốc mẫu
-- ---------------------------------------------------------------------------

INSERT INTO design_levels (name, description) VALUES
('Level 1', 'Thiết kế đơn giản: text, monogram'),
('Level 2', 'Thiết kế trung bình: logo, hình đơn sắc'),
('Level 3', 'Thiết kế phức tạp: nhiều màu, nhiều vị trí');

INSERT INTO suppliers (name, short_name, type, payment_days) VALUES
('Xưởng Streamhub', 'Streamhub', 'internal', 0),
('EGfulfill', 'EGF', 'external_fulfill', 15);
