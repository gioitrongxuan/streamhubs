import express from 'express';
import path from 'node:path';
import { errorHandler } from './middlewares/error-handler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { rolesRouter } from './modules/roles/roles.routes.js';
import { shopsRouter } from './modules/shops/shops.routes.js';
import { suppliersRouter } from './modules/suppliers/suppliers.routes.js';
import { designLevelsRouter } from './modules/design-levels/design-levels.routes.js';
import { productTypesRouter } from './modules/product-types/product-types.routes.js';
import { productsRouter } from './modules/products/products.routes.js';
import { machinesRouter } from './modules/machines/machines.routes.js';
import { shelvesRouter } from './modules/shelves/shelves.routes.js';
import { ordersRouter } from './modules/orders/orders.routes.js';
import { orderErrorsRouter } from './modules/orders/order-errors.routes.js';
import { orderExamplesRouter } from './modules/order-examples/order-examples.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { threadsRouter } from './modules/threads/threads.routes.js';
import { receiveOrdersRouter } from './modules/receive-orders/receive-orders.routes.js';
import { paymentRequestsRouter } from './modules/payment-requests/payment-requests.routes.js';
import { autoLabelsRouter } from './modules/auto-labels/auto-labels.routes.js';
import { documentsRouter } from './modules/documents/documents.routes.js';
import { systemConfigsRouter } from './modules/system-configs/system-configs.routes.js';
import { activityLogsRouter } from './modules/activity-logs/activity-logs.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';

/** Lắp ráp Express app — thêm module mới = thêm 1 dòng mount, không sửa module cũ. */
export function createApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api', [
    authRouter,
    usersRouter,
    rolesRouter,
    shopsRouter,
    suppliersRouter,
    designLevelsRouter,
    productTypesRouter,
    productsRouter,
    machinesRouter,
    shelvesRouter,
    ordersRouter,
    orderErrorsRouter,
    orderExamplesRouter,
    inventoryRouter,
    threadsRouter,
    receiveOrdersRouter,
    paymentRequestsRouter,
    autoLabelsRouter,
    documentsRouter,
    systemConfigsRouter,
    activityLogsRouter,
    dashboardRouter,
  ]);

  // Frontend tĩnh (SPA) — public/ nằm cạnh src/ (dev) hoặc dist/ (build)
  const publicDir = path.join(import.meta.dirname, '..', 'public');
  app.use(express.static(publicDir));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

  app.use(errorHandler);
  return app;
}
