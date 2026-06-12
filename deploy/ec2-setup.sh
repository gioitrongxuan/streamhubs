#!/usr/bin/env bash
# Cài đặt StreamHub trên EC2 Ubuntu 22.04/24.04 — chạy MỘT lệnh từ thư mục repo:
#   bash deploy/ec2-setup.sh
# Idempotent: chạy lại an toàn (cập nhật phiên bản = git pull rồi chạy lại).
set -euo pipefail

cd "$(dirname "$0")/../backend"

# 1. Cài Docker + Compose plugin nếu chưa có
if ! command -v docker >/dev/null 2>&1; then
  echo "→ Cài Docker..."
  sudo apt-get update -y
  sudo apt-get install -y docker.io docker-compose-v2
  sudo systemctl enable --now docker
  sudo usermod -aG docker "$USER"
fi
DOCKER="docker"
docker info >/dev/null 2>&1 || DOCKER="sudo docker"

# 2. Sinh .env lần đầu (mật khẩu DB + JWT secret ngẫu nhiên)
if [ ! -f .env ]; then
  echo "→ Sinh .env với secret ngẫu nhiên..."
  cat > .env <<EOF
DB_PASSWORD=$(openssl rand -hex 16)
DB_ROOT_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=12h
EOF
  chmod 600 .env
fi

# 3. Build + chạy app & MySQL (healthcheck đảm bảo DB sẵn sàng trước app)
echo "→ Build và khởi động dịch vụ..."
$DOCKER compose -f docker-compose.ec2.yml up -d --build

# 4. Migration — luôn chạy (script tự bỏ qua phần đã áp dụng vì chỉ thêm file mới);
#    seed chỉ chạy lần đầu (khi chưa có bảng roles có dữ liệu)
echo "→ Chờ MySQL sẵn sàng..."
for _ in $(seq 1 30); do
  $DOCKER compose -f docker-compose.ec2.yml exec -T mysql mysqladmin ping -ustreamhub -p"$(grep '^DB_PASSWORD=' .env | cut -d= -f2)" --silent 2>/dev/null && break
  sleep 3
done

HAS_DATA=$($DOCKER compose -f docker-compose.ec2.yml exec -T mysql \
  mysql -ustreamhub -p"$(grep '^DB_PASSWORD=' .env | cut -d= -f2)" streamhub \
  -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='streamhub' AND table_name='roles'" 2>/dev/null || echo 0)

if [ "$HAS_DATA" = "0" ]; then
  echo "→ Lần đầu: chạy migration + seed..."
  $DOCKER compose -f docker-compose.ec2.yml exec -T app node scripts/run-sql.mjs database/migrations
  $DOCKER compose -f docker-compose.ec2.yml exec -T app node scripts/run-sql.mjs database/seeds
else
  echo "→ DB đã có schema — bỏ qua migrate/seed (chạy tay nếu có migration mới:"
  echo "   docker compose -f docker-compose.ec2.yml exec app node scripts/run-sql.mjs database/migrations)"
fi

echo ""
echo "✅ Hoàn tất. Kiểm tra:"
echo "   curl -s localhost/health   → {\"ok\":true}"
echo "   Mở http://<EC2-public-IP>  → đăng nhập admin@streamhub.co / Admin@123"
echo "   ⚠ ĐỔI MẬT KHẨU ADMIN NGAY sau lần đăng nhập đầu tiên."
