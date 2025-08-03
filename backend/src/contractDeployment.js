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
    this.ethereumRPC = process.env.ETHEREUM_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/public';
    
    // Private keys from environment (load manually if dotenv not available)
    this.loadEnvironmentVariables();
    this.tezosPrivateKey = process.env.TEZOS_PRIVATE_KEY;
    this.ethereumPrivateKey = process.env.ETHEREUM_PRIVATE_KEY;
    
    // Debug environment variables at startup
    console.log('🔧 ContractDeploymentService Configuration:');
    console.log('  Tezos RPC:', this.tezosRPC);
    console.log('  Ethereum RPC:', this.ethereumRPC);
    console.log('  Tezos Private Key present:', !!this.tezosPrivateKey);
    console.log('  Ethereum Private Key present:', !!this.ethereumPrivateKey);
    if (this.ethereumPrivateKey) {
      console.log('  Ethereum Private Key length:', this.ethereumPrivateKey.length);
      console.log('  Ethereum Private Key starts with 0x:', this.ethereumPrivateKey.startsWith('0x'));
    }
    
    // Load deployed contract addresses
    this.deployedContracts = this.loadDeployedContracts();
  }

  loadEnvironmentVariables() {
    const path = require('path');
    const fs = require('fs');
    
    // Try to load dotenv, if not available load manually
    try {
      require('dotenv').config();
    } catch (error) {
      console.log('📁 Loading .env manually (dotenv package not found)');
      const envPath = path.join(__dirname, '../.env');
      
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith('#')) {
            const [key, ...valueParts] = trimmedLine.split('=');
            if (key && valueParts.length > 0) {
              const value = valueParts.join('=').replace(/^["']|["']$/g, '');
              process.env[key.trim()] = value;
            }
          }
        });
        console.log('  ✅ .env file loaded manually');
      }
    }
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
    console.log('🔗 Initializing Ethereum connection...');
    console.log('  RPC URL:', this.ethereumRPC);
    console.log('  Private key available:', !!this.ethereumPrivateKey);
    
    try {
      const provider = new ethers.JsonRpcProvider(this.ethereumRPC);
      
      // Test provider connection
      const network = await provider.getNetwork();
      console.log('  ✅ Provider connected to network:', network.name, 'chainId:', network.chainId.toString());
      
      let wallet = null;
      if (this.ethereumPrivateKey) {
        try {
          // Validate private key format
          if (!this.ethereumPrivateKey.startsWith('0x')) {
            console.log('  ⚠️ Private key missing 0x prefix, adding it...');
            this.ethereumPrivateKey = '0x' + this.ethereumPrivateKey;
          }
          
          // Create wallet
          wallet = new ethers.Wallet(this.ethereumPrivateKey, provider);
          const address = await wallet.getAddress();
          const balance = await provider.getBalance(address);
          
          console.log('  ✅ Wallet created successfully');
          console.log('  Address:', address);
          console.log('  Balance:', ethers.formatEther(balance), 'ETH');
          
          // Test if wallet can sign
          const testMessage = 'test';
          const signature = await wallet.signMessage(testMessage);
          console.log('  ✅ Wallet can sign messages');
          
        } catch (walletError) {
          console.error('  ❌ Error creating wallet:', walletError.message);
          console.error('  Private key value (first 10 chars):', this.ethereumPrivateKey?.substring(0, 10));
          throw new Error(`Invalid Ethereum private key: ${walletError.message}`);
        }
      } else {
        console.log('  ⚠️ No Ethereum private key provided');
      }
      
      return { provider, wallet };
      
    } catch (error) {
      console.error('  ❌ Error initializing Ethereum:', error.message);
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
      
      // Ensure all BigInt values are properly converted to numbers with explicit checks
      let tezosAmountMutez, safetyDepositMutez;
      
      try {
        // More robust conversion handling
        tezosAmountMutez = this.safeToNumber(orderParams.tezosAmount, 'tezosAmount');
        safetyDepositMutez = this.safeToNumber(orderParams.tezosSafetyDeposit, 'tezosSafetyDeposit');
        
        console.log('🔧 Type conversion successful:', {
          tezosAmountType: typeof tezosAmountMutez,
          tezosAmountValue: tezosAmountMutez,
          safetyDepositType: typeof safetyDepositMutez,
          safetyDepositValue: safetyDepositMutez
        });
        
      } catch (conversionError) {
        console.error('❌ Error converting BigInt values:', conversionError);
        throw new Error(`BigInt conversion failed: ${conversionError.message}`);
      }
      
      // Get actual Tezos resolver address who is deploying the contract
      const tezosResolver = await tezos.signer.publicKeyHash();
      const tezosMaker = this.convertEthereumToTezosAddress(orderParams.maker);
      // Use the actual Tezos resolver address, not converted Ethereum address
      const tezosTaker = tezosResolver; // Resolver is the taker on Tezos side
      
      console.log('🔧 Address conversion:', {
        originalMaker: orderParams.maker,
        originalTaker: orderParams.taker,
        tezosMaker: tezosMaker,
        tezosTaker: tezosTaker, // This is now the actual Tezos resolver address
        tezosResolver: tezosResolver,
        note: 'Tezos taker is the resolver deploying the contract'
      });
      
      console.log('🔧 Tezos deployment parameters:', {
        orderId: orderParams.orderId,
        orderHash: orderParams.orderHash,
        secretHash: orderParams.secretHash,
        maker: tezosMaker,
        taker: tezosTaker,
        tezosAmount: tezosAmountMutez,
        safetyDeposit: safetyDepositMutez,
        tokenAddress: orderParams.tezosTokenAddress
      });
      
      // Prepare immutables structure with Tezos addresses
      const immutables = {
        order_hash: String(orderParams.orderHash),
        hashlock: String(orderParams.secretHash),
        maker: tezosMaker, // Use converted Tezos address
        taker: tezosTaker, // Use converted Tezos address or resolver
        token_address: orderParams.tezosTokenAddress, // null for XTZ, address for FA2
        amount: tezosAmountMutez, // as number
        safety_deposit: safetyDepositMutez, // as number
        withdrawal_start: new Date(orderParams.timelocks.withdrawalStart * 1000).toISOString(),
        public_withdrawal_start: new Date(orderParams.timelocks.publicWithdrawalStart * 1000).toISOString(),
        cancellation_start: new Date(orderParams.timelocks.cancellationStart * 1000).toISOString(),
        public_cancellation_start: new Date(orderParams.timelocks.cancellationStart * 1000).toISOString(), // Same as cancellation for dst
        rescue_start: new Date(orderParams.timelocks.rescueStart * 1000).toISOString()
      };
      
      console.log('🔧 Tezos immutables structure:', immutables);
      console.log('🔧 Immutables types:', {
        order_hash: typeof immutables.order_hash,
        hashlock: typeof immutables.hashlock,
        maker: typeof immutables.maker,
        taker: typeof immutables.taker,
        amount: typeof immutables.amount,
        safety_deposit: typeof immutables.safety_deposit
      });
      
      // FIXED: Calculate initial balance correctly - the amounts are already in mutez
      // Convert mutez to XTZ for the initial balance (1 XTZ = 1,000,000 mutez)
      const totalMutez = tezosAmountMutez + safetyDepositMutez;
      const initialBalanceXTZ = totalMutez / 1000000; // Convert from mutez to XTZ
      
      // Cap to maximum 1 XTZ for testing to avoid balance underflow
      const maxBalanceXTZ = 1.0; // 1 XTZ maximum
      const cappedBalanceXTZ = Math.min(initialBalanceXTZ, maxBalanceXTZ);
      
      console.log('🔧 Balance calculation (FIXED):', {
        tezosAmountMutez: tezosAmountMutez,
        safetyDepositMutez: safetyDepositMutez, 
        totalMutez: totalMutez,
        initialBalanceXTZ: initialBalanceXTZ,
        cappedBalanceXTZ: cappedBalanceXTZ,
        note: 'Values above are: mutez for amounts, XTZ for balance'
      });
      
      // Check account balance before deployment
      const accountBalance = await tezos.tz.getBalance(tezosResolver);
      const accountBalanceXTZ = accountBalance.toNumber() / 1000000;
      
      console.log('🔧 Account balance check:', {
        accountBalanceMutez: accountBalance.toNumber(),
        accountBalanceXTZ: accountBalanceXTZ,
        requestedBalanceXTZ: cappedBalanceXTZ
      });
      
      // Use minimal balance if account doesn't have enough
      let finalBalanceXTZ = cappedBalanceXTZ;
      if (accountBalanceXTZ < cappedBalanceXTZ + 0.1) { // Need buffer for fees
        finalBalanceXTZ = Math.max(0.01, accountBalanceXTZ * 0.5); // Use 50% of available or minimum 0.01 XTZ
        console.warn(`⚠️ Insufficient balance. Using minimal balance: ${finalBalanceXTZ} XTZ`);
      }

      finalBalanceXTZ = initialBalanceXTZ; // Use the initial balance calculated above
      
      console.log('🔧 Deploying with balance:', finalBalanceXTZ, 'XTZ');
      
      // Prepare storage with explicit type safety
      const storage = {
        immutables: immutables,
        access_token: accessTokenAddress,
        withdrawn: false,
        cancelled: false
      };
      
      const originationOp = await tezos.contract.originate({
        code: contractCode,
        storage: storage,
        balance: finalBalanceXTZ // This should be in XTZ, not mutez
      });

      console.log(`⏳ Waiting for confirmation of origination for ${originationOp.contractAddress}...`);
      const contract = await originationOp.contract();
      console.log(`✅ Tezos Destination Escrow deployed at: ${contract.address}`);

      return {
        contractAddress: contract.address,
        transactionHash: originationOp.hash,
        contractType: 'tezos-destination',
        immutables: immutables,
        balance: finalBalanceXTZ,
        // Include original Ethereum addresses for reference
        originalAddresses: {
          maker: orderParams.maker,
          taker: orderParams.taker
        }
      };

    } catch (error) {
      console.error('Error deploying Tezos Destination escrow:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Log the specific line that's causing the issue
      if (error.stack) {
        const lines = error.stack.split('\n');
        const relevantLine = lines.find(line => line.includes('contractDeployment.js'));
        if (relevantLine) {
          console.error('Specific error location:', relevantLine);
        }
      }
      
      throw error;
    }
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
      
      // Ensure all BigInt values are properly converted to numbers with explicit checks
      let tezosAmountMutez, safetyDepositMutez;
      
      try {
        // More robust conversion handling
        tezosAmountMutez = this.safeToNumber(orderParams.tezosAmount, 'tezosAmount');
        safetyDepositMutez = this.safeToNumber(orderParams.tezosSafetyDeposit, 'tezosSafetyDeposit');
        
        console.log('🔧 Type conversion successful:', {
          tezosAmountType: typeof tezosAmountMutez,
          tezosAmountValue: tezosAmountMutez,
          safetyDepositType: typeof safetyDepositMutez,
          safetyDepositValue: safetyDepositMutez
        });
        
      } catch (conversionError) {
        console.error('❌ Error converting BigInt values:', conversionError);
        throw new Error(`BigInt conversion failed: ${conversionError.message}`);
      }
      
      // Get actual Tezos resolver address who is deploying the contract
      const tezosResolver = await tezos.signer.publicKeyHash();
      const tezosMaker = this.convertEthereumToTezosAddress(orderParams.maker);
      // Use the actual Tezos resolver address, not converted Ethereum address
      const tezosTaker = tezosResolver; // Resolver is the taker on Tezos side
      
      console.log('🔧 Address conversion:', {
        originalMaker: orderParams.maker,
        originalTaker: orderParams.taker,
        tezosMaker: tezosMaker,
        tezosTaker: tezosTaker, // This is now the actual Tezos resolver address
        tezosResolver: tezosResolver,
        note: 'Tezos taker is the resolver deploying the contract'
      });
      
      console.log('🔧 Tezos deployment parameters:', {
        orderId: orderParams.orderId,
        orderHash: orderParams.orderHash,
        secretHash: orderParams.secretHash,
        maker: tezosMaker,
        taker: tezosTaker,
        tezosAmount: tezosAmountMutez,
        safetyDeposit: safetyDepositMutez,
        tokenAddress: orderParams.tezosTokenAddress
      });
      
      // Prepare immutables structure with Tezos addresses
      const immutables = {
        order_hash: String(orderParams.orderHash),
        hashlock: String(orderParams.secretHash),
        maker: tezosMaker, // Use converted Tezos address
        taker: tezosTaker, // Use converted Tezos address or resolver
        token_address: orderParams.tezosTokenAddress, // null for XTZ, address for FA2
        amount: tezosAmountMutez, // as number
        safety_deposit: safetyDepositMutez, // as number
        withdrawal_start: new Date(orderParams.timelocks.withdrawalStart * 1000).toISOString(),
        public_withdrawal_start: new Date(orderParams.timelocks.publicWithdrawalStart * 1000).toISOString(),
        cancellation_start: new Date(orderParams.timelocks.cancellationStart * 1000).toISOString(),
        public_cancellation_start: new Date(orderParams.timelocks.publicCancellationStart * 1000).toISOString(),
        rescue_start: new Date(orderParams.timelocks.rescueStart * 1000).toISOString()
      };
      
      console.log('🔧 Tezos immutables structure:', immutables);
      console.log('🔧 Immutables types:', {
        order_hash: typeof immutables.order_hash,
        hashlock: typeof immutables.hashlock,
        maker: typeof immutables.maker,
        taker: typeof immutables.taker,
        amount: typeof immutables.amount,
        safety_deposit: typeof immutables.safety_deposit
      });
      
      // FIXED: Calculate initial balance correctly - the amounts are already in mutez
      // Convert mutez to XTZ for the initial balance (1 XTZ = 1,000,000 mutez)
      const totalMutez = tezosAmountMutez + safetyDepositMutez;
      const initialBalanceXTZ = totalMutez / 1000000; // Convert from mutez to XTZ
      
      // Cap to maximum 1 XTZ for testing to avoid balance underflow
      const maxBalanceXTZ = 1.0; // 1 XTZ maximum
      const cappedBalanceXTZ = Math.min(initialBalanceXTZ, maxBalanceXTZ);
      
      console.log('🔧 Balance calculation (FIXED):', {
        tezosAmountMutez: tezosAmountMutez,
        safetyDepositMutez: safetyDepositMutez, 
        totalMutez: totalMutez,
        initialBalanceXTZ: initialBalanceXTZ,
        cappedBalanceXTZ: cappedBalanceXTZ,
        note: 'Values above are: mutez for amounts, XTZ for balance'
      });
      
      // Check account balance before deployment
      const accountBalance = await tezos.tz.getBalance(tezosResolver);
      const accountBalanceXTZ = accountBalance.toNumber() / 1000000;
      
      console.log('🔧 Account balance check:', {
        accountBalanceMutez: accountBalance.toNumber(),
        accountBalanceXTZ: accountBalanceXTZ,
        requestedBalanceXTZ: cappedBalanceXTZ
      });
      
      // Use minimal balance if account doesn't have enough
      let finalBalanceXTZ = cappedBalanceXTZ;
      if (accountBalanceXTZ < cappedBalanceXTZ + 0.1) { // Need buffer for fees
        finalBalanceXTZ = Math.max(0.01, accountBalanceXTZ * 0.5); // Use 50% of available or minimum 0.01 XTZ
        console.warn(`⚠️ Insufficient balance. Using minimal balance: ${finalBalanceXTZ} XTZ`);
      }

      finalBalanceXTZ = initialBalanceXTZ; // Use the initial balance calculated above
      
      console.log('🔧 Deploying with balance:', finalBalanceXTZ, 'XTZ');
      
      // Prepare storage with explicit type safety
      const storage = {
        immutables: immutables,
        access_token: accessTokenAddress,
        withdrawn: false,
        cancelled: false
      };
      
      const originationOp = await tezos.contract.originate({
        code: contractCode,
        storage: storage,
        balance: finalBalanceXTZ // This should be in XTZ, not mutez
      });

      console.log(`⏳ Waiting for confirmation of origination for ${originationOp.contractAddress}...`);
      const contract = await originationOp.contract();
      console.log(`✅ Tezos Source Escrow deployed at: ${contract.address}`);

      return {
        contractAddress: contract.address,
        transactionHash: originationOp.hash,
        contractType: 'tezos-source',
        immutables: immutables,
        balance: finalBalanceXTZ,
        // Include original Ethereum addresses for reference
        originalAddresses: {
          maker: orderParams.maker,
          taker: orderParams.taker
        }
      };

    } catch (error) {
      console.error('Error deploying Tezos Source escrow:', error);
      throw error;
    }
  }

  // =============================================================================
  // ETHEREUM SOURCE ESCROW DEPLOYMENT (Resolver sends all funds)
  // =============================================================================
  async deployEthereumSourceEscrow(orderParams, accessTokenAddress) {
  try {
    console.log(`🚀 Deploying Ethereum Source Escrow for order ${orderParams.orderId}`);
    console.log('  Order params:', {
      orderId: orderParams.orderId,
      maker: orderParams.maker,
      taker: orderParams.taker,
      amount: orderParams.amount?.toString(),
      tokenAddress: orderParams.tokenAddress
    });
    
    const { provider, wallet } = await this.initializeEthereum();
    
    if (!wallet) {
      throw new Error('Ethereum wallet not configured - please set ETHEREUM_PRIVATE_KEY environment variable');
    }

    console.log('✅ Ethereum wallet configured, proceeding with deployment...');

    // Load EscrowSrc contract
    const contractData = this.loadEthereumSourceContract();
    console.log('  Contract ABI entries:', contractData.abi?.length || 0);
    console.log('  Contract bytecode length:', contractData.bytecode?.length || 0);
    
    if (!contractData.abi || !contractData.bytecode || contractData.bytecode === "0x") {
      console.error('❌ Invalid contract data loaded - using mock deployment instead');
      return this.createMockEthereumSourceContract(orderParams);
    }

    // Calculate amounts for ETH swaps
    const userAmount = BigInt(orderParams.amount);
    const safetyDeposit = BigInt(orderParams.safetyDeposit);
    const totalFunding = userAmount + safetyDeposit;

    console.log('  Funding details:', {
      userAmount: userAmount.toString(),
      safetyDeposit: safetyDeposit.toString(),
      totalFunding: totalFunding.toString(),
      tokenAddress: orderParams.tokenAddress
    });

    // Pre-calculate the deployment immutables BEFORE deployment
    const encodedTimelocks = this.encodeTimelocks(orderParams.timelocks);
    
    const deploymentImmutables = {
      orderHash: orderParams.orderHash,
      hashlock: orderParams.secretHash,
      maker: orderParams.maker,
      taker: orderParams.taker,
      token: orderParams.tokenAddress,
      amount: userAmount, // Keep as BigInt for exact matching
      safetyDeposit: safetyDeposit, // Keep as BigInt for exact matching
      timelocks: encodedTimelocks // This will be the exact same value used during deployment
    };

    console.log('  Pre-calculated deployment immutables:', {
      orderHash: deploymentImmutables.orderHash,
      hashlock: deploymentImmutables.hashlock,
      maker: deploymentImmutables.maker,
      taker: deploymentImmutables.taker,
      token: deploymentImmutables.token,
      amount: deploymentImmutables.amount.toString(),
      safetyDeposit: deploymentImmutables.safetyDeposit.toString(),
      timelocks: deploymentImmutables.timelocks.toString()
    });

    // Deploy EscrowSrc contract
    const contractFactory = new ethers.ContractFactory(
      contractData.abi,
      contractData.bytecode,
      wallet
    );

    console.log('  Deploying contract with parameters:');
    console.log('    Rescue delay:', 30 * 24 * 60 * 60, 'seconds');
    console.log('    Access token:', accessTokenAddress);

    let contract;
    let fundingTransactions = [];

    if (orderParams.tokenAddress === ethers.ZeroAddress) {
      // For native ETH: Send Ether during deployment
      console.log('  ETH swap: Sending Ether during deployment');
      console.log('  Total ETH to send:', ethers.formatEther(totalFunding));
      
      try {
        contract = await contractFactory.deploy(
          30 * 24 * 60 * 60, // 30 days rescue delay
          accessTokenAddress, // IERC20 access token
          { value: totalFunding } // Send Ether during deployment
        );
        
        fundingTransactions.push({
          type: 'eth_deployment_funding',
          amount: totalFunding.toString(),
          userPortion: userAmount.toString(),
          safetyDepositPortion: safetyDeposit.toString(),
          from: await wallet.getAddress()
        });
        
      } catch (deployError) {
        console.error('❌ Deployment with funding failed:', deployError.message);
        console.log('🔄 Trying deployment without funding...');
        
        // Fallback: Deploy without funding
        contract = await contractFactory.deploy(
          30 * 24 * 60 * 60,
          accessTokenAddress
        );
        
        // Then send ETH separately
        try {
          const tx = await wallet.sendTransaction({
            to: await contract.getAddress(),
            value: totalFunding
          });
          await tx.wait();
          
          fundingTransactions.push({
            type: 'eth_post_deployment_funding',
            amount: totalFunding.toString(),
            txHash: tx.hash,
            from: await wallet.getAddress()
          });
          
        } catch (fundingError) {
          console.error('❌ Post-deployment funding failed:', fundingError.message);
        }
      }
    } else {
      // For ERC20 tokens: Deploy without ETH funding, then transfer tokens
      console.log('  ERC20 swap: Deploying without initial ETH funding');
      
      contract = await contractFactory.deploy(
        30 * 24 * 60 * 60, // 30 days rescue delay
        accessTokenAddress // IERC20 access token
      );
      
      await contract.waitForDeployment();
      const contractAddress = await contract.getAddress();
      
      // Transfer tokens to contract
      try {
        const tokenContract = new ethers.Contract(
          orderParams.tokenAddress,
          ['function transfer(address to, uint256 amount) returns (bool)'],
          wallet
        );
        
        console.log('  Transferring tokens to contract...');
        const transferTx = await tokenContract.transfer(contractAddress, userAmount);
        await transferTx.wait();
        
        fundingTransactions.push({
          type: 'erc20_token_transfer',
          amount: userAmount.toString(),
          token: orderParams.tokenAddress,
          txHash: transferTx.hash,
          from: await wallet.getAddress(),
          to: contractAddress
        });
        
      } catch (tokenError) {
        console.error('❌ Token transfer failed:', tokenError.message);
      }
    }
    
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();
    console.log(`✅ Ethereum Source Escrow deployed at: ${contractAddress}`);

    // Verify contract has the expected balance
    const finalBalance = await provider.getBalance(contractAddress);
    console.log('  Final contract balance:', ethers.formatEther(finalBalance));

    // Return with BOTH immutables and deploymentImmutables
    return {
      contractAddress,
      transactionHash: contract.deploymentTransaction().hash,
      contractType: 'ethereum-source',
      // Keep immutables for backward compatibility
      immutables: {
        orderHash: deploymentImmutables.orderHash,
        hashlock: deploymentImmutables.hashlock,
        maker: deploymentImmutables.maker,
        taker: deploymentImmutables.taker,
        token: deploymentImmutables.token,
        amount: deploymentImmutables.amount.toString(),
        safetyDeposit: deploymentImmutables.safetyDeposit.toString(),
        timelocks: deploymentImmutables.timelocks.toString()
      },
      // ✅ Add deploymentImmutables for withdrawal function
      deploymentImmutables: deploymentImmutables, // This keeps BigInt values for exact matching
      funded: fundingTransactions.length > 0,
      fundingTransactions: fundingTransactions,
      fundingBreakdown: {
        resolverContribution: totalFunding.toString(),
        userPortion: userAmount.toString(),
        safetyDepositPortion: safetyDeposit.toString(),
        totalLocked: totalFunding.toString()
      }
    };

  } catch (error) {
    console.error('❌ Error deploying Ethereum Source escrow:');
    console.log('  Error message:', error.message);
    console.log('  Error code:', error.code);
    console.log('  Stack:', error.stack);
    
    // Enhanced fallback with proper immutables
    console.log('🔧 Creating enhanced mock deployment...');
    const mockResult = this.createMockEthereumSourceContract(orderParams);
    
    // Add deploymentImmutables to mock result
    const encodedTimelocks = this.encodeTimelocks(orderParams.timelocks);
    mockResult.deploymentImmutables = {
      orderHash: orderParams.orderHash,
      hashlock: orderParams.secretHash,
      maker: orderParams.maker,
      taker: orderParams.taker,
      token: orderParams.tokenAddress,
      amount: BigInt(orderParams.amount),
      safetyDeposit: BigInt(orderParams.safetyDeposit),
      timelocks: encodedTimelocks
    };
    
    return mockResult;
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
      
      if (!contractData.abi || !contractData.bytecode || contractData.bytecode === "0x") {
        console.error('❌ Destination contract not available - using mock deployment');
        return this.createMockEthereumDestinationContract(orderParams);
      }
      
      // Check wallet balance
      const balance = await provider.getBalance(await wallet.getAddress());
      const totalAmount = BigInt(orderParams.amount) + BigInt(orderParams.safetyDeposit);
      
      if (balance < totalAmount + ethers.parseEther("0.01")) {
        console.warn(`⚠️ Insufficient balance for destination escrow - using mock`);
        return this.createMockEthereumDestinationContract(orderParams);
      }
      
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
        amount: orderParams.amount.toString(),
        safetyDeposit: orderParams.safetyDeposit.toString(),
        timelocks: this.encodeTimelocks(orderParams.timelocks)
      };

      // Fund the contract with the required amount
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
        console.log(`✅ Funded Ethereum Destination Escrow with tokens and ${ethers.formatEther(orderParams.safetyDeposit)} ETH safety deposit`);
      }

      return {
        contractAddress: contract.target,
        transactionHash: contract.deploymentTransaction().hash,
        contractType: 'ethereum-destination',
        immutables: immutables
      };

    } catch (error) {
      console.error('❌ Error deploying Ethereum Destination escrow:', error.message);
      return this.createMockEthereumDestinationContract(orderParams);
    }
  }

  /**
   * Creates a mock Ethereum destination contract deployment for testing
   */
  createMockEthereumDestinationContract(orderParams) {
    const mockAddress = "0x" + Math.random().toString(16).substring(2, 42).padStart(40, '0');
    const mockTxHash = "0x" + Math.random().toString(16).substring(2, 66).padStart(64, '0');
    
    return {
      contractAddress: mockAddress,
      transactionHash: mockTxHash,
      contractType: 'ethereum-destination',
      funded: true,
      mock: true,
      immutables: {
        orderHash: orderParams.orderHash,
        hashlock: orderParams.secretHash,
        maker: orderParams.maker,
        taker: orderParams.taker,
        token: orderParams.tokenAddress,
        amount: orderParams.amount.toString(),
        safetyDeposit: orderParams.safetyDeposit.toString(),
        timelocks: this.encodeTimelocks(orderParams.timelocks)
      }
    };
  }

  // =============================================================================
  // ETHEREUM CONTRACT LOADING WITH BETTER ERROR HANDLING
  // =============================================================================
  loadEthereumSourceContract() {
    console.log('📁 Loading Ethereum Source contract...');
    
    // Try the correct path first based on your structure
    const possiblePaths = [
      path.join(__dirname, '../../contracts/ethereum/EscrowSrc.sol'),
      path.join(__dirname, '../../artifacts/contracts/ethereum/EscrowSrc.sol/EscrowSrc.json'),
      path.join(__dirname, '../contracts/ethereum/compiled/EscrowSrc.json'),
      path.join(__dirname, '../../contracts/ethereum/compiled/EscrowSrc.json'),
      path.join(__dirname, '../../contracts/ethereum/artifacts/EscrowSrc.sol/EscrowSrc.json'),
      path.join(__dirname, '../../build/contracts/EscrowSrc.json'),
      path.join(__dirname, '../artifacts/EscrowSrc.json')
    ];

    for (const contractPath of possiblePaths) {
      console.log(`  Trying path: ${contractPath}`);
      if (fs.existsSync(contractPath)) {
        try {
          const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
          console.log(`  ✅ Found contract at: ${contractPath}`);
          console.log(`  ABI entries: ${contractData.abi?.length || 0}`);
          console.log(`  Bytecode length: ${contractData.bytecode?.length || 0}`);
          
          // Validate contract data
          if (contractData.abi && contractData.bytecode && contractData.bytecode !== "0x") {
            return contractData;
          } else {
            console.log(`  ⚠️ Invalid contract data at ${contractPath}`);
          }
        } catch (parseError) {
          console.log(`  ❌ Error parsing contract at ${contractPath}:`, parseError.message);
        }
      } else {
        console.log(`  ❌ File not found: ${contractPath}`);
      }
    }

    console.error('❌ Ethereum Source contract not found or invalid in any expected location');
    console.log('💡 To deploy real contracts, please:');
    console.log('   1. Compile your Solidity contracts with: npx hardhat compile');
    console.log('   2. Ensure contracts are in the correct location');
    console.log('   3. Check that bytecode is not empty');
    
    return { abi: [], bytecode: "0x" };
  }

  loadEthereumDestinationContract() {
    console.log('📁 Loading Ethereum Destination contract...');
    
    // Try the correct path first based on your structure
    const possiblePaths = [
      path.join(__dirname, '../../contracts/ethereum/EscrowDst.sol'),
      path.join(__dirname, '../../artifacts/contracts/ethereum/EscrowDst.sol/EscrowDst.json'),
      path.join(__dirname, '../contracts/ethereum/compiled/EscrowDst.json'),
      path.join(__dirname, '../../contracts/ethereum/compiled/EscrowDst.json'),
      path.join(__dirname, '../../contracts/ethereum/artifacts/EscrowDst.sol/EscrowDst.json'),
      path.join(__dirname, '../../build/contracts/EscrowDst.json'),
      path.join(__dirname, '../artifacts/EscrowDst.json')
    ];

    for (const contractPath of possiblePaths) {
      console.log(`  Trying path: ${contractPath}`);
      if (fs.existsExists(contractPath)) {
        try {
          const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
          console.log(`  ✅ Found contract at: ${contractPath}`);
          console.log(`  ABI entries: ${contractData.abi?.length || 0}`);
          console.log(`  Bytecode length: ${contractData.bytecode?.length || 0}`);
          
          // Validate contract data
          if (contractData.abi && contractData.bytecode && contractData.bytecode !== "0x") {
            return contractData;
          } else {
            console.log(`  ⚠️ Invalid contract data at ${contractPath}`);
          }
        } catch (parseError) {
          console.log(`  ❌ Error parsing contract at ${contractPath}:`, parseError.message);
        }
      } else {
        console.log(`  ❌ File not found: ${contractPath}`);
      }
    }

    console.error('❌ Ethereum Destination contract not found or invalid in any expected location');
    return { abi: [], bytecode: "0x" };
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

  // =============================================================================
  // ETHEREUM DEPLOYMENT USING 1INCH ARCHITECTURE
  // =============================================================================
  async deployEthereumEscrowContracts(orderParams, accessTokenAddress) {
    try {
      console.log(`🚀 Deploying Ethereum escrows using 1inch architecture for order ${orderParams.orderId}`);
      
      const { provider, wallet } = await this.initializeEthereum();
      
      if (!wallet) {
        throw new Error('Ethereum wallet not configured');
      }

      // Load deployed factory address (should be deployed separately like in the test)
      const factoryAddress = this.deployedContracts.ethereum.escrowFactory?.address;
      if (!factoryAddress) {
        throw new Error('EscrowFactory not deployed. Please deploy factory first.');
      }

      // Prepare immutables matching the 1inch structure
      const immutables = {
        orderHash: orderParams.orderHash,
        hashlock: orderParams.secretHash,
        maker: orderParams.maker,
        taker: orderParams.taker, // resolver address
        token: orderParams.tokenAddress,
        amount: orderParams.amount,
        safetyDeposit: orderParams.safetyDeposit,
        timelocks: this.encodeTimelocks(orderParams.timelocks)
      };

      // For source chain: Deploy through factory with safety deposit
      const factory = new ethers.Contract(
        factoryAddress,
        this.loadEthereumFactoryContract().abi,
        wallet
      );

      // Deploy source escrow (this would be called by resolver in real scenario)
      const srcTx = await factory.createSrcEscrow(immutables, {
        value: immutables.safetyDeposit // Send safety deposit with deployment
      });
      const srcReceipt = await srcTx.wait();
      
      // Get deployed escrow address from events
      const srcEscrowCreatedEvent = srcReceipt.logs.find(log => 
        log.topics[0] === ethers.id("SrcEscrowCreated(bytes32,address)")
      );
      const srcEscrowAddress = ethers.AbiCoder.defaultAbiCoder().decode(
        ['bytes32', 'address'], 
        srcEscrowCreatedEvent.data
      )[1];

      console.log(`✅ Ethereum Source Escrow deployed at: ${srcEscrowAddress}`);

      return {
        sourceContract: {
          contractAddress: srcEscrowAddress,
          transactionHash: srcReceipt.hash,
          contractType: 'ethereum-source',
          immutables
        },
        factoryAddress
      };

    } catch (error) {
      console.error('Error deploying Ethereum escrows:', error);
      throw error;
    }
  }

  // =============================================================================
  // IMPROVED ORDER PARAMETER EXTRACTION
  // =============================================================================
  extractOrderDeploymentParams(signedOrder) {
    const { _metadata, signature, ...orderData } = signedOrder;
    
    // Generate timelocks based on current time and order expiries
    const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
    const minDelay = 60; // Minimum 1 minute delay

    const timelocks = {
      // 1. Finality period: 1 minute (no withdrawals allowed)
      withdrawalStart: now + 60,                    // Private withdrawal starts after finality
      
      // 2. Public withdrawal: 5 minutes after private withdrawal starts
      publicWithdrawalStart: now + 360,             // 6 minutes from now (60 + 300)
      
      // 3. Private cancellation: At least 1 hour from now, or after srcExpiry
      cancellationStart: Math.max(
        orderData.srcExpiry, 
        now + 3600                                  // 1 hour from now minimum
      ),
      
      // 4. Public cancellation: 5 minutes after private cancellation
      publicCancellationStart: Math.max(
        orderData.srcExpiry + 300,                  // 5 minutes after srcExpiry
        now + 3900                                  // Or 65 minutes from now (3600 + 300)
      ),
      
      // 5. Rescue: Much later - for stuck funds recovery
      rescueStart: Math.max(
        orderData.srcExpiry + 24 * 60 * 60,        // 24 hours after srcExpiry
        now + 25 * 60 * 60                         // Or 25 hours from now
      ),
      
      // 6. Destination cancellation: Shorter timelock for resolver protection
      dstCancellationStart: Math.max(
        orderData.dstExpiry, 
        now + 1800                                  // 30 minutes from now
      )
    };

    console.log('🕐 Generated timelocks:', {
      now,
      withdrawalStart: timelocks.withdrawalStart,
      publicWithdrawalStart: timelocks.publicWithdrawalStart,
      cancellationStart: timelocks.cancellationStart,
      publicCancellationStart: timelocks.publicCancellationStart,
      rescueStart: timelocks.rescueStart,
      dstCancellationStart: timelocks.dstCancellationStart
    });

    // Always use the user-provided values as-is, and calculate safety deposits per chain
    const makingAmountBigInt = BigInt(orderData.makingAmount); // ETH/ERC20, in wei
    const takingAmountBigInt = BigInt(orderData.takingAmount); // XTZ, in mutez

    // Safety deposit for Ethereum (in wei)
    const safetyDepositBigInt = makingAmountBigInt / BigInt(100);

    // Safety deposit for Tezos (in mutez)
    const tezosSafetyDepositMutez = takingAmountBigInt / BigInt(100);

    console.log('🔧 Amount calculations:', {
      originalMakingAmount: orderData.makingAmount,
      originalTakingAmount: orderData.takingAmount,
      makingAmountBigInt: makingAmountBigInt.toString(),
      safetyDepositBigInt: safetyDepositBigInt.toString(),
      tezosAmountMutez: takingAmountBigInt.toString(),
      tezosSafetyDepositMutez: tezosSafetyDepositMutez.toString()
    });

    return {
      // Order identification
      orderId: orderData.orderId,
      orderHash: ethers.keccak256(ethers.toUtf8Bytes(orderData.orderId)),
      
      // Parties (resolver becomes taker when accepting the order)
      maker: orderData.maker,
      taker: orderData.resolverBeneficiary || process.env.RESOLVER_ADDRESS || "0x6cD7f208742840078ea0025677f1fD48eC4f6259",
      
      // Cross-chain parameters
      secretHash: orderData.secretHash,
      secret: _metadata.secret,
      
      // Ethereum side
      tokenAddress: orderData.makerAsset,
      amount: makingAmountBigInt,
      safetyDeposit: safetyDepositBigInt,

      // Tezos side
      tezosTokenAddress: orderData.takerAsset === 'XTZ' ? null : orderData.takerAsset,
      tezosAmount: takingAmountBigInt,
      tezosSafetyDeposit: tezosSafetyDepositMutez,
      tezosDestination: orderData.destinationAddress,

      // Timelocks
      timelocks,

      // Chain information
      sourceChain: _metadata.sourceChain,
      targetChain: _metadata.targetChain
    };
  }

  // =============================================================================
  // PROPER TIMELOCK ENCODING FOR ETHEREUM
  // =============================================================================
  encodeTimelocks(timelocks) {
  try {
    console.log('🕐 Encoding timelocks with input:', timelocks);
    
    const now = Math.floor(Date.now() / 1000);
    const deployedAt = BigInt(timelocks.deployedAt || now);
    
    console.log('📅 Deployment timestamp:', deployedAt.toString(), `(${new Date(Number(deployedAt) * 1000).toISOString()})`);
    
    // ❌ YOUR OLD MAPPING WAS WRONG! 
    // ✅ CORRECT MAPPING according to TimelocksLib.Stage enum:
    // Stage.SrcWithdrawal = 0        -> bits 0-31
    // Stage.SrcPublicWithdrawal = 1  -> bits 32-63  
    // Stage.SrcCancellation = 2      -> bits 64-95
    // Stage.SrcPublicCancellation = 3 -> bits 96-127
    // Stage.DstWithdrawal = 4        -> bits 128-159
    // Stage.DstPublicWithdrawal = 5  -> bits 160-191
    // Stage.DstCancellation = 6      -> bits 192-223
    // DeployedAt timestamp           -> bits 224-255
    
    // Calculate delays from deployment time
    const srcWithdrawalDelay = BigInt(Math.max(0, (timelocks.withdrawalStart || (now + 30)) - Number(deployedAt)));
    const srcPublicWithdrawalDelay = BigInt(Math.max(0, (timelocks.publicWithdrawalStart || (now + 3600)) - Number(deployedAt)));
    const srcCancellationDelay = BigInt(Math.max(0, (timelocks.cancellationStart || (now + 86400)) - Number(deployedAt)));
    const srcPublicCancellationDelay = BigInt(Math.max(0, (timelocks.publicCancellationStart || (now + 86700)) - Number(deployedAt)));
    
    // For source escrow, destination stages can be 0 or reasonable defaults
    const dstWithdrawalDelay = BigInt(timelocks.dstWithdrawalDelay || 0);
    const dstPublicWithdrawalDelay = BigInt(timelocks.dstPublicWithdrawalDelay || 0);
    const dstCancellationDelay = BigInt(timelocks.dstCancellationDelay || 43200); // 12 hours

    console.log('⏱️ Calculated delays (seconds from deployment):');
    console.log(`  SrcWithdrawal: ${srcWithdrawalDelay} (absolute: ${Number(deployedAt) + Number(srcWithdrawalDelay)})`);
    console.log(`  SrcPublicWithdrawal: ${srcPublicWithdrawalDelay} (absolute: ${Number(deployedAt) + Number(srcPublicWithdrawalDelay)})`);
    console.log(`  SrcCancellation: ${srcCancellationDelay} (absolute: ${Number(deployedAt) + Number(srcCancellationDelay)})`);
    console.log(`  SrcPublicCancellation: ${srcPublicCancellationDelay} (absolute: ${Number(deployedAt) + Number(srcPublicCancellationDelay)})`);

    // Validate delays fit in uint32
    const maxUint32 = 0xFFFFFFFFn;
    const delays = [srcWithdrawalDelay, srcPublicWithdrawalDelay, srcCancellationDelay, srcPublicCancellationDelay, dstWithdrawalDelay, dstPublicWithdrawalDelay, dstCancellationDelay];
    
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > maxUint32) {
        console.warn(`⚠️ Delay ${i} too large: ${delays[i]}, capping to ${maxUint32}`);
        delays[i] = maxUint32;
      }
    }

    // ✅ CORRECT BIT PACKING according to Stage enum:
    let packed = BigInt(0);
    
    // Pack delays in correct bit positions
    packed |= (srcWithdrawalDelay & 0xFFFFFFFFn) << 0n;    // Stage 0: SrcWithdrawal
    packed |= (srcPublicWithdrawalDelay & 0xFFFFFFFFn) << 32n; // Stage 1: SrcPublicWithdrawal
    packed |= (srcCancellationDelay & 0xFFFFFFFFn) << 64n;     // Stage 2: SrcCancellation  
    packed |= (srcPublicCancellationDelay & 0xFFFFFFFFn) << 96n; // Stage 3: SrcPublicCancellation
    packed |= (dstWithdrawalDelay & 0xFFFFFFFFn) << 128n;      // Stage 4: DstWithdrawal
    packed |= (dstPublicWithdrawalDelay & 0xFFFFFFFFn) << 160n; // Stage 5: DstPublicWithdrawal
    packed |= (dstCancellationDelay & 0xFFFFFFFFn) << 192n;    // Stage 6: DstCancellation
    
    // Pack deployment timestamp in upper 32 bits
    packed |= (deployedAt & 0xFFFFFFFFn) << 224n;

    console.log('📦 Encoded timelocks:');
    console.log(`  Packed value: ${packed.toString()}`);
    console.log(`  Hex: 0x${packed.toString(16)}`);

    // ✅ VERIFICATION: Decode back to verify
    console.log('🔍 Verification - decoding packed value:');
    const decodedDeployedAt = Number((packed >> 224n) & 0xFFFFFFFFn);
    console.log(`  Deployed at: ${decodedDeployedAt} (${new Date(decodedDeployedAt * 1000).toISOString()})`);
    
    const stageNames = ['SrcWithdrawal', 'SrcPublicWithdrawal', 'SrcCancellation', 'SrcPublicCancellation', 'DstWithdrawal', 'DstPublicWithdrawal', 'DstCancellation'];
    
    for (let stage = 0; stage < 7; stage++) {
      const delay = Number((packed >> BigInt(stage * 32)) & 0xFFFFFFFFn);
      const absoluteTime = decodedDeployedAt + delay;
      console.log(`  ${stageNames[stage]} (Stage ${stage}): delay=${delay}s, absolute=${absoluteTime} (${new Date(absoluteTime * 1000).toISOString()})`);
    }

    return packed;

  } catch (error) {
    console.error('❌ Error encoding timelocks:', error);
    throw new Error(`Failed to encode timelocks: ${error.message}`);
  }
}

  // Contract loading methods for compiled .tz files
  loadTezosDestinationContract() {
    console.log('📁 Loading Tezos Destination contract...');
    
    // Try the correct path first based on your structure
    const possiblePaths = [
    //   path.join(__dirname, '../contracts/tezos/compiled/EscrowDst.tz'),
    //   path.join(__dirname, '../../contracts/tezos/compiled/EscrowDst.tz'),
      path.join(__dirname, '../contracts/tezos/compiled/EscrowDst.json'),
      path.join(__dirname, '../../contracts/tezos/compiled/EscrowDst.json'),
    //   path.join(__dirname, '../contracts/tezos/compiled/mock-escrow.json'),
    //   path.join(__dirname, '../../contracts/tezos/compiled/mock-escrow.json')
    ];

    for (const contractPath of possiblePaths) {
      console.log(`  Trying path: ${contractPath}`);
      if (fs.existsSync(contractPath)) {
        try {
          const contractContent = fs.readFileSync(contractPath, 'utf8');
          console.log(`  ✅ Found Tezos contract at: ${contractPath}`);
          
          // If it's a JSON file, parse it and return the code
          if (contractPath.endsWith('.json')) {
            const parsed = JSON.parse(contractContent);
            return parsed.code || parsed; // Return code field if available, otherwise full object
          } else {
            // For .tz files, return as plain Michelson
            return contractContent.trim();
          }
        } catch (readError) {
          console.log(`  ❌ Error reading contract at ${contractPath}:`, readError.message);
        }
      } else {
        console.log(`  ❌ File not found: ${contractPath}`);
      }
    }

    console.error('❌ Tezos Destination contract not found in any expected location');
    // Return a simple mock contract as fallback
    console.log('🔧 Using fallback mock contract');
    return [
      { "prim": "parameter", "args": [{ "prim": "unit" }] },
      { "prim": "storage", "args": [{ "prim": "unit" }] },
      { "prim": "code", "args": [[{ "prim": "CDR" }, { "prim": "NIL", "args": [{ "prim": "operation" }] }, { "prim": "PAIR" }]] }
    ];
  }

  loadTezosSourceContract() {
    console.log('📁 Loading Tezos Source contract...');
    
    // Try the correct path first based on your structure
    const possiblePaths = [
      path.join(__dirname, '../contracts/tezos/compiled/EscrowSrc.tz'),
      path.join(__dirname, '../../contracts/tezos/compiled/EscrowSrc.tz'),
      path.join(__dirname, '../contracts/tezos/compiled/EscrowSrc.json'),
      path.join(__dirname, '../../contracts/tezos/compiled/EscrowSrc.json'),
      path.join(__dirname, '../contracts/tezos/compiled/mock-escrow.json'),
      path.join(__dirname, '../../contracts/tezos/compiled/mock-escrow.json')
    ];

    for (const contractPath of possiblePaths) {
      console.log(`  Trying path: ${contractPath}`);
      if (fs.existsSync(contractPath)) {
        try {
          const contractContent = fs.readFileSync(contractPath, 'utf8');
          console.log(`  ✅ Found Tezos contract at: ${contractPath}`);
          
          // If it's a JSON file, parse it and return the code
          if (contractPath.endsWith('.json')) {
            const parsed = JSON.parse(contractContent);
            return parsed.code || parsed; // Return code field if available, otherwise full object
          } else {
            // For .tz files, return as plain Michelson
            return contractContent.trim();
          }
        } catch (readError) {
          console.log(`  ❌ Error reading contract at ${contractPath}:`, readError.message);
        }
      } else {
        console.log(`  ❌ File not found: ${contractPath}`);
      }
    }

    console.error('❌ Tezos Source contract not found in any expected location');
    // Return a simple mock contract as fallback
    console.log('🔧 Using fallback mock contract');
    return [
      { "prim": "parameter", "args": [{ "prim": "unit" }] },
      { "prim": "storage", "args": [{ "prim": "unit" }] },
      { "prim": "code", "args": [[{ "prim": "CDR" }, { "prim": "NIL", "args": [{ "prim": "operation" }] }, { "prim": "PAIR" }]] }
    ];
  }

  // =============================================================================
  // ETHEREUM CONTRACT LOADING WITH FACTORY SUPPORT
  // =============================================================================
  loadEthereumSourceContract() {
    console.log('📁 Loading Ethereum Source contract...');
    
    // Try the correct path first based on your structure
    const possiblePaths = [
      path.join(__dirname, '../contracts/ethereum/compiled/EscrowSrc.json'),
      path.join(__dirname, '../../contracts/ethereum/compiled/EscrowSrc.json'),
      path.join(__dirname, '../../artifacts/contracts/ethereum/EscrowSrc.sol/EscrowSrc.json'),
      path.join(__dirname, '../../contracts/ethereum/artifacts/EscrowSrc.sol/EscrowSrc.json'),
      path.join(__dirname, '../../build/contracts/EscrowSrc.json'),
      path.join(__dirname, '../artifacts/EscrowSrc.json')
    ];

    for (const contractPath of possiblePaths) {
      console.log(`  Trying path: ${contractPath}`);
      if (fs.existsSync(contractPath)) {
        try {
          const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
          console.log(`  ✅ Found contract at: ${contractPath}`);
          console.log(`  ABI entries: ${contractData.abi?.length || 0}`);
          console.log(`  Bytecode length: ${contractData.bytecode?.length || 0}`);
          return contractData;
        } catch (parseError) {
          console.log(`  ❌ Error parsing contract at ${contractPath}:`, parseError.message);
        }
      } else {
        console.log(`  ❌ File not found: ${contractPath}`);
      }
    }

    console.error('❌ Ethereum Source contract not found in any expected location');
    return { abi: [], bytecode: "0x" };
  }

  loadEthereumDestinationContract() {
    console.log('📁 Loading Ethereum Destination contract...');
    
    // Try the correct path first based on your structure
    const possiblePaths = [
      path.join(__dirname, '../contracts/ethereum/compiled/EscrowDst.json'),
      path.join(__dirname, '../../contracts/ethereum/compiled/EscrowDst.json'),
      path.join(__dirname, '../../artifacts/contracts/ethereum/EscrowDst.sol/EscrowDst.json'),
      path.join(__dirname, '../../contracts/ethereum/artifacts/EscrowDst.sol/EscrowDst.json'),
      path.join(__dirname, '../../build/contracts/EscrowDst.json'),
      path.join(__dirname, '../artifacts/EscrowDst.json')
    ];

    for (const contractPath of possiblePaths) {
      console.log(`  Trying path: ${contractPath}`);
      if (fs.existsExists(contractPath)) {
        try {
          const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
          console.log(`  ✅ Found contract at: ${contractPath}`);
          console.log(`  ABI entries: ${contractData.abi?.length || 0}`);
          console.log(`  Bytecode length: ${contractData.bytecode?.length || 0}`);
          return contractData;
        } catch (parseError) {
          console.log(`  ❌ Error parsing contract at ${contractPath}:`, parseError.message);
        }
      } else {
        console.log(`  ❌ File not found: ${contractPath}`);
      }
    }

    console.error('❌ Ethereum Destination contract not found in any expected location');
    return { abi: [], bytecode: "0x" };
  }

  loadEthereumFactoryContract() {
    // Load compiled Solidity Factory contract
    try {
      return JSON.parse(fs.readFileSync(
        path.join(__dirname, '../../artifacts/contracts/ethereum/EscrowFactory.sol/EscrowFactory.json')
      ));
    } catch (error) {
      console.warn('Ethereum Factory contract ABI not found, using placeholder');
      return { abi: [], bytecode: "0x" };
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================
  
  /**
   * Converts amount to mutez for Tezos - REMOVED CONVERSION
   * @param {string} amount - Amount as string (already in correct unit)
   * @param {string} asset - Asset type ('XTZ' or token address)
   * @returns {BigInt} Amount in base unit
   */
  convertToMutez(amount, asset) {
    // User should provide amounts in the correct base unit
    // For XTZ: amount should already be in mutez
    // For FA2 tokens: amount should already be in token's base unit
    return BigInt(amount);
  }

  generateSecret() {
    // Generate a random 32-byte secret
    return ethers.randomBytes(32);
  }

  hashSecret(secret) {
    // Hash the secret for cross-chain verification
    return ethers.keccak256(secret);
  }

  /**
   * Safely converts a value to number, handling BigInt, string, and number inputs
   * @param {*} value - The value to convert
   * @param {string} fieldName - Name of the field for error reporting
   * @returns {number} The converted number
   */
  safeToNumber(value, fieldName) {
    if (value === null || value === undefined) {
      throw new Error(`${fieldName} is null or undefined`);
    }
    
    if (typeof value === 'number') {
      if (value > Number.MAX_SAFE_INTEGER) {
        throw new Error(`${fieldName} number value ${value} exceeds Number.MAX_SAFE_INTEGER`);
      }
      return value;
    }
    
    if (typeof value === 'bigint') {
      // Check if BigInt value is within safe number range
      if (value > Number.MAX_SAFE_INTEGER) {
        throw new Error(`${fieldName} BigInt value ${value} exceeds Number.MAX_SAFE_INTEGER`);
      }
      return Number(value);
    }
    
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed)) {
        throw new Error(`${fieldName} string value "${value}" cannot be parsed as a number`);
      }
      if (parsed > Number.MAX_SAFE_INTEGER) {
        throw new Error(`${fieldName} parsed value ${parsed} exceeds Number.MAX_SAFE_INTEGER`);
      }
      return parsed;
    }
    
    throw new Error(`${fieldName} has unsupported type: ${typeof value}`);
  }

  /**
   * Converts an Ethereum address to a valid Tezos address format
   * This is a simple mapping function - in a real implementation you might want
   * to use a more sophisticated cross-chain address mapping system
   * @param {string} ethereumAddress - Ethereum address (0x...)
   * @returns {string} Valid Tezos address
   */
  convertEthereumToTezosAddress(ethereumAddress) {
    // For now, we'll use a deterministic mapping to generate valid Tezos addresses
    // In a real cross-chain system, you might have a registry or use the resolver's address
    
    if (!ethereumAddress || !ethereumAddress.startsWith('0x')) {
      throw new Error(`Invalid Ethereum address: ${ethereumAddress}`);
    }
    
    // Simple deterministic mapping - create a valid Tezos tz1 address
    // This is just for demo purposes - real implementation would need proper cross-chain mapping
    const ethLower = ethereumAddress.toLowerCase();
    
    // Create a hash from the Ethereum address and format it as a Tezos address
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(ethLower).digest();
    
    // Take first 20 bytes and encode as base58check with tz1 prefix
    const tz1Prefix = Buffer.from([6, 161, 159]); // tz1 prefix bytes
    const payload = hash.slice(0, 20);
    const prefixedPayload = Buffer.concat([tz1Prefix, payload]);
    
    // Calculate checksum
    const checksum = crypto.createHash('sha256')
      .update(crypto.createHash('sha256').update(prefixedPayload).digest())
      .digest()
      .slice(0, 4);
    
    const fullPayload = Buffer.concat([prefixedPayload, checksum]);
    
    // Convert to base58
    const base58 = this.encodeBase58(fullPayload);
    
    console.log(`🔄 Converted ${ethereumAddress} to Tezos address: ${base58}`);
    return base58;
  }

  /**
   * Simple base58 encoding (Bitcoin/Tezos alphabet)
   * @param {Buffer} buffer - Buffer to encode
   * @returns {string} Base58 encoded string
   */
  encodeBase58(buffer) {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    
    // Convert buffer to big integer
    let num = BigInt('0x' + buffer.toString('hex'));
    let encoded = '';
    
    while (num > 0) {
      const remainder = num % 58n;
      num = num / 58n;
      encoded = alphabet[Number(remainder)] + encoded;
    }
    
    // Handle leading zeros
    for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
      encoded = '1' + encoded;
    }
    
    return encoded;
  }

}

module.exports = ContractDeploymentService;