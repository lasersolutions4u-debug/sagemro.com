/**
 * SAGEMRO 小智 - Cloudflare Worker
 * 后端 API 服务，处理聊天、工单、认证等请求
 */

// ============ 配置 ============
// API_KEY 和 API_ENDPOINT 通过 Cloudflare Worker Secrets 注入
// 设置命令：wrangler secret put OPENAI_API_KEY / OPENAI_API_ENDPOINT
// JWT_SECRET 也通过 Secrets 注入：wrangler secret put JWT_SECRET

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

// ============ 工具函数 ============

// 生成唯一 ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
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

    // 将 Base64URL 签名转回 ArrayBuffer
    const sigStr = base64UrlDecode(signatureB64);
    const sigBytes = new Uint8Array(sigStr.length);
    for (let i = 0; i < sigStr.length; i++) sigBytes[i] = sigStr.charCodeAt(i);

    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data));
    if (!valid) return null;

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

    return jsonResponse({ success: true, message: '验证码已发送' });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 客户注册
async function handleRegisterCustomer(request, env) {
  try {
    const { name, phone, password, code } = await request.json();

    if (!name || !phone || !password) {
      return errorResponse('姓名、手机号、密码不能为空');
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

    // 创建客户
    const id = generateId();
    const userNo = await generateUserNo(env, 'U');
    const salt = generateSalt();
    const passwordHash = await hashPasswordNew(password, salt);

    await env.DB.prepare(
      'INSERT INTO customers (id, user_no, name, phone, password_hash, salt) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, userNo, name, phone, passwordHash, salt).run();

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
      specialties, brands, services, service_region, bio
    } = await request.json();

    if (!name || !phone || !password) {
      return errorResponse('姓名、手机号、密码不能为空');
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
      INSERT INTO engineers (id, user_no, name, phone, password_hash, salt, specialties, brands, services, service_region, bio)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, userNo, name, phone, passwordHash, salt,
      JSON.stringify(specialties || []),
      JSON.stringify(brands || {}),
      JSON.stringify(services || []),
      JSON.stringify(service_region || []),
      bio || ''
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

    return jsonResponse({ success: true, message: '验证码已发送' });
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

// 处理聊天请求
async function handleChat(request, env) {
  try {
    const body = await request.json();
    const { conversation_id, message, customer_id } = body;

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

    // 获取客户上下文
    const customerContext = await generateCustomerContext(customer_id, env);
    const systemWithContext = SYSTEM_PROMPT + customerContext;

    // 构建请求到 API
    const apiResponse = await fetch(env.OPENAI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemWithContext },
          ...messages,
          { role: 'user', content: message }
        ],
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
      ).bind(convId, message.slice(0, 20), message.slice(0, 50)).run();
    } else {
      await env.DB.prepare(
        'UPDATE conversations SET last_message = ?, updated_at = datetime("now") WHERE id = ?'
      ).bind(message.slice(0, 50), convId).run();
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
        specialtyScore,
        skillScore,
        brandBonus,
        totalScore
      };
    });

    // 按分数排序，返回前5名
    scoredEngineers.sort((a, b) => b.totalScore - a.totalScore);

    return scoredEngineers.slice(0, 5);
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

// 获取客户的工单列表
async function handleGetWorkOrders(request, env) {
  // 优先使用认证信息中的 userId，其次使用查询参数
  const customerId = request._auth?.userId || new URL(request.url).searchParams.get('customer_id');

  try {
    let query = 'SELECT * FROM work_orders';
    let params = [];

    if (customerId) {
      query += ' WHERE customer_id = ?';
      params = [customerId];
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

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
    const workOrder = await env.DB.prepare(
      'SELECT * FROM work_orders WHERE id = ?'
    ).bind(id).first();

    if (!workOrder) {
      return errorResponse('工单不存在', 404);
    }

    const logs = await env.DB.prepare(
      'SELECT * FROM work_order_logs WHERE work_order_id = ? ORDER BY created_at ASC'
    ).bind(id).all();

    return jsonResponse({ ...workOrder, logs: logs.results });
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
    let query = `SELECT * FROM work_orders WHERE status IN ('pending', 'assigned')`;
    let params = [];

    if (engineerId) {
      // 排除已拒绝的工单
      const engineer = await env.DB.prepare('SELECT rejected_engineers FROM engineers WHERE id = ?').bind(engineerId).first();
      const rejected = engineer ? JSON.parse(engineer.rejected_engineers || '[]') : [];

      if (rejected.length > 0) {
        query += ` AND id NOT IN (${rejected.map(() => '?').join(',')})`;
        params = rejected;
      }
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

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
    const rejected = engineer ? JSON.parse(engineer.rejected_engineers || '[]') : [];
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
      'SELECT id, name, phone, specialties, brands, services, service_region, bio, status, rating_timeliness, rating_technical, rating_communication, rating_professional, rating_count, created_at FROM engineers WHERE id = ?'
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

    // ====== 以下接口需要 JWT 认证 ======
    const auth = await authenticateRequest(request, env);
    if (!auth) {
      return errorResponse('请先登录', 401);
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

    // 默认返回 404
    return new Response('Not found', { status: 404 });
  },
};
