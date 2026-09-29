use aztec::protocol::{address::AztecAddress, hash::poseidon2_hash, traits::ToField};
use aztec::test::helpers::{
    authwit::add_private_authwit_from_call,
    test_environment::{CallPrivateOptions, ExecuteUtilityOptions, TestEnvironment},
};
use private_token::PrivateToken;
use sealed_auction::SealedAuction;

global LISTING_ID: Field = 17;
global RESERVE: u128 = 100;
global BID_A: u128 = 110;
global BID_B: u128 = 150;
global BIDDER_A_FUNDS: u128 = 500;
global BIDDER_B_FUNDS: u128 = 700;
global TOKEN_AUTHWIT_NONCE: Field = 1;

#[test]
unconstrained fn two_bidders_reveal_winner_and_settle_loser_refund() {
    let mut env = TestEnvironment::new();
    let seller = env.create_light_account();
    let treasury = env.create_light_account();
    let bidder_a = env.create_contract_account();
    let bidder_b = env.create_contract_account();

    let token = env.deploy("@private_token/PrivateToken").without_initializer();
    let auction = env.deploy("@sealed_auction/SealedAuction").with_public_initializer(
        seller,
        SealedAuction::interface().constructor(treasury),
    );

    env.call_private(bidder_a, PrivateToken::at(token).faucet(BIDDER_A_FUNDS));
    env.call_private(bidder_b, PrivateToken::at(token).faucet(BIDDER_B_FUNDS));

    let close_timestamp = env.last_block_timestamp() + 100;
    let reveal_deadline = close_timestamp + 100;
    env.call_public(
        seller,
        SealedAuction::at(auction).create_listing(
            LISTING_ID,
            token,
            RESERVE,
            close_timestamp,
            reveal_deadline,
            true,
            0, // category: mobile-goods
            0, // stake_bps
            0, // legal_closing_window
        ),
    );

    add_private_authwit_from_call(
        env,
        bidder_a,
        auction,
        PrivateToken::at(token).transfer_in_private(bidder_a, auction, BID_A, TOKEN_AUTHWIT_NONCE),
    );
    add_private_authwit_from_call(
        env,
        bidder_b,
        auction,
        PrivateToken::at(token).transfer_in_private(bidder_b, auction, BID_B, TOKEN_AUTHWIT_NONCE),
    );

    let commit_scopes = [auction, token];
    env.call_private_opts(
        bidder_a,
        CallPrivateOptions::new().with_additional_scopes(commit_scopes),
        SealedAuction::at(auction).commit_bid(LISTING_ID, BID_A, 0xabc1, TOKEN_AUTHWIT_NONCE),
    );
    env.call_private_opts(
        bidder_b,
        CallPrivateOptions::new().with_additional_scopes(commit_scopes),
        SealedAuction::at(auction).commit_bid(LISTING_ID, BID_B, 0xabc2, TOKEN_AUTHWIT_NONCE),
    );

    assert_eq(
        env.call_public(seller, SealedAuction::at(auction).get_commitment_count(LISTING_ID)),
        2,
        "both bids should be indexed as commitments",
    );
    let committed_a =
        env.call_public(seller, SealedAuction::at(auction).get_commitment(LISTING_ID, 0));
    let committed_b =
        env.call_public(seller, SealedAuction::at(auction).get_commitment(LISTING_ID, 1));
    assert(!committed_a.revealed, "first bid should be hidden before reveal");
    assert(!committed_b.revealed, "second bid should be hidden before reveal");
    assert_eq(committed_a.amount, 0, "first amount should not be public before reveal");
    assert_eq(committed_b.amount, 0, "second amount should not be public before reveal");

    env.mine_block_at(close_timestamp + 1);
    env.call_public(seller, SealedAuction::at(auction).close_auction(LISTING_ID));

    env.call_private_opts(
        bidder_a,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid(LISTING_ID, BID_A, 0xabc1),
    );
    env.call_private_opts(
        bidder_b,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid(LISTING_ID, BID_B, 0xabc2),
    );

    let revealed_a =
        env.call_public(seller, SealedAuction::at(auction).get_commitment(LISTING_ID, 0));
    let revealed_b =
        env.call_public(seller, SealedAuction::at(auction).get_commitment(LISTING_ID, 1));
    assert(revealed_a.revealed, "first bid should be revealed");
    assert(revealed_b.revealed, "second bid should be revealed");
    assert_eq(revealed_a.amount, BID_A);
    assert_eq(revealed_b.amount, BID_B);

    env.call_public(seller, SealedAuction::at(auction).finalize_settlement(LISTING_ID));
    let settlement = env.call_public(seller, SealedAuction::at(auction).get_settlement(LISTING_ID));
    let expected_winner_hash = poseidon2_hash([BID_B as Field, 0xabc2, bidder_b.to_field()]);
    assert(settlement.has_winner, "an eligible revealed bid should win");
    assert_eq(settlement.winner_hash, expected_winner_hash);
    assert_eq(settlement.winning_amount, BID_B);

    let finalized_a =
        env.call_public(seller, SealedAuction::at(auction).get_commitment(LISTING_ID, 0));
    let finalized_b =
        env.call_public(seller, SealedAuction::at(auction).get_commitment(LISTING_ID, 1));
    assert(!finalized_a.is_winner, "lower bid should not win");
    assert(finalized_b.is_winner, "highest bid should win");

    env.call_private_opts(
        bidder_a,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).claim_losing_bid(LISTING_ID),
    );
    env.call_private_opts(
        bidder_b,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).claim_winning_bid(LISTING_ID),
    );

    let bidder_a_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(bidder_a),
        PrivateToken::at(token).balance_of_private(bidder_a),
    );
    let bidder_b_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(bidder_b),
        PrivateToken::at(token).balance_of_private(bidder_b),
    );
    let seller_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(seller),
        PrivateToken::at(token).balance_of_private(seller),
    );
    let treasury_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(treasury),
        PrivateToken::at(token).balance_of_private(treasury),
    );

    assert_eq(bidder_a_balance, BIDDER_A_FUNDS, "loser should receive the full bid refund");
    assert_eq(bidder_b_balance, BIDDER_B_FUNDS - BID_B, "winner's locked bid should be paid out");
    assert_eq(
        seller_balance,
        BID_B - (BID_B * 300 / 10_000),
        "seller receives the winning bid less fee",
    );
    assert_eq(treasury_balance, BID_B * 300 / 10_000, "treasury receives the configured fee");
}


#[test]
unconstrained fn late_reveal_forfeits_penalty_to_treasury() {
    let mut env = TestEnvironment::new();
    let seller = env.create_light_account();
    let treasury = env.create_light_account();
    let bidder = env.create_contract_account();

    let listing_id: Field = 42;
    let reserve: u128 = 100;
    let bid_amount: u128 = 120;
    let bidder_funds: u128 = 500;
    let token_authwit_nonce: Field = 1;
    let salt: Field = 0xdead;

    let token = env.deploy("@private_token/PrivateToken").without_initializer();
    let auction = env.deploy("@sealed_auction/SealedAuction").with_public_initializer(
        seller,
        SealedAuction::interface().constructor(treasury),
    );

    env.call_private(bidder, PrivateToken::at(token).faucet(bidder_funds));

    let close_timestamp = env.last_block_timestamp() + 100;
    let reveal_deadline = close_timestamp + 100;
    env.call_public(
        seller,
        SealedAuction::at(auction).create_listing(
            listing_id,
            token,
            reserve,
            close_timestamp,
            reveal_deadline,
            true,
            0, // category: mobile-goods
            0, // stake_bps
            0, // legal_closing_window
        ),
    );

    add_private_authwit_from_call(
        env,
        bidder,
        auction,
        PrivateToken::at(token).transfer_in_private(bidder, auction, bid_amount, token_authwit_nonce),
    );

    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).commit_bid(listing_id, bid_amount, salt, token_authwit_nonce),
    );

    // Advance past the reveal deadline without ever calling reveal_bid.
    env.mine_block_at(reveal_deadline + 1);

    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).claim_late_reveal(listing_id, bid_amount, salt),
    );

    let bidder_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(bidder),
        PrivateToken::at(token).balance_of_private(bidder),
    );
    let treasury_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(treasury),
        PrivateToken::at(token).balance_of_private(treasury),
    );

    let penalty = bid_amount * 2000 / 10_000;
    let refund = bid_amount - penalty;

    assert_eq(
        bidder_balance,
        bidder_funds - bid_amount + refund,
        "late-reveal claimant should recover their bid minus the penalty",
    );
    assert_eq(treasury_balance, penalty, "treasury should receive the forfeited penalty");
    assert(refund < bid_amount, "late reveal must recover strictly less than the locked bid");
}


global REAL_ESTATE_LISTING_ID: Field = 91;
global REAL_ESTATE_STAKE_BPS: u16 = 1000; // 10% of the bid amount
global REAL_ESTATE_LEGAL_CLOSING_WINDOW: u64 = 1000;

#[test]
unconstrained fn real_estate_winner_stake_returns_after_closing_and_loser_gets_bid_plus_stake() {
    let mut env = TestEnvironment::new();
    let seller = env.create_light_account();
    let treasury = env.create_light_account();
    let losing_bidder = env.create_contract_account();
    let winning_bidder = env.create_contract_account();

    let reserve_price: u128 = 100;
    let losing_bid: u128 = 200;
    let winning_bid: u128 = 300;
    let losing_bidder_funds: u128 = 500;
    let winning_bidder_funds: u128 = 700;
    let token_authwit_nonce: Field = 1;
    let losing_salt: Field = 0xbeef1;
    let winning_salt: Field = 0xbeef2;

    // Same integer math as commit_bid in the contract.
    let losing_stake = losing_bid * (REAL_ESTATE_STAKE_BPS as u128) / 10_000;
    let winning_stake = winning_bid * (REAL_ESTATE_STAKE_BPS as u128) / 10_000;
    let losing_total_locked = losing_bid + losing_stake;
    let winning_total_locked = winning_bid + winning_stake;
    let settlement_fee = winning_bid * 300 / 10_000;

    let token = env.deploy("@private_token/PrivateToken").without_initializer();
    let auction = env.deploy("@sealed_auction/SealedAuction").with_public_initializer(
        seller,
        SealedAuction::interface().constructor(treasury),
    );

    env.call_private(losing_bidder, PrivateToken::at(token).faucet(losing_bidder_funds));
    env.call_private(winning_bidder, PrivateToken::at(token).faucet(winning_bidder_funds));

    let close_timestamp = env.last_block_timestamp() + 100;
    let reveal_deadline = close_timestamp + 100;
    env.call_public(
        seller,
        SealedAuction::at(auction).create_listing(
            REAL_ESTATE_LISTING_ID,
            token,
            reserve_price,
            close_timestamp,
            reveal_deadline,
            true,
            1, // category: real-estate
            REAL_ESTATE_STAKE_BPS,
            REAL_ESTATE_LEGAL_CLOSING_WINDOW,
        ),
    );

    // The token pull must cover bid AND stake, since commit_bid locks both.
    add_private_authwit_from_call(
        env,
        losing_bidder,
        auction,
        PrivateToken::at(token).transfer_in_private(
            losing_bidder,
            auction,
            losing_total_locked,
            token_authwit_nonce,
        ),
    );
    add_private_authwit_from_call(
        env,
        winning_bidder,
        auction,
        PrivateToken::at(token).transfer_in_private(
            winning_bidder,
            auction,
            winning_total_locked,
            token_authwit_nonce,
        ),
    );

    env.call_private_opts(
        losing_bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).commit_bid(
            REAL_ESTATE_LISTING_ID,
            losing_bid,
            losing_salt,
            token_authwit_nonce,
        ),
    );
    env.call_private_opts(
        winning_bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).commit_bid(
            REAL_ESTATE_LISTING_ID,
            winning_bid,
            winning_salt,
            token_authwit_nonce,
        ),
    );

    let losing_balance_after_commit = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(losing_bidder),
        PrivateToken::at(token).balance_of_private(losing_bidder),
    );
    let winning_balance_after_commit = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(winning_bidder),
        PrivateToken::at(token).balance_of_private(winning_bidder),
    );
    assert_eq(
        losing_balance_after_commit,
        losing_bidder_funds - losing_total_locked,
        "commit should lock the loser's bid plus stake",
    );
    assert_eq(
        winning_balance_after_commit,
        winning_bidder_funds - winning_total_locked,
        "commit should lock the winner's bid plus stake",
    );

    env.mine_block_at(close_timestamp + 1);
    env.call_public(seller, SealedAuction::at(auction).close_auction(REAL_ESTATE_LISTING_ID));

    env.call_private_opts(
        losing_bidder,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid(REAL_ESTATE_LISTING_ID, losing_bid, losing_salt),
    );
    env.call_private_opts(
        winning_bidder,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid(REAL_ESTATE_LISTING_ID, winning_bid, winning_salt),
    );

    env.call_public(seller, SealedAuction::at(auction).finalize_settlement(REAL_ESTATE_LISTING_ID));

    // Loser recovers bid and stake together, no penalty for simply losing.
    env.call_private_opts(
        losing_bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).claim_losing_bid(REAL_ESTATE_LISTING_ID),
    );
    // Winner's bid is paid out, but the stake must stay locked.
    env.call_private_opts(
        winning_bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).claim_winning_bid(REAL_ESTATE_LISTING_ID),
    );

    let losing_balance_after_claims = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(losing_bidder),
        PrivateToken::at(token).balance_of_private(losing_bidder),
    );
    let winning_balance_before_closing = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(winning_bidder),
        PrivateToken::at(token).balance_of_private(winning_bidder),
    );
    assert_eq(
        losing_balance_after_claims,
        losing_bidder_funds,
        "loser should get back the full bid plus stake",
    );
    assert_eq(
        winning_balance_before_closing,
        winning_bidder_funds - winning_total_locked,
        "winner's stake must stay locked until closing is confirmed",
    );

    // Seller confirms off-chain legal closing, which unlocks the stake claim.
    env.call_public(seller, SealedAuction::at(auction).confirm_closing(REAL_ESTATE_LISTING_ID));
    env.call_private_opts(
        winning_bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).claim_stake_after_closing(REAL_ESTATE_LISTING_ID),
    );

    let winning_balance_after_stake = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(winning_bidder),
        PrivateToken::at(token).balance_of_private(winning_bidder),
    );
    let seller_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(seller),
        PrivateToken::at(token).balance_of_private(seller),
    );
    let treasury_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(treasury),
        PrivateToken::at(token).balance_of_private(treasury),
    );
    assert_eq(
        winning_balance_after_stake,
        winning_bidder_funds - winning_bid,
        "winner should be out only the winning bid once the stake returns",
    );
    assert_eq(
        seller_balance,
        winning_bid - settlement_fee,
        "seller receives the winning bid less fee",
    );
    assert_eq(treasury_balance, settlement_fee, "treasury receives only the fee, never the stake");
}


#[test(should_fail)]
unconstrained fn real_estate_stake_claim_before_closing_confirmation_reverts() {
    let mut env = TestEnvironment::new();
    let seller = env.create_light_account();
    let treasury = env.create_light_account();
    let bidder = env.create_contract_account();

    let bid_amount: u128 = 300;
    let stake_amount = bid_amount * (REAL_ESTATE_STAKE_BPS as u128) / 10_000;
    let total_locked = bid_amount + stake_amount;
    let token_authwit_nonce: Field = 1;
    let salt: Field = 0xbeef3;

    let token = env.deploy("@private_token/PrivateToken").without_initializer();
    let auction = env.deploy("@sealed_auction/SealedAuction").with_public_initializer(
        seller,
        SealedAuction::interface().constructor(treasury),
    );
    env.call_private(bidder, PrivateToken::at(token).faucet(700));

    let close_timestamp = env.last_block_timestamp() + 100;
    let reveal_deadline = close_timestamp + 100;
    env.call_public(
        seller,
        SealedAuction::at(auction).create_listing(
            REAL_ESTATE_LISTING_ID,
            token,
            100,
            close_timestamp,
            reveal_deadline,
            true,
            1,
            REAL_ESTATE_STAKE_BPS,
            REAL_ESTATE_LEGAL_CLOSING_WINDOW,
        ),
    );
    add_private_authwit_from_call(
        env,
        bidder,
        auction,
        PrivateToken::at(token).transfer_in_private(bidder, auction, total_locked, token_authwit_nonce),
    );
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).commit_bid(REAL_ESTATE_LISTING_ID, bid_amount, salt, token_authwit_nonce),
    );
    env.mine_block_at(close_timestamp + 1);
    env.call_public(seller, SealedAuction::at(auction).close_auction(REAL_ESTATE_LISTING_ID));
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid(REAL_ESTATE_LISTING_ID, bid_amount, salt),
    );
    env.call_public(seller, SealedAuction::at(auction).finalize_settlement(REAL_ESTATE_LISTING_ID));
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).claim_winning_bid(REAL_ESTATE_LISTING_ID),
    );

    // No confirm_closing here. This last call must revert.
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).claim_stake_after_closing(REAL_ESTATE_LISTING_ID),
    );
}


#[test]
unconstrained fn relayer_reveals_for_both_bidders_then_normal_claims() {
    let mut env = TestEnvironment::new();
    let seller = env.create_light_account();
    let treasury = env.create_light_account();
    let relayer = env.create_light_account();
    let bidder_a = env.create_contract_account();
    let bidder_b = env.create_contract_account();

    let token = env.deploy("@private_token/PrivateToken").without_initializer();
    let auction = env.deploy("@sealed_auction/SealedAuction").with_public_initializer(
        seller,
        SealedAuction::interface().constructor(treasury),
    );

    env.call_private(bidder_a, PrivateToken::at(token).faucet(BIDDER_A_FUNDS));
    env.call_private(bidder_b, PrivateToken::at(token).faucet(BIDDER_B_FUNDS));

    let close_timestamp = env.last_block_timestamp() + 100;
    let reveal_deadline = close_timestamp + 100;
    env.call_public(
        seller,
        SealedAuction::at(auction).create_listing(
            LISTING_ID,
            token,
            RESERVE,
            close_timestamp,
            reveal_deadline,
            true,
            0,
            0,
            0,
        ),
    );

    add_private_authwit_from_call(
        env,
        bidder_a,
        auction,
        PrivateToken::at(token).transfer_in_private(bidder_a, auction, BID_A, TOKEN_AUTHWIT_NONCE),
    );
    add_private_authwit_from_call(
        env,
        bidder_b,
        auction,
        PrivateToken::at(token).transfer_in_private(bidder_b, auction, BID_B, TOKEN_AUTHWIT_NONCE),
    );
    env.call_private_opts(
        bidder_a,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).commit_bid(LISTING_ID, BID_A, 0xabc1, TOKEN_AUTHWIT_NONCE),
    );
    env.call_private_opts(
        bidder_b,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).commit_bid(LISTING_ID, BID_B, 0xabc2, TOKEN_AUTHWIT_NONCE),
    );

    env.mine_block_at(close_timestamp + 1);
    env.call_public(seller, SealedAuction::at(auction).close_auction(LISTING_ID));

    // A third account, holding only the preimages, reveals for both bidders.
    env.call_private_opts(
        relayer,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid_for(LISTING_ID, BID_A, 0xabc1, bidder_a),
    );
    env.call_private_opts(
        relayer,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid_for(LISTING_ID, BID_B, 0xabc2, bidder_b),
    );

    let revealed_a =
        env.call_public(seller, SealedAuction::at(auction).get_commitment(LISTING_ID, 0));
    let revealed_b =
        env.call_public(seller, SealedAuction::at(auction).get_commitment(LISTING_ID, 1));
    assert(revealed_a.revealed, "relayer reveal should mark the first record revealed");
    assert(revealed_b.revealed, "relayer reveal should mark the second record revealed");
    assert_eq(revealed_a.amount, BID_A);
    assert_eq(revealed_b.amount, BID_B);

    env.call_public(seller, SealedAuction::at(auction).finalize_settlement(LISTING_ID));
    let settlement = env.call_public(seller, SealedAuction::at(auction).get_settlement(LISTING_ID));
    assert(settlement.has_winner, "an eligible revealed bid should win");
    assert_eq(settlement.winning_amount, BID_B);
    assert_eq(settlement.winner_hash, poseidon2_hash([BID_B as Field, 0xabc2, bidder_b.to_field()]));

    // The bidders' notes still say unrevealed; the normal claims must still work.
    env.call_private_opts(
        bidder_a,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).claim_losing_bid(LISTING_ID),
    );
    env.call_private_opts(
        bidder_b,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).claim_winning_bid(LISTING_ID),
    );

    let bidder_a_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(bidder_a),
        PrivateToken::at(token).balance_of_private(bidder_a),
    );
    let bidder_b_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(bidder_b),
        PrivateToken::at(token).balance_of_private(bidder_b),
    );
    let seller_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(seller),
        PrivateToken::at(token).balance_of_private(seller),
    );
    let treasury_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(treasury),
        PrivateToken::at(token).balance_of_private(treasury),
    );
    assert_eq(bidder_a_balance, BIDDER_A_FUNDS, "loser should get the full bid back");
    assert_eq(bidder_b_balance, BIDDER_B_FUNDS - BID_B, "winner's bid should be paid out");
    assert_eq(seller_balance, BID_B - (BID_B * 300 / 10_000), "seller receives bid less fee");
    assert_eq(treasury_balance, BID_B * 300 / 10_000, "treasury receives the fee");
}


#[test(should_fail)]
unconstrained fn reveal_bid_for_wrong_salt_reverts() {
    let mut env = TestEnvironment::new();
    let seller = env.create_light_account();
    let treasury = env.create_light_account();
    let relayer = env.create_light_account();
    let bidder = env.create_contract_account();

    let bid_amount: u128 = BID_A;
    let salt: Field = 0x5a17;

    let token = env.deploy("@private_token/PrivateToken").without_initializer();
    let auction = env.deploy("@sealed_auction/SealedAuction").with_public_initializer(
        seller,
        SealedAuction::interface().constructor(treasury),
    );
    env.call_private(bidder, PrivateToken::at(token).faucet(BIDDER_A_FUNDS));

    let close_timestamp = env.last_block_timestamp() + 100;
    let reveal_deadline = close_timestamp + 100;
    env.call_public(
        seller,
        SealedAuction::at(auction).create_listing(
            LISTING_ID,
            token,
            RESERVE,
            close_timestamp,
            reveal_deadline,
            true,
            0,
            0,
            0,
        ),
    );
    add_private_authwit_from_call(
        env,
        bidder,
        auction,
        PrivateToken::at(token).transfer_in_private(bidder, auction, bid_amount, TOKEN_AUTHWIT_NONCE),
    );
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).commit_bid(LISTING_ID, bid_amount, salt, TOKEN_AUTHWIT_NONCE),
    );
    env.mine_block_at(close_timestamp + 1);
    env.call_public(seller, SealedAuction::at(auction).close_auction(LISTING_ID));

    // No other call is illegal. This last call must revert on the salt alone.
    let submitted_salt: Field = salt + 1;
    env.call_private_opts(
        relayer,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid_for(LISTING_ID, bid_amount, submitted_salt, bidder),
    );
}


#[test(should_fail)]
unconstrained fn reveal_bid_for_wrong_amount_reverts() {
    let mut env = TestEnvironment::new();
    let seller = env.create_light_account();
    let treasury = env.create_light_account();
    let relayer = env.create_light_account();
    let bidder = env.create_contract_account();

    let bid_amount: u128 = BID_A;
    let salt: Field = 0x5a18;

    let token = env.deploy("@private_token/PrivateToken").without_initializer();
    let auction = env.deploy("@sealed_auction/SealedAuction").with_public_initializer(
        seller,
        SealedAuction::interface().constructor(treasury),
    );
    env.call_private(bidder, PrivateToken::at(token).faucet(BIDDER_A_FUNDS));

    let close_timestamp = env.last_block_timestamp() + 100;
    let reveal_deadline = close_timestamp + 100;
    env.call_public(
        seller,
        SealedAuction::at(auction).create_listing(
            LISTING_ID,
            token,
            RESERVE,
            close_timestamp,
            reveal_deadline,
            true,
            0,
            0,
            0,
        ),
    );
    add_private_authwit_from_call(
        env,
        bidder,
        auction,
        PrivateToken::at(token).transfer_in_private(bidder, auction, bid_amount, TOKEN_AUTHWIT_NONCE),
    );
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).commit_bid(LISTING_ID, bid_amount, salt, TOKEN_AUTHWIT_NONCE),
    );
    env.mine_block_at(close_timestamp + 1);
    env.call_public(seller, SealedAuction::at(auction).close_auction(LISTING_ID));

    let submitted_amount: u128 = bid_amount + 1;
    env.call_private_opts(
        relayer,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid_for(LISTING_ID, submitted_amount, salt, bidder),
    );
}


#[test(should_fail)]
unconstrained fn reveal_bid_for_wrong_bidder_reverts() {
    let mut env = TestEnvironment::new();
    let seller = env.create_light_account();
    let treasury = env.create_light_account();
    let relayer = env.create_light_account();
    let wrong_bidder = env.create_light_account();
    let bidder = env.create_contract_account();

    let bid_amount: u128 = BID_A;
    let salt: Field = 0x5a19;

    let token = env.deploy("@private_token/PrivateToken").without_initializer();
    let auction = env.deploy("@sealed_auction/SealedAuction").with_public_initializer(
        seller,
        SealedAuction::interface().constructor(treasury),
    );
    env.call_private(bidder, PrivateToken::at(token).faucet(BIDDER_A_FUNDS));

    let close_timestamp = env.last_block_timestamp() + 100;
    let reveal_deadline = close_timestamp + 100;
    env.call_public(
        seller,
        SealedAuction::at(auction).create_listing(
            LISTING_ID,
            token,
            RESERVE,
            close_timestamp,
            reveal_deadline,
            true,
            0,
            0,
            0,
        ),
    );
    add_private_authwit_from_call(
        env,
        bidder,
        auction,
        PrivateToken::at(token).transfer_in_private(bidder, auction, bid_amount, TOKEN_AUTHWIT_NONCE),
    );
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).commit_bid(LISTING_ID, bid_amount, salt, TOKEN_AUTHWIT_NONCE),
    );
    env.mine_block_at(close_timestamp + 1);
    env.call_public(seller, SealedAuction::at(auction).close_auction(LISTING_ID));

    let submitted_bidder = wrong_bidder;
    env.call_private_opts(
        relayer,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid_for(LISTING_ID, bid_amount, salt, submitted_bidder),
    );
}


#[test(should_fail)]
unconstrained fn late_reveal_claim_after_relayer_reveal_reverts() {
    let mut env = TestEnvironment::new();
    let seller = env.create_light_account();
    let treasury = env.create_light_account();
    let relayer = env.create_light_account();
    let bidder = env.create_contract_account();

    let bid_amount: u128 = BID_A;
    let salt: Field = 0x5a20;

    let token = env.deploy("@private_token/PrivateToken").without_initializer();
    let auction = env.deploy("@sealed_auction/SealedAuction").with_public_initializer(
        seller,
        SealedAuction::interface().constructor(treasury),
    );
    env.call_private(bidder, PrivateToken::at(token).faucet(BIDDER_A_FUNDS));

    let close_timestamp = env.last_block_timestamp() + 100;
    let reveal_deadline = close_timestamp + 100;
    env.call_public(
        seller,
        SealedAuction::at(auction).create_listing(
            LISTING_ID,
            token,
            RESERVE,
            close_timestamp,
            reveal_deadline,
            true,
            0,
            0,
            0,
        ),
    );
    add_private_authwit_from_call(
        env,
        bidder,
        auction,
        PrivateToken::at(token).transfer_in_private(bidder, auction, bid_amount, TOKEN_AUTHWIT_NONCE),
    );
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).commit_bid(LISTING_ID, bid_amount, salt, TOKEN_AUTHWIT_NONCE),
    );
    env.mine_block_at(close_timestamp + 1);
    env.call_public(seller, SealedAuction::at(auction).close_auction(LISTING_ID));

    // Relayer reveals on time, so the bidder's note still says unrevealed.
    env.call_private_opts(
        relayer,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid_for(LISTING_ID, bid_amount, salt, bidder),
    );

    // After the deadline the bidder must NOT be able to take the penalty path.
    env.mine_block_at(reveal_deadline + 1);
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).claim_late_reveal(LISTING_ID, bid_amount, salt),
    );
}


#[test]
unconstrained fn settle_winning_bid_pays_seller_without_winner_then_stake_returns() {
    let mut env = TestEnvironment::new();
    let seller = env.create_light_account();
    let treasury = env.create_light_account();
    let relayer = env.create_light_account();
    let bidder = env.create_contract_account();

    let bid_amount: u128 = 300;
    let stake_amount = bid_amount * (REAL_ESTATE_STAKE_BPS as u128) / 10_000;
    let total_locked = bid_amount + stake_amount;
    let settlement_fee = bid_amount * 300 / 10_000;
    let bidder_funds: u128 = 700;
    let salt: Field = 0x5e01;

    let token = env.deploy("@private_token/PrivateToken").without_initializer();
    let auction = env.deploy("@sealed_auction/SealedAuction").with_public_initializer(
        seller,
        SealedAuction::interface().constructor(treasury),
    );
    env.call_private(bidder, PrivateToken::at(token).faucet(bidder_funds));

    let close_timestamp = env.last_block_timestamp() + 100;
    let reveal_deadline = close_timestamp + 100;
    env.call_public(
        seller,
        SealedAuction::at(auction).create_listing(
            REAL_ESTATE_LISTING_ID,
            token,
            100,
            close_timestamp,
            reveal_deadline,
            true,
            1,
            REAL_ESTATE_STAKE_BPS,
            REAL_ESTATE_LEGAL_CLOSING_WINDOW,
        ),
    );
    add_private_authwit_from_call(
        env,
        bidder,
        auction,
        PrivateToken::at(token).transfer_in_private(bidder, auction, total_locked, TOKEN_AUTHWIT_NONCE),
    );
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).commit_bid(REAL_ESTATE_LISTING_ID, bid_amount, salt, TOKEN_AUTHWIT_NONCE),
    );
    env.mine_block_at(close_timestamp + 1);
    env.call_public(seller, SealedAuction::at(auction).close_auction(REAL_ESTATE_LISTING_ID));
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid(REAL_ESTATE_LISTING_ID, bid_amount, salt),
    );
    env.call_public(seller, SealedAuction::at(auction).finalize_settlement(REAL_ESTATE_LISTING_ID));

    env.call_private_opts(
        relayer,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).settle_winning_bid(REAL_ESTATE_LISTING_ID, bid_amount),
    );
    let seller_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(seller),
        PrivateToken::at(token).balance_of_private(seller),
    );
    let treasury_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(treasury),
        PrivateToken::at(token).balance_of_private(treasury),
    );
    let bidder_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(bidder),
        PrivateToken::at(token).balance_of_private(bidder),
    );
    assert_eq(seller_balance, bid_amount - settlement_fee, "seller is paid without the winner acting");
    assert_eq(treasury_balance, settlement_fee, "treasury receives the fee");
    assert_eq(bidder_balance, bidder_funds - total_locked, "winner's stake stays locked after a relayer payout");
    env.call_public(seller, SealedAuction::at(auction).confirm_closing(REAL_ESTATE_LISTING_ID));
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).claim_stake_after_closing(REAL_ESTATE_LISTING_ID),
    );
    let bidder_balance_after_stake = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(bidder),
        PrivateToken::at(token).balance_of_private(bidder),
    );
    let seller_balance_after_stake = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(seller),
        PrivateToken::at(token).balance_of_private(seller),
    );
    assert_eq(bidder_balance_after_stake, bidder_funds - bid_amount, "stake returns after closing even though the note never saw the bid claim");
    assert_eq(seller_balance_after_stake, bid_amount - settlement_fee, "seller balance is unchanged by the stake claim");
}


#[test(should_fail)]
unconstrained fn winner_claim_after_permissionless_settle_reverts() {
    let mut env = TestEnvironment::new();
    let seller = env.create_light_account();
    let treasury = env.create_light_account();
    let relayer = env.create_light_account();
    let bidder = env.create_contract_account();

    let bid_amount: u128 = 300;
    let stake_amount = bid_amount * (REAL_ESTATE_STAKE_BPS as u128) / 10_000;
    let total_locked = bid_amount + stake_amount;
    let settlement_fee = bid_amount * 300 / 10_000;
    let bidder_funds: u128 = 700;
    let salt: Field = 0x5e02;

    let token = env.deploy("@private_token/PrivateToken").without_initializer();
    let auction = env.deploy("@sealed_auction/SealedAuction").with_public_initializer(
        seller,
        SealedAuction::interface().constructor(treasury),
    );
    env.call_private(bidder, PrivateToken::at(token).faucet(bidder_funds));

    let close_timestamp = env.last_block_timestamp() + 100;
    let reveal_deadline = close_timestamp + 100;
    env.call_public(
        seller,
        SealedAuction::at(auction).create_listing(
            REAL_ESTATE_LISTING_ID,
            token,
            100,
            close_timestamp,
            reveal_deadline,
            true,
            1,
            REAL_ESTATE_STAKE_BPS,
            REAL_ESTATE_LEGAL_CLOSING_WINDOW,
        ),
    );
    add_private_authwit_from_call(
        env,
        bidder,
        auction,
        PrivateToken::at(token).transfer_in_private(bidder, auction, total_locked, TOKEN_AUTHWIT_NONCE),
    );
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).commit_bid(REAL_ESTATE_LISTING_ID, bid_amount, salt, TOKEN_AUTHWIT_NONCE),
    );
    env.mine_block_at(close_timestamp + 1);
    env.call_public(seller, SealedAuction::at(auction).close_auction(REAL_ESTATE_LISTING_ID));
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid(REAL_ESTATE_LISTING_ID, bid_amount, salt),
    );
    env.call_public(seller, SealedAuction::at(auction).finalize_settlement(REAL_ESTATE_LISTING_ID));

    let relayer_settles_first: bool = true;
    if relayer_settles_first {
        env.call_private_opts(
            relayer,
            CallPrivateOptions::new().with_additional_scopes([auction, token]),
            SealedAuction::at(auction).settle_winning_bid(REAL_ESTATE_LISTING_ID, bid_amount),
        );
    }
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).claim_winning_bid(REAL_ESTATE_LISTING_ID),
    );
}


#[test(should_fail)]
unconstrained fn permissionless_settle_after_winner_claim_reverts() {
    let mut env = TestEnvironment::new();
    let seller = env.create_light_account();
    let treasury = env.create_light_account();
    let relayer = env.create_light_account();
    let bidder = env.create_contract_account();

    let bid_amount: u128 = 300;
    let stake_amount = bid_amount * (REAL_ESTATE_STAKE_BPS as u128) / 10_000;
    let total_locked = bid_amount + stake_amount;
    let settlement_fee = bid_amount * 300 / 10_000;
    let bidder_funds: u128 = 700;
    let salt: Field = 0x5e03;

    let token = env.deploy("@private_token/PrivateToken").without_initializer();
    let auction = env.deploy("@sealed_auction/SealedAuction").with_public_initializer(
        seller,
        SealedAuction::interface().constructor(treasury),
    );
    env.call_private(bidder, PrivateToken::at(token).faucet(bidder_funds));

    let close_timestamp = env.last_block_timestamp() + 100;
    let reveal_deadline = close_timestamp + 100;
    env.call_public(
        seller,
        SealedAuction::at(auction).create_listing(
            REAL_ESTATE_LISTING_ID,
            token,
            100,
            close_timestamp,
            reveal_deadline,
            true,
            1,
            REAL_ESTATE_STAKE_BPS,
            REAL_ESTATE_LEGAL_CLOSING_WINDOW,
        ),
    );
    add_private_authwit_from_call(
        env,
        bidder,
        auction,
        PrivateToken::at(token).transfer_in_private(bidder, auction, total_locked, TOKEN_AUTHWIT_NONCE),
    );
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).commit_bid(REAL_ESTATE_LISTING_ID, bid_amount, salt, TOKEN_AUTHWIT_NONCE),
    );
    env.mine_block_at(close_timestamp + 1);
    env.call_public(seller, SealedAuction::at(auction).close_auction(REAL_ESTATE_LISTING_ID));
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid(REAL_ESTATE_LISTING_ID, bid_amount, salt),
    );
    env.call_public(seller, SealedAuction::at(auction).finalize_settlement(REAL_ESTATE_LISTING_ID));

    let winner_claims_first: bool = true;
    if winner_claims_first {
        env.call_private_opts(
            bidder,
            CallPrivateOptions::new().with_additional_scopes([auction, token]),
            SealedAuction::at(auction).claim_winning_bid(REAL_ESTATE_LISTING_ID),
        );
    }
    env.call_private_opts(
        relayer,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).settle_winning_bid(REAL_ESTATE_LISTING_ID, bid_amount),
    );
}


#[test]
unconstrained fn slash_after_legal_closing_deadline_pays_stake_to_seller() {
    let mut env = TestEnvironment::new();
    let seller = env.create_light_account();
    let treasury = env.create_light_account();
    let relayer = env.create_light_account();
    let bidder = env.create_contract_account();

    let bid_amount: u128 = 300;
    let stake_amount = bid_amount * (REAL_ESTATE_STAKE_BPS as u128) / 10_000;
    let total_locked = bid_amount + stake_amount;
    let settlement_fee = bid_amount * 300 / 10_000;
    let bidder_funds: u128 = 700;
    let salt: Field = 0x5e04;

    let token = env.deploy("@private_token/PrivateToken").without_initializer();
    let auction = env.deploy("@sealed_auction/SealedAuction").with_public_initializer(
        seller,
        SealedAuction::interface().constructor(treasury),
    );
    env.call_private(bidder, PrivateToken::at(token).faucet(bidder_funds));

    let close_timestamp = env.last_block_timestamp() + 100;
    let reveal_deadline = close_timestamp + 100;
    env.call_public(
        seller,
        SealedAuction::at(auction).create_listing(
            REAL_ESTATE_LISTING_ID,
            token,
            100,
            close_timestamp,
            reveal_deadline,
            true,
            1,
            REAL_ESTATE_STAKE_BPS,
            REAL_ESTATE_LEGAL_CLOSING_WINDOW,
        ),
    );
    add_private_authwit_from_call(
        env,
        bidder,
        auction,
        PrivateToken::at(token).transfer_in_private(bidder, auction, total_locked, TOKEN_AUTHWIT_NONCE),
    );
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).commit_bid(REAL_ESTATE_LISTING_ID, bid_amount, salt, TOKEN_AUTHWIT_NONCE),
    );
    env.mine_block_at(close_timestamp + 1);
    env.call_public(seller, SealedAuction::at(auction).close_auction(REAL_ESTATE_LISTING_ID));
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid(REAL_ESTATE_LISTING_ID, bid_amount, salt),
    );
    env.call_public(seller, SealedAuction::at(auction).finalize_settlement(REAL_ESTATE_LISTING_ID));

    env.call_private_opts(
        relayer,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).settle_winning_bid(REAL_ESTATE_LISTING_ID, bid_amount),
    );
    env.mine_block_at(reveal_deadline + 5 * REAL_ESTATE_LEGAL_CLOSING_WINDOW);
    env.call_private_opts(
        relayer,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).slash_stake_for_default(REAL_ESTATE_LISTING_ID, bid_amount),
    );
    let seller_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(seller),
        PrivateToken::at(token).balance_of_private(seller),
    );
    let treasury_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(treasury),
        PrivateToken::at(token).balance_of_private(treasury),
    );
    let bidder_balance = env.execute_utility_opts(
        ExecuteUtilityOptions::new().with_from(bidder),
        PrivateToken::at(token).balance_of_private(bidder),
    );
    // SLASH_SELLER_SHARE_BPS is 10_000: the whole stake goes to the seller.
    assert_eq(seller_balance, bid_amount - settlement_fee + stake_amount, "seller gets the winning bid less fee plus the slashed stake");
    assert_eq(treasury_balance, settlement_fee, "treasury gets only the fee");
    assert_eq(bidder_balance, bidder_funds - total_locked, "defaulting winner loses bid and stake");
}


#[test(should_fail)]
unconstrained fn slash_before_legal_closing_deadline_reverts() {
    let mut env = TestEnvironment::new();
    let seller = env.create_light_account();
    let treasury = env.create_light_account();
    let relayer = env.create_light_account();
    let bidder = env.create_contract_account();

    let bid_amount: u128 = 300;
    let stake_amount = bid_amount * (REAL_ESTATE_STAKE_BPS as u128) / 10_000;
    let total_locked = bid_amount + stake_amount;
    let settlement_fee = bid_amount * 300 / 10_000;
    let bidder_funds: u128 = 700;
    let salt: Field = 0x5e05;

    let token = env.deploy("@private_token/PrivateToken").without_initializer();
    let auction = env.deploy("@sealed_auction/SealedAuction").with_public_initializer(
        seller,
        SealedAuction::interface().constructor(treasury),
    );
    env.call_private(bidder, PrivateToken::at(token).faucet(bidder_funds));

    let close_timestamp = env.last_block_timestamp() + 100;
    let reveal_deadline = close_timestamp + 100;
    env.call_public(
        seller,
        SealedAuction::at(auction).create_listing(
            REAL_ESTATE_LISTING_ID,
            token,
            100,
            close_timestamp,
            reveal_deadline,
            true,
            1,
            REAL_ESTATE_STAKE_BPS,
            REAL_ESTATE_LEGAL_CLOSING_WINDOW,
        ),
    );
    add_private_authwit_from_call(
        env,
        bidder,
        auction,
        PrivateToken::at(token).transfer_in_private(bidder, auction, total_locked, TOKEN_AUTHWIT_NONCE),
    );
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).commit_bid(REAL_ESTATE_LISTING_ID, bid_amount, salt, TOKEN_AUTHWIT_NONCE),
    );
    env.mine_block_at(close_timestamp + 1);
    env.call_public(seller, SealedAuction::at(auction).close_auction(REAL_ESTATE_LISTING_ID));
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid(REAL_ESTATE_LISTING_ID, bid_amount, salt),
    );
    env.call_public(seller, SealedAuction::at(auction).finalize_settlement(REAL_ESTATE_LISTING_ID));

    env.call_private_opts(
        relayer,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).settle_winning_bid(REAL_ESTATE_LISTING_ID, bid_amount),
    );
    let mine_past_deadline: bool = false;
    if mine_past_deadline {
        env.mine_block_at(reveal_deadline + 5 * REAL_ESTATE_LEGAL_CLOSING_WINDOW);
    }
    env.call_private_opts(
        relayer,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).slash_stake_for_default(REAL_ESTATE_LISTING_ID, bid_amount),
    );
}


#[test(should_fail)]
unconstrained fn slash_after_confirm_closing_reverts() {
    let mut env = TestEnvironment::new();
    let seller = env.create_light_account();
    let treasury = env.create_light_account();
    let relayer = env.create_light_account();
    let bidder = env.create_contract_account();

    let bid_amount: u128 = 300;
    let stake_amount = bid_amount * (REAL_ESTATE_STAKE_BPS as u128) / 10_000;
    let total_locked = bid_amount + stake_amount;
    let settlement_fee = bid_amount * 300 / 10_000;
    let bidder_funds: u128 = 700;
    let salt: Field = 0x5e06;

    let token = env.deploy("@private_token/PrivateToken").without_initializer();
    let auction = env.deploy("@sealed_auction/SealedAuction").with_public_initializer(
        seller,
        SealedAuction::interface().constructor(treasury),
    );
    env.call_private(bidder, PrivateToken::at(token).faucet(bidder_funds));

    let close_timestamp = env.last_block_timestamp() + 100;
    let reveal_deadline = close_timestamp + 100;
    env.call_public(
        seller,
        SealedAuction::at(auction).create_listing(
            REAL_ESTATE_LISTING_ID,
            token,
            100,
            close_timestamp,
            reveal_deadline,
            true,
            1,
            REAL_ESTATE_STAKE_BPS,
            REAL_ESTATE_LEGAL_CLOSING_WINDOW,
        ),
    );
    add_private_authwit_from_call(
        env,
        bidder,
        auction,
        PrivateToken::at(token).transfer_in_private(bidder, auction, total_locked, TOKEN_AUTHWIT_NONCE),
    );
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).commit_bid(REAL_ESTATE_LISTING_ID, bid_amount, salt, TOKEN_AUTHWIT_NONCE),
    );
    env.mine_block_at(close_timestamp + 1);
    env.call_public(seller, SealedAuction::at(auction).close_auction(REAL_ESTATE_LISTING_ID));
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid(REAL_ESTATE_LISTING_ID, bid_amount, salt),
    );
    env.call_public(seller, SealedAuction::at(auction).finalize_settlement(REAL_ESTATE_LISTING_ID));

    env.call_private_opts(
        relayer,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).settle_winning_bid(REAL_ESTATE_LISTING_ID, bid_amount),
    );
    env.mine_block_at(reveal_deadline + 5 * REAL_ESTATE_LEGAL_CLOSING_WINDOW);
    let seller_confirms_closing: bool = true;
    if seller_confirms_closing {
        env.call_public(seller, SealedAuction::at(auction).confirm_closing(REAL_ESTATE_LISTING_ID));
    }
    env.call_private_opts(
        relayer,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).slash_stake_for_default(REAL_ESTATE_LISTING_ID, bid_amount),
    );
}


#[test(should_fail)]
unconstrained fn winner_stake_claim_after_slash_reverts() {
    let mut env = TestEnvironment::new();
    let seller = env.create_light_account();
    let treasury = env.create_light_account();
    let relayer = env.create_light_account();
    let bidder = env.create_contract_account();

    let bid_amount: u128 = 300;
    let stake_amount = bid_amount * (REAL_ESTATE_STAKE_BPS as u128) / 10_000;
    let total_locked = bid_amount + stake_amount;
    let settlement_fee = bid_amount * 300 / 10_000;
    let bidder_funds: u128 = 700;
    let salt: Field = 0x5e07;

    let token = env.deploy("@private_token/PrivateToken").without_initializer();
    let auction = env.deploy("@sealed_auction/SealedAuction").with_public_initializer(
        seller,
        SealedAuction::interface().constructor(treasury),
    );
    env.call_private(bidder, PrivateToken::at(token).faucet(bidder_funds));

    let close_timestamp = env.last_block_timestamp() + 100;
    let reveal_deadline = close_timestamp + 100;
    env.call_public(
        seller,
        SealedAuction::at(auction).create_listing(
            REAL_ESTATE_LISTING_ID,
            token,
            100,
            close_timestamp,
            reveal_deadline,
            true,
            1,
            REAL_ESTATE_STAKE_BPS,
            REAL_ESTATE_LEGAL_CLOSING_WINDOW,
        ),
    );
    add_private_authwit_from_call(
        env,
        bidder,
        auction,
        PrivateToken::at(token).transfer_in_private(bidder, auction, total_locked, TOKEN_AUTHWIT_NONCE),
    );
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).commit_bid(REAL_ESTATE_LISTING_ID, bid_amount, salt, TOKEN_AUTHWIT_NONCE),
    );
    env.mine_block_at(close_timestamp + 1);
    env.call_public(seller, SealedAuction::at(auction).close_auction(REAL_ESTATE_LISTING_ID));
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction]),
        SealedAuction::at(auction).reveal_bid(REAL_ESTATE_LISTING_ID, bid_amount, salt),
    );
    env.call_public(seller, SealedAuction::at(auction).finalize_settlement(REAL_ESTATE_LISTING_ID));

    env.call_private_opts(
        relayer,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).settle_winning_bid(REAL_ESTATE_LISTING_ID, bid_amount),
    );
    env.mine_block_at(reveal_deadline + 5 * REAL_ESTATE_LEGAL_CLOSING_WINDOW);
    let slash_happens: bool = true;
    if slash_happens {
        env.call_private_opts(
            relayer,
            CallPrivateOptions::new().with_additional_scopes([auction, token]),
            SealedAuction::at(auction).slash_stake_for_default(REAL_ESTATE_LISTING_ID, bid_amount),
        );
    }
    env.call_public(seller, SealedAuction::at(auction).confirm_closing(REAL_ESTATE_LISTING_ID));
    env.call_private_opts(
        bidder,
        CallPrivateOptions::new().with_additional_scopes([auction, token]),
        SealedAuction::at(auction).claim_stake_after_closing(REAL_ESTATE_LISTING_ID),
    );
}
