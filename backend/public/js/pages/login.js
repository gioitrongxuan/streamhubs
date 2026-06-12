import { post, setToken } from '../api.js';
import { toast } from '../ui.js';

export function renderLogin(root, onSuccess) {
  root.innerHTML = `
    <div class="login-wrap">
      <div class="sh-card login-card">
        <div class="text-center mb-4">
          <div class="sh-logo">stream<span style="color:#2f80ed">hub</span><small class="text-muted">.co</small></div>
          <div class="text-muted-sm">Hệ thống quản lý vận hành</div>
        </div>
        <form id="login-form">
          <div class="mb-3"><label class="form-label">Email</label>
            <input type="email" class="form-control" name="email" required autofocus></div>
          <div class="mb-3"><label class="form-label">Mật khẩu</label>
            <input type="password" class="form-control" name="password" required></div>
          <button class="btn btn-primary w-100">Đăng nhập</button>
        </form>
      </div>
    </div>`;

  root.querySelector('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      const { token } = await post('/auth/login', {
        email: form.get('email'),
        password: form.get('password'),
      });
      setToken(token);
      location.hash = '#/dashboard';
      onSuccess();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
}
