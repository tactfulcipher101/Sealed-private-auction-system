# Sealed Private Auction System

## Development Runtime

Use Node.js 24 or later for Aztec TXE tests. The PXE test runner uses `Set.prototype.intersection`, which Node.js 20 does not provide. `aztec compile` itself does not require Node 24; it compiles successfully under Node.js 20.

## Deployment Model

Compile the Noir workspace before starting or building the frontend (`aztec compile --workspace`). The frontend stages the generated auction artifact into its ignored public artifact directory before `npm run dev` or `npm run build`.

The frontend defaults to the official Aztec testnet endpoint `https://v5.testnet.rpc.aztec-labs.com`, Sepolia L1 chain ID `11155111`, and explorer `https://testnet.aztecscan.xyz`. The official Sponsored FPC address is `0x130925fbd734a252e3d8ddff87f6c346052dd2`. The deployment wizard is at `/deploy`; it stages the compiled artifacts, deploys the test-only `PrivateToken`, deploys `SealedAuction`, and emits generated addresses as an env snippet. The deploying account becomes the asset verifier. The browser wallet must already have Fee Juice; this frontend does not currently submit Sponsored FPC fee calls.

The deployment wizard compares the artifact's embedded Aztec version with the live node and disables deployment if they differ. On 2026-10-03, the official endpoint returned `nodeVersion=5.0.0`, while this workspace's artifacts are `5.2.0-nightly.20260815`; the official network page lists Testnet `5.1.0`. These sources disagree, and each reported version is incompatible with the workspace artifacts. Do not deploy until the Aztec toolchain and network versions are aligned. Public endpoint/explorer values are known; the auction, verifier, treasury, guardians, and test-token addresses only exist after a compatible deployment.

Copy `frontend/.env.example` to `frontend/.env.local` and fill those addresses from the wizard output. The faucet token must use `NEXT_PUBLIC_AZTEC_TESTNET_TEST_TOKEN_ADDRESS`, never a stablecoin variable. Mainnet settings remain separate.

The current listing-verification gate is an allowlisted operator model: the deployer account becomes the initial asset verifier, only that account can create listings on behalf of sellers, and the current verifier can rotate the role. This is an operational testnet gate, not a cryptographic partner attestation; the verifier key must be secured and the contract upgraded to signed/registry-backed attestations before decentralizing asset intake. Treasury and guardians are constructor parameters; listing stake and legal closing window are provided per listing. The contract's 3% settlement fee and 20% late-reveal penalty remain Noir compile-time constants and changing them requires updating and recompiling the contract.

The frontend `/demo` flow supports a real Aztec browser-wallet connection when the selected network's node URL is configured. Wallet discovery is tied to the node's chain identity and requires verification of the SDK security phrase. Listing creation submits to the deployed contract only when the connected account matches both the configured and on-chain asset verifier; the verifier must explicitly attest that off-chain review was completed. This is operator trust, not a cryptographic partner attestation. Catalog entries, bidding, and settlement remain previews; token transfers and verification-partner calls are not implemented.
