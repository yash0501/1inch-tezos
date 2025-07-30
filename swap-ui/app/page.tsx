"use client";
import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { initializeConnector } from "@web3-react/core";
import { MetaMask as MetaMaskConnector } from "@web3-react/metamask";

// Initialize MetaMask connector outside component
const [metaMask, metaMaskHooks] = initializeConnector(
  (actions) => new MetaMaskConnector({ actions })
);

function useTezosWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Simple initialization without Beacon SDK
  useEffect(() => {
    // Just mark as initialized after a short delay
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  const connect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setError(null);
    
    try {
      // Check if Temple Wallet is available
      if (typeof window === "undefined") {
        throw new Error("Window not available");
      }

      // Wait for Temple Wallet to be available
      let templeWallet = (window as any).templeWallet;
      let attempts = 0;
      const maxAttempts = 20;

      while (!templeWallet && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 250));
        templeWallet = (window as any).templeWallet;
        attempts++;
      }

      if (!templeWallet) {
        throw new Error("Temple Wallet not found. Please install Temple Wallet extension.");
      }

      console.log("Temple Wallet detected, attempting connection...");
      
      // Connect to Temple Wallet
      await templeWallet.connect("mainnet");
      const userAddress = await templeWallet.getPKH();
      
      if (!userAddress) {
        throw new Error("Failed to get wallet address");
      }

      setAddress(userAddress);
      console.log("Successfully connected to Temple Wallet:", userAddress);
      
    } catch (e: any) {
      console.error("Tezos wallet connection error:", e);
      
      if (e.message.includes("not found")) {
        setError("Temple Wallet not found. Please install Temple Wallet extension and refresh the page.");
      } else if (e.message.includes("rejected") || e.message.includes("denied")) {
        setError("Connection was rejected. Please try again and approve the connection.");
      } else {
        setError(e?.message || "Failed to connect to Temple Wallet. Please try again.");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      setAddress(null);
      setError(null);
      console.log("Disconnected from Temple Wallet");
    } catch (e) {
      console.warn("Disconnect error:", e);
    }
  };

  // Auto-reconnect check
  useEffect(() => {
    const checkConnection = async () => {
      if (!isInitialized) return;
      
      try {
        if (typeof window !== "undefined" && (window as any).templeWallet) {
          const templeWallet = (window as any).templeWallet;
          
          try {
            const userAddress = await templeWallet.getPKH();
            if (userAddress) {
              console.log("Auto-reconnected to Temple Wallet:", userAddress);
              setAddress(userAddress);
            }
          } catch (e) {
            console.log("No existing Temple Wallet connection found");
          }
        }
      } catch (e) {
        console.warn("Auto-reconnect failed:", e);
      }
    };

    if (isInitialized) {
      const timer = setTimeout(checkConnection, 1000);
      return () => clearTimeout(timer);
    }
  }, [isInitialized]);

  return { address, connect, disconnect, error, isConnecting, isInitialized };
}

function useEthereumWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

  // Auto-reconnect on page load
  useEffect(() => {
    const checkConnection = async () => {
      try {
        if (typeof window !== "undefined" && metaMask.provider) {
          // Check if MetaMask is already connected
          const accounts = await metaMask.provider.request({ method: 'eth_accounts' }) as string[];
          
          if (accounts && accounts.length > 0) {
            const provider = new ethers.BrowserProvider(metaMask.provider);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            
            setAddress(address);
            setProvider(provider);
            setIsActive(true);
            console.log("Auto-reconnected to MetaMask:", address);
          }
        }
      } catch (e) {
        console.warn("MetaMask auto-reconnect failed:", e);
      }
    };

    checkConnection();
  }, []);

  const connect = async () => {
    try {
      const result = await metaMask.activate();
      const provider = new ethers.BrowserProvider(metaMask.provider!);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      setAddress(address);
      setProvider(provider);
      setIsActive(true);
    } catch (e: any) {
      setError(e?.message || "MetaMask connection failed");
    }
  };

  const disconnect = async () => {
    if (metaMask.deactivate) {
      await metaMask.deactivate();
    } else if (metaMask.resetState) {
      await metaMask.resetState();
    }
    setAddress(null);
    setError(null);
    setIsActive(false);
  };

  return {
    address,
    connect,
    disconnect,
    provider,
    isActive,
    error,
  };
}

function SwapApp() {
  const [sourceChain, setSourceChain] = useState<"ethereum" | "tezos">("ethereum");
  const [targetChain, setTargetChain] = useState<"ethereum" | "tezos">("tezos");
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  
  const eth = useEthereumWallet();
  const tezos = useTezosWallet();

  // Auto-switch target chain when source chain changes
  useEffect(() => {
    setTargetChain(sourceChain === "ethereum" ? "tezos" : "ethereum");
  }, [sourceChain]);

  const handleSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that source and target chains are different
    if (sourceChain === targetChain) {
      alert("Source and target chains must be different");
      return;
    }

    // Validate wallet connection
    const sourceWallet = sourceChain === "ethereum" ? eth : tezos;
    if (!sourceWallet.address) {
      alert(`Please connect your ${sourceChain} wallet first`);
      return;
    }

    setIsSubmitting(true);
    setOrderStatus("Creating order...");

    try {
      // Create order data
      const orderData = {
        sourceChain,
        targetChain,
        sourceToken: token === "ETH" ? "0x0000000000000000000000000000000000000000" : token,
        targetToken: token === "XTZ" ? "tez" : token,
        sourceAmount: parseFloat(amount) * 1e6, // Convert to smallest unit
        targetAmount: parseFloat(amount) * 1e6 * 0.98, // Assume 2% slippage
        userAddress: sourceWallet.address,
        destinationAddress: destination,
        waitingPeriod: 30000, // 30 seconds
        auctionDuration: 600000, // 10 minutes
        minimumReturnRatio: 0.95 // 95% minimum
      };

      // Submit order to backend
      const response = await fetch('http://localhost:3001/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create order');
      }

      setOrderId(result.order.id);
      setOrderStatus("Order created successfully! Broadcasting to resolvers...");

      // Start polling for order status updates
      pollOrderStatus(result.order.id);

    } catch (error: any) {
      console.error('Error creating order:', error);
      setOrderStatus(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pollOrderStatus = (id: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/orders/${id}`);
        const order = await response.json();
        
        if (order.status === 'filled') {
          setOrderStatus(`Order filled by resolver ${order.filledBy} at price ${order.fillPrice}`);
          clearInterval(interval);
        } else if (order.status === 'expired') {
          setOrderStatus('Order expired - no resolver accepted the order');
          clearInterval(interval);
        } else {
          setOrderStatus(`Order status: ${order.status} - Current price: ${order.currentPrice}`);
        }
      } catch (error) {
        console.error('Error polling order status:', error);
      }
    }, 2000); // Poll every 2 seconds

    // Stop polling after 15 minutes
    setTimeout(() => clearInterval(interval), 900000);
  };

  return (
    <main className="max-w-xl mx-auto mt-12 p-6 bg-white rounded-xl shadow-lg border border-gray-100">
      <h1 className="text-4xl font-extrabold mb-3 text-center text-gray-900">1inch Cross-Chain Swap</h1>
      <p className="mb-8 text-center text-gray-700 text-lg font-medium">Swap tokens between Ethereum and Tezos easily.</p>
      
      {/* Source Chain Selection */}
      <div className="mb-8">
        <label className="block mb-3 font-bold text-lg text-gray-800">Source Chain</label>
        <div className="flex gap-4 justify-center">
          <button
            className={`px-6 py-3 rounded-lg font-bold text-lg transition-colors duration-150 ${
              sourceChain === "ethereum"
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-gray-200 text-gray-800 hover:bg-blue-100 border-2 border-gray-300"
            }`}
            onClick={() => setSourceChain("ethereum")}
          >
            Ethereum
          </button>
          <button
            className={`px-6 py-3 rounded-lg font-bold text-lg transition-colors duration-150 ${
              sourceChain === "tezos"
                ? "bg-purple-600 text-white shadow-lg"
                : "bg-gray-200 text-gray-800 hover:bg-purple-100 border-2 border-gray-300"
            }`}
            onClick={() => setSourceChain("tezos")}
          >
            Tezos
          </button>
        </div>
      </div>

      {/* Wallet Connection */}
      <div className="mb-8 flex justify-center">
        {sourceChain === "ethereum" ? (
          eth.address ? (
            <span className="inline-flex items-center gap-3 px-4 py-2 bg-blue-50 text-blue-800 rounded-full text-base font-semibold border-2 border-blue-200">
              <svg width="20" height="20" fill="currentColor" className="inline"><circle cx="10" cy="10" r="10" /></svg>
              {eth.address.slice(0, 6)}...{eth.address.slice(-4)}
              <button
                className="ml-2 px-3 py-1 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium"
                onClick={eth.disconnect}
                type="button"
              >
                Disconnect
              </button>
            </span>
          ) : (
            <div className="flex flex-col items-center">
              <button
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold text-lg shadow-lg hover:bg-blue-700 transition"
                onClick={eth.connect}
              >
                Connect MetaMask
              </button>
              {eth.error && (
                <span className="text-sm text-red-600 mt-2 font-medium">{eth.error}</span>
              )}
            </div>
          )
        ) : tezos.address ? (
          <span className="inline-flex items-center gap-3 px-4 py-2 bg-purple-50 text-purple-800 rounded-full text-base font-semibold border-2 border-purple-200">
            <svg width="20" height="20" fill="currentColor" className="inline"><circle cx="10" cy="10" r="10" /></svg>
            {tezos.address.slice(0, 6)}...{tezos.address.slice(-4)}
            <button
              className="ml-2 px-3 py-1 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium"
              onClick={tezos.disconnect}
              type="button"
            >
              Disconnect
            </button>
          </span>
        ) : (
          <div className="flex flex-col items-center">
            <button
              className={`px-6 py-3 bg-purple-600 text-white rounded-lg font-bold text-lg shadow-lg hover:bg-purple-700 transition ${
                tezos.isConnecting || !tezos.isInitialized ? "opacity-50 cursor-not-allowed" : ""
              }`}
              onClick={tezos.connect}
              disabled={tezos.isConnecting || !tezos.isInitialized}
            >
              {tezos.isConnecting ? "Connecting..." : !tezos.isInitialized ? "Initializing..." : "Connect Temple Wallet"}
            </button>
            {tezos.error && (
              <div className="text-sm text-red-600 mt-2 text-center max-w-sm font-medium">
                {tezos.error}
                {tezos.error.includes("not found") && (
                  <div className="mt-2">
                    <a 
                      href="https://templewallet.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      Install Temple Wallet
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Swap Form */}
      <form className="space-y-6" onSubmit={handleSwap}>
        <div>
          <label className="block mb-2 font-bold text-lg text-gray-800">Token</label>
          <input
            className="w-full border-2 border-gray-300 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-medium text-gray-900 placeholder-gray-500"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="Token address or symbol (e.g., ETH, XTZ)"
            required
          />
        </div>
        
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block mb-2 font-bold text-lg text-gray-800">Amount</label>
            <input
              className="w-full border-2 border-gray-300 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-medium text-gray-900 placeholder-gray-500"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              type="number"
              step="0.000001"
              min="0"
              placeholder="0.0"
              required
            />
          </div>
          
          <div className="flex-1">
            <label className="block mb-2 font-bold text-lg text-gray-800">Target Chain</label>
            <div className="w-full border-2 border-gray-300 px-4 py-3 rounded-lg bg-gray-100 text-gray-900 font-bold text-base">
              {targetChain === "ethereum" ? "Ethereum" : "Tezos"}
            </div>
          </div>
        </div>
        
        <div>
          <label className="block mb-2 font-bold text-lg text-gray-800">Destination Address</label>
          <input
            className="w-full border-2 border-gray-300 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base font-medium text-gray-900 placeholder-gray-500"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder={`Recipient address on ${targetChain}`}
            required
          />
        </div>
        
        <button
          type="submit"
          className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg font-bold text-xl shadow-lg hover:from-green-600 hover:to-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!token || !amount || !destination || (sourceChain === "ethereum" ? !eth.address : !tezos.address) || isSubmitting}
        >
          {isSubmitting ? "Creating Order..." : 
           (sourceChain === "ethereum" ? !eth.address : !tezos.address) 
            ? `Connect ${sourceChain === "ethereum" ? "MetaMask" : "Temple Wallet"} to Swap`
            : "Create Limit Order"
          }
        </button>
      </form>
      
      {/* Order Status */}
      {orderStatus && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <h3 className="font-bold text-blue-800 mb-2 text-lg">Order Status</h3>
          <p className="text-base text-blue-700 font-medium">{orderStatus}</p>
          {orderId && (
            <p className="text-sm text-blue-600 mt-2 font-medium">Order ID: {orderId}</p>
          )}
        </div>
      )}

      {/* Swap Details */}
      {token && amount && destination && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
          <h3 className="font-bold text-gray-800 mb-3 text-lg">Swap Summary</h3>
          <div className="text-base space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold text-gray-700">From:</span>
              <span className="font-bold text-gray-900">{sourceChain.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-700">To:</span>
              <span className="font-bold text-gray-900">{targetChain.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-700">Amount:</span>
              <span className="font-bold text-gray-900">{amount} {token}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-700">Destination:</span>
              <span className="font-bold text-gray-900 font-mono text-sm">{destination.slice(0, 12)}...{destination.slice(-10)}</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return <SwapApp />;
}