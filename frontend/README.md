# Sealed Private Auction Protocol

Sealed is a private bidding protocol for high-value physical assets. It is designed for situations where sellers need liquidity without publicly exposing an asset's distress, and where buyers need to compete without revealing their financial ceiling to the market.

The protocol separates private bid discovery from identity, custody, legal transfer, and physical delivery. It aims to make the competitive part of an auction private while preserving the verification and compliance steps required to complete a real-world transaction.

## The Problem

Open auctions expose more than the final price. During bidding, competitors can often observe price movements, infer a bidder's budget, identify participants, and use that information to shape the next bid. Sellers may also be forced to publicly associate themselves with a liquidation, estate sale, corporate wind-down, or other sensitive transaction.

Sealed addresses this information problem by keeping bids committed and hidden until the auction closes. The protocol does not attempt to make the entire transaction anonymous. Instead, it limits unnecessary disclosure during competitive bidding and reveals the information needed for settlement and lawful delivery at the appropriate point.

## Protocol Goals

- Keep bid amounts hidden during the active auction.
- Keep bidder wallet addresses hidden from competitors and public observers during bidding.
- Verify that a bidder can support an intended bid without exposing total wallet holdings.
- Select the highest valid bid deterministically at close.
- Return losing bid funds without relying on a manual claim process.
- Support different regulated settlement currencies and regional verification partners.
- Separate software-based bid privacy from legal identity, custody, and physical delivery requirements.

## Participants

### Seller

The seller submits an asset for listing, provides the required identity and ownership information to the appropriate service providers, and accepts a reserve price and auction schedule. The seller does not need to expose sensitive financial circumstances to every market participant.

### Bidder

A bidder connects a wallet, completes any required onboarding or funding checks, proves that the intended bid is supportable, and submits a private commitment. The bidder's identity may remain hidden from competing bidders during the auction, but the winning bidder must be identified where law, title transfer, tax, delivery, or custody requires it.

### Verification Partner

A regional professional verifies the physical asset, its condition, ownership evidence, and any relevant provenance before the listing is released. Examples may include licensed surveyors, valuers, authenticators, appraisers, custodians, and legal delegates.

### Settlement Layer

The settlement layer records commitments, evaluates valid reveals, selects the winner, transfers the seller proceeds, and releases losing funds. A production deployment would use audited contracts or an equivalent independently verifiable settlement system.

## Auction Lifecycle

### 1. Listing and Local Intake

The seller submits an asset and the required supporting information. A qualified local partner inspects or authenticates the asset and signs an intake record. The public listing can expose the asset description, reserve floor, currency, location category, and verification status without publishing private seller circumstances.

For real estate, the verification path may involve licensed surveyors, valuers, title professionals, and legal delegates. For luxury goods, it may involve authentication, custody, condition reporting, and insured logistics providers.

### 2. Bidder Eligibility and Solvency Proof

Before a bid is accepted, the bidder must demonstrate that the wallet can support the intended amount in the auction's settlement currency. In the proposed design, this happens through a client-side zero-knowledge circuit or equivalent proof system.

The verifier should learn only that the bid satisfies the required conditions. It should not learn the bidder's total balance, unrelated assets, or private financial information. Identity and anti-money-laundering checks remain separate requirements where regulated on-ramps or settlement providers require them.

### 3. Private Bid Commitment

The bidder selects an amount and creates a commitment that binds the bidder to that amount without publishing it. The commitment is submitted to the auction's escrow or settlement layer before the bidding deadline.

During this phase, competitors should see only the minimum state needed to know that a valid commitment exists. They should not see the committed amount, the bidder's wallet address, or a price ladder that reveals the market's current ceiling.

### 4. Auction Close and Reveal

When the auction closes, valid commitments are opened or evaluated according to the protocol rules. The settlement process checks that each reveal matches its original commitment and that the associated solvency and eligibility conditions remain valid.

The highest valid bid wins according to the published auction rules. A production protocol must define tie-breaking, invalid reveals, late submissions, failed payments, reserve-price handling, and cancellation conditions before an auction begins.

### 5. Settlement and Refunds

The winning bid is transferred according to the settlement rules. Losing bid funds are unlocked and returned directly to their owners. The seller and winning bidder then move into the appropriate legal, custody, title-transfer, and delivery workflow.

The protocol's privacy boundary changes at this point. The winning bidder may need to disclose identity for a deed, invoice, courier waybill, tax record, regulated custody release, or other legal instrument. This is not a failure of private bidding; it is the point at which disclosure becomes necessary for completion.

### Seller Outcome After the Auction

Once reveal-at-close completes, the seller receives the winning bidder reference and winning amount for the listing. The seller should then confirm the winning bidder's identity and compliance status through the designated verification partner before releasing the asset or ownership documents.

The next procedure depends on the asset class:

- **Property**: a licensed local legal representative begins title checks, contract signing, and registry transfer. The parties follow the agreed legal completion deadline and any configured commitment-stake rules.
- **Mobile goods**: the seller hands the item to the approved custody or courier partner for double-blind delivery. The buyer receives the configured post-delivery inspection window, and any dispute is routed to the independent authentication partner.

The winning bidder reference shown during settlement is a protocol-level wallet reference in the demonstration. A production deployment would disclose the legal identity needed for closing only to the seller, approved verification providers, and other parties with a legitimate settlement requirement.

## Privacy Model

### What Sealed Protects During Bidding

- Bid amounts are hidden from competing bidders.
- Bidder wallet addresses are not exposed as part of the public bidding view.
- The market cannot construct an open price ladder from live bid values.
- Solvency can be checked without publishing total wallet holdings.
- Commitments can be independently checked for consistency at settlement.

### What Sealed Does Not Promise

- Fiat-to-crypto or stablecoin on-ramps are not automatically anonymous and may be subject to KYC.
- Blockchain network metadata, wallet reuse, timing, and external systems can create linkability risks.
- A winning bidder cannot remain unidentified when legal ownership, delivery, tax, custody, or title requirements demand identification.
- Physical asset verification still requires trusted people and institutions in the relevant jurisdiction.
- Privacy claims depend on the deployed cryptography, contracts, wallet software, network, and operational practices being correctly implemented and audited.

## Settlement Assets and Currencies

The protocol is intended to support regulated one-to-one settlement assets such as USDC, USDT, cNGN, or EURC, subject to the rules of the deployment jurisdiction and the selected settlement provider.

Currency support does not remove compliance obligations. Each deployment must define accepted assets, price precision, exchange-rate handling where necessary, supported jurisdictions, sanctions screening, refund rules, and the party responsible for custody during settlement.

## Physical Asset and Legal Framework

Sealed is software for the private auction phase, not a replacement for local professional services. A complete transaction may require:

- Identity and sanctions screening
- Proof of ownership and authority to sell
- Condition reports and independent appraisal
- Secure custody and insurance
- Escrow or controlled release of the physical asset
- Title, deed, invoice, tax, and customs documentation
- Licensed legal, valuation, real-estate, authentication, and logistics partners

The appropriate partner depends on the asset and jurisdiction. The protocol should record which verification pathway was used and what claims were attested without treating an on-chain or cryptographic record as a substitute for the underlying professional responsibility.

## Trust and Security Assumptions

A production implementation must be designed and audited around at least these assumptions:

- Commitment hashes are collision-resistant and bind a bidder to one bid.
- Randomness used in commitments cannot be guessed or reused.
- The solvency proof circuit correctly expresses the bid and balance conditions.
- Auction deadlines and ordering are enforced by the settlement layer.
- Contracts cannot arbitrarily redirect escrowed funds.
- Wallet signatures authenticate the intended bidder action.
- Verification partners and custody providers protect the physical asset.
- Failure, dispute, cancellation, and recovery paths are specified before funds are accepted.

The current repository is an interactive protocol demonstration. Its generated wallet addresses, commitment hashes, bids, and settlement outcomes are simulated values for explaining the lifecycle. They must not be treated as production cryptography or used for real transactions.

## Demonstration

The accompanying web experience illustrates the protocol lifecycle through four views:

- `/` presents the protocol's purpose, architecture, logistics model, and a solvency-proof simulation.
- `/about` summarizes private bidding, deterministic settlement, and physical settlement.
- `/demo` walks through wallet connection, listing, bidding, live auction, and reveal-at-close settlement.
- `/protocol` provides the longer technical explanation of the privacy model and auction phases.

The demonstration uses local browser state and simulated data. Refreshing the page resets the session; no real wallet, contract, escrow, identity provider, or verification partner is contacted.

## Disclaimer

Sealed is an architecture and product demonstration, not a financial service, auction house, escrow provider, custody provider, legal service, or audited zero-knowledge system. The protocol description is not legal, financial, investment, or compliance advice. Any production deployment would require independent security review, contract audits, jurisdiction-specific legal analysis, regulated service providers, and clearly documented user protections.
