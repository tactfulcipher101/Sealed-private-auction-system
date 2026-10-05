//! Sealed private auction core: private bid commitments, public reveal-at-close settlement.
//!
//! Bid values remain private while the auction is open. At reveal, each amount
//! becomes public alongside its commitment hash; anyone can independently verify
//! the winner from the public records. This does not hide bidders from regulated
//! intermediaries, and the winning bidder's real-world identity is handed to the
//! seller off-chain when closing requires it.
//!
//! An emergency pause needs a threshold of guardian votes. While paused, new
//! commitments, reveals, finalization, closing confirmation and slashing are
//! blocked. Payouts, refunds and already-earned stake returns are never blocked.

mod bid_note;

use aztec::macros::aztec;

#[aztec]
pub contract SealedAuction {
    use crate::bid_note::{BidCommitmentNote, note_key};
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
    global BPS_DENOMINATOR: u128 = 10_000;
    global CATEGORY_MOBILE_GOODS: u8 = 0;
    global CATEGORY_REAL_ESTATE: u8 = 1;
    global PAUSE_SIGNER_COUNT: u32 = 3;
    // Vote slots 0..3 hold pause votes, slots 3..6 hold unpause votes.
    global PAUSE_VOTE_SLOTS: u32 = 6;

    #[derive(Deserialize, Eq, Packable, Serialize)]
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
    pub struct ClosingState {
        pub closing_confirmed: bool,
        pub legal_closing_deadline: u64,
        pub stake_claimed: bool,
    }

    #[derive(Deserialize, Eq, Packable, Serialize)]
    pub struct ProtocolParameters {
        pub settlement_fee_bps: u128,
        pub late_reveal_penalty_bps: u128,
        pub slash_seller_share_bps: u128,
        pub treasury: AztecAddress,
    }

    #[derive(Deserialize, Eq, Packable, Serialize)]
    pub struct EffectiveDeadlines {
        pub reveal_deadline: u64,
        pub legal_closing_deadline: u64,
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
        parameters: PublicImmutable<ProtocolParameters, Context>,
        asset_verifier: PublicMutable<AztecAddress, Context>,
        listings: Map<Field, PublicImmutable<ListingInfo, Context>, Context>,
        status: Map<Field, PublicMutable<u8, Context>, Context>,
        commitments: Map<Field, Map<u32, PublicMutable<CommitmentRecord, Context>, Context>, Context>,
        commitment_count: Map<Field, PublicMutable<u32, Context>, Context>,
        revealed_count: Map<Field, PublicMutable<u32, Context>, Context>,
        settlement: Map<Field, PublicMutable<SettlementRecord, Context>, Context>,
        closing_confirmed: Map<Field, PublicMutable<bool, Context>, Context>,
        legal_closing_deadline: Map<Field, PublicMutable<u64, Context>, Context>,
        // True once the winner's stake has left the auction (returned or slashed).
        stake_claimed: Map<Field, PublicMutable<bool, Context>, Context>,
        pause_signers: Map<u32, PublicImmutable<AztecAddress, Context>, Context>,
        pause_threshold: PublicImmutable<u8, Context>,
        guardian_votes: Map<u32, PublicMutable<bool, Context>, Context>,
        paused: PublicMutable<bool, Context>,
        paused_seconds_total: PublicMutable<u64, Context>,
        paused_since: PublicMutable<u64, Context>,
        pause_clock_at_listing: Map<Field, PublicMutable<u64, Context>, Context>,
        pause_clock_at_finalize: Map<Field, PublicMutable<u64, Context>, Context>,
        bid_notes: Map<Field, Owned<PrivateMutable<BidCommitmentNote, Context>, Context>, Context>,
    }

    #[initializer]
    #[external("public")]
    fn constructor(
        treasury: AztecAddress,
        asset_verifier: AztecAddress,
        pause_guardians: [AztecAddress; 3],
        pause_threshold: u8,
        settlement_fee_bps: u128,
        late_reveal_penalty_bps: u128,
        slash_seller_share_bps: u128,
    ) {
        assert(!treasury.is_zero(), "treasury cannot be zero");

        assert(!asset_verifier.is_zero(), "asset verifier cannot be zero");
        self.storage.asset_verifier.write(asset_verifier);
        assert(settlement_fee_bps <= 1000, "settlement fee exceeds 1000 basis points");
        assert(late_reveal_penalty_bps <= 5000, "late reveal penalty exceeds 5000 basis points");
        assert(slash_seller_share_bps <= 10_000, "slash seller share exceeds 10000 basis points");
        self.storage.parameters.initialize(
            ProtocolParameters {
                settlement_fee_bps,
                late_reveal_penalty_bps,
                slash_seller_share_bps,
                treasury,
            },
        );
        self.storage.paused_seconds_total.write(0);
        self.storage.paused_since.write(0);
        for i in 0..PAUSE_SIGNER_COUNT {
            assert(!pause_guardians[i].is_zero(), "pause guardian cannot be zero");
            self.storage.pause_signers.at(i).initialize(pause_guardians[i]);
        }
        assert(pause_guardians[0] != pause_guardians[1], "pause guardians must be distinct");
        assert(pause_guardians[0] != pause_guardians[2], "pause guardians must be distinct");
        assert(pause_guardians[1] != pause_guardians[2], "pause guardians must be distinct");
        assert(pause_threshold >= 1, "pause threshold must be at least 1");
        assert((pause_threshold as u32) <= PAUSE_SIGNER_COUNT, "pause threshold exceeds guardian count");
        self.storage.pause_threshold.initialize(pause_threshold);
    }

    #[external("public")]
    fn create_listing(
        listing_id: Field,
        token: AztecAddress,
        reserve_price: u128,
        close_timestamp: u64,
        reveal_deadline: u64,
        seller: AztecAddress,
        category: u8,
        stake_bps: u16,
        legal_closing_window: u64,
    ) {
        let caller = self.context.maybe_msg_sender().expect(
            f"create_listing must be called through an account contract",
        );
        assert(
            caller == self.storage.asset_verifier.read(),
            "only the configured asset verifier may create listings",
        );
        assert(!seller.is_zero(), "seller cannot be zero");
        assert(listing_id != 0, "listing id cannot be zero");
        assert(!token.is_zero(), "token cannot be zero");
        assert(reserve_price > 0, "reserve price must be positive");
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

        let timestamp = self.context.timestamp();
        let mut clock = self.storage.paused_seconds_total.read();
        if self.storage.paused.read() {
            clock += timestamp - self.storage.paused_since.read();
        }
        self.storage.listings.at(listing_id).initialize(
            ListingInfo {
                seller,
                token,
                reserve_price,
                close_timestamp,
                reveal_deadline,
                verified: true,
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
        self.storage.pause_clock_at_listing.at(listing_id).write(clock);
        self.emit(ListingCreated { listing_id, seller, token, reserve_price });
    }



    #[external("public")]
    fn get_listing(listing_id: Field) -> pub ListingInfo {
        self.storage.listings.at(listing_id).read()
    }

    #[external("public")]
    fn get_status(listing_id: Field) -> u8 {
        self.storage.status.at(listing_id).read()
    }

    #[external("public")]
    fn get_closing_state(listing_id: Field) -> pub ClosingState {
        ClosingState {
            closing_confirmed: self.storage.closing_confirmed.at(listing_id).read(),
            legal_closing_deadline: self.storage.legal_closing_deadline.at(listing_id).read(),
            stake_claimed: self.storage.stake_claimed.at(listing_id).read(),
        }
    }

    #[external("public")]
    fn get_parameters() -> pub ProtocolParameters {
        ProtocolParameters {
            settlement_fee_bps: self.storage.parameters.read().settlement_fee_bps,
            late_reveal_penalty_bps: self.storage.parameters.read().late_reveal_penalty_bps,
            slash_seller_share_bps: self.storage.parameters.read().slash_seller_share_bps,
            treasury: self.storage.parameters.read().treasury,
        }
    }

    #[external("public")]
    fn get_effective_deadlines(listing_id: Field) -> pub EffectiveDeadlines {
        let timestamp = self.context.timestamp();
        let mut clock = self.storage.paused_seconds_total.read();
        if self.storage.paused.read() {
            clock += timestamp - self.storage.paused_since.read();
        }
        let listing = self.storage.listings.at(listing_id).read();
        let stored_legal_deadline = self.storage.legal_closing_deadline.at(listing_id).read();
        let mut legal_closing_deadline = 0;
        if stored_legal_deadline > 0 {
            legal_closing_deadline = stored_legal_deadline
                + (clock - self.storage.pause_clock_at_finalize.at(listing_id).read());
        }
        EffectiveDeadlines {
            reveal_deadline: listing.reveal_deadline
                + (clock - self.storage.pause_clock_at_listing.at(listing_id).read()),
            legal_closing_deadline,
        }
    }

    #[external("public")]
    fn get_asset_verifier() -> AztecAddress {
        self.storage.asset_verifier.read()
    }

    #[external("public")]
    fn update_asset_verifier(new_verifier: AztecAddress) {
        let caller = self.context.maybe_msg_sender().expect(
            f"asset verifier update must be called through an account contract",
        );
        assert(caller == self.storage.asset_verifier.read(), "only the current asset verifier can rotate the role");
        assert(!new_verifier.is_zero(), "asset verifier cannot be zero");
        self.storage.asset_verifier.write(new_verifier);
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
        let note = BidCommitmentNote::new(listing_id, commitment_hash, salt, amount, stake);
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

    /// A bidder reveals the amount and salt stored in their own note.
    #[external("private")]
    fn reveal_bid(listing_id: Field) {
        let bidder = self.context.maybe_msg_sender().expect(
            f"reveal_bid must be called through an account contract",
        );
        let listing = self.storage.listings.at(listing_id).read();
        let now = self.context.get_anchor_block_header().timestamp();
        assert(now >= listing.close_timestamp, "auction has not closed");
        let enrollment_key = crate::bid_note::note_key(bidder, listing_id);
        let slot = self.storage.bid_notes.at(enrollment_key).at(bidder);
        let note = slot.get_note().get_note();
        assert(!note.revealed, "bid already revealed");
        assert(!note.bid_settled, "bid already settled");
        let expected_hash = crate::bid_note::bid_commitment_hash(note.locked_bid, note.salt, bidder);
        assert(expected_hash == note.commitment_hash, "reveal does not match commitment");
        slot.replace(|current| current.after_reveal()).deliver(
            MessageDelivery::onchain_unconstrained(),
        );
        self.enqueue_self._record_reveal(listing_id, note.commitment_hash, note.locked_bid);
    }

    /// Anyone may reveal a bid on the bidder's behalf, provided they know the
    /// preimage (amount, salt, bidder). The bidder's note is not touched, since
    /// consuming it would need the owner's nullifier key. A wrong preimage
    /// hashes to a commitment that is not in the listing, so the enqueued
    /// _record_reveal reverts. Only (hash, amount) becomes public, exactly as
    /// in reveal_bid. Payouts stay bound to the bidder because the bidder
    /// address is inside the hash and claims are made by the note owner.
    #[external("private")]
    fn reveal_bid_for(listing_id: Field, amount: u128, salt: Field, bidder: AztecAddress) {
        let listing = self.storage.listings.at(listing_id).read();
        let now = self.context.get_anchor_block_header().timestamp();
        assert(now >= listing.close_timestamp, "auction has not closed");

        let commitment_hash = crate::bid_note::bid_commitment_hash(amount, salt, bidder);
        self.enqueue_self._record_reveal(listing_id, commitment_hash, amount);
    }

    /// Anyone finalizes after the deadline, or earlier after every indexed bid
    /// has revealed. The result is derivable from the public revealed rows.
    #[external("public")]
    fn finalize_settlement(listing_id: Field) {
        assert(!self.storage.paused.read(), "protocol is paused");
        let listing = self.storage.listings.at(listing_id).read();
        assert(
            self.storage.status.at(listing_id).read() == STATUS_REVEAL_WINDOW,
            "auction is not in reveal window",
        );
        let count = self.storage.commitment_count.at(listing_id).read();
        let reveals = self.storage.revealed_count.at(listing_id).read();
        let reveal_deadline = listing.reveal_deadline
            + (self.storage.paused_seconds_total.read()
                - self.storage.pause_clock_at_listing.at(listing_id).read());
        assert(
            (self.context.timestamp() >= reveal_deadline)
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
            let finalize_timestamp = self.context.timestamp();
            let mut finalize_clock = self.storage.paused_seconds_total.read();
            if self.storage.paused.read() {
                finalize_clock += finalize_timestamp - self.storage.paused_since.read();
            }
            self.storage.pause_clock_at_finalize.at(listing_id).write(finalize_clock);
        }
        self.storage.status.at(listing_id).write(STATUS_SETTLED);
    }

    /// A guardian votes to pause. The pause takes effect once the threshold
    /// of distinct guardians has voted; all votes clear when the state flips.
    #[external("public")]
    fn approve_pause() {
        self.internal.cast_guardian_vote(true);
    }

    /// A guardian votes to lift the pause, under the same threshold.
    #[external("public")]
    fn approve_unpause() {
        self.internal.cast_guardian_vote(false);
    }

    #[external("public")]
    fn get_paused() -> bool {
        self.storage.paused.read()
    }

    #[internal("public")]
    fn cast_guardian_vote(want_paused: bool) {
        let caller = self.context.maybe_msg_sender().expect(
            f"pause votes must come from an account contract",
        );
        assert(
            self.storage.paused.read() != want_paused,
            "protocol is already in the requested state",
        );
        let mut caller_index: u32 = 0;
        let mut is_guardian = false;
        for i in 0..PAUSE_SIGNER_COUNT {
            if self.storage.pause_signers.at(i).read() == caller {
                caller_index = i;
                is_guardian = true;
            }
        }
        assert(is_guardian, "only a pause guardian can vote");

        let vote_offset: u32 = if want_paused { 0 } else { PAUSE_SIGNER_COUNT };
        self.storage.guardian_votes.at(vote_offset + caller_index).write(true);
        let mut vote_count: u8 = 0;
        for i in 0..PAUSE_SIGNER_COUNT {
            if self.storage.guardian_votes.at(vote_offset + i).read() {
                vote_count += 1;
            }
        }
        if vote_count >= self.storage.pause_threshold.read() {
            let timestamp = self.context.timestamp();
            if want_paused {
                self.storage.paused_since.write(timestamp);
            } else {
                self.storage.paused_seconds_total.write(
                    self.storage.paused_seconds_total.read()
                        + timestamp - self.storage.paused_since.read(),
                );
            }
            self.storage.paused.write(want_paused);
            for i in 0..PAUSE_VOTE_SLOTS {
                self.storage.guardian_votes.at(i).write(false);
            }
        }
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
    #[external("private")]
    fn claim_winning_bid(listing_id: Field) {
        let bidder = self.context.maybe_msg_sender().expect(
            f"claim_winning_bid must be called through an account contract",
        );
        let listing = self.storage.listings.at(listing_id).read();
        let note_key = note_key(bidder, listing_id);
        let slot = self.storage.bid_notes.at(note_key).at(bidder);
        let note = slot.get_note().get_note();
        // Reveal status is enforced publicly by mark_claim (revealed & !claimed).
        // The note can still say unrevealed if a relayer used reveal_bid_for.
        assert(!note.bid_settled, "bid already claimed");
        self.enqueue_self._mark_winner_claim(listing_id, note.commitment_hash);
        let fee = note.locked_bid * self.storage.parameters.read().settlement_fee_bps / BPS_DENOMINATOR;
        self.call(PrivateToken::at(listing.token).transfer(listing.seller, note.locked_bid - fee));
        self.call(PrivateToken::at(listing.token).transfer(self.storage.parameters.read().treasury, fee));
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
        // Reveal status is enforced publicly by mark_claim (revealed & !claimed).
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
    fn claim_late_reveal(listing_id: Field) {
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
        let expected_hash = crate::bid_note::bid_commitment_hash(note.locked_bid, note.salt, bidder);
        assert(expected_hash == note.commitment_hash, "claim does not match commitment");
        // Public gate: the record must be unrevealed and unclaimed, and the
        // deadline must have passed. Closes the relayer-reveal loophole.
        self.enqueue_self._mark_late_claim(listing_id, note.commitment_hash);

        let total_locked = note.locked_bid + note.locked_stake;
        let penalty = total_locked * self.storage.parameters.read().late_reveal_penalty_bps / BPS_DENOMINATOR;
        let refund = total_locked - penalty;
        self.call(PrivateToken::at(listing.token).transfer(bidder, refund));
        self.call(PrivateToken::at(listing.token).transfer(self.storage.parameters.read().treasury, penalty));
        slot.replace(|current| current.after_full_settlement()).deliver(
            MessageDelivery::onchain_unconstrained(),
        );
    }

    /// Seller confirms off-chain legal closing has completed. Only unlocks
    /// the winner's stake claim below -- it does not move any funds itself.
    #[external("public")]
    fn confirm_closing(listing_id: Field) {
        assert(!self.storage.paused.read(), "protocol is paused");
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
    #[external("private")]
    fn claim_stake_after_closing(listing_id: Field) {
        let bidder = self.context.maybe_msg_sender().expect(
            f"claim_stake_after_closing must be called through an account contract",
        );
        let listing = self.storage.listings.at(listing_id).read();
        let note_key = note_key(bidder, listing_id);
        let slot = self.storage.bid_notes.at(note_key).at(bidder);
        let note = slot.get_note().get_note();
        assert(!note.stake_resolved, "stake already resolved");
        assert(note.locked_stake > 0, "no stake locked for this bid");
        // Public gate: winner record paid out, closing confirmed, stake not yet
        // claimed or slashed. Independent of the note's bid_settled flag, which
        // stays false when the bid was paid through settle_winning_bid.
        self.enqueue_self._mark_stake_release(listing_id, note.commitment_hash);
        self.call(PrivateToken::at(listing.token).transfer(bidder, note.locked_stake));
        slot.replace(|current| current.after_stake_settlement()).deliver(
            MessageDelivery::onchain_unconstrained(),
        );
    }

    /// Anyone may pay out the winning bid. The caller supplies winning_amount,
    /// so the public gate re-verifies it against the settled result and marks
    /// the winner's record claimed through the same flag claim_winning_bid uses.
    #[external("private")]
    fn settle_winning_bid(listing_id: Field, winning_amount: u128) {
        let listing = self.storage.listings.at(listing_id).read();
        self.enqueue_self._mark_settle_winner(listing_id, winning_amount);
        let fee = winning_amount * self.storage.parameters.read().settlement_fee_bps / BPS_DENOMINATOR;
        self.call(PrivateToken::at(listing.token).transfer(listing.seller, winning_amount - fee));
        self.call(PrivateToken::at(listing.token).transfer(self.storage.parameters.read().treasury, fee));
    }

    /// Anyone may slash a real-estate winner who missed the legal closing
    /// deadline. The public gate re-verifies winning_amount, the deadline and
    /// that closing was never confirmed.
    #[external("private")]
    fn slash_stake_for_default(listing_id: Field, winning_amount: u128) {
        let listing = self.storage.listings.at(listing_id).read();
        assert(listing.category == CATEGORY_REAL_ESTATE, "only real-estate stakes can be slashed");
        let stake = winning_amount * (listing.stake_bps as u128) / BPS_DENOMINATOR;
        assert(stake > 0, "no stake locked for this listing");
        self.enqueue_self._mark_slash(listing_id, winning_amount);
        let seller_share = stake * self.storage.parameters.read().slash_seller_share_bps / BPS_DENOMINATOR;
        self.call(PrivateToken::at(listing.token).transfer(listing.seller, seller_share));
        if self.storage.parameters.read().slash_seller_share_bps < BPS_DENOMINATOR {
            self.call(
                PrivateToken::at(listing.token).transfer(
                    self.storage.parameters.read().treasury,
                    stake - seller_share,
                ),
            );
        }
    }

    #[only_self]
    #[external("public")]
    fn _record_commitment(listing_id: Field, commitment_hash: Field) {
        assert(!self.storage.paused.read(), "protocol is paused");
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
        assert(!self.storage.paused.read(), "protocol is paused");
        let listing = self.storage.listings.at(listing_id).read();
        assert(
            self.storage.status.at(listing_id).read() == STATUS_REVEAL_WINDOW,
            "auction is not in reveal window",
        );
        assert(
            self.context.timestamp() <= listing.reveal_deadline
                + (self.storage.paused_seconds_total.read()
                    - self.storage.pause_clock_at_listing.at(listing_id).read()),
            "reveal deadline passed",
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
    fn _mark_late_claim(listing_id: Field, commitment_hash: Field) {
        let listing = self.storage.listings.at(listing_id).read();
        let timestamp = self.context.timestamp();
        let mut clock = self.storage.paused_seconds_total.read();
        if self.storage.paused.read() {
            clock += timestamp - self.storage.paused_since.read();
        }
        assert(
            timestamp > listing.reveal_deadline
                + (clock - self.storage.pause_clock_at_listing.at(listing_id).read()),
            "reveal deadline has not passed yet",
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
        assert(!bid_record.revealed, "bid was revealed; use the normal claim path");
        assert(!bid_record.claimed, "bid already claimed");
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

    #[only_self]
    #[external("public")]
    fn _mark_settle_winner(listing_id: Field, winning_amount: u128) {
        let settlement = self.storage.settlement.at(listing_id).read();
        assert(settlement.has_winner, "listing has no winner");
        assert(
            winning_amount == settlement.winning_amount,
            "amount differs from the settled winning bid",
        );
        self.internal.mark_claim(listing_id, settlement.winner_hash, true);
    }

    #[only_self]
    #[external("public")]
    fn _mark_stake_release(listing_id: Field, commitment_hash: Field) {
        assert(
            self.storage.closing_confirmed.at(listing_id).read(),
            "closing has not been confirmed",
        );
        assert(!self.storage.stake_claimed.at(listing_id).read(), "stake already claimed");
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
        let bid_record = self.storage.commitments.at(listing_id).at(index).read();
        assert(bid_record.is_winner & bid_record.claimed, "only a paid-out winner can claim the stake");
        self.storage.stake_claimed.at(listing_id).write(true);
    }

    #[only_self]
    #[external("public")]
    fn _mark_slash(listing_id: Field, winning_amount: u128) {
        assert(!self.storage.paused.read(), "protocol is paused");
        let listing = self.storage.listings.at(listing_id).read();
        assert(listing.category == CATEGORY_REAL_ESTATE, "only real-estate stakes can be slashed");
        assert(
            self.storage.status.at(listing_id).read() == STATUS_SETTLED,
            "settlement is not finalized",
        );
        let settlement = self.storage.settlement.at(listing_id).read();
        assert(settlement.has_winner, "listing has no winner");
        assert(
            winning_amount == settlement.winning_amount,
            "amount differs from the settled winning bid",
        );
        let count = self.storage.commitment_count.at(listing_id).read();
        let mut index = 0;
        let mut found = false;
        for i in 0..MAX_BIDS_PER_LISTING {
            if i < count {
                let bid_record = self.storage.commitments.at(listing_id).at(i).read();
                if bid_record.commitment_hash == settlement.winner_hash {
                    index = i;
                    found = true;
                }
            }
        }
        assert(found, "winner commitment not found");
        let winner_record = self.storage.commitments.at(listing_id).at(index).read();
        assert(winner_record.is_winner & winner_record.claimed, "winning bid has not been paid out");
        assert(
            self.context.timestamp()
                > self.storage.legal_closing_deadline.at(listing_id).read()
                    + (self.storage.paused_seconds_total.read()
                        - self.storage.pause_clock_at_finalize.at(listing_id).read()),
            "legal closing deadline has not passed",
        );
        assert(!self.storage.closing_confirmed.at(listing_id).read(), "closing was confirmed");
        assert(!self.storage.stake_claimed.at(listing_id).read(), "stake already claimed");
        self.storage.stake_claimed.at(listing_id).write(true);
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

