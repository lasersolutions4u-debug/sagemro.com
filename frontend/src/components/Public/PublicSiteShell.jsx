import { Footer } from '../common/Footer';
import { BrandMark } from '../common/BrandMark';

const INTERNATIONAL_STORE_URL = 'https://www.dhgate.com/store/sagemro';

const navigation = {
  cn: [
    ['服务项目', '/services/'],
    ['支持品牌', '/brands/'],
    ['实用工具', '/tools/'],
    ['技术洞察', '/insights/'],
  ],
  com: [
    ['Services', '/services/'],
    ['Brands', '/brands/'],
    ['Tools', '/tools/'],
    ['Insights', '/insights/'],
  ],
};

export function PublicSiteShell({ children, isCn, onOpenLegal }) {
  const market = isCn ? 'cn' : 'com';
  const portalHref = isCn ? 'https://ai.sagemro.cn' : 'https://ai.sagemro.com';

  return (
    <div className="min-h-screen bg-[#f7f3ed] text-[#21160c] antialiased">
      <header className="sticky top-0 z-40 border-b border-[#e6dccf] bg-[#fffdf8]/95 shadow-[0_1px_0_rgba(45,33,22,0.03)] backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1240px] flex-wrap items-center justify-between gap-3 px-5 py-2 lg:px-8">
          <a href="/" className="flex min-h-11 items-center gap-3" aria-label={isCn ? 'SAGEMRO 首页' : 'SAGEMRO home'}>
            <BrandMark className="h-11 w-11 shrink-0 object-contain" />
            <span>
              <strong className="block text-[15px] tracking-[0.16em] text-[#1a1a1a]">SAGEMRO</strong>
              <span className="block text-[10px] uppercase tracking-[0.15em] text-[#756552]">
                {isCn ? '工业设备服务' : 'Industrial equipment service'}
              </span>
            </span>
          </a>

          <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto border-t border-[#e6dccf] pt-2 md:order-2 md:w-auto md:border-0 md:pt-0" aria-label={isCn ? '主导航' : 'Main navigation'}>
            {navigation[market].map(([label, href]) => (
              <a key={href} href={href} className="flex min-h-11 shrink-0 items-center px-3 text-sm font-medium text-[#5f5142] transition-colors hover:text-[#d97706]">
                {label}
              </a>
            ))}
            {isCn ? (
              <span aria-disabled="true" title="购物链接准备中" className="flex min-h-11 shrink-0 items-center px-3 text-sm font-medium text-[#a39686]">
                商城（筹备中）
              </span>
            ) : (
              <a href={INTERNATIONAL_STORE_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-11 shrink-0 items-center px-3 text-sm font-medium text-[#5f5142] transition-colors hover:text-[#d97706]">
                Store
              </a>
            )}
          </nav>

          <a href={portalHref} className="order-2 flex min-h-11 items-center rounded-lg border border-[#d97706] bg-[#f59e0b] px-4 text-sm font-semibold text-[#21160c] shadow-sm transition-colors hover:bg-[#fbbf24] md:order-3">
            {isCn ? '客户服务系统' : 'Customer service system'}
          </a>
        </div>
      </header>

      <main>{children}</main>

      <section className="border-t border-[#e6dccf] bg-[#f4ede3] px-5 py-7" aria-label={isCn ? '联系支持' : 'Contact support'}>
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-3 sm:flex-row sm:items-center lg:px-3">
          <div>
            <p className="text-sm font-semibold">{isCn ? '需要补充资料或咨询服务范围？' : 'Need to clarify scope or provide supporting information?'}</p>
            <p className="mt-1 text-sm text-[#756552]">{isCn ? '通过统一服务入口提交最完整，邮件用于补充沟通。' : 'The service request is the primary intake; email is available for follow-up.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {isCn ? (
              <span aria-disabled="true" className="flex min-h-11 items-center text-sm font-medium text-[#a39686]">商城（筹备中）</span>
            ) : (
              <a href={INTERNATIONAL_STORE_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center text-sm font-semibold text-[#b45309] underline decoration-[#e7b65b] underline-offset-4">Store</a>
            )}
            <a href="mailto:support@sagemro.com" className="flex min-h-11 items-center text-sm font-semibold text-[#b45309] underline decoration-[#e7b65b] underline-offset-4">
              support@sagemro.com
            </a>
          </div>
        </div>
      </section>
      <Footer onOpenLegal={onOpenLegal} />
    </div>
  );
}
