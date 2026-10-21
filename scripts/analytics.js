// ============================================================
// RIEKER TECH — ADMIN INCIDENT ANALYTICS LOGIC (PROMPT 4)
// Top 5 Bar Chart (P1 Red / P2 Amber) + Ranking Breakdown Table
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Role Protection (Admin Only)
    const user = window.auth ? window.auth.requireAuth() : null;
    if (!user) return;
    if (user.role !== 'admin') {
        alert('Trang Thống Kê Sự Cố chỉ dành cho Quản Trị Viên (Admin). Đang chuyển hướng về Tổng quan...');
        window.location.href = 'index.html';
        return;
    }

    // 2. Render Navigation Shell
    const sb = document.getElementById('sidebar-container');
    const hd = document.getElementById('header-container');
    if (sb) sb.innerHTML = window.renderSidebar('analytics');
    if (hd) hd.innerHTML = window.renderHeader();

    // Elements
    const filterMonth      = document.getElementById('filterMonth');
    const filterYear       = document.getElementById('filterYear');
    const filterDepartment = document.getElementById('filterDepartment');
    const resetFilterBtn   = document.getElementById('resetFilterBtn');
    const exportCsvBtn     = document.getElementById('exportCsvBtn');
    const machineSearch    = document.getElementById('machineSearchInput');
    const sortToggleBtn    = document.getElementById('sortToggleBtn');
    const sortToggleLabel  = document.getElementById('sortToggleLabel');

    const metricTotalIncidents = document.getElementById('metricTotalIncidents');
    const metricP1Count        = document.getElementById('metricP1Count');
    const metricP2Count        = document.getElementById('metricP2Count');
    const metricTotalDowntime  = document.getElementById('metricTotalDowntime');
    const rankingTableBody     = document.getElementById('rankingTableBody');
    const tableFilterSummary   = document.getElementById('tableFilterSummary');

    let allDevices = [];
    let allRequests = [];
    let sortDescending = true; // Default: Hỏng nhiều nhất ⬇
    let barChartInstance = null;

    // Load initial date defaults (all months or current month)
    const now = new Date();
    // Keep 'all' as default for full visibility, user can filter by month
    if (filterYear) filterYear.value = now.getFullYear().toString();

    // 3. Load Data from Supabase
    async function loadData() {
        try {
            const [devices, requests] = await Promise.all([
                window.fetchDevices ? window.fetchDevices() : [],
                window.fetchRequests ? window.fetchRequests() : []
            ]);

            allDevices = devices || [];
            allRequests = requests || [];

            computeAndRender();
        } catch (err) {
            console.error('Lỗi nạp dữ liệu thống kê:', err);
            if (rankingTableBody) {
                rankingTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--p1-red);padding:2rem;"><i class="fa-solid fa-triangle-exclamation"></i> Lỗi kết nối cơ sở dữ liệu Supabase.</td></tr>`;
            }
        }
    }

    // 4. Computation Engine
    function computeAndRender() {
        const selectedMonth = filterMonth ? filterMonth.value : 'all';
        const selectedYear  = filterYear ? filterYear.value : 'all';
        const selectedDept  = filterDepartment ? filterDepartment.value : 'all';
        const searchQuery   = machineSearch ? machineSearch.value.trim().toLowerCase() : '';

        // Filter requests based on time
        const filteredRequests = allRequests.filter(req => {
            if (!req.created_at) return true;
            const reqDate = new Date(req.created_at);

            if (selectedYear !== 'all') {
                if (reqDate.getFullYear().toString() !== selectedYear) return false;
            }

            if (selectedMonth !== 'all') {
                // getMonth() is 0-indexed (0 = Jan, 11 = Dec)
                if ((reqDate.getMonth() + 1).toString() !== selectedMonth) return false;
            }

            return true;
        });

        // Map devices and associate incident requests
        const deviceMap = new Map();

        allDevices.forEach(d => {
            deviceMap.set(d.machine_id.toUpperCase(), {
                machine_id: d.machine_id.toUpperCase(),
                device_name: d.device_name || 'Thiết bị sản xuất',
                department: d.department || 'Xưởng May',
                p1Count: 0,
                p2Count: 0,
                totalBreakdowns: 0,
                downtimeHours: 0
            });
        });

        // Aggregate incidents
        let totalP1 = 0;
        let totalP2 = 0;

        filteredRequests.forEach(req => {
            const mId = (req.machine_id || '').trim().toUpperCase();
            if (!mId) return;

            if (!deviceMap.has(mId)) {
                // If machine exists in requests but not in devices catalog
                deviceMap.set(mId, {
                    machine_id: mId,
                    device_name: `Thiết bị ${mId}`,
                    department: 'Xưởng May',
                    p1Count: 0,
                    p2Count: 0,
                    totalBreakdowns: 0,
                    downtimeHours: 0
                });
            }

            const record = deviceMap.get(mId);
            const isP1 = req.issue_level === 'high' || req.issue_level === 'p1';

            if (isP1) {
                record.p1Count++;
                totalP1++;
                record.downtimeHours += 2.5; // Estimated 2.5 hours downtime for catastrophic P1 stop
            } else {
                record.p2Count++;
                totalP2++;
                record.downtimeHours += 0.5; // Estimated 0.5 hours downtime for minor P2 fault
            }

            record.totalBreakdowns = record.p1Count + record.p2Count;
        });

        // Convert Map to Array
        let machineStats = Array.from(deviceMap.values());

        // Filter by Department if chosen
        if (selectedDept !== 'all') {
            machineStats = machineStats.filter(m => m.department === selectedDept);
        }

        // Search filter
        if (searchQuery) {
            machineStats = machineStats.filter(m =>
                m.machine_id.toLowerCase().includes(searchQuery) ||
                m.device_name.toLowerCase().includes(searchQuery) ||
                m.department.toLowerCase().includes(searchQuery)
            );
        }

        // Sort machines
        machineStats.sort((a, b) => {
            if (sortDescending) {
                // Highest breakdowns first
                if (b.totalBreakdowns !== a.totalBreakdowns) {
                    return b.totalBreakdowns - a.totalBreakdowns;
                }
                return b.p1Count - a.p1Count;
            } else {
                // Lowest breakdowns first
                if (a.totalBreakdowns !== b.totalBreakdowns) {
                    return a.totalBreakdowns - b.totalBreakdowns;
                }
                return a.p1Count - b.p1Count;
            }
        });

        // Update Summary Metrics
        const totalIncidents = totalP1 + totalP2;
        let totalDowntime = 0;
        machineStats.forEach(m => { totalDowntime += m.downtimeHours; });

        if (metricTotalIncidents) metricTotalIncidents.textContent = totalIncidents;
        if (metricP1Count)        metricP1Count.textContent = totalP1;
        if (metricP2Count)        metricP2Count.textContent = totalP2;
        if (metricTotalDowntime)  metricTotalDowntime.textContent = `${totalDowntime.toFixed(1)}h`;

        // Update Summary text
        if (tableFilterSummary) {
            const mText = selectedMonth === 'all' ? 'Toàn bộ các tháng' : `Tháng ${selectedMonth}`;
            const yText = selectedYear === 'all' ? '' : `/${selectedYear}`;
            const dText = selectedDept === 'all' ? 'Tất cả phân xưởng' : selectedDept;
            tableFilterSummary.textContent = `${mText}${yText} · ${dText} · ${machineStats.length} thiết bị`;
        }

        // 5. Render Bar Chart (Top 5 Máy Hỏng Nhiều Nhất)
        renderTopMachinesChart(machineStats);

        // 6. Render Ranking Table
        renderRankingTable(machineStats);
    }

    // ─── 5. Chart.js Bar Chart Rendering ──────────────────────
    function renderTopMachinesChart(statsArray) {
        const canvas = document.getElementById('topMachinesBarChart');
        if (!canvas) return;

        // Take top 5 machines with highest breakdowns
        const top5 = [...statsArray]
            .sort((a, b) => b.totalBreakdowns - a.totalBreakdowns || b.p1Count - a.p1Count)
            .slice(0, 5);

        // Chart styling colors based on theme
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const textColor = isLight ? '#0f172a' : '#f4f4f5';
        const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)';

        const labels = top5.map(m => m.machine_id);
        const dataP1 = top5.map(m => m.p1Count);
        const dataP2 = top5.map(m => m.p2Count);

        if (barChartInstance) {
            barChartInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        barChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.length > 0 ? labels : ['Không có sự cố'],
                datasets: [
                    {
                        label: 'P1 - Dừng Máy (Khẩn Cấp)',
                        data: labels.length > 0 ? dataP1 : [0],
                        backgroundColor: '#ef4444', // Red
                        borderRadius: 4,
                        barPercentage: 0.65
                    },
                    {
                        label: 'P2 - Hỏng Nhẹ (Cảnh Báo)',
                        data: labels.length > 0 ? dataP2 : [0],
                        backgroundColor: '#f59e0b', // Amber/Orange
                        borderRadius: 4,
                        barPercentage: 0.65
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false },
                        ticks: {
                            color: textColor,
                            font: { family: "'JetBrains Mono', monospace", size: 12, weight: 'bold' }
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: textColor,
                            font: { family: "'Inter', sans-serif", size: 11 }
                        },
                        grid: { color: gridColor }
                    }
                },
                plugins: {
                    legend: {
                        display: false // Using custom top legend
                    },
                    tooltip: {
                        backgroundColor: isLight ? '#ffffff' : '#181a24',
                        titleColor: isLight ? '#0f172a' : '#ffffff',
                        bodyColor: isLight ? '#334155' : '#a1a1aa',
                        borderColor: isLight ? '#e2e8f0' : '#27272a',
                        borderWidth: 1,
                        padding: 10,
                        titleFont: { family: "'JetBrains Mono', monospace", weight: 'bold' },
                        bodyFont: { family: "'Inter', sans-serif" }
                    }
                }
            }
        });
    }

    // ─── 6. Table Rendering ───────────────────────────────────
    function renderRankingTable(statsArray) {
        if (!rankingTableBody) return;

        if (statsArray.length === 0) {
            rankingTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center;padding:2.5rem;" class="text-muted">
                        <i class="fa-solid fa-check-circle" style="font-size:2rem;color:var(--success);margin-bottom:8px;opacity:0.6;"></i>
                        <p style="font-weight:600;color:var(--text-bright);">Không có thiết bị nào phù hợp với bộ lọc</p>
                    </td>
                </tr>
            `;
            return;
        }

        rankingTableBody.innerHTML = statsArray.map((m, idx) => {
            const rank = idx + 1;
            let rankBadge = `<span class="rank-other font-mono">#${rank}</span>`;
            if (sortDescending) {
                if (rank === 1) rankBadge = `<span class="rank-medal rank-1">🥇</span>`;
                else if (rank === 2) rankBadge = `<span class="rank-medal rank-2">🥈</span>`;
                else if (rank === 3) rankBadge = `<span class="rank-medal rank-3">🥉</span>`;
            }

            // Risk Assessment (Prompt 4 Requirement: Cao / Trung bình / Thấp)
            let riskBadge = `<span class="risk-badge risk-low"><span class="led-dot success"></span> Thấp</span>`;
            if (m.p1Count > 0 || m.totalBreakdowns >= 2) {
                riskBadge = `<span class="risk-badge risk-high"><span class="led-dot p1-danger"></span> Cao</span>`;
            } else if (m.p2Count > 0) {
                riskBadge = `<span class="risk-badge risk-medium"><span class="led-dot p2-warning"></span> Trung bình</span>`;
            }

            return `
                <tr>
                    <td style="text-align:center;">${rankBadge}</td>
                    <td>
                        <button class="table-machine-id" onclick="window.openMachineDrawer && window.openMachineDrawer('${m.machine_id}')" style="background:transparent;border:none;cursor:pointer;text-align:left;padding:0;">
                            <span style="background:rgba(0,212,255,0.08);color:#00d4ff;border:1px solid rgba(0,212,255,0.25);padding:3px 7px;border-radius:4px;font-family:var(--font-mono);font-weight:700;">
                                ${m.machine_id}
                            </span>
                        </button>
                    </td>
                    <td><strong style="color:var(--text-bright);">${m.device_name}</strong></td>
                    <td>
                        <span style="background:var(--bg-elevated);border:1px solid var(--border-subtle);padding:2px 8px;border-radius:4px;font-size:0.75rem;">
                            ${m.department}
                        </span>
                    </td>
                    <td style="text-align:center;">
                        <strong style="font-size:0.95rem;color:var(--text-bright);">${m.totalBreakdowns}</strong>
                        ${m.totalBreakdowns > 0 ? `
                            <div style="font-size:0.7rem;margin-top:2px;display:flex;gap:4px;justify-content:center;">
                                <span style="color:var(--p1-red);font-weight:700;" title="Sự cố P1">P1: ${m.p1Count}</span>
                                <span style="color:var(--text-muted);">|</span>
                                <span style="color:var(--p2-amber);font-weight:700;" title="Sự cố P2">P2: ${m.p2Count}</span>
                            </div>
                        ` : ''}
                    </td>
                    <td style="text-align:center;" class="font-mono text-sm">
                        ${m.downtimeHours.toFixed(1)}h
                    </td>
                    <td style="text-align:center;">
                        ${riskBadge}
                    </td>
                    <td style="text-align:center;">
                        <button class="btn btn-outline btn-sm" onclick="window.openMachineDrawer && window.openMachineDrawer('${m.machine_id}')" title="Xem chi tiết thiết bị">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Chi tiết
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ─── 7. Toggle Sort Direction (Prompt 4 Requirement) ──────
    function toggleSortDirection() {
        sortDescending = !sortDescending;
        if (sortToggleLabel) {
            sortToggleLabel.textContent = sortDescending ? 'Hỏng nhiều nhất ⬇' : 'Hỏng ít nhất ⬆';
        }
        if (sortToggleBtn) {
            const icon = sortToggleBtn.querySelector('i');
            if (icon) {
                icon.className = sortDescending ? 'fa-solid fa-arrow-down-wide-short' : 'fa-solid fa-arrow-up-short-wide';
            }
        }
        computeAndRender();
    }

    window.toggleSortDirection = toggleSortDirection;
    if (sortToggleBtn) sortToggleBtn.addEventListener('click', toggleSortDirection);

    // Filter event listeners
    if (filterMonth)      filterMonth.addEventListener('change', computeAndRender);
    if (filterYear)       filterYear.addEventListener('change', computeAndRender);
    if (filterDepartment) filterDepartment.addEventListener('change', computeAndRender);
    if (machineSearch)    machineSearch.addEventListener('input', computeAndRender);

    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', () => {
            if (filterMonth) filterMonth.value = 'all';
            if (filterYear)  filterYear.value = 'all';
            if (filterDepartment) filterDepartment.value = 'all';
            if (machineSearch) machineSearch.value = '';
            sortDescending = true;
            if (sortToggleLabel) sortToggleLabel.textContent = 'Hỏng nhiều nhất ⬇';
            computeAndRender();
        });
    }

    // Export CSV Report
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            const rows = [
                ['Xep Hang', 'Ma Thiet Bi', 'Ten Thiet Bi', 'Vi Tri Xuong', 'Tong So Lan Hong', 'P1 Dung May', 'P2 Hong Nhe', 'Tong Thoi Gian Dung (Gio)', 'Muc Do Rui Ro']
            ];

            const tbody = document.getElementById('rankingTableBody');
            const trList = tbody ? tbody.querySelectorAll('tr') : [];

            trList.forEach((tr, idx) => {
                const tds = tr.querySelectorAll('td');
                if (tds.length >= 7) {
                    const rank = idx + 1;
                    const mId = tds[1].innerText.trim();
                    const name = tds[2].innerText.trim();
                    const dept = tds[3].innerText.trim();
                    const breakdowns = tds[4].innerText.trim().replace(/\n/g, ' ');
                    const downtime = tds[5].innerText.trim();
                    const risk = tds[6].innerText.trim();
                    rows.push([rank, mId, `"${name}"`, `"${dept}"`, `"${breakdowns}"`, '', '', downtime, risk]);
                }
            });

            const csvContent = '\uFEFF' + rows.map(e => e.join(',')).join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Rieker_Incident_Analytics_${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
        });
    }

    // Re-render chart when theme switches so axes remain visible
    window.addEventListener('themeChanged', () => {
        computeAndRender();
    });

    // Start data load
    await loadData();
});
