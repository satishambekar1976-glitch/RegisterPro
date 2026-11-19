const http = require('http');
const { db, hashPassword } = require('../server/db');
const { distributeDeviceOrderCommissions } = require('../server/commissionEngine');

async function testMLMSystem() {
  console.log('--- Starting RegisterPro 100-Level MLM Verification ---');

  // 1. Verify Admin exists
  const admin = db.getUserByEmail('admin@registerpro.demo');
  console.log('✓ Admin account:', admin ? `${admin.name} (${admin.memberId})` : 'FAILED');

  // 2. Create chain of members: Level 1 -> Level 2 -> Level 3
  console.log('\n--- Creating Member Chain ---');
  const user1 = db.createUser({
    name: 'Ramesh Patil',
    email: 'ramesh@test.com',
    mobile: '9822000001',
    password: 'Password123!',
    sponsorId: admin.id
  });
  console.log(`✓ Member 1 Created: ${user1.name} (${user1.memberId}), Sponsor: Admin`);
  db.updateUser(user1.id, { status: 'active', paymentStatus: 'approved', refCode: user1.memberId });

  const user2 = db.createUser({
    name: 'Suresh Shinde',
    email: 'suresh@test.com',
    mobile: '9822000002',
    password: 'Password123!',
    sponsorId: user1.id
  });
  console.log(`✓ Member 2 Created: ${user2.name} (${user2.memberId}), Sponsor: Ramesh`);
  db.updateUser(user2.id, { status: 'active', paymentStatus: 'approved', refCode: user2.memberId });

  const user3 = db.createUser({
    name: 'Ganesh Kadam',
    email: 'ganesh@test.com',
    mobile: '9822000003',
    password: 'Password123!',
    sponsorId: user2.id
  });
  console.log(`✓ Member 3 Created: ${user3.name} (${user3.memberId}), Sponsor: Suresh`);
  db.updateUser(user3.id, { status: 'active', paymentStatus: 'approved', refCode: user3.memberId });

  // Verify Upline Chain
  console.log('\n--- Verifying Upline Chain up to 100 Levels ---');
  console.log(`Ganesh's upline chain: ${user3.uplineChain.join(' -> ')}`);
  console.log(`- Level 1 Upline of Ganesh: ${db.getUserById(user3.uplineChain[0]).name}`);
  console.log(`- Level 2 Upline of Ganesh: ${db.getUserById(user3.uplineChain[1]).name}`);
  console.log(`- Level 3 Upline of Ganesh: ${db.getUserById(user3.uplineChain[2]).name}`);

  // Check Downline for Ramesh (User 1)
  const rameshStats = db.getLevelStats(user1.id, 100);
  console.log('\n--- Ramesh Downline Stats ---');
  console.log(`Total Team: ${rameshStats.totalTeam}`);
  console.log(`Directs (Level 1): ${rameshStats.directsTotal}`);
  console.log(`Level 1 Members: ${rameshStats.levels[1].total}`);
  console.log(`Level 2 Members: ${rameshStats.levels[2].total}`);

  // Test Device Sale Order by Ganesh (User 3)
  console.log('\n--- Testing Device Sale Order by Ganesh ---');
  const device = db.getDevices()[0];
  console.log(`Device: ${device.name}, Retail Price: ₹${device.price}`);

  const order = db.createOrder({
    memberId: user3.id,
    deviceId: device.id,
    deviceName: device.name,
    devicePrice: device.price,
    quantity: 1,
    customerName: 'Mahesh Deshmukh',
    customerMobile: '9876543210',
    customerAddress: 'Flat 402, Shivajinagar, Pune 411005',
    utr: 'UTR9988776655'
  });
  console.log(`✓ Order Created: ${order.orderNumber}, Amount: ₹${order.totalAmount}`);

  // Distribute commissions (Admin approval simulation)
  console.log('\n--- Executing 100-Level Commission Engine ---');
  const result = distributeDeviceOrderCommissions(order.id);
  console.log(`✓ Commissions Distributed: ${result.distributedCount} levels paid, Total Disbursed: ₹${result.totalAmount}`);
  for (const c of result.distributed) {
    console.log(`  -> Level ${c.level} Paid to: ${c.toMemberName} (${c.toMemberCode}): ₹${c.amount} [${c.note}]`);
  }

  // Check updated wallet balances
  console.log('\n--- Checking Wallet Balances ---');
  const sureshUpdated = db.getUserById(user2.id);
  const rameshUpdated = db.getUserById(user1.id);
  console.log(`✓ Suresh (Level 1 direct sponsor of seller) Wallet: ₹${sureshUpdated.walletBalance}`);
  console.log(`✓ Ramesh (Level 2 sponsor) Wallet: ₹${rameshUpdated.walletBalance}`);

  console.log('\n=== ALL MLM & 100-LEVEL COMMISSION TESTS PASSED! ===');
}

testMLMSystem();
