use aztec::macros::notes::note;
use aztec::protocol::{address::AztecAddress, hash::poseidon2_hash, traits::{Packable, ToField}};

pub fn note_key(bidder: AztecAddress, listing_id: Field) -> Field {
    poseidon2_hash([bidder.to_field(), listing_id])
}

pub fn bid_commitment_hash(amount: u128, salt: Field, bidder: AztecAddress) -> Field {
    poseidon2_hash([amount as Field, salt, bidder.to_field()])
}

#[derive(Eq, Packable)]
#[note]
pub struct BidCommitmentNote {
    pub listing_id: Field,
    pub commitment_hash: Field,
    pub locked_bid: u128,
    /// Real-estate commitment stake, locked alongside the bid. Zero for
    /// mobile-goods listings.
    pub locked_stake: u128,
    pub revealed: bool,
    /// Bid portion (payout to seller/treasury, or refund to a loser) has
    /// been claimed.
    pub bid_settled: bool,
    /// Stake portion has been resolved. Always true immediately for
    /// mobile-goods listings, where no stake is ever locked.
    pub stake_resolved: bool,
}

impl BidCommitmentNote {
    pub fn new(
        listing_id: Field,
        commitment_hash: Field,
        locked_bid: u128,
        locked_stake: u128,
    ) -> Self {
        Self {
            listing_id,
            commitment_hash,
            locked_bid,
            locked_stake,
            revealed: false,
            bid_settled: false,
            stake_resolved: locked_stake == 0,
        }
    }

    pub fn after_reveal(self) -> Self {
        Self {
            listing_id: self.listing_id,
            commitment_hash: self.commitment_hash,
            locked_bid: self.locked_bid,
            locked_stake: self.locked_stake,
            revealed: true,
            bid_settled: self.bid_settled,
            stake_resolved: self.stake_resolved,
        }
    }

    pub fn after_bid_settlement(self) -> Self {
        Self {
            listing_id: self.listing_id,
            commitment_hash: self.commitment_hash,
            locked_bid: self.locked_bid,
            locked_stake: self.locked_stake,
            revealed: self.revealed,
            bid_settled: true,
            stake_resolved: self.stake_resolved,
        }
    }

    pub fn after_stake_settlement(self) -> Self {
        Self {
            listing_id: self.listing_id,
            commitment_hash: self.commitment_hash,
            locked_bid: self.locked_bid,
            locked_stake: self.locked_stake,
            revealed: self.revealed,
            bid_settled: self.bid_settled,
            stake_resolved: true,
        }
    }

    pub fn after_full_settlement(self) -> Self {
        Self {
            listing_id: self.listing_id,
            commitment_hash: self.commitment_hash,
            locked_bid: self.locked_bid,
            locked_stake: self.locked_stake,
            revealed: self.revealed,
            bid_settled: true,
            stake_resolved: true,
        }
    }
}