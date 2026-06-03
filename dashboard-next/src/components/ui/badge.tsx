import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-primary text-primary-foreground',
        secondary:   'bg-secondary text-secondary-foreground',
        success:     'bg-green-100 text-green-800',
        warning:     'bg-yellow-100 text-yellow-800',
        destructive: 'bg-red-100 text-red-800',
        outline:     'border border-input bg-background',
        muted:       'bg-muted text-muted-foreground',
        blue:        'bg-blue-100 text-blue-800',
        purple:      'bg-purple-100 text-purple-800',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
