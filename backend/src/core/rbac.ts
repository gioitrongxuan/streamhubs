/**
 * RBAC theo docs/03-quan-tri-he-thong/phan-quyen-rbac.md.
 *
 * permissions JSON có dạng: module → action → true | false | "own"
 * - `{"*": true}`            : toàn quyền (admin)
 * - `"warehouse": false`     : chặn cả module
 * - `"edit": "own"`          : chỉ thao tác trên bản ghi mình phụ trách
 *                              (service tự kiểm tra ownership)
 */
export type PermissionValue = boolean | 'own';
export type Permissions = Record<string, unknown>;

/**
 * Tra quyền theo key dạng "module.action" (VD: "orders.upload_design").
 * Trả về true / false / 'own'.
 */
export function resolvePermission(permissions: Permissions, key: string): PermissionValue {
  if (permissions['*'] === true) return true;

  let node: unknown = permissions;
  for (const part of key.split('.')) {
    // Cấp quyền cả module bằng `"payment": true` (hoặc 'own') — áp cho mọi action bên trong
    if (node === true || node === 'own') return node;
    if (node === null || typeof node !== 'object') return false;
    node = (node as Record<string, unknown>)[part];
  }
  if (node === true || node === 'own') return node;
  return false;
}

export function hasPermission(permissions: Permissions, key: string): boolean {
  return resolvePermission(permissions, key) !== false;
}
