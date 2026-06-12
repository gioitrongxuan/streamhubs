import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne, execute } from '../../db/pool.js';
import { NotFoundError } from '../../core/http-error.js';
import { authenticate, currentUser } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/authorize.js';

const documentSchema = z.object({
  category: z.enum(['system_guide', 'sales_case', 'listing_idea', 'design_doc', 'qc_doc']),
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  file_path: z.string().min(1).max(255),
});

export const documentsRouter = Router();

documentsRouter.get('/documents', authenticate, authorize('system.documents_view'), async (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const rows = await query(
    pool,
    `SELECT d.*, u.name AS uploaded_by_name
     FROM documents d JOIN users u ON u.id = d.uploaded_by
     ${category ? 'WHERE d.category = ?' : ''} ORDER BY d.id DESC`,
    category ? [category] : [],
  );
  res.json({ data: rows });
});

documentsRouter.post('/documents', authenticate, authorize('system.documents_upload'), async (req, res) => {
  const input = documentSchema.parse(req.body);
  const result = await execute(
    pool,
    'INSERT INTO documents (category, title, description, file_path, uploaded_by) VALUES (?, ?, ?, ?, ?)',
    [input.category, input.title, input.description ?? null, input.file_path, currentUser(req).id],
  );
  res.status(201).json({ id: result.insertId });
});

documentsRouter.delete('/documents/:id', authenticate, authorize('system.documents_upload'), async (req, res) => {
  const id = Number(req.params.id);
  const doc = await queryOne(pool, 'SELECT id FROM documents WHERE id = ?', [id]);
  if (!doc) throw new NotFoundError('Không tìm thấy tài liệu');
  await execute(pool, 'DELETE FROM documents WHERE id = ?', [id]);
  res.json({ ok: true });
});
