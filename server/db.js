const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'data', 'db.json');

// Initial schema defaults
const defaultSchema = {
  settings: {
    companyName: 'Hitechpower MLM Network',
    joiningFee: 1999,
    upiId: 'merchant@upi',
    qrUrl: '',
    bankDetails: 'Bank: State Bank of India\nA/C: 1234567890\nIFSC: SBIN0001234\nHolder: Hitechpower Enterprises',
    maxLevels: 100,
    supportMobile: '+91 9876543210',
    supportEmail: 'support@hitechpower.com'
  },
  users: [],
  devices: [
    {
      id: 'DEV-001',
      name: 'Smart Energy Saver Device (Model A)',
      sku: 'ESD-A1',
      price: 9999,
      description: 'Advanced power factor optimization device for homes and businesses. High demand consumer gadget.',
      status: 'active',
      createdAt: new Date().toISOString(),
      slabs: [
        {
          id: 'SLAB-1',
          name: '100-Level Energy Saver Commission Slab',
          minPrice: 5000,
          maxPrice: 20000,
          levels: {
            "1": 800,   // Level 1: Direct Sponsor (₹800)
            "2": 400,   // Level 2: (₹400)
            "3": 200,   // Level 3: (₹200)
            "4": 100,   // Level 4: (₹100)
            "5": 80,    // Level 5: (₹80)
            "6-10": 40, // Level 6 to 10: ₹40 each
            "11-20": 20,// Level 11 to 20: ₹20 each
            "21-50": 10,// Level 21 to 50: ₹10 each
            "51-100": 5 // Level 51 to 100: ₹5 each
          }
        }
      ]
    },
    {
      id: 'DEV-002',
      name: 'Smart IoT Home Automation Controller',
      sku: 'IOT-H1',
      price: 14999,
      description: 'WiFi & Zigbee central hub for automated energy and appliance management.',
      status: 'active',
      createdAt: new Date().toISOString(),
      slabs: [
        {
          id: 'SLAB-2',
          name: '100-Level IoT Controller Commission Slab',
          minPrice: 10000,
          maxPrice: 30000,
          levels: {
            "1": 1500,
            "2": 700,
            "3": 350,
            "4": 200,
            "5": 120,
            "6-10": 60,
            "11-20": 30,
            "21-50": 15,
            "51-100": 8
          }
        }
      ]
    }
  ],
  orders: [],
  commissions: [],
  withdrawals: []
};

// Password hashing utilities using crypto
function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, key] = stored.split(':');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(hash, 'hex'));
  } catch (err) {
    return false;
  }
}

class Database {
  constructor() {
    this.data = this.load();
    this.ensureAdmin();
  }

  load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return { ...defaultSchema, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.error('Error loading db.json, fallback to defaults:', err.message);
    }
    this.save(defaultSchema);
    return JSON.parse(JSON.stringify(defaultSchema));
  }

  save(data = this.data) {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpFile = `${DATA_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DATA_FILE);
    } catch (err) {
      console.error('Error saving db.json:', err.message);
    }
  }

  ensureAdmin() {
    let admin = this.data.users.find(u => u.role === 'admin');
    if (!admin) {
      admin = {
        id: 'ADMIN-001',
        memberId: 'ADMIN',
        name: 'Super Admin',
        email: 'admin@registerpro.demo',
        mobile: '9999999999',
        city: 'Mumbai',
        state: 'Maharashtra',
        passwordHash: hashPassword('Admin123!'),
        role: 'admin',
        sponsorId: null,
        uplineChain: [],
        refCode: 'ADMINREF',
        status: 'active',
        paymentStatus: 'approved',
        feeSnapshot: 0,
        utr: 'SYSTEM_APPROVED',
        walletBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        createdAt: new Date().toISOString()
      };
      this.data.users.push(admin);
      this.save();
    }
  }

  // --- User Operations ---
  getUsers() {
    return this.data.users;
  }

  getUserById(id) {
    return this.data.users.find(u => u.id === id);
  }

  getUserByEmail(email) {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  getUserByRefCode(code) {
    return this.data.users.find(u => (u.refCode && u.refCode.toUpperCase() === code.toUpperCase()) || (u.memberId && u.memberId.toUpperCase() === code.toUpperCase()));
  }

  createUser(userData) {
    const memberNum = (this.data.users.filter(u => u.role !== 'admin').length + 1).toString().padStart(5, '0');
    const memberId = `HP${memberNum}`;
    const id = `USR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Compute upline chain up to 100 levels
    let uplineChain = [];
    if (userData.sponsorId) {
      const sponsor = this.getUserById(userData.sponsorId);
      if (sponsor) {
        uplineChain = [sponsor.id, ...(sponsor.uplineChain || [])].slice(0, 100);
      }
    }

    const newUser = {
      id,
      memberId,
      name: userData.name,
      email: userData.email.toLowerCase(),
      mobile: userData.mobile,
      city: userData.city || '',
      state: userData.state || '',
      passwordHash: hashPassword(userData.password),
      sponsorId: userData.sponsorId || null,
      uplineChain,
      role: 'member',
      status: 'pending',              // pending until joining fee approved
      paymentStatus: 'pending',       // pending -> submitted -> approved / rejected
      feeSnapshot: Number(this.data.settings.joiningFee || 1999),
      utr: '',
      receiptUrl: '',
      refCode: '',                   // given upon approval
      walletBalance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      createdAt: new Date().toISOString()
    };

    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  updateUser(id, updates) {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.data.users[idx] = { ...this.data.users[idx], ...updates };
      this.save();
      return this.data.users[idx];
    }
    return null;
  }

  // --- Downline & Hierarchy Queries ---
  getDirects(userId) {
    return this.data.users.filter(u => u.sponsorId === userId);
  }

  getAllDownlines(userId, maxLevel = 100) {
    // Find all users who have userId in their uplineChain
    const downlines = [];
    for (const u of this.data.users) {
      if (u.uplineChain && u.uplineChain.includes(userId)) {
        const level = u.uplineChain.indexOf(userId) + 1; // 1-based level
        if (level <= maxLevel) {
          downlines.push({
            id: u.id,
            memberId: u.memberId,
            name: u.name,
            email: u.email,
            mobile: u.mobile,
            city: u.city,
            state: u.state,
            sponsorId: u.sponsorId,
            sponsorName: (this.getUserById(u.sponsorId) || {}).name || 'N/A',
            level,
            status: u.status,
            paymentStatus: u.paymentStatus,
            createdAt: u.createdAt
          });
        }
      }
    }
    return downlines;
  }

  getLevelStats(userId, maxLevel = 100) {
    const downlines = this.getAllDownlines(userId, maxLevel);
    const levels = {};
    for (let i = 1; i <= maxLevel; i++) {
      levels[i] = { total: 0, active: 0, pending: 0 };
    }
    for (const d of downlines) {
      if (levels[d.level]) {
        levels[d.level].total++;
        if (d.status === 'active') levels[d.level].active++;
        else levels[d.level].pending++;
      }
    }
    return {
      totalTeam: downlines.length,
      activeTeam: downlines.filter(d => d.status === 'active').length,
      directsTotal: downlines.filter(d => d.level === 1).length,
      directsActive: downlines.filter(d => d.level === 1 && d.status === 'active').length,
      levels
    };
  }

  // --- Device Management ---
  getDevices() {
    return this.data.devices;
  }

  getDeviceById(id) {
    return this.data.devices.find(d => d.id === id);
  }

  addDevice(deviceData) {
    const id = `DEV-${Date.now().toString(36).toUpperCase()}`;
    const newDevice = {
      id,
      name: deviceData.name,
      sku: deviceData.sku || `SKU-${Date.now().toString(36).toUpperCase()}`,
      price: Number(deviceData.price),
      description: deviceData.description || '',
      imageUrl: deviceData.imageUrl || '',
      status: 'active',
      createdAt: new Date().toISOString(),
      slabs: deviceData.slabs || [
        {
          id: `SLAB-${Date.now().toString(36).toUpperCase()}`,
          name: `${deviceData.name} Default Slab`,
          minPrice: 0,
          maxPrice: 999999,
          levels: {
            "1": Math.round(Number(deviceData.price) * 0.10), // 10% direct
            "2": Math.round(Number(deviceData.price) * 0.05), // 5% level 2
            "3": Math.round(Number(deviceData.price) * 0.02), // 2% level 3
            "4-10": Math.round(Number(deviceData.price) * 0.005),
            "11-50": Math.round(Number(deviceData.price) * 0.002),
            "51-100": Math.round(Number(deviceData.price) * 0.001)
          }
        }
      ]
    };
    this.data.devices.push(newDevice);
    this.save();
    return newDevice;
  }

  updateDevice(id, updates) {
    const idx = this.data.devices.findIndex(d => d.id === id);
    if (idx !== -1) {
      this.data.devices[idx] = { ...this.data.devices[idx], ...updates };
      this.save();
      return this.data.devices[idx];
    }
    return null;
  }

  deleteDevice(id) {
    this.data.devices = this.data.devices.filter(d => d.id !== id);
    this.save();
    return true;
  }

  // --- Order Management ---
  getOrders() {
    return this.data.orders;
  }

  getOrderById(id) {
    return this.data.orders.find(o => o.id === id);
  }

  createOrder(orderData) {
    const orderNum = (this.data.orders.length + 1).toString().padStart(6, '0');
    const newOrder = {
      id: `ORD-${Date.now().toString(36).toUpperCase()}`,
      orderNumber: `ORD${orderNum}`,
      memberId: orderData.memberId,
      deviceId: orderData.deviceId,
      deviceName: orderData.deviceName,
      devicePrice: Number(orderData.devicePrice),
      quantity: Number(orderData.quantity || 1),
      totalAmount: Number(orderData.devicePrice) * Number(orderData.quantity || 1),
      customerName: orderData.customerName,
      customerMobile: orderData.customerMobile,
      customerAddress: orderData.customerAddress,
      utr: orderData.utr || '',
      receiptUrl: orderData.receiptUrl || '',
      status: 'pending', // pending -> approved / rejected
      createdAt: new Date().toISOString(),
      approvedAt: null
    };
    this.data.orders.push(newOrder);
    this.save();
    return newOrder;
  }

  updateOrder(id, updates) {
    const idx = this.data.orders.findIndex(o => o.id === id);
    if (idx !== -1) {
      this.data.orders[idx] = { ...this.data.orders[idx], ...updates };
      this.save();
      return this.data.orders[idx];
    }
    return null;
  }

  // --- Commissions & Withdrawals ---
  addCommission(commData) {
    const comm = {
      id: `COMM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      ...commData,
      createdAt: new Date().toISOString()
    };
    this.data.commissions.push(comm);

    // Credit user's wallet
    const user = this.getUserById(comm.toMemberId);
    if (user) {
      user.walletBalance = (user.walletBalance || 0) + Number(comm.amount);
      user.totalEarned = (user.totalEarned || 0) + Number(comm.amount);
    }
    this.save();
    return comm;
  }

  getCommissionsForUser(userId) {
    return this.data.commissions
      .filter(c => c.toMemberId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getAllCommissions() {
    return this.data.commissions;
  }

  createWithdrawal(userId, amount, accountDetails) {
    const user = this.getUserById(userId);
    if (!user || user.walletBalance < amount) {
      throw new Error('Insufficient wallet balance');
    }
    const withdrawal = {
      id: `WTH-${Date.now().toString(36).toUpperCase()}`,
      memberId: userId,
      memberName: user.name,
      memberCode: user.memberId,
      amount: Number(amount),
      accountDetails,
      status: 'pending', // pending -> approved / rejected
      utr: '',
      createdAt: new Date().toISOString(),
      processedAt: null
    };
    user.walletBalance -= Number(amount);
    user.totalWithdrawn = (user.totalWithdrawn || 0) + Number(amount);
    this.data.withdrawals.push(withdrawal);
    this.save();
    return withdrawal;
  }

  getWithdrawalsForUser(userId) {
    return this.data.withdrawals.filter(w => w.memberId === userId);
  }

  getAllWithdrawals() {
    return this.data.withdrawals;
  }

  updateWithdrawal(id, updates) {
    const idx = this.data.withdrawals.findIndex(w => w.id === id);
    if (idx !== -1) {
      const w = this.data.withdrawals[idx];
      // If rejected, refund balance
      if (updates.status === 'rejected' && w.status === 'pending') {
        const user = this.getUserById(w.memberId);
        if (user) {
          user.walletBalance += w.amount;
          user.totalWithdrawn -= w.amount;
        }
      }
      this.data.withdrawals[idx] = { ...w, ...updates };
      this.save();
      return this.data.withdrawals[idx];
    }
    return null;
  }

  // --- Settings ---
  getSettings() {
    return this.data.settings;
  }

  updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.save();
    return this.data.settings;
  }
}

const db = new Database();

module.exports = {
  db,
  hashPassword,
  verifyPassword
};
