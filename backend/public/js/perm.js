// Bản sao client của core/rbac.ts (backend vẫn là nơi chặn thật) —
// chỉ dùng để ẩn/hiện menu và nút theo quyền.
export function resolvePermission(permissions, key) {
  if (!permissions) return false;
  if (permissions['*'] === true) return true;
  let node = permissions;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return false;
    node = node[part];
  }
  if (node === true || node === 'own') return node;
  return false;
}

export const hasPerm = (permissions, key) => resolvePermission(permissions, key) !== false;
