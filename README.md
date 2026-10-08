# Sealed Private Auction System

Sealed is a sealed-bid auction written in Noir for the Aztec network. Bids are committed privately and revealed only after the auction closes. This is an early prototype. Read "Status and limits" before relying on it.

## Status and limits

- The payment token in this repo (`PrivateToken`) is a test-only faucet fixture. It is not USDC or any real asset. The interface of a real token's private transfer has not been verified against this contract.
- The contract has not had an outside security review. Do not use it on mainnet before one.
- The asset verifier is an operator key, not a real verification process. See "Listing verification".
- The workspace is pinned to Aztec `5.2.0-nightly.20260815` and Nargo `1.0.0-beta.25`. A public testnet running a matching version is still needed.
- Each listing holds at most 32 bids.
- There is no on-chain dispute window for mobile goods.
- `commit_bid` rejects a bid from the same address as the listing's seller. A seller can still bid from a second account.
- Every claimant needs the auction secret to claim. There is no custody scheme for that secret yet.
- Not implemented yet: `listing_id` inside the commitment hash, and expiry for guardian votes.
- The frontend is a demo plus a testnet deploy wizard. Catalog, bidding and settlement screens are previews that do not call the contract, apart from the sell step and a read-only status line on listings created on-chain (not yet run against a live wallet). The deploy wizard has been updated for the current constructor but has not been run end-to-end on a live network.

## What the protocol does

1. A bidder commits to a bid. The commitment is `poseidon2([amount, salt, bidder])`, and the amount (plus any stake) is locked in a private note that also stores the salt.
2. After the close, the bidder calls `reveal_bid(listing_id)`. No amount or salt argument is needed, because both come from the note.
3. A reveal makes the commitment hash and the amount public. It does not publish the bidder's address.
4. The auction is finalized, the highest revealed bid wins, and the winner is paid out (permissionless settlement is available). Losers are refunded.
5. A bidder who misses the reveal deadline can call `claim_late_reveal(listing_id)` and get a refund minus the late-reveal penalty.
6. Real-estate listings add a commitment stake and a legal closing window. The stake returns to the winner after the seller confirms closing, or anyone can slash it to the seller after the deadline passes.
7. A guardian threshold can pause the protocol. A pause halts new activity but not payouts. Time spent paused extends the reveal and legal-closing deadlines.

Read-only getters: `get_listing`, `get_status`, `get_closing_state`, `get_parameters`, `get_effective_deadlines`.

## Constructor parameters

`treasury`, `asset_verifier`, three pause guardians, `pause_threshold`, `settlement_fee_bps` (max 1000), `late_reveal_penalty_bps` (max 5000) and `slash_seller_share_bps` (max 10000). They are fixed at deploy time. Changing them means redeploying. The wizard defaults are 300, 2000 and 10000, which are placeholders pending an economic decision. Listing stake and legal closing window are set per listing.

## Listing verification

Listing creation is gated by an allowlisted operator model. Only the current asset verifier can create listings on behalf of sellers, and the verifier can rotate the role. This is operator trust, not a cryptographic partner attestation. Secure the verifier key. Before opening asset intake to others, replace this with signed or registry-backed attestations.

## Development

- Use Node.js 24 or later for Aztec TXE tests. `aztec compile` works under Node.js 20.
- Compile: `aztec compile --workspace`
- Test: `cd protocol_test && TXE_WORKERS=1 aztec test`. The contract suite has 43 tests, and a full run takes 30 to 60+ minutes. Do not interrupt it.
- Three `should_fail` tests and one regression test were mutation-checked: each fails when its guarded logic is removed.

## Frontend and deployment

Compile the workspace before starting or building the frontend. The frontend copies the generated artifacts into its ignored public artifact directory before `npm run dev` or `npm run build`.

The frontend defaults to the Aztec testnet endpoint `https://v5.testnet.rpc.aztec-labs.com`, Sepolia chain ID `11155111` and explorer `https://testnet.aztecscan.xyz`. The Sponsored FPC address is `0x130925fbd734a252e3d8ddff87f6c346052dd2`, but this frontend does not submit Sponsored FPC fee calls. The browser wallet must already hold Fee Juice.

The wizard at `/deploy` deploys the test token and `SealedAuction`, then prints the addresses as an env snippet. It passes the connected account as the asset verifier. It compares the artifact's Aztec version with the live node and blocks deployment if they differ.

As of 2026-10-03 the official endpoint reported node version `5.0.0` and the official network page listed Testnet `5.1.0`. Both differ from this workspace's `5.2.0-nightly.20260815`, so deployment is blocked until the toolchain and network versions are aligned. Check the current versions before trying.

Copy `frontend/.env.example` to `frontend/.env.local` and fill in the addresses the wizard prints. The faucet token goes in `NEXT_PUBLIC_AZTEC_TESTNET_TEST_TOKEN_ADDRESS`, never in a stablecoin variable. Mainnet settings are separate.

The `/demo` page can connect a real Aztec browser wallet when the node URL is configured. Wallet discovery is tied to the node's chain identity and requires checking the SDK security phrase. Listing creation reaches the contract only when the connected account is both the configured and the on-chain asset verifier, and that account must confirm that off-chain review was completed.
