// Theme Management (Light / Dark Mode with localStorage)
function getSavedTheme() {
    return localStorage.getItem('rieker_theme') || 'dark';
}

function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light') {
        root.setAttribute('data-theme', 'light');
        if (document.body) document.body.classList.add('theme-light');
    } else {
        root.removeAttribute('data-theme');
        if (document.body) document.body.classList.remove('theme-light');
    }
    localStorage.setItem('rieker_theme', theme);

    // Update toggle icon if in DOM
    const icon = document.getElementById('themeToggleIcon');
    const btn = document.getElementById('themeToggleBtn');
    if (icon) {
        icon.className = theme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    }
    if (btn) {
        btn.setAttribute('title', theme === 'light' ? 'Chuyển sang chế độ Tối (Dark)' : 'Chuyển sang chế độ Sáng (Light)');
    }

    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
}

function toggleTheme() {
    const current = getSavedTheme();
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
}

// Immediately apply theme on script run to avoid FOUC
applyTheme(getSavedTheme());

window.getSavedTheme = getSavedTheme;
window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;

function renderSidebar(activePage) {
    const user = window.auth ? window.auth.getCurrentUser() : { role: 'worker', name: 'Công Nhân', avatar: '' };

    let navItems = '';

    if (user.role === 'admin') {
        navItems += `
            <a href="index.html" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}">
                <i class="fa-solid fa-chart-pie"></i><span>Tổng Quan Hệ Thống</span>
            </a>
            <a href="analytics.html" class="nav-item ${activePage === 'analytics' ? 'active' : ''}">
                <i class="fa-solid fa-chart-line"></i><span>Thống Kê Sự Cố</span>
            </a>
            <a href="devices.html" class="nav-item ${activePage === 'devices' ? 'active' : ''}">
                <i class="fa-solid fa-server"></i><span>Quản Lý Máy Móc</span>
            </a>
            <a href="users.html" class="nav-item ${activePage === 'users' ? 'active' : ''}">
                <i class="fa-solid fa-users"></i><span>Quản Lý Người Dùng</span>
            </a>
            <a href="profile.html" class="nav-item ${activePage === 'profile' ? 'active' : ''}">
                <i class="fa-solid fa-user-shield"></i><span>Hồ Sơ &amp; Bảo Mật</span>
            </a>
        `;
    } else if (user.role === 'technician') {
        navItems += `
            <a href="index.html" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}">
                <i class="fa-solid fa-clipboard-check"></i><span>Danh Sách Yêu Cầu</span>
            </a>
            <a href="history.html" class="nav-item ${activePage === 'history' ? 'active' : ''}">
                <i class="fa-solid fa-clock-rotate-left"></i><span>Lịch Sử Bảo Trì</span>
            </a>
            <a href="profile.html" class="nav-item ${activePage === 'profile' ? 'active' : ''}">
                <i class="fa-solid fa-user-shield"></i><span>Hồ Sơ &amp; Bảo Mật</span>
            </a>
        `;
    } else { // Worker
        navItems += `
            <a href="index.html" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}">
                <i class="fa-solid fa-list-ul"></i><span>Yêu Cầu Của Tôi</span>
            </a>
            <a href="qr-scanner.html" class="nav-item ${activePage === 'qr' ? 'active' : ''}">
                <i class="fa-solid fa-qrcode"></i><span>Báo Hỏng (QR)</span>
            </a>
            <a href="request-form.html" class="nav-item ${activePage === 'form' ? 'active' : ''}">
                <i class="fa-solid fa-file-pen"></i><span>Tạo Yêu Cầu Nhanh</span>
            </a>
            <a href="profile.html" class="nav-item ${activePage === 'profile' ? 'active' : ''}">
                <i class="fa-solid fa-user-shield"></i><span>Hồ Sơ &amp; Bảo Mật</span>
            </a>
        `;
    }

    const dept = user.role === 'admin' ? 'Hệ thống Quản trị' : (user.role === 'technician' ? 'Đội Kỹ thuật Cơ điện' : (user.department || 'Phân xưởng Sản xuất'));

    return `
        <aside class="sidebar">
            <div class="sidebar-header">
                <div class="logo-box">
                    <i class="fa-solid fa-industry"></i>
                </div>
                <h2>Rieker<span class="text-gradient">Tech</span></h2>
            </div>
            <nav class="sidebar-nav">
                <span class="nav-section-label">Menu Điều Hướng</span>
                ${navItems}
            </nav>
            <div class="sidebar-footer">
                <a href="profile.html" class="user-profile" title="Xem thông tin tài khoản & đổi mật khẩu" style="text-decoration:none;">
                    <div class="avatar">
                        <img src="${user.avatar || 'https://ui-avatars.com/api/?name=User&background=27272a&color=fff'}" alt="Avatar">
                    </div>
                    <div class="user-info">
                        <h4>${user.name}</h4>
                        <p>${dept}</p>
                    </div>
                    <i class="fa-solid fa-chevron-right" style="margin-left:auto;font-size:0.7rem;color:var(--text-muted);"></i>
                </a>
            </div>
        </aside>
    `;
}

function renderHeader() {
    const currentTheme = getSavedTheme();
    const themeIcon = currentTheme === 'light' ? 'fa-moon' : 'fa-sun';
    const themeTitle = currentTheme === 'light' ? 'Chuyển sang chế độ Tối (Dark)' : 'Chuyển sang chế độ Sáng (Light)';

    return `
        <header class="top-header">
            <div class="header-search" onclick="window.triggerCommandPalette && window.triggerCommandPalette()">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" id="globalSearchInput" placeholder="Tìm kiếm nhanh thiết bị, mã máy, sự cố...">
                <kbd>Ctrl K</kbd>
            </div>
            <div class="header-actions">
                <!-- Dark / Light Mode Toggle Button -->
                <button class="icon-btn tooltip" id="themeToggleBtn" title="${themeTitle}" onclick="window.toggleTheme && window.toggleTheme()">
                    <i class="fa-solid ${themeIcon}" id="themeToggleIcon"></i>
                </button>

                <!-- Notifications Dropdown -->
                <div class="notification-wrapper" style="position:relative; display:inline-block;">
                    <button class="icon-btn tooltip" id="notifBtn" title="Thông báo bảo trì" onclick="window.toggleNotifModal()">
                        <i class="fa-regular fa-bell"></i>
                        <span class="badge" id="notifBadge" style="display:none;">0</span>
                    </button>
                    <div class="notif-dropdown glass-panel" id="notifDropdown" style="display:none; position:absolute; right:0; top:42px; width:320px; padding:12px; border-radius:var(--border-radius-sm); z-index:999; box-shadow:var(--shadow-card); text-align:left; border:1px solid var(--border-subtle); background:var(--bg-surface);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid var(--border-subtle); padding-bottom:6px;">
                            <h4 style="font-size:0.85rem; font-weight:700; color:var(--text-bright);"><i class="fa-solid fa-bell" style="color:var(--primary);margin-right:6px;"></i>Thông Báo Real-time</h4>
                            <span class="text-xs text-muted" id="notifStatusText">Tự động làm mới</span>
                        </div>
                        <div id="notifList" style="max-height:280px; overflow-y:auto; font-size:12px; display:flex; flex-direction:column; gap:4px;">Đang tải...</div>
                    </div>
                </div>

                <!-- Profile Quick Link -->
                <a href="profile.html" class="icon-btn tooltip" title="Hồ sơ tài khoản & Đổi mật khẩu">
                    <i class="fa-regular fa-user"></i>
                </a>

                <!-- Logout Button -->
                <button class="icon-btn tooltip" onclick="if(confirm('Đăng xuất khỏi hệ thống?')){ localStorage.removeItem('auth_user'); window.location.replace('login.html'); }" title="Đăng xuất">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i>
                </button>
            </div>
        </header>
    `;
}

window.renderSidebar = renderSidebar;
window.renderHeader = renderHeader;

// ─── Machine Quick-View Drawer / Sheet (shadcn/ui style) ────
window.ensureMachineDrawerInDOM = function() {
    let backdrop = document.getElementById('machineSheetBackdrop');
    let panel = document.getElementById('machineSheetPanel');

    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'machineSheetBackdrop';
        backdrop.className = 'sheet-backdrop';
        backdrop.onclick = window.closeMachineDrawer;
        document.body.appendChild(backdrop);
    }

    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'machineSheetPanel';
        panel.className = 'sheet-panel';
        document.body.appendChild(panel);
    }

    return { backdrop, panel };
};

window.closeMachineDrawer = function() {
    const backdrop = document.getElementById('machineSheetBackdrop');
    const panel = document.getElementById('machineSheetPanel');
    if (backdrop) backdrop.classList.remove('open');
    if (panel) panel.classList.remove('open');

    // Kích hoạt sự kiện để màn hình quét QR tiếp tục quét frame tiếp theo
    window.dispatchEvent(new CustomEvent('machineDrawerClosed'));
};

window.openMachineDrawer = async function(machineId, details = null) {
    const { backdrop, panel } = window.ensureMachineDrawerInDOM();

    // Show initial loading state in drawer
    panel.innerHTML = `
        <div class="sheet-header">
            <div class="sheet-title">
                <i class="fa-solid fa-server" style="color:var(--primary);"></i>
                Thông Tin Thiết Bị
            </div>
            <button class="sheet-close-btn" onclick="window.closeMachineDrawer()"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="sheet-body" style="align-items:center; justify-content:center; text-align:center;">
            <div class="spinner" style="border-width:2px;width:24px;height:24px;border-top-color:var(--primary);margin-bottom:10px;"></div>
            <p class="text-sm text-muted">Đang truy vấn dữ liệu máy [${machineId}]...</p>
        </div>
    `;

    backdrop.classList.add('open');
    panel.classList.add('open');

    // Fetch device data from Supabase if not provided
    let device = details;
    if (!device && window.fetchDevices) {
        const allDevices = await window.fetchDevices();
        device = allDevices.find(d => d.machine_id.toUpperCase() === machineId.toUpperCase());
    }

    // Check machine validation (Existence + Duplicate Maintenance)
    let validation = null;
    if (window.validateMachineStatus) {
        validation = await window.validateMachineStatus(machineId);
    }

    if (validation && !validation.valid && validation.code === 'NOT_FOUND') {
        panel.innerHTML = `
            <div class="sheet-header">
                <div class="sheet-title" style="color:var(--p1-red);">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <span>Mã Thiết Bị Không Tồn Tại</span>
                </div>
                <button class="sheet-close-btn" onclick="window.closeMachineDrawer()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="sheet-body">
                <div style="background:rgba(239, 68, 68, 0.12); border:1px solid rgba(239, 68, 68, 0.35); border-radius:var(--border-radius-sm); padding:1.25rem; text-align:center;">
                    <i class="fa-solid fa-circle-xmark" style="color:var(--p1-red); font-size:2.5rem; margin-bottom:10px;"></i>
                    <h3 style="color:var(--p1-red); font-size:1rem; font-weight:700; margin-bottom:6px;">Lỗi: Mã thiết bị '${machineId}' không tồn tại trên hệ thống nhà máy!</h3>
                    <p class="text-xs text-muted">Vui lòng kiểm tra lại tem QR trên thân máy hoặc nhập lại mã số chính xác từ danh mục xưởng.</p>
                </div>
            </div>
            <div class="sheet-footer">
                <button class="btn btn-secondary full-width" onclick="window.closeMachineDrawer()">
                    <i class="fa-solid fa-arrow-rotate-left"></i> Quét Hoặc Nhập Mã Khác
                </button>
            </div>
        `;
        return;
    }

    const isUnderMaintenance = validation && validation.code === 'UNDER_MAINTENANCE';
    const activeReq = validation ? validation.activeRequest : null;
    device = (validation && validation.device) || device;

    const deviceName = device ? device.device_name : 'Thiết bị sản xuất ' + machineId;
    const department = device ? device.department : 'Xưởng sản xuất chung';

    const statusBadge = isUnderMaintenance
        ? `<span class="badge-status status-p1"><span class="led-dot p1-danger"></span> ĐANG BẢO TRÌ (${activeReq ? activeReq.request_id : 'PENDING'})</span>`
        : `<span class="badge-status status-completed"><span class="led-dot success"></span> SẴN SÀNG HOẠT ĐỘNG</span>`;

    const warningBox = isUnderMaintenance
        ? `
            <div style="background:rgba(239, 68, 68, 0.12); border:1px solid rgba(239, 68, 68, 0.35); border-radius:var(--border-radius-sm); padding:0.875rem 1rem;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <span class="led-dot p1-danger"></span>
                    <strong style="color:var(--p1-red); font-size:0.8125rem;">Máy Đang Trong Quá Trình Bảo Trì</strong>
                </div>
                <p class="text-xs text-muted" style="line-height:1.4;">
                    Máy <strong>${machineId}</strong> hiện đang trong quá trình bảo trì (Mã phiếu: <strong class="table-req-id" style="color:var(--p1-red);">${activeReq ? activeReq.request_id : ''}</strong>). Không thể tạo thêm yêu cầu mới cho đến khi kỹ thuật viên hoàn tất!
                </p>
            </div>
        `
        : `
            <div style="background:rgba(239, 68, 68, 0.08); border:1px solid rgba(239, 68, 68, 0.2); border-radius:var(--border-radius-sm); padding:0.875rem 1rem;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <span class="led-dot p1-danger"></span>
                    <strong style="color:var(--p1-red); font-size:0.8125rem;">Quy trình Báo Hỏng Khẩn Cấp</strong>
                </div>
                <p class="text-xs text-muted">Nếu thiết bị gặp sự cố dừng dây chuyền (P1) hoặc hỏng nhẹ (P2), bấm nút đỏ bên dưới để chuyển sang form báo hỏng nhanh.</p>
            </div>
        `;

    const actionButton = isUnderMaintenance
        ? `
            <button class="btn btn-secondary btn-large full-width" disabled style="opacity:0.5; cursor:not-allowed;" title="Máy đang có phiếu bảo trì">
                <i class="fa-solid fa-lock"></i> KHÓA BÁO HỎNG (ĐANG BẢO TRÌ)
            </button>
        `
        : `
            <button class="btn btn-emergency btn-large full-width" onclick="window.proceedToReport('${machineId}')">
                <i class="fa-solid fa-triangle-exclamation"></i> TẠO YÊU CẦU BÁO HỎNG KHẨN CẤP
            </button>
        `;

    panel.innerHTML = `
        <div class="sheet-header">
            <div class="sheet-title">
                <i class="fa-solid fa-microchip" style="color:var(--primary);"></i>
                <span>Mã Máy: <strong class="table-machine-id">${machineId}</strong></span>
            </div>
            <button class="sheet-close-btn" onclick="window.closeMachineDrawer()"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="sheet-body">
            <div>
                <h3 style="font-size:1.1rem; font-weight:700; color:var(--text-bright); margin-bottom:4px;">${deviceName}</h3>
                <p class="text-sm text-muted"><i class="fa-solid fa-location-dot" style="margin-right:6px; color:var(--text-secondary);"></i>${department}</p>
            </div>

            <div class="machine-detail-card">
                <div class="machine-detail-row">
                    <span class="machine-detail-label">Tình trạng hiện tại</span>
                    <span class="machine-detail-value">${statusBadge}</span>
                </div>
                <div class="machine-detail-row">
                    <span class="machine-detail-label">Khu vực / Dây chuyền</span>
                    <span class="machine-detail-value">${department}</span>
                </div>
                <div class="machine-detail-row">
                    <span class="machine-detail-label">Mã QR Định danh</span>
                    <span class="machine-detail-value font-mono text-xs" style="color:var(--primary);">${machineId}</span>
                </div>
                <div class="machine-detail-row">
                    <span class="machine-detail-label">Hạn kiểm định kỹ thuật</span>
                    <span class="machine-detail-value font-mono text-xs">Đạt chuẩn ISO-9001</span>
                </div>
            </div>

            ${warningBox}
        </div>
        <div class="sheet-footer">
            ${actionButton}
            <button class="btn btn-secondary full-width" onclick="window.closeMachineDrawer()">
                <i class="fa-solid fa-arrow-rotate-left"></i> Quét Mã Máy Khác
            </button>
        </div>
    `;
};

window.proceedToReport = function(machineId) {
    localStorage.setItem('temp_scanned_id', machineId);
    window.location.href = `request-form.html?machine=${encodeURIComponent(machineId)}&level=high`;
};

// ─── Notification loop & Real-time Alerts ──────────────────
window.toggleNotifModal = function() {
    const d = document.getElementById('notifDropdown');
    if (d) d.style.display = d.style.display === 'none' ? 'block' : 'none';
};

window.markAsRead = async function(id) {
    if (window.markNotificationRead) {
        await window.markNotificationRead(id);
        window.loadNotifications();
    }
};

let lastSeenNotifIds = new Set();
let isFirstNotifLoad = true;

window.loadNotifications = async function() {
    if (!window.fetchNotifications || !window.auth) return;
    const user = window.auth.getCurrentUser();
    if (!user) return;

    const notifs = await window.fetchNotifications(user);
    const badge = document.getElementById('notifBadge');
    const list = document.getElementById('notifList');

    if (!badge || !list) return;

    if (notifs.length > 0) {
        badge.style.display = 'inline-flex';
        badge.innerText = notifs.length;

        // Check for new notifications to trigger Sonner Toast + Audio bip for Technicians / Admins
        notifs.forEach(n => {
            if (!lastSeenNotifIds.has(n.id)) {
                lastSeenNotifIds.add(n.id);
                if (!isFirstNotifLoad && (user.role === 'technician' || user.role === 'admin')) {
                    // Extract machine ID from title or message if present (e.g. [RIEKER-M102])
                    const match = n.message.match(/\[(.*?)\]/);
                    const machineId = match ? match[1] : null;

                    window.showSonnerToast && window.showSonnerToast({
                        title: `🚨 ${n.title || 'Sự Cố Nhà Xưởng Mới'}`,
                        description: n.message,
                        machineId: machineId,
                        level: 'p1',
                        playSound: true
                    });
                }
            }
        });
        isFirstNotifLoad = false;

        list.innerHTML = notifs.map(n => `
            <div style="padding:8px; border-bottom:1px solid var(--border-subtle); cursor:pointer; transition:var(--transition); border-radius:4px; background:var(--bg-elevated);"
                 onmouseover="this.style.background='var(--bg-overlay)'"
                 onmouseout="this.style.background='var(--bg-elevated)'"
                 onclick="window.markAsRead('${n.id}')">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                    <strong style="color:#00d4ff; font-size:0.78rem;">${n.title}</strong>
                    <span class="led-dot p1-danger"></span>
                </div>
                <span style="color:var(--text-secondary); display:block; line-height:1.35; font-size:0.75rem;">${n.message}</span>
                <small style="color:var(--text-muted); font-size:0.68rem; margin-top:4px; display:block;">Click để xác nhận đã xem</small>
            </div>
        `).join('');
    } else {
        badge.style.display = 'none';
        list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);"><i class="fa-regular fa-bell-slash" style="font-size:20px;margin-bottom:6px;opacity:0.4;"></i><br/>Không có cảnh báo mới</div>';
    }
};

// Polling for updates every 8s
setInterval(() => {
    if (window.auth && window.auth.getCurrentUser()) {
        window.loadNotifications();
    }
}, 8000);

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.loadNotifications, 500);

    // Global Command Palette Shortcut (Ctrl+K or Cmd+K)
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('globalSearchInput');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }
    });
});
