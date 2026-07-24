import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

for (const page of ['UsersPage.jsx', 'LeadsPage.jsx', 'RatingsPage.jsx', 'WorkOrdersPage.jsx']) {
  test(`${page} exposes a retryable load error instead of silently hiding it`, async () => {
    const source = await readFile(new URL(`./${page}`, import.meta.url), 'utf8');

    assert.match(source, /loadError/);
    assert.match(source, /Retry|重试/);
    assert.doesNotMatch(source, /\.catch\(\(\) => \{\}\)/);
    assert.match(source, /useRef|loadRequestId/);
    assert.match(source, /requestId/);
  });
}

test('WorkOrdersPage exposes a separate retry when the dispatch candidate pool fails', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /engineerLoadError/);
  assert.match(source, /setEngineerLoadAttempt\(\(current\) => current \+ 1\)/);
});

test('WorkOrdersPage distinguishes a missing invoice request from an invoice load failure', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /invoiceLoadError/);
  assert.match(source, /response\.invoice_request \|\| null/);
  assert.match(source, /loadDetailInvoice\(detail\.id\)/);
  assert.match(source, /invoiceRequestId\.current !== requestId/);
});
