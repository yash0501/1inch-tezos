## Technical Workflow: 1inch Cross-Chain Swap (Ethereum ↔ Tezos)

### 1. Wallet Connection & UI Initialization
- User connects MetaMask (Ethereum) and Temple/Beacon/Kukai (Tezos) wallets via the frontend UI.
- The UI displays a modern swap form: select source/target chain, tokens, amount, and destination address.

### 2. Secret Generation & Order Preparation
- On the client, a 32-byte random secret `s` is generated.
- Compute `secretHash = keccak256(s)` for Ethereum and `sp.sha256(s)` for Tezos (hashlock compatibility is handled).
- The swap order object is prepared, including secretHash, token addresses, amounts, expiry timestamps, destination address, and user signature (EIP-712).

### 3. User Approval & Order Submission
- If ERC-20 is selected, prompt user to approve token spending for the 1inch Limit Order Protocol.
- User signs the order and submits it to the backend resolver via the UI.

### 4. Resolver Selection & Escrow Deployment
- The backend resolver validates the order and broadcasts it to available resolvers (if auctioned).
- The selected resolver:
  - On Ethereum: Calls `fillOrderArgs(...)` to deploy the source HTLC (EscrowSrc) via EscrowFactory, locking user tokens and resolver's safety deposit.
  - On Tezos: Deploys the destination HTLC (EscrowDst) using SmartPy/Michelson, locking resolver's tokens and safety deposit.

### 5. Monitoring & Finality
- The backend and UI monitor both chains for escrow funding and block confirmations (e.g., ≥10 Ethereum, ≥20 Tezos).
- The UI updates the user in real time as each step is completed.

### 6. Secret Reveal & Claim
- Once both escrows are funded, the user clicks "Reveal & Claim" in the UI.
- The user signs and sends a transaction to claim on the Tezos HTLC (using Temple/Beacon/Kukai & Taquito), revealing `s` on-chain.
- The resolver (or anyone) observes `s` on Tezos and uses it to claim on the Ethereum HTLC.

### 7. Settlement
- Tezos HTLC: Verifies `sp.sha256(s) == storedHash`, releases tokens to the user.
- Ethereum HTLC: Verifies `keccak256(s) == storedHash`, releases tokens to the resolver.

### 8. Refund Logic (Timeouts)
- If the expiry is reached and the claim is not executed:
  - The user can refund from the Ethereum HTLC after expiry.
  - The resolver can refund from the Tezos HTLC after expiry.
- The UI and backend monitor for timeouts and notify users of refund eligibility.

### 9. Security & Edge Cases
- Secrets are never revealed before the claim step.
- All contract addresses and hashes are validated on-chain.
- Safety deposits and timelocks prevent griefing and ensure atomicity.
- The system is designed to support partial fills and multiple fills (advanced/optional).
- The backend and UI handle stuck swaps and notify users for manual intervention if needed.

---

## Timelocks: How the Protocol Protects Participants

Timelocks are a core part of the protocol, ensuring both security and fairness for all participants. Here’s how they work in the swap process:

### Finality Timelocks
- **Purpose:** Prevents chain reorganizations or attacks from affecting the swap. Ensures that escrows are only actionable after sufficient block confirmations.
- **How:** When an escrow is created on the source chain (A1), a finality lock period is set. During this period, withdrawals are prohibited and the secret is not revealed. The same applies when the destination escrow is created on chain B (B1).
- **Result:** No party can act until both escrows are confirmed and the finality lock expires.

### Hashlock (Exclusive Withdrawal Window)
- **After finality lock expires:** The relayer shares the secret with the resolver(s). The resolver who created the destination escrow has an exclusive window to complete the swap on both chains (A2, B2).
- **Incentive:** The resolver receives a safety deposit as a reward for executing the withdrawal, covering transaction costs and incentivizing timely completion.
- **If the resolver does not act:** After the exclusive window, any resolver can complete the withdrawal and claim the safety deposit (A3, B3).

### Cancellation Timelocks
- **If swap is not completed:** After the exclusive withdrawal and public withdrawal periods, cancellation timelocks allow participants to recover their funds.
- **Destination chain (B4):** The resolver can recover their assets if the secret was never revealed.
- **Source chain (A5):** The maker can recover their assets after the resolver’s exclusive cancellation period ends. Initially, only the resolver can cancel and return assets to the user (securing their safety deposit). If not, any resolver can cancel and claim the deposit.

### Summary Table

| Stage                | Who Can Act         | What Happens                                      |
|----------------------|---------------------|---------------------------------------------------|
| Finality Lock        | Nobody              | Wait for confirmations, no withdrawals possible   |
| Exclusive Withdraw   | Resolver            | Resolver can withdraw and claim safety deposit    |
| Public Withdraw      | Any resolver        | Any resolver can withdraw and claim deposit       |
| Cancellation (Dst)   | Resolver            | Resolver can refund their assets on destination   |
| Cancellation (Src)   | Maker/Any resolver  | Maker or any resolver can refund/cancel on source |

**Safety Deposit:**  
A safety deposit is required from the resolver when creating an escrow. Whoever executes the withdrawal receives this deposit, incentivizing timely and honest execution.

**Protection:**  
- If the second escrow isn’t created or the secret isn’t revealed, all parties can recover their funds after the appropriate timelock.
- Timelocks are carefully set so the resolver’s refund window is shorter than the maker’s, protecting both sides from malicious or unresponsive behavior.

---

## Next Steps

### 1. ✅ Tezos HTLC Smart Contracts (SmartPy) - COMPLETED
- Implemented Tezos HTLC contracts using SmartPy.
- Support for hashlock (using `sp.sha256(s)`).
- Support for timelock (expiry timestamp).
- Token escrow and release (XTZ native tokens).
- Refund and claim logic for bidirectional swaps.
- EscrowSrc: user deposits, resolver claims.
- EscrowDst: resolver deposits, user claims.

### 2. Enhanced Token Support & Resolver Implementation
- Extend contracts to support FA2 tokens on Tezos and ERC20 tokens on Ethereum.
- Build resolver logic for order matching, escrow funding, and monitoring.
- Implement relayer service to monitor both chains and coordinate swaps.
- Create a frontend interface for wallet connections (MetaMask + Temple/Beacon/Kukai).
- Add cross-chain secret coordination and claim/refund flows.

### 3. Integration & Testing
- Deploy contracts to Tezos testnet (Ghostnet) and Ethereum testnet (Sepolia).
- Test complete swap flows: Ethereum → Tezos and Tezos → Ethereum.
- Verify hashlock compatibility between keccak256 and sha256.
- Test timeout and refund scenarios.
- Expand test coverage and add integration tests.

---

**Current Status:**  
- Basic HTLC contracts for XTZ and ETH/ERC20 are implemented and tested.
- Off-chain order creation, EIP-712 signing, and backend resolver logic are in place.
- UI supports the full swap flow with real-time feedback.
- Ready to proceed with advanced token support, relayer improvements, and further integration testing.
