-- 020: 消息表新增 image_urls 列（JSON 数组），支持聊天图片上传
-- 部署前需手动执行：wrangler d1 execute sagemro-db --env production --remote --file migrations/020_add_message_images.sql

ALTER TABLE messages ADD COLUMN image_urls TEXT;
