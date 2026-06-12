# StreamHub Backend

Backend API cho hệ thống StreamHub — ERP lite cho doanh nghiệp POD/Thêu cá nhân hóa bán trên Etsy.
Thiết kế bám theo tài liệu tại [`docs/`](../docs/README.md); quyết định công nghệ xem [ADR-001](../docs/02-kien-truc-csdl/tech-stack-decision.md).

## Tech stack

- **Node.js 22 + TypeScript (strict) + Express 5** — monolith phân tầng
- **MySQL 8** — migration SQL thuần, truy cập qua `mysql2` (không ORM)
- **Zod** — validate input, **JWT + bcrypt** — auth, **RBAC** theo `roles.permissions` JSON

## Chạy dev

```bash
cp .env.example .env
docker compose up -d        # MySQL 8
npm install
npm run db:migrate          # tạo schema (database/migrations)
npm run db:seed             # roles, admin, system configs (database/seeds)
npm run dev                 # http://localhost:3000
```

Đăng nhập mặc định: `admin@streamhub.co` / `Admin@123` (đổi ngay sau khi đăng nhập).

```bash
npm test          # unit test (state machine, RBAC, order code)
npm run typecheck # kiểm tra type
npm run build && npm start  # production
```

## Frontend (`public/`)

SPA nhẹ không cần build step — vanilla ES modules + Bootstrap 5 (CDN), được chính backend phục vụ tại `/` (SPA fallback cho mọi GET không phải `/api`). Mở `http://localhost:3000` sau khi `npm run dev`.

```
public/
  index.html            # shell
  css/app.css           # theme theo mockup (card trắng, badge màu, panel trượt)
  js/
    api.js              # fetch wrapper: JWT, 401 → login, chuẩn hóa lỗi
    ui.js               # esc/fmtMoney/badge/modal/panel/donut/pagination
    perm.js             # bản sao client của RBAC resolver (chỉ để ẩn/hiện UI)
    constants.js        # nhãn tiếng Việt + màu cho mọi enum trạng thái
    app.js / routes.js  # shell + hash router + menu theo quyền
    pages/
      crud.js           # factory trang CRUD khai báo (9 trang master-data dùng chung)
      payments.js       # KPI + donut + bảng (theo mockup /request-payment)
      payment-detail.js # panel chi tiết + duyệt/từ chối/mark-paid
      payment-create.js # form tạo ĐNTT (theo mockup /add-request-payment)
      orders.js, order-detail.js, order-create.js, stock-orders.js, errors.js
      inventory.js, scan.js, threads.js, receive-orders.js, auto-labels.js
      dashboard.js, system-configs.js, master-data.js, login.js
```

Đăng nhập, đổi trạng thái order, scan QR nhập/xuất, nhận hàng xưởng, duyệt + thanh toán ĐNTT... đều thao tác được từ UI. Quyền RBAC quyết định menu và nút hiển thị (backend vẫn là nơi chặn thật).

## Cấu trúc & nguyên tắc

```
src/
  config/          # đọc env
  db/              # pool, withTransaction, query helpers
  core/            # HttpError, RBAC resolver, pagination, buildSet — thuần, test được
  middlewares/     # authenticate (JWT), authorize (RBAC), errorHandler
  integrations/    # biên tích hợp ngoài (carrier...) — interface + adapter
  modules/         # mỗi module nghiệp vụ 1 thư mục
    orders/
      orders.routes.ts     # endpoint + handler mỏng (parse input → gọi service → trả JSON)
      orders.service.ts    # business logic, transaction
      orders.repository.ts # SQL phức tạp dùng lại
      orders.schemas.ts    # Zod schemas
      order-status.ts      # state machine vòng đời order (nguồn sự thật duy nhất)
```

Nguyên tắc đang áp dụng (chi tiết trong ADR-001):

1. **Tách tầng:** routes không chứa SQL nghiệp vụ phức tạp; service không đụng `req/res`.
2. **State machine khai báo:** mọi đổi `orders.status` đi qua `assertTransition` — thêm trạng thái mới chỉ sửa 1 bảng transition.
3. **Transaction cho dữ liệu denormalized:** `remaining_qty`, `current_count`, tracking sync luôn cập nhật atomic trong `withTransaction`, kèm `SELECT ... FOR UPDATE` chống race.
4. **Deny-by-default RBAC:** quyền tra theo `module.action`; giá trị `"own"` do service kiểm tra ownership.
5. **Dependency inversion ở biên:** carrier API là interface (`CarrierClient`) + stub — thay nhà cung cấp không sửa service.
6. **Error tập trung:** handler chỉ `throw` (`NotFoundError`, `ConflictError`...), `errorHandler` dịch thành JSON.

## API chính

| Nhóm | Endpoint tiêu biểu |
|------|--------------------|
| Auth | `POST /api/auth/login`, `GET /api/auth/me` |
| Orders | `GET/POST /api/orders`, `GET /api/orders/:id`, `POST /api/orders/:id/status`, `/cancel`, `/merge`, `/packages` |
| Sản xuất | `PATCH /api/order-items/:id`, `POST /api/order-items/:id/notes`, `/design-files` |
| Kho phôi | `POST /api/inventory/lots`, `POST /api/inventory/lots/:id/qrcodes`, `POST /api/inventory/in`, `/out`, `GET /api/inventory/lots` |
| Chỉ thêu | `GET/POST /api/threads/lots`, `POST /api/threads/in`, `/out` |
| Nhận hàng xưởng | `POST /api/receive-orders` (session + logs + chuyển in_finishing trong 1 transaction) |
| Thanh toán | `GET/POST /api/payment-requests`, `POST /:id/approval`, `/mark-paid` |
| Auto label | `POST /api/auto-labels` (tạo label + sync tracking cùng transaction) |
| Dashboard | `GET /api/dashboard/supplier?date_from&date_to` |
| Quản trị | `/api/users`, `/api/roles`, `/api/shops`, `/api/system-configs`, `/api/activity-logs` |

## Roadmap (chưa thuộc phạm vi v1)

- Etsy sync worker (poll orders theo `shops.sync_interval`, đẩy tracking) — thêm adapter tại `src/integrations/etsy/`
- Upload file multipart + S3 adapter (hiện API nhận `file_path` metadata)
- Carrier webhook nhận `in_transit`/`delivered`
- Migrate `orders.labels` → bảng `order_labels` khi volume > 200K orders (đã ghi chú trong docs)
