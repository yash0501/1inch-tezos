# Tezra

**Category:** DeFi  
**Emoji:** 😎  
**Demo:** [https://hackathon.project.io](https://hackathon.project.io)

---

## Short Description

Tezra: The first trustless portal between Ethereum and Tezos ecosystems 🌉

---

## Overview

Tezra is a cross-chain DeFi protocol that enables trustless, atomic swaps between Ethereum and Tezos. Users can securely exchange assets across both ecosystems without relying on centralized bridges or custodians. Tezra leverages advanced smart contracts and a resolver mechanism to ensure swaps are either completed on both chains or safely refunded, eliminating counterparty risk.

---

## Table of Contents

- [Key Features](#key-features)
- [Architecture](#architecture)
- [How Tezra Works (Step-by-Step)](#how-tezra-works-step-by-step)
- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Setup & Installation](#setup--installation)
- [Building & Running Locally](#building--running-locally)
- [Testing](#testing)
- [Notable Integrations](#notable-integrations)
- [Why we are applying for the 1inch prize](#why-we-are-applying-for-the-1inch-prize)
- [Demo](#demo)

---

## Key Features

- **Atomic Swaps:** Uses hash time-locked contracts (HTLCs) and a resolver for true cross-chain atomicity.
- **Ethereum ↔ Tezos:** Swap tokens between Ethereum (including ERC-20s) and Tezos (XTZ), supporting both native and token assets.
- **Non-Custodial:** Users always control their funds; no third party ever holds user assets.
- **Open Source & Auditable:** All smart contracts and backend code are public for maximum transparency.
- **Modern UI:** Inspired by leading DeFi protocols, with a smooth, intuitive user experience.
- **Robust Security:** Safety deposits, time locks, and on-chain validation protect against malicious actors and failures.
- **Extensible:** Designed for future multi-chain support.

---

## Architecture

Tezra is a full-stack protocol with the following components:

- **Smart Contracts:**  
  - *Ethereum (Solidity):* Escrow contracts (`EscrowSrc`, `EscrowDst`) using OpenZeppelin, 1inch Limit Order Protocol, and HTLCs.
  - *Tezos (SmartPy/Michelson):* Escrow contract in SmartPy, mirroring Ethereum logic.
- **Backend Resolver:**  
  - *Node.js/TypeScript:* Orchestrates swaps, deploys escrows, monitors funding, and triggers secret revelation.
- **Frontend:**  
  - *React + Next.js + TailwindCSS:* Modern SPA for user interaction, wallet connection, and swap flow.
- **SDKs & Libraries:**  
  - *@1inch/cross-chain-sdk, Ethers.js, Taquito:* For blockchain interactions and cross-chain logic.

---

## How Tezra Works (Step-by-Step)

### 1. **User Connects Wallets**
- The user connects their Ethereum wallet (MetaMask) and Tezos wallet (Temple/Beacon/Kukai) via the frontend.
- The frontend verifies connections and displays balances.

### 2. **Order Creation**
- The user specifies the asset, amount, and destination address for the swap.
- The frontend generates a random secret and computes its hash (hashlock).
- An order object is created and signed by the user using EIP-712 (on Ethereum).

### 3. **Order Submission**
- The signed order is sent to the backend resolver.
- The resolver validates the order and deploys the source escrow contract on Ethereum using the 1inch Limit Order Protocol.
- The resolver also prepares the destination escrow contract for Tezos.

### 4. **Escrow Deployment**
- On Ethereum, the source escrow contract is deployed and funded by the user (locking their tokens).
- On Tezos, the resolver deploys and funds the destination escrow contract (locking the resolver's tokens).

### 5. **Funding Verification**
- The backend monitors both chains to ensure both escrows are funded.
- The frontend displays real-time status updates to the user.

### 6. **Secret Revelation**
- Once both escrows are funded, the user reveals the secret via the frontend.
- The secret is submitted to both contracts:
  - On Tezos, the user withdraws their tokens from the destination escrow using the secret.
  - On Ethereum, the resolver uses the revealed secret to withdraw the user's tokens from the source escrow.

### 7. **Settlement or Refund**
- If the swap completes successfully, both parties receive their assets.
- If any party fails to fund or reveal the secret in time, the contracts allow for refunds after a timeout, ensuring no funds are lost.

---

## Project Structure

```
backend/
  src/
contracts/
  ethereum/
    compiled/
    interfaces/
    libraries/
    BaseEscrow.sol
    Escrow.sol
    EscrowDst.sol
    EscrowSrc.sol
  solidity-utils/
    contracts/
      interfaces/
      libraries/
      mixins/
      mocks/
      tests/
  tezos/
    compiled/
    EscrowFactory_v2.py
    EscrowFactory.py
    EscrowFactoryAdvanced.py
    EscrowSrc.py
  package.json
swap-ui/
  app/
    components/
    resolver/
    globals.css
    layout.tsx
    page.tsx
  public/
.env.example
```