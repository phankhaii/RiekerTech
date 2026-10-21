// Supabase Database Management
const SUPABASE_URL = 'https://rqwvupwoflbxlomcrphi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxd3Z1cHdvZmxieGxvbWNycGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NzkwNzMsImV4cCI6MjEwMjM1NTA3M30.EjAYMVSRviUmsJXC3K7uBZglUJ6w4aekn_998SfFtwE';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchRequests() {
    try {
        const { data, error } = await supabaseClient
            .from('maintenance_requests')
            .select('*')
            .order('created_at', { ascending: false }); 
            
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Lỗi khi tải dữ liệu từ Supabase:', err);
        return [];
    }
}

async function saveRequest(newReq) {
    const mappedData = {
        request_id: 'REQ-' + Math.floor(Math.random() * 9000 + 1000), 
        machine_id: newReq.machineId,
        reporter_name: newReq.reporter,
        issue_level: newReq.level,
        issue_desc: newReq.desc,
        status: 'pending'
    };

    try {
        const { error } = await supabaseClient
            .from('maintenance_requests')
            .insert([mappedData]);
            
        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Lỗi khi lưu dữ liệu lên Supabase:', err);
        return false;
    }
}

window.fetchRequests = fetchRequests;
window.saveRequest = saveRequest;

async function updateRequestStatus(reqId, newStatus) {
    try {
        // First verify the record exists (Select usually works if policy allows)
        const { data: existing, error: fetchErr } = await supabaseClient
            .from('maintenance_requests')
            .select('request_id, status')
            .eq('request_id', reqId)
            .single();
        
        if (fetchErr || !existing) {
            console.error('Không tìm thấy yêu cầu (hoặc RLS cấm SELECT):', reqId, fetchErr);
            return false;
        }

        // Supabase RLS silent fail behavior requires .select() to detect if row was actually updated
        const { data, error } = await supabaseClient
            .from('maintenance_requests')
            .update({ status: newStatus })
            .eq('request_id', reqId)
            .select();
        
        if (error) throw error;
        
        // If data is empty, it means no rows were updated, which is almost always an RLS UPDATE policy rejection.
        if (!data || data.length === 0) {
            console.error('UPDATE bị Supabase từ chối (RLS Policy).');
            return false;
        }

        return true;
    } catch (err) {
        console.error('Lỗi khi cập nhật trạng thái:', err);
        return false;
    }
}

async function deleteMaintenanceRequest(reqId) {
    try {
        const { error } = await supabaseClient
            .from('maintenance_requests')
            .delete()
            .eq('request_id', reqId);
        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Lỗi khi xóa yêu cầu:', err);
        return false;
    }
}

window.updateRequestStatus = updateRequestStatus;
window.deleteMaintenanceRequest = deleteMaintenanceRequest;

// ==========================================
// Devices (Thiết bị) Management
// ==========================================
async function checkDeviceExists(machineId) {
    const res = await validateMachineStatus(machineId);
    return res.code !== 'NOT_FOUND';
}

async function checkMachineIsUnderMaintenance(machineId) {
    const res = await validateMachineStatus(machineId);
    return res.code === 'UNDER_MAINTENANCE';
}

async function validateMachineStatus(machineId) {
    if (!machineId) {
        return { valid: false, code: 'NOT_FOUND', error: 'Vui lòng nhập hoặc quét Mã Thiết bị!' };
    }

    const cleanId = machineId.trim().toUpperCase();

    // 1. Kiểm tra tồn tại của Thiết bị (Machine Existence Check)
    let device = null;
    try {
        const { data, error } = await supabaseClient
            .from('devices')
            .select('*')
            .ilike('machine_id', cleanId)
            .maybeSingle();

        if (!error && data) {
            device = data;
        }
    } catch (e) {
        console.warn('Lỗi kiểm tra bảng devices:', e);
    }

    if (!device) {
        return {
            valid: false,
            code: 'NOT_FOUND',
            error: `Lỗi: Mã thiết bị '${cleanId}' không tồn tại trên hệ thống nhà máy!`
        };
    }

    // 2. Chống trùng lặp Yêu cầu Bảo trì (Duplicate Prevention)
    try {
        const { data: activeRequests, error: reqErr } = await supabaseClient
            .from('maintenance_requests')
            .select('request_id, status, created_at, issue_level')
            .eq('machine_id', device.machine_id)
            .in('status', ['pending', 'processing', 'in_progress'])
            .order('created_at', { ascending: false })
            .limit(1);

        if (!reqErr && activeRequests && activeRequests.length > 0) {
            const activeReq = activeRequests[0];
            return {
                valid: false,
                code: 'UNDER_MAINTENANCE',
                device: device,
                activeRequest: activeReq,
                error: `Máy ${cleanId} hiện đang trong quá trình bảo trì (Mã phiếu: ${activeReq.request_id}). Không thể tạo thêm yêu cầu mới!`
            };
        }
    } catch (e) {
        console.warn('Lỗi kiểm tra trùng lặp phiếu bảo trì:', e);
    }

    return {
        valid: true,
        device: device
    };
}

async function fetchDevices() {
    try {
        const { data, error } = await supabaseClient
            .from('devices')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Lỗi tải danh sách thiết bị:', err);
        return [];
    }
}

async function addDevice(device) {
    try {
        const { data, error } = await supabaseClient
            .from('devices')
            .insert([device])
            .select();
        if (error) throw error;
        return data ? data[0] : null;
    } catch (err) {
        console.error('Lỗi thêm thiết bị:', err);
        return null;
    }
}

async function deleteDevice(id) {
    try {
        const { error } = await supabaseClient
            .from('devices')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Lỗi xóa thiết bị:', err);
        return false;
    }
}

window.validateMachineStatus = validateMachineStatus;
window.checkDeviceExists = checkDeviceExists;
window.checkMachineIsUnderMaintenance = checkMachineIsUnderMaintenance;
window.fetchDevices = fetchDevices;
window.addDevice = addDevice;
window.deleteDevice = deleteDevice;

// ==========================================
// History (Lịch Sử) Management
// ==========================================
async function fetchHistory(filter = {}) {
    try {
        let query = supabaseClient
            .from('maintenance_requests')
            .select('*')
            .eq('status', 'completed')
            .order('created_at', { ascending: false });

        if (filter.machine_id) query = query.ilike('machine_id', `%${filter.machine_id}%`);
        if (filter.reporter)   query = query.ilike('reporter_name', `%${filter.reporter}%`);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Lỗi tải lịch sử:', err);
        return [];
    }
}
window.fetchHistory = fetchHistory;

// ==========================================
// Users (Quản Lý Người Dùng) Management
// ==========================================
async function fetchUsers() {
    try {
        const { data, error } = await supabaseClient
            .from('app_users')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Lỗi tải danh sách người dùng:', err);
        return [];
    }
}

async function addUser(user) {
    try {
        const { data, error } = await supabaseClient
            .from('app_users')
            .insert([user])
            .select();
        if (error) throw error;
        return { success: true, data: data ? data[0] : null };
    } catch (err) {
        console.error('Lỗi thêm người dùng:', err);
        return { success: false, message: err.message };
    }
}

async function toggleUserStatus(id, newStatus) {
    try {
        const { error } = await supabaseClient
            .from('app_users')
            .update({ status: newStatus })
            .eq('id', id);
        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Lỗi cập nhật trạng thái người dùng:', err);
        return false;
    }
}

async function deleteUser(id) {
    try {
        const { error } = await supabaseClient
            .from('app_users')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Lỗi xóa người dùng:', err);
        return false;
    }
}

window.fetchUsers = fetchUsers;
window.addUser = addUser;
window.toggleUserStatus = toggleUserStatus;
window.deleteUser = deleteUser;

// ==========================================
// Notifications System
// ==========================================
async function saveNotification(notifObj) {
    try {
        await supabaseClient.from('notifications').insert([notifObj]);
    } catch(e) {
        console.error('Lỗi khi lưu thông báo:', e);
    }
}

async function fetchNotifications(user) {
    try {
        let query = supabaseClient.from('notifications').select('*').eq('is_read', false).order('created_at', { ascending: false });
        // Worker only sees notifications specifically targeted to them
        if (user.role === 'worker') {
            query = query.eq('target_user', user.name);
        } else {
            // Admin/Tech: sees notifications for their role, or broadcast 'all'
            // We'll just filter by their exact role to keep it simple
            query = query.eq('target_role', user.role);
        }
        const { data } = await query;
        return data || [];
    } catch (e) {
        return [];
    }
}

async function markNotificationRead(id) {
    try {
        await supabaseClient.from('notifications').update({ is_read: true }).eq('id', id);
    } catch(e) {
        console.error(e);
    }
}

window.saveNotification = saveNotification;
window.fetchNotifications = fetchNotifications;
window.markNotificationRead = markNotificationRead;
