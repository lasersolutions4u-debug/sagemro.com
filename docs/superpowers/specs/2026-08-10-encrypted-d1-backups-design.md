# Encrypted Production D1 Backups

## Goal

Stop publishing plaintext production D1 exports as GitHub Actions artifacts without losing the ability to restore either the COM or CN database.

## Scope

This change covers only the existing scheduled D1 backup workflow and removal of its existing plaintext artifacts. It does not change application code, D1 schema, deployment workflows, or database contents.

## Design

The workflow will continue to export COM and CN independently, but it will encrypt each SQL export with `age` before any artifact upload. Encryption uses a public recipient embedded in the workflow; the corresponding private identity never enters GitHub, repository secrets, workflow logs, or the repository.

The `age` executable will be installed from a fixed upstream release and verified against a fixed SHA-256 checksum. The workflow will:

1. Export each database to a runner-local temporary directory.
2. Validate that each plaintext export is non-empty.
3. Encrypt each export to a separate `.sql.age` file.
4. Delete the plaintext SQL files immediately after encryption.
5. Hash and upload only the encrypted files, manifests, and non-sensitive metadata.
6. Remove the complete temporary directory in an unconditional cleanup step.

The private identity will be generated locally with mode `0600` and stored outside Git in `.Codex/memory/backup-recovery/`. The user must copy it to a password manager or offline encrypted storage before plaintext artifacts are deleted. Losing this identity makes all encrypted backups unrecoverable.

## Verification and deletion order

Deletion is deliberately last:

1. Contract tests must first fail against the current plaintext-upload workflow.
2. Update the workflow and make the tests pass.
3. Locally encrypt and decrypt a harmless sample with the generated key pair.
4. Commit and push the workflow, then run it manually.
5. Download the newly generated COM and CN encrypted artifacts.
6. Decrypt both locally and validate that each is a non-empty SQL export for the expected database.
7. Confirm that the uploaded artifacts contain no plaintext `.sql` files.
8. Only then delete all pre-existing plaintext D1 artifacts through the GitHub API.
9. Query the artifacts API again and confirm that only encrypted backups remain.

If any verification before step 8 fails, stop and retain the existing plaintext artifacts until a recoverable encrypted replacement exists.

## Recovery procedure

To restore, download the required `.sql.age` artifact, decrypt it locally with the offline identity, verify its recorded SHA-256 digest, and then use the existing guarded D1 restore procedure. The decrypted SQL must remain in a temporary directory and be deleted after the restore or rehearsal.

## Follow-up boundary

This is immediate containment. A later task may copy encrypted backups to an independent private object store with daily and weekly lifecycle rules. That later storage decision is not required to remove the current plaintext exposure because the artifacts produced here are encrypted before upload.
