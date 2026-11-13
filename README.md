# Sealed Private Auction System

Sealed is a sealed-bid auction written in Noir for the Aztec network. Bids are committed privately and revealed only after the auction closes. This is an early prototype. Read "Status and limits" before relying on it.

## Status and limits

- The payment token in this repo (`PrivateToken`) is a test-only faucet fixture. It is not USDC or any real asset. The interface of a real token's private transfer has not been verified against this contract.
- The contract has not had an outside security review. Do not use it on mainnet before one.
- Listing creation is permissionless in the demo and does not verify asset ownership or condition. Do not rely on listing details without independent verification.
- All three packages build against aztec-nr tag `v6.0.0`. The deployed contract's artifact reports Aztec 6.0.0 and Noir 1.0.0-rc.3, and the contract runs on the public Aztec testnet.
- Each listing holds at most 32 bids.
- There is no on-chain dispute window for mobile goods.
- `commit_bid` rejects a bid from the same address as the listing's seller. A seller can still bid from a second account.
- Every claimant needs the auction secret to claim. There is no custody scheme for that secret yet.
- Not implemented yet: `listing_id` inside the commitment hash, and expiry for guardian votes.
- The frontend is a demo plus a testnet deploy wizard. The four catalog entries are static samples with simulated bidding and do not call the contract. Listings created from the page are permissionless and unverified. Their title, description and photos are saved only in the creator's browser and are not stored in the contract. A share link carries the listing id plus that text, which whoever made the link can change. With the test token on testnet, these ran from a browser wallet: connect, faucet, create listing, commit, close, reveal and finalize. A two-account auction from two browsers settled with the higher bid; that run used a local dev server. The listing page shows the settled winning amount. The close and finalize controls take a listing id (0x plus 64 hex digits). Claims are CLI-only because they need the auction secret in the claimant's wallet; winner, loser and late-reveal claims have been run from the CLI on testnet. The deploy wizard has been updated for the current constructor but has not been run end-to-end on a live network.

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

`treasury`, a legacy `asset_verifier` address (no longer used to authorize listings), three pause guardians, `pause_threshold`, `settlement_fee_bps` (max 1000), `late_reveal_penalty_bps` (max 5000) and `slash_seller_share_bps` (max 10000). They are fixed at deploy time. Changing them means redeploying. The wizard defaults are 300, 2000 and 10000, which are placeholders pending an economic decision. Listing stake and legal closing window are set per listing.

## Listing verification

Listing creation is permissionless in this demo: any account can create listings, and the contract does not verify ownership, condition, or the seller's authority. The legacy asset-verifier storage and rotation method remain for constructor compatibility but do not gate listing creation. Use independent off-chain review and treat all demo listings as unverified. The change applies only to contracts compiled from this source; an already deployed contract still enforces its original verifier rule and must be replaced with a newly deployed contract to use permissionless listing creation.

## Development

- Use Node.js 24 or later for Aztec TXE tests. `aztec compile` works under Node.js 20.
- Compile: `aztec compile --workspace`
- Test: `cd protocol_test && TXE_WORKERS=1 aztec test`. The contract suite has 44 tests. The 2026-10-05 full run recorded 43 passing; the 44th, commit_bid_from_listing_seller_reverts, passes in isolation on 5.0.0 and has not been part of a full run. A full run takes 30 to 60+ minutes. Do not interrupt it.
- Three `should_fail` tests and one regression test were mutation-checked: each fails when its guarded logic is removed.
- Older note from the 5.x toolchain; it has not been updated for 6.0.0: compiling against aztec-nr 5.2.0 instead of 5.0.0 succeeds but prints 148 compiler bug diagnostics, all located in aztec-nr library files. It is not known whether they matter. The 5.0.0 compile prints none of them.

## Frontend and deployment

Compile the workspace before starting or building the frontend. The frontend copies the generated artifacts into its ignored public artifact directory before `npm run dev` or `npm run build`.

The frontend defaults to the Aztec testnet endpoint `https://aztec-testnet.drpc.org`, Sepolia chain ID `11155111` and explorer `https://testnet.aztecscan.xyz`. The Sponsored FPC address is `0x2d8fff82a3b0c15d0a89169e7d8d043e079ab94d52031f1de1e4972ebad169d3`, and the frontend sends its transactions with the sponsored fee payment method. The demo flows ran that way on testnet.

The wizard at `/deploy` deploys the test token and `SealedAuction`, then prints the addresses as an env snippet. The constructor still accepts a legacy verifier address, but it does not gate listing creation. It compares the artifact's Aztec version with the live node and blocks deployment if they differ.

Check the live node version before using the wizard. It blocks deployment when the artifact's Aztec version differs from the node's.

Copy `frontend/.env.example` to `frontend/.env.local` and fill in the addresses the wizard prints. The faucet token goes in `NEXT_PUBLIC_AZTEC_TESTNET_TEST_TOKEN_ADDRESS`, never in a stablecoin variable. Mainnet settings are separate.

The `/demo` page can connect a real Aztec browser wallet when the node URL is configured. Wallet discovery is tied to the node's chain identity and requires checking the SDK security phrase. Listing creation is permissionless on newly deployed contracts compiled from this source. Previously deployed contracts remain verifier-gated. Commit, reveal, close and finalize are wired into the demo page. Claims are not; they are CLI-only.
