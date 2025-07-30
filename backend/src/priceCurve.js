/**
 * Calculates the current price based on Dutch auction mechanics
 */
function calculateCurrentPrice(order) {
  const now = Date.now();
  
  // If auction hasn't started, return start rate
  if (now < order.auctionStartTime) {
    return order.auctionStartRate;
  }
  
  // If auction has ended, return minimum rate
  const auctionEnd = order.auctionStartTime + order.auctionDuration;
  if (now >= auctionEnd) {
    return order.minimumReturnAmount;
  }
  
  // Calculate time elapsed since auction start
  const timeElapsed = now - order.auctionStartTime;
  
  // Find current price segment
  const currentSegment = order.priceSegments.find(segment => 
    timeElapsed >= segment.timeStart && timeElapsed < segment.timeEnd
  );
  
  if (!currentSegment) {
    return order.minimumReturnAmount;
  }
  
  // Calculate price within the segment
  const segmentProgress = (timeElapsed - currentSegment.timeStart) / 
                         (currentSegment.timeEnd - currentSegment.timeStart);
  
  const currentPrice = currentSegment.priceStart - 
                      (currentSegment.priceStart - currentSegment.priceEnd) * segmentProgress;
  
  // Apply gas cost adjustments if enabled
  if (order.gasAdjustmentEnabled) {
    return applyGasAdjustment(currentPrice, order);
  }
  
  return Math.max(currentPrice, order.minimumReturnAmount);
}

/**
 * Applies gas cost adjustments to the price
 */
function applyGasAdjustment(basePrice, order) {
  // Simulate gas price changes (in production, this would fetch real gas prices)
  const currentGasPrice = simulateGasPrice();
  const baseGasPrice = 50; // gwei
  
  // Adjust price based on gas cost difference
  const gasCostDifference = (currentGasPrice - baseGasPrice) * order.baseGasCost;
  const adjustmentFactor = gasCostDifference / order.targetAmount;
  
  // Apply adjustment (positive adjustment means higher gas = slightly lower user return)
  const adjustedPrice = basePrice * (1 - adjustmentFactor * 0.01); // 1% adjustment factor
  
  return Math.max(adjustedPrice, order.minimumReturnAmount);
}

/**
 * Simulates gas price fluctuations
 */
function simulateGasPrice() {
  // Simulate gas price between 20-100 gwei
  const baseGas = 50;
  const volatility = 30;
  return baseGas + (Math.random() - 0.5) * volatility;
}

/**
 * Creates a complete price curve for visualization
 */
function createPriceCurve(order) {
  const points = [];
  const totalDuration = order.auctionDuration;
  const stepSize = totalDuration / 100; // 100 points for smooth curve
  
  for (let i = 0; i <= 100; i++) {
    const timeOffset = i * stepSize;
    const timestamp = order.auctionStartTime + timeOffset;
    
    // Create a temporary order state for this time point
    const tempOrder = {
      ...order,
      auctionStartTime: order.auctionStartTime
    };
    
    // Calculate price at this point
    const mockNow = timestamp;
    const price = calculatePriceAtTime(tempOrder, mockNow);
    
    points.push({
      timeOffset,
      timestamp,
      price,
      percentage: (timeOffset / totalDuration) * 100
    });
  }
  
  return {
    points,
    metadata: {
      startPrice: order.auctionStartRate,
      endPrice: order.minimumReturnAmount,
      duration: totalDuration,
      segments: order.priceSegments.length
    }
  };
}

/**
 * Helper function to calculate price at a specific time
 */
function calculatePriceAtTime(order, targetTime) {
  if (targetTime < order.auctionStartTime) {
    return order.auctionStartRate;
  }
  
  const auctionEnd = order.auctionStartTime + order.auctionDuration;
  if (targetTime >= auctionEnd) {
    return order.minimumReturnAmount;
  }
  
  const timeElapsed = targetTime - order.auctionStartTime;
  
  const currentSegment = order.priceSegments.find(segment => 
    timeElapsed >= segment.timeStart && timeElapsed < segment.timeEnd
  );
  
  if (!currentSegment) {
    return order.minimumReturnAmount;
  }
  
  const segmentProgress = (timeElapsed - currentSegment.timeStart) / 
                         (currentSegment.timeEnd - currentSegment.timeStart);
  
  const price = currentSegment.priceStart - 
                (currentSegment.priceStart - currentSegment.priceEnd) * segmentProgress;
  
  return Math.max(price, order.minimumReturnAmount);
}

module.exports = {
  calculateCurrentPrice,
  createPriceCurve,
  applyGasAdjustment
};
