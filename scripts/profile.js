// ============================================================
// RIEKER TECH — USER PROFILE & SECURITY SCRIPT
// Profile updates & Bcrypt password change handler
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const user = window.auth.requireAuth();
    if (!user) return;

    // Render Shell Navigation
    const sb = document.getElementById('sidebar-container');
    const hd = document.getElementById('header-container');
    if (sb) sb.innerHTML = window.renderSidebar('profile');
    if (hd) hd.innerHTML = window.renderHeader();

    // Elements
    const avatarPreview    = document.getElementById('avatarPreview');
    const displayFullname  = document.getElementById('displayFullname');
    const displayUsername  = document.getElementById('displayUsername');
    const rolePill         = document.getElementById('rolePill');

    const inputFullname    = document.getElementById('inputFullname');
    const inputUsername    = document.getElementById('inputUsername');
    const inputEmail       = document.getElementById('inputEmail');
    const inputPhone       = document.getElementById('inputPhone');
    const inputDepartment  = document.getElementById('inputDepartment');
    const profileInfoForm  = document.getElementById('profileInfoForm');
    const saveProfileBtn   = document.getElementById('saveProfileBtn');

    const changePasswordForm = document.getElementById('changePasswordForm');
    const currentPassInput   = document.getElementById('currentPassInput');
    const newPassInput       = document.getElementById('newPassInput');
    const confirmPassInput   = document.getElementById('confirmPassInput');
    const changePassBtn      = document.getElementById('changePassBtn');
    const mismatchMsg        = document.getElementById('passwordMismatchMsg');

    const seg1 = document.getElementById('seg1');
    const seg2 = document.getElementById('seg2');
    const seg3 = document.getElementById('seg3');
    const strengthLabel = document.getElementById('strengthLabel');

    // ─── 1. Populate Current Data ─────────────────────────────
    async function loadUserData() {
        let currentUser = window.auth.getCurrentUser() || user;

        // Tải thông tin mới nhất từ database nếu có authSupabase
        if (currentUser && currentUser.id && window.supabaseClient) {
            try {
                const { data: dbUser } = await window.supabaseClient
                    .from('app_users')
                    .select('id, username, name, email, role, avatar')
                    .eq('id', currentUser.id)
                    .maybeSingle();

                if (dbUser && dbUser.email) {
                    currentUser.email = dbUser.email;
                    localStorage.setItem('auth_user', JSON.stringify({ ...currentUser, email: dbUser.email }));
                }
            } catch (err) {
                console.warn('Không thể refresh user từ DB:', err);
            }
        }

        if (displayFullname) displayFullname.textContent = currentUser.name || 'Người dùng';
        if (displayUsername) displayUsername.textContent = `@${currentUser.username}`;
        if (avatarPreview)   avatarPreview.src = currentUser.avatar || 'https://ui-avatars.com/api/?name=User&background=27272a&color=fff';

        if (inputFullname)   inputFullname.value = currentUser.name || '';
        if (inputUsername)   inputUsername.value = currentUser.username || '';
        if (inputEmail)      inputEmail.value = currentUser.email || '';
        if (inputPhone)      inputPhone.value = currentUser.phone || '';
        if (inputDepartment && currentUser.department) {
            inputDepartment.value = currentUser.department;
        }

        // Role styling
        if (rolePill) {
            rolePill.className = `role-pill ${currentUser.role || 'worker'}`;
            const roleLabels = {
                admin: 'Quản Trị Viên (Admin)',
                technician: 'Kỹ Thuật Viên Cơ Điện',
                worker: 'Công Nhân Sản Xuất'
            };
            rolePill.textContent = roleLabels[currentUser.role] || currentUser.role;
        }
    }

    loadUserData();

    // ─── 2. Handle Profile Info Update ────────────────────────
    if (profileInfoForm) {
        profileInfoForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const originalBtn = saveProfileBtn.innerHTML;
            saveProfileBtn.disabled = true;
            saveProfileBtn.innerHTML = '<div class="spinner" style="border-width:2px;width:14px;height:14px;margin-right:6px;"></div> Đang lưu...';

            const name = inputFullname.value.trim();
            const email = inputEmail ? inputEmail.value.trim() : '';
            const phone = inputPhone.value.trim();
            const department = inputDepartment.value;

            // Generate fresh avatar if name changed
            const currentUser = window.auth.getCurrentUser();
            const color = currentUser.role === 'admin' ? '00d4ff' : (currentUser.role === 'technician' ? 'f59e0b' : '10b981');
            const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=000`;

            const res = await window.auth.updateProfile({
                name,
                email,
                phone,
                department,
                avatar
            });

            saveProfileBtn.disabled = false;
            saveProfileBtn.innerHTML = originalBtn;

            if (res.success) {
                loadUserData();

                // Re-render sidebar to reflect updated name and department
                if (sb) sb.innerHTML = window.renderSidebar('profile');

                window.showSonnerToast && window.showSonnerToast({
                    title: 'Cập Nhật Thành Công',
                    description: 'Thông tin cá nhân của bạn đã được lưu lại',
                    level: 'success',
                    playSound: true
                });
            } else {
                window.showSonnerToast && window.showSonnerToast({
                    title: 'Lỗi Cập Nhật',
                    description: res.message,
                    level: 'danger',
                    playSound: true
                });
            }
        });
    }

    // ─── 3. Password Strength Meter ───────────────────────────
    if (newPassInput) {
        newPassInput.addEventListener('input', () => {
            const pass = newPassInput.value;

            // Reset thanh màu
            seg1.style.background = 'var(--border-subtle)';
            seg2.style.background = 'var(--border-subtle)';
            seg3.style.background = 'var(--border-subtle)';

            if (pass.length === 0) {
                strengthLabel.textContent = 'Độ mạnh: Chưa nhập';
                strengthLabel.style.color = 'var(--text-muted)';
                checkConfirmPasswordMatch();
                return;
            }

            // Dưới 6 ký tự luôn là Yếu
            if (pass.length < 6) {
                seg1.style.background = 'var(--p1-red)';
                strengthLabel.textContent = 'Độ mạnh: Yếu (cần tối thiểu 6 ký tự)';
                strengthLabel.style.color = 'var(--p1-red)';
                checkConfirmPasswordMatch();
                return;
            }

            let score = 1; // Đã đạt >= 6 ký tự
            if (pass.length >= 8 && (/[A-Z]/.test(pass) || /[0-9]/.test(pass))) score++;
            if (pass.length >= 10 && /[A-Z]/.test(pass) && /[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score++;

            if (score === 1) {
                seg1.style.background = 'var(--p1-red)';
                strengthLabel.textContent = 'Độ mạnh: Yếu';
                strengthLabel.style.color = 'var(--p1-red)';
            } else if (score === 2) {
                seg1.style.background = 'var(--p2-amber)';
                seg2.style.background = 'var(--p2-amber)';
                strengthLabel.textContent = 'Độ mạnh: Trung bình';
                strengthLabel.style.color = 'var(--p2-amber)';
            } else {
                seg1.style.background = 'var(--success)';
                seg2.style.background = 'var(--success)';
                seg3.style.background = 'var(--success)';
                strengthLabel.textContent = 'Độ mạnh: Mạnh';
                strengthLabel.style.color = 'var(--success)';
            }

            checkConfirmPasswordMatch();
        });
    }

    if (confirmPassInput) {
        confirmPassInput.addEventListener('input', checkConfirmPasswordMatch);
    }

    function checkConfirmPasswordMatch() {
        if (!confirmPassInput || !newPassInput || !mismatchMsg) return true;
        if (confirmPassInput.value && confirmPassInput.value !== newPassInput.value) {
            mismatchMsg.style.display = 'block';
            return false;
        } else {
            mismatchMsg.style.display = 'none';
            return true;
        }
    }

    // ─── 4. Handle Password Change Submit ──────────────────────
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const currentPass = currentPassInput.value;
            const newPass = newPassInput.value;
            const confirmPass = confirmPassInput.value;

            if (newPass.length < 6) {
                window.showSonnerToast && window.showSonnerToast({
                    title: 'Mật Khẩu Quá Ngắn',
                    description: 'Mật khẩu mới phải có ít nhất 6 ký tự để đảm bảo an toàn',
                    level: 'warning',
                    playSound: false
                });
                return;
            }

            if (newPass !== confirmPass) {
                mismatchMsg.style.display = 'block';
                return;
            }

            const originalBtn = changePassBtn.innerHTML;
            changePassBtn.disabled = true;
            changePassBtn.innerHTML = '<div class="spinner" style="border-width:2px;width:14px;height:14px;margin-right:6px;"></div> Đang lưu...';

            const res = await window.auth.changePassword(currentPass, newPass);

            changePassBtn.disabled = false;
            changePassBtn.innerHTML = originalBtn;

            if (res.success) {
                changePasswordForm.reset();
                if (strengthLabel) strengthLabel.textContent = 'Độ mạnh mật khẩu: Chưa nhập';
                seg1.style.background = 'var(--border-subtle)';
                seg2.style.background = 'var(--border-subtle)';
                seg3.style.background = 'var(--border-subtle)';

                window.showSonnerToast && window.showSonnerToast({
                    title: 'Thành Công',
                    description: 'Đã đổi mật khẩu thành công.',
                    level: 'success',
                    playSound: true
                });
            } else {
                window.showSonnerToast && window.showSonnerToast({
                    title: 'Lỗi',
                    description: res.message || 'Không thể đổi mật khẩu.',
                    level: 'danger',
                    playSound: true
                });
            }
        });
    }
});

// Toggle password input visibility (Show/Hide Eye)
window.togglePassVisibility = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.innerHTML = isPass ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
};
