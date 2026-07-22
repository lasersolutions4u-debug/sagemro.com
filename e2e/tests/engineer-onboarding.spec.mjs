import { test } from '@playwright/test';

import { onboardEngineer } from '../support/journeys.mjs';
import { e2eRuntime } from '../support/runtime.mjs';

const runtime = e2eRuntime();

test('engineer application is reviewed, activated, and signed in', async ({ browser }) => {
  const { context } = await onboardEngineer({ browser, runtime });
  await context.close();
});
