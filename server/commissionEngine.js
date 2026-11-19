/**
 * Commission Engine for 100-Level MLM Device Sales
 */
const { db } = require('./db');

function resolveLevelCommission(levelsConfig, levelNumber, devicePrice) {
  if (!levelsConfig) return 0;

  // 1. Direct exact level check: "1", "2", etc.
  if (levelsConfig[levelNumber] !== undefined) {
    return Number(levelsConfig[levelNumber]);
  }
  if (levelsConfig[String(levelNumber)] !== undefined) {
    return Number(levelsConfig[String(levelNumber)]);
  }

  // 2. Range match: "6-10", "11-20", "21-50", "51-100"
  for (const [key, val] of Object.entries(levelsConfig)) {
    if (key.includes('-')) {
      const [startStr, endStr] = key.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && levelNumber >= start && levelNumber <= end) {
        return Number(val);
      }
    }
  }

  return 0;
}

function distributeDeviceOrderCommissions(orderId) {
  const order = db.getOrderById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  const seller = db.getUserById(order.memberId);
  if (!seller) {
    throw new Error('Seller member not found');
  }

  const device = db.getDeviceById(order.deviceId);
  if (!device) {
    throw new Error('Device not found');
  }

  // Find matching slab for device price
  let slab = null;
  if (device.slabs && device.slabs.length > 0) {
    slab = device.slabs.find(s => order.devicePrice >= s.minPrice && order.devicePrice <= s.maxPrice) || device.slabs[0];
  }

  if (!slab || !slab.levels) {
    return {
      success: false,
      message: 'No commission slab configured for this device price',
      distributedCount: 0,
      totalAmount: 0
    };
  }

  const uplineChain = seller.uplineChain || [];
  const maxLevels = Math.min(uplineChain.length, 100);
  const distributed = [];
  let totalAmount = 0;

  for (let i = 0; i < maxLevels; i++) {
    const level = i + 1;
    const uplineUserId = uplineChain[i];
    const uplineMember = db.getUserById(uplineUserId);

    if (!uplineMember) continue;

    // Only active members earn commission
    if (uplineMember.status !== 'active') {
      continue;
    }

    const commPerUnit = resolveLevelCommission(slab.levels, level, order.devicePrice);
    const commTotal = commPerUnit * (order.quantity || 1);

    if (commTotal > 0) {
      const commRecord = db.addCommission({
        orderId: order.id,
        orderNumber: order.orderNumber,
        deviceId: device.id,
        deviceName: device.name,
        devicePrice: order.devicePrice,
        quantity: order.quantity || 1,
        fromMemberId: seller.id,
        fromMemberName: seller.name,
        fromMemberCode: seller.memberId,
        toMemberId: uplineMember.id,
        toMemberName: uplineMember.name,
        toMemberCode: uplineMember.memberId,
        level,
        amount: commTotal,
        slabName: slab.name || 'Default Slab',
        note: `Level ${level} Commission from ${seller.name} (${seller.memberId}) on Device: ${device.name}`
      });

      distributed.push(commRecord);
      totalAmount += commTotal;
    }
  }

  return {
    success: true,
    distributedCount: distributed.length,
    totalAmount,
    distributed
  };
}

module.exports = {
  distributeDeviceOrderCommissions,
  resolveLevelCommission
};
