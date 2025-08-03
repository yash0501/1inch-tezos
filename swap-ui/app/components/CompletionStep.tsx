'use client';

import React from 'react';
import { ethers } from 'ethers';

interface CompletionStepProps {
  order: any;
  isActive: boolean;
}

const CompletionStep: React.FC<CompletionStepProps> = ({ order, isActive }) => {
  if (!isActive) return null;

  return (
    <div className="completion-step mb-8">
      <div className="flex items-center mb-6">
        <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center mr-4">
          ✅
        </div>
        <div>
          <h2 className="text-2xl font-bold text-green-600">Swap Completed!</h2>
          <p className="text-gray-600">Your cross-chain atomic swap has been successfully executed</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">🎉 Transaction Summary</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg p-4 border">
            <h4 className="font-medium text-gray-900 mb-2">You Sent</h4>
            <div className="text-2xl font-bold text-red-600">
              {order.makerAsset === ethers.ZeroAddress ? 
                `${ethers.formatEther(order.makingAmount)} ETH` :
                `${ethers.formatUnits(order.makingAmount, 18)} Tokens`
              }
            </div>
            <div className="text-sm text-gray-500">
              From {order._metadata.sourceChain}
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 border">
            <h4 className="font-medium text-gray-900 mb-2">You Received</h4>
            <div className="text-2xl font-bold text-green-600">
              {parseInt(order.takingAmount) / 1000000} XTZ
            </div>
            <div className="text-sm text-gray-500">
              On {order._metadata.targetChain}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border mb-4">
          <h4 className="font-medium text-gray-900 mb-3">📋 Contract Details</h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">Source Contract:</span>
              <span className="ml-2 font-mono">{order.resolverResponse?.sourceContract?.contractAddress}</span>
            </div>
            <div>
              <span className="text-gray-600">Target Contract:</span>
              <span className="ml-2 font-mono">{order.resolverResponse?.targetContract?.contractAddress}</span>
            </div>
            <div>
              <span className="text-gray-600">Secret Hash:</span>
              <span className="ml-2 font-mono">{order.secretHash}</span>
            </div>
            {order.completionResult?.transactionHashes && (
              <div>
                <span className="text-gray-600">Completion Transactions:</span>
                <div className="ml-2 space-y-1">
                  {order.completionResult.transactionHashes.map((tx: string, index: number) => (
                    <div key={index} className="font-mono text-xs">{tx}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center">
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg"
          >
            Start New Swap
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompletionStep;
