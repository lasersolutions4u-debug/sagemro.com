-- 056_business_flat_start.sql
-- 扁平起步：商务账号可以从任意级别开始，而不是必须「总监 → 经理 → 专员」三层齐备。
--
-- 背景：实际业务里销售团队常常一开始只有专员，之后再设经理、总监。
-- 原表约束写死了「只有总监可以没有上级」：
--   CHECK((role = 'business_director' AND supervisor_staff_id IS NULL)
--      OR (role <> 'business_director' AND supervisor_staff_id IS NOT NULL))
-- 导致顶层专员建不出来；账号会落到 invalid_staff，所有接口 403。
--
-- SQLite 无法直接修改 CHECK，只能重建表。重建期间必须关闭外键校验：
-- business_director_territories.staff_id 引用本表，而 DROP TABLE 会做一次隐式 DELETE，
-- 这一步的约束违反**不会**被 PRAGMA defer_foreign_keys 延迟（实测：defer 在 DROP 上无效）。
-- 只有 PRAGMA foreign_keys = OFF 可行，且它不能在事务内切换，所以本文件不使用 BEGIN/COMMIT。
--
-- 已在真实 D1 上实测通过：
--   * 既有数据与外键关系原样保留
--   * 触发器重建后仍在递增 business_scope_version
--   * 顶层专员可插入；总监带上级仍被拒；指向不存在上级仍被外键拒
--
-- 新的约束语义：
--   * 没有上级（顶层）→ 任意级别都允许
--   * 有上级 → 只能是经理或专员（总监不能有上级）

PRAGMA foreign_keys = OFF;

CREATE TABLE business_staff_profiles_flat_start (
  staff_id TEXT PRIMARY KEY REFERENCES admin_staff_accounts(id),
  role TEXT NOT NULL CHECK(role IN ('business_director','business_manager','business_specialist')),
  grade INTEGER NOT NULL CHECK(grade IN (1,2,3)),
  supervisor_staff_id TEXT REFERENCES admin_staff_accounts(id),
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(staff_id <> supervisor_staff_id),
  CHECK(supervisor_staff_id IS NULL OR role IN ('business_manager','business_specialist'))
);

INSERT INTO business_staff_profiles_flat_start (staff_id, role, grade, supervisor_staff_id, revision, updated_at)
  SELECT staff_id, role, grade, supervisor_staff_id, revision, updated_at FROM business_staff_profiles;

DROP TABLE business_staff_profiles;

ALTER TABLE business_staff_profiles_flat_start RENAME TO business_staff_profiles;

-- 触发器随旧表一起被删除，必须重建（scope_version 依赖它们做并发失效）
CREATE TRIGGER IF NOT EXISTS business_staff_profiles_scope_insert AFTER INSERT ON business_staff_profiles BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS business_staff_profiles_scope_update AFTER UPDATE ON business_staff_profiles BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS business_staff_profiles_scope_delete AFTER DELETE ON business_staff_profiles BEGIN UPDATE business_scope_version SET revision = revision + 1 WHERE id = 1; END;

PRAGMA foreign_keys = ON;
