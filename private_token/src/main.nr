use aztec::macros::aztec;

#[aztec]
pub contract PrivateToken {
    use aztec::{
        macros::{functions::{authorize_once, external}, storage::storage},
        messages::delivery::MessageDelivery,
        protocol::address::AztecAddress,
        state_vars::Owned,
    };
    use balance_set::BalanceSet;

    #[storage]
    struct Storage<Context> {
        balances: Owned<BalanceSet<Context>, Context>,
    }

    /// Faucet is test-only: it mints a private balance for TXE integration cases.
    #[external("private")]
    fn faucet(amount: u128) {
        let owner = self.context.maybe_msg_sender().expect(
            f"faucet must be called through an account contract",
        );
        assert(amount > 0, "amount must be positive");
        self.storage.balances.at(owner).add(amount).deliver(MessageDelivery::onchain_unconstrained());
    }

    /// Standard authwit-gated private pull used by the auction escrow.
    #[authorize_once("from", "authwit_nonce")]
    #[external("private")]
    fn transfer_in_private(
        from: AztecAddress,
        to: AztecAddress,
        amount: u128,
        authwit_nonce: Field,
    ) {
        self.storage.balances.at(from).sub(amount).deliver(MessageDelivery::onchain_unconstrained());
        self.storage.balances.at(to).add(amount).deliver(MessageDelivery::onchain_constrained());
    }

    /// Private transfer initiated by the balance owner, used for seller payout,
    /// treasury fee, and losing-bid refunds.
    #[external("private")]
    fn transfer(to: AztecAddress, amount: u128) {
        let from = self.context.maybe_msg_sender().expect(
            f"transfer must be called through an account contract",
        );
        self.storage.balances.at(from).sub(amount).deliver(MessageDelivery::onchain_unconstrained());
        self.storage.balances.at(to).add(amount).deliver(MessageDelivery::onchain_constrained());
    }

    #[external("utility")]
    unconstrained fn balance_of_private(owner: AztecAddress) -> u128 {
        self.storage.balances.at(owner).balance_of()
    }
}
