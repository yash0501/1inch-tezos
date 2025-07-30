const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (replace with database in production)
const orders = new Map();
const resolvers = new Map();

// Import order management modules
const { createOrder, getOrderById, getAllOrders, updateOrderStatus } = require('./src/orderManager');
const { calculateCurrentPrice, createPriceCurve } = require('./src/priceCurve');
const { validateOrder, validateResolver } = require('./src/validation');
const ContractDeploymentService = require('./src/contractDeployment');
const contractService = new ContractDeploymentService();

// In-memory storage for deployments
const deployments = new Map();

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: Date.now() });
});

// Register a resolver
app.post('/api/resolvers/register', (req, res) => {
  try {
    const { id, supportedChains, minimumProfitThreshold } = req.body;
    
    const resolver = {
      id: id || uuidv4(),
      supportedChains: supportedChains || ['ethereum', 'tezos'],
      minimumProfitThreshold: minimumProfitThreshold || 0.01,
      registeredAt: Date.now(),
      lastSeen: Date.now(),
      totalFilled: 0,
      totalVolume: 0
    };

    resolvers.set(resolver.id, resolver);
    
    res.json({
      success: true,
      resolver: {
        id: resolver.id,
        supportedChains: resolver.supportedChains
      }
    });
  } catch (error) {
    console.error('Error registering resolver:', error);
    res.status(500).json({ error: 'Failed to register resolver' });
  }
});

// Broadcast order to resolvers (webhook simulation)
function broadcastOrderToResolvers(order) {
  // In a real implementation, this would send webhooks to registered resolvers
  console.log(`📢 Broadcasting order ${order.id} to ${resolvers.size} resolvers`);
  
  // Simulate resolver notifications
  for (const [resolverId, resolver] of resolvers) {
    console.log(`  → Notified resolver ${resolverId}`);
    resolver.lastSeen = Date.now();
  }
}

// Create a new limit order
app.post('/api/orders', (req, res) => {
  try {
    const orderData = req.body;
    
    // Validate order data
    const validation = validateOrder(orderData);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors });
    }

    // Create the order
    const order = createOrder(orderData);
    orders.set(order.id, order);

    // Broadcast to resolvers
    broadcastOrderToResolvers(order);

    res.status(201).json({
      success: true,
      order: {
        id: order.id,
        status: order.status,
        auctionStartTime: order.auctionStartTime,
        currentPrice: calculateCurrentPrice(order),
        estimatedFillTime: order.estimatedFillTime
      }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get order by ID
app.get('/api/orders/:id', (req, res) => {
  try {
    const order = orders.get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const currentPrice = calculateCurrentPrice(order);
    
    res.json({
      ...order,
      currentPrice,
      priceDecay: {
        startPrice: order.auctionStartRate,
        currentPrice,
        minimumPrice: order.minimumReturnAmount,
        timeElapsed: Date.now() - order.auctionStartTime,
        totalDuration: order.auctionDuration
      }
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Get all orders with current prices
app.get('/api/orders', (req, res) => {
  try {
    const allOrders = Array.from(orders.values()).map(order => ({
      ...order,
      currentPrice: calculateCurrentPrice(order),
      timeRemaining: Math.max(0, (order.auctionStartTime + order.auctionDuration) - Date.now())
    }));

    res.json({ orders: allOrders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get resolver statistics
app.get('/api/resolvers/:id/stats', (req, res) => {
  try {
    const resolver = resolvers.get(req.params.id);
    if (!resolver) {
      return res.status(404).json({ error: 'Resolver not found' });
    }

    // Calculate filled orders for this resolver
    const filledOrders = Array.from(orders.values()).filter(
      order => order.filledBy === req.params.id
    );

    const stats = {
      ...resolver,
      recentOrders: filledOrders.slice(-10),
      successRate: filledOrders.length > 0 ? 
        (filledOrders.filter(o => o.status === 'filled').length / filledOrders.length) * 100 : 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching resolver stats:', error);
    res.status(500).json({ error: 'Failed to fetch resolver stats' });
  }
});

// Fill an order (resolver endpoint)
app.post('/api/orders/:id/fill', async (req, res) => {
  try {
    const { resolverId, fillAmount } = req.body;
    const order = orders.get(req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'active') {
      return res.status(400).json({ error: 'Order is not active' });
    }

    const currentPrice = calculateCurrentPrice(order);
    
    // Check if fill is profitable for resolver
    if (currentPrice < order.minimumReturnAmount) {
      return res.status(400).json({ error: 'Order price below minimum threshold' });
    }

    // Update order status to filling
    order.status = 'filling';
    order.filledAt = Date.now();
    order.filledBy = resolverId;
    order.fillPrice = currentPrice;
    order.fillAmount = fillAmount;

    orders.set(order.id, order);

    // Start contract deployment process asynchronously
    deployContractsForOrder(order, resolverId)
      .then(deployment => {
        // Update order status to deployed
        order.status = 'contracts_deployed';
        order.deployment = deployment;
        orders.set(order.id, order);
        
        console.log(`🎉 Contracts deployed for order ${order.id}`);
      })
      .catch(error => {
        console.error(`❌ Contract deployment failed for order ${order.id}:`, error);
        order.status = 'deployment_failed';
        order.deploymentError = error.message;
        orders.set(order.id, order);
      });

    // Update resolver stats
    const resolver = resolvers.get(resolverId);
    if (resolver) {
      resolver.totalFilled += 1;
      resolver.totalVolume += fillAmount;
      resolver.lastSeen = Date.now();
      resolvers.set(resolverId, resolver);
    }

    console.log(`✅ Order ${order.id} accepted by resolver ${resolverId}, deploying contracts...`);

    res.json({
      success: true,
      fillPrice: currentPrice,
      fillAmount,
      order: {
        id: order.id,
        status: order.status,
        filledAt: order.filledAt
      },
      message: 'Order accepted, deploying cross-chain contracts...'
    });
  } catch (error) {
    console.error('Error filling order:', error);
    res.status(500).json({ error: 'Failed to fill order' });
  }
});

// New endpoint to get deployment status
app.get('/api/orders/:id/deployment', (req, res) => {
  try {
    const order = orders.get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      orderId: order.id,
      status: order.status,
      deployment: order.deployment || null,
      deploymentError: order.deploymentError || null
    });
  } catch (error) {
    console.error('Error fetching deployment status:', error);
    res.status(500).json({ error: 'Failed to fetch deployment status' });
  }
});

// Async function to handle contract deployment
async function deployContractsForOrder(order, resolverId) {
  try {
    const deployment = await contractService.deployContractsForOrder(order, resolverId);
    deployments.set(order.id, deployment);
    return deployment;
  } catch (error) {
    console.error(`Contract deployment failed for order ${order.id}:`, error);
    throw error;
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 1inch Fusion+ Backend running on port ${PORT}`);
  console.log(`📊 API Documentation: http://localhost:${PORT}/health`);
  console.log(`🔗 Resolver Dashboard: http://localhost:3000/resolver`);
});

module.exports = app;
