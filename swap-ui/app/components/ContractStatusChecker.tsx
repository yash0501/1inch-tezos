'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface ContractStatusCheckerProps {
  order: any;
  resolverEndpoint: string;
  onStatusUpdate: (status: any) => void;
  showStatus: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

interface ContractStatus {
  sourceContract: {
    deployed: boolean;
    funded: boolean;
    contractAddress?: string;
    transactionHash?: string;
  };
  targetContract: {
    deployed: boolean;
    funded: boolean;
    contractAddress?: string;
    transactionHash?: string;
  };
  bothReady: boolean;
  lastChecked: Date;
}

const ContractStatusChecker: React.FC<ContractStatusCheckerProps> = ({
  order,
  resolverEndpoint,
  onStatusUpdate,
  showStatus
}) => {
  const [status, setStatus] = useState<ContractStatus>({
    sourceContract: { deployed: false, funded: false },
    targetContract: { deployed: false, funded: false },
    bothReady: false,
    lastChecked: new Date()
  });
  const [polling, setPolling] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (order?.orderId) {
      startPolling();
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [order?.orderId]);

  const startPolling = () => {
    if (polling) return;
    
    setPolling(true);
    showStatus('Checking contract deployment status...', 'info');
    
    // Initial check
    checkContractStatus();
    
    // Set up polling every 10 seconds
    const interval = setInterval(checkContractStatus, 10000);
    setPollInterval(interval);
  };

  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    setPolling(false);
  };

  const checkContractStatus = async () => {
    try {
      const response = await fetch(`${resolverEndpoint}/api/orders/${order.orderId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get status');
      }

      const newStatus: ContractStatus = {
        sourceContract: {
          deployed: result.sourceContract?.deployed || false,
          funded: result.sourceContract?.funded || false,
          contractAddress: result.sourceContract?.contractAddress,
          transactionHash: result.sourceContract?.transactionHash
        },
        targetContract: {
          deployed: result.targetContract?.deployed || false,
          funded: result.targetContract?.funded || false,
          contractAddress: result.targetContract?.contractAddress,
          transactionHash: result.targetContract?.transactionHash
        },
        bothReady: result.bothContractsReady || false,
        lastChecked: new Date()
      };

      setStatus(newStatus);

      // Notify parent component of status update
      onStatusUpdate(newStatus);

      // Show appropriate status messages
      if (newStatus.bothReady && !status.bothReady) {
        showStatus('🎉 Both contracts are deployed and funded! You can now reveal the secret.', 'success');
        stopPolling();
      } else if (newStatus.sourceContract.deployed && !status.sourceContract.deployed) {
        showStatus('✅ Source contract deployed successfully', 'success');
      } else if (newStatus.targetContract.deployed && !status.targetContract.deployed) {
        showStatus('✅ Target contract deployed successfully', 'success');
      } else if (newStatus.sourceContract.funded && !status.sourceContract.funded) {
        showStatus('💰 Source contract funded successfully', 'success');
      } else if (newStatus.targetContract.funded && !status.targetContract.funded) {
        showStatus('💰 Target contract funded successfully', 'success');
      }

    } catch (error: any) {
      console.error('Error checking contract status:', error);
      showStatus(`Error checking status: ${error.message}`, 'error');
    }
  };

  const getStatusIcon = (deployed: boolean, funded: boolean) => {
    if (!deployed) return '⏳';
    if (deployed && !funded) return '🔄';
    if (deployed && funded) return '✅';
    return '❌';
  };

  const getStatusText = (deployed: boolean, funded: boolean) => {
    if (!deployed) return 'Pending deployment';
    if (deployed && !funded) return 'Deployed, waiting for funding';
    if (deployed && funded) return 'Deployed and funded';
    return 'Failed';
  };

  return (
    <div className="contract-status-checker bg-gray-50 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-medium text-gray-900">Contract Status</h4>
        <div className="flex items-center space-x-2">
          {polling && (
            <div className="flex items-center text-blue-600">
              <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm">Checking...</span>
            </div>
          )}
          <button
            onClick={checkContractStatus}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source Contract Status */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-medium text-gray-900">Source Chain ({order._metadata.sourceChain})</h5>
            <span className="text-2xl">{getStatusIcon(status.sourceContract.deployed, status.sourceContract.funded)}</span>
          </div>
          <p className="text-sm text-gray-600 mb-2">{getStatusText(status.sourceContract.deployed, status.sourceContract.funded)}</p>
          {status.sourceContract.contractAddress && (
            <div className="text-xs font-mono bg-gray-100 p-2 rounded">
              {status.sourceContract.contractAddress}
            </div>
          )}
        </div>

        {/* Target Contract Status */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-medium text-gray-900">Target Chain ({order._metadata.targetChain})</h5>
            <span className="text-2xl">{getStatusIcon(status.targetContract.deployed, status.targetContract.funded)}</span>
          </div>
          <p className="text-sm text-gray-600 mb-2">{getStatusText(status.targetContract.deployed, status.targetContract.funded)}</p>
          {status.targetContract.contractAddress && (
            <div className="text-xs font-mono bg-gray-100 p-2 rounded">
              {status.targetContract.contractAddress}
            </div>
          )}
        </div>
      </div>

      {/* Overall Status */}
      <div className={`mt-4 p-3 rounded-lg ${status.bothReady ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
        <div className="flex items-center">
          <span className="text-2xl mr-3">{status.bothReady ? '🎉' : '⏳'}</span>
          <div>
            <p className={`font-medium ${status.bothReady ? 'text-green-800' : 'text-yellow-800'}`}>
              {status.bothReady ? 'Ready for Secret Revelation!' : 'Waiting for Contract Deployment'}
            </p>
            <p className={`text-sm ${status.bothReady ? 'text-green-700' : 'text-yellow-700'}`}>
              {status.bothReady 
                ? 'Both contracts are deployed and funded. You can now reveal your secret to complete the swap.'
                : 'Please wait while the resolver deploys and funds the escrow contracts on both chains.'
              }
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-500">
        Last checked: {status.lastChecked.toLocaleTimeString()}
      </div>
    </div>
  );
};

export default ContractStatusChecker;
