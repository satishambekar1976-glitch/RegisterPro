# RegisterPro — 100-Level MLM Referral & Device Sales Platform

Production-ready full-stack Web Application for direct selling & network marketing businesses featuring a **100-level downline referral hierarchy**, **₹1,999 membership joining workflow**, and **dynamic device sales commission slabs**.

---

## 🚀 Key Features

### 1. 100-Level Referral Hierarchy & Sponsor Capture
- Automatic sponsor tracking via URL parameter: `https://yourdomain.com/?ref=REFERRAL_CODE`.
- Sponsors are verified in real time when a new prospect opens the link.
- Downline tree supports **up to 100 levels** of depth.
- Each member receives their own personal referral link with **1-click Copy** and **1-click WhatsApp Share** with a pre-written invite message.

### 2. ₹1,999 Membership Joining & Activation
- One-time registration fee (default **₹1,999**, editable by Admin).
- Dynamic UPI QR Code and Bank Transfer details displayed on the payment screen.
- Members submit their UPI UTR / Transaction Reference and optional payment screenshot.
- Account remains pending until Admin verifies the transaction reference.
- Upon Admin approval, the account is activated and granted its unique 100-level referral link.

### 3. Device Sales & 100-Level Commission Slabs
- Commission is driven by **Device Sales** across the downline.
- Admin can configure device products, retail prices, and customized **100-level commission slabs**.
- Members record customer device sales (Customer Name, Mobile, Shipping Address, and UTR).
- When Admin verifies the order, the **Commission Engine** traces up to 100 upline ancestors of the seller and automatically disburses earnings directly into their digital wallets based on the slab rules:
  - **Level 1 (Direct Sponsor)**
  - **Level 2**
  - **Level 3**
  - **Level 4 & 5**
  - **Levels 6 to 10**
  - **Levels 11 to 20**
  - **Levels 21 to 50**
  - **Levels 51 to 100**

### 4. Member Dashboard
- **Live Wallet & Earnings:** Real-time available balance and lifetime earnings.
- **100-Level Breakdown Table:** View total, active, and pending members across each level (Level 1 to 100).
- **Interactive Genealogy Tree:** Visual tree structure with active/pending color indicators.
- **Device Catalog & Customer Sales Entry:** Record customer sales directly from the dashboard.
- **Commissions Ledger:** Itemized history of every commission credited (showing Level #, Downline Member Name, and Device sold).
- **Payout Requests:** Request wallet withdrawal to Bank Account or UPI ID.

### 5. Administrator Control Center
- **Overview Dashboard:** Total members, active members, pending joining payments, device sales revenue, total commissions paid, pending payouts.
- **Joining Payment Approvals:** Verify UTRs for ₹1,999 joining payments and activate member accounts.
- **Device Sales & Auto-Disbursement:** Verify device orders and trigger 100-level commission calculations with one click.
- **Device & Slab Management:** Add new devices, set retail prices, and customize 100-level commission rules.
- **Payout Processing:** Mark member withdrawal requests as paid with bank transaction references.
- **CSV Data Export:** Export Members list, Device Orders, and Commission Ledgers to CSV.
- **System Settings:** Customize Joining Fee, UPI ID, QR Code URL, Bank Account details, and Support contacts.

---

## 🛠️ Tech Stack & Architecture

- **Backend:** Node.js, Express.js
- **Database:** Atomic JSON Document Store (`data/db.json`) — zero external database configuration required, runs anywhere immediately!
- **Security:** Scrypt password hashing with unique per-user salts, token-based session authentication, sanitized queries.
- **Frontend:** Responsive HTML5 / CSS3 / Vanilla JavaScript SPA served directly by Express.

---

## 💻 Local Testing & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```
The server will start at: **`http://localhost:3000`**

### 3. Default Admin Credentials
- **Email:** `admin@registerpro.demo`
- **Password:** `Admin123!`
- **Referral Code:** `ADMINREF`

Referral links must be copied from the public hosted HTTPS site. The browser-only demo opened from `file://` or `localhost` cannot create links that other people can open.

---

## 🌐 How to Deploy to a Server (Production)

### Method A: Linux VPS (Ubuntu / Debian) with PM2 & Nginx (Recommended)

1. **Connect to your VPS via SSH:**
   ```bash
   ssh root@your_server_ip
   ```

2. **Install Node.js & PM2:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo npm install -g pm2
   ```

3. **Upload the project to `/var/www/registerpro`:**
   ```bash
   cd /var/www/registerpro
   npm install --production
   ```

4. **Start the application with PM2 (Auto-restart on reboot):**
   ```bash
   pm2 start server/server.js --name "registerpro"
   pm2 startup
   pm2 save
   ```

5. **Configure Nginx as Reverse Proxy:**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

6. **Add Free SSL via Certbot (HTTPS):**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

---

### Method B: Cloud Platforms (Render / Railway / DigitalOcean App Platform)

1. Push this folder to a GitHub repository.
2. In **Render** or **Railway**:
   - Create a **New Web Service**.
   - Connect your GitHub repo.
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment Variables:
     - `PORT`: `3000`
3. Your web app will be live with an automatic HTTPS URL.

---

### Method C: cPanel Hosting (with "Setup Node.js App")

1. In cPanel, open **Setup Node.js App**.
2. Click **Create Application**:
   - Node.js Version: Select **20.x** or **22.x**.
   - Application root: `registerpro`
   - Application startup file: `server/server.js`
3. Upload the project files into the `registerpro` folder.
4. Click **Run NPM Install** in cPanel.
5. Click **Restart** to launch.
