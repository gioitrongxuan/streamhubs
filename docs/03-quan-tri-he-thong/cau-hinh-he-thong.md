# Cấu hình Hệ thống

## 1. Cấu hình Shops Etsy

Mỗi shop Etsy được cấu hình riêng:

| Tham số | Mô tả |
|---------|-------|
| `etsy_shop_id` | ID shop trên Etsy |
| `etsy_api_key` | OAuth token (lưu encrypted) |
| `sync_interval` | Tần suất đồng bộ order (phút) |
| `default_designer_id` | Designer mặc định nhận order |
| `default_supplier_id` | Xưởng mặc định xử lý |

---

## 2. Cấu hình Vận hành

> Tất cả tham số dưới đây được lưu trong bảng `system_configs`. Xem mapping đầy đủ tại [database-schema.md — Bảng system_configs](../02-kien-truc-csdl/database-schema.md).

### Cảnh báo thời gian

| `key` trong DB | Giá trị mặc định | Mô tả |
|----------------|-----------------|-------|
| `alert_design_overdue_days` | `2` | Số ngày chưa Design → hiện cảnh báo (Orders) |
| `alert_production_overdue_days` | `3` | Số ngày chưa SX xong → cảnh báo (Orders) |
| `alert_shipping_overdue_days` | `4` | Số ngày chưa Ship → cảnh báo (Orders) |
| `alert_qc_unshipped_hours` | `24` | Số giờ QC đạt mà chưa ship → cảnh báo (Orders) |
| `alert_intransit_overdue_days` | `5` | Số ngày QC đạt mà chưa InTransit → cảnh báo (Orders) |
| `alert_stock_order_overdue_days` | `1` | Số ngày chưa SX xong tại Stock/Order → cảnh báo |
| `payment_due_warning_days` | `3` | Số ngày trước hạn TT → cảnh báo màu vàng |

### Phân trang

| `key` trong DB | Giá trị mặc định |
|----------------|-----------------|
| `order_per_page` | `50` |
| `stock_order_per_page` | `20` |
| `payment_per_page` | `25` |

---

## 3. Cấu hình Tiền tệ

Hệ thống hỗ trợ dual currency (USD + VND):

| `key` trong DB | Mô tả |
|----------------|-------|
| `default_currency` | VND (nội bộ), USD (Etsy orders) |
| `usd_vnd_rate` | Tỷ giá quy đổi (cập nhật thủ công) |

> Format hiển thị (`1.234.567 ₫`, `$123.45`) xử lý tại tầng frontend, không lưu trong `system_configs`.

---

## 4. Cấu hình QR Code

Hệ thống có 2 loại QR code với mục đích khác nhau:

| Loại | Dùng tại | Lưu ở |
|------|----------|-------|
| **Phôi QR** | `/in-out`, `/output-order` — nhập/xuất kho | `inventory_items.qrcode` |
| **Order QR từ sàn** | `/by-qrcode` — QC sau thêu | QR do Etsy/marketplace đính kèm, chứa order code |

| `key` trong DB | Mô tả |
|----------------|-------|
| `qr_prefix` | Prefix khi sinh mã QR phôi (VD: `CH-`) |
| `qr_print_size` | Kích thước nhãn in (mm) |

> `camera_resolution` là cấu hình hardware, không lưu trong `system_configs`.

---

## 5. Cấu hình Số Seri Đề nghị Thanh toán

| Tham số | Mô tả |
|---------|-------|
| `seri_format` | `YYYYMM` + 4 chữ số sequence |
| `seri_reset_period` | Reset sequence theo tháng |

Ví dụ: `2026060021` = tháng 06/2026, sequence 0021

---

## 6. Cấu hình Email / Thông báo

| Sự kiện | `key` trong DB | Nhận thông báo (mặc định) |
|---------|----------------|--------------------------|
| Đề nghị TT mới tạo | `notification_payment_new` | Manager, Admin |
| Đề nghị TT quá hạn | `notification_payment_overdue` | Finance, Manager |
| Order quá hạn chưa Design / SX / Ship | `notification_order_overdue` | Manager, Admin |
| Tồn kho dưới ngưỡng | `notification_stock_low` | Warehouse Staff, Manager |
| Order bị hủy (`cancelled`) | `notification_order_cancelled` | Manager, Admin |

> **Cơ chế thông báo** (in-app notification / email) chưa được thiết kế DB — cần bổ sung bảng `notifications` khi build feature này. `system_configs` chỉ lưu cấu hình *ai nhận*, không phải cơ chế gửi.

---

## 7. Ship HPW (Happy Parcel Way)

Nút **Ship HPW** trên màn hình Order Detail xử lý toàn bộ flow ship nhanh nội bộ (khác với `/auto-label` dùng carrier API bên ngoài).

> **Trạng thái:** Chưa có tài liệu chi tiết. Cần bổ sung spec riêng khi build feature này, bao gồm: API endpoint, DB fields, và quy trình vận hành.

---

## 7. File Storage

| Loại file | Đường dẫn | Ghi chú |
|-----------|-----------|---------|
| Logo / ảnh hệ thống | `/files/image/` | |
| Avatar người dùng | `/files/image/user/` | Mặc định: `avatar-default_150x150.jpg` |
| File thiết kế (EMB/DST/PDF) | `/files/design/{order_id}/` | |
| File tài liệu nội bộ | `/files/documents/` | |
| File QR code | `/files/qrcode/` | |
