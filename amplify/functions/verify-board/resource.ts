import { defineFunction } from '@aws-amplify/backend';

/**
 * Board verification for the watchlist: given an exact provider + slug (the
 * pair the sweep actually pulls), probe that one ATS endpoint and report
 * whether it's reachable. The inverse of resolve-board (which guesses slugs
 * across every provider) — here the caller already knows the board and just
 * wants confidence it responds (ARCHITECTURE.md §2).
 */
export const verifyBoard = defineFunction({
  name: 'verify-board',
  entry: './handler.ts',
  timeoutSeconds: 10,
  memoryMB: 256,
});
