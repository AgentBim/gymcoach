import { useCallback, useEffect, useState } from 'react'
import { createCollectionLoad } from '../lib/collectionLoad'

export function useCollectionLoad(key, load, initialData) {
  const [state, setState] = useState({ key: null, hasData: false, pending: false, error: null })
  const [runner] = useState(() => createCollectionLoad(setState))
  const reload = useCallback(() => key ? runner.run(key, load) : Promise.resolve(false), [key, load, runner])
  useEffect(() => { reload(); return () => runner.cancel() }, [reload, runner])
  const sameOwner = state.key === key
  const hasData = sameOwner && state.hasData
  return {
    data: hasData ? state.data : initialData,
    hasData,
    loading: !sameOwner || (state.pending && !hasData),
    refreshing: sameOwner && state.pending && hasData,
    error: sameOwner ? state.error : null,
    reload,
  }
}
