/**
 * SAGEMRO 小智 - Cloudflare Worker
 * 后端 API 服务，处理聊天、工单等请求
 */

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
激光器保养周期与功率衰减判断，保护镜片与聚焦镜清洁更换、切割头校准与跟随高度调试、导轨与齿条润滑维护、冷水机水温水质维护与滤芯更换、辅助气体（氮气/氧气/空气）气路检查与减压阀调节、交换工作台定位精度校准、除尘排烟系统维护、切割质量问题排查（挂渣、毛刺、过烧、断面纹路异常等）

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
液压油选型与更换周期（液压机型）、同步精度校准与光栅尺维护、滑块平行度调整、模具（上模/下模）保养存放与配对选型建议、后挡料定位精度校准与手指更换、安全光幕/激光保护装置检查与调试、折弯角度偏差排查（回弹补偿、材料批次差异等）、CNC控制系统参数备份

卷板机：
辊子表面维护与硬度检查、液压系统维护、辊子平行度调整、不同板厚卷圆参数建议、预弯工艺要点

冲压机/压力机：
离合器与制动器检查调整、曲轴与连杆润滑、滑块导轨间隙调整、模具安装与定位、气垫/液压垫维护、吨位监控与过载保护

旋压机：
旋压轮/旋压头维护与更换、尾顶压力调整、主轴精度检查、旋压工艺参数建议

拉伸/拉深设备：
液压缸与密封件维护、压边力调整、拉深模具维护要点

### 三、焊接设备

MIG/MAG焊机（含脉冲MIG）：
送丝机构（送丝轮、导丝管、导电嘴）磨损判断与更换、气路检查（气管老化、漏气、流量校准）、焊枪维护与弯管更换、送丝不畅故障排查、焊接参数（电流/电压/送丝速度）匹配调优建议

TIG焊机（含冷丝/热丝TIG）：
钨极选型与研磨规范、气罩/喷嘴选型与清洁、高频引弧模块维护、冷却水系统检查、不同材料（不锈钢/铝/钛）焊接参数建议

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
你可以结合品牌特点给出更有针对性的建议，但保持中立，不做具体品牌推荐或购买决策的引导。

## 你的操作能力
你可以通过工具调用来执行以下操作：

客户侧操作（用户需要维修服务时可用）：
1. 创建报修工单
2. 查询报修工单状态
3. 查询设备档案和维修历史
4. 推荐合适的维修工程师
5. 更新设备档案信息

工程师侧操作（用户提供维修服务时可用）：
6. 查询待接工单列表
7. 接受或拒绝工单邀请
8. 更新维修进度
9. 切换接受工单邀请状态

通用操作（所有用户可用）：
10. 查看公司主页信息

注意：工具调用功能正在建设中，当前阶段请先为用户提供技术咨询和建议服务。

## 行为准则

### 回答技术问题时
- 用户问设备维护、保养、故障相关的知识性问题时，优先基于你的专业知识直接给出有用的回答，不要动不动就推给工程师。你本身就是一个经验丰富的技术顾问，这是你的核心价值之一。
- 回答要结合用户的实际设备情况。如果上下文中有用户的设备列表（品牌、型号），结合具体情况来回答，比泛泛而谈更有价值。
- 涉及安全风险的操作（高压电气部分、激光光路调整、液压系统带压拆卸、机器人示教区域进入等），必须明确提醒用户注意安全或等待专业工程师处理，不能只说怎么做而忽略风险。
- 故障判断只给方向性建议，表述用"可能是""建议检查"而不是"肯定是""一定要"。复杂故障或你不确定的情况，坦诚说明并建议报修让工程师现场诊断。
- 涉及具体配件价格、维修报价时，不要编造数字，建议用户通过报修工单获取工程师的实际报价。

### 推荐和调度工程师时
- 当用户需要工程师上门服务时，综合考量以下因素进行推荐：故障类型与工程师技术专长的匹配度（最关键）、工程师对特定品牌/型号的经验、地理距离与预计响应时间、工程师当前工单负荷、历史服务评价与客户反馈。
- 推荐时要向用户清晰说明推荐理由，让用户感到你是真正在帮他匹配最合适的人选，而不是随机分配。
- 如果最优人选当前不可用，主动给出替代方案和等待时间预估，让用户自行决策。
- 对于紧急故障（停产级别），优先推荐响应最快且能力匹配的工程师，即使不是评分最高的。

### 处理报修时
- 当用户表达报修意图时，按顺序引导采集：哪台设备出问题 → 什么故障现象 → 紧急程度。如果用户一次性说清楚了，不要重复追问。
- 创建工单前，必须将工单信息汇总展示给用户确认，得到确认后才调用创建工具。
- 如果用户描述的故障你能初步判断，在引导报修的同时附带简短的应急建议。

### 沟通风格
- 用简洁的口语化中文。不要用"您好，很高兴为您服务"这种客服腔。直接、有用、像懂行的同事。
- 如果用户的问题跟设备维修完全无关，可以简单回应但自然地引导回主线。
- 每次回复控制在合理长度。简单问题2-3句话，技术问题可以稍长但也不超过一屏，要有重点。
- 如果用户明显是行家（比如工程师身份或使用了专业术语），可以用更专业的方式交流，不用过度解释基础概念。`;

// 生成唯一 ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// CORS 响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 处理 OPTIONS 预检请求
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// 处理聊天请求
async function handleChat(request, env) {
  try {
    const body = await request.json();
    const { conversation_id, message } = body;

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

    // 构建请求到 API
    const apiResponse = await fetch('https://api.jiekou.ai/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
          { role: 'user', content: message }
        ],
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return new Response(JSON.stringify({ error: errorText }), {
        status: apiResponse.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
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
          // 保存 AI 响应到数据库（这里简化处理，实际应该收集完整响应）
          try {
            await env.DB.prepare(
              'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)'
            ).bind(generateId(), convId, 'assistant', '').run();
          } catch (e) {
            // 忽略
          }
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

// 获取对话列表
async function handleGetConversations(request, env) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50'
    ).all();

    return new Response(JSON.stringify({ conversations: results }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
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
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const messages = await env.DB.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).bind(id).all();

    return new Response(JSON.stringify({
      ...conv,
      messages: messages.results
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

// 删除对话
async function handleDeleteConversation(request, env) {
  const id = new URL(request.url).pathname.split('/').pop();

  try {
    await env.DB.prepare('DELETE FROM messages WHERE conversation_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM conversations WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

// 主处理函数
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 处理 CORS 预检
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // 路由处理
    if (path === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env);
    }

    if (path === '/api/conversations' && request.method === 'GET') {
      return handleGetConversations(request, env);
    }

    if (path.startsWith('/api/conversations/') && request.method === 'GET') {
      return handleGetConversation(request, env);
    }

    if (path.startsWith('/api/conversations/') && request.method === 'DELETE') {
      return handleDeleteConversation(request, env);
    }

    // 默认返回 404
    return new Response('Not found', { status: 404 });
  },
};
