// Bảng route của SPA — thứ tự quan trọng: route tĩnh đặt trước route có :param.
import { renderDashboard } from './pages/dashboard.js';
import { renderGuide } from './pages/guide.js';
import { renderOrders } from './pages/orders.js';
import { renderOrderCreate } from './pages/order-create.js';
import { renderOrderDetail } from './pages/order-detail.js';
import { renderStockOrders } from './pages/stock-orders.js';
import { renderErrors } from './pages/errors.js';
import { renderInventory } from './pages/inventory.js';
import { renderScanIn } from './pages/scan-in.js';
import { renderScanOut } from './pages/scan-out.js';
import { renderGenQr } from './pages/gen-qr.js';
import { renderQc } from './pages/qc.js';
import { renderScanTrack } from './pages/scan-track.js';
import { renderThreads } from './pages/threads.js';
import { renderReceiveOrders } from './pages/receive-orders.js';
import { renderPayments } from './pages/payments.js';
import { renderPaymentCreate } from './pages/payment-create.js';
import { renderAutoLabels } from './pages/auto-labels.js';
import { renderSystemConfigs } from './pages/system-configs.js';
import {
  suppliersPage, shelvesPage, machinesPage, productsPage, productTypesPage,
  designLevelsPage, usersPage, shopsPage, documentsPage,
} from './pages/master-data.js';

export const routes = [
  { path: '/dashboard', render: renderDashboard },
  { path: '/guide', render: renderGuide },
  { path: '/orders/create', render: renderOrderCreate },
  { path: '/orders/:id', render: renderOrderDetail },
  { path: '/orders', render: renderOrders },
  { path: '/stock-orders', render: renderStockOrders },
  { path: '/errors', render: renderErrors },
  { path: '/inventory', render: renderInventory },
  { path: '/scan-in', render: renderScanIn },
  { path: '/scan-out', render: renderScanOut },
  { path: '/scan', render: renderScanIn }, // tương thích link cũ → trang Nhập kho
  { path: '/gen-qrcode', render: renderGenQr },
  { path: '/qc', render: renderQc },
  { path: '/scan-track', render: renderScanTrack },
  { path: '/threads', render: renderThreads },
  { path: '/receive-orders', render: renderReceiveOrders },
  { path: '/payments/create', render: renderPaymentCreate },
  { path: '/payments/:id/edit', render: renderPaymentCreate },
  { path: '/payments', render: renderPayments },
  { path: '/auto-labels', render: renderAutoLabels },
  { path: '/system-configs', render: renderSystemConfigs },
  { path: '/suppliers', render: suppliersPage },
  { path: '/shelves', render: shelvesPage },
  { path: '/machines', render: machinesPage },
  { path: '/products', render: productsPage },
  { path: '/product-types', render: productTypesPage },
  { path: '/design-levels', render: designLevelsPage },
  { path: '/users', render: usersPage },
  { path: '/shops', render: shopsPage },
  { path: '/documents', render: documentsPage },
];
