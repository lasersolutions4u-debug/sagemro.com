import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function collectCopyFiles(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const entries = readdirSync(absolutePath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const childPath = path.join(relativePath, entry.name);
    if (entry.isDirectory()) return collectCopyFiles(childPath);
    return /\.(?:html|js|jsx|json|md|mjs|toml|ya?ml)$/.test(entry.name) ? [childPath] : [];
  });
}

function extractPlaceholderExpression(source) {
  const match = source.match(/const placeholder = ([^;]+);/);
  assert.ok(match, 'expected InputArea placeholder expression to be discoverable');
  return match[1];
}

test('customer, engineer, admin, and browser icons use the approved full SAGEMRO logo', () => {
  const expectedAssets = [
    'frontend/public/sagemro-logo.png',
    'admin/public/sagemro-logo.png',
  ];
  const approvedLogoHash = '8dd41506fb801bf6cad52751905a104423dd5e69e40c18b9043b8cab25c3893e';

  for (const assetPath of expectedAssets) {
    assert.equal(existsSync(path.join(root, assetPath)), true, `${assetPath} should exist`);
    const hash = createHash('sha256').update(readFileSync(path.join(root, assetPath))).digest('hex');
    assert.equal(hash, approvedLogoHash, `${assetPath} should be the approved full robot logo`);
  }

  assert.match(read('frontend/src/components/common/BrandMark.jsx'), /sagemro-logo\.png/);
  assert.doesNotMatch(read('frontend/src/components/common/BrandMark.jsx'), /sagemro-brand-mark\.svg/);
  assert.match(read('admin/src/components/BrandMark.jsx'), /sagemro-logo\.png/);
  assert.doesNotMatch(read('admin/src/components/BrandMark.jsx'), /sagemro-brand-mark\.svg/);

  assert.match(read('frontend/index.html'), /type="image\/png" href="\/sagemro-logo\.png"/);
  assert.match(read('admin/index.html'), /href="\/sagemro-logo\.png"/);
});

test('main chat input is text-only and uses short mobile placeholder copy', () => {
  const inputArea = read('frontend/src/components/Chat/InputArea.jsx');
  const placeholderExpression = extractPlaceholderExpression(inputArea);

  assert.doesNotMatch(inputArea, /uploadChatImage|ImagePlus|type="file"|accept="image/);
  assert.doesNotMatch(placeholderExpression, /upload image|Add device|field context|material, thickness/i);
  assert.match(placeholderExpression, /Describe the problem/);
});

test('main chat input supports Deepgram voice transcription without image upload', () => {
  const inputArea = read('frontend/src/components/Chat/InputArea.jsx');
  const api = read('frontend/src/services/api.js');

  assert.match(inputArea, /Mic/);
  assert.match(inputArea, /MediaRecorder/);
  assert.match(inputArea, /VOICE_RECORDING_LIMIT_MS = 30 \* 1000/);
  assert.doesNotMatch(inputArea, /voiceLanguage|<select|aria-label="Voice language"|Auto language/);
  assert.match(inputArea, /transcribeVoiceInput\(audioBlob\)/);
  assert.match(inputArea, /setInput\(\(current\) => current \? `\$\{current\} \$\{transcript\}` : transcript\)/);
  assert.match(inputArea, /Voice input unavailable/);
  assert.match(api, /transcribeVoiceInput\(audioBlob\)/);
  assert.doesNotMatch(api, /formData\.append\('language'/);
  assert.match(api, /\/api\/chat\/transcribe/);
  assert.doesNotMatch(inputArea, /type="file"|accept="image/);
});

test('main site first-impression copy keeps CN and COM market language separate', () => {
  const welcome = read('frontend/src/data/welcomePageCopy.js');
  const welcomePage = read('frontend/src/components/Chat/WelcomePage.jsx');
  const chatArea = read('frontend/src/components/Chat/ChatArea.jsx');
  const footer = read('frontend/src/components/common/Footer.jsx');
  const engineerRecruiting = read('frontend/src/components/Engineer/EngineerRecruitingPage.jsx');

  assert.match(welcome, /eyebrow: 'SAGEMRO Service OS'/);
  assert.match(welcome, /Equipment trouble\? Chat now\. Get answers instantly\./);
  assert.doesNotMatch(welcome, /Issues with laser and metal forming equipment\? Ask AI first\./);
  assert.match(welcome, /Cutting issue, bending problem, or welding alarm\? Describe what you are seeing on site, and let SAGEMRO AI analyze it and offer suggestions\./);
  assert.doesNotMatch(welcome, /AI assistant specialized for laser and metal forming equipment/);
  assert.doesNotMatch(welcome, /AI-generated content is for reference only/);
  assert.match(welcome, /Useful shop-floor tools/);
  assert.doesNotMatch(welcome, /href: '\/tools\/bend-simulator'/);
  assert.match(welcome, /href: '\/tools\/laser-cutting-speed-reference\/'/);
  assert.match(welcome, /label: 'Laser Cutting Speed'/);
  assert.match(welcome, /label: '激光切割速度参考'/);
  assert.match(welcome, /href: '\/tools\/metal-weight-calculator\/'/);
  assert.match(welcome, /href: '\/tools\/laser-cutting-cost-calculator\/'/);
  assert.match(welcome, /href: '\/tools\/steel-price-watch\/'/);
  assert.doesNotMatch(welcome, /href: '\/insights'/);
  assert.doesNotMatch(welcome, /Insights/);
  assert.doesNotMatch(welcome, /sales form|sales shortcut/i);
  assert.doesNotMatch(welcome, /Machine selection|new-machine evaluation/);
  assert.doesNotMatch(welcome, /supports international customers with independent after-sales service, spare parts, consumables/);
  assert.doesNotMatch(welcome, /purchasing decision|Clear facts first|BM111 alarm|burrs on stainless steel/i);
  assert.match(welcome, /eyebrow: 'SAGEMRO 智能服务系统'/);
  assert.match(welcome, /headline: '机器的问题，难不倒有心的人'/);
  assert.doesNotMatch(welcome, /headline: '机器的问题，难不倒有心的人。'/);
  assert.match(welcome, /intro: '描述激光切割、折弯、焊接现场，让 SageMRO AI 助你快速拨开故障迷雾，做设备最明智的主人。'/);
  assert.doesNotMatch(welcome, /设备问题不求人，即时交谈，马上就有答案/);
  assert.doesNotMatch(welcome, /切割出了什么问题、折弯哪里不对、焊接报了什么警——描述现场情况，让SAGEMRO AI 给你分析和建议/);
  assert.doesNotMatch(welcome, /激光和成型设备问题，先问AI试试/);
  assert.doesNotMatch(welcome, /描述现场遇到的情况/);
  assert.doesNotMatch(welcome, /专为激光和成型设备打造的智能服务助手/);
  assert.doesNotMatch(welcome, /内容由 AI 生成，仅供参考/);
  assert.doesNotMatch(welcome, /钣金设备故障，先用 AI 看看/);
  assert.doesNotMatch(welcome, /报了什么警、切割出了什么问题、折弯不对了/);
  assert.match(welcomePage, /max-w-4xl/);
  assert.match(chatArea, /SAGEMRO AI 设备服务平台/);
  assert.match(chatArea, /专为激光和成型设备打造的智能服务助手/);
  assert.match(chatArea, /SAGEMRO AI Equipment Service/);
  assert.match(chatArea, /AI assistant specialized for laser and metal forming equipment\./);
  assert.match(chatArea, /内容由 AI 生成，仅供参考。最终诊断、报价和现场安全需经 SAGEMRO 服务流程确认。/);
  assert.match(chatArea, /AI-generated content is for reference only\. Final diagnosis, pricing, and safety decisions follow the SAGEMRO service process\./);
  assert.ok(chatArea.indexOf('{aiNotice}') < chatArea.indexOf('{/* 消息区域 */}'));
  assert.match(footer, /© 2026 SAGEMRO/);
  assert.doesNotMatch(footer, /operated by Jinan Euchio Machinery|由济南钰峭机械有限公司运营/);
  assert.match(footer, /鲁ICP备2026032904号-1/);
  assert.match(footer, /https:\/\/beian\.miit\.gov\.cn\//);
  assert.match(engineerRecruiting, /SAGEMRO 工程师合作计划/);
  assert.match(engineerRecruiting, /SAGEMRO Engineer Partner Program/);
  assert.match(engineerRecruiting, /品牌、系统、推广免费给，你只管把技术做到极致/);
  assert.match(engineerRecruiting, /We bring the brand, the systems and the reach\. You bring the craft\./);
  assert.doesNotMatch(engineerRecruiting, /智能服务系统|Certified Representative Program/);
});

test('equipment category narrative uses laser and metal forming equipment consistently', () => {
  const copyFiles = [
    ...collectCopyFiles('frontend/src'),
    ...collectCopyFiles('admin/src'),
    ...collectCopyFiles('worker/src'),
    ...collectCopyFiles('docs'),
    ...collectCopyFiles('Marketing'),
    ...readdirSync(root)
      .filter((fileName) => fileName.endsWith('.md')),
  ];
  const forbiddenNarrative = /钣金加工全工艺链设备|钣金加工设备|钣金设备|激光和金属成型设备|sheet[- ]metal equipment/i;
  const violations = copyFiles.filter((filePath) => forbiddenNarrative.test(read(filePath)));

  assert.deepEqual(violations, []);
});

test('AI service copy keeps service preparation neutral instead of sales routing', () => {
  const chatArea = read('frontend/src/components/Chat/ChatArea.jsx');
  const welcomeCopy = read('frontend/src/data/welcomePageCopy.js');
  const legal = read('frontend/src/components/common/LegalModal.jsx');

  assert.match(chatArea, /service process/i);
  assert.match(welcomeCopy, /SAGEMRO Service OS|Useful shop-floor tools/i);
  assert.match(legal, /Service cost reference/);
  assert.match(legal, /服务费用参考/);
  assert.doesNotMatch(chatArea, /sales lead|Repair Estimate AI|Equipment Health Report AI|Health Report/);
  assert.doesNotMatch(welcomeCopy, /sales lead|right conversion action|Lead type/);
  assert.doesNotMatch(legal, /Repair estimate|维修估算/);
});

test('registration copy hides CN email input and routes verification through phone SMS', () => {
  const loginModal = read('frontend/src/components/Auth/LoginModal.jsx');
  const api = read('frontend/src/services/api.js');
  const sidebar = read('frontend/src/components/Sidebar/Sidebar.jsx');

  assert.match(loginModal, /emailRequired: '请输入邮箱'/);
  assert.doesNotMatch(loginModal, /emailAddress: '邮箱/);
  assert.doesNotMatch(loginModal, /emailPlaceholder: '请输入邮箱地址'/);
  assert.match(loginModal, /smsVerificationCode: '短信验证码'/);
  assert.match(loginModal, /emailVerificationCode: 'Email verification code'/);
  assert.match(loginModal, /\{!isCn && \(\s*<div>\s*<label className="block text-sm font-medium mb-1">\{copy\.emailAddress\}<\/label>/);
  assert.match(loginModal, /sendVerifyCode\(\{ phone \}\)/);
  assert.match(loginModal, /sendVerifyCode\(\{ email \}\)/);
  assert.match(loginModal, /fullName: '姓名 \*'/);
  assert.match(loginModal, /fullNamePlaceholder: '请输入姓名'/);
  assert.doesNotMatch(loginModal, /真实姓名/);
  assert.match(api, /sendVerifyCode\(\{ phone, email \}\)/);
  assert.match(api, /JSON\.stringify\(payload\)/);
  assert.match(api, /registerCustomer\(\{ name, phone, email, password, code, company, identity \}\)/);
  assert.match(loginModal, /modalTitle: '登录 \/ 注册'/);
  assert.match(loginModal, /modalTitle: 'Sign In \/ Register'/);
  assert.match(sidebar, /label: isCn \? '登录' : 'Sign In'/);
});

test('international login accepts email or long international phone numbers', () => {
  const loginModal = read('frontend/src/components/Auth/LoginModal.jsx');
  const api = read('frontend/src/services/api.js');

  assert.match(loginModal, /accountLabel: 'Email or phone'/);
  assert.match(loginModal, /accountPlaceholder: 'Email or phone number'/);
  assert.match(loginModal, /const \[loginAccount, setLoginAccount\] = useState\(''\)/);
  assert.match(loginModal, /maxLength=\{24\}/);
  assert.doesNotMatch(loginModal, /phone\.length !== 11/);
  assert.doesNotMatch(loginModal, /placeholder=\{copy\.phonePlaceholder\} maxLength=\{11\}/);
  assert.match(loginModal, /login\(\{ email: credential, password \}\)/);
  assert.match(api, /login\(\{ phone, email, password \}\)/);
  assert.match(api, /JSON\.stringify\(\{ phone, email, password \}\)/);
});

test('registration creates customer accounts without a public role selection step', () => {
  const loginModal = read('frontend/src/components/Auth/LoginModal.jsx');

  assert.match(loginModal, /createAccount: 'Create account'/);
  assert.match(loginModal, /createAccount: '创建账号'/);
  assert.match(loginModal, /identity: 'customer'/);
  assert.match(loginModal, /Keep every service interaction/);
  assert.doesNotMatch(loginModal, /Next: Choose your role/);
  assert.doesNotMatch(loginModal, /选择角色/);
  assert.doesNotMatch(loginModal, /identity-select-customer/);
  assert.doesNotMatch(loginModal, /identity-select-visitor/);
  assert.doesNotMatch(loginModal, /How would you like to use SAGEMRO Service OS/);
  assert.doesNotMatch(loginModal, /I Need Service/);
  assert.doesNotMatch(loginModal, /I'm just browsing \(Guest\)/);
});

test('registration and reset password copy require stronger public passwords', () => {
  const loginModal = read('frontend/src/components/Auth/LoginModal.jsx');

  assert.match(loginModal, /PASSWORD_MIN_LENGTH = 10/);
  assert.match(loginModal, /password\.length < PASSWORD_MIN_LENGTH/);
  assert.match(loginModal, /Password must be at least 10 characters/);
  assert.match(loginModal, /Set a password \(min\. 10 characters\)/);
  assert.match(loginModal, /密码至少需要 10 位/);
  assert.match(loginModal, /设置密码（至少 10 位）/);
  assert.doesNotMatch(loginModal, /at least 6 characters/);
  assert.doesNotMatch(loginModal, /至少 6 位/);
  assert.doesNotMatch(loginModal, /password\.length < 6/);
});

test('AI safety boundary is visible in prompt, chat fallback, and legal notice', () => {
  const workerIndex = read('worker/src/index.js');
  const useChat = read('frontend/src/hooks/useChat.js');
  const legal = read('frontend/src/components/common/LegalModal.jsx');

  assert.match(workerIndex, /AI guidance is preliminary and for reference only/i);
  assert.match(workerIndex, /structured assessment/i);
  assert.match(workerIndex, /likely causes/i);
  assert.match(workerIndex, /Avoid ranking any cause as "#1" or "the root cause"/i);
  assert.match(workerIndex, /electrical, laser, high-pressure gas, hydraulic/i);
  assert.match(workerIndex, /stop operation and require qualified manual confirmation/i);
  assert.match(useChat, /AI guidance is for reference only/);
  assert.match(useChat, /SAGEMRO confirmation/);
  assert.match(legal, /for reference only/);
  assert.match(legal, /qualified manual confirmation/);
});

test('international privacy policy covers beta launch retention, subprocessors, transfers, and GDPR rights', () => {
  const legal = read('frontend/src/components/common/LegalModal.jsx');

  assert.match(legal, /Data Retention/i);
  assert.match(legal, /Storage Regions/i);
  assert.match(legal, /AI and Cloud Subprocessors/i);
  assert.match(legal, /International Transfers/i);
  assert.match(legal, /GDPR \/ UK GDPR Rights/i);
  assert.match(legal, /complaint with your local data protection authority/i);
  assert.match(legal, /standard contractual clauses/i);
});

test('Cloudflare deploy gate runs frontend tests before production deploy jobs', () => {
  const workflow = read('.github/workflows/deploy.yml');

  assert.match(workflow, /name: Frontend tests/);
  assert.match(workflow, /working-directory: frontend\s+run: npm test/);
  assert.ok(
    workflow.indexOf('name: Frontend tests') > workflow.indexOf('name: Frontend lint'),
    'frontend tests should run after lint in the test gate'
  );
  assert.ok(
    workflow.indexOf('name: Frontend tests') < workflow.indexOf('name: Frontend public build'),
    'frontend tests should run before frontend build and deploy'
  );
  assert.ok(
    workflow.indexOf('name: Frontend public build') < workflow.indexOf('name: Frontend AI portal build'),
    'both deterministic frontend artifacts should be verified before deploy'
  );
});

test('shared modal uses one scroll surface without a trailing blank area', () => {
  const modal = read('frontend/src/components/common/Modal.jsx');

  assert.match(modal, /max-h-\[calc\(100dvh-16px\)\][\s\S]*overflow-y-auto/);
  assert.doesNotMatch(modal, /z-50 flex flex-col/);
  assert.match(modal, /sticky top-0 z-10/);
  assert.match(modal, /<div className="p-3 sm:p-4">/);
  assert.doesNotMatch(modal, /<div className="min-h-0 overflow-y-auto/);
});

test('engineer recruiting page presents the approved partnership story and application flow', () => {
  const recruiting = read('frontend/src/components/Engineer/EngineerRecruitingPage.jsx');

  assert.match(recruiting, /modalOpen/);
  assert.match(recruiting, /networkLabel: '工业设备服务合作计划'/);
  assert.match(recruiting, /networkLabel: 'Industrial Service Partner Program'/);
  assert.match(recruiting, /title: '品牌、系统、推广免费给，你只管把技术做到极致'/);
  assert.match(recruiting, /title: 'We bring the brand, the systems and the reach\. You bring the craft\.'/);
  assert.match(recruiting, /琐碎的交给平台，值钱的留给你/);
  assert.match(recruiting, /Hand over the overhead\. Keep the work that pays\./);
  assert.match(recruiting, /免费品牌授权/);
  assert.match(recruiting, /免费管理系统/);
  assert.match(recruiting, /统一品牌宣传/);
  assert.match(recruiting, /视频、公众号与搜索引擎推广/);
  assert.match(recruiting, /供应链与备件管理/);
  assert.match(recruiting, /AI 知识库运营/);
  assert.match(recruiting, /合作制而非雇佣制/);
  assert.match(recruiting, /账目透明，多劳多得/);
  assert.match(recruiting, /第一年免加盟费/);
  assert.match(recruiting, /AI 不抢你的活，只把专业回复做到越来越准/);
  assert.match(recruiting, /AI is not here to take your work/);
  assert.match(recruiting, /Apply to Join/);
  assert.match(recruiting, /explain the brand licence and system access steps/);
  assert.doesNotMatch(recruiting, /AI-assisted industrial service platform|verified service pool|Certified Representative/);
  assert.doesNotMatch(recruiting, /Paid field service opportunities/);
  assert.doesNotMatch(recruiting, /Payment confirmation first/);
  assert.doesNotMatch(recruiting, /被看见、被支持、被认真对待/);
  assert.match(recruiting, /fixed inset-0 z-50/);
});

test('client shell keeps history and service actions while public tools and insights remain on the website', () => {
  const sidebar = read('frontend/src/components/Sidebar/Sidebar.jsx');
  const app = read('frontend/src/App.jsx');
  const chatHistory = read('frontend/src/components/Sidebar/ChatHistory.jsx');
  const industryToolsModal = read('frontend/src/components/Tools/IndustryToolsModal.jsx');
  const industryToolCalculator = read('frontend/src/components/Tools/IndustryToolCalculator.jsx');
  const industryToolsPage = read('frontend/src/components/Tools/IndustryToolsPage.jsx');
  const industryTools = read('frontend/src/data/industryTools.js');
  const insightsPage = read('frontend/src/components/Insights/InsightsPage.jsx');
  const insights = read('frontend/src/data/insights.js');
  const redirects = read('frontend/public/_redirects');

  assert.match(sidebar, /onOpenHistory/);
  assert.doesNotMatch(sidebar, /onOpenIndustryTools|tool-industry-tools|tool-insights/);
  assert.match(sidebar, /History/);
  assert.doesNotMatch(sidebar, /label:.*(?:'Tools'|'Insights')/);
  const welcome = read('frontend/src/components/Chat/WelcomePage.jsx');
  assert.doesNotMatch(welcome, /t\.resources|t\.resourceTitle|Calculator/);
  assert.match(welcome, /t\.headline/);
  assert.match(sidebar, /w-\[184px\]/);
  assert.doesNotMatch(sidebar, /<ChatHistory/);
  assert.match(app, /historyModalOpen/);
  assert.doesNotMatch(app, /industryToolsOpen|onOpenIndustryTools|IndustryToolsModal/);
  assert.match(app, /currentPath === '\/tools'/);
  assert.match(app, /currentPath\.startsWith\('\/tools\/'\)/);
  assert.match(app, /currentPath === '\/insights'/);
  assert.match(app, /currentPath\.startsWith\('\/insights\/'\)/);
  assert.match(app, /<ChatHistory/);
  assert.match(app, /<IndustryToolsPage/);
  assert.match(app, /<InsightsPage/);
  assert.match(chatHistory, /Conversation History/);
  assert.match(chatHistory, /Search conversations/);
  assert.doesNotMatch(industryToolsModal, /<IndustryToolCalculator/);
  assert.match(industryToolsModal, /href="\/tools\/"/);
  assert.match(industryToolsModal, /All tools/);
  assert.match(industryToolsModal, /href="\/insights\/"/);
  assert.match(industryToolsModal, /publicIndustryTools\.map/);
  assert.doesNotMatch(industryToolsModal, /industryTools\.map/);
  assert.match(industryToolCalculator, /reviewActionLabel/);
  assert.match(industryToolsPage, /href=\{`\/tools\/\$\{tool\.slug\}\/`\}/);
  assert.match(industryToolsPage, /max-w-7xl/);
  assert.match(industryToolsPage, /md:grid-cols-2/);
  assert.doesNotMatch(industryToolsPage, /lg:grid-cols-3/);
  assert.match(industryToolsPage, /<a href="\/" className="mb-5 flex w-fit items-center/);
  assert.match(industryToolsPage, /setSeoMetadata\(/);
  assert.match(industryToolsPage, /publicIndustryTools\.map/);
  assert.match(industryToolsPage, /publicIndustryTools\.filter/);
  assert.match(industryToolsPage, /getIndustryToolsSeoMetadata/);
  assert.match(industryToolsPage, /robots: seoMetadata\.robots/);
  assert.match(industryToolsPage, /referenceItems/);
  assert.match(industryToolsPage, /ToolReferenceItem/);
  assert.match(industryToolsPage, /Material range/);
  assert.match(industryToolsPage, /Profile coverage/);
  assert.match(industryToolsPage, /Planning boundary/);
  assert.match(industryToolsPage, /bg-\[#0f171d\]/);
  assert.match(industryToolsPage, /border-white\/10/);
  assert.match(industryToolsPage, /md:border-l/);
  assert.match(industryTools, /Metal Weight Calculator/);
  assert.match(industryTools, /Steel Price Watch/);
  assert.match(industryTools, /Laser Cutting Cost Calculator/);
  assert.match(industryTools, /Press Brake Tonnage Calculator/);
  assert.match(industryTools, /Assist Gas Consumption Calculator/);
  assert.match(industryTools, /Laser Cutting Speed Reference/);
  assert.match(industryTools, /V-die and Bend Allowance Helper/);
  assert.match(industryTools, /Equipment ROI Calculator/);
  assert.match(industryTools, /Chiller and Dust Collector Sizing/);
  assert.match(industryTools, /densityKgM3/);
  assert.match(industryTools, /market reference for planning/i);
  assert.match(industryTools, /metal-weight-calculator/);
  assert.match(industryTools, /steel-price-watch/);
  assert.match(industryTools, /laser-assist-gas-consumption-calculator/);
  assert.match(industryTools, /laser-cutting-speed-reference/);
  assert.match(industryTools, /press-brake-v-die-bend-allowance-helper/);
  assert.match(industryTools, /laser-cutting-machine-roi-calculator/);
  assert.match(industryTools, /laser-chiller-dust-collector-sizing-checklist/);
  assert.doesNotMatch(industryToolsPage, /Planned next calculators/);
  assert.match(insightsPage, /SAGEMRO Insights/);
  assert.match(insightsPage, /href=\{`\/tools\/\$\{insight\.toolSlug\}\/`\}/);
  assert.match(insights, /laser-cutting-cost-drivers/);
  assert.match(insights, /metal-weight-for-structural-profiles/);
  assert.match(redirects, /\/work-orders\/\* \/ 200/);
  assert.doesNotMatch(redirects, /^\/\* \/index\.html 200$/m);
});

test('public industry tool detail prioritizes calculator before related tools and exposes AI review CTA', () => {
  const industryToolsPage = read('frontend/src/components/Tools/IndustryToolsPage.jsx');
  const industryToolCalculator = read('frontend/src/components/Tools/IndustryToolCalculator.jsx');

  const calculatorIndex = industryToolsPage.indexOf('<IndustryToolCalculator');
  const relatedToolsIndex = industryToolsPage.indexOf('<aside aria-label="Related tools"');

  assert.ok(calculatorIndex > -1, 'tool detail should render the calculator');
  assert.ok(relatedToolsIndex > -1, 'tool detail should render related tools');
  assert.ok(
    calculatorIndex < relatedToolsIndex,
    'calculator should appear before related tools in DOM order so mobile users reach the tool first'
  );
  assert.match(industryToolsPage, /handleSendToolReview/);
  assert.match(industryToolsPage, /<IndustryToolCalculator tool=\{tool\} values=\{values\} onChange=\{onChange\} onSendMessage=\{handleSendToolReview\}/);
  assert.match(industryToolsPage, /buildCustomerPortalUrl/);
  assert.match(industryToolsPage, /navigator\.clipboard\.writeText\(prompt\)/);
  assert.match(industryToolsPage, /window\.location\.assign\(portalUrl\)/);
  assert.match(industryToolCalculator, /reviewActionLabel/);
});

test('industry calculator result card makes estimate limits visible', () => {
  const industryToolCalculator = read('frontend/src/components/Tools/IndustryToolCalculator.jsx');

  assert.match(industryToolCalculator, /Planning estimate/);
  assert.match(industryToolCalculator, /Confirm before production or purchasing/);
  assert.match(industryToolCalculator, /result\.note/);
});

test('public legal and tool copy use transparent reviewed-engineer wording', () => {
  const legal = read('frontend/src/components/common/LegalModal.jsx');
  const industryTools = read('frontend/src/data/industryTools.js');
  const toolsCalculator = read('frontend/src/components/Tools/IndustryToolCalculator.jsx');

  assert.match(legal, /qualified engineers reviewed by SAGEMRO/);
  assert.match(legal, /合格工程师或经 SAGEMRO 审核的服务人员/);
  assert.doesNotMatch(legal, /SAGEMRO-designated service personnel/);
  assert.match(industryTools, /supplier quotes decide final purchasing cost/i);
  assert.match(toolsCalculator, /steelPriceReferences/);
  assert.doesNotMatch(industryTools, /not a supplier quote/i);
  assert.doesNotMatch(toolsCalculator, /not a supplier quote/i);
});
