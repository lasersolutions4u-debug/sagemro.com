import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

test('chat device information is presented for confirmation before saving', () => {
  const useChat = read('frontend/src/hooks/useChat.js');
  const app = read('frontend/src/App.jsx');
  const modal = read('frontend/src/components/Device/MyDevicesModal.jsx');
  const form = read('frontend/src/components/Device/DeviceForm.jsx');

  assert.match(useChat, /data\.device_suggestion/);
  assert.match(useChat, /deviceSuggestion/);
  assert.match(useChat, /clearDeviceSuggestion/);
  assert.match(app, /deviceSuggestion/);
  assert.match(app, /setMyDevicesOpen\(true\)/);
  assert.match(modal, /<DeviceForm/);
  assert.match(modal, /initialValues=\{deviceSuggestion\}/);
  assert.match(modal, /Add equipment/);
  assert.match(form, /initialValues/);
  assert.doesNotMatch(modal, /automatically organized|No manual entry needed/i);
});
