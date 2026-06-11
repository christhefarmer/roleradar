import { defineFunction } from '@aws-amplify/backend';

/**
 * Board discovery for the watchlist: given a company name, probe the public
 * ATS board endpoints (Greenhouse / Lever / Ashby) for a matching slug so an
 * entry lands with the provider that actually hosts it. Companies with no
 * public board fall back to aggregate feeds (ARCHITECTURE.md §2).
 */
export const resolveBoard = defineFunction({
  name: 'resolve-board',
  entry: './handler.ts',
  timeoutSeconds: 20,
  memoryMB: 256,
});
