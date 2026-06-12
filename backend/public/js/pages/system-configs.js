import { get, put } from '../api.js';
import { esc, spinner, toast, tryDo } from '../ui.js';

export async function renderSystemConfigs(root) {
  root.innerHTML = spinner();
  const configs = (await get('/system-configs')).data;
  const groups = [...new Set(configs.map((c) => c.group))];

  root.innerHTML = `
    <h5 class="mb-3">Cấu hình hệ thống</h5>
    ${groups.map((group) => `
      <div class="sh-card mb-3">
        <div class="section-title text-uppercase">${esc(group)}</div>
        <table class="sh-table"><tbody>
          ${configs.filter((c) => c.group === group).map((c) => `<tr>
            <td style="width:280px"><code>${esc(c.key)}</code>
              <div class="text-muted-sm">${esc(c.description ?? '')}</div></td>
            <td style="width:260px"><input class="form-control form-control-sm" data-key="${esc(c.key)}" value="${esc(c.value)}"></td>
            <td style="width:90px"><button class="btn btn-sm btn-light" data-save="${esc(c.key)}">Lưu</button></td>
          </tr>`).join('')}
        </tbody></table>
      </div>`).join('')}`;

  root.querySelectorAll('[data-save]').forEach((btn) => {
    btn.onclick = () => tryDo(async () => {
      const key = btn.dataset.save;
      await put(`/system-configs/${encodeURIComponent(key)}`, {
        value: root.querySelector(`[data-key="${key}"]`).value,
      });
      toast(`Đã lưu ${key}`);
    });
  });
}
