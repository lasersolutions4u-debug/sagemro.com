# Encrypted Production D1 Backups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace plaintext production D1 artifacts with recoverable age-encrypted artifacts and delete the exposed plaintext history only after a verified encrypted replacement exists.

**Architecture:** A focused Node CLI wraps the official `age-encryption` package for key generation, file encryption, and file decryption. The existing GitHub Actions workflow exports to runner-local plaintext, encrypts both market backups, securely removes plaintext, and uploads only ciphertext plus hashes and metadata. The private identity remains outside Git and GitHub.

**Tech Stack:** Node.js 24, `age-encryption@0.3.0`, Node test runner, GitHub Actions, GitHub CLI.

## Global Constraints

- Do not modify application code, D1 schema, database contents, or deployment workflows.
- Never print SQL contents or the private age identity.
- Keep the private identity outside Git at `.Codex/memory/backup-recovery/sagemro-d1-backup-age-identity.txt` with mode `0600`.
- Do not delete an existing plaintext artifact until fresh COM and CN ciphertext artifacts have both been downloaded, decrypted, and validated.
- Stop before deletion if any encryption, workflow, download, decryption, or validation step fails.

---

### Task 1: Age file encryption CLI

**Files:**
- Create: `worker/scripts/age-backup-crypto.mjs`
- Create: `worker/tests/age-backup-crypto.test.mjs`
- Modify: `worker/package.json`
- Modify: `worker/package-lock.json`

**Interfaces:**
- Produces CLI commands:
  - `generate --identity <path>` writes an age identity and prints only its public recipient.
  - `encrypt --recipient <age1...> --input <plain.sql> --output <cipher.sql.age>`.
  - `decrypt --identity <path> --input <cipher.sql.age> --output <plain.sql>`.
- Produces exported functions `generateIdentityFile`, `encryptFile`, and `decryptFile` for real round-trip tests.

- [ ] **Step 1: Add the pinned encryption dependency**

Run:

```bash
cd worker
npm install --save-dev --save-exact age-encryption@0.3.0
```

Expected: `package.json` records exactly `0.3.0` and the lockfile contains its integrity hashes.

- [ ] **Step 2: Write the failing round-trip and secret-output tests**

Create tests that generate an identity in a temporary directory, encrypt a sample SQL buffer, confirm ciphertext does not contain the sample, decrypt it, and compare bytes. Capture stdout from the generate CLI and assert it contains an `age1` recipient but not `AGE-SECRET-KEY-`.

Run:

```bash
cd worker
node --test tests/age-backup-crypto.test.mjs
```

Expected: FAIL because `scripts/age-backup-crypto.mjs` does not exist.

- [ ] **Step 3: Implement the minimal CLI**

Use `age.generateIdentity()`, `age.identityToRecipient()`, `age.Encrypter`, and `age.Decrypter`. Validate required flags, refuse identical input/output paths, write generated identities with mode `0600`, and use binary input/output without logging contents.

- [ ] **Step 4: Verify the encryption tests pass**

Run:

```bash
cd worker
node --test tests/age-backup-crypto.test.mjs
```

Expected: all age backup crypto tests PASS.

- [ ] **Step 5: Commit the encryption CLI**

```bash
git add worker/package.json worker/package-lock.json worker/scripts/age-backup-crypto.mjs worker/tests/age-backup-crypto.test.mjs
git commit -m "feat(backup): add age encryption utility"
```

### Task 2: Encrypted GitHub Actions artifacts

**Files:**
- Modify: `worker/tests/d1-backup-workflow.test.mjs`
- Modify: `.github/workflows/d1-backup.yml`
- Modify: `DEPLOY.md`

**Interfaces:**
- Consumes `node scripts/age-backup-crypto.mjs encrypt` from Task 1.
- Produces artifact payloads containing only `*.sql.age`, SHA-256 manifests, and metadata with `encryption=age` and the public recipient.

- [ ] **Step 1: Change the workflow contract test first**

Require the workflow to define separate plaintext and encrypted paths, run a named `Encrypt backups and remove plaintext` step, invoke the CLI once for COM and once for CN, remove both plaintext files before validation, hash encrypted basenames, and upload only `COM_ENCRYPTED`/`CN_ENCRYPTED`. Add negative assertions that upload paths contain no `COM_BACKUP` or `CN_BACKUP` references.

Run:

```bash
cd worker
node --test tests/d1-backup-workflow.test.mjs
```

Expected: FAIL because the current workflow uploads `COM_BACKUP` and `CN_BACKUP` directly.

- [ ] **Step 2: Implement the minimal workflow change**

Set the public recipient only on the encryption step. Export to `.sql`, encrypt to `.sql.age`, then use `shred -u -- "$COM_BACKUP" "$CN_BACKUP"`. Validate ciphertext size, assert both plaintext paths no longer exist, hash ciphertext, and upload only encrypted paths. Keep Cloudflare credentials scoped only to the export step.

- [ ] **Step 3: Update the recovery documentation**

Document the private identity path, ciphertext artifact naming, local decrypt command, checksum verification, temporary plaintext cleanup, and the rule that the identity must be copied to a password manager/offline encrypted store.

- [ ] **Step 4: Run targeted and complete Worker tests**

Run:

```bash
cd worker
node --test tests/age-backup-crypto.test.mjs tests/d1-backup-workflow.test.mjs
npm test
```

Expected: all tests PASS with zero failures.

- [ ] **Step 5: Commit the encrypted workflow**

```bash
git add .github/workflows/d1-backup.yml DEPLOY.md worker/tests/d1-backup-workflow.test.mjs
git commit -m "fix(backup): encrypt production D1 artifacts"
```

### Task 3: Recovery key and local rehearsal

**Files:**
- Create outside Git: `.Codex/memory/backup-recovery/sagemro-d1-backup-age-identity.txt`
- Create outside Git: `.Codex/memory/backup-recovery/README.md`

**Interfaces:**
- Consumes the generate/encrypt/decrypt CLI from Task 1.
- Produces the exact public recipient embedded in Task 2 and an offline private identity used only for recovery.

- [ ] **Step 1: Generate the recovery identity**

Run the generate command with the ignored `.Codex/memory` path, enforce `chmod 600`, and confirm `git check-ignore` reports the path as ignored. Never print the identity.

- [ ] **Step 2: Perform a harmless local round trip**

Create a temporary sample SQL file, encrypt it with the public recipient, decrypt it with the private identity, compare the files byte-for-byte, then remove the temporary plaintext and ciphertext.

- [ ] **Step 3: Verify repository hygiene**

Run:

```bash
git status --short
git grep -n 'AGE-SECRET-KEY-' -- . ':!docs/superpowers/plans/2026-08-10-encrypted-d1-backups.md'
```

Expected: no private identity is tracked or shown by grep.

### Task 4: Deploy, verify production backup, and remove plaintext history

**Files:**
- No additional repository files expected.

**Interfaces:**
- Consumes the merged workflow and offline private identity.
- Produces a verified encrypted COM/CN backup pair and an artifact inventory with zero plaintext SQL artifacts.

- [ ] **Step 1: Push and merge through main checks**

Push `codex/secure-d1-backups`, create a PR to `main`, wait for required tests, and merge only if all checks pass.

- [ ] **Step 2: Run the backup workflow manually**

Run `Production D1 Backup - COM and CN` on `main` and wait for success.

- [ ] **Step 3: Download and inspect the new artifacts safely**

Download the new COM and CN artifacts to a fresh mode-`0700` temporary directory. Assert archives contain `.sql.age`, manifest, and metadata only, with no `.sql` member.

- [ ] **Step 4: Decrypt and validate both backups**

Decrypt both files locally with the offline identity. Confirm each output exceeds 100 bytes, contains the expected D1 SQL export structure and database-specific metadata, and passes its checksum validation. Do not print SQL content.

- [ ] **Step 5: Delete the 40 pre-existing plaintext artifacts**

Resolve artifact IDs from the API using creation time and old artifact payload contract, then delete each exact ID. Do not delete the newly verified encrypted artifacts.

- [ ] **Step 6: Verify final artifact inventory**

Query all active `sagemro-d1-*` artifacts. Expected: every remaining backup comes from the encrypted workflow and contains only ciphertext; plaintext artifact count is zero.

- [ ] **Step 7: Record completion without secrets**

Record run ID, artifact IDs, creation time, public recipient fingerprint, verification time, and deletion count in `.Codex/memory/backup-recovery/README.md`. Never record the private identity in logs or Git.
