export function BrandMark({
  className = '',
  title = 'SAGEMRO',
}) {
  return (
    <img
      className={className}
      src="/sagemro-brand-mark.svg"
      alt={title}
      loading="eager"
      decoding="async"
    />
  );
}
