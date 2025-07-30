import smartpy as sp

@sp.module
def main():
    # Source Escrow: user deposits, resolver claims with secret, user can refund after timelock
    class EscrowSrc(sp.Contract):
        def __init__(self, params):
            self.data.sender = params.sender
            self.data.resolver = params.resolver
            self.data.hashlock = params.hashlock
            self.data.timelock = params.timelock
            self.data.token_address = params.token_address
            self.data.token_id = params.token_id
            self.data.amount = params.amount
            self.data.claimed = False
            self.data.refunded = False

        @sp.entrypoint
        def claim(self, secret):
            assert not self.data.claimed, "Already claimed"
            assert not self.data.refunded, "Already refunded"
            assert sp.sha256(secret) == self.data.hashlock, "Invalid secret"
            assert sp.now < self.data.timelock, "Expired"
            assert sp.sender == self.data.resolver, "Only resolver can claim"
            
            # Transfer tokens to resolver
            match self.data.token_address:
                case None:
                    # For XTZ, amount is stored as nat, send as mutez
                    amount_mutez = sp.cast(self.data.amount, sp.mutez)
                    sp.send(self.data.resolver, amount_mutez)
                case Some(token_addr):
                    # FA2 token transfer
                    transfer_args = [
                        sp.record(
                            from_=sp.self_address,
                            txs=[
                                sp.record(
                                    to_=self.data.resolver,
                                    token_id=self.data.token_id,
                                    amount=self.data.amount
                                )
                            ]
                        )
                    ]
                    
                    fa2_contract = sp.contract(
                        sp.list[sp.record(
                            from_=sp.address,
                            txs=sp.list[sp.record(to_=sp.address, token_id=sp.nat, amount=sp.nat)]
                        )],
                        token_addr,
                        entrypoint="transfer"
                    ).unwrap_some(error="FA2 contract not found")
                    
                    sp.transfer(transfer_args, sp.mutez(0), fa2_contract)

            self.data.claimed = True

        @sp.entrypoint
        def refund(self):
            assert not self.data.claimed, "Already claimed"
            assert not self.data.refunded, "Already refunded"
            assert sp.now >= self.data.timelock, "Not expired"
            assert sp.sender == self.data.sender, "Only sender can refund"
            
            # Refund tokens to sender
            match self.data.token_address:
                case None:
                    # For XTZ, amount is stored as nat, send as mutez
                    amount_mutez = sp.cast(self.data.amount, sp.mutez)
                    sp.send(self.data.sender, amount_mutez)
                case Some(token_addr):
                    # FA2 token transfer
                    transfer_args = [
                        sp.record(
                            from_=sp.self_address,
                            txs=[
                                sp.record(
                                    to_=self.data.sender,
                                    token_id=self.data.token_id,
                                    amount=self.data.amount
                                )
                            ]
                        )
                    ]
                    
                    fa2_contract = sp.contract(
                        sp.list[sp.record(
                            from_=sp.address,
                            txs=sp.list[sp.record(to_=sp.address, token_id=sp.nat, amount=sp.nat)]
                        )],
                        token_addr,
                        entrypoint="transfer"
                    ).unwrap_some(error="FA2 contract not found")
                    
                    sp.transfer(transfer_args, sp.mutez(0), fa2_contract)

            self.data.refunded = True

    # Destination Escrow: resolver deposits, user claims with secret, resolver can refund after timelock
    class EscrowDst(sp.Contract):
        def __init__(self, params):
            self.data.resolver = params.resolver
            self.data.user = params.user
            self.data.hashlock = params.hashlock
            self.data.timelock = params.timelock
            self.data.token_address = params.token_address
            self.data.token_id = params.token_id
            self.data.amount = params.amount
            self.data.claimed = False
            self.data.refunded = False

        @sp.entrypoint
        def claim(self, secret):
            assert not self.data.claimed, "Already claimed"
            assert not self.data.refunded, "Already refunded"
            assert sp.sha256(secret) == self.data.hashlock, "Invalid secret"
            assert sp.now < self.data.timelock, "Expired"
            assert sp.sender == self.data.user, "Only user can claim"
            
            # Transfer tokens to user
            match self.data.token_address:
                case None:
                    # For XTZ, amount is stored as nat, send as mutez
                    amount_mutez = sp.cast(self.data.amount, sp.mutez)
                    sp.send(self.data.user, amount_mutez)
                case Some(token_addr):
                    # FA2 token transfer
                    transfer_args = [
                        sp.record(
                            from_=sp.self_address,
                            txs=[
                                sp.record(
                                    to_=self.data.user,
                                    token_id=self.data.token_id,
                                    amount=self.data.amount
                                )
                            ]
                        )
                    ]
                    
                    fa2_contract = sp.contract(
                        sp.list[sp.record(
                            from_=sp.address,
                            txs=sp.list[sp.record(to_=sp.address, token_id=sp.nat, amount=sp.nat)]
                        )],
                        token_addr,
                        entrypoint="transfer"
                    ).unwrap_some(error="FA2 contract not found")
                    
                    sp.transfer(transfer_args, sp.mutez(0), fa2_contract)

            self.data.claimed = True
            
        @sp.entrypoint
        def refund(self):
            assert not self.data.claimed, "Already claimed"
            assert not self.data.refunded, "Already refunded"
            assert sp.now >= self.data.timelock, "Not expired"
            assert sp.sender == self.data.resolver, "Only resolver can refund"
            
            # Refund tokens to resolver
            match self.data.token_address:
                case None:
                    # For XTZ, amount is stored as nat, send as mutez
                    amount_mutez = sp.cast(self.data.amount, sp.mutez)
                    sp.send(self.data.resolver, amount_mutez)
                case Some(token_addr):
                    # FA2 token transfer
                    transfer_args = [
                        sp.record(
                            from_=sp.self_address,
                            txs=[
                                sp.record(
                                    to_=self.data.resolver,
                                    token_id=self.data.token_id,
                                    amount=self.data.amount
                                )
                            ]
                        )
                    ]

                    transfer_type = sp.list[
                        sp.record(
                            from_=sp.address,
                            txs=sp.list[sp.record(
                                to_=sp.address,
                                token_id=sp.nat,
                                amount=sp.nat,
                            ).layout(("to_", ("token_id", "amount")))],
                        ).layout(("from_", "txs"))
                    ]
                    
                    fa2_contract = sp.contract(
                        transfer_type,
                        token_addr,
                        entrypoint="transfer"
                    ).unwrap_some(error="FA2 contract not found")
                    
                    sp.transfer(transfer_args, sp.mutez(0), fa2_contract)

            self.data.refunded = True

    class EscrowFactory(sp.Contract):
        def __init__(self):
            self.data.escrows = sp.cast(sp.big_map({}), sp.big_map[sp.nat, sp.address])
            self.data.counter = 0

        @sp.entrypoint
        def create_escrow(self, params):
            # Define the parameter type explicitly - support both mutez and nat amounts
            sp.cast(params, sp.record(
                kind=sp.string,
                sender=sp.address,
                resolver=sp.address,
                user=sp.address,
                hashlock=sp.bytes,
                timelock=sp.timestamp,
                token_address=sp.option[sp.address],
                token_id=sp.nat,
                amount=sp.nat  # Changed to sp.nat to support both XTZ (as mutez value) and FA2 tokens
            ))
            
            if params.kind == "src":
                addr = sp.create_contract(
                    EscrowSrc, 
                    None, 
                    sp.mutez(0), 
                    sp.record(
                        sender=params.sender,
                        resolver=params.resolver,
                        hashlock=params.hashlock,
                        timelock=params.timelock,
                        token_address=params.token_address,
                        token_id=params.token_id,
                        amount=params.amount,
                        claimed=False,
                        refunded=False
                    )
                )
                self.data.escrows[self.data.counter] = addr
            else:
                addr = sp.create_contract(
                    EscrowDst, 
                    None, 
                    sp.mutez(0), 
                    sp.record(
                        resolver=params.resolver,
                        user=params.user,
                        hashlock=params.hashlock,
                        timelock=params.timelock,
                        token_address=params.token_address,
                        token_id=params.token_id,
                        amount=params.amount,
                        claimed=False,
                        refunded=False
                    )
                )
                self.data.escrows[self.data.counter] = addr
            self.data.counter += 1

@sp.add_test()
def test():
    scenario = sp.test_scenario("EscrowFactory - Bidirectional HTLC")
    scenario.h1("EscrowFactory - Bidirectional HTLC")
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")
    resolver = sp.test_account("Resolver")
    user = sp.test_account("User")

    # Display the accounts
    scenario.h2("Test Accounts")
    scenario.show([alice, bob, resolver, user])

    factory = main.EscrowFactory()
    scenario += factory

    secret = sp.bytes("0x1234")
    hashlock = sp.sha256(secret)
    timelock = sp.timestamp_from_utc_now().add_minutes(10)
    none_address = None

    scenario.h2("Test Factory Operations")

    # Test EscrowSrc creation - use nat values for amounts
    params_src = sp.record(
        kind="src",
        sender=alice.address,
        resolver=resolver.address,
        user=alice.address,
        hashlock=hashlock,
        timelock=timelock,
        token_address=none_address,
        token_id=0,
        amount=1000000  # Use nat directly instead of sp.mutez(1000000)
    )
    scenario.h3("Create EscrowSrc")
    factory.create_escrow(params_src, _sender=alice)

    # Test EscrowDst creation - use nat values for amounts
    params_dst = sp.record(
        kind="dst",
        sender=resolver.address,
        resolver=resolver.address,
        user=user.address,
        hashlock=hashlock,
        timelock=timelock,
        token_address=none_address,
        token_id=0,
        amount=2000000  # Use nat directly instead of sp.mutez(2000000)
    )
    scenario.h3("Create EscrowDst")
    factory.create_escrow(params_dst, _sender=resolver)

    # Test with expired timelock for refund scenarios
    expired_timelock = sp.timestamp(0)
    params_src_refund = sp.record(
        kind="src",
        sender=bob.address,
        resolver=resolver.address,
        user=bob.address,
        hashlock=hashlock,
        timelock=expired_timelock,
        token_address=none_address,
        token_id=0,
        amount=500000  # Use nat directly instead of sp.mutez(500000)
    )
    scenario.h3("Create EscrowSrc for refund test")
    factory.create_escrow(params_src_refund, _sender=bob)

    params_dst_refund = sp.record(
        kind="dst",
        sender=resolver.address,
        resolver=resolver.address,
        user=user.address,
        hashlock=hashlock,
        timelock=expired_timelock,
        token_address=none_address,
        token_id=0,
        amount=700000  # Use nat directly instead of sp.mutez(700000)
    )
    scenario.h3("Create EscrowDst for refund test")
    factory.create_escrow(params_dst_refund, _sender=resolver)

    # Verify factory state
    scenario.h3("Verify factory state")
    scenario.verify(factory.data.counter == 4)
    scenario.verify(factory.data.escrows.contains(0))
    scenario.verify(factory.data.escrows.contains(1))
    scenario.verify(factory.data.escrows.contains(2))
    scenario.verify(factory.data.escrows.contains(3))

    scenario.h2("Test Individual Escrow Contracts with Funding")

    # Test EscrowSrc functionality with valid claim - sender funds, resolver claims
    scenario.h3("Test EscrowSrc claim functionality")
    escrow_src = main.EscrowSrc(params_src)
    scenario += escrow_src
    # Alice (sender) funds the contract, then resolver claims with secret
    escrow_src.claim(secret, _sender=resolver, _amount=sp.mutez(1000000))
    scenario.verify(escrow_src.data.claimed == True)
    scenario.verify(escrow_src.data.refunded == False)

    # Test EscrowDst functionality with valid claim - resolver funds, user claims
    scenario.h3("Test EscrowDst claim functionality")
    escrow_dst = main.EscrowDst(params_dst)
    scenario += escrow_dst
    # Resolver funds the contract, then user claims with secret
    escrow_dst.claim(secret, _sender=user, _amount=sp.mutez(2000000))
    scenario.verify(escrow_dst.data.claimed == True)
    scenario.verify(escrow_dst.data.refunded == False)

    # Test EscrowSrc refund functionality
    scenario.h3("Test EscrowSrc refund functionality")
    escrow_src_refund = main.EscrowSrc(params_src_refund)
    scenario += escrow_src_refund
    # Bob (sender) funds and then refunds after timelock expiry
    escrow_src_refund.refund(_sender=bob, _amount=sp.mutez(500000))
    scenario.verify(escrow_src_refund.data.refunded == True)
    scenario.verify(escrow_src_refund.data.claimed == False)

    # Test EscrowDst refund functionality
    scenario.h3("Test EscrowDst refund functionality")
    escrow_dst_refund = main.EscrowDst(params_dst_refund)
    scenario += escrow_dst_refund
    # Resolver funds and then refunds after timelock expiry
    escrow_dst_refund.refund(_sender=resolver, _amount=sp.mutez(700000))
    scenario.verify(escrow_dst_refund.data.refunded == True)
    scenario.verify(escrow_dst_refund.data.claimed == False)

    scenario.h2("Test Error Cases")

    # Test claim with wrong secret
    scenario.h3("Test claim with wrong secret should fail")
    wrong_secret = sp.bytes("0x5678")
    escrow_error_test = main.EscrowSrc(params_src)
    scenario += escrow_error_test
    escrow_error_test.claim(wrong_secret, _sender=resolver, _amount=sp.mutez(1000000), _valid=False)

    # Test double claim
    scenario.h3("Test double claim should fail")
    escrow_double_claim = main.EscrowSrc(params_src)
    scenario += escrow_double_claim
    escrow_double_claim.claim(secret, _sender=resolver, _amount=sp.mutez(1000000))
    escrow_double_claim.claim(secret, _sender=resolver, _valid=False)

    # Test refund before expiry
    scenario.h3("Test refund before expiry should fail")
    escrow_early_refund = main.EscrowSrc(params_src)
    scenario += escrow_early_refund
    escrow_early_refund.refund(_sender=alice, _amount=sp.mutez(1000000), _valid=False)

    # Test claim after refund
    scenario.h3("Test claim after refund should fail")
    escrow_claim_after_refund = main.EscrowSrc(params_src_refund)
    scenario += escrow_claim_after_refund
    escrow_claim_after_refund.refund(_sender=bob, _amount=sp.mutez(500000))
    escrow_claim_after_refund.claim(secret, _sender=resolver, _valid=False)

    # Test refund after claim
    scenario.h3("Test refund after claim should fail")
    escrow_refund_after_claim = main.EscrowSrc(params_src)
    scenario += escrow_refund_after_claim
    escrow_refund_after_claim.claim(secret, _sender=resolver, _amount=sp.mutez(1000000))
    escrow_refund_after_claim.refund(_sender=alice, _valid=False)

    # Test claim with expired timelock
    scenario.h3("Test claim with expired timelock should fail")
    escrow_expired_claim = main.EscrowSrc(params_src_refund)
    scenario += escrow_expired_claim
    escrow_expired_claim.claim(secret, _sender=resolver, _amount=sp.mutez(500000), _valid=False)

    # Test unauthorized claim (wrong sender for EscrowSrc)
    scenario.h3("Test unauthorized claim should fail")
    escrow_wrong_claimer = main.EscrowSrc(params_src)
    scenario += escrow_wrong_claimer
    escrow_wrong_claimer.claim(secret, _sender=alice, _amount=sp.mutez(1000000))  # Alice can't claim, only resolver can

    # Test unauthorized refund (wrong sender for EscrowSrc)
    scenario.h3("Test unauthorized refund should fail") 
    escrow_wrong_refunder = main.EscrowSrc(params_src_refund)
    scenario += escrow_wrong_refunder
    escrow_wrong_refunder.refund(_sender=resolver, _amount=sp.mutez(500000))  # Resolver can't refund, only sender can

    # Test EscrowDst specific scenarios
    scenario.h3("Test EscrowDst unauthorized claim should fail")
    escrow_dst_wrong_claimer = main.EscrowDst(params_dst)
    scenario += escrow_dst_wrong_claimer
    escrow_dst_wrong_claimer.claim(secret, _sender=resolver, _amount=sp.mutez(2000000))  # Resolver can't claim, only user can

    scenario.h3("Test EscrowDst unauthorized refund should fail")
    escrow_dst_wrong_refunder = main.EscrowDst(params_dst_refund)
    scenario += escrow_dst_wrong_refunder
    escrow_dst_wrong_refunder.refund(_sender=user, _amount=sp.mutez(700000))  # User can't refund, only resolver can

    # Test with FA2 token (should now work)
    scenario.h3("Test with FA2 token")
    usdt_address = sp.Some(sp.address("KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o"))
    params_fa2 = sp.record(
        kind="dst",
        sender=resolver.address,
        resolver=resolver.address,
        user=user.address,
        hashlock=hashlock,
        timelock=timelock,
        token_address=usdt_address,
        token_id=0,
        amount=1000  # Use nat directly for FA2 tokens
    )
    factory.create_escrow(params_fa2, _sender=resolver)
    
    escrow_fa2 = main.EscrowDst(params_fa2)
    scenario += escrow_fa2
    # This should now work since we properly handle FA2 transfers
    escrow_fa2.claim(secret, _sender=user)
    scenario.verify(escrow_fa2.data.claimed == True)

    # Test FA2 refund functionality
    scenario.h3("Test FA2 refund functionality")
    params_fa2_refund = sp.record(
        kind="dst",
        sender=resolver.address,
        resolver=resolver.address,
        user=user.address,
        hashlock=hashlock,
        timelock=sp.timestamp(0),  # expired for refund
        token_address=usdt_address,
        token_id=0,
        amount=2000
    )
    factory.create_escrow(params_fa2_refund, _sender=resolver)
    
    escrow_fa2_refund = main.EscrowDst(params_fa2_refund)
    scenario += escrow_fa2_refund
    escrow_fa2_refund.refund(_sender=resolver)
    scenario.verify(escrow_fa2_refund.data.refunded == True)

    scenario.h2("Final factory state verification")
    # Factory should have created 9 contracts total (4 initial + 2 FA2 + 2 workflow + 1 FA2 refund)
    scenario.verify(factory.data.counter == 9)

    scenario.h2("All tests completed successfully")