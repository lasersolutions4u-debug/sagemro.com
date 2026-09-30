export function BrandMark({
  className = '',
  title = 'SAGEMRO',
}) {
  return (
    <img
      className={className}
      // 用批准版 logo 的 192px 派生副本，而不是 512px 原图（124 KB，曾是每页最大的资源，
      // 因为 favicon 也指向它）。BrandMark 最大显示 44px、壳里 60px，
      // 3 倍屏分别需要 132px / 180px——192px 够用，且已在真实显示尺寸下逐尺寸比对过画质。
      // 512px 原图仍用于 Organization.logo 结构化数据（只被爬虫取，不进页面渲染）。
      // ⚠️ 不能用 favicon.svg 顶替：它是另一个更简化的标记（只有头部轮廓），不是这本 logo。
      src="/sagemro-logo-192.png"
      alt={title}
      loading="eager"
      decoding="async"
    />
  );
}
