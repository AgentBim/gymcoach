import Layout from '../components/Layout'
import { PageHeader, EmptyState, Card } from '../components/ui'
import { useIsMobile } from '../hooks/useIsMobile'

// Placeholder until in-app messaging lands (next phase).
export default function Inbox() {
  const isMobile = useIsMobile()
  return (
    <Layout>
      <div style={{ padding: isMobile ? 'max(18px, calc(var(--sat) + 10px)) 16px 24px' : '28px 36px 36px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <PageHeader title="Inbox" />
        <Card><EmptyState title="Nothing here. You're caught up.">Athlete feedback and messages will appear here.</EmptyState></Card>
      </div>
    </Layout>
  )
}
