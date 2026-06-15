-- Lịch sử phiếu in báo cáo nhập kho (theo ngày hoặc theo lô nhập), kèm liên kết
-- sang đề nghị thanh toán khi báo cáo được đẩy lên thanh toán (issue #12).

CREATE TABLE IF NOT EXISTS inventory_print_history (
  id                 INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  report_type        ENUM('day','lot') NOT NULL,
  report_date        DATE NULL COMMENT 'Khi lọc báo cáo theo ngày',
  lot_id             INT UNSIGNED NULL COMMENT 'Khi lọc báo cáo theo lô nhập',
  total_qty          INT NOT NULL DEFAULT 0,
  total_amount       DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_request_id INT UNSIGNED NULL COMMENT 'Set khi đẩy báo cáo sang đề nghị thanh toán',
  printed_by         INT UNSIGNED NOT NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_iph_lot  FOREIGN KEY (lot_id) REFERENCES inventory_lots(id),
  CONSTRAINT fk_iph_pr   FOREIGN KEY (payment_request_id) REFERENCES payment_requests(id),
  CONSTRAINT fk_iph_user FOREIGN KEY (printed_by) REFERENCES users(id),
  INDEX idx_iph_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bổ sung entity_type cho activity log của phiếu in nhập kho.
ALTER TABLE activity_logs
  MODIFY COLUMN entity_type ENUM('order','order_item','payment_request','inventory_lot','inventory_in',
    'inventory_out','thread_lot','thread_in','thread_out','receive_session',
    'auto_label','machine','user','inventory_print') NOT NULL;
