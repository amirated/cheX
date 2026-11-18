import { useState } from 'react';
import type { TransportMeta } from '../net/transport';
import type { Color } from '../types/game';

interface Props {
  meta: TransportMeta;
  onPlayOnline: () => void;
  creating: boolean;
  createError: string | null;
}

const cap = (c: Color) => (c === 'white' ? 'White' : 'Black');

/** Local mode: a "Play online" entry point. Online mode: room code, seat, opponent presence, share link. */
export function OnlineBar({ meta, onPlayOnline, creating, createError }: Props) {
  const [copied, setCopied] = useState(false);

  if (meta.mode === 'local') {
    return (
      <div className="online-bar">
        <span className="online-hint">{createError ?? 'Playing on this device'}</span>
        <button className="ghost" type="button" onClick={onPlayOnline} disabled={creating}>
          {creating ? 'Creating…' : 'Play online'}
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
