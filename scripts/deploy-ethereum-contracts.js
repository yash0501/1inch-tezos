require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting Ethereum contract deployment on Sepolia testnet...");
  
  const [deployer] = await ethers.getSigners();
  const network = await deployer.provider.getNetwork();
  
  console.log("👤 Deploying from:", deployer.address);
  console.log("🌐 Network:", network.name, "Chain ID:", network.chainId);
  console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  const deploymentResults = {
    network: {
      name: network.name,
      chainId: network.chainId.toString()
    },
    deployer: deployer.address,
    contracts: {},
    timestamp: new Date().toISOString()
  };

  try {
    // 1. Deploy EscrowSrc contract (template for source escrows)
    console.log("\n🔒 Deploying EscrowSrc template...");
    const rescueDelaySrc = 30 * 24 * 60 * 60; // 30 days
    const accessTokenSrc = process.env.ACCESS_TOKEN_ADDRESS || ethers.ZeroAddress;
    
    const EscrowSrc = await ethers.getContractFactory("EscrowSrc");
    const escrowSrc = await EscrowSrc.deploy(rescueDelaySrc, accessTokenSrc);
    await escrowSrc.waitForDeployment();
    
    deploymentResults.contracts.escrowSrc = {
      address: await escrowSrc.getAddress(),
      txHash: escrowSrc.deploymentTransaction().hash,
      rescueDelay: rescueDelaySrc,
      accessToken: accessTokenSrc
    };
    console.log("✅ EscrowSrc template deployed at:", deploymentResults.contracts.escrowSrc.address);

    // 2. Deploy EscrowDst contract (template for destination escrows)
    console.log("\n🎯 Deploying EscrowDst template...");
    const rescueDelayDst = 15 * 24 * 60 * 60; // 15 days (shorter than src)
    const accessTokenDst = process.env.ACCESS_TOKEN_ADDRESS || ethers.ZeroAddress;
    
    const EscrowDst = await ethers.getContractFactory("EscrowDst");
    const escrowDst = await EscrowDst.deploy(rescueDelayDst, accessTokenDst);
    await escrowDst.waitForDeployment();
    
    deploymentResults.contracts.escrowDst = {
      address: await escrowDst.getAddress(),
      txHash: escrowDst.deploymentTransaction().hash,
      rescueDelay: rescueDelayDst,
      accessToken: accessTokenDst
    };
    console.log("✅ EscrowDst template deployed at:", deploymentResults.contracts.escrowDst.address);

    // Save deployment results
    const fs = require('fs');
    const path = require('path');
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const deploymentFile = path.join(deploymentsDir, `ethereum-${network.name}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentResults, null, 2));
    
    console.log("\n🎉 Ethereum deployment completed successfully!");
    console.log("📄 Deployment results saved to:", deploymentFile);
    console.log("\n📋 Summary:");
    console.log("- EscrowSrc Template:", deploymentResults.contracts.escrowSrc.address);
    console.log("- EscrowDst Template:", deploymentResults.contracts.escrowDst.address);
    console.log("\n💡 Next steps:");
    console.log("1. Deploy Tezos contracts: npm run deploy:tezos:ghostnet");
    console.log("2. Test cross-chain order creation: npm run example:create-order");

    return deploymentResults;

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

// Only run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };
