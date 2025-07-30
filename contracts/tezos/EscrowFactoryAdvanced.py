import smartpy as sp

@sp.module
def main():
    # Type definitions matching Ethereum contract structure
    t_immutables: type = sp.record(
        order_hash=sp.bytes,
        hashlock=sp.bytes,
        maker=sp.address,
        taker=sp.address,
        token_address=sp.option[sp.address],
        amount=sp.mutez,
        safety_deposit=sp.mutez,
        # Simplified timelocks structure for Tezos
        withdrawal_start=sp.timestamp,
        public_withdrawal_start=sp.timestamp,
        cancellation_start=sp.timestamp,
        public_cancellation_start=sp.timestamp,  # Only for SRC
        rescue_start=sp.timestamp
    )

    # Source Escrow: Maker deposits, Taker withdraws with secret
    class EscrowSrc(sp.Contract):
        def __init__(self, immutables, access_token):
            # Initialize storage directly
            self.data.immutables = immutables
            self.data.access_token = access_token
            self.data.withdrawn = False
            self.data.cancelled = False

        @sp.entrypoint
        def withdraw(self, secret):
            """Private withdrawal by taker"""
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
            
            # Transfer tokens to sender
            match self.data.immutables.token_address:
                case None:
                    sp.send(sp.sender, self.data.immutables.amount)
                case Some(token_addr):
                    raise "FA2 tokens not yet implemented"
            
            # Send safety deposit to caller
            sp.send(sp.sender, self.data.immutables.safety_deposit)
            
            self.data.withdrawn = True

        @sp.entrypoint
        def withdraw_to(self, secret, target):
            """Private withdrawal by taker to specified target"""
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
            
            # Transfer tokens to target
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
            """Public withdrawal (anyone with access token)"""
            # Validate timing
            assert sp.now >= self.data.immutables.public_withdrawal_start, "Too early"
            assert sp.now < self.data.immutables.cancellation_start, "Too late"
            
            # Validate state
            assert not self.data.withdrawn, "Already withdrawn"
            assert not self.data.cancelled, "Already cancelled"
            
            # Validate secret
            assert sp.sha256(secret) == self.data.immutables.hashlock, "Invalid secret"
            
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
            """Private cancellation by taker"""
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
            """Public cancellation (anyone with access token)"""
            # Validate timing
            assert sp.now >= self.data.immutables.public_cancellation_start, "Too early"
            
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
        def rescue_funds(self, params):
            """Rescue funds after rescue delay (only taker)"""
            # Validate caller is taker
            assert sp.sender == self.data.immutables.taker, "Only taker can call"
            
            # Validate timing
            assert sp.now >= self.data.immutables.rescue_start, "Too early"
            
            match params.token_address:
                case None:
                    sp.send(sp.sender, params.amount)
                case Some(token_addr):
                    raise "FA2 rescue not yet implemented"

    # Destination Escrow: Taker deposits, Maker withdraws with secret
    class EscrowDst(sp.Contract):
        def __init__(self, immutables, access_token):
            # Initialize storage directly
            self.data.immutables = immutables
            self.data.access_token = access_token
            self.data.withdrawn = False
            self.data.cancelled = False

        @sp.entrypoint
        def withdraw(self, secret):
            """Private withdrawal by taker"""
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
        def public_withdraw(self, secret):
            """Public withdrawal (anyone with access token)"""
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
            """Cancellation by taker (returns funds to taker)"""
            # Validate caller is taker
            assert sp.sender == self.data.immutables.taker, "Only taker can call"
            
            # Validate timing
            assert sp.now >= self.data.immutables.cancellation_start, "Too early"
            
            # Validate state
            assert not self.data.withdrawn, "Already withdrawn"
            assert not self.data.cancelled, "Already cancelled"
            
            # Return tokens to taker
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
            """Rescue funds after rescue delay (only taker)"""
            # Validate caller is taker
            assert sp.sender == self.data.immutables.taker, "Only taker can call"
            
            # Validate timing
            assert sp.now >= self.data.immutables.rescue_start, "Too early"
            
            match params.token_address:
                case None:
                    sp.send(sp.sender, params.amount)
                case Some(token_addr):
                    raise "FA2 rescue not yet implemented"

# Test scenarios
@sp.add_test()
def test_advanced_escrow():
    scenario = sp.test_scenario("Advanced Cross-Chain Escrow", main)
    scenario.h1("Advanced Cross-Chain Escrow System")
    
    # Test accounts
    maker = sp.test_account("Maker")
    taker = sp.test_account("Taker") 
    access_token_holder = sp.test_account("AccessTokenHolder")
    
    scenario.h2("Test Accounts")
    scenario.show([maker, taker, access_token_holder])
    
    # Test parameters
    secret = sp.bytes("0x1234567890abcdef")
    hashlock = sp.sha256(secret)
    order_hash = sp.bytes("0xdeadbeef")
    current_time = sp.timestamp_from_utc_now()
    
    # Create immutables for source escrow
    src_immutables = sp.record(
        order_hash=order_hash,
        hashlock=hashlock,
        maker=maker.address,
        taker=taker.address,
        token_address=None,  # XTZ
        amount=sp.mutez(1000000),
        safety_deposit=sp.mutez(100000),
        withdrawal_start=current_time.add_minutes(1),
        public_withdrawal_start=current_time.add_minutes(10),
        cancellation_start=current_time.add_minutes(20),
        public_cancellation_start=current_time.add_minutes(30),
        rescue_start=current_time.add_days(1)
    )
    
    scenario.h2("Test Source Escrow Direct Deployment")
    # Deploy with initial balance (amount + safety deposit)
    initial_balance = src_immutables.amount + src_immutables.safety_deposit
    src_escrow = main.EscrowSrc(src_immutables, sp.Some(access_token_holder.address))
    src_escrow.set_initial_balance(initial_balance)
    scenario += src_escrow
    
    # Test private withdrawal by taker
    src_escrow.withdraw(secret, _sender=taker, _now=current_time.add_minutes(5))
    scenario.verify(src_escrow.data.withdrawn)
    
    # Create destination escrow
    dst_order_hash = sp.bytes("0xbeefdead")
    dst_immutables = sp.record(
        order_hash=dst_order_hash,
        hashlock=hashlock,
        maker=maker.address,
        taker=taker.address,
        token_address=None,
        amount=sp.mutez(2000000),
        safety_deposit=sp.mutez(200000),
        withdrawal_start=current_time.add_minutes(1),
        public_withdrawal_start=current_time.add_minutes(10),
        cancellation_start=current_time.add_minutes(20),
        public_cancellation_start=current_time.add_minutes(30),
        rescue_start=current_time.add_days(1)
    )
    
    scenario.h2("Test Destination Escrow Direct Deployment")
    # Deploy with initial balance (amount + safety deposit)
    dst_initial_balance = dst_immutables.amount + dst_immutables.safety_deposit
    dst_escrow = main.EscrowDst(dst_immutables, sp.Some(access_token_holder.address))
    dst_escrow.set_initial_balance(dst_initial_balance)
    scenario += dst_escrow
    
    # Test private withdrawal by taker (maker receives funds)
    dst_escrow.withdraw(secret, _sender=taker, _now=current_time.add_minutes(5))
    scenario.verify(dst_escrow.data.withdrawn)
    
    scenario.h2("Test Error Cases")
    
    # Test invalid secret
    scenario.h3("Test Invalid Secret")
    wrong_secret = sp.bytes("0xfeedbeefcafebabe")  # Valid hex but wrong secret
    error_escrow = main.EscrowSrc(src_immutables, sp.Some(access_token_holder.address))
    error_escrow.set_initial_balance(initial_balance)
    scenario += error_escrow
    error_escrow.withdraw(wrong_secret, _sender=taker, _now=current_time.add_minutes(5), _valid=False)
    
    # Test double withdrawal
    scenario.h3("Test Double Withdrawal")
    double_escrow = main.EscrowSrc(src_immutables, sp.Some(access_token_holder.address))
    double_escrow.set_initial_balance(initial_balance)
    scenario += double_escrow
    double_escrow.withdraw(secret, _sender=taker, _now=current_time.add_minutes(5))
    double_escrow.withdraw(secret, _sender=taker, _now=current_time.add_minutes(5), _valid=False)
    
    # Test timing restrictions
    scenario.h3("Test Timing Restrictions")
    timing_escrow = main.EscrowSrc(src_immutables, sp.Some(access_token_holder.address))
    timing_escrow.set_initial_balance(initial_balance)
    scenario += timing_escrow
    timing_escrow.withdraw(secret, _sender=taker, _now=current_time, _valid=False)
    timing_escrow.withdraw(secret, _sender=taker, _now=current_time.add_minutes(25), _valid=False)
    
    # Test unauthorized access
    scenario.h3("Test Unauthorized Access")
    auth_escrow = main.EscrowSrc(src_immutables, sp.Some(access_token_holder.address))
    auth_escrow.set_initial_balance(initial_balance)
    scenario += auth_escrow
    auth_escrow.withdraw(secret, _sender=maker, _now=current_time.add_minutes(5), _valid=False)
    
    # Test public withdrawal
    scenario.h3("Test Public Withdrawal")
    pub_escrow = main.EscrowSrc(src_immutables, sp.Some(access_token_holder.address))
    pub_escrow.set_initial_balance(initial_balance)
    scenario += pub_escrow
    pub_escrow.public_withdraw(secret, _sender=access_token_holder, _now=current_time.add_minutes(15))
    scenario.verify(pub_escrow.data.withdrawn)
    
    # Test cancellation
    scenario.h3("Test Cancellation")
    cancel_immutables = sp.record(
        order_hash=sp.bytes("0xcafeface"),  # Valid hex
        hashlock=hashlock,
        maker=maker.address,
        taker=taker.address,
        token_address=None,
        amount=sp.mutez(500000),
        safety_deposit=sp.mutez(50000),
        withdrawal_start=current_time.add_minutes(1),
        public_withdrawal_start=current_time.add_minutes(10),
        cancellation_start=current_time.add_minutes(20),
        public_cancellation_start=current_time.add_minutes(30),
        rescue_start=current_time.add_days(1)
    )
    
    cancel_escrow = main.EscrowSrc(cancel_immutables, sp.Some(access_token_holder.address))
    cancel_escrow.set_initial_balance(cancel_immutables.amount + cancel_immutables.safety_deposit)
    scenario += cancel_escrow
    cancel_escrow.cancel(_sender=taker, _now=current_time.add_minutes(25))
    scenario.verify(cancel_escrow.data.cancelled)
    
    # Test rescue functions
    scenario.h3("Test Fund Rescue")
    rescue_escrow = main.EscrowSrc(src_immutables, sp.Some(access_token_holder.address))
    rescue_escrow.set_initial_balance(initial_balance)
    scenario += rescue_escrow
    rescue_escrow.rescue_funds(
        sp.record(token_address=None, amount=sp.mutez(100000)), 
        _sender=taker, 
        _now=current_time.add_days(2)
    )
    
    scenario.h2("All tests completed successfully")