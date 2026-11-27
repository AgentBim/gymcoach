import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock('../ui', () => ({ Card: ({children,...props}) => <section {...props}>{children}</section>, Button: ({children,...props}) => <button {...props}>{children}</button> }))
import { CollectionSkeleton, CollectionStatus } from '../CollectionLoading'

describe('collection loading accessibility', () => {
  it('announces loading once while hiding decorative placeholders', () => {
    const status = renderToStaticMarkup(<CollectionStatus name="exercises" loading />)
    expect(status).toContain('role="status"')
    expect(status).toContain('Loading exercises…')
    const skeleton = renderToStaticMarkup(<CollectionSkeleton kind="exercises" mobile />)
    expect(skeleton).toContain('aria-hidden="true"')
    expect(skeleton).not.toContain('<button')
  })
  it('offers Retry after a load fails instead of an empty-library message', () => {
    const html = renderToStaticMarkup(<CollectionStatus name="workouts" error={new Error('Offline')} onRetry={()=>{}} />)
    expect(html).toContain('Couldn’t load workouts.')
    expect(html).toContain('Retry')
    expect(html).not.toContain('No workouts')
  })
})
