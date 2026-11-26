import type { ModInfo } from '../../variants/catalog';

/** 7×7 board around the piece: what it already does (dots) and what the mod adds (shell-coloured). */
export function MoveDiagram({ mod }: { mod: ModInfo }) {
  const N = 7;
  const C = 3;
  const cell = 24;
  const has = (list: { dFile: number; dRank: number }[], f: number, r: number) =>
    list.some((v) => v.dFile === f - C && v.dRank === C - r);
  return (
    <svg className="move-diagram" viewBox={`0 0 ${N * cell} ${N * cell}`} role="img" aria-label={`How the ${mod.piece} moves with ${mod.name}`} style={{ ['--shell' as string]: mod.shell }}>
      {Array.from({ length: N * N }, (_, i) => {
        const f = i % N;
        const r = Math.floor(i / N);
        const added = has(mod.diagram.added, f, r);
        const base = has(mod.diagram.base, f, r);
        return (
          <g key={i}>
            <rect x={f * cell} y={r * cell} width={cell} height={cell} className={(f + r) % 2 ? 'md-dark' : 'md-light'} />
            {added && <rect x={f * cell + 3} y={r * cell + 3} width={cell - 6} height={cell - 6} className="md-added" />}
            {base && <circle cx={f * cell + cell / 2} cy={r * cell + cell / 2} r={cell * 0.18} className="md-base" />}
          </g>
        );
      })}
      <text x={C * cell + cell / 2} y={C * cell + cell / 2 + 6} textAnchor="middle" className="md-piece">
        {mod.piece === 'knight' ? '♞' : mod.piece[0].toUpperCase()}
      </text>
    </svg>
  );
}
