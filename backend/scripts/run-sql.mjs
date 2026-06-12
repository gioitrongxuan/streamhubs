/**
 * Chạy tuần tự các file .sql trong một thư mục (migrations hoặc seeds).
 * JS thuần để chạy được cả trong image production (không cần tsx).
 * Dùng: node scripts/run-sql.mjs database/migrations
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const dir = process.argv[2];
if (!dir) {
  console.error('Cách dùng: node scripts/run-sql.mjs <thư mục sql>');
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

const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
for (const file of files) {
  const sql = await readFile(path.join(dir, file), 'utf8');
  console.log(`→ ${file}`);
  await conn.query(sql);
}
await conn.end();
console.log('Hoàn tất.');
