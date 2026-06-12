/**
 * Build mệnh đề SET cho UPDATE từ object input.
 * An toàn SQL injection với điều kiện: key của object phải đi qua Zod schema
 * (whitelist cột) trước khi gọi hàm này — không truyền thẳng req.body.
 */
export function buildSet(input: Record<string, unknown>): { clause: string; params: unknown[] } {
  const fields: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    fields.push(`\`${key}\` = ?`);
    params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
  }
  return { clause: fields.join(', '), params };
}
