const { ethers } = require('ethers');

// Cross-chain order interface
class CrossChainOrderService {
  constructor() {
    // Default timelock durations (in seconds)
    this.ETH_LOCK_DURATION = 24 * 60 * 60;  // 24 hours for Ethereum
    this.TEZ_LOCK_DURATION = 12 * 60 * 60;  // 12 hours for Tezos (shorter)
    
    // EIP-712 domain for cross-chain orders
    this.DOMAIN = {
      name: "1inchCrossChainOrders",
      version: "1",
      chainId: 1, // Ethereum mainnet
      verifyingContract: "0x0000000000000000000000000000000000000000" // To be replaced with actual contract
    };

    // EIP-712 types for cross-chain orders
    this.TYPES = {
      CrossChainOrder: [
        { name: "orderId", type: "string" },
        { name: "maker", type: "address" },
        { name: "makerAsset", type: "address" },
        { name: "takerAsset", type: "string" },
        { name: "makingAmount", type: "uint256" },
        { name: "takingAmount", type: "uint256" },
        { name: "resolverBeneficiary", type: "address" },
        { name: "secretHash", type: "bytes32" },
        { name: "srcExpiry", type: "uint256" },
        { name: "dstExpiry", type: "uint256" },
        { name: "destinationAddress", type: "string" }
      ]
    };
  }

  /**
   * Creates a new cross-chain order with all required fields
   * @param {Object} orderParams - Basic order parameters
   * @param {string} orderParams.maker - Ethereum address of the maker
   * @param {string} orderParams.makerAsset - ERC-20 token address on Ethereum
   * @param {string} orderParams.takerAsset - FA2 token address or "XTZ" on Tezos
   * @param {string} orderParams.makingAmount - Amount of makerAsset to sell
   * @param {string} orderParams.takingAmount - Amount of takerAsset to receive
   * @param {string} orderParams.resolverBeneficiary - Ethereum address for resolver payment
   * @param {string} orderParams.destinationAddress - Tezos address to receive tokens
   * @param {ethers.Wallet} makerWallet - Wallet to sign the order
   * @returns {Promise<Object>} Complete cross-chain order with signature
   */
  async createCrossChainOrder(orderParams, makerWallet) {
    try {
      console.log('🔨 Creating cross-chain order...');

      // Generate unique order ID
      const orderId = this.generateOrderId();
      
      // Generate secret and compute hash
      const secret = this.generateSecret();
      const secretHash = this.hashSecret(secret);
      
      // Compute expiry timestamps
      const now = Math.floor(Date.now() / 1000);
      const srcExpiry = now + this.ETH_LOCK_DURATION;
      const dstExpiry = now + this.TEZ_LOCK_DURATION;

      // Build the complete cross-chain order
      const crossChainOrder = {
        orderId: orderId,
        maker: orderParams.maker,
        makerAsset: orderParams.makerAsset,
        takerAsset: orderParams.takerAsset,
        makingAmount: orderParams.makingAmount,
        takingAmount: orderParams.takingAmount,
        resolverBeneficiary: orderParams.resolverBeneficiary,
        secretHash: secretHash,
        srcExpiry: srcExpiry,
        dstExpiry: dstExpiry,
        destinationAddress: orderParams.destinationAddress
      };

      console.log('📋 Cross-chain order structure:', {
        orderId,
        maker: crossChainOrder.maker,
        makerAsset: crossChainOrder.makerAsset,
        takerAsset: crossChainOrder.takerAsset,
        makingAmount: crossChainOrder.makingAmount,
        takingAmount: crossChainOrder.takingAmount,
        resolverBeneficiary: crossChainOrder.resolverBeneficiary,
        secretHash,
        srcExpiry: new Date(srcExpiry * 1000).toISOString(),
        dstExpiry: new Date(dstExpiry * 1000).toISOString(),
        destinationAddress: crossChainOrder.destinationAddress
      });

      // Sign the order with EIP-712
      const signature = await this.signOrder(crossChainOrder, makerWallet);
      
      // Return complete signed order with metadata
      const signedOrder = {
        ...crossChainOrder,
        signature,
        // Metadata for internal use
        _metadata: {
          secret, // Keep secret for deployment (will be used by resolver)
          createdAt: new Date().toISOString(),
          sourceChain: 'ethereum',
          targetChain: 'tezos',
          status: 'created'
        }
      };

      console.log('✅ Cross-chain order created and signed');
      return signedOrder;

    } catch (error) {
      console.error('❌ Error creating cross-chain order:', error);
      throw error;
    }
  }

  /**
   * Signs a cross-chain order using EIP-712
   * @param {Object} order - The order to sign
   * @param {ethers.Wallet} wallet - Wallet to sign with
   * @returns {Promise<string>} EIP-712 signature
   */
  async signOrder(order, wallet) {
    try {
      const signature = await wallet.signTypedData(
        this.DOMAIN,
        this.TYPES,
        order
      );
      
      console.log('✍️ Order signed with EIP-712');
      return signature;
    } catch (error) {
      console.error('❌ Error signing order:', error);
      throw error;
    }
  }

  /**
   * Verifies an order signature
   * @param {Object} order - The signed order
   * @returns {Promise<boolean>} Whether signature is valid
   */
  async verifyOrderSignature(order) {
    try {
      const { signature, _metadata, ...orderData } = order;
      
      const recoveredAddress = ethers.verifyTypedData(
        this.DOMAIN,
        this.TYPES,
        orderData,
        signature
      );
      
      const isValid = recoveredAddress.toLowerCase() === order.maker.toLowerCase();
      console.log(`🔍 Signature verification: ${isValid ? 'VALID' : 'INVALID'}`);
      
      return isValid;
    } catch (error) {
      console.error('❌ Error verifying signature:', error);
      return false;
    }
  }

  /**
   * Extracts deployment parameters from a signed order
   * @param {Object} signedOrder - The complete signed order
   * @returns {Object} Parameters for contract deployment
   */
  extractDeploymentParams(signedOrder) {
    const { _metadata, signature, ...orderData } = signedOrder;
    
    return {
      // Order identification
      orderId: orderData.orderId,
      orderHash: ethers.keccak256(ethers.toUtf8Bytes(orderData.orderId)),
      
      // Parties
      maker: orderData.maker,
      taker: orderData.resolverBeneficiary, // Resolver acts as taker
      
      // Assets and amounts
      sourceToken: orderData.makerAsset,
      targetToken: orderData.takerAsset,
      sourceAmount: BigInt(orderData.makingAmount),
      targetAmount: BigInt(orderData.takingAmount),
      
      // Cross-chain parameters
      secretHash: orderData.secretHash,
      secret: _metadata.secret,
      
      // Timelocks
      srcExpiry: orderData.srcExpiry,
      dstExpiry: orderData.dstExpiry,
      
      // Destination
      destinationAddress: orderData.destinationAddress,
      
      // Metadata
      sourceChain: _metadata.sourceChain,
      targetChain: _metadata.targetChain
    };
  }

  /**
   * Generates a unique order ID
   * @returns {string} Unique order ID
   */
  generateOrderId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `order_${timestamp}_${random}`;
  }

  /**
   * Generates a random 32-byte secret
   * @returns {string} Hex-encoded secret
   */
  generateSecret() {
    return ethers.hexlify(ethers.randomBytes(32));
  }

  /**
   * Computes keccak256 hash of a secret
   * @param {string} secret - Hex-encoded secret
   * @returns {string} Hex-encoded hash
   */
  hashSecret(secret) {
    return ethers.keccak256(secret);
  }

  /**
   * Validates order parameters before creation
   * @param {Object} params - Order parameters to validate
   * @returns {boolean} Whether parameters are valid
   */
  validateOrderParams(params) {
    const required = [
      'maker', 
      'makerAsset', 
      'takerAsset', 
      'makingAmount', 
      'takingAmount', 
      'resolverBeneficiary', 
      'destinationAddress'
    ];
    
    for (const field of required) {
      if (!params[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate Ethereum addresses
    if (!ethers.isAddress(params.maker)) {
      throw new Error('Invalid maker address');
    }
    
    if (!ethers.isAddress(params.resolverBeneficiary)) {
      throw new Error('Invalid resolver beneficiary address');
    }

    if (params.makerAsset !== ethers.ZeroAddress && !ethers.isAddress(params.makerAsset)) {
      throw new Error('Invalid maker asset address');
    }

    // Validate Tezos address (basic check)
    if (!params.destinationAddress.startsWith('tz') && !params.destinationAddress.startsWith('KT')) {
      throw new Error('Invalid Tezos destination address');
    }

    // Validate amounts
    try {
      BigInt(params.makingAmount);
      BigInt(params.takingAmount);
    } catch {
      throw new Error('Invalid amount format');
    }

    return true;
  }
}

module.exports = CrossChainOrderService;
