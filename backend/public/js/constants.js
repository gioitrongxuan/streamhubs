// Nhãn tiếng Việt + màu sắc cho các trạng thái — đồng bộ với enum trong database-schema.md

export const ORDER_STATUS = {
  new:            { label: 'Mới',              bg: '#eef2f6', color: '#475467' },
  need_confirm:   { label: 'Need Confirm',     bg: '#fef0c7', color: '#b54708' },
  designing:      { label: 'Đang Design',      bg: '#e0eaff', color: '#3538cd' },
  pending_review: { label: 'Chờ duyệt Design', bg: '#fef0c7', color: '#b54708' },
  designed:       { label: 'Đã duyệt Design',  bg: '#d1fadf', color: '#067647' },
  in_production:  { label: 'Chưa sản xuất',    bg: '#e0eaff', color: '#3538cd' },
  producing:      { label: 'Đang sản xuất',    bg: '#dbeafe', color: '#1d4ed8' },
  redo:           { label: 'Làm lại',          bg: '#fee4e2', color: '#b42318' },
  fixing:         { label: 'Sửa lại',          bg: '#fee4e2', color: '#b42318' },
  factory_return: { label: 'Xưởng trả lại',    bg: '#fee4e2', color: '#b42318' },
  produced:       { label: 'Sản xuất xong',    bg: '#d1fadf', color: '#067647' },
  in_finishing:   { label: 'Đang hậu kỳ',      bg: '#e0eaff', color: '#3538cd' },
  qc_passed:      { label: 'QC đạt',           bg: '#d1fadf', color: '#067647' },
  out_stock:      { label: 'Đã xuất kho',      bg: '#cffafe', color: '#0e7490' },
  shipped:        { label: 'Shipped',          bg: '#d1fadf', color: '#067647' },
  in_transit:     { label: 'InTransit',        bg: '#cffafe', color: '#0e7490' },
  complete:       { label: 'Complete',         bg: '#d1fadf', color: '#067647' },
  cancelled:      { label: 'Đã hủy',           bg: '#f2f4f7', color: '#667085' },
};

// Bản sao client của state machine (backend là nguồn sự thật — đây chỉ để hiển thị nút)
export const ORDER_TRANSITIONS = {
  new: ['need_confirm', 'designing'],
  need_confirm: ['new', 'designing'],
  designing: ['pending_review'],
  pending_review: ['designing', 'designed'],
  designed: ['in_production'],
  in_production: ['producing', 'factory_return'],
  producing: ['produced', 'redo', 'factory_return'],
  redo: ['producing', 'in_production'],
  fixing: ['in_production'],
  factory_return: ['in_production', 'fixing'],
  produced: ['in_finishing'],
  in_finishing: ['qc_passed', 'redo'],
  qc_passed: ['out_stock'],
  out_stock: ['shipped'],
  shipped: ['in_transit'],
  in_transit: ['complete'],
  complete: [],
  cancelled: [],
};

// Các trạng thái thuộc giai đoạn sản xuất — filter màn Order xưởng
export const PRODUCTION_STATUSES = ['in_production', 'producing', 'redo', 'fixing', 'factory_return', 'produced'];

// Đơn đã bàn giao carrier hoặc kết thúc — không hủy/gộp được nữa (đồng bộ NON_CANCELLABLE backend)
export const NON_CANCELLABLE_STATUSES = ['out_stock', 'shipped', 'in_transit', 'complete', 'cancelled'];

export const ITEM_STATUS = {
  pending:      { label: 'Chờ SX',        bg: '#eef2f6', color: '#475467' },
  in_progress:  { label: 'Đang thêu',     bg: '#dbeafe', color: '#1d4ed8' },
  done:         { label: 'Thêu xong',     bg: '#d1fadf', color: '#067647' },
  in_finishing: { label: 'Đang hậu kỳ',   bg: '#e0eaff', color: '#3538cd' },
  redo:         { label: 'Làm lại',       bg: '#fee4e2', color: '#b42318' },
  qc_failed:    { label: 'QC không đạt',  bg: '#fee4e2', color: '#b42318' },
  qc_passed:    { label: 'QC đạt',        bg: '#d1fadf', color: '#067647' },
};

export const PAYMENT_STATUS = {
  pending:  { label: 'Chờ xác nhận',     bg: '#fef0c7', color: '#b54708', chart: '#f79009' },
  accepted: { label: 'Đã xác nhận',      bg: '#d1fadf', color: '#067647', chart: '#12b76a' },
  partial:  { label: 'Đã TT 1 phần',     bg: '#cffafe', color: '#0e7490', chart: '#06aed4' },
  paid:     { label: 'Đã thanh toán',    bg: '#d1e9ff', color: '#175cd3', chart: '#2e90fa' },
  rejected: { label: 'Từ chối',          bg: '#fee4e2', color: '#b42318', chart: '#f04438' },
};

export const PAYMENT_GROUPS = {
  external_fulfill: 'Fulfill ngoài',
  material: 'Phôi sản phẩm',
  thread: 'Nguyên vật liệu thêu',
  shipping: 'Phí vận chuyển',
  design: 'Design - File thêu',
  other: 'Khác / Mua ngoài',
};

export const ERROR_AT = { xuong: 'Lỗi xưởng', designer: 'Lỗi thiết kế', phoi: 'Lỗi phôi' };

export const MACHINE_STATUS = {
  idle:        { label: 'Đang trống',  bg: '#d1fadf', color: '#067647' },
  active:      { label: 'Đang chạy',  bg: '#fef0c7', color: '#b54708' },
  error:       { label: 'Lỗi',        bg: '#fee4e2', color: '#b42318' },
  maintenance: { label: 'Bảo trì',    bg: '#f2f4f7', color: '#667085' },
};

export const SUPPLIER_TYPES = {
  internal: 'Xưởng nội bộ',
  external_fulfill: 'Fulfill ngoài',
  material: 'NCC nguyên liệu',
};

export const DOCUMENT_CATEGORIES = {
  system_guide: 'Hướng dẫn hệ thống',
  sales_case: 'Sales case',
  listing_idea: 'Ý tưởng listing',
  design_doc: 'Tài liệu thiết kế',
  qc_doc: 'Tài liệu QC',
};
