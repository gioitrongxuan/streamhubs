# Module: Documents — Tài liệu Nội bộ

## Tổng quan

Module lưu trữ và tra cứu tài liệu nội bộ của công ty, phân loại theo mục đích sử dụng.

## Màn hình chính (`/documents`)

### Phân loại tài liệu

| Danh mục | `category` | Mô tả |
|----------|------------|-------|
| Hướng dẫn hệ thống | `system_guide` | Tài liệu vận hành phần mềm |
| Ca bán hàng | `sales_case` | Case study, best practice bán hàng Etsy |
| Ý tưởng Listing | `listing_idea` | Ý tưởng sản phẩm mới, keyword research |
| Tài liệu thiết kế | `design_doc` | Hướng dẫn thiết kế, file mẫu |
| Tài liệu QC | `qc_doc` | Tiêu chuẩn chất lượng, checklist QC |

### Chức năng

- **Upload file:** Hỗ trợ PDF, Word, Excel, hình ảnh
- **Tìm kiếm:** Theo tên, danh mục, người upload
- **Xem online** (PDF preview)
- **Tải xuống**
- **Phân quyền xem:** Theo role (xem ma trận phân quyền)

### Giao diện

```
[Hướng dẫn hệ thống] [Ca bán hàng] [Ý tưởng Listing] [Tài liệu TK] [Tài liệu QC]

┌─────────────────────────────────────┐
│  [Upload file mới]                  │
│                                     │
│  📄 Hướng dẫn nhập kho.pdf          │
│     Uploaded: Nguyễn Văn A          │
│     2026-06-01  [Tải xuống]         │
│                                     │
│  📄 Checklist QC thêu.pdf           │
│     ...                             │
└─────────────────────────────────────┘
```

---

## API Endpoints

| Method | URL | Mô tả |
|--------|-----|-------|
| `GET` | `/documents` | Danh sách theo category |
| `POST` | `/documents` | Upload tài liệu mới |
| `GET` | `/documents/{id}` | Xem / tải xuống |
| `DELETE` | `/documents/{id}` | Xóa tài liệu |
