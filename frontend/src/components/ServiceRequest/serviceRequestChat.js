import { createEmptyServiceRequestDraft, normalizeServiceRequestDraft } from './serviceRequestDraft.js';

const LABELS = {
  repair: ['设备维修', 'equipment repair'],
  maintenance: ['检测与维护保养', 'inspection and maintenance'],
  retrofit: ['升级与改造', 'upgrade and retrofit'],
  relocation: ['搬迁与安装', 'relocation and installation'],
  used_equipment: ['旧设备评估与处置', 'used-equipment evaluation'],
  parts: ['配件与耗材', 'parts and consumables'],
};

export function getServiceChatLabel(presets = {}, isCn = false) {
  return LABELS[presets.service_kind]?.[isCn ? 0 : 1] || (isCn ? '设备服务' : 'equipment service');
}

export function composeServiceChatMessage(content, presets = {}, isCn = false) {
  const label = getServiceChatLabel(presets, isCn);
  const context = isCn
    ? `【服务请求填写辅助：${label}】请通过对话协助整理需求，优先询问尚缺的设备、服务目标、地区和紧急程度，每次只问少量必要问题。入口类型仅供参考，以客户实际描述为准。不要代客户提交工单，不要承诺诊断、报价或派工；提醒客户点击“整理并填写服务单”，核对表单后自行提交。`
    : `[Service request preparation: ${label}] Help prepare a service request through conversation. Ask a few necessary questions at a time about missing equipment details, service goals, location and urgency. The entry category is only a starting point; follow the customer's actual needs. Do not submit an order or promise a diagnosis, price or dispatch. Direct the customer to "Prepare service form" to review and submit the form themselves.`;
  return `${context}\n\n${content}`;
}

export async function prepareServiceRequestFromChat({ messages = [], presets = {}, assist }) {
  const message = messages.filter((item) => item.role === 'user' && typeof item.content === 'string')
    .map((item) => item.content.trim()).filter(Boolean).join('\n\n');
  if (!message) throw new Error('empty_chat');
  if (message.length > 4000) throw new Error('chat_too_long');
  const draft = createEmptyServiceRequestDraft({ mode: 'manual', presets: { ...presets, description: message } });
  const result = await assist({ message, draft });
  if (!result?.patch || typeof result.patch !== 'object' || Array.isArray(result.patch)) throw new Error('invalid_assist');
  return normalizeServiceRequestDraft({
    ...draft,
    ...result.patch,
    description: message,
    contact: { ...draft.contact, ...result.patch.contact },
    submission_key: draft.submission_key,
    mode: 'manual',
    step: 1,
    files: [],
  });
}
