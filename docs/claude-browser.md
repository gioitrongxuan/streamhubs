# Sơ đồ Kiến trúc & Luồng Logic Nghiệp vụ — StreamHub

## 1. Tổng quan hệ thống

**StreamHub** là một hệ thống quản lý sản xuất & hoàn thiện đơn hàng thêu (embroidery fulfillment) tích hợp từ đầu vào (nhập kho phôi) đến đầu ra (ship hàng cho khách). Hệ thống phục vụ cả nhân viên nội bộ lẫn nhà cung cấp.

---

## 2. Sơ đồ Kiến trúc Module (Site Map)

```
streamhub.co (system.streamhub.co)
│
├── 🛒 ORDERS (Quản lý đơn hàng)
│   ├── /orders           → Order List (danh sách đơn, tổng 99.859 đơn)
│   └── Order mẫu         → Đơn hàng mẫu
│
├── 🛍️ PRODUCTS (Sản phẩm)
│   └── /products         → [phân quyền - user hiện tại không có quyền]
│
├── 🏭 QUẢN LÝ KHO XƯỞNG
│   ├── Dashboard (/dashboard-supplier) → Theo dõi máy thêu theo thời gian thực
│   ├── Nhập kho  (/in-out)             → Nhập phôi + sản phẩm khác
│   ├── Xuất kho  (/output-order)       → Xuất theo đơn / chỉ / hoàn kho lỗi
│   ├── Quản lý chỉ (/emb-thread)       → Danh sách cuộn chỉ thêu
│   ├── Tạo QRCode (/gen-qrcode)        → Tạo mã QR cho phôi / chỉ
│   ├── Tồn kho   (/inventory)          → Tồn kho phôi áo
│   │   ├── /inventory-thread          → Tồn kho chỉ thêu
│   │   ├── /inventory-day             → Tồn kho theo ngày (snapshot)
│   │   └── /get-qrcode                → Tra mã tồn kho qua QR
│   ├── Đơn lỗi   (/errors → /stock/order) → Danh sách item lỗi
│   ├── Orders Xưởng (/stock/order)    → Đơn xưởng nội bộ
│   ├── Receive Orders (/receive-order)→ Xác nhận đơn đã nhận
│   ├── Nhà cung cấp (/supplier)       → Danh sách NCC + ngân hàng
│   ├── Máy thêu (/machine)            → [phân quyền - hạn chế]
│   ├── Hậu kỳ (/export-hk)            → Xuất danh sách hậu kỳ
│   └── Kệ hàng (/shelf)               → Danh sách kệ + số lượng
│
├── 💳 Đề nghị thanh toán (/request-payment)  → Quản lý công nợ / thanh toán NCC
├── 🏷️ Auto Label                              → In nhãn tự động
├── 📁 Documents                               → Tài liệu
│
└── HEADER TOOLS
    ├── QC Order (/by-qrcode)   → Quét QR tiếp nhận + QC chất lượng sản phẩm
    └── Scan Track (/scan-track) → Quét mã tracking vận chuyển
```

---

## 3. Kiến trúc Dữ liệu (Data Entities & Relationships)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ENTITY DIAGRAM                                │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────┐        ┌──────────────────┐       ┌──────────────┐
│  SUPPLIER   │        │   PRODUCT_TYPE   │       │   SHELF      │
│ (Nhà CC)    │        │  (Loại sản phẩm) │       │ (Kệ hàng)   │
│─────────────│        │──────────────────│       │──────────────│
│ id          │        │ id               │       │ id (số kệ)  │
│ name        │        │ name (Sweatshirt │       │ quantity     │
│ short_name  │        │  Hoodie, Hat...) │       └──────┬───────┘
│ payment_days│        └────────┬─────────┘              │
│ bank_name   │                 │                         │
│ bank_account│                 │                         │
│ bank_holder │        ┌────────▼─────────┐              │
└──────┬──────┘        │   INVENTORY_LOT  │              │
       │               │   (Lô phôi áo)   │◄─────────────┘
       │               │──────────────────│
       └──────────────►│ id (lot_number)  │
                       │ supplier_id  (FK)│
                       │ product_type_id  │
                       │ color            │
                       │ size             │
                       │ quantity         │
                       │ unit_price (VND/ │
                       │  USD)            │
                       │ shelf_id (FK)    │
                       └────────┬─────────┘
                                │
       ┌────────────────────────┼──────────────────────────────┐
       │                        │                              │
┌──────▼──────┐      ┌──────────▼────────┐         ┌──────────▼────────┐
│ THREAD_LOT  │      │  INVENTORY_IN     │         │  INVENTORY_OUT    │
│ (Lô chỉ    │      │  (Nhập kho)        │         │  (Xuất kho)       │
│  thêu)      │      │───────────────────│         │───────────────────│
│─────────────│      │ id                │         │ id                │
│ thread_code │      │ lot_id (FK)       │         │ order_id (FK)     │
│ supplier_id │      │ qrcode            │         │ lot_id (FK)       │
│ thread_type │      │ shelf_id          │         │ type (đơn hàng /  │
│ unit (cuộn) │      │ date              │         │  chỉ / hoàn lỗi) │
│ length_unit │      │ created_by        │         │ quantity          │
│ quantity    │      └───────────────────┘         │ date              │
└─────────────┘                                    └───────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         ORDER DOMAIN                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐          ┌─────────────────────────┐
│      ORDER          │          │     ORDER_ITEM           │
│─────────────────────│          │─────────────────────────│
│ order_id (Etsy ID)  │◄────────►│ item_id                 │
│ status              │          │ order_id (FK)           │
│ shop                │          │ product_type            │
│ designer            │          │ color / size            │
│ listing_name        │          │ qrcode                  │
│ qty                 │          │ lot_id (FK)             │
│ fulfill_type        │          │ error_reason            │
│ order_total ($)     │          │ error_at (xưởng/designer│
│ base_cost ($)       │          │  /phôi)                 │
│ shipping_fee ($)    │          └─────────────────────────┘
│ streamer_name       │
│ streamer_country    │
│ tags                │
│ streamer_note       │
│ tracking_number     │
│ date_scan_tracking  │
└─────────────────────┘

STATUS FLOW (trạng thái đơn):
Mới → Đang Design → Chờ Duyệt Design → Đã Duyệt Design
     → Chưa Sản Xuất → Đang Sản Xuất → Làm Lại / Sửa Lại
     → Need Confirm → Xưởng Trả Lại → [Ship]

┌─────────────────────────────────────────────────────────────────────┐
│                      PAYMENT DOMAIN                                 │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│  PAYMENT_REQUEST     │
│  (Đề nghị TT)        │
│──────────────────────│
│ id (serial code)     │
│ supplier_id (FK)     │
│ category             │
│ amount (VND + USD)   │
│ status:              │
│  - Chờ xác nhận      │
│  - Đã xác nhận       │
│  - Đã thanh toán     │
│  - Đã TT 1 phần      │
│  - Quá hạn           │
│ due_date             │
│ created_by           │
└──────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      QC & TRACKING DOMAIN                           │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐       ┌──────────────────────┐
│  QC_SCAN             │       │  TRACKING_SCAN        │
│  (QC chất lượng)     │       │  (Quét mã vận chuyển) │
│──────────────────────│       │──────────────────────│
│ order_id             │       │ order_id             │
│ product_qrcode       │       │ tracking_number      │
│ package_id           │       │ date_scan            │
│ scan_date            │       └──────────────────────┘
└──────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      MACHINE DOMAIN                                 │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│  MACHINE             │
│  (Máy thêu)          │
│──────────────────────│
│ id (Máy 1..34)       │
│ status:              │
│  - Xanh: trống       │
│  - Vàng: sản xuất    │
│  - Đỏ: lỗi/hỏng     │
│ workload (%)         │
│ date                 │
└──────────────────────┘
```

---

## 4. Luồng Logic Nghiệp vụ (Business Logic Flow)

```
════════════════════════════════════════════════════════════════════
 LUỒNG CHÍNH: TỪ NHẬP PHÔI → SẢN XUẤT → SHIP ĐƠN
════════════════════════════════════════════════════════════════════

BƯỚC 1: NHẬP KHO PHÔI ÁO / CHỈ THÊU
─────────────────────────────────────
  [Nhà cung cấp giao hàng]
          │
          ▼
  [Tạo QRCode] (/gen-qrcode)
    → Chọn NCC + Số lô sản xuất + Style + Số lượng + Đơn giá
    → Hệ thống tạo mã QR gắn với từng chiếc phôi / cuộn chỉ
          │
          ▼
  [Nhập kho] (/in-out → "Nhập kho phôi")
    → Quét mã QR từng chiếc
    → Chọn số kệ (shelf) lưu trữ
    → Cập nhật số lượng tồn kho theo lô, màu, size
          │
          ▼
  [Tồn kho] (/inventory)
    → Hiển thị: NCC | Số lô | Loại SP | Màu | Size | SL | Tiền
    → Tổng: 64.148 chiếc / 577.698.500 VND / 223.905 USD


BƯỚC 2: TIẾP NHẬN & XỬ LÝ ĐƠN HÀNG
─────────────────────────────────────
  [Đơn từ Etsy/Sàn TMDT đổ vào hệ thống]
          │
          ▼
  [Order List] (/orders) — Status: MỚI
    • 99.859 đơn tổng / 117.507 chiếc
    • Phân loại: Đơn Digital / Đơn Vật lý / Đơn Dup / Ship nhanh
          │
          ▼
  [Designer nhận đơn] → Status: ĐANG DESIGN
    → Designer tạo/chỉnh file thiết kế
          │
          ▼
  [Review] → Status: CHỜ DUYỆT DESIGN → ĐÃ DUYỆT DESIGN
    → QA/Lead duyệt file trước khi đưa vào xưởng


BƯỚC 3: SẢN XUẤT TẠI XƯỞNG
─────────────────────────────
  [Xuất kho phôi cho đơn hàng] (/output-order)
    → Quét mã QRCode đơn hàng
    → Hệ thống trừ tồn kho phôi tương ứng
          │
          ▼
  [Dashboard máy thêu] (/dashboard-supplier)
    → Theo dõi 34 máy theo thời gian thực
    → Màu xanh: máy trống | Vàng: đang chạy | Đỏ: lỗi/hỏng
    → Hiển thị % workload từng máy
          │
          ▼
  [Sản xuất] → Status: ĐANG SẢN XUẤT
          │
          ├─── [Lỗi phát sinh] → /errors (Đơn lỗi)
          │         → Ghi nhận: lỗi tại (Xưởng / Designer / Phôi)
          │         → Lý do: Thêu xien / Rách / File sai kích thước...
          │         → Hoàn kho phôi lỗi (nếu tái sử dụng được)
          │
          └─── [Hoàn thành] → Status: CHƯA SẢN XUẤT (chờ QC)


BƯỚC 4: QC CHẤT LƯỢNG & ĐÓNG GÓI
───────────────────────────────────
  [QC Order] (/by-qrcode)
    Tab 1: "Tiếp nhận sản phẩm và QC chất lượng"
      → Quét mã QR sản phẩm
      → Xác nhận chất lượng đạt / không đạt
      → Gắn vào package (Add Package)
      → In Label (Buy Label)
    Tab 2: "Quét mã order"
      → Xác nhận đơn hoàn chỉnh
          │
          ▼
  [Receive Orders] (/receive-order)
    → Add thông tin đơn hàng đã nhận
    → Xác nhận bằng Order ID hoặc QR scan


BƯỚC 5: GIAO HÀNG & TRACKING
──────────────────────────────
  [Hậu kỳ] (/export-hk)
    → Xuất danh sách hậu kỳ theo ngày
          │
          ▼
  [Scan Track] (/scan-track)
    → Quét mã tracking vận chuyển (USPS, UPS...)
    → Liên kết tracking number ↔ Order ID
    → Ghi nhận ngày scan
    → Export data


BƯỚC 6: THANH TOÁN NHÀ CUNG CẤP
──────────────────────────────────
  [Đề nghị thanh toán] (/request-payment)
    → Dashboard: Tổng đề / Đã xác nhận / Chờ xác nhận / Đã TT / Quá hạn
    → Tạo phiếu đề nghị: NCC + Danh mục + Số tiền + Hạn TT
    → Workflow:
        Tạo mới → Chờ xác nhận → Đã xác nhận
                                → Đã thanh toán
                                → Quá hạn (alert)


════════════════════════════════════════════════════════════════════
 LUỒNG PHỤ: QUẢN LÝ CHỈ THÊU
════════════════════════════════════════════════════════════════════

  [Quản lý chỉ] (/emb-thread)
    → Danh sách cuộn chỉ: Mã chỉ | NCC | Loại chỉ | Đơn vị | Độ dài
          │
          ▼
  [Nhập kho chỉ] (/in-out → "Nhập kho sản phẩm khác")
          │
          ▼
  [Xuất kho chỉ] (/output-order → "Xuất kho chỉ")
          │
          ▼
  [Tồn kho chỉ] (/inventory-thread)
    → Theo lô: NCC | Số lô | Mã chỉ | Số lượng (cuộn) | Tiền
    → Tổng: 1.549 cuộn / 113.758.560 VND
```

---

## 5. Phân quyền người dùng (đã quan sát)

| Module | User hiện tại (Đinh Thị Duyên) |
|---|---|
| Orders | ✅ Có quyền xem/thao tác |
| Kho xưởng (toàn bộ) | ✅ Có quyền |
| QC / Scan Track | ✅ Có quyền |
| Thanh toán | ✅ Có quyền |
| Products | ❌ Không có quyền |
| Máy thêu | ❌ Không có quyền |

---

## 6. Các chỉ số kinh doanh quan sát được (hôm nay 07/06/2026)

- **Tổng đơn hàng:** 99.859 đơn | 117.507 chiếc
- **Tồn kho phôi:** 64.148 chiếc | ~578 triệu VND / 224K USD
- **Tồn kho chỉ:** 1.549 cuộn | ~114 triệu VND
- **Đơn lỗi:** 3.844 items
- **Máy thêu hoạt động:** 34 máy (Máy 1–34)
- **Tracking đã quét hôm nay:** 236 mã
- **Đề nghị thanh toán:** 56 tổng đề, 5 quá hạn
- **Đơn cảnh báo:** 467 quá 2 ngày chưa Design | 650 quá 3 ngày chưa SX xong | 579 quá 4 ngày chưa Ship