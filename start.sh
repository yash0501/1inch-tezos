#!/bin/bash

echo "🚀 Starting 1inch Cross-Chain Swap Application..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please copy .env.example and configure it."
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if swap-ui dependencies exist
if [ ! -d swap-ui/node_modules ]; then
    echo "📦 Installing frontend dependencies..."
    cd swap-ui && npm install && cd ..
fi

# Start the application
echo "🔧 Starting resolver service and frontend..."
npm run dev
