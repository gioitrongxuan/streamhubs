-- StreamHub — Schema v1
-- Nguồn thiết kế: docs/02-kien-truc-csdl/database-schema.md
-- Quy ước: InnoDB, utf8mb4; mọi bảng có PK `id` AUTO_INCREMENT.

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Auth & Master Data
-- ---------------------------------------------------------------------------

CREATE TABLE roles (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(50) NOT NULL UNIQUE COMMENT 'admin, manager, designer, designer_senior, warehouse, production, finishing, finance',
  permissions JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shops (
  id                  INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name                VARCHAR(100) NOT NULL,
  order_prefix        VARCHAR(5)  NOT NULL COMMENT 'Prefix mã đơn nội bộ (ME, MA, ...)',
  etsy_shop_id        VARCHAR(50)  NULL,
  etsy_api_key        VARCHAR(255) NULL COMMENT 'Đã mã hóa ở tầng ứng dụng',
  sync_interval       INT NOT NULL DEFAULT 10 COMMENT 'Phút giữa các lần sync Etsy',
  default_designer_id INT UNSIGNED NULL,
  sender_name         VARCHAR(100) NULL,
  sender_address      TEXT NULL,
  is_active           TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE users (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id       INT UNSIGNED NOT NULL,
  shop_id       INT UNSIGNED NULL,
  avatar        VARCHAR(255) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_users_shop FOREIGN KEY (shop_id) REFERENCES shops(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE shops
  ADD CONSTRAINT fk_shops_default_designer FOREIGN KEY (default_designer_id) REFERENCES users(id);

CREATE TABLE suppliers (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  short_name    VARCHAR(50)  NULL,
  type          ENUM('internal','external_fulfill','material') NOT NULL,
  contact_name  VARCHAR(100) NULL,
  contact_phone VARCHAR(20)  NULL,
  bank_account  VARCHAR(100) NULL,
  bank_name     VARCHAR(100) NULL,
  bank_holder   VARCHAR(100) NULL,
  payment_days  INT NOT NULL DEFAULT 0 COMMENT 'NET payment terms',
  is_active     TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE design_levels (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(50) NOT NULL,
  description TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_types (
  id                  INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name                VARCHAR(100) NOT NULL,
  short_name          VARCHAR(20)  NULL COMMENT 'Mã nội bộ (EQZ, ...)',
  parent_id           INT UNSIGNED NULL,
  design_level_id     INT UNSIGNED NULL,
  hscode              VARCHAR(20)  NULL,
  hs_name             VARCHAR(255) NULL,
  hs_price            DECIMAL(10,2) NULL,
  image               VARCHAR(255) NULL,
  content             LONGTEXT NULL,
  data_map            TEXT NULL COMMENT 'Mỗi dòng 1 cặp key|Value ánh xạ variant Etsy',
  positions           JSON NULL COMMENT '["Front","Back","Left Chest",...]',
  default_supplier_id INT UNSIGNED NULL,
  is_active           TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_pt_parent   FOREIGN KEY (parent_id) REFERENCES product_types(id),
  CONSTRAINT fk_pt_level    FOREIGN KEY (design_level_id) REFERENCES design_levels(id),
  CONSTRAINT fk_pt_supplier FOREIGN KEY (default_supplier_id) REFERENCES suppliers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_type_variants (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  product_type_id INT UNSIGNED NOT NULL,
  name            VARCHAR(50) NOT NULL COMMENT 'Size, Color, Style, ...',
  sort_order      INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_ptv_type FOREIGN KEY (product_type_id) REFERENCES product_types(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_type_variant_values (
  id         INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  variant_id INT UNSIGNED NOT NULL,
  value      VARCHAR(50) NOT NULL,
  length     DECIMAL(8,2) NULL COMMENT 'cm — chỉ áp dụng variant Size',
  width      DECIMAL(8,2) NULL,
  height     DECIMAL(8,2) NULL,
  weight     DECIMAL(8,2) NULL COMMENT 'gram',
  weight_box DECIMAL(8,2) NULL,
  CONSTRAINT fk_ptvv_variant FOREIGN KEY (variant_id) REFERENCES product_type_variants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE products (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  product_type_id INT UNSIGNED NOT NULL,
  shop_id         INT UNSIGNED NOT NULL,
  etsy_listing_id VARCHAR(50) NULL,
  name            VARCHAR(255) NOT NULL,
  sku             VARCHAR(50) NULL,
  price           DECIMAL(12,2) NULL,
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  image           VARCHAR(255) NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_type FOREIGN KEY (product_type_id) REFERENCES product_types(id),
  CONSTRAINT fk_products_shop FOREIGN KEY (shop_id) REFERENCES shops(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_examples (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(100) NOT NULL,
  product_type_id INT UNSIGNED NOT NULL,
  image           VARCHAR(255) NULL,
  description     TEXT NULL,
  content         JSON NULL COMMENT 'variants, positions, personalization template',
  created_by      INT UNSIGNED NOT NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_oe_type FOREIGN KEY (product_type_id) REFERENCES product_types(id),
  CONSTRAINT fk_oe_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE machines (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  model       VARCHAR(100) NULL,
  supplier_id INT UNSIGNED NULL COMMENT 'Xưởng sở hữu máy',
  status      ENUM('idle','active','error','maintenance') NOT NULL DEFAULT 'idle',
  heads       INT NOT NULL DEFAULT 1,
  CONSTRAINT fk_machines_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

CREATE TABLE orders (
  id                 INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_code         VARCHAR(30) NOT NULL UNIQUE COMMENT '{PREFIX}{YYYYMMDDHHmmss}',
  order_type         ENUM('etsy','internal') NOT NULL DEFAULT 'internal',
  etsy_order_id      VARCHAR(50) NULL,
  shop_id            INT UNSIGNED NOT NULL,
  listing_name       VARCHAR(255) NULL,
  status             ENUM('new','need_confirm','designing','pending_review','designed',
                          'in_production','producing','redo','fixing','factory_return',
                          'produced','in_finishing','qc_passed','out_stock','shipped',
                          'in_transit','complete','cancelled') NOT NULL DEFAULT 'new',
  qc_passed_at       DATETIME NULL,
  design_assigned_at DATETIME NULL,
  designer_id        INT UNSIGNED NULL,
  cs_id              INT UNSIGNED NULL,
  supplier_id        INT UNSIGNED NULL,
  fulfill_type       ENUM('internal','external') NOT NULL DEFAULT 'internal',
  labels             VARCHAR(255) NULL COMMENT 'comma-separated; migrate sang order_labels khi >200K orders',
  is_dup             TINYINT(1) NOT NULL DEFAULT 0,
  is_digital         TINYINT(1) NOT NULL DEFAULT 0,
  shop_note          TEXT NULL,
  streamer_note      TEXT NULL COMMENT 'Personalization note từ Etsy',
  merged_order_id    INT UNSIGNED NULL COMMENT 'Đơn chính khi gộp; đơn có giá trị này không được làm đơn chính',
  ioss_number        VARCHAR(50) NULL,
  item_total         DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount           DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_fee       DECIMAL(12,2) NOT NULL DEFAULT 0,
  delivery_fee       DECIMAL(12,2) NOT NULL DEFAULT 0,
  sales_tax          DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax                DECIMAL(12,2) NOT NULL DEFAULT 0,
  order_total        DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency           VARCHAR(3) NOT NULL DEFAULT 'USD',
  receiver_name      VARCHAR(150) NULL,
  address_line1      VARCHAR(255) NULL,
  address_line2      VARCHAR(255) NULL,
  city               VARCHAR(100) NULL,
  state              VARCHAR(50)  NULL,
  zipcode            VARCHAR(20)  NULL,
  country            VARCHAR(100) NULL,
  phone              VARCHAR(30)  NULL,
  tracking_number    VARCHAR(100) NULL COMMENT 'Legacy — dùng order_packages.tracking_number',
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pushed_at          DATETIME NULL,
  shipped_at         DATETIME NULL,
  completed_at       DATETIME NULL,
  cancelled_at       DATETIME NULL,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_shop     FOREIGN KEY (shop_id) REFERENCES shops(id),
  CONSTRAINT fk_orders_designer FOREIGN KEY (designer_id) REFERENCES users(id),
  CONSTRAINT fk_orders_cs       FOREIGN KEY (cs_id) REFERENCES users(id),
  CONSTRAINT fk_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_orders_merged   FOREIGN KEY (merged_order_id) REFERENCES orders(id),
  INDEX idx_orders_status_created (status, created_at),
  INDEX idx_orders_shop_status (shop_id, status),
  INDEX idx_orders_designer_status (designer_id, status),
  INDEX idx_orders_etsy (etsy_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_items (
  id                     INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_id               INT UNSIGNED NOT NULL,
  product_type_id        INT UNSIGNED NOT NULL,
  listing_user_id        INT UNSIGNED NULL,
  sku                    VARCHAR(50) NULL,
  qty                    INT NOT NULL DEFAULT 1,
  price_sale             DECIMAL(12,2) NULL,
  sup_cost               DECIMAL(12,2) NULL,
  design_cost            DECIMAL(12,2) NULL,
  variants               JSON NULL,
  personalization        TEXT NULL,
  hscode                 VARCHAR(20) NULL,
  hs_name                VARCHAR(100) NULL,
  hs_price               DECIMAL(10,2) NULL,
  image_qc               TINYINT(1) NOT NULL DEFAULT 0,
  machine_id             INT UNSIGNED NULL,
  operator_id            INT UNSIGNED NULL,
  production_started_at  DATETIME NULL,
  production_finished_at DATETIME NULL,
  inventory_item_id      INT UNSIGNED NULL COMMENT 'Phôi dùng cho item; NULL khi qty>1, tra qua inventory_out',
  error_reason           TEXT NULL,
  error_at               ENUM('xuong','designer','phoi') NULL,
  status                 ENUM('pending','in_progress','done','in_finishing','redo','qc_failed','qc_passed')
                         NOT NULL DEFAULT 'pending',
  updated_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_oi_order    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_oi_type     FOREIGN KEY (product_type_id) REFERENCES product_types(id),
  CONSTRAINT fk_oi_listing  FOREIGN KEY (listing_user_id) REFERENCES users(id),
  CONSTRAINT fk_oi_machine  FOREIGN KEY (machine_id) REFERENCES machines(id),
  CONSTRAINT fk_oi_operator FOREIGN KEY (operator_id) REFERENCES users(id),
  INDEX idx_oi_order (order_id),
  INDEX idx_oi_machine_status (machine_id, status),
  INDEX idx_oi_operator (operator_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_item_design_files (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_item_id INT UNSIGNED NOT NULL,
  position      VARCHAR(50) NOT NULL COMMENT 'Trước, Mặt sau, Left Chest, ... — từ product_types.positions',
  file_type     ENUM('emb','dst','pdf','jpg','png') NOT NULL,
  file_path     VARCHAR(255) NOT NULL,
  uploaded_by   INT UNSIGNED NOT NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Re-upload sau redo: file cũ set 0',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_oidf_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_oidf_user FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_oidf_item_active (order_item_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_item_notes (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_item_id INT UNSIGNED NOT NULL,
  note          TEXT NOT NULL,
  images        JSON NULL,
  created_by    INT UNSIGNED NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_oin_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_oin_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_oin_item (order_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_packages (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_id        INT UNSIGNED NOT NULL,
  tracking_number VARCHAR(100) NULL,
  carrier         VARCHAR(50)  NULL,
  weight          DECIMAL(8,2) NULL COMMENT 'gram',
  note            TEXT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_op_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_op_order (order_id),
  INDEX idx_op_tracking (tracking_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- FK order_items.inventory_item_id → inventory_items được thêm sau khi
-- inventory_items tồn tại (xem bên dưới).

-- ---------------------------------------------------------------------------
-- Kho phôi & Chỉ thêu
-- ---------------------------------------------------------------------------

CREATE TABLE shelves (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(50) NOT NULL,
  capacity      INT NOT NULL DEFAULT 0,
  current_count INT NOT NULL DEFAULT 0 COMMENT 'Denormalized — sync atomic với inventory_in/out',
  location      VARCHAR(100) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inventory_lots (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  lot_number      VARCHAR(50) NOT NULL,
  supplier_id     INT UNSIGNED NOT NULL,
  product_type_id INT UNSIGNED NOT NULL,
  color           VARCHAR(50) NULL,
  size            VARCHAR(20) NULL,
  quantity        INT NOT NULL COMMENT 'Số lượng nhập ban đầu',
  remaining_qty   INT NOT NULL DEFAULT 0 COMMENT 'Denormalized = COUNT(inventory_items status=in_stock)',
  unit_price_vnd  DECIMAL(12,2) NULL,
  unit_price_usd  DECIMAL(10,4) NULL,
  min_threshold   INT NULL COMMENT 'Cảnh báo khi remaining_qty <= min_threshold',
  qr_prefix       VARCHAR(50) NOT NULL COMMENT 'QR mỗi item = {qr_prefix}{seq}',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_il_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_il_type     FOREIGN KEY (product_type_id) REFERENCES product_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inventory_items (
  id         INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  lot_id     INT UNSIGNED NOT NULL,
  qrcode     VARCHAR(100) NOT NULL UNIQUE,
  shelf_id   INT UNSIGNED NULL,
  -- `created`: QR đã sinh nhưng phôi chưa scan nhập kho (xem ADR-001)
  status     ENUM('created','in_stock','out','return_error','damaged') NOT NULL DEFAULT 'created',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ii_lot   FOREIGN KEY (lot_id) REFERENCES inventory_lots(id),
  CONSTRAINT fk_ii_shelf FOREIGN KEY (shelf_id) REFERENCES shelves(id),
  INDEX idx_ii_lot_status (lot_id, status),
  INDEX idx_ii_shelf_status (shelf_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE order_items
  ADD CONSTRAINT fk_oi_inventory_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id);

CREATE TABLE inventory_in (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  inventory_item_id INT UNSIGNED NOT NULL COMMENT '1 scan = 1 item',
  shelf_id          INT UNSIGNED NOT NULL,
  date              DATE NOT NULL,
  created_by        INT UNSIGNED NOT NULL,
  note              TEXT NULL,
  CONSTRAINT fk_in_item  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
  CONSTRAINT fk_in_shelf FOREIGN KEY (shelf_id) REFERENCES shelves(id),
  CONSTRAINT fk_in_user  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_in_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inventory_out (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  inventory_item_id INT UNSIGNED NOT NULL,
  order_item_id     INT UNSIGNED NULL COMMENT 'NULL khi type=return_error',
  type              ENUM('order','return_error') NOT NULL DEFAULT 'order',
  date              DATE NOT NULL,
  created_by        INT UNSIGNED NOT NULL,
  CONSTRAINT fk_out_item  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
  CONSTRAINT fk_out_oi    FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  CONSTRAINT fk_out_user  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_out_date (date),
  INDEX idx_out_order_item (order_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE thread_lots (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  lot_number      VARCHAR(50) NOT NULL,
  thread_code     VARCHAR(50) NOT NULL,
  supplier_id     INT UNSIGNED NOT NULL,
  thread_type     VARCHAR(100) NULL,
  unit            VARCHAR(20) NOT NULL DEFAULT 'cuộn',
  length_per_unit DECIMAL(10,2) NULL COMMENT 'mét/cuộn',
  quantity        INT NOT NULL,
  remaining_qty   INT NOT NULL DEFAULT 0 COMMENT 'Denormalized — sync với thread_in/out',
  min_threshold   INT NULL,
  unit_price_vnd  DECIMAL(12,2) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tl_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE thread_in (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  thread_lot_id INT UNSIGNED NOT NULL,
  qty           INT NOT NULL,
  date          DATE NOT NULL,
  created_by    INT UNSIGNED NOT NULL,
  note          TEXT NULL,
  CONSTRAINT fk_ti_lot  FOREIGN KEY (thread_lot_id) REFERENCES thread_lots(id),
  CONSTRAINT fk_ti_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE thread_out (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  thread_lot_id INT UNSIGNED NOT NULL,
  order_item_id INT UNSIGNED NULL COMMENT 'NULL khi xuất hàng loạt',
  qty           DECIMAL(10,2) NOT NULL,
  date          DATE NOT NULL,
  created_by    INT UNSIGNED NOT NULL,
  note          TEXT NULL,
  CONSTRAINT fk_to_lot  FOREIGN KEY (thread_lot_id) REFERENCES thread_lots(id),
  CONSTRAINT fk_to_oi   FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  CONSTRAINT fk_to_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Nhận hàng từ xưởng
-- ---------------------------------------------------------------------------

CREATE TABLE receive_sessions (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_id      INT UNSIGNED NOT NULL,
  supplier_id   INT UNSIGNED NOT NULL,
  received_date DATE NOT NULL,
  shipping_fee  DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Lưu 1 lần duy nhất tại header',
  received_by   INT UNSIGNED NOT NULL,
  note          TEXT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rs_order    FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_rs_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_rs_user     FOREIGN KEY (received_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE receive_order_logs (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  session_id    INT UNSIGNED NOT NULL,
  order_id      INT UNSIGNED NOT NULL COMMENT 'Denormalized để query nhanh theo order',
  order_item_id INT UNSIGNED NULL COMMENT 'NULL khi order chỉ có 1 item',
  sent_qty      INT NOT NULL,
  received_qty  INT NOT NULL,
  note          TEXT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rol_session FOREIGN KEY (session_id) REFERENCES receive_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_rol_order   FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_rol_item    FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  INDEX idx_rol_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Thanh toán
-- ---------------------------------------------------------------------------

CREATE TABLE payment_requests (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  serial_number VARCHAR(20) NOT NULL UNIQUE COMMENT 'YYYYMM + seq',
  supplier_id   INT UNSIGNED NULL COMMENT 'NULL cho loại other/shipping không gắn NCC',
  payment_group ENUM('external_fulfill','material','thread','shipping','design','other') NOT NULL,
  content       TEXT NULL,
  total_amount  DECIMAL(14,2) NOT NULL DEFAULT 0,
  currency      VARCHAR(3) NOT NULL DEFAULT 'VND',
  status        ENUM('pending','accepted','partial','paid','rejected') NOT NULL DEFAULT 'pending',
  file_main     VARCHAR(255) NULL,
  created_by    INT UNSIGNED NOT NULL,
  due_date      DATE NULL,
  paid_date     DATE NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pr_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_pr_user     FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_pr_status_due (status, due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payment_request_items (
  id                 INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  payment_request_id INT UNSIGNED NOT NULL,
  description        TEXT NOT NULL,
  qty                DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit               VARCHAR(20) NULL,
  unit_price         DECIMAL(14,2) NOT NULL DEFAULT 0,
  total              DECIMAL(14,2) NOT NULL DEFAULT 0,
  reference_type     VARCHAR(20) NULL COMMENT 'order | inventory_lot | thread_lot',
  reference_id       INT UNSIGNED NULL,
  CONSTRAINT fk_pri_pr FOREIGN KEY (payment_request_id) REFERENCES payment_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payment_request_files (
  id                 INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  payment_request_id INT UNSIGNED NOT NULL,
  file_path          VARCHAR(255) NOT NULL,
  created_by         INT UNSIGNED NOT NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prf_pr   FOREIGN KEY (payment_request_id) REFERENCES payment_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_prf_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payment_request_approvers (
  id                 INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  payment_request_id INT UNSIGNED NOT NULL,
  user_id            INT UNSIGNED NOT NULL,
  status             ENUM('pending','accepted','reject') NOT NULL DEFAULT 'pending',
  comment            TEXT NULL,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pra_pr   FOREIGN KEY (payment_request_id) REFERENCES payment_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_pra_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_pra (payment_request_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Vận chuyển, Logs, Tài liệu, Cấu hình
-- ---------------------------------------------------------------------------

CREATE TABLE auto_labels (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_id        INT UNSIGNED NOT NULL,
  package_id      INT UNSIGNED NULL COMMENT 'Khuyến nghị luôn set; NULL chỉ cho legacy',
  carrier         VARCHAR(50) NOT NULL,
  service         VARCHAR(100) NULL,
  tracking_number VARCHAR(100) NULL COMMENT 'Source of truth — sync sang order_packages cùng transaction',
  label_url       VARCHAR(255) NULL,
  status          ENUM('pending','generated','printed','failed') NOT NULL DEFAULT 'pending',
  created_by      INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_al_order   FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_al_package FOREIGN KEY (package_id) REFERENCES order_packages(id),
  CONSTRAINT fk_al_user    FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE activity_logs (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  entity_type ENUM('order','order_item','payment_request','inventory_lot','inventory_in',
                   'inventory_out','thread_lot','thread_in','thread_out','receive_session',
                   'auto_label','machine','user') NOT NULL,
  entity_id   INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NULL COMMENT 'NULL nếu hệ thống tự động',
  activity    TEXT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_log_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE documents (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  category    ENUM('system_guide','sales_case','listing_idea','design_doc','qc_doc') NOT NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT NULL,
  file_path   VARCHAR(255) NOT NULL,
  uploaded_by INT UNSIGNED NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_user FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE system_configs (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `key`       VARCHAR(100) NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  type        ENUM('int','float','string','json') NOT NULL DEFAULT 'string',
  `group`     VARCHAR(50) NOT NULL COMMENT 'alert | pagination | currency | qrcode | notification',
  description TEXT NULL,
  updated_by  INT UNSIGNED NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sc_user FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
