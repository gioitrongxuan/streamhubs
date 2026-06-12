import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertTransition, canCancel, canTransition, timestampColumnFor } from './order-status.js';

describe('order state machine', () => {
  it('cho phép luồng happy path đầy đủ theo workflow.md', () => {
    const happyPath = [
      'new', 'designing', 'pending_review', 'designed', 'in_production', 'producing',
      'produced', 'in_finishing', 'qc_passed', 'out_stock', 'shipped', 'in_transit', 'complete',
    ] as const;
    for (let i = 0; i < happyPath.length - 1; i++) {
      assert.equal(canTransition(happyPath[i]!, happyPath[i + 1]!), true,
        `${happyPath[i]} → ${happyPath[i + 1]} phải hợp lệ`);
    }
  });

  it('chặn nhảy cóc trạng thái', () => {
    assert.equal(canTransition('new', 'shipped'), false);
    assert.equal(canTransition('designing', 'in_production'), false);
    assert.equal(canTransition('complete', 'new'), false);
  });

  it('duyệt design không đạt quay về designing', () => {
    assert.equal(canTransition('pending_review', 'designing'), true);
  });

  it('QC không đạt từ in_finishing trả về redo', () => {
    assert.equal(canTransition('in_finishing', 'redo'), true);
  });

  it('factory_return chuyển được sang xưởng khác hoặc fixing', () => {
    assert.equal(canTransition('factory_return', 'in_production'), true);
    assert.equal(canTransition('factory_return', 'fixing'), true);
  });

  it('không hủy được đơn đã bàn giao carrier', () => {
    assert.equal(canCancel('out_stock'), false);
    assert.equal(canCancel('shipped'), false);
    assert.equal(canCancel('in_transit'), false);
    assert.equal(canCancel('complete'), false);
    assert.equal(canCancel('cancelled'), false);
  });

  it('hủy được mọi trạng thái trước xuất kho', () => {
    for (const status of ['new', 'designing', 'producing', 'in_finishing', 'qc_passed'] as const) {
      assert.equal(canTransition(status, 'cancelled'), true, `${status} phải hủy được`);
    }
  });

  it('assertTransition ném ConflictError khi không hợp lệ', () => {
    assert.throws(() => assertTransition('new', 'complete'), /Không thể chuyển trạng thái/);
  });

  it('ghi đúng cột timestamp khi vào trạng thái', () => {
    assert.equal(timestampColumnFor('in_production'), 'pushed_at');
    assert.equal(timestampColumnFor('qc_passed'), 'qc_passed_at');
    assert.equal(timestampColumnFor('complete'), 'completed_at');
    assert.equal(timestampColumnFor('producing'), null);
  });
});
