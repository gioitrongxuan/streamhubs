# Tài liệu Thiết kế Hệ thống — StreamHub

StreamHub là hệ thống quản lý vận hành tích hợp (ERP lite) cho doanh nghiệp bán hàng cá nhân hóa trên Etsy, bao gồm quy trình từ nhận đơn hàng → thiết kế → sản xuất thêu → kiểm hàng → xuất kho → thanh toán nhà cung cấp.

---

## Trình tự Thiết kế

| # | Giai đoạn | File tài liệu |
|---|-----------|---------------|
| 1 | **Phân tích Quy trình** | [01-phan-tich-quy-trinh/](01-phan-tich-quy-trinh/README.md) |
| 2 | **Kiến trúc & CSDL** | [02-kien-truc-csdl/](02-kien-truc-csdl/README.md) |
| 3 | **Quản trị Hệ thống** | [03-quan-tri-he-thong/](03-quan-tri-he-thong/README.md) |
| 4 | **Dữ liệu Gốc (MDM)** | [04-du-lieu-goc/](04-du-lieu-goc/README.md) |
| 5 | **Các Module Nghiệp vụ** | [05-module-nghiep-vu/](05-module-nghiep-vu/README.md) |
| 6 | **Triển khai** | [06-trien-khai/](06-trien-khai/README.md) |

---

## Tổng quan Hệ thống

**Tên hệ thống:** StreamHub (`system.streamhub.co`)  
**Mô hình kinh doanh:** Print-on-Demand + Embroidery (POD/Thêu cá nhân hóa), bán trên Etsy  
**Framework UI:** AdminLTE + Bootstrap 5, PJAX navigation  
**Ngôn ngữ giao diện:** Tiếng Việt (nội bộ), hỗ trợ Tiếng Anh cho dữ liệu Etsy

---

## Danh sách trang (Routes)

| URL | Mô tả | Module |
|-----|-------|--------|
| `/dashboard` | Trang tổng quan chính | Dashboard |
| `/orders` | Danh sách order Etsy | Orders |
| `/order-example` | Danh sách order của shop (alias cho `/orders`, lọc theo shop cụ thể) | Orders |
| `/by-qrcode` | QC order bằng QR scan | Kho xưởng |
| `/scan-track` | Quét tracking số | Kho xưởng |
| `/products` | Danh sách sản phẩm | Products |
| `/product-type` | Danh mục loại sản phẩm | Products |
| `/design-level` | Cấp độ thiết kế | Products |
| `/dashboard-supplier` | Dashboard nhà xưởng | Kho xưởng |
| `/in-out` | Nhập kho phôi | Kho xưởng |
| `/output-order` | Xuất kho | Kho xưởng |
| `/inventory` | Tồn kho | Kho xưởng |
| `/stock/order` | Order xưởng (lệnh SX) | Kho xưởng |
| `/receive-order` | Nhận hàng từ xưởng | Kho xưởng |
| `/emb-thread` | Quản lý chỉ thêu | Kho xưởng |
| `/gen-qrcode` | Tạo QR code | Kho xưởng |
| `/errors` | Đơn lỗi | Kho xưởng |
| `/shelf` | Quản lý kệ hàng | Kho xưởng |
| `/machine` | Quản lý máy thêu | Kho xưởng |
| `/export-hk` | Hậu kì (finishing) | Kho xưởng |
| `/supplier` | Nhà cung cấp | MDM |
| `/request-payment` | Đề nghị thanh toán | Thanh toán |
| `/add-request-payment` | Tạo đề nghị thanh toán | Thanh toán |
| `/auto-label` | Tự động in nhãn vận chuyển | Auto Label |
| `/documents` | Tài liệu nội bộ | Documents |
