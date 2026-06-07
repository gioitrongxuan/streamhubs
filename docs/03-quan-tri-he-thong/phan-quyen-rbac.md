# Phân quyền Người dùng (RBAC)

## Các Vai trò (Roles)

| Role ID | Tên Role | Mô tả |
|---------|----------|-------|
| `admin` | Admin | Quản trị toàn bộ hệ thống |
| `manager` | Manager | Quản lý vận hành, phê duyệt |
| `designer` | Designer | Xử lý thiết kế order |
| `warehouse` | Warehouse Staff | Quản lý kho, QR, xuất nhập |
| `production` | Production Staff | Nhận và cập nhật lệnh sản xuất |
| `finance` | Finance / Kế toán | Tạo và duyệt đề nghị thanh toán |

---

## Ma trận Phân quyền

### Module: Orders

| Chức năng | Admin | Manager | Designer | Warehouse | Production | Finance |
|-----------|:-----:|:-------:|:--------:|:---------:|:----------:|:-------:|
| Xem danh sách order | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tạo order thủ công | ✅ | ✅ | — | — | — | — |
| Chỉnh sửa order | ✅ | ✅ | ✅ (đang design) | — | — | — |
| Upload file thiết kế | ✅ | ✅ | ✅ | — | — | — |
| Đẩy xưởng | ✅ | ✅ | — | — | — | — |
| Export CSV | ✅ | ✅ | ✅ | ✅ | — | — |
| Xóa order | ✅ | — | — | — | — | — |

### Module: Kho xưởng

| Chức năng | Admin | Manager | Designer | Warehouse | Production | Finance |
|-----------|:-----:|:-------:|:--------:|:---------:|:----------:|:-------:|
| Nhập kho phôi | ✅ | ✅ | — | ✅ | — | — |
| Xuất kho | ✅ | ✅ | — | ✅ | — | — |
| Xem tồn kho | ✅ | ✅ | — | ✅ | ✅ | — |
| Quản lý kệ | ✅ | ✅ | — | ✅ | — | — |
| Tạo QR Code | ✅ | ✅ | — | ✅ | — | — |
| Quét QR (by-qrcode) | ✅ | — | — | ✅ | ✅ | — |
| Quét tracking | ✅ | — | — | ✅ | — | — |
| Xem lệnh SX | ✅ | ✅ | — | ✅ | ✅ | — |
| Cập nhật trạng thái SX | ✅ | ✅ | — | — | ✅ | — |
| Quản lý chỉ thêu | ✅ | ✅ | — | ✅ | — | — |
| Quản lý máy thêu | ✅ | ✅ | — | — | ✅ | — |
| Dashboard supplier | ✅ | ✅ | — | ✅ | ✅ | — |

### Module: Đề nghị Thanh toán

| Chức năng | Admin | Manager | Designer | Warehouse | Production | Finance |
|-----------|:-----:|:-------:|:--------:|:---------:|:----------:|:-------:|
| Tạo đề nghị TT | ✅ | ✅ | — | — | — | ✅ |
| Xem danh sách | ✅ | ✅ | — | — | — | ✅ |
| Xác nhận (approve) | ✅ | ✅ | — | — | — | — |
| Đánh dấu đã thanh toán | ✅ | ✅ | — | — | — | ✅ |
| Xóa / hủy | ✅ | — | — | — | — | — |

### Module: Sản phẩm & MDM

| Chức năng | Admin | Manager | Designer | Warehouse | Production | Finance |
|-----------|:-----:|:-------:|:--------:|:---------:|:----------:|:-------:|
| Quản lý loại SP | ✅ | ✅ | — | — | — | — |
| Quản lý cấp độ TK | ✅ | ✅ | ✅ | — | — | — |
| Quản lý nhà cung cấp | ✅ | ✅ | — | — | — | ✅ |
| Xem danh sách SP | ✅ | ✅ | ✅ | ✅ | ✅ | — |

### Module: Hệ thống

| Chức năng | Admin | Manager | Designer | Warehouse | Production | Finance |
|-----------|:-----:|:-------:|:--------:|:---------:|:----------:|:-------:|
| Quản lý người dùng | ✅ | — | — | — | — | — |
| Cấu hình hệ thống | ✅ | — | — | — | — | — |
| Quản lý shops Etsy | ✅ | ✅ | — | — | — | — |
| Xem Documents | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload Documents | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Auto Label | ✅ | ✅ | — | ✅ | — | — |

---

## Sơ đồ Phân quyền theo Luồng

```mermaid
flowchart LR
    subgraph Orders["Luồng Order"]
        O1[Tạo Order] -->|Admin/Manager| O2[Giao Designer]
        O2 -->|Designer| O3[Upload Design]
        O3 -->|Admin/Manager| O4[Đẩy xưởng]
    end

    subgraph Warehouse["Luồng Kho"]
        W1[Nhập kho] -->|Warehouse| W2[Tồn kho]
        W2 -->|Warehouse| W3[Xuất cho SX]
        W3 -->|Production| W4[Cập nhật SX]
        W4 -->|Warehouse| W5[Xuất vận chuyển]
    end

    subgraph Finance["Luồng Tài chính"]
        F1[Tạo ĐNTT] -->|Finance| F2[Chờ duyệt]
        F2 -->|Manager/Admin| F3[Đã xác nhận]
        F3 -->|Finance| F4[Đã thanh toán]
    end
```

---

## Cấu trúc Permissions JSON

Ví dụ cấu trúc permissions cho role `designer`:

```json
{
  "orders": {
    "view": true,
    "create": false,
    "edit": "own",
    "delete": false,
    "upload_design": true,
    "push_factory": false,
    "export": true
  },
  "products": {
    "view": true,
    "manage": false
  },
  "warehouse": false,
  "payment": false,
  "admin": false
}
```
