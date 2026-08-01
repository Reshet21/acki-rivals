import { useCallback, useRef } from 'react';

/**
 * PremiumButton — Blizzard-quality button with ripple, glow, and depth.
 */
export default function PremiumButton({
  children,
  onClick,
  variant = 'primary', // primary | danger | ghost | gold
  size = 'md', // sm | md | lg
  disabled = false,
  className = '',
  icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'danger' | 'ghost' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  icon?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  const variants = {
    primary: {
      bg: 'linear-gradient(135deg, #0066ff 0%, #0044cc 50%, #0033aa 100%)',
      border: '1px solid rgba(0,150,255,0.4)',
      shadow: '0 4px 20px rgba(0,100,255,0.3), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)',
      hoverShadow: '0 6px 30px rgba(0,100,255,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
      text: 'white',
    },
    danger: {
      bg: 'linear-gradient(135deg, #FF3D00 0%, #CC2200 50%, #AA1A00 100%)',
      border: '1px solid rgba(255,80,0,0.4)',
      shadow: '0 4px 20px rgba(255,61,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)',
      hoverShadow: '0 6px 30px rgba(255,61,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
      text: 'white',
    },
    ghost: {
      bg: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      shadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      hoverShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
      text: 'rgba(255,255,255,0.7)',
    },
    gold: {
      bg: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)',
      border: '1px solid rgba(255,200,0,0.5)',
      shadow: '0 4px 20px rgba(255,180,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.15)',
      hoverShadow: '0 6px 30px rgba(255,180,0,0.5), inset 0 1px 0 rgba(255,255,255,0.4)',
      text: '#1a1a1a',
    },
  };

  const sizes = {
    sm: 'px-4 py-2 text-xs rounded-lg',
    md: 'px-6 py-3 text-sm rounded-xl',
    lg: 'px-8 py-4 text-base rounded-2xl',
  };

  const v = variants[variant];

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    // Ripple
    const btn = ref.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      ripple.style.cssText = `
        position: absolute; border-radius: 50%; pointer-events: none;
        width: ${size}px; height: ${size}px;
        left: ${e.clientX - rect.left - size / 2}px;
        top: ${e.clientY - rect.top - size / 2}px;
        background: rgba(255,255,255,0.2);
        transform: scale(0); opacity: 1;
        animation: ripple-expand 0.5s ease-out forwards;
      `;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    }

    onClick?.();
  }, [disabled, onClick]);

  return (
    <button
      ref={ref}
      onClick={handleClick}
      disabled={disabled}
      className={`
        relative overflow-hidden font-bold flex items-center justify-center gap-2
        transition-all duration-200 active:scale-[0.97]
        disabled:opacity-40 disabled:cursor-not-allowed
        font-body
        ${sizes[size]} ${className}
      `}
      style={{
        background: v.bg,
        border: v.border,
        boxShadow: v.shadow,
        color: v.text,
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLElement).style.boxShadow = v.hoverShadow;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = v.shadow;
      }}
    >
      {icon && <span className="text-lg">{icon}</span>}
      {children}
    </button>
  );
}
