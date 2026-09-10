import { signSessionJwt } from '../../src/lib/auth.js';

export const fixtureCredential = { password_hash: 'fictional-session-password-hash', salt: 'fictional-session-salt' };
export const fixtureAdminEnv = { ADMIN_PASSWORD: 'fictional-bootstrap-password', ADMIN_PHONE: 'fictional-bootstrap-phone' };
const storedFixtureAccounts = new WeakMap();

export function withFixtureAccounts(env, accounts) {
  Object.assign(env, { ...fixtureAdminEnv, ...env });
  const database = env.DB;
  const storedAccounts = storedFixtureAccounts.get(database) || new Set();
  storedFixtureAccounts.set(database, storedAccounts);
  env.DB = {
    ...database,
    prepare(sql) {
      const match = /^SELECT \* FROM (customers|engineers|admin_staff_accounts) WHERE id = \?$/i.exec(sql.trim());
      if (!match || !accounts[match[1]]) return database.prepare(sql);
      let id;
      return {
        bind(value) { id = value; return this; },
        async first() {
          const account = accounts[match[1]].find(row => row.id === id);
          const statement = database.prepare(sql).bind(id);
          const original = statement.first ? await statement.first() : null;
          const key = `${match[1]}:${id}`;
          if (original?.id === id) {
            storedAccounts.add(key);
            return { ...fixtureCredential, ...account, ...original };
          }
          if (storedAccounts.has(key)) return null;
          return account ? { ...fixtureCredential, ...account } : null;
        },
      };
    },
  };
  storedFixtureAccounts.set(env.DB, storedAccounts);
  return env;
}

export function signFixtureSession(payload, secret, credential = fixtureCredential) {
  return signSessionJwt({ market: 'com', ...payload }, credential, secret);
}

export async function signEnvSession(payload, env) {
  const claims = { market: 'com', ...payload };
  let credential;
  if (claims.userType === 'admin' && !claims.staffId) {
    const cn = claims.market === 'cn' && env.ADMIN_PHONE_CN && env.ADMIN_PASSWORD_CN;
    credential = { password_hash: cn ? env.ADMIN_PASSWORD_CN : env.ADMIN_PASSWORD,
      salt: cn ? env.ADMIN_PHONE_CN : env.ADMIN_PHONE };
  } else {
    const table = claims.userType === 'admin' ? 'admin_staff_accounts' : claims.userType === 'engineer' ? 'engineers' : 'customers';
    const db = claims.market === 'cn' && env.DB_CN ? env.DB_CN : env.DB;
    credential = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(claims.userId).first();
  }
  return signSessionJwt(claims, credential, env.JWT_SECRET);
}
