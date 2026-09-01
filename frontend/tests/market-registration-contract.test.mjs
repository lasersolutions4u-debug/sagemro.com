import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const loginModalUrl = new URL('../src/components/Auth/LoginModal.jsx', import.meta.url);
const apiUrl = new URL('../src/services/api.js', import.meta.url);

test('COM registration requires email while keeping phone explicitly optional', async () => {
  const source = await readFile(loginModalUrl, 'utf8');

  assert.match(source, /phoneNumberOptional:\s*'Phone number \(optional\)'/);
  assert.match(source, /\{isCn \? copy\.phoneNumber : copy\.phoneNumberOptional\}/);
  assert.match(source, /\(isCn && !phone\)/);
  assert.doesNotMatch(source, /!name \|\| !phone \|\| !password/);
  assert.match(source, /!isCn && \(!email \|\| !isEmailAddress\(email\)\)/);
});

test('password reset uses email on COM and phone on CN', async () => {
  const modalSource = await readFile(loginModalUrl, 'utf8');
  const apiSource = await readFile(apiUrl, 'utf8');

  assert.match(modalSource, /const resetTarget = isCn \? phone : email/);
  assert.match(modalSource, /isCn \? copy\.phoneNumberLabel : copy\.emailAddressLabel/);
  assert.match(modalSource, /await sendResetCode\(isCn \? \{ phone \} : \{ email \}\)/);
  assert.match(modalSource, /await resetPassword\(\{ \.\.\.\(isCn \? \{ phone \} : \{ email \}\), code, newPassword: password \}\)/);
  assert.match(modalSource, /const goToForgotPassword = \(\) => \{[^}]*setForgotStep\('target'\)[^}]*\};/);
  assert.match(apiSource, /export async function sendResetCode\(\{ phone, email \}\)/);
  assert.match(apiSource, /export async function resetPassword\(\{ phone, email, code, newPassword \}\)/);
});
