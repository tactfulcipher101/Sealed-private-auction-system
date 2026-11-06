import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const vendoredDirectory = resolve(scriptDirectory, "../vendored-artifacts");
const publicDirectory = resolve(scriptDirectory, "../public/artifacts");
const artifacts = [
  "sealed_auction-SealedAuction.json",
  "private_token-PrivateToken.json",
  "sponsored_fpc_contract-SponsoredFPC.json",
];

await mkdir(publicDirectory, { recursive: true });
for (const artifact of artifacts) {
  await copyFile(resolve(vendoredDirectory, artifact), resolve(publicDirectory, artifact));
}
