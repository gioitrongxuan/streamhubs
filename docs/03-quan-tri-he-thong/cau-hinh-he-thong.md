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

### Cảnh báo thời gian

| Tham số | Giá trị mặc định | Mô tả |
|---------|-----------------|-------|
| `alert_design_overdue_days` | 2 | Số ngày chưa design → hiện cảnh báo |
| `alert_production_overdue_days` | 3 | Số ngày chưa SX xong → cảnh báo |
| `payment_due_warning_days` | 3 | Số ngày trước hạn TT → cảnh báo màu vàng |

### Phân trang

| Tham số | Giá trị mặc định |
|---------|-----------------|
| `order_per_page` | 50 |
| `stock_order_per_page` | 20 |
| `payment_per_page` | 25 |

---

## 3. Cấu hình Tiền tệ

Hệ thống hỗ trợ dual currency (USD + VND):

| Cấu hình | Mô tả |
|----------|-------|
| `default_currency` | VND (nội bộ), USD (Etsy orders) |
| `usd_vnd_rate` | Tỷ giá quy đổi (cập nhật thủ công hoặc API) |
| `display_format_vnd` | `1.234.567 ₫` |
| `display_format_usd` | `$123.45` |

---

## 4. Cấu hình QR Code

| Tham số | Mô tả |
|---------|-------|
| `qr_prefix` | Prefix mã QR (VD: `CH-`) |
| `qr_format` | `{PREFIX}{PRODUCT_TYPE_CODE}{SEQ}` |
| `qr_print_size` | Kích thước nhãn in (mm) |
| `camera_resolution` | Độ phân giải camera quét (HD/FHD) |

---

## 5. Cấu hình Số Seri Đề nghị Thanh toán

| Tham số | Mô tả |
|---------|-------|
| `seri_format` | `YYYYMM` + 4 chữ số sequence |
| `seri_reset_period` | Reset sequence theo tháng |

Ví dụ: `2026060021` = tháng 06/2026, sequence 0021

---

## 6. Cấu hình Email / Thông báo

| Sự kiện | Nhận thông báo |
|---------|---------------|
| Đề nghị TT mới tạo | Manager, Admin |
| Đề nghị TT quá hạn | Finance, Manager |
| Order overdue design | Manager, Admin |
| Tồn kho dưới ngưỡng | Warehouse Staff, Manager |

---

## 7. File Storage

| Loại file | Đường dẫn | Ghi chú |
|-----------|-----------|---------|
| Logo / ảnh hệ thống | `/files/image/` | |
| Avatar người dùng | `/files/image/user/` | Mặc định: `avatar-default_150x150.jpg` |
| File thiết kế (EMB/DST/PDF) | `/files/design/{order_id}/` | |
| File tài liệu nội bộ | `/files/documents/` | |
| File QR code | `/files/qrcode/` | |
