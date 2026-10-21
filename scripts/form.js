// ============================================================
// RIEKER TECH — FAST FAULT REPORTING FORM LOGIC (10 - 15 SECONDS)
// P1/P2 Segmented Radios + Quick Tags + Image Upload Widget
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

    const user = window.auth ? window.auth.getCurrentUser() : null;
    const reporterNameInput = document.getElementById('reporterName');
    if (user && reporterNameInput) {
        reporterNameInput.value = user.name;
        reporterNameInput.setAttribute('readonly', true);
        reporterNameInput.classList.add('readonly-input');
    }

    const machineIdInput = document.getElementById('machineId');
    const departmentSelect = document.getElementById('department');
    const maintenanceForm = document.getElementById('maintenanceForm');
    const descTextarea = document.getElementById('issueDescription');
    const submitBtn = document.getElementById('submitReportBtn');

    // ─── Pre-fill Machine ID from URL or temp storage ─────────
    const urlParams = new URLSearchParams(window.location.search);
    const urlMachineId = urlParams.get('machine');
    const urlLevel = urlParams.get('level');
    const tempId = localStorage.getItem('temp_scanned_id');

    if (urlMachineId && machineIdInput) {
        machineIdInput.value = urlMachineId.trim().toUpperCase();
        window.showSonnerToast && window.showSonnerToast({
            title: 'Đã Nhận Diện Mã Máy',
            description: `Nạp dữ liệu thiết bị [${urlMachineId}]`,
            machineId: urlMachineId,
            level: 'info',
            playSound: false
        });
        autoDetectDepartment(urlMachineId);
    } else if (tempId && machineIdInput) {
        machineIdInput.value = tempId.trim().toUpperCase();
        localStorage.removeItem('temp_scanned_id');
        window.showSonnerToast && window.showSonnerToast({
            title: 'Quét Thành Công',
            description: `Nạp thông tin máy từ Camera: [${tempId}]`,
            machineId: tempId,
            level: 'info',
            playSound: false
        });
        autoDetectDepartment(tempId);
    }

    async function autoDetectDepartment(mId) {
        if (!departmentSelect || !window.fetchDevices) return;
        try {
            const devices = await window.fetchDevices();
            const found = devices.find(d => d.machine_id.toUpperCase() === mId.toUpperCase());
            if (found && found.department) {
                departmentSelect.value = found.department;
            }
        } catch (e) {
            console.warn(e);
        }
    }

    // ─── Segmented Radio Group (P1 vs P2) ─────────────────────
    const cardP1 = document.getElementById('cardP1');
    const cardP2 = document.getElementById('cardP2');
    let currentLevel = 'high'; // default to P1

    function setSeverity(level) {
        currentLevel = level;
        if (level === 'high') {
            cardP1.classList.add('active');
            cardP2.classList.remove('active');
            cardP1.querySelector('input').checked = true;
            if (submitBtn) {
                submitBtn.className = 'btn btn-emergency btn-glow btn-large';
                submitBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> GỬI YÊU CẦU BÁO HỎNG KHẨN CẤP (P1)';
            }
        } else {
            cardP2.classList.add('active');
            cardP1.classList.remove('active');
            cardP2.querySelector('input').checked = true;
            if (submitBtn) {
                submitBtn.className = 'btn btn-primary btn-glow btn-large';
                submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> GỬI YÊU CẦU BÁO LỖI VẬN HÀNH (P2)';
            }
        }
    }

    if (cardP1 && cardP2) {
        cardP1.addEventListener('click', () => setSeverity('high'));
        cardP2.addEventListener('click', () => setSeverity('medium'));
    }

    if (urlLevel === 'medium' || urlLevel === 'low') {
        setSeverity('medium');
    }

    // ─── Toggle Group / Quick Fault Tags ──────────────────────
    const tagButtons = document.querySelectorAll('.tag-toggle-btn');
    tagButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.getAttribute('data-tag');
            const isActive = btn.classList.contains('active');

            tagButtons.forEach(b => b.classList.remove('active'));
            if (!isActive) {
                btn.classList.add('active');
                // Replace or prepend tag in description
                let text = descTextarea.value.trim();
                // Strip existing bracket tag if present
                text = text.replace(/^\[.*?\]\s*/, '');
                descTextarea.value = `${tag} ${text || 'Máy gặp sự cố bất thường, cần kỹ thuật kiểm tra'}`;
            }
        });
    });

    // ─── Image Upload Widget (Max 2 photos) ───────────────────
    const uploadTriggerBtn = document.getElementById('uploadTriggerBtn');
    const faultImageInput = document.getElementById('faultImageInput');
    const imagePreviewGrid = document.getElementById('imagePreviewGrid');
    const uploadedImages = []; // max 2 base64 strings

    if (uploadTriggerBtn && faultImageInput) {
        uploadTriggerBtn.addEventListener('click', () => {
            if (uploadedImages.length >= 2) {
                window.showSonnerToast && window.showSonnerToast({
                    title: 'Đã đạt giới hạn ảnh',
                    description: 'Tối đa 2 ảnh hiện trường sự cố',
                    level: 'warning',
                    playSound: false
                });
                return;
            }
            faultImageInput.click();
        });

        faultImageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            for (const file of files) {
                if (uploadedImages.length >= 2) break;
                if (!file.type.startsWith('image/')) continue;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const dataUrl = event.target.result;
                    uploadedImages.push(dataUrl);
                    renderImagePreviews();
                };
                reader.readAsDataURL(file);
            }
            faultImageInput.value = ''; // reset so same photo can be re-picked
        });
    }

    function renderImagePreviews() {
        if (!imagePreviewGrid) return;
        imagePreviewGrid.innerHTML = uploadedImages.map((src, idx) => `
            <div class="image-preview-card">
                <img src="${src}" alt="Ảnh sự cố ${idx + 1}">
                <button type="button" class="remove-btn" onclick="window.removeFaultImage(${idx})" title="Xóa ảnh">✕</button>
            </div>
        `).join('');

        if (uploadTriggerBtn) {
            uploadTriggerBtn.innerHTML = `<i class="fa-solid fa-camera"></i> Chụp ảnh / Chọn ảnh (${uploadedImages.length}/2)`;
            if (uploadedImages.length >= 2) {
                uploadTriggerBtn.style.opacity = '0.5';
            } else {
                uploadTriggerBtn.style.opacity = '1';
            }
        }
    }

    window.removeFaultImage = function(index) {
        uploadedImages.splice(index, 1);
        renderImagePreviews();
    };

    // ─── Submit Form Handler ──────────────────────────────────
    if (maintenanceForm) {
        maintenanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const mId = machineIdInput ? machineIdInput.value.trim().toUpperCase() : '';
            if (!mId) {
                alert('Vui lòng quét QR hoặc nhập mã máy trước khi gửi!');
                return;
            }

            const originalBtnHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner" style="border-width:2px;width:16px;height:16px;margin-right:8px;"></div> Đang truyền tín hiệu...';

            // Verify device exists
            if (window.checkDeviceExists) {
                const isReal = await window.checkDeviceExists(mId);
                if (!isReal) {
                    alert(`Lỗi: Thiết bị [${mId}] không tồn tại trong danh mục xưởng. Vui lòng kiểm tra lại!`);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHtml;
                    return;
                }
            }

            // Check if machine is already under maintenance
            if (window.checkMachineIsUnderMaintenance) {
                const isBusy = await window.checkMachineIsUnderMaintenance(mId);
                if (isBusy) {
                    alert(`Thiết bị [${mId}] hiện đang có phiếu bảo trì đang xử lý. Vui lòng chờ kỹ thuật viên hoàn tất!`);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHtml;
                    return;
                }
            }

            const rName = reporterNameInput ? reporterNameInput.value : (user ? user.name : 'Công Nhân');
            const dept = departmentSelect ? departmentSelect.value : 'Xưởng May';
            const desc = descTextarea ? descTextarea.value.trim() : '';

            // Attach photo marker to description if images uploaded
            let finalDesc = desc;
            if (uploadedImages.length > 0) {
                finalDesc += ` (Có ${uploadedImages.length} ảnh hiện trường đính kèm)`;
            }

            const isSuccess = await window.saveRequest({
                machineId: mId,
                reporter: rName,
                level: currentLevel,
                desc: finalDesc
            });

            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;

            if (isSuccess) {
                // Sound chime
                window.playAlertSound && window.playAlertSound(currentLevel === 'high' ? 'high' : 'default');

                // Broadcast notification to technician and admin
                if (window.saveNotification) {
                    const alertTitle = currentLevel === 'high'
                        ? `🚨 BÁO HỎNG P1 (DỪNG MÁY): [${mId}]`
                        : `⚠️ Báo Sự Cố P2: [${mId}]`;
                    const alertMsg = `Công nhân ${rName} báo hỏng máy [${mId}] tại khu vực ${dept}. Chi tiết: ${desc}`;

                    await window.saveNotification({
                        target_role: 'technician',
                        title: alertTitle,
                        message: alertMsg
                    });
                    await window.saveNotification({
                        target_role: 'admin',
                        title: alertTitle,
                        message: alertMsg
                    });
                }

                // Show Success Modal
                const modal = document.getElementById('successModal');
                const modalIdEl = document.getElementById('modalMachineId');
                if (modalIdEl) modalIdEl.innerText = mId;
                if (modal) modal.classList.add('show');

                maintenanceForm.reset();
                uploadedImages.length = 0;
                renderImagePreviews();

                // Re-lock reporter
                if (user && reporterNameInput) reporterNameInput.value = user.name;
                if (machineIdInput) machineIdInput.value = '';
            } else {
                alert('Gửi thất bại! Vui lòng kiểm tra lại kết nối mạng hoặc phân quyền Supabase.');
            }
        });
    }

    const modalOkBtn = document.getElementById('modalOkBtn');
    if (modalOkBtn) {
        modalOkBtn.addEventListener('click', () => { window.location.href = 'index.html'; });
    }
});
