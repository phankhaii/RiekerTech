// ============================================================
// RIEKER TECH — INDUSTRIAL DASHBOARD VIEW LOGIC
// Linear/Vercel Dark Theme + High-Contrast Industrial Palette
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

    const user = window.auth ? window.auth.getCurrentUser() : { role: 'worker', name: 'Công Nhân' };

    const sb = document.getElementById('sidebar-container');
    const hd = document.getElementById('header-container');
    if (sb && !sb.innerHTML.trim()) sb.innerHTML = window.renderSidebar('dashboard');
    if (hd && !hd.innerHTML.trim()) hd.innerHTML = window.renderHeader();

    const statsGrid = document.querySelector('.stats-grid');
    const qrBtn = document.getElementById('qrBtn');

    if (user.role === 'admin') {
        if (qrBtn) qrBtn.style.display = 'none';
    } else {
        if (statsGrid) statsGrid.style.display = 'none';
        if (user.role !== 'worker' && qrBtn) qrBtn.style.display = 'none';
    }

    let refreshTimer = null;

    async function renderDashboard() {
        const tbody = document.getElementById('tableBody');
        const pendingCount = document.getElementById('pendingCount');
        const completedCount = document.getElementById('completedCount');

        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;"><div class="spinner" style="border-width:2px;width:20px;height:20px;border-top-color:#00d4ff;margin-right:8px;"></div><span class="text-xs text-muted font-mono">ĐỒNG BỘ DỮ LIỆU CLOUD SUPABASE...</span></td></tr>`;

        let data = await window.fetchRequests();

        if (user.role === 'worker') {
            data = data.filter(r => r.reporter_name === user.name);
        }

        tbody.innerHTML = '';

        if (data.length === 0) {
            const msg = user.role === 'worker'
                ? 'Bạn chưa có yêu cầu báo hỏng nào. <a href="request-form.html" style="color:var(--primary);text-decoration:underline;">Tạo yêu cầu siêu tốc</a>'
                : 'Chưa có yêu cầu báo hỏng nào đang xử lý trong ca trực';
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:2.5rem 1rem;">${msg}</td></tr>`;
            return;
        }

        let pending = 0, completed = 0;

        data.forEach(req => {
            if (req.status === 'pending' || req.status === 'processing') pending++;
            else if (req.status === 'completed') completed++;

            const dateObj = new Date(req.created_at);
            const dateStr = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;

            // High-Contrast Industrial Status Badges (User Spec #1)
            let statusBadge = '';
            const isP1 = req.issue_level === 'high' || (req.issue_desc && req.issue_desc.includes('P1'));

            if (req.status === 'pending') {
                if (isP1) {
                    statusBadge = `<span class="badge-status status-p1"><span class="led-dot p1-danger"></span> P1 - DỪNG MÁY</span>`;
                } else {
                    statusBadge = `<span class="badge-status status-p2"><span class="led-dot p2-warning"></span> P2 - HỎNG NHẸ</span>`;
                }
            } else if (req.status === 'processing') {
                statusBadge = `<span class="badge-status status-processing"><span class="led-dot info"></span> ĐANG XỬ LÝ</span>`;
            } else {
                statusBadge = `<span class="badge-status status-completed"><span class="led-dot success"></span> ĐÃ SỬA XONG</span>`;
            }

            // Action Buttons
            let actionHtml = '';
            if (user.role === 'technician') {
                if (req.status === 'pending') {
                    actionHtml += `<button class="btn btn-sm btn-primary" onclick="dispatchAction(this,'${req.request_id}','processing', '${req.reporter_name}')"><i class="fa-solid fa-play"></i> Tiếp nhận</button> `;
                } else if (req.status === 'processing') {
                    actionHtml += `<button class="btn btn-sm btn-outline" onclick="dispatchAction(this,'${req.request_id}','completed', '${req.reporter_name}')" style="color:var(--success);border-color:var(--success);"><i class="fa-solid fa-check"></i> Hoàn thành</button> `;
                } else {
                    actionHtml += `<span class="text-xs text-muted font-mono"><i class="fa-solid fa-check-double" style="color:var(--success);margin-right:4px;"></i>Hoàn tất</span>`;
                }
            }

            if (user.role === 'worker' || user.role === 'admin') {
                actionHtml += `<button class="btn btn-sm btn-outline danger" onclick="deleteRequest(this,'${req.request_id}')" title="Xóa yêu cầu"><i class="fa-solid fa-trash"></i></button>`;
            }

            if (actionHtml === '') actionHtml = '<span class="text-muted">—</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="table-req-id">${req.request_id}</span></td>
                <td>
                    <span class="table-machine-id" style="cursor:pointer;" onclick="window.openMachineDrawer && window.openMachineDrawer('${req.machine_id}')" title="Xem chi tiết máy">
                        <i class="fa-solid fa-microchip" style="font-size:0.7rem;margin-right:4px;"></i>${req.machine_id}
                    </span>
                </td>
                <td>${req.reporter_name}</td>
                <td>${statusBadge}</td>
                <td><span class="table-timestamp"><i class="fa-regular fa-clock" style="margin-right:4px;"></i>${dateStr}</span></td>
                <td style="text-align:center;">${actionHtml}</td>
            `;
            tbody.appendChild(tr);
        });

        if (pendingCount) pendingCount.innerText = pending;
        if (completedCount) completedCount.innerText = completed;

        if (user.role === 'admin') {
            const deviceCount = document.getElementById('deviceCount');
            if (deviceCount && window.fetchDevices) {
                const devices = await window.fetchDevices();
                deviceCount.innerText = devices.length;
            }
        }
    }

    window.dispatchAction = async (btn, id, newStatus, reporter_name) => {
        if (!window.updateRequestStatus) return;
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<div class="spinner" style="border-width:2px;width:12px;height:12px;"></div>';
        btn.disabled = true;

        const ok = await window.updateRequestStatus(id, newStatus);

        if (ok) {
            window.playAlertSound && window.playAlertSound('default');
            if (window.saveNotification) {
                await window.saveNotification({
                    target_role: 'worker',
                    target_user: reporter_name,
                    title: 'Cập Nhật Trạng Thái Thiết Bị',
                    message: `Yêu cầu (${id}) của bạn đã chuyển sang trạng thái: ${newStatus === 'processing' ? 'Kỹ thuật viên đang xử lý' : 'Đã sửa chữa hoàn thành'}`
                });
            }
            window.showSonnerToast && window.showSonnerToast({
                title: 'Đã Cập Nhật Trạng Thái',
                description: `Yêu cầu ${id} -> ${newStatus === 'processing' ? 'Đang xử lý' : 'Hoàn thành'}`,
                level: newStatus === 'processing' ? 'info' : 'success',
                playSound: false
            });
            renderDashboard();
        } else {
            btn.innerHTML = oldHtml;
            btn.disabled = false;
            alert('Cập nhật thất bại! Vui lòng kiểm tra RLS Supabase.');
        }
    };

    window.deleteRequest = async (btn, request_id) => {
        if (!confirm(`Bạn có chắc muốn xóa vĩnh viễn yêu cầu: ${request_id}?`)) return;
        if (!window.deleteMaintenanceRequest) return;

        const oldHtml = btn.innerHTML;
        btn.innerHTML = '...';
        btn.disabled = true;

        const ok = await window.deleteMaintenanceRequest(request_id);
        if (ok) {
            window.showSonnerToast && window.showSonnerToast({
                title: 'Đã Xóa Yêu Cầu',
                description: `Mã phiếu ${request_id} đã bị hủy`,
                level: 'info',
                playSound: false
            });
            renderDashboard();
        } else {
            alert('Lỗi: Xóa thất bại. Thiếu quyền DELETE trên Supabase (RLS).');
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    };

    renderDashboard();

    // Live auto-refresh every 12s
    refreshTimer = setInterval(renderDashboard, 12000);
});
