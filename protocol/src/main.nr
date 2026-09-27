//! Sealed private auction core: private bid commitments, public reveal-at-close settlement.
//!
//! Bid values remain private while the auction is open. At reveal, each amount
//! becomes public alongside its commitment hash; anyone can independently verify
//! the winner from the public records. This does not hide bidders from regulated
//! intermediaries, and the winning bidder's real-world identity is handed to the
//! seller off-chain when closing requires it.
//!
//! TODO: real-estate stakes/defaults, emergency multisig, and relayer
//! authwits are intentionally deferred until this core vertical slice
//! compiles and is integration-tested. Forced late-reveal penalties are
//! implemented below (see `claim_late_reveal`).

mod bid_note;

use aztec::macros::aztec;

#[aztec]
pub contract SealedAuction {
    use crate::bid_note::{bid_commitment_hash, BidCommitmentNote, note_key};
    use aztec::{
        macros::{
            events::event,
            functions::{external, initializer, internal, only_self},
            storage::storage,
        },
        messages::delivery::MessageDelivery,
        protocol::{address::AztecAddress, traits::{Deserialize, Packable, Serialize}},
        state_vars::{Map, Owned, PrivateMutable, PublicImmutable, PublicMutable},
    };
    use private_token::PrivateToken;

    global STATUS_OPEN: u8 = 1;
    global STATUS_REVEAL_WINDOW: u8 = 2;
    global STATUS_SETTLED: u8 = 3;
    global MAX_BIDS_PER_LISTING: u32 = 32;
    global SETTLEMENT_FEE_BPS: u128 = 300; // Placeholder: 3%, pending unit-economics review.
    global LATE_REVEAL_PENALTY_BPS: u128 = 2000; // Placeholder: 20%, pending real economic decision.
    global BPS_DENOMINATOR: u128 = 10_000;
    global CATEGORY_MOBILE_GOODS: u8 = 0;
    global CATEGORY_REAL_ESTATE: u8 = 1;

    #[derive(Eq, Packable)]
    pub struct ListingInfo {
        pub seller: AztecAddress,
        pub token: AztecAddress,
        pub reserve_price: u128,
        pub close_timestamp: u64,
        pub reveal_deadline: u64,
        pub verified: bool,
        /// 0 = mobile-goods, 1 = real-estate.
        pub category: u8,
        /// Commitment stake as basis points of the bid amount. Zero for
        /// mobile-goods listings.
        pub stake_bps: u16,
        /// Seconds the winner has, after finalize_settlement, to confirm
        /// legal closing before the stake becomes eligible for slashing.
        /// Unused for mobile-goods listings.
        pub legal_closing_window: u64,
    }

    #[derive(Deserialize, Eq, Packable, Serialize)]
    pub struct CommitmentRecord {
        pub commitment_hash: Field,
        /// Zero until the bidder reveals. The bid is not public during commitment.
        pub amount: u128,
        pub revealed: bool,
        pub claimed: bool,
        pub is_winner: bool,
    }

    #[derive(Deserialize, Eq, Packable, Serialize)]
    pub struct SettlementRecord {
        pub winner_hash: Field,
        pub winning_amount: u128,
        pub has_winner: bool,
    }

    #[event]
    struct ListingCreated {
        listing_id: Field,
        seller: AztecAddress,
        token: AztecAddress,
        reserve_price: u128,
    }

    #[storage]
    struct Storage<Context> {
        treasury: PublicImmutable<AztecAddress, Context>,
        listings: Map<Field, PublicImmutable<ListingInfo, Context>, Context>,
        status: Map<Field, PublicMutable<u8, Context>, Context>,
        commitments: Map<Field, Map<u32, PublicMutable<CommitmentRecord, Context>, Context>, Context>,
        commitment_count: Map<Field, PublicMutable<u32, Context>, Context>,
        revealed_count: Map<Field, PublicMutable<u32, Context>, Context>,
        settlement: Map<Field, PublicMutable<SettlementRecord, Context>, Context>,
        closing_confirmed: Map<Field, PublicMutable<bool, Context>, Context>,
        legal_closing_deadline: Map<Field, PublicMutable<u64, Context>, Context>,
        bid_notes: Map<Field, Owned<PrivateMutable<BidCommitmentNote, Context>, Context>, Context>,
    }

    #[initializer]
    #[external("public")]
    fn constructor(treasury: AztecAddress) {
        assert(!treasury.is_zero(), "treasury cannot be zero");
        self.storage.treasury.initialize(treasury);
    }

    #[external("public")]
    fn create_listing(
        listing_id: Field,
        token: AztecAddress,
        reserve_price: u128,
        close_timestamp: u64,
        reveal_deadline: u64,
        verified_proof: bool,
        category: u8,
        stake_bps: u16,
        legal_closing_window: u64,
    ) {
        let seller = self.context.maybe_msg_sender().expect(
            f"create_listing must be called through an account contract",
        );
        assert(listing_id != 0, "listing id cannot be zero");
        assert(!token.is_zero(), "token cannot be zero");
        assert(reserve_price > 0, "reserve price must be positive");
        assert(verified_proof, "external asset verification required");
        assert(close_timestamp > self.context.timestamp(), "close time must be in the future");
        assert(reveal_deadline > close_timestamp, "reveal deadline must follow close time");
        assert(self.storage.status.at(listing_id).read() == 0, "listing id already used");
        assert(
            (category == CATEGORY_MOBILE_GOODS) | (category == CATEGORY_REAL_ESTATE),
            "unknown listing category",
        );
        if category == CATEGORY_REAL_ESTATE {
            assert(stake_bps > 0, "real-estate listings require a nonzero stake");
            assert(legal_closing_window > 0, "real-estate listings require a legal closing window");
        } else {
            assert(stake_bps == 0, "mobile-goods listings cannot require a stake");
        }

        self.storage.listings.at(listing_id).initialize(
            ListingInfo {
                seller,
                token,
                reserve_price,
                close_timestamp,
                reveal_deadline,
                verified: verified_proof,
                category,
                stake_bps,
                legal_closing_window,
            },
        );
        self.storage.status.at(listing_id).write(STATUS_OPEN);
        self.storage.commitment_count.at(listing_id).write(0);
        self.storage.revealed_count.at(listing_id).write(0);
        self.storage.settlement.at(listing_id).write(
            SettlementRecord { winner_hash: 0, winning_amount: 0, has_winner: false },
        );
        self.storage.closing_confirmed.at(listing_id).write(false);
        self.storage.legal_closing_deadline.at(listing_id).write(0);
        self.emit(ListingCreated { listing_id, seller, token, reserve_price });
    }

    /// Bidder-owned note consumption both proves solvency and locks exactly the
    /// bid amount. A token authwit is required for the token's private pull.
    /// The public phase records only the commitment hash, never the bid amount
    /// or bidder address.
    #[external("private")]
    fn commit_bid(listing_id: Field, amount: u128, salt: Field, token_authwit_nonce: Field) {
        let bidder = self.context.maybe_msg_sender().expect(
            f"commit_bid must be called through an account contract",
        );
        let listing = self.storage.listings.at(listing_id).read();
        let now = self.context.get_anchor_block_header().timestamp();
        assert(listing.verified, "listing is not verified");
        assert(amount >= listing.reserve_price, "bid is below reserve price");
        assert(now < listing.close_timestamp, "auction is closed");

        // Real-estate listings require a commitment stake locked alongside
        // the bid itself, sized as a fixed percentage of the bid amount.
        // Mobile-goods listings have stake_bps == 0, so this is always zero
        // for them.
        let stake = amount * (listing.stake_bps as u128) / BPS_DENOMINATOR;
        let total_locked = amount + stake;

        let commitment_hash = crate::bid_note::bid_commitment_hash(amount, salt, bidder);
        let enrollment_key = crate::bid_note::note_key(bidder, listing_id);
        let note = BidCommitmentNote::new(listing_id, commitment_hash, amount, stake);
        self.storage.bid_notes.at(enrollment_key).at(bidder).initialize(note).deliver(
            MessageDelivery::onchain_unconstrained(),
        );
        self.call(PrivateToken::at(listing.token).transfer_in_private(
            bidder,
            self.context.this_address(),
            total_locked,
            token_authwit_nonce,
        ));
        self.enqueue_self._record_commitment(listing_id, commitment_hash);
    }

    /// Anyone may transition the listing into its reveal phase after close.
    #[external("public")]
    fn close_auction(listing_id: Field) {
        let listing = self.storage.listings.at(listing_id).read();
        assert(self.storage.status.at(listing_id).read() == STATUS_OPEN, "auction is not open");
        assert(
            self.context.timestamp() >= listing.close_timestamp,
            "auction has not reached close time",
        );
        self.storage.status.at(listing_id).write(STATUS_REVEAL_WINDOW);
    }

    /// A bidder reveals their own note. This call publishes amount and hash,
    /// then queues public indexing; it is not a blind or MPC settlement.
    #[external("private")]
    fn reveal_bid(listing_id: Field, amount: u128, salt: Field) {
        let bidder = self.context.maybe_msg_sender().expect(
            f"reveal_bid must be called through an account contract",
        );
        let listing = self.storage.listings.at(listing_id).read();
        let now = self.context.get_anchor_block_header().timestamp();
        assert(now >= listing.close_timestamp, "auction has not closed");
        assert(now <= listing.reveal_deadline, "reveal deadline passed");

        let enrollment_key = crate::bid_note::note_key(bidder, listing_id);
        let slot = self.storage.bid_notes.at(enrollment_key).at(bidder);
        let note = slot.get_note().get_note();
        assert(!note.revealed, "bid already revealed");
        assert(!note.bid_settled, "bid already settled");
        let expected_hash = crate::bid_note::bid_commitment_hash(amount, salt, bidder);
        assert(expected_hash == note.commitment_hash, "reveal does not match commitment");
        assert(amount == note.locked_bid, "revealed amount differs from locked amount");

        slot.replace(|current| current.after_reveal()).deliver(
            MessageDelivery::onchain_unconstrained(),
        );
        self.enqueue_self._record_reveal(listing_id, note.commitment_hash, amount);
    }

    /// Anyone finalizes after the deadline, or earlier after every indexed bid
    /// has revealed. The result is derivable from the public revealed rows.
    #[external("public")]
    fn finalize_settlement(listing_id: Field) {
        let listing = self.storage.listings.at(listing_id).read();
        assert(
            self.storage.status.at(listing_id).read() == STATUS_REVEAL_WINDOW,
            "auction is not in reveal window",
        );
        let count = self.storage.commitment_count.at(listing_id).read();
        let reveals = self.storage.revealed_count.at(listing_id).read();
        assert(
            (self.context.timestamp() >= listing.reveal_deadline)
                | ((count > 0) & (count == reveals)),
            "reveal window is still active",
        );

        let mut winner_hash: Field = 0;
        let mut winning_amount: u128 = 0;
        let mut winning_index: u32 = 0;
        let mut has_winner = false;
        for i in 0..MAX_BIDS_PER_LISTING {
            if i < count {
                let bid_record = self.storage.commitments.at(listing_id).at(i).read();
                if bid_record.revealed & (bid_record.amount >= listing.reserve_price) {
                    if (!has_winner) | (bid_record.amount > winning_amount) {
                        winner_hash = bid_record.commitment_hash;
                        winning_amount = bid_record.amount;
                        winning_index = i;
                        has_winner = true;
                    }
                }
            }
        }

        for i in 0..MAX_BIDS_PER_LISTING {
            if i < count {
                let bid_slot = self.storage.commitments.at(listing_id).at(i);
                let bid_record = bid_slot.read();
                bid_slot.write(
                    CommitmentRecord {
                        commitment_hash: bid_record.commitment_hash,
                        amount: bid_record.amount,
                        revealed: bid_record.revealed,
                        claimed: bid_record.claimed,
                        is_winner: has_winner & (i == winning_index),
                    },
                );
            }
        }
        self.storage.settlement.at(listing_id).write(
            SettlementRecord { winner_hash, winning_amount, has_winner },
        );
        if has_winner & (listing.category == CATEGORY_REAL_ESTATE) {
            self.storage.legal_closing_deadline.at(listing_id).write(
                self.context.timestamp() + listing.legal_closing_window,
            );
        }
        self.storage.status.at(listing_id).write(STATUS_SETTLED);
    }

    #[external("public")]
    fn get_commitment_count(listing_id: Field) -> u32 {
        self.storage.commitment_count.at(listing_id).read()
    }

    #[external("public")]
    fn get_commitment(listing_id: Field, index: u32) -> pub CommitmentRecord {
        assert(
            index < self.storage.commitment_count.at(listing_id).read(),
            "commitment index out of range",
        );
        self.storage.commitments.at(listing_id).at(index).read()
    }

    #[external("public")]
    fn get_settlement(listing_id: Field) -> pub SettlementRecord {
        self.storage.settlement.at(listing_id).read()
    }

    /// The caller chooses the winner or loser endpoint; the public self-call
    /// verifies that choice against the finalized, publicly checkable result.
    /// TODO: late-reveal recovery and its penalty are intentionally deferred.
    #[external("private")]
    fn claim_winning_bid(listing_id: Field) {
        let bidder = self.context.maybe_msg_sender().expect(
            f"claim_winning_bid must be called through an account contract",
        );
        let listing = self.storage.listings.at(listing_id).read();
        let note_key = note_key(bidder, listing_id);
        let slot = self.storage.bid_notes.at(note_key).at(bidder);
        let note = slot.get_note().get_note();
        assert(note.revealed, "unrevealed bid is not claimable");
        assert(!note.bid_settled, "bid already claimed");
        self.enqueue_self._mark_winner_claim(listing_id, note.commitment_hash);
        let fee = note.locked_bid * SETTLEMENT_FEE_BPS / BPS_DENOMINATOR;
        self.call(PrivateToken::at(listing.token).transfer(listing.seller, note.locked_bid - fee));
        self.call(PrivateToken::at(listing.token).transfer(self.storage.treasury.read(), fee));
        // The stake (if any) stays locked here; real-estate winners claim it
        // separately via claim_stake_after_closing, once the seller confirms
        // legal closing. Mobile-goods bids have no stake, so stake_resolved
        // was already true from note creation and nothing further is owed.
        slot.replace(|current| current.after_bid_settlement()).deliver(
            MessageDelivery::onchain_unconstrained(),
        );
    }

    #[external("private")]
    fn claim_losing_bid(listing_id: Field) {
        let bidder = self.context.maybe_msg_sender().expect(
            f"claim_losing_bid must be called through an account contract",
        );
        let listing = self.storage.listings.at(listing_id).read();
        let note_key = note_key(bidder, listing_id);
        let slot = self.storage.bid_notes.at(note_key).at(bidder);
        let note = slot.get_note().get_note();
        assert(note.revealed, "unrevealed bid is not claimable");
        assert(!note.bid_settled, "bid already claimed");
        self.enqueue_self._mark_loser_claim(listing_id, note.commitment_hash);
        // Losers recover the full locked amount, bid and stake together --
        // there is no penalty for losing, only for withholding a reveal.
        self.call(
            PrivateToken::at(listing.token).transfer(bidder, note.locked_bid + note.locked_stake),
        );
        slot.replace(|current| current.after_full_settlement()).deliver(
            MessageDelivery::onchain_unconstrained(),
        );
    }

    /// Recovery path for a bidder who never called `reveal_bid` before
    /// `reveal_deadline`. Applies `LATE_REVEAL_PENALTY_BPS` to the full
    /// locked amount (bid plus any real-estate stake) as the cost of
    /// withholding a reveal -- the remainder returns to the bidder and the
    /// penalty is routed to treasury. Without this, a bidder who suspects
    /// they lost has no reason to ever reveal, and the reveal-at-close
    /// mechanism can stall with no winner determinable.
    #[external("private")]
    fn claim_late_reveal(listing_id: Field, amount: u128, salt: Field) {
        let bidder = self.context.maybe_msg_sender().expect(
            f"claim_late_reveal must be called through an account contract",
        );
        let listing = self.storage.listings.at(listing_id).read();
        let now = self.context.get_anchor_block_header().timestamp();
        assert(now > listing.reveal_deadline, "reveal deadline has not passed yet");

        let note_key = note_key(bidder, listing_id);
        let slot = self.storage.bid_notes.at(note_key).at(bidder);
        let note = slot.get_note().get_note();
        assert(!note.revealed, "bid was revealed on time; use the normal claim path");
        assert(!note.bid_settled, "bid already settled");
        let expected_hash = crate::bid_note::bid_commitment_hash(amount, salt, bidder);
        assert(expected_hash == note.commitment_hash, "claim does not match commitment");
        assert(amount == note.locked_bid, "claimed amount differs from locked amount");

        let total_locked = note.locked_bid + note.locked_stake;
        let penalty = total_locked * LATE_REVEAL_PENALTY_BPS / BPS_DENOMINATOR;
        let refund = total_locked - penalty;
        self.call(PrivateToken::at(listing.token).transfer(bidder, refund));
        self.call(PrivateToken::at(listing.token).transfer(self.storage.treasury.read(), penalty));
        slot.replace(|current| current.after_full_settlement()).deliver(
            MessageDelivery::onchain_unconstrained(),
        );
    }

    /// Seller confirms off-chain legal closing has completed. Only unlocks
    /// the winner's stake claim below -- it does not move any funds itself.
    #[external("public")]
    fn confirm_closing(listing_id: Field) {
        let listing = self.storage.listings.at(listing_id).read();
        let caller = self.context.maybe_msg_sender().expect(
            f"confirm_closing must be called through an account contract",
        );
        assert(caller == listing.seller, "only the seller can confirm closing");
        assert(
            listing.category == CATEGORY_REAL_ESTATE,
            "closing confirmation only applies to real-estate listings",
        );
        assert(
            self.storage.status.at(listing_id).read() == STATUS_SETTLED,
            "settlement is not finalized",
        );
        assert(!self.storage.closing_confirmed.at(listing_id).read(), "closing already confirmed");
        self.storage.closing_confirmed.at(listing_id).write(true);
    }

    /// Returns the winning real-estate bidder's locked stake once the
    /// seller has confirmed closing. Kept separate from claim_winning_bid
    /// because the stake must stay locked past bid settlement.
    ///
    /// TODO (deferred, depends on Task 3 -- authwit relayer support):
    /// there is intentionally no `slash_stake_for_default` here yet. In
    /// Aztec's private-note model, only a note's own owner can nullify it
    /// -- a third party cannot force a winner's private stake note to move
    /// without that winner's cooperation or a pre-granted authwit. A
    /// defaulting winner has no incentive to call a function that slashes
    /// their own stake, so slashing genuinely requires the winner to grant
    /// the contract a standing authwit at stake-posting time -- the same
    /// primitive Task 3 introduces for relayers. Revisit once that lands.
    #[external("private")]
    fn claim_stake_after_closing(listing_id: Field) {
        let bidder = self.context.maybe_msg_sender().expect(
            f"claim_stake_after_closing must be called through an account contract",
        );
        let listing = self.storage.listings.at(listing_id).read();
        self.enqueue_self._require_closing_confirmed(listing_id);
        let note_key = note_key(bidder, listing_id);
        let slot = self.storage.bid_notes.at(note_key).at(bidder);
        let note = slot.get_note().get_note();
        assert(note.bid_settled, "claim the bid portion before the stake");
        assert(!note.stake_resolved, "stake already resolved");
        assert(note.locked_stake > 0, "no stake locked for this bid");
        self.call(PrivateToken::at(listing.token).transfer(bidder, note.locked_stake));
        slot.replace(|current| current.after_stake_settlement()).deliver(
            MessageDelivery::onchain_unconstrained(),
        );
    }

    #[only_self]
    #[external("public")]
    fn _record_commitment(listing_id: Field, commitment_hash: Field) {
        let listing = self.storage.listings.at(listing_id).read();
        assert(self.storage.status.at(listing_id).read() == STATUS_OPEN, "auction is not open");
        assert(self.context.timestamp() < listing.close_timestamp, "auction is closed");
        let count = self.storage.commitment_count.at(listing_id).read();
        assert(count < MAX_BIDS_PER_LISTING, "auction commitment capacity reached");
        self.storage.commitments.at(listing_id).at(count).write(
            CommitmentRecord {
                commitment_hash,
                amount: 0,
                revealed: false,
                claimed: false,
                is_winner: false,
            },
        );
        self.storage.commitment_count.at(listing_id).write(count + 1);
    }

    #[only_self]
    #[external("public")]
    fn _record_reveal(listing_id: Field, commitment_hash: Field, amount: u128) {
        let listing = self.storage.listings.at(listing_id).read();
        assert(
            self.storage.status.at(listing_id).read() == STATUS_REVEAL_WINDOW,
            "auction is not in reveal window",
        );
        assert(self.context.timestamp() <= listing.reveal_deadline, "reveal deadline passed");
        let count = self.storage.commitment_count.at(listing_id).read();
        let mut index = 0;
        let mut found = false;
        for i in 0..MAX_BIDS_PER_LISTING {
            if i < count {
                let bid_record = self.storage.commitments.at(listing_id).at(i).read();
                if bid_record.commitment_hash == commitment_hash {
                    index = i;
                    found = true;
                }
            }
        }
        assert(found, "commitment not found");
        let bid_slot = self.storage.commitments.at(listing_id).at(index);
        let bid_record = bid_slot.read();
        assert(!bid_record.revealed, "commitment already revealed");
        bid_slot.write(
            CommitmentRecord {
                commitment_hash: bid_record.commitment_hash,
                amount,
                revealed: true,
                claimed: bid_record.claimed,
                is_winner: false,
            },
        );
        self.storage.revealed_count.at(listing_id).write(
            self.storage.revealed_count.at(listing_id).read() + 1,
        );
    }

    #[only_self]
    #[external("public")]
    fn _mark_winner_claim(listing_id: Field, commitment_hash: Field) {
        self.internal.mark_claim(listing_id, commitment_hash, true);
    }

    #[only_self]
    #[external("public")]
    fn _mark_loser_claim(listing_id: Field, commitment_hash: Field) {
        self.internal.mark_claim(listing_id, commitment_hash, false);
    }

    #[only_self]
    #[external("public")]
    fn _require_closing_confirmed(listing_id: Field) {
        assert(
            self.storage.closing_confirmed.at(listing_id).read(),
            "closing has not been confirmed",
        );
    }

    #[internal("public")]
    fn mark_claim(listing_id: Field, commitment_hash: Field, is_winner: bool) {
        assert(
            self.storage.status.at(listing_id).read() == STATUS_SETTLED,
            "settlement is not finalized",
        );
        let count = self.storage.commitment_count.at(listing_id).read();
        let mut index = 0;
        let mut found = false;
        for i in 0..MAX_BIDS_PER_LISTING {
            if i < count {
                let bid_record = self.storage.commitments.at(listing_id).at(i).read();
                if bid_record.commitment_hash == commitment_hash {
                    index = i;
                    found = true;
                }
            }
        }
        assert(found, "commitment not found");
        let bid_slot = self.storage.commitments.at(listing_id).at(index);
        let bid_record = bid_slot.read();
        assert(bid_record.revealed & !bid_record.claimed, "bid is not claimable");
        assert(bid_record.is_winner == is_winner, "claim mode does not match winner result");
        bid_slot.write(
            CommitmentRecord {
                commitment_hash: bid_record.commitment_hash,
                amount: bid_record.amount,
                revealed: bid_record.revealed,
                claimed: true,
                is_winner: bid_record.is_winner,
            },
        );
    }
}

