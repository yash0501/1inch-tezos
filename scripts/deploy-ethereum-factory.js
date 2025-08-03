require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying Ethereum Escrow Factory (1inch architecture)...");
  
  const [deployer] = await ethers.getSigners();
  const network = await deployer.provider.getNetwork();
  
  console.log("👤 Deploying from:", deployer.address);
  console.log("🌐 Network:", network.name, "Chain ID:", network.chainId);
  console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  try {
    // Deploy EscrowFactory matching the 1inch architecture
    console.log("\n🏭 Deploying EscrowFactory...");
    
    const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
    const factory = await EscrowFactory.deploy(
      process.env.LIMIT_ORDER_PROTOCOL_ADDRESS || "0x111111125421ca6dc452d289314280a0f8842a65", // 1inch LOP
      ethers.ZeroAddress, // Fee token (ETH)
      process.env.ACCESS_TOKEN_ADDRESS || ethers.ZeroAddress, // Access token
      deployer.address, // Owner (resolver)
      30 * 24 * 60 * 60, // Source rescue delay (30 days)
      15 * 24 * 60 * 60  // Destination rescue delay (15 days)
    );
    
    await factory.waitForDeployment();
    
    const factoryAddress = await factory.getAddress();
    console.log("✅ EscrowFactory deployed at:", factoryAddress);

    // Get implementation addresses
    const srcImpl = await factory.ESCROW_SRC_IMPLEMENTATION();
    const dstImpl = await factory.ESCROW_DST_IMPLEMENTATION();
    
    console.log("📋 Source Implementation:", srcImpl);
    console.log("📋 Destination Implementation:", dstImpl);

    // Save deployment results
    const fs = require('fs');
    const path = require('path');
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const deploymentResults = {
      network: {
        name: network.name,
        chainId: network.chainId.toString()
      },
      deployer: deployer.address,
      contracts: {
        escrowFactory: {
          address: factoryAddress,
          txHash: factory.deploymentTransaction().hash,
          sourceImplementation: srcImpl,
          destinationImplementation: dstImpl
        }
      },
      timestamp: new Date().toISOString()
    };
    
    const deploymentFile = path.join(deploymentsDir, `ethereum-factory-${network.name}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentResults, null, 2));
    
    console.log("\n🎉 Factory deployment completed!");
    console.log("📄 Results saved to:", deploymentFile);

    return deploymentResults;

  } catch (error) {
    console.error("❌ Factory deployment failed:", error);
    throw error;
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };
