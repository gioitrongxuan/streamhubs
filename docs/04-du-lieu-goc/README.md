# Phase 4 — Dữ liệu Gốc (Master Data - MDM)

## Mục tiêu

Chuẩn hóa các danh mục cốt lõi của hệ thống trước khi đưa vào vận hành: Sản phẩm, Nhà cung cấp, Người dùng.

## Tài liệu trong phase này

| File | Nội dung |
|------|----------|
| [san-pham.md](san-pham.md) | Loại sản phẩm, cấp độ thiết kế, SKU |
| [nha-cung-cap.md](nha-cung-cap.md) | Nhà cung cấp, xưởng, đối tác fulfill |
| [nguoi-dung.md](nguoi-dung.md) | Người dùng hệ thống, cơ cấu shops |

## Nguyên tắc MDM

- Mọi dữ liệu gốc phải được thiết lập **trước** khi đưa module nghiệp vụ vào hoạt động
- Thay đổi MDM cần qua quy trình duyệt (Admin/Manager)
- Không xóa cứng (hard delete) — chỉ vô hiệu hóa (`is_active = 0`)
