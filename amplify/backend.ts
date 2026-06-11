// Role Radar backend — everything is code, reviewed like app code; no
// console-clicked resources (ARCHITECTURE.md §8).

import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { sweep } from './functions/sweep/resource';

defineBackend({
  auth,
  data,
  sweep,
});
