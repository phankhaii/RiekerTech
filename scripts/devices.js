// Device Management Logic
document.addEventListener('DOMContentLoaded', () => {
    
    const sb = document.getElementById('sidebar-container');
    const hd = document.getElementById('header-container');
    if (sb) sb.innerHTML = window.renderSidebar('devices');
    if (hd) hd.innerHTML = window.renderHeader();

    const addDeviceForm = document.getElementById('addDeviceForm');
    const deviceGrid = document.getElementById('deviceGrid');
    const deviceCountEl = document.getElementById('deviceCount');
    
    // Base URL for QR codes - points to report form
    // When deployed, replace with your actual domain
    const BASE_URL = window.location.origin + window.location.pathname.replace('devices.html', '');

    // ==========================================
    // Load and Render All Devices
    // ==========================================
    async function loadDevices() {
        deviceGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="spinner" style="border-width: 2px; width: 24px; height: 24px; border-top-color: var(--primary); display:inline-block; margin-bottom: 1rem;"></div>
                <p>Đang tải danh sách...</p>
            </div>
        `;
        
        const devices = await window.fetchDevices();
        deviceGrid.innerHTML = '';
        
        if (devices.length === 0) {
            deviceGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <i class="fa-solid fa-box-open"></i>
                    <p>Chưa có thiết bị nào. Hãy thêm thiết bị đầu tiên!</p>
                </div>
            `;
            deviceCountEl.textContent = '0 thiết bị';
            return;
        }
        
        deviceCountEl.textContent = devices.length + ' thiết bị';

        devices.forEach(device => {
            const card = createDeviceCard(device);
            deviceGrid.appendChild(card);
        });
    }

    // ==========================================
    // Create a Device Card with QR
    // ==========================================
    function createDeviceCard(device) {
        const card = document.createElement('div');
        card.className = 'device-card';
        card.id = 'device-' + device.id;
        
        // QR URL: points to report form with machine ID pre-filled
        const qrUrl = BASE_URL + 'request-form.html?machine=' + encodeURIComponent(device.machine_id);
        
        card.innerHTML = `
            <div class="device-card-header">
                <span class="device-id" style="cursor:pointer;" onclick="window.openMachineDrawer && window.openMachineDrawer('${device.machine_id}')" title="Xem chi tiết máy">
                    <i class="fa-solid fa-microchip" style="font-size:0.75rem;margin-right:4px;"></i>${device.machine_id}
                </span>
                <span class="device-dept">${device.department}</span>
            </div>
            <div class="device-name">${device.device_name}</div>
            <div class="qr-preview" id="qr-${device.id}"></div>
            <div class="device-card-actions">
                <button class="btn btn-primary btn-sm print-qr-btn" data-id="${device.id}" data-machine="${device.machine_id}">
                    <i class="fa-solid fa-print"></i> In QR
                </button>
                <button class="btn btn-outline btn-sm delete-device-btn" data-id="${device.id}" data-machine="${device.machine_id}">
                    <i class="fa-solid fa-trash"></i> Xóa
                </button>
            </div>
        `;
        
        // Generate QR Code into the preview div
        const qrContainer = card.querySelector('.qr-preview');
        setTimeout(() => {
            new QRCode(qrContainer, {
                text: qrUrl,
                width: 140,
                height: 140,
                colorDark: '#1e293b',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        }, 50);
        
        // Print QR button
        card.querySelector('.print-qr-btn').addEventListener('click', () => {
            printQR(device, qrUrl);
        });
        
        // Delete button
        card.querySelector('.delete-device-btn').addEventListener('click', async (e) => {
            const mId = e.currentTarget.getAttribute('data-machine');
            if (!confirm('Xóa thiết bị ' + mId + '?')) return;
            const ok = await window.deleteDevice(device.id);
            if (ok) {
                window.showToast('Đã xóa', 'Thiết bị ' + mId + ' đã bị xóa khỏi hệ thống.');
                loadDevices();
            } else {
                window.showToast('Lỗi', 'Không thể xóa thiết bị. Kiểm tra quyền Supabase.', 'error');
            }
        });
        
        return card;
    }

    // ==========================================
    // Print QR Code
    // ==========================================
    function printQR(device, qrUrl) {
        const printArea = document.getElementById('printArea');
        printArea.innerHTML = '';
        printArea.style.display = 'block';
        
        const wrapper = document.createElement('div');
        wrapper.style.textAlign = 'center';
        wrapper.style.padding = '20px';
        
        const title = document.createElement('h2');
        title.textContent = 'RIEKER VIỆT NAM';
        title.style.marginBottom = '8px';
        title.style.fontFamily = 'Outfit, sans-serif';
        
        const subtitle = document.createElement('p');
        subtitle.textContent = device.device_name;
        subtitle.style.marginBottom = '4px';
        subtitle.style.fontSize = '14px';
        subtitle.style.color = '#666';
        
        const machineLabel = document.createElement('h3');
        machineLabel.textContent = device.machine_id;
        machineLabel.style.marginBottom = '16px';
        machineLabel.style.fontFamily = 'Outfit, sans-serif';
        
        const qrDiv = document.createElement('div');
        qrDiv.id = 'print-qr-code';
        
        const footerText = document.createElement('p');
        footerText.textContent = 'Quét mã QR để báo hỏng thiết bị nhanh';
        footerText.style.marginTop = '12px';
        footerText.style.fontSize = '12px';
        footerText.style.color = '#999';
        
        wrapper.appendChild(title);
        wrapper.appendChild(subtitle);
        wrapper.appendChild(machineLabel);
        wrapper.appendChild(qrDiv);
        wrapper.appendChild(footerText);
        printArea.appendChild(wrapper);
        
        new QRCode(qrDiv, {
            text: qrUrl,
            width: 250,
            height: 250,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
        
        // Wait for QR to render then print
        setTimeout(() => {
            window.print();
            setTimeout(() => { printArea.style.display = 'none'; }, 500);
        }, 300);
    }

    // ==========================================
    // Add Device Form
    // ==========================================
    if (addDeviceForm) {
        addDeviceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const machineId = document.getElementById('deviceId').value.trim().toUpperCase();
            const deviceName = document.getElementById('deviceName').value.trim();
            const dept = document.getElementById('deviceDept').value;
            
            const addBtn = document.getElementById('addDeviceBtn');
            addBtn.disabled = true;
            addBtn.innerHTML = '<div class="spinner" style="border-width:2px;width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></div> Đang lưu...';
            
            const result = await window.addDevice({
                machine_id: machineId,
                device_name: deviceName,
                department: dept
            });
            
            addBtn.disabled = false;
            addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Thêm & Tạo Mã QR';
            
            if (result) {
                window.showToast('Thêm thành công!', 'Đã sinh mã QR cho thiết bị ' + machineId);
                addDeviceForm.reset();
                loadDevices();
            } else {
                window.showToast('Lỗi', 'Không thể thêm thiết bị. Có thể mã lỗi (trùng) hoặc RLS chặn.', 'error');
            }
        });
    }

    // Init
    loadDevices();
});
