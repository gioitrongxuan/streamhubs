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

# 1b. Đảm bảo có swap ≥1G — máy RAM nhỏ (t2/t3.micro) build npm/tsc trong lúc
#     MySQL đang chạy rất dễ cạn RAM và treo cả máy. Idempotent.
if [ "$(awk '/SwapTotal/ {print $2}' /proc/meminfo)" -lt 1048576 ]; then
  echo "→ Tạo swapfile 2G (chống treo khi build trên máy RAM nhỏ)..."
  if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
  fi
  sudo swapon /swapfile 2>/dev/null || true
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

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

# 3. Build + chạy app & MySQL (healthcheck đảm bảo DB sẵn sàng trước app).
#    Dọn image cũ sau mỗi lần build — layer dangling tích tụ sẽ làm đầy đĩa EBS nhỏ.
echo "→ Build và khởi động dịch vụ..."
$DOCKER compose -f docker-compose.ec2.yml up -d --build
$DOCKER image prune -f >/dev/null

# 4. Migration — luôn chạy: run-sql.mjs ghi file đã áp dụng vào bảng
#    schema_migrations nên chạy lại chỉ áp dụng file mới.
echo "→ Chờ MySQL sẵn sàng..."
for _ in $(seq 1 30); do
  $DOCKER compose -f docker-compose.ec2.yml exec -T mysql mysqladmin ping -ustreamhub -p"$(grep '^DB_PASSWORD=' .env | cut -d= -f2)" --silent 2>/dev/null && break
  sleep 3
done

MYSQL_EXEC="$DOCKER compose -f docker-compose.ec2.yml exec -T mysql mysql -ustreamhub -p$(grep '^DB_PASSWORD=' .env | cut -d= -f2) streamhub -N -e"
HAS_SCHEMA=$($MYSQL_EXEC "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='streamhub' AND table_name='roles'" 2>/dev/null || echo 0)
HAS_TRACKING=$($MYSQL_EXEC "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='streamhub' AND table_name='schema_migrations'" 2>/dev/null || echo 0)

if [ "$HAS_SCHEMA" != "0" ] && [ "$HAS_TRACKING" = "0" ]; then
  # DB dựng từ phiên bản cũ (chưa có tracking): đánh dấu file hiện có là đã chạy
  echo "→ Baseline schema_migrations cho DB có sẵn..."
  $DOCKER compose -f docker-compose.ec2.yml exec -T app node scripts/run-sql.mjs database/migrations --baseline
  $DOCKER compose -f docker-compose.ec2.yml exec -T app node scripts/run-sql.mjs database/seeds --baseline
fi

echo "→ Chạy migration + seed (chỉ áp dụng file mới)..."
$DOCKER compose -f docker-compose.ec2.yml exec -T app node scripts/run-sql.mjs database/migrations
$DOCKER compose -f docker-compose.ec2.yml exec -T app node scripts/run-sql.mjs database/seeds

echo ""
echo "✅ Hoàn tất. Kiểm tra:"
echo "   curl -s localhost/health   → {\"ok\":true}"
echo "   Mở http://<EC2-public-IP>  → đăng nhập admin@streamhub.co / Admin@123"
echo "   ⚠ ĐỔI MẬT KHẨU ADMIN NGAY sau lần đăng nhập đầu tiên."
