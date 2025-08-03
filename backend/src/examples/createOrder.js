const { ethers } = require('ethers');
const CrossChainOrderService = require('../orderService');
const ContractDeploymentService = require('../contractDeployment');

async function createAndDeployOrder() {
  try {
    // Initialize services
    const orderService = new CrossChainOrderService();
    const deploymentService = new ContractDeploymentService();

    // Mock user wallet (in practice, this would be connected via wallet)
    const privateKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const makerWallet = new ethers.Wallet(privateKey);

    console.log('👤 Maker address:', makerWallet.address);

    // Example order parameters for testnet (smaller amounts)
    const orderParams = {
      maker: makerWallet.address,                           // User's Ethereum address
      makerAsset: ethers.ZeroAddress,                       // ETH (use token address for ERC20)
      takerAsset: "XTZ",                                    // Tezos native token
      makingAmount: ethers.parseEther("0.01").toString(),  // 0.01 ETH (testnet amount)
      takingAmount: "10000000",                             // 10 XTZ (in mutez)
      resolverBeneficiary: "0x6cD7f208742840078ea0025677f1fD48eC4f6259", // Resolver's ETH address
      destinationAddress: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"    // User's Tezos address
    };

    // Validate parameters
    orderService.validateOrderParams(orderParams);
    console.log('✅ Order parameters validated');

    // Create and sign the cross-chain order
    const signedOrder = await orderService.createCrossChainOrder(orderParams, makerWallet);
    console.log('📝 Signed order created:', {
      orderId: signedOrder.orderId,
      secretHash: signedOrder.secretHash,
      srcExpiry: new Date(signedOrder.srcExpiry * 1000).toISOString(),
      dstExpiry: new Date(signedOrder.dstExpiry * 1000).toISOString(),
      signature: signedOrder.signature.substring(0, 20) + '...'
    });

    // Verify the signature
    const isValid = await orderService.verifyOrderSignature(signedOrder);
    if (!isValid) {
      throw new Error('Invalid order signature');
    }
    console.log('✅ Order signature verified');

    // At this point, the signed order would be sent to the resolver/relayer
    // The resolver would then deploy the contracts
    console.log('\n📤 Order ready to send to resolver/relayer');
    console.log('📋 Complete order JSON:', JSON.stringify({
      orderId: signedOrder.orderId,
      maker: signedOrder.maker,
      makerAsset: signedOrder.makerAsset,
      takerAsset: signedOrder.takerAsset,
      makingAmount: signedOrder.makingAmount,
      takingAmount: signedOrder.takingAmount,
      resolverBeneficiary: signedOrder.resolverBeneficiary,
      secretHash: signedOrder.secretHash,
      srcExpiry: signedOrder.srcExpiry,
      dstExpiry: signedOrder.dstExpiry,
      destinationAddress: signedOrder.destinationAddress,
      signature: signedOrder.signature
    }, null, 2));

    // Example: Deploy contracts (resolver would do this)
    console.log('\n🏗️ Deploying contracts (resolver action)...');
    
    // Access token addresses for testnets
    const accessTokenAddresses = {
      ethereum: process.env.ACCESS_TOKEN_ADDRESS || ethers.ZeroAddress,
      tezos: process.env.TEZOS_ACCESS_TOKEN_ADDRESS || null
    };

    const deploymentResults = await deploymentService.deployContractsForOrder(
      signedOrder, 
      accessTokenAddresses
    );

    console.log('🎉 Deployment completed:', {
      sourceContract: deploymentResults.sourceContract?.contractAddress,
      targetContract: deploymentResults.targetContract?.contractAddress,
      status: deploymentResults.status
    });

  } catch (error) {
    console.error('❌ Error in order creation and deployment:', error);
  }
}

// Run the example
if (require.main === module) {
  createAndDeployOrder();
}

module.exports = { createAndDeployOrder };
