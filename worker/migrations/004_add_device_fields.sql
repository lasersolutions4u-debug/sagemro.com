-- 004_add_device_fields.sql
-- 设备表新增字段（name / status / photo_url / notes）
-- 注意：work_orders.completed_at 已存在，无需重复添加

-- 设备表新增字段
ALTER TABLE devices ADD COLUMN name TEXT;                      -- 设备名称（如"车间1号激光机"）
ALTER TABLE devices ADD COLUMN status TEXT DEFAULT 'normal';   -- 设备状态：normal/running/maintenance
ALTER TABLE devices ADD COLUMN photo_url TEXT;                 -- 设备照片 URL
ALTER TABLE devices ADD COLUMN notes TEXT;                     -- 客户备注（文字）