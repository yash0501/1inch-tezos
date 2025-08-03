# Real Contract Deployment Setup

## Prerequisites

1. **Ethereum Wallet**: A wallet with ETH on Sepolia testnet
2. **Tezos Wallet**: A wallet with XTZ on Ghostnet testnet  
3. **RPC Access**: Infura/Alchemy for Ethereum, public RPC for Tezos

## Environment Configuration

1. Copy the example environment file:
```bash
cp backend/.env.example backend/.env
```

2. Fill in your configuration:

### Ethereum Setup
- Get a private key from MetaMask or generate one
- Get Sepolia ETH from [Sepolia Faucet](https://sepoliafaucet.com/)
- Get an Infura/Alchemy API key
- Set `ETHEREUM_PRIVATE_KEY` and `ETHEREUM_RPC_URL`

### Tezos Setup  
- Generate a Tezos wallet using [Temple Wallet](https://templewallet.com/) or Taquito
- Get Ghostnet XTZ from [Tezos Faucet](https://faucet.ghostnet.teztnets.xyz/)
- Set `TEZOS_PRIVATE_KEY` and `TEZOS_RPC_URL`

### Resolver Configuration
- Set `RESOLVER_ADDRESS` to your resolver's Ethereum address
- This address will receive fees and act as the taker in cross-chain swaps

## Contract Compilation

Before real deployment, you need compiled contracts:

### Ethereum Contracts
```bash
cd backend
npm install
npx hardhat compile
```

### Tezos Contracts  
```bash
# Install SmartPy
pip install smartpy-cli

# Compile Tezos contracts
sp compile contracts/tezos/EscrowSrc.py contracts/tezos/compiled/
sp compile contracts/tezos/EscrowDst.py contracts/tezos/compiled/
```

## Testing Real Deployment

1. **Fund your wallets** with testnet tokens
2. **Start the resolver** with environment variables set
3. **Create an order** from the frontend
4. **Check logs** to see if real deployment succeeded

## Troubleshooting

- **"Ethereum wallet not configured"**: Check `ETHEREUM_PRIVATE_KEY` is set
- **"Tezos Source contract not found"**: Compile SmartPy contracts first
- **"Insufficient funds"**: Add more testnet ETH/XTZ to your wallets
- **"Invalid private key"**: Ensure private key is in hex format (0x...)

## Security Notes

- Never use mainnet private keys in development
- Use testnet tokens only
- Store private keys securely (consider using a .env file with restricted permissions)
- The example resolver address is for testing only
