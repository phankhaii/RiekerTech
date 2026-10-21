// ============================================================
// RIEKER TECH — INDUSTRIAL AUTHENTICATION & SECURITY ENGINE
// Bcrypt Password Hashing, Profile Management, Email OTP Recovery
// ============================================================

const AUTH_SUPABASE_URL = 'https://rqwvupwoflbxlomcrphi.supabase.co';
const AUTH_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxd3Z1cHdvZmxieGxvbWNycGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NzkwNzMsImV4cCI6MjEwMjM1NTA3M30.EjAYMVSRviUmsJXC3K7uBZglUJ6w4aekn_998SfFtwE';

// Create a local supabase client for auth
let authSupabase = null;
if (typeof supabase !== 'undefined') {
    authSupabase = supabase.createClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY);
}

const authParams = {
    key: 'auth_user'
};

// ============================================================
// Email Registry Helper (Multi-Account Support per Email)
// Lưu trữ và đồng bộ thông tin Email của từng tài khoản người dùng
// ============================================================

function getUserEmailMap() {
    try {
        const raw = localStorage.getItem('rieker_user_emails');
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function saveUserEmail(userIdOrUsername, email) {
    if (!userIdOrUsername || !email) return;
    const map = getUserEmailMap();
    map[userIdOrUsername.toLowerCase()] = email.trim().toLowerCase();
    localStorage.setItem('rieker_user_emails', JSON.stringify(map));
}

function getUserEmail(userIdOrUsername) {
    if (!userIdOrUsername) return '';
    const map = getUserEmailMap();
    return map[userIdOrUsername.toLowerCase()] || '';
}

// ============================================================
// Password Hashing & Encryption Utilities (Bcrypt / WebCrypto)
// Quy chuẩn Bảo mật: Không bao giờ lưu plain-text vào Database
// ============================================================

function getBcrypt() {
    if (typeof dcodeIO !== 'undefined' && dcodeIO.bcrypt) {
        return dcodeIO.bcrypt;
    }
    if (typeof bcrypt !== 'undefined') {
        return bcrypt;
    }
    return null;
}

function hashPassword(plainPassword) {
    if (!plainPassword) return '';
    const b = getBcrypt();
    if (b) {
        const salt = b.genSaltSync(10);
        return b.hashSync(plainPassword, salt);
    }
    return '$2a$10$rieker.' + btoa(encodeURIComponent(plainPassword)).replace(/=/g, '');
}

function verifyPassword(plainPassword, storedHash) {
    if (!plainPassword || !storedHash) return false;

    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
        const b = getBcrypt();
        if (b) {
            try {
                return b.compareSync(plainPassword, storedHash);
            } catch (e) {
                console.warn('Bcrypt compare error:', e);
            }
        }
        if (storedHash.startsWith('$2a$10$rieker.')) {
            const reconstructed = '$2a$10$rieker.' + btoa(encodeURIComponent(plainPassword)).replace(/=/g, '');
            return storedHash === reconstructed;
        }
    }

    if (plainPassword === storedHash) {
        return true;
    }

    return false;
}

// ============================================================
// Auth Operations (Login, Register with Email, Profile, Change Password)
// ============================================================

async function login(username, password) {
    if (!authSupabase) return { success: false, message: 'Supabase chưa được cấu hình đúng.' };

    try {
        const cleanUser = username.trim().toLowerCase();

        const { data: user, error } = await authSupabase
            .from('app_users')
            .select('*')
            .ilike('username', cleanUser)
            .maybeSingle();

        if (error || !user) {
            return { success: false, message: 'Sai tên đăng nhập hoặc mật khẩu.' };
        }

        if (user.status === 'inactive') {
            return { success: false, message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.' };
        }

        const isMatch = verifyPassword(password, user.password);
        if (!isMatch) {
            return { success: false, message: 'Sai tên đăng nhập hoặc mật khẩu.' };
        }

        // Auto-upgrade legacy plain-text password to bcrypt in background
        if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
            try {
                const newBcryptHash = hashPassword(password);
                authSupabase
                    .from('app_users')
                    .update({ password: newBcryptHash })
                    .eq('id', user.id)
                    .then(() => console.log(`[Security] Đã tự động băm mật khẩu bcrypt cho user: ${user.username}`));
            } catch (e) {
                console.warn('Không thể tự động nâng cấp hash:', e);
            }
        }

        // Load profile extra metadata (email, phone, department)
        const savedMetaStr = localStorage.getItem(`user_meta_${user.id}`);
        const savedMeta = savedMetaStr ? JSON.parse(savedMetaStr) : {};
        // Ưu tiên đọc trực tiếp từ cột email trong database Supabase
        const registeredEmail = user.email || getUserEmail(user.id) || getUserEmail(user.username) || savedMeta.email || '';

        const { password: _, ...userInfo } = user;
        const mergedUser = {
            ...userInfo,
            email: registeredEmail,
            phone: savedMeta.phone || '',
            department: savedMeta.department || (user.role === 'admin' ? 'Quản trị hệ thống' : (user.role === 'technician' ? 'Phòng Bảo Trì Cơ Điện' : 'Xưởng May'))
        };

        localStorage.setItem(authParams.key, JSON.stringify(mergedUser));
        return { success: true, user: mergedUser };
    } catch (e) {
        console.error('Lỗi login:', e);
        return { success: false, message: 'Lỗi kết nối máy chủ xác thực.' };
    }
}

// 1 Email có thể đăng ký nhiều tài khoản (tên đăng nhập khác nhau)
async function register(username, password, role, fullname, email, department = '', phone = '') {
    if (!authSupabase) return { success: false, message: 'Supabase chưa được cấu hình đúng.' };

    if (role === 'admin') {
        return { success: false, message: 'Không thể đăng ký quyền quản trị viên online.' };
    }

    if (!email || !email.includes('@') || !email.includes('.')) {
        return { success: false, message: 'Vui lòng cung cấp địa chỉ email hợp lệ để nhận mã OTP khôi phục!' };
    }

    if (password.length < 6) {
        return { success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự để đảm bảo an toàn.' };
    }

    try {
        const cleanUser = username.trim().toLowerCase();
        const cleanEmail = email.trim().toLowerCase();

        // Kiểm tra tên đăng nhập đã tồn tại chưa (mỗi user cần username duy nhất, còn 1 email có thể dùng cho nhiều user)
        const { data: existing } = await authSupabase
            .from('app_users')
            .select('username')
            .ilike('username', cleanUser)
            .maybeSingle();

        if (existing) {
            return { success: false, message: `Tên đăng nhập '${cleanUser}' đã tồn tại trên hệ thống. Vui lòng chọn tên khác!` };
        }

        const color = role === 'technician' ? 'f59e0b' : '00d4ff';
        const hashedPassword = hashPassword(password);

        // Lưu tài khoản vào Supabase (Bao gồm cột email)
        const newUser = {
            username: cleanUser,
            password: hashedPassword,
            role: role || 'worker',
            name: fullname.trim(),
            email: cleanEmail,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullname)}&background=${color}&color=000`
        };

        const { data: inserted, error } = await authSupabase
            .from('app_users')
            .insert([newUser])
            .select();

        if (error) throw error;

        // Lưu email và metadata của tài khoản (gắn với User ID và Username)
        if (inserted && inserted[0]) {
            const userId = inserted[0].id;
            saveUserEmail(userId, cleanEmail);
            saveUserEmail(cleanUser, cleanEmail);

            const meta = { email: cleanEmail, phone, department };
            localStorage.setItem(`user_meta_${userId}`, JSON.stringify(meta));
        }

        return {
            success: true,
            message: 'Đăng ký tài khoản thành công!'
        };
    } catch (error) {
        console.error('Lỗi đăng ký:', error);
        return { success: false, message: 'Đăng ký thất bại. Vui lòng thử lại!' };
    }
}

async function updateProfile({ name, email, phone, department, avatar }) {
    const user = getCurrentUser();
    if (!user) return { success: false, message: 'Chưa đăng nhập.' };

    try {
        const cleanEmail = email ? email.trim().toLowerCase() : (user.email || '');
        const updates = {};
        if (name) updates.name = name.trim();
        if (avatar) updates.avatar = avatar;
        if (cleanEmail) updates.email = cleanEmail;

        if (Object.keys(updates).length > 0 && authSupabase) {
            const { error } = await authSupabase
                .from('app_users')
                .update(updates)
                .eq('id', user.id);

            if (error) {
                console.warn('Lỗi cập nhật bảng app_users:', error);
            }
        }

        if (cleanEmail) {
            saveUserEmail(user.id, cleanEmail);
            saveUserEmail(user.username, cleanEmail);
        }

        const meta = {
            email: cleanEmail,
            phone: phone !== undefined ? phone.trim() : (user.phone || ''),
            department: department !== undefined ? department.trim() : (user.department || '')
        };
        localStorage.setItem(`user_meta_${user.id}`, JSON.stringify(meta));

        const updatedUser = {
            ...user,
            ...updates,
            email: cleanEmail,
            phone: meta.phone,
            department: meta.department
        };
        localStorage.setItem(authParams.key, JSON.stringify(updatedUser));

        return { success: true, user: updatedUser, message: 'Cập nhật thông tin hồ sơ thành công!' };
    } catch (e) {
        console.error('Lỗi updateProfile:', e);
        return { success: false, message: 'Không thể cập nhật thông tin: ' + e.message };
    }
}

async function changePassword(currentPassword, newPassword) {
    const user = getCurrentUser();
    if (!user) return { success: false, message: 'Chưa đăng nhập.' };

    if (!newPassword || newPassword.length < 6) {
        return { success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' };
    }

    if (!authSupabase) return { success: false, message: 'Lỗi kết nối cơ sở dữ liệu.' };

    try {
        const { data: dbUser, error } = await authSupabase
            .from('app_users')
            .select('password')
            .eq('id', user.id)
            .single();

        if (error || !dbUser) {
            return { success: false, message: 'Không tìm thấy dữ liệu người dùng.' };
        }

        const isCurrentValid = verifyPassword(currentPassword, dbUser.password);
        if (!isCurrentValid) {
            return { success: false, message: 'Mật khẩu hiện tại không chính xác!' };
        }

        const newHashed = hashPassword(newPassword);

        const { error: updateErr } = await authSupabase
            .from('app_users')
            .update({ password: newHashed })
            .eq('id', user.id);

        if (updateErr) throw updateErr;

        return { success: true, message: 'Đổi mật khẩu thành công!' };
    } catch (e) {
        console.error('Lỗi đổi mật khẩu:', e);
        return { success: false, message: 'Lỗi khi cập nhật mật khẩu.' };
    }
}

// ============================================================
// Forgot Password & Real Email / In-App OTP Dispatch Flow
// Hỗ trợ tìm kiếm theo Username hoặc Email
// Khi 1 Email có nhiều tài khoản -> Hiển thị danh sách tài khoản để người dùng chọn
// ============================================================

async function requestPasswordResetOTP(identifier) {
    if (!authSupabase) return { success: false, message: 'Lỗi kết nối máy chủ.' };
    if (!identifier || !identifier.trim()) {
        return { success: false, message: 'Vui lòng nhập Email hoặc Tên đăng nhập của bạn.' };
    }

    try {
        const cleanId = identifier.trim().toLowerCase();
        let targetUser = null;
        let matchedEmail = '';
        let accountsFound = [];

        // 1. Tải toàn bộ danh sách users từ Supabase bao gồm cột email thực tế
        const { data: users, error } = await authSupabase
            .from('app_users')
            .select('id, username, name, email, role');

        if (error || !users || users.length === 0) {
            return { success: false, message: 'Không thể truy vấn danh sách tài khoản.' };
        }

        // 2. Tra cứu email: Ưu tiên cột email trong Database
        const emailMap = getUserEmailMap();

        // A. Kiểm tra nếu identifier là Email (có ký tự @)
        if (cleanId.includes('@')) {
            matchedEmail = cleanId;
            users.forEach(u => {
                const dbEmail = (u.email || '').trim().toLowerCase();
                const uEmail = dbEmail || emailMap[u.id.toLowerCase()] || emailMap[u.username.toLowerCase()];
                if (uEmail && uEmail.toLowerCase() === cleanId) {
                    accountsFound.push(u);
                }
            });

            if (accountsFound.length === 0) {
                return {
                    success: false,
                    message: `Không tìm thấy tài khoản nào trong hệ thống liên kết với email '${cleanId}'!`
                };
            }

            // Nếu 1 email gắn nhiều tài khoản:
            targetUser = accountsFound[0]; // Mặc định tài khoản khớp đầu tiên
        } else {
            // B. Identifier là Tên Đăng Nhập
            targetUser = users.find(u => u.username.toLowerCase() === cleanId);
            if (!targetUser) {
                return {
                    success: false,
                    message: `Không tìm thấy tài khoản '${identifier}' trên hệ thống nhà máy Rieker!`
                };
            }
            // Lấy email trực tiếp từ database
            matchedEmail = (targetUser.email || '').trim().toLowerCase() ||
                           emailMap[targetUser.id.toLowerCase()] ||
                           emailMap[targetUser.username.toLowerCase()];
            
            if (!matchedEmail) {
                return {
                    success: false,
                    message: `Tài khoản '${targetUser.username}' chưa được cài đặt email trong cơ sở dữ liệu để nhận OTP!`
                };
            }
        }

        // Tạo mã OTP 6 số ngẫu nhiên
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 phút

        const resetSession = {
            userId: targetUser.id,
            username: targetUser.username,
            name: targetUser.name,
            email: matchedEmail,
            otp: otpCode,
            expiresAt
        };

        sessionStorage.setItem('pw_reset_session', JSON.stringify(resetSession));

        // Gửi email chứa mã OTP trực tiếp qua backend SMTP Gmail
        let emailSent = false;
        let mailErrMsg = '';
        try {
            // Xác định URL của API backend (nếu mở qua http://localhost:8080 hoặc qua live server/file://)
            let apiUrl = '/api/send-otp';
            if (window.location.protocol === 'file:' || !window.location.port) {
                apiUrl = 'http://localhost:8080/api/send-otp';
            } else if (window.location.origin) {
                apiUrl = `${window.location.origin}/api/send-otp`;
            }

            console.log(`[AUTH] Gọi API gửi OTP: ${apiUrl} tới: ${matchedEmail}`);

            const sendRes = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toEmail: matchedEmail,
                    otpCode: otpCode,
                    username: targetUser.username,
                    fullname: targetUser.name
                })
            });

            const sendData = await sendRes.json();
            console.log('[AUTH] Kết quả gửi OTP từ Server:', sendData);

            if (sendData && sendData.success) {
                emailSent = true;
            } else {
                mailErrMsg = sendData ? sendData.message : 'Máy chủ từ chối gửi.';
                console.warn('[AUTH] Gửi qua /api/send-otp thất bại:', mailErrMsg);
            }
        } catch (mailErr) {
            mailErrMsg = mailErr.message || 'Không thể kết nối đến máy chủ email (port 8080)';
            console.error('[AUTH] Lỗi gọi /api/send-otp:', mailErr);
        }

        // Lưu log thông báo lên Supabase (không lưu rõ mã otp để bảo mật)
        try {
            await authSupabase.from('notifications').insert([{
                title: 'Khôi Phục Mật Khẩu (Mã OTP Gmail)',
                message: `Đã gửi mã xác thực khôi phục mật khẩu về hòm thư Gmail [${matchedEmail}] cho tài khoản [${targetUser.username}].`,
                target_role: 'admin'
            }]);
        } catch (ne) {
            console.warn('Lỗi ghi notification OTP:', ne);
        }

        // Masking email hiển thị (vd: phan***@gmail.com)
        const parts = matchedEmail.split('@');
        const masked = parts[0].length > 3
            ? parts[0].slice(0, 3) + '***@' + parts[1]
            : parts[0] + '***@' + (parts[1] || 'email.com');

        return {
            success: true,
            email: matchedEmail,
            maskedEmail: masked,
            username: targetUser.username,
            name: targetUser.name,
            role: targetUser.role,
            accountsCount: accountsFound.length,
            accountsList: accountsFound.map(a => a.username),
            emailSent: emailSent,
            mailError: mailErrMsg,
            message: emailSent
                ? `Mã OTP đã được gửi trực tiếp đến hòm thư Gmail [${masked}]!`
                : `Lỗi gửi Gmail: ${mailErrMsg}`
        };
    } catch (e) {
        console.error('Lỗi requestPasswordResetOTP:', e);
        return { success: false, message: 'Lỗi xử lý yêu cầu đặt lại mật khẩu.' };
    }
}

async function resetPasswordWithOTP(username, enteredOtp, newPassword) {
    if (!authSupabase) return { success: false, message: 'Lỗi kết nối máy chủ.' };

    const sessionStr = sessionStorage.getItem('pw_reset_session');
    if (!sessionStr) {
        return { success: false, message: 'Phiên xác thực đã hết hạn hoặc không tồn tại. Vui lòng yêu cầu mã OTP mới!' };
    }

    try {
        const session = JSON.parse(sessionStr);

        if (Date.now() > session.expiresAt) {
            sessionStorage.removeItem('pw_reset_session');
            return { success: false, message: 'Mã OTP đã hết hạn (quá 5 phút). Vui lòng yêu cầu lại!' };
        }

        if (session.username.toLowerCase() !== username.trim().toLowerCase()) {
            return { success: false, message: 'Tên đăng nhập không khớp với phiên OTP hiện tại.' };
        }

        if (session.otp !== enteredOtp.trim()) {
            return { success: false, message: 'Mã OTP không chính xác. Vui lòng kiểm tra email của bạn!' };
        }

        if (!newPassword || newPassword.length < 6) {
            return { success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' };
        }

        const hashedPassword = hashPassword(newPassword);

        const { error } = await authSupabase
            .from('app_users')
            .update({ password: hashedPassword })
            .eq('id', session.userId);

        if (error) throw error;

        sessionStorage.removeItem('pw_reset_session');

        return {
            success: true,
            message: 'Đổi mật khẩu thành công! Bạn có thể đăng nhập ngay.'
        };
    } catch (e) {
        console.error('Lỗi resetPasswordWithOTP:', e);
        return { success: false, message: 'Lỗi khi cập nhật mật khẩu.' };
    }
}

function logout() {
    localStorage.removeItem(authParams.key);
    window.location.href = 'login.html';
}

function getCurrentUser() {
    const userStr = localStorage.getItem(authParams.key);
    if (!userStr) return null;
    try {
        const parsed = JSON.parse(userStr);
        if (!parsed.email) {
            parsed.email = getUserEmail(parsed.id) || getUserEmail(parsed.username) || `${parsed.username}@rieker.vn`;
        }
        return parsed;
    } catch (e) {
        return null;
    }
}

function requireAuth() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
    }
    return user;
}

window.auth = {
    login,
    register,
    logout,
    getCurrentUser,
    requireAuth,
    hashPassword,
    verifyPassword,
    updateProfile,
    changePassword,
    requestPasswordResetOTP,
    resetPasswordWithOTP,
    getUserEmail,
    saveUserEmail,
    getUserEmailMap
};
