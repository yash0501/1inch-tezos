'use client';

import { useState } from 'react';
import { ethers } from 'ethers';

interface OrderReviewProps {
  isActive: boolean;
  isCompleted: boolean;
  order: any;
  signer: ethers.JsonRpcSigner | null;
  resolverEndpoint: string;
  onOrderSubmitted: (response: any) => void;
  showStatus: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// Resolver address
const RESOLVER_ADDRESS = "0x6cD7f208742840078ea0025677f1fD48eC4f6259";

export default function OrderReview({
  isActive,
  isCompleted,
  order,
  signer,
  resolverEndpoint,
  onOrderSubmitted,
  showStatus
}: OrderReviewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');

  const submitOrderToResolver = async () => {
    console.log('🔍 Debug - signer:', signer);
    console.log('🔍 Debug - order:', order);
    
    if (!signer) {
      showStatus('No wallet connected', 'error');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Step 1: Send maker amount to resolver
      await sendFundsToResolver();
      
      // Step 2: Submit signed order to resolver
      await submitSignedOrder();
      
    } catch (error: any) {
      console.error('❌ Order submission error:', error);
      showStatus(`Failed to complete order submission: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
      setCurrentStep('');
    }
  };

  const sendFundsToResolver = async () => {
    console.log('💰 Starting fund transfer to resolver...');
    setCurrentStep('Sending funds to resolver...');
    showStatus('Sending funds to resolver...', 'info');

    const userAddress = await signer!.getAddress();
    const amount = BigInt(order.makingAmount);
    
    console.log('🔍 Transfer details:', {
      userAddress,
      resolverAddress: RESOLVER_ADDRESS,
      amount: amount.toString(),
      amountFormatted: ethers.formatEther(amount),
      assetType: order.makerAsset === ethers.ZeroAddress ? 'ETH' : 'ERC20'
    });

    if (order.makerAsset === ethers.ZeroAddress) {
      // For ETH transfers
      console.log('💎 Sending ETH to resolver...');
      const tx = await signer!.sendTransaction({
        to: RESOLVER_ADDRESS,
        value: amount
      });
      
      showStatus(`ETH transfer sent: ${tx.hash}`, 'info');
      console.log('📋 ETH transfer tx:', tx.hash);
      await tx.wait();
      showStatus('ETH transfer confirmed!', 'success');
      console.log('✅ ETH transfer confirmed');
      
    } else {
      // For ERC20 tokens
      const tokenContract = new ethers.Contract(
        order.makerAsset,
        [
          'function transfer(address to, uint256 amount) returns (bool)',
          'function balanceOf(address account) returns (uint256)',
          'function allowance(address owner, address spender) returns (uint256)',
          'function approve(address spender, uint256 amount) returns (bool)'
        ],
        signer
      );

      // Check current allowance
      const currentAllowance = await tokenContract.allowance(userAddress, RESOLVER_ADDRESS);
      
      if (currentAllowance < amount) {
        setCurrentStep('Approving tokens...');
        showStatus('Approving tokens for resolver...', 'info');
        
        // Reset allowance to 0 first (for USDT-like tokens)
        if (currentAllowance > 0) {
          const resetTx = await tokenContract.approve(RESOLVER_ADDRESS, 0);
          await resetTx.wait();
        }
        
        // Approve the required amount
        const approveTx = await tokenContract.approve(RESOLVER_ADDRESS, amount);
        showStatus(`Approval transaction sent: ${approveTx.hash}`, 'info');
        await approveTx.wait();
        showStatus('Token approval confirmed!', 'success');
      }

      // Transfer tokens to resolver
      setCurrentStep('Transferring tokens...');
      showStatus('Transferring tokens to resolver...', 'info');
      
      const transferTx = await tokenContract.transfer(RESOLVER_ADDRESS, amount);
      showStatus(`Token transfer sent: ${transferTx.hash}`, 'info');
      await transferTx.wait();
      showStatus('Token transfer confirmed!', 'success');
      
      // Verify the transfer
      const resolverBalance = await tokenContract.balanceOf(RESOLVER_ADDRESS);
      console.log('Resolver token balance after transfer:', ethers.formatUnits(resolverBalance, 18));
    }
  };

  const submitSignedOrder = async () => {
    setCurrentStep('Submitting signed order...');
    showStatus('Submitting signed order to resolver...', 'info');

    try {
      const response = await fetch(`${resolverEndpoint}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(order)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Resolver rejected the order');
      }
      
      showStatus('Order successfully submitted to resolver!', 'success');
      onOrderSubmitted(result);
      
    } catch (error: any) {
      throw new Error(`Failed to submit order: ${error.message}`);
    }
  };

  const getAssetDisplayName = () => {
    if (order.makerAsset === ethers.ZeroAddress) {
      return 'ETH';
    }
    return `ERC20 Token (${order.makerAsset.slice(0, 6)}...${order.makerAsset.slice(-4)})`;
  };

  const getFormattedAmount = () => {
    if (order.makerAsset === ethers.ZeroAddress) {
      return ethers.formatEther(order.makingAmount);
    }
    return ethers.formatUnits(order.makingAmount, 18); // Assume 18 decimals for ERC20
  };

  if (!isActive && !isCompleted) return null;

  return (
    <div className={`step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
      <div className="flex items-center mb-4">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
          isCompleted ? 'bg-green-500 text-white' : 
          isActive ? 'bg-blue-500 text-white' : 
          'bg-gray-300 text-gray-600'
        }`}>
          {isCompleted ? '✓' : '3'}
        </div>
        <h2 className={`text-xl font-semibold ${
          isActive ? 'text-blue-600' : 
          isCompleted ? 'text-green-600' : 
          'text-gray-500'
        }`}>
          Review & Submit Order
        </h2>
      </div>
      
      {(isActive || isCompleted) && (
        <div className="pl-11">
          <div className="order-details bg-gray-50 rounded-lg p-6">
            <h4 className="text-lg font-medium mb-4">📋 Order Summary</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-3">
                <p><strong>Order ID:</strong><br/>
                  <span className="font-mono text-sm">{order.orderId}</span>
                </p>
                <p><strong>Sending:</strong><br/>
                  <span className="text-lg font-semibold">{getFormattedAmount()} {getAssetDisplayName()}</span>
                </p>
                <p><strong>Receiving:</strong><br/>
                  <span className="text-lg font-semibold">{parseInt(order.takingAmount) / 1000000} XTZ</span>
                </p>
              </div>
              <div className="space-y-3">
                <p><strong>To Tezos Address:</strong><br/>
                  <span className="font-mono text-sm">{order.destinationAddress}</span>
                </p>
                <p><strong>Resolver Address:</strong><br/>
                  <span className="font-mono text-sm">{RESOLVER_ADDRESS}</span>
                </p>
                <p><strong>Source Expiry:</strong><br/>
                  <span className="text-sm">{new Date(order.srcExpiry * 1000).toLocaleString()}</span>
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-yellow-900 mb-2">⚠️ Important Process</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-800">
                <li>Your {getAssetDisplayName()} will be sent to the resolver</li>
                <li>The signed order will be submitted to the resolver</li>
                <li>The resolver will deploy escrow contracts on both chains</li>
                <li>You can then reveal the secret to complete the cross-chain swap</li>
              </ol>
            </div>

            {isActive && (
              <div>
                {/* Debug info */}
                <div className="mb-4 p-2 bg-gray-100 rounded text-xs">
                  <strong>Debug:</strong> Signer: {signer ? '✅ Connected' : '❌ Not connected'} | 
                  Order: {order ? '✅ Present' : '❌ Missing'}
                </div>
                
                {currentStep && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-800 font-medium">{currentStep}</p>
                  </div>
                )}
                
                <button
                  onClick={submitOrderToResolver}
                  disabled={isSubmitting || !signer}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition duration-300"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Send Funds & Submit Order'
                  )}
                </button>
                
                {!signer && (
                  <p className="text-red-600 text-sm mt-2">
                    Please connect your Ethereum wallet to continue
                  </p>
                )}
              </div>
            )}

            {isCompleted && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">
                  ✅ Order successfully submitted! Funds sent to resolver and order deployed.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
