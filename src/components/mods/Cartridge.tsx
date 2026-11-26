import { useId, type CSSProperties } from 'react';
import type { ModInfo } from '../../variants/catalog';

interface Props {
  mod: ModInfo;
  /** Seated in a bay: contacts hidden, LED lit. */
  plugged?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * A game-mod cartridge, drawn as SVG (no assets). Shell colour comes from the mod;
 * the label carries its code, name and a pictogram of what it adds.
 */
export function Cartridge({ mod, plugged = false, className = '', style }: Props) {
  const id = useId().replace(/:/g, '');
  const [first, ...rest] = mod.name.toUpperCase().split(' ');
  const second = rest.join(' ');
  return (
    <svg
      className={`cartridge${plugged ? ' is-plugged' : ''} ${className}`}
      viewBox="0 0 120 112"
      style={{ ...style, ['--shell' as string]: mod.shell }}
      role="img"
      aria-label={`${mod.code} ${mod.name} cartridge`}
    >
      <defs>
        <linearGradient id={`${id}-shell`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--shell)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--shell) 55%, #000)" />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".45" />
          <stop offset=".35" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-pin`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#b8862b" />
        </linearGradient>
      </defs>

      {/* edge connector (hidden inside the bay when plugged) */}
      <g className="cart-pins">
        <rect x="18" y="92" width="84" height="16" rx="2" fill="#1a1d27" />
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={22 + i * 6.6} y="95" width="4" height="13" rx="1" fill={`url(#${id}-pin)`} />
        ))}
      </g>

      {/* shell: chamfered top corners, grip notch */}
      <path
        d="M10 2 H110 L118 10 V96 H2 V10 Z"
        fill={`url(#${id}-shell)`}
        stroke="color-mix(in srgb, var(--shell) 40%, #000)"
        strokeWidth="2"
      />
      <path d="M10 2 H110 L118 10 V96 H2 V10 Z" fill={`url(#${id}-gloss)`} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={38 + i * 9} y="6" width="5" height="10" rx="1.5" fill="#000" opacity=".28" />
      ))}

      {/* LED */}
      <circle className="cart-led" cx="104" cy="12" r="3.6" />

      {/* label */}
      <rect x="10" y="22" width="100" height="66" rx="3" fill="#0b0d14" />
      <rect x="10" y="22" width="100" height="13" rx="3" fill="var(--shell)" />
      <rect x="10" y="30" width="100" height="5" fill="var(--shell)" />
      <text x="15" y="32" className="cart-code">
        {mod.code}
      </text>
      <text x="105" y="32" className="cart-tag" textAnchor="end">
        MOD
      </text>
      <text x="15" y="53" className="cart-name">
        {first}
      </text>
      {second && (
        <text x="15" y="68" className="cart-name">
          {second}
        </text>
      )}
      {/* pictogram: the added leaps around a centre dot */}
      <g transform="translate(88 64)">
        {mod.diagram.added.map((v, i) => (
          <rect key={i} x={v.dFile * 4.2 - 1.6} y={-v.dRank * 4.2 - 1.6} width="3.2" height="3.2" fill="var(--shell)" />
        ))}
        <circle r="2.4" fill="#fff" />
      </g>
      <rect x="15" y="77" width="44" height="2" fill="var(--shell)" opacity=".7" />
      <rect x="15" y="81" width="28" height="2" fill="var(--shell)" opacity=".4" />
    </svg>
  );
}

/**
 * The part of a cartridge you see sticking out of a bay slot: a wide shell top with
 * grip ridges, the label strip and a status LED. The edge connector is inside the port.
 */
export function BayCartridge({ mod, level }: { mod: ModInfo; level: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="bay-cart" viewBox="0 0 160 52" style={{ ['--shell' as string]: mod.shell }} aria-hidden>
      <defs>
        <linearGradient id={`${id}-s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--shell)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--shell) 50%, #000)" />
        </linearGradient>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M8 1 H152 L159 8 V52 H1 V8 Z" fill={`url(#${id}-s)`} stroke="color-mix(in srgb, var(--shell) 35%, #000)" strokeWidth="1.5" />
      <path d="M8 1 H152 L159 8 V20 H1 V8 Z" fill={`url(#${id}-g)`} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={7 + i * 5} y="7" width="2.6" height="38" rx="1" fill="#000" opacity=".3" />
      ))}
      <rect x="30" y="7" width="114" height="38" rx="2.5" fill="#0b0d14" />
      <rect x="30" y="7" width="40" height="38" rx="2.5" fill="var(--shell)" />
      <rect x="62" y="7" width="8" height="38" fill="var(--shell)" />
      <text x="50" y="23" className="bay-cart-code" textAnchor="middle">
        {mod.code.split('-')[0]}
      </text>
      <text x="50" y="37" className="bay-cart-num" textAnchor="middle">
        {mod.code.split('-')[1] ?? ''}
      </text>
      <text x="70" y="22" className="bay-cart-name">
        {mod.name.toUpperCase()}
      </text>
      <g transform="translate(138 32)">
        {mod.diagram.added.map((v, i) => (
          <rect key={i} x={v.dFile * 2.6 - 1} y={-v.dRank * 2.6 - 1} width="2" height="2" fill="var(--shell)" />
        ))}
        <circle r="1.5" fill="#fff" />
      </g>
      <rect x="70" y="29" width="26" height="11" rx="2" fill="var(--shell)" />
      <text x="83" y="37.5" className="bay-cart-level" textAnchor="middle">
        LV{level}
      </text>
      <rect x="100" y="30" width="18" height="2" fill="var(--shell)" opacity=".6" />
      <rect x="100" y="35" width="12" height="2" fill="var(--shell)" opacity=".35" />
      <circle className="cart-led" cx="153" cy="4.5" r="2" />
    </svg>
  );
}
