import { createLucideIcon } from 'lucide-react';

/**
 * Composed "Person + Clock" icon for the sidebar's Upcoming nav item. No native combined
 * user+clock icon exists in the installed lucide-react version (0.344.0) — confirmed by
 * inspecting every "user" and "clock" icon file in node_modules/lucide-react/dist/esm/icons
 * before building this. Built with Lucide's own createLucideIcon() factory (a public export),
 * so it behaves identically to every other icon in this app — same size/className/strokeWidth
 * props, ref forwarding, 24x24 viewBox and stroke conventions — never a hand-rolled <svg> wrapper.
 *
 * The person base (head circle + shifted-left shoulders) reuses the exact same path data
 * UserRoundPlus/UserRoundMinus/UserRoundX already use for their person half, and the clock badge
 * occupies the same bottom-right badge zone their +/-/x marks use — so all four PEOPLE section
 * icons read as one consistent visual family.
 */
const UserClockIcon = createLucideIcon('UserClock', [
  ['path', { d: 'M2 21a8 8 0 0 1 13.292-6', key: 'ucik-body' }],
  ['circle', { cx: '10', cy: '8', r: '5', key: 'ucik-head' }],
  ['circle', { cx: '19', cy: '19', r: '3.5', key: 'ucik-badge' }],
  ['path', { d: 'M19 17.5V19l1.2 1.2', key: 'ucik-hands' }],
]);

export default UserClockIcon;
