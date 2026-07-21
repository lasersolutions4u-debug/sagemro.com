export function normalizeIdentityEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeIdentityPhone(value) {
  return String(value || '').trim().replace(/[\s().-]/g, '');
}

export function identityClaimsForAccount({ ownerType, ownerId, email, phone }) {
  const claims = [];
  const normalizedEmail = normalizeIdentityEmail(email);
  const normalizedPhone = normalizeIdentityPhone(phone);

  if (normalizedEmail) {
    claims.push({ identityType: 'email', normalizedValue: normalizedEmail, ownerType, ownerId });
  }
  if (normalizedPhone) {
    claims.push({ identityType: 'phone', normalizedValue: normalizedPhone, ownerType, ownerId });
  }

  return claims;
}

export function identityInsertStatements(env, account) {
  return identityClaimsForAccount(account).map((claim) => env.DB.prepare(`
    INSERT INTO account_identities (identity_type, normalized_value, owner_type, owner_id)
    VALUES (?, ?, ?, ?)
  `).bind(claim.identityType, claim.normalizedValue, claim.ownerType, claim.ownerId));
}

export function identityDeleteStatement(env, ownerType, ownerId) {
  return env.DB.prepare(
    'DELETE FROM account_identities WHERE owner_type = ? AND owner_id = ?'
  ).bind(ownerType, ownerId);
}
