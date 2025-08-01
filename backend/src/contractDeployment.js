const { TezosToolkit } = require('@taquito/taquito');
const { InMemorySigner } = require('@taquito/signer');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Contract deployment service
class ContractDeploymentService {
  constructor() {
    // Initialize for testnets
    this.tezosRPC = process.env.TEZOS_RPC_URL || 'https://ghostnet.tezos.ecadinfra.com';
    this.ethereumRPC = process.env.ETHEREUM_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/your-api-key';
    
    // Private keys from environment
    this.tezosPrivateKey = process.env.TEZOS_PRIVATE_KEY;
    this.ethereumPrivateKey = process.env.ETHEREUM_PRIVATE_KEY;
    
    // Load deployed contract addresses
    this.deployedContracts = this.loadDeployedContracts();
  }

  /**
   * Load deployed contract addresses from deployment files
   */
  loadDeployedContracts() {
    const contracts = {
      ethereum: {},
      tezos: {}
    };

    try {
      // Load Ethereum contracts (Sepolia by default for testnet)
      const networkName = process.env.ETHEREUM_NETWORK || 'sepolia';
      const ethereumDeploymentPath = path.join(__dirname, '../../deployments', `ethereum-${networkName}.json`);
      
      if (fs.existsSync(ethereumDeploymentPath)) {
        const ethereumDeployment = JSON.parse(fs.readFileSync(ethereumDeploymentPath, 'utf8'));
        contracts.ethereum = ethereumDeployment.contracts;
        console.log(`✅ Loaded Ethereum ${networkName} contract addresses`);
      }

      // Load Tezos contracts (Ghostnet for testnet)
      const tezosNetwork = process.env.TEZOS_NETWORK || 'ghostnet';
      const tezosDeploymentPath = path.join(__dirname, '../../deployments', `tezos-${tezosNetwork}.json`);
      if (fs.existsSync(tezosDeploymentPath)) {
        const tezosDeployment = JSON.parse(fs.readFileSync(tezosDeploymentPath, 'utf8'));
        contracts.tezos = tezosDeployment.contracts || {};
        console.log(`✅ Loaded Tezos ${tezosNetwork} contract addresses`);
      }

    } catch (error) {
      console.error('❌ Error loading deployed contracts:', error);
    }

    return contracts;
  }

  async initializeTezos() {
    const tezos = new TezosToolkit(this.tezosRPC);
    if (this.tezosPrivateKey) {
      tezos.setProvider({ signer: await InMemorySigner.fromSecretKey(this.tezosPrivateKey) });
    }
    return tezos;
  }

  async initializeEthereum() {
    const provider = new ethers.JsonRpcProvider(this.ethereumRPC);
    const wallet = this.ethereumPrivateKey ? 
      new ethers.Wallet(this.ethereumPrivateKey, provider) : null;
    return { provider, wallet };
  }

  // =============================================================================
  // TEZOS SOURCE ESCROW DEPLOYMENT (Using compiled .tz files)
  // =============================================================================
  async deployTezosSourceEscrow(orderParams, accessTokenAddress) {
    try {
      console.log(`🚀 Deploying Tezos Source Escrow for order ${orderParams.orderId}`);
      
      const tezos = await this.initializeTezos();
      
      // Load compiled SmartPy EscrowSrc contract (.tz file)
      const contractCode = this.loadTezosSourceContract();
      
      // Prepare immutables structure for this specific order
      const immutables = {
        order_hash: orderParams.orderHash,
        hashlock: orderParams.secretHash,
        maker: orderParams.maker,
        taker: orderParams.taker,
        token_address: orderParams.tezosTokenAddress, // null for XTZ, address for FA2
        amount: orderParams.tezosAmount, // in mutez
        safety_deposit: orderParams.safetyDeposit,
        withdrawal_start: orderParams.timelocks.withdrawalStart,
        public_withdrawal_start: orderParams.timelocks.publicWithdrawalStart,
        cancellation_start: orderParams.timelocks.cancellationStart,
        public_cancellation_start: orderParams.timelocks.publicCancellationStart,
        rescue_start: orderParams.timelocks.rescueStart
      };
      
      // Deploy EscrowSrc contract with proper initial storage and balance
      const initialBalance = Math.floor((orderParams.tezosAmount + orderParams.safetyDeposit) / 1000000); // Convert to XTZ
      
      const originationOp = await tezos.contract.originate({
        code: contractCode,
        storage: {
          immutables: immutables,
          access_token: accessTokenAddress,
          withdrawn: false,
          cancelled: false
        },
        balance: initialBalance, // Initial XTZ balance for the contract
        mutez: true // Indicate we're using mutez
      });

      console.log(`⏳ Waiting for confirmation of origination for ${originationOp.contractAddress}...`);
      const contract = await originationOp.contract();
      console.log(`✅ Tezos Source Escrow deployed at: ${contract.address}`);

      return {
        contractAddress: contract.address,
        transactionHash: originationOp.hash,
        contractType: 'tezos-source',
        immutables: immutables,
        balance: initialBalance
      };

    } catch (error) {
      console.error('Error deploying Tezos Source escrow:', error);
      throw error;
    }
  }

  // =============================================================================
  // TEZOS DESTINATION ESCROW DEPLOYMENT (Using compiled .tz files)
  // =============================================================================
  async deployTezosDestinationEscrow(orderParams, accessTokenAddress) {
    try {
      console.log(`🚀 Deploying Tezos Destination Escrow for order ${orderParams.orderId}`);
      
      const tezos = await this.initializeTezos();
      
      // Load compiled SmartPy EscrowDst contract (.tz file)
      const contractCode = this.loadTezosDestinationContract();
      
      // Prepare immutables structure for this specific order
      const immutables = {
        order_hash: orderParams.orderHash,
        hashlock: orderParams.secretHash,
        maker: orderParams.maker,
        taker: orderParams.taker,
        token_address: orderParams.tezosTokenAddress, // null for XTZ, address for FA2
        amount: orderParams.tezosAmount, // in mutez
        safety_deposit: orderParams.safetyDeposit,
        withdrawal_start: orderParams.timelocks.withdrawalStart,
        public_withdrawal_start: orderParams.timelocks.publicWithdrawalStart,
        cancellation_start: orderParams.timelocks.cancellationStart,
        public_cancellation_start: orderParams.timelocks.cancellationStart, // Same as cancellation for dst
        rescue_start: orderParams.timelocks.rescueStart
      };
      
      // Deploy EscrowDst contract with proper initial storage and balance
      const initialBalance = Math.floor((orderParams.tezosAmount + orderParams.safetyDeposit) / 1000000); // Convert to XTZ
      
      const originationOp = await tezos.contract.originate({
        code: contractCode,
        storage: {
          immutables: immutables,
          access_token: accessTokenAddress,
          withdrawn: false,
          cancelled: false
        },
        balance: initialBalance, // Initial XTZ balance for the contract
        mutez: true // Indicate we're using mutez
      });

      console.log(`⏳ Waiting for confirmation of origination for ${originationOp.contractAddress}...`);
      const contract = await originationOp.contract();
      console.log(`✅ Tezos Destination Escrow deployed at: ${contract.address}`);

      return {
        contractAddress: contract.address,
        transactionHash: originationOp.hash,
        contractType: 'tezos-destination',
        immutables: immutables,
        balance: initialBalance
      };

    } catch (error) {
      console.error('Error deploying Tezos Destination escrow:', error);
      throw error;
    }
  }

  // =============================================================================
  // ETHEREUM SOURCE ESCROW DEPLOYMENT (Direct deployment, no factory)
  // =============================================================================
  async deployEthereumSourceEscrow(orderParams, accessTokenAddress) {
    try {
      console.log(`🚀 Deploying Ethereum Source Escrow for order ${orderParams.orderId}`);
      
      const { provider, wallet } = await this.initializeEthereum();
      
      if (!wallet) {
        throw new Error('Ethereum wallet not configured');
      }

      // Load EscrowSrc contract
      const contractData = this.loadEthereumSourceContract();
      
      // Deploy EscrowSrc contract directly
      const contractFactory = new ethers.ContractFactory(
        contractData.abi,
        contractData.bytecode,
        wallet
      );

      // Deploy with rescue delay and access token
      const contract = await contractFactory.deploy(
        30 * 24 * 60 * 60, // 30 days rescue delay
        accessTokenAddress // IERC20 access token
      );
      await contract.waitForDeployment();

      console.log(`✅ Ethereum Source Escrow deployed at: ${contract.target}`);

      // Prepare Ethereum immutables structure
      const immutables = {
        orderHash: orderParams.orderHash,
        hashlock: orderParams.secretHash,
        maker: orderParams.maker,
        taker: orderParams.taker,
        token: orderParams.tokenAddress,
        amount: orderParams.amount,
        safetyDeposit: orderParams.safetyDeposit,
        timelocks: this.encodeTimelocks(orderParams.timelocks)
      };

      // Fund the contract with the required amount
      const totalAmount = BigInt(orderParams.amount) + BigInt(orderParams.safetyDeposit);
      if (orderParams.tokenAddress === ethers.ZeroAddress) {
        // For ETH, send directly to contract
        const fundTx = await wallet.sendTransaction({
          to: contract.target,
          value: totalAmount
        });
        await fundTx.wait();
        console.log(`✅ Funded Ethereum Source Escrow with ${ethers.formatEther(totalAmount)} ETH`);
      } else {
        // For ERC20 tokens, approve and transfer
        const tokenContract = new ethers.Contract(
          orderParams.tokenAddress,
          ['function transfer(address to, uint256 amount) returns (bool)'],
          wallet
        );
        const transferTx = await tokenContract.transfer(contract.target, orderParams.amount);
        await transferTx.wait();
        
        // Send safety deposit in ETH
        const safetyTx = await wallet.sendTransaction({
          to: contract.target,
          value: orderParams.safetyDeposit
        });
        await safetyTx.wait();
        console.log(`✅ Funded Ethereum Source Escrow with tokens and ${ethers.formatEther(orderParams.safetyDeposit)} ETH safety deposit`);
      }

      return {
        contractAddress: contract.target,
        transactionHash: contract.deploymentTransaction().hash,
        contractType: 'ethereum-source',
        immutables: immutables
      };

    } catch (error) {
      console.error('Error deploying Ethereum Source escrow:', error);
      throw error;
    }
  }

  // =============================================================================
  // ETHEREUM DESTINATION ESCROW DEPLOYMENT (Direct deployment, no factory)
  // =============================================================================
  async deployEthereumDestinationEscrow(orderParams, accessTokenAddress) {
    try {
      console.log(`🚀 Deploying Ethereum Destination Escrow for order ${orderParams.orderId}`);
      
      const { provider, wallet } = await this.initializeEthereum();
      
      if (!wallet) {
        throw new Error('Ethereum wallet not configured');
      }

      // Load EscrowDst contract
      const contractData = this.loadEthereumDestinationContract();
      
      // Deploy EscrowDst contract directly
      const contractFactory = new ethers.ContractFactory(
        contractData.abi,
        contractData.bytecode,
        wallet
      );

      // Deploy with rescue delay and access token
      const contract = await contractFactory.deploy(
        30 * 24 * 60 * 60, // 30 days rescue delay
        accessTokenAddress // IERC20 access token
      );
      await contract.waitForDeployment();

      console.log(`✅ Ethereum Destination Escrow deployed at: ${contract.target}`);

      // Prepare Ethereum immutables structure
      const immutables = {
        orderHash: orderParams.orderHash,
        hashlock: orderParams.secretHash,
        maker: orderParams.maker,
        taker: orderParams.taker,
        token: orderParams.tokenAddress,
        amount: orderParams.amount,
        safetyDeposit: orderParams.safetyDeposit,
        timelocks: this.encodeTimelocks(orderParams.timelocks)
      };

      // Fund the contract with the required amount
      const totalAmount = BigInt(orderParams.amount) + BigInt(orderParams.safetyDeposit);
      if (orderParams.tokenAddress === ethers.ZeroAddress) {
        // For ETH, send directly to contract
        const fundTx = await wallet.sendTransaction({
          to: contract.target,
          value: totalAmount
        });
        await fundTx.wait();
        console.log(`✅ Funded Ethereum Destination Escrow with ${ethers.formatEther(totalAmount)} ETH`);
      } else {
        // For ERC20 tokens, approve and transfer
        const tokenContract = new ethers.Contract(
          orderParams.tokenAddress,
          ['function transfer(address to, uint256 amount) returns (bool)'],
          wallet
        );
        const transferTx = await tokenContract.transfer(contract.target, orderParams.amount);
        await transferTx.wait();
        
        // Send safety deposit in ETH
        const safetyTx = await wallet.sendTransaction({
          to: contract.target,
          value: orderParams.safetyDeposit
        });
        await safetyTx.wait();
        console.log(`✅ Funded Ethereum Destination Escrow with tokens and ${ethers.formatEther(orderParams.safetyDeposit)} ETH safety deposit`);
      }

      return {
        contractAddress: contract.target,
        transactionHash: contract.deploymentTransaction().hash,
        contractType: 'ethereum-destination',
        immutables: immutables
      };

    } catch (error) {
      console.error('Error deploying Ethereum Destination escrow:', error);
      throw error;
    }
  }

  // =============================================================================
  // CROSS-CHAIN DEPLOYMENT ORCHESTRATION (Updated for new order structure)
  // =============================================================================
  async deployContractsForOrder(signedOrder, accessTokenAddresses) {
    const deploymentResults = {
      orderId: signedOrder.orderId,
      sourceChain: signedOrder._metadata.sourceChain,
      targetChain: signedOrder._metadata.targetChain,
      sourceContract: null,
      targetContract: null,
      secret: signedOrder._metadata.secret,
      secretHash: signedOrder.secretHash,
      status: 'deploying'
    };

    try {
      // Extract deployment parameters from the signed order
      const orderParams = this.extractOrderDeploymentParams(signedOrder);

      console.log('🚀 Deploying contracts for cross-chain order:', {
        orderId: orderParams.orderId,
        sourceChain: orderParams.sourceChain,
        targetChain: orderParams.targetChain,
        maker: orderParams.maker,
        secretHash: orderParams.secretHash
      });

      // Deploy based on source and target chains (only cross-chain swaps)
      if (orderParams.sourceChain === 'ethereum' && orderParams.targetChain === 'tezos') {
        // Ethereum → Tezos
        const ethereumContract = await this.deployEthereumSourceEscrow(
          orderParams, 
          accessTokenAddresses.ethereum
        );
        deploymentResults.sourceContract = ethereumContract;

        const tezosContract = await this.deployTezosDestinationEscrow(
          orderParams, 
          accessTokenAddresses.tezos
        );
        deploymentResults.targetContract = tezosContract;

      } else if (orderParams.sourceChain === 'tezos' && orderParams.targetChain === 'ethereum') {
        // Tezos → Ethereum (if needed in the future)
        const tezosContract = await this.deployTezosSourceEscrow(
          orderParams, 
          accessTokenAddresses.tezos
        );
        deploymentResults.sourceContract = tezosContract;

        const ethereumContract = await this.deployEthereumDestinationEscrow(
          orderParams, 
          accessTokenAddresses.ethereum
        );
        deploymentResults.targetContract = ethereumContract;

      } else {
        throw new Error(`Unsupported chain combination: ${orderParams.sourceChain} → ${orderParams.targetChain}`);
      }

      deploymentResults.status = 'deployed';
      console.log(`🎉 Successfully deployed cross-chain contracts for order ${signedOrder.orderId}`);
      
      return deploymentResults;

    } catch (error) {
      console.error(`❌ Failed to deploy contracts for order ${signedOrder.orderId}:`, error);
      deploymentResults.status = 'failed';
      deploymentResults.error = error.message;
      throw error;
    }
  }

  /**
   * Extracts deployment parameters from a signed cross-chain order
   * @param {Object} signedOrder - The complete signed cross-chain order
   * @returns {Object} Parameters for contract deployment
   */
  extractOrderDeploymentParams(signedOrder) {
    const { _metadata, signature, ...orderData } = signedOrder;
    
    return {
      // Order identification
      orderId: orderData.orderId,
      orderHash: ethers.keccak256(ethers.toUtf8Bytes(orderData.orderId)),
      
      // Parties
      maker: orderData.maker,
      taker: orderData.resolverBeneficiary,
      
      // Cross-chain parameters
      secretHash: orderData.secretHash,
      secret: _metadata.secret,
      
      // Assets and amounts for Ethereum side
      tokenAddress: orderData.makerAsset, // ETH address (0x0 for ETH, token address for ERC20)
      amount: BigInt(orderData.makingAmount),
      safetyDeposit: BigInt(orderData.makingAmount) / BigInt(10), // 10% safety deposit
      
      // Assets for Tezos side  
      tezosTokenAddress: orderData.takerAsset === 'XTZ' ? null : orderData.takerAsset,
      tezosAmount: this.convertToMutez(orderData.takingAmount, orderData.takerAsset),
      tezosDestination: orderData.destinationAddress,
      
      // Timelocks
      timelocks: this.generateTimelocksFromOrder(orderData),
      
      // Chain information
      sourceChain: _metadata.sourceChain,
      targetChain: _metadata.targetChain
    };
  }

  /**
   * Generates timelocks from order expiry timestamps
   * @param {Object} orderData - Order data with srcExpiry and dstExpiry
   * @returns {Object} Timelock configuration
   */
  generateTimelocksFromOrder(orderData) {
    const now = Math.floor(Date.now() / 1000);
    
    return {
      withdrawalStart: now + 300, // 5 minutes from now
      publicWithdrawalStart: now + 3600, // 1 hour from now
      cancellationStart: orderData.srcExpiry, // Use order's source expiry
      publicCancellationStart: orderData.srcExpiry + 3600, // 1 hour after source expiry
      rescueStart: orderData.srcExpiry + 24 * 60 * 60, // 24 hours after source expiry
      dstCancellationStart: orderData.dstExpiry // Use order's destination expiry
    };
  }

  /**
   * Converts amount to mutez for Tezos
   * @param {string} amount - Amount as string
   * @param {string} asset - Asset type ('XTZ' or token address)
   * @returns {number} Amount in mutez
   */
  convertToMutez(amount, asset) {
    if (asset === 'XTZ') {
      // Convert XTZ to mutez (1 XTZ = 1,000,000 mutez)
      return BigInt(amount) * BigInt(1000000);
    } else {
      // For FA2 tokens, amount is already in the token's base unit
      return BigInt(amount);
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================
  
  generateTimelocks(timeouts) {
    const now = Math.floor(Date.now() / 1000);
    return {
      withdrawalStart: now + (timeouts.withdrawalDelay || 300), // 5 minutes
      publicWithdrawalStart: now + (timeouts.publicWithdrawalDelay || 3600), // 1 hour
      cancellationStart: now + (timeouts.cancellationDelay || 7200), // 2 hours
      publicCancellationStart: now + (timeouts.publicCancellationDelay || 10800), // 3 hours
      rescueStart: now + (timeouts.rescueDelay || 86400) // 24 hours
    };
  }

  encodeTimelocks(timelocks) {
    // Encode timelocks according to Ethereum TimelocksLib format
    // This is a simplified version - you'll need to implement the actual encoding
    return ethers.solidityPacked(
      ['uint32', 'uint32', 'uint32', 'uint32', 'uint32', 'uint32', 'uint32'],
      [
        Math.floor(Date.now() / 1000), // deployed at
        timelocks.withdrawalStart,
        timelocks.publicWithdrawalStart,
        timelocks.cancellationStart,
        timelocks.publicCancellationStart,
        timelocks.withdrawalStart, // dst withdrawal
        timelocks.publicWithdrawalStart // dst public withdrawal
      ]
    );
  }

  // Contract loading methods for compiled .tz files
  loadTezosSourceContract() {
    // Load compiled SmartPy EscrowSrc contract (.tz file)
    try {
      const contractPath = path.join(__dirname, '../../contracts/tezos/compiled/EscrowSrc.tz');
      if (fs.existsSync(contractPath)) {
        const contractContent = fs.readFileSync(contractPath, 'utf8');
        // If it's a JSON file, parse it; otherwise return as plain Michelson
        try {
          return JSON.parse(contractContent);
        } catch {
          return contractContent.trim();
        }
      } else {
        // Try .json extension as fallback
        const jsonPath = path.join(__dirname, '../../contracts/tezos/compiled/EscrowSrc.json');
        return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      }
    } catch (error) {
      console.warn('Tezos Source contract not found, using placeholder');
      throw new Error('EscrowSrc.tz contract file not found. Please compile SmartPy contracts first.');
    }
  }

  loadTezosDestinationContract() {
    // Load compiled SmartPy EscrowDst contract (.tz file)
    try {
      const contractPath = path.join(__dirname, '../../contracts/tezos/compiled/EscrowDst.tz');
      if (fs.existsSync(contractPath)) {
        const contractContent = fs.readFileSync(contractPath, 'utf8');
        // If it's a JSON file, parse it; otherwise return as plain Michelson
        try {
          return JSON.parse(contractContent);
        } catch {
          return contractContent.trim();
        }
      } else {
        // Try .json extension as fallback
        const jsonPath = path.join(__dirname, '../../contracts/tezos/compiled/EscrowDst.json');
        return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      }
    } catch (error) {
      console.warn('Tezos Destination contract not found, using placeholder');
      throw new Error('EscrowDst.tz contract file not found. Please compile SmartPy contracts first.');
    }
  }

  // Remove factory contract loading method since we don't need it
  // loadEthereumFactoryContract() {
  //   // Not needed for direct deployment
  // }

  generateSecret() {
    // Generate a random 32-byte secret
    return ethers.randomBytes(32);
  }

  hashSecret(secret) {
    // Hash the secret for cross-chain verification
    return ethers.keccak256(secret);
  }
}

module.exports = ContractDeploymentService;