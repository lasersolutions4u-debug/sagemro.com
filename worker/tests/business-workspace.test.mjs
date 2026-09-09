import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';
import './business-quote-api.test.mjs';

const secret = 'business-workspace-fictional-test-secret';
function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  t.after(() => sqlite.close());
  const DB = { __sqlite: sqlite, prepare(sql) { let args=[]; return { bind(...v) { args=v; return this; }, async first() { return sqlite.prepare(sql).get(...args)||null; }, async all() { return {results:sqlite.prepare(sql).all(...args)}; }, async run() { const r=sqlite.prepare(sql).run(...args); return {meta:{changes:Number(r.changes)}}; } }; }, async batch(statements) { sqlite.exec('BEGIN'); try { const out=[]; for(const s of statements) out.push(await s.run()); sqlite.exec('COMMIT'); return out; } catch(e) { sqlite.exec('ROLLBACK'); throw e; } } };
  return { DB, JWT_SECRET:secret, ENVIRONMENT:'development', KV:{async get(){return null;},async put(){},async delete(){}} };
}
async function api(env,path,{id='admin',method='GET',body,claims={},cookie=false}={}) {
  const token=await signJwt({userId:id,userType:'admin',market:'com',...(id==='admin'?{}:{staffId:id,staffRole:'admin'}),csrf:'fixture-csrf',exp:Math.floor(Date.now()/1000)+3600,...claims},secret);
  const headers={Origin:'https://admin.sagemro.com','Content-Type':'application/json','X-CSRF-Token':'fixture-csrf',...(cookie?{Cookie:`sagemro_admin_session=${token}`}:{Authorization:`Bearer ${token}`})};
  const url=new URL(`https://api.sagemro.com${path}`); if(method==='GET'&&!url.searchParams.has('expected_staff_id'))url.searchParams.set('expected_staff_id',id);
  const response=await worker.fetch(new Request(url,{method,headers,...(body?{body:JSON.stringify({expected_staff_id:id,...body})}:{})}),env,{});
  return {status:response.status,data:await response.json()};
}
function staff(db,id,role,supervisor=null,grade=1,market='com') {
  db.prepare("INSERT INTO admin_staff_accounts(id,normalized_login,password_hash,salt,role,display_name,market_scope,must_change_password,business_profile_required) VALUES (?,?,'secret-hash','secret-salt','operations',?,?,0,1)").run(id,`${id}@example.invalid`,id,market);
  db.prepare('INSERT INTO business_staff_profiles(staff_id,role,grade,supervisor_staff_id) VALUES (?,?,?,?)').run(id,role,grade,supervisor);
}
function seed(env) {
  const db=env.DB.__sqlite;
  for(const n of ['a','b']) {
    staff(db,`director-${n}`,'business_director'); staff(db,`manager-${n}`,'business_manager',`director-${n}`); staff(db,`specialist-${n}`,'business_specialist',`manager-${n}`);
    db.prepare('INSERT INTO business_territories(id,name,market) VALUES (?,?,?)').run(n,`Territory ${n}`,'com');
    db.prepare('INSERT INTO business_director_territories(staff_id,territory_id) VALUES (?,?)').run(`director-${n}`,n);
  }
  for(const id of ['director-a','manager-a','specialist-a','specialist-b','unassigned']) {
    db.prepare("INSERT INTO customers(id,user_no,name,password_hash,onesignal_player_id) VALUES (?,?,?,'private-hash','private-push')").run(id,id,id);
    db.prepare("INSERT INTO leads(id,name,source,source_type,conversation_id) VALUES (?,?,'referral','general','private-conversation')").run(id,id);
    db.prepare("INSERT INTO work_orders(id,order_no,type,description) VALUES (?,?,'fault','Fictional fault')").run(id,id);
    if(id!=='unassigned') for(const kind of ['customer','lead','work_order'])db.prepare('INSERT INTO business_record_assignments(kind,record_id,territory_id,owner_staff_id) VALUES (?,?,?,?)').run(kind,id,id.endsWith('b')?'b':'a',id);
  }
}

test('business migration schema is additive and creates scoped workspace',async(t)=>{
  const env=fixture(t);
  assert.ok(env.DB.__sqlite.prepare('PRAGMA table_info(admin_staff_accounts)').all().some(c=>c.name==='business_profile_required'));
  const r=await api(env,'/api/admin/business/organization');
  assert.equal(r.status,200); assert.equal(r.data.can_configure,true);
});

test('all nine business grades use identical owner/team/territory scope for list detail and export',async(t)=>{
  const env=fixture(t); seed(env);
  for(const grade of [1,2,3]) for(const role of ['director','manager','specialist']) {
    const id=`${role}-a`; env.DB.__sqlite.prepare('UPDATE business_staff_profiles SET grade=? WHERE staff_id=?').run(grade,id);
    const expected=role==='director'?['director-a','manager-a','specialist-a']:role==='manager'?['manager-a','specialist-a']:['specialist-a'];
    for(const kind of ['customer','lead','work_order']) {
      const r=await api(env,`/api/admin/business/records?kind=${kind}`,{id});
      assert.equal(r.status,200,JSON.stringify(r.data)); assert.deepEqual(r.data.records.map(x=>x.id),expected);
      assert.equal(JSON.stringify(r.data).includes('private-'),false);
      const exported=await api(env,`/api/admin/business/records?kind=${kind}&export=1`,{id}); assert.deepEqual(exported.data.records,r.data.records);
      for(const denied of ['specialist-b','unassigned'])assert.equal((await api(env,`/api/admin/business/records/${kind}/${denied}`,{id})).status,404);
    }
  }
});

test('authoritative staff identity defeats spoofed bearer/cookie roles and all legacy access paths',async(t)=>{
  const env=fixture(t); seed(env);
  for(const cookie of [false,true]) {
    const session=await api(env,'/api/auth/session',{id:'specialist-a',cookie});
    assert.equal(session.data.user.staffRole,'business_specialist'); assert.equal(session.data.user.businessGrade,1);
    for(const path of ['/api/admin/stats','/api/admin/users','/api/material-requisitions','/api/notifications','/api/conversations','/api/test/db']) {
      const r=await api(env,path,{id:'specialist-a',cookie}); assert.ok([403,404].includes(r.status),`${path} ${r.status}`);
    }
    assert.equal((await api(env,'/api/chat',{id:'specialist-a',cookie,method:'POST',body:{message:'hello'}})).status,403);
  }
  env.DB.__sqlite.prepare("DELETE FROM business_staff_profiles WHERE staff_id='specialist-a'").run();
  assert.notEqual((await api(env,'/api/admin/business/organization',{id:'specialist-a'})).status,200);
  env.DB.__sqlite.prepare("UPDATE admin_staff_accounts SET is_active=0 WHERE id='director-a'").run();
  assert.notEqual((await api(env,'/api/admin/business/organization',{id:'manager-a'})).status,200);
});

test('assignment checks both ends, revision, identity and invalidated pagination',async(t)=>{
  const env=fixture(t); seed(env);
  const path='/api/admin/business/records/customer/specialist-a/assignment';
  assert.equal((await api(env,path,{id:'specialist-a',method:'PUT',body:{revision:0,territory_id:'a',owner_staff_id:'manager-a'}})).status,403);
  assert.equal((await api(env,path,{id:'manager-a',method:'PUT',body:{revision:0,territory_id:'b',owner_staff_id:'specialist-b'}})).status,403);
  assert.equal((await api(env,'/api/admin/business/records/customer/specialist-b/assignment',{id:'manager-a',method:'PUT',body:{revision:0,territory_id:'a',owner_staff_id:'manager-a'}})).status,404);
  const moved=await api(env,path,{id:'manager-a',method:'PUT',body:{revision:0,territory_id:'a',owner_staff_id:'manager-a'}}); assert.equal(moved.status,200); assert.equal(moved.data.record.assignment_revision,1);
  assert.equal((await api(env,path,{id:'manager-a',method:'PUT',body:{revision:0,territory_id:'a',owner_staff_id:'manager-a'}})).status,409);
  assert.equal((await api(env,'/api/admin/business/organization?expected_staff_id=manager-a',{id:'specialist-a'})).status,403);
  const page=await api(env,'/api/admin/business/records?kind=customer&limit=1',{id:'director-a'}); assert.ok(page.data.next_cursor);
  env.DB.__sqlite.prepare("DELETE FROM business_director_territories WHERE staff_id='director-a'").run();
  const next=await api(env,`/api/admin/business/records?kind=customer&cursor=${encodeURIComponent(page.data.next_cursor)}&scope_version=${page.data.scope_version}`,{id:'director-a'}); assert.equal(next.status,409);
});

test('unified business menus never grant legacy management or deferred modules to any business role', async t => {
  const env = fixture(t); seed(env);
  for (const id of ['director-a', 'manager-a', 'specialist-a']) {
    for (const path of ['/api/admin/users', '/api/admin/leads', '/api/admin/workorders', '/api/admin/staff', '/api/admin/knowledge', '/api/admin/ratings', '/api/admin/materials']) {
      const result = await api(env, path, { id });
      assert.equal(result.status, 403, `${id}: ${path}`);
    }
  }
});

test('bootstrap configures territories and creates audited business accounts with valid hierarchy atomically',async(t)=>{
  const env=fixture(t); seed(env);
  const preview=await api(env,'/api/admin/business/organization');
  const created=await api(env,'/api/admin/staff',{method:'POST',body:{scope_version:preview.data.scope_version,login:'new-specialist@example.invalid',display_name:'Fictional Specialist',role:'business_specialist',grade:2,supervisor_staff_id:'manager-a',market_scope:'com'}});
  assert.equal(created.status,201,JSON.stringify(created.data));
  assert.equal(created.data.staff.role,'business_specialist'); assert.equal(created.data.staff.grade,2);
  assert.ok(created.data.temporary_password);
  const raw=env.DB.__sqlite.prepare('SELECT role,business_profile_required FROM admin_staff_accounts WHERE id=?').get(created.data.staff.id);
  assert.deepEqual({...raw},{role:'operations',business_profile_required:1});
  assert.equal(env.DB.__sqlite.prepare('SELECT count(*) n FROM audit_logs WHERE target_id=?').get(created.data.staff.id).n,1);
  const login=await worker.fetch(new Request('https://api.sagemro.com/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://admin.sagemro.com'},body:JSON.stringify({phone:'new-specialist@example.invalid',password:created.data.temporary_password})}),env,{});
  assert.equal(login.status,200); assert.equal((await login.json()).user.staffRole,'business_specialist');
  for(const body of [{supervisor_staff_id:'specialist-a'},{supervisor_staff_id:null},{market_scope:'cn'},{grade:4}]) {
    const preview=await api(env,'/api/admin/business/organization');
    const denied=await api(env,'/api/admin/staff',{method:'POST',body:{scope_version:preview.data.scope_version,login:'invalid@example.invalid',display_name:'Invalid Fixture',role:'business_manager',grade:1,market_scope:'com',supervisor_staff_id:'director-a',...body}});
    assert.equal(denied.status,400,JSON.stringify(denied.data));
    assert.equal(env.DB.__sqlite.prepare("SELECT count(*) n FROM admin_staff_accounts WHERE normalized_login='invalid@example.invalid'").get().n,0);
  }
  const territory=await api(env,'/api/admin/business/territories',{method:'POST',body:{name:'New territory',market:'com'}}); assert.equal(territory.status,201);
  const changed=await api(env,'/api/admin/business/staff/director-a',{method:'PUT',body:{revision:0,role:'business_director',grade:3,supervisor_staff_id:null,territory_ids:['a',territory.data.territory.id]}});
  assert.equal(changed.status,200); assert.equal(changed.data.staff.revision,1);
  assert.equal((await api(env,'/api/admin/business/staff/director-a',{method:'PUT',body:{revision:0,role:'business_director',grade:2,territory_ids:[]}})).status,409);
  assert.equal((await api(env,'/api/admin/business/territories',{id:'director-a',method:'POST',body:{name:'No',market:'com'}})).status,403);
});

test('business notifications never join legacy admin/operations broadcasts',()=>{
  const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
  const broadcasts=source.match(/WHERE is_active = 1 AND role IN \('admin', 'operations'\)[^\n]+/g);
  assert.equal(broadcasts.length,3);
  assert.ok(broadcasts.every(sql=>sql.includes('business_profile_required = 0')));
});

test('business scope intersects database market and staff market with active fixed-depth hierarchy',async(t)=>{
  const env=fixture(t); seed(env);
  const cn=fixture(t); seed(cn); env.DB_CN=cn.DB;
  const cnToken=await signJwt({userId:'specialist-a',staffId:'specialist-a',staffRole:'admin',userType:'admin',market:'cn',exp:Math.floor(Date.now()/1000)+3600},secret);
  const r=await worker.fetch(new Request('https://api.sagemro.com/api/admin/business/records?kind=customer&expected_staff_id=specialist-a',{headers:{Origin:'https://admin.sagemro.cn',Authorization:`Bearer ${cnToken}`}}),env,{});
  assert.equal(r.status,403);
  const db=env.DB.__sqlite;
  db.prepare("INSERT INTO business_territories(id,name,market) VALUES ('cn','China','cn')").run();
  assert.equal((await api(env,'/api/admin/business/staff/director-a',{method:'PUT',body:{revision:0,role:'business_director',grade:1,territory_ids:['cn']}})).status,400);
  db.prepare("UPDATE business_staff_profiles SET supervisor_staff_id='specialist-a' WHERE staff_id='manager-a'").run();
  assert.equal((await api(env,'/api/admin/business/records?kind=customer',{id:'specialist-a'})).status,403);
});

test('business account audit failure rolls back account and profile together',async(t)=>{
  const env=fixture(t); seed(env);
  env.DB.__sqlite.exec("CREATE TRIGGER fail_business_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'fictional audit failure'); END;");
  const preview=await api(env,'/api/admin/business/organization');
  const r=await api(env,'/api/admin/staff',{method:'POST',body:{scope_version:preview.data.scope_version,login:'rollback@example.invalid',display_name:'Rollback Fixture',role:'business_director',grade:1,market_scope:'com'}});
  assert.equal(r.status,500);
  assert.equal(env.DB.__sqlite.prepare("SELECT count(*) n FROM admin_staff_accounts WHERE normalized_login='rollback@example.invalid'").get().n,0);
});

test('business public routes default deny and organization includes inherited territory choices',async(t)=>{
  const env=fixture(t); seed(env);
  const org=await api(env,'/api/admin/business/organization',{id:'manager-a'});
  assert.deepEqual(org.data.staff.find(s=>s.id==='specialist-a').effective_territory_ids,['a']);
  for(const id of ['specialist-a','manager-a']) {
    for(const path of ['/api/leads','/api/chat/upload-image','/api/service-request-assist']) {
      assert.equal((await api(env,path,{id,method:'POST',body:{message:'Fictional'}})).status,403);
    }
  }
  env.DB.__sqlite.prepare("DELETE FROM business_staff_profiles WHERE staff_id='specialist-a'").run();
  assert.equal((await api(env,'/api/chat',{id:'specialist-a',method:'POST',body:{message:'Fictional'}})).status,403);
});

test('business organization resolves a growing staff team with bounded SQL queries',async(t)=>{
  const env=fixture(t); seed(env);
  for(let i=0;i<30;i++)staff(env.DB.__sqlite,`extra-${i}`,'business_specialist','manager-a');
  let count=0;const prepare=env.DB.prepare.bind(env.DB);env.DB.prepare=(sql)=>{count++;return prepare(sql);};
  const r=await api(env,'/api/admin/business/records?kind=customer',{id:'manager-a'});
  assert.equal(r.status,200);assert.ok(count<35,`${count} queries`);
});

test('staff account list displays effective business profiles and migration preserves legacy accounts',async(t)=>{
  const env=fixture(t); seed(env);
  const list=await api(env,'/api/admin/staff');
  assert.equal(list.data.staff.find(s=>s.id==='manager-a').role,'business_manager');
  const db=new DatabaseSync(':memory:'); t.after(()=>db.close());
  db.exec("CREATE TABLE _migrations(version TEXT PRIMARY KEY,note TEXT); CREATE TABLE admin_staff_accounts(id TEXT PRIMARY KEY,role TEXT,password_hash TEXT); INSERT INTO admin_staff_accounts VALUES ('legacy','operations','retained');");
  const migration=readFileSync(new URL('../migrations/051_business_scope.sql',import.meta.url),'utf8');
  function migrate(){if(!db.prepare("SELECT version FROM _migrations WHERE version='051_business_scope'").get())db.exec(migration);}
  migrate();migrate();
  assert.deepEqual({...db.prepare("SELECT * FROM admin_staff_accounts WHERE id='legacy'").get()},{id:'legacy',role:'operations',password_hash:'retained',business_profile_required:0});
});

test('assignment and organization changes invalidate export pages and concurrent assignment batches',async(t)=>{
  const env=fixture(t); seed(env);
  const page=await api(env,'/api/admin/business/records?kind=customer&limit=1',{id:'director-a'});
  env.DB.__sqlite.prepare("UPDATE business_record_assignments SET owner_staff_id='specialist-b',territory_id='b',revision=revision+1 WHERE kind='customer' AND record_id='specialist-a'").run();
  assert.equal((await api(env,`/api/admin/business/records?kind=customer&limit=1&scope_version=${page.data.scope_version}`,{id:'director-a'})).status,409);
  const original=env.DB.batch.bind(env.DB);
  env.DB.batch=async statements=>{env.DB.__sqlite.prepare("UPDATE business_record_assignments SET owner_staff_id='specialist-b',territory_id='b',revision=revision+1 WHERE kind='customer' AND record_id='manager-a'").run();return original(statements);};
  const r=await api(env,'/api/admin/business/records/customer/manager-a/assignment',{id:'manager-a',method:'PUT',body:{revision:0,owner_staff_id:'manager-a',territory_id:'a'}});
  assert.equal(r.status,409);
  assert.equal(env.DB.__sqlite.prepare("SELECT owner_staff_id FROM business_record_assignments WHERE kind='customer' AND record_id='manager-a'").get().owner_staff_id,'specialist-b');
  assert.equal(env.DB.__sqlite.prepare('SELECT count(*) n FROM audit_logs').get().n,0);
});

test('large teams fit bounded SQL parameters',async(t)=>{
  const env=fixture(t); seed(env);
  for(let i=0;i<120;i++)staff(env.DB.__sqlite,`large-${i}`,'business_specialist','manager-a');
  const prepare=env.DB.prepare.bind(env.DB);
  env.DB.prepare=sql=>{
    const s=prepare(sql), bind=s.bind.bind(s);
    s.bind=(...args)=>{assert.ok(args.length<=100,'Too many D1 SQL parameters');return bind(...args);}; return s;
  };
  assert.equal((await api(env,'/api/admin/business/records?kind=customer',{id:'manager-a'})).status,200);
});

test('scope changes while resolving an admin actor fail closed',async(t)=>{
  const env=fixture(t); seed(env);
  env.DB.__sqlite.prepare("INSERT INTO admin_staff_accounts(id,normalized_login,password_hash,salt,role,display_name,market_scope,must_change_password) VALUES ('staff-admin','admin@example.invalid','hash','salt','admin','Admin Fixture','com',0)").run();
  const prepare=env.DB.prepare.bind(env.DB);let reads=0;
  env.DB.prepare=sql=>{
    const s=prepare(sql),first=s.first.bind(s);
    s.first=async()=>{const r=await first();if(sql==='SELECT * FROM admin_staff_accounts WHERE id = ?'&&++reads===3)env.DB.__sqlite.prepare("UPDATE admin_staff_accounts SET is_active=0 WHERE id='staff-admin'").run();return r;};return s;
  };
  assert.equal((await api(env,'/api/admin/business/records?kind=customer',{id:'staff-admin'})).status,409);
});

test('assignment response hides the customer if actor access changes before its post-write detail query',async(t)=>{
  const env=fixture(t); seed(env);
  const prepare=env.DB.prepare.bind(env.DB);let detailReads=0;
  env.DB.prepare=sql=>{
    const s=prepare(sql),first=s.first.bind(s);
    s.first=async()=>{
      if(sql.startsWith('SELECT r.id,r.user_no')&&++detailReads===2)env.DB.__sqlite.prepare("UPDATE admin_staff_accounts SET is_active=0 WHERE id='manager-a'").run();
      return first();
    };return s;
  };
  const r=await api(env,'/api/admin/business/records/customer/specialist-a/assignment',{id:'manager-a',method:'PUT',body:{revision:0,owner_staff_id:'manager-a',territory_id:'a'}});
  assert.equal(detailReads,2);
  assert.equal(r.status,409);
  assert.equal(r.data.code,'business_scope_changed');
  assert.equal(r.data.record,undefined);
  assert.equal(env.DB.__sqlite.prepare("SELECT revision FROM business_record_assignments WHERE kind='customer' AND record_id='specialist-a'").get().revision,1);
  assert.equal(env.DB.__sqlite.prepare("SELECT count(*) n FROM audit_logs WHERE action='business_assignment_changed'").get().n,1);
});

test('profile audit preserves previous direct territory grants when the director grants are revoked',async(t)=>{
  const env=fixture(t); seed(env);
  const r=await api(env,'/api/admin/business/staff/director-a',{method:'PUT',body:{revision:0,role:'business_director',grade:2,territory_ids:[]}});
  assert.equal(r.status,200);
  const audit=env.DB.__sqlite.prepare("SELECT before_state,after_state FROM audit_logs WHERE action='business_profile_updated' AND target_id='director-a'").get();
  assert.deepEqual(JSON.parse(audit.before_state).territory_ids,['a']);
  assert.equal(JSON.parse(audit.before_state).grade,1);
  assert.deepEqual(JSON.parse(audit.after_state).territory_ids,[]);
  assert.equal(env.DB.__sqlite.prepare("SELECT count(*) n FROM business_director_territories WHERE staff_id='director-a'").get().n,0);
});

test('business staff creation rejects stale organization previews after parent territory grants change',async(t)=>{
  const env=fixture(t);seed(env);
  const preview=await api(env,'/api/admin/business/organization');
  env.DB.__sqlite.prepare("DELETE FROM business_director_territories WHERE staff_id='director-a'").run();
  const counts=()=>['admin_staff_accounts','business_staff_profiles','audit_logs'].map(table=>env.DB.__sqlite.prepare(`SELECT count(*) n FROM ${table}`).get().n);
  const before=counts();
  const r=await api(env,'/api/admin/staff',{method:'POST',body:{scope_version:preview.data.scope_version,login:'stale-preview@example.invalid',display_name:'Stale Preview Fixture',role:'business_manager',grade:1,supervisor_staff_id:'director-a',market_scope:'com'}});
  assert.equal(r.status,409);
  assert.equal(r.data.code,'business_scope_changed');
  assert.deepEqual(counts(),before);
});

test('business staff creation requires a valid scope version while legacy staff creation stays compatible',async(t)=>{
  const env=fixture(t);seed(env);
  for(const scope_version of [undefined,null,'',1,'not-a-scope-version']) {
    const r=await api(env,'/api/admin/staff',{method:'POST',body:{scope_version,login:'missing-version@example.invalid',display_name:'Missing Version Fixture',role:'business_director',grade:1,market_scope:'com'}});
    assert.equal(r.status,400);
    assert.equal(env.DB.__sqlite.prepare("SELECT count(*) n FROM admin_staff_accounts WHERE normalized_login='missing-version@example.invalid'").get().n,0);
  }
  const legacy=await api(env,'/api/admin/staff',{method:'POST',body:{login:'legacy-version@example.invalid',display_name:'Legacy Fixture',role:'operations',market_scope:'com'}});
  assert.equal(legacy.status,201);
});

test('business staff creation maps an organization race before its transaction to a clean conflict',async(t)=>{
  const env=fixture(t);seed(env);
  const preview=await api(env,'/api/admin/business/organization');
  const batch=env.DB.batch.bind(env.DB);
  env.DB.batch=async statements=>{env.DB.__sqlite.prepare("DELETE FROM business_director_territories WHERE staff_id='director-a'").run();return batch(statements);};
  const r=await api(env,'/api/admin/staff',{method:'POST',body:{scope_version:preview.data.scope_version,login:'race-preview@example.invalid',display_name:'Racing Preview Fixture',role:'business_manager',grade:1,supervisor_staff_id:'director-a',market_scope:'com'}});
  assert.equal(r.status,409);
  assert.equal(r.data.code,'business_scope_changed');
  assert.equal(env.DB.__sqlite.prepare("SELECT count(*) n FROM admin_staff_accounts WHERE normalized_login='race-preview@example.invalid'").get().n,0);
  assert.equal(env.DB.__sqlite.prepare('SELECT count(*) n FROM business_staff_profiles').get().n,6);
  assert.equal(env.DB.__sqlite.prepare('SELECT count(*) n FROM audit_logs').get().n,0);
});
