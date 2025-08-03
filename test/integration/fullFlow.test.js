const { ethers } = require('ethers');
const CrossChainOrderService = require('../../backend/src/orderService');
const ContractDeploymentService = require('../../backend/src/contractDeployment');

async function testFullFlow() {
  console.log('🧪 Starting full integration test...');

  try {
    // Initialize services
    const orderService = new CrossChainOrderService();
    const deploymentService = new ContractDeploymentService();

    // Mock user wallet
    const privateKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const wallet = new ethers.Wallet(privateKey);

    console.log('👤 Test wallet address:', wallet.address);

    // Create test order
    const orderParams = {
      maker: wallet.address,
      makerAsset: ethers.ZeroAddress, // ETH
      takerAsset: "XTZ",
      makingAmount: ethers.parseEther("0.01").toString(),
      takingAmount: "10000000", // 10 XTZ in mutez
      resolverBeneficiary: "0x6cD7f208742840078ea0025677f1fD48eC4f6259",
      destinationAddress: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"
    };

    // Validate and create order
    orderService.validateOrderParams(orderParams);
    const signedOrder = await orderService.createCrossChainOrder(orderParams, wallet);
    
    console.log('✅ Order created and signed');
    console.log('📋 Order ID:', signedOrder.orderId);
    console.log('🔐 Secret hash:', signedOrder.secretHash);

    // Verify signature
    const isValid = await orderService.verifyOrderSignature(signedOrder);
    if (!isValid) {
      throw new Error('Invalid order signature');
    }
    console.log('✅ Signature verified');

    // Extract deployment parameters
    const deploymentParams = deploymentService.extractOrderDeploymentParams(signedOrder);
    console.log('📊 Deployment parameters extracted');

    console.log('🎉 Full flow test completed successfully!');
    
    return {
      success: true,
      orderId: signedOrder.orderId,
      secretHash: signedOrder.secretHash,
      deploymentParams
    };

  } catch (error) {
    console.error('❌ Full flow test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run test if called directly
if (require.main === module) {
  testFullFlow()
    .then(result => {
      console.log('\n📋 Test Result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testFullFlow };
