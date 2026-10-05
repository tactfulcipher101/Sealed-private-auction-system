import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceDirectory = resolve(scriptDirectory, "../..");
const artifacts = ["sealed_auction-SealedAuction.json", "private_token-PrivateToken.json"];

await mkdir(resolve(scriptDirectory, "../public/artifacts"), { recursive: true });
for (const artifact of artifacts) {
  const source = resolve(workspaceDirectory, "target", artifact);
  const destination = resolve(scriptDirectory, "../public/artifacts", artifact);
  try {
    await copyFile(source, destination);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Compiled contract artifact ${artifact} is missing. Run aztec compile --workspace from the repository root before starting the frontend.`);
    }
    throw error;
  }
}
