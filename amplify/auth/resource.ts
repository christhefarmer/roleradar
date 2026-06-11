import { defineAuth } from '@aws-amplify/backend';

/**
 * Amplify Gen 2 Auth (Cognito): email + password with email-code verification.
 * Per-account data isolation flows from here — every Data model is owner-scoped.
 *
 * Optional Google federation (ARCHITECTURE.md §1): add `externalProviders`
 * with `secret('GOOGLE_CLIENT_ID')` / `secret('GOOGLE_CLIENT_SECRET')` once
 * the OAuth app exists. Secrets live in Amplify secrets, never the client.
 */
export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailStyle: 'CODE',
      verificationEmailSubject: 'Your Role Radar verification code',
    },
  },
  userAttributes: {
    preferredUsername: { mutable: true, required: false },
  },
});
