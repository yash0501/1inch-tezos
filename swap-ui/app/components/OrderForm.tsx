'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface OrderFormProps {
  isActive: boolean;
  isCompleted: boolean;
  userAddress: string;
  tezosAddress: string;
  signer: ethers.JsonRpcSigner | null;
  onOrderCreated: (order: any) => void;
  showStatus: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// Sample resolver address
const RESOLVER_ADDRESS = "0x6cD7f208742840078ea0025677f1fD48eC4f6259";

export default function OrderForm({
  isActive,
  isCompleted,
  userAddress,
  tezosAddress,
  signer,
  onOrderCreated,
  showStatus
}: OrderFormProps) {
  const [formData, setFormData] = useState({
    sourceAmount: '',
    targetAmount: '',
    destinationAddress: tezosAddress || '',
    assetType: 'ETH' // ETH or ERC20
  });
  const [isCreating, setIsCreating] = useState(false);
  const [tokenAddress, setTokenAddress] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer) {
      showStatus('Please connect your Ethereum wallet first', 'error');
      return;
    }

    setIsCreating(true);
    showStatus('Creating cross-chain order...', 'info');

    try {
      // Validate form data
      validateOrderParams();

      // Determine token address based on asset type
      const makerAsset = formData.assetType === 'ETH' ? ethers.ZeroAddress : tokenAddress;
      
      // Create order parameters
      const orderParams = {
        maker: userAddress,
        makerAsset: makerAsset,
        takerAsset: "XTZ",
        makingAmount: formData.assetType === 'ETH' 
          ? ethers.parseEther(formData.sourceAmount).toString()
          : ethers.parseUnits(formData.sourceAmount, 18).toString(), // Assume 18 decimals for ERC20
        takingAmount: (parseFloat(formData.targetAmount) * 1000000).toString(), // Convert to mutez
        destinationAddress: formData.destinationAddress.trim()
      };

      // Handle approval for ERC20 tokens
      if (formData.assetType === 'ERC20') {
        await handleTokenApproval(orderParams);
      }

      // Create and sign the order
      const signedOrder = await createAndSignOrder(orderParams);
      
      onOrderCreated(signedOrder);
      showStatus('Order created and signed successfully!', 'success');
      
    } catch (error: any) {
      showStatus(`Failed to create order: ${error.message}`, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleTokenApproval = async (orderParams: any) => {
    if (!signer || !tokenAddress) {
      throw new Error('Token address is required for ERC20 approval');
    }

    showStatus('Checking token allowance...', 'info');

    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)'
      ],
      signer
    );

    try {
      // Check current allowance
      const currentAllowance = await tokenContract.allowance(userAddress, RESOLVER_ADDRESS);
      const requiredAmount = BigInt(orderParams.makingAmount);

      console.log('Token approval check:', {
        token: tokenAddress,
        currentAllowance: currentAllowance.toString(),
        requiredAmount: requiredAmount.toString(),
        spender: RESOLVER_ADDRESS
      });

      if (currentAllowance < requiredAmount) {
        showStatus('Approving tokens for resolver...', 'info');
        
        // For USDT-like tokens, reset to 0 first if there's existing allowance
        if (currentAllowance > 0) {
          showStatus('Resetting existing approval...', 'info');
          const resetTx = await tokenContract.approve(RESOLVER_ADDRESS, 0);
          await resetTx.wait();
          showStatus('Existing approval reset. Now approving required amount...', 'info');
        }

        // Approve the required amount
        const approveTx = await tokenContract.approve(RESOLVER_ADDRESS, requiredAmount);
        showStatus(`Approval transaction sent: ${approveTx.hash}`, 'info');
        
        const receipt = await approveTx.wait();
        showStatus('Token approval confirmed!', 'success');
        
        console.log('Token approval completed:', {
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber
        });
      } else {
        showStatus('Token already approved for required amount', 'info');
      }
    } catch (error: any) {
      throw new Error(`Token approval failed: ${error.message}`);
    }
  };

  const validateOrderParams = () => {
    // Validate destination address
    const destAddr = formData.destinationAddress.trim();
    if (!destAddr) {
      throw new Error('Tezos destination address is required');
    }
    
    if (!destAddr.startsWith('tz') && !destAddr.startsWith('KT')) {
      throw new Error(`Invalid Tezos address format: ${destAddr}. Address should start with 'tz' or 'KT'.`);
    }
    
    // Validate amounts
    const sourceAmt = parseFloat(formData.sourceAmount);
    const targetAmt = parseFloat(formData.targetAmount);
    
    if (isNaN(sourceAmt) || sourceAmt <= 0) {
      throw new Error('Source amount must be greater than 0');
    }
    
    if (isNaN(targetAmt) || targetAmt <= 0) {
      throw new Error('Target amount must be greater than 0');
    }

    // Validate token address for ERC20
    if (formData.assetType === 'ERC20') {
      if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
        throw new Error('Valid ERC20 token address is required');
      }
    }
  };

  const createAndSignOrder = async (orderParams: any) => {
    // Generate order ID
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate secret and hash - Keep secret secure on client side
    const secret = ethers.randomBytes(32);
    const secretHash = ethers.keccak256(secret);
    
    // Store secret directly (Uint8Array) in localStorage with orderId as key (as JSON string)
    localStorage.setItem(`swap_secret_${orderId}`, JSON.stringify(Array.from(secret)));
    console.log('🔐 Secret generated and stored securely for order:', orderId);
    
    // Calculate expiry times
    const now = Math.floor(Date.now() / 1000);
    const srcExpiry = now + (24 * 60 * 60); // 24 hours
    const dstExpiry = now + (12 * 60 * 60); // 12 hours
    
    // Create order structure with resolver address included
    const order = {
      orderId,
      maker: orderParams.maker,
      makerAsset: orderParams.makerAsset,
      takerAsset: orderParams.takerAsset,
      makingAmount: orderParams.makingAmount,
      takingAmount: orderParams.takingAmount,
      secretHash,
      srcExpiry,
      dstExpiry,
      destinationAddress: orderParams.destinationAddress,
      resolverAddress: RESOLVER_ADDRESS, // Include resolver address in order
      salt: ethers.toBigInt(ethers.randomBytes(32)).toString(),
      allowPartialFills: false,
      allowMultipleFills: false
    };
    
    // EIP-712 domain and types
    const domain = {
      name: "1inchCrossChainOrders",
      version: "1",
      chainId: 11155111 // Sepolia
    };
    
    const types = {
      CrossChainOrder: [
        { name: "orderId", type: "string" },
        { name: "maker", type: "address" },
        { name: "makerAsset", type: "address" },
        { name: "takerAsset", type: "string" },
        { name: "makingAmount", type: "uint256" },
        { name: "takingAmount", type: "uint256" },
        { name: "secretHash", type: "bytes32" },
        { name: "srcExpiry", type: "uint256" },
        { name: "dstExpiry", type: "uint256" },
        { name: "destinationAddress", type: "string" },
        { name: "resolverAddress", type: "address" },
        { name: "salt", type: "uint256" },
        { name: "allowPartialFills", type: "bool" },
        { name: "allowMultipleFills", type: "bool" }
      ]
    };

    console.log('🔍 Signing order with data:', order);
    console.log('🔍 Domain:', domain);
    
    // Sign the order
    const signature = await signer!.signTypedData(domain, types, order);
    
    console.log('✅ Order signed, signature:', signature);
    
    return {
      ...order,
      signature,
      _metadata: {
        // Store as hex string for UI convenience, but localStorage keeps the raw bytes
        // secret: ethers.hexlify(secret),
        // secretStorageKey: `swap_secret_${orderId}`,
        createdAt: new Date().toISOString(),
        sourceChain: 'ethereum',
        targetChain: 'tezos',
        status: 'created',
        approvalCompleted: formData.assetType === 'ERC20'
      }
    };
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Auto-fill destination address when tezos wallet is connected
  useEffect(() => {
    if (tezosAddress && !formData.destinationAddress) {
      setFormData(prev => ({ ...prev, destinationAddress: tezosAddress }));
    }
  }, [tezosAddress, formData.destinationAddress]);

  if (!isActive && !isCompleted) return null;

  return (
    <div className={`step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
      <h3 className="text-xl font-semibold mb-4">Step 2: Create Cross-Chain Order</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-group">
          <label className="form-label">Asset Type:</label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="assetType"
                value="ETH"
                checked={formData.assetType === 'ETH'}
                onChange={(e) => handleInputChange('assetType', e.target.value)}
                className="mr-2"
              />
              ETH (Native)
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="assetType"
                value="ERC20"
                checked={formData.assetType === 'ERC20'}
                onChange={(e) => handleInputChange('assetType', e.target.value)}
                className="mr-2"
              />
              ERC20 Token
            </label>
          </div>
        </div>

        {formData.assetType === 'ERC20' && (
          <div className="form-group">
            <label htmlFor="token-address" className="form-label">
              ERC20 Token Address:
            </label>
            <input
              type="text"
              id="token-address"
              placeholder="0x..."
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              className="form-input"
              required
            />
            <p className="text-sm text-gray-600 mt-1">
              Enter the contract address of the ERC20 token you want to swap
            </p>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="source-amount" className="form-label">
            Amount to Send ({formData.assetType}):
          </label>
          <input
            type="number"
            id="source-amount"
            step="0.000001"
            placeholder={formData.assetType === 'ETH' ? "0.01" : "100"}
            value={formData.sourceAmount}
            onChange={(e) => handleInputChange('sourceAmount', e.target.value)}
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="target-amount" className="form-label">
            Amount to Receive (XTZ):
          </label>
          <input
            type="number"
            id="target-amount"
            step="0.000001"
            placeholder="10.0"
            value={formData.targetAmount}
            onChange={(e) => handleInputChange('targetAmount', e.target.value)}
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="destination-address" className="form-label">
            Your Tezos Address:
          </label>
          <input
            type="text"
            id="destination-address"
            placeholder="tz1..."
            value={formData.destinationAddress}
            onChange={(e) => handleInputChange('destinationAddress', e.target.value)}
            className="form-input"
            required
          />
          {tezosAddress && (
            <p className="text-sm text-gray-600 mt-1">
              Connected wallet: {tezosAddress}
            </p>
          )}
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Resolver Information:</h4>
          <p className="text-sm text-blue-800 mb-2">
            <strong>Resolver Address:</strong> {RESOLVER_ADDRESS}
          </p>
          <p className="text-sm text-blue-800">
            💡 This resolver will fulfill your order. 
            {formData.assetType === 'ERC20' && (
              <span className="block mt-1">
                <strong>Note:</strong> You'll need to approve this resolver to spend your tokens during order creation.
              </span>
            )}
          </p>
        </div>

        {formData.assetType === 'ERC20' && (
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2">Token Approval Process:</h4>
            <ol className="text-sm text-yellow-800 space-y-1">
              <li>1. Check current token allowance for resolver</li>
              <li>2. If needed, approve resolver to spend your tokens</li>
              <li>3. Create and sign the cross-chain order</li>
              <li>4. Submit order to resolver for fulfillment</li>
            </ol>
          </div>
        )}

        <button
          type="submit"
          disabled={isCreating}
          className="btn-primary w-full"
        >
          {isCreating ? 'Processing...' : 
           formData.assetType === 'ERC20' ? 'Approve Tokens & Create Order' : 'Create & Sign Order'}
        </button>
      </form>
    </div>
  );
}