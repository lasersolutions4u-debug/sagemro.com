export function BrandMark({
  className = '',
  title = 'SAGEMRO',
  variant = 'mark',
}) {
  const src = variant === 'logo' ? '/sagemro-logo.png' : '/sagemro-brand-mark.svg';

  return (
    <img
      className={className}
      src={src}
      alt={title}
      loading="eager"
      decoding="async"
    />
  );
}
