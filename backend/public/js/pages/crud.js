// Factory trang CRUD master-data: bảng + modal Tạo mới/Sửa.
// Một cấu hình khai báo = một trang hoàn chỉnh (suppliers, shelves, machines, ...).
import { get, post, patch } from '../api.js';
import { esc, openModal, toast, tryDo, spinner } from '../ui.js';
import { hasPerm } from '../perm.js';
import { state } from '../app.js';

/**
 * cfg = {
 *   title, endpoint,
 *   columns: [{ key, label, render?(row) }],
 *   fields:  [{ name, label, type: 'text'|'number'|'select'|'checkbox'|'textarea'|'date',
 *               required?, options? (object|array), optionsEndpoint?, optionLabel?, step?, hint? }],
 *   writePerm,            // quyền cho Tạo/Sửa (ẩn nút nếu thiếu)
 *   toPayload?(values),   // tùy biến payload trước khi gửi
 * }
 */
export function crudPage(cfg) {
  return async function render(root) {
    root.innerHTML = spinner();
    const [listRes, ...optionLists] = await Promise.all([
      get(cfg.endpoint),
      ...cfg.fields.filter((f) => f.optionsEndpoint).map((f) => get(f.optionsEndpoint)),
    ]);
    const optionData = {};
    cfg.fields.filter((f) => f.optionsEndpoint).forEach((f, i) => { optionData[f.name] = optionLists[i].data; });

    const canWrite = !cfg.writePerm || hasPerm(state.user.permissions, cfg.writePerm);
    const canEdit = canWrite && cfg.editable !== false;
    const rows = listRes.data;

    root.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="m-0">${esc(cfg.title)}</h5>
        ${canWrite ? '<button class="btn btn-primary btn-sm" data-create>＋ Tạo mới</button>' : ''}
      </div>
      <div class="sh-card p-0">
        <div class="table-responsive"><table class="sh-table">
          <thead><tr><th>#</th>${cfg.columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}${canEdit ? '<th></th>' : ''}</tr></thead>
          <tbody>
            ${rows.map((row, i) => `<tr>
              <td class="text-muted-sm">${i + 1}</td>
              ${cfg.columns.map((c) => `<td>${c.render ? c.render(row) : esc(row[c.key] ?? '—')}</td>`).join('')}
              ${canEdit ? `<td class="text-end"><button class="btn btn-sm btn-light" data-edit="${row.id}">Sửa</button></td>` : ''}
            </tr>`).join('') || `<tr><td colspan="20" class="text-center text-muted py-4">Chưa có dữ liệu</td></tr>`}
          </tbody>
        </table></div>
      </div>`;

    const openForm = (row) => {
      openModal({
        title: row ? `Sửa ${cfg.title.toLowerCase()}` : `Tạo ${cfg.title.toLowerCase()}`,
        body: `<form data-form class="row g-3">${cfg.fields.map((f) => fieldHtml(f, row, optionData)).join('')}</form>`,
        footer: `<button class="btn btn-light" data-close>Hủy</button>
                 <button class="btn btn-primary" data-save>${row ? 'Lưu' : 'Tạo mới'}</button>`,
        onMount: (el, close) => {
          el.querySelector('[data-save]').onclick = () =>
            tryDo(async () => {
              const values = readForm(el.querySelector('[data-form]'), cfg.fields);
              const payload = cfg.toPayload ? cfg.toPayload(values) : values;
              if (row) await patch(`${cfg.endpoint}/${row.id}`, payload);
              else await post(cfg.endpoint, payload);
              toast(row ? 'Đã cập nhật' : 'Đã tạo mới');
              close();
              render(root);
            });
        },
      });
    };

    root.querySelector('[data-create]')?.addEventListener('click', () => openForm(null));
    root.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.onclick = () => openForm(rows.find((r) => String(r.id) === btn.dataset.edit));
    });
  };
}

function fieldHtml(field, row, optionData) {
  const value = row ? (field.fromRow ? field.fromRow(row) : row[field.name]) : field.default;
  const required = field.required ? 'required' : '';
  let input;
  switch (field.type) {
    case 'select': {
      let opts = field.options ?? optionData[field.name] ?? [];
      if (!Array.isArray(opts)) opts = Object.entries(opts).map(([id, name]) => ({ id, name }));
      const labelKey = field.optionLabel ?? 'name';
      input = `<select class="form-select" name="${field.name}" ${required}>
        <option value="">— Chọn —</option>
        ${opts.map((o) => `<option value="${esc(o.id)}" ${String(o.id) === String(value) ? 'selected' : ''}>${esc(o[labelKey] ?? o.name)}</option>`).join('')}
      </select>`;
      break;
    }
    case 'checkbox':
      input = `<div class="form-check mt-2"><input type="checkbox" class="form-check-input" name="${field.name}"
        ${value === undefined ? 'checked' : value ? 'checked' : ''}></div>`;
      break;
    case 'textarea':
      input = `<textarea class="form-control" name="${field.name}" rows="3" ${required}>${esc(value ?? '')}</textarea>`;
      break;
    default:
      input = `<input type="${field.type ?? 'text'}" class="form-control" name="${field.name}"
        value="${esc(value ?? '')}" ${field.step ? `step="${field.step}"` : ''} ${required}>`;
  }
  return `<div class="col-md-${field.col ?? 6}"><label class="form-label">${esc(field.label)}</label>${input}
    ${field.hint ? `<div class="text-muted-sm">${esc(field.hint)}</div>` : ''}</div>`;
}

export function readForm(form, fields) {
  const values = {};
  for (const field of fields) {
    const input = form.querySelector(`[name="${field.name}"]`);
    if (!input) continue;
    if (field.type === 'checkbox') values[field.name] = input.checked;
    else if (field.type === 'number') values[field.name] = input.value === '' ? null : Number(input.value);
    else if (field.type === 'select') {
      const raw = input.value;
      if (raw === '') values[field.name] = null;
      else values[field.name] = field.numeric === false ? raw : (Number.isNaN(Number(raw)) ? raw : Number(raw));
    } else values[field.name] = input.value === '' ? null : input.value;
  }
  return values;
}
