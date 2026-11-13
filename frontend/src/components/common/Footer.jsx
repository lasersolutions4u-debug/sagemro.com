import { isCnLocale } from '../../utils/locale';
// 法人名与备案号从公司实体数据源取，供页脚与结构化数据共用同一个值。
import { ICP_RECORD_NUMBER, getLegalEntity } from '../../data/companyProfile.js';

export function Footer({ onOpenLegal, compact = false }) {
  const isCn = isCnLocale();
  // 运营主体的声明按市场取：COM 是 SAGEMRO LLC（Wyoming），CN 是济南钰峭机械有限公司。
  // 这一句同时回答「谁收钱」与「为什么没有美国办公室」，也是银行/渠道尽调最先找的一句话。
  const entity = getLegalEntity(isCn ? 'zh-CN' : 'en');
  const companyLine = '© 2026 SAGEMRO — AI-powered equipment service platform';
  const companyLineCn = '© 2026 SAGEMRO — AI 驱动的设备服务平台';
  const legalLabel = isCn ? '规则与说明' : 'Terms, Privacy & AI Notice';
  const technicalReviewLabel = isCn ? '技术审核' : 'Technical review';
  const aboutLabel = isCn ? '关于我们' : 'About';
  const contactLabel = isCn ? '联系我们' : 'Contact';
  // 退款政策必须有站内可见入口：支付机构与银行审核找的是这个链接，不是弹窗。
  const refundLabel = isCn ? '付款与退款' : 'Refunds';
  const icpLink = isCn ? (
    <>
      <span className="text-[var(--color-border)]">|</span>
      <a
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noreferrer"
        className="hover:text-[var(--color-primary)] transition-colors"
      >
        {ICP_RECORD_NUMBER}
      </a>
    </>
  ) : null;

  if (compact) {
    return (
      <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-text-muted)]">
        <span>{isCn ? companyLineCn : companyLine}</span>
        {icpLink}
        <span className="text-[var(--color-border)]">|</span>
        <a href="/about/" className="hover:text-[var(--color-primary)] transition-colors">{aboutLabel}</a>
        <span className="text-[var(--color-border)]">|</span>
        <a href="/contact/" className="hover:text-[var(--color-primary)] transition-colors">{contactLabel}</a>
        <span className="text-[var(--color-border)]">|</span>
        <a href="/refund-policy/" className="hover:text-[var(--color-primary)] transition-colors">{refundLabel}</a>
        <span className="text-[var(--color-border)]">|</span>
        <a href="/about/technical-review/" className="hover:text-[var(--color-primary)] transition-colors">{technicalReviewLabel}</a>
        <span className="text-[var(--color-border)]">|</span>
        <button onClick={() => onOpenLegal?.('agreement')} className="hover:text-[var(--color-primary)] transition-colors">{legalLabel}</button>
      </footer>
    );
  }

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-sidebar)] px-4 py-3 text-center space-y-1">
      <div className="flex items-center justify-center gap-3 text-[11px] text-[var(--color-text-muted)]">
        <a href="/about/" className="hover:text-[var(--color-primary)] transition-colors">{aboutLabel}</a>
        <a href="/contact/" className="hover:text-[var(--color-primary)] transition-colors">{contactLabel}</a>
        <a href="/refund-policy/" className="hover:text-[var(--color-primary)] transition-colors">{refundLabel}</a>
        <a href="/about/technical-review/" className="hover:text-[var(--color-primary)] transition-colors">{technicalReviewLabel}</a>
        <button onClick={() => onOpenLegal?.('agreement')} className="hover:text-[var(--color-primary)] transition-colors">{legalLabel}</button>
      </div>
      <p className="mx-auto max-w-3xl text-[10px] leading-5 text-[var(--color-text-muted)]">
        {entity.operatingEntityStatement}
      </p>
      <p className="text-[10px] text-[var(--color-text-muted)]">
        {isCn ? companyLineCn : companyLine}
      </p>
      {isCn && (
        <p className="text-[10px] text-[var(--color-text-muted)]">
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--color-primary)] transition-colors"
          >
            {ICP_RECORD_NUMBER}
          </a>
        </p>
      )}
    </footer>
  );
}
