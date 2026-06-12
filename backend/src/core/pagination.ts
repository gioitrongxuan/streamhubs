import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(200).default(50),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function offsetOf({ page, per_page }: Pagination): number {
  return (page - 1) * per_page;
}

/** Response chuẩn cho danh sách có phân trang. */
export function paginated<T>(rows: T[], total: number, { page, per_page }: Pagination) {
  return {
    data: rows,
    meta: { page, per_page, total, total_pages: Math.ceil(total / per_page) },
  };
}
