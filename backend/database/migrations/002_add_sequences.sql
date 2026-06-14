-- Bảng counter atomic cho việc sinh serial number không bị race condition.
-- INSERT ... ON DUPLICATE KEY UPDATE giữ row-lock, ngăn hai transaction
-- đọc cùng giá trị rồi cùng tính ra serial trùng nhau.

CREATE TABLE IF NOT EXISTS sequences (
  name        VARCHAR(50) PRIMARY KEY,
  current_val INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Khởi tạo counter từ dữ liệu hiện có trong payment_requests
-- để tránh reuse serial_number khi migration chạy trên DB đang có data.
INSERT INTO sequences (name, current_val)
SELECT
  CONCAT('payment_request_', prefix) AS name,
  MAX(CAST(SUBSTRING(serial_number, 7) AS UNSIGNED)) AS current_val
FROM (
  SELECT serial_number, LEFT(serial_number, 6) AS prefix
  FROM payment_requests
) t
GROUP BY prefix
ON DUPLICATE KEY UPDATE current_val = VALUES(current_val);
