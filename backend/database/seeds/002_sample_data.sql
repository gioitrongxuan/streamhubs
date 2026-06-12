-- StreamHub — Seed dữ liệu mẫu (giống thật) để test toàn hệ thống
-- Chạy SAU 001_master_data.sql. Chỉ chạy 1 lần trên DB trống (không idempotent).
--
-- Tài khoản test (mật khẩu chung: Test@123):
--   manager:   thuy.le@streamhub.co
--   designer:  minh.pham@streamhub.co, lan.vu@streamhub.co
--   senior:    huong.nguyen@streamhub.co
--   warehouse: tuan.tran@streamhub.co, hoa.dang@streamhub.co
--   production: cuong.do@streamhub.co, nam.bui@streamhub.co
--   finishing: mai.hoang@streamhub.co
--   finance:   ngoc.ly@streamhub.co
--
-- Phủ nghiệp vụ: 3 shop Etsy, 5 loại SP + variants, 16 đơn ở đủ các trạng thái
-- (new → designing → in_production → producing → produced → in_finishing →
--  qc_passed → shipped → in_transit → complete, kèm redo, cancelled, external
--  fulfill, đơn gộp, đơn digital), kho phôi (lot/QR/nhập/xuất), chỉ thêu,
-- nhận hàng từ xưởng, đề nghị thanh toán đủ trạng thái, auto label,
-- activity logs, tài liệu.

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Tra cứu ID từ seed 001
-- ---------------------------------------------------------------------------

SET @role_admin      = (SELECT id FROM roles WHERE name = 'admin');
SET @role_manager    = (SELECT id FROM roles WHERE name = 'manager');
SET @role_designer   = (SELECT id FROM roles WHERE name = 'designer');
SET @role_senior     = (SELECT id FROM roles WHERE name = 'designer_senior');
SET @role_warehouse  = (SELECT id FROM roles WHERE name = 'warehouse');
SET @role_production = (SELECT id FROM roles WHERE name = 'production');
SET @role_finishing  = (SELECT id FROM roles WHERE name = 'finishing');
SET @role_finance    = (SELECT id FROM roles WHERE name = 'finance');

SET @lv1 = (SELECT id FROM design_levels WHERE name = 'Level 1');
SET @lv2 = (SELECT id FROM design_levels WHERE name = 'Level 2');
SET @lv3 = (SELECT id FROM design_levels WHERE name = 'Level 3');

SET @sup_streamhub = (SELECT id FROM suppliers WHERE short_name = 'Streamhub');
SET @sup_egf       = (SELECT id FROM suppliers WHERE short_name = 'EGF');

-- Bổ sung thông tin liên hệ/ngân hàng cho NCC sẵn có (cần cho ĐNTT)
UPDATE suppliers SET contact_name = 'Trần Văn Hùng', contact_phone = '0903221144',
  bank_account = '19036881234011', bank_name = 'Techcombank', bank_holder = 'TRAN VAN HUNG'
WHERE id = @sup_streamhub;
UPDATE suppliers SET contact_name = 'Emily Zhang', contact_phone = '+86 138 0013 8000',
  bank_account = '6217003810026, SWIFT: PCBCCNBJ', bank_name = 'China Construction Bank', bank_holder = 'EG FULFILLMENT CO LTD'
WHERE id = @sup_egf;

-- ---------------------------------------------------------------------------
-- Nhà cung cấp bổ sung (nguyên vật liệu)
-- ---------------------------------------------------------------------------

INSERT INTO suppliers (name, short_name, type, contact_name, contact_phone, bank_account, bank_name, bank_holder, payment_days) VALUES
('Dệt may Phương Nam',   'PhuongNam', 'material', 'Nguyễn Thị Phương', '0912334455', '0071000868686', 'Vietcombank', 'NGUYEN THI PHUONG', 30),
('Chỉ thêu Tân Bình',    'TanBinh',   'material', 'Lê Quốc Bảo',       '0987654321', '060123456789',  'Sacombank',   'LE QUOC BAO',       15),
('Phụ liệu may Hòa Bình','HoaBinh',   'material', 'Phạm Văn Hòa',      '0938111222', '102003456789',  'VietinBank',  'PHAM VAN HOA',      0);

SET @sup_phuongnam = (SELECT id FROM suppliers WHERE short_name = 'PhuongNam');
SET @sup_tanbinh   = (SELECT id FROM suppliers WHERE short_name = 'TanBinh');

-- ---------------------------------------------------------------------------
-- Shops Etsy
-- ---------------------------------------------------------------------------

INSERT INTO shops (name, order_prefix, etsy_shop_id, sync_interval, sender_name, sender_address, is_active) VALUES
('MimiEmbroidery',  'ME', '38291045', 10, 'Mimi Embroidery',  '128 Nguyễn Trãi, Thanh Xuân, Hà Nội, Vietnam', 1),
('MagnoliaStitch',  'MA', '41507823', 10, 'Magnolia Stitch',  '128 Nguyễn Trãi, Thanh Xuân, Hà Nội, Vietnam', 1),
('CozyKidsCorner',  'CK', '45112960', 15, 'Cozy Kids Corner', '57 Lê Văn Lương, Cầu Giấy, Hà Nội, Vietnam',   1);

SET @shop_me = (SELECT id FROM shops WHERE order_prefix = 'ME');
SET @shop_ma = (SELECT id FROM shops WHERE order_prefix = 'MA');
SET @shop_ck = (SELECT id FROM shops WHERE order_prefix = 'CK');

-- ---------------------------------------------------------------------------
-- Người dùng (mật khẩu chung: Test@123)
-- ---------------------------------------------------------------------------

SET @pw = '$2b$10$5o925kYDoE7/Egv/X0/L/OlC208KZLGIXqpI3NhdDnr.cLps0kDRK';

INSERT INTO users (name, email, password_hash, role_id, shop_id, is_active, created_at) VALUES
('Lê Thanh Thúy',   'thuy.le@streamhub.co',    @pw, @role_manager,    NULL,     1, '2026-01-05 08:30:00'),
('Nguyễn Thu Hương','huong.nguyen@streamhub.co',@pw, @role_senior,    NULL,     1, '2026-01-05 08:35:00'),
('Phạm Quang Minh', 'minh.pham@streamhub.co',  @pw, @role_designer,   @shop_me, 1, '2026-01-06 09:00:00'),
('Vũ Ngọc Lan',     'lan.vu@streamhub.co',     @pw, @role_designer,   @shop_ma, 1, '2026-01-06 09:05:00'),
('Trần Anh Tuấn',   'tuan.tran@streamhub.co',  @pw, @role_warehouse,  NULL,     1, '2026-01-08 08:00:00'),
('Đặng Thị Hoa',    'hoa.dang@streamhub.co',   @pw, @role_warehouse,  NULL,     1, '2026-01-08 08:05:00'),
('Đỗ Mạnh Cường',   'cuong.do@streamhub.co',   @pw, @role_production, NULL,     1, '2026-01-10 07:30:00'),
('Bùi Hải Nam',     'nam.bui@streamhub.co',    @pw, @role_production, NULL,     1, '2026-01-10 07:35:00'),
('Hoàng Thị Mai',   'mai.hoang@streamhub.co',  @pw, @role_finishing,  NULL,     1, '2026-01-12 08:00:00'),
('Lý Bảo Ngọc',     'ngoc.ly@streamhub.co',    @pw, @role_finance,    NULL,     1, '2026-01-12 08:10:00'),
('Cao Văn Sơn',     'son.cao@streamhub.co',    @pw, @role_designer,   NULL,     0, '2026-02-01 09:00:00');

SET @u_admin   = (SELECT id FROM users WHERE email = 'admin@streamhub.co');
SET @u_thuy    = (SELECT id FROM users WHERE email = 'thuy.le@streamhub.co');
SET @u_huong   = (SELECT id FROM users WHERE email = 'huong.nguyen@streamhub.co');
SET @u_minh    = (SELECT id FROM users WHERE email = 'minh.pham@streamhub.co');
SET @u_lan     = (SELECT id FROM users WHERE email = 'lan.vu@streamhub.co');
SET @u_tuan    = (SELECT id FROM users WHERE email = 'tuan.tran@streamhub.co');
SET @u_hoa     = (SELECT id FROM users WHERE email = 'hoa.dang@streamhub.co');
SET @u_cuong   = (SELECT id FROM users WHERE email = 'cuong.do@streamhub.co');
SET @u_nam     = (SELECT id FROM users WHERE email = 'nam.bui@streamhub.co');
SET @u_mai     = (SELECT id FROM users WHERE email = 'mai.hoang@streamhub.co');
SET @u_ngoc    = (SELECT id FROM users WHERE email = 'ngoc.ly@streamhub.co');

UPDATE shops SET default_designer_id = @u_minh WHERE id = @shop_me;
UPDATE shops SET default_designer_id = @u_lan  WHERE id = @shop_ma;
UPDATE shops SET default_designer_id = @u_huong WHERE id = @shop_ck;

-- ---------------------------------------------------------------------------
-- Loại sản phẩm + variants
-- ---------------------------------------------------------------------------

INSERT INTO product_types (name, short_name, design_level_id, hscode, hs_name, hs_price, positions, data_map, default_supplier_id, is_active) VALUES
('Hoodie',       'HDI', @lv2, '6110.20', 'Cotton hooded sweatshirt',  12.00, JSON_ARRAY('Chest','Back','Left Sleeve','Right Sleeve'), 'Size|size\nColor|color\nStream Option|stream_option', @sup_streamhub, 1),
('Sweatshirt',   'SWS', @lv2, '6110.20', 'Cotton sweatshirt',         10.00, JSON_ARRAY('Chest','Back','Left Sleeve','Right Sleeve'), 'Size|size\nColor|color\nStream Option|stream_option', @sup_streamhub, 1),
('T-Shirt',      'TSH', @lv1, '6109.10', 'Cotton t-shirt',             6.00, JSON_ARRAY('Chest','Back'),                              'Size|size\nColor|color',                              @sup_streamhub, 1),
('Baby Banner',  'BBN', @lv3, '6307.90', 'Textile decoration banner',  8.00, JSON_ARRAY('Center'),                                    'Name|name\nFont|font',                                @sup_streamhub, 1),
('Beanie',       'BNE', @lv1, '6505.00', 'Knitted hat',                5.00, JSON_ARRAY('Front'),                                     'Color|color',                                         @sup_egf,       1);

SET @pt_hdi = (SELECT id FROM product_types WHERE short_name = 'HDI');
SET @pt_sws = (SELECT id FROM product_types WHERE short_name = 'SWS');
SET @pt_tsh = (SELECT id FROM product_types WHERE short_name = 'TSH');
SET @pt_bbn = (SELECT id FROM product_types WHERE short_name = 'BBN');
SET @pt_bne = (SELECT id FROM product_types WHERE short_name = 'BNE');

-- Variants: Size + Color cho Hoodie / Sweatshirt
INSERT INTO product_type_variants (product_type_id, name, sort_order) VALUES
(@pt_hdi, 'Size', 1), (@pt_hdi, 'Color', 2),
(@pt_sws, 'Size', 1), (@pt_sws, 'Color', 2),
(@pt_tsh, 'Size', 1), (@pt_tsh, 'Color', 2),
(@pt_bne, 'Color', 1);

SET @v_hdi_size  = (SELECT id FROM product_type_variants WHERE product_type_id = @pt_hdi AND name = 'Size');
SET @v_hdi_color = (SELECT id FROM product_type_variants WHERE product_type_id = @pt_hdi AND name = 'Color');
SET @v_sws_size  = (SELECT id FROM product_type_variants WHERE product_type_id = @pt_sws AND name = 'Size');
SET @v_sws_color = (SELECT id FROM product_type_variants WHERE product_type_id = @pt_sws AND name = 'Color');

INSERT INTO product_type_variant_values (variant_id, value, length, width, height, weight, weight_box) VALUES
(@v_hdi_size, 'S',   68.0, 51.0, 4.0, 450.0, 520.0),
(@v_hdi_size, 'M',   70.0, 54.0, 4.0, 480.0, 550.0),
(@v_hdi_size, 'L',   72.0, 57.0, 4.0, 510.0, 580.0),
(@v_hdi_size, 'XL',  74.0, 60.0, 4.0, 545.0, 615.0),
(@v_hdi_size, '2XL', 76.0, 63.0, 4.0, 580.0, 650.0),
(@v_hdi_color, 'Black', NULL, NULL, NULL, NULL, NULL),
(@v_hdi_color, 'White', NULL, NULL, NULL, NULL, NULL),
(@v_hdi_color, 'Navy',  NULL, NULL, NULL, NULL, NULL),
(@v_hdi_color, 'Sand',  NULL, NULL, NULL, NULL, NULL),
(@v_sws_size, 'S',   66.0, 50.0, 3.0, 380.0, 450.0),
(@v_sws_size, 'M',   68.0, 53.0, 3.0, 410.0, 480.0),
(@v_sws_size, 'L',   70.0, 56.0, 3.0, 440.0, 510.0),
(@v_sws_size, 'XL',  72.0, 59.0, 3.0, 470.0, 540.0),
(@v_sws_color, 'Ash Grey', NULL, NULL, NULL, NULL, NULL),
(@v_sws_color, 'Black',    NULL, NULL, NULL, NULL, NULL),
(@v_sws_color, 'Maroon',   NULL, NULL, NULL, NULL, NULL);

-- ---------------------------------------------------------------------------
-- Sản phẩm (Etsy listings)
-- ---------------------------------------------------------------------------

INSERT INTO products (product_type_id, shop_id, etsy_listing_id, name, sku, price, currency, is_active, created_at) VALUES
(@pt_hdi, @shop_me, '1689001122', 'Custom Embroidered Mama Hoodie - Personalized Names On Sleeve',   'EHD01021', 42.90, 'USD', 1, '2026-02-10 10:00:00'),
(@pt_hdi, @shop_me, '1689003344', 'Embroidered Dog Mom Hoodie - Custom Pet Name',                    'EHD01038', 39.50, 'USD', 1, '2026-02-12 10:00:00'),
(@pt_sws, @shop_me, '1690005566', 'Custom Grandma Sweatshirt With Grandkids Names',                  'ESW06349', 36.00, 'USD', 1, '2026-02-15 10:00:00'),
(@pt_sws, @shop_ma, '1701007788', 'Personalized Couple Sweatshirt - Embroidered Initials & Date',    'ESW06402', 34.50, 'USD', 1, '2026-02-20 10:00:00'),
(@pt_tsh, @shop_ma, '1702009900', 'Embroidered Cat Dad T-Shirt - Custom Cat Name',                   'ETS02115', 24.90, 'USD', 1, '2026-03-01 10:00:00'),
(@pt_bbn, @shop_ck, '1710002211', 'Personalized Baby Name Banner - Nursery Wall Decor',              'EBB00871', 28.00, 'USD', 1, '2026-03-05 10:00:00'),
(@pt_bne, @shop_ma, '1703004433', 'Embroidered Mama Beanie - Mothers Day Gift',                      'EBN00214', 19.90, 'USD', 1, '2026-03-10 10:00:00'),
(@pt_hdi, @shop_ck, '1711006655', 'Custom Big Sister Hoodie - Announcement Gift',                    'EHD01102', 38.00, 'USD', 0, '2026-03-12 10:00:00');

-- ---------------------------------------------------------------------------
-- Order examples (mẫu đơn cho CS/Designer tham chiếu)
-- ---------------------------------------------------------------------------

INSERT INTO order_examples (name, product_type_id, description, content, created_by, is_active, created_at) VALUES
('Mama Hoodie - tên con trên tay áo', @pt_hdi,
 'Mẫu chuẩn hoodie Mama: chữ "Mama" giữa ngực, tên các con thêu dọc tay áo trái.',
 JSON_OBJECT('variants', JSON_OBJECT('size','M','color','Sand'),
             'positions', JSON_ARRAY('Chest','Left Sleeve'),
             'personalization', 'Mama | Names: Liam, Emma'),
 @u_huong, 1, '2026-03-01 14:00:00'),
('Baby Banner - font script', @pt_bbn,
 'Banner tên bé font script, 3 màu chỉ, viền scallop.',
 JSON_OBJECT('variants', JSON_OBJECT('font','Script'),
             'positions', JSON_ARRAY('Center'),
             'personalization', 'Name: Olivia | Colors: blush/sage/cream'),
 @u_huong, 1, '2026-03-08 14:00:00');

-- ---------------------------------------------------------------------------
-- Máy thêu (xưởng nội bộ)
-- ---------------------------------------------------------------------------

INSERT INTO machines (name, model, supplier_id, status, heads) VALUES
('Máy thêu 01', 'Tajima TMEZ-SC 1501', @sup_streamhub, 'active',      1),
('Máy thêu 02', 'Tajima TMBP-SC 901',  @sup_streamhub, 'active',      1),
('Máy thêu 03', 'Brother PR1055X',     @sup_streamhub, 'idle',        1),
('Máy thêu 04', 'Tajima TFMX-IIC 1506',@sup_streamhub, 'maintenance', 6);

SET @mc1 = (SELECT id FROM machines WHERE name = 'Máy thêu 01');
SET @mc2 = (SELECT id FROM machines WHERE name = 'Máy thêu 02');

-- ---------------------------------------------------------------------------
-- Kệ hàng & Kho phôi
-- ---------------------------------------------------------------------------

INSERT INTO shelves (name, capacity, current_count, location) VALUES
('A1', 100, 0, 'Tầng 1 - dãy trái'),
('A2', 100, 0, 'Tầng 1 - dãy trái'),
('B1', 80,  0, 'Tầng 1 - dãy phải'),
('B2', 80,  0, 'Tầng 1 - dãy phải');

SET @sh_a1 = (SELECT id FROM shelves WHERE name = 'A1');
SET @sh_a2 = (SELECT id FROM shelves WHERE name = 'A2');
SET @sh_b1 = (SELECT id FROM shelves WHERE name = 'B1');

-- 3 lot phôi. remaining_qty set sau khi sinh inventory_items.
INSERT INTO inventory_lots (lot_number, supplier_id, product_type_id, color, size, quantity, remaining_qty, unit_price_vnd, unit_price_usd, min_threshold, qr_prefix, created_at) VALUES
('LOT-2605-HDI-BLK-M', @sup_phuongnam, @pt_hdi, 'Black', 'M', 10, 0, 185000, 7.25, 5, 'CH-HDIBLKM-', '2026-05-02 09:00:00'),
('LOT-2605-HDI-SND-L', @sup_phuongnam, @pt_hdi, 'Sand',  'L', 8,  0, 195000, 7.65, 5, 'CH-HDISNDL-', '2026-05-02 09:10:00'),
('LOT-2605-SWS-ASH-M', @sup_phuongnam, @pt_sws, 'Ash Grey', 'M', 12, 0, 145000, 5.70, 6, 'CH-SWSASHM-', '2026-05-10 09:00:00');

SET @lot_hdi_blk = (SELECT id FROM inventory_lots WHERE lot_number = 'LOT-2605-HDI-BLK-M');
SET @lot_hdi_snd = (SELECT id FROM inventory_lots WHERE lot_number = 'LOT-2605-HDI-SND-L');
SET @lot_sws_ash = (SELECT id FROM inventory_lots WHERE lot_number = 'LOT-2605-SWS-ASH-M');

-- Phôi từng chiếc (QR). Trạng thái: in_stock / out (đã dùng cho đơn) / created (mới in QR)
INSERT INTO inventory_items (lot_id, qrcode, shelf_id, status, created_at) VALUES
(@lot_hdi_blk, 'CH-HDIBLKM-0001', @sh_a1, 'out',      '2026-05-02 10:00:00'),
(@lot_hdi_blk, 'CH-HDIBLKM-0002', @sh_a1, 'out',      '2026-05-02 10:00:00'),
(@lot_hdi_blk, 'CH-HDIBLKM-0003', @sh_a1, 'in_stock', '2026-05-02 10:00:00'),
(@lot_hdi_blk, 'CH-HDIBLKM-0004', @sh_a1, 'in_stock', '2026-05-02 10:00:00'),
(@lot_hdi_blk, 'CH-HDIBLKM-0005', @sh_a1, 'in_stock', '2026-05-02 10:00:00'),
(@lot_hdi_blk, 'CH-HDIBLKM-0006', @sh_a1, 'in_stock', '2026-05-02 10:00:00'),
(@lot_hdi_blk, 'CH-HDIBLKM-0007', @sh_a1, 'in_stock', '2026-05-02 10:00:00'),
(@lot_hdi_blk, 'CH-HDIBLKM-0008', @sh_a1, 'damaged',  '2026-05-02 10:00:00'),
(@lot_hdi_blk, 'CH-HDIBLKM-0009', NULL,   'created',  '2026-05-02 10:00:00'),
(@lot_hdi_blk, 'CH-HDIBLKM-0010', NULL,   'created',  '2026-05-02 10:00:00'),
(@lot_hdi_snd, 'CH-HDISNDL-0001', @sh_a2, 'out',      '2026-05-02 10:30:00'),
(@lot_hdi_snd, 'CH-HDISNDL-0002', @sh_a2, 'in_stock', '2026-05-02 10:30:00'),
(@lot_hdi_snd, 'CH-HDISNDL-0003', @sh_a2, 'in_stock', '2026-05-02 10:30:00'),
(@lot_hdi_snd, 'CH-HDISNDL-0004', @sh_a2, 'in_stock', '2026-05-02 10:30:00'),
(@lot_hdi_snd, 'CH-HDISNDL-0005', @sh_a2, 'in_stock', '2026-05-02 10:30:00'),
(@lot_hdi_snd, 'CH-HDISNDL-0006', @sh_a2, 'in_stock', '2026-05-02 10:30:00'),
(@lot_hdi_snd, 'CH-HDISNDL-0007', @sh_a2, 'in_stock', '2026-05-02 10:30:00'),
(@lot_hdi_snd, 'CH-HDISNDL-0008', @sh_a2, 'return_error', '2026-05-02 10:30:00'),
(@lot_sws_ash, 'CH-SWSASHM-0001', @sh_b1, 'out',      '2026-05-10 10:00:00'),
(@lot_sws_ash, 'CH-SWSASHM-0002', @sh_b1, 'out',      '2026-05-10 10:00:00'),
(@lot_sws_ash, 'CH-SWSASHM-0003', @sh_b1, 'in_stock', '2026-05-10 10:00:00'),
(@lot_sws_ash, 'CH-SWSASHM-0004', @sh_b1, 'in_stock', '2026-05-10 10:00:00'),
(@lot_sws_ash, 'CH-SWSASHM-0005', @sh_b1, 'in_stock', '2026-05-10 10:00:00'),
(@lot_sws_ash, 'CH-SWSASHM-0006', @sh_b1, 'in_stock', '2026-05-10 10:00:00'),
(@lot_sws_ash, 'CH-SWSASHM-0007', @sh_b1, 'in_stock', '2026-05-10 10:00:00'),
(@lot_sws_ash, 'CH-SWSASHM-0008', @sh_b1, 'in_stock', '2026-05-10 10:00:00'),
(@lot_sws_ash, 'CH-SWSASHM-0009', @sh_b1, 'in_stock', '2026-05-10 10:00:00'),
(@lot_sws_ash, 'CH-SWSASHM-0010', @sh_b1, 'in_stock', '2026-05-10 10:00:00'),
(@lot_sws_ash, 'CH-SWSASHM-0011', @sh_b1, 'in_stock', '2026-05-10 10:00:00'),
(@lot_sws_ash, 'CH-SWSASHM-0012', @sh_b1, 'in_stock', '2026-05-10 10:00:00');

-- Đồng bộ trường denormalized
UPDATE inventory_lots l SET remaining_qty =
  (SELECT COUNT(*) FROM inventory_items i WHERE i.lot_id = l.id AND i.status = 'in_stock')
WHERE l.id IN (@lot_hdi_blk, @lot_hdi_snd, @lot_sws_ash);

UPDATE shelves s SET current_count =
  (SELECT COUNT(*) FROM inventory_items i WHERE i.shelf_id = s.id AND i.status = 'in_stock');

-- Lịch sử nhập kho (mọi item đã từng lên kệ — trừ 2 item mới in QR)
INSERT INTO inventory_in (inventory_item_id, shelf_id, date, created_by, note)
SELECT i.id, i.shelf_id, DATE(i.created_at) + INTERVAL 1 DAY, @u_tuan, 'Nhập kho theo lot'
FROM inventory_items i WHERE i.shelf_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Chỉ thêu
-- ---------------------------------------------------------------------------

INSERT INTO thread_lots (lot_number, thread_code, supplier_id, thread_type, unit, length_per_unit, quantity, remaining_qty, min_threshold, unit_price_vnd, created_at) VALUES
('TL-2604-001', 'MD-1001', @sup_tanbinh, 'Polyester 120D/2 - White',  'cuộn', 5000, 50, 41, 10, 32000, '2026-04-15 09:00:00'),
('TL-2604-002', 'MD-1840', @sup_tanbinh, 'Polyester 120D/2 - Black',  'cuộn', 5000, 50, 38, 10, 32000, '2026-04-15 09:00:00'),
('TL-2605-003', 'MD-1147', @sup_tanbinh, 'Polyester 120D/2 - Blush',  'cuộn', 5000, 20, 17, 5,  34000, '2026-05-20 09:00:00'),
('TL-2605-004', 'MD-1615', @sup_tanbinh, 'Polyester 120D/2 - Sage',   'cuộn', 5000, 20, 4,  5,  34000, '2026-05-20 09:00:00');

SET @tl_white = (SELECT id FROM thread_lots WHERE lot_number = 'TL-2604-001');
SET @tl_black = (SELECT id FROM thread_lots WHERE lot_number = 'TL-2604-002');
SET @tl_sage  = (SELECT id FROM thread_lots WHERE lot_number = 'TL-2605-004');

INSERT INTO thread_in (thread_lot_id, qty, date, created_by, note) VALUES
(@tl_white, 50, '2026-04-16', @u_tuan, 'Nhập lô chỉ trắng tháng 4'),
(@tl_black, 50, '2026-04-16', @u_tuan, 'Nhập lô chỉ đen tháng 4'),
((SELECT id FROM thread_lots WHERE lot_number = 'TL-2605-003'), 20, '2026-05-21', @u_hoa, NULL),
(@tl_sage,  20, '2026-05-21', @u_hoa, NULL);

INSERT INTO thread_out (thread_lot_id, order_item_id, qty, date, created_by, note) VALUES
(@tl_white, NULL, 9,  '2026-05-25', @u_tuan, 'Xuất hàng loạt cho ca sản xuất tuần 22'),
(@tl_black, NULL, 12, '2026-05-25', @u_tuan, 'Xuất hàng loạt cho ca sản xuất tuần 22'),
(@tl_sage,  NULL, 16, '2026-06-01', @u_hoa,  'Xuất cho lô banner — sắp chạm ngưỡng cảnh báo'),
((SELECT id FROM thread_lots WHERE lot_number = 'TL-2605-003'), NULL, 3, '2026-06-01', @u_hoa, NULL);

-- ---------------------------------------------------------------------------
-- ĐƠN HÀNG — phủ đủ trạng thái vòng đời
-- ---------------------------------------------------------------------------

-- 1) ME — mới sync từ Etsy, chưa xử lý
INSERT INTO orders (order_code, order_type, etsy_order_id, shop_id, listing_name, status, fulfill_type,
  item_total, shipping_fee, sales_tax, order_total, currency,
  receiver_name, address_line1, city, state, zipcode, country, phone, streamer_note, created_at, updated_at) VALUES
('ME20260611083015', 'etsy', '3401558821', @shop_me, 'Custom Embroidered Mama Hoodie - Personalized Names On Sleeve',
 'new', 'internal', 42.90, 6.50, 3.20, 52.60, 'USD',
 'Sarah Mitchell', '4821 Maple Grove Ln', 'Austin', 'TX', '78745', 'United States', '+1 512 555 0182',
 'Mama / Names on sleeve: Liam, Emma', '2026-06-11 08:30:15', '2026-06-11 08:30:15');

-- 2) ME — thiếu thông tin personalization, cần CS xác nhận với khách
INSERT INTO orders (order_code, order_type, etsy_order_id, shop_id, listing_name, status, fulfill_type, cs_id,
  item_total, shipping_fee, order_total, currency,
  receiver_name, address_line1, city, state, zipcode, country, streamer_note, shop_note, labels, created_at, updated_at) VALUES
('ME20260610141122', 'etsy', '3401442756', @shop_me, 'Embroidered Dog Mom Hoodie - Custom Pet Name',
 'need_confirm', 'internal', @u_thuy, 39.50, 6.50, 46.00, 'USD',
 'Jennifer Lopez', '77 Birchwood Ave', 'Portland', 'OR', '97201', 'United States',
 NULL, 'Khách không điền tên pet — đã nhắn Etsy message 10/06, chờ phản hồi', 'cho-khach', '2026-06-10 14:11:22', '2026-06-10 16:00:00');

-- 3) MA — đang thiết kế
INSERT INTO orders (order_code, order_type, etsy_order_id, shop_id, listing_name, status, fulfill_type,
  designer_id, cs_id, design_assigned_at,
  item_total, shipping_fee, sales_tax, order_total, currency,
  receiver_name, address_line1, address_line2, city, state, zipcode, country, streamer_note, created_at, updated_at) VALUES
('MA20260609091500', 'etsy', '3399887123', @shop_ma, 'Personalized Couple Sweatshirt - Embroidered Initials & Date',
 'designing', 'internal', @u_lan, @u_thuy, '2026-06-09 10:30:00',
 69.00, 8.00, 5.10, 82.10, 'USD',
 'Michael Chen', '210 King St W', 'Apt 1804', 'Toronto', 'ON', 'M5H 1K4', 'Canada',
 'Set of 2: "J ♥ K" + date 14.02.2025', '2026-06-09 09:15:00', '2026-06-09 10:30:00');

-- 4) ME — designer up file xong, chờ senior duyệt
INSERT INTO orders (order_code, order_type, etsy_order_id, shop_id, listing_name, status, fulfill_type,
  designer_id, cs_id, design_assigned_at,
  item_total, shipping_fee, order_total, currency,
  receiver_name, address_line1, city, state, zipcode, country, streamer_note, created_at, updated_at) VALUES
('ME20260608101010', 'etsy', '3398765001', @shop_me, 'Custom Grandma Sweatshirt With Grandkids Names',
 'pending_review', 'internal', @u_minh, @u_thuy, '2026-06-08 11:00:00',
 36.00, 6.50, 42.50, 'USD',
 'Patricia Walker', '15 Rosewood Close', 'Manchester', NULL, 'M14 5TQ', 'United Kingdom',
 'Grandma + names: Oliver, Amelia, George', '2026-06-08 10:10:10', '2026-06-10 17:20:00');

-- 5) MA — đã duyệt design, sẵn sàng đẩy xưởng
INSERT INTO orders (order_code, order_type, etsy_order_id, shop_id, listing_name, status, fulfill_type,
  designer_id, cs_id, design_assigned_at, ioss_number,
  item_total, shipping_fee, tax, order_total, currency,
  receiver_name, address_line1, city, zipcode, country, streamer_note, created_at, updated_at) VALUES
('MA20260607154500', 'etsy', '3397001442', @shop_ma, 'Embroidered Cat Dad T-Shirt - Custom Cat Name',
 'designed', 'internal', @u_lan, @u_thuy, '2026-06-07 16:00:00', 'IM2760000742',
 24.90, 7.50, 6.15, 38.55, 'USD',
 'Lukas Schneider', 'Hauptstraße 42', 'Berlin', '10827', 'Germany',
 'Cat name: Whiskers', '2026-06-07 15:45:00', '2026-06-09 09:00:00');

-- 6) ME — đã đẩy xưởng nội bộ, chưa lên máy
INSERT INTO orders (order_code, order_type, etsy_order_id, shop_id, listing_name, status, fulfill_type, supplier_id,
  designer_id, cs_id, design_assigned_at, pushed_at,
  item_total, shipping_fee, sales_tax, order_total, currency,
  receiver_name, address_line1, city, state, zipcode, country, streamer_note, created_at, updated_at) VALUES
('ME20260606081200', 'etsy', '3395887210', @shop_me, 'Custom Embroidered Mama Hoodie - Personalized Names On Sleeve',
 'in_production', 'internal', @sup_streamhub, @u_minh, @u_thuy, '2026-06-06 09:00:00', '2026-06-08 08:30:00',
 42.90, 6.50, 3.20, 52.60, 'USD',
 'Emily Rodriguez', '932 Sunset Blvd', 'Los Angeles', 'CA', '90026', 'United States',
 'Mama / Sleeve: Mateo', '2026-06-06 08:12:00', '2026-06-08 08:30:00');

-- 7) MA — đang chạy trên máy thêu
INSERT INTO orders (order_code, order_type, etsy_order_id, shop_id, listing_name, status, fulfill_type, supplier_id,
  designer_id, cs_id, design_assigned_at, pushed_at,
  item_total, shipping_fee, order_total, currency,
  receiver_name, address_line1, city, state, zipcode, country, streamer_note, created_at, updated_at) VALUES
('MA20260605103000', 'etsy', '3394556001', @shop_ma, 'Personalized Couple Sweatshirt - Embroidered Initials & Date',
 'producing', 'internal', @sup_streamhub, @u_lan, @u_thuy, '2026-06-05 11:00:00', '2026-06-07 08:00:00',
 34.50, 8.00, 42.50, 'USD',
 'Ashley Nguyen', '88 Fremont St', 'San Jose', 'CA', '95113', 'United States',
 'A ♥ T — 20.10.2024', '2026-06-05 10:30:00', '2026-06-10 08:15:00');

-- 8) ME — xưởng phát hiện lỗi design (thiếu màu chỉ), trả lại designer làm lại
INSERT INTO orders (order_code, order_type, etsy_order_id, shop_id, listing_name, status, fulfill_type, supplier_id,
  designer_id, cs_id, design_assigned_at, pushed_at, labels,
  item_total, shipping_fee, order_total, currency,
  receiver_name, address_line1, city, state, zipcode, country, streamer_note, created_at, updated_at) VALUES
('ME20260604093045', 'etsy', '3393201818', @shop_me, 'Embroidered Dog Mom Hoodie - Custom Pet Name',
 'redo', 'internal', @sup_streamhub, @u_minh, @u_thuy, '2026-06-04 10:00:00', '2026-06-05 14:00:00', 'loi-design',
 39.50, 6.50, 46.00, 'USD',
 'Hannah Kim', '501 Pine St', 'Seattle', 'WA', '98101', 'United States',
 'Dog: Bella (font script)', '2026-06-04 09:30:45', '2026-06-09 15:40:00');

-- 9) CK — sản xuất xong, chờ hậu kì
INSERT INTO orders (order_code, order_type, etsy_order_id, shop_id, listing_name, status, fulfill_type, supplier_id,
  designer_id, cs_id, design_assigned_at, pushed_at,
  item_total, shipping_fee, sales_tax, order_total, currency,
  receiver_name, address_line1, city, state, zipcode, country, streamer_note, created_at, updated_at) VALUES
('CK20260603140020', 'etsy', '3391900553', @shop_ck, 'Personalized Baby Name Banner - Nursery Wall Decor',
 'produced', 'internal', @sup_streamhub, @u_huong, @u_thuy, '2026-06-03 15:00:00', '2026-06-05 08:00:00',
 28.00, 5.50, 2.10, 35.60, 'USD',
 'Megan Foster', '12 Cherry Hill Rd', 'Nashville', 'TN', '37206', 'United States',
 'Name: Olivia | blush/sage/cream', '2026-06-03 14:00:20', '2026-06-10 16:30:00');

-- 10) MA — đang hậu kì (là + gấp + đóng gói)
INSERT INTO orders (order_code, order_type, etsy_order_id, shop_id, listing_name, status, fulfill_type, supplier_id,
  designer_id, cs_id, design_assigned_at, pushed_at,
  item_total, shipping_fee, order_total, currency,
  receiver_name, address_line1, city, state, zipcode, country, streamer_note, created_at, updated_at) VALUES
('MA20260602111530', 'etsy', '3390442817', @shop_ma, 'Embroidered Mama Beanie - Mothers Day Gift',
 'in_finishing', 'internal', @sup_streamhub, @u_lan, @u_thuy, '2026-06-02 13:00:00', '2026-06-04 08:00:00',
 19.90, 5.00, 24.90, 'USD',
 'Rachel Adams', '305 Elm St', 'Denver', 'CO', '80205', 'United States',
 NULL, '2026-06-02 11:15:30', '2026-06-11 09:00:00');

-- 11) ME — QC đạt, chờ xuất kho/ship (sẽ cảnh báo nếu >24h chưa ship)
INSERT INTO orders (order_code, order_type, etsy_order_id, shop_id, listing_name, status, fulfill_type, supplier_id,
  designer_id, cs_id, design_assigned_at, pushed_at, qc_passed_at,
  item_total, shipping_fee, sales_tax, order_total, currency,
  receiver_name, address_line1, city, state, zipcode, country, streamer_note, created_at, updated_at) VALUES
('ME20260601164510', 'etsy', '3389118274', @shop_me, 'Custom Grandma Sweatshirt With Grandkids Names',
 'qc_passed', 'internal', @sup_streamhub, @u_minh, @u_thuy, '2026-06-01 17:30:00', '2026-06-03 08:00:00', '2026-06-11 10:20:00',
 36.00, 6.50, 2.70, 45.20, 'USD',
 'Linda Brooks', '9410 Lakeshore Dr', 'Chicago', 'IL', '60611', 'United States',
 'Nana + names: Ava, Noah', '2026-06-01 16:45:10', '2026-06-11 10:20:00');

-- 12) MA — đã ship, có tracking
INSERT INTO orders (order_code, order_type, etsy_order_id, shop_id, listing_name, status, fulfill_type, supplier_id,
  designer_id, cs_id, design_assigned_at, pushed_at, qc_passed_at, shipped_at,
  item_total, shipping_fee, order_total, currency,
  receiver_name, address_line1, city, state, zipcode, country, streamer_note, created_at, updated_at) VALUES
('MA20260528092230', 'etsy', '3384665190', @shop_ma, 'Personalized Couple Sweatshirt - Embroidered Initials & Date',
 'shipped', 'internal', @sup_streamhub, @u_lan, @u_thuy, '2026-05-28 10:00:00', '2026-05-30 08:00:00', '2026-06-05 14:00:00', '2026-06-06 09:30:00',
 34.50, 8.00, 42.50, 'USD',
 'David Miller', '47 Ocean View Ter', 'Miami', 'FL', '33139', 'United States',
 'D ♥ S — 07.07.2023', '2026-05-28 09:22:30', '2026-06-06 09:30:00');

-- 13) CK — đang trên đường vận chuyển
INSERT INTO orders (order_code, order_type, etsy_order_id, shop_id, listing_name, status, fulfill_type, supplier_id,
  designer_id, cs_id, design_assigned_at, pushed_at, qc_passed_at, shipped_at,
  item_total, shipping_fee, sales_tax, order_total, currency,
  receiver_name, address_line1, city, state, zipcode, country, streamer_note, created_at, updated_at) VALUES
('CK20260525133040', 'etsy', '3381207465', @shop_ck, 'Personalized Baby Name Banner - Nursery Wall Decor',
 'in_transit', 'internal', @sup_streamhub, @u_huong, @u_thuy, '2026-05-25 14:30:00', '2026-05-27 08:00:00', '2026-06-01 11:00:00', '2026-06-02 10:00:00',
 28.00, 5.50, 2.10, 35.60, 'USD',
 'Sophie Turner', '23 Garden Walk', 'Boston', 'MA', '02115', 'United States',
 'Name: Theodore | navy/cream', '2026-05-25 13:30:40', '2026-06-08 07:45:00');

-- 14) ME — hoàn tất (đã giao thành công)
INSERT INTO orders (order_code, order_type, etsy_order_id, shop_id, listing_name, status, fulfill_type, supplier_id,
  designer_id, cs_id, design_assigned_at, pushed_at, qc_passed_at, shipped_at, completed_at,
  item_total, discount, shipping_fee, sales_tax, order_total, currency,
  receiver_name, address_line1, city, state, zipcode, country, streamer_note, created_at, updated_at) VALUES
('ME20260512080910', 'etsy', '3367448012', @shop_me, 'Custom Embroidered Mama Hoodie - Personalized Names On Sleeve',
 'complete', 'internal', @sup_streamhub, @u_minh, @u_thuy, '2026-05-12 09:00:00', '2026-05-14 08:00:00', '2026-05-19 10:00:00', '2026-05-20 09:00:00', '2026-05-29 18:00:00',
 85.80, 8.58, 9.50, 6.40, 90.12, 'USD',
 'Amanda Clarke', '1640 Riverside Ave', 'Jacksonville', 'FL', '32204', 'United States',
 '2x Mama hoodie — sleeve: Lucas, Mia | Mã giảm giá MOTHERSDAY10', '2026-05-12 08:09:10', '2026-05-29 18:00:00');

-- 15) MA — khách hủy trước khi sản xuất
INSERT INTO orders (order_code, order_type, etsy_order_id, shop_id, listing_name, status, fulfill_type,
  cs_id, item_total, shipping_fee, order_total, currency,
  receiver_name, address_line1, city, state, zipcode, country, shop_note, cancelled_at, created_at, updated_at) VALUES
('MA20260607190005', 'etsy', '3397112230', @shop_ma, 'Embroidered Cat Dad T-Shirt - Custom Cat Name',
 'cancelled', 'internal', @u_thuy, 24.90, 7.50, 32.40, 'USD',
 'Tom Harris', '12 Abbey Rd', 'London', NULL, 'NW8 9AY', 'United Kingdom',
 'Khách nhắn đặt nhầm size, yêu cầu hủy & refund — đã refund trên Etsy 08/06', '2026-06-08 09:15:00', '2026-06-07 19:00:05', '2026-06-08 09:15:00');

-- 16) MA — fulfill ngoài qua EGF (beanie không tự sản xuất)
INSERT INTO orders (order_code, order_type, etsy_order_id, shop_id, listing_name, status, fulfill_type, supplier_id,
  designer_id, cs_id, design_assigned_at, pushed_at,
  item_total, shipping_fee, order_total, currency,
  receiver_name, address_line1, city, state, zipcode, country, streamer_note, created_at, updated_at) VALUES
('MA20260604160820', 'etsy', '3393448867', @shop_ma, 'Embroidered Mama Beanie - Mothers Day Gift',
 'in_production', 'external', @sup_egf, @u_lan, @u_thuy, '2026-06-04 17:00:00', '2026-06-06 10:00:00',
 39.80, 5.00, 44.80, 'USD',
 'Jessica Park', '730 W 5th Ave', 'Anchorage', 'AK', '99501', 'United States',
 '2 beanies: Mama + Mini', '2026-06-04 16:08:20', '2026-06-06 10:00:00');

-- 17) Đơn nội bộ (sản xuất stock, không qua Etsy) — đơn gộp ship cùng đơn 12
INSERT INTO orders (order_code, order_type, shop_id, listing_name, status, fulfill_type, supplier_id,
  designer_id, cs_id, merged_order_id, item_total, order_total, currency, shop_note, created_at, updated_at) VALUES
('MA20260528101500', 'internal', @shop_ma, 'Bổ sung: túi canvas tặng kèm đơn MA20260528092230',
 'shipped', 'internal', @sup_streamhub, @u_lan, @u_thuy,
 (SELECT o2.id FROM (SELECT id FROM orders WHERE order_code = 'MA20260528092230') o2),
 0.00, 0.00, 'USD', 'Quà tặng kèm — gộp ship cùng đơn chính', '2026-05-28 10:15:00', '2026-06-06 09:30:00');

SET @o1  = (SELECT id FROM orders WHERE order_code = 'ME20260611083015');
SET @o2  = (SELECT id FROM orders WHERE order_code = 'ME20260610141122');
SET @o3  = (SELECT id FROM orders WHERE order_code = 'MA20260609091500');
SET @o4  = (SELECT id FROM orders WHERE order_code = 'ME20260608101010');
SET @o5  = (SELECT id FROM orders WHERE order_code = 'MA20260607154500');
SET @o6  = (SELECT id FROM orders WHERE order_code = 'ME20260606081200');
SET @o7  = (SELECT id FROM orders WHERE order_code = 'MA20260605103000');
SET @o8  = (SELECT id FROM orders WHERE order_code = 'ME20260604093045');
SET @o9  = (SELECT id FROM orders WHERE order_code = 'CK20260603140020');
SET @o10 = (SELECT id FROM orders WHERE order_code = 'MA20260602111530');
SET @o11 = (SELECT id FROM orders WHERE order_code = 'ME20260601164510');
SET @o12 = (SELECT id FROM orders WHERE order_code = 'MA20260528092230');
SET @o13 = (SELECT id FROM orders WHERE order_code = 'CK20260525133040');
SET @o14 = (SELECT id FROM orders WHERE order_code = 'ME20260512080910');
SET @o16 = (SELECT id FROM orders WHERE order_code = 'MA20260604160820');
SET @o17 = (SELECT id FROM orders WHERE order_code = 'MA20260528101500');

-- ---------------------------------------------------------------------------
-- Order items
-- ---------------------------------------------------------------------------

INSERT INTO order_items (order_id, product_type_id, sku, qty, price_sale, variants, personalization, hscode, hs_name, hs_price, status) VALUES
(@o1, @pt_hdi, 'EHD01021', 1, 42.90, JSON_OBJECT('size','M','color','Sand','stream_option','Left Sleeve'),
 'Chest: Mama | Left Sleeve: Liam, Emma', '6110.20', 'Cotton hooded sweatshirt', 12.00, 'pending'),
(@o2, @pt_hdi, 'EHD01038', 1, 39.50, JSON_OBJECT('size','L','color','Black'),
 NULL, '6110.20', 'Cotton hooded sweatshirt', 12.00, 'pending');

-- Đơn 3: 2 items (couple set) — đang thiết kế
INSERT INTO order_items (order_id, product_type_id, sku, qty, price_sale, variants, personalization, hscode, hs_name, hs_price, status) VALUES
(@o3, @pt_sws, 'ESW06402', 1, 34.50, JSON_OBJECT('size','L','color','Black'),  'Chest: J ♥ K | 14.02.2025', '6110.20', 'Cotton sweatshirt', 10.00, 'in_progress'),
(@o3, @pt_sws, 'ESW06402', 1, 34.50, JSON_OBJECT('size','S','color','Maroon'), 'Chest: K ♥ J | 14.02.2025', '6110.20', 'Cotton sweatshirt', 10.00, 'in_progress');

INSERT INTO order_items (order_id, product_type_id, sku, qty, price_sale, design_cost, variants, personalization, hscode, hs_name, hs_price, status) VALUES
(@o4, @pt_sws, 'ESW06349', 1, 36.00, 1.50, JSON_OBJECT('size','XL','color','Ash Grey'),
 'Chest: Grandma | Names: Oliver, Amelia, George', '6110.20', 'Cotton sweatshirt', 10.00, 'in_progress'),
(@o5, @pt_tsh, 'ETS02115', 1, 24.90, 0.80, JSON_OBJECT('size','M','color','Black'),
 'Chest: Cat Dad — Whiskers', '6109.10', 'Cotton t-shirt', 6.00, 'done');

-- Đơn 6: đã đẩy xưởng, phôi đã xuất, chờ lên máy
INSERT INTO order_items (order_id, product_type_id, sku, qty, price_sale, sup_cost, design_cost, variants, personalization,
  hscode, hs_name, hs_price, inventory_item_id, status) VALUES
(@o6, @pt_hdi, 'EHD01021', 1, 42.90, 3.80, 1.50, JSON_OBJECT('size','L','color','Sand','stream_option','Left Sleeve'),
 'Chest: Mama | Left Sleeve: Mateo', '6110.20', 'Cotton hooded sweatshirt', 12.00,
 (SELECT id FROM inventory_items WHERE qrcode = 'CH-HDISNDL-0001'), 'pending');

-- Đơn 7: đang chạy máy 01, thợ Cường đứng máy
INSERT INTO order_items (order_id, product_type_id, sku, qty, price_sale, sup_cost, design_cost, variants, personalization,
  hscode, hs_name, hs_price, machine_id, operator_id, production_started_at, inventory_item_id, status) VALUES
(@o7, @pt_sws, 'ESW06402', 1, 34.50, 3.20, 1.20, JSON_OBJECT('size','M','color','Ash Grey'),
 'Chest: A ♥ T — 20.10.2024', '6110.20', 'Cotton sweatshirt', 10.00,
 @mc1, @u_cuong, '2026-06-10 08:15:00', (SELECT id FROM inventory_items WHERE qrcode = 'CH-SWSASHM-0001'), 'in_progress');

-- Đơn 8: lỗi design — xưởng trả lại
INSERT INTO order_items (order_id, product_type_id, sku, qty, price_sale, variants, personalization,
  hscode, hs_name, hs_price, error_reason, error_at, status) VALUES
(@o8, @pt_hdi, 'EHD01038', 1, 39.50, JSON_OBJECT('size','M','color','Black'),
 'Chest: Dog Mom — Bella', '6110.20', 'Cotton hooded sweatshirt', 12.00,
 'File DST thiếu màu chỉ thứ 3 (script outline) — máy báo dừng giữa chừng', 'designer', 'redo');

-- Đơn 9: SX xong chờ hậu kì
INSERT INTO order_items (order_id, product_type_id, sku, qty, price_sale, sup_cost, design_cost, variants, personalization,
  hscode, hs_name, hs_price, machine_id, operator_id, production_started_at, production_finished_at, status) VALUES
(@o9, @pt_bbn, 'EBB00871', 1, 28.00, 2.50, 2.00, JSON_OBJECT('font','Script'),
 'Name: Olivia | blush/sage/cream', '6307.90', 'Textile decoration banner', 8.00,
 @mc2, @u_nam, '2026-06-09 13:00:00', '2026-06-10 16:30:00', 'done');

-- Đơn 10: đang hậu kì
INSERT INTO order_items (order_id, product_type_id, sku, qty, price_sale, sup_cost, variants, personalization,
  hscode, hs_name, hs_price, machine_id, operator_id, production_started_at, production_finished_at, status) VALUES
(@o10, @pt_bne, 'EBN00214', 1, 19.90, 1.80, JSON_OBJECT('color','Black'),
 'Front: Mama', '6505.00', 'Knitted hat', 5.00,
 @mc2, @u_nam, '2026-06-08 09:00:00', '2026-06-08 11:30:00', 'in_finishing');

-- Đơn 11: QC đạt (có ảnh QC)
INSERT INTO order_items (order_id, product_type_id, sku, qty, price_sale, sup_cost, design_cost, variants, personalization,
  hscode, hs_name, hs_price, machine_id, operator_id, production_started_at, production_finished_at, image_qc, inventory_item_id, status) VALUES
(@o11, @pt_sws, 'ESW06349', 1, 36.00, 3.20, 1.50, JSON_OBJECT('size','M','color','Ash Grey'),
 'Chest: Nana | Names: Ava, Noah', '6110.20', 'Cotton sweatshirt', 10.00,
 @mc1, @u_cuong, '2026-06-08 13:00:00', '2026-06-09 10:00:00', 1,
 (SELECT id FROM inventory_items WHERE qrcode = 'CH-SWSASHM-0002'), 'qc_passed');

-- Đơn 12 + 17 (gộp): đã ship
INSERT INTO order_items (order_id, product_type_id, sku, qty, price_sale, sup_cost, design_cost, variants, personalization,
  hscode, hs_name, hs_price, machine_id, operator_id, production_started_at, production_finished_at, image_qc, status) VALUES
(@o12, @pt_sws, 'ESW06402', 1, 34.50, 3.20, 1.20, JSON_OBJECT('size','L','color','Black'),
 'Chest: D ♥ S — 07.07.2023', '6110.20', 'Cotton sweatshirt', 10.00,
 @mc1, @u_cuong, '2026-06-02 08:00:00', '2026-06-03 15:00:00', 1, 'qc_passed'),
(@o17, @pt_tsh, 'GIFT-BAG', 1, 0.00, 0.50, NULL, NULL, NULL, NULL, NULL, NULL,
 NULL, NULL, NULL, NULL, 0, 'qc_passed');

-- Đơn 13: in_transit
INSERT INTO order_items (order_id, product_type_id, sku, qty, price_sale, sup_cost, design_cost, variants, personalization,
  hscode, hs_name, hs_price, machine_id, operator_id, production_started_at, production_finished_at, image_qc, status) VALUES
(@o13, @pt_bbn, 'EBB00871', 1, 28.00, 2.50, 2.00, JSON_OBJECT('font','Serif'),
 'Name: Theodore | navy/cream', '6307.90', 'Textile decoration banner', 8.00,
 @mc2, @u_nam, '2026-05-29 09:00:00', '2026-05-31 16:00:00', 1, 'qc_passed');

-- Đơn 14: complete, qty=2 (không gắn inventory_item_id — tra qua inventory_out)
INSERT INTO order_items (order_id, product_type_id, sku, qty, price_sale, sup_cost, design_cost, variants, personalization,
  hscode, hs_name, hs_price, machine_id, operator_id, production_started_at, production_finished_at, image_qc, status) VALUES
(@o14, @pt_hdi, 'EHD01021', 2, 42.90, 3.80, 1.50, JSON_OBJECT('size','M','color','Black','stream_option','Left Sleeve'),
 'Chest: Mama | Sleeves: Lucas, Mia', '6110.20', 'Cotton hooded sweatshirt', 12.00,
 @mc1, @u_cuong, '2026-05-15 08:00:00', '2026-05-17 14:00:00', 1, 'qc_passed');

-- Đơn 15: cancelled (item giữ pending)
INSERT INTO order_items (order_id, product_type_id, sku, qty, price_sale, variants, personalization, status) VALUES
((SELECT id FROM orders WHERE order_code = 'MA20260607190005'), @pt_tsh, 'ETS02115', 1, 24.90,
 JSON_OBJECT('size','XL','color','White'), 'Chest: Cat Dad — Milo', 'pending');

-- Đơn 16: external fulfill — 2 beanies
INSERT INTO order_items (order_id, product_type_id, sku, qty, price_sale, sup_cost, variants, personalization,
  hscode, hs_name, hs_price, status) VALUES
(@o16, @pt_bne, 'EBN00214', 1, 19.90, 4.50, JSON_OBJECT('color','Black'), 'Front: Mama', '6505.00', 'Knitted hat', 5.00, 'in_progress'),
(@o16, @pt_bne, 'EBN00214', 1, 19.90, 4.50, JSON_OBJECT('color','White'), 'Front: Mini', '6505.00', 'Knitted hat', 5.00, 'in_progress');

SET @oi3a = (SELECT id FROM order_items WHERE order_id = @o3 ORDER BY id LIMIT 1);
SET @oi4  = (SELECT id FROM order_items WHERE order_id = @o4);
SET @oi5  = (SELECT id FROM order_items WHERE order_id = @o5);
SET @oi6  = (SELECT id FROM order_items WHERE order_id = @o6);
SET @oi7  = (SELECT id FROM order_items WHERE order_id = @o7);
SET @oi8  = (SELECT id FROM order_items WHERE order_id = @o8);
SET @oi9  = (SELECT id FROM order_items WHERE order_id = @o9);
SET @oi11 = (SELECT id FROM order_items WHERE order_id = @o11);
SET @oi12 = (SELECT id FROM order_items WHERE order_id = @o12);
SET @oi14 = (SELECT id FROM order_items WHERE order_id = @o14);
SET @oi16a = (SELECT id FROM order_items WHERE order_id = @o16 ORDER BY id LIMIT 1);
SET @oi16b = (SELECT id FROM order_items WHERE order_id = @o16 ORDER BY id DESC LIMIT 1);

-- ---------------------------------------------------------------------------
-- Design files & notes
-- ---------------------------------------------------------------------------

INSERT INTO order_item_design_files (order_item_id, position, file_type, file_path, uploaded_by, is_active, created_at) VALUES
(@oi4,  'Chest',       'emb', '/uploads/designs/2026/06/ESW06349-grandma-chest.emb',   @u_minh, 1, '2026-06-10 16:50:00'),
(@oi4,  'Chest',       'png', '/uploads/designs/2026/06/ESW06349-grandma-chest.png',   @u_minh, 1, '2026-06-10 16:51:00'),
(@oi5,  'Chest',       'dst', '/uploads/designs/2026/06/ETS02115-catdad-chest.dst',    @u_lan,  1, '2026-06-08 14:20:00'),
(@oi5,  'Chest',       'png', '/uploads/designs/2026/06/ETS02115-catdad-chest.png',    @u_lan,  1, '2026-06-08 14:21:00'),
(@oi6,  'Chest',       'emb', '/uploads/designs/2026/06/EHD01021-mama-chest.emb',      @u_minh, 1, '2026-06-07 11:00:00'),
(@oi6,  'Left Sleeve', 'emb', '/uploads/designs/2026/06/EHD01021-mateo-sleeve.emb',    @u_minh, 1, '2026-06-07 11:05:00'),
(@oi7,  'Chest',       'dst', '/uploads/designs/2026/06/ESW06402-AT-chest.dst',        @u_lan,  1, '2026-06-06 10:30:00'),
-- Đơn redo: file cũ bị vô hiệu, file mới active
(@oi8,  'Chest',       'dst', '/uploads/designs/2026/06/EHD01038-bella-chest-v1.dst',  @u_minh, 0, '2026-06-05 10:00:00'),
(@oi8,  'Chest',       'dst', '/uploads/designs/2026/06/EHD01038-bella-chest-v2.dst',  @u_minh, 1, '2026-06-10 09:30:00'),
(@oi9,  'Center',      'emb', '/uploads/designs/2026/06/EBB00871-olivia-center.emb',   @u_huong, 1, '2026-06-04 15:00:00'),
(@oi11, 'Chest',       'emb', '/uploads/designs/2026/06/ESW06349-nana-chest.emb',      @u_minh, 1, '2026-06-02 14:00:00'),
(@oi12, 'Chest',       'dst', '/uploads/designs/2026/05/ESW06402-DS-chest.dst',        @u_lan,  1, '2026-05-29 10:00:00'),
(@oi14, 'Chest',       'emb', '/uploads/designs/2026/05/EHD01021-mama-x2-chest.emb',   @u_minh, 1, '2026-05-13 11:00:00'),
(@oi14, 'Left Sleeve', 'emb', '/uploads/designs/2026/05/EHD01021-lucas-mia-sleeve.emb',@u_minh, 1, '2026-05-13 11:05:00'),
(@oi16a,'Front',       'pdf', '/uploads/designs/2026/06/EBN00214-mama-front.pdf',      @u_lan,  1, '2026-06-05 16:00:00'),
(@oi16b,'Front',       'pdf', '/uploads/designs/2026/06/EBN00214-mini-front.pdf',      @u_lan,  1, '2026-06-05 16:02:00');

INSERT INTO order_item_notes (order_item_id, note, images, created_by, created_at) VALUES
(@oi8, 'Máy dừng ở màu thứ 3 — file DST không có color stop cho outline. Trả designer xử lý.',
 JSON_ARRAY('/uploads/notes/2026/06/oi-bella-machine-stop.jpg'), @u_cuong, '2026-06-09 15:35:00'),
(@oi8, 'Đã export lại DST v2 đủ 3 color stops, nhờ xưởng chạy lại giúp.', NULL, @u_minh, '2026-06-10 09:32:00'),
(@oi3a, 'Khách nhắn thêm qua Etsy: muốn chữ J ♥ K màu đỏ đô thay vì trắng.', NULL, @u_thuy, '2026-06-10 08:50:00'),
(@oi9, 'Banner cần là hơi kỹ phần viền scallop trước khi đóng gói.', NULL, @u_nam, '2026-06-10 16:32:00');

-- ---------------------------------------------------------------------------
-- Xuất kho phôi cho các đơn đã/đang sản xuất
-- ---------------------------------------------------------------------------

INSERT INTO inventory_out (inventory_item_id, order_item_id, type, date, created_by) VALUES
((SELECT id FROM inventory_items WHERE qrcode = 'CH-HDISNDL-0001'), @oi6,  'order', '2026-06-08', @u_tuan),
((SELECT id FROM inventory_items WHERE qrcode = 'CH-SWSASHM-0001'), @oi7,  'order', '2026-06-07', @u_tuan),
((SELECT id FROM inventory_items WHERE qrcode = 'CH-SWSASHM-0002'), @oi11, 'order', '2026-06-03', @u_hoa),
-- Đơn 14 qty=2 → 2 phôi cùng order_item
((SELECT id FROM inventory_items WHERE qrcode = 'CH-HDIBLKM-0001'), @oi14, 'order', '2026-05-14', @u_tuan),
((SELECT id FROM inventory_items WHERE qrcode = 'CH-HDIBLKM-0002'), @oi14, 'order', '2026-05-14', @u_tuan),
-- Phôi lỗi trả về NCC
((SELECT id FROM inventory_items WHERE qrcode = 'CH-HDISNDL-0008'), NULL, 'return_error', '2026-05-15', @u_hoa);

-- Chỉ tiêu hao gắn đơn cụ thể
INSERT INTO thread_out (thread_lot_id, order_item_id, qty, date, created_by, note) VALUES
(@tl_black, @oi7,  0.5, '2026-06-10', @u_cuong, NULL),
(@tl_white, @oi11, 0.5, '2026-06-08', @u_cuong, NULL);

-- ---------------------------------------------------------------------------
-- Nhận hàng từ xưởng (external fulfill EGF — giao thiếu 1)
-- ---------------------------------------------------------------------------

INSERT INTO receive_sessions (order_id, supplier_id, received_date, shipping_fee, received_by, note, created_at) VALUES
(@o16, @sup_egf, '2026-06-11', 120000, @u_mai, 'EGF giao đợt 1 — thiếu beanie trắng (Mini), hẹn bổ sung 15/06', '2026-06-11 14:00:00');

SET @rs1 = (SELECT id FROM receive_sessions WHERE order_id = @o16);

INSERT INTO receive_order_logs (session_id, order_id, order_item_id, sent_qty, received_qty, note, created_at) VALUES
(@rs1, @o16, @oi16a, 1, 1, NULL, '2026-06-11 14:05:00'),
(@rs1, @o16, @oi16b, 1, 0, 'Thiếu — EGF xác nhận gửi bù đợt 2', '2026-06-11 14:06:00');

-- ---------------------------------------------------------------------------
-- Đóng gói & Auto label
-- ---------------------------------------------------------------------------

INSERT INTO order_packages (order_id, tracking_number, carrier, weight, note, created_at) VALUES
(@o12, '9400111899560012345671', 'USPS', 540.00, 'Gộp kèm túi canvas đơn MA20260528101500', '2026-06-06 09:00:00'),
(@o13, '9400111899560012398765', 'USPS', 310.00, NULL, '2026-06-02 09:30:00'),
(@o14, '9400111899560011223344', 'USPS', 1160.00, '2 hoodie chung 1 kiện', '2026-05-20 08:30:00');

SET @pkg12 = (SELECT id FROM order_packages WHERE order_id = @o12);
SET @pkg13 = (SELECT id FROM order_packages WHERE order_id = @o13);
SET @pkg14 = (SELECT id FROM order_packages WHERE order_id = @o14);

INSERT INTO auto_labels (order_id, package_id, carrier, service, tracking_number, label_url, status, created_by, created_at) VALUES
(@o12, @pkg12, 'USPS', 'First-Class Package International', '9400111899560012345671', '/uploads/labels/2026/06/MA20260528092230.pdf', 'printed',   @u_tuan, '2026-06-06 08:45:00'),
(@o13, @pkg13, 'USPS', 'First-Class Package International', '9400111899560012398765', '/uploads/labels/2026/06/CK20260525133040.pdf', 'printed',   @u_tuan, '2026-06-02 09:15:00'),
(@o14, @pkg14, 'USPS', 'Priority Mail International',       '9400111899560011223344', '/uploads/labels/2026/05/ME20260512080910.pdf', 'printed',   @u_hoa,  '2026-05-20 08:15:00'),
(@o11, NULL,   'USPS', 'First-Class Package International', NULL, NULL, 'pending', @u_tuan, '2026-06-11 10:30:00');

-- ---------------------------------------------------------------------------
-- Đề nghị thanh toán — đủ trạng thái
-- ---------------------------------------------------------------------------

-- 1) Đã thanh toán: mua phôi tháng 5 (Dệt may Phương Nam)
INSERT INTO payment_requests (serial_number, supplier_id, payment_group, content, total_amount, currency, status, created_by, due_date, paid_date, created_at) VALUES
('20260501', @sup_phuongnam, 'material', 'Thanh toán phôi hoodie/sweatshirt theo lot tháng 5', 5150000, 'VND', 'paid', @u_tuan, '2026-06-02', '2026-05-30', '2026-05-03 10:00:00');

SET @pr1 = (SELECT id FROM payment_requests WHERE serial_number = '20260501');

INSERT INTO payment_request_items (payment_request_id, description, qty, unit, unit_price, total, reference_type, reference_id) VALUES
(@pr1, 'Phôi hoodie đen size M (LOT-2605-HDI-BLK-M)', 10, 'cái', 185000, 1850000, 'inventory_lot', @lot_hdi_blk),
(@pr1, 'Phôi hoodie sand size L (LOT-2605-HDI-SND-L)', 8, 'cái', 195000, 1560000, 'inventory_lot', @lot_hdi_snd),
(@pr1, 'Phôi sweatshirt ash grey size M (LOT-2605-SWS-ASH-M)', 12, 'cái', 145000, 1740000, 'inventory_lot', @lot_sws_ash);

INSERT INTO payment_request_approvers (payment_request_id, user_id, status, comment) VALUES
(@pr1, @u_thuy, 'accepted', 'OK, khớp phiếu nhập kho'),
(@pr1, @u_admin, 'accepted', NULL);

-- 2) Chờ duyệt: chỉ thêu (Chỉ thêu Tân Bình)
INSERT INTO payment_requests (serial_number, supplier_id, payment_group, content, total_amount, currency, status, created_by, due_date, created_at) VALUES
('20260601', @sup_tanbinh, 'thread', 'Thanh toán 2 lô chỉ màu blush/sage tháng 5', 1360000, 'VND', 'pending', @u_tuan, '2026-06-20', '2026-06-05 09:00:00');

SET @pr2 = (SELECT id FROM payment_requests WHERE serial_number = '20260601');

INSERT INTO payment_request_items (payment_request_id, description, qty, unit, unit_price, total, reference_type, reference_id) VALUES
(@pr2, 'Chỉ Polyester Blush MD-1147 (TL-2605-003)', 20, 'cuộn', 34000, 680000, 'thread_lot', (SELECT id FROM thread_lots WHERE lot_number = 'TL-2605-003')),
(@pr2, 'Chỉ Polyester Sage MD-1615 (TL-2605-004)',  20, 'cuộn', 34000, 680000, 'thread_lot', @tl_sage);

INSERT INTO payment_request_approvers (payment_request_id, user_id, status) VALUES
(@pr2, @u_thuy, 'pending'),
(@pr2, @u_admin, 'pending');

-- 3) Đã duyệt chờ chuyển tiền: fulfill EGF (USD)
INSERT INTO payment_requests (serial_number, supplier_id, payment_group, content, total_amount, currency, status, created_by, due_date, created_at) VALUES
('20260602', @sup_egf, 'external_fulfill', 'Fulfill 2 beanie đơn MA20260604160820 + ship nội địa TQ', 12.50, 'USD', 'accepted', @u_ngoc, '2026-06-21', '2026-06-06 11:00:00');

SET @pr3 = (SELECT id FROM payment_requests WHERE serial_number = '20260602');

INSERT INTO payment_request_items (payment_request_id, description, qty, unit, unit_price, total, reference_type, reference_id) VALUES
(@pr3, 'Beanie thêu Mama (đen) + Mini (trắng)', 2, 'cái', 4.50, 9.00, 'order', @o16),
(@pr3, 'Phí ship EGF → kho HN', 1, 'lần', 3.50, 3.50, 'order', @o16);

INSERT INTO payment_request_approvers (payment_request_id, user_id, status, comment) VALUES
(@pr3, @u_thuy, 'accepted', 'Duyệt — đối chiếu đơn EGF khớp'),
(@pr3, @u_admin, 'accepted', NULL);

-- 4) Bị từ chối: chi phí khác thiếu chứng từ
INSERT INTO payment_requests (serial_number, supplier_id, payment_group, content, total_amount, currency, status, created_by, due_date, created_at) VALUES
('20260603', NULL, 'other', 'Mua kéo cắt chỉ + kim thêu dự phòng', 450000, 'VND', 'rejected', @u_hoa, '2026-06-15', '2026-06-07 14:00:00');

SET @pr4 = (SELECT id FROM payment_requests WHERE serial_number = '20260603');

INSERT INTO payment_request_items (payment_request_id, description, qty, unit, unit_price, total) VALUES
(@pr4, 'Kéo cắt chỉ Nhật', 5, 'cái', 50000, 250000),
(@pr4, 'Kim thêu DBxK5 (hộp 100)', 2, 'hộp', 100000, 200000);

INSERT INTO payment_request_approvers (payment_request_id, user_id, status, comment) VALUES
(@pr4, @u_thuy, 'reject', 'Thiếu hóa đơn/báo giá đính kèm — bổ sung rồi tạo lại');

-- 5) Thanh toán một phần: phí ship USPS tháng 5
INSERT INTO payment_requests (serial_number, supplier_id, payment_group, content, total_amount, currency, status, created_by, due_date, created_at) VALUES
('20260604', NULL, 'shipping', 'Phí mua label USPS các đơn tháng 5 (đợt 1 đã chuyển 60%)', 4200000, 'VND', 'partial', @u_ngoc, '2026-06-14', '2026-06-08 10:00:00');

SET @pr5 = (SELECT id FROM payment_requests WHERE serial_number = '20260604');

INSERT INTO payment_request_items (payment_request_id, description, qty, unit, unit_price, total) VALUES
(@pr5, 'Label USPS quốc tế (28 đơn)', 28, 'label', 150000, 4200000);

INSERT INTO payment_request_approvers (payment_request_id, user_id, status, comment) VALUES
(@pr5, @u_thuy, 'accepted', 'Duyệt — chuyển trước 60%, phần còn lại sau đối soát');

INSERT INTO payment_request_files (payment_request_id, file_path, created_by, created_at) VALUES
(@pr1, '/uploads/payments/2026/05/20260501-hoa-don-phuong-nam.pdf', @u_tuan, '2026-05-03 10:05:00'),
(@pr3, '/uploads/payments/2026/06/20260602-invoice-egf.pdf',        @u_ngoc, '2026-06-06 11:05:00'),
(@pr5, '/uploads/payments/2026/06/20260604-bang-ke-usps.xlsx.pdf',  @u_ngoc, '2026-06-08 10:05:00');

-- ---------------------------------------------------------------------------
-- Activity logs (mẫu cho timeline)
-- ---------------------------------------------------------------------------

INSERT INTO activity_logs (entity_type, entity_id, user_id, activity, created_at) VALUES
('order', @o1,  NULL,    'Đồng bộ đơn mới từ Etsy (receipt #3401558821)', '2026-06-11 08:30:15'),
('order', @o2,  @u_thuy, 'Chuyển trạng thái new → need_confirm: khách chưa điền tên pet', '2026-06-10 16:00:00'),
('order', @o3,  @u_thuy, 'Giao designer Vũ Ngọc Lan', '2026-06-09 10:30:00'),
('order', @o4,  @u_minh, 'Upload file design vị trí Chest, chuyển pending_review', '2026-06-10 17:20:00'),
('order', @o5,  @u_huong,'Duyệt design — chuyển designed', '2026-06-09 09:00:00'),
('order', @o6,  @u_thuy, 'Đẩy đơn sang Xưởng Streamhub', '2026-06-08 08:30:00'),
('order_item', @oi7, @u_cuong, 'Bắt đầu chạy máy thêu 01', '2026-06-10 08:15:00'),
('order_item', @oi8, @u_cuong, 'Báo lỗi design: file DST thiếu color stop — trả designer', '2026-06-09 15:40:00'),
('order', @o8,  @u_cuong, 'Chuyển trạng thái producing → redo', '2026-06-09 15:40:00'),
('order', @o11, @u_mai,  'QC đạt — chờ xuất kho', '2026-06-11 10:20:00'),
('order', @o12, @u_tuan, 'Ship đơn — tracking 9400111899560012345671 (USPS)', '2026-06-06 09:30:00'),
('order', (SELECT id FROM orders WHERE order_code = 'MA20260607190005'), @u_thuy, 'Hủy đơn theo yêu cầu khách — đã refund Etsy', '2026-06-08 09:15:00'),
('inventory_lot', @lot_sws_ash, @u_tuan, 'Tạo lot LOT-2605-SWS-ASH-M, sinh 12 mã QR', '2026-05-10 09:00:00'),
('receive_session', @rs1, @u_mai, 'Nhận hàng EGF đợt 1: 1/2 — thiếu beanie trắng', '2026-06-11 14:00:00'),
('payment_request', @pr1, @u_ngoc, 'Đánh dấu đã thanh toán 30/05 (UNC kèm file)', '2026-05-30 15:00:00'),
('payment_request', @pr4, @u_thuy, 'Từ chối: thiếu hóa đơn/báo giá', '2026-06-08 09:00:00'),
('machine', (SELECT id FROM machines WHERE name = 'Máy thêu 04'), @u_nam, 'Đưa máy vào bảo trì định kỳ — thay dầu, căn chỉnh kim', '2026-06-09 07:30:00');

-- ---------------------------------------------------------------------------
-- Tài liệu nội bộ
-- ---------------------------------------------------------------------------

INSERT INTO documents (category, title, description, file_path, uploaded_by, created_at) VALUES
('system_guide', 'Hướng dẫn quy trình xử lý đơn Etsy A-Z', 'Từ sync đơn → design → sản xuất → QC → ship. Dành cho nhân sự mới.', '/uploads/docs/quy-trinh-don-etsy-v2.pdf', @u_thuy, '2026-03-15 10:00:00'),
('qc_doc', 'Checklist QC hàng thêu trước khi đóng gói', '12 điểm kiểm tra: mặt thêu, mặt trái, chỉ thừa, vết bẩn, size tag...', '/uploads/docs/checklist-qc-theu.pdf', @u_mai, '2026-04-02 14:00:00'),
('design_doc', 'Bộ font script chuẩn cho đơn personalized', 'Danh sách font đã digitize sẵn + khoảng cách chữ khuyến nghị theo size.', '/uploads/docs/font-script-library.pdf', @u_huong, '2026-04-20 09:00:00'),
('sales_case', 'Case study: xử lý khách yêu cầu refund sau khi đã ship', 'Mẫu trả lời Etsy message + chính sách hỗ trợ lại 50%.', '/uploads/docs/case-refund-sau-ship.pdf', @u_thuy, '2026-05-05 11:00:00'),
('listing_idea', 'Ý tưởng listing mùa tựu trường 2026', 'Backpack tag, hoodie tên lớp, banner first day of school.', '/uploads/docs/listing-back-to-school-2026.pdf', @u_lan, '2026-06-01 16:00:00');
