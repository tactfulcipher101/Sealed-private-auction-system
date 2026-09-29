# Sealed Protocol Layer

This folder is the Aztec/Noir settlement and escrow layer for the Sealed private-auction protocol.

It is intentionally kept separate from the frontend demo in `frontend/` so the smart-contract logic can evolve independently from the product UI.

## Scope

This module covers the core protocol logic described in the design:

- listing lifecycle
- bidder solvency checks
- bid commitment and locked funds
- forced reveal with penalty for non-reveal
- reveal-at-close settlement
- seller payout and loser refund
- real-estate commitment stake and default handling
- emergency pause controls

## Out of scope

- frontend rendering
- KYC / identity proof circuits
- physical logistics
- courier or legal handoff logic
- MPC blind settlement

## Folder layout

```text
protocol/
  README.md
  Nargo.toml
  src/
    main.nr
    bid_note.nr
```

## Implementation status

The contract, the test token and the TXE tests are implemented; the suite runs from `protocol_test/`. The emergency pause needs a threshold of guardian votes set at deploy. While paused it blocks commits, reveals, finalization, closing confirmation and slashing, and it never blocks payouts, refunds or earned stake returns.

## Token interface (unverified)

`private_token/` is a test-only token with a public faucet, and it is the only token the auction has been run against. No other token contract was available to check against, so compatibility with any production token, including a regulated stablecoin, is unverified.

The auction depends on exactly these two calls:

- `transfer_in_private(from, to, amount, authwit_nonce)`: private pull from the bidder, authorized by an authwit on `from`, with the auction as `to`.
- `transfer(to, amount)`: private transfer out of the auction's own private balance, called by the auction contract for seller payouts, treasury fees, refunds and stake returns.

It also assumes the amount credited equals the amount requested (no fee-on-transfer, no rebasing) and that the token never blocks transfers from or to the auction address. A token that differs on any of these needs the auction re-tested against it before use.
