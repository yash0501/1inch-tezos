'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import FundingManager from './FundingManager';
import ContractStatusChecker from './ContractStatusChecker';

interface FundingStepProps {
  isActive: boolean;
  isCompleted: boolean;
  order: any;
  signer: ethers.JsonRpcSigner | null;
  resolverEndpoint: string;
  onFundingComplete: (result: any) => void;
  showStatus: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const FundingStep: React.FC<FundingStepProps> = ({
  isActive,
  isCompleted,
  order,
  signer,
  resolverEndpoint,
  onFundingComplete,
  showStatus
}) => {
  const [autoCompleted, setAutoCompleted] = useState(false);
  const [contractStatus, setContractStatus] = useState<any>(null);

  // Auto-complete this step when contracts are deployed and funded
  useEffect(() => {
    if (contractStatus?.bothReady && !autoCompleted) {
      console.log('✅ Both contracts are deployed and funded, auto-completing funding step');
      setAutoCompleted(true);
      onFundingComplete({
        type: 'auto_complete',
        contractStatus: contractStatus
      });
    }
  }, [contractStatus, autoCompleted, onFundingComplete]);

  const handleStatusUpdate = (status: any) => {
    setContractStatus(status);
  };

  const stepClass = `step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`;

  return (
    <div className={`${stepClass} mb-8`}>
      <div className="flex items-center mb-4">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
          isCompleted ? 'bg-green-500 text-white' : 
          isActive ? 'bg-blue-500 text-white' : 
          'bg-gray-300 text-gray-600'
        }`}>
          {isCompleted ? '✓' : '4'}
        </div>
        <h2 className={`text-xl font-semibold ${
          isActive ? 'text-blue-600' : 
          isCompleted ? 'text-green-600' : 
          'text-gray-500'
        }`}>
          Contracts Deployed & Funded
        </h2>
      </div>

      {(isActive || isCompleted) && (
        <div className="pl-11">
          <div className="bg-gray-50 rounded-lg p-6">
            <p className="text-gray-700 mb-4">
              The resolver is deploying and funding the escrow contracts on both chains. 
              This process may take a few minutes.
            </p>

            {/* Contract Status Checker */}
            {order && (
              <ContractStatusChecker
                order={order}
                resolverEndpoint={resolverEndpoint}
                onStatusUpdate={handleStatusUpdate}
                showStatus={showStatus}
              />
            )}

            {/* Legacy display for when resolverResponse is available */}
            {order.resolverResponse && (
              <div className="mt-6 space-y-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">📋 Deployment Summary</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">
                        Source Chain ({order._metadata.sourceChain})
                      </h5>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center">
                          <span className={`w-2 h-2 rounded-full mr-2 ${
                            order.resolverResponse.sourceContract?.funded ? 'bg-green-500' : 'bg-yellow-500'
                          }`}></span>
                          <span>Status: {order.resolverResponse.sourceContract?.funded ? 'Funded' : 'Deployed'}</span>
                        </div>
                        <div className="font-mono bg-gray-100 p-1 rounded text-xs">
                          {order.resolverResponse.sourceContract?.contractAddress}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">
                        Target Chain ({order._metadata.targetChain})
                      </h5>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center">
                          <span className={`w-2 h-2 rounded-full mr-2 ${
                            order.resolverResponse.targetContract?.funded ? 'bg-green-500' : 'bg-yellow-500'
                          }`}></span>
                          <span>Status: {order.resolverResponse.targetContract?.funded ? 'Funded' : 'Deployed'}</span>
                        </div>
                        <div className="font-mono bg-gray-100 p-1 rounded text-xs">
                          {order.resolverResponse.targetContract?.contractAddress}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isCompleted && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">
                  ✅ All contracts deployed and funded successfully! Ready for secret revelation.
                </p>
              </div>
            )}

            {isActive && autoCompleted && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-medium">
                  🔄 Automatically advancing to secret revelation step...
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FundingStep;
