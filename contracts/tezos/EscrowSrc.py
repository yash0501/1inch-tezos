import smartpy as sp

@sp.module
def main():
    # Type definitions for cross-chain escrow
    t_immutables: type = sp.record(
        order_hash=sp.bytes,
        hashlock=sp.bytes,
        maker=sp.address,
        taker=sp.address,
        token_address=sp.option[sp.address],
        amount=sp.mutez,
        safety_deposit=sp.mutez,
        # Timelocks matching Ethereum TimelocksLib structure
        withdrawal_start=sp.timestamp,
        public_withdrawal_start=sp.timestamp,
        cancellation_start=sp.timestamp,
        public_cancellation_start=sp.timestamp,
        rescue_start=sp.timestamp
    )

    # Source Escrow: Maker deposits, Taker withdraws with secret
    class EscrowSrc(sp.Contract):
        def __init__(self, immutables, access_token):
            self.data.immutables = immutables
            self.data.access_token = access_token
            self.data.withdrawn = False
            self.data.cancelled = False

        @sp.entrypoint
        def withdraw(self, secret):
            """Private withdrawal by taker - matches Ethereum EscrowSrc.withdraw"""
            # Validate caller is taker
            assert sp.sender == self.data.immutables.taker, "Only taker can call"
            
            # Validate timing - matches Ethereum time windows
            assert sp.now >= self.data.immutables.withdrawal_start, "Too early"
            assert sp.now < self.data.immutables.cancellation_start, "Too late"
            
            # Validate state
            assert not self.data.withdrawn, "Already withdrawn"
            assert not self.data.cancelled, "Already cancelled"
            
            # Validate secret - matches Ethereum hashlock validation
            assert sp.sha256(secret) == self.data.immutables.hashlock, "Invalid secret"
            
            # Transfer tokens to taker (same recipient as caller)
            match self.data.immutables.token_address:
                case None:
                    sp.send(sp.sender, self.data.immutables.amount)
                case Some(token_addr):
                    # FA2 token transfer - implement when needed
                    raise "FA2 tokens not yet implemented"
            
            # Send safety deposit to caller (incentive for proper behavior)
            sp.send(sp.sender, self.data.immutables.safety_deposit)
            
            self.data.withdrawn = True

        @sp.entrypoint
        def withdraw_to(self, secret, target):
            """Private withdrawal to specific target - matches Ethereum EscrowSrc.withdrawTo"""
            # Validate caller is taker
            assert sp.sender == self.data.immutables.taker, "Only taker can call"
            
            # Validate timing
            assert sp.now >= self.data.immutables.withdrawal_start, "Too early"
            assert sp.now < self.data.immutables.cancellation_start, "Too late"
            
            # Validate state
            assert not self.data.withdrawn, "Already withdrawn"
            assert not self.data.cancelled, "Already cancelled"
            
            # Validate secret
            assert sp.sha256(secret) == self.data.immutables.hashlock, "Invalid secret"
            
            # Transfer tokens to specified target
            match self.data.immutables.token_address:
                case None:
                    sp.send(target, self.data.immutables.amount)
                case Some(token_addr):
                    raise "FA2 tokens not yet implemented"
            
            # Send safety deposit to caller
            sp.send(sp.sender, self.data.immutables.safety_deposit)
            
            self.data.withdrawn = True

        @sp.entrypoint
        def public_withdraw(self, secret):
            """Public withdrawal with access token - matches Ethereum EscrowSrc.publicWithdraw"""
            # Validate timing for public withdrawal window
            assert sp.now >= self.data.immutables.public_withdrawal_start, "Too early"
            assert sp.now < self.data.immutables.cancellation_start, "Too late"
            
            # Validate state
            assert not self.data.withdrawn, "Already withdrawn"
            assert not self.data.cancelled, "Already cancelled"
            
            # Validate secret
            assert sp.sha256(secret) == self.data.immutables.hashlock, "Invalid secret"
            
            # Note: Access token validation would be implemented here
            # For now, anyone can call during public period
            
            # Transfer tokens to taker
            match self.data.immutables.token_address:
                case None:
                    sp.send(self.data.immutables.taker, self.data.immutables.amount)
                case Some(token_addr):
                    raise "FA2 tokens not yet implemented"
            
            # Send safety deposit to caller
            sp.send(sp.sender, self.data.immutables.safety_deposit)
            
            self.data.withdrawn = True

        @sp.entrypoint
        def cancel(self):
            """Private cancellation by taker - matches Ethereum EscrowSrc.cancel"""
            # Validate caller is taker
            assert sp.sender == self.data.immutables.taker, "Only taker can call"
            
            # Validate timing
            assert sp.now >= self.data.immutables.cancellation_start, "Too early"
            
            # Validate state
            assert not self.data.withdrawn, "Already withdrawn"
            assert not self.data.cancelled, "Already cancelled"
            
            # Return tokens to maker
            match self.data.immutables.token_address:
                case None:
                    sp.send(self.data.immutables.maker, self.data.immutables.amount)
                case Some(token_addr):
                    raise "FA2 tokens not yet implemented"
            
            # Send safety deposit to caller
            sp.send(sp.sender, self.data.immutables.safety_deposit)
            
            self.data.cancelled = True

        @sp.entrypoint
        def public_cancel(self):
            """Public cancellation with access token - matches Ethereum EscrowSrc.publicCancel"""
            # Validate timing
            assert sp.now >= self.data.immutables.public_cancellation_start, "Too early"
            
            # Validate state
            assert not self.data.withdrawn, "Already withdrawn"
            assert not self.data.cancelled, "Already cancelled"
            
            # Note: Access token validation would be implemented here
            
            # Return tokens to maker
            match self.data.immutables.token_address:
                case None:
                    sp.send(self.data.immutables.maker, self.data.immutables.amount)
                case Some(token_addr):
                    raise "FA2 tokens not yet implemented"
            
            # Send safety deposit to caller
            sp.send(sp.sender, self.data.immutables.safety_deposit)
            
            self.data.cancelled = True

        @sp.entrypoint
        def rescue_funds(self, params):
            """Rescue funds after rescue delay - matches Ethereum BaseEscrow.rescueFunds"""
            # Validate caller is taker
            assert sp.sender == self.data.immutables.taker, "Only taker can call"
            
            # Validate timing
            assert sp.now >= self.data.immutables.rescue_start, "Too early"
            
            # Rescue specified tokens
            match params.token_address:
                case None:
                    sp.send(sp.sender, params.amount)
                case Some(token_addr):
                    raise "FA2 rescue not yet implemented"

    # Destination Escrow: Taker deposits, Maker withdraws with secret
    class EscrowDst(sp.Contract):
        def __init__(self, immutables, access_token):
            self.data.immutables = immutables
            self.data.access_token = access_token
            self.data.withdrawn = False
            self.data.cancelled = False

        @sp.entrypoint
        def withdraw(self, secret):
            """Private withdrawal by taker - matches Ethereum EscrowDst.withdraw"""
            # Validate caller is taker
            assert sp.sender == self.data.immutables.taker, "Only taker can call"
            
            # Validate timing
            assert sp.now >= self.data.immutables.withdrawal_start, "Too early"
            assert sp.now < self.data.immutables.cancellation_start, "Too late"
            
            # Validate state
            assert not self.data.withdrawn, "Already withdrawn"
            assert not self.data.cancelled, "Already cancelled"
            
            # Validate secret
            assert sp.sha256(secret) == self.data.immutables.hashlock, "Invalid secret"
            
            # Transfer tokens to maker (destination receives from taker's deposit)
            match self.data.immutables.token_address:
                case None:
                    sp.send(self.data.immutables.maker, self.data.immutables.amount)
                case Some(token_addr):
                    raise "FA2 tokens not yet implemented"
            
            # Send safety deposit to caller
            sp.send(sp.sender, self.data.immutables.safety_deposit)
            
            self.data.withdrawn = True

        @sp.entrypoint
        def public_withdraw(self, secret):
            """Public withdrawal - matches Ethereum EscrowDst.publicWithdraw"""
            # Validate timing
            assert sp.now >= self.data.immutables.public_withdrawal_start, "Too early"
            assert sp.now < self.data.immutables.cancellation_start, "Too late"
            
            # Validate state
            assert not self.data.withdrawn, "Already withdrawn"
            assert not self.data.cancelled, "Already cancelled"
            
            # Validate secret
            assert sp.sha256(secret) == self.data.immutables.hashlock, "Invalid secret"
            
            # Transfer tokens to maker
            match self.data.immutables.token_address:
                case None:
                    sp.send(self.data.immutables.maker, self.data.immutables.amount)
                case Some(token_addr):
                    raise "FA2 tokens not yet implemented"
            
            # Send safety deposit to caller
            sp.send(sp.sender, self.data.immutables.safety_deposit)
            
            self.data.withdrawn = True

        @sp.entrypoint
        def cancel(self):
            """Cancellation returns funds to taker - matches Ethereum EscrowDst.cancel"""
            # Validate caller is taker
            assert sp.sender == self.data.immutables.taker, "Only taker can call"
            
            # Validate timing
            assert sp.now >= self.data.immutables.cancellation_start, "Too early"
            
            # Validate state
            assert not self.data.withdrawn, "Already withdrawn"
            assert not self.data.cancelled, "Already cancelled"
            
            # Return tokens to taker (who deposited them)
            match self.data.immutables.token_address:
                case None:
                    sp.send(self.data.immutables.taker, self.data.immutables.amount)
                case Some(token_addr):
                    raise "FA2 tokens not yet implemented"
            
            # Send safety deposit to caller
            sp.send(sp.sender, self.data.immutables.safety_deposit)
            
            self.data.cancelled = True

        @sp.entrypoint
        def rescue_funds(self, params):
            """Rescue funds after rescue delay"""
            # Validate caller is taker
            assert sp.sender == self.data.immutables.taker, "Only taker can call"
            
            # Validate timing
            assert sp.now >= self.data.immutables.rescue_start, "Too early"
            
            match params.token_address:
                case None:
                    sp.send(sp.sender, params.amount)
                case Some(token_addr):
                    raise "FA2 rescue not yet implemented"
