/**
 * Sinh mã đơn nội bộ theo format {PREFIX}{YYYYMMDDHHmmss}
 * (docs/02-kien-truc-csdl/database-schema.md — orders.order_code).
 */
export function buildOrderCode(prefix: string, at: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    prefix +
    at.getFullYear() +
    pad(at.getMonth() + 1) +
    pad(at.getDate()) +
    pad(at.getHours()) +
    pad(at.getMinutes()) +
    pad(at.getSeconds())
  );
}
