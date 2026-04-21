-- Add devices for customers (张伟 already has 3 devices, skip)

-- 李强 (东莞宏利五金) - 不锈钢加工
INSERT INTO devices (id, customer_id, type, brand, model, power, name, status) VALUES
  ('dev101', 'mnyj0a25lpfunm4l76', '光纤激光切割机', '百超', 'ByStar Fiber 3015', '4000W', '1号激光切割机', 'normal'),
  ('dev102', 'mnyj0a25lpfunm4l76', '折弯机', 'Amada', 'HG-1303', '130T', '折弯机A', 'normal'),
  ('dev103', 'mnyj0a25lpfunm4l76', 'TIG焊机', '福尼斯', 'MagicWave 230i', '', 'TIG焊机', 'normal');

-- 王磊 (天津北方重工) - 重型钢结构
INSERT INTO devices (id, customer_id, type, brand, model, power, name, status) VALUES
  ('dev201', 'mnyj0a36ttkagvurig', '等离子切割机', '海宝', 'HPR400XD', '400A', '等离子1号', 'normal'),
  ('dev202', 'mnyj0a36ttkagvurig', '卷板机', '南通锻压', 'W11S-50x3000', '', '大型卷板机', 'normal'),
  ('dev203', 'mnyj0a36ttkagvurig', 'MIG焊机', '林肯', 'Power Wave S500', '', '焊机组A', 'normal'),
  ('dev204', 'mnyj0a36ttkagvurig', '剪板机', '通快', 'TruBend 5130', '', '液压剪板机', 'maintenance');

-- 赵明 (上海申泰激光) - 激光加工
INSERT INTO devices (id, customer_id, type, brand, model, power, name, status) VALUES
  ('dev301', 'mnyj0a4bpent310jbh', '光纤激光切割机', '大族', 'G3015HF', '6000W', '主力切割机', 'normal'),
  ('dev302', 'mnyj0a4bpent310jbh', '光纤激光切割机', '通快', 'TruLaser 3030', '3000W', '2号切割机', 'normal'),
  ('dev303', 'mnyj0a4bpent310jbh', '折弯机', '百超', 'Xpert 150', '150T', '折弯机', 'normal'),
  ('dev304', 'mnyj0a4bpent310jbh', '激光焊接机', '大族', 'HW-1500', '1500W', '激光焊接机', 'normal');

-- 陈刚 (武汉中联钣金) - 全工艺链
INSERT INTO devices (id, customer_id, type, brand, model, power, name, status) VALUES
  ('dev401', 'mnyj0a5whjieo420xy', '光纤激光切割机', '迅镭', 'XL-3015', '3000W', '车间激光机', 'normal'),
  ('dev402', 'mnyj0a5whjieo420xy', '数控冲床', '金方圆', 'VT-300', '', '转塔冲', 'normal'),
  ('dev403', 'mnyj0a5whjieo420xy', '折弯机', '亚威', 'PBH-110/3100', '110T', '折弯机', 'fault'),
  ('dev404', 'mnyj0a5whjieo420xy', 'MIG焊机', '麦格米特', 'PM500A', '', '焊机', 'normal');

-- 刘洋 (重庆渝川) - 小型加工
INSERT INTO devices (id, customer_id, type, brand, model, power, name, status) VALUES
  ('dev501', 'mnyj0a6x3zzizxbqup', '光纤激光切割机', '宏山', 'HS-G3015C', '1500W', '激光机', 'normal'),
  ('dev502', 'mnyj0a6x3zzizxbqup', '折弯机', '亚威', 'PBH-63/2500', '63T', '小折弯机', 'normal');

-- 周涛 (深圳正泰电子) - 电子设备壳
INSERT INTO devices (id, customer_id, type, brand, model, power, name, status) VALUES
  ('dev601', 'mnyj0a7w3tkoe6746z', '光纤激光切割机', '大族', 'G4020HF', '4000W', '大幅面激光', 'normal'),
  ('dev602', 'mnyj0a7w3tkoe6746z', '数控冲床', 'Amada', 'EM-2510NT', '', '数控转塔冲', 'normal'),
  ('dev603', 'mnyj0a7w3tkoe6746z', '折弯机', '通快', 'TruBend 5085', '85T', '精密折弯', 'normal');

-- 吴鹏 (河北冀中钢构) - 钢结构
INSERT INTO devices (id, customer_id, type, brand, model, power, name, status) VALUES
  ('dev701', 'mnyj0a8x1xsilmntq9r', '剪板机', '扬力', 'QC12Y-6x3200', '', '液压剪板机', 'normal'),
  ('dev702', 'mnyj0a8x1xsilmntq9r', 'MIG焊机', '伊萨', 'Warrior 500i', '', '焊机组', 'normal'),
  ('dev703', 'mnyj0a8x1xsilmntq9r', '等离子切割机', '飞马特', 'HPR260XD', '260A', '等离子', 'normal');

-- 孙斌 (沈阳辽发) - 工程机械
INSERT INTO devices (id, customer_id, type, brand, model, power, name, status) VALUES
  ('dev801', 'mnyj0aa1w3ry0a6gm9', '光纤激光切割机', '奔腾', 'BOLT-III', '6000W', '激光切割机', 'normal'),
  ('dev802', 'mnyj0aa1w3ry0a6gm9', '焊接机器人', 'KUKA', 'KR 16 + 福尼斯TPS 500i', '', '焊接机器人工位', 'normal'),
  ('dev803', 'mnyj0aa1w3ry0a6gm9', '折弯机', '通快', 'TruBend 5170', '170T', '大型折弯机', 'normal');
