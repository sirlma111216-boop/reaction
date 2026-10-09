import { useState, type CSSProperties } from 'react';
import { IMAGE_BY_ID } from '../../shared/content/assets';
import { imageSrc, imageSrcSet, markFailed } from '../lib/assets';

/**
 * 모든 그림은 이 컴포넌트 하나로 표시한다 (8.1).
 * 파일이 있으면 그 그림을, 없으면 점선 테두리 상자 안에 자산 ID 와 한글 이름을 글자로 보여 준다.
 * 아이콘·캐릭터·배경을 코드로 그리지 않는다.
 */
export interface AssetImageProps {
  id: string;
  /** 표시 폭(px). 변형 파일 선택과 대체 상자 크기에 쓴다 */
  size?: number;
  /** 높이(px). 없으면 size 와 같다(정사각) */
  height?: number;
  /** 이름을 겹쳐 쓸 때 (대체 상자에는 항상 이름이 나온다) */
  label?: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  /** 상자를 가로로 채움 (너비 100%) */
  fluid?: boolean;
}

export function AssetImage({ id, size = 64, height, label, alt, className, style, fluid }: AssetImageProps) {
  const [failed, setFailed] = useState(false);
  const meta = IMAGE_BY_ID[id];
  const name = label ?? meta?.name ?? id;
  const src = failed ? null : imageSrc(id, size);
  const h = height ?? (meta ? Math.round(size * (meta.height / meta.width)) : size);
  const box: CSSProperties = fluid ? { width: '100%', aspectRatio: meta ? `${meta.width} / ${meta.height}` : '1 / 1', ...style } : { width: size, height: h, ...style };
  if (!src) {
    return (
      <span className={`asset-ph ${className ?? ''}`} style={box} role="img" aria-label={alt ?? name} data-asset={id}>
        <span className="asset-ph-name">{name}</span>
        {size >= 56 && <code className="asset-ph-id">{id}</code>}
      </span>
    );
  }
  return (
    <img
      src={src}
      srcSet={imageSrcSet(id) ?? undefined}
      sizes={fluid ? '100vw' : `${size}px`}
      alt={alt ?? name}
      className={`asset-img ${className ?? ''}`}
      style={box}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => { markFailed(id); setFailed(true); }}
    />
  );
}

/** 배경 그림: 파일이 있으면 바탕에 깔고, 없으면 종이색 바탕만 */
export function Backdrop({ id }: { id: string }) {
  const src = imageSrc(id, 1600);
  return <div className={`backdrop ${src ? '' : 'backdrop-empty'}`} style={src ? { backgroundImage: `url(${src})` } : undefined} aria-hidden data-asset={id} />;
}
