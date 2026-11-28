import { useEffect, useMemo, useRef, useState } from 'react';
import { BoardFx } from './components/BoardFx';
import { BAY_DEPTH, ModBay } from './components/mods/ModBay';
import { ModLibrary, ModsButton } from './components/mods/ModLibrary';
import { createGameState, standardBoard } from './engine';
import { haptic } from './feedback/haptics';
import { playSound } from './feedback/sound';
import { modInfo, modsOf, rulesetFor } from './variants/catalog';
import { getLoadout, setLoadout, useLoadout } from './variants/loadout';
import { GameCanvas } from './components/GameCanvas';
import { GameOverOverlay } from './components/GameOverOverlay';
import { useGameFeedback } from './feedback/useGameFeedback';
import { Hud } from './components/Hud';
import { OnlineBar } from './components/OnlineBar';
import { PlayerBar } from './components/PlayerBar';
import { SettingsButton, SettingsPanel } from './components/SettingsPanel';
import { usePreferences } from './prefs/preferences';
import { THEMES } from './render/theme';
import { useBoardSize } from './hooks/useBoardSize';
import { useLayoutMode } from './hooks/useLayoutMode';
import { FullscreenButton } from './components/FullscreenButton';
import { useChessGame } from './hooks/useChessGame';
import { useClock } from './hooks/useClock';
import { findMatch, type MatchSearch } from './net/matchmaking';
import { createOnlineRoom, isMatched, SERVER_URL, SocketTransport } from './net/socketTransport';
import { LocalTransport, type GameTransport } from './net/transport';
import type { TimeControl } from './types/clock';
import type { Color } from './types/game';
import type { PipInfo } from './components/PieceView';
import { ModStatusLine } from './components/mods/ModStatusLine';
import { pieceModStatus } from './engine/rules/modifiers';
import { levelOf } from './engine/rules/charges';
import { playerLevel } from './variants/progression';
import { useReview } from './hooks/useReview';
import { AutoHeight } from './components/AutoHeight';
import { MoveNav } from './components/MoveNav';
import { CapturedTray } from './components/CapturedTray';
import { materialOf } from './engine/replay';

/** `?room=CODE` → online game against the Rust server; otherwise local pass-and-play.
 *  Created once at module scope so React StrictMode's double-mount can't open two sockets. */
function createTransport(): GameTransport {
  const room = new URLSearchParams(location.search).get('room');
  // A local game starts with whatever cartridges are in this device's mod bay.
  return room
    ? new SocketTransport(SERVER_URL, room.toUpperCase())
    : new LocalTransport(createGameState(standardBoard(), rulesetFor(getLoadout(), playerLevel)));
}
const transport = createTransport();

/**
 * `?quick=180000+2000&mods=knightCamel` (or `?quick=none`) starts a quick-match search on
 * load ("New opponent"), with the same mods as the game just played.
 */
function quickParam(): TimeControl | null | undefined {
  const params = new URLSearchParams(location.search);
  const q = params.get('quick');
  if (q === null) return undefined;
  const mods = params.get('mods');
  if (mods !== null) setLoadout(mods.split(/[ +,]/).filter((id) => modInfo(id)));
  const [initial, inc] = q.split(' ').join('+').split('+').map(Number);
  return Number.isFinite(initial) && initial > 0 ? { initialMs: initial, incrementMs: Number.isFinite(inc) ? inc : 0 } : null;
}
const initialQuick = quickParam();
if (initialQuick !== undefined) history.replaceState(null, '', location.pathname);
let quickStarted = false;

const NO_PIPS: Record<string, PipInfo> = {};

/** Gap between the mod bay and the board (keep in sync with .board-column in index.css). */
const BAY_GAP = 0;
/** Height of a player bar plus its gap, when bars sit above/below the board in portrait. */
const PLAYER_BAR_PX = 46;
/** Portrait: room kept under the board for the mod status line and the move log + arrows. */
const PORTRAIT_LOG_PX = 72;
/** Captured-piece trays: a row above and below the board (portrait), a column beside it (landscape). */
const TRAY_ROW_PX = 30;
const TRAY_COL_PX = 40;
const TRAY_ICON = { portrait: 26, landscape: 32 } as const;

export default function App() {
  const { state, meta, myTurn, highlights, onSquare, reset, resign, sanLog } = useChessGame(transport);
  const clock = useClock(transport);
  const fx = useGameFeedback(state, meta, clock);
  const review = useReview(state);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  // Checkmate lands with a jolt (Web Animations, so the canvas isn't remounted).
  useEffect(() => {
    if (!fx.shake || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const k = [0, -9, 8, -6, 5, -3, 2, 0].map((x, i) => ({ transform: `translate(${x}px, ${i % 2 ? 2 : -2}px)` }));
    frameRef.current?.animate(k, { duration: 520, easing: 'ease-out', delay: 180 });
  }, [fx.shake]);
  const prefs = usePreferences();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const loadout = useLoadout();
  const [freshMod, setFreshMod] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [searching, setSearching] = useState<{ since: number; timeControl: TimeControl | null } | null>(null);
  const search = useRef<MatchSearch | null>(null);

  const online = meta.mode === 'online';
  const layout = useLayoutMode();
  const landscape = layout === 'landscape';
  const stageRef = useRef<HTMLDivElement>(null);
  // As big as the screen allows: full width in portrait, full height in landscape. The
  // mod bay sits on the board's top edge (portrait) or left edge (landscape).
  const size = useBoardSize(
    stageRef,
    landscape
      ? { x: BAY_DEPTH + BAY_GAP + TRAY_COL_PX }
      : { y: BAY_DEPTH + BAY_GAP + PORTRAIT_LOG_PX + TRAY_ROW_PX * 2 + (online ? PLAYER_BAR_PX * 2 : 0) },
    layout,
  );

  // Mods of the game on screen (an online room's are fixed when the room is made).
  const activeMods = modsOf(state.ruleset);
  // Charges left on every enhanced piece (chips on the piece) — generic for any piece mod.
  const pips = useMemo(() => {
    const out: Record<string, PipInfo> = {};
    if (!state.ruleset.modifiers.length) return out;
    for (const piece of Object.values(state.board.pieces)) {
      const st = pieceModStatus(state, piece)[0];
      const info = st && modInfo(st.modId);
      if (st && info) out[piece.id] = { color: parseInt(info.shell.slice(1), 16), level: st.level, charges: st.charges, cooling: st.cooling };
    }
    return out;
  }, [state]);

  /** Plug a cartridge in or eject it. Locally that restarts the game with the new rules. */
  const toggleMod = (id: string) => {
    const plugging = !loadout.includes(id);
    // A piece has one slot: plugging a mod in replaces whatever that slot held.
    const piece = modInfo(id)?.piece;
    const next = plugging ? [...loadout.filter((m) => modInfo(m)?.piece !== piece), id] : loadout.filter((m) => m !== id);
    if (!online) {
      const midGame = state.ply > 0 && !['checkmate', 'stalemate', 'draw', 'timeout', 'resigned'].includes(state.status);
      if (midGame && !window.confirm('Changing mods starts a new game. Continue?')) return;
      transport.send({ type: 'reset', ruleset: rulesetFor(next, playerLevel) });
    }
    setLoadout(next);
    setFreshMod(plugging ? id : null);
    playSound(plugging ? 'plug' : 'eject');
    haptic(plugging ? 'plug' : 'eject');
  };

  const quickMatch = (tc: TimeControl | null) => {
    if (meta.mode === 'online') {
      // From a finished matched game: go back to the lobby and search again.
      const mods = activeMods.length ? `&mods=${activeMods.join('+')}` : '';
      location.search = `?quick=${tc ? `${tc.initialMs}+${tc.incrementMs}` : 'none'}${mods}`;
      return;
    }
    search.current?.cancel();
    setCreateError(null);
    setSearching({ since: Date.now(), timeControl: tc });
    search.current = findMatch(SERVER_URL, tc, getLoadout(), {
      onFound: (m) => {
        location.search = `?room=${m.roomId}`; // token is already saved; the room page claims the seat
      },
      onError: (message) => setCreateError(message),
    });
  };

  const cancelSearch = () => {
    search.current?.cancel();
    search.current = null;
    setSearching(null);
    setCreateError(null);
  };

  // "New opponent" lands here with ?quick=…: start searching right away (once per page load).
  useEffect(() => {
    if (initialQuick !== undefined && !quickStarted && meta.mode === 'local') {
      quickStarted = true;
      quickMatch(initialQuick);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playOnline = async (tc: TimeControl | null) => {
    setCreating(true);
    setCreateError(null);
    try {
      const id = await createOnlineRoom(tc, getLoadout());
      location.search = `?room=${id}`; // reload into the room
    } catch {
      setCreateError(`Can't reach the game server at ${SERVER_URL}`);
      setCreating(false);
    }
  };

  // ◆ marks a move that used a mod charge.
  const plySan = useMemo(
    () => sanLog.map((san, i) => `${san}${state.history[i]?.flags.some((f) => f.startsWith('mod:')) ? '◆' : ''}`),
    [sanLog, state.history],
  );
  // Pair plies into "1. e4 e5" (portrait shows the most recent few).
  const moves = useMemo(() => {
    const rows: string[] = [];
    for (let i = 0; i < plySan.length; i += 2) rows.push(`${i / 2 + 1}. ${plySan[i]}${plySan[i + 1] ? ' ' + plySan[i + 1] : ''}`);
    return rows;
  }, [plySan]);
  // Keep the newest move in view when the full log scrolls (landscape); while reviewing, the viewed one.
  const logRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const current = el.querySelector<HTMLElement>('.ply.is-current');
    if (review.reviewing && current) current.scrollIntoView({ block: 'nearest' });
    else el.scrollTo({ top: el.scrollHeight });
  }, [moves.length, review.ply, review.reviewing]);

  // Static highlights for a reviewed position: just the move that led to it.
  const reviewHighlights = useMemo(
    () => ({
      lastMove: review.lastMove ? { from: review.lastMove.from, to: review.lastMove.to } : null,
      selected: null,
      quietTargets: [],
      captureTargets: [],
      checkSquare: null,
      modTargets: [],
    }),
    [review.lastMove],
  );

  // You at the bottom; spectators see White at the bottom.
  const bottom: Color = meta.seat ?? 'white';
  const top: Color = bottom === 'white' ? 'black' : 'white';
  const over = ['checkmate', 'stalemate', 'draw', 'timeout', 'resigned'].includes(state.status);
  const matched = isMatched(meta.roomId);
  const showOver = fx.over && fx.over.seq !== dismissed ? fx.over : null;
  const canRematch = !online || !!meta.seat;
  const frameClass = [
    'board-frame',
    online && meta.seat && myTurn && !over ? 'is-your-turn' : '',
    state.status === 'check' && !review.reviewing ? 'is-check' : '',
    state.status === 'checkmate' && !review.reviewing ? 'is-mate' : '',
    review.reviewing ? 'is-reviewing' : '',
  ].filter(Boolean).join(' ');

  const bar = (color: Color) => {
    const seat = meta.presence?.[color];
    const name = meta.seat ? (color === meta.seat ? 'You' : 'Opponent') : color === 'white' ? 'White' : 'Black';
    return (
      <PlayerBar
        color={color}
        name={name}
        connected={color === meta.seat ? undefined : !seat?.taken ? null : seat.connected}
        toMove={!over && state.turn === color}
        clock={
          clock
            ? {
                remainingMs: clock[color],
                running: clock.running === color,
                flagged: clock.flagged === color,
                timeControl: clock.timeControl,
              }
            : null
        }
      />
    );
  };

  const hud = (
    <Hud
      turn={state.turn}
      status={state.status}
      winner={state.winner}
      moveNumber={state.fullmoveNumber}
      onReset={reset}
      onResign={resign}
      seat={online ? meta.seat : undefined}
      extra={
        <>
          <ModsButton
            open={libraryOpen}
            count={activeMods.length}
            onClick={() => {
              setLibraryOpen((o) => !o);
              setSettingsOpen(false);
            }}
          />
          <SettingsButton
            open={settingsOpen}
            onClick={() => {
              setSettingsOpen((o) => !o);
              setLibraryOpen(false);
            }}
          />
          <FullscreenButton />
        </>
      }
    />
  );

  const bay = (
    <ModBay
      mods={online ? activeMods : loadout}
      editable={!online}
      fresh={freshMod}
      vertical={landscape}
      length={size}
      levels={
        online
          ? Object.fromEntries(state.ruleset.modifiers.map((m) => [m.id, levelOf(m)]))
          : Object.fromEntries(loadout.map((id) => [id, playerLevel(id)]))
      }
      onOpenLibrary={() => {
        setLibraryOpen(true);
        setSettingsOpen(false);
      }}
      onEject={toggleMod}
    />
  );

  // One DOM order for both layouts; CSS grid areas place the pieces (see .app in index.css),
  // so switching orientation never remounts the board canvas.
  // Move log + mod status: the side column in landscape, right under the board in portrait.
  const moveText = (() => {
    if (moves.length === 0) return <span className="movelog-empty">Tap a piece to begin</span>;
    if (landscape) {
      return moves.map((_, r) => (
        <span key={r} className="move-row">
          <span className="move-no">{r + 1}.</span>
          {[2 * r, 2 * r + 1].map((i) =>
            i < plySan.length ? (
              <button
                key={i}
                type="button"
                className={`ply${review.ply === i + 1 ? ' is-current' : ''}`}
                onClick={() => review.go(i + 1)}
              >
                {plySan[i]}
              </button>
            ) : null,
          )}
        </span>
      ));
    }
    if (review.reviewing) {
      const i = review.ply - 1;
      return i < 0 ? 'Start position' : `${Math.floor(i / 2) + 1}.${i % 2 ? '..' : ''} ${plySan[i]}   · ${review.ply}/${review.live}`;
    }
    return moves.slice(-3).join('   ');
  })();

  // Move log + mod status: the side column in landscape, right under the board in portrait.
  const log = (
    <>
      {!review.reviewing && <ModStatusLine state={state} selected={highlights.selected} />}
      {landscape ? (
        <>
          <MoveNav review={review}>
            <span className="move-nav-label">{review.reviewing ? `Move ${review.ply} of ${review.live}` : 'Live'}</span>
          </MoveNav>
          <footer className="movelog" ref={logRef}>
            {moveText}
          </footer>
        </>
      ) : (
        <MoveNav review={review}>
          <footer className="movelog" ref={logRef}>
            {moveText}
          </footer>
        </MoveNav>
      )}
    </>
  );

  // Captured pieces: each side's haul sits next to that side (top player's above/right-top).
  const tray = (color: Color, align: 'start' | 'end') => {
    const other: Color = color === 'white' ? 'black' : 'white';
    const mat = (c: Color) => materialOf(Object.values(review.board.pieces).filter((p) => p.color === c));
    return (
      <CapturedTray
        pieces={review.captures[color]}
        look={THEMES[prefs.theme].pieces[prefs.pieceStyle][other]}
        lead={mat(color) - mat(other)}
        direction={landscape ? 'column' : 'row'}
        align={align}
        label={`Taken by ${color === meta.seat ? 'you' : meta.seat ? 'opponent' : color}`}
        iconSize={TRAY_ICON[layout]}
      />
    );
  };

  return (
    <main className={`app is-${layout}${online ? ' is-online' : ''}`} style={{ ['--board' as string]: `${size}px` }}>
      <div className="area-top">
        {hud}
        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      </div>
      <AutoHeight className="area-online">
        <OnlineBar
          meta={meta}
          onPlayFriend={playOnline}
          onQuickMatch={quickMatch}
          onCancelSearch={cancelSearch}
          creating={creating}
          createError={createError}
          searching={searching}
          mods={online ? activeMods : loadout}
          timeControl={meta.presence ? (clock?.timeControl ?? null) : undefined}
          matched={matched}
          over={over}
        />
      </AutoHeight>
      {online && landscape && <div className="area-bar-top">{bar(top)}</div>}
      <div className="stage" ref={stageRef}>
        {size > 0 && (
          <div className="board-column">
            {online && !landscape && <div className="board-bar">{bar(top)}</div>}
            {!landscape && tray(top, 'start')}
            {bay}
            <div ref={frameRef} className={frameClass} style={{ width: size, height: size }}>
              <GameCanvas
                board={review.board}
                size={size}
                highlights={review.reviewing ? reviewHighlights : highlights}
                onSquare={review.reviewing ? review.toLive : onSquare}
                flipped={meta.seat === 'black'}
                theme={THEMES[prefs.theme]}
                pieceStyle={prefs.pieceStyle}
                pips={review.reviewing ? NO_PIPS : pips}
              />
              <BoardFx
                size={size}
                files={state.board.width}
                ranks={state.board.height}
                flipped={meta.seat === 'black'}
                bursts={fx.bursts}
                checkSquare={review.reviewing ? null : highlights.checkSquare}
                mate={state.status === 'checkmate' && !review.reviewing}
              />
              {review.reviewing && (
                <button type="button" className="review-chip" onClick={review.toLive}>
                  <span>
                    {review.ply === 0 ? 'Start position' : `Move ${Math.ceil(review.ply / 2)}${review.ply % 2 ? '' : '…'} ${sanLog[review.ply - 1] ?? ''}`}
                  </span>
                  <strong>Back to live</strong>
                </button>
              )}
              {showOver && !review.reviewing && (
                <GameOverOverlay
                  key={showOver.seq}
                  info={showOver}
                  seat={online ? meta.seat : undefined}
                  onRematch={canRematch ? reset : undefined}
                  onNewOpponent={matched ? () => quickMatch(clock?.timeControl ?? null) : undefined}
                  onDismiss={() => setDismissed(showOver.seq)}
                />
              )}
            </div>
            {landscape ? (
              <div className="captured-col">
                {tray(top, 'start')}
                {tray(bottom, 'end')}
              </div>
            ) : (
              tray(bottom, 'start')
            )}
            {online && !landscape && <div className="board-bar">{bar(bottom)}</div>}
            {!landscape && <div className="area-log">{log}</div>}
          </div>
        )}
      </div>
      {online && landscape && <div className="area-bar-bottom">{bar(bottom)}</div>}
      {landscape && <div className="area-log">{log}</div>}
      {libraryOpen && (
        <ModLibrary
          loadout={loadout}
          active={activeMods}
          editable={!online}
          onToggle={toggleMod}
          onClose={() => setLibraryOpen(false)}
        />
      )}
    </main>
  );
}
