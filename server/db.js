const crypto = require('crypto');
const mongoose = require('mongoose');

// ─────────────────────────────────────────────
// Password Utilities
// ─────────────────────────────────────────────
function hashPassword(password, salt = null) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, key] = stored.split(':');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// Mongoose Schemas
// ─────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  id:            { type: String, required: true, unique: true },
  memberId:      { type: String, required: true },
  name:          String,
  email:         { type: String, lowercase: true },
  mobile:        String,
  dob:           String,
  pincode:       String,
  address:       String,
  city:          String,
  state:         String,
  passwordHash:  String,
  sponsorId:     { type: String, default: null },
  uplineChain:   [String],
  role:          { type: String, default: 'member' },
  status:        { type: String, default: 'pending' },
  paymentStatus: { type: String, default: 'pending' },
  feeSnapshot:   { type: Number, default: 1999 },
  utr:           String,
  receiptUrl:    String,
  refCode:       String,
  walletBalance: { type: Number, default: 0 },
  totalEarned:   { type: Number, default: 0 },
  totalWithdrawn:{ type: Number, default: 0 },
  createdAt:     { type: String, default: () => new Date().toISOString() }
}, { collection: 'users' });

const deviceSchema = new mongoose.Schema({
  id:          { type: String, required: true, unique: true },
  name:        String,
  sku:         String,
  price:       Number,
  description: String,
  imageUrl:    String,
  status:      { type: String, default: 'active' },
  createdAt:   { type: String, default: () => new Date().toISOString() },
  slabs:       mongoose.Schema.Types.Mixed
}, { collection: 'devices' });

const orderSchema = new mongoose.Schema({
  id:              { type: String, required: true, unique: true },
  orderNumber:     String,
  memberId:        String,
  deviceId:        String,
  deviceName:      String,
  devicePrice:     Number,
  quantity:        Number,
  totalAmount:     Number,
  customerName:    String,
  customerMobile:  String,
  customerAddress: String,
  utr:             String,
  receiptUrl:      String,
  status:          { type: String, default: 'pending' },
  createdAt:       { type: String, default: () => new Date().toISOString() },
  approvedAt:      { type: String, default: null }
}, { collection: 'orders' });

const commissionSchema = new mongoose.Schema({
  id:           { type: String, required: true, unique: true },
  toMemberId:   String,
  fromOrderId:  String,
  level:        Number,
  amount:       Number,
  deviceName:   String,
  createdAt:    { type: String, default: () => new Date().toISOString() }
}, { collection: 'commissions' });

const withdrawalSchema = new mongoose.Schema({
  id:             { type: String, required: true, unique: true },
  memberId:       String,
  memberName:     String,
  memberCode:     String,
  amount:         Number,
  accountDetails: mongoose.Schema.Types.Mixed,
  status:         { type: String, default: 'pending' },
  utr:            String,
  createdAt:      { type: String, default: () => new Date().toISOString() },
  processedAt:    { type: String, default: null }
}, { collection: 'withdrawals' });

const settingsSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed
}, { collection: 'settings' });

// Models
const User       = mongoose.model('User', userSchema);
const Device     = mongoose.model('Device', deviceSchema);
const Order      = mongoose.model('Order', orderSchema);
const Commission = mongoose.model('Commission', commissionSchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
const Settings   = mongoose.model('Settings', settingsSchema);

// ─────────────────────────────────────────────
// Default seed data
// ─────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  companyName:    'Hitechpower MLM Network',
  joiningFee:     1999,
  upiId:          'merchant@upi',
  qrUrl:          '',
  bankDetails:    'Bank: State Bank of India\nA/C: 1234567890\nIFSC: SBIN0001234\nHolder: Hitechpower Enterprises',
  maxLevels:      100,
  supportMobile:  '+91 9876543210',
  supportEmail:   'support@hitechpower.com'
};

const DEFAULT_DEVICES = [
  {
    id: 'DEV-001',
    name: 'Smart Energy Saver Device (Model A)',
    sku: 'ESD-A1',
    price: 9999,
    description: 'Advanced power factor optimization device for homes and businesses.',
    status: 'active',
    createdAt: new Date().toISOString(),
    slabs: [{
      id: 'SLAB-1',
      name: '100-Level Energy Saver Commission Slab',
      minPrice: 5000,
      maxPrice: 20000,
      levels: { "1": 800, "2": 400, "3": 200, "4": 100, "5": 80, "6-10": 40, "11-20": 20, "21-50": 10, "51-100": 5 }
    }]
  },
  {
    id: 'DEV-002',
    name: 'Smart IoT Home Automation Controller',
    sku: 'IOT-H1',
    price: 14999,
    description: 'WiFi & Zigbee central hub for automated energy and appliance management.',
    status: 'active',
    createdAt: new Date().toISOString(),
    slabs: [{
      id: 'SLAB-2',
      name: '100-Level IoT Controller Commission Slab',
      minPrice: 10000,
      maxPrice: 30000,
      levels: { "1": 1500, "2": 700, "3": 350, "4": 200, "5": 120, "6-10": 60, "11-20": 30, "21-50": 15, "51-100": 8 }
    }]
  }
];

// ─────────────────────────────────────────────
// DB Class (async)
// ─────────────────────────────────────────────
class Database {
  constructor() {
    this._ready = false;
  }

  async connect() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not set. Please add it on Render.');
    }
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log('✅ MongoDB Atlas connected');
    await this._seed();
    this._ready = true;
  }

  async _seed() {
    // Settings
    const existing = await Settings.findOne({ key: 'main' });
    if (!existing) {
      await Settings.create({ key: 'main', value: DEFAULT_SETTINGS });
      console.log('✅ Default settings seeded');
    }

    // Admin
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      await User.create({
        id:            'ADMIN-001',
        memberId:      'ADMIN',
        name:          'Super Admin',
        email:         'admin@registerpro.demo',
        mobile:        '9999999999',
        city:          'Mumbai',
        state:         'Maharashtra',
        passwordHash:  hashPassword('Admin123!'),
        role:          'admin',
        sponsorId:     null,
        uplineChain:   [],
        refCode:       'ADMINREF',
        status:        'active',
        paymentStatus: 'approved',
        feeSnapshot:   0,
        utr:           'SYSTEM_APPROVED',
        walletBalance: 0,
        totalEarned:   0,
        totalWithdrawn:0,
        createdAt:     new Date().toISOString()
      });
      console.log('✅ Admin user seeded');
    }

    // Devices
    const devCount = await Device.countDocuments();
    if (devCount === 0) {
      await Device.insertMany(DEFAULT_DEVICES);
      console.log('✅ Default devices seeded');
    }
  }

  // ─── User Operations ───
  async getUsers() {
    return User.find({}).lean();
  }

  async getUserById(id) {
    return User.findOne({ id }).lean();
  }

  async getUserByEmail(email) {
    return User.findOne({ email: email.toLowerCase() }).lean();
  }

  async getUserByRefCode(code) {
    if (!code) return null;
    const upper = code.toUpperCase();
    return User.findOne({
      $or: [
        { refCode:  { $regex: new RegExp(`^${upper}$`, 'i') } },
        { memberId: { $regex: new RegExp(`^${upper}$`, 'i') } }
      ]
    }).lean();
  }

  async createUser(userData) {
    const count = await User.countDocuments({ role: { $ne: 'admin' } });
    const memberNum = (count + 1).toString().padStart(5, '0');
    const memberId = `HP${memberNum}`;
    const id = `USR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Upline chain
    let uplineChain = [];
    if (userData.sponsorId) {
      const sponsor = await this.getUserById(userData.sponsorId);
      if (sponsor) {
        uplineChain = [sponsor.id, ...(sponsor.uplineChain || [])].slice(0, 100);
      }
    }

    const settings = await this.getSettings();
    const newUser = await User.create({
      id, memberId,
      name:          userData.name,
      email:         userData.email.toLowerCase(),
      mobile:        userData.mobile,
      dob:           userData.dob || '',
      pincode:       userData.pincode || '',
      address:       userData.address || '',
      city:          userData.city || '',
      state:         userData.state || '',
      passwordHash:  hashPassword(userData.password),
      sponsorId:     userData.sponsorId || null,
      uplineChain,
      role:          'member',
      status:        'pending',
      paymentStatus: 'pending',
      feeSnapshot:   Number(settings.joiningFee || 1999),
      utr:           '',
      receiptUrl:    '',
      refCode:       '',
      walletBalance: 0,
      totalEarned:   0,
      totalWithdrawn:0,
      createdAt:     new Date().toISOString()
    });
    return newUser.toObject();
  }

  async updateUser(id, updates) {
    const doc = await User.findOneAndUpdate({ id }, updates, { new: true }).lean();
    return doc;
  }

  // ─── Downline & Hierarchy ───
  async getDirects(userId) {
    return User.find({ sponsorId: userId }).lean();
  }

  async getAllDownlines(userId, maxLevel = 100) {
    const all = await User.find({ uplineChain: userId }).lean();
    const result = [];
    for (const u of all) {
      const level = u.uplineChain.indexOf(userId) + 1;
      if (level <= maxLevel) {
        const sponsor = u.sponsorId ? await this.getUserById(u.sponsorId) : null;
        result.push({
          id: u.id, memberId: u.memberId, name: u.name, email: u.email,
          mobile: u.mobile, city: u.city, state: u.state,
          sponsorId: u.sponsorId, sponsorName: sponsor ? sponsor.name : 'N/A',
          level, status: u.status, paymentStatus: u.paymentStatus, createdAt: u.createdAt
        });
      }
    }
    return result;
  }

  async getLevelStats(userId, maxLevel = 100) {
    const downlines = await this.getAllDownlines(userId, maxLevel);
    const levels = {};
    for (let i = 1; i <= maxLevel; i++) levels[i] = { total: 0, active: 0, pending: 0 };
    for (const d of downlines) {
      if (levels[d.level]) {
        levels[d.level].total++;
        if (d.status === 'active') levels[d.level].active++;
        else levels[d.level].pending++;
      }
    }
    return {
      totalTeam:     downlines.length,
      activeTeam:    downlines.filter(d => d.status === 'active').length,
      directsTotal:  downlines.filter(d => d.level === 1).length,
      directsActive: downlines.filter(d => d.level === 1 && d.status === 'active').length,
      levels
    };
  }

  // ─── Device Management ───
  async getDevices() {
    return Device.find({}).lean();
  }

  async getDeviceById(id) {
    return Device.findOne({ id }).lean();
  }

  async addDevice(deviceData) {
    const id = `DEV-${Date.now().toString(36).toUpperCase()}`;
    const newDevice = await Device.create({
      id,
      name:        deviceData.name,
      sku:         deviceData.sku || `SKU-${Date.now().toString(36).toUpperCase()}`,
      price:       Number(deviceData.price),
      description: deviceData.description || '',
      imageUrl:    deviceData.imageUrl || '',
      status:      'active',
      createdAt:   new Date().toISOString(),
      slabs:       deviceData.slabs || [{
        id:       `SLAB-${Date.now().toString(36).toUpperCase()}`,
        name:     `${deviceData.name} Default Slab`,
        minPrice: 0,
        maxPrice: 999999,
        levels: {
          "1":     Math.round(Number(deviceData.price) * 0.10),
          "2":     Math.round(Number(deviceData.price) * 0.05),
          "3":     Math.round(Number(deviceData.price) * 0.02),
          "4-10":  Math.round(Number(deviceData.price) * 0.005),
          "11-50": Math.round(Number(deviceData.price) * 0.002),
          "51-100":Math.round(Number(deviceData.price) * 0.001)
        }
      }]
    });
    return newDevice.toObject();
  }

  async updateDevice(id, updates) {
    return Device.findOneAndUpdate({ id }, updates, { new: true }).lean();
  }

  async deleteDevice(id) {
    await Device.deleteOne({ id });
    return true;
  }

  // ─── Order Management ───
  async getOrders() {
    return Order.find({}).lean();
  }

  async getOrderById(id) {
    return Order.findOne({ id }).lean();
  }

  async createOrder(orderData) {
    const count = await Order.countDocuments();
    const orderNum = (count + 1).toString().padStart(6, '0');
    const newOrder = await Order.create({
      id:              `ORD-${Date.now().toString(36).toUpperCase()}`,
      orderNumber:     `ORD${orderNum}`,
      memberId:        orderData.memberId,
      deviceId:        orderData.deviceId,
      deviceName:      orderData.deviceName,
      devicePrice:     Number(orderData.devicePrice),
      quantity:        Number(orderData.quantity || 1),
      totalAmount:     Number(orderData.devicePrice) * Number(orderData.quantity || 1),
      customerName:    orderData.customerName,
      customerMobile:  orderData.customerMobile,
      customerAddress: orderData.customerAddress,
      utr:             orderData.utr || '',
      receiptUrl:      orderData.receiptUrl || '',
      status:          'pending',
      createdAt:       new Date().toISOString(),
      approvedAt:      null
    });
    return newOrder.toObject();
  }

  async updateOrder(id, updates) {
    return Order.findOneAndUpdate({ id }, updates, { new: true }).lean();
  }

  // ─── Commissions ───
  async addCommission(commData) {
    const id = `COMM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const comm = await Commission.create({ id, ...commData, createdAt: new Date().toISOString() });

    // Credit user wallet
    await User.findOneAndUpdate(
      { id: commData.toMemberId },
      { $inc: { walletBalance: Number(commData.amount), totalEarned: Number(commData.amount) } }
    );
    return comm.toObject();
  }

  async getCommissionsForUser(userId) {
    return Commission.find({ toMemberId: userId }).sort({ createdAt: -1 }).lean();
  }

  async getAllCommissions() {
    return Commission.find({}).lean();
  }

  // ─── Withdrawals ───
  async createWithdrawal(userId, amount, accountDetails) {
    const user = await this.getUserById(userId);
    if (!user || user.walletBalance < amount) throw new Error('Insufficient wallet balance');

    const withdrawal = await Withdrawal.create({
      id:             `WTH-${Date.now().toString(36).toUpperCase()}`,
      memberId:       userId,
      memberName:     user.name,
      memberCode:     user.memberId,
      amount:         Number(amount),
      accountDetails,
      status:         'pending',
      utr:            '',
      createdAt:      new Date().toISOString(),
      processedAt:    null
    });

    await User.findOneAndUpdate(
      { id: userId },
      { $inc: { walletBalance: -Number(amount), totalWithdrawn: Number(amount) } }
    );
    return withdrawal.toObject();
  }

  async getWithdrawalsForUser(userId) {
    return Withdrawal.find({ memberId: userId }).lean();
  }

  async getAllWithdrawals() {
    return Withdrawal.find({}).lean();
  }

  async updateWithdrawal(id, updates) {
    const w = await Withdrawal.findOne({ id }).lean();
    if (!w) return null;

    // If rejected → refund balance
    if (updates.status === 'rejected' && w.status === 'pending') {
      await User.findOneAndUpdate(
        { id: w.memberId },
        { $inc: { walletBalance: w.amount, totalWithdrawn: -w.amount } }
      );
    }
    return Withdrawal.findOneAndUpdate({ id }, updates, { new: true }).lean();
  }

  // ─── Settings ───
  async getSettings() {
    const doc = await Settings.findOne({ key: 'main' }).lean();
    return doc ? doc.value : DEFAULT_SETTINGS;
  }

  async updateSettings(newSettings) {
    const doc = await Settings.findOneAndUpdate(
      { key: 'main' },
      { $set: { value: { ...DEFAULT_SETTINGS, ...newSettings } } },
      { new: true, upsert: true }
    ).lean();
    return doc.value;
  }
}

const db = new Database();

module.exports = { db, hashPassword, verifyPassword };
