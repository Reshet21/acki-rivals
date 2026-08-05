import { useState } from 'react';

interface Props {
  src?: string;
  alt?: string;
  /** Fixed container ratio for grids ('fixed' mode). For 'auto' the box follows the image. */
  boxRatio?: number;
  /** 'auto': box aspect-ratio = image natural ratio (image never cropped).
   *  'fixed': box keeps boxRatio, image switches to contain when ratios differ a lot. */
  mode?: 'auto' | 'fixed';
  minH?: number | string;
  maxH?: number | string;
  fallbackRatio?: number;
}

interface ImgState { ratio: number; fit: 'cover' | 'contain'; }

export default function CardArt({ src, alt = '', boxRatio = 3 / 4, mode = 'auto', minH, maxH, fallbackRatio }: Props) {
  const [img, setImg] = useState<ImgState | null>(null);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    const w = el.naturalWidth;
    const h = el.naturalHeight;
    if (!w || !h) return;
    const ratio = w / h;
    const diff = Math.abs(ratio - boxRatio) / boxRatio;
    setImg({ ratio, fit: diff > 0.18 ? 'contain' : 'cover' });
  };

  const boxStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    background: '#080503',
    overflow: 'hidden',
    ...(mode === 'auto'
      ? { aspectRatio: img ? `${img.ratio}` : (fallbackRatio ? `${fallbackRatio}` : `${boxRatio}`) }
      : { aspectRatio: `${boxRatio}` }),
  };
  if (minH !== undefined) boxStyle.minHeight = minH;
  if (maxH !== undefined) boxStyle.maxHeight = maxH;

  return (
    <div style={boxStyle}>
      {src ? (
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          style={{
            width: '100%',
            height: '100%',
            objectFit: mode === 'auto' ? 'cover' : (img?.fit ?? 'cover'),
            objectPosition: 'center center',
            display: 'block',
          }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, opacity: 0.15 }}>🃏</div>
      )}
    </div>
  );
}
