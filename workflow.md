<!-- ...existing content... -->

---

## Technical Workflow: 1inch Cross-Chain Swap (Ethereum ↔ Tezos)

### 1. Wallet Connection & UI Initialization
- Integrate MetaMask (Ethereum) and Temple Wallet (Tezos) connection logic.
- Display swap form: select source/target chain, tokens, amount, destination address, slippage.

### 2. Secret Generation & Order Preparation
- On client, generate a 32-byte random secret `s`.
- Compute `secretHash = keccak256(s)` (Ethereum) and `sp.sha256(s)` (Tezos).
- Prepare swap order object: includes secretHash, token addresses, amounts, expiry timestamps, destination address, and user signature.

### 3. User Approval & Order Submission
- Prompt user to approve ERC-20 spending for 1inch router (MetaMask).
- Submit signed order to backend/relayer for auction.

### 4. Resolver Selection & Escrow Deployment
- Relayer/auction service broadcasts order to resolvers.
- Winning resolver:
  - On Ethereum: Calls `fillContractOrderArgs(...)` to deploy HTLC (EscrowSrc) via EscrowFactory, locking user tokens and resolver's safety deposit.
  - On Tezos: Calls `createDstEscrow(...)` to deploy HTLC (EscrowDst), locking resolver's tokens and safety deposit.

### 5. Monitoring & Finality
- Relayer monitors both chains for escrow funding and block confirmations (≥10 Ethereum, ≥20 Tezos).
- UI updates user when both escrows are funded and finalized.

### 6. Secret Reveal & Claim
- User clicks "Reveal & Claim":
  - Signs and sends transaction to claim on Tezos HTLC (using Temple Wallet & Taquito), revealing `s` on-chain.
- Resolver (or anyone) observes `s` on Tezos, uses it to claim on Ethereum HTLC.

### 7. Settlement
- Tezos HTLC: Verifies `sp.sha256(s) == storedHash`, releases tokens to user.
- Ethereum HTLC: Verifies `keccak256(s) == storedHash`, releases tokens to resolver.

### 8. Refund Logic (Timeouts)
- If expiry reached and claim not executed:
  - User can refund from Ethereum HTLC after expiry.
  - Resolver can refund from Tezos HTLC after expiry.

### 9. Security & Edge Cases
- Ensure secrets are never leaked before claim.
- Handle partial fills (optional, stretch goal).
- Relayer monitors for stuck swaps and notifies users.

---

## Next Steps

### 1. ✅ Tezos HTLC Smart Contracts (SmartPy) - COMPLETED
- ✅ Implemented Tezos HTLC contracts using SmartPy
- ✅ Support for hashlock (using `sp.sha256(s)`)
- ✅ Support for timelock (expiry timestamp)
- ✅ Token escrow and release (XTZ native tokens)
- ✅ Refund and claim logic for bidirectional swaps
- ✅ EscrowSrc: user deposits, resolver claims
- ✅ EscrowDst: resolver deposits, user claims
- ✅ EscrowFactory: deploys both contract types

### 2. Next Phase: Enhanced Token Support & Resolver Implementation
- Extend contracts to support FA2 tokens (like USDT on Tezos)
- Build resolver logic for order matching and escrow funding
- Implement relayer service to monitor both chains
- Create frontend interface for wallet connections (MetaMask + Temple)
- Add cross-chain secret coordination and claim/refund flows

### 3. Integration & Testing
- Deploy contracts to Tezos testnet (Ghostnet)
- Test complete swap flows: Ethereum → Tezos and Tezos → Ethereum
- Verify hashlock compatibility between keccak256 and sha256
- Test timeout and refund scenarios

---

**Current Status:** Basic HTLC contracts for XTZ are implemented and tested. Ready to proceed with token support and resolver implementation.

<!-- ...existing content... -->
