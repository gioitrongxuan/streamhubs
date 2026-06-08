# Module: Đề nghị Thanh toán

## Tổng quan

Module quản lý toàn bộ quy trình đề nghị thanh toán cho nhà cung cấp, từ lúc tạo → duyệt → thanh toán thực tế. Hỗ trợ dual currency (VND + USD).

## Màn hình chính

### 1. Dashboard + Danh sách (`/request-payment`)

**KPI Cards (kỳ thống kê — lọc theo date range):**

| Card | `status` filter | Hiển thị |
|------|----------------|----------|
| Tổng đề nghị | tất cả | Số lượng + Tổng VND + Tổng USD |
| Đã xác nhận | `accepted` | Số lượng + Tổng VND + Tổng USD |
| Chờ xác nhận | `pending` | Số lượng |
| Đã thanh toán | `paid` | Số lượng + Tổng VND + Tổng USD |
| Đã TT 1 phần | `partial` | Số lượng |
| Quá hạn | computed: `due_date < today AND status IN (pending, partial)` | Số lượng + Tổng VND + Tổng USD (badge đỏ) |

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

**Phân loại (`payment_group`) — mapping UI ↔ DB:**

| Hiển thị UI | `payment_group` |
|---|---|
| Phôi sản phẩm | `material` |
| Nguyên vật liệu thêu | `thread` |
| Phí vận chuyển | `shipping` |
| Design - File thêu | `design` |
| Fulfill ngoài | `external_fulfill` |
| Khác / Mua ngoài - Ship lẻ | `other` |

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

Giao diện 2 cột (8/4). Load bằng AJAX side panel khi click Seri Number, response format: `{stt: N, data: "HTML"}`.

**Cột trái (8/12):**

| Card | Nội dung |
|------|---------|
| Thông tin cơ bản | Ngày tạo, Hạn thanh toán, Người tạo, Phân loại, Nhà cung cấp, Seri — có nút edit |
| Nội dung | Mô tả chi tiết đề nghị |
| Phương thức thanh toán | Thông tin ngân hàng NCC: Chủ TK, Số TK, Ngân hàng |
| File đính kèm chính | 1 file chính (hóa đơn, PDF, ...) |
| Các file đính kèm phụ | Nhiều file bổ sung |

**Cột phải (4/12):**

| Card | Nội dung |
|------|---------|
| Tổng số tiền | Tổng thanh toán, hiển thị lớn |
| Người xác nhận | Danh sách approvers, mỗi người có dropdown status riêng |
| Logs | Timeline hoạt động (accordion) — đọc từ `activity_logs` WHERE `entity_type = 'payment_request'` |

**Cơ chế multi-approver:**
- Mỗi phiếu có thể có nhiều người duyệt (từ bảng `payment_request_approvers`)
- Mỗi approver tự đổi status của mình: `Chờ xác nhận` → `Đã xác nhận` hoặc `Từ chối`
- Trạng thái tổng của phiếu được tính từ tập hợp approver statuses

---

## Trạng thái & Màu sắc

| Trạng thái | Code | Màu | Ghi chú |
|------------|------|-----|---------|
| Chờ xác nhận | `pending` | Vàng (`bg-19`) | Trạng thái mặc định khi tạo |
| Đã xác nhận | `accepted` | Xanh dương | Manager/Admin đã duyệt |
| Đã TT 1 phần | `partial` | Cam | Thanh toán một phần, vẫn còn nợ |
| Đã thanh toán | `paid` | Xanh lá (`bg-23`) | Thanh toán đủ |
| Từ chối | `rejected` | Đỏ | Manager/Admin từ chối, cần chỉnh sửa |
| Quá hạn | *(computed)* | Đỏ đậm | `pending` hoặc `partial` AND `today > due_date` — tính toán tại query, không lưu DB |

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
status IN (pending, partial) AND today > due_date → Quá hạn N ngày (badge đỏ)
status IN (pending, partial) AND today = due_date - 1,2,3 → Sắp đến hạn (vàng)
```

> Lưu ý: `partial` (đã TT một phần) vẫn phải tính quá hạn vì còn dư nợ chưa thanh toán.

### Quy tắc Duyệt

- Chỉ Manager hoặc Admin mới có quyền **Xác nhận**
- Finance tạo được nhưng không tự duyệt
- Sau khi Xác nhận, Finance đánh dấu **Đã TT 1 phần** hoặc **Đã thanh toán**
- `partial` → vẫn còn nợ, có thể tiếp tục TT thêm đợt → chuyển sang `paid` khi đủ
- Không thể chỉnh sửa sau khi đã Xác nhận (chỉ Admin mới được mở lại)

### Quy tắc Multi-Approver

Khi phiếu có nhiều người duyệt (bảng `payment_request_approvers`):

- **Tổng trạng thái tính như sau:**
  - Có ít nhất 1 approver `reject` → phiếu tổng = `rejected`
  - Tất cả approver đều `accepted` → phiếu tổng = `accepted`
  - Còn lại (chưa ai duyệt, hoặc có người chưa duyệt) → phiếu tổng = `pending`
- Approver nào reject phải điền `comment` (lý do) — bắt buộc
- Admin có thể reset toàn bộ approver về `pending` để tạo lại vòng duyệt

---

## API Endpoints

| Method | URL | Mô tả |
|--------|-----|-------|
| `GET` | `/request-payment` | Danh sách + KPI |
| `GET` | `/request-payment/{id}` | Chi tiết |
| `POST` | `/request-payment` | Tạo mới |
| `PUT` | `/request-payment/{id}/partial` | Đánh dấu đã TT 1 phần |
| `PUT` | `/request-payment/{id}/paid` | Đánh dấu đã TT đủ |
| `POST` | `/request-payment/{id}/approver/status` | Approver tự đổi status của mình (`pending/accepted/reject`) — body: `{user_id, status}` |
| `GET` | `/request-payment/stats` | KPI dashboard |
