// Amplify wiring with a graceful fallback. `amplify_outputs.json` is written
// by `ampx pipeline-deploy` (Amplify Hosting) or `ampx sandbox` — when it
// exists the app runs fully connected (Cognito auth, AppSync data, AI
// routes). When it doesn't (local dev without AWS, design reviews), the app
// runs in design-fidelity mode on the prototype seed and every remote call
// no-ops behind `isConnected`.

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

// Optional import: import.meta.glob returns {} when the file is absent,
// which a static `import` would turn into a build error.
const outputsModules = import.meta.glob('../../amplify_outputs.json', { eager: true });
const outputsModule = Object.values(outputsModules)[0] as { default?: object } | undefined;
const outputs = outputsModule?.default ?? outputsModule;

export const isConnected = !!outputs;

if (outputs) {
  Amplify.configure(outputs as Parameters<typeof Amplify.configure>[0]);
}

let _client: ReturnType<typeof generateClient<Schema>> | null = null;

/** Typed Amplify Data client — only call when `isConnected` is true. */
export function client() {
  if (!isConnected) throw new Error('Amplify is not configured (design-fidelity mode)');
  if (!_client) _client = generateClient<Schema>();
  return _client;
}
