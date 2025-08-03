'use client';

import React from 'react';
import { ethers } from 'ethers';

interface ApprovalInstructionsProps {
  tokenAddress: string;
  spenderAddress: string;
  amount: string;
  currentAllowance: string;
  onApproveClick: () => void;
  isLoading: boolean;
}

const ApprovalInstructions: React.FC<ApprovalInstructionsProps> = ({
  tokenAddress,
  spenderAddress,
  amount,
  currentAllowance,
  onApproveClick,
  isLoading
}) => {
  const formatAmount = (value: string) => {
    try {
      return ethers.formatUnits(value, 18);
    } catch {
      return value;
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="approval-instructions">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Token Approval Required
            </h3>
            <p className="mt-2 text-sm text-yellow-700">
              Before the resolver can transfer your tokens, you need to approve the transaction. 
              This is a one-time approval that allows the resolver to spend your tokens on your behalf.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Token Details</h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500">Address:</span>
              <span className="ml-2 font-mono">{shortenAddress(tokenAddress)}</span>
            </div>
            <div>
              <span className="text-gray-500">Amount to Approve:</span>
              <span className="ml-2 font-semibold">{formatAmount(amount)} tokens</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Approval Details</h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500">Spender:</span>
              <span className="ml-2 font-mono">{shortenAddress(spenderAddress)}</span>
            </div>
            <div>
              <span className="text-gray-500">Current Allowance:</span>
              <span className="ml-2">{formatAmount(currentAllowance)} tokens</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
          <li>You approve the resolver to spend your tokens</li>
          <li>The resolver automatically transfers your tokens to the escrow</li>
          <li>The cross-chain swap becomes active</li>
          <li>You can reveal the secret to complete the swap</li>
        </ol>
      </div>

      <button
        onClick={onApproveClick}
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition duration-300 flex items-center justify-center"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Approving...
          </>
        ) : (
          'Approve Token Transfer'
        )}
      </button>
    </div>
  );
};

export default ApprovalInstructions;
