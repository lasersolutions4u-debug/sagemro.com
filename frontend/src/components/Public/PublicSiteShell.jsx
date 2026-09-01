import { Footer } from '../common/Footer';

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
    <div className="min-h-screen bg-[#f6f8f5] text-[#18241f] antialiased">
      <header className="sticky top-0 z-40 border-b border-[#dfe6e1] bg-[#f6f8f5]/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1240px] flex-wrap items-center justify-between gap-3 px-5 py-2 lg:px-8">
          <a href="/" className="flex min-h-11 items-center gap-3" aria-label={isCn ? 'SAGEMRO 首页' : 'SAGEMRO home'}>
            <span className="grid h-9 w-9 place-items-center rounded-sm bg-[#176b4b] text-sm font-black tracking-tight text-white">S</span>
            <span>
              <strong className="block text-[15px] tracking-[0.16em]">SAGEMRO</strong>
              <span className="block text-[10px] uppercase tracking-[0.15em] text-[#63716a]">
                {isCn ? '工业设备服务' : 'Industrial equipment service'}
              </span>
            </span>
          </a>

          <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto border-t border-[#dfe6e1] pt-2 md:order-2 md:w-auto md:border-0 md:pt-0" aria-label={isCn ? '主导航' : 'Main navigation'}>
            {navigation[market].map(([label, href]) => (
              <a key={href} href={href} className="flex min-h-11 shrink-0 items-center px-3 text-sm font-medium text-[#425149] hover:text-[#176b4b]">
                {label}
              </a>
            ))}
            {isCn ? (
              <span aria-disabled="true" title="购物链接准备中" className="flex min-h-11 shrink-0 items-center px-3 text-sm font-medium text-[#87938c]">
                商城（筹备中）
              </span>
            ) : (
              <a href={INTERNATIONAL_STORE_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-11 shrink-0 items-center px-3 text-sm font-medium text-[#425149] hover:text-[#176b4b]">
                Store
              </a>
            )}
          </nav>

          <a href={portalHref} className="order-2 flex min-h-11 items-center rounded-sm border border-[#176b4b] px-4 text-sm font-semibold text-[#176b4b] hover:bg-[#e7f1eb] md:order-3">
            {isCn ? '客户服务系统' : 'Customer service system'}
          </a>
        </div>
      </header>

      <main>{children}</main>

      <section className="border-t border-[#dfe6e1] bg-[#edf2ee] px-5 py-7" aria-label={isCn ? '联系支持' : 'Contact support'}>
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-3 sm:flex-row sm:items-center lg:px-3">
          <div>
            <p className="text-sm font-semibold">{isCn ? '需要补充资料或咨询服务范围？' : 'Need to clarify scope or provide supporting information?'}</p>
            <p className="mt-1 text-sm text-[#63716a]">{isCn ? '通过统一服务入口提交最完整，邮件用于补充沟通。' : 'The service request is the primary intake; email is available for follow-up.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {isCn ? (
              <span aria-disabled="true" className="flex min-h-11 items-center text-sm font-medium text-[#87938c]">商城（筹备中）</span>
            ) : (
              <a href={INTERNATIONAL_STORE_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center text-sm font-semibold text-[#176b4b] underline decoration-[#9bbcac] underline-offset-4">Store</a>
            )}
            <a href="mailto:support@sagemro.com" className="flex min-h-11 items-center text-sm font-semibold text-[#176b4b] underline decoration-[#9bbcac] underline-offset-4">
              support@sagemro.com
            </a>
          </div>
        </div>
      </section>
      <Footer onOpenLegal={onOpenLegal} />
    </div>
  );
}
