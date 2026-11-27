import { useCallback, useEffect } from 'react'
import { useBlocker } from 'react-router-dom'
import { Button, Dialog } from './ui'

export default function UnsavedChanges({ dirty, saving = false, noun = 'workout' }) {
  const blocker = useBlocker(useCallback(() => dirty || saving, [dirty, saving]))
  useEffect(() => {
    if (!dirty && !saving && blocker.state === 'blocked') blocker.proceed()
  }, [dirty, saving, blocker])
  useEffect(() => {
    if (!dirty && !saving) return
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, saving])
  if (blocker.state !== 'blocked') return null
  return <Dialog title={saving ? `Saving ${noun}` : 'Leave without saving?'} onClose={() => blocker.reset()}
    footer={<><Button onClick={() => blocker.reset()}>Keep editing</Button>{!saving && <Button variant="danger" onClick={() => blocker.proceed()}>Discard changes</Button>}</>}>
    <p>{saving ? 'Wait for saving to finish before leaving.' : `Your changes will be lost. Stay here to save your ${noun}, or discard them and leave.`}</p>
  </Dialog>
}
