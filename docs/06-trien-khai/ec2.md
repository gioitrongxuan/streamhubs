# Triển khai lên AWS EC2

Phương án khởi đầu: **1 EC2 instance chạy cả app + MySQL** qua Docker Compose (`backend/docker-compose.ec2.yml`). Khi hệ thống quan trọng hơn, chuyển DB sang RDS (mục cuối).

## 1. Tạo EC2 instance

Trên AWS Console → EC2 → Launch instance:

| Mục | Giá trị khuyến nghị |
|-----|---------------------|
| AMI | Ubuntu Server 24.04 LTS |
| Instance type | `t3.small` (2 vCPU / 2GB — đủ cho 10–50 user); tối thiểu `t3.micro` để thử |
| Storage | 20–30 GB gp3 |
| Key pair | Tạo mới hoặc dùng key sẵn có (để SSH) |

**Security Group** — mở đúng 3 port:

| Port | Nguồn | Mục đích |
|------|-------|----------|
| 22 (SSH) | IP của bạn (My IP) | Quản trị |
| 80 (HTTP) | 0.0.0.0/0 | Ứng dụng |
| 443 (HTTPS) | 0.0.0.0/0 | Khi gắn TLS (mục 4) |

> Không mở port 3306 — MySQL chỉ nghe trong mạng nội bộ Docker.

Khuyến nghị gắn **Elastic IP** để IP không đổi khi restart instance.

## 2. Cài đặt (một lệnh)

SSH vào instance rồi:

```bash
sudo apt-get update -y && sudo apt-get install -y git
git clone <repo-url> streamhubs && cd streamhubs
git checkout claude/system-architecture-design-0gsd3f   # hoặc master sau khi merge

bash deploy/ec2-setup.sh
```

Script tự làm: cài Docker, sinh `.env` với mật khẩu DB + `JWT_SECRET` ngẫu nhiên, build image, khởi động app + MySQL, chạy migration + seed (chỉ lần đầu).

Kiểm tra:

```bash
curl -s localhost/health        # → {"ok":true}
```

Mở `http://<EC2-public-IP>` trên trình duyệt → đăng nhập `admin@streamhub.co` / `Admin@123` → **đổi mật khẩu ngay** (menu Người dùng).

## 3. Cập nhật phiên bản

```bash
cd streamhubs && git pull
bash deploy/ec2-setup.sh        # rebuild + restart, downtime vài giây
# Nếu có file migration mới:
cd backend && docker compose -f docker-compose.ec2.yml exec app node scripts/run-sql.mjs database/migrations
```

## 4. Gắn domain + HTTPS (khuyến nghị khi dùng thật)

Trỏ DNS `system.streamhub.co` (bản ghi A) về Elastic IP, rồi chạy Caddy làm reverse proxy TLS tự động:

```bash
sudo apt-get install -y caddy
# Đổi app sang port nội bộ: trong docker-compose.ec2.yml sửa "80:3000" → "127.0.0.1:3000:3000"
cd streamhubs/backend && docker compose -f docker-compose.ec2.yml up -d
echo 'system.streamhub.co {
    reverse_proxy 127.0.0.1:3000
}' | sudo tee /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

Caddy tự xin và gia hạn chứng chỉ Let's Encrypt. Sau bước này có thể đóng port 80→chỉ Caddy dùng, app không expose trực tiếp.

## 5. Backup database (bắt buộc trước khi dùng thật)

Cron mysqldump hàng ngày, giữ 14 bản:

```bash
mkdir -p ~/backups
crontab -e
# Thêm dòng (chạy 2h sáng mỗi ngày):
0 2 * * * cd ~/streamhubs/backend && docker compose -f docker-compose.ec2.yml exec -T mysql mysqldump -ustreamhub -p$(grep '^DB_PASSWORD=' .env | cut -d= -f2) streamhub | gzip > ~/backups/streamhub-$(date +\%F).sql.gz && ls -t ~/backups/*.gz | tail -n +15 | xargs -r rm
```

Tốt hơn nữa: đồng bộ `~/backups` lên S3 (`aws s3 sync ~/backups s3://<bucket>/db-backups/`).

Khôi phục:

```bash
zcat ~/backups/streamhub-YYYY-MM-DD.sql.gz | docker compose -f docker-compose.ec2.yml exec -T mysql mysql -ustreamhub -p<DB_PASSWORD> streamhub
```

## 6. Vận hành thường ngày

```bash
cd streamhubs/backend
docker compose -f docker-compose.ec2.yml ps          # trạng thái
docker compose -f docker-compose.ec2.yml logs -f app # log ứng dụng
docker compose -f docker-compose.ec2.yml restart app # restart app
```

App và MySQL có `restart: unless-stopped` — tự chạy lại khi instance reboot.

## 7. Nâng cấp lên RDS (khi cần độ bền cao hơn)

1. Tạo RDS MySQL 8.0 (db.t3.micro trở lên) cùng VPC, security group chỉ cho phép EC2 truy cập port 3306
2. Dump dữ liệu hiện tại (mục 5) và import vào RDS
3. Sửa `backend/.env`: thêm `DB_HOST=<rds-endpoint>`, `DB_USER`, `DB_NAME`
4. Chuyển sang compose không có MySQL: `docker compose -f docker-compose.prod.yml up -d --build`

RDS lo backup tự động, point-in-time recovery và failover — đúng kiến trúc đích trong [ADR-001](../02-kien-truc-csdl/tech-stack-decision.md).

## Sự cố thường gặp

| Triệu chứng | Nguyên nhân / Cách xử lý |
|---|---|
| Không vào được web | Kiểm tra Security Group mở port 80; `docker compose ps` xem app có chạy |
| App restart liên tục | `docker compose logs app` — thường do thiếu `JWT_SECRET` trong `.env` |
| `health` OK nhưng đăng nhập lỗi | Chưa chạy seed — chạy lại `bash deploy/ec2-setup.sh` |
| Hết dung lượng đĩa | `docker system prune -af` xóa image cũ sau nhiều lần build |
