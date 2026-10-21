// ============================================================
// RIEKER TECH — INDUSTRIAL QR SCANNER & INPUT-OTP LOGIC
// Real Camera + Flashlight + HUD Laser + Machine Drawer
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

    const startScanBtn = document.getElementById('startScanBtn');
    const stopScanBtn = document.getElementById('stopScanBtn');
    const scannerLine = document.getElementById('scannerLine');
    const processingOverlay = document.getElementById('processingOverlay');
    const cameraFeed = document.getElementById('cameraFeed');
    const camStatusText = document.getElementById('camStatusText');
    const camLed = document.getElementById('camLed');
    const torchBtn = document.getElementById('torchBtn');
    const torchLabel = document.getElementById('torchLabel');

    let videoStream = null;
    let videoElement = null;
    let videoTrack = null;
    let canvasElement = null;
    let canvasCtx = null;
    let scanAnimationId = null;
    let isTorchOn = false;

    // ==========================================
    // Real Camera Setup (MediaDevices API)
    // ==========================================
    async function startRealCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 640 },
                    height: { ideal: 640 }
                }
            });

            videoStream = stream;
            videoTrack = stream.getVideoTracks()[0];

            cameraFeed.innerHTML = '';

            videoElement = document.createElement('video');
            videoElement.setAttribute('autoplay', '');
            videoElement.setAttribute('playsinline', '');
            videoElement.style.width = '100%';
            videoElement.style.height = '100%';
            videoElement.style.objectFit = 'cover';
            videoElement.srcObject = stream;
            cameraFeed.appendChild(videoElement);

            canvasElement = document.createElement('canvas');
            canvasElement.width = 480;
            canvasElement.height = 480;
            canvasCtx = canvasElement.getContext('2d', { willReadFrequently: true });

            // Check if torch capability is available
            checkTorchCapability();

            scanForQR();
            return true;
        } catch (err) {
            console.warn('Camera thực không khả dụng hoặc bị chặn:', err.message);
            return false;
        }
    }

    // Check Torch Capability
    function checkTorchCapability() {
        if (!videoTrack) return;
        const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        if (capabilities.torch) {
            torchBtn.style.display = 'inline-flex';
        }
    }

    // Toggle Torch (Đèn Flash)
    if (torchBtn) {
        torchBtn.addEventListener('click', async () => {
            isTorchOn = !isTorchOn;
            if (videoTrack && videoTrack.getCapabilities && videoTrack.getCapabilities().torch) {
                try {
                    await videoTrack.applyConstraints({
                        advanced: [{ torch: isTorchOn }]
                    });
                } catch (e) {
                    console.warn('Không thể bật đèn flash:', e);
                }
            }

            if (isTorchOn) {
                torchBtn.classList.add('active');
                if (torchLabel) torchLabel.textContent = 'Flash: BẬT';
                window.showSonnerToast && window.showSonnerToast({
                    title: 'Đèn Flash Đã Bật',
                    description: 'Hỗ trợ quét góc máy tối trong xưởng',
                    level: 'info',
                    playSound: false,
                    duration: 2000
                });
            } else {
                torchBtn.classList.remove('active');
                if (torchLabel) torchLabel.textContent = 'Flash: Tắt';
            }
        });
    }

    // ==========================================
    // Frame Scanning Loop (jsQR)
    // ==========================================
    function scanForQR() {
        if (!videoElement || !canvasCtx || !videoStream) return;

        if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
            canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            const imageData = canvasCtx.getImageData(0, 0, canvasElement.width, canvasElement.height);

            if (typeof jsQR !== 'undefined') {
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert'
                });

                if (code && code.data) {
                    onQRCodeDetected(code.data);
                    return;
                }
            }
        }

        scanAnimationId = requestAnimationFrame(scanForQR);
    }

    // ==========================================
    // QR Code Detected -> Open Machine Drawer (Sheet)
    // ==========================================
    function onQRCodeDetected(qrData) {
        if (processingOverlay) processingOverlay.classList.remove('hidden');
        if (scannerLine) scannerLine.classList.add('hidden');
        if (scanAnimationId) cancelAnimationFrame(scanAnimationId);

        // Sound chime
        window.playAlertSound && window.playAlertSound('default');

        setTimeout(() => {
            let machineId = qrData.trim();

            // Extract ID from URL if formatted as URL
            if (qrData.includes('machine=')) {
                try {
                    const url = new URL(qrData);
                    machineId = url.searchParams.get('machine') || qrData;
                } catch (e) {
                    const match = qrData.match(/machine=([^&]+)/);
                    if (match) machineId = decodeURIComponent(match[1]);
                }
            } else if (qrData.includes('id=')) {
                const match = qrData.match(/id=([^&]+)/);
                if (match) machineId = decodeURIComponent(match[1]);
            }

            // Normalise
            machineId = machineId.toUpperCase();

            if (processingOverlay) processingOverlay.classList.add('hidden');
            if (scannerLine) scannerLine.classList.remove('hidden');

            // Open Machine Quick-View Drawer (Requirement B)
            if (window.openMachineDrawer) {
                window.openMachineDrawer(machineId);
            } else {
                localStorage.setItem('temp_scanned_id', machineId);
                window.location.href = `request-form.html?machine=${encodeURIComponent(machineId)}`;
            }

            // Resume frame scanning if drawer closes
            resumeScanAfterDelay();
        }, 600);
    }

    function resumeScanAfterDelay() {
        setTimeout(() => {
            if (videoStream && !scanAnimationId) {
                scanAnimationId = requestAnimationFrame(scanForQR);
            }
        }, 1500);
    }

    // ==========================================
    // Start / Stop Scanner
    // ==========================================
    async function startScanner() {
        startScanBtn.disabled = true;
        startScanBtn.innerHTML = '<div class="spinner" style="border-width:2px;width:16px;height:16px;margin-right:6px;"></div> Đang khởi động HUD...';

        if (scannerLine) scannerLine.classList.remove('hidden');

        const ok = await startRealCamera();

        startScanBtn.disabled = false;
        startScanBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Bật Camera Quét QR';
        startScanBtn.classList.add('hidden');
        if (stopScanBtn) stopScanBtn.classList.remove('hidden');

        if (ok) {
            if (camStatusText) camStatusText.textContent = 'HUD SCANNING ACTIVE';
            if (camLed) camLed.className = 'led-dot success';
            const title = document.getElementById('scannerTitle');
            if (title) title.textContent = 'Camera Laser Đang Quét';
            const desc = document.getElementById('scannerDesc');
            if (desc) desc.textContent = 'Căn chỉnh mã QR vào khung ngắm chữ thập. Hệ thống sẽ quét và trượt thông tin máy tự động.';
        } else {
            if (camStatusText) camStatusText.textContent = 'CAMERA MOCK ACTIVE';
            if (camLed) camLed.className = 'led-dot p2-warning';
            cameraFeed.innerHTML = `
                <div class="mock-camera-view" style="padding:1.5rem;">
                    <i class="fa-solid fa-video-slash" style="color:var(--p2-amber);font-size:2.2rem;margin-bottom:8px;"></i>
                    <p style="color:var(--text-bright);font-weight:600;font-size:0.85rem;">Camera bị chặn hoặc chưa cấp quyền</p>
                    <p class="text-xs text-muted" style="margin-top:4px;">Bạn có thể dùng ô nhập nhanh InputOTP bên phải để chọn mã máy ngay lập tức.</p>
                </div>
            `;
        }
    }

    function stopScanner() {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
            videoTrack = null;
        }
        if (scanAnimationId) {
            cancelAnimationFrame(scanAnimationId);
            scanAnimationId = null;
        }

        if (startScanBtn) {
            startScanBtn.classList.remove('hidden');
            startScanBtn.disabled = false;
        }
        if (stopScanBtn) stopScanBtn.classList.add('hidden');
        if (scannerLine) scannerLine.classList.add('hidden');
        if (processingOverlay) processingOverlay.classList.add('hidden');
        if (camStatusText) camStatusText.textContent = 'HUD READY';
        if (camLed) camLed.className = 'led-dot info';

        if (cameraFeed) {
            cameraFeed.innerHTML = `
                <div class="mock-camera-view">
                    <i class="fa-solid fa-camera camera-icon"></i>
                    <p style="color:var(--text-primary);font-weight:600;margin-bottom:4px;">Camera đang ở chế độ chờ</p>
                    <p class="text-xs text-muted">Nhấn nút để kích hoạt Camera quét HUD</p>
                </div>
            `;
        }
    }

    if (startScanBtn) startScanBtn.addEventListener('click', startScanner);
    if (stopScanBtn) stopScanBtn.addEventListener('click', stopScanner);

    // ==========================================
    // Fallback Input: InputOTP Logic (Requirement A)
    // ==========================================
    const otpDigits = document.querySelectorAll('.otp-digit');
    const submitOtpBtn = document.getElementById('submitOtpBtn');

    otpDigits.forEach((input, idx) => {
        // Auto jump to next input on typing
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val.length === 1) {
                if (idx < otpDigits.length - 1) {
                    otpDigits[idx + 1].focus();
                } else {
                    // Last digit filled: auto-submit!
                    submitEnteredOtp();
                }
            }
        });

        // Jump back on backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && idx > 0) {
                otpDigits[idx - 1].focus();
            } else if (e.key === 'Enter') {
                submitEnteredOtp();
            }
        });

        // Auto select on focus
        input.addEventListener('focus', () => input.select());
    });

    function submitEnteredOtp() {
        let code = '';
        otpDigits.forEach(d => { code += d.value.trim(); });

        if (code.length < 2) {
            window.showSonnerToast && window.showSonnerToast({
                title: 'Vui lòng nhập đủ mã số máy',
                description: 'Nhập ít nhất 2 - 3 chữ số cuối (VD: 101)',
                level: 'warning',
                playSound: false
            });
            return;
        }

        const fullMachineId = `RIEKER-M${code}`;
        window.playAlertSound && window.playAlertSound('default');

        // Open Machine Drawer
        if (window.openMachineDrawer) {
            window.openMachineDrawer(fullMachineId);
        } else {
            localStorage.setItem('temp_scanned_id', fullMachineId);
            window.location.href = `request-form.html?machine=${encodeURIComponent(fullMachineId)}`;
        }
    }

    if (submitOtpBtn) submitOtpBtn.addEventListener('click', submitEnteredOtp);

    // Quick selection chips
    const quickChips = document.querySelectorAll('.quick-chip-btn');
    quickChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const mId = chip.getAttribute('data-id');
            window.playAlertSound && window.playAlertSound('default');
            if (window.openMachineDrawer) {
                window.openMachineDrawer(mId);
            } else {
                localStorage.setItem('temp_scanned_id', mId);
                window.location.href = `request-form.html?machine=${encodeURIComponent(mId)}`;
            }
        });
    });

    // Populate quick chips dynamically if devices exist in Supabase
    if (window.fetchDevices) {
        window.fetchDevices().then(devices => {
            if (devices && devices.length > 0) {
                const chipsContainer = document.getElementById('quickChips');
                if (chipsContainer) {
                    chipsContainer.innerHTML = devices.slice(0, 6).map(d => `
                        <button class="quick-chip-btn" data-id="${d.machine_id}">
                            ${d.machine_id.replace('RIEKER-', '')} (${d.device_name.split(' ')[0]} ${d.device_name.split(' ')[1] || ''})
                        </button>
                    `).join('');

                    chipsContainer.querySelectorAll('.quick-chip-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const mId = btn.getAttribute('data-id');
                            window.openMachineDrawer(mId);
                        });
                    });
                }
            }
        });
    }

});
