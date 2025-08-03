'use client';

import React, { useState } from 'react';

interface TezosInstructionsProps {
  contractAddress: string;
  requiredAmountXTZ: number;
  requiredAmountMutez: number;
  onConfirm: (txHash: string) => void;
  isLoading: boolean;
}

const TezosInstructions: React.FC<TezosInstructionsProps> = ({
  contractAddress,
  requiredAmountXTZ,
  requiredAmountMutez,
  onConfirm,
  isLoading
}) => {
  const [txHash, setTxHash] = useState('');

  const handleConfirm = () => {
    if (txHash.trim()) {
      onConfirm(txHash.trim());
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="tezos-instructions">
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Tezos Transfer Required
            </h3>
            <p className="mt-2 text-sm text-blue-700">
              Please send XTZ to the escrow contract using your Tezos wallet (Temple, Kukai, etc.).
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Transfer Details</h4>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Recipient:</span>
              <div className="flex items-center">
                <span className="font-mono text-sm mr-2">{contractAddress}</span>
                <button
                  onClick={() => copyToClipboard(contractAddress)}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  Copy
                </button>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Amount (XTZ):</span>
              <div className="flex items-center">
                <span className="font-semibold mr-2">{requiredAmountXTZ} XTZ</span>
                <button
                  onClick={() => copyToClipboard(requiredAmountXTZ.toString())}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  Copy
                </button>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Amount (mutez):</span>
              <div className="flex items-center">
                <span className="font-mono text-sm mr-2">{requiredAmountMutez}</span>
                <button
                  onClick={() => copyToClipboard(requiredAmountMutez.toString())}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-900 mb-2">Instructions</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-800">
            <li>Open your Tezos wallet (Temple, Kukai, etc.)</li>
            <li>Send exactly <strong>{requiredAmountXTZ} XTZ</strong> to the contract address above</li>
            <li>Wait for the transaction to be confirmed</li>
            <li>Copy the transaction hash and paste it below</li>
            <li>Click "Confirm Transfer" to proceed</li>
          </ol>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Transaction Hash
          </label>
          <input
            type="text"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="Enter Tezos transaction hash (opHash...)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            The transaction hash should start with "op" and be about 51 characters long
          </p>
        </div>

        <button
          onClick={handleConfirm}
          disabled={isLoading || !txHash.trim()}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition duration-300 flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Confirming...
            </>
          ) : (
            'Confirm Transfer'
          )}
        </button>
      </div>
    </div>
  );
};

export default TezosInstructions;
