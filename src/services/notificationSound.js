// The bell's "new notification" sound — the same approach as Rizurf Discussion (RIZURF_SOUNDS.md).
// It plays through Web Audio from a buffer decoded once, not an <audio> element: browsers hold an
// <audio> back in a background tab (it only plays once you return), and a gain above 1 needs Web
// Audio anyway. The browser keeps it silent until the person has clicked/typed on the page once.
// notification.mp3 peaks at 0.658, so 1.52 is the most gain it takes before clipping — re-measure
// if the file changes. Turn it off with localStorage 'rizurf-sounds' = 'off'.
const SOUND_URL = '/assets/sounds/notification.mp3';
const SOUND_GAIN = 1.5;
// A sound asked for while the browser still blocks audio is dropped if it can only start later
// (on the first click) — no burst of old sounds then.
const STALE_AFTER_MS = 2000;
// Back-to-back refreshes (feed + read state + note reminders) never stack overlapping sounds.
const MIN_GAP_MS = 2000;

let soundContext = null;
let soundBuffer = null;
let loading = null;
let lastPlayedAt = 0;

function soundsOff() {
  try {
    return localStorage.getItem('rizurf-sounds') === 'off';
  } catch {
    return false;
  }
}

// Creates the audio context and decodes the file once. Safe to call repeatedly; never throws.
export function preloadNotificationSound() {
  if (loading) return loading;
  const AudioContextClass = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AudioContextClass) return (loading = Promise.resolve());
  try {
    soundContext = new AudioContextClass();
  } catch {
    return (loading = Promise.resolve());
  }
  loading = fetch(SOUND_URL)
    .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(`HTTP ${response.status}`))))
    .then((data) => soundContext.decodeAudioData(data))
    .then((buffer) => { soundBuffer = buffer; })
    .catch(() => {});
  return loading;
}

// Plays the notification sound once. Not loaded yet, switched off, blocked by the browser or
// played moments ago: it quietly does nothing — it never throws or rejects.
export function playNotificationSound() {
  if (!soundContext || !soundBuffer || soundsOff()) return;
  const asked = Date.now();
  if (asked - lastPlayedAt < MIN_GAP_MS) return;
  lastPlayedAt = asked;
  soundContext.resume().then(() => {
    if (Date.now() - asked > STALE_AFTER_MS) return;
    const source = soundContext.createBufferSource();
    const gain = soundContext.createGain();
    source.buffer = soundBuffer;
    gain.gain.value = SOUND_GAIN;
    source.connect(gain).connect(soundContext.destination);
    source.start();
  }).catch(() => {});
}
