const { v4: uuidv4 } = require('uuid');

/**
 * Creates a new Fusion+ order with Dutch auction parameters
 */
function createOrder(orderData) {
  const now = Date.now();
  const {
    sourceChain,
    targetChain,
    sourceToken,
    targetToken,
    sourceAmount,
    targetAmount,
    waitingPeriod = 30000, // 30 seconds default
    auctionDuration = 600000, // 10 minutes default
    userAddress,
    destinationAddress,
    minimumReturnRatio = 0.95 // 95% of target amount minimum
  } = orderData;

  const auctionStartTime = now + waitingPeriod;
  const auctionStartRate = targetAmount; // Maximum exchange rate
  const minimumReturnAmount = Math.floor(targetAmount * minimumReturnRatio);

  const order = {
    id: uuidv4(),
    status: 'pending', // pending -> active -> filled/expired/cancelled
    sourceChain,
    targetChain,
    sourceToken,
    targetToken,
    sourceAmount,
    targetAmount,
    userAddress,
    destinationAddress,
    
    // Dutch Auction Parameters
    createdAt: now,
    signatureTimestamp: now,
    waitingPeriod,
    auctionStartTime,
    auctionDuration,
    auctionStartRate,
    minimumReturnAmount,
    
    // Price curve configuration (6-segment grid approach)
    priceSegments: generatePriceSegments(auctionStartRate, minimumReturnAmount, auctionDuration),
    
    // Gas adjustment parameters
    baseGasCost: 150000, // Base gas estimate
    gasAdjustmentEnabled: true,
    
    // Execution tracking
    filledAt: null,
    filledBy: null,
    fillPrice: null,
    fillAmount: null,
    estimatedFillTime: auctionStartTime + (auctionDuration * 0.4), // Estimated 40% through auction
    
    // Resolver tracking
    broadcastedAt: now,
    resolverResponses: []
  };

  // Update status to active when auction starts
  setTimeout(() => {
    if (order.status === 'pending') {
      order.status = 'active';
      console.log(`🎯 Order ${order.id} is now active - auction started`);
    }
  }, waitingPeriod);

  // Mark as expired after auction duration
  setTimeout(() => {
    if (order.status === 'active') {
      order.status = 'expired';
      console.log(`⏰ Order ${order.id} expired - no resolver filled it`);
    }
  }, waitingPeriod + auctionDuration);

  return order;
}

/**
 * Generates price segments for the Dutch auction using 6-segment grid approach
 */
function generatePriceSegments(startRate, minRate, duration) {
  const segments = [];
  const segmentCount = 6;
  const segmentDuration = duration / segmentCount;
  
  // First 2/3 of auction: gradual decline from startRate to market price
  const marketPrice = startRate * 0.85; // Assume market price is 85% of start rate
  const rapidDeclineEnd = Math.floor(segmentCount * 0.67); // ~4 segments
  
  for (let i = 0; i < segmentCount; i++) {
    const segmentStart = i * segmentDuration;
    const segmentEnd = (i + 1) * segmentDuration;
    
    let priceStart, priceEnd;
    
    if (i < rapidDeclineEnd) {
      // Rapid decline phase: from startRate to marketPrice
      const progress = i / (rapidDeclineEnd - 1);
      priceStart = startRate - (startRate - marketPrice) * progress;
      priceEnd = startRate - (startRate - marketPrice) * ((i + 1) / (rapidDeclineEnd - 1));
    } else {
      // Slow decline phase: from marketPrice to minRate
      const remainingSegments = segmentCount - rapidDeclineEnd;
      const progressInSlowPhase = (i - rapidDeclineEnd) / remainingSegments;
      priceStart = marketPrice - (marketPrice - minRate) * progressInSlowPhase;
      priceEnd = marketPrice - (marketPrice - minRate) * ((i - rapidDeclineEnd + 1) / remainingSegments);
    }
    
    segments.push({
      segmentIndex: i,
      timeStart: segmentStart,
      timeEnd: segmentEnd,
      priceStart: Math.max(priceStart, minRate),
      priceEnd: Math.max(priceEnd, minRate),
      declineRate: (priceStart - priceEnd) / segmentDuration
    });
  }
  
  return segments;
}

/**
 * Gets order by ID
 */
function getOrderById(orderId) {
  return orders.get(orderId);
}

/**
 * Gets all orders
 */
function getAllOrders() {
  return Array.from(orders.values());
}

/**
 * Updates order status
 */
function updateOrderStatus(orderId, status, additionalData = {}) {
  const order = orders.get(orderId);
  if (order) {
    order.status = status;
    Object.assign(order, additionalData);
    orders.set(orderId, order);
    return order;
  }
  return null;
}

module.exports = {
  createOrder,
  getOrderById,
  getAllOrders,
  updateOrderStatus
};
