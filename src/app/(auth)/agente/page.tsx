import { notFound } from 'next/navigation'
import { isAgentBootstrapEnabled } from '@/lib/auth/agent-bootstrap'
import { AgentBootstrapForm } from './agent-bootstrap-form'

export default function AgentBootstrapPage() {
  if (!isAgentBootstrapEnabled()) {
    notFound()
  }

  return <AgentBootstrapForm />
}
