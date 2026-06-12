import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission, resolvePermission } from './rbac.js';

describe('RBAC resolvePermission', () => {
  const designer = {
    orders: { view: true, edit: 'own', upload_design: true, push_factory: false },
    warehouse: false,
    payment: false,
  };

  it('admin với {"*": true} có mọi quyền', () => {
    assert.equal(resolvePermission({ '*': true }, 'orders.delete'), true);
    assert.equal(resolvePermission({ '*': true }, 'system.configs'), true);
  });

  it('trả về đúng giá trị true / false / own', () => {
    assert.equal(resolvePermission(designer, 'orders.view'), true);
    assert.equal(resolvePermission(designer, 'orders.edit'), 'own');
    assert.equal(resolvePermission(designer, 'orders.push_factory'), false);
  });

  it('module bị chặn cả khối (false) thì mọi action đều bị từ chối', () => {
    assert.equal(resolvePermission(designer, 'warehouse.inventory_in'), false);
    assert.equal(hasPermission(designer, 'payment.create'), false);
  });

  it('key không tồn tại → từ chối (deny by default)', () => {
    assert.equal(resolvePermission(designer, 'orders.unknown_action'), false);
    assert.equal(resolvePermission(designer, 'unknown_module.x'), false);
  });

  it('cấp quyền cả module bằng true / own áp cho mọi action bên trong', () => {
    assert.equal(resolvePermission({ payment: true }, 'payment.create'), true);
    assert.equal(resolvePermission({ orders: 'own' }, 'orders.edit'), 'own');
    assert.equal(resolvePermission({ payment: true }, 'orders.view'), false);
  });

  it('hasPermission coi "own" là được phép (service tự kiểm tra ownership)', () => {
    assert.equal(hasPermission(designer, 'orders.edit'), true);
  });
});
