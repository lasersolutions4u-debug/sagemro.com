import * as age from 'age-encryption';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function assertDifferentPaths(inputPath, outputPath) {
  if (resolve(inputPath) === resolve(outputPath)) {
    throw new Error('Input and output paths must be different.');
  }
}

export async function generateIdentityFile(identityPath) {
  const identity = await age.generateIdentity();
  const recipient = await age.identityToRecipient(identity);
  await writeFile(identityPath, `${identity}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  await chmod(identityPath, 0o600);
  return recipient;
}

export async function encryptFile({ recipient, inputPath, outputPath }) {
  assertDifferentPaths(inputPath, outputPath);
  const plaintext = await readFile(inputPath);
  try {
    const encrypter = new age.Encrypter();
    encrypter.addRecipient(recipient);
    const ciphertext = await encrypter.encrypt(plaintext);
    await writeFile(outputPath, ciphertext, { flag: 'wx', mode: 0o600 });
  } finally {
    plaintext.fill(0);
  }
}

export async function decryptFile({ identityPath, inputPath, outputPath }) {
  assertDifferentPaths(inputPath, outputPath);
  const identity = (await readFile(identityPath, 'utf8')).trim();
  const ciphertext = await readFile(inputPath);
  const decrypter = new age.Decrypter();
  decrypter.addIdentity(identity);
  const plaintext = await decrypter.decrypt(ciphertext);
  try {
    await writeFile(outputPath, plaintext, { flag: 'wx', mode: 0o600 });
  } finally {
    plaintext.fill(0);
  }
}

function parseOptions(argumentsList) {
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 2) {
    const flag = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!flag?.startsWith('--') || !value) {
      throw new Error(`Invalid option near ${flag || 'end of command'}.`);
    }
    options[flag.slice(2)] = value;
  }
  return options;
}

function requireOptions(options, names) {
  for (const name of names) {
    if (!options[name]) throw new Error(`Missing required option --${name}.`);
  }
}

async function main() {
  const [command, ...argumentsList] = process.argv.slice(2);
  const options = parseOptions(argumentsList);

  if (command === 'generate') {
    requireOptions(options, ['identity']);
    console.log(await generateIdentityFile(options.identity));
    return;
  }
  if (command === 'encrypt') {
    requireOptions(options, ['recipient', 'input', 'output']);
    await encryptFile({
      recipient: options.recipient,
      inputPath: options.input,
      outputPath: options.output,
    });
    return;
  }
  if (command === 'decrypt') {
    requireOptions(options, ['identity', 'input', 'output']);
    await decryptFile({
      identityPath: options.identity,
      inputPath: options.input,
      outputPath: options.output,
    });
    return;
  }
  throw new Error('Command must be generate, encrypt, or decrypt.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
