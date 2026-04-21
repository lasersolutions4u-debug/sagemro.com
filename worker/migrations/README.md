# D1 Migrations

## 🔑 真相源政策（Source of Truth）

- **`migrations/`** 是 schema 的唯一真相源。任何建表/改表**必须**先写一个新的 `NNN_*.sql`。
- **`schema.sql`** 是 migrations 的全量累积快照，只用于两种场景：
  1. 给全新 D1 一键建表（等价于顺序跑完所有 migrations）
  2. code review 时看当前整体结构的参考文档
- schema.sql 的内容**每次新增 migration 都要同步更新**，不允许两边长期漂移。
- 迁移执行情况记录在 `_migrations` 表（011 创建），避免重复跑同一 migration。

## 执行顺序（按文件名字典序）

| 文件 | 作用 |
|------|------|
| `000_initial.sql` | 初始建表（conversations / messages / customers / engineers / devices / work_orders / work_order_logs / ratings） |
| `001_add_engineer_fields.sql` | V2 合伙人字段：level / commission_rate / credit_score / wallet / deposit / bank 等 |
| `001a_add_user_no.sql` | 遗留库补丁：为已存在的 customers / engineers 表补 user_no、salt 字段（字典序在 001 之后，002 之前） |
| `002_pricing_and_new_tables.sql` | 重建 work_order_pricing / work_order_pricing_history，新增钱包/保证金/晋升/违约/提现表 |
| `003_add_onesignal.sql` | engineers.onesignal_player_id + push_subscriptions 表 |
| `004_add_device_fields.sql` | devices 补 name / status / photo_url / notes |
| `005_add_company_and_auth.sql` | customers & engineers 补公司资料 + auth_status |
| `006_create_notifications.sql` | notifications 表 |
| `007_create_engineer_reviews.sql` | 工程师对客户评价（engineer_reviews） |
| `008_sync_missing_tables.sql` | 幂等补齐早期 migrations 未包含但代码已使用的表：admin_replies / platform_ratings / customer_ratings / work_order_messages / work_order_pricing / work_order_pricing_history |
| `009_add_customer_onesignal.sql` | customers 补 onesignal_player_id，使客户也能接收推送通知（此前仅工程师端支持） |
| `010_add_conversation_owner.sql` | conversations 补 customer_id + 索引，IDOR 修复依赖此列 |
| `011_create_migrations_tracking.sql` | 新增 `_migrations` 跟踪表并回填历史版本记录 |

> 约定：文件名格式 `NNN_*.sql`，按字典序顺序执行；历史命名中出现过 `001_partner_upgrade.sql`（已删除，是 `001_add_engineer_fields.sql + 002_pricing_and_new_tables.sql` 的合并版本，避免重复执行）。

## 新增一个迁移

1. 文件名取下一个序号：`012_your_change.sql`
2. 写 `ALTER TABLE ... / CREATE TABLE IF NOT EXISTS ...`（幂等优先）
3. 文件尾部追加：
   ```sql
   INSERT OR IGNORE INTO _migrations (version, note) VALUES
     ('012_your_change', '一句话说明');
   ```
4. 同步把 schema 变更追加到根目录 `../schema.sql`（同一次 PR 内完成）
5. 在本 README 追加一行到表格

## 新库初始化推荐流程

```bash
# 方案 A：从 schema.sql 一次性建表（推荐给全新的 D1 实例）
wrangler d1 execute sagemro-db --file ../schema.sql

# 方案 B：严格按 migrations 顺序（用于线上数据库渐进升级）
for f in migrations/*.sql; do
  wrangler d1 execute sagemro-db --file "$f"
done
```

## data_fixes/

`data_fixes/` 目录下是**数据迁移**脚本（不是 schema 迁移），如批量给老数据补字段。与常规建表/改表区分，避免混淆。手工执行，不自动运行。

| 文件 | 作用 |
|------|------|
| `temp_enrich_users.sql` | 早期 user_no / salt 回填脚本（已执行过，保留备查） |
| `temp_enrich_devices.sql` | 早期 device name / status 回填脚本（已执行过，保留备查） |
| `cleanup_test_accounts.sql` | 上线前清理测试账号（手机号 13800000xx / 13900000xx / 13700000xx 或姓名含"测试"/"test"）及其工单、设备、钱包流水等关联数据。**生产环境执行前必须手工核对清单。** |
