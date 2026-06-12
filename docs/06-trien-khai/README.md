# Triển khai (Deployment)

Mô hình theo [ADR-001](../02-kien-truc-csdl/tech-stack-decision.md): monolith 1 node trên VPS/EC2, database dùng managed MySQL (RDS), file lưu S3.

## CI (GitHub Actions)

Workflow [.github/workflows/ci.yml](../../.github/workflows/ci.yml) chạy trên mọi PR và push vào `master`:

| Bước | Mục đích |
|------|----------|
| `npm run typecheck` | TypeScript strict — chặn lỗi type trước khi merge |
| `npm test` | Unit test (state machine, RBAC, order code) |
| `db:migrate` + `db:seed` trên MySQL 8 service | Mọi thay đổi schema/seed được chạy thật, không chỉ review bằng mắt |
| `docker build` | Dockerfile luôn build được |

## Môi trường & biến cấu hình

| Biến | Bắt buộc (prod) | Ghi chú |
|------|:---:|------|
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | ✅ | Trỏ tới RDS endpoint |
| `JWT_SECRET` | ✅ | Sinh ngẫu nhiên ≥ 32 bytes (`openssl rand -base64 32`); app từ chối khởi động nếu thiếu khi `NODE_ENV=production` |
| `JWT_EXPIRES_IN` | — | Mặc định `12h` |
| `PORT` | — | Mặc định `3000` |

## Staging / Production trên VPS

```bash
# Lần đầu trên server
git clone <repo> && cd streamhubs/backend
cp .env.example .env   # điền RDS endpoint + JWT_SECRET thật

# Build & chạy
docker compose -f docker-compose.prod.yml up -d --build

# Migration (lần đầu và mỗi khi có file SQL mới)
docker compose -f docker-compose.prod.yml exec app node scripts/run-sql.mjs database/migrations
docker compose -f docker-compose.prod.yml exec app node scripts/run-sql.mjs database/seeds   # chỉ lần đầu
```

Đặt Nginx/Caddy phía trước làm TLS termination, trỏ `system.streamhub.co` về cổng 3000.

### Cập nhật phiên bản

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build   # rebuild + restart, downtime vài giây
```

Rollback: `git checkout <commit cũ>` rồi chạy lại lệnh trên. Migration chỉ thêm mới (additive) — không sửa file SQL đã chạy; cần đổi schema thì thêm file `002_...sql`.

## Checklist trước khi mở production

- [ ] Đổi mật khẩu admin seed (`admin@streamhub.co`)
- [ ] `JWT_SECRET` sinh ngẫu nhiên, không dùng giá trị ví dụ
- [ ] RDS bật automated backup (point-in-time recovery)
- [ ] Mã hóa `shops.etsy_api_key` ở tầng ứng dụng trước khi nhập key thật
- [ ] Bật HTTPS (Caddy tự động hoặc certbot với Nginx)
