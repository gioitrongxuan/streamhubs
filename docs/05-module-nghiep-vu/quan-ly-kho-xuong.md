# Module: Quản lý Kho Xưởng

## Tổng quan

Module quản lý toàn bộ hoạt động kho và sản xuất, bao gồm: kho phôi, QR code, máy thêu, chỉ, và quy trình hậu kì.

## Màn hình & Chức năng

### 1. Dashboard Supplier (`/dashboard-supplier`)

Tổng quan hoạt động xưởng:
- Trạng thái máy thêu (active/maintenance/idle)
- Biểu đồ sản lượng theo ngày/tuần
- Số order đang trong từng giai đoạn SX
- Cảnh báo: order quá hạn, chỉ sắp hết

---

### 2. Nhập kho Phôi (`/in-out`)

**Luồng:**
1. Chọn kệ đích từ dropdown (Kệ số 1, 2, 3, 51, ...)
2. Quét QR code phôi qua camera hoặc nhập thủ công
3. Hệ thống ghi bản ghi vào bảng `inventory_in` (lot_id, qty, shelf_id)
4. Cập nhật atomic: `inventory_lots.remaining_qty += qty` và `shelves.current_count += qty`

**Tabs:**
- **Nhập kho phôi** — phôi blank sản phẩm chính
- **Nhập kho sản phẩm khác** (`/admin/inventory/input-other`) — nguyên phụ liệu khác
- **Lịch sử nhập kho** (`/history-input`)
- **Lịch sử in phiếu** (`/history-print`)

---

### 3. Xuất kho (`/output-order`)

Xuất phôi cho lệnh sản xuất:
1. Căn cứ vào lệnh SX (`stock/order`)
2. Quét QR code phôi cần xuất
3. Hệ thống ghi bản ghi vào bảng `inventory_out` (lot_id, order_item_id, type='order', qty)
4. Cập nhật atomic: `inventory_lots.remaining_qty -= qty` và `shelves.current_count -= qty`

---

### 4. Tồn kho (`/inventory`)

Báo cáo tồn kho theo thời gian thực:
- Lọc theo: SKU, loại sản phẩm, kệ
- Hiển thị: số lượng trên từng kệ
- Cảnh báo khi tồn kho dưới ngưỡng tối thiểu

---

### 5. Orders Xưởng — Lệnh Sản xuất (`/stock/order`)

Danh sách các order đã đẩy sang xưởng:

**Lọc:**

| Filter | Mô tả |
|--------|-------|
| Date | Ngày đẩy xưởng |
| Status | Chưa SX / Đã xuất kho |
| Order ID | Tìm theo ID |
| SKU | Tìm theo mã |
| Loại sản phẩm | Dropdown |
| Xưởng | Dropdown supplier |
| Checkbox | "Sản xuất xong", "Làm gấp" |

**Cột bảng:**

| Cột | Mô tả |
|-----|-------|
| OrderID | Kèm sub-ID item |
| SKU | Mã sản phẩm |
| QTY | Số lượng |
| Image | Thumbnail sản phẩm |
| Variants | Size/Color/Style + Personalization |
| Ngày order | Ngày tạo trên Etsy |
| Ngày đẩy xưởng | Ngày đưa vào SX |
| Country | Quốc gia khách hàng |
| Trạng thái | Dropdown đổi trạng thái SX |

**Action per item:**
- In Lệnh sản xuất (PDF)
- File EMB / DST / PDF (download)
- Ghi chú Design lỗi

**Cảnh báo:** `N order quá 1 ngày chưa SX xong`

---

### 6. Nhận hàng từ Xưởng (`/receive-order`)

Ghi nhận hàng thêu được xưởng gửi về kho. Mỗi lần nhận = 1 bản ghi `receive_order_logs`.

**Giao diện:**
- Trang chính: **"Quét mã đơn"** — scan QR hoặc nhập Order ID để tìm đơn cần nhận
- Nút **"+ Add thông tin đơn hàng đã nhận"** → mở modal

**Modal "Add thông tin đơn hàng":**

| Trường | Ghi chú |
|--------|---------|
| Gửi từ xưởng | Dropdown chọn `suppliers` (xưởng thêu gửi về) |
| Ngày nhận | Date picker, mặc định hôm nay |
| Phí ship | Chi phí vận chuyển từ xưởng về kho (VND) |
| Số lượng gửi | Số lượng xưởng báo đã gửi |
| Số lượng nhận | Số lượng thực nhận được — ghi chú nếu lệch |

**Luồng:**
1. Scan QR hoặc nhập Order ID
2. Điền modal → Submit → ghi `receive_order_logs`
3. Hệ thống chuyển `orders.status → in_finishing`
4. Nếu `received_qty < sent_qty`: ghi note sai lệch, cần follow-up với xưởng

**Ghi DB:** `receive_order_logs` (order_id, supplier_id, received_date, shipping_fee, sent_qty, received_qty, received_by)

---

### 7. Tạo QR Code (`/gen-qrcode`)

Tạo mã QR cho phôi mới nhập kho:
- Chọn loại sản phẩm + SKU
- Nhập số lượng cần tạo QR
- Hệ thống sinh QR theo format: `{PREFIX}{PRODUCT_CODE}{SEQ}`
- In nhãn QR (kết nối máy in nhãn)

---

### 8. QC Order (`/by-qrcode`)

Kiểm tra chất lượng sản phẩm sau hậu kì:
- Quét QR trên sản phẩm
- Hệ thống hiển thị thông tin order + yêu cầu cá nhân hóa
- Staff xác nhận: đúng / lỗi
- Nếu lỗi: ghi chú và chuyển sang `errors`

---

### 9. Scan Tracking (`/scan-track`)

Quét tracking number khi bàn giao cho vận chuyển:
- Quét tracking từ nhãn vận chuyển
- Gắn tracking vào order
- Tự động cập nhật status → `shipped`
- Đồng bộ tracking lên Etsy

---

### 10. Quản lý Chỉ Thêu (`/emb-thread`)

Quản lý kho chỉ thêu:
- Danh sách chỉ theo màu (color code + tên màu)
- Số lượng tồn, đơn vị (cuộn/mét)
- Nhập thêm / ghi xuất dùng
- Cảnh báo khi dưới ngưỡng tối thiểu (`min_threshold`)

---

### 11. Quản lý Kệ hàng (`/shelf`)

- Danh sách kệ, vị trí, sức chứa
- Tình trạng từng kệ: đang chứa bao nhiêu, còn trống bao nhiêu
- Sơ đồ kho (nếu có)

---

### 12. Quản lý Máy thêu (`/machine`)

- Danh sách máy: tên, model, số đầu thêu
- Trạng thái: active / maintenance / idle
- Phân công máy cho lệnh sản xuất
- Lịch bảo trì

---

### 13. Hậu kì (`/export-hk`)

Quản lý công đoạn hoàn thiện sản phẩm sau thêu:
- Nhận hàng từ Tổ Sản xuất (quét QR chuyển giao)
- Thực hiện: cắt chỉ → kiểm tra → ủi → đóng gói
- Xác nhận hoàn thành từng item
- Chuyển sang khu vực xuất kho

---

### 14. Đơn lỗi (`/errors`)

Theo dõi và xử lý các order có vấn đề:
- Lỗi thiết kế (Designer ghi chú)
- Lỗi sản xuất (chỉ sai màu, kích thước sai, ...)
- Phân công xử lý lại
- Theo dõi tiến độ fix

---

## API Endpoints Chính

| Method | URL | Mô tả |
|--------|-----|-------|
| `POST` | `/inventory/scan-in` | Nhập kho bằng QR |
| `POST` | `/inventory/scan-out` | Xuất kho bằng QR |
| `GET` | `/inventory` | Báo cáo tồn kho |
| `GET` | `/stock/order` | Danh sách lệnh SX |
| `PUT` | `/stock/order/{id}/status` | Cập nhật trạng thái SX |
| `POST` | `/gen-qrcode` | Tạo QR hàng loạt |
| `POST` | `/by-qrcode/verify` | QC xác nhận |
| `POST` | `/scan-track` | Gắn tracking |
