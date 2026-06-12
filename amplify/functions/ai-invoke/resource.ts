import { defineFunction } from '@aws-amplify/backend';

/**
 * Direct Bedrock invocation for the one-shot AI tasks (résumé parse, fit
 * scoring) via the Converse API. Owning the call means owning the IAM
 * policy — backend.ts grants this function explicit access to the Claude
 * Haiku 4.5 global inference profile, removing the generated-policy
 * variable that broke the AI Kit generation routes.
 */
export const aiInvoke = defineFunction({
  name: 'ai-invoke',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
});
