'use client';

import { useState, useContext, createContext } from 'react';
import { ethers } from 'ethers';
import { TezosToolkit } from '@taquito/taquito';
import { BeaconWallet } from '@taquito/beacon-wallet';
import { NetworkType } from '@airgap/beacon-types';

// Add global type for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

// Context for BeaconWallet singleton
const BeaconWalletContext = createContext<BeaconWallet | null>(null);

export function BeaconWalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet] = useState(() => new BeaconWallet({ name: '1inch Cross-Chain Swap' }));
  return (
    <BeaconWalletContext.Provider value={wallet}>
      {children}
    </BeaconWalletContext.Provider>
  );
}

interface WalletConnectionProps {
  isActive: boolean;
  isCompleted: boolean;
  onWalletConnected: (
    provider: ethers.BrowserProvider | null,
    signer: ethers.JsonRpcSigner | null,
    address: string | null,
    tezosToolkit?: TezosToolkit,
    tezosAddress?: string
  ) => void;
  showStatus: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function WalletConnection({ 
  isActive, 
  isCompleted, 
  onWalletConnected, 
  showStatus 
}: WalletConnectionProps) {
  const [isConnectingEth, setIsConnectingEth] = useState(false);
  const [isConnectingTez, setIsConnectingTez] = useState(false);
  const [walletInfo, setWalletInfo] = useState<{
    ethAddress?: string;
    ethNetwork?: string;
    ethBalance?: string;
    tezosAddress?: string;
    tezosNetwork?: string;
  } | null>(null);

  const beaconWallet = useContext(BeaconWalletContext);

  // Ethereum/MetaMask connection
  const connectEthWallet = async () => {
    setIsConnectingEth(true);
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not found. Please install MetaMask.');
      }
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== 11155111) {
        throw new Error('Please switch to Sepolia testnet in MetaMask');
      }
      const balance = await provider.getBalance(address);
      setWalletInfo(prev => ({
        ...prev,
        ethAddress: address.substring(0, 6) + '...' + address.substring(38),
        ethNetwork: 'Sepolia Testnet',
        ethBalance: parseFloat(ethers.formatEther(balance)).toFixed(4)
      }));
      onWalletConnected(provider, signer, address, undefined, undefined);
      showStatus('Ethereum wallet connected!', 'success');
    } catch (error: any) {
      showStatus(`Failed to connect Ethereum wallet: ${error.message}`, 'error');
    } finally {
      setIsConnectingEth(false);
    }
  };

  // Tezos/Beacon connection
  const connectTezosWallet = async () => {
    setIsConnectingTez(true);
    try {
      if (!beaconWallet) throw new Error('BeaconWallet not initialized');
      const Tezos = new TezosToolkit('https://ghostnet.tezos.ecadinfra.com');
      Tezos.setWalletProvider(beaconWallet);
      await beaconWallet.requestPermissions({
        network: { type: NetworkType.GHOSTNET } // Changed from mainnet to ghostnet
      });
      const tezosAddress = await beaconWallet.getPKH();
      setWalletInfo(prev => ({
        ...prev,
        tezosAddress,
        tezosNetwork: 'Ghostnet' // Changed from 'Mainnet' to 'Ghostnet'
      }));
      onWalletConnected(null, null, null, Tezos, tezosAddress);
      showStatus('Tezos wallet connected!', 'success');
    } catch (error: any) {
      showStatus(`Failed to connect Tezos wallet: ${error.message}`, 'error');
    } finally {
      setIsConnectingTez(false);
    }
  };

  return (
    <div className={`step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
      <h3 className="text-xl font-semibold mb-4">Step 1: Connect Wallet</h3>
      <div className="flex flex-col md:flex-row gap-6">
        <div>
          <button
            onClick={connectEthWallet}
            disabled={isConnectingEth || !!walletInfo?.ethAddress}
            className="btn-primary"
          >
            {isConnectingEth ? 'Connecting...' : walletInfo?.ethAddress ? 'Connected ✓' : 'Connect MetaMask'}
          </button>
          {walletInfo?.ethAddress && (
            <div className="wallet-info mt-2">
              <p><strong>Ethereum:</strong> {walletInfo.ethAddress}</p>
              <p><strong>Network:</strong> {walletInfo.ethNetwork}</p>
              <p><strong>Balance:</strong> {walletInfo.ethBalance} ETH</p>
            </div>
          )}
        </div>
        <div>
          <button
            onClick={connectTezosWallet}
            disabled={isConnectingTez || !!walletInfo?.tezosAddress}
            className="btn-primary"
          >
            {isConnectingTez ? 'Connecting...' : walletInfo?.tezosAddress ? 'Connected ✓' : 'Connect Tezos Wallet'}
          </button>
          {walletInfo?.tezosAddress && (
            <div className="wallet-info mt-2">
              <p><strong>Tezos:</strong> {walletInfo.tezosAddress}</p>
              <p><strong>Network:</strong> {walletInfo.tezosNetwork}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
