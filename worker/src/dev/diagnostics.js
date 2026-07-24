export async function handleDiagnosticRoute(request, env, deps) {
  const {
    checkPricingReasonableness, computeSlaDeadline, errorResponse, findMatchingEngineers,
    generateId, generateUserNo, generateWorkOrderSummary, getRequestMarket,
    hashPasswordLegacy, jsonResponse, sendPushToEngineer,
  } = deps;
  const path = new URL(request.url).pathname;

  // ============ 临时建表接口（仅供开发测试使用）============
  async function handleInitDb(env) {
    try {
      const tables = [
        `CREATE TABLE IF NOT EXISTS work_order_pricing (
          id TEXT PRIMARY KEY,
          work_order_id TEXT NOT NULL UNIQUE,
          labor_fee INTEGER DEFAULT 0,
          parts_fee INTEGER DEFAULT 0,
          travel_fee INTEGER DEFAULT 0,
          other_fee INTEGER DEFAULT 0,
          parts_detail TEXT DEFAULT '',
          commission_rate REAL DEFAULT 0.05,
          commission_amount INTEGER DEFAULT 0,
          subtotal INTEGER DEFAULT 0,
          total_amount INTEGER DEFAULT 0,
          ai_price_check TEXT DEFAULT '',
          status TEXT DEFAULT 'draft',
          submitted_at TEXT,
          confirmed_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
        )`,
        `CREATE TABLE IF NOT EXISTS work_order_messages (
          id TEXT PRIMARY KEY,
          work_order_id TEXT NOT NULL,
          sender_type TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          sender_name TEXT DEFAULT '',
          content TEXT NOT NULL,
          message_type TEXT DEFAULT 'text',
          attachment_urls TEXT DEFAULT '[]',
          is_internal_note INTEGER DEFAULT 0,
          is_customer_visible INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
        )`,
        `CREATE TABLE IF NOT EXISTS work_order_pricing_history (
          id TEXT PRIMARY KEY,
          pricing_id TEXT NOT NULL,
          labor_fee INTEGER DEFAULT 0,
          parts_fee INTEGER DEFAULT 0,
          travel_fee INTEGER DEFAULT 0,
          other_fee INTEGER DEFAULT 0,
          parts_detail TEXT DEFAULT '',
          subtotal INTEGER DEFAULT 0,
          total_amount INTEGER DEFAULT 0,
          commission_amount INTEGER DEFAULT 0,
          version INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (pricing_id) REFERENCES work_order_pricing(id)
        )`,
      ];

      for (const sql of tables) {
        await env.DB.prepare(sql).run();
      }

      // 添加工单新状态列（SQLite 不支持 DROP COLUMN，如果列已存在会报错，忽略）
      try {
        await env.DB.prepare("ALTER TABLE work_orders ADD COLUMN pricing_status TEXT DEFAULT 'none'").run();
      } catch (e) {
        // 列可能已存在，忽略
      }

      return jsonResponse({ success: true, message: 'Tables created successfully' });
    } catch (error) {
      return errorResponse(error.message, 500);
    }
  }

  // ============ 临时测试数据初始化（仅供测试使用）============
  async function handleInitTestData(env) {
    try {
      const created = { customers: [], engineers: [], workOrders: [], ratings: [] };

      // 创建客户
      const customerData = [
        { name: '张伟', phone: '13900001001', region: '华东', password: 'test1234' },
        { name: '李强', phone: '13900001002', region: '华南', password: 'test1234' },
        { name: '王磊', phone: '13900001003', region: '华北', password: 'test1234' },
        { name: '赵明', phone: '13900001004', region: '华东', password: 'test1234' },
        { name: '陈刚', phone: '13900001005', region: '华中', password: 'test1234' },
        { name: '刘洋', phone: '13900001006', region: '西南', password: 'test1234' },
        { name: '周涛', phone: '13900001007', region: '华南', password: 'test1234' },
        { name: '吴鹏', phone: '13900001008', region: '华北', password: 'test1234' },
        { name: '孙斌', phone: '13900001009', region: '东北', password: 'test1234' },
      ];

      for (const c of customerData) {
        const existing = await env.DB.prepare('SELECT id FROM customers WHERE phone = ?').bind(c.phone).first();
        if (existing) { created.customers.push({ ...c, note: '已存在' }); continue; }
        const id = generateId();
        const userNo = await generateUserNo(env, 'U');
        const hash = await hashPasswordLegacy(c.password);
        await env.DB.prepare(
          'INSERT INTO customers (id, user_no, name, phone, password_hash, region) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, userNo, c.name, c.phone, hash, c.region).run();
        created.customers.push({ id, user_no: userNo, name: c.name, phone: c.phone, region: c.region });
      }

      // 创建工程师
      const engineerData = [
        { name: '李师傅', phone: '13900011001', status: 'available', specialties: '["激光切割机","折弯机"]', brands: '{"激光切割机":["大族","通快"],"折弯机":["通快","百超"]}', services: '["激光器维修","切割头维护","参数调试"]', service_region: '华东', bio: '15年激光设备维修经验', password: 'test1234' },
        { name: '张工', phone: '13900011002', status: 'paused', specialties: '["焊接机","激光焊接"]', brands: '{"焊接机":["福尼斯","林肯"],"激光焊接":["大族","华工"]}', services: '["电气排查","液压维修"]', service_region: '华南', bio: '专注焊接设备维修', password: 'test1234' },
        { name: '王技师', phone: '13900011003', status: 'available', specialties: '["冲床","剪板机"]', brands: '{"冲床":["通快","村田"],"剪板机":["黄石","扬力"]}', services: '["设备保养","参数调试"]', service_region: '华北', bio: '', password: 'test1234' },
        { name: '赵师傅', phone: '13900011004', status: 'offline', specialties: '["折弯机","卷板机"]', brands: '{"折弯机":["亚威","普玛宝"],"卷板机":["华工","扬力"]}', services: '["激光器维修","液压维修"]', service_region: '华中', bio: '', password: 'test1234' },
        { name: '刘工', phone: '13900011005', status: 'available', specialties: '["等离子切割","水刀切割"]', brands: '{"等离子切割":["飞博","瑞凌"],"水刀切割":["华臻"]}', services: '["切割头维护","设备保养"]', service_region: '西南', bio: '专业切割设备维修', password: 'test1234' },
        { name: '周工', phone: '13900011006', status: 'available', specialties: '["激光切割机","焊接机"]', brands: '{"激光切割机":["邦德","宏山"],"焊接机":["米勒","松下"]}', services: '["激光器维修","参数调试","电气排查"]', service_region: '全国', bio: '', password: 'test1234' },
      ];

      for (const e of engineerData) {
        const existing = await env.DB.prepare('SELECT id FROM engineers WHERE phone = ?').bind(e.phone).first();
        if (existing) { created.engineers.push({ ...e, note: '已存在' }); continue; }
        const id = generateId();
        const userNo = await generateUserNo(env, 'E');
        const hash = await hashPasswordLegacy(e.password);
        await env.DB.prepare(
          'INSERT INTO engineers (id, user_no, name, phone, password_hash, status, specialties, brands, services, service_region, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, userNo, e.name, e.phone, hash, e.status, e.specialties, e.brands, e.services, e.service_region, e.bio).run();
        created.engineers.push({ id, user_no: userNo, name: e.name, phone: e.phone, status: e.status, service_region: e.service_region });
      }

      // 创建工单（利用已有的客户和工程师）
      const customers = await env.DB.prepare('SELECT id FROM customers').all();
      const engineers = await env.DB.prepare('SELECT id FROM engineers').all();
      if (customers.results.length > 0 && engineers.results.length > 0) {
        const workOrderData = [
          { type: 'fault', urgency: 'critical', status: 'pending', description: '激光切割机切割时出现异响，突然停止工作' },
          { type: 'maintenance', urgency: 'normal', status: 'in_progress', description: '定期保养，导轨润滑，切割头校准' },
          { type: 'parameter', urgency: 'urgent', status: 'assigned', description: '切割参数异常，断面质量差，需要重新调参' },
          { type: 'other', urgency: 'normal', status: 'resolved', description: '设备搬迁后重新安装调试' },
          { type: 'fault', urgency: 'urgent', status: 'completed', description: '折弯机液压系统漏油，已修复' },
          { type: 'maintenance', urgency: 'normal', status: 'pending', description: '焊机电极磨损严重，需要更换并调试' },
          { type: 'parameter', urgency: 'normal', status: 'in_progress', description: '激光焊接机焦点偏移，需要校准' },
          { type: 'fault', urgency: 'critical', status: 'pending', description: '数控冲床冲头无法抬起，设备停机' },
        ];

        for (let i = 0; i < workOrderData.length; i++) {
          const wo = workOrderData[i];
          const cid = customers.results[i % customers.results.length].id;
          const eid = (wo.status !== 'pending') ? engineers.results[i % engineers.results.length].id : null;
          const id = generateId();
          const orderNo = `WO-TEST-${(i + 1).toString().padStart(3, '0')}`;
          const assignedAt = eid ? `datetime('now', '-${Math.floor(Math.random() * 3)} days')` : null;
          await env.DB.prepare(
            'INSERT INTO work_orders (id, order_no, customer_id, engineer_id, type, description, urgency, status, assigned_at, sla_deadline, category_l1, category_l2) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(id, orderNo, cid, eid, wo.type, wo.description, wo.urgency, wo.status, assignedAt, computeSlaDeadline(wo.urgency), 'other', 'other').run();

          // 部分已完成工单添加日志
          if (wo.status === 'resolved' || wo.status === 'completed') {
            await env.DB.prepare(
              'INSERT INTO work_order_logs (id, work_order_id, action, actor_type, content) VALUES (?, ?, ?, ?, ?)'
            ).bind(generateId(), id, '工单已解决', 'engineer', '问题已修复，客户确认').run();
          }

          created.workOrders.push({ id, order_no: orderNo, status: wo.status, customer_id: cid, engineer_id: eid });
        }

        // 创建评价（针对已完成/已解决的工单）
        const ratedWorkOrders = created.workOrders.filter(w => w.status === 'resolved' || w.status === 'completed');
        const ratingData = [
          { timeliness: 5, technical: 5, communication: 5, professional: 5, comment: '李师傅非常专业，问题很快就解决了，非常满意！', avg: 5.0 },
          { timeliness: 3, technical: 2, communication: 3, professional: 2, comment: '响应速度一般，技术水平有待提高。', avg: 2.5 },
          { timeliness: 4, technical: 4, communication: 5, professional: 4, comment: '沟通很顺畅，工程师很有耐心，给个好评！', avg: 4.25 },
          { timeliness: 1, technical: 1, communication: 1, professional: 2, comment: '等了两天才来，而且修完没过多久又出问题了，非常失望。', avg: 1.25 },
          { timeliness: 4, technical: 3, communication: 4, professional: 4, comment: '整体不错，就是价格稍微贵了点。', avg: 3.75 },
        ];

        for (let i = 0; i < Math.min(ratedWorkOrders.length, ratingData.length); i++) {
          const wo = ratedWorkOrders[i];
          const rd = ratingData[i];
          const existingRating = await env.DB.prepare('SELECT id FROM ratings WHERE work_order_id = ?').bind(wo.id).first();
          if (existingRating) continue;

          // 找一个对应的工程师ID
          const woData = await env.DB.prepare('SELECT engineer_id FROM work_orders WHERE id = ?').bind(wo.id).first();
          if (!woData?.engineer_id) continue;
          const rid = generateId();
          await env.DB.prepare(
            'INSERT INTO ratings (id, work_order_id, engineer_id, customer_id, rating_timeliness, rating_technical, rating_communication, rating_professional, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(rid, wo.id, woData.engineer_id, wo.customer_id, rd.timeliness, rd.technical, rd.communication, rd.professional, rd.comment).run();

          // 更新工程师评分
          const allRatings = await env.DB.prepare('SELECT * FROM ratings WHERE engineer_id = ?').bind(woData.engineer_id).all();
          const count = allRatings.results.length;
          if (count > 0) {
            const avgT = allRatings.results.reduce((s, r) => s + r.rating_timeliness, 0) / count;
            const avgTech = allRatings.results.reduce((s, r) => s + r.rating_technical, 0) / count;
            const avgC = allRatings.results.reduce((s, r) => s + r.rating_communication, 0) / count;
            const avgP = allRatings.results.reduce((s, r) => s + r.rating_professional, 0) / count;
            await env.DB.prepare(
              'UPDATE engineers SET rating_timeliness = ?, rating_technical = ?, rating_communication = ?, rating_professional = ?, rating_count = ? WHERE id = ?'
            ).bind(avgT, avgTech, avgC, avgP, count, woData.engineer_id).run();
          }

          // 添加管理员回复（部分评价）
          if (i === 1 || i === 3) {
            const replyId = generateId();
            const replyContent = i === 1 ? '非常抱歉给您带来不好的体验，我们会跟进工程师的服务质量，感谢您的反馈。'
              : '对不起，这种情况是不应该发生的。我们已将此问题反馈给工程师团队，会尽快安排复检。如有需要请联系客服。';
            await env.DB.prepare('INSERT INTO admin_replies (id, rating_id, content) VALUES (?, ?, ?)').bind(replyId, rid, replyContent).run();
          }

          created.ratings.push({ work_order_id: wo.id, avg: rd.avg, comment: rd.comment });
        }

        // 平台评价
        const platformRatings = [
          { rating: 5, comment: '平台很好用，SAGEMRO AI 很专业，解决了我的很多问题！' },
          { rating: 4, comment: '整体满意，希望能覆盖更多地区。' },
          { rating: 3, comment: '还行，希望后续能增加更多工程师。' },
        ];
        for (let i = 0; i < Math.min(platformRatings.length, customers.results.length); i++) {
          const pr = platformRatings[i];
          const cid = customers.results[i].id;
          const existingPR = await env.DB.prepare('SELECT id FROM platform_ratings WHERE customer_id = ?').bind(cid).first();
          if (existingPR) continue;
          const pid = generateId();
          await env.DB.prepare('INSERT INTO platform_ratings (id, customer_id, rating, comment) VALUES (?, ?, ?, ?)').bind(pid, cid, pr.rating, pr.comment).run();
          created.ratings.push({ type: 'platform', customer_id: cid, rating: pr.rating });
        }

        // 工程师对客户的评价（内部）
        if (ratedWorkOrders.length >= 2) {
          for (let i = 0; i < 2; i++) {
            const wo = ratedWorkOrders[i];
            const woData = await env.DB.prepare('SELECT engineer_id, customer_id FROM work_orders WHERE id = ?').bind(wo.id).first();
            if (!woData?.engineer_id) continue;
            const existingCR = await env.DB.prepare('SELECT id FROM customer_ratings WHERE work_order_id = ? AND engineer_id = ?').bind(wo.id, woData.engineer_id).first();
            if (existingCR) continue;
            const crid = generateId();
            const crRating = 3 + Math.floor(Math.random() * 3);
            const crComment = crRating >= 4 ? '客户配合度高，沟通顺畅。' : '客户描述不够清楚，耽误了一些时间。';
            await env.DB.prepare('INSERT INTO customer_ratings (id, work_order_id, engineer_id, customer_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)').bind(crid, wo.id, woData.engineer_id, woData.customer_id, crRating, crComment).run();
            created.ratings.push({ type: 'customer_rating', work_order_id: wo.id, rating: crRating });
          }
        }
      }

      return jsonResponse({ success: true, created });
    } catch (error) {
      return errorResponse(error.message, 500);
    }
  }

  // ============ 完整核价流程测试 ============
  async function handleTestFullPricingFlow(env) {
    const results = { flow: [] };

    const log = (step, data) => results.flow.push({ step, ...data });

    try {
      // ====== 第1步：创建3个不同专长的工程师 ======
      log('step1_create_engineers', { message: '创建3个专长不同的工程师' });

      const engineers = [
        {
          id: generateId(),
          user_no: 'E' + String(100 + Math.floor(Math.random() * 900000)).padStart(6, '0'),
          name: '李师傅',
          phone: '18800001001',
          password_hash: 'test',
          specialties: JSON.stringify(['激光切割机', '等离子切割机']),
          brands: JSON.stringify({ '激光切割机': ['大族', '通快', '百超'], '等离子切割机': ['林德', '凯尔尼'] }),
          services: JSON.stringify(['激光器维修', '切割头维护', '导轨润滑', '参数调试']),
          service_region: '华东地区',
          bio: '专注激光设备15年，擅长通快、大族设备',
          rating_timeliness: 4.8,
          rating_technical: 4.9,
          rating_communication: 4.7,
          rating_professional: 4.9,
          rating_count: 48,
        },
        {
          id: generateId(),
          user_no: 'E' + String(100 + Math.floor(Math.random() * 900000)).padStart(6, '0'),
          name: '王师傅',
          phone: '18800001002',
          password_hash: 'test',
          specialties: JSON.stringify(['折弯机', '剪板机', '卷板机']),
          brands: JSON.stringify({ '折弯机': ['通快', '百超', 'Amada'], '剪板机': ['金方圆', '扬力'] }),
          services: JSON.stringify(['液压维修', '同步精度校准', '模具维护', '参数调试']),
          service_region: '华东地区',
          bio: '擅长激光和成型设备，10年经验',
          rating_timeliness: 4.5,
          rating_technical: 4.7,
          rating_communication: 4.6,
          rating_professional: 4.5,
          rating_count: 32,
        },
        {
          id: generateId(),
          user_no: 'E' + String(100 + Math.floor(Math.random() * 900000)).padStart(6, '0'),
          name: '张师傅',
          phone: '18800001003',
          password_hash: 'test',
          specialties: JSON.stringify(['激光焊接', 'MIG焊接', 'TIG焊接']),
          brands: JSON.stringify({ '激光焊接': ['通快', 'IPG'], 'MIG焊接': ['福尼斯', '林肯'] }),
          services: JSON.stringify(['焊接参数调优', '焊缝质量排查', '送丝机构维护']),
          service_region: '华南地区',
          bio: '焊接专家，精通各类焊接设备调试',
          rating_timeliness: 4.3,
          rating_technical: 4.6,
          rating_communication: 4.8,
          rating_professional: 4.4,
          rating_count: 25,
        },
      ];

      for (const eng of engineers) {
        const existing = await env.DB.prepare('SELECT id FROM engineers WHERE phone = ?').bind(eng.phone).first();
        if (!existing) {
          await env.DB.prepare(`
            INSERT INTO engineers (id, user_no, name, phone, password_hash, specialties, brands, services, service_region, bio, rating_timeliness, rating_technical, rating_communication, rating_professional, rating_count, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')
          `).bind(eng.id, eng.user_no, eng.name, eng.phone, eng.password_hash, eng.specialties, eng.brands, eng.services, eng.service_region, eng.bio, eng.rating_timeliness, eng.rating_technical, eng.rating_communication, eng.rating_professional, eng.rating_count).run();
        }
        eng.created = !existing;
      }
      log('step1_done', { engineers: engineers.map(e => ({ name: e.name, phone: e.phone, specialties: JSON.parse(e.specialties), created: e.created })) });

      // ====== 第2步：创建一个测试客户 ======
      log('step2_create_customer', { message: '创建测试客户' });
      const customerId = generateId();
      const customerPhone = '18900001001';
      const customerName = '张伟';

      const existingCust = await env.DB.prepare('SELECT id FROM customers WHERE phone = ?').bind(customerPhone).first();
      const finalCustomerId = existingCust ? existingCust.id : customerId;
      if (!existingCust) {
        await env.DB.prepare(`
          INSERT INTO customers (id, user_no, name, phone, password_hash, salt, region)
          VALUES (?, 'C' || substr(?, 10), ?, ?, 'test', '', '华东地区')
        `).bind(customerId, customerId, customerName, customerPhone).run();
      }
      log('step2_done', { customer_id: finalCustomerId, name: customerName, phone: customerPhone });

      // ====== 第3步：客户提交工单 ======
      log('step3_submit_workorder', { message: '客户提交工单' });
      const workOrderId = generateId();
      const orderNo = 'WO-TEST-' + generateId().slice(0, 8).toUpperCase();

      await env.DB.prepare(`
        INSERT INTO work_orders (id, order_no, customer_id, type, description, urgency, status, sla_deadline, category_l1, category_l2)
        VALUES (?, ?, ?, 'fault', '光纤激光切割机（3000W大族）切割时出现毛刺，切面不光洁，侧壁有挂渣。已经更换过辅助气体（氮气），问题仍然存在。设备使用3年，近期未做保养。', 'urgent', 'pending', ?, 'laser_cutting', 'optical_fault')
      `).bind(workOrderId, orderNo, finalCustomerId, computeSlaDeadline('urgent')).run();

      // 生成 AI 摘要
      const aiSummary = await generateWorkOrderSummary('fault', '光纤激光切割机（3000W大族）切割时出现毛刺，切面不光洁，侧壁有挂渣。已经更换过辅助气体（氮气），问题仍然存在。设备使用3年，近期未做保养。', 'urgent', env, { market: 'cn' });
      await env.DB.prepare('UPDATE work_orders SET ai_summary = ? WHERE id = ?').bind(JSON.stringify(aiSummary), workOrderId).run();

      log('step3_done', { work_order_id: workOrderId, order_no: orderNo, ai_summary: aiSummary });

      // ====== 第4步：AI 推荐工程师 ======
      log('step4_ai_recommend', { message: 'AI 分析工单并推荐工程师' });
      const workOrder = await env.DB.prepare('SELECT * FROM work_orders WHERE id = ?').bind(workOrderId).first();
      const recommended = await findMatchingEngineers(workOrder, env);
      log('step4_done', {
        recommended_engineers: recommended.map(e => ({
          name: e.name,
          total_score: e.totalScore,
          specialty_score: e.specialtyScore,
          skill_score: e.skillScore,
          brand_bonus: e.brandBonus,
          avg_rating: ((e.rating_timeliness + e.rating_technical + e.rating_communication + e.rating_professional) / 4).toFixed(1),
          specialties: e.specialties,
        }))
      });

      // ====== 第5步：第1名工程师接单 ======
      log('step5_engineer_accept', { message: '最优推荐工程师接单' });
      const topEngineer = recommended[0];
      await env.DB.prepare(`
        UPDATE work_orders SET status = 'in_progress', engineer_id = ?, assigned_at = datetime('now')
        WHERE id = ?
      `).bind(topEngineer.id, workOrderId).run();

      await env.DB.prepare(`
        INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
        VALUES (?, ?, 'accepted', 'engineer', ?, ?)
      `).bind(generateId(), workOrderId, topEngineer.id, `${topEngineer.name} 接单`).run();

      log('step5_done', { engineer_name: topEngineer.name, status: 'in_progress' });

      // ====== 第6步：工程师提交核价 ======
      log('step6_engineer_pricing', { message: '工程师提交核价' });

      // 读取工程师佣金比例（按等级：Junior 80% / Senior 85% / Expert 88%）
      const engineerData = await env.DB.prepare(
        'SELECT commission_rate, level FROM engineers WHERE id = ?'
      ).bind(topEngineer.id).first();
      const commissionRate = engineerData?.commission_rate || 0.80;

      const laborFee = 800; // 工时费
      const partsFee = 200; // 配件费（保护镜片等）
      const travelFee = 200; // 差旅费
      const otherFee = 0;
      const subtotal = laborFee + partsFee + travelFee + otherFee;
      // V2佣金体系：客户支付 subtotal（工程师报的全包价），平台从工程师端抽佣
      const platformFee = Math.round(subtotal * (1 - commissionRate));  // 平台服务费
      const depositWithhold = Math.round(subtotal * 0.05);             // 动态保证金 5%
      const engineerPayout = Math.round(subtotal * commissionRate);     // 工程师实得

      // AI 审核报价
      const aiCheck = await checkPricingReasonableness({ labor_fee: laborFee, parts_fee: partsFee, travel_fee: travelFee, other_fee: otherFee, total_amount: subtotal }, workOrderId, env);

      const pricingId = generateId();
      await env.DB.prepare(`
        INSERT INTO work_order_pricing (id, work_order_id, engineer_id, labor_fee, parts_fee, travel_fee, other_fee, subtotal, platform_fee, deposit_withhold, total_amount, ai_price_check, status, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', datetime('now'))
      `).bind(pricingId, workOrderId, topEngineer.id, laborFee, partsFee, travelFee, otherFee, subtotal, platformFee, depositWithhold, subtotal, JSON.stringify(aiCheck)).run();

      // 更新工单状态
      await env.DB.prepare("UPDATE work_orders SET status = 'pricing' WHERE id = ?").bind(workOrderId).run();

      // 发送系统消息
      await env.DB.prepare(`
        INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type)
        VALUES (?, ?, 'system', '', '系统', '工程师已提交报价，请查看报价明细并确认。', 'pricing_update')
      `).bind(generateId(), workOrderId).run();

      log('step6_done', {
        pricing: { laborFee, partsFee, travelFee, otherFee, subtotal, commissionRate, platformFee, depositWithhold, engineerPayout },
        ai_check: aiCheck,
        work_order_status: 'pricing'
      });

      // ====== 第7步：客户确认报价 ======
      log('step7_customer_confirm', { message: '客户确认报价' });
      await env.DB.prepare(`
        UPDATE work_order_pricing SET status = 'confirmed', confirmed_at = datetime('now') WHERE id = ?
      `).bind(pricingId).run();

      await env.DB.prepare(`
        UPDATE work_orders SET status = 'in_service' WHERE id = ?
      `).bind(workOrderId).run();

      await env.DB.prepare(`
        INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type)
        VALUES (?, ?, 'system', '', '系统', '客户已确认报价，工程师将上门服务。', 'system')
      `).bind(generateId(), workOrderId).run();

      log('step7_done', { work_order_status: 'in_service' });

      // ====== 第8步：工程师标记服务完成 ======
      log('step8_resolve', { message: '工程师上门服务完成' });
      await env.DB.prepare(`
        UPDATE work_orders SET status = 'resolved', resolved_at = datetime('now') WHERE id = ?
      `).bind(workOrderId).run();

      await env.DB.prepare(`
        INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type)
        VALUES (?, ?, 'system', '', '系统', '服务已完成，请客户确认并评价。', 'system')
      `).bind(generateId(), workOrderId).run();

      log('step8_done', { work_order_status: 'resolved' });

      // ====== 第9步：客户提交评价 ======
      log('step9_customer_rating', { message: '客户提交评价' });
      const ratingId = generateId();
      await env.DB.prepare(`
        INSERT INTO ratings (id, work_order_id, engineer_id, customer_id, rating_timeliness, rating_technical, rating_communication, rating_professional, comment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(ratingId, workOrderId, topEngineer.id, finalCustomerId, 5, 5, 4, 5, '服务很专业，准时到达，问题解决了，满意！').run();

      // 更新工程师评分
      const newTimeliness = ((topEngineer.rating_timeliness * topEngineer.rating_count) + 5) / (topEngineer.rating_count + 1);
      const newTechnical = ((topEngineer.rating_technical * topEngineer.rating_count) + 5) / (topEngineer.rating_count + 1);
      const newComm = ((topEngineer.rating_communication * topEngineer.rating_count) + 4) / (topEngineer.rating_count + 1);
      const newProf = ((topEngineer.rating_professional * topEngineer.rating_count) + 5) / (topEngineer.rating_count + 1);
      await env.DB.prepare(`
        UPDATE engineers SET rating_timeliness = ?, rating_technical = ?, rating_communication = ?, rating_professional = ?, rating_count = ? WHERE id = ?
      `).bind(newTimeliness.toFixed(1), newTechnical.toFixed(1), newComm.toFixed(1), newProf.toFixed(1), topEngineer.rating_count + 1, topEngineer.id).run();

      // 工单标记完成
      await env.DB.prepare(`
        UPDATE work_orders SET status = 'completed', completed_at = datetime('now') WHERE id = ?
      `).bind(workOrderId).run();

      log('step9_done', { rating_submitted: true, work_order_status: 'completed' });

      // 保存结果到D1
      try {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS test_flow_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            step TEXT,
            data TEXT,
            created_at TEXT DEFAULT (datetime('now'))
          )
        `).run();
        for (const item of results.flow) {
          await env.DB.prepare(
            'INSERT INTO test_flow_results (step, data) VALUES (?, ?)'
          ).bind(item.step, JSON.stringify(item)).run();
        }
      } catch (e) {
        console.error('保存结果失败:', e);
      }

      return jsonResponse({ success: true, flow: results.flow });
    } catch (error) {
      return errorResponse('测试流程出错: ' + error.message, 500);
    }
  }

  if (path === '/api/init-test-data' && request.method === 'GET') {
  return handleInitTestData(env);
  }
  if (path === '/api/test-full-flow' && request.method === 'GET') {
  return handleTestFullPricingFlow(env);
  }
  if (path === '/api/debug-engineers' && request.method === 'GET') {
  // 调试：查看所有可用工程师的onesignal_player_id
  const engineers = await env.DB.prepare(
  'SELECT id, name, onesignal_player_id FROM engineers WHERE status = ?'
  ).bind('available').all();
  return jsonResponse({ count: engineers.results.length, engineers: engineers.results });
  }
  if (path === '/api/test-create-workorder' && request.method === 'POST') {
  const body = await request.json().catch(() => ({}));
  const customerId = body.customer_id || 'mnyj09v0pa0kfz0lenf'; // 张伟
  const id = generateId();
  const order_no = 'WO-TEST-' + Date.now();
  const type = body.type || 'fault';
  const description = body.description || '激光切割机激光器不出光';
  const urgency = body.urgency || 'urgent';

  // 直接查数据库看onesignal_player_id
  const allEngineers = await env.DB.prepare('SELECT id, name, onesignal_player_id FROM engineers WHERE status = ?').bind('available').all();

  // 创建工单
  await env.DB.prepare(`
  INSERT INTO work_orders (id, order_no, customer_id, type, description, urgency, status, sla_deadline, category_l1, category_l2)
  VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).bind(id, order_no, customerId, type, description, urgency, computeSlaDeadline(urgency), 'other', 'other').run();

  // 生成AI摘要
  const aiSummary = await generateWorkOrderSummary(type, description, urgency, env, { market: getRequestMarket(request) });

  const workOrderData = { id, order_no, type, description, urgency, ai_summary: aiSummary };

  // 查找匹配的工程师
  const matchingEngineers = await findMatchingEngineers(workOrderData, env);

  // 发送推送
  const typeLabels = { fault: '设备故障', maintenance: '维护保养', parameter: '参数调试' };
  const urgencyLabels = { normal: '普通', urgent: '紧急', critical: '非常紧急' };
  let sent = 0;
  for (const engineer of matchingEngineers) {
  if (engineer.onesignal_player_id) {
  await sendPushToEngineer(engineer.id, env, {
  title: '📋 New Service Assignment',
  titleZh: '📋 新服务任务待确认',
  message: `Service: ${order_no} | Type: ${typeLabels[type] || type} | Urgency: ${urgencyLabels[urgency] || urgency}`,
  messageZh: `服务编号：${order_no} | 类型：${typeLabels[type] || type} | 紧急程度：${urgencyLabels[urgency] || urgency}`,
  data: { work_order_id: id, type: 'new_ticket' }
  });
  sent++;
  }
  }

  return jsonResponse({
  workOrder: { id, order_no },
  allEngineers: allEngineers.results.length,
  allEngineersSample: allEngineers.results.slice(0,2).map(e => ({ id: e.id, name: e.name, playerId: e.onesignal_player_id })),
  matched: matchingEngineers.length,
  sent,
  firstEngineer: matchingEngineers[0] ? JSON.stringify(matchingEngineers[0]) : null
  });
  }
  if (path === '/api/test-push' && request.method === 'POST') {
  // 测试推送，直接发给李师傅
  const engineerId = 'mnyj0ab5bzrrfkvrppo';
  const result = await sendPushToEngineer(engineerId, env, {
  title: '📋 Test Push',
  titleZh: '📋 测试推送',
  message: 'Test message from worker',
  messageZh: '这是来自 Worker 的测试消息',
  data: { type: 'test' }
  });
  return jsonResponse({ success: result, engineerId });
  }
  if (path === '/api/test-workorder-push' && request.method === 'POST') {
  // 模拟工单创建流程，测试推送
  const body = await request.json().catch(() => ({}));
  const workOrderData = {
  id: 'test-wo-' + Date.now(),
  order_no: 'WO-TEST-' + Date.now(),
  type: body.type || 'fault',
  description: body.description || '激光切割机激光器不出光',
  urgency: body.urgency || 'urgent',
  ai_summary: JSON.stringify({
  summary: '激光切割机激光器不出光',
  required_specialties: ['激光切割机'],
  suggested_skills: ['激光器维修'],
  })
  };
  const matchingEngineers = await findMatchingEngineers(workOrderData, env);
  const typeLabels = { fault: '设备故障', maintenance: '维护保养', parameter: '参数调试', urgent: '紧急' };
  const urgencyLabels = { normal: '普通', urgent: '紧急', critical: '非常紧急' };
  let sent = 0;
  for (const engineer of matchingEngineers) {
  if (engineer.onesignal_player_id) {
  await sendPushToEngineer(engineer.id, env, {
  title: '📋 New Service Assignment',
  titleZh: '📋 新服务任务待确认',
  message: `Service: ${workOrderData.order_no} | Type: ${typeLabels[workOrderData.type] || workOrderData.type} | Urgency: ${urgencyLabels[workOrderData.urgency] || workOrderData.urgency}`,
  messageZh: `服务编号：${workOrderData.order_no} | 类型：${typeLabels[workOrderData.type] || workOrderData.type} | 紧急程度：${urgencyLabels[workOrderData.urgency] || workOrderData.urgency}`,
  data: { work_order_id: workOrderData.id, type: 'new_ticket' }
  });
  sent++;
  }
  }
  return jsonResponse({ matched: matchingEngineers.length, sent, engineers: matchingEngineers.map(e => ({ id: e.id, name: e.name, playerId: e.onesignal_player_id })) });
  }
  if (path === '/api/test-results' && request.method === 'GET') {
  try {
  const results = await env.DB.prepare('SELECT * FROM test_flow_results ORDER BY id ASC').all();
  return jsonResponse({ results: results.results });
  } catch (e) {
  return errorResponse('读取失败: ' + e.message, 500);
  }
  }
  if (path === '/api/clear-test-data' && request.method === 'GET') {
  try {
  await env.DB.prepare('DELETE FROM test_flow_results').run();
  await env.DB.prepare('DELETE FROM work_orders WHERE order_no LIKE ?').bind('WO-TEST-%').run();
  return jsonResponse({ success: true, message: '测试数据已清理' });
  } catch (e) {
  return errorResponse('清理失败: ' + e.message, 500);
  }
  }

  // 临时建表接口（生产 404；非生产需管理员）
  if (path === '/api/init-db' && request.method === 'GET') {
  return handleInitDb(env);
  }

  return null;
}
