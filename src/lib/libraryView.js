export function librarySearch(value) {
  const input = new URLSearchParams(value)
  const output = new URLSearchParams()
  const category = input.get('category')
  const group = input.get('group')
  if (['strength', 'prehab', 'mobility'].includes(category)) output.set('category', category)
  if (['Arms', 'Back', 'Legs', 'Core', 'Shoulders'].includes(group)) output.set('group', group)
  if (input.get('q')) output.set('q', input.get('q').slice(0, 160))
  if (/^[\w-]{1,80}$/.test(input.get('exercise') || '')) output.set('exercise', input.get('exercise'))
  return output.toString()
}

const key = owner => `chalkup:library:v1:${owner}`
export function rememberLibrary(owner, search) {
  if (!owner) return
  try { sessionStorage.setItem(key(owner), librarySearch(search)) } catch { /* Private browsing may disable storage. */ }
}
export function libraryHref(owner) {
  let search = ''
  try { if (owner) search = librarySearch(sessionStorage.getItem(key(owner)) || '') } catch { /* Use the default view. */ }
  return '/plan/exercises' + (search ? '?' + search : '')
}
