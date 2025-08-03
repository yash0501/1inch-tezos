# Complete Deployment Guide

## Prerequisites

1. **Node.js ≥18** installed
2. **Ethereum testnet ETH** (Sepolia)
3. **Tezos testnet XTZ** (Ghostnet)
4. **RPC URLs** for both networks
5. **Private keys** for deployment accounts

## Setup

### 1. Install Dependencies

```bash
# Root project
npm install

# Frontend
cd swap-ui
npm install
cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your keys and RPC URLs

cp swap-ui/.env.local.example swap-ui/.env.local
# Edit with resolver endpoint
```

### 3. Compile Contracts

```bash
# Ethereum contracts
npm run compile

# Tezos contracts (manual compilation required)
# Use SmartPy CLI or online IDE to compile contracts/tezos/*.py
# Place compiled .tz files in contracts/tezos/compiled/
```

## Deployment Steps

### 1. Deploy Ethereum Contracts

```bash
npm run deploy:ethereum:sepolia
```

This deploys:
- EscrowSrc template
- EscrowDst template
- Optional factory contracts

### 2. Deploy Tezos Contracts (if needed)

```bash
npm run deploy:tezos:ghostnet
```

### 3. Start Services

```bash
# Start resolver and frontend
npm run dev

# Or start individually:
# Terminal 1: npm run resolver:start
# Terminal 2: npm run frontend:dev
```

### 4. Access Application

- Frontend: http://localhost:3000
- Resolver API: http://localhost:3001

## Testing

### Integration Test
```bash
npm run test:integration
```

### Manual Testing
1. Connect MetaMask (Sepolia)
2. Connect Tezos wallet (Ghostnet)
3. Create cross-chain order
4. Fund escrow contract
5. Monitor swap execution

## Architecture Overview

