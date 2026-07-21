# Engineer Account Activation And Admin Terminology Design

## Goal

Give Admin a complete, secure workflow for turning an approved engineer cooperation application into an engineer account. Remove the current manual engineer-ID handoff, require a verified email address, let the engineer set their own password through a one-time activation link, and unify the engineer-related terminology across the Admin interface.

## Scope

- Make email required in the public engineer cooperation application for both markets.
- Add a direct account-opening action to each approved application in Admin.
- Create and link the engineer account in one Worker operation.
- Send a single-use activation link by email so the engineer sets their own password.
- Support engineer login by either email or phone after activation.
- Separate application review status from account activation status in Admin.
- Unify Chinese and English terminology on the engineer application and engineer management surfaces.
- Add the required D1 schema, Worker tests, Admin tests, frontend tests, and deployment checks.

The following are out of scope for this iteration:

- Public engineer self-registration.
- Bulk engineer account import.
- Multi-role customer/engineer accounts.
- International SMS activation or password recovery.
- A standalone generic account generator.

## Approved Product Direction

Use the existing Engineer Applications page as the account-opening surface. Once an application is approved, Admin clicks `Open engineer account` / `开通工程师账号` on that application card. A confirmation modal uses the submitted information as defaults and asks Admin only for the missing operational fields. Admin does not navigate to another page and never copies a database ID manually.

Do not expose or transmit an Admin-generated plaintext password. The engineer receives a 48-hour, single-use activation link by email and chooses a password of at least 10 characters.

Retire the legacy generic Admin engineer-creation branch that accepts a plaintext password. `POST /api/admin/users` remains available for customer creation only; attempts to create `userType = engineer` return an instruction to use an approved engineer application. Remove the unreachable engineer form code from the Admin customer page.

## Terminology

Use `engineer service network` / `工程师服务协作网络` for the network and `engineer cooperation application` / `工程师合作申请` for the application. Do not use `certified service representative`, `认证服务代表`, or `服务代表` on these Admin surfaces.

### Chinese Application Terms

| Current | Approved |
| --- | --- |
| 工程师申请审核池 | 工程师合作申请 |
| SAGEMRO 认证服务代表网络 | SAGEMRO 工程师服务协作网络 |
| 已提交 | 待审核 |
| 可合作 | 审核通过 |
| 暂不合作 | 未通过 |
| 已创建账号 | Remove from review statuses |
| 审核处理 | 审核与账号开通 |
| 创建账号后的工程师 ID | Remove manual field |
| 保存审核 | 保存审核结果 |
| Admin | 管理员 or 运营团队, according to context |

### Engineer Management Terms

- Use `区域负责人`, never `区域主管` or bare `主管`.
- Use `工程师编号`, not `No.` on the Chinese interface.
- Use `服务项目`, not `熟悉工艺/服务` or `维修项目` when the field includes broader service work.
- Use `服务区域`, not mixed `服务地区` / `服务区域` labels on engineer surfaces.
- Use `工作状态` for availability such as `可派工 / 暂停 / 离线` when a label is required.

The English interface should use `Engineer Applications`, `Engineer Service Network`, `Review and account setup`, `Approved`, `Not approved`, `Open engineer account`, `Awaiting activation`, and `Activated` consistently.

## Status Model

Application review and account activation are separate state dimensions.

### Application Review Status

- `submitted`: `待审核` / `Submitted`
- `reviewing`: `审核中` / `Reviewing`
- `qualified`: `审核通过` / `Approved`
- `rejected`: `未通过` / `Not approved`
- `archived`: `已归档` / `Archived`

The existing `converted` value remains readable for legacy rows but is no longer selectable or written by the new workflow. Legacy `converted` rows render as `审核通过` with their linked account state.

### Account Activation Status

Account state is derived from the linked engineer and activation record:

- `not_opened`: no linked engineer account.
- `awaiting_activation`: linked engineer exists, has not completed activation, and has a valid activation token.
- `activation_expired`: linked engineer exists, has not completed activation, and no valid token remains.
- `activated`: engineer has completed activation and may sign in.

Activation does not automatically mean the engineer is dispatchable. Dispatch remains controlled by the existing cooperation and workload fields. A newly activated account defaults to confirmed cooperation and available workload only when Admin selected those values during account opening; activation itself does not change them.

## Public Application Form

Name, phone, and email are required in both locales.

- Chinese labels: `姓名`, `手机 / 电话`, `邮箱`.
- English labels: `Name`, `Phone`, `Email`.
- Remove `可选` / `Optional` from the email placeholder.
- Use native email input semantics and frontend validation.
- Worker normalizes email to lowercase and rejects an empty or invalid address.
- Application submission still does not create an account.

The submitted email becomes the account email if Admin opens the account. Admin can correct an obvious typo in the confirmation modal before creation, but the final email must pass validation and uniqueness checks.

Legacy applications may not contain an email because it was previously optional. They remain reviewable, but the account-opening modal requires Admin to enter a valid engineer-confirmed email before account creation.

## Identity And Uniqueness Rules

- Engineer email is required and normalized with the existing email normalization rule.
- Engineer phone remains required for this workflow and is stored with a canonical identity value for uniqueness checks while preserving the submitted display value.
- An email may belong to only one customer or engineer account within the current market database.
- A phone may belong to only one customer or engineer account within the current market database.
- If the same person needs both customer and engineer capabilities, do not create two conflicting accounts. Multi-role identity is a separate future design.
- The `.com` and `.cn` deployments use separate D1 databases; uniqueness is enforced independently in each market database.

The account-opening endpoint checks both `customers` and `engineers` before writing. A shared identity registry with a unique `(identity_type, normalized_value)` key provides the final cross-role race-condition protection.

## Admin Experience

### Application Card

Each application card shows two independent badges:

- Review badge: `待审核`, `审核中`, `审核通过`, `未通过`, or `已归档`.
- Account badge: `未开通`, `等待激活`, `激活已过期`, or `已激活`.

Actions follow the current state:

- `待审核`: `开始审核`.
- `审核中`: save notes and choose an outcome.
- `审核通过 + 未开通`: `开通工程师账号`.
- `等待激活`: show engineer number, activation email timestamp, expiry time, and `重新发送激活邮件`.
- `激活已过期`: show engineer number and `重新发送激活邮件`.
- `已激活`: show engineer number and `查看工程师档案`.
- `未通过` or `已归档`: no account-opening action.

Remove the manual `converted_user_id` input and the instruction to create an account elsewhere.

### Account-Opening Modal

Prepopulate the modal from the application:

- Name.
- Email.
- Phone.
- Service regions.
- Equipment and skill tags.
- Experience summary.

Admin confirms or supplies:

- Account type: engineer or regional lead.
- Service items.
- Regional lead assignment for a normal engineer.
- Responsible region.
- Team name.
- Certification status.
- Cooperation status and workload status.

The primary action is `确认开通并发送激活邮件`. Its confirmation copy states that the system will create an engineer number and send a 48-hour activation link. It never asks Admin to enter a password.

## Account Creation Transaction

Add a dedicated endpoint rather than composing the generic user endpoint and review PATCH from the browser:

`POST /api/admin/engineer-applications/:applicationId/open-account`

The endpoint requires Admin authentication and accepts the confirmed operational fields plus any corrected name, email, or phone.

The Worker performs these steps as one D1 batch after all validation and email preparation data are ready:

1. Load the application and reject missing, rejected, or archived applications.
2. Return the existing linked account when the operation has already succeeded, making retries idempotent.
3. Normalize and validate name, email, and phone.
4. Check email and phone across customers and engineers.
5. Generate engineer ID and `E` engineer number.
6. Generate a cryptographically random activation token and store only its SHA-256 hash.
7. Generate an unusable random password hash so the account has no Admin-known password before activation.
8. Claim the normalized email and phone in the shared identity registry for the new engineer.
9. Insert the engineer with email, `auth_status = 'pending_activation'`, and the confirmed operational fields.
10. Insert the activation record with a 48-hour expiry.
11. Update the application to `qualified` and set `converted_user_id` to the engineer ID.
12. Write the account creation and application linkage audit records.

After the database batch succeeds, send the activation email. If delivery fails, keep the linked account in `awaiting_activation`, return a response that clearly reports the email failure, and allow Admin to use the resend action. Do not delete the account or application link because retrying creation could produce duplicates.

The application list response includes the linked engineer ID, engineer number, account activation state, last send status, last sent time, and current expiry time so Admin can render the approved four-state interface without additional per-card requests.

## Activation Tokens

Add a dedicated activation table with:

- `id`
- `engineer_id`
- `token_hash`
- `expires_at`
- `used_at`
- `revoked_at`
- `created_by`
- `sent_at`
- `send_status`
- `send_error`
- `created_at`
- `updated_at`

Only one unused, unrevoked activation token may exist per engineer. Resending sets `revoked_at` on earlier unused tokens and creates a new token. Token values are never stored or logged in plaintext.

The email link points to the engineer host for the current market and places the secret in the URL fragment so it is not sent in the HTTP request, access logs, or Referer headers:

- `https://engineer.sagemro.com/activate#token=...`
- `https://engineer.sagemro.cn/activate#token=...`

The activation page reads the fragment, immediately removes it from browser history with `history.replaceState`, and then submits the token to the API.

The activation page submits the token and the engineer-selected password to:

`POST /api/auth/engineer/activate`

The Worker verifies the hash, expiry, unused state, linked engineer, and password length. On success it updates the password hash and salt, sets `auth_status = 'authenticated'`, clears `first_login_password_reset_required`, marks the token used, and writes an audit log. Reusing or replaying the link returns an expired-or-used message without revealing account details.

## Email Delivery

Reuse the existing Cloudflare Email / Resend delivery path, but introduce an activation-specific message function instead of overloading verification-code copy.

The email contains:

- SAGEMRO engineer account activation subject.
- Engineer name and engineer number.
- One clear activation button and the plain link as fallback.
- The 48-hour expiry.
- A warning to ignore the message if the recipient did not apply.
- No password and no sensitive application details.

Admin can resend after a failed delivery or expiry. Rate-limit resend actions per engineer and Admin to prevent accidental or abusive mail volume.

Use a dedicated Admin endpoint:

`POST /api/admin/engineer-applications/:applicationId/resend-activation`

It validates the linked account, rejects already activated accounts, revokes prior unused tokens, creates a new 48-hour token, sends the email, and returns the updated activation metadata.

## Login And Recovery

Engineer login accepts either normalized email or phone plus password. Login explicitly rejects the new `pending_activation` state before issuing a token. Existing legacy engineer `auth_status` values keep their current login behavior so this release does not lock out established accounts; normalizing historical authentication states is a separate migration and rollout. Customer login behavior remains unchanged, except cross-role uniqueness prevents ambiguous email or phone ownership for newly created accounts.

The first version uses email activation and email-based reactivation as the reliable international path. Existing mainland-China SMS password recovery remains available where already supported. International SMS recovery is out of scope and must not be presented as available.

An activated engineer can use the existing authenticated change-password flow. A later iteration may add email-based forgot-password recovery for international users.

## Schema Changes

Create one new numbered migration containing:

- `engineers.email`.
- `engineer_account_activations` table and indexes.
- An `account_identities` registry with `identity_type`, `normalized_value`, `owner_type`, and `owner_id`, plus a unique `(identity_type, normalized_value)` index.
- A unique normalized engineer email index as local table protection.
- Any application indexes needed for linked-account lookup.

Before enabling cross-role uniqueness enforcement, the migration or deployment preflight must check existing customer email duplicates and cross-role phone duplicates. Historical engineers do not yet have an email column, so engineer-email conflicts cannot exist before this migration. The migration then backfills the registry for existing accounts. Do not silently delete or merge records. If conflicts exist, stop deployment and resolve them explicitly.

All future customer and engineer creation paths must claim identities in the registry. Account deletion must release the matching registry rows in the same D1 batch. This prevents the new workflow from being correct while older account creation paths bypass uniqueness.

The China full-schema representation must remain compatible with the incremental production migrations. No workflow may assume migrations run automatically.

## Error Handling And Idempotency

- Double-clicking or retrying account opening returns the same linked engineer instead of creating another account.
- Duplicate phone or email returns a field-specific conflict and writes nothing.
- Invalid application state returns a clear validation error and writes nothing.
- D1 failure rolls back account, activation, application linkage, and audit writes together.
- Email delivery failure does not roll back the database account; Admin sees the failure and can resend.
- Resend sets `revoked_at` on previous unused tokens before issuing a new one.
- Activation of an already activated account returns a safe completed/used response and does not change the password.
- Expired activation does not allow password creation.

## Security And Audit

- Use Web Crypto randomness for activation tokens.
- Store only token hashes.
- Never log activation tokens, activation URLs, passwords, or password hashes.
- Require Admin JWT authorization for open-account and resend endpoints.
- Add rate limits to resend and activation attempts.
- Audit account creation, application linkage, activation email resend, activation completion, and relevant failures without sensitive payloads.
- Keep the existing public engineer registration endpoint closed with HTTP 410.

## Testing

### Worker

- Application rejects missing or invalid email.
- Account opening requires an approved application and Admin authentication.
- Submitted application fields correctly populate the engineer record.
- Phone and email conflicts across both account tables are rejected.
- Existing customer creation and deletion paths claim and release the shared identity registry correctly.
- The legacy generic Admin engineer creation path is closed and cannot bypass activation.
- Account opening is atomic and idempotent.
- Activation token is hashed, single-use, and expires after 48 hours.
- Email failure leaves a linked pending account that can be resent.
- Resend invalidates earlier tokens.
- Activation sets the password and authenticated status.
- Engineer login succeeds with either email or phone after activation and fails before activation.
- Public engineer registration remains closed.

### Admin

- Terminology contract rejects the retired Chinese and English terms.
- Review and account badges render independently.
- Account-opening action only appears for approved, unlinked applications.
- Confirmation modal is prefilled from the application.
- No password or manual engineer-ID field is rendered.
- Pending, expired, and activated states expose the correct actions.

### Frontend

- Engineer application email is marked required in both locales.
- Native email validation is present.
- Existing application submission still does not create an account.
- Activation page handles valid, expired, used, and invalid links.
- Password length and confirmation validation are covered.

### End-To-End Verification

- Submit one `.com` and one `.cn` application with email.
- Approve and open each account from the matching Admin host.
- Confirm the generated engineer number and linked application state.
- Open the activation link, set a password, and sign in once with email and once with phone.
- Confirm an unused prior link cannot be replayed after resend or activation.
- Confirm the activated engineer appears in Admin Engineers and opens the correct profile.

## Deployment

This feature changes Worker schema and behavior, so it cannot be delivered only from `china-edition`.

1. Add and test the migration on both branches as appropriate.
2. Before deploying the Worker, manually run the production migration against both D1 databases according to the repository deployment rules.
3. Deploy `main` so the shared Worker and `.com` frontend/Admin are updated.
4. Push `china-edition` for the China frontend/Admin build.
5. Manually run the Aliyun ECS China deployment workflow.
6. Verify activation email configuration and sender domains for both markets.
7. Smoke-test Admin open-account, activation, email/phone login, both API health endpoints, and both engineer hosts.

If either production D1 migration is not confirmed, do not deploy the Worker endpoint that depends on the new columns and table.
