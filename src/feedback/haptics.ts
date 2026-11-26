/**
 * Haptic feedback.
 *
 * - Android / Chrome: the Vibration API, with distinct patterns per event.
 * - iOS Safari has no Vibration API. Since iOS 18, toggling a native `<input switch>`
 *   produces a system haptic tick; we use that as a best-effort single tap (it only
 *   fires reliably during a user gesture, so opponent moves may be silent on iOS).
 */

export type HapticName =
  | 'select'
  | 'move'
  | 'capture'
  | 'check'
  | 'illegal'
  | 'win'
  | 'lose'
  | 'draw'
  | 'lowTime'
  | 'start'
  | 'plug'
  | 'eject';

const PATTERNS: Record<HapticName, number | number[]> = {
  select: 6,
  move: 12,
  capture: [22, 30, 14],
  check: [30, 50, 30],
  illegal: [8, 40, 8],
  win: [40, 60, 40, 60, 140],
  lose: [160, 90, 260],
  draw: [60, 80, 60],
  lowTime: 15,
  start: [20, 60, 20],
  plug: [12, 50, 28],
  eject: [20, 30, 8],
};

let enabled = true;

export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

export const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

let iosSwitch: HTMLLabelElement | null = null;

function iosTick() {
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

const isIOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent);

export function haptic(name: HapticName) {
  if (!enabled) return;
  try {
    if (canVibrate) navigator.vibrate(PATTERNS[name]);
    else if (isIOS) iosTick();
  } catch {
    /* decoration only */
  }
}
