// Единый набор штриховых SVG-иконок (замена эмодзи в UI).
// Наследует цвет через currentColor. Размер и толщину линии можно менять пропсами.

export type IconName =
  | 'sword' | 'cpu' | 'deck' | 'bag' | 'store' | 'anvil' | 'wallet' | 'pickaxe'
  | 'trophy' | 'book' | 'music' | 'musicOff' | 'gear' | 'chevron' | 'back'
  | 'close' | 'check' | 'clock' | 'search' | 'gift' | 'dice' | 'user' | 'plus'
  | 'coin' | 'gas' | 'link' | 'globe' | 'sparkle' | 'castle' | 'key'
  | 'boom' | 'heart' | 'skull' | 'bolt' | 'drop' | 'shield' | 'pill' | 'ban'
  | 'fire' | 'target' | 'gamepad' | 'moneybag' | 'party' | 'plug' | 'star'
  | 'arrowRight' | 'hourglass' | 'cards' | 'phone' | 'zen';

const P: Record<IconName, string> = {
  sword: '<path d="M14.5 4.5 20 3l-1.5 5.5-8 8L4 20l-1-4 4-1.5z"/><path d="m14.5 9.5-5 5M4 20l3-3"/>',
  cpu: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M12 3v2M12 19v2M8 3v2M16 3v2M8 19v2M16 19v2M3 8h2M3 16h2M19 8h2M19 16h2"/>',
  deck: '<rect x="8" y="3" width="11" height="15" rx="2"/><path d="M5 6v13a2 2 0 0 0 2 2h9"/>',
  bag: '<path d="M6 8h12l-1 12H7z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  store: '<path d="M4 9l1-5h14l1 5"/><path d="M4 9v10h16V9"/><path d="M4 9a2.2 2.2 0 0 0 4 0 2.2 2.2 0 0 0 4 0 2.2 2.2 0 0 0 4 0 2.2 2.2 0 0 0 4 0"/><path d="M9 19v-5h6v5"/>',
  anvil: '<path d="M6 8h9a4 4 0 0 1-4 4H9m-3-4H3m3 0v2m5 2v4m-4 0h8M9 6h4"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M16 12h2.5"/>',
  pickaxe: '<path d="M4 20 14 10"/><path d="M3 9c4-4 10-5 18-6-1 8-2 14-6 18"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 20h6M12 14v6"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M19 19H6.5A2.5 2.5 0 0 1 4 16.5"/>',
  music: '<circle cx="6" cy="17" r="2.5"/><circle cx="17" cy="15" r="2.5"/><path d="M8.5 17V6l11-2v11"/>',
  musicOff: '<circle cx="6" cy="17" r="2.5"/><path d="M8.5 17V6l11-2v4"/><path d="M3 3l18 18"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12l5 5 9-11"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-3.5-3.5"/>',
  gift: '<path d="M4 11h16v9H4z"/><path d="M4 7h16v4H4zM12 7v13M12 7C10 7 8 6 8 4.5S10 3 12 7zM12 7c2 0 4-1 4-2.5S14 3 12 7z"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.1"/><circle cx="15" cy="15" r="1.1"/><circle cx="15" cy="9" r="1.1"/><circle cx="9" cy="15" r="1.1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M9.5 9.5h3.5a1.5 1.5 0 0 1 0 3H10a1.5 1.5 0 0 0 0 3h3.5"/>',
  gas: '<path d="M6 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16H5"/><path d="M15 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-2.5-2.5M8 8h5"/>',
  link: '<path d="M9 15l6-6"/><path d="M10 6l1-1a4 4 0 0 1 6 6l-1 1M8 12l-1 1a4 4 0 0 0 6 6l1-1"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 2.5 14 0 17M12 3.5c-2.5 2.5-2.5 14 0 17"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  castle: '<path d="M4 21V8l2 1 2-2 2 2 2-2 2 2 2-1v13M4 12h16M9 21v-4h6v4"/>',
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/>',
  boom: '<path d="M12 2l2.2 4.5L19 5l-1.5 4.8L22 12l-4.5 2.2L19 19l-4.8-1.5L12 22l-2.2-4.5L5 19l1.5-4.8L2 12l4.5-2.2L5 5l4.8 1.5z"/>',
  heart: '<path d="M12 20s-7-4.6-9.2-9C1.3 8 3 4.5 6.4 4.5c2 0 3.2 1.2 3.6 2 .4-.8 1.6-2 3.6-2 3.4 0 5.1 3.5 3.6 6.5C19 15.4 12 20 12 20z"/>',
  skull: '<path d="M5 11a7 7 0 1 1 14 0c0 2-1 3.2-2 4v3H7v-3c-1-.8-2-2-2-4z"/><circle cx="9" cy="11" r="1.3"/><circle cx="15" cy="11" r="1.3"/><path d="M12 15v2"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
  pill: '<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-45 12 12)"/><path d="M8.5 8.5l7 7"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  fire: '<path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C9 10 12 8 12 3z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  gamepad: '<rect x="2" y="7" width="20" height="10" rx="5"/><path d="M7 10v4M5 12h4M15.5 11h.01M18 13h.01"/>',
  moneybag: '<path d="M9 3h6l-1.5 3h-3z"/><path d="M12 6c-4 2-6 5-6 9a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4c0-4-2-7-6-9z"/><path d="M10.5 12h3a1.3 1.3 0 0 1 0 2.6H10a1.3 1.3 0 0 0 0 2.6h3.5M12 10.5v8"/>',
  party: '<path d="M4 20l6-14 8 8z"/><path d="M14 6a3 3 0 0 1 3-3M18 8a2 2 0 0 1 2-2M13 3l.01.01M20 11l.01.01"/>',
  plug: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v4"/>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.4 4.1 1.2 6L12 16.9 6.6 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  arrowRight: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 0M7 21c0-5 10-5 10 0"/>',
  cards: '<rect x="3" y="6" width="11" height="14" rx="2" transform="rotate(-8 8.5 13)"/><rect x="10" y="4" width="11" height="14" rx="2" transform="rotate(8 15.5 11)"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
  zen: '<circle cx="12" cy="6.5" r="2"/><path d="M5 20c0-4 3-7 7-7s7 3 7 7M8 14l-3 6M16 14l3 6"/>',
};

interface Props {
  name: IconName;
  size?: number;
  stroke?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function Icon({ name, size = 22, stroke = 1.7, className, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: P[name] }}
    />
  );
}
