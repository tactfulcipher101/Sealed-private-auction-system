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
