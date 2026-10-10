require('dotenv').config({ path: './.env' });
const { spawn } = require('child_process');
const http = require('http');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

const request = (method, path, body = null, token = null) => {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const options = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            headers: { 'Content-Type': 'application/json' }
        };
        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, body: parsed });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
};

const delay = ms => new Promise(res => setTimeout(res, ms));

const runTests = async () => {
    console.log("Äang khá»Ÿi Ä‘á»™ng Server Ä‘á»ƒ test...\n");
    const serverProcess = spawn('node', ['../server.js'], { cwd: __dirname });

    await delay(3000); // Äá»£i server khá»Ÿi Ä‘á»™ng
    
    const results = [];
    let customerToken = null;
    let adminToken = null;
    const adminPassword = process.env.ADMIN_PASSWORD;

    try {
        // 1) ÄÄƒng kÃ½ má»›i
        const res1 = await request('POST', '/auth/register', { full_name: "Test Customer", email: "test@customer.com", password: "password123", phone: "0912345678" });
        results.push({ name: '1) ÄÄƒng kÃ½ má»›i', expect: 201, actual: res1.status, pass: res1.status === 201 });
        if (res1.status === 201) customerToken = res1.body.token;

        // 2) ÄÄƒng kÃ½ trÃ¹ng email
        const res2 = await request('POST', '/auth/register', { full_name: "Test Clone", email: "test@customer.com", password: "password123" });
        results.push({ name: '2) ÄÄƒng kÃ½ trÃ¹ng email', expect: 409, actual: res2.status, pass: res2.status === 409 });

        // 3) ÄÄƒng nháº­p sai máº­t kháº©u
        const res3 = await request('POST', '/auth/login', { email: "test@customer.com", password: "wrongpassword" });
        results.push({ name: '3) ÄÄƒng nháº­p sai máº­t kháº©u', expect: 401, actual: res3.status, pass: res3.status === 401 });

        // 4) ÄÄƒng nháº­p khÃ¡ch
        const res4 = await request('POST', '/auth/login', { email: "test@customer.com", password: "password123" });
        results.push({ name: '4) ÄÄƒng nháº­p khÃ¡ch', expect: 200, actual: res4.status, pass: res4.status === 200 });
        if (res4.status === 200) customerToken = res4.body.token;

        // 5) KhÃ¡ch gá»i /auth/admin/login
        const res5 = await request('POST', '/auth/admin/login', { email: "test@customer.com", password: "password123" });
        results.push({ name: '5) KhÃ¡ch gá»i admin/login', expect: 403, actual: res5.status, pass: res5.status === 403 });

        // 6) Admin gá»i /auth/admin/login
        const res6 = await request('POST', '/auth/admin/login', { email: "admin@bookstore.com", password: adminPassword });
        results.push({ name: '6) Admin gá»i admin/login', expect: 200, actual: res6.status, pass: res6.status === 200 });
        if (res6.status === 200) adminToken = res6.body.token;

        // 7) GET /me khÃ´ng token
        const res7 = await request('GET', '/auth/me');
        results.push({ name: '7) GET /me khÃ´ng token', expect: 401, actual: res7.status, pass: res7.status === 401 });

        // 8) GET /me token khÃ¡ch
        const res8 = await request('GET', '/auth/me', null, customerToken);
        results.push({ name: '8) GET /me token khÃ¡ch', expect: 200, actual: res8.status, pass: res8.status === 200 });

        // 9) GET /admin-only token khÃ¡ch
        const res9 = await request('GET', '/auth/admin-only', null, customerToken);
        results.push({ name: '9) GET /admin-only token khÃ¡ch', expect: 403, actual: res9.status, pass: res9.status === 403 });

        // 10) GET /admin-only token admin
        const res10 = await request('GET', '/auth/admin-only', null, adminToken);
        results.push({ name: '10) GET /admin-only token admin', expect: 200, actual: res10.status, pass: res10.status === 200 });

    } catch (error) {
        console.error("Lá»—i khi test:", error);
    } finally {
        serverProcess.kill();
        
        console.log("---------------------------------------------------------");
        console.log("Báº¢NG Káº¾T QUáº¢ KIá»‚M Äá»ŠNH (GIAI ÄOáº N 2)");
        console.log("---------------------------------------------------------");
        let allPassed = true;
        results.forEach(r => {
            const status = r.pass ? "âœ… Äáº T" : "âŒ KHÃ”NG Äáº T";
            console.log(`${status.padEnd(12)} | ${r.name.padEnd(35)} | Tráº£ vá»: ${r.actual} (Mong Ä‘á»£i: ${r.expect})`);
            if (!r.pass) allPassed = false;
        });
        console.log("---------------------------------------------------------");
        
        if (allPassed) {
            console.log("Táº¥t cáº£ 10 trÆ°á»ng há»£p Ä‘á»u Äáº T. Há»‡ thá»‘ng sáºµn sÃ ng cho Giai Ä‘oáº¡n 3.");
        } else {
            console.log("Váº«n cÃ²n test KHÃ”NG Äáº T. HÃ£y kiá»ƒm tra láº¡i logic code.");
        }
    }
};

runTests();

