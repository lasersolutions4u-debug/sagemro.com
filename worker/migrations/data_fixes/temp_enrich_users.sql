-- Enrich customers with company data

UPDATE customers SET
  company = '苏州鑫达精密钣金有限公司',
  address = '苏州市吴中区胥口镇工业园88号',
  city = '苏州',
  company_description = '专业从事精密钣金加工、激光切割、折弯焊接，主要服务汽车零部件和电子设备外壳行业',
  business_scope = '精密钣金加工、激光切割、折弯焊接、表面处理',
  auth_status = 'authenticated'
WHERE id = 'mnyj09v0pa0kfz0lenf';

UPDATE customers SET
  company = '东莞宏利五金制品有限公司',
  address = '东莞市长安镇乌沙社区振安东路168号',
  city = '东莞',
  company_description = '金属制品加工制造企业，主营不锈钢制品、铝合金加工件',
  business_scope = '五金制品、不锈钢加工、铝合金加工',
  auth_status = 'authenticated'
WHERE id = 'mnyj0a25lpfunm4l76';

UPDATE customers SET
  company = '天津北方重工装备制造有限公司',
  address = '天津市滨海新区开发区第三大街58号',
  city = '天津',
  company_description = '大型装备制造企业，承接桥梁钢结构、压力容器、工程机械结构件加工',
  business_scope = '重型钢结构、压力容器、工程机械结构件',
  auth_status = 'authenticated'
WHERE id = 'mnyj0a36ttkagvurig';

UPDATE customers SET
  company = '上海申泰激光科技有限公司',
  address = '上海市松江区九亭镇沪松公路1399号',
  city = '上海',
  company_description = '激光加工服务商，拥有多台大功率光纤激光切割机和折弯机',
  business_scope = '激光切割加工、钣金折弯、焊接加工',
  auth_status = 'authenticated'
WHERE id = 'mnyj0a4bpent310jbh';

UPDATE customers SET
  company = '武汉中联钣金工程有限公司',
  address = '武汉市东西湖区金银潭企业城12栋',
  city = '武汉',
  company_description = '综合性钣金加工企业，配备激光切割、数控冲床、折弯机等全工艺链设备',
  business_scope = '钣金加工、机箱机柜、电气柜体、通信设备外壳',
  auth_status = 'authenticated'
WHERE id = 'mnyj0a5whjieo420xy';

UPDATE customers SET
  company = '重庆渝川机械加工厂',
  address = '重庆市九龙坡区西彭工业园区B区7号',
  city = '重庆',
  company_description = '个体经营，从事中小型钣金件加工，主要做厨房设备和通风管道',
  business_scope = '钣金加工、通风管道、厨房设备外壳',
  auth_status = 'authenticated'
WHERE id = 'mnyj0a6x3zzizxbqup';

UPDATE customers SET
  company = '深圳市正泰电子设备有限公司',
  address = '深圳市宝安区福永街道凤凰社区工业三路8号',
  city = '深圳',
  company_description = '电子设备结构件制造商，主要为通信基站和服务器机柜提供钣金件',
  business_scope = '电子设备结构件、通信机柜、服务器机柜、散热器件',
  auth_status = 'authenticated'
WHERE id = 'mnyj0a7w3tkoe6746z';

UPDATE customers SET
  company = '河北冀中钢构有限公司',
  address = '沧州市青县经济开发区纬三路12号',
  city = '沧州',
  company_description = '钢结构加工制造企业，主营厂房钢结构、彩钢板、C型钢檩条',
  business_scope = '钢结构加工、彩钢板、檩条、H型钢',
  auth_status = 'authenticated'
WHERE id = 'mnyj0a8x1xsilmntq9r';

UPDATE customers SET
  company = '沈阳辽发机械制造有限公司',
  address = '沈阳市铁西区开发大路15号',
  city = '沈阳',
  company_description = '工程机械配套件制造企业，为三一、徐工等品牌提供结构件',
  business_scope = '工程机械结构件、挖掘机斗齿、装载机铲斗',
  auth_status = 'authenticated'
WHERE id = 'mnyj0aa1w3ry0a6gm9';

UPDATE customers SET
  company = '济南鲁信金属加工有限公司',
  address = '济南市历城区王舍人街道工业南路66号',
  city = '济南',
  company_description = '钣金加工服务商，提供激光切割、折弯、焊接一站式服务',
  business_scope = '激光切割、折弯焊接、表面处理',
  auth_status = 'authenticated'
WHERE id = 'mnzhsfsymc8rfuat1pr';

UPDATE customers SET
  company = '昆山智远精密制造有限公司',
  address = '昆山市张浦镇德国工业园12号',
  city = '昆山',
  company_description = '外资配套钣金件供应商，主要服务博世、西门子等德资企业',
  business_scope = '精密钣金件、机电设备外壳、控制柜体',
  auth_status = 'authenticated'
WHERE id = 'mnzitc9np7hdmh1t1i';

-- Enrich engineers with company data

UPDATE engineers SET
  company = '济南鼎信机电设备维修服务部',
  address = '济南市槐荫区经十西路润华汽车园内',
  city = '济南',
  company_description = '个体工商户，专注激光切割设备和冲床维修，服务山东全省',
  business_scope = '激光设备维修、冲床维修保养',
  auth_status = 'authenticated',
  bio = '10年激光切割机和冲床维修经验，擅长通快和Amada品牌设备故障排查，持有特种设备维修资质证书'
WHERE id = 'mnyg6jz8hjk47ofr3cn';

UPDATE engineers SET
  company = '苏州恒辉机电工程有限公司',
  address = '苏州市工业园区唯亭镇创苑路20号',
  city = '苏州',
  company_description = '专业激光设备维修保养公司，签约大族、通快等品牌售后服务',
  business_scope = '激光设备维修、切割头维护、年度维保合同',
  auth_status = 'authenticated',
  bio = '15年激光设备维修经验，曾任大族激光华东区售后主管，熟悉大族全系列设备和通快TruLaser系列'
WHERE id = 'mnyj0ab5bzrrfkvrppo';

UPDATE engineers SET
  company = '广州焊之星机电维修部',
  address = '广州市番禺区石碁镇金山工业园C栋',
  city = '广州',
  company_description = '焊接设备专业维修，服务珠三角地区各类焊接机器人和手动焊机',
  business_scope = '焊接设备维修、机器人焊接系统调试',
  auth_status = 'authenticated',
  bio = '焊接工程师出身，12年焊接设备维修调试经验，精通福尼斯、林肯全系列MIG/TIG焊机和大族激光焊接设备'
WHERE id = 'mnyj0acb5ni7f3vbsls';

UPDATE engineers SET
  company = '北京金锐机械设备维修有限公司',
  address = '北京市大兴区西红门镇宏业路9号',
  city = '北京',
  company_description = '数控机床和冲压设备维修企业，覆盖京津冀地区',
  business_scope = '冲床维修、剪板机保养、数控系统维修',
  auth_status = 'authenticated',
  bio = '专注冲压设备8年，通快转塔冲和村田冲床深度维修经验，熟悉Fanuc和Siemens数控系统'
WHERE id = 'mnyj0adqq6p6nibt3at';

UPDATE engineers SET
  company = '武汉楚天液压设备服务中心',
  address = '武汉市汉阳区四新南路98号',
  city = '武汉',
  company_description = '专业液压系统维修，折弯机和卷板机液压故障诊断与修复',
  business_scope = '液压系统维修、折弯机调试、卷板机保养',
  auth_status = 'authenticated',
  bio = '液压工程师背景，9年折弯机和卷板机维修经验，擅长亚威、普玛宝折弯机液压系统故障诊断'
WHERE id = 'mnyj0aer8r36pa05x0v';

UPDATE engineers SET
  company = '成都川维机电设备有限公司',
  address = '成都市龙泉驿区大面街道车城东六路88号',
  city = '成都',
  company_description = '西南地区等离子和水刀切割设备维修服务商',
  business_scope = '等离子切割维修、水刀设备保养、切割参数调优',
  auth_status = 'authenticated',
  bio = '专业切割设备维修7年，熟悉飞博等离子全系列和华臻水刀设备，覆盖四川、重庆、贵州地区'
WHERE id = 'mnyj0afw6fizyoisk9n';

UPDATE engineers SET
  company = '周工机电维修工作室',
  address = '上海市嘉定区安亭镇墨玉路28号',
  city = '上海',
  company_description = '个人工作室，全国出差，激光和焊接设备综合维修',
  business_scope = '激光设备维修、焊接设备调试、紧急抢修',
  auth_status = 'authenticated',
  bio = '前邦德激光售后工程师，6年全国巡回维修经验，擅长邦德、宏山激光切割机和米勒、松下焊机'
WHERE id = 'mnyj0ah5jvu421sviaj';

UPDATE engineers SET
  company = '苏州光维激光技术服务有限公司',
  address = '苏州市相城区元和街道广济北路88号',
  city = '苏州',
  company_description = '华东最大的第三方激光设备维修服务商，年服务客户200+',
  business_scope = '激光器维修、光路调整、切割头维护、年度维保',
  auth_status = 'authenticated',
  level = 'senior',
  commission_rate = 0.85,
  bio = '专注激光设备15年，团队8人，签约大族、通快、百超华东区第三方维保。年处理工单500+，客户覆盖江浙沪200余家企业'
WHERE id = 'mnzitbp9d678fjuqzq';

UPDATE engineers SET
  company = '苏州博力成形设备技术有限公司',
  address = '苏州市吴江区汾湖高新区康力大道128号',
  city = '苏州',
  company_description = '折弯机和剪板机专业维修公司，通快百超Amada三大品牌授权维修站',
  business_scope = '折弯机维修、剪板机保养、液压系统维护、模具维护',
  auth_status = 'authenticated',
  level = 'senior',
  commission_rate = 0.85,
  bio = '擅长钣金成形设备维修，10年经验，通快、百超、Amada官方授权维修工程师，精通液压同步系统和CNC控制器维修'
WHERE id = 'mnzitbp9dj66bhjwpcq';

UPDATE engineers SET
  company = '佛山南海焊接技术服务中心',
  address = '佛山市南海区狮山镇科技工业园A区',
  city = '佛山',
  company_description = '华南地区焊接设备维修服务中心，服务珠三角300+制造企业',
  business_scope = '焊接设备维修、焊接机器人调试、焊接工艺优化',
  auth_status = 'authenticated',
  bio = '焊接专家，精通各类焊接设备调试与维修。擅长通快、IPG激光焊接和福尼斯、林肯MIG焊机。曾任福尼斯华南技术总监'
WHERE id = 'mnzitbp90cwi1vpnbip8';

-- Fix engineer statuses: make key engineers available
UPDATE engineers SET status = 'available' WHERE id IN ('mnyj0acb5ni7f3vbsls', 'mnyj0aer8r36pa05x0v');
