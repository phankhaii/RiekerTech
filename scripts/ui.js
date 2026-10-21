// ============================================================
// RIEKER TECH — INDUSTRIAL UI & SONNER TOAST NOTIFICATIONS
// Real-time alerts with Web Audio API chime & stacked toasts
// ============================================================

// Web Audio API Industrial Bip Sound Synthesizer
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            audioCtx = new AudioContext();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

window.playAlertSound = function(type = 'default') {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'high' || type === 'p1' || type === 'danger') {
            // Urgent double-bip alert
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now); // A5
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

            // Second pulse
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1174, now + 0.12); // D6
            gain2.gain.setValueAtTime(0.14, now + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

            osc.start(now);
            osc.stop(now + 0.1);
            osc2.start(now + 0.12);
            osc2.stop(now + 0.3);
        } else {
            // Subtle pleasant notification chime
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(659.25, now); // E5
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            osc.start(now);
            osc.stop(now + 0.2);
        }
    } catch (e) {
        console.warn('Audio alert not allowed by browser autoplay policy until user gesture:', e);
    }
};

// Ensure sonner container exists
function getOrCreateSonnerContainer() {
    let container = document.getElementById('sonner-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'sonner-container';
        container.className = 'sonner-container';
        document.body.appendChild(container);
    }
    return container;
}

// Modern Sonner Stacked Toast
window.showSonnerToast = function({
    title,
    description = '',
    machineId = null,
    level = 'info', // 'p1', 'p2', 'high', 'medium', 'low', 'success', 'error', 'info'
    department = null,
    playSound = true,
    duration = 4500
}) {
    const container = getOrCreateSonnerContainer();

    // Map level to industrial palette
    const isP1 = level === 'p1' || level === 'high' || level === 'danger';
    const isP2 = level === 'p2' || level === 'medium' || level === 'warning';
    const isSuccess = level === 'success' || level === 'completed';

    let ledClass = 'info';
    let iconHtml = '<i class="fa-solid fa-bell" style="color:var(--info);"></i>';
    let toastTypeClass = '';

    if (isP1) {
        ledClass = 'p1-danger';
        iconHtml = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--p1-red);"></i>';
        toastTypeClass = 'p1-alert';
    } else if (isP2) {
        ledClass = 'p2-warning';
        iconHtml = '<i class="fa-solid fa-circle-exclamation" style="color:var(--p2-amber);"></i>';
    } else if (isSuccess) {
        ledClass = 'success';
        iconHtml = '<i class="fa-solid fa-circle-check" style="color:var(--success);"></i>';
    }

    if (playSound) {
        window.playAlertSound(isP1 ? 'high' : 'default');
    }

    const toast = document.createElement('div');
    toast.className = `sonner-toast ${toastTypeClass}`;

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    let tagsHtml = '';
    if (machineId) {
        tagsHtml += `<span class="badge-mono" style="background:rgba(0,212,255,0.08);color:#00d4ff;border:1px solid rgba(0,212,255,0.2);padding:1px 5px;border-radius:3px;font-size:0.7rem;font-weight:700;">${machineId}</span> `;
    }
    if (department) {
        tagsHtml += `<span style="background:rgba(255,255,255,0.05);color:var(--text-secondary);border:1px solid var(--border-subtle);padding:1px 5px;border-radius:3px;font-size:0.7rem;">${department}</span> `;
    }

    toast.innerHTML = `
        <div class="sonner-icon">
            <span class="led-dot ${ledClass}"></span>
        </div>
        <div class="sonner-body">
            <div class="sonner-title">
                ${title}
            </div>
            ${tagsHtml ? `<div style="margin-bottom:4px;display:flex;gap:4px;flex-wrap:wrap;">${tagsHtml}</div>` : ''}
            <div class="sonner-desc">${description}</div>
            <div class="sonner-time">${timeStr} · Rieker Dispatch</div>
        </div>
        <button class="sonner-close" title="Đóng">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    // Dismiss click
    toast.querySelector('.sonner-close').addEventListener('click', () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 200);
    });

    container.prepend(toast);

    // Limit maximum stacked toasts
    if (container.children.length > 4) {
        const oldest = container.lastElementChild;
        if (oldest) oldest.remove();
    }

    // Auto dismiss
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 250);
        }
    }, duration);
};

// Backward-compatible showToast wrapper
function showToast(title, desc, type = 'success') {
    window.showSonnerToast({
        title,
        description: desc,
        level: type === 'error' ? 'danger' : (type === 'warning' ? 'warning' : 'success'),
        playSound: type === 'error'
    });
}

window.showToast = showToast;
