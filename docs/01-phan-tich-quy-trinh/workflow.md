# Luồng Công việc (Workflow)

## 1. Vòng đời Order (Order Lifecycle)

```mermaid
flowchart TD
    A(["Etsy Order nhận vào"]) --> B{"Loại fulfill?"}

    B -- "Internal<br>Xưởng Streamhub" --> C["Mới"]
    B -- "External<br>EGfulfill / NCC ngoài" --> EXT["Chuyển sang hệ thống NCC"]
    EXT --> EXTSHIP["Nhận tracking → Cập nhật Etsy"]

    C --> D["Đang Design"]
    D --> PR["Chờ Duyệt Design"]
    PR -- "Không đạt" --> D
    PR -- "Duyệt OK" --> G["Đã duyệt Design"]

    G --> H["Đẩy xưởng<br>Tạo lệnh SX"]
    H --> I["Kho xuất phôi<br>Quét QR ra"]
    I --> J["Sản xuất thêu"]
    J --> K["Hậu kì<br>Cắt chỉ, KT, ủi, đóng gói"]
    K --> L["Nhận hàng từ xưởng<br>/receive-order — scan Order ID<br>Gửi từ xưởng + Phí ship + Qty gửi/nhận"]
    L --> L2["QC by-qrcode<br>Quét xác nhận (qc_passed)"]
    L2 --> M["Xuất kho\n/output-order (out_stock)"]
    M --> N["Scan tracking (shipped)\nCập nhật Etsy"]
    N --> O(["InTransit → Complete"])
```

### Trạng thái Order

| Trạng thái | `status` | Mô tả | Người phụ trách |
|------------|----------|-------|----------------|
| Mới | `new` | Order vừa nhận / tạo | Hệ thống tự tạo |
| Need Confirm | `need_confirm` | Thiếu thông tin, cần xác nhận | Manager |
| Đang Design | `designing` | Đã giao cho Designer | Designer |
| Chờ Duyệt Design | `pending_review` | File đã upload, chờ QA duyệt | Designer Senior / Manager |
| Đã duyệt design | `designed` | Design được duyệt, sẵn sàng SX | Manager |
| Chưa sản xuất | `in_production` | Đã đẩy sang xưởng, chờ làm | Production Staff |
| Đang Sản Xuất | `producing` | Đang thêu | Production Staff |
| Làm lại | `redo` | Yêu cầu làm lại | Production Staff |
| Xưởng trả lại | `factory_return` | Xưởng trả về có vấn đề | Production Staff / Warehouse |
| Sửa lại | `fixing` | Đang xử lý sửa chữa | Production Staff |
| Sản xuất xong | `produced` | Thêu xong, chuyển hậu kì | Production Staff |
| Đang hậu kỳ | `in_finishing` | Đang hậu kỳ sau khi nhận hàng từ xưởng | Finishing Staff |
| QC đạt | `qc_passed` | Quét QR `/by-qrcode` xác nhận chất lượng đạt | Finishing Staff |
| Đã xuất kho | `out_stock` | Hàng đã xuất, có tracking | Warehouse Staff |
| Shipped | `shipped` | Tracking đã cập nhật lên Etsy | Hệ thống tự động |
| InTransit | `in_transit` | Carrier đã scan nhận hàng | Carrier webhook (tự động) |
| Complete | `complete` | Đơn hoàn tất, ghi `completed_at` | Hệ thống / Manager |
| Đã hủy | `cancelled` | Đơn bị hủy (buyer request / hết hàng / Etsy cancel) | Manager / Admin |

### Luồng Hủy Đơn (`cancelled`)

```mermaid
flowchart TD
    A["Order ở bất kỳ trạng thái nào\n(trừ shipped/in_transit/complete)"] --> B{"Lý do hủy?"}
    B -- "Buyer request qua Etsy" --> C["Đồng bộ cancel từ Etsy API\norder_type = etsy"]
    B -- "Hết hàng / không thể SX" --> D["Manager/Admin hủy thủ công"]
    B -- "Lỗi đơn / nhập sai" --> D
    C --> E["orders.status = cancelled\nghi activity_log"]
    D --> E
    E --> F{"Đã xuất phôi?"}
    F -- "Có (inventory_out tồn tại)" --> G["Hoàn kho phôi\ninventory_out type = return_error"]
    F -- "Chưa" --> H["Kết thúc"]
    G --> H
```

**Quy tắc hủy đơn:**
- Có thể hủy khi status `IN (new, need_confirm, designing, pending_review, designed, in_production, producing, redo, fixing, factory_return, produced, in_finishing, qc_passed)`
- **Không được hủy** khi đã `out_stock`, `shipped`, `in_transit`, `complete` (hàng đã bàn giao carrier)
- Đơn Etsy bị hủy trên Etsy → webhook/sync tự động cập nhật về `cancelled`
- Khi hủy đơn đã có `inventory_out`, phải tạo bản ghi `inventory_out` loại `return_error` để hoàn kho
- Đơn đã gộp (`merged_order_id != NULL`): xem mục 3b

---

## 1b. Luồng External Fulfill

Áp dụng khi `orders.fulfill_type = 'external'` (đối tác EGfulfill, NCC ngoài).

```mermaid
flowchart TD
    A["Order Etsy nhận vào\nfulfill_type = external"] --> B["Designer thiết kế\n(nếu cần file thêu gửi NCC)"]
    B --> C["Đẩy sang NCC\nGửi file + thông tin qua portal/email"]
    C --> D["NCC xử lý & giao vận"]
    D --> E{"Nhận tracking?"}
    E -- "Tự động webhook" --> F["Hệ thống nhận tracking\nghi vào order_packages"]
    E -- "Nhập tay" --> G["Staff nhập tracking\n/orders/{id} > Package"]
    F --> H["Cập nhật status → shipped\nPush tracking lên Etsy"]
    G --> H
    H --> I["Tạo ĐNTT cho NCC\n/add-request-payment\npayment_group = external_fulfill"]
```

**Điểm khác biệt so với Internal:**
- Bỏ qua toàn bộ bước kho nội bộ (`inventory_lots`, `inventory_out`, QR scan)
- Bỏ qua bước sản xuất (`in_production → producing → produced`)
- Không dùng `/auto-label` (NCC tự tạo label)
- Tracking có thể nhận qua webhook (nếu NCC hỗ trợ) hoặc nhập tay
- Bắt buộc tạo ĐNTT để thanh toán chi phí fulfill

---

## 2. Luồng Quản lý Kho (Inventory Flow)

```mermaid
flowchart LR
    NCC[Nhà cung cấp\nphôi] -->|Nhập kho\n/in-out| KHO[(Kho phôi\ntheo kệ + QR)]
    KHO -->|Xuất cho SX\nQuét QR| SX[Sản xuất]
    SX -->|Sản phẩm hoàn thiện| HK[Hậu kì]
    HK -->|Quét QR xác nhận| PKG[Đóng gói]
    PKG -->|Xuất vận chuyển\n/output-order| SHIP[Vận chuyển]

    KHO -.->|Kiểm tra tồn kho\n/inventory| TK[Báo cáo Tồn kho]
```

### Quy trình Nhập kho Phôi (`/in-out`)

1. Chọn kệ đích (kệ số 1, 2, 3, 51, …)
2. Quét QR code phôi bằng camera
3. Hệ thống ghi nhận nhập kho, cập nhật số lượng trên kệ
4. In phiếu nhập kho

### Quy trình Xuất kho (`/output-order`)

1. Căn cứ lệnh sản xuất
2. Quét QR code phôi cần xuất
3. Hệ thống trừ tồn kho, ghi lịch sử xuất
4. Chuyển phôi sang tổ sản xuất

---

## 3. Luồng Đề nghị Thanh toán

```mermaid
flowchart TD
    A[Kế toán tạo ĐNTT\n/add-request-payment] --> B[Trạng thái: Chờ xác nhận]
    B --> C{Manager duyệt}
    C -- Từ chối --> D[Từ chối - chỉnh sửa lại]
    D --> B
    C -- Xác nhận --> E[Đã xác nhận]
    E --> F{Thanh toán thực tế}
    F -- Thanh toán đủ --> G[Đã thanh toán]
    F -- Thanh toán một phần --> H[Đã TT 1 phần]
    H --> F
```

### Phân loại Đề nghị Thanh toán

| Phân loại | `payment_group` | Mô tả |
|-----------|----------------|-------|
| Fulfill ngoài | `external_fulfill` | Thanh toán cho đối tác fulfill (EGfulfill, ...) |
| Phôi sản phẩm | `material` | Mua nguyên liệu thô (blank products) |
| Nguyên vật liệu thêu | `thread` | Chỉ, phụ kiện thêu |
| Phí vận chuyển | `shipping` | Phí ship nội địa / quốc tế (VD: phí ship Việt–Trung) |
| Design - File thêu | `design` | Chi phí thiết kế / file thêu từ bên ngoài |
| Khác | `other` | Các chi phí phát sinh khác (Mua ngoài, Ship lẻ, ...) |

---

## 3b. Luồng Gộp Đơn (`merged_order_id`)

Dùng khi nhiều đơn từ cùng khách, ship chung một kiện để tiết kiệm phí vận chuyển.

```mermaid
flowchart TD
    A["Staff chọn đơn chính\n(order A)"] --> B["Staff gộp đơn phụ vào\n(order B, C, ...)"]
    B --> C["order B.merged_order_id = A.id\norder C.merged_order_id = A.id"]
    C --> D["Địa chỉ ship: dùng của đơn chính A"]
    D --> E["Xử lý sản xuất từng đơn\ntheo luồng bình thường"]
    E --> F["Đóng gói chung 1 kiện\norder_packages gắn với đơn A"]
    F --> G["1 tracking dùng cho tất cả\nGhi tracking_number vào order_packages của A"]
    G --> H["Cập nhật status shipped\ncho cả A, B, C"]
```

**Quy tắc:**
- Chỉ gộp khi tất cả đơn `fulfilled_type = internal`, cùng địa chỉ giao
- Đơn phụ (B, C) vẫn xử lý design và sản xuất riêng
- Tracking chỉ tạo 1 lần trên đơn chính, đơn phụ inherit tracking
- Không gộp đơn external fulfill với internal

**Xử lý khi đơn con bị hủy sau khi đã gộp:**
- Đơn phụ (B hoặc C) bị hủy → set `orders.status = cancelled` cho đơn phụ đó, xóa/bỏ qua `merged_order_id` của đơn phụ
- Tracking đã tạo trên đơn chính (A) vẫn dùng để ship phần còn lại
- Nếu **đơn chính (A) bị hủy**: phải ungroupp — chuyển một đơn phụ lên làm đơn chính mới (staff thực hiện thủ công), tạo package + tracking mới
- Không tự động ungroupp — cần xác nhận của Manager/Admin

---

## 3c. Luồng Xưởng Trả Lại (`factory_return`)

Khi xưởng thêu không thể thực hiện hoặc trả lại sản phẩm sau khi nhận lệnh SX.

```mermaid
flowchart TD
    A["Xưởng không thể SX\nhoặc gặp vấn đề\nstatus: in_production / producing"] --> B["Xưởng thông báo cho Staff\n(kênh ngoài hệ thống hoặc ghi note)"]
    B --> C["Warehouse Staff hoặc Manager\nchuyển status → factory_return\ntại /orders hoặc /stock/order"]
    C --> D["Ghi note nguyên nhân\nvào order_item_notes"]
    D --> E{"Nguyên nhân?"}
    E -- "Xưởng hết khả năng SX" --> F["Chuyển sang xưởng khác\nthay đổi orders.supplier_id\nstatus → in_production"]
    E -- "Lỗi kỹ thuật / cần sửa file" --> G["Designer chỉnh file\nstatus → fixing"]
    E -- "Lỗi phôi" --> H["Kho xuất phôi thay thế\nstatus → fixing"]
    F --> I["Tiếp tục luồng SX bình thường"]
    G --> J["status → in_production\nSau khi xử lý xong"]
    H --> J
    J --> I
```

**Người phụ trách:** Warehouse Staff hoặc Manager chuyển trạng thái `factory_return`. Production Staff ghi nhận nguyên nhân.

---

## 4. Luồng QR Code (Vòng đời QR)

```mermaid
flowchart LR
    GEN[Tạo QR\n/gen-qrcode] -->|Gán vào phôi| LABEL[In nhãn QR]
    LABEL -->|Dán lên sản phẩm| STOCK[Phôi trong kho]
    STOCK -->|Quét khi nhập kho\n/in-out| IN[Ghi nhận nhập]
    IN -->|Quét khi xuất\n/output-order| OUT[Ghi nhận xuất]
    OUT -->|Quét sau sản xuất\n/by-qrcode| QC[QC xác nhận]
    QC -->|Quét khi giao vận\n/scan-track| TRACK[Gắn tracking]
```

---

## 5. Luồng Đơn Lỗi (`/errors`)

Đơn lỗi phát sinh khi order_item bị phát hiện lỗi trong quá trình sản xuất hoặc QC.

```mermaid
flowchart TD
    A[Phát hiện lỗi] --> B[Production/HK staff\nghi nhận: error_at + error_reason\ntrên order_item]
    B --> C{Nguồn gốc lỗi?}

    C -- "error_at = phoi\nLỗi phôi áo" --> D[Kho xuất phôi thay thế\n/output-order]
    C -- "error_at = designer\nLỗi file thiết kế" --> E[Designer chỉnh lại\nupload lại EMB/DST]
    C -- "error_at = xuong\nLỗi xưởng thêu" --> F[Làm lại tại xưởng]

    D --> G[Tái sản xuất]
    E --> G
    F --> G
    G --> H[Hoàn thành bình thường\nstatus: produced]
```

| `error_at` | Ý nghĩa | Xử lý |
|---|---|---|
| `xuong` | Lỗi do xưởng thêu | Xưởng chịu trách nhiệm làm lại |
| `designer` | Lỗi file thiết kế | Designer upload lại file |
| `phoi` | Lỗi phôi nguyên liệu | Kho xuất phôi thay thế, ghi vào `inventory_out` |

---

## 6. Luồng Orders Xưởng & Hậu kỳ

### 6.1 Orders Xưởng (`/stock/order`)

Sau khi Manager đẩy xưởng, Production Staff xem lệnh sản xuất và cập nhật tiến độ từng order_item.

**Filters trang `/stock/order`:**
- Date, Status, Order ID, SKU
- Loại sản phẩm (`product_type_id`)
- Xưởng (`supplier_id`)
- Checkbox: Sản xuất xong | Làm gấp (`labels LIKE '%lam_gap%'`)

**Columns hiển thị:** OrderID, SKU, QTY, Image, Variants, Ngày order, Ngày đẩy xưởng (`pushed_at`), Country, Trạng thái

**Mỗi order_item hiển thị:**
- Ảnh thiết kế + variants + personalization
- Item Note log (từ `order_item_notes` — có timestamp + ảnh đính kèm)
- Note đỏ: lý do làm lại / lỗi thiết kế
- Badge "Làm gấp" nếu label có `lam_gap`
- Button **Lệnh sản xuất** — in phiếu giao việc cho xưởng
- File nhanh: **EMB / DST / pdf** — download trực tiếp

```mermaid
flowchart TD
    A[Manager đẩy xưởng\norder status: in_production] --> B[Production Staff\nxem lệnh SX tại /stock/order]
    B --> C[Gắn máy thêu + operator\nmachine_id, operator_id vào order_item]
    C --> D[Bắt đầu thêu\nproduction_started_at = NOW\nstatus: producing]
    D --> E{Kết quả?}
    E -- "OK" --> F[Thêu xong\nproduction_finished_at = NOW\nstatus: produced]
    E -- "Lỗi / cần sửa" --> G[Thêm note vào order_item_notes\nerror_at + error_reason]
    G --> H[status: redo / fixing]
```

### 6.2 Receive Orders & Hậu kỳ (`/receive-order`, `/export-hk`)

Luồng hậu kì theo thứ tự: nhận hàng → hoàn thiện + QC → đóng gói xác nhận QR → xuất kho.

```mermaid
flowchart TD
    A[SX xong\nstatus: produced] --> B["Nhận hàng từ xưởng\n/receive-order\nScan Order ID → Gửi từ xưởng + Phí ship\nSố lượng gửi / nhận → receive_sessions + receive_order_logs\norders.status: in_finishing\norder_items.status: in_finishing"]
    B --> C["Hoàn thiện\n/export-hk\nCắt chỉ → KT chất lượng → ủi → đóng gói"]
    C --> D{QC đạt?}
    D -- "Không đạt" --> E["Trả lại SX\norders.status: redo\norder_items.status: redo"]
    E --> A
    D -- "Đạt" --> F["Quét QR Order ID từ sàn\n/by-qrcode\norders.status: qc_passed\nghi orders.qc_passed_at"]
    F --> G[Kho xuất kho\n/output-order\nstatus: out_stock]
    G --> H[Tạo label vận chuyển\n/auto-label]
    H --> I[Shipped — cập nhật Etsy]
```

> **Phân biệt `/export-hk` và `/by-qrcode`:**
> - `/export-hk`: Trang làm việc của Tổ Hậu kì — ghi nhận từng bước hoàn thiện (cắt chỉ, ủi, đóng gói), xác nhận QC nội bộ
> - `/by-qrcode`: Scan **QR Order ID từ sàn** (QR do Etsy/marketplace đính kèm sản phẩm, chứa order code) để hệ thống ghi nhận `qc_passed` chính thức — bắt buộc trước khi xuất kho. Khác với QR phôi (`inventory_items.qrcode`) chỉ dùng cho nhập/xuất kho.

---

## 7. Luồng Auto Label (`/auto-label`)

Tạo shipping label tự động qua API carrier, thay thế việc tạo tay trên Etsy.

```mermaid
flowchart TD
    A[Order xuất kho\nstatus: out_stock] --> B[Staff vào /auto-label\nchọn order cần tạo label]
    B --> C[Chọn carrier + service\nUSPS / FedEx / UPS]
    C --> D[Gọi API carrier\ntạo label + tracking]
    D --> E{Thành công?}
    E -- "OK" --> F[Lưu auto_labels:\ntracking_number, label_url\nstatus: generated]
    E -- "Lỗi" --> G[status: failed\nthử lại thủ công]
    F --> H[In PDF label / download]
    H --> I[Dán label lên kiện hàng]
    I --> J[Cập nhật tracking lên Etsy\nstatus: shipped]
```

| `status` | Ý nghĩa |
|---|---|
| `pending` | Chờ tạo label |
| `generated` | Label đã tạo, chưa in |
| `printed` | Đã in và dán |
| `failed` | Tạo label thất bại |

---

## 8. Dashboard Kho Xưởng (`/dashboard-supplier`)

Dashboard tổng hợp hiệu suất sản xuất theo kỳ (lọc theo ngày).

### 8.1 Trạng thái máy thêu (real-time)

Hiển thị toàn bộ máy thêu dưới dạng grid icon, màu sắc theo `machines.status`:

| Màu | `status` | Ý nghĩa |
|---|---|---|
| Xanh lá | `idle` | Đang trống, chờ việc |
| Vàng | `active` | Đang sản xuất |
| Đỏ | `error` / `maintenance` | Đang lỗi hoặc bảo trì |

Số % trên mỗi máy = tỷ lệ hoàn thành của các order_item giao cho máy đó trong kỳ:
```
% = (count order_items WHERE machine_id = X AND status = 'done') 
  / (count order_items WHERE machine_id = X) × 100
```

### 8.2 Biểu đồ theo máy

Bar chart: số lượng `order_items` hoàn thành (`status = done`) group by `machine_id` trong kỳ.

Nguồn dữ liệu: `order_items` JOIN `machines`, lọc theo `production_finished_at` trong range ngày.

### 8.3 Biểu đồ & bảng thống kê theo kỹ thuật viên

Bar chart + bảng thống kê group by `operator_id`:

| Cột | Công thức |
|---|---|
| Tổng sản phẩm | `COUNT(order_items)` WHERE operator_id = X trong kỳ |
| Đang sản xuất | `COUNT` WHERE status = `in_progress` (= `order_items.status = 'in_progress'`) |
| Sản xuất xong | `COUNT` WHERE status = `done` (= `order_items.status = 'done'`) |
| Lỗi (%) | `COUNT` WHERE `error_reason IS NOT NULL` / Tổng × 100 |
| AVG Time | `AVG(production_finished_at - production_started_at)` tính bằng phút |

> Yêu cầu: `order_items` phải có `operator_id`, `production_started_at`, `production_finished_at`.

---

## 9. Cảnh báo Vận hành (Operational Alerts)

Hệ thống hiển thị cảnh báo nổi bật trên các trang:

| Cảnh báo | Ngưỡng | Vị trí hiển thị |
|----------|--------|-----------------|
| Order quá N ngày chưa Design | 2 ngày | Trang Orders |
| Order quá N ngày chưa Sản xuất xong | 3 ngày | Trang Orders |
| Order quá N ngày chưa Ship | 4 ngày | Trang Orders |
| Order QC đạt quá 24h chưa ship | 24 tiếng | Trang Orders |
| Order QC đạt quá N ngày chưa InTransit | 5 ngày | Trang Orders |
| Order quá 1 ngày chưa SX xong | 1 ngày | Trang Stock/Order |
| Đề nghị TT sắp đến hạn | < 3 ngày | Dashboard thanh toán |
| Đề nghị TT quá hạn | Quá ngày | Dashboard thanh toán (badge đỏ) |

---

## 10. Cơ chế Cập nhật `in_transit` và `complete`

### Chuyển `shipped → in_transit`

| Phương thức | Điều kiện | Ghi chú |
|---|---|---|
| **Carrier webhook** | Carrier hỗ trợ webhook (USPS, FedEx, UPS) | Tự động khi carrier scan nhận hàng |
| **Etsy API polling** | Etsy nhận được update từ carrier và phản hồi qua API | Hệ thống poll định kỳ (khuyến nghị mỗi 6h) |
| **Nhập tay** | Carrier không hỗ trợ webhook | Warehouse Staff cập nhật thủ công tại trang Orders |

Ưu tiên: Webhook > Etsy poll > Thủ công.

### Chuyển `in_transit → complete`

Trigger khi **một trong hai** điều kiện:
1. Carrier xác nhận "Delivered" qua webhook / Etsy API
2. Manager/Admin đánh dấu hoàn tất thủ công (sau khi xác nhận với khách)

Khi `complete`: ghi `orders.completed_at = NOW()`.
