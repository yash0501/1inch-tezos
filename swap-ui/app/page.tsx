'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { TezosToolkit } from '@taquito/taquito';
import WalletConnection from './components/WalletConnection';
import OrderForm from './components/OrderForm';
import OrderReview from './components/OrderReview';
import FundingStep from './components/FundingStep';
import CompletionStep from './components/CompletionStep';
import StatusMessage from './components/StatusMessage';
import ProgressBar from './components/ProgressBar';
import SecretRevelationStep from './components/SecretRevelationStep';
import ContractStatusChecker from './components/ContractStatusChecker';

interface StatusMessage {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface CrossChainOrder {
  orderId: string;
  maker: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: string;
  takingAmount: string;
  resolverBeneficiary: string;
  secretHash: string;
  srcExpiry: number;
  dstExpiry: number;
  destinationAddress: string;
  signature: string;
  _metadata: {
    secret: string;
    createdAt: string;
    sourceChain: string;
    targetChain: string;
    status: string;
  };
  resolverResponse?: any;
  completed?: boolean;
  completedAt?: string;
  secretRevealed?: boolean;
  completionResult?: any;
}

export default function CrossChainSwap() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [userAddress, setUserAddress] = useState<string>('');
  const [tezosToolkit, setTezosToolkit] = useState<TezosToolkit | null>(null);
  const [tezosAddress, setTezosAddress] = useState<string>('');
  const [currentOrder, setCurrentOrder] = useState<CrossChainOrder | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const resolverEndpoint = process.env.NEXT_PUBLIC_RESOLVER_ENDPOINT || 'http://localhost:3001';

  const showStatus = (message: string, type: StatusMessage['type']) => {
    const newStatus: StatusMessage = { message, type };
    setStatusMessages(prev => {
      // Remove existing messages of the same type
      const filtered = prev.filter(msg => msg.type !== type);
      return [...filtered, newStatus];
    });

    // Auto-remove info messages after 5 seconds
    if (type === 'info') {
      setTimeout(() => {
        setStatusMessages(prev => prev.filter(msg => msg !== newStatus));
      }, 5000);
    }
  };

  const activateStep = (stepNumber: number) => {
    setCurrentStep(stepNumber);
  };

  const completeStep = (stepNumber: number) => {
    activateStep(stepNumber + 1);
  };

  const handleWalletConnected = (
    newProvider: ethers.BrowserProvider | null, 
    newSigner: ethers.JsonRpcSigner | null, 
    address: string | null,
    newTezosToolkit?: TezosToolkit,
    newTezosAddress?: string
  ) => {
    if (newProvider && newSigner && address) {
      setProvider(newProvider);
      setSigner(newSigner);
      setUserAddress(address);
    }
    if (newTezosToolkit && newTezosAddress) {
      setTezosToolkit(newTezosToolkit);
      setTezosAddress(newTezosAddress);
    }
    
    // Check if we have at least one wallet connected to proceed
    if ((provider || newProvider) || (tezosToolkit || newTezosToolkit)) {
      showStatus('Wallet connected successfully!', 'success');
      completeStep(1);
    }
  };

  const handleOrderCreated = (order: CrossChainOrder) => {
    setCurrentOrder(order);
    showStatus('Order created and signed successfully!', 'success');
    completeStep(2);
  };

  const handleOrderSubmitted = (resolverResponse: any) => {
    if (currentOrder) {
      setCurrentOrder({
        ...currentOrder,
        resolverResponse
      });
    }
    showStatus('Order accepted by resolver! Contracts deployed.', 'success');
    completeStep(3);
  };

  const handleFundingComplete = (result: any) => {
    showStatus(`Funding completed successfully! Type: ${result.type}`, 'success');
    if (result.txHash) {
      showStatus(`Transaction: ${result.txHash}`, 'info');
    }
    
    // Automatically progress to secret revelation step
    console.log('🔄 Funding complete, advancing to secret revelation step');
    completeStep(4);
  };

  const handleSecretRevealed = (result: any) => {
    showStatus('Cross-chain swap completed successfully!', 'success');
    completeStep(5);
    
    // Update order with completion data
    if (currentOrder) {
      setCurrentOrder({
        ...currentOrder,
        completed: true,
        completedAt: new Date().toISOString(),
        secretRevealed: true,
        completionResult: result
      });
    }

    // Clear any remaining secrets from localStorage
    if (currentOrder?.orderId) {
      localStorage.removeItem(`swap_secret_${currentOrder.orderId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-700 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
            🌉 Cross-Chain Atomic Swap
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Swap tokens between Ethereum and Tezos securely with atomic guarantees
          </p>

          <ProgressBar currentStep={currentStep} totalSteps={5} />

          {/* Status Messages */}
          <div className="mb-6">
            {statusMessages.map((status, index) => (
              <StatusMessage 
                key={index} 
                message={status.message} 
                type={status.type} 
              />
            ))}
          </div>

          {/* Step 1: Wallet Connection */}
          <WalletConnection
            isActive={currentStep === 1}
            isCompleted={currentStep > 1}
            onWalletConnected={handleWalletConnected}
            showStatus={showStatus}
          />

          {/* Step 2: Order Creation */}
          {currentStep >= 2 && (
            <OrderForm
              isActive={currentStep === 2}
              isCompleted={currentStep > 2}
              userAddress={userAddress}
              tezosAddress={tezosAddress}
              signer={signer}
              onOrderCreated={handleOrderCreated}
              showStatus={showStatus}
            />
          )}

          {/* Step 3: Order Review */}
          {currentStep >= 3 && currentOrder && (
            <OrderReview
              isActive={currentStep === 3}
              isCompleted={currentStep > 3}
              order={currentOrder}
              signer={signer}
              resolverEndpoint={resolverEndpoint}
              onOrderSubmitted={handleOrderSubmitted}
              showStatus={showStatus}
            />
          )}

          {/* Step 4: Contract Deployment & Funding */}
          {currentStep >= 4 && currentOrder && (
            <FundingStep
              isActive={currentStep === 4}
              isCompleted={currentStep > 4}
              order={currentOrder}
              signer={signer}
              resolverEndpoint={resolverEndpoint}
              onFundingComplete={handleFundingComplete}
              showStatus={showStatus}
            />
          )}

          {/* Step 5: Secret Revelation */}
          {currentStep >= 5 && currentOrder && (
            <SecretRevelationStep
              isActive={currentStep === 5}
              isCompleted={currentStep > 5}
              order={currentOrder}
              signer={signer}
              resolverEndpoint={resolverEndpoint}
              onSecretRevealed={handleSecretRevealed}
              showStatus={showStatus}
            />
          )}

          {/* Completion Step */}
          {currentStep > 5 && currentOrder && (
            <CompletionStep
              order={currentOrder}
              isActive={currentStep === 6}
            />
          )}
        </div>
      </div>
    </div>
  );
}