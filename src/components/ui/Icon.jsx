// Line icons from the redesign mockup (24px grid, 1.8 stroke). Use these
// instead of emoji so every screen draws from one set.
const PATHS = {
  today: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  athletes: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" /><path d="M16 4.8a3.5 3.5 0 010 6.4M18 14.8c2 .6 3.3 2.4 3.6 5.2" /></>,
  inbox: <path d="M4 5h16v11H9l-5 4z" />,
  plan: <><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  back: <path d="M15 6l-6 6 6 6" />,
  forward: <path d="M9 6l6 6-6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  more: <><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,
  flame: <path d="M12 3c.5 3-1.5 4.5-3 6.5S7 13 8.5 16c1 2 3 3 3.5 3-1-1.5-.5-3 .5-4 1.5 1.5 3 2.5 2.5 5 2-1 3.5-3 3.5-5.5 0-3.5-3-5-3.5-7-.5 1-1.5 1.5-2.5 1.5C13 7 12.5 5 12 3z" />,
  send: <path d="M4 12l16-8-6 17-3-7-7-2z" />,
  link: <><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></>,
  trash: <path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  edit: <path d="M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3" />,
  tools: <path d="M14.5 6.5a4 4 0 00-5 5L4 17l3 3 5.5-5.5a4 4 0 005-5l-2.5 2.5-2-2z" />,
  recovery: <path d="M4 14c3 0 3-6 6-6s3 8 6 8 2-4 4-4" />,
  rest: <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />,
  note: <path d="M6 4h12v16H6zM9 9h6M9 13h6" />,
  warn: <><path d="M12 4l9 16H3L12 4z" /><path d="M12 10v4M12 17.5v.1" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-3.6 3.5-5.5 7-5.5s6.3 1.9 7 5.5" /></>,
  progress: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />,
  week: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 14h.1M12 14h.1M16 14h.1M8 17.5h.1M12 17.5h.1" /></>,
}

export function Icon({ name, size = 18, strokeWidth = 1.8, style, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }} {...rest}>
      {PATHS[name]}
    </svg>
  )
}
