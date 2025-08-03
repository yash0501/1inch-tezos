'use client';

import React from 'react';
import { ethers } from 'ethers';

interface CompletionStepProps {
  order: any;
  isActive: boolean;
}

const CompletionStep: React.FC<CompletionStepProps> = ({ order, isActive }) => {
  if (!isActive) return null;

  const formatTransactionHash = (hash: string) => {
    if (!hash) return 'N/A';
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 6)}`;
  };

  const getExplorerUrl = (hash: string, chain: string) => {
    if (!hash) return '#';
    
    if (chain === 'ethereum') {
      return `https://sepolia.etherscan.io/tx/${hash}`;
    } else if (chain === 'tezos') {
      return `https://ghostnet.tzkt.io/${hash}`;
    }
    return '#';
  };

  const renderTransactionResults = () => {
    if (!order.completionResult?.transactionHashes) {
      return (
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-4">📄</div>
          <p className="text-gray-600">No transaction details available</p>
        </div>
      );
    }

    const transactions = order.completionResult.transactionHashes;
    
    // Handle both array and single object cases
    const transactionArray = Array.isArray(transactions) ? transactions : [transactions];
    
    return (
      <div className="space-y-3">
        {transactionArray.map((tx: any, index: number) => {
          // Ensure tx is an object and has the expected properties
          if (!tx || typeof tx !== 'object') {
            return (
              <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600">Invalid transaction data</p>
              </div>
            );
          }

          return (
            <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">
                      {tx.chain === 'ethereum' ? 'ETH' : tx.chain === 'tezos' ? 'XTZ' : '?'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {tx.chain || 'Unknown'} {tx.type ? tx.type.replace('_', ' ') : 'Transaction'}
                    </p>
                    <p className="text-xs text-gray-500">
                      To: {tx.beneficiary ? formatTransactionHash(String(tx.beneficiary)) : 'N/A'}
                    </p>
                  </div>
                </div>
                <div>
                  {tx.txHash ? (
                    <a
                      href={getExplorerUrl(String(tx.txHash), String(tx.chain || ''))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      <span className="font-mono">{formatTransactionHash(String(tx.txHash))}</span>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                      </svg>
                    </a>
                  ) : (
                    <span className="text-gray-400 text-sm">No hash</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Swap Completed Successfully!
        </h3>
        <p className="text-gray-600">
          Your cross-chain atomic swap has been executed
        </p>
      </div>

      {/* Swap Summary Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Swap Details</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* From */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">You sent</span>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">E</span>
                </div>
                <span className="text-sm text-gray-600">Ethereum</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {order.makingAmount ? 
                `${(parseFloat(order.makingAmount) / 1e18).toFixed(6)} ETH` : 
                'N/A'
              }
            </div>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>

          {/* To */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">You received</span>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">T</span>
                </div>
                <span className="text-sm text-gray-600">Tezos</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {order.takingAmount ? 
                `${(parseFloat(order.takingAmount) / 1e6).toFixed(6)} XTZ` : 
                'N/A'
              }
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Transactions</h4>
        {renderTransactionResults()}
      </div>

      {/* Timing Information */}
      {order.completedAt && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Completed at:</span>
            <span className="text-gray-900 font-medium">
              {new Date(order.completedAt).toLocaleString()}
            </span>
          </div>
          {order._metadata?.createdAt && (
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-500">Total time:</span>
              <span className="text-gray-900 font-medium">
                {Math.round(
                  (new Date(order.completedAt).getTime() - 
                   new Date(order._metadata.createdAt).getTime()) / 1000
                )} seconds
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <button
          onClick={() => window.location.reload()}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
          <span>New Swap</span>
        </button>
        <button
          onClick={() => {
            const data = {
              orderId: order.orderId,
              transactions: order.completionResult?.transactionHashes || [],
              completedAt: order.completedAt
            };
            navigator.clipboard.writeText(JSON.stringify(data, null, 2));
            alert('Swap details copied to clipboard!');
          }}
          className="flex-1 sm:flex-none bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
          </svg>
          <span>Copy Details</span>
        </button>
      </div>
    </div>
  );
};

export default CompletionStep;
