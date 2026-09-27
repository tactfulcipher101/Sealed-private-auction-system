# Sealed Private Auction System

## Development Runtime

Use Node.js 24 or later for Aztec TXE tests. The PXE test runner uses `Set.prototype.intersection`, which Node.js 20 does not provide. `aztec compile` itself does not require Node 24; it compiles successfully under Node.js 20.
