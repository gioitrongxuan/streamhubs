# StreamHub

Hệ thống quản lý vận hành tích hợp (ERP lite) cho doanh nghiệp POD/Thêu cá nhân hóa
bán trên Etsy: nhận đơn → thiết kế → sản xuất thêu → kiểm hàng → xuất kho → thanh toán
nhà cung cấp.

## Cấu trúc kho mã

```
streamhubs/
├── backend/             # Ứng dụng chính — monolith Node.js + TypeScript + Express
│   ├── src/             #   API và business logic (config, db, core, modules…)
│   ├── public/          #   Frontend SPA (vanilla ES modules + Bootstrap, do backend phục vụ)
│   ├── database/        #   Migrations + seeds SQL
│   ├── Dockerfile, docker-compose*.yml
│   └── README.md        #   Hướng dẫn chạy dev, kiến trúc tầng, API
├── docs/                # Tài liệu thiết kế hệ thống (tiếng Việt)
│   └── mockups/         #   Mockup HTML gốc dùng làm tham chiếu UI
├── deploy/              # Script triển khai EC2
└── .github/workflows/   # CI (typecheck + test) và auto-deploy
```

## Vì sao mọi thứ nằm trong `backend/`?

StreamHub được thiết kế **monolith có chủ đích**: một tiến trình Express vừa chạy API
(`/api/*`) vừa phục vụ trực tiếp frontend tĩnh từ `backend/public/` (SPA fallback cho
mọi GET không phải `/api`). Frontend là vanilla ES modules + Bootstrap qua CDN, **không
có build step**, nên không tách thành package `frontend/` riêng — toàn bộ ứng dụng đóng
gói và triển khai như một đơn vị duy nhất dưới `backend/`.

Đây là quyết định kiến trúc, không phải nhầm lẫn cấu trúc. Chi tiết kiến trúc tầng và
nguyên tắc xem [`backend/README.md`](backend/README.md) và
[ADR-001](docs/02-kien-truc-csdl/tech-stack-decision.md).

## Bắt đầu nhanh

```bash
cd backend
cp .env.example .env
docker compose up -d        # MySQL 8
npm install
npm run db:migrate
npm run db:seed
npm run dev                 # http://localhost:3000
```

Tài liệu đầy đủ: [`docs/README.md`](docs/README.md) · Hướng dẫn backend: [`backend/README.md`](backend/README.md)
