import { useEffect, useState } from 'react';
import type { TransportMeta } from '../net/transport';
import { formatTimeControl, type TimeControl } from '../types/clock';
import type { Color } from '../types/game';
import { TimeControlPicker } from './TimeControlPicker';

interface Props {
  meta: TransportMeta;
  /** Create a private room to share with a friend. */
  onPlayFriend: (tc: TimeControl | null) => void;
  /** Find an opponent through quick match. */
  onQuickMatch: (tc: TimeControl | null) => void;
  onCancelSearch: () => void;
  creating: boolean;
  createError: string | null;
  /** Quick match in progress: when it started (ms since epoch) and for which time control. */
  searching: { since: number; timeControl: TimeControl | null } | null;
  /** Online only: the room's time control (null = untimed). */
  timeControl?: TimeControl | null;
  /** Online only: this room came from quick match. */
  matched?: boolean;
  /** Online only: the game has ended. */
  over?: boolean;
}

const cap = (c: Color) => (c === 'white' ? 'White' : 'Black');

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return <>{`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`}</>;
}

/** Local mode: quick match / play a friend. Online mode: room, seat, opponent presence, invite. */
export function OnlineBar(props: Props) {
  const { meta, creating, createError, searching, timeControl, matched, over } = props;
  const [copied, setCopied] = useState(false);
  const [picking, setPicking] = useState<'match' | 'friend' | null>(null);

  if (meta.mode === 'local') {
    if (searching) {
      return (
        <div className="online-bar">
          <span className="dot dot-wait dot-pulse" />
          <div className="online-text">
            <strong>
              Finding an opponent
              {searching.timeControl ? ` · ${formatTimeControl(searching.timeControl)}` : ' · No clock'}
            </strong>
            <span className={createError ? 'online-error' : 'online-hint'}>
              {createError ?? <Elapsed since={searching.since} />}
            </span>
          </div>
          <button className="ghost" type="button" onClick={props.onCancelSearch}>
            Cancel
          </button>
        </div>
      );
    }
    if (picking) {
      const pick = (tc: TimeControl | null) => {
        if (picking === 'match') {
          setPicking(null);
          props.onQuickMatch(tc);
        } else {
          props.onPlayFriend(tc);
        }
      };
      return (
        <div className="online-bar online-bar-picker">
          <span className={createError ? 'online-error' : 'online-hint'}>
            {createError ??
              (creating ? 'Creating game…' : picking === 'match' ? 'Quick match: choose a time control' : 'Play a friend: choose a time control')}
          </span>
          <TimeControlPicker busy={creating} onPick={pick} onCancel={() => setPicking(null)} />
        </div>
      );
    }
    return (
      <div className="online-bar">
        <span className={createError ? 'online-error' : 'online-hint'}>{createError ?? 'Playing on this device'}</span>
        <button className="reset" type="button" onClick={() => setPicking('match')}>
          Quick match
        </button>
        <button className="ghost" type="button" onClick={() => setPicking('friend')}>
          Play a friend
        </button>
      </div>
    );
  }

  const opp = meta.seat ? (meta.seat === 'white' ? meta.presence?.black : meta.presence?.white) : null;
  const oppLabel = !meta.seat ? null : !opp?.taken ? 'Waiting for opponent' : opp.connected ? 'Opponent online' : 'Opponent offline';
  const dot = meta.connection !== 'connected' ? 'off' : !meta.seat ? 'on' : opp?.connected ? 'on' : 'wait';
  const tcLabel = timeControl ? ` · ${formatTimeControl(timeControl)}` : timeControl === null ? ' · No clock' : '';

  const share = async () => {
    const link = `${location.origin}${location.pathname}?room=${meta.roomId}`;
    try {
      if (navigator.share) await navigator.share({ title: 'CheX', text: 'Play chess with me', url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* user cancelled share sheet */
    }
  };

  return (
    <div className="online-bar">
      <span className={`dot dot-${dot}`} />
      <div className="online-text">
        <strong>
          {matched ? 'Quick match' : `Room ${meta.roomId}`}
          {tcLabel}
          {meta.seat ? ` · You're ${cap(meta.seat)}` : meta.connection === 'connected' ? ' · Spectating' : ''}
        </strong>
        <span className={meta.error ? 'online-error' : 'online-hint'}>
          {meta.error ??
            (meta.connection === 'connecting'
              ? 'Connecting…'
              : meta.connection === 'disconnected'
                ? 'Reconnecting…'
                : (oppLabel ?? `${meta.presence?.spectators ?? 0} watching`))}
        </span>
      </div>
      {matched ? (
        over && (
          <button className="ghost" type="button" onClick={() => props.onQuickMatch(timeControl ?? null)}>
            New opponent
          </button>
        )
      ) : (
        <button className="ghost" type="button" onClick={share}>
          {copied ? 'Copied!' : 'Invite'}
        </button>
      )}
      <a className="ghost" href={location.pathname}>
        Leave
      </a>
    </div>
  );
}
