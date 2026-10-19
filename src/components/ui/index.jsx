// Shared building blocks taken from the redesign mockup: avatar, chip, pill,
// segmented control, stat card, week dots, dialog/sheet and the undo toast.
import { useEffect, useState } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { avatarColor, initials } from '../../lib/theme'
import { Icon } from './Icon'

export { Icon }

const TONES = {
  neutral: { bg: 'var(--s2)', color: 'var(--mu2)' },
  text: { bg: 'var(--s2)', color: 'var(--tx)' },
  accent: { bg: 'rgba(199,228,92,.12)', color: 'var(--ac)' },
  amber: { bg: 'rgba(231,162,62,.14)', color: '#E7A23E' },
  coral: { bg: 'rgba(226,105,90,.14)', color: '#E2695A' },
  teal: { bg: 'rgba(79,184,138,.14)', color: '#4FB88A' },
  blue: { bg: 'rgba(107,169,222,.14)', color: '#6BA9DE' },
  violet: { bg: 'rgba(161,132,227,.14)', color: '#A184E3' },
}

export function Chip({ tone = 'neutral', mono, children, style }) {
  const t = TONES[tone] || TONES.neutral
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
      background: t.bg, color: t.color, fontFamily: mono ? 'var(--mono)' : undefined, ...style }}>
      {children}
    </span>
  )
}

export function Avatar({ name, size = 36, style }) {
  const c = avatarColor(name)
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), display: 'inline-grid', placeItems: 'center', flexShrink: 0,
      fontSize: Math.round(size * 0.34), fontWeight: 700, background: c.bg, color: c.color, ...style }}>
      {initials(name)}
    </span>
  )
}

export function Label({ children, style }) {
  return <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mu)', ...style }}>{children}</div>
}

export function Pill({ on, onClick, children, count }) {
  const isMobile = useIsMobile()
  return (
    <button type="button" aria-pressed={!!on} onClick={onClick}
      style={{ padding: '0 14px', minHeight: isMobile ? 40 : 32, borderRadius: 20, whiteSpace: 'nowrap', fontSize: 12.5, cursor: 'pointer',
        border: `1px solid ${on ? 'var(--ac)' : 'var(--br)'}`, background: on ? 'var(--ac)' : 'transparent', color: on ? 'var(--ac-ink)' : 'var(--mu2)', fontWeight: on ? 700 : 500 }}>
      {children}{count != null ? ` ${count}` : ''}
    </button>
  )
}

export function PillRow({ label, children }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 8, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 2 }}>{children}</div>
  )
}

export function Segmented({ label, options, value, onChange, style }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', border: '1px solid var(--br2)', borderRadius: 9, overflow: 'hidden', ...style }}>
      {options.map(o => {
        const on = o.value === value
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)}
            style={{ flex: 1, minHeight: 36, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: on ? 700 : 500, background: on ? 'var(--ac)' : 'transparent', color: on ? 'var(--ac-ink)' : 'var(--mu2)' }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Button({ variant = 'default', size = 'md', icon, children, style, ...rest }) {
  const isMobile = useIsMobile()
  const pri = variant === 'primary'
  const danger = variant === 'danger'
  return (
    <button type="button" {...rest}
      style={{ minHeight: isMobile ? 44 : size === 'sm' ? 32 : 36, padding: '0 14px', borderRadius: 8, fontSize: 13, fontWeight: pri ? 700 : 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap',
        cursor: rest.disabled ? 'default' : 'pointer', opacity: rest.disabled ? 0.5 : 1,
        border: `1px solid ${pri ? 'var(--ac)' : danger ? 'rgba(226,105,90,.4)' : 'var(--br2)'}`,
        background: pri ? 'var(--ac)' : 'transparent', color: pri ? 'var(--ac-ink)' : danger ? '#E2695A' : 'var(--tx)', ...style }}>
      {icon && <Icon name={icon} size={16} />}{children}
    </button>
  )
}

export function Card({ as: Tag = 'section', style, children, ...rest }) {
  return <Tag {...rest} style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 14, ...style }}>{children}</Tag>
}

export function StatCard({ label, value, note, tone, to, onClick, border }) {
  const inner = (
    <>
      <Label>{label}</Label>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
        <span style={{ fontFamily: 'var(--font-head)', fontSize: 40, fontWeight: 800, lineHeight: 1, color: tone || 'var(--tx)' }}>{value}</span>
        {note && <span style={{ fontSize: 13, color: 'var(--mu2)' }}>{note}</span>}
      </div>
    </>
  )
  const style = { display: 'block', padding: '14px 16px', textAlign: 'left', background: 'var(--s1)', border: `1px solid ${border || 'var(--br)'}`, borderRadius: 14, color: 'var(--tx)' }
  if (to) return <a href={to} onClick={onClick} style={style}>{inner}</a>
  return <div style={style}>{inner}</div>
}

// Week dot states: done | miss | rest | today | future | none
const DOT = {
  done: { bg: 'var(--ac)', label: 'Done' },
  miss: { bg: 'rgba(226,105,90,.2)', border: '#E2695A', label: 'Missed' },
  rest: { bg: 'var(--br)', label: 'Rest', small: true },
  today: { bg: 'transparent', border: 'var(--ac)', label: 'Due today' },
  future: { bg: 'transparent', border: 'var(--br2)', label: 'Upcoming' },
  none: { bg: 'transparent', label: '' },
}

export function Dot({ state, size = 18 }) {
  const d = DOT[state] || DOT.none
  const s = d.small ? Math.round(size * 0.45) : size
  return (
    <span role="img" aria-label={d.label} style={{ width: s, height: s, borderRadius: '50%', boxSizing: 'border-box', display: 'inline-grid', placeItems: 'center', flexShrink: 0,
      background: d.bg, border: d.border ? `1.5px solid ${d.border}` : 'none', color: state === 'done' ? 'var(--ac-ink)' : '#E2695A' }}>
      {state === 'done' && <Icon name="check" size={Math.round(s * 0.65)} strokeWidth={3} />}
      {state === 'miss' && <Icon name="close" size={Math.round(s * 0.55)} strokeWidth={3} />}
    </span>
  )
}

export function WeekDots({ days, size = 14, gap = 6 }) {
  return (
    <span role="img" aria-label="This week, Monday to Sunday" style={{ display: 'inline-flex', alignItems: 'center', gap }}>
      {days.map((s, i) => <span key={i} style={{ width: size, height: size, display: 'inline-grid', placeItems: 'center' }}><Dot state={s} size={size} /></span>)}
    </span>
  )
}

export function DotLegend({ items = ['done', 'miss', 'today', 'rest'] }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--mu2)' }}>
      {items.map(k => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Dot state={k} size={12} />{DOT[k].label}</span>)}
    </div>
  )
}

export function PageHeader({ eyebrow, title, children }) {
  return (
    <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <div>
        {eyebrow && <Label style={{ marginBottom: 6 }}>{eyebrow}</Label>}
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 40, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1 }}>{title}</h1>
      </div>
      {children && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{children}</div>}
    </header>
  )
}

export function SearchBox({ value, onChange, placeholder, label, style }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '0 12px', background: 'var(--s1)', border: '1px solid var(--br2)', borderRadius: 8, color: 'var(--mu)', ...style }}>
      <Icon name="search" size={16} />
      <input aria-label={label || placeholder} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'var(--tx)', fontSize: 13 }} />
    </label>
  )
}

// Centered dialog on desktop, bottom sheet on phones.
export function Dialog({ title, subtitle, onClose, children, footer, width = 480, busy }) {
  const isMobile = useIsMobile()
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  return (
    <div onClick={busy ? undefined : onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(9,13,14,.6)', zIndex: 400, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 16 }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}
        style={{ width: isMobile ? '100%' : width, maxWidth: '100%', maxHeight: isMobile ? '92vh' : '88vh', overflowY: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14,
          background: 'var(--s1)', border: '1px solid var(--br2)', borderRadius: isMobile ? '20px 20px 0 0' : 16,
          padding: isMobile ? '10px 16px calc(env(safe-area-inset-bottom) + 20px)' : 22 }}>
        {isMobile && <div style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, background: '#4A5559' }} />}
        <div>
          <h2 style={{ fontSize: isMobile ? 17 : 22, fontWeight: isMobile ? 700 : 800, fontFamily: isMobile ? undefined : 'var(--font-head)', letterSpacing: '-.01em' }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 12.5, color: 'var(--mu2)', marginTop: 4, lineHeight: 1.45 }}>{subtitle}</p>}
        </div>
        {children}
        {footer && <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>{footer}</div>}
      </div>
    </div>
  )
}

// Light toast with an optional Undo, as in the mockup's destructive actions.
export function UndoToast({ message, onUndo, onClose, ms = 6000 }) {
  const isMobile = useIsMobile()
  useEffect(() => {
    const t = setTimeout(onClose, ms)
    return () => clearTimeout(t)
  }, [message])
  return (
    <div role="status"
      style={{ position: 'fixed', bottom: isMobile ? 'calc(76px + env(safe-area-inset-bottom))' : 24, left: isMobile ? 16 : '50%', right: isMobile ? 16 : 'auto', transform: isMobile ? 'none' : 'translateX(-50%)',
        zIndex: 450, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 14px', borderRadius: 12, background: 'var(--s2)', border: '1px solid var(--ac)', fontSize: 13, fontWeight: 600, maxWidth: isMobile ? 'none' : 480 }}>
      <span style={{ flex: 1 }}>{message}</span>
      {onUndo && <button type="button" onClick={onUndo} style={{ minHeight: 40, padding: '0 12px', background: 'none', border: 'none', color: 'var(--ac)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Undo</button>}
    </div>
  )
}

export function EmptyState({ title, children }) {
  return (
    <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 14, color: 'var(--mu2)' }}>
      {title && <div style={{ color: 'var(--tx)', fontWeight: 600, marginBottom: 4 }}>{title}</div>}
      {children}
    </div>
  )
}

// Standard page body: the mockup's 28/36 desktop padding, 16 on phones.
export function Page({ children, gap = 18, style }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ padding: isMobile ? 'max(18px, calc(var(--sat) + 10px)) 16px 24px' : '28px 36px 36px', display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : gap, ...style }}>
      {children}
    </div>
  )
}

// "⋯" popover menu. items: [{ label, icon, onClick, danger }]
export function MoreMenu({ label, items }) {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        style={{ width: isMobile ? 44 : 34, height: isMobile ? 44 : 34, display: 'grid', placeItems: 'center', borderRadius: 8, border: '1px solid var(--br)', background: open ? 'var(--s2)' : 'transparent', color: 'var(--mu2)', cursor: 'pointer' }}>
        <Icon name="more" />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div role="menu" style={{ position: 'absolute', right: 0, top: isMobile ? 48 : 38, minWidth: 190, zIndex: 41, background: 'var(--s2)', border: '1px solid var(--br2)', borderRadius: 10, padding: 4, boxShadow: '0 12px 32px rgba(0,0,0,.45)' }}>
            {items.map(it => (
              <button key={it.label} type="button" role="menuitem" onClick={() => { setOpen(false); it.onClick() }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, minHeight: isMobile ? 44 : 36, padding: '0 12px', border: 'none', background: 'transparent', borderRadius: 8, fontSize: 13.5, fontWeight: 500, textAlign: 'left', cursor: 'pointer',
                  color: it.danger ? '#E2695A' : 'var(--tx)' }}>
                {it.icon && <Icon name={it.icon} size={16} />}{it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Overlapping avatar stack + "+N".
export function AvatarStack({ names, max = 4, size = 24 }) {
  const shown = names.slice(0, max)
  return (
    <span style={{ display: 'inline-flex' }}>
      {shown.map((n, i) => <Avatar key={n + i} name={n} size={size} style={{ marginLeft: i ? -6 : 0, border: '1.5px solid var(--s1)' }} />)}
      {names.length > max && <span style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), marginLeft: -6, border: '1.5px solid var(--s1)', background: 'var(--br2)', display: 'grid', placeItems: 'center', fontSize: 10, color: 'var(--mu2)', fontWeight: 600 }}>+{names.length - max}</span>}
    </span>
  )
}

// Checkbox row used by assign dialogs.
export function CheckRow({ checked, onChange, children, disabled }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} disabled={disabled} onClick={onChange}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '0 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', color: 'var(--tx)',
        border: `1px solid ${checked ? 'rgba(199,228,92,.45)' : 'var(--br2)'}`, background: checked ? 'rgba(199,228,92,.07)' : 'transparent' }}>
      <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: 'grid', placeItems: 'center', background: checked ? 'var(--ac)' : 'transparent', border: checked ? 'none' : '1.5px solid var(--br2)', color: 'var(--ac-ink)' }}>
        {checked && <Icon name="check" size={13} strokeWidth={3} />}
      </span>
      {children}
    </button>
  )
}
