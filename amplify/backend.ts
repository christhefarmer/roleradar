// Role Radar backend — everything is code, reviewed like app code; no
// console-clicked resources (ARCHITECTURE.md §8).

import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { aiInvoke } from './functions/ai-invoke/resource';
import { resolveBoard } from './functions/resolve-board/resource';
import { sweep } from './functions/sweep/resource';
import { verifyBoard } from './functions/verify-board/resource';

const backend = defineBackend({
  auth,
  data,
  sweep,
  resolveBoard,
  verifyBoard,
  aiInvoke,
});

// Private cockpit: no self-service sign-up. Every authenticated user can
// spend Bedrock/Apify budget through the AI mutations, so accounts are
// created only by the admin (Cognito console → Users → Create user).
backend.auth.resources.cfnResources.cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: true,
};

// Explicit Bedrock access for the direct-invocation Lambda. Global inference
// profiles route across regions, so the grant covers the profile ARN in any
// region plus the underlying foundation-model ARNs everywhere it may land.
backend.aiInvoke.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
    resources: [
      'arn:aws:bedrock:*:*:inference-profile/global.anthropic.claude-haiku-4-5*',
      'arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5*',
    ],
  }),
);
