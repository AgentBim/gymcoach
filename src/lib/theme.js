// Shared visual tokens, centralized so muscle-group/level/avatar colors can't
// drift between pages the way six copies of the same object inevitably do.
// Values match the chalkup redesign mockup's palette (--blue/--amber/--coral/
// --teal/--violet in index.html's :root).

export const MUSCLE_COLORS = {
  Arms:      { bg: 'rgba(231,162,62,.14)',  color: '#E7A23E' },
  Back:      { bg: 'rgba(107,169,222,.14)', color: '#6BA9DE' },
  Legs:      { bg: 'rgba(226,105,90,.14)',  color: '#E2695A' },
  Core:      { bg: 'rgba(79,184,138,.14)',  color: '#4FB88A' },
  Shoulders: { bg: 'rgba(161,132,227,.14)', color: '#A184E3' },
}

export const DIFF_COLORS = {
  Easy:   { bg: 'rgba(79,184,138,.15)',  color: '#4FB88A' },
  Medium: { bg: 'rgba(231,162,62,.15)',  color: '#E7A23E' },
  Hard:   { bg: 'rgba(226,105,90,.15)',  color: '#E2695A' },
}

export const FOCUS_COLORS = {
  activation: { bg: 'rgba(199,228,92,.12)',  color: '#C7E45C' },
  stability:  { bg: 'rgba(107,169,222,.12)', color: '#6BA9DE' },
  mobility:   { bg: 'rgba(161,132,227,.12)', color: '#A184E3' },
  strength:   { bg: 'rgba(231,162,62,.12)',  color: '#E7A23E' },
}

export const DAY_TYPE_COLORS = {
  training:    { icon: '💪', label: 'Training',   color: '#C7E45C', bg: 'rgba(199,228,92,.16)' },
  rest:        { icon: '😴', label: 'Rest',        color: '#66716D', bg: 'var(--br)' },
  recovery:    { icon: '🚶', label: 'Recovery',    color: '#6BA9DE', bg: 'rgba(107,169,222,.16)' },
  competition: { icon: '🏟', label: 'Competition', color: '#E2695A', bg: 'rgba(226,105,90,.16)' },
}

export const EMOJI_MAP = {
  easy:     { icon: '😴', label: 'Too easy',   color: '#6BA9DE' },
  good:     { icon: '😊', label: 'Good',        color: '#4FB88A' },
  hard:     { icon: '💪', label: 'Challenging', color: '#E7A23E' },
  veryhard: { icon: '🔥', label: 'Very hard',   color: '#E2695A' },
}

const LEVEL_PALETTE = [
  { bg: 'rgba(107,169,222,.15)', color: '#6BA9DE' },
  { bg: 'rgba(79,184,138,.15)',  color: '#4FB88A' },
  { bg: 'rgba(231,162,62,.15)',  color: '#E7A23E' },
  { bg: 'rgba(226,105,90,.15)',  color: '#E2695A' },
  { bg: 'rgba(161,132,227,.15)', color: '#A184E3' },
]
export function levelColor(level) {
  if (!level) return { bg: 'var(--br)', color: 'var(--mu2)' }
  if (level === 'Elite') return { bg: 'rgba(199,228,92,.14)', color: 'var(--ac)' }
  const n = parseInt(level.replace(/\D/g, ''), 10) || 0
  return LEVEL_PALETTE[Math.floor((n - 1) / 2) % LEVEL_PALETTE.length] || LEVEL_PALETTE[0]
}

export const AVATAR_PALETTE = [
  { bg: 'rgba(199,228,92,.14)',  color: '#C7E45C' },
  { bg: 'rgba(107,169,222,.14)', color: '#6BA9DE' },
  { bg: 'rgba(161,132,227,.14)', color: '#A184E3' },
  { bg: 'rgba(79,184,138,.14)',  color: '#4FB88A' },
  { bg: 'rgba(231,162,62,.14)',  color: '#E7A23E' },
  { bg: 'rgba(226,105,90,.14)',  color: '#E2695A' },
]
export function avatarColor(name) {
  return AVATAR_PALETTE[(name || '').charCodeAt(0) % AVATAR_PALETTE.length]
}

export function initials(name) {
  return (name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}
