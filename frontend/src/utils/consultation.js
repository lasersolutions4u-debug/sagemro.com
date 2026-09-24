// 咨询线索表单由 App 托管。公开营销页（外壳导航、首页 CTA）通过事件请求打开它，
// 而不是逐页透传回调 —— 与 api.js 里 `sagemro:auth-expired` 的做法保持一致。
export const CONSULTATION_OPEN_EVENT = 'sagemro:open-consultation';

export function openConsultationForm() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONSULTATION_OPEN_EVENT));
  }
}
