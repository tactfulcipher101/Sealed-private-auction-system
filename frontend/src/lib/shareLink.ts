import type { Listing } from "@/lib/demoData";

export interface SharedListingMetadata {
  title: string;
  region: string;
  description: string;
}

export interface SharedListingRequest {
  id: string;
  meta: SharedListingMetadata;
}

// Public text only. Photos, salts, bid boxes and the auction secret never go in a link.
export function buildShareLink(listing: Listing): string {
  const meta = {
    t: listing.title.slice(0, 120),
    r: listing.region.slice(0, 120),
    d: listing.description.slice(0, 600),
  };
  return window.location.origin + "/demo?listing=" + encodeURIComponent(listing.id) + "#t=" + encodeURIComponent(JSON.stringify(meta));
}

export function parseShareLink(): SharedListingRequest | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("listing");
    if (!id || !/^0x[0-9a-fA-F]{64}$/.test(id)) return null;
    let meta: SharedListingMetadata = { title: "Shared listing", region: "", description: "" };
    const hash = window.location.hash;
    if (hash.startsWith("#t=")) {
      const parsed: unknown = JSON.parse(decodeURIComponent(hash.slice(3)));
      if (typeof parsed === "object" && parsed !== null) {
        const fields = parsed as { t?: unknown; r?: unknown; d?: unknown };
        meta = {
          title: typeof fields.t === "string" && fields.t.trim() ? fields.t.slice(0, 120) : meta.title,
          region: typeof fields.r === "string" ? fields.r.slice(0, 120) : "",
          description: typeof fields.d === "string" ? fields.d.slice(0, 600) : "",
        };
      }
    }
    return { id, meta };
  } catch {
    return null;
  }
}
