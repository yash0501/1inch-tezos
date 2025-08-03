// SPDX-License-Identifier: MIT

pragma solidity 0.8.23;

import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "solidity-utils/contracts/libraries/SafeERC20.sol";
import { AddressLib, Address } from "solidity-utils/contracts/libraries/AddressLib.sol";

import { Timelocks, TimelocksLib } from "./libraries/TimelocksLib.sol";
import { ImmutablesLib } from "./libraries/ImmutablesLib.sol";

import { IEscrowSrc } from "./interfaces/IEscrowSrc.sol";
import { BaseEscrow } from "./BaseEscrow.sol";
import { Escrow } from "./Escrow.sol";

/**
 * @title Source Escrow contract for cross-chain atomic swap.
 * @notice Contract to initially lock funds and then unlock them with verification of the secret presented.
 * @dev Funds are locked in at the time of contract deployment. For this Limit Order Protocol
 * calls the `EscrowFactory.postInteraction` function.
 * To perform any action, the caller must provide the same Immutables values used to deploy the clone contract.
 * @custom:security-contact security@1inch.io
 */
contract EscrowSrc is Escrow, IEscrowSrc {
    using AddressLib for Address;
    using ImmutablesLib for Immutables;
    using SafeERC20 for IERC20;
    using TimelocksLib for Timelocks;

    constructor(uint32 rescueDelay, IERC20 accessToken) payable BaseEscrow(rescueDelay, accessToken) {}

    /**
     * @notice See {IBaseEscrow-withdraw}.
     * @dev The function works on the time interval highlighted with capital letters:
     * ---- contract deployed --/-- finality --/-- PRIVATE WITHDRAWAL --/-- PUBLIC WITHDRAWAL --/--
     * --/-- private cancellation --/-- public cancellation ----
     */
    function withdraw(bytes32 secret, Immutables calldata immutables)
        external
        onlyTaker(immutables)
        onlyAfter(immutables.timelocks.get(TimelocksLib.Stage.SrcWithdrawal))
        onlyBefore(immutables.timelocks.get(TimelocksLib.Stage.SrcCancellation))
    {
        _withdrawTo(secret, msg.sender, immutables);
    }

    /**
     * @notice See {IEscrowSrc-withdrawTo}.
     * @dev The function works on the time interval highlighted with capital letters:
     * ---- contract deployed --/-- finality --/-- PRIVATE WITHDRAWAL --/-- PUBLIC WITHDRAWAL --/--
     * --/-- private cancellation --/-- public cancellation ----
     */
    function withdrawTo(bytes32 secret, address target, Immutables calldata immutables)
        external
        onlyTaker(immutables)
        onlyAfter(immutables.timelocks.get(TimelocksLib.Stage.SrcWithdrawal))
        onlyBefore(immutables.timelocks.get(TimelocksLib.Stage.SrcCancellation))
    {
        _withdrawTo(secret, target, immutables);
    }

    /**
     * @notice See {IEscrowSrc-publicWithdraw}.
     * @dev The function works on the time interval highlighted with capital letters:
     * ---- contract deployed --/-- finality --/-- private withdrawal --/-- PUBLIC WITHDRAWAL --/--
     * --/-- private cancellation --/-- public cancellation ----
     */
    function publicWithdraw(bytes32 secret, Immutables calldata immutables)
        external
        onlyAccessTokenHolder()
        onlyAfter(immutables.timelocks.get(TimelocksLib.Stage.SrcPublicWithdrawal))
        onlyBefore(immutables.timelocks.get(TimelocksLib.Stage.SrcCancellation))
    {
        _withdrawTo(secret, immutables.taker.get(), immutables);
    }

    /**
     * @notice See {IBaseEscrow-cancel}.
     * @dev The function works on the time intervals highlighted with capital letters:
     * ---- contract deployed --/-- finality --/-- private withdrawal --/-- public withdrawal --/--
     * --/-- PRIVATE CANCELLATION --/-- PUBLIC CANCELLATION ----
     */
    function cancel(Immutables calldata immutables)
        external
        onlyTaker(immutables)
        onlyAfter(immutables.timelocks.get(TimelocksLib.Stage.SrcCancellation))
    {
        _cancel(immutables);
    }

    /**
     * @notice See {IEscrowSrc-publicCancel}.
     * @dev The function works on the time intervals highlighted with capital letters:
     * ---- contract deployed --/-- finality --/-- private withdrawal --/-- public withdrawal --/--
     * --/-- private cancellation --/-- PUBLIC CANCELLATION ----
     */
    function publicCancel(Immutables calldata immutables)
        external
        onlyAccessTokenHolder()
        onlyAfter(immutables.timelocks.get(TimelocksLib.Stage.SrcPublicCancellation))
    {
        _cancel(immutables);
    }

    /**
     * @dev Transfers ERC20 tokens to the target and native tokens to the caller.
     * @param secret The secret that unlocks the escrow.
     * @param target The address to transfer ERC20 tokens to.
     * @param immutables The immutable values used to deploy the clone contract.
     */
    function _withdrawTo(bytes32 secret, address target, Immutables calldata immutables)
    internal
    // onlyValidImmutables(immutables)
    onlyValidSecret(secret, immutables)
    {
        _uniTransfer(immutables.token.get(), target, immutables.amount);  // ✅ CORRECT
        _ethTransfer(msg.sender, immutables.safetyDeposit);
        emit EscrowWithdrawal(secret);
    }

    /**
     * @dev Transfers ERC20 tokens to the maker and native tokens to the caller.
     * @param immutables The immutable values used to deploy the clone contract.
     */
    function _cancel(Immutables calldata immutables) internal
    // onlyValidImmutables(immutables)
    {
        _uniTransfer(immutables.token.get(), immutables.maker.get(), immutables.amount);  // ✅ Use _uniTransfer
        _ethTransfer(msg.sender, immutables.safetyDeposit);
        emit EscrowCancelled();
    }

    /**
     * @dev Debug function to decode timelocks
     */
    function decodeTimelocks(Immutables calldata immutables) external view returns (
        uint256 srcWithdrawal,
        uint256 srcPublicWithdrawal, 
        uint256 srcCancellation,
        uint256 srcPublicCancellation,
        uint256 currentTimestamp
    ) {
        srcWithdrawal = immutables.timelocks.get(TimelocksLib.Stage.SrcWithdrawal);
        srcPublicWithdrawal = immutables.timelocks.get(TimelocksLib.Stage.SrcPublicWithdrawal);
        srcCancellation = immutables.timelocks.get(TimelocksLib.Stage.SrcCancellation);
        srcPublicCancellation = immutables.timelocks.get(TimelocksLib.Stage.SrcPublicCancellation);
        currentTimestamp = block.timestamp;
    }

    /**
     * @dev Debug function to validate each condition separately
     */
    function validateWithdrawConditions(bytes32 secret, Immutables calldata immutables) external view returns (
        bool isTaker,
        bool isValidSecret,
        bool isAfterWithdrawal,
        bool isBeforeCancellation,
        string memory errorMessage
    ) {
        // Check taker
        isTaker = (msg.sender == immutables.taker.get());
        
        // Check secret
        isValidSecret = (_keccakBytes32(secret) == immutables.hashlock);
        
        // Check timing
        uint256 withdrawalStart = immutables.timelocks.get(TimelocksLib.Stage.SrcWithdrawal);
        uint256 cancellationStart = immutables.timelocks.get(TimelocksLib.Stage.SrcCancellation);
        
        isAfterWithdrawal = (block.timestamp >= withdrawalStart);
        isBeforeCancellation = (block.timestamp < cancellationStart);
        
        // Generate error message
        if (!isTaker) {
            errorMessage = "Not the taker";
        } else if (!isValidSecret) {
            errorMessage = "Invalid secret";
        } else if (!isAfterWithdrawal) {
            errorMessage = "Too early - before withdrawal window";
        } else if (!isBeforeCancellation) {
            errorMessage = "Too late - after cancellation window";
        } else {
            errorMessage = "All conditions met";
        }
    }

    /**
     * @dev Debug function to validate public withdraw conditions
     */
    function validatePublicWithdrawConditions(bytes32 secret, Immutables calldata immutables) external view returns (
        bool isValidSecret,
        bool isAfterPublicWithdrawal,
        bool isBeforeCancellation,
        string memory errorMessage
    ) {
        // Check secret
        isValidSecret = (_keccakBytes32(secret) == immutables.hashlock);
        
        // Check timing
        uint256 publicWithdrawalStart = immutables.timelocks.get(TimelocksLib.Stage.SrcPublicWithdrawal);
        uint256 cancellationStart = immutables.timelocks.get(TimelocksLib.Stage.SrcCancellation);
        
        isAfterPublicWithdrawal = (block.timestamp >= publicWithdrawalStart);
        isBeforeCancellation = (block.timestamp < cancellationStart);
        
        // Generate error message
        if (!isValidSecret) {
            errorMessage = "Invalid secret";
        } else if (!isAfterPublicWithdrawal) {
            errorMessage = "Too early - before public withdrawal window";
        } else if (!isBeforeCancellation) {
            errorMessage = "Too late - after cancellation window";
        } else {
            errorMessage = "All conditions met";
        }
    }

    // function _keccakBytes32(bytes32 secret) private pure returns (bytes32 ret) {
    //     assembly ("memory-safe") {
    //         mstore(0, secret)
    //         ret := keccak256(0, 0x20)
    //     }
    // }
}
