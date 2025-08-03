# 1inch Tezos Cross-Chain Atomic Swap Project

## Overview

This project implements a cross-chain atomic swap protocol between Ethereum and Tezos using HTLC-style escrows. It leverages the 1inch Limit Order Protocol (v4) on Ethereum and custom SmartPy contracts on Tezos. The system supports secure, trustless swaps of ETH/ERC20 ↔ XTZ/FA2 tokens, with off-chain order creation, EIP-712 signing, and on-chain contract deployment.

---

## Key Components

### 1. Ethereum Contracts

- **EscrowSrc.sol / EscrowDst.sol**: Source and destination escrow contracts for atomic swaps, supporting secret-based withdrawals, cancellations, and rescue mechanisms.
- **BaseEscrow.sol / Escrow.sol**: Abstract base contracts implementing core logic, access control, and validation.
- **Interfaces**: `IBaseEscrow`, `IEscrow`, `IEscrowSrc`, `IEscrowDst` define the contract APIs.
- **Libraries**: `ImmutablesLib`, `TimelocksLib`, `ProxyHashLib` for hashing, timelock encoding, and proxy deployment logic.

### 2. Tezos Contracts

- **EscrowSrc.py / EscrowDst.py**: SmartPy contracts implementing source and destination escrows for Tezos, matching the Ethereum logic.
- **No Factory**: Direct deployment of escrows for cross-chain swaps (no same-chain swaps, so factory contract removed).
- **Compiled Contracts**: SmartPy contracts are compiled to Michelson `.tz` and `.json` files for deployment.

### 3. Off-Chain Order Flow

- **CrossChainOrder Interface**: TypeScript/JavaScript structure for off-chain orders, including:
  - `orderId`, `maker`, `makerAsset`, `takerAsset`, `makingAmount`, `takingAmount`, `resolverBeneficiary`
  - `secretHash` (keccak256(secret)), `srcExpiry`, `dstExpiry`, `destinationAddress` (Tezos)
  - `signature` (EIP-712 signed by maker)
- **Order Creation**: Generates secret, computes hash, sets expiries, and signs the order.
- **Order Verification**: EIP-712 signature verification before deployment.

### 4. Deployment Scripts & Services

- **Hardhat Scripts**: For compiling and deploying Ethereum contracts to Sepolia/Goerli/Mainnet.
- **Taquito Scripts**: For deploying Tezos contracts to Ghostnet/Mainnet using `.tz` or `.json` Michelson files.
- **ContractDeploymentService.js**: Unified service for deploying escrows on both chains, loading compiled contracts, and handling testnet/mainnet configuration.
- **OrderService.js**: Handles order creation, signing, validation, and extraction of deployment parameters.

### 5. Directory Structure

```
contracts/
  ethereum/
    compiled/         # ABI + bytecode for Ethereum contracts
    interfaces/
    libraries/
    EscrowSrc.sol
    EscrowDst.sol
    BaseEscrow.sol
    Escrow.sol
  tezos/
    compiled/         # .tz and .json Michelson for Tezos contracts
    EscrowSrc.py
    EscrowDst.py

backend/
  src/
    contractDeployment.js
    orderService.js
    examples/
      createOrder.js

scripts/
  deploy-ethereum-contracts.js
  deploy-tezos-contracts.js

deployments/
  ethereum-sepolia.json
  tezos-ghostnet.json

.env
.env.example
hardhat.config.js
package.json
DEPLOYMENT.md
PROJECT_SUMMARY.md
```

---

## What Has Been Implemented

### ✅ Ethereum Side

- Written and compiled source/destination escrow contracts and interfaces.
- Implemented timelock, hashlock, and rescue logic.
- Hardhat scripts for deployment to Sepolia/Goerli/Mainnet.
- Deployment results saved in `deployments/ethereum-*.json`.

### ✅ Tezos Side

- Written SmartPy contracts for source/destination escrows.
- Removed factory contract (no same-chain swaps).
- Compiled contracts to `.tz` and `.json` Michelson.
- Taquito scripts for deployment to Ghostnet/Mainnet.
- Deployment results saved in `deployments/tezos-*.json`.

### ✅ Off-Chain Order Flow

- Defined `CrossChainOrder` interface with all required fields.
- Generates secret, computes hash, sets expiries, and signs with EIP-712.
- Validates and verifies order signatures.
- Example script for order creation and deployment (`createOrder.js`).

### ✅ Deployment Service

- Unified deployment service for both chains.
- Loads compiled contracts from `contracts/ethereum/compiled/` and `contracts/tezos/compiled/`.
- Handles testnet/mainnet configuration via `.env`.
- Deploys escrows directly (no factory) and funds contracts as needed.

### ✅ Configuration & Documentation

- `.env` and `.env.example` for all keys, RPC URLs, and contract addresses.
- `DEPLOYMENT.md` for step-by-step deployment instructions.
- `PROJECT_SUMMARY.md` (this file) for a complete overview.

---

## How to Use

1. **Compile Contracts**
   - Ethereum: `npm run compile`
   - Tezos: `npm run compile:tezos`

2. **Deploy Contracts**
   - Ethereum Sepolia: `npm run deploy:ethereum:sepolia`
   - Tezos Ghostnet: `npm run deploy:tezos:ghostnet`
   - Both: `npm run deploy:testnet`

3. **Create and Sign Orders**
   - Run: `npm run example:create-order`
   - This generates a signed order JSON with all required fields.

4. **Deploy Escrows for Orders**
   - The resolver/relayer uses the signed order and deployment service to deploy escrows on both chains.

5. **Test and Verify**
   - Ethereum: `npm run test:ethereum`
   - Tezos: `npm run test:tezos`

---

## Next Steps

- Integrate with 1inch Limit Order Protocol for on-chain order filling.
- Add UI for order creation and signing.
- Implement relayer/resolver logic for monitoring and deploying escrows.
- Add support for FA2 tokens on Tezos and ERC20 tokens on Ethereum.
- Expand test coverage and add integration tests.

---

## References

- [SmartPy Documentation](https://smartpy.io/docs/)
- [Taquito Documentation](https://tezostaquito.io/docs/)
- [Hardhat Documentation](https://hardhat.org/getting-started/)
- [1inch Limit Order Protocol](https://github.com/1inch/limit-order-protocol)

---

## Security Considerations

- **No Custodial Risk:** At no point does any party (including the resolver/relayer) have custody of both sides' funds. All assets are locked in on-chain escrows.
- **Atomicity:** The protocol ensures that either both escrows are settled (swap completes) or both are refunded (swap fails or is cancelled).
- **Timelocks:** Carefully designed time windows prevent griefing and ensure that funds are always recoverable.
- **Signature Verification:** All off-chain orders are signed using EIP-712 and verified before contract deployment.
- **Open Source:** All contracts and backend code are open for audit and community review.

---

## UI/UX

- **swap-ui:**  
  - Built with React, Next.js, and TailwindCSS for a modern, responsive experience.
  - Users are guided step-by-step: wallet connection, order creation, review, funding, secret revelation, and completion.
  - Real-time status updates and error handling.
  - Supports MetaMask for Ethereum and Temple/Beacon/Kukai for Tezos.
  - Progress bar and clear feedback at each stage.

---

## Extensibility

- **Multi-Chain Ready:**  
  - The architecture is designed to support additional EVM and non-EVM chains in the future.
  - Modular contract and backend structure allows for easy integration of new assets and networks.

- **Token Support:**  
  - ETH, ERC-20, XTZ, and (planned) FA2 tokens.
  - Adding new token standards is straightforward due to modular contract design.

---

## Contribution

- Contributions are welcome! Please open issues or pull requests for improvements, bug fixes, or new features.
- For questions or discussions, open an issue or reach out via the project's GitHub.

---

## License

This project is licensed under the MIT License.

---

## Acknowledgements

- 1inch Network for the Limit Order Protocol and inspiration.
- OpenZeppelin for secure contract libraries.
- SmartPy and Taquito teams for Tezos tooling.
- The Ethereum and Tezos communities for documentation and support.
