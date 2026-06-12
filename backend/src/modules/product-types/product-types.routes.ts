import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne, execute, withTransaction } from '../../db/pool.js';
import { NotFoundError } from '../../core/http-error.js';
import { buildSet } from '../../core/sql.js';
import { authenticate } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';

const productTypeSchema = z.object({
  name: z.string().min(1).max(100),
  short_name: z.string().max(20).nullable().optional(),
  parent_id: z.number().int().positive().nullable().optional(),
  design_level_id: z.number().int().positive().nullable().optional(),
  hscode: z.string().max(20).nullable().optional(),
  hs_name: z.string().max(255).nullable().optional(),
  hs_price: z.number().nonnegative().nullable().optional(),
  image: z.string().max(255).nullable().optional(),
  content: z.string().nullable().optional(),
  data_map: z.string().nullable().optional(),
  positions: z.array(z.string()).nullable().optional(),
  default_supplier_id: z.number().int().positive().nullable().optional(),
  is_active: z.boolean().default(true),
});

/** Thay toàn bộ trục variant của một loại sản phẩm (Size/Color/... + giá trị). */
const variantsSchema = z.object({
  variants: z.array(
    z.object({
      name: z.string().min(1).max(50),
      values: z.array(
        z.object({
          value: z.string().min(1).max(50),
          length: z.number().nullable().optional(),
          width: z.number().nullable().optional(),
          height: z.number().nullable().optional(),
          weight: z.number().nullable().optional(),
          weight_box: z.number().nullable().optional(),
        }),
      ),
    }),
  ),
});

export const productTypesRouter = Router();
productTypesRouter.use('/product-types', authenticate);

productTypesRouter.get('/product-types', authorize('products.view'), async (_req, res) => {
  const rows = await query(
    pool,
    `SELECT pt.*, dl.name AS design_level_name, parent.name AS parent_name
     FROM product_types pt
     LEFT JOIN design_levels dl ON dl.id = pt.design_level_id
     LEFT JOIN product_types parent ON parent.id = pt.parent_id
     ORDER BY pt.id`,
  );
  res.json({ data: rows });
});

productTypesRouter.get('/product-types/:id', authorize('products.view'), async (req, res) => {
  const id = Number(req.params.id);
  const productType = await queryOne(pool, 'SELECT * FROM product_types WHERE id = ?', [id]);
  if (!productType) throw new NotFoundError('Không tìm thấy loại sản phẩm');

  const variants = await query<{ id: number }>(
    pool,
    'SELECT id, name, sort_order FROM product_type_variants WHERE product_type_id = ? ORDER BY sort_order',
    [id],
  );
  const values = variants.length
    ? await query(
        pool,
        `SELECT * FROM product_type_variant_values WHERE variant_id IN (${variants.map(() => '?').join(',')})`,
        variants.map((v) => v.id),
      )
    : [];
  res.json({ ...productType, variants, variant_values: values });
});

productTypesRouter.post('/product-types', authorize('products.manage'), async (req, res) => {
  const input = productTypeSchema.parse(req.body);
  const result = await execute(
    pool,
    `INSERT INTO product_types (name, short_name, parent_id, design_level_id, hscode, hs_name,
                                hs_price, image, content, data_map, positions, default_supplier_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.name, input.short_name ?? null, input.parent_id ?? null, input.design_level_id ?? null,
     input.hscode ?? null, input.hs_name ?? null, input.hs_price ?? null, input.image ?? null,
     input.content ?? null, input.data_map ?? null,
     input.positions ? JSON.stringify(input.positions) : null,
     input.default_supplier_id ?? null, input.is_active ? 1 : 0],
  );
  res.status(201).json({ id: result.insertId });
});

productTypesRouter.patch('/product-types/:id', authorize('products.manage'), async (req, res) => {
  const id = Number(req.params.id);
  const input = productTypeSchema.partial().parse(req.body);
  const productType = await queryOne(pool, 'SELECT id FROM product_types WHERE id = ?', [id]);
  if (!productType) throw new NotFoundError('Không tìm thấy loại sản phẩm');

  const { positions, ...rest } = input;
  const { clause, params } = buildSet({
    ...rest,
    ...(positions !== undefined ? { positions: positions ? JSON.stringify(positions) : null } : {}),
  });
  if (clause) await execute(pool, `UPDATE product_types SET ${clause} WHERE id = ?`, [...params, id]);
  res.json({ ok: true });
});

productTypesRouter.put('/product-types/:id/variants', authorize('products.manage'), async (req, res) => {
  const id = Number(req.params.id);
  const { variants } = variantsSchema.parse(req.body);
  const productType = await queryOne(pool, 'SELECT id FROM product_types WHERE id = ?', [id]);
  if (!productType) throw new NotFoundError('Không tìm thấy loại sản phẩm');

  await withTransaction(async (conn) => {
    // ON DELETE CASCADE xóa luôn variant_values
    await execute(conn, 'DELETE FROM product_type_variants WHERE product_type_id = ?', [id]);
    for (const [index, variant] of variants.entries()) {
      const inserted = await execute(
        conn,
        'INSERT INTO product_type_variants (product_type_id, name, sort_order) VALUES (?, ?, ?)',
        [id, variant.name, index],
      );
      for (const v of variant.values) {
        await execute(
          conn,
          `INSERT INTO product_type_variant_values (variant_id, value, length, width, height, weight, weight_box)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [inserted.insertId, v.value, v.length ?? null, v.width ?? null, v.height ?? null,
           v.weight ?? null, v.weight_box ?? null],
        );
      }
    }
  });
  res.json({ ok: true });
});
