'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface SecretRevelationStepProps {
  isActive: boolean;
  isCompleted: boolean;
  order: any;
  signer: ethers.JsonRpcSigner | null;
  resolverEndpoint: string;
  onSecretRevealed: (result: any) => void;
  showStatus: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const SecretRevelationStep: React.FC<SecretRevelationStepProps> = ({
  isActive,
  isCompleted,
  order,
  signer,
  resolverEndpoint,
  onSecretRevealed,
  showStatus
}) => {
  const [isRevealing, setIsRevealing] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [showSecretFromOrder, setShowSecretFromOrder] = useState(false);
  const [secretFromStorage, setSecretFromStorage] = useState<string>('');

  // Load secret from localStorage when component mounts
  useEffect(() => {
    if (order?.orderId) {
      const storedSecret = localStorage.getItem(`swap_secret_${order.orderId}`);
      if (storedSecret) {
        try {
          // Parse the JSON array and convert back to Uint8Array, then to hex
          const secretArray = JSON.parse(storedSecret);
          const secretBytes = new Uint8Array(secretArray);
          const secretHex = ethers.hexlify(secretBytes);
          setSecretFromStorage(secretHex);
          console.log('🔐 Secret loaded from secure storage for order:', order.orderId, {
            storedSecret: storedSecret.substring(0, 20) + '...',
            secretArray: secretArray.slice(0, 4) + '...',
            secretHex: secretHex.substring(0, 20) + '...'
          });
        } catch (error) {
          console.error('❌ Error parsing stored secret:', error);
          // Fallback: assume it's already a hex string
          if (storedSecret.startsWith('0x')) {
            setSecretFromStorage(storedSecret);
          }
        }
      } else {
        console.warn('⚠️ No secret found in storage for order:', order.orderId);
      }
    }
  }, [order?.orderId]);

  const revealSecret = async () => {
    if (!signer) {
      showStatus('Please connect your wallet', 'error');
      return;
    }

    let secretToReveal = secretInput.trim() || secretFromStorage;
    if (!secretToReveal) {
      showStatus('Please enter the secret or use the stored secret', 'error');
      return;
    }

    // Handle different secret formats and ensure proper conversion
    let normalizedSecret;
    try {
      if (secretToReveal.startsWith('0x') && secretToReveal.length === 66) {
        // Already in hex format
        normalizedSecret = secretToReveal;
      } else if (secretToReveal.startsWith('[') && secretToReveal.endsWith(']')) {
        // JSON array format from localStorage
        const secretArray = JSON.parse(secretToReveal);
        const secretBytes = new Uint8Array(secretArray);
        normalizedSecret = ethers.hexlify(secretBytes);
      } else if (Array.isArray(JSON.parse(secretToReveal || '[]'))) {
        // Handle case where it might be a JSON array
        const secretArray = JSON.parse(secretToReveal);
        const secretBytes = new Uint8Array(secretArray);
        normalizedSecret = ethers.hexlify(secretBytes);
      } else {
        throw new Error('Invalid secret format');
      }
    } catch (parseError) {
      console.error('❌ Secret parsing error:', parseError);
      showStatus('Invalid secret format. Please check your secret.', 'error');
      return;
    }

    // Verify that this secret would produce the correct hash
    try {
      const computedHash = ethers.keccak256(normalizedSecret);
      console.log('🔍 Secret verification:', {
        secret: normalizedSecret.substring(0, 20) + '...',
        computedHash,
        expectedHash: order.secretHash,
        matches: computedHash === order.secretHash
      });
      
      if (computedHash !== order.secretHash) {
        showStatus('Secret does not match the order hash. Please check your secret.', 'error');
        return;
      }
    } catch (hashError) {
      console.error('❌ Error validating secret hash:', hashError);
      showStatus('Error validating secret hash', 'error');
      return;
    }

    setIsRevealing(true);
    showStatus('Revealing secret to complete the swap...', 'info');

    try {
      const userAddress = await signer.getAddress();
      
      console.log('📤 Submitting secret revelation:', {
        orderId: order.orderId,
        secretLength: normalizedSecret.length,
        userAddress,
        endpoint: `${resolverEndpoint}/api/orders/${order.orderId}/reveal`
      });
      
      // Submit the normalized secret to resolver
      const response = await fetch(`${resolverEndpoint}/api/orders/${order.orderId}/reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: normalizedSecret,
          userAddress: userAddress
        })
      });

      console.log('📥 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response error:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Secret revelation result:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'Secret revelation failed');
      }

      showStatus('Secret revealed successfully! Cross-chain swap completed.', 'success');
      
      // Clear secret from localStorage after successful revelation
      localStorage.removeItem(`swap_secret_${order.orderId}`);
      console.log('🔐 Secret cleared from storage after successful revelation');
      
      onSecretRevealed(result);

    } catch (error: any) {
      console.error('❌ Secret revelation error:', error);
      showStatus(`Failed to reveal secret: ${error.message}`, 'error');
    } finally {
      setIsRevealing(false);
    }
  };

  const useStoredSecret = () => {
    if (secretFromStorage) {
      setSecretInput(secretFromStorage);
      showStatus('Secret filled from secure storage', 'info');
    } else {
      showStatus('No secret found in storage', 'warning');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showStatus('Copied to clipboard', 'info');
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
          {isCompleted ? '✓' : '5'}
        </div>
        <h2 className={`text-xl font-semibold ${
          isActive ? 'text-blue-600' : 
          isCompleted ? 'text-green-600' : 
          'text-gray-500'
        }`}>
          Reveal Secret to Complete Swap
        </h2>
      </div>

      {(isActive || isCompleted) && (
        <div className="pl-11">
          <div className="bg-gray-50 rounded-lg p-6">
            {order.resolverResponse && (
              <div className="mb-6">
                <h4 className="text-lg font-medium mb-3">📋 Deployment Status</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h5 className="font-medium text-gray-900 mb-2">Source Contract ({order._metadata.sourceChain})</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center">
                        <span className={`w-2 h-2 rounded-full mr-2 ${
                          order.resolverResponse.sourceContract?.funded ? 'bg-green-500' : 'bg-yellow-500'
                        }`}></span>
                        <span>Status: {order.resolverResponse.sourceContract?.funded ? 'Funded' : 'Deployed'}</span>
                      </div>
                      <div className="font-mono text-xs">
                        {order.resolverResponse.sourceContract?.contractAddress}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h5 className="font-medium text-gray-900 mb-2">Target Contract ({order._metadata.targetChain})</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center">
                        <span className={`w-2 h-2 rounded-full mr-2 ${
                          order.resolverResponse.targetContract?.funded ? 'bg-green-500' : 'bg-yellow-500'
                        }`}></span>
                        <span>Status: {order.resolverResponse.targetContract?.funded ? 'Funded' : 'Deployed'}</span>
                      </div>
                      <div className="font-mono text-xs">
                        {order.resolverResponse.targetContract?.contractAddress}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-blue-900 mb-2">🔐 Secret Revelation Process</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Enter the secret that was used to create the order</li>
                <li>The resolver will use this secret to withdraw from both escrow contracts</li>
                <li>Your tokens will be released on the destination chain</li>
                <li>The resolver's tokens will be released on the source chain</li>
                <li>The cross-chain swap will be completed</li>
              </ol>
            </div>

            {isActive && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secret (32 bytes hex)
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={secretInput}
                      onChange={(e) => setSecretInput(e.target.value)}
                      placeholder="0x1234567890abcdef..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                    {secretFromStorage && (
                      <button
                        onClick={useStoredSecret}
                        className="px-3 py-2 bg-green-100 hover:bg-green-200 border border-green-300 rounded-lg text-sm text-green-800"
                      >
                        Use Stored Secret
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    This must be the exact secret that was used to create the secretHash for this order
                  </p>
                  {order.secretHash && (
                    <p className="text-xs text-gray-400 mt-1">
                      Expected hash: <span className="font-mono">{order.secretHash}</span>
                    </p>
                  )}
                  {/* Debug info */}
                  {secretFromStorage && (
                    <p className="text-xs text-blue-600 mt-1">
                      Debug: Stored secret available ({secretFromStorage.length} chars)
                    </p>
                  )}
                </div>

                <button
                  onClick={revealSecret}
                  disabled={isRevealing || (!secretInput.trim() && !secretFromStorage)}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition duration-300 flex items-center justify-center"
                >
                  {isRevealing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Revealing Secret...
                    </>
                  ) : (
                    'Reveal Secret & Complete Swap'
                  )}
                </button>
                
                {/* Debug button for testing */}
                <button
                  onClick={() => {
                    console.log('🔍 Debug Info:', {
                      secretInput: secretInput,
                      secretFromStorage: secretFromStorage,
                      hasStoredSecret: !!secretFromStorage,
                      orderId: order?.orderId,
                      secretHash: order?.secretHash,
                      resolverEndpoint: resolverEndpoint
                    });
                  }}
                  className="w-full mt-2 bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded text-sm"
                >
                  Debug Info (Check Console)
                </button>
              </div>
            )}

            {isCompleted && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2">✅ Secret Revealed Successfully!</h4>
                <p className="text-green-700 text-sm">
                  Your secret has been revealed and the cross-chain swap has been completed. 
                  Both parties should now have received their respective tokens.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SecretRevelationStep;