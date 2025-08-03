// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IEscrow } from "./IEscrow.sol";

/**
 * @title Destination Escrow interface for cross-chain atomic swap.
 * @notice Interface implies withdrawing funds initially and then unlocking them with verification of the secret presented.
 * @custom:security-contact security@1inch.io
 */
interface IEscrowDst is IEscrow {
    /**
     * @notice Withdraws funds to maker
     * @dev Withdrawal can only be made during the withdrawal period and with secret with hash matches the hashlock.
     * @param secret The secret that unlocks the escrow.
     * @param immutables The immutables of the escrow contract.
     */
    function publicWithdraw(bytes32 secret, IEscrow.Immutables calldata immutables) external;

    // ✅ ADD: New helper function you added to EscrowDst contract
    /**
     * @notice Returns the balance of a specific token in the contract.
     * @param token The token address to check balance for. Zero address for ETH.
     * @return The token balance.
     */
    function getTokenBalance(address token) external view returns (uint256);
}