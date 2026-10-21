const AUTH_SUPABASE_URL = 'https://rqwvupwoflbxlomcrphi.supabase.co';
const AUTH_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxd3Z1cHdvZmxieGxvbWNycGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NzkwNzMsImV4cCI6MjEwMjM1NTA3M30.EjAYMVSRviUmsJXC3K7uBZglUJ6w4aekn_998SfFtwE';

// Create a local supabase client for auth (since store.js might not be loaded in login.html)
let authSupabase = null;
if (typeof supabase !== 'undefined') {
    authSupabase = supabase.createClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY);
}

const authParams = {
    key: 'auth_user'
};

async function login(username, password) {
    if (!authSupabase) return { success: false, message: 'Supabase chưa được cấu hình đúng.' };

    try {
        const { data: user, error } = await authSupabase
            .from('app_users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !user) {
            return { success: false, message: 'Sai tên đăng nhập hoặc mật khẩu.' };
        }
        
        if (user.status === 'inactive') {
            return { success: false, message: 'Tài khoản của bạn đã bị khóa.' };
        }

        const { password: _, ...userInfo } = user;
        localStorage.setItem(authParams.key, JSON.stringify(userInfo));
        return { success: true, user: userInfo };
    } catch (e) {
        return { success: false, message: 'Lỗi mạng khi đăng nhập.' };
    }
}

async function register(username, password, role, fullname) {
    if (!authSupabase) return { success: false, message: 'Supabase chưa được cấu hình đúng.' };

    if (role === 'admin') {
        return { success: false, message: 'Không thể đăng ký quyền quản trị viên online.' };
    }
    
    // Check if user already exists
    try {
        const { data: existing } = await authSupabase
            .from('app_users')
            .select('username')
            .eq('username', username)
            .single();
            
        if (existing) {
            return { success: false, message: 'Tên đăng nhập đã tồn tại.' };
        }

        const color = role === 'technician' ? 'ffb822' : '4cbbb9';
        
        const newUser = {
            username,
            password,
            role,
            name: fullname,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullname)}&background=${color}&color=fff`
        };

        const { error } = await authSupabase
            .from('app_users')
            .insert([newUser]);

        if (error) throw error;
        
        return { success: true, message: 'Đăng ký thành công, vui lòng đăng nhập!' };
    } catch (error) {
        return { success: false, message: 'Lỗi khi đăng ký (có thể do trùng lặp hoặc mảng bảo vệ).' };
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
        return JSON.parse(userStr);
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
    requireAuth
};
