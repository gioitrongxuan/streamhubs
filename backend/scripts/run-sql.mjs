/**
 * Chạy tuần tự các file .sql trong một thư mục (migrations hoặc seeds).
 * JS thuần để chạy được cả trong image production (không cần tsx).
 *
 * File đã chạy được ghi vào bảng schema_migrations — chạy lại lệnh chỉ áp dụng
 * file mới, nên thêm migration 002, 003... rồi chạy lại là an toàn.
 *
 * Dùng:
 *   node scripts/run-sql.mjs database/migrations
 *   node scripts/run-sql.mjs database/migrations --baseline
 *     (--baseline: chỉ ĐÁNH DẤU các file là đã chạy, không thực thi —
 *      dùng một lần cho DB có sẵn schema từ trước khi có bảng tracking)
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const args = process.argv.slice(2);
const baseline = args.includes('--baseline');
const dir = args.find((a) => !a.startsWith('--'));
if (!dir) {
  console.error('Cách dùng: node scripts/run-sql.mjs <thư mục sql> [--baseline]');
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'streamhub',
  password: process.env.DB_PASSWORD ?? 'streamhub',
  database: process.env.DB_NAME ?? 'streamhub',
  multipleStatements: true,
});

await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

const [appliedRows] = await conn.query('SELECT filename FROM schema_migrations');
const applied = new Set(appliedRows.map((r) => r.filename));

const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
for (const file of files) {
  // Key kèm tên thư mục để migrations/ và seeds/ không đè nhau
  const key = `${path.basename(dir)}/${file}`;
  if (applied.has(key)) {
    console.log(`↷ ${file} (đã áp dụng — bỏ qua)`);
    continue;
  }
  if (baseline) {
    console.log(`✓ ${file} (baseline — chỉ đánh dấu, không chạy)`);
  } else {
    const sql = await readFile(path.join(dir, file), 'utf8');
    console.log(`→ ${file}`);
    await conn.query(sql);
  }
  await conn.query('INSERT INTO schema_migrations (filename) VALUES (?)', [key]);
}
await conn.end();
console.log('Hoàn tất.');
