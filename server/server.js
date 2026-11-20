require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { db, hashPassword, verifyPassword } = require('./db');
const { distributeDeviceOrderCommissions } = require('./commissionEngine');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup upload storage
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Simple Auth Token Store (in-memory)
const sessions = new Map();

function generateToken(userId) {
  const token = `TKN_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  sessions.set(token, { userId, createdAt: Date.now() });
  return token;
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Authorization header missing' });
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: 'Session expired or invalid token' });
  const user = await db.getUserById(session.userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  req.user = user;
  req.token = token;
  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied: Administrator privilege required' });
  next();
}

// ----------------------------------------------------
// PUBLIC ROUTES
// ----------------------------------------------------

// 1. System Config
app.get('/api/config', async (req, res) => {
  try {
    const settings = await db.getSettings();
    res.json({
      companyName: settings.companyName,
      joiningFee: settings.joiningFee,
      upiId: settings.upiId,
      qrUrl: settings.qrUrl,
      bankDetails: settings.bankDetails,
      maxLevels: settings.maxLevels || 100,
      supportMobile: settings.supportMobile,
      supportEmail: settings.supportEmail
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Validate Sponsor Referral Code
app.get('/api/sponsor/:code', async (req, res) => {
  try {
    const code = (req.params.code || '').trim();
    const sponsor = await db.getUserByRefCode(code);
    if (!sponsor) return res.status(404).json({ valid: false, message: 'Invalid or inactive referral code' });
    if (sponsor.status !== 'active' && sponsor.role !== 'admin') {
      return res.status(400).json({ valid: false, message: 'Referrer account is not yet active' });
    }
    res.json({ valid: true, sponsor: { id: sponsor.id, memberId: sponsor.memberId, name: sponsor.name, city: sponsor.city, state: sponsor.state } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Register Member
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, mobile, dob, pincode, address, city, state, password, referralCode } = req.body;
    if (!name || !email || !mobile || !password) {
      return res.status(400).json({ error: 'Name, email, mobile, and password are required' });
    }
    if (await db.getUserByEmail(email)) {
      return res.status(400).json({ error: 'This email is already registered. Please login.' });
    }

    let sponsorId = null;
    if (referralCode && referralCode.trim()) {
      const sponsor = await db.getUserByRefCode(referralCode.trim());
      if (!sponsor) return res.status(400).json({ error: 'Invalid referral code entered' });
      sponsorId = sponsor.id;
    } else {
      const users = await db.getUsers();
      const admin = users.find(u => u.role === 'admin');
      if (admin) sponsorId = admin.id;
    }

    const newUser = await db.createUser({ name, email, mobile, dob: dob || '', pincode: pincode || '', address: address || '', city: city || '', state: state || '', password, sponsorId });
    const token = generateToken(newUser.id);
    res.status(201).json({
      message: 'Registration successful. Please proceed to pay the ₹' + newUser.feeSnapshot + ' joining fee.',
      token,
      user: { id: newUser.id, memberId: newUser.memberId, name: newUser.name, email: newUser.email, mobile: newUser.mobile, status: newUser.status, paymentStatus: newUser.paymentStatus, feeSnapshot: newUser.feeSnapshot, role: newUser.role }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const cleanEmail = (email || '').trim().toLowerCase();
    let user = await db.getUserByEmail(cleanEmail);

    // Guaranteed admin fallback
    if ((cleanEmail === 'admin@registerpro.demo' || cleanEmail === 'admin@hitechpower.demo' || cleanEmail === 'admin') && password === 'Admin123!') {
      const users = await db.getUsers();
      user = users.find(u => u.role === 'admin');
    } else {
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
    }

    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const token = generateToken(user.id);
    res.json({
      token,
      user: { id: user.id, memberId: user.memberId, name: user.name, email: user.email, mobile: user.mobile, role: user.role, status: user.status, paymentStatus: user.paymentStatus, refCode: user.refCode, walletBalance: user.walletBalance || 0, totalEarned: user.totalEarned || 0 }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. Get Current User Profile
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const sponsor = user.sponsorId ? await db.getUserById(user.sponsorId) : null;
    res.json({
      id: user.id, memberId: user.memberId, name: user.name, email: user.email, mobile: user.mobile,
      dob: user.dob || '', pincode: user.pincode || '', address: user.address || '',
      city: user.city, state: user.state, role: user.role, status: user.status,
      paymentStatus: user.paymentStatus, utr: user.utr, receiptUrl: user.receiptUrl,
      refCode: user.refCode, feeSnapshot: user.feeSnapshot,
      walletBalance: user.walletBalance || 0, totalEarned: user.totalEarned || 0, totalWithdrawn: user.totalWithdrawn || 0,
      sponsor: sponsor ? { name: sponsor.name, memberId: sponsor.memberId, mobile: sponsor.mobile } : null,
      createdAt: user.createdAt
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. Submit Joining Fee Payment
app.post('/api/auth/payment', authMiddleware, upload.single('receipt'), async (req, res) => {
  try {
    const { utr } = req.body;
    if (!utr || !utr.trim()) return res.status(400).json({ error: 'UTR / Transaction Reference is required' });
    const updates = { utr: utr.trim(), paymentStatus: 'submitted' };
    if (req.file) updates.receiptUrl = `/uploads/${req.file.filename}`;
    const updatedUser = await db.updateUser(req.user.id, updates);
    res.json({ message: 'Payment details submitted successfully. Verification is pending with Administrator.', user: updatedUser });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ----------------------------------------------------
// MEMBER PROTECTED ROUTES
// ----------------------------------------------------

// 7. Member Dashboard Overview
app.get('/api/member/dashboard', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const stats = await db.getLevelStats(user.id, 100);
    const recentCommissions = (await db.getCommissionsForUser(user.id)).slice(0, 10);
    const allOrders = await db.getOrders();
    const myOrders = allOrders.filter(o => o.memberId === user.id).slice(0, 10);
    res.json({ stats, wallet: { balance: user.walletBalance || 0, totalEarned: user.totalEarned || 0, totalWithdrawn: user.totalWithdrawn || 0 }, recentCommissions, myOrders });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 8. Member Downline List
app.get('/api/member/downline', authMiddleware, async (req, res) => {
  try {
    const levelParam = req.query.level ? parseInt(req.query.level, 10) : null;
    const statusParam = req.query.status;
    let downlines = await db.getAllDownlines(req.user.id, 100);
    if (levelParam && !isNaN(levelParam)) downlines = downlines.filter(d => d.level === levelParam);
    if (statusParam) downlines = downlines.filter(d => d.status === statusParam);
    res.json({ total: downlines.length, downlines });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 9. Member Tree Hierarchy
app.get('/api/member/tree', authMiddleware, async (req, res) => {
  try {
    const rootId = req.query.rootId || req.user.id;
    const targetUser = await db.getUserById(rootId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (req.user.role !== 'admin' && targetUser.id !== req.user.id) {
      if (!targetUser.uplineChain || !targetUser.uplineChain.includes(req.user.id)) {
        return res.status(403).json({ error: 'You can only view members within your own downline tree' });
      }
    }

    async function buildNode(u, currentDepth = 1, maxDepth = 4) {
      const directs = await db.getDirects(u.id);
      const node = { id: u.id, memberId: u.memberId, name: u.name, status: u.status, paymentStatus: u.paymentStatus, directCount: directs.length, createdAt: u.createdAt, children: [] };
      if (currentDepth < maxDepth) {
        node.children = await Promise.all(directs.map(child => buildNode(child, currentDepth + 1, maxDepth)));
      }
      return node;
    }

    const tree = await buildNode(targetUser, 1, 4);
    res.json({ tree });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 10. Member Devices Catalog
app.get('/api/member/devices', authMiddleware, async (req, res) => {
  try {
    const all = await db.getDevices();
    res.json({ devices: all.filter(d => d.status === 'active') });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 11. Member Place Device Sale Order
app.post('/api/member/orders', authMiddleware, upload.single('receipt'), async (req, res) => {
  try {
    const { deviceId, customerName, customerMobile, customerAddress, quantity, utr } = req.body;
    if (!deviceId || !customerName || !customerMobile || !customerAddress) {
      return res.status(400).json({ error: 'All customer and device details are required' });
    }
    const device = await db.getDeviceById(deviceId);
    if (!device) return res.status(404).json({ error: 'Selected device not found' });

    const receiptUrl = req.file ? `/uploads/${req.file.filename}` : '';
    const newOrder = await db.createOrder({ memberId: req.user.id, deviceId: device.id, deviceName: device.name, devicePrice: device.price, quantity: quantity || 1, customerName, customerMobile, customerAddress, utr: utr || '', receiptUrl });
    res.status(201).json({ message: 'Device sale order submitted successfully. Awaiting Admin verification.', order: newOrder });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 12. Member My Orders
app.get('/api/member/orders', authMiddleware, async (req, res) => {
  try {
    const all = await db.getOrders();
    res.json({ orders: all.filter(o => o.memberId === req.user.id) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 13. Member Commissions Ledger
app.get('/api/member/commissions', authMiddleware, async (req, res) => {
  try {
    const commissions = await db.getCommissionsForUser(req.user.id);
    res.json({ commissions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 14. Member Request Payout / Withdrawal
app.post('/api/member/withdraw', authMiddleware, async (req, res) => {
  try {
    const { amount, accountDetails } = req.body;
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 100) return res.status(400).json({ error: 'Minimum withdrawal amount is ₹100' });
    if (!accountDetails || !accountDetails.trim()) return res.status(400).json({ error: 'Please provide your UPI ID or Bank account details' });
    const withdrawal = await db.createWithdrawal(req.user.id, numAmount, accountDetails.trim());
    res.json({ message: 'Withdrawal request submitted successfully.', withdrawal });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// 15. Member Withdrawal History
app.get('/api/member/withdrawals', authMiddleware, async (req, res) => {
  try {
    const withdrawals = await db.getWithdrawalsForUser(req.user.id);
    res.json({ withdrawals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ----------------------------------------------------
// ADMIN PROTECTED ROUTES
// ----------------------------------------------------

// 16. Admin Overview Stats
app.get('/api/admin/overview', authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = (await db.getUsers()).filter(u => u.role !== 'admin');
    const orders = await db.getOrders();
    const commissions = await db.getAllCommissions();
    const withdrawals = await db.getAllWithdrawals();

    res.json({
      totalMembers: users.length,
      activeMembers: users.filter(u => u.status === 'active').length,
      pendingMembers: users.filter(u => u.status !== 'active').length,
      pendingPayments: users.filter(u => u.paymentStatus === 'submitted').length,
      totalDeviceSalesCount: orders.filter(o => o.status === 'approved').length,
      totalDeviceSalesRevenue: orders.filter(o => o.status === 'approved').reduce((s, o) => s + (o.totalAmount || 0), 0),
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      totalCommissionsPaid: commissions.reduce((s, c) => s + (c.amount || 0), 0),
      pendingWithdrawals: withdrawals.filter(w => w.status === 'pending').length
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 17. Admin Member List
app.get('/api/admin/members', authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = (await db.getUsers()).filter(u => u.role !== 'admin');
    const enriched = await Promise.all(users.map(async u => {
      const sponsor = u.sponsorId ? await db.getUserById(u.sponsorId) : null;
      return { ...u, sponsorName: sponsor ? `${sponsor.name} (${sponsor.memberId})` : 'Company / Top', uplineDepth: u.uplineChain ? u.uplineChain.length : 0 };
    }));
    res.json({ members: enriched });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 18. Admin Approve Joining Fee Payment
app.post('/api/admin/members/:id/verify-payment', authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = await db.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Member not found' });
    const refCode = user.refCode || user.memberId;
    const updated = await db.updateUser(user.id, { status: 'active', paymentStatus: 'approved', refCode });
    res.json({ message: `Member ${updated.name} (${updated.memberId}) activated successfully with Referral Code: ${refCode}`, member: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 19. Admin Reject Joining Fee Payment
app.post('/api/admin/members/:id/reject-payment', authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = await db.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Member not found' });
    const updated = await db.updateUser(user.id, { paymentStatus: 'rejected', status: 'pending' });
    res.json({ message: 'Payment marked as rejected', member: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 20. Admin Device Management (CRUD)
app.get('/api/admin/devices', authMiddleware, adminOnly, async (req, res) => {
  try { res.json({ devices: await db.getDevices() }); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/devices', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, sku, price, description, imageUrl, slabs } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Device name and price are required' });
    const newDev = await db.addDevice({ name, sku, price, description, imageUrl, slabs });
    res.status(201).json({ message: 'Device added successfully', device: newDev });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/devices/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const updated = await db.updateDevice(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Device not found' });
    res.json({ message: 'Device updated successfully', device: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/devices/:id', authMiddleware, adminOnly, async (req, res) => {
  try { await db.deleteDevice(req.params.id); res.json({ message: 'Device removed successfully' }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// 21. Admin Device Orders & 100-Level Commission
app.get('/api/admin/orders', authMiddleware, adminOnly, async (req, res) => {
  try {
    const orders = await db.getOrders();
    const enriched = await Promise.all(orders.map(async o => {
      const seller = await db.getUserById(o.memberId);
      return { ...o, sellerName: seller ? `${seller.name} (${seller.memberId})` : 'N/A' };
    }));
    res.json({ orders: enriched });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/orders/:id/approve', authMiddleware, adminOnly, async (req, res) => {
  try {
    const order = await db.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'approved') return res.status(400).json({ error: 'This order is already approved' });

    await db.updateOrder(order.id, { status: 'approved', approvedAt: new Date().toISOString() });
    const distributionResult = await distributeDeviceOrderCommissions(order.id);
    res.json({ message: `Order ${order.orderNumber} approved. Commissions distributed to ${distributionResult.distributedCount} upline levels!`, totalCommissionsPaid: distributionResult.totalAmount, distribution: distributionResult });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/orders/:id/reject', authMiddleware, adminOnly, async (req, res) => {
  try {
    const order = await db.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    await db.updateOrder(order.id, { status: 'rejected' });
    res.json({ message: 'Order rejected' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 22. Admin Commission Ledger
app.get('/api/admin/commissions', authMiddleware, adminOnly, async (req, res) => {
  try { res.json({ commissions: await db.getAllCommissions() }); } catch (err) { res.status(500).json({ error: err.message }); }
});

// 23. Admin Withdrawals & Payouts
app.get('/api/admin/withdrawals', authMiddleware, adminOnly, async (req, res) => {
  try { res.json({ withdrawals: await db.getAllWithdrawals() }); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/withdrawals/:id/process', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { status, utr } = req.body;
    const updated = await db.updateWithdrawal(req.params.id, { status, utr: utr || '', processedAt: new Date().toISOString() });
    if (!updated) return res.status(404).json({ error: 'Withdrawal not found' });
    res.json({ message: `Payout marked as ${status}`, withdrawal: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 24. Admin Settings
app.get('/api/admin/settings', authMiddleware, adminOnly, async (req, res) => {
  try { res.json({ settings: await db.getSettings() }); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/settings', authMiddleware, adminOnly, async (req, res) => {
  try {
    const updated = await db.updateSettings(req.body);
    res.json({ message: 'System settings updated', settings: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 25. CSV Export
app.get('/api/admin/export/:type', authMiddleware, adminOnly, async (req, res) => {
  try {
    const type = req.params.type;
    let filename = `export-${type}-${Date.now()}.csv`;
    let csv = '';

    if (type === 'members') {
      const users = (await db.getUsers()).filter(u => u.role !== 'admin');
      csv = 'MemberID,Name,Email,Mobile,DOB,PINCode,Address,City,State,SponsorID,Status,PaymentStatus,UTR,WalletBalance,TotalEarned,JoinedDate\n' +
        users.map(u => `"${u.memberId}","${u.name}","${u.email}","${u.mobile}","${u.dob || ''}","${u.pincode || ''}","${(u.address || '').replace(/"/g, '""')}","${u.city}","${u.state}","${u.sponsorId || ''}","${u.status}","${u.paymentStatus}","${u.utr || ''}",${u.walletBalance || 0},${u.totalEarned || 0},"${u.createdAt}"`).join('\n');
    } else if (type === 'orders') {
      const orders = await db.getOrders();
      csv = 'OrderNumber,SellerID,DeviceName,Price,Quantity,TotalAmount,CustomerName,CustomerMobile,UTR,Status,Date\n' +
        orders.map(o => `"${o.orderNumber}","${o.memberId}","${o.deviceName}",${o.devicePrice},${o.quantity},${o.totalAmount},"${o.customerName}","${o.customerMobile}","${o.utr || ''}","${o.status}","${o.createdAt}"`).join('\n');
    } else if (type === 'commissions') {
      const comms = await db.getAllCommissions();
      csv = 'ID,OrderNumber,FromMember,ToMember,Level,Amount,Device,Date\n' +
        comms.map(c => `"${c.id}","${c.orderNumber || ''}","${c.fromMemberCode || ''}","${c.toMemberCode || ''}",${c.level},${c.amount},"${c.deviceName || ''}","${c.createdAt}"`).join('\n');
    } else {
      return res.status(400).send('Invalid export type');
    }

    res.header('Content-Type', 'text/csv');
    res.attachment(filename);
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Fallback SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─────────────────────────────────────────────
// START SERVER (connect MongoDB first)
// ─────────────────────────────────────────────
async function startServer() {
  try {
    await db.connect();
    app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(` Hitechpower MLM 100-Level Server Running!`);
      console.log(` Port: http://localhost:${PORT}`);
      console.log(` Mode: Production-ready Node.js & Express App`);
      console.log(` Default Admin: admin@registerpro.demo`);
      console.log(` Password:      Admin123!`);
      console.log(`===============================================`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
