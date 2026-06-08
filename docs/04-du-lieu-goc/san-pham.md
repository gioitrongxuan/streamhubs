# Dữ liệu Gốc — Sản phẩm

## 1. Loại Sản phẩm (`product_types`)

Danh mục loại sản phẩm là nền tảng để phân loại order, giao xưởng và lập kế hoạch sản xuất.

### Danh sách mẫu (từ dữ liệu thực tế)

| ID | Mã | Tên sản phẩm | Design Level | NCC mặc định |
|----|----|--------------|:------------:|:------------:|
| 112 | BBN | Baby Banner | — | Streamhub |
| 25 | HDI | Hoodie | — | Streamhub |
| — | SWS | Sweatshirt | — | Streamhub |
| — | — | (thêm theo thực tế) | — | — |

### Thuộc tính

| Thuộc tính | Mô tả |
|-----------|-------|
| `name` | Tên hiển thị (Baby Banner, Hoodie, ...) |
| `short_name` | Mã nội bộ ngắn, dùng trong SKU (VD: `EQZ`, `HDI`, `BBN`) |
| `design_level_id` | Liên kết cấp độ thiết kế |
| `default_supplier_id` | Xưởng SX mặc định |
| `is_active` | Đang sử dụng hay không |

---

## 2. Cấp độ Thiết kế (`design_levels`)

Cấp độ thiết kế phản ánh độ phức tạp của file thiết kế cần tạo, ảnh hưởng đến việc phân công Designer và ước tính thời gian xử lý.

### Ví dụ cấp độ

| Level | Mô tả | Thời gian ước tính |
|-------|-------|-------------------|
| Level 1 | Thiết kế đơn giản, 1 vị trí thêu, text cơ bản | < 15 phút |
| Level 2 | 2 vị trí thêu hoặc font phức tạp | 15–30 phút |
| Level 3 | Thiết kế phức tạp, nhiều màu chỉ, nhiều vị trí | > 30 phút |

---

## 3. Cấu trúc SKU

SKU được dùng xuyên suốt từ order đến xuất kho:

```
{PRODUCT_TYPE_CODE}{SEQ_NUMBER}
Ví dụ: ESW06349  =  E (prefix Etsy?) + SW (Sweatshirt) + 06349 (sequence)
```

> **Lưu ý:** Cần xác nhận thêm quy tắc đặt SKU chính xác từ team vận hành.

---

## 4. Variants (Biến thể sản phẩm)

Biến thể được lưu dạng JSON trong `order_items.variants`. Các dimension thường gặp:

| Dimension | Giá trị mẫu |
|-----------|-------------|
| Size | XS, S, M, L, XL, 2XL, 3XL |
| Color | White, Black, Navy, Gray, ... |
| Style | Hoodie, Sweatshirt, T-Shirt, ... |
| Stream Option | Yes/No (sleeve embroidery, ...) |

---

## 5. Vị trí Thêu (Embroidery Position)

Mỗi sản phẩm có thể có nhiều vị trí thêu, mỗi vị trí cần file thiết kế riêng:

| Vị trí | Mã | Ghi chú |
|--------|----|---------|
| Giữa ngực | CHEST | Vị trí phổ biến nhất |
| Tay áo trái | L_SLEEVE | Stream option |
| Tay áo phải | R_SLEEVE | Stream option |
| Lưng | BACK | Ít phổ biến |
| Mũ (cap) | CAP | Riêng cho mũ |
