/**
 * Biên tích hợp Etsy (docs/02-kien-truc-csdl/kien-truc-he-thong.md — Tích hợp bên ngoài).
 * Service/worker chỉ phụ thuộc interface này; khi có Etsy API key thật,
 * viết EtsyApiClient implement cùng interface — không sửa chỗ gọi.
 *
 * Worker đồng bộ (roadmap): poll theo shops.sync_interval, map đơn mới
 * vào orders/order_items (order_type = 'etsy'), và đẩy tracking khi shipped.
 */
export interface EtsyOrderLineItem {
  listing_id: string;
  sku: string | null;
  qty: number;
  price: number;
  variants: Record<string, string>;
  personalization: string | null;
}

export interface EtsyOrder {
  etsy_order_id: string;
  buyer_name: string;
  address: {
    line1: string; line2: string | null; city: string; state: string | null;
    zipcode: string; country: string; phone: string | null;
  };
  listing_name: string;
  item_total: number;
  discount: number;
  shipping_fee: number;
  sales_tax: number;
  currency: string;
  personalization_note: string | null;
  line_items: EtsyOrderLineItem[];
  created_at: string;
}

export interface EtsyClient {
  /** Lấy các order mới kể từ lần sync trước của shop. */
  fetchNewOrders(etsyShopId: string, since: Date): Promise<EtsyOrder[]>;
  /** Đẩy tracking lên Etsy khi order chuyển shipped. */
  pushTracking(etsyShopId: string, etsyOrderId: string, trackingNumber: string, carrier: string): Promise<void>;
}

/** Stub cho dev — chưa có hợp đồng Etsy API. */
export class StubEtsyClient implements EtsyClient {
  async fetchNewOrders(): Promise<EtsyOrder[]> {
    return [];
  }
  async pushTracking(): Promise<void> {
    // no-op
  }
}

export function createEtsyClient(): EtsyClient {
  return new StubEtsyClient();
}
