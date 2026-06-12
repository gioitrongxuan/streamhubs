/** Lỗi nghiệp vụ có HTTP status — error handler dịch thành response JSON. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Dữ liệu không hợp lệ') {
    super(400, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Chưa đăng nhập hoặc phiên hết hạn') {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Không có quyền thực hiện thao tác này') {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Không tìm thấy dữ liệu') {
    super(404, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Thao tác xung đột với trạng thái hiện tại') {
    super(409, message);
  }
}
