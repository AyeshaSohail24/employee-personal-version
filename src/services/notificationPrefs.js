// The Rizurf "Notifications" switch (RIZURF_NOTIFICATION_STANDARD.md §4d/§4e): on by default,
// saved per device under the same key every Rizurf app and the gateway use. Off means no banners
// and no sound in this app; the bell's list and unread count still update.
const KEY = 'rizurf-notify';

export function notificationsOn() {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setNotificationsOn(on) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // storage blocked: the switch just won't be remembered on this device
  }
}
