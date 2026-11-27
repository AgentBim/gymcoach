import { Button, Card } from './ui'
import './CollectionLoading.css'

export function CollectionStatus({ name, loading, refreshing, error, onRetry }) {
  return <div className="collection-status" role="status" aria-live="polite" aria-atomic="true">
    {error ? <><span>Couldn’t load {name}. Check your connection and try again.</span><Button size="sm" onClick={onRetry}>Retry</Button></>
      : loading ? `Loading ${name}…` : refreshing ? `Updating ${name}…` : null}
  </div>
}

const Line = ({ width = '70%', small = false }) => <span className={`collection-ghost${small ? ' collection-ghost--small' : ''}`} style={{ width }} />

export function CollectionSkeleton({ kind, columns, mobile }) {
  if (kind === 'programs') return <div className="collection-program-grid" aria-hidden="true">
    {Array.from({ length: 3 }, (_, i) => <Card key={i} className="collection-program-placeholder">
      <Line width={['64%', '78%', '57%'][i]} /><Line small width="46%" />
      <div className="collection-week-placeholder">{Array.from({ length: 21 }, (_, n) => <span className="collection-ghost" key={n} />)}</div>
      <div className="collection-placeholder-footer"><Line small width="42%" /><Line small width="18%" /></div>
    </Card>)}
  </div>
  return <div className="collection-list-placeholder" aria-hidden="true">
    <Card style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
      {!mobile && <div className="collection-row-placeholder collection-placeholder-heading" style={{ gridTemplateColumns: columns }}>
        {Array.from({ length: 6 }, (_, i) => <Line key={i} small width={i ? '65%' : '38%'} />)}
      </div>}
      {Array.from({ length: 5 }, (_, i) => <div key={i} className={`collection-row-placeholder${mobile ? ' collection-row-placeholder--mobile' : ''}${kind === 'workouts' && mobile ? ' collection-row-placeholder--workout' : ''}`} style={{ gridTemplateColumns: mobile ? 'minmax(0, 1fr) 30%' : columns }}>
        <div className="collection-placeholder-name"><Line width={['64%', '80%', '56%', '72%', '60%'][i]} /><Line small width="40%" /></div>
        <Line small width="85%" />
        {!mobile && Array.from({ length: 4 }, (_, n) => <Line key={n} small width={n === 3 ? '65%' : '70%'} />)}
        {kind === 'workouts' && mobile && <Line small width="70%" />}
      </div>)}
    </Card>
    {kind === 'exercises' && !mobile && <Card className="collection-detail-placeholder"><Line width="65%" /><Line small /><Line small width="90%" /><Line small width="80%" /></Card>}
  </div>
}
