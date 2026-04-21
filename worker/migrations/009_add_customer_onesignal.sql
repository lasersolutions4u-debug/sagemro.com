-- 009_add_customer_onesignal.sql
-- 为客户表添加 OneSignal Player ID，使客户也能接收推送通知
-- （此前只有工程师表有此字段，工单进度/报价/评价等事件只推送到工程师端）
-- 依赖：004_add_device_fields.sql 之前已运行过 005_add_company_and_auth.sql

ALTER TABLE customers ADD COLUMN onesignal_player_id TEXT;
