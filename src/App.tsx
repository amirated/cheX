import { useEffect, useMemo, useRef, useState } from 'react';
import { BoardFx } from './components/BoardFx';
import { ModBay } from './components/mods/ModBay';
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
import { useChessGame } from './hooks/useChessGame';
import { useClock } from './hooks/useClock';
import { findMatch, type MatchSearch } from './net/matchmaking';
import { createOnlineRoom, isMatched, SERVER_URL, SocketTransport } from './net/socketTransport';
import { LocalTransport, type GameTransport } from './net/transport';
import type { TimeControl } from './types/clock';
import type { Color, PieceKind } from './types/game';

/** `?room=CODE` → online game against the Rust server; otherwise local pass-and-play.
 *  Created once at module scope so React StrictMode's double-mount can't open two sockets. */
function createTransport(): GameTransport {
  const room = new URLSearchParams(location.search).get('room');
  // A local game starts with whatever cartridges are in this device's mod bay.
  return room
    ? new SocketTransport(SERVER_URL, room.toUpperCase())
    : new LocalTransport(createGameState(standardBoard(), rulesetFor(getLoadout())));
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

/** Height of one player bar incl. its gap (keep in sync with .player-bar in index.css). */
const PLAYER_BAR_PX = 48;
/** Height of the mod bay above the board incl. its gap (keep in sync with .mod-bay). */
const MOD_BAY_PX = 72;

export default function App() {
  const { state, meta, myTurn, highlights, onSquare, reset, resign, sanLog } = useChessGame(transport);
  const clock = useClock(transport);
  const fx = useGameFeedback(state, meta, clock);
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
  const stageRef = useRef<HTMLDivElement>(null);
  const size = useBoardSize(stageRef, 640, (online ? PLAYER_BAR_PX * 2 : 0) + MOD_BAY_PX);

  // Mods of the game on screen (an online room's are fixed when the room is made).
  const activeMods = modsOf(state.ruleset);
  const pips = useMemo(() => {
    const out: Partial<Record<PieceKind, number>> = {};
    for (const id of activeMods) {
      const m = modInfo(id);
      if (m) out[m.piece] = parseInt(m.shell.slice(1), 16);
    }
    return out;
  }, [activeMods.join('+')]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Plug a cartridge in or eject it. Locally that restarts the game with the new rules. */
  const toggleMod = (id: string) => {
    const plugging = !loadout.includes(id);
    const next = plugging ? [...loadout, id] : loadout.filter((m) => m !== id);
    if (!online) {
      const midGame = state.ply > 0 && !['checkmate', 'stalemate', 'draw', 'timeout', 'resigned'].includes(state.status);
      if (midGame && !window.confirm('Changing mods starts a new game. Continue?')) return;
      transport.send({ type: 'reset', ruleset: rulesetFor(next) });
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

  // Pair plies into "1. e4 e5" and show the most recent few.
  const moves = useMemo(() => {
    const rows: string[] = [];
    for (let i = 0; i < sanLog.length; i += 2) rows.push(`${i / 2 + 1}. ${sanLog[i]}${sanLog[i + 1] ? ' ' + sanLog[i + 1] : ''}`);
    return rows.slice(-4);
  }, [sanLog]);

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
    state.status === 'check' ? 'is-check' : '',
    state.status === 'checkmate' ? 'is-mate' : '',
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

  return (
    <main className="app">
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
          </>
        }
      />
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {libraryOpen && (
        <ModLibrary
          loadout={loadout}
          active={activeMods}
          editable={!online}
          onToggle={toggleMod}
          onClose={() => setLibraryOpen(false)}
        />
      )}
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
      <div className="stage" ref={stageRef}>
        {size > 0 && (
          <div className="board-column" style={{ width: size }}>
            {online && bar(top)}
            <ModBay
              mods={online ? activeMods : loadout}
              editable={!online}
              fresh={freshMod}
              onOpenLibrary={() => {
                setLibraryOpen(true);
                setSettingsOpen(false);
              }}
              onEject={toggleMod}
            />
            <div ref={frameRef} className={frameClass} style={{ width: size, height: size }}>
              <GameCanvas
                board={state.board}
                size={size}
                highlights={highlights}
                onSquare={onSquare}
                flipped={meta.seat === 'black'}
                theme={THEMES[prefs.theme]}
                pieceStyle={prefs.pieceStyle}
                pips={pips}
              />
              <BoardFx
                size={size}
                files={state.board.width}
                ranks={state.board.height}
                flipped={meta.seat === 'black'}
                bursts={fx.bursts}
                checkSquare={highlights.checkSquare}
                mate={state.status === 'checkmate'}
              />
              {showOver && (
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
            {online && bar(bottom)}
          </div>
        )}
      </div>
      <footer className="movelog">{moves.length ? moves.join('   ') : 'Tap a piece to begin'}</footer>
    </main>
  );
}
