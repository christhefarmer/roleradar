import { defineFunction, secret } from '@aws-amplify/backend';

/**
 * The Scout pipeline — one Lambda run per sweep:
 * fetch all active adapters → normalize → dedup by sourceId → score fit vs
 * résumé profile → flag phantoms → detect hidden gems → persist + emit
 * proposals. Invoked on demand (Send scouts); progress is written to the
 * owner's SweepRun record so the client can subscribe rather than poll.
 */
export const sweep = defineFunction({
  name: 'sweep',
  entry: './handler.ts',
  // v1 runs synchronously behind the startSweep mutation; AppSync caps
  // resolvers at 30s, so fail fast rather than burn invisible time.
  timeoutSeconds: 30,
  memoryMB: 512,
  environment: {
    // Apify API token (Amplify secret `apify`) — powers the LinkedIn
    // public-listings adapter. Optional: without it the adapter skips.
    APIFY_TOKEN: secret('apify'),
  },
});
