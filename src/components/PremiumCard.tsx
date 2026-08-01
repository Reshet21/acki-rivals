import { useRef, useState, useCallback } from 'react';

/**
 * CardTilt — wraps children with 3D perspective tilt on pointer move.
 * Blizzard-quality hover interaction.
 */
export default function CardTilt({
  children,
  className = '',
  glareEnabled = true,
  scale = 1.05,
  maxTilt = 15,
}: {
  children: React.ReactNode;
  className?: string;
  glareEnabled?: boolean;
  scale?: number;
  maxTilt?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('');
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const tiltX = (0.5 - y) * maxTilt;
    const tiltY = (x - 0.5) * maxTilt;
    setTransform(`perspective(600px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${scale})`);
    setGlarePos({ x: x * 100, y: y * 100, opacity: 0.15 });
  }, [maxTilt, scale]);

  const handleLeave = useCallback(() => {
    setTransform('perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)');
    setGlarePos({ x: 50, y: 50, opacity: 0 });
  }, []);

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{
        transform,
        transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
      }}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {children}
      {/* Glare overlay */}
      {glareEnabled && (
        <div
          className="absolute inset-0 pointer-events-none rounded-xl"
          style={{
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,${glarePos.opacity}) 0%, transparent 60%)`,
            transition: 'opacity 0.3s',
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
}
