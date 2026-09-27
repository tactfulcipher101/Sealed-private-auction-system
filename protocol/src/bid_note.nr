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
    pub revealed: bool,
    pub settled: bool,
}

impl BidCommitmentNote {
    pub fn new(listing_id: Field, commitment_hash: Field, locked_bid: u128) -> Self {
        Self { listing_id, commitment_hash, locked_bid, revealed: false, settled: false }
    }

    pub fn after_reveal(self) -> Self {
        Self {
            listing_id: self.listing_id,
            commitment_hash: self.commitment_hash,
            locked_bid: self.locked_bid,
            revealed: true,
            settled: self.settled,
        }
    }

    pub fn after_settlement(self) -> Self {
        Self {
            listing_id: self.listing_id,
            commitment_hash: self.commitment_hash,
            locked_bid: self.locked_bid,
            revealed: self.revealed,
            settled: true,
        }
    }
}
