"use client";
import React, { useState, useEffect } from "react";

interface Order {
  id: string;
  status: string;
  sourceChain: string;
  targetChain: string;
  sourceToken: string;
  targetToken: string;
  sourceAmount: number;
  targetAmount: number;
  userAddress: string;
  destinationAddress: string;
  currentPrice: number;
  timeRemaining: number;
  auctionStartTime: number;
  minimumReturnAmount: number;
  createdAt: number;
}

export default function ResolverDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [resolverId, setResolverId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [processingOrders, setProcessingOrders] = useState<Set<string>>(new Set());
  const [deploymentStatus, setDeploymentStatus] = useState<Map<string, any>>(new Map());

  // Load resolver ID from localStorage or generate new one
  useEffect(() => {
    const savedResolverId = localStorage.getItem('resolverId');
    if (savedResolverId) {
      setResolverId(savedResolverId);
    } else {
      const newId = `resolver_${Math.random().toString(36).substr(2, 9)}`;
      setResolverId(newId);
      localStorage.setItem('resolverId', newId);
    }
  }, []);

  // Fetch orders from backend
  const fetchOrders = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/orders');
      const data = await response.json();
      
      // Filter for active orders only
      const activeOrders = data.orders.filter((order: Order) => order.status === 'active');
      setOrders(activeOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // Poll for new orders every 3 seconds
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleAcceptOrder = async (orderId: string) => {
    setProcessingOrders(prev => new Set(prev).add(orderId));
    
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const response = await fetch(`http://localhost:3001/api/orders/${orderId}/fill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resolverId,
          fillAmount: order.sourceAmount,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // Remove filled order from list
        setOrders(prev => prev.filter(o => o.id !== orderId));
        
        // Start polling for deployment status
        pollDeploymentStatus(orderId);
        
        alert(`Order accepted successfully! Deploying cross-chain contracts...`);
      } else {
        alert(`Failed to accept order: ${result.error}`);
      }
    } catch (error) {
      console.error('Error accepting order:', error);
      alert('Failed to accept order');
    } finally {
      setProcessingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const pollDeploymentStatus = (orderId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/orders/${orderId}/deployment`);
        const deployment = await response.json();
        
        setDeploymentStatus(prev => new Map(prev).set(orderId, deployment));
        
        if (deployment.status === 'contracts_deployed') {
          console.log(`🎉 Contracts deployed for order ${orderId}:`, deployment.deployment);
          clearInterval(interval);
        } else if (deployment.status === 'deployment_failed') {
          console.error(`❌ Contract deployment failed for order ${orderId}:`, deployment.deploymentError);
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Error polling deployment status:', error);
      }
    }, 3000);

    // Stop polling after 10 minutes
    setTimeout(() => clearInterval(interval), 600000);
  };

  const handleRejectOrder = (orderId: string) => {
    // Simply remove from local view (resolver chooses not to fill)
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const formatAmount = (amount: number) => {
    return (amount / 1e6).toFixed(6);
  };

  const formatTimeRemaining = (timeRemaining: number) => {
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const calculateProfitability = (order: Order) => {
    // Simple profitability calculation
    const profit = order.currentPrice - order.minimumReturnAmount;
    const profitPercentage = (profit / order.minimumReturnAmount) * 100;
    return profitPercentage;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Resolver Dashboard</h1>
          <p className="text-gray-700 text-lg font-medium">Monitor and execute cross-chain limit orders</p>
          <div className="mt-4 flex items-center gap-4">
            <span className="text-base font-bold text-gray-800">Resolver ID:</span>
            <code className="bg-gray-100 px-3 py-1 rounded text-base font-mono text-gray-900">{resolverId}</code>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-base text-green-700 font-semibold">Online</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-900">Active Orders</h3>
            <p className="text-4xl font-bold text-blue-600">{orders.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-900">Processing</h3>
            <p className="text-4xl font-bold text-yellow-600">{processingOrders.size}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-900">Avg Profit</h3>
            <p className="text-4xl font-bold text-green-600">
              {orders.length > 0 ? 
                (orders.reduce((acc, order) => acc + calculateProfitability(order), 0) / orders.length).toFixed(2) 
                : "0.00"
              }%
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-900">Total Volume</h3>
            <p className="text-4xl font-bold text-purple-600">
              ${orders.reduce((acc, order) => acc + parseFloat(formatAmount(order.sourceAmount)), 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Deployment Status Section */}
        {deploymentStatus.size > 0 && (
          <div className="bg-white rounded-lg shadow-sm mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Contract Deployments</h2>
            </div>
            <div className="p-6">
              {Array.from(deploymentStatus.entries()).map(([orderId, deployment]) => (
                <div key={orderId} className="mb-4 p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-gray-900">Order: {orderId.slice(0, 8)}...</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      deployment.status === 'contracts_deployed' ? 'bg-green-100 text-green-800' :
                      deployment.status === 'deployment_failed' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {deployment.status?.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  
                  {deployment.deployment && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      <div>
                        <h4 className="font-semibold text-gray-700">Source Contract ({deployment.sourceChain})</h4>
                        <p className="text-sm text-gray-600 font-mono">
                          {deployment.deployment.sourceContract?.contractAddress || 'Deploying...'}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-700">Target Contract ({deployment.targetChain})</h4>
                        <p className="text-sm text-gray-600 font-mono">
                          {deployment.deployment.targetContract?.contractAddress || 'Deploying...'}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {deployment.deploymentError && (
                    <div className="mt-3 p-3 bg-red-50 rounded text-red-700">
                      <strong>Error:</strong> {deployment.deploymentError}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Orders List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Available Orders</h2>
          </div>
          
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-700 text-lg font-medium">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-700 text-lg font-medium">No active orders available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-bold text-gray-800 uppercase tracking-wider">Order</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-gray-800 uppercase tracking-wider">Route</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-gray-800 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-gray-800 uppercase tracking-wider">Current Price</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-gray-800 uppercase tracking-wider">Profit</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-gray-800 uppercase tracking-wider">Time Left</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-gray-800 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-base font-bold text-gray-900">{order.id.slice(0, 8)}...</div>
                        <div className="text-sm text-gray-600 font-medium">
                          {new Date(order.createdAt).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-base font-bold text-gray-900 capitalize">
                            {order.sourceChain}
                          </span>
                          <span className="mx-2 text-gray-500">→</span>
                          <span className="text-base font-bold text-gray-900 capitalize">
                            {order.targetChain}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 font-medium">
                          {order.sourceToken} → {order.targetToken}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-base font-bold text-gray-900">
                          {formatAmount(order.sourceAmount)}
                        </div>
                        <div className="text-sm text-gray-600 font-medium">
                          → {formatAmount(order.targetAmount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-base font-bold text-gray-900">
                          {formatAmount(order.currentPrice)}
                        </div>
                        <div className="text-sm text-gray-600 font-medium">
                          Min: {formatAmount(order.minimumReturnAmount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 text-sm font-bold rounded-full ${
                          calculateProfitability(order) > 0 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {calculateProfitability(order).toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-base font-bold text-gray-900">
                          {formatTimeRemaining(order.timeRemaining)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptOrder(order.id)}
                            disabled={processingOrders.has(order.id)}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingOrders.has(order.id) ? 'Processing...' : 'Accept'}
                          </button>
                          <button
                            onClick={() => handleRejectOrder(order.id)}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-bold"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
