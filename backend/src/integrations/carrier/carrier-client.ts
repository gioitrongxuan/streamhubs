/**
 * Biên tích hợp với carrier (USPS/FedEx/UPS...).
 * Service chỉ phụ thuộc interface — thay nhà vận chuyển = thêm adapter mới,
 * không sửa business logic (Dependency Inversion).
 */
export interface CreateLabelRequest {
  carrier: string;
  service?: string;
  receiver: {
    name: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    zipcode: string | null;
    country: string | null;
    phone: string | null;
  };
  weight_gram?: number | null;
}

export interface CreateLabelResult {
  tracking_number: string;
  label_url: string;
}

export interface CarrierClient {
  createLabel(request: CreateLabelRequest): Promise<CreateLabelResult>;
}

/**
 * Stub cho môi trường dev/chưa ký hợp đồng carrier API.
 * Production: thay bằng UspsCarrierClient / FedexCarrierClient... qua factory này.
 */
export class StubCarrierClient implements CarrierClient {
  async createLabel(request: CreateLabelRequest): Promise<CreateLabelResult> {
    const trackingNumber = `${request.carrier.toUpperCase()}-${Date.now()}`;
    return { tracking_number: trackingNumber, label_url: `/files/labels/${trackingNumber}.pdf` };
  }
}

export function createCarrierClient(): CarrierClient {
  return new StubCarrierClient();
}
