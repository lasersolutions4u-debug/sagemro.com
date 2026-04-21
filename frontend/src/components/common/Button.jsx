import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary:
    'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white disabled:bg-[var(--color-text-muted)]',
  secondary:
    'bg-[var(--color-surface-elevated)] hover:bg-[var(--color-hover)] text-[var(--color-text-primary)] border border-[var(--color-border)] dark:border-[var(--color-border-strong)]',
  danger:
    'bg-red-500 hover:bg-red-600 text-white disabled:bg-red-500/50',
  ghost:
    'bg-transparent hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
  link:
    'bg-transparent hover:underline text-[var(--color-primary)] px-0 py-0',
};

const SIZES = {
  sm: 'px-3 py-2 text-xs rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-xl',
  lg: 'px-5 py-3 text-sm rounded-xl',
};

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  const variantCls = VARIANTS[variant] || VARIANTS.primary;
  const sizeCls = variant === 'link' ? '' : SIZES[size] || SIZES.md;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center gap-2 font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 focus:ring-offset-[var(--color-surface)]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variantCls,
        sizeCls,
        fullWidth ? 'w-full' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!loading && rightIcon}
    </button>
  );
});
