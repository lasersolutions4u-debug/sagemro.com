import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

function functionBody(name, nextName) {
  const start = source.indexOf(`async function ${name}`);
  const end = source.indexOf(`async function ${nextName}`, start + 1);
  assert.notEqual(start, -1, `${name} should exist`);
  assert.notEqual(end, -1, `${nextName} should follow ${name}`);
  return source.slice(start, end);
}

test('conversation image attachment preloads existing URLs and batches writes', () => {
  const body = functionBody('attachConversationImagesToWorkOrder', 'toolCreateWorkOrder');

  assert.match(body, /SELECT r2_url[\s\S]*FROM work_order_attachments[\s\S]*WHERE work_order_id = \?/);
  assert.doesNotMatch(body, /SELECT id FROM work_order_attachments WHERE work_order_id = \? AND r2_url = \?/);
  assert.match(body, /env\.DB\.batch\(/);
});

test('material replacement validates referenced materials in one query and batches writes', () => {
  const body = functionBody('replaceWorkOrderMaterialItems', 'insertWorkOrderMaterialItem');

  assert.match(body, /FROM materials WHERE id IN \(/);
  assert.doesNotMatch(body, /for \([^)]*items[^)]*\)[\s\S]*await insertWorkOrderMaterialItem/);
  assert.match(body, /env\.DB\.batch\(/);
});
