'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface FundingManagerProps {
  order: any;
  signer: ethers.JsonRpcSigner | null;
  resolverEndpoint: string;
  onFundingComplete: (result: any) => void;
  showStatus: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const FundingManager: React.FC<FundingManagerProps> = ({
  order,
  signer,
  resolverEndpoint,
  onFundingComplete,
  showStatus
}) => {
  const [fundingStep, setFundingStep] = useState<string>('checking');
  const [txHash, setTxHash] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [tezosInputHash, setTezosInputHash] = useState<string>('');

  useEffect(() => {
    if (order?.resolverResponse) {
      checkFundingRequirements();
    }
  }, [order]);

  const checkFundingRequirements = () => {
    if (!order?.resolverResponse?.sourceContract) {
      setError('No deployment results found');
      return;
    }

    const sourceContract = order.resolverResponse.sourceContract;
    
    if (sourceContract.funded) {
      setFundingStep('completed');
      return;
    }

    if (sourceContract.requiresApproval) {
      setFundingStep('approval_needed');
    } else if (sourceContract.requiresUserFunding) {
      setFundingStep('tezos_funding_needed');
    } else if (sourceContract.awaitingFunding) {
      setFundingStep('eth_funding_needed');
    } else {
      setFundingStep('unknown');
    }
  };

  const handleApproveTokens = async () => {
    if (!signer) {
      setError('No wallet connected');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const approvalDetails = order.resolverResponse.sourceContract.approvalDetails;
      
      // Create token contract instance
      const tokenContract = new ethers.Contract(
        approvalDetails.tokenAddress,
        [
          'function approve(address spender, uint256 amount) returns (bool)',
          'function allowance(address owner, address spender) returns (uint256)'
        ],
        signer
      );

      showStatus('Approving tokens for resolver...', 'info');

      // Approve the resolver to spend user's tokens
      const approveTx = await tokenContract.approve(
        approvalDetails.spender,
        approvalDetails.amount
      );

      showStatus(`Approval transaction sent: ${approveTx.hash}`, 'info');
      setTxHash(approveTx.hash);
      
      // Wait for confirmation
      const receipt = await approveTx.wait();
      showStatus('Approval confirmed! Notifying resolver...', 'info');

      // Notify resolver that approval is complete
      await notifyResolverApproval(approveTx.hash);
      
      setFundingStep('approval_complete');
      onFundingComplete({
        type: 'approval',
        txHash: approveTx.hash
      });

    } catch (err: any) {
      console.error('Approval failed:', err);
      setError(`Approval failed: ${err.message}`);
      showStatus(`Approval failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const notifyResolverApproval = async (approvalTxHash: string) => {
    try {
      const userAddress = await signer?.getAddress();
      const response = await fetch(`${resolverEndpoint}/api/orders/${order.orderId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approvalTxHash,
          userAddress
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      showStatus('Resolver confirmed token transfer!', 'success');
      
      return result;
    } catch (error) {
      console.error('Failed to notify resolver:', error);
      throw error;
    }
  };

  const handleTezosTransfer = () => {
    setFundingStep('tezos_instructions');
  };

  const confirmTezosTransfer = async () => {
    if (!tezosInputHash.trim()) {
      setError('Please provide transaction hash');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${resolverEndpoint}/api/orders/${order.orderId}/fund-tezos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionHash: tezosInputHash,
          amount: order.resolverResponse.sourceContract.userFundingDetails.requiredAmountMutez
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      showStatus('Tezos funding confirmed!', 'success');
      
      setFundingStep('completed');
      onFundingComplete({
        type: 'tezos_funding',
        txHash: tezosInputHash
      });

    } catch (err: any) {
      console.error('Tezos funding confirmation failed:', err);
      setError(`Confirmation failed: ${err.message}`);
      showStatus(`Confirmation failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderFundingStep = () => {
    switch (fundingStep) {
      case 'checking':
        return (
          <div className="funding-step">
            <div className="flex items-center justify-center p-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="ml-3">Checking funding requirements...</p>
            </div>
          </div>
        );

      case 'approval_needed':
        const approvalDetails = order.resolverResponse.sourceContract.approvalDetails;
        return (
          <div className="funding-step">
            <h3 className="text-lg font-semibold mb-4">Token Approval Required</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800 mb-2">
                You need to approve the resolver to transfer your tokens:
              </p>
              <ul className="text-xs text-yellow-700 space-y-1">
                <li><strong>Token:</strong> {approvalDetails.tokenAddress}</li>
                <li><strong>Amount:</strong> {ethers.formatUnits(approvalDetails.amount, 18)} tokens</li>
                <li><strong>Spender:</strong> {approvalDetails.spender}</li>
                <li><strong>Current Allowance:</strong> {ethers.formatUnits(approvalDetails.currentAllowance, 18)} tokens</li>
              </ul>
            </div>
            <button
              onClick={handleApproveTokens}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-300"
            >
              {loading ? 'Approving...' : 'Approve Tokens'}
            </button>
            {txHash && (
              <p className="text-xs text-gray-600 mt-2">
                Transaction: {txHash}
              </p>
            )}
          </div>
        );

      case 'approval_complete':
        return (
          <div className="funding-step">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-800 mb-2">✅ Approval Complete</h3>
              <p className="text-green-700">
                Tokens approved and transferred successfully! The cross-chain swap is now active.
              </p>
              {txHash && (
                <p className="text-xs text-green-600 mt-2">
                  Transaction: {txHash}
                </p>
              )}
            </div>
          </div>
        );

      case 'tezos_funding_needed':
        return (
          <div className="funding-step">
            <h3 className="text-lg font-semibold mb-4">Tezos Funding Required</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800 mb-2">
                You need to send XTZ to the escrow contract:
              </p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li><strong>Amount:</strong> {order.resolverResponse.sourceContract.userFundingDetails.requiredAmountXTZ} XTZ</li>
                <li><strong>Amount (mutez):</strong> {order.resolverResponse.sourceContract.userFundingDetails.requiredAmountMutez}</li>
                <li><strong>Contract:</strong> {order.resolverResponse.sourceContract.contractAddress}</li>
              </ul>
            </div>
            <button
              onClick={handleTezosTransfer}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-300 mb-4"
            >
              Continue with Tezos Transfer
            </button>
          </div>
        );

      case 'tezos_instructions':
        return (
          <div className="funding-step">
            <h3 className="text-lg font-semibold mb-4">Send Tezos Transaction</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800 mb-4">
                Please send the following XTZ transaction using your Tezos wallet:
              </p>
              <div className="text-xs text-yellow-700 space-y-2 font-mono bg-yellow-100 p-3 rounded">
                <div><strong>To:</strong> {order.resolverResponse.sourceContract.contractAddress}</div>
                <div><strong>Amount:</strong> {order.resolverResponse.sourceContract.userFundingDetails.requiredAmountXTZ} XTZ</div>
                <div><strong>Amount (mutez):</strong> {order.resolverResponse.sourceContract.userFundingDetails.requiredAmountMutez}</div>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transaction Hash
              </label>
              <input
                type="text"
                value={tezosInputHash}
                onChange={(e) => setTezosInputHash(e.target.value)}
                placeholder="Enter Tezos transaction hash"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={confirmTezosTransfer}
              disabled={loading || !tezosInputHash.trim()}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-300"
            >
              {loading ? 'Confirming...' : 'Confirm Tezos Transfer'}
            </button>
          </div>
        );

      case 'eth_funding_needed':
        return (
          <div className="funding-step">
            <h3 className="text-lg font-semibold mb-4">ETH Funding Required</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">
                This order requires ETH funding. Please contact support or use a different funding method.
              </p>
            </div>
          </div>
        );

      case 'completed':
        return (
          <div className="funding-step">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-800 mb-2">✅ Funding Complete</h3>
              <p className="text-green-700">
                Your order has been successfully funded! The cross-chain swap is now active and ready for execution.
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="funding-step">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-700">
                Unknown funding state. Please refresh or contact support.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="funding-manager">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}
      {renderFundingStep()}
    </div>
  );
};

export default FundingManager;
