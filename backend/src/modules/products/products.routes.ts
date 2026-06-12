import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne, execute } from '../../db/pool.js';
import { NotFoundError } from '../../core/http-error.js';
import { buildSet } from '../../core/sql.js';
import { authenticate } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';

const productSchema = z.object({
  product_type_id: z.number().int().positive(),
  shop_id: z.number().int().positive(),
  etsy_listing_id: z.string().max(50).nullable().optional(),
  name: z.string().min(1).max(255),
  sku: z.string().max(50).nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).default('USD'),
  image: z.string().max(255).nullable().optional(),
  is_active: z.boolean().default(true),
});

export const productsRouter = Router();
productsRouter.use('/products', authenticate);

productsRouter.get('/products', authorize('products.view'), async (req, res) => {
  const shopId = req.query.shop_id ? Number(req.query.shop_id) : undefined;
  const rows = await query(
    pool,
    `SELECT p.*, pt.name AS product_type_name, s.name AS shop_name
     FROM products p
     JOIN product_types pt ON pt.id = p.product_type_id
     JOIN shops s ON s.id = p.shop_id
     ${shopId ? 'WHERE p.shop_id = ?' : ''} ORDER BY p.id DESC`,
    shopId ? [shopId] : [],
  );
  res.json({ data: rows });
});

productsRouter.post('/products', authorize('products.manage'), async (req, res) => {
  const input = productSchema.parse(req.body);
  const result = await execute(
    pool,
    `INSERT INTO products (product_type_id, shop_id, etsy_listing_id, name, sku, price, currency, image, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.product_type_id, input.shop_id, input.etsy_listing_id ?? null, input.name,
     input.sku ?? null, input.price ?? null, input.currency, input.image ?? null, input.is_active ? 1 : 0],
  );
  res.status(201).json({ id: result.insertId });
});

productsRouter.patch('/products/:id', authorize('products.manage'), async (req, res) => {
  const id = Number(req.params.id);
  // Không cho đổi shop_id sau khi tạo — nhất quán với updateOrderSchema
  const input = productSchema.omit({ shop_id: true }).partial().parse(req.body);
  const product = await queryOne(pool, 'SELECT id FROM products WHERE id = ?', [id]);
  if (!product) throw new NotFoundError('Không tìm thấy sản phẩm');

  const { clause, params } = buildSet(input);
  if (clause) await execute(pool, `UPDATE products SET ${clause} WHERE id = ?`, [...params, id]);
  res.json({ ok: true });
});
