export function BrandMark({
  className = '',
  title = 'SAGEMRO',
}) {
  return (
    <img
      className={className}
      src="/sagemro-logo.png"
      alt={title}
      loading="eager"
      decoding="async"
    />
  );
}
