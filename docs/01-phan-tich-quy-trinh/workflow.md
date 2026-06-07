# Luồng Công việc (Workflow)

## 1. Vòng đời Order (Order Lifecycle)

```mermaid
flowchart TD
    A([Etsy Order nhận vào]) --> B{Loại fulfill?}

    B -- Internal\nXưởng Streamhub --> C[Mới]
    B -- External\nEGfulfill / NCC ngoài --> EXT[Chuyển sang hệ thống NCC]
    EXT --> EXTSHIP[Nhận tracking → Cập nhật Etsy]

    C --> D[Đang Design]
    D --> E{File thiết kế OK?}
    E -- Lỗi --> F[Đơn lỗi\n/errors]
    F --> D
    E -- OK --> G[Đã Design]

    G --> H[Đẩy xưởng\nTạo lệnh SX]
    H --> I[Kho xuất phôi\nQuét QR ra]
    I --> J[Sản xuất thêu]
    J --> K[Hậu kì\nCắt chỉ, KT, ủi, đóng gói]
    K --> L[QC by-qrcode\nQuét xác nhận]
    L --> M[Xuất kho\nQuét tracking]
    M --> N([Shipped → Cập nhật Etsy])
```

### Trạng thái Order

| Trạng thái | Mô tả | Người phụ trách |
|------------|-------|----------------|
| Mới | Order vừa nhận từ Etsy | Hệ thống tự tạo |
| Đang Design | Đã giao cho Designer | Designer |
| Đã Design | File thiết kế đã upload | Designer |
| Chưa sản xuất | Đã đẩy sang xưởng, chờ làm | Production Staff |
| Đang sản xuất | Đang thêu | Production Staff |
| Sản xuất xong | Thêu xong, chuyển hậu kì | Production Staff |
| Đã xuất kho | Hàng đã xuất, có tracking | Warehouse Staff |
| Shipped | Tracking đã cập nhật Etsy | Hệ thống tự động |

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
    C -- Từ chối --> D[Trả lại chỉnh sửa]
    D --> B
    C -- Xác nhận --> E[Đã xác nhận]
    E --> F[Thanh toán thực tế]
    F --> G[Đã thanh toán]
```

### Phân loại Đề nghị Thanh toán

| Phân loại | Mô tả |
|-----------|-------|
| Fulfill ngoài | Thanh toán cho đối tác fulfill (EGfulfill, ...) |
| Phôi sản phẩm | Mua nguyên liệu thô (blank products) |
| Nguyên vật liệu thêu | Chỉ, phụ kiện thêu |
| Khác | Các chi phí phát sinh khác |

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

## 5. Cảnh báo Vận hành (Operational Alerts)

Hệ thống hiển thị cảnh báo nổi bật trên các trang:

| Cảnh báo | Ngưỡng | Vị trí hiển thị |
|----------|--------|-----------------|
| Order quá N ngày chưa Design | 2 ngày | Trang Orders |
| Order quá N ngày chưa Sản xuất xong | 3 ngày | Trang Orders |
| Order quá 1 ngày chưa SX xong | 1 ngày | Trang Stock/Order |
| Đề nghị TT sắp đến hạn | < 3 ngày | Dashboard thanh toán |
| Đề nghị TT quá hạn | Quá ngày | Dashboard thanh toán (badge đỏ) |
