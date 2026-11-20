import { useState } from 'react';
import type { TransportMeta } from '../net/transport';
import { formatTimeControl, type TimeControl } from '../types/clock';
import type { Color } from '../types/game';
import { TimeControlPicker } from './TimeControlPicker';

interface Props {
  meta: TransportMeta;
  onPlayOnline: (tc: TimeControl | null) => void;
  creating: boolean;
  createError: string | null;
  /** Online only: the room's time control (null = untimed). */
  timeControl?: TimeControl | null;
}

const cap = (c: Color) => (c === 'white' ? 'White' : 'Black');

/** Local mode: a "Play online" entry point. Online mode: room code, seat, opponent presence, share link. */
export function OnlineBar({ meta, onPlayOnline, creating, createError, timeControl }: Props) {
  const [copied, setCopied] = useState(false);
  const [picking, setPicking] = useState(false);

  if (meta.mode === 'local') {
    if (picking) {
      return (
        <div className="online-bar online-bar-picker">
          <span className={createError ? 'online-error' : 'online-hint'}>
            {createError ?? (creating ? 'Creating game…' : 'Choose a time control')}
          </span>
          <TimeControlPicker busy={creating} onPick={onPlayOnline} onCancel={() => setPicking(false)} />
        </div>
      );
    }
    return (
      <div className="online-bar">
        <span className="online-hint">{createError ?? 'Playing on this device'}</span>
        <button className="ghost" type="button" onClick={() => setPicking(true)}>
          Play online
        </button>
      </div>
    );
  }

  const opp = meta.seat ? (meta.seat === 'white' ? meta.presence?.black : meta.presence?.white) : null;
  const oppLabel = !meta.seat ? null : !opp?.taken ? 'Waiting for opponent' : opp.connected ? 'Opponent online' : 'Opponent offline';
  const dot = meta.connection !== 'connected' ? 'off' : !meta.seat ? 'on' : opp?.connected ? 'on' : 'wait';

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
          Room {meta.roomId}
          {timeControl ? ` · ${formatTimeControl(timeControl)}` : timeControl === null ? ' · No clock' : ''}
          {meta.seat ? ` · You're ${cap(meta.seat)}` : meta.connection === 'connected' ? ' · Spectating' : ''}
        </strong>
        <span className={meta.error ? 'online-error' : 'online-hint'}>
          {meta.error ?? (meta.connection === 'connecting' ? 'Connecting…' : meta.connection === 'disconnected' ? 'Reconnecting…' : oppLabel ?? `${meta.presence?.spectators ?? 0} watching`)}
        </span>
      </div>
      <button className="ghost" type="button" onClick={share}>
        {copied ? 'Copied!' : 'Invite'}
      </button>
      <a className="ghost" href={location.pathname}>
        Leave
      </a>
    </div>
  );
}
