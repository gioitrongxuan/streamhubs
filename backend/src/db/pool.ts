import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env.js';

/** Repository nhận Queryable để chạy được cả trong và ngoài transaction. */
export type Queryable = Pool | PoolConnection;

export const pool: Pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});

/**
 * Gói một đơn vị nghiệp vụ trong DB transaction.
 * Mọi cập nhật liên quan tới dữ liệu denormalized (remaining_qty, current_count,
 * tracking sync) BẮT BUỘC đi qua đây.
 */
export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** SELECT trả về mảng row đã ép kiểu. */
export async function query<T>(db: Queryable, sql: string, params?: unknown[]): Promise<T[]> {
  const [rows] = await db.query<RowDataPacket[]>(sql, params);
  return rows as T[];
}

/** SELECT một row; undefined nếu không có. */
export async function queryOne<T>(db: Queryable, sql: string, params?: unknown[]): Promise<T | undefined> {
  const rows = await query<T>(db, sql, params);
  return rows[0];
}

/** INSERT/UPDATE/DELETE; trả về ResultSetHeader (insertId, affectedRows). */
export async function execute(db: Queryable, sql: string, params?: unknown[]): Promise<ResultSetHeader> {
  const [result] = await db.query<ResultSetHeader>(sql, params);
  return result;
}
