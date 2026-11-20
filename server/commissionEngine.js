/**
 * Commission Engine for 100-Level MLM Device Sales (async MongoDB version)
 */
const { db } = require('./db');

function resolveLevelCommission(levelsConfig, levelNumber) {
  if (!levelsConfig) return 0;

  // Direct exact level: "1", "2", etc.
  if (levelsConfig[levelNumber] !== undefined) return Number(levelsConfig[levelNumber]);
  if (levelsConfig[String(levelNumber)] !== undefined) return Number(levelsConfig[String(levelNumber)]);

  // Range match: "6-10", "11-20", etc.
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

async function distributeDeviceOrderCommissions(orderId) {
  const order = await db.getOrderById(orderId);
  if (!order) throw new Error('Order not found');

  const seller = await db.getUserById(order.memberId);
  if (!seller) throw new Error('Seller member not found');

  const device = await db.getDeviceById(order.deviceId);
  if (!device) throw new Error('Device not found');

  // Find matching slab
  let slab = null;
  if (device.slabs && device.slabs.length > 0) {
    slab = device.slabs.find(s => order.devicePrice >= s.minPrice && order.devicePrice <= s.maxPrice) || device.slabs[0];
  }

  if (!slab || !slab.levels) {
    return { success: false, message: 'No commission slab configured for this device price', distributedCount: 0, totalAmount: 0 };
  }

  const uplineChain = seller.uplineChain || [];
  const maxLevels = Math.min(uplineChain.length, 100);
  const distributed = [];
  let totalAmount = 0;

  for (let i = 0; i < maxLevels; i++) {
    const level = i + 1;
    const uplineUserId = uplineChain[i];
    const uplineMember = await db.getUserById(uplineUserId);

    if (!uplineMember) continue;
    if (uplineMember.status !== 'active' && uplineMember.role !== 'admin') continue;

    const commPerUnit = resolveLevelCommission(slab.levels, level);
    const commTotal = commPerUnit * (order.quantity || 1);

    if (commTotal > 0) {
      const commRecord = await db.addCommission({
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

  return { success: true, distributedCount: distributed.length, totalAmount, distributed };
}

module.exports = { distributeDeviceOrderCommissions, resolveLevelCommission };
