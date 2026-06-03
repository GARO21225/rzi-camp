'use client'
import { Bell, Search, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TopbarProps {
  title: string
  subtitle?: string
  onRefresh?: () => void
  loading?: boolean
  notifCount?: number
}

export function Topbar({ title, subtitle, onRefresh, loading, notifCount = 0 }: TopbarProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-white px-6">
      <div className="flex-1">
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-1.5">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
          En direct
        </div>

        {/* Refresh */}
        {onRefresh && (
          <Button variant="ghost" size="icon" onClick={onRefresh} disabled={loading} className="h-8 w-8">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        )}

        {/* Search */}
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Search className="h-3.5 w-3.5" />
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-3.5 w-3.5" />
          {notifCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </Button>
      </div>
    </header>
  )
}
