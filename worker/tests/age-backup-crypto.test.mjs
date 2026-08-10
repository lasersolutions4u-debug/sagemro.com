import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  decryptFile,
  encryptFile,
  generateIdentityFile,
} from '../scripts/age-backup-crypto.mjs';

const temporaryDirectories = [];
const cliPath = resolve(import.meta.dirname, '../scripts/age-backup-crypto.mjs');

async function makeTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'sagemro-age-backup-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

after(async () => {
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});

test('generated identity encrypts and decrypts a backup without exposing plaintext', async () => {
  const directory = await makeTemporaryDirectory();
  const identityPath = join(directory, 'identity.txt');
  const plaintextPath = join(directory, 'backup.sql');
  const encryptedPath = join(directory, 'backup.sql.age');
  const restoredPath = join(directory, 'restored.sql');
  const sample = Buffer.from('CREATE TABLE audit_sample (id INTEGER PRIMARY KEY);\n');

  const recipient = await generateIdentityFile(identityPath);
  await writeFile(plaintextPath, sample);
  await encryptFile({ recipient, inputPath: plaintextPath, outputPath: encryptedPath });

  const ciphertext = await readFile(encryptedPath);
  assert.ok(ciphertext.length > sample.length);
  assert.equal(ciphertext.includes(sample), false);

  await decryptFile({ identityPath, inputPath: encryptedPath, outputPath: restoredPath });
  assert.deepEqual(await readFile(restoredPath), sample);
  assert.match(recipient, /^age1[023456789acdefghjklmnpqrstuvwxyz]+$/);
  assert.equal((await stat(identityPath)).mode & 0o777, 0o600);
});

test('generate CLI prints only the public recipient', async () => {
  const directory = await makeTemporaryDirectory();
  const identityPath = join(directory, 'identity.txt');
  const result = spawnSync(process.execPath, [cliPath, 'generate', '--identity', identityPath], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout.trim(), /^age1[023456789acdefghjklmnpqrstuvwxyz]+$/);
  assert.doesNotMatch(result.stdout, /AGE-SECRET-KEY-/);
  assert.match(await readFile(identityPath, 'utf8'), /^AGE-SECRET-KEY-/);
});

test('encryption refuses to overwrite its input file', async () => {
  const directory = await makeTemporaryDirectory();
  const identityPath = join(directory, 'identity.txt');
  const plaintextPath = join(directory, 'backup.sql');
  const recipient = await generateIdentityFile(identityPath);
  await writeFile(plaintextPath, 'SELECT 1;\n');

  await assert.rejects(
    encryptFile({ recipient, inputPath: plaintextPath, outputPath: plaintextPath }),
    /input and output paths must be different/i,
  );
});
