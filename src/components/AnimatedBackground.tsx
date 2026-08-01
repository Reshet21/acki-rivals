/**
 * AnimatedBackground — Shared premium background for all screens.
 * Aurora blobs, floating particles, sparkles, and optional grid.
 */
export default function AnimatedBackground({
  variant = 'default',
  particleCount = 6,
}: {
  variant?: 'default' | 'battle' | 'shop' | 'pvp';
  particleCount?: number;
}) {
  const auroras = {
    default: [
      { color: 'rgba(255,215,0,0.08)', top: '-150px', left: '-100px', size: 400, anim: 'animate-aurora-1' },
      { color: 'rgba(255,100,0,0.06)', bottom: '5%', right: '-80px', size: 350, anim: 'animate-aurora-2', delay: '4s' },
      { color: 'rgba(0,212,255,0.05)', top: '30%', left: '30%', size: 300, anim: 'animate-aurora-3', delay: '8s' },
    ],
    battle: [
      { color: 'rgba(255,61,0,0.1)', top: '-100px', left: '-100px', size: 450, anim: 'animate-aurora-1' },
      { color: 'rgba(255,140,0,0.08)', bottom: '10%', right: '-100px', size: 400, anim: 'animate-aurora-2', delay: '3s' },
      { color: 'rgba(255,0,0,0.05)', top: '50%', left: '20%', size: 350, anim: 'animate-aurora-3', delay: '7s' },
    ],
    shop: [
      { color: 'rgba(168,85,247,0.08)', top: '-120px', left: '-80px', size: 400, anim: 'animate-aurora-1' },
      { color: 'rgba(255,215,0,0.08)', bottom: '0%', right: '-60px', size: 350, anim: 'animate-aurora-2', delay: '5s' },
      { color: 'rgba(139,92,246,0.06)', top: '40%', left: '40%', size: 300, anim: 'animate-aurora-3', delay: '10s' },
    ],
    pvp: [
      { color: 'rgba(255,61,0,0.1)', top: '-100px', right: '-100px', size: 450, anim: 'animate-aurora-1' },
      { color: 'rgba(255,152,0,0.07)', bottom: '10%', left: '-80px', size: 400, anim: 'animate-aurora-2', delay: '3s' },
      { color: 'rgba(0,212,255,0.05)', top: '30%', left: '30%', size: 300, anim: 'animate-aurora-3', delay: '8s' },
    ],
  };

  const particleColors = ['rgba(255,215,0,0.4)', 'rgba(255,61,0,0.3)', 'rgba(0,212,255,0.3)', 'rgba(168,85,247,0.3)'];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Animated grid */}
      <div className="absolute inset-0 bg-grid-sm animate-grid-scroll opacity-40" />

      {/* Aurora blobs */}
      {auroras[variant].map((a, i) => (
        <div
          key={i}
          className={`absolute rounded-full ${a.anim}`}
          style={{
            width: a.size,
            height: a.size,
            top: a.top,
            left: a.left,
            bottom: a.bottom,
            right: a.right,
            background: `radial-gradient(circle, ${a.color} 0%, transparent 70%)`,
            animationDelay: a.delay,
          }}
        />
      ))}

      {/* Floating particles */}
      {Array.from({ length: particleCount }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-particle"
          style={{
            width: `${2 + (i * 1.3) % 4}px`,
            height: `${2 + (i * 1.3) % 4}px`,
            borderRadius: '50%',
            background: particleColors[i % particleColors.length],
            left: `${10 + (i * 13) % 80}%`,
            bottom: '-10px',
            '--duration': `${8 + (i * 2.7) % 12}s`,
            '--delay': `${(i * 1.7) % 10}s`,
          } as React.CSSProperties}
        />
      ))}

      {/* Sparkles */}
      {[
        { top: '12%', left: '8%', delay: '0s', size: 'sm' },
        { top: '35%', right: '6%', delay: '1.2s', size: 'md' },
        { top: '65%', left: '4%', delay: '2.4s', size: 'sm' },
        { top: '80%', right: '12%', delay: '0.8s', size: 'md' },
      ].map((p, i) => (
        <div
          key={i}
          className="absolute animate-sparkle"
          style={{ ...p, color: 'rgba(255,215,0,0.35)' } as React.CSSProperties}
        >
          {p.size === 'md' ? '✧' : '·'}
        </div>
      ))}

      {/* Scan line CRT effect */}
      <div className="scan-line" />
    </div>
  );
}
