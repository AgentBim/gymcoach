export function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  return <button type={type} className={`cu-button cu-button--${variant} ${className}`.trim()} {...props} />
}

export function IconButton({ label, className = '', ...props }) {
  return <Button className={`cu-icon-button ${className}`.trim()} aria-label={label} title={label} {...props} />
}

export function Input({ className = '', ...props }) {
  return <input className={`cu-input ${className}`.trim()} {...props} />
}

export function Select({ className = '', children, ...props }) {
  return <select className={`cu-select ${className}`.trim()} {...props}>{children}</select>
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`cu-textarea ${className}`.trim()} {...props} />
}

export function Field({ label, htmlFor, children, className = '' }) {
  return <div className={`cu-field ${className}`.trim()}><label className="cu-label" htmlFor={htmlFor}>{label}</label>{children}</div>
}

export function Card({ padded = false, className = '', ...props }) {
  return <div className={`cu-card${padded ? ' cu-card--padded' : ''} ${className}`.trim()} {...props} />
}

export function Chip({ selected, className = '', ...props }) {
  return <button type="button" className={`cu-chip ${className}`.trim()} aria-pressed={selected} {...props} />
}

export function Badge({ tone, className = '', ...props }) {
  const modifier = tone ? ` cu-badge--${tone}` : ''
  return <span className={`cu-badge${modifier} ${className}`.trim()} {...props} />
}

export function Alert({ tone = 'error', className = '', ...props }) {
  return <p role={tone === 'error' ? 'alert' : 'status'} className={`cu-alert cu-alert--${tone} ${className}`.trim()} {...props} />
}

export function EmptyState({ className = '', ...props }) {
  return <div className={`cu-empty cu-card ${className}`.trim()} {...props} />
}

export function Skeleton({ lines = 3, label = 'Loading content' }) {
  return <div className="cu-skeleton" role="status" aria-label={label}>{Array.from({ length: lines }, (_, index) => <span key={index} />)}</div>
}

export function InlineError({ children, onRetry }) {
  return <Alert tone="error">{children}{onRetry && <Button variant="ghost" onClick={onRetry}>Try again</Button>}</Alert>
}

export function StatCard({ label, value, className = '' }) {
  return <Card className={`cu-stat ${className}`.trim()}><div className="cu-stat__label">{label}</div><div className="cu-stat__value">{value}</div></Card>
}

export function Modal({ labelledBy, children, onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    const dialog = dialogRef.current
    const focusable = dialog?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])') || []
    ;(focusable[0] || dialog)?.focus()
    function handleKey(event) {
      if (event.key === 'Escape' && onClose) onClose()
      if (event.key !== 'Tab' || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus?.() }
  }, [onClose])
  return <div className="cu-overlay" onMouseDown={event => event.target === event.currentTarget && onClose?.()}><div ref={dialogRef} tabIndex={-1} className="cu-modal cu-card cu-card--padded" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>{children}</div></div>
}

export function ConfirmationDialog({ title, children, confirmLabel = 'Confirm', onConfirm, onCancel, danger = false }) {
  return <Modal labelledBy="confirmation-title" onClose={onCancel}><h2 id="confirmation-title">{title}</h2><div>{children}</div><div className="cu-dialog-actions"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button></div></Modal>
}

export function Drawer({ labelledBy, children, onClose }) {
  const drawerRef = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    const drawer = drawerRef.current
    const focusable = drawer?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]') || []
    ;(focusable[0] || drawer)?.focus()
    function handleKey(event) {
      if (event.key === 'Escape') onClose?.()
      if (event.key !== 'Tab' || !focusable.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus?.() }
  }, [onClose])
  return <><button className="cu-drawer-backdrop" aria-label="Close drawer" onClick={onClose} /><aside ref={drawerRef} tabIndex={-1} className="cu-drawer" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>{children}</aside></>
}

export function Toast({ tone = 'success', children }) {
  return <div className="cu-toast"><Alert tone={tone}>{children}</Alert></div>
}
import { useEffect, useRef } from 'react'
