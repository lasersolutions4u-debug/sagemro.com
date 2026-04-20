/**
 * SAGEMRO 小智 - Cloudflare Worker
 * 后端 API 服务，处理聊天、工单、认证等请求
 */

// ============ 配置 ============
// API_KEY 和 API_ENDPOINT 通过 Cloudflare Worker Secrets 注入
// 设置命令：wrangler secret put OPENAI_API_KEY / OPENAI_API_ENDPOINT
// JWT_SECRET 也通过 Secrets 注入：wrangler secret put JWT_SECRET

// 管理员账号（通过环境变量注入，wrangler secret put ADMIN_PHONE / ADMIN_PASSWORD）
// 本地开发回退值仅用于提示，生产环境必须设置 secret
const ADMIN_PHONE = '13800000000';  // 仅回退默认值
// ADMIN_PASSWORD 从 env 读取，不再硬编码

// ============ System Prompt ============
const SYSTEM_PROMPT = `你是"小智"，智维钣金平台的 AI 助手，服务于钣金加工行业的设备维修服务。

## 你的身份

你同时具备三重角色：

第一，你是钣金加工设备领域的资深技术顾问。你在钣金行业深耕多年，对从下料到成品的全工艺链设备都有深入了解，包括其工作原理、日常维护保养规范、常见故障模式和应急处理方法。用户问你技术问题，你能像一个经验丰富的老师傅一样给出实在、可靠的建议。

第二，你是一个十分资深的客服部门总监。你对每一位客户的设备状况、历史报修记录、服务偏好都了然于胸。你能站在客户角度思考，不是机械地走流程，而是真正帮客户解决问题——该给建议给建议，该报修报修，该紧急处理就加急，永远给用户最理性、最明智的选项和方案。

第三，你是一个十分资深的人事总监。你对平台上每一位工程师的技术专长、擅长品牌、服务评价、响应速度、当前工作负荷和接单状态都精准掌握。当需要为客户推荐或调度工程师时，你能综合考量故障类型与工程师专长的匹配度、地理距离、工程师当前负荷、历史服务评价等多维因素，给出最优推荐，并清晰地向用户说明推荐理由。

你叫小智，语气像一个懂行、靠谱、办事利索的人——干脆、实在、有经验、有全局观。

## 你的专业知识领域

你熟悉钣金加工全工艺链涉及的各类设备，具备以下方面的行业知识，可以主动为用户提供技术建议和解答：

### 一、切割下料设备

激光切割机（光纤激光、CO2激光）：
激光器保养周期与功率衰减判断，保护镜片与聚焦镜清洁更换、切割头校准与跟随高度调试、导轨与齿条润滑维护、冷水机水温水质维护与滤芯更换、辅助气体（氮气/氧气/空气）气路检查与减压阀调节、交换工作台定位精度校准、除尘排烟系统维护、切割质量问题排查（挂渣，毛刺，过烧、断面纹路异常等）

数控冲床/转塔冲床：
模具间隙调整与刃口研磨周期、转塔定位精度校准、液压系统（液压冲）或伺服驱动（伺服冲）维护要点、送料机构精度维护与夹钳调整、打击头与模位对中检查、润滑系统（油脂/集中润滑）维护

剪板机（液压/机械）：
刀片间隙调整方法与根据板厚选择、刀片刃口磨损判断与翻面/更换、后挡料精度校准、液压系统油液维护与密封件检查、机械传动部分保养

等离子切割机：
电极与喷嘴消耗件更换周期判断、割炬高度控制（THC）维护与校准、冷却水系统维护、切割电流与速度匹配调优、穿孔工艺参数调整

水刀切割机（水射流切割）：
高压泵（增压器/直驱泵）维护保养要点、高压管路与接头密封检查、砂管与宝石喷嘴磨损判断及更换、磨料供给系统维护、水质处理与过滤系统

### 二、成形加工设备

折弯机（液压同步/电液伺服/全电动）：
液压油选型与更换周期（液压机型）、同步精度校准与光栅尺维护、滑块平行度调整、模具（上模/下模）保养存放与配对选型建议、后挡料定位精度校准与手指更换、安全光幕/激光保护装置检查与调试、折弯角度偏差排查（回弹补偿，材料批次差异等）、CNC控制系统参数备份

卷板机：
辊子表面维护与硬度检查、液压系统维护、辊子平行度调整、不同板厚卷圆参数建议、预弯工艺要点

冲压机/压力机：
离合器与制动器检查调整、曲轴与连杆润滑、滑块导轨间隙调整、模具安装与定位，气垫/液压垫维护、吨位监控与过载保护

旋压机：
旋压轮/旋压头维护与更换、尾顶压力调整、主轴精度检查、旋压工艺参数建议

拉伸/拉深设备：
液压缸与密封件维护、压边力调整、拉深模具维护要点

### 三、焊接设备

MIG/MAG焊机（含脉冲MIG）：
送丝机构（送丝轮、导丝管、导电嘴）磨损判断与更换，气路检查（气管老化、漏气、流量校准）、焊枪维护与弯管更换、送丝不畅故障排查、焊接参数（电流/电压/送丝速度）匹配调优建议

TIG焊机（含冷丝/热丝TIG）：
钨极选型与研磨规范，气罩/喷嘴选型与清洁、高频引弧模块维护、冷却水系统检查、不同材料（不锈钢/铝/钛）焊接参数建议

激光焊接机：
光纤传输检查、焊接头保护镜片更换、焦点位置校准、冷却系统维护、焊缝质量问题排查（气孔、飞溅、咬边等）

电阻焊/点焊机：
电极帽磨损判断与修磨/更换周期、变压器冷却系统维护、焊接压力与电流校准、焊点质量检验要点

焊接机器人系统：
TCP（工具中心点）校准、清枪剪丝站维护、变位机定位精度检查、离线编程与示教要点、防碰撞传感器检查

### 四、表面处理及后处理设备

去毛刺机/砂光机：
砂带/毛刷辊选型与更换、输送辊维护与速度调节、吸尘系统维护、加工效果调优（毛刺方向、R角大小）

抛丸机/喷砂机：
抛丸器叶片与护板磨损检查更换、弹丸/砂料循环系统维护、除尘滤筒更换、履带/吊钩等传动部件保养

喷涂/粉末喷涂设备：
喷枪（静电喷枪）维护与清洁、供粉系统与流化桶维护、固化炉温度均匀性检查、回收系统滤芯更换、涂层质量问题排查（橘皮、流挂、附着力差等）

清洗设备（超声波/喷淋）：
换能器检查、清洗液配比与更换周期、加热系统维护、过滤系统维护

### 五、辅助设备与系统

空压机及气路系统：
空压机保养（空滤/油滤/油分芯更换周期、润滑油更换）、冷干机维护、储气罐排水、管路漏气检查、气体品质（含油量/含水量/颗粒度）对设备和工艺的影响

冷水机/冷却系统：
冷却水水质管理（电导率、pH值、防冻液配比）、滤芯更换、冷凝器清洁、制冷剂状态检查、水温水压报警处理

除尘/环保设备：
滤筒/布袋更换周期与差压监控、脉冲反吹系统维护、风机与管道系统检查、活性炭等净化模块更换

制氮机/制氧机：
分子筛更换周期、气体纯度检测与校准、阀门组件维护

变压器/稳压器/UPS：
散热系统维护、电压波动对设备的影响排查

### 六、数控系统与自动化

常见数控系统（Fanuc、Siemens、Mitsubishi、Beckhoff、Delem、Cybelec、Bosch Rexroth等）：
系统参数备份与恢复、报警代码含义速查与常见处理方式、系统版本更新注意事项、通讯接口排查（网络/串口）

伺服驱动与电机：
伺服报警代码排查、编码器故障判断、电机异响与发热异常处理、刹车制动器检查

工业机器人（KUKA、ABB、Fanuc、Yaskawa等）：
日常点检要点、减速器异响与漏油判断、电池更换（编码器电池/控制器电池）、安全回路检查

自动化产线与物流系统：
自动上下料系统维护、立体料库故障排查、AGV/RGV维护要点、传感器（光电/接近/安全）检查与更换

### 七、检测与品控设备

三坐标测量机（CMM）：
气源品质要求、导轨清洁与保养、测头校准、环境温湿度要求

激光检测/在线测量设备：
镜头清洁、标定校准周期、环境干扰因素排查

### 常见品牌认知
你对行业内主流品牌有基本认知，包括但不限于：
- 激光切割：大族、通快（TRUMPF）、百超（Bystronic）、迅镭、邦德、宏山、奔腾
- 折弯机：通快、百超、安马达（Amada）、亚威、普玛宝（Prima Power）、萨瓦尼尼（Salvagnini）
- 冲床：安马达、通快，村田（MURATA/MURATEC）、金方圆、扬力
- 焊接：福尼斯（Fronius）、林肯（Lincoln）、米勒（Miller）、松下、伊萨（ESAB）、麦格米特
- 机器人：KUKA、ABB、Fanuc、Yaskawa、埃斯顿、汇川
- 数控系统：Fanuc、Siemens、Delem、Cybelec、Beckhoff、Mitsubishi、凯恩帝

## 行为准则

### 回答技术问题时
- 用户问设备维护、保养、故障相关的知识性问题时，优先基于你的专业知识直接给出有用的回答。
- 回答要结合用户的实际设备情况。
- 涉及安全风险的操作，必须明确提醒用户注意安全或等待专业工程师处理。
- 故障判断只给方向性建议，表述用"可能是""建议检查"而不是"肯定是"。
- 涉及具体配件价格、维修报价时，不要编造数字，建议用户通过报修工单获取工程师的实际报价。

### 推荐和调度工程师时
- 当用户需要工程师上门服务时，综合考量故障类型与工程师技术专长的匹配度。
- 推荐时要向用户清晰说明推荐理由。
- 对于紧急故障（停产级别），优先推荐响应最快且能力匹配的工程师。

### 处理报修时
- 当用户表达报修意图时，按顺序引导采集：哪台设备出问题 → 什么故障现象 → 紧急程度。
- 创建工单前，必须将工单信息汇总展示给用户确认。

### 沟通风格
- 用简洁的口语化中文。不要用"您好，很高兴为您服务"这种客服腔。直接、有用、像懂行的同事。
- 每次回复控制在合理长度。简单问题2-3句话，技术问题可以稍长但也不超过一屏。`;

// ============ Role Prompt（分层注入）============

const ROLE_PROMPTS = {
  guest: `
【角色】你是 SAGEMRO 平台的热情接待员。

当前用户是游客，还没有注册账号。他正在体验小智的免费技术咨询服务。

## 你的目标
通过回答他的技术问题，展示小智的专业价值，让他感受到"这个 AI 真的懂设备"。
在回答末尾，自然引导他注册账号，享受更个性化的服务。

## 禁忌
- 不要一上来就要求他注册
- 不要机械地说"欢迎致电客服"
- 不要夸大平台功能，说做不到的承诺

## 回答风格
像一位热情但专业的老师傅，用口语化、直接的方式回答问题。
技术问题给实在的建议，不绕弯子。

## 引导注册
在回答技术问题后，如果感觉用户有设备维修需求，可以自然地说：
"如果想保存这次维修记录，方便以后追踪保养历史，可以在平台注册一个账号，完全免费。"
——不要说太多，点到为止。
`,

  customer: `
【角色】你是 SAGEMRO 平台客户的专属设备顾问。

当前用户已登录，是平台的客户。他的个人信息和设备档案在下方【上下文】中有详细记录。

## 你的核心职责
1. 当他咨询设备问题时，结合他的设备历史给出针对性建议，不是泛泛而谈
2. 当发现设备有反复出现的故障模式时，主动提醒预防性保养
3. 当他需要报修时，引导他提交工单
4. 跟踪他的工单状态，在合适的时机提醒他确认服务完成

## 主动关怀指令
- 如果他的某台设备上次保养时间超过 6 个月，主动提醒保养
- 如果他有正在处理中的工单，可以在回答中穿插提醒

## 禁忌
- 不要重复问他已经说过的设备信息
- 不要在不了解他设备的情况下给过于通用的建议
- 绝不能说"您还不是会员"——他已经是注册用户了

## 回答风格
像一位熟悉他情况的专属顾问，知道他有什么设备、遇到过什么问题。
语气：熟悉、靠谱、主动。

## 工具调用指令
当客户询问以下类型问题时，必须先调用对应工具获取实时数据，再回答：
- 询问自己有哪些设备、有哪些设备档案 → 调用 get_customer_devices
- 询问某个设备的详细信息、维修历史、工单记录 → 调用 get_device_detail（需提供 device_id）
- 询问某个设备的状态（是否正常使用、是否在维保中）→ 调用 get_device_detail

调用工具后，将工具返回的数据自然地融入回答中。
`,

  engineer: `
【角色】你是 SAGEMRO 平台合伙人的业务助理。

当前用户已登录，是平台的合伙人/工程师。他的个人档案、当前工单状态、钱包信息在下方【上下文】中有详细记录。

## 你的核心职责
1. 当他咨询技术问题时，在回答中结合他当前的接单状态
2. 当他在讨论报价时，主动提供历史参考数据和地区均价
3. 当他提到"接单""工单"相关时，主动汇报他的工单情况

## 主动汇报指令
- 如果他有待接单的新工单，提醒："您目前有 X 个新工单等待接单，其中 X 个匹配您的专长。"
- 如果他有正在报价中的工单，提醒："您有 X 个工单正在等待客户确认报价。"
- 如果他钱包有变化，提醒："您的钱包最新余额为 XXX 元。"

## 报价辅助
当合伙人询问如何报价时：
- 参考【上下文】中的历史报价数据和地区均价
- 结合他的合伙人等级（Junior/Senior/Expert）和对应提成比例给出合理区间

## 禁忌
- 不要在客户面前暴露合伙人隐私（钱包余额等）
- 不要替他做接单决策
- 绝不能说"您还没有注册"——他已是合伙人

## 回答风格
像一位懂行的业务搭档，既能讨论技术问题，又能帮他理清手上的活儿和钱包。
语气：专业、高效、主动。

## 工具调用指令
当合伙人询问以下类型问题时，必须先调用对应工具获取实时数据，再回答：
- 询问自身状态（钱包余额、信用分、评分、等级、提现、本月收入、本月完成工单数等）→ 调用 get_engineer_profile
- 询问有哪些新工单可接、当前平台有哪些待接单工单 → 调用 get_pending_tickets_for_engineer

调用工具后，将工具返回的数据自然地融入回答中，不要机械地复述数据。
`
};

// ============ Function Calling 工具定义 ============

const TOOLS_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'get_engineer_profile',
      description: '查询当前登录合伙人的完整档案信息，包括等级、钱包余额、信用分、评分、专长、服务地区、累计完成工单数、本月收入等。当合伙人询问自身状态时调用此工具。',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_tickets_for_engineer',
      description: '查询平台当前所有待接单的工单列表。返回工单编号、设备类型、故障描述、紧急程度、提交时间。当合伙人询问有哪些新工单可接时调用此工具。',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            description: '返回数量限制，默认10条，最多20条'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_customer_devices',
      description: '查询当前客户的所有设备档案列表，包含设备名称、类型、品牌、状态和维修记录摘要。用于客户询问自己有哪些设备时调用。',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_device_detail',
      description: '查询指定设备的完整档案，包括设备详细信息和所有关联的维修工单记录。用于客户询问某个设备的详细信息或维修历史时调用。参数 device_id 为必填。',
      parameters: {
        type: 'object',
        properties: {
          device_id: {
            type: 'string',
            description: '设备ID'
          }
        },
        required: ['device_id']
      }
    }
  }
];

// ============ 工具函数 ============

// ============ Function Calling 工具实现 ============

// 执行工具调用（根据工具名路由到具体实现）
async function executeTool(toolName, args, env, engineerId, customerId) {
  switch(toolName) {
    case 'get_engineer_profile':
      return await toolGetEngineerProfile(engineerId, env);
    case 'get_pending_tickets_for_engineer':
      return await toolGetPendingTickets(args?.limit || 10, env);
    case 'get_customer_devices':
      return await toolGetCustomerDevices(customerId, env);
    case 'get_device_detail':
      return await toolGetDeviceDetail(customerId, args?.device_id, env);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// 工具1：查询合伙人档案
async function toolGetEngineerProfile(engineerId, env) {
  if (!engineerId) return { error: 'engineer_id is required' };

  try {
    const engineer = await env.DB.prepare(
      `SELECT name, phone, specialties, brands, services, service_region,
              status, level, commission_rate, credit_score, wallet_balance,
              rating_timeliness, rating_technical, rating_communication,
              rating_professional, rating_count, total_orders, total_earnings
       FROM engineers WHERE id = ?`
    ).bind(engineerId).first();

    if (!engineer) return { error: 'Engineer not found' };

    // 获取本月完成工单数和收入
    const monthly = await env.DB.prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as earnings
      FROM work_orders wo
      LEFT JOIN engineer_wallets ew ON ew.work_order_id = wo.id AND ew.engineer_id = ? AND ew.type IN ('order_payment', 'bonus')
      WHERE wo.engineer_id = ? AND wo.status = 'completed'
      AND wo.completed_at >= datetime('now', 'start of month')`
    ).bind(engineerId, engineerId).first();

    // 获取当前处理中工单数
    const inProgress = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM work_orders
       WHERE engineer_id = ? AND status IN ('assigned', 'in_progress', 'pricing', 'in_service')`
    ).bind(engineerId).first();

    const levelText = { junior: '初级', senior: '中级', expert: '专家' };
    const statusText = { available: '接单中', paused: '暂停接单', offline: '离线' };

    const avgRating = engineer.rating_count > 0
      ? ((engineer.rating_timeliness + engineer.rating_technical +
          engineer.rating_communication + engineer.rating_professional) / 4).toFixed(1)
      : null;

    return {
      name: engineer.name,
      level: levelText[engineer.level] || engineer.level,
      commission_rate: Math.round((engineer.commission_rate || 0.80) * 100),
      credit_score: engineer.credit_score,
      wallet_balance: engineer.wallet_balance || 0,
      total_earnings: engineer.total_earnings || 0,
      service_region: engineer.service_region,
      specialties: (() => { try { return JSON.parse(engineer.specialties || '[]'); } catch { return []; } })(),
      brands: (() => { try { return JSON.parse(engineer.brands || '{}'); } catch { return {}; } })(),
      services: (() => { try { return JSON.parse(engineer.services || '[]'); } catch { return []; } })(),
      status: statusText[engineer.status] || engineer.status,
      current_orders: inProgress?.cnt || 0,
      monthly_completed: monthly?.cnt || 0,
      monthly_earnings: monthly?.earnings || 0,
      avg_rating: avgRating,
      rating_count: engineer.rating_count,
      total_completed: engineer.total_orders
    };
  } catch (error) {
    return { error: error.message };
  }
}

// 工具2：查询待接单工单
async function toolGetPendingTickets(limit, env) {
  try {
    // 只查 pending 状态的工单（尚未分配工程师）
    const tickets = await env.DB.prepare(`
      SELECT wo.id, wo.order_no, wo.type, wo.description, wo.urgency, wo.created_at,
             d.type as device_type, d.brand as device_brand, d.model as device_model,
             c.name as customer_name
      FROM work_orders wo
      LEFT JOIN devices d ON d.id = wo.device_id
      LEFT JOIN customers c ON c.id = wo.customer_id
      WHERE wo.status = 'pending'
      ORDER BY
        CASE wo.urgency WHEN 'critical' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END,
        wo.created_at DESC
      LIMIT ?
    `).bind(Math.min(limit || 10, 20)).all();

    const typeText = { fault: '设备故障', maintenance: '维护保养', parameter: '参数调试', other: '其他' };
    const urgencyText = { normal: '普通', urgent: '紧急', critical: '非常紧急' };

    return {
      count: tickets.results?.length || 0,
      tickets: (tickets.results || []).map(t => ({
        order_no: t.order_no,
        device_type: t.device_type || '未知设备',
        device_brand: t.device_brand || '',
        device_model: t.device_model || '',
        problem: t.description,
        urgency: urgencyText[t.urgency] || t.urgency,
        type: typeText[t.type] || t.type,
        customer: t.customer_name || '匿名客户',
        created_at: t.created_at,
        time_ago: getTimeAgo(t.created_at)
      }))
    };
  } catch (error) {
    return { error: error.message };
  }
}

// 工具3：查询客户设备列表
async function toolGetCustomerDevices(customerId, env) {
  if (!customerId) return { error: '未登录，无法查询设备' };

  try {
    const devices = await env.DB.prepare(`
      SELECT d.id, d.name, d.type, d.brand, d.model, d.power, d.status,
             COUNT(w.id) as total_orders,
             SUM(CASE WHEN w.status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
             MAX(w.created_at) as last_order_date
      FROM devices d
      LEFT JOIN work_orders w ON w.device_id = d.id
      WHERE d.customer_id = ?
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT 50
    `).bind(customerId).all();

    const statusText = { normal: '正常', running: '使用中', maintenance: '维保中' };

    return {
      count: devices.results?.length || 0,
      devices: (devices.results || []).map(d => ({
        id: d.id,
        name: d.name || d.type,
        type: d.type,
        brand: d.brand || '',
        model: d.model || '',
        power: d.power || '',
        status: statusText[d.status] || '正常',
        total_orders: d.total_orders || 0,
        completed_orders: d.completed_orders || 0,
        last_order_date: d.last_order_date ? formatDate(d.last_order_date) : null
      }))
    };
  } catch (error) {
    return { error: error.message };
  }
}

// 工具4：查询设备详情（含维修记录）
async function toolGetDeviceDetail(customerId, deviceId, env) {
  if (!customerId) return { error: '未登录，无法查询设备' };
  if (!deviceId) return { error: 'device_id is required' };

  try {
    const device = await env.DB.prepare(
      'SELECT * FROM devices WHERE id = ? AND customer_id = ?'
    ).bind(deviceId, customerId).first();

    if (!device) return { error: '设备不存在或无权访问' };

    const workOrders = await env.DB.prepare(`
      SELECT w.id, w.order_no, w.type, w.description, w.urgency, w.status,
             w.created_at, w.completed_at,
             e.name as engineer_name,
             r.rating_timeliness, r.rating_technical, r.rating_communication, r.rating_professional
      FROM work_orders w
      LEFT JOIN engineers e ON w.engineer_id = e.id
      LEFT JOIN ratings r ON r.work_order_id = w.id
      WHERE w.device_id = ?
      ORDER BY w.created_at DESC
      LIMIT 20
    `).bind(deviceId).all();

    const typeText = { fault: '设备故障', maintenance: '维护保养', parameter: '参数调试', other: '其他' };
    const urgencyText = { normal: '普通', urgent: '紧急', critical: '非常紧急' };
    const statusText = { pending: '待处理', assigned: '已接单', in_progress: '处理中', pricing: '报价中', in_service: '服务中', resolved: '已解决', pending_review: '待评价', completed: '已完成', rejected: '已拒绝', cancelled: '已取消' };

    const workOrdersWithCost = await Promise.all((workOrders.results || []).map(async (wo) => {
      let costSummary = null;
      try {
        const pricing = await env.DB.prepare(
          'SELECT labor_fee, parts_fee, travel_fee FROM work_order_pricing WHERE work_order_id = ?'
        ).bind(wo.id).first();
        if (pricing) {
          costSummary = {
            labor: pricing.labor_fee || 0,
            parts: pricing.parts_fee || 0,
            travel: pricing.travel_fee || 0
          };
        }
      } catch (e) {}

      const ratings = [wo.rating_timeliness, wo.rating_technical, wo.rating_communication, wo.rating_professional].filter(r => r > 0);
      const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;

      return {
        order_no: wo.order_no,
        type: typeText[wo.type] || wo.type,
        description: wo.description,
        urgency: urgencyText[wo.urgency] || wo.urgency,
        status: statusText[wo.status] || wo.status,
        engineer_name: wo.engineer_name || '未知',
        rating: avgRating,
        cost_summary: costSummary,
        created_at: formatDate(wo.created_at),
        completed_at: wo.completed_at ? formatDate(wo.completed_at) : null
      };
    }));

    const statusText2 = { normal: '正常', running: '使用中', maintenance: '维保中' };

    return {
      device: {
        id: device.id,
        name: device.name || device.type,
        type: device.type,
        brand: device.brand || '',
        model: device.model || '',
        power: device.power || '',
        status: statusText2[device.status] || '正常',
        notes: device.notes || '',
        created_at: formatDate(device.created_at)
      },
      work_orders: workOrdersWithCost
    };
  } catch (error) {
    return { error: error.message };
  }
}

// 辅助函数：格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 辅助函数：获取相对时间字符串
function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

// 生成唯一 ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 创建通知记录
async function createNotification(env, { user_id, user_type, type, title, body, data }) {
  try {
    const id = generateId();
    await env.DB.prepare(
      'INSERT INTO notifications (id, user_id, user_type, type, title, body, data) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, user_id, user_type, type, title, body, data ? JSON.stringify(data) : null).run();
  } catch (e) {
    console.error('[Notification] Failed to create:', e.message);
  }
}

// 安全截断字符串（按字符数，而非字节数），支持中文
function truncateStr(str, maxChars) {
  if (!str) return '';
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars);
}

// 生成用户编号（U/E + 6位数字）
async function generateUserNo(env, prefix) {
  // 获取当前最大编号
  const table = prefix === 'U' ? 'customers' : 'engineers';
  const result = await env.DB.prepare(
    `SELECT user_no FROM ${table} WHERE user_no LIKE ? ORDER BY user_no DESC LIMIT 1`
  ).bind(`${prefix}%`).first();

  let nextNum = 1;
  if (result && result.user_no) {
    const lastNo = result.user_no;
    const numPart = parseInt(lastNo.slice(1), 10);
    nextNum = numPart + 1;
  }
  return `${prefix}${nextNum.toString().padStart(6, '0')}`;
}

// 生成随机盐值（16字节，转为hex字符串）
function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 使用 PBKDF2 生成密码哈希（新算法，每个用户独立盐值）
async function hashPasswordNew(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 旧算法兼容（SHA-256 + 固定盐），用于已有用户的密码验证
async function hashPasswordLegacy(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'sagemro_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 验证密码（兼容新旧算法）
// 如果用户有 salt 字段且非空，用新算法；否则用旧算法
async function verifyPassword(password, hash, salt) {
  if (salt) {
    const inputHash = await hashPasswordNew(password, salt);
    return inputHash === hash;
  }
  // 兼容旧用户（无 salt）
  const inputHash = await hashPasswordLegacy(password);
  return inputHash === hash;
}

// 生成工单号
function generateOrderNo() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `WO-${dateStr}-${random}`;
}

// ============ JWT 认证（基于 Web Crypto API）===========

// Base64URL 编码
function base64UrlEncode(data) {
  let str;
  if (typeof data === 'string') {
    str = btoa(unescape(encodeURIComponent(data)));
  } else {
    str = btoa(String.fromCharCode(...new Uint8Array(data)));
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Base64URL 解码
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return decodeURIComponent(escape(atob(str)));
}

// 签发 JWT token
async function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureB64 = base64UrlEncode(signature);

  return `${data}.${signatureB64}`;
}

// 验证 JWT token
async function verifyJwt(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const data = `${headerB64}.${payloadB64}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );

    // 将 Base64URL 签名转回字节数组（二进制数据，不做 UTF-8 解码）
    const sigB64 = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    const sigPadded = sigB64 + '='.repeat((4 - sigB64.length % 4) % 4);
    const sigBinary = atob(sigPadded);
    const sigBytes = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) sigBytes[i] = sigBinary.charCodeAt(i);

    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data));
    if (!valid) return null;

    // payload 用 base64UrlDecode 解码（文本数据）
    const payload = JSON.parse(base64UrlDecode(payloadB64));

    // 检查过期时间
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (e) {
    return null;
  }
}

// 从请求头中提取并验证 token
async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  const payload = await verifyJwt(token, env.JWT_SECRET);
  return payload; // { userId, userType, iat, exp }
}

// 验证是否为管理员（用于保护测试接口）
async function authenticateAdmin(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const payload = await verifyJwt(authHeader.slice(7), env.JWT_SECRET);
    return payload.userType === 'admin' ? payload : null;
  } catch {
    return null;
  }
}

// CORS 响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 处理 OPTIONS 预检请求
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// 返回 JSON 响应
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// 返回错误
function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

// ============ 认证相关 ============

// 发送验证码（模拟，实际应对接短信网关）
async function handleSendCode(request, env) {
  try {
    const { phone } = await request.json();
    if (!phone) {
      return errorResponse('手机号不能为空');
    }

    // 临时方案：固定验证码用于开发测试
    const code = String(Math.floor(1000 + Math.random() * 9000));

    // 存储验证码（有效期5分钟）
    await env.KV.put(`verify_code_${phone}`, code, { expirationTtl: 300 });

    // 测试模式：返回验证码（上线前需移除）
    return jsonResponse({ success: true, message: '验证码已发送', code });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 客户注册
async function handleRegisterCustomer(request, env) {
  try {
    const { name, phone, password, code, company, identity } = await request.json();

    if (!name || !phone || !password || !company) {
      return errorResponse('姓名、手机号、公司名称、密码不能为空');
    }

    // 验证验证码
    const storedCode = await env.KV.get(`verify_code_${phone}`);
    if (!storedCode || storedCode !== code) {
      return errorResponse('验证码错误或已过期');
    }

    // 检查手机号是否已注册
    const existing = await env.DB.prepare(
      'SELECT id FROM customers WHERE phone = ?'
    ).bind(phone).first();

    if (existing) {
      return errorResponse('该手机号已注册');
    }

    // 根据身份设置认证状态
    let authStatus = 'guest';
    if (identity === 'customer') {
      authStatus = 'authenticated';
    }

    // 创建客户
    const id = generateId();
    const userNo = await generateUserNo(env, 'U');
    const salt = generateSalt();
    const passwordHash = await hashPasswordNew(password, salt);

    await env.DB.prepare(
      'INSERT INTO customers (id, user_no, name, phone, password_hash, salt, company, auth_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, userNo, name, phone, passwordHash, salt, company, authStatus).run();

    // 删除已使用的验证码
    await env.KV.delete(`verify_code_${phone}`);

    return jsonResponse({
      success: true,
      customer: { id, user_no: userNo, name, phone }
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 工程师注册
async function handleRegisterEngineer(request, env) {
  try {
    const {
      name, phone, password, code,
      specialties, brands, services, service_region, bio,
      company
    } = await request.json();

    if (!name || !phone || !password || !company) {
      return errorResponse('姓名、手机号、公司名称、密码不能为空');
    }

    // 验证验证码
    const storedCode = await env.KV.get(`verify_code_${phone}`);
    if (!storedCode || storedCode !== code) {
      return errorResponse('验证码错误或已过期');
    }

    // 检查手机号是否已注册
    const existing = await env.DB.prepare(
      'SELECT id FROM engineers WHERE phone = ?'
    ).bind(phone).first();

    if (existing) {
      return errorResponse('该手机号已注册');
    }

    // 创建工程师
    const id = generateId();
    const userNo = await generateUserNo(env, 'E');
    const salt = generateSalt();
    const passwordHash = await hashPasswordNew(password, salt);

    await env.DB.prepare(`
      INSERT INTO engineers (id, user_no, name, phone, password_hash, salt, specialties, brands, services, service_region, bio, level, commission_rate, credit_score, wallet_balance, deposit_balance, company, auth_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, userNo, name, phone, passwordHash, salt,
      JSON.stringify(specialties || []),
      JSON.stringify(brands || {}),
      JSON.stringify(services || []),
      JSON.stringify(service_region || []),
      bio || '',
      'junior',   // 默认初级合伙人
      0.80,       // 默认提成80%
      100,        // 初始信用分100
      0,          // 初始钱包余额0
      0,          // 初始保证金余额0
      company || '',
      'authenticated'  // 合伙人注册时已完成认证
    ).run();

    // 删除已使用的验证码
    await env.KV.delete(`verify_code_${phone}`);

    return jsonResponse({
      success: true,
      engineer: { id, user_no: userNo, name, phone }
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 登录
async function handleLogin(request, env) {
  try {
    const { phone, password } = await request.json();

    if (!phone || !password) {
      return errorResponse('手机号、密码不能为空');
    }

    // 查找客户
    let user = await env.DB.prepare(
      'SELECT * FROM customers WHERE phone = ?'
    ).bind(phone).first();

    let userType = 'customer';

    // 查找工程师
    if (!user) {
      user = await env.DB.prepare(
        'SELECT * FROM engineers WHERE phone = ?'
      ).bind(phone).first();
      userType = 'engineer';
    }

    if (!user) {
      return errorResponse('手机号或密码错误');
    }

    // 验证密码（兼容新旧算法）
    const passwordValid = await verifyPassword(password, user.password_hash, user.salt);
    if (!passwordValid) {
      return errorResponse('手机号或密码错误');
    }

    // 签发 JWT token（有效期 7 天）
    const token = await signJwt({
      userId: user.id,
      userType,
      phone: user.phone,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    }, env.JWT_SECRET);

    return jsonResponse({
      success: true,
      token,
      userType,
      user: {
        id: user.id,
        user_no: user.user_no,
        name: user.name,
        phone: user.phone
      }
    });
} catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 发送重置密码验证码
async function handleSendResetCode(request, env) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return errorResponse('手机号不能为空');
    }

    // 检查手机号是否已注册（客户或工程师）
    const customer = await env.DB.prepare(
      'SELECT id FROM customers WHERE phone = ?'
    ).bind(phone).first();

    const engineer = await env.DB.prepare(
      'SELECT id FROM engineers WHERE phone = ?'
    ).bind(phone).first();

    if (!customer && !engineer) {
      return errorResponse('该手机号未注册');
    }

    // 生成验证码
    const code = String(Math.floor(1000 + Math.random() * 9000));

    // 存储验证码（有效期5分钟）
    await env.KV.put(`reset_code_${phone}`, code, { expirationTtl: 300 });

    // 测试模式：返回验证码（上线前需移除）
    return jsonResponse({ success: true, message: '验证码已发送', code });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 重置密码
async function handleResetPassword(request, env) {
  try {
    const { phone, code, newPassword } = await request.json();

    if (!phone || !code || !newPassword) {
      return errorResponse('手机号、验证码、新密码不能为空');
    }

    if (newPassword.length < 6) {
      return errorResponse('密码至少6位');
    }

    // 验证验证码
    const storedCode = await env.KV.get(`reset_code_${phone}`);
    if (!storedCode || storedCode !== code) {
      return errorResponse('验证码错误或已过期');
    }

    // 哈希新密码（使用新算法 + 随机盐）
    const salt = generateSalt();
    const passwordHash = await hashPasswordNew(newPassword, salt);

    // 更新客户密码
    const customerUpdated = await env.DB.prepare(
      'UPDATE customers SET password_hash = ?, salt = ? WHERE phone = ?'
    ).bind(passwordHash, salt, phone).run();

    // 更新工程师密码
    const engineerUpdated = await env.DB.prepare(
      'UPDATE engineers SET password_hash = ?, salt = ? WHERE phone = ?'
    ).bind(passwordHash, salt, phone).run();

    if (!customerUpdated.success && !engineerUpdated.success) {
      return errorResponse('密码更新失败');
    }

    // 删除已使用的验证码
    await env.KV.delete(`reset_code_${phone}`);

    return jsonResponse({ success: true, message: '密码重置成功' });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 聊天相关 ============

// 生成客户上下文（用于 AI 对话）
async function generateCustomerContext(customerId, env) {
  if (!customerId) return '';

  try {
    // 获取客户信息
    const customer = await env.DB.prepare(
      'SELECT name, phone, region FROM customers WHERE id = ?'
    ).bind(customerId).first();

    // 获取客户设备列表
    const devices = await env.DB.prepare(
      'SELECT type, brand, model, power FROM devices WHERE customer_id = ? ORDER BY created_at DESC'
    ).bind(customerId).all();

    // 获取最近工单（最近5条）
    const workOrders = await env.DB.prepare(
      'SELECT order_no, type, description, status, created_at FROM work_orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 5'
    ).bind(customerId).all();

    // 构建上下文文本
    let contextParts = [];

    if (customer) {
      contextParts.push(`【客户信息】${customer.name || '未知'}（${customer.phone || '无电话'}）${customer.region ? `，位于${customer.region}` : ''}`);
    }

    if (devices.results && devices.results.length > 0) {
      const deviceList = devices.results.map(d =>
        `${d.type}${d.brand ? ` (${d.brand})` : ''}${d.model ? ` - ${d.model}` : ''}${d.power ? ` - ${d.power}` : ''}`
      ).join('、');
      contextParts.push(`【已有设备】${deviceList}`);
    } else {
      contextParts.push(`【已有设备】暂无登记设备`);
    }

    if (workOrders.results && workOrders.results.length > 0) {
      const recentHistory = workOrders.results.map(wo => {
        const statusText = { pending: '待处理', assigned: '已分配', in_progress: '处理中', resolved: '已解决', completed: '已完成', rejected: '已拒绝', cancelled: '已取消' };
        return `${wo.order_no}（${wo.type} - ${statusText[wo.status] || wo.status}）：${wo.description.slice(0, 50)}${wo.description.length > 50 ? '...' : ''}`;
      }).join('；');
      contextParts.push(`【最近工单】${recentHistory}`);
    } else {
      contextParts.push(`【最近工单】暂无工单记录`);
    }

    return `\n\n${contextParts.join('\n')}\n\n请结合以上客户信息提供更个性化的服务。`;
  } catch (error) {
    console.error('generateCustomerContext error:', error);
    return '';
  }
}

// 生成合伙人上下文（用于 AI 对话）
async function generateEngineerContext(engineerId, env) {
  if (!engineerId) return '';

  try {
    // 获取合伙人信息
    const engineer = await env.DB.prepare(
      'SELECT name, phone, specialties, brands, services, service_region, status, level, commission_rate, credit_score, wallet_balance, rating_timeliness, rating_technical, rating_communication, rating_professional, rating_count, total_orders FROM engineers WHERE id = ?'
    ).bind(engineerId).first();

    if (!engineer) return '';

    // 获取待接单工单数（status = pending）
    // 注意：pending 工单尚未分配 engineer_id（分配后状态变为 assigned/in_progress）
    // 目前 pending 工单没有关联工程师，不做专长匹配（等工单提交时记录故障类型再匹配）
    const pendingOrders = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM work_orders WHERE status = 'pending'`
    ).first();

    // 获取处理中工单数（assigned 或 in_progress）
    const inProgressOrders = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM work_orders
       WHERE engineer_id = ? AND status IN ('assigned', 'in_progress', 'pricing')`
    ).bind(engineerId).first();

    // 获取本月完成工单数
    const monthlyCompleted = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM work_orders
       WHERE engineer_id = ? AND status = 'completed'
       AND created_at >= datetime('now', 'start of month')`
    ).bind(engineerId).first();

    // 获取钱包记录（本月收入）
    const monthlyEarnings = await env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM engineer_wallets
       WHERE engineer_id = ? AND type IN ('order_payment', 'bonus')
       AND created_at >= datetime('now', 'start of month')`
    ).bind(engineerId).first();

    // 合伙人等级中文
    const levelText = { junior: '初级', senior: '中级', expert: '专家' };
    // 接单状态中文
    const statusText = { available: '接单中', paused: '暂停接单', offline: '离线' };

    // 构建上下文文本
    const avgRating = engineer.rating_count > 0
      ? ((engineer.rating_timeliness + engineer.rating_technical + engineer.rating_communication + engineer.rating_professional) / 4).toFixed(1)
      : '暂无';

    const levelName = levelText[engineer.level] || engineer.level || '初级';
    const commissionRate = Math.round((engineer.commission_rate || 0.80) * 100);
    const statusName = statusText[engineer.status] || engineer.status || '接单中';

    let contextParts = [];

    contextParts.push(`【合伙人信息】${engineer.name || '未知'}${engineer.phone ? `（${engineer.phone}）` : ''}，${levelName}合伙人（提成${commissionRate}%）`);

    if (engineer.specialties) {
      try {
        const specialties = JSON.parse(engineer.specialties);
        if (Array.isArray(specialties) && specialties.length > 0) {
          contextParts.push(`【专长领域】${specialties.join('、')}`);
        }
      } catch (e) {}
    }

    if (engineer.service_region) {
      contextParts.push(`【服务地区】${engineer.service_region}`);
    }

    contextParts.push(`【接单状态】${statusName}`);

    const pendingCount = pendingOrders?.cnt || 0;
    const inProgressCount = inProgressOrders?.cnt || 0;
    const monthlyCompletedCount = monthlyCompleted?.cnt || 0;
    const monthlyEarningsTotal = monthlyEarnings?.total || 0;

    contextParts.push(`【当前工单】待接单：${pendingCount} 个；处理中：${inProgressCount} 个；本月已完成：${monthlyCompletedCount} 个`);

    if (engineer.wallet_balance !== undefined && engineer.wallet_balance !== null) {
      contextParts.push(`【钱包余额】${engineer.wallet_balance} 元`);
    }

    if (engineer.credit_score !== undefined && engineer.credit_score !== null) {
      contextParts.push(`【信用分】${engineer.credit_score}`);
    }

    contextParts.push(`【本月收入】${monthlyEarningsTotal} 元`);

    if (engineer.rating_count > 0) {
      contextParts.push(`【平均评分】${avgRating}（${engineer.rating_count}次评价）`);
    } else {
      contextParts.push(`【平均评分】暂无评价`);
    }

    if (engineer.total_orders > 0) {
      contextParts.push(`【累计完成】${engineer.total_orders} 个工单`);
    }

    return `\n\n${contextParts.join('\n')}\n\n你是 ${engineer.name || '合伙人'} 的专属业务助理，以上是你的当前状态。请结合以上信息提供个性化服务。`;
  } catch (error) {
    console.error('generateEngineerContext error:', error);
    return '';
  }
}

// 处理聊天请求
async function handleChat(request, env) {
  try {
    const body = await request.json();
    const { conversation_id, message, customer_id, engineer_id, user_type } = body;

    // ============ 访客 IP 限流保护 ============
    const effectiveUserType = user_type || 'guest';
    if (effectiveUserType === 'guest') {
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      const rateLimitKey = `rate:${clientIP}`;
      const rateLimitWindow = 3600; // 1小时窗口
      const maxMessagesPerWindow = 30; // 最多30条消息/小时

      try {
        const currentCount = await env.KV.get(rateLimitKey);
        const count = parseInt(currentCount || '0', 10);

        if (count >= maxMessagesPerWindow) {
          return jsonResponse({
            error: '请求过于频繁，请稍后再试。您已达到每小时30条消息的限制。'
          }, 429);
        }

        // 使用 KV 的 put 方法，带过期时间
        await env.KV.put(rateLimitKey, String(count + 1), { expirationTtl: rateLimitWindow });
      } catch (kvErr) {
        // KV 错误不影响主流程，仅限流保护
        console.error('Rate limit KV error:', kvErr);
      }
    }

    // 如果有 conversation_id，先获取历史消息
    let messages = [];
    if (conversation_id) {
      const history = await env.DB.prepare(
        'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
      ).bind(conversation_id).all();

      messages = history.results.map(m => ({
        role: m.role,
        content: m.content
      }));
    }

    // ============ 分层 Prompt 构建 ============
    // Step 2: 获取数据上下文（优先根据 ID 获取）
    let dataContext = '';
    if (effectiveUserType === 'engineer' && engineer_id) {
      dataContext = await generateEngineerContext(engineer_id, env);
    } else if (effectiveUserType === 'customer' && customer_id) {
      dataContext = await generateCustomerContext(customer_id, env);
    }

    // Step 3: 获取对应 Role Prompt
    // 如果数据上下文为空（ID无效或DB错误），降级为 guest Role Prompt
    // 避免 Role Prompt 说"你有 X 个待接单"但 AI 不知道数据
    let rolePrompt;
    if (dataContext) {
      rolePrompt = ROLE_PROMPTS[effectiveUserType] || ROLE_PROMPTS.guest;
    } else {
      rolePrompt = ROLE_PROMPTS.guest;
    }

    // Step 4: 拼接完整 System Prompt
    // 顺序：Base → Role → Context
    const fullSystemPrompt = SYSTEM_PROMPT + rolePrompt + dataContext;

    // 构建请求到 API
    const allMessages = [
      { role: 'system', content: fullSystemPrompt },
      ...messages,
      { role: 'user', content: message }
    ];

    const apiResponse = await fetch(env.OPENAI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: allMessages,
        tools: TOOLS_SCHEMAS,
        tool_choice: 'auto',
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return jsonResponse({ error: errorText }, apiResponse.status);
    }

    // 创建新对话
    let convId = conversation_id;
    if (!convId) {
      convId = generateId();
      await env.DB.prepare(
        'INSERT INTO conversations (id, title, last_message) VALUES (?, ?, ?)'
      ).bind(convId, truncateStr(message, 20), truncateStr(message, 50)).run();
    } else {
      await env.DB.prepare(
        'UPDATE conversations SET last_message = ?, updated_at = datetime("now") WHERE id = ?'
      ).bind(truncateStr(message, 50), convId).run();
    }

    // 保存用户消息
    const userMsgId = generateId();
    await env.DB.prepare(
      'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)'
    ).bind(userMsgId, convId, 'user', message).run();

    // 流式返回响应
    const encoder = new TextEncoder();
    let fullContent = '';

    const stream = new ReadableStream({
      async start(controller) {
        const reader = apiResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let toolCalls = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === 'data: [DONE]') {
                if (trimmed === 'data: [DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n'));
                }
                continue;
              }

              if (trimmed.startsWith('data: ')) {
                const dataStr = trimmed.slice(6);
                try {
                  const data = JSON.parse(dataStr);

                  // 检测工具调用
                  if (data.choices && data.choices[0].delta && data.choices[0].delta.tool_calls) {
                    toolCalls = data.choices[0].delta.tool_calls;
                  }

                  if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                    const content = data.choices[0].delta.content;
                    fullContent += content;
                    const responseData = JSON.stringify({
                      content,
                      conversation_id: convId
                    });
                    controller.enqueue(encoder.encode(`data: ${responseData}\n`));
                  }
                } catch (e) {
                  // 忽略解析错误
                }
              }
            }
          }
        } catch (e) {
          // 处理错误
        } finally {
          // 处理工具调用
          if (toolCalls && toolCalls.length > 0) {
            const toolCall = toolCalls[0];
            const toolName = toolCall.function?.name;
            const toolArgs = toolCall.function?.arguments
              ? JSON.parse(toolCall.function.arguments)
              : {};

            // 执行工具
            const toolResult = await executeTool(toolName, toolArgs, env, engineer_id, customer_id);

            // 将工具结果作为消息注入
            const toolResultMessage = {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult)
            };

            // 构建第二轮请求（不带 tools 参数，避免重复调用）
            const secondMessages = [
              ...allMessages,
              { role: 'assistant', content: fullContent },
              toolResultMessage
            ];

            const secondResponse = await fetch(env.OPENAI_API_ENDPOINT, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: secondMessages,
                stream: true,
                temperature: 0.7,
              }),
            });

            // 流式返回第二轮结果
            const secondReader = secondResponse.body.getReader();
            let secondBuffer = '';
            let finalContent = fullContent; // 保留第一轮内容

            try {
              while (true) {
                const { done, value } = await secondReader.read();
                if (done) break;

                secondBuffer += decoder.decode(value, { stream: true });
                const secondLines = secondBuffer.split('\n');
                secondBuffer = secondLines.pop() || '';

                for (const line of secondLines) {
                  const trimmed = line.trim();
                  if (!trimmed || trimmed === 'data: [DONE]') {
                    if (trimmed === 'data: [DONE]') {
                      controller.enqueue(encoder.encode('data: [DONE]\n'));
                    }
                    continue;
                  }

                  if (trimmed.startsWith('data: ')) {
                    const dataStr = trimmed.slice(6);
                    try {
                      const data = JSON.parse(dataStr);
                      if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                        const content = data.choices[0].delta.content;
                        finalContent += content;
                        const responseData = JSON.stringify({
                          content,
                          conversation_id: convId
                        });
                        controller.enqueue(encoder.encode(`data: ${responseData}\n`));
                      }
                    } catch (e) {
                      // 忽略
                    }
                  }
                }
              }
              fullContent = finalContent;
            } catch (e) {
              // 处理错误
            }
          }

          // 保存 AI 响应到数据库
          if (fullContent) {
            try {
              await env.DB.prepare(
                'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)'
              ).bind(generateId(), convId, 'assistant', fullContent).run();
            } catch (e) {
              // 忽略保存错误
            }
          }
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', ...corsHeaders },
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

// 获取对话列表
async function handleGetConversations(request, env) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50'
    ).all();

    return jsonResponse({ conversations: results });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 获取对话详情
async function handleGetConversation(request, env) {
  const id = new URL(request.url).pathname.split('/').pop();

  try {
    const conv = await env.DB.prepare(
      'SELECT * FROM conversations WHERE id = ?'
    ).bind(id).first();

    if (!conv) {
      return errorResponse('Not found', 404);
    }

    const messages = await env.DB.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).bind(id).all();

    return jsonResponse({ ...conv, messages: messages.results });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 删除对话
async function handleDeleteConversation(request, env) {
  const id = new URL(request.url).pathname.split('/').pop();

  try {
    await env.DB.prepare('DELETE FROM messages WHERE conversation_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM conversations WHERE id = ?').bind(id).run();

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 工单相关 ============

// 工单类型标签映射
const WORK_ORDER_TYPE_LABELS = {
  fault: '设备故障',
  maintenance: '维护保养',
  parameter: '参数调试',
  consult: '技术咨询',
  parts: '配件采购',
  aftersales: '售后服务',
  other: '其他'
};

// 生成工单 AI 摘要
async function generateWorkOrderSummary(type, description, urgency, env) {
  const typeLabel = WORK_ORDER_TYPE_LABELS[type] || type;

  const prompt = `你是工单分析助手。当客户提交一个维修工单时，你需要生成一个简洁的摘要，帮助工程师快速了解工单情况。

工单信息：
- 类型：${typeLabel}
- 描述：${description}
- 紧急程度：${urgency === 'critical' ? '非常紧急' : urgency === 'urgent' ? '紧急' : '普通'}

请生成以下格式的 JSON 响应（只返回 JSON，不要有其他内容）：
{
  "summary": "用2-3句话概括这个工单的核心问题和建议的处理方向",
  "required_specialties": ["需要的最匹配的设备类型标签，如激光切割机、折弯机等"],
  "suggested_skills": ["建议的技术能力标签，如激光器维修、参数调试等"],
  "urgency_notes": "如果紧急，说明为什么紧急和需要注意的事项"
}

只返回 JSON，不要有其他内容。`;

  try {
    const apiResponse = await fetch(env.OPENAI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: prompt }
        ],
        stream: false,
        temperature: 0.3,
      }),
    });

    if (!apiResponse.ok) {
      console.error('AI summary API error:', await apiResponse.text());
      return null;
    }

    const data = await apiResponse.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) return null;

    // 尝试解析 JSON
    try {
      // 去除可能的 markdown 代码块
      const jsonStr = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      return JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI summary JSON:', parseError, content);
      return null;
    }
  } catch (error) {
    console.error('generateWorkOrderSummary error:', error);
    return null;
  }
}

// 创建工单
async function handleCreateWorkOrder(request, env) {
  try {
    const { customer_id, type, description, urgency, device_id } = await request.json();

    if (!customer_id || !type || !description) {
      return errorResponse('缺少必填字段');
    }

    const id = generateId();
    const order_no = generateOrderNo();

    await env.DB.prepare(`
      INSERT INTO work_orders (id, order_no, customer_id, type, description, urgency, device_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(id, order_no, customer_id, type, description, urgency || 'normal', device_id || null).run();

    // 生成 AI 摘要（异步，不阻塞工单创建）
    const aiSummary = await generateWorkOrderSummary(type, description, urgency, env);
    if (aiSummary) {
      await env.DB.prepare(`
        UPDATE work_orders SET ai_summary = ? WHERE id = ?
      `).bind(JSON.stringify(aiSummary), id).run();
    }

    // 记录日志
    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(generateId(), id, 'created', 'customer', customer_id, '创建工单').run();

    // 获取完整工单数据用于匹配
    const workOrderData = {
      id,
      order_no,
      type,
      description,
      urgency,
      ai_summary: aiSummary
    };

    // 查找匹配的工程师并发送推送通知
    const matchingEngineers = await findMatchingEngineers(workOrderData, env);

    // 过滤出有 playerId 的工程师（只有订阅了推送的才发）
    const engineersWithPush = matchingEngineers.filter(e => e.onesignal_player_id);

    const typeLabels = {
      fault: '设备故障',
      maintenance: '维护保养',
      parameter: '参数调试',
      consult: '技术咨询',
      parts: '配件采购',
      aftersales: '售后服务',
      other: '其他'
    };
    const urgencyLabels = { normal: '普通', urgent: '紧急', critical: '非常紧急' };

    for (const engineer of matchingEngineers) {
      console.log('[Push] Engineer loop:', engineer.id, engineer.name, 'playerId:', engineer.onesignal_player_id, 'type:', typeof engineer.onesignal_player_id);
      if (engineer.onesignal_player_id) {
        const pushTitle = '📋 New Work Order!';
        const pushTitleZh = '📋 您有新工单等待接单！';
        const pushMessage = `Order: ${order_no} | Type: ${typeLabels[type] || type} | Urgency: ${urgencyLabels[urgency] || urgency}`;
        const pushMessageZh = `工单号：${order_no} | 类型：${typeLabels[type] || type} | 紧急程度：${urgencyLabels[urgency] || urgency}`;
        await sendPushToEngineer(engineer.id, env, {
          title: pushTitle,
          titleZh: pushTitleZh,
          message: pushMessage,
          messageZh: pushMessageZh,
          data: { work_order_id: id, type: 'new_ticket' }
        });
      }
    }

    // 创建通知 — 通知匹配到的合伙人
    for (const engineer of matchingEngineers) {
      await createNotification(env, {
        user_id: engineer.id,
        user_type: 'engineer',
        type: 'new_ticket',
        title: '新工单待接单',
        body: `工单号：${order_no} | 类型：${typeLabels[type] || type} | 紧急程度：${urgencyLabels[urgency] || urgency}`,
        data: { work_order_id: id, order_no },
      });
    }

    return jsonResponse({
      success: true,
      work_order: { id, order_no, status: 'pending', ai_summary: aiSummary }
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 查找匹配的工程师
async function findMatchingEngineers(workOrder, env) {
  try {
    // 解析 AI 摘要
    let aiSummary = null;
    if (workOrder.ai_summary) {
      try {
        aiSummary = typeof workOrder.ai_summary === 'string'
          ? JSON.parse(workOrder.ai_summary)
          : workOrder.ai_summary;
      } catch (e) {
        console.error('Failed to parse ai_summary:', e);
      }
    }

    // 获取工作订单类型对应的设备类型
    const typeToSpecialty = {
      fault: '设备故障',
      maintenance: '维护保养',
      parameter: '参数调试',
      consult: '技术咨询',
      parts: '配件采购',
      aftersales: '售后服务',
      other: '其他'
    };

    // 需要匹配的设备类型
    const requiredSpecialties = new Set();
    const workOrderSpecialty = typeToSpecialty[workOrder.type];
    if (workOrderSpecialty) {
      requiredSpecialties.add(workOrderSpecialty);
    }
    if (aiSummary?.required_specialties) {
      aiSummary.required_specialties.forEach(s => requiredSpecialties.add(s));
    }

    // 需要匹配的技能
    const requiredSkills = new Set();
    if (aiSummary?.suggested_skills) {
      aiSummary.suggested_skills.forEach(s => requiredSkills.add(s));
    }

    // 查询所有可用的工程师
    const engineers = await env.DB.prepare(
      'SELECT * FROM engineers WHERE status = ?'
    ).bind('available').all();

    if (!engineers.results || engineers.results.length === 0) {
      return [];
    }

    // 计算每个工程师的匹配分数
    const scoredEngineers = engineers.results.map(engineer => {
      let specialtyScore = 0;
      let skillScore = 0;
      let brandBonus = 0;

      // 解析工程师的专长和技能
      let engineerSpecialties = [];
      let engineerServices = [];
      let engineerBrands = {};

      try {
        engineerSpecialties = typeof engineer.specialties === 'string'
          ? JSON.parse(engineer.specialties)
          : (engineer.specialties || []);
        engineerServices = typeof engineer.services === 'string'
          ? JSON.parse(engineer.services)
          : (engineer.services || []);
        engineerBrands = typeof engineer.brands === 'string'
          ? JSON.parse(engineer.brands)
          : (engineer.brands || {});
      } catch (e) {
        console.error('Failed to parse engineer data:', e);
      }

      // 计算设备类型匹配分数
      requiredSpecialties.forEach(rs => {
        if (engineerSpecialties.some(s => s.includes(rs) || rs.includes(s))) {
          specialtyScore += 10;
        }
      });

      // 计算技能匹配分数
      requiredSkills.forEach(rs => {
        if (engineerServices.some(s => s.includes(rs) || rs.includes(s))) {
          skillScore += 5;
        }
      });

      // 检查品牌熟悉度（从 AI 摘要中提取品牌信息）
      if (aiSummary?.suggested_brands) {
        aiSummary.suggested_brands.forEach(brand => {
          Object.values(engineerBrands).forEach(brandList => {
            if (Array.isArray(brandList) && brandList.some(b => b.includes(brand) || brand.includes(b))) {
              brandBonus += 3;
            }
          });
        });
      }

      // 计算综合评分
      const avgRating = (
        (engineer.rating_timeliness || 0) +
        (engineer.rating_technical || 0) +
        (engineer.rating_communication || 0) +
        (engineer.rating_professional || 0)
      ) / 4;

      const totalScore = specialtyScore + skillScore + brandBonus + (avgRating * 2);

      return {
        id: engineer.id,
        name: engineer.name,
        phone: engineer.phone,
        specialties: engineerSpecialties,
        services: engineerServices,
        brands: engineerBrands,
        service_region: engineer.service_region,
        bio: engineer.bio,
        rating_timeliness: engineer.rating_timeliness,
        rating_technical: engineer.rating_technical,
        rating_communication: engineer.rating_communication,
        rating_professional: engineer.rating_professional,
        rating_count: engineer.rating_count,
        onesignal_player_id: engineer.onesignal_player_id,
        specialtyScore,
        skillScore,
        brandBonus,
        totalScore
      };
    });

    // 按分数排序，返回前20名（扩大范围让有playerId的工程师更可能被包含）
    scoredEngineers.sort((a, b) => b.totalScore - a.totalScore);

    return scoredEngineers.slice(0, 20);
  } catch (error) {
    console.error('findMatchingEngineers error:', error);
    return [];
  }
}

// 推荐工程师接口
async function handleRecommendEngineers(request, env) {
  try {
    const workOrderId = new URL(request.url).searchParams.get('work_order_id');

    if (!workOrderId) {
      return errorResponse('缺少工单ID');
    }

    // 获取工单
    const workOrder = await env.DB.prepare(
      'SELECT * FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();

    if (!workOrder) {
      return errorResponse('工单不存在', 404);
    }

    // 查找匹配的工程师
    const engineers = await findMatchingEngineers(workOrder, env);

    return jsonResponse({ engineers });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 设备管理 API ============

// 获取客户的所有设备（含工单统计）
async function handleGetDevices(request, env) {
  const customerId = request._auth?.userId;
  if (!customerId) {
    return errorResponse('未登录', 401);
  }

  try {
    // 获取客户的所有设备
    const devices = await env.DB.prepare(`
      SELECT d.*,
             COUNT(w.id) as total_orders,
             SUM(CASE WHEN w.status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
             MAX(w.created_at) as last_order_date
      FROM devices d
      LEFT JOIN work_orders w ON w.device_id = d.id
      WHERE d.customer_id = ?
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `).bind(customerId).all();

    return jsonResponse({ devices: devices.results || [] });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 获取单个设备详情（含维修记录）
async function handleGetDevice(request, env) {
  const customerId = request._auth?.userId;
  if (!customerId) {
    return errorResponse('未登录', 401);
  }

  const id = new URL(request.url).pathname.split('/').pop();

  try {
    // 获取设备信息
    const device = await env.DB.prepare(
      'SELECT * FROM devices WHERE id = ? AND customer_id = ?'
    ).bind(id, customerId).first();

    if (!device) {
      return errorResponse('设备不存在', 404);
    }

    // 获取关联的工单（维修记录）
    const workOrders = await env.DB.prepare(`
      SELECT w.id, w.order_no, w.type, w.description, w.urgency, w.status,
             w.created_at, w.completed_at,
             e.name as engineer_name,
             r.rating_timeliness, r.rating_technical, r.rating_communication, r.rating_professional
      FROM work_orders w
      LEFT JOIN engineers e ON w.engineer_id = e.id
      LEFT JOIN ratings r ON r.work_order_id = w.id
      WHERE w.device_id = ?
      ORDER BY w.created_at DESC
      LIMIT 20
    `).bind(id).all();

    // 计算费用明细（从工单消息中提取，需要单独查询 pricing）
    const workOrdersWithCost = await Promise.all((workOrders.results || []).map(async (wo) => {
      let costSummary = null;
      try {
        const pricing = await env.DB.prepare(
          'SELECT labor_fee, parts_fee, travel_fee FROM work_order_pricing WHERE work_order_id = ?'
        ).bind(wo.id).first();
        if (pricing) {
          costSummary = {
            labor: pricing.labor_fee || 0,
            parts: pricing.parts_fee || 0,
            travel: pricing.travel_fee || 0
          };
        }
      } catch (e) {}

      const avgRating = (wo.rating_timeliness + wo.rating_technical +
                         wo.rating_communication + wo.rating_professional) / 4;

      return {
        id: wo.id,
        order_no: wo.order_no,
        type: wo.type,
        description: wo.description,
        urgency: wo.urgency,
        status: wo.status,
        engineer_name: wo.engineer_name || '未知',
        rating: avgRating > 0 ? avgRating.toFixed(1) : null,
        cost_summary: costSummary,
        created_at: wo.created_at,
        completed_at: wo.completed_at
      };
    }));

    return jsonResponse({
      device,
      work_orders: workOrdersWithCost
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 添加新设备
async function handleCreateDevice(request, env) {
  const customerId = request._auth?.userId;
  if (!customerId) {
    return errorResponse('未登录', 401);
  }

  try {
    const body = await request.json();
    const { name, type, brand, model, power } = body;

    if (!type) {
      return errorResponse('设备类型不能为空', 400);
    }

    const id = generateId();
    await env.DB.prepare(`
      INSERT INTO devices (id, customer_id, name, type, brand, model, power, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'normal', datetime('now'))
    `).bind(id, customerId, name || '', type, brand || '', model || '', power || '').run();

    const device = await env.DB.prepare('SELECT * FROM devices WHERE id = ?').bind(id).first();

    return jsonResponse({ device }, 201);
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 更新设备
async function handleUpdateDevice(request, env) {
  const customerId = request._auth?.userId;
  if (!customerId) {
    return errorResponse('未登录', 401);
  }

  const id = new URL(request.url).pathname.split('/').pop();

  try {
    // 验证设备归属
    const device = await env.DB.prepare(
      'SELECT * FROM devices WHERE id = ? AND customer_id = ?'
    ).bind(id, customerId).first();

    if (!device) {
      return errorResponse('设备不存在', 404);
    }

    const body = await request.json();
    const { name, type, brand, model, power, status, photo_url, notes } = body;

    await env.DB.prepare(`
      UPDATE devices
      SET name = ?, type = ?, brand = ?, model = ?, power = ?, status = ?, photo_url = ?, notes = ?
      WHERE id = ?
    `).bind(
      name ?? device.name,
      type ?? device.type,
      brand ?? device.brand,
      model ?? device.model,
      power ?? device.power,
      status ?? device.status,
      photo_url ?? device.photo_url,
      notes ?? device.notes,
      id
    ).run();

    const updated = await env.DB.prepare('SELECT * FROM devices WHERE id = ?').bind(id).first();

    return jsonResponse({ device: updated });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 删除设备
async function handleDeleteDevice(request, env) {
  const customerId = request._auth?.userId;
  if (!customerId) {
    return errorResponse('未登录', 401);
  }

  const id = new URL(request.url).pathname.split('/').pop();

  try {
    // 验证设备归属
    const device = await env.DB.prepare(
      'SELECT * FROM devices WHERE id = ? AND customer_id = ?'
    ).bind(id, customerId).first();

    if (!device) {
      return errorResponse('设备不存在', 404);
    }

    // 删除设备（工单关联的外键设为 NULL，而非 cascade delete）
    await env.DB.prepare('UPDATE work_orders SET device_id = NULL WHERE device_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(id).run();

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 获取客户的工单列表
async function handleGetWorkOrders(request, env) {
  // 优先使用认证信息中的 userId，其次使用查询参数
  const customerId = request._auth?.userId || new URL(request.url).searchParams.get('customer_id');

  try {
    let query = `
      SELECT
        w.*,
        e.name as engineer_name,
        e.phone as engineer_phone,
        e.rating_technical as engineer_rating,
        e.level as engineer_level,
        e.commission_rate as engineer_commission_rate,
        e.credit_score as engineer_credit_score
      FROM work_orders w
      LEFT JOIN engineers e ON w.engineer_id = e.id
    `;
    let params = [];

    if (customerId) {
      query += ' WHERE w.customer_id = ?';
      params = [customerId];
    }

    query += ' ORDER BY w.created_at DESC LIMIT 50';

    const { results } = await env.DB.prepare(query).bind(...params).all();

    return jsonResponse({ work_orders: results });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 获取工单详情
async function handleGetWorkOrder(request, env) {
  const id = new URL(request.url).pathname.split('/').pop();

  try {
    const workOrder = await env.DB.prepare(`
      SELECT
        w.*,
        e.name as engineer_name,
        e.phone as engineer_phone,
        e.level as engineer_level,
        e.commission_rate as engineer_commission_rate,
        e.credit_score as engineer_credit_score,
        c.name as customer_name,
        c.phone as customer_phone
      FROM work_orders w
      LEFT JOIN engineers e ON w.engineer_id = e.id
      LEFT JOIN customers c ON w.customer_id = c.id
      WHERE w.id = ?
    `).bind(id).first();

    if (!workOrder) {
      return errorResponse('工单不存在', 404);
    }

    const logs = await env.DB.prepare(
      'SELECT * FROM work_order_logs WHERE work_order_id = ? ORDER BY created_at ASC'
    ).bind(id).all();

    // 查询评价数据
    const rating = await env.DB.prepare(
      'SELECT * FROM ratings WHERE work_order_id = ?'
    ).bind(id).first();

    let adminReply = null;
    if (rating) {
      adminReply = await env.DB.prepare(
        'SELECT * FROM admin_replies WHERE rating_id = ?'
      ).bind(rating.id).first();
    }

    return jsonResponse({ ...workOrder, logs: logs.results, rating: rating || null, admin_reply: adminReply || null });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 提交评价
async function handleSubmitRating(request, env) {
  try {
    const { work_order_id, engineer_id, customer_id, rating_timeliness, rating_technical, rating_communication, rating_professional, comment } = await request.json();

    if (!work_order_id || !engineer_id || !customer_id) {
      return errorResponse('缺少必填字段');
    }

    // 检查是否已评价
    const existing = await env.DB.prepare(
      'SELECT id FROM ratings WHERE work_order_id = ?'
    ).bind(work_order_id).first();

    if (existing) {
      return errorResponse('该工单已评价');
    }

    // 创建评价
    const id = generateId();
    await env.DB.prepare(`
      INSERT INTO ratings (id, work_order_id, engineer_id, customer_id, rating_timeliness, rating_technical, rating_communication, rating_professional, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, work_order_id, engineer_id, customer_id, rating_timeliness, rating_technical, rating_communication, rating_professional, comment || '').run();

    // 更新工程师评分
    const ratings = await env.DB.prepare(
      'SELECT * FROM ratings WHERE engineer_id = ?'
    ).bind(engineer_id).all();

    const count = ratings.results.length;
    const avgTimeliness = ratings.results.reduce((sum, r) => sum + r.rating_timeliness, 0) / count;
    const avgTechnical = ratings.results.reduce((sum, r) => sum + r.rating_technical, 0) / count;
    const avgCommunication = ratings.results.reduce((sum, r) => sum + r.rating_communication, 0) / count;
    const avgProfessional = ratings.results.reduce((sum, r) => sum + r.rating_professional, 0) / count;

    await env.DB.prepare(`
      UPDATE engineers SET rating_timeliness = ?, rating_technical = ?, rating_communication = ?, rating_professional = ?, rating_count = ?
      WHERE id = ?
    `).bind(avgTimeliness, avgTechnical, avgCommunication, avgProfessional, count, engineer_id).run();

    // 更新工单状态
    await env.DB.prepare(
      'UPDATE work_orders SET status = ?, completed_at = datetime("now") WHERE id = ?'
    ).bind('completed', work_order_id).run();

    // 通知合伙人：收到新评价
    const avgAll = ((rating_timeliness + rating_technical + rating_communication + rating_professional) / 4).toFixed(1);
    const woRating = await env.DB.prepare('SELECT order_no FROM work_orders WHERE id = ?').bind(work_order_id).first();
    await createNotification(env, {
      user_id: engineer_id,
      user_type: 'engineer',
      type: 'rating_received',
      title: '收到新评价',
      body: `工单 ${woRating?.order_no || ''} 的客户给您评分 ${avgAll} 分${comment ? '："' + comment.slice(0, 30) + '"' : ''}`,
      data: { work_order_id },
    });

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 工程师相关 ============

// 获取待接工单（工程师）
async function handleGetEngineerTickets(request, env) {
  const engineerId = request._auth?.userId || new URL(request.url).searchParams.get('engineer_id');

  try {
    // 返回推荐工单(pending) + 本工程师的所有工单
    let query = `
      SELECT
        w.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.region as customer_region
      FROM work_orders w
      LEFT JOIN customers c ON w.customer_id = c.id
      WHERE (w.status IN ('pending', 'assigned')`;

    let params = [];

    if (engineerId) {
      // pending 工单需排除已拒绝的
      const engineer = await env.DB.prepare('SELECT rejected_engineers FROM engineers WHERE id = ?').bind(engineerId).first();
      let rejected = [];
      if (engineer?.rejected_engineers) {
        try { rejected = JSON.parse(engineer.rejected_engineers); } catch (e) { rejected = []; }
      }

      if (rejected.length > 0) {
        query += ` AND w.id NOT IN (${rejected.map(() => '?').join(',')})`;
        params.push(...rejected);
      }

      // 同时返回分配给该工程师的所有工单（不限状态）
      query += `) OR w.engineer_id = ?`;
      params.push(engineerId);
    } else {
      query += `)`;
    }

    query += ' ORDER BY w.created_at DESC LIMIT 100';

    const { results } = await env.DB.prepare(query).bind(...params).all();

    return jsonResponse({ work_orders: results });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 工程师接单
async function handleAcceptTicket(request, env) {
  try {
    const { work_order_id, engineer_id } = await request.json();

    if (!work_order_id || !engineer_id) {
      return errorResponse('缺少必填字段');
    }

    await env.DB.prepare(`
      UPDATE work_orders SET status = 'in_progress', engineer_id = ?, assigned_at = datetime("now")
      WHERE id = ?
    `).bind(engineer_id, work_order_id).run();

    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(generateId(), work_order_id, 'accepted', 'engineer', engineer_id, '工程师已接单').run();

    // 通知客户：合伙人已接单
    const wo = await env.DB.prepare('SELECT customer_id, order_no FROM work_orders WHERE id = ?').bind(work_order_id).first();
    const eng = await env.DB.prepare('SELECT name FROM engineers WHERE id = ?').bind(engineer_id).first();
    if (wo?.customer_id) {
      await createNotification(env, {
        user_id: wo.customer_id,
        user_type: 'customer',
        type: 'ticket_accepted',
        title: '工单已被接单',
        body: `工单 ${wo.order_no} 已被合伙人${eng?.name || ''}接单，即将为您服务。`,
        data: { work_order_id },
      });
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 工程师拒单
async function handleRejectTicket(request, env) {
  try {
    const { work_order_id, engineer_id } = await request.json();

    if (!work_order_id || !engineer_id) {
      return errorResponse('缺少必填字段');
    }

    // 获取工程师已拒绝的工单列表
    const engineer = await env.DB.prepare('SELECT rejected_engineers FROM engineers WHERE id = ?').bind(engineer_id).first();
    let rejected = [];
    if (engineer?.rejected_engineers) {
      try { rejected = JSON.parse(engineer.rejected_engineers); } catch (e) { rejected = []; }
    }
    rejected.push(work_order_id);

    await env.DB.prepare(
      'UPDATE engineers SET rejected_engineers = ? WHERE id = ?'
    ).bind(JSON.stringify(rejected), engineer_id).run();

    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(generateId(), work_order_id, 'rejected', 'engineer', engineer_id, '工程师已拒单').run();

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 更新工程师接单状态
async function handleUpdateEngineerStatus(request, env) {
  try {
    const { engineer_id, status } = await request.json();

    if (!engineer_id || !status) {
      return errorResponse('缺少必填字段');
    }

    await env.DB.prepare(
      'UPDATE engineers SET status = ? WHERE id = ?'
    ).bind(status, engineer_id).run();

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 获取工程师档案
async function handleGetEngineerProfile(request, env) {
  try {
    const engineerId = request._auth?.userId || new URL(request.url).searchParams.get('engineer_id');

    if (!engineerId) {
      return errorResponse('缺少工程师ID');
    }

    const engineer = await env.DB.prepare(
      'SELECT id, name, phone, specialties, brands, services, service_region, bio, status, rating_timeliness, rating_technical, rating_communication, rating_professional, rating_count, created_at, level, commission_rate, credit_score, wallet_balance, deposit_balance, total_orders, complex_orders, success_orders FROM engineers WHERE id = ?'
    ).bind(engineerId).first();

    if (!engineer) {
      return errorResponse('工程师不存在', 404);
    }

    // 解析 JSON 字段
    const profile = {
      ...engineer,
      specialties: typeof engineer.specialties === 'string' ? JSON.parse(engineer.specialties) : (engineer.specialties || []),
      brands: typeof engineer.brands === 'string' ? JSON.parse(engineer.brands) : (engineer.brands || {}),
      services: typeof engineer.services === 'string' ? JSON.parse(engineer.services) : (engineer.services || []),
    };

    return jsonResponse({ engineer: profile });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 客户档案更新 ============

async function handleUpdateCustomerProfile(request, env) {
  try {
    const customerId = request._auth?.userId;
    if (!customerId) return errorResponse('未登录', 401);

    const body = await request.json();
    const { name, region, company, address, city, phone, company_description, business_scope, logo_url } = body;

    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (region !== undefined) { updates.push('region = ?'); values.push(region); }
    if (company !== undefined) { updates.push('company = ?'); values.push(company); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address); }
    if (city !== undefined) { updates.push('city = ?'); values.push(city); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (company_description !== undefined) { updates.push('company_description = ?'); values.push(company_description); }
    if (business_scope !== undefined) { updates.push('business_scope = ?'); values.push(business_scope); }
    if (logo_url !== undefined) { updates.push('logo_url = ?'); values.push(logo_url); }

    if (updates.length === 0) return errorResponse('没有要更新的字段');

    values.push(customerId);
    await env.DB.prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

    const updated = await env.DB.prepare('SELECT id, user_no, name, phone, region, company, address, city, company_description, business_scope, logo_url, auth_status, created_at FROM customers WHERE id = ?').bind(customerId).first();
    return jsonResponse({ customer: updated });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 合伙人档案更新 ============

async function handleUpdateEngineerProfile(request, env) {
  try {
    const engineerId = request._auth?.userId;
    if (!engineerId) return errorResponse('未登录', 401);

    const body = await request.json();
    const { name, bio, service_region } = body;

    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (bio !== undefined) { updates.push('bio = ?'); values.push(bio); }
    if (service_region !== undefined) { updates.push('service_region = ?'); values.push(service_region); }

    if (updates.length === 0) return errorResponse('没有要更新的字段');

    values.push(engineerId);
    await env.DB.prepare(`UPDATE engineers SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

    const updated = await env.DB.prepare(
      'SELECT id, user_no, name, phone, specialties, brands, services, service_region, bio, status, level, commission_rate, credit_score, rating_timeliness, rating_technical, rating_communication, rating_professional, rating_count FROM engineers WHERE id = ?'
    ).bind(engineerId).first();

    if (!updated) return errorResponse('工程师不存在', 404);

    const profile = {
      ...updated,
      specialties: typeof updated.specialties === 'string' ? JSON.parse(updated.specialties) : (updated.specialties || []),
      brands: typeof updated.brands === 'string' ? JSON.parse(updated.brands) : (updated.brands || {}),
      services: typeof updated.services === 'string' ? JSON.parse(updated.services) : (updated.services || []),
    };
    return jsonResponse({ engineer: profile });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 修改密码 ============

async function handleChangePassword(request, env) {
  try {
    const auth = request._auth;
    if (!auth) return errorResponse('未登录', 401);

    const body = await request.json();
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) return errorResponse('旧密码和新密码不能为空');
    if (newPassword.length < 6) return errorResponse('新密码至少6位');

    const table = auth.userType === 'engineer' ? 'engineers' : 'customers';
    const user = await env.DB.prepare(`SELECT id, password_hash, salt FROM ${table} WHERE id = ?`).bind(auth.userId).first();
    if (!user) return errorResponse('用户不存在', 404);

    const ok = await verifyPassword(oldPassword, user.password_hash, user.salt);
    if (!ok) return errorResponse('旧密码错误');

    const newSalt = generateSalt();
    const newHash = await hashPasswordNew(newPassword, newSalt);
    await env.DB.prepare(`UPDATE ${table} SET password_hash = ?, salt = ? WHERE id = ?`).bind(newHash, newSalt, auth.userId).run();

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 合伙人钱包与保证金 API ============

// 获取合伙人钱包信息（余额 + 摘要）
async function handleGetEngineerWallet(request, env) {
  try {
    const engineerId = request._auth?.userId || new URL(request.url).searchParams.get('engineer_id');
    if (!engineerId) return errorResponse('缺少合伙人ID');

    const engineer = await env.DB.prepare(
      'SELECT id, wallet_balance, deposit_balance, level, commission_rate, credit_score FROM engineers WHERE id = ?'
    ).bind(engineerId).first();

    if (!engineer) return errorResponse('合伙人不存在', 404);

    // 最近10条钱包流水
    const walletHistory = await env.DB.prepare(
      'SELECT * FROM engineer_wallets WHERE engineer_id = ? ORDER BY created_at DESC LIMIT 10'
    ).bind(engineerId).all();

    // 最近10条保证金流水
    const depositHistory = await env.DB.prepare(
      'SELECT * FROM engineer_deposits WHERE engineer_id = ? ORDER BY created_at DESC LIMIT 10'
    ).bind(engineerId).all();

    return jsonResponse({
      wallet_balance: engineer.wallet_balance || 0,
      deposit_balance: engineer.deposit_balance || 0,
      level: engineer.level || 'junior',
      commission_rate: engineer.commission_rate || 0.80,
      credit_score: engineer.credit_score || 100,
      wallet_history: walletHistory.results || [],
      deposit_history: depositHistory.results || [],
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 申请提现
async function handleWithdrawRequest(request, env) {
  try {
    const engineerId = request._auth?.userId;
    if (!engineerId) return errorResponse('未登录或登录已过期', 401);

    const { amount } = await request.json();
    if (!amount || amount <= 0) return errorResponse('请输入正确的提现金额');
    if (amount < 100) return errorResponse('提现金额不能低于100元');
    if (amount > 50000) return errorResponse('单次提现金额不能超过50000元');

    const engineer = await env.DB.prepare(
      'SELECT wallet_balance, bank_account, bank_name FROM engineers WHERE id = ?'
    ).bind(engineerId).first();

    if (!engineer) return errorResponse('合伙人不存在', 404);
    if (!engineer.bank_account || !engineer.bank_name) {
      return errorResponse('请先在档案中绑定银行卡信息');
    }
    if ((engineer.wallet_balance || 0) < amount) {
      return errorResponse('钱包余额不足');
    }

    // 检查是否有处理中的提现申请
    const pending = await env.DB.prepare(
      "SELECT id FROM engineer_withdrawals WHERE engineer_id = ? AND status = 'pending'"
    ).bind(engineerId).first();
    if (pending) return errorResponse('您有待处理的提现申请，请等待处理完成后再申请');

    const id = generateId();
    await env.DB.prepare(`
      INSERT INTO engineer_withdrawals (id, engineer_id, amount, status)
      VALUES (?, ?, ?, 'pending')
    `).bind(id, engineerId, amount).run();

    return jsonResponse({
      success: true,
      withdrawal_id: id,
      message: `提现申请已提交，预计 T+1 工作日到账至 ${engineer.bank_name}（${engineer.bank_account.slice(-4).padStart(engineer.bank_account.length, '*')}）`
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 推送订阅 API（OneSignal）============

// 保存推送订阅
async function handleSavePushSubscription(request, env) {
  try {
    const engineerId = request._auth?.userId;
    if (!engineerId) return errorResponse('未登录或登录已过期', 401);

    const { onesignal_player_id } = await request.json();
    if (!onesignal_player_id) return errorResponse('缺少 OneSignal Player ID');

    // 更新工程师的推送订阅
    // 注意：需要确保 engineers 表有 onesignal_player_id 字段
    // 如果没有，需要先执行迁移：
    // ALTER TABLE engineers ADD COLUMN onesignal_player_id TEXT;
    await env.DB.prepare(`
      UPDATE engineers SET onesignal_player_id = ? WHERE id = ?
    `).bind(onesignal_player_id, engineerId).run();

    return jsonResponse({ success: true, message: '推送订阅已保存' });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 发送推送通知给工程师（供内部调用）
async function sendPushToEngineer(engineerId, env, { title, titleZh, message, messageZh, data }) {
  try {
    const engineer = await env.DB.prepare(
      'SELECT onesignal_player_id FROM engineers WHERE id = ?'
    ).bind(engineerId).first();

    if (!engineer?.onesignal_player_id) {
      console.log(`Engineer ${engineerId} has no push subscription`);
      return false;
    }

    // 调用 OneSignal API 发送推送
    // ONESIGNAL_APP_ID 和 ONESIGNAL_REST_API_KEY 需要通过 wrangler secret 设置
    const appId = env.ONESIGNAL_APP_ID;
    const apiKey = env.ONESIGNAL_REST_API_KEY;

    if (!appId || !apiKey) {
      console.log('OneSignal credentials not configured');
      return false;
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_player_ids: [engineer.onesignal_player_id],
        headings: {
          en: title,
          zh: titleZh || title,
        },
        contents: {
          en: message,
          zh: messageZh || message,
        },
        data: data || {},
        android_group: 'sagemro',
      }),
    });

    if (!response.ok) {
      console.error('OneSignal API error:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Send push error:', error);
    return false;
  }
}

// ============ 管理后台 API ============

// 管理员创建用户
async function handleAdminCreateUser(request, env) {
  try {
    const body = await request.json();
    const { userType, name, phone, password, region } = body;

    if (!userType || !name || !phone || !password) {
      return errorResponse('用户类型、姓名、手机号、密码不能为空');
    }

    if (userType === 'customer') {
      // 检查手机号是否已注册
      const existing = await env.DB.prepare(
        'SELECT id FROM customers WHERE phone = ?'
      ).bind(phone).first();
      if (existing) {
        return errorResponse('该手机号已注册为客户');
      }

      const id = generateId();
      const userNo = await generateUserNo(env, 'U');
      const salt = generateSalt();
      const passwordHash = await hashPasswordNew(password, salt);

      await env.DB.prepare(
        'INSERT INTO customers (id, user_no, name, phone, password_hash, salt, region) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, userNo, name, phone, passwordHash, salt, region || null).run();

      return jsonResponse({ success: true, user: { id, user_no: userNo, name, phone, region } });
    } else if (userType === 'engineer') {
      const { specialties, brands, services, serviceRegion, bio } = body;

      if (!specialties || !specialties.length || !services || !services.length) {
        return errorResponse('工程师必须填写擅长设备类型和维修项目');
      }

      const existing = await env.DB.prepare(
        'SELECT id FROM engineers WHERE phone = ?'
      ).bind(phone).first();
      if (existing) {
        return errorResponse('该手机号已注册为工程师');
      }

      const id = generateId();
      const userNo = await generateUserNo(env, 'E');
      const salt = generateSalt();
      const passwordHash = await hashPasswordNew(password, salt);

      await env.DB.prepare(
        'INSERT INTO engineers (id, user_no, name, phone, password_hash, salt, specialties, brands, services, service_region, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        id, userNo, name, phone, passwordHash, salt,
        JSON.stringify(specialties),
        JSON.stringify(brands || {}),
        JSON.stringify(services),
        serviceRegion || null,
        bio || null
      ).run();

      return jsonResponse({ success: true, user: { id, user_no: userNo, name, phone, serviceRegion } });
    } else {
      return errorResponse('不支持的用户类型');
    }
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 管理员删除用户
async function handleAdminDeleteUser(request, env) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const userId = pathParts[pathParts.length - 1];
    const userType = url.searchParams.get('type');

    if (!userId || !userType) {
      return errorResponse('缺少用户ID或类型');
    }

    if (userType === 'customer') {
      // 检查用户是否存在
      const user = await env.DB.prepare('SELECT id FROM customers WHERE id = ?').bind(userId).first();
      if (!user) {
        return errorResponse('客户不存在', 404);
      }

      // 删除客户的工单相关数据
      const workOrders = await env.DB.prepare(
        'SELECT id FROM work_orders WHERE customer_id = ?'
      ).bind(userId).all();
      for (const wo of (workOrders.results || [])) {
        await env.DB.prepare('DELETE FROM ratings WHERE work_order_id = ?').bind(wo.id).run();
        await env.DB.prepare('DELETE FROM work_order_logs WHERE work_order_id = ?').bind(wo.id).run();
      }
      await env.DB.prepare('DELETE FROM work_orders WHERE customer_id = ?').bind(userId).run();

      // 删除设备
      await env.DB.prepare('DELETE FROM devices WHERE customer_id = ?').bind(userId).run();

      // 删除客户
      await env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(userId).run();

      return jsonResponse({ success: true });
    } else if (userType === 'engineer') {
      const user = await env.DB.prepare('SELECT id FROM engineers WHERE id = ?').bind(userId).first();
      if (!user) {
        return errorResponse('工程师不存在', 404);
      }

      // 删除工程师的工单相关数据
      const workOrders = await env.DB.prepare(
        'SELECT id FROM work_orders WHERE engineer_id = ?'
      ).bind(userId).all();
      for (const wo of (workOrders.results || [])) {
        await env.DB.prepare('DELETE FROM ratings WHERE work_order_id = ?').bind(wo.id).run();
        await env.DB.prepare('DELETE FROM work_order_logs WHERE work_order_id = ?').bind(wo.id).run();
      }
      await env.DB.prepare('DELETE FROM work_orders WHERE engineer_id = ?').bind(userId).run();

      // 删除评价
      await env.DB.prepare('DELETE FROM ratings WHERE engineer_id = ?').bind(userId).run();

      // 删除工程师
      await env.DB.prepare('DELETE FROM engineers WHERE id = ?').bind(userId).run();

      return jsonResponse({ success: true });
    } else {
      return errorResponse('不支持的用户类型');
    }
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 统计概览

// 管理员登录
async function handleAdminLogin(request, env) {
  try {
    const body = await request.json();
    const { phone, password } = body;

    const adminPassword = env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return errorResponse('管理员密码未配置，请联系管理员', 500);
    }
    if (phone !== ADMIN_PHONE || password !== adminPassword) {
      return errorResponse('手机号或密码错误', 401);
    }

    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt({
      userId: 'admin',
      userType: 'admin',
      phone: ADMIN_PHONE,
      iat: now,
      exp: now + 86400 * 7,
    }, env.JWT_SECRET);

    return jsonResponse({
      token,
      user: { id: 'admin', name: '超级管理员', phone: ADMIN_PHONE, type: 'admin' },
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 统计概览
async function handleAdminStats(request, env) {
  try {
    const customerCount = await env.DB.prepare('SELECT COUNT(*) as count FROM customers').first();
    const engineerCount = await env.DB.prepare('SELECT COUNT(*) as count FROM engineers').first();

    const woTotal = await env.DB.prepare('SELECT COUNT(*) as count FROM work_orders').first();
    const woPending = await env.DB.prepare("SELECT COUNT(*) as count FROM work_orders WHERE status = 'pending'").first();
    const woInProgress = await env.DB.prepare("SELECT COUNT(*) as count FROM work_orders WHERE status IN ('assigned', 'in_progress')").first();
    const woCompleted = await env.DB.prepare("SELECT COUNT(*) as count FROM work_orders WHERE status IN ('completed', 'resolved')").first();

    // 最近7天注册数
    const recentCustomers = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM customers WHERE created_at >= datetime('now', '-7 days')"
    ).first();
    const recentEngineers = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM engineers WHERE created_at >= datetime('now', '-7 days')"
    ).first();

    return jsonResponse({
      customers: customerCount?.count || 0,
      engineers: engineerCount?.count || 0,
      workOrders: {
        total: woTotal?.count || 0,
        pending: woPending?.count || 0,
        in_progress: woInProgress?.count || 0,
        completed: woCompleted?.count || 0,
      },
      recentRegistrations: (recentCustomers?.count || 0) + (recentEngineers?.count || 0),
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 用户列表
async function handleAdminUsers(request, env) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'customer';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
    const search = url.searchParams.get('search') || '';
    const offset = (page - 1) * pageSize;

    if (type === 'engineer') {
      const status = url.searchParams.get('status') || '';
      const region = url.searchParams.get('region') || '';
      const specialty = url.searchParams.get('specialty') || '';

      let where = 'WHERE 1=1';
      const params = [];

      if (search) {
        where += ' AND (name LIKE ? OR phone LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }
      if (status) {
        where += ' AND status = ?';
        params.push(status);
      }
      if (region) {
        where += ' AND service_region LIKE ?';
        params.push(`%${region}%`);
      }
      if (specialty) {
        where += ' AND specialties LIKE ?';
        params.push(`%${specialty}%`);
      }

      const total = await env.DB.prepare(`SELECT COUNT(*) as count FROM engineers ${where}`).bind(...params).first();
      const list = await env.DB.prepare(
        `SELECT id, user_no, name, phone, specialties, service_region, status, rating_count, rating_technical, created_at FROM engineers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params, pageSize, offset).all();

      return jsonResponse({
        total: total?.count || 0,
        list: (list.results || []).map(e => ({
          ...e,
          specialties: typeof e.specialties === 'string' ? JSON.parse(e.specialties) : (e.specialties || []),
        })),
      });
    } else {
      const region = url.searchParams.get('region') || '';

      let where = 'WHERE 1=1';
      const params = [];

      if (search) {
        where += ' AND (name LIKE ? OR phone LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }
      if (region) {
        where += ' AND region LIKE ?';
        params.push(`%${region}%`);
      }

      const total = await env.DB.prepare(`SELECT COUNT(*) as count FROM customers ${where}`).bind(...params).first();
      const list = await env.DB.prepare(
        `SELECT id, user_no, name, phone, region, created_at FROM customers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params, pageSize, offset).all();

      return jsonResponse({
        total: total?.count || 0,
        list: list.results || [],
      });
    }
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 工单列表
async function handleAdminWorkOrders(request, env) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
    const offset = (page - 1) * pageSize;

    let where = '';
    const params = [];
    if (status && status !== 'all') {
      where = 'WHERE w.status = ?';
      params.push(status);
    }

    const total = await env.DB.prepare(`SELECT COUNT(*) as count FROM work_orders w ${where}`).bind(...params).first();

    const list = await env.DB.prepare(`
      SELECT w.id, w.order_no, w.type, w.description, w.urgency, w.status, w.created_at,
             c.name as customer_name, c.user_no as customer_no,
             e.name as engineer_name, e.user_no as engineer_no
      FROM work_orders w
      LEFT JOIN customers c ON w.customer_id = c.id
      LEFT JOIN engineers e ON w.engineer_id = e.id
      ${where}
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, pageSize, offset).all();

    return jsonResponse({
      total: total?.count || 0,
      list: list.results || [],
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 评价管理 ============

// 工单评价列表（管理员）
async function handleAdminRatings(request, env) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
    const lowScore = url.searchParams.get('lowScore') === 'true';
    const sort = url.searchParams.get('sort') || 'created_at_desc';
    const offset = (page - 1) * pageSize;

    let where = 'WHERE 1=1';
    const params = [];

    if (lowScore) {
      where += ' AND ((r.rating_timeliness + r.rating_technical + r.rating_communication + r.rating_professional) / 4.0) < 3';
    }

    const orderBy = sort === 'score_asc'
      ? 'ORDER BY ((r.rating_timeliness + r.rating_technical + r.rating_communication + r.rating_professional) / 4.0) ASC'
      : sort === 'score_desc'
        ? 'ORDER BY ((r.rating_timeliness + r.rating_technical + r.rating_communication + r.rating_professional) / 4.0) DESC'
        : 'ORDER BY r.created_at DESC';

    const total = await env.DB.prepare(`SELECT COUNT(*) as count FROM ratings r ${where}`).bind(...params).first();
    const list = await env.DB.prepare(`
      SELECT r.id, r.work_order_id, r.rating_timeliness, r.rating_technical, r.rating_communication, r.rating_professional, r.comment, r.created_at,
             c.name as customer_name, c.user_no as customer_no,
             e.name as engineer_name, e.user_no as engineer_no,
             w.order_no
      FROM ratings r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN engineers e ON r.engineer_id = e.id
      LEFT JOIN work_orders w ON r.work_order_id = w.id
      ${where} ${orderBy}
      LIMIT ? OFFSET ?
    `).bind(...params, pageSize, offset).all();

    // 查询管理员回复
    const ratingIds = (list.results || []).map(r => r.id);
    const replies = {};
    if (ratingIds.length > 0) {
      const placeholders = ratingIds.map(() => '?').join(',');
      const replyResults = await env.DB.prepare(
        `SELECT * FROM admin_replies WHERE rating_id IN (${placeholders})`
      ).bind(...ratingIds).all();
      for (const reply of (replyResults.results || [])) {
        replies[reply.rating_id] = reply;
      }
    }

    return jsonResponse({
      total: total?.count || 0,
      list: (list.results || []).map(r => ({
        ...r,
        avg_score: ((r.rating_timeliness + r.rating_technical + r.rating_communication + r.rating_professional) / 4).toFixed(1),
        admin_reply: replies[r.id] || null,
      })),
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 管理员回复评价
async function handleAdminReplyRating(request, env) {
  try {
    const ratingId = new URL(request.url).pathname.split('/')[4]; // /api/admin/ratings/:id/reply
    const { content } = await request.json();

    if (!content) {
      return errorResponse('回复内容不能为空');
    }

    // 检查评价是否存在
    const rating = await env.DB.prepare('SELECT id FROM ratings WHERE id = ?').bind(ratingId).first();
    if (!rating) {
      return errorResponse('评价不存在', 404);
    }

    // 检查是否已回复
    const existing = await env.DB.prepare('SELECT id FROM admin_replies WHERE rating_id = ?').bind(ratingId).first();
    if (existing) {
      // 更新回复
      await env.DB.prepare('UPDATE admin_replies SET content = ?, created_at = datetime("now") WHERE rating_id = ?').bind(content, ratingId).run();
    } else {
      // 新增回复
      const id = generateId();
      await env.DB.prepare('INSERT INTO admin_replies (id, rating_id, content) VALUES (?, ?, ?)').bind(id, ratingId, content).run();
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 平台评价列表（管理员）
async function handleAdminPlatformRatings(request, env) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
    const offset = (page - 1) * pageSize;

    const total = await env.DB.prepare('SELECT COUNT(*) as count FROM platform_ratings').first();
    const list = await env.DB.prepare(`
      SELECT pr.id, pr.rating, pr.comment, pr.created_at,
             c.name as customer_name, c.user_no as customer_no
      FROM platform_ratings pr
      LEFT JOIN customers c ON pr.customer_id = c.id
      ORDER BY pr.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(pageSize, offset).all();

    return jsonResponse({
      total: total?.count || 0,
      list: list.results || [],
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 工程师对客户的评价列表（管理员）
async function handleAdminCustomerRatings(request, env) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
    const offset = (page - 1) * pageSize;

    const total = await env.DB.prepare('SELECT COUNT(*) as count FROM customer_ratings').first();
    const list = await env.DB.prepare(`
      SELECT cr.id, cr.rating, cr.comment, cr.created_at,
             e.name as engineer_name, e.user_no as engineer_no,
             c.name as customer_name, c.user_no as customer_no,
             w.order_no
      FROM customer_ratings cr
      LEFT JOIN engineers e ON cr.engineer_id = e.id
      LEFT JOIN customers c ON cr.customer_id = c.id
      LEFT JOIN work_orders w ON cr.work_order_id = w.id
      ORDER BY cr.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(pageSize, offset).all();

    return jsonResponse({
      total: total?.count || 0,
      list: list.results || [],
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

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
          'INSERT INTO work_orders (id, order_no, customer_id, engineer_id, type, description, urgency, status, assigned_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, orderNo, cid, eid, wo.type, wo.description, wo.urgency, wo.status, assignedAt).run();

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
        { rating: 5, comment: '平台很好用，小智助手很智能，解决了我的很多问题！' },
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
        bio: '擅长钣金成形设备，10年经验',
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
      INSERT INTO work_orders (id, order_no, customer_id, type, description, urgency, status)
      VALUES (?, ?, ?, 'fault', '光纤激光切割机（3000W大族）切割时出现毛刺，切面不光洁，侧壁有挂渣。已经更换过辅助气体（氮气），问题仍然存在。设备使用3年，近期未做保养。', 'urgent', 'pending')
    `).bind(workOrderId, orderNo, finalCustomerId).run();

    // 生成 AI 摘要
    const aiSummary = await generateWorkOrderSummary('fault', '光纤激光切割机（3000W大族）切割时出现毛刺，切面不光洁，侧壁有挂渣。已经更换过辅助气体（氮气），问题仍然存在。设备使用3年，近期未做保养。', 'urgent', env);
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
    // V2佣金体系：客户支付 subtotal（合伙人报的全包价），平台从合伙人端抽佣
    const platformFee = Math.round(subtotal * (1 - commissionRate));  // 平台服务费
    const depositWithhold = Math.round(subtotal * 0.05);             // 动态保证金 5%
    const engineerPayout = Math.round(subtotal * commissionRate);     // 合伙人实得

    // AI 审核报价
    const aiCheck = await checkPricing合理性({ labor_fee: laborFee, parts_fee: partsFee, travel_fee: travelFee, other_fee: otherFee, total_amount: subtotal }, workOrderId, env);

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

// 工程师标记服务完成
async function handleResolveWorkOrder(request, env) {
  try {
    const { engineer_id } = await request.json();
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const wo = await env.DB.prepare('SELECT status FROM work_orders WHERE id = ?').bind(workOrderId).first();
    if (!wo) return errorResponse('工单不存在', 404);

    // 仅允许 in_service 或 pricing 状态时标记完成
    if (['in_service', 'pricing'].includes(wo.status)) {
      await env.DB.prepare(
        "UPDATE work_orders SET status = 'resolved', resolved_at = datetime('now') WHERE id = ?"
      ).bind(workOrderId).run();

      await env.DB.prepare(`
        INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
        VALUES (?, ?, 'resolved', 'engineer', ?, '工程师标记服务完成，等待客户确认。')
      `).bind(generateId(), workOrderId, engineer_id || '').run();

      await env.DB.prepare(`
        INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type)
        VALUES (?, ?, 'system', '', '系统', '服务已完成，请客户确认并评价。', 'system')
      `).bind(generateId(), workOrderId).run();

      // 通知客户：服务已完成
      const woResolve = await env.DB.prepare('SELECT customer_id, order_no FROM work_orders WHERE id = ?').bind(workOrderId).first();
      if (woResolve?.customer_id) {
        await createNotification(env, {
          user_id: woResolve.customer_id,
          user_type: 'customer',
          type: 'ticket_resolved',
          title: '服务已完成',
          body: `工单 ${woResolve.order_no} 的服务已完成，请确认并评价。`,
          data: { work_order_id: workOrderId },
        });
      }
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 前端评价 API ============

// 客户提交平台评价
async function handleSubmitPlatformRating(request, env) {
  try {
    const { customer_id, rating, comment } = await request.json();
    if (!customer_id || !rating) {
      return errorResponse('缺少必填字段');
    }
    const id = generateId();
    await env.DB.prepare(
      'INSERT INTO platform_ratings (id, customer_id, rating, comment) VALUES (?, ?, ?, ?)'
    ).bind(id, customer_id, rating, comment || '').run();
    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 工程师评价客户
async function handleSubmitCustomerRating(request, env) {
  try {
    const { work_order_id, engineer_id, customer_id, rating, comment } = await request.json();
    if (!work_order_id || !engineer_id || !customer_id || !rating) {
      return errorResponse('缺少必填字段');
    }
    // 检查是否已评价
    const existing = await env.DB.prepare(
      'SELECT id FROM customer_ratings WHERE work_order_id = ? AND engineer_id = ?'
    ).bind(work_order_id, engineer_id).first();
    if (existing) {
      return errorResponse('已评价过该工单');
    }
    const id = generateId();
    await env.DB.prepare(
      'INSERT INTO customer_ratings (id, work_order_id, engineer_id, customer_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, work_order_id, engineer_id, customer_id, rating, comment || '').run();
    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 工单消息与核价 API ============

// 获取工单消息列表
async function handleGetWorkOrderMessages(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const messages = await env.DB.prepare(
      'SELECT * FROM work_order_messages WHERE work_order_id = ? ORDER BY created_at ASC'
    ).bind(workOrderId).all();
    return jsonResponse({ list: messages.results || [] });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 发送工单消息
async function handlePostWorkOrderMessage(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const { sender_type, sender_id, sender_name, content, message_type } = await request.json();

    if (!sender_type || !sender_id || !content) {
      return errorResponse('缺少必填字段');
    }

    // 验证工单存在
    const wo = await env.DB.prepare('SELECT id FROM work_orders WHERE id = ?').bind(workOrderId).first();
    if (!wo) return errorResponse('工单不存在', 404);

    const id = generateId();
    await env.DB.prepare(
      'INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, workOrderId, sender_type, sender_id, sender_name || '', content, message_type || 'text').run();

    return jsonResponse({ success: true, id });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 获取工单核价信息
async function handleGetWorkOrderPricing(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const pricing = await env.DB.prepare(
      'SELECT * FROM work_order_pricing WHERE work_order_id = ?'
    ).bind(workOrderId).first();
    return jsonResponse({ pricing: pricing || null });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// AI 报价审核
async function checkPricing合理性(pricing, workOrderId, env) {
  try {
    // 获取工单信息
    const wo = await env.DB.prepare(
      'SELECT w.*, c.region as customer_region FROM work_orders w LEFT JOIN customers c ON w.customer_id = c.id WHERE w.id = ?'
    ).bind(workOrderId).first();

    // 获取该工程师的历史报价记录
    const history = await env.DB.prepare(
      `SELECT * FROM work_order_pricing WHERE engineer_id = ? AND status = 'confirmed' ORDER BY created_at DESC LIMIT 10`
    ).bind(wo?.engineer_id).all();

    // 获取该地区同类工单的平均报价
    let regionalAvg = null;
    if (wo?.customer_region && wo?.type) {
      const regional = await env.DB.prepare(`
        SELECT AVG(p.total_amount) as avg_amount, COUNT(*) as cnt
        FROM work_order_pricing p
        JOIN work_orders w ON p.work_order_id = w.id
        JOIN customers c ON w.customer_id = c.id
        WHERE p.status = 'confirmed' AND c.region = ? AND w.type = ?
      `).bind(wo.customer_region, wo.type).first();
      regionalAvg = regional?.avg_amount || null;
    }

    const subtotal = (pricing.labor_fee || 0) + (pricing.parts_fee || 0) + (pricing.travel_fee || 0) + (pricing.other_fee || 0);
    const total = pricing.total_amount || 0;

    let status = 'reasonable';
    let reason = '报价在合理区间内';

    if (regionalAvg && total > regionalAvg * 1.3) {
      status = 'high';
      reason = `该报价高于同地区同类工单平均价约${Math.round((total / regionalAvg - 1) * 100)}%，请确认配件费用是否偏高`;
    } else if (regionalAvg && total < regionalAvg * 0.7) {
      status = 'low';
      reason = `该报价低于同地区同类工单平均价约${Math.round((1 - total / regionalAvg) * 100)}%，请确认是否遗漏费用`;
    }

    return { status, reason, regional_avg: regionalAvg, engineer_avg: null, history_count: history.results?.length || 0 };
  } catch (error) {
    return { status: 'reasonable', reason: '无法进行AI审核（数据不足）', regional_avg: null, engineer_avg: null, history_count: 0 };
  }
}

// 工程师提交/更新核价（V2：按合伙人等级浮动佣金）
async function handleSubmitWorkOrderPricing(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const { labor_fee, parts_fee, travel_fee, other_fee, parts_detail, engineer_id } = await request.json();

    // 验证工单
    const wo = await env.DB.prepare('SELECT * FROM work_orders WHERE id = ?').bind(workOrderId).first();
    if (!wo) return errorResponse('工单不存在', 404);

    const targetEngineerId = engineer_id || wo.engineer_id;

    // 读取工程师佣金比例（按等级：Junior 80% / Senior 85% / Expert 88%）
    const engineerRow = await env.DB.prepare(
      'SELECT commission_rate, level FROM engineers WHERE id = ?'
    ).bind(targetEngineerId).first();
    const commissionRate = engineerRow?.commission_rate || 0.80;
    const engineerLevel = engineerRow?.level || 'junior';

    const subtotal = (labor_fee || 0) + (parts_fee || 0) + (travel_fee || 0) + (other_fee || 0);
    // V2佣金体系：客户支付 subtotal（合伙人报的全包价），平台从合伙人端抽佣
    const platformFee = Math.round(subtotal * (1 - commissionRate));  // 平台服务费
    const depositWithhold = Math.round(subtotal * 0.05);             // 动态保证金 5%
    const engineerPayout = Math.round(subtotal * commissionRate);    // 合伙人实得

    // AI 审核
    const aiCheck = await checkPricing合理性({ labor_fee, parts_fee, travel_fee, other_fee, total_amount: subtotal }, workOrderId, env);

    // 检查是否已有报价
    const existing = await env.DB.prepare(
      'SELECT id FROM work_order_pricing WHERE work_order_id = ?'
    ).bind(workOrderId).first();

    if (existing) {
      // 更新报价
      await env.DB.prepare(`
        UPDATE work_order_pricing SET
          labor_fee = ?, parts_fee = ?, travel_fee = ?, other_fee = ?,
          parts_detail = ?, subtotal = ?, platform_fee = ?,
          deposit_withhold = ?, total_amount = ?, ai_price_check = ?,
          status = 'submitted', submitted_at = datetime('now')
        WHERE work_order_id = ?
      `).bind(labor_fee || 0, parts_fee || 0, travel_fee || 0, other_fee || 0,
           JSON.stringify(parts_detail || []), subtotal, platformFee, depositWithhold, subtotal,
           JSON.stringify(aiCheck), workOrderId).run();

      // 记录历史
      const historyId = generateId();
      await env.DB.prepare(
        'INSERT INTO work_order_pricing_history (id, pricing_id, labor_fee, parts_fee, travel_fee, other_fee, parts_detail, subtotal, total_amount, platform_fee, deposit_withhold, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(historyId, existing.id, labor_fee || 0, parts_fee || 0, travel_fee || 0, other_fee || 0, JSON.stringify(parts_detail || []), subtotal, subtotal, platformFee, depositWithhold, (await env.DB.prepare('SELECT MAX(version) as v FROM work_order_pricing_history WHERE pricing_id = ?').bind(existing.id).first())?.v + 1 || 1).run();
    } else {
      // 新建报价
      const id = generateId();
      await env.DB.prepare(`
        INSERT INTO work_order_pricing (id, work_order_id, engineer_id, labor_fee, parts_fee, travel_fee, other_fee, parts_detail, subtotal, platform_fee, deposit_withhold, total_amount, ai_price_check, status, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', datetime('now'))
      `).bind(id, workOrderId, targetEngineerId, labor_fee || 0, parts_fee || 0, travel_fee || 0, other_fee || 0, JSON.stringify(parts_detail || []), subtotal, platformFee, depositWithhold, subtotal, JSON.stringify(aiCheck)).run();
    }

    // 更新工单状态为 pricing
    await env.DB.prepare(
      "UPDATE work_orders SET status = 'pricing' WHERE id = ?"
    ).bind(workOrderId).run();

    // 发送系统消息
    const msgId = generateId();
    await env.DB.prepare(
      "INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type) VALUES (?, ?, 'system', '', '系统', '工程师已提交报价，请查看报价明细并确认。', 'pricing_update')"
    ).bind(msgId, workOrderId).run();

    // 通知客户：有新报价
    const woForNotif = await env.DB.prepare('SELECT customer_id, order_no FROM work_orders WHERE id = ?').bind(workOrderId).first();
    if (woForNotif?.customer_id) {
      await createNotification(env, {
        user_id: woForNotif.customer_id,
        user_type: 'customer',
        type: 'pricing_submitted',
        title: '收到新报价',
        body: `工单 ${woForNotif.order_no} 的合伙人已提交报价 ¥${subtotal}，请查看确认。`,
        data: { work_order_id: workOrderId },
      });
    }

    return jsonResponse({
      success: true,
      ai_check: aiCheck,
      subtotal,
      commission_rate: commissionRate,
      engineer_level: engineerLevel,
      platform_fee: platformFee,
      deposit_withhold: depositWithhold,
      engineer_payout: engineerPayout,
      total_amount: subtotal,  // 客户应付 = subtotal
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 客户确认报价
async function handleConfirmWorkOrderPricing(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const { customer_id } = await request.json();

    const pricing = await env.DB.prepare(
      'SELECT * FROM work_order_pricing WHERE work_order_id = ?'
    ).bind(workOrderId).first();
    if (!pricing) return errorResponse('报价不存在', 404);
    if (pricing.status !== 'submitted') return errorResponse('报价状态不正确，无法确认');

    await env.DB.prepare(
      "UPDATE work_order_pricing SET status = 'confirmed', confirmed_at = datetime('now') WHERE work_order_id = ?"
    ).bind(workOrderId).run();

    await env.DB.prepare(
      "UPDATE work_orders SET status = 'in_service' WHERE id = ?"
    ).bind(workOrderId).run();

    // 系统消息
    const msgId = generateId();
    await env.DB.prepare(
      "INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type) VALUES (?, ?, 'system', '', '系统', '客户已确认报价，工程师可以开始上门服务。', 'system')"
    ).bind(msgId, workOrderId).run();

    // 通知合伙人：报价已确认
    const woConfirm = await env.DB.prepare('SELECT engineer_id, order_no FROM work_orders WHERE id = ?').bind(workOrderId).first();
    if (woConfirm?.engineer_id) {
      await createNotification(env, {
        user_id: woConfirm.engineer_id,
        user_type: 'engineer',
        type: 'pricing_confirmed',
        title: '报价已确认',
        body: `工单 ${woConfirm.order_no} 的客户已确认报价，可以开始上门服务。`,
        data: { work_order_id: workOrderId },
      });
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 客户拒绝/议价
async function handleRejectWorkOrderPricing(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const { customer_id, reason } = await request.json();

    await env.DB.prepare(
      "UPDATE work_order_pricing SET status = 'draft' WHERE work_order_id = ?"
    ).bind(workOrderId).run();

    await env.DB.prepare(
      "UPDATE work_orders SET status = 'in_progress' WHERE id = ?"
    ).bind(workOrderId).run();

    // 发送议价消息
    const msgId = generateId();
    await env.DB.prepare(
      "INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type) VALUES (?, ?, 'customer', ?, '客户', ?, 'text')"
    ).bind(msgId, workOrderId, customer_id || '', reason || '希望重新报价').run();

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 通知相关 API ============

async function handleGetNotifications(request, env) {
  try {
    const auth = request._auth;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    const { results } = await env.DB.prepare(
      'SELECT * FROM notifications WHERE user_id = ? AND user_type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(auth.userId, auth.userType, limit, offset).all();

    return jsonResponse({ notifications: results });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleGetUnreadNotificationCount(request, env) {
  try {
    const auth = request._auth;
    const row = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND user_type = ? AND is_read = 0'
    ).bind(auth.userId, auth.userType).first();

    return jsonResponse({ count: row?.count || 0 });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleMarkNotificationRead(request, env) {
  try {
    const auth = request._auth;
    const notificationId = new URL(request.url).pathname.split('/')[3];

    await env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND user_type = ?'
    ).bind(notificationId, auth.userId, auth.userType).run();

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleMarkAllNotificationsRead(request, env) {
  try {
    const auth = request._auth;

    await env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND user_type = ? AND is_read = 0'
    ).bind(auth.userId, auth.userType).run();

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 主处理函数 ============
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 处理 CORS 预检
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // 认证相关（无需 token）
    if (path === '/api/auth/send-code' && request.method === 'POST') {
      return handleSendCode(request, env);
    }
    if (path === '/api/auth/register/customer' && request.method === 'POST') {
      return handleRegisterCustomer(request, env);
    }
    if (path === '/api/auth/register/engineer' && request.method === 'POST') {
      return handleRegisterEngineer(request, env);
    }
    if (path === '/api/auth/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }
    if (path === '/api/auth/reset-password' && request.method === 'POST') {
      return handleResetPassword(request, env);
    }
    if (path === '/api/auth/send-reset-code' && request.method === 'POST') {
      return handleSendResetCode(request, env);
    }

    // 聊天相关（允许未登录用户使用 AI 对话）
    if (path === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env);
    }

    // 健康检查（无需 token）
    if (path === '/health') {
      return jsonResponse({ status: 'ok' });
    }

    // 临时测试数据初始化（需要管理员认证）
    if (path === '/api/init-test-data' && request.method === 'GET') {
      const admin = await authenticateAdmin(request, env);
      if (!admin) return errorResponse('需要管理员权限', 403);
      return handleInitTestData(env);
    }
    if (path === '/api/test-full-flow' && request.method === 'GET') {
      const admin = await authenticateAdmin(request, env);
      if (!admin) return errorResponse('需要管理员权限', 403);
      return handleTestFullPricingFlow(env);
    }
    if (path === '/api/debug-engineers' && request.method === 'GET') {
      // 调试：查看所有可用工程师的onesignal_player_id
      const engineers = await env.DB.prepare(
        'SELECT id, name, onesignal_player_id FROM engineers WHERE status = ?'
      ).bind('available').all();
      return jsonResponse({ count: engineers.results.length, engineers: engineers.results });
    }
    // 完整的工单创建+推送测试（不需要认证）
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
        INSERT INTO work_orders (id, order_no, customer_id, type, description, urgency, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `).bind(id, order_no, customerId, type, description, urgency).run();

      // 生成AI摘要
      const aiSummary = await generateWorkOrderSummary(type, description, urgency, env);

      const workOrderData = { id, order_no, type, description, urgency, ai_summary: aiSummary };

      // 查找匹配的工程师
      const matchingEngineers = await findMatchingEngineers(workOrderData, env);

      // 发送推送
      const typeLabels = { fault: '设备故障', maintenance: '维护保养', parameter: '参数调试' };
      const urgencyLabels = { normal: '普通', urgent: '紧急', critical: '非常紧急' };
      let sent = 0;
      for (const engineer of matchingEngineers) {
        console.log('[TEST] Engineer in loop:', JSON.stringify(engineer));
        if (engineer.onesignal_player_id) {
          await sendPushToEngineer(engineer.id, env, {
            title: '📋 New Work Order!',
            titleZh: '📋 您有新工单等待接单！',
            message: `Order: ${order_no} | Type: ${typeLabels[type] || type} | Urgency: ${urgencyLabels[urgency] || urgency}`,
            messageZh: `工单号：${order_no} | 类型：${typeLabels[type] || type} | 紧急程度：${urgencyLabels[urgency] || urgency}`,
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
        console.log('[Push] Checking engineer:', engineer.id, engineer.name, 'playerId:', engineer.onesignal_player_id);
        if (engineer.onesignal_player_id) {
          await sendPushToEngineer(engineer.id, env, {
            title: '📋 New Work Order!',
            titleZh: '📋 您有新工单等待接单！',
            message: `Order: ${workOrderData.order_no} | Type: ${typeLabels[workOrderData.type] || workOrderData.type} | Urgency: ${urgencyLabels[workOrderData.urgency] || workOrderData.urgency}`,
            messageZh: `工单号：${workOrderData.order_no} | 类型：${typeLabels[workOrderData.type] || workOrderData.type} | 紧急程度：${urgencyLabels[workOrderData.urgency] || workOrderData.urgency}`,
            data: { work_order_id: workOrderData.id, type: 'new_ticket' }
          });
          sent++;
        }
      }
      return jsonResponse({ matched: matchingEngineers.length, sent, engineers: matchingEngineers.map(e => ({ id: e.id, name: e.name, playerId: e.onesignal_player_id })) });
    }
    if (path === '/api/test-results' && request.method === 'GET') {
      const admin = await authenticateAdmin(request, env);
      if (!admin) return errorResponse('需要管理员权限', 403);
      try {
        const results = await env.DB.prepare('SELECT * FROM test_flow_results ORDER BY id ASC').all();
        return jsonResponse({ results: results.results });
      } catch (e) {
        return errorResponse('读取失败: ' + e.message, 500);
      }
    }
    // 工程师标记服务完成
    if (path.match(/^\/api\/workorders\/[^/]+\/resolve$/) && request.method === 'POST') {
      return handleResolveWorkOrder(request, env);
    }
    if (path === '/api/clear-test-data' && request.method === 'GET') {
      const admin = await authenticateAdmin(request, env);
      if (!admin) return errorResponse('需要管理员权限', 403);
      try {
        await env.DB.prepare('DELETE FROM test_flow_results').run();
        await env.DB.prepare('DELETE FROM work_orders WHERE order_no LIKE ?').bind('WO-TEST-%').run();
        return jsonResponse({ success: true, message: '测试数据已清理' });
      } catch (e) {
        return errorResponse('清理失败: ' + e.message, 500);
      }
    }

    // 临时建表接口（需要管理员认证）
    if (path === '/api/init-db' && request.method === 'GET') {
      const admin = await authenticateAdmin(request, env);
      if (!admin) return errorResponse('需要管理员权限', 403);
      return handleInitDb(env);
    }

    // 管理员登录（无需 token）
    if (path === '/api/admin/login' && request.method === 'POST') {
      return handleAdminLogin(request, env);
    }

    // ====== 以下接口需要 JWT 认证 ======
    const auth = await authenticateRequest(request, env);
    if (!auth) {
      return errorResponse('请先登录', 401);
    }

    // 管理后台 API（需要管理员权限）
    if (path.startsWith('/api/admin/')) {
      if (auth.userType !== 'admin') {
        return errorResponse('需要管理员权限', 403);
      }
      if (path === '/api/admin/stats' && request.method === 'GET') {
        return handleAdminStats(request, env);
      }
      if (path === '/api/admin/users' && request.method === 'GET') {
        return handleAdminUsers(request, env);
      }
      if (path === '/api/admin/users' && request.method === 'POST') {
        return handleAdminCreateUser(request, env);
      }
      if (path.startsWith('/api/admin/users/') && request.method === 'DELETE') {
        return handleAdminDeleteUser(request, env);
      }
      if (path === '/api/admin/workorders' && request.method === 'GET') {
        return handleAdminWorkOrders(request, env);
      }
      if (path === '/api/admin/ratings' && request.method === 'GET') {
        return handleAdminRatings(request, env);
      }
      if (path.startsWith('/api/admin/ratings/') && path.endsWith('/reply') && request.method === 'POST') {
        return handleAdminReplyRating(request, env);
      }
      if (path === '/api/admin/platform-ratings' && request.method === 'GET') {
        return handleAdminPlatformRatings(request, env);
      }
      if (path === '/api/admin/customer-ratings' && request.method === 'GET') {
        return handleAdminCustomerRatings(request, env);
      }
    }

    // 将认证信息挂到 request 上，供 handler 使用
    request._auth = auth;

    // 对话管理
    if (path === '/api/conversations' && request.method === 'GET') {
      return handleGetConversations(request, env);
    }
    if (path.startsWith('/api/conversations/') && request.method === 'GET') {
      return handleGetConversation(request, env);
    }
    if (path.startsWith('/api/conversations/') && request.method === 'DELETE') {
      return handleDeleteConversation(request, env);
    }

    // 工单相关
    if (path === '/api/workorders' && request.method === 'POST') {
      return handleCreateWorkOrder(request, env);
    }
    if (path === '/api/workorders' && request.method === 'GET') {
      return handleGetWorkOrders(request, env);
    }
    if (path.startsWith('/api/workorders/') && request.method === 'GET') {
      return handleGetWorkOrder(request, env);
    }
    if (path === '/api/workorders/rating' && request.method === 'POST') {
      return handleSubmitRating(request, env);
    }
    // 工单消息
    if (path.match(/^\/api\/workorders\/[^/]+\/messages$/) && request.method === 'GET') {
      return handleGetWorkOrderMessages(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/messages$/) && request.method === 'POST') {
      return handlePostWorkOrderMessage(request, env);
    }
    // 工单核价
    if (path.match(/^\/api\/workorders\/[^/]+\/pricing\/confirm$/) && request.method === 'POST') {
      return handleConfirmWorkOrderPricing(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/pricing\/reject$/) && request.method === 'POST') {
      return handleRejectWorkOrderPricing(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/pricing$/) && request.method === 'GET') {
      return handleGetWorkOrderPricing(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/pricing$/) && request.method === 'POST') {
      return handleSubmitWorkOrderPricing(request, env);
    }
    if (path === '/api/platform-ratings' && request.method === 'POST') {
      return handleSubmitPlatformRating(request, env);
    }
    if (path === '/api/customer-ratings' && request.method === 'POST') {
      return handleSubmitCustomerRating(request, env);
    }

    // 设备管理
    if (path === '/api/devices' && request.method === 'GET') {
      return handleGetDevices(request, env);
    }
    if (path === '/api/devices' && request.method === 'POST') {
      return handleCreateDevice(request, env);
    }
    if (path.startsWith('/api/devices/') && request.method === 'GET') {
      return handleGetDevice(request, env);
    }
    if (path.startsWith('/api/devices/') && request.method === 'PATCH') {
      return handleUpdateDevice(request, env);
    }
    if (path.startsWith('/api/devices/') && request.method === 'DELETE') {
      return handleDeleteDevice(request, env);
    }

    // 通知相关
    if (path === '/api/notifications' && request.method === 'GET') {
      return handleGetNotifications(request, env);
    }
    if (path === '/api/notifications/unread-count' && request.method === 'GET') {
      return handleGetUnreadNotificationCount(request, env);
    }
    if (path.match(/^\/api\/notifications\/[^/]+\/read$/) && request.method === 'PATCH') {
      return handleMarkNotificationRead(request, env);
    }
    if (path === '/api/notifications/read-all' && request.method === 'POST') {
      return handleMarkAllNotificationsRead(request, env);
    }

    // 工程师相关
    if (path === '/api/engineers/tickets' && request.method === 'GET') {
      return handleGetEngineerTickets(request, env);
    }
    if (path === '/api/engineers/tickets/accept' && request.method === 'POST') {
      return handleAcceptTicket(request, env);
    }
    if (path === '/api/engineers/tickets/reject' && request.method === 'POST') {
      return handleRejectTicket(request, env);
    }
    if (path === '/api/engineers/status' && request.method === 'PATCH') {
      return handleUpdateEngineerStatus(request, env);
    }
    if (path === '/api/engineers/recommend' && request.method === 'GET') {
      return handleRecommendEngineers(request, env);
    }
    if (path === '/api/engineers/profile' && request.method === 'GET') {
      return handleGetEngineerProfile(request, env);
    }
    if (path === '/api/engineers/profile' && request.method === 'PATCH') {
      return handleUpdateEngineerProfile(request, env);
    }
    if (path === '/api/customers/profile' && request.method === 'PATCH') {
      return handleUpdateCustomerProfile(request, env);
    }
    if (path === '/api/auth/change-password' && request.method === 'POST') {
      return handleChangePassword(request, env);
    }
    // 合伙人钱包信息
    if (path === '/api/engineers/wallet' && request.method === 'GET') {
      return handleGetEngineerWallet(request, env);
    }
    // 合伙人提现申请
    if (path === '/api/engineers/wallet/withdraw' && request.method === 'POST') {
      return handleWithdrawRequest(request, env);
    }
    // 合伙人推送订阅（OneSignal Player ID）
    if (path === '/api/engineers/push-subscription' && request.method === 'POST') {
      return handleSavePushSubscription(request, env);
    }

    // 默认返回 404
    return new Response('Not found', { status: 404 });
  },
};
