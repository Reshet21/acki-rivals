import { useRef, useEffect } from 'react';

/**
 * StarfieldCanvas — full-screen canvas with parallax starfield + nebula.
 * Renders at 30fps for battery savings. Uses requestAnimationFrame.
 */
export default function StarfieldCanvas({ speed = 1 }: { speed?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let w = 0;
    let h = 0;

    // Star layers (back → front, increasingly bright)
    interface Star { x: number; y: number; r: number; speed: number; brightness: number; twinkle: number; twinkleSpeed: number; }
    const layers: Star[][] = [[], [], []];
    const LAYER_COUNTS = [80, 50, 20];
    const LAYER_SPEEDS = [0.15, 0.4, 0.9];
    const LAYER_BRIGHTNESS = [0.3, 0.6, 1.0];

    const init = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      layers.forEach((layer, li) => {
        layer.length = 0;
        for (let i = 0; i < LAYER_COUNTS[li]; i++) {
          layer.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: 0.5 + Math.random() * (li === 2 ? 2 : 1.2),
            speed: LAYER_SPEEDS[li] * (0.8 + Math.random() * 0.4),
            brightness: LAYER_BRIGHTNESS[li] * (0.7 + Math.random() * 0.3),
            twinkle: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.02 + Math.random() * 0.04,
          });
        }
      });
    };

    init();

    // Nebula blobs
    interface Nebula { x: number; y: number; r: number; color: string; speed: number; phase: number; }
    const nebulae: Nebula[] = [
      { x: w * 0.2, y: h * 0.3, r: Math.min(w, h) * 0.35, color: 'rgba(255,215,0,0.025)', speed: 0.08, phase: 0 },
      { x: w * 0.8, y: h * 0.7, r: Math.min(w, h) * 0.3, color: 'rgba(255,61,0,0.02)', speed: 0.06, phase: 2 },
      { x: w * 0.5, y: h * 0.5, r: Math.min(w, h) * 0.4, color: 'rgba(0,212,255,0.015)', speed: 0.04, phase: 4 },
    ];

    let time = 0;

    const draw = () => {
      time += 0.016 * speed;
      ctx.clearRect(0, 0, w, h);

      // Deep space gradient background
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, Math.max(w, h) * 0.8);
      bg.addColorStop(0, '#0d0d15');
      bg.addColorStop(0.5, '#080810');
      bg.addColorStop(1, '#050508');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Nebulae — soft glowing clouds
      for (const neb of nebulae) {
        const ox = Math.sin(time * neb.speed + neb.phase) * 30;
        const oy = Math.cos(time * neb.speed * 0.7 + neb.phase) * 20;
        const g = ctx.createRadialGradient(neb.x + ox, neb.y + oy, 0, neb.x + ox, neb.y + oy, neb.r);
        g.addColorStop(0, neb.color);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      // Stars by layer
      for (let li = 0; li < layers.length; li++) {
        const layer = layers[li];
        for (const star of layer) {
          // Parallax drift
          star.y += star.speed * speed;
          if (star.y > h + 5) { star.y = -5; star.x = Math.random() * w; }

          // Twinkle
          star.twinkle += star.twinkleSpeed;
          const tw = 0.5 + 0.5 * Math.sin(star.twinkle);
          const alpha = star.brightness * (0.6 + tw * 0.4);

          ctx.beginPath();
          ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.fill();

          // Bright stars get a glow
          if (li === 2 && star.r > 1.5) {
            const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.r * 4);
            glow.addColorStop(0, `rgba(200, 220, 255, ${alpha * 0.3})`);
            glow.addColorStop(1, 'transparent');
            ctx.fillStyle = glow;
            ctx.fillRect(star.x - star.r * 4, star.y - star.r * 4, star.r * 8, star.r * 8);
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      // Redistribute stars on resize
      layers.forEach((layer) => {
        for (const star of layer) {
          star.x = Math.random() * w;
          star.y = Math.random() * h;
        }
      });
      nebulae[0].x = w * 0.2; nebulae[0].y = h * 0.3; nebulae[0].r = Math.min(w, h) * 0.35;
      nebulae[1].x = w * 0.8; nebulae[1].y = h * 0.7; nebulae[1].r = Math.min(w, h) * 0.3;
      nebulae[2].x = w * 0.5; nebulae[2].y = h * 0.5; nebulae[2].r = Math.min(w, h) * 0.4;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [speed]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
