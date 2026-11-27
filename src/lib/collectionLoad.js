// Keep the last successful snapshot while refreshing. New owners start empty;
// cancelled, timed-out and superseded requests cannot replace current data.
export function createCollectionLoad(onChange, timeoutMs = 15000) {
  let current = { key: null, data: null, hasData: false, pending: false, error: null }
  let version = 0
  let controller
  function emit(next) { current = next; onChange(next) }
  function cancel() { version++; controller?.abort() }
  async function run(key, load) {
    cancel()
    const request = version
    const abort = new AbortController()
    controller = abort
    emit({ key, data: current.key === key ? current.data : null, hasData: current.key === key && current.hasData, pending: true, error: null })
    let timer
    let rejectAbort
    const interrupted = new Promise((_, reject) => {
      rejectAbort = () => reject(new Error('Loading was interrupted. Please try again.'))
      abort.signal.addEventListener('abort', rejectAbort, { once: true })
      timer = setTimeout(() => abort.abort(), timeoutMs)
    })
    try {
      const data = await Promise.race([Promise.resolve().then(() => load(abort.signal)), interrupted])
      if (request !== version) return false
      emit({ key, data, hasData: true, pending: false, error: null })
      return true
    } catch (error) {
      if (request === version) emit({ ...current, pending: false, error: error instanceof Error ? error : new Error('Could not load the library.') })
      return false
    } finally {
      clearTimeout(timer)
      abort.signal.removeEventListener('abort', rejectAbort)
    }
  }
  return { run, cancel }
}
