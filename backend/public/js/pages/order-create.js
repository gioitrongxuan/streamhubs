import { get, post } from '../api.js';
import { esc, options, toast, tryDo, spinner } from '../ui.js';

export async function renderOrderCreate(root) {
  root.innerHTML = spinner();
  const [shops, productTypes, users, suppliers] = await Promise.all([
    get('/shops/options'), get('/product-types'), get('/users/options'), get('/suppliers'),
  ]);

  let itemSeq = 0;
  const itemRow = () => `
    <div class="row g-2 align-items-end border-bottom pb-2 mb-2" data-item="${itemSeq++}">
      <div class="col-md-3"><label class="form-label">Loại sản phẩm *</label>
        <select class="form-select form-select-sm" data-i="product_type_id" required>${options(productTypes.data)}</select></div>
      <div class="col-md-1"><label class="form-label">SL</label>
        <input type="number" class="form-control form-control-sm" data-i="qty" value="1" min="1"></div>
      <div class="col-md-2"><label class="form-label">Giá bán ($)</label>
        <input type="number" step="0.01" class="form-control form-control-sm" data-i="price_sale"></div>
      <div class="col-md-2"><label class="form-label">SKU</label>
        <input class="form-control form-control-sm" data-i="sku"></div>
      <div class="col-md-3"><label class="form-label">Personalization</label>
        <input class="form-control form-control-sm" data-i="personalization"></div>
      <div class="col-md-1"><button type="button" class="btn btn-sm btn-outline-danger" data-remove-item>✕</button></div>
    </div>`;

  root.innerHTML = `
    <h5 class="mb-3">Tạo order</h5>
    <form id="order-form">
      <div class="sh-card mb-3"><div class="section-title">Thông tin chung</div>
        <div class="row g-3">
          <div class="col-md-3"><label class="form-label">Shop *</label>
            <select class="form-select" name="shop_id" required>${options(shops.data)}</select></div>
          <div class="col-md-3"><label class="form-label">Fulfill</label>
            <select class="form-select" name="fulfill_type">
              <option value="internal">Internal</option><option value="external">External</option></select></div>
          <div class="col-md-3"><label class="form-label">Designer</label>
            <select class="form-select" name="designer_id">${options(users.data)}</select></div>
          <div class="col-md-3"><label class="form-label">Xưởng / NCC</label>
            <select class="form-select" name="supplier_id">${options(suppliers.data)}</select></div>
          <div class="col-md-6"><label class="form-label">Tên listing</label>
            <input class="form-control" name="listing_name"></div>
          <div class="col-md-3"><label class="form-label">Labels</label>
            <input class="form-control" name="labels" placeholder="lam_gap,ship_nhanh"></div>
          <div class="col-md-3"><label class="form-label">Shop's Note</label>
            <input class="form-control" name="shop_note"></div>
        </div>
      </div>

      <div class="sh-card mb-3"><div class="section-title">Địa chỉ nhận hàng</div>
        <div class="row g-3">
          <div class="col-md-4"><label class="form-label">Tên người nhận</label><input class="form-control" name="receiver_name"></div>
          <div class="col-md-4"><label class="form-label">Địa chỉ 1</label><input class="form-control" name="address_line1"></div>
          <div class="col-md-4"><label class="form-label">Địa chỉ 2</label><input class="form-control" name="address_line2"></div>
          <div class="col-md-3"><label class="form-label">Thành phố</label><input class="form-control" name="city"></div>
          <div class="col-md-3"><label class="form-label">Bang / Tỉnh</label><input class="form-control" name="state"></div>
          <div class="col-md-2"><label class="form-label">Zipcode</label><input class="form-control" name="zipcode"></div>
          <div class="col-md-2"><label class="form-label">Quốc gia</label><input class="form-control" name="country"></div>
          <div class="col-md-2"><label class="form-label">Điện thoại</label><input class="form-control" name="phone"></div>
        </div>
      </div>

      <div class="sh-card mb-3">
        <div class="d-flex justify-content-between"><div class="section-title">Sản phẩm</div>
          <button type="button" class="btn btn-sm btn-light" data-add-item>＋ Thêm sản phẩm</button></div>
        <div id="items">${itemRow()}</div>
      </div>

      <div class="sh-card mb-3"><div class="section-title">Phí & thuế</div>
        <div class="row g-3">
          ${['discount:Giảm giá', 'shipping_fee:Phí ship', 'sales_tax:Sales tax', 'tax:Thuế khác']
            .map((pair) => {
              const [name, label] = pair.split(':');
              return `<div class="col-md-2"><label class="form-label">${label}</label>
                <input type="number" step="0.01" class="form-control" name="${name}" value="0"></div>`;
            }).join('')}
          <div class="col-md-2"><label class="form-label">Tiền tệ</label>
            <select class="form-select" name="currency"><option>USD</option><option>VND</option></select></div>
        </div>
      </div>

      <button class="btn btn-primary">Tạo order</button>
    </form>`;

  root.querySelector('[data-add-item]').onclick = () => {
    root.querySelector('#items').insertAdjacentHTML('beforeend', itemRow());
    bindRemove();
  };
  const bindRemove = () => {
    root.querySelectorAll('[data-remove-item]').forEach((btn) => {
      btn.onclick = () => {
        if (root.querySelectorAll('[data-item]').length > 1) btn.closest('[data-item]').remove();
      };
    });
  };
  bindRemove();

  root.querySelector('#order-form').onsubmit = (e) => {
    e.preventDefault();
    tryDo(async () => {
      const form = new FormData(e.target);
      const text = (name) => form.get(name) || null;
      const items = [...root.querySelectorAll('[data-item]')].map((row) => {
        const val = (key) => row.querySelector(`[data-i="${key}"]`).value;
        return {
          product_type_id: Number(val('product_type_id')),
          qty: Number(val('qty')) || 1,
          price_sale: val('price_sale') ? Number(val('price_sale')) : null,
          sku: val('sku') || null,
          personalization: val('personalization') || null,
        };
      });
      const { id } = await post('/orders', {
        shop_id: Number(form.get('shop_id')),
        fulfill_type: form.get('fulfill_type'),
        designer_id: form.get('designer_id') ? Number(form.get('designer_id')) : null,
        supplier_id: form.get('supplier_id') ? Number(form.get('supplier_id')) : null,
        listing_name: text('listing_name'), labels: text('labels'), shop_note: text('shop_note'),
        receiver_name: text('receiver_name'), address_line1: text('address_line1'),
        address_line2: text('address_line2'), city: text('city'), state: text('state'),
        zipcode: text('zipcode'), country: text('country'), phone: text('phone'),
        discount: Number(form.get('discount')) || 0, shipping_fee: Number(form.get('shipping_fee')) || 0,
        sales_tax: Number(form.get('sales_tax')) || 0, tax: Number(form.get('tax')) || 0,
        currency: form.get('currency'),
        items,
      });
      toast('Đã tạo order');
      location.hash = `#/orders/${id}`;
    });
  };
}
