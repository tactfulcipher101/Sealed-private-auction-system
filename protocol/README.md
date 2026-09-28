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
```

## Implementation status

This is a contract skeleton aligned to the architecture notes you shared. It is meant to be the protocol foundation for the next implementation pass in Noir/Aztec.
