# ADR-001 — Quyết định Công nghệ (Tech Stack)

**Trạng thái:** Accepted
**Ngày:** 2026-06-12

## Bối cảnh

StreamHub là ERP-lite cho doanh nghiệp POD/Thêu quy mô vừa và nhỏ (~10–50 user nội bộ, < 200K orders/năm). Tài liệu kiến trúc đã chốt mô hình **Monolithic**, giao diện AdminLTE + PJAX, CSDL MySQL. Cần chọn công nghệ cụ thể cho từng tầng sao cho: dễ đọc, dễ thay đổi, dễ tuyển người maintain, chi phí vận hành thấp.

## Quyết định

| Tầng | Lựa chọn | Lý do |
|------|----------|-------|
| **Frontend** | AdminLTE 3 + Bootstrap 5, PJAX, server-rendered | Mockup HTML đã xây theo hướng này; đội vận hành quen UI admin chuẩn; không cần SPA vì ứng dụng nội bộ, form-heavy. |
| **Backend** | Node.js 22 LTS + TypeScript + Express 5 | Một ngôn ngữ (TS) cho cả validate/types/logic; type-safety giúp refactor an toàn ("dễ thay đổi"); Express tối giản, không magic, dễ đọc. Hệ sinh thái tốt cho tích hợp Etsy/Carrier API (REST/webhook). |
| **Truy cập DB** | `mysql2` + SQL thuần, repository pattern | Schema đã thiết kế chi tiết bằng SQL trong docs; SQL thuần minh bạch hơn ORM với các nghiệp vụ denormalized (remaining_qty, current_count) cần transaction chính xác. Không lock-in ORM. |
| **Database** | MySQL 8.0 | Theo tài liệu kiến trúc; đủ cho quy mô; hỗ trợ JSON column (permissions, variants), CHECK constraint. |
| **Validation** | Zod | Schema validation khai báo, suy ra TypeScript type — một nguồn sự thật cho input. |
| **Auth** | JWT Bearer + bcrypt | Stateless, phù hợp REST API + PJAX; RBAC theo `roles.permissions` JSON như docs. |
| **File storage** | Local FS (dev) → S3-compatible (prod) qua adapter | Docs cho phép cả hai; tách interface để đổi không sửa business logic. |
| **Cloud** | VPS/EC2 + RDS MySQL + S3 (+ CloudFront cho file tĩnh) | Monolith 1 node là đủ; RDS lo backup/failover; nâng cấp dọc trước khi nghĩ tới scale ngang. Dev/staging chạy Docker Compose. |

## Kiến trúc Backend (Layered Monolith)

```
src/
  config/        # đọc env, hằng số
  db/            # connection pool, transaction helper
  core/          # HttpError, pagination, async handler
  middlewares/   # auth (JWT), authorize (RBAC), validate (Zod), error handler
  modules/       # mỗi module nghiệp vụ một thư mục
    orders/
      orders.routes.ts      # khai báo endpoint + handler mỏng
      orders.service.ts     # business logic, transaction
      orders.repository.ts  # SQL thuần
      orders.schemas.ts     # Zod input schemas
      order-status.ts       # state machine vòng đời order
    inventory/ ...
```

**Nguyên tắc áp dụng:**
- **Separation of concerns:** routes chỉ parse/trả response; service chứa nghiệp vụ; repository chứa SQL. Không gọi SQL từ routes, không gọi `res` từ service.
- **Single source of truth cho rule nghiệp vụ:** vòng đời order là một state machine khai báo (`order-status.ts`), không rải `if status ==` khắp nơi.
- **Transaction rõ ràng:** mọi cập nhật denormalized (remaining_qty, current_count, tracking sync) gói trong `withTransaction`.
- **Dependency inversion ở biên:** Etsy API, Carrier API, File storage là interface + adapter — thay nhà cung cấp không đụng service.
- **Open/Closed cho module:** thêm module mới = thêm thư mục + mount router, không sửa module cũ.

## Hệ quả

- (+) Một codebase TS thống nhất, junior đọc được; refactor có compiler đỡ.
- (+) SQL thuần khiến hành vi DB dự đoán được, dễ tối ưu index theo docs.
- (−) Không có ORM nghĩa là tự viết SQL CRUD — chấp nhận, đổi lại minh bạch.
- (−) Monolith: deploy nguyên khối — chấp nhận ở quy mô này, đã tách module rõ để tách dịch vụ sau nếu cần.

## Sai khác nhỏ so với docs (có chủ đích)

- `inventory_items.status` thêm giá trị `created`: QR được sinh tại `/gen-qrcode` trước khi phôi thực sự nhập kho, cần trạng thái "đã có QR nhưng chưa vào kho" để bất biến `remaining_qty = COUNT(status='in_stock')` luôn đúng.
