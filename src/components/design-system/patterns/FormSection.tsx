import { Card, CardContent, CardHeader } from '../Card'

/** Pattern de formulário (PFM=B — cards por seção). Um `FormSection` por bloco temático do formulário; várias podem ficar visíveis ao mesmo tempo, em grid. */
export interface FormSectionProps {
  icon?: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function FormSection({ icon, title, description, children, className }: FormSectionProps) {
  return (
    <Card className={className}>
      <CardHeader icon={icon} title={title} description={description} />
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">{children}</div>
      </CardContent>
    </Card>
  )
}
