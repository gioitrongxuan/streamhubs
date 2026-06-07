# Module: Đề nghị Thanh toán

## Tổng quan

Module quản lý toàn bộ quy trình đề nghị thanh toán cho nhà cung cấp, từ lúc tạo → duyệt → thanh toán thực tế. Hỗ trợ dual currency (VND + USD).

## Màn hình chính

### 1. Dashboard + Danh sách (`/request-payment`)

**KPI Cards (kỳ thống kê):**

| KPI | Mô tả |
|-----|-------|
| Tổng đề nghị | Số lượng + Tổng tiền trong kỳ |
| Đã xác nhận | Số lượng + Tổng tiền đã approve |
| (mở rộng) | Đã thanh toán, Chờ xác nhận |

**Biểu đồ donut:** Phân bố trạng thái (Chờ xác nhận / Đã xác nhận / Đã thanh toán)

**Panel "Sắp đến hạn thanh toán":** Danh sách đề nghị gần đến hạn, hiển thị:
- Mã seri + Người tạo
- Số tiền + Ngày hạn
- Badge cảnh báo: `Quá Xn` (số ngày quá hạn)

**Bảng danh sách:**

| Cột | Mô tả |
|-----|-------|
| STT | Số thứ tự |
| Seri Number | Link đến chi tiết (VD: 2026060021) |
| Người tạo | |
| Người xác nhận | |
| Nhà cung cấp | |
| Phân loại | Fulfill ngoài / Phôi / Chỉ / Khác |
| Tổng số tiền | Hiển thị theo currency |
| Ngày tạo | |
| Ngày hết hạn | |
| Trạng thái | Badge có màu |

**Lọc:**
- Khoảng thời gian tạo
- Nhà cung cấp
- Phân loại (`payment_group`)
- Trạng thái
- Seri Number
- Keyword

---

### 2. Tạo Đề nghị Thanh toán (`/add-request-payment`)

Form tạo mới với các thành phần:

**Thông tin chung:**
- Nhà cung cấp (chọn từ danh sách — kéo tự động thông tin tài khoản)
- Phân loại thanh toán
- Ngày hết hạn
- Nội dung mô tả tổng quát

**Bảng chi tiết (items):**
- Mô tả dịch vụ/hàng hóa
- Số lượng + Đơn vị tính
- Đơn giá + Thành tiền (tự tính)
- Reference ID (order hoặc lệnh kho liên quan)
- Thêm/xóa dòng động

**Tổng cộng:** Tự động tính từ các dòng chi tiết

**Upload file đính kèm:** Hóa đơn, phiếu giao hàng, ...

---

### 3. Chi tiết & Duyệt (`/request-payment/{id}`)

- Xem toàn bộ thông tin đề nghị
- Timeline duyệt: Tạo → Xác nhận → Thanh toán
- Button **Xác nhận** (Manager/Admin)
- Button **Đánh dấu Đã thanh toán** (Finance)
- Button **Từ chối** + ghi lý do (Manager/Admin)

---

## Trạng thái & Màu sắc

| Trạng thái | Code | Màu |
|------------|------|-----|
| Chờ xác nhận | `pending` | Vàng (`bg-19`) |
| Đã xác nhận | `accepted` | Xanh dương |
| Đã thanh toán | `paid` | Xanh lá (`bg-23`) |
| Từ chối | `rejected` | Đỏ |

---

## Logic Nghiệp vụ

### Số Seri

Format: `YYYYMM` + 4 chữ số tự tăng, reset mỗi tháng.

```
2026060001  ← đề nghị đầu tiên tháng 6/2026
2026060002  ← đề nghị thứ hai
...
2026070001  ← tháng 7/2026 reset lại
```

### Cảnh báo Quá hạn

Hệ thống tính số ngày so với `due_date`:

```
status = pending AND today > due_date → Quá hạn N ngày (badge đỏ)
status = pending AND today = due_date - 1,2,3 → Sắp đến hạn (vàng)
```

### Quy tắc Duyệt

- Chỉ Manager hoặc Admin mới có quyền **Xác nhận**
- Finance tạo được nhưng không tự duyệt
- Sau khi Xác nhận, Finance đánh dấu **Đã thanh toán**
- Không thể chỉnh sửa sau khi đã Xác nhận (chỉ Admin mới được mở lại)

---

## API Endpoints

| Method | URL | Mô tả |
|--------|-----|-------|
| `GET` | `/request-payment` | Danh sách + KPI |
| `GET` | `/request-payment/{id}` | Chi tiết |
| `POST` | `/request-payment` | Tạo mới |
| `PUT` | `/request-payment/{id}/confirm` | Xác nhận |
| `PUT` | `/request-payment/{id}/paid` | Đánh dấu đã TT |
| `PUT` | `/request-payment/{id}/reject` | Từ chối |
| `GET` | `/request-payment/stats` | KPI dashboard |
