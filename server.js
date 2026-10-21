const http = require('http');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const PORT = 8080;

// Cấu hình Nodemailer gửi qua Gmail SMTP bằng Google App Password của bạn
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'phanminhkhai2006@gmail.com',
        pass: 'miky hkmc wsoz kddu'.replace(/\s+/g, '') // bỏ khoảng trắng nếu có
    }
});

// Kiểm tra kết nối SMTP khi khởi động
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Lỗi kết nối Gmail SMTP:', error.message);
    } else {
        console.log('✅ Kết nối Gmail SMTP thành công! Sẵn sàng gửi OTP qua phanminhkhai2006@gmail.com');
    }
});

const mime = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ─── API GỬI EMAIL OTP ──────────────────────────────────
    if (req.method === 'POST' && req.url === '/api/send-otp') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body || '{}');
                const { toEmail, otpCode, username, fullname } = data;

                if (!toEmail || !otpCode) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Thiếu email nhận hoặc mã OTP!' }));
                    return;
                }

                console.log(`[EMAIL DISPATCH] Đang gửi mã OTP tới: ${toEmail} cho user: ${username || 'N/A'}`);

                const mailOptions = {
                    from: '"Rieker Tech - Hệ Thống Quản Lý Thiết Bị" <phanminhkhai2006@gmail.com>',
                    to: toEmail,
                    subject: 'Mã OTP Xác Thực Khôi Phục Mật Khẩu — Rieker Tech',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #334155;">
                            <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 24px 30px; text-align: center;">
                                <h1 style="margin: 0; font-size: 24px; color: #ffffff; letter-spacing: 1px;">RIEKER TECH</h1>
                                <p style="margin: 6px 0 0; font-size: 14px; color: #e0f2fe;">Hệ Thống Quản Lý Thiết Bị Nhà Xưởng</p>
                            </div>
                            
                            <div style="padding: 30px 30px 24px;">
                                <h2 style="font-size: 18px; color: #38bdf8; margin-top: 0;">Yêu Cầu Đặt Lại Mật Khẩu</h2>
                                <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                                    Xin chào <strong>${fullname || username || 'Quý khách'}</strong>,<br>
                                    Hệ thống nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>${username || toEmail}</strong> liên kết với email này.
                                </p>
                                
                                <div style="background-color: #1e293b; border: 1px dashed #38bdf8; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
                                    <div style="font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Mã Xác Thực OTP Của Bạn:</div>
                                    <div style="font-size: 32px; font-weight: 800; color: #38bdf8; letter-spacing: 6px; font-family: monospace;">${otpCode}</div>
                                    <div style="font-size: 12px; color: #f59e0b; margin-top: 8px;">⏳ Mã này có hiệu lực trong vòng 5 phút (300 giây).</div>
                                </div>
                                
                                <p style="font-size: 13px; line-height: 1.5; color: #94a3b8;">
                                    ⚠️ <strong>Lưu ý bảo mật:</strong> Tuyệt đối không chia sẻ mã này cho bất kỳ ai khác, kể cả nhân viên kỹ thuật. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua thư này.
                                </p>
                            </div>
                            
                            <div style="background-color: #0b1120; padding: 16px 30px; text-align: center; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b;">
                                © 2026 Rieker Vietnam · Industrial Equipment Operations
                            </div>
                        </div>
                    `
                };

                await transporter.sendMail(mailOptions);
                console.log(`[EMAIL DISPATCH] Đã gửi thư thành công tới: ${toEmail}`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    message: `Mã OTP đã được gửi trực tiếp tới hòm thư ${toEmail}!` 
                }));
            } catch (err) {
                console.error('[EMAIL DISPATCH ERROR]', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: false, 
                    message: 'Không thể gửi email: ' + (err.message || 'Lỗi SMTP Google') 
                }));
            }
        });
        return;
    }

    // ─── TĨNH: PHỤC VỤ WEB FILE ──────────────────────────────
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(__dirname, reqPath);

    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Rieker Tech Server running at http://localhost:${PORT}`);
});
