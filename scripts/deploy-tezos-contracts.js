require("dotenv").config();
const { TezosToolkit } = require('@taquito/taquito');
const { InMemorySigner } = require('@taquito/signer');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("🚀 Starting Tezos contract deployment on Ghostnet...");
  
  // Initialize Tezos toolkit for Ghostnet
  const tezosRPC = process.env.TEZOS_RPC_URL || 'https://ghostnet.tezos.ecadinfra.com';
  const tezos = new TezosToolkit(tezosRPC);
  
  // Import private key
  if (!process.env.TEZOS_PRIVATE_KEY) {
    throw new Error('TEZOS_PRIVATE_KEY environment variable is required');
  }
  
  await tezos.setProvider({
    signer: await InMemorySigner.fromSecretKey(process.env.TEZOS_PRIVATE_KEY)
  });
  
  const deployerAddress = await tezos.signer.publicKeyHash();
  const balance = await tezos.tz.getBalance(deployerAddress);
  
  console.log("👤 Deploying from:", deployerAddress);
  console.log("🌐 Network: Ghostnet");
  console.log("💰 Account balance:", balance.toNumber() / 1000000, "XTZ");

  const deploymentResults = {
    network: {
      name: "ghostnet",
      rpc: tezosRPC
    },
    deployer: deployerAddress,
    contracts: {},
    timestamp: new Date().toISOString()
  };

  try {
    // Load compiled SmartPy contracts (.tz files)
    const contractsDir = path.join(__dirname, '..', 'contracts', 'tezos', 'compiled');
    
    // 1. Deploy EscrowSrc template
    console.log("\n🔒 Deploying EscrowSrc template...");
    const escrowSrcCode = loadCompiledContract(contractsDir, 'EscrowSrc.tz');
    const accessTokenSrc = process.env.TEZOS_ACCESS_TOKEN_ADDRESS || null;
    
    const srcOriginationOp = await tezos.contract.originate({
      code: escrowSrcCode,
      storage: {
        immutables: {
          order_hash: "0x00", // Placeholder - will be set during individual deployments
          hashlock: "0x00",
          maker: deployerAddress,
          taker: deployerAddress,
          token_address: null, // XTZ
          amount: 0,
          safety_deposit: 0,
          withdrawal_start: Math.floor(Date.now() / 1000),
          public_withdrawal_start: Math.floor(Date.now() / 1000),
          cancellation_start: Math.floor(Date.now() / 1000),
          public_cancellation_start: Math.floor(Date.now() / 1000),
          rescue_start: Math.floor(Date.now() / 1000)
        },
        access_token: accessTokenSrc,
        withdrawn: false,
        cancelled: false
      }
    });

    console.log(`⏳ Waiting for EscrowSrc origination confirmation...`);
    const srcContract = await srcOriginationOp.contract();
    
    deploymentResults.contracts.escrowSrc = {
      address: srcContract.address,
      txHash: srcOriginationOp.hash,
      accessToken: accessTokenSrc
    };
    console.log("✅ EscrowSrc template deployed at:", srcContract.address);

    // 2. Deploy EscrowDst template
    console.log("\n🎯 Deploying EscrowDst template...");
    const escrowDstCode = loadCompiledContract(contractsDir, 'EscrowDst.tz');
    const accessTokenDst = process.env.TEZOS_ACCESS_TOKEN_ADDRESS || null;
    
    const dstOriginationOp = await tezos.contract.originate({
      code: escrowDstCode,
      storage: {
        immutables: {
          order_hash: "0x00", // Placeholder - will be set during individual deployments
          hashlock: "0x00",
          maker: deployerAddress,
          taker: deployerAddress,
          token_address: null, // XTZ
          amount: 0,
          safety_deposit: 0,
          withdrawal_start: Math.floor(Date.now() / 1000),
          public_withdrawal_start: Math.floor(Date.now() / 1000),
          cancellation_start: Math.floor(Date.now() / 1000),
          public_cancellation_start: Math.floor(Date.now() / 1000),
          rescue_start: Math.floor(Date.now() / 1000)
        },
        access_token: accessTokenDst,
        withdrawn: false,
        cancelled: false
      }
    });

    console.log(`⏳ Waiting for EscrowDst origination confirmation...`);
    const dstContract = await dstOriginationOp.contract();
    
    deploymentResults.contracts.escrowDst = {
      address: dstContract.address,
      txHash: dstOriginationOp.hash,
      accessToken: accessTokenDst
    };
    console.log("✅ EscrowDst template deployed at:", dstContract.address);

    // Save deployment results
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const deploymentFile = path.join(deploymentsDir, `tezos-ghostnet.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentResults, null, 2));
    
    console.log("\n🎉 Tezos deployment completed successfully!");
    console.log("📄 Deployment results saved to:", deploymentFile);
    console.log("\n📋 Summary:");
    console.log("- EscrowSrc Template:", deploymentResults.contracts.escrowSrc.address);
    console.log("- EscrowDst Template:", deploymentResults.contracts.escrowDst.address);
    console.log("\n💡 Next steps:");
    console.log("1. Update .env with deployed contract addresses");
    console.log("2. Test cross-chain order creation: npm run example:create-order");

    return deploymentResults;

  } catch (error) {
    console.error("❌ Tezos deployment failed:", error);
    throw error;
  }
}

/**
 * Load compiled SmartPy contract from .tz file
 * @param {string} contractsDir - Directory containing compiled contracts
 * @param {string} filename - Name of the .tz file
 * @returns {Object} Michelson code
 */
function loadCompiledContract(contractsDir, filename) {
  try {
    const contractPath = path.join(contractsDir, filename);
    const contractContent = fs.readFileSync(contractPath, 'utf8');
    
    // If it's a JSON file, parse it
    if (filename.endsWith('.json')) {
      return JSON.parse(contractContent);
    }
    
    // If it's a .tz file, assume it's plain Michelson
    return contractContent.trim();
  } catch (error) {
    console.error(`❌ Failed to load contract ${filename}:`, error.message);
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

module.exports = { main, loadCompiledContract };
