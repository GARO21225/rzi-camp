'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Map, Monitor, Home, Users, ShieldCheck,
  Plane, Wrench, ShoppingCart, Calendar, BarChart3, Bot,
  ChevronRight, LogOut, Settings
} from 'lucide-react'

const NAV = [
  {
    items: [
      { href: '/dashboard',    label: 'Dashboard',          icon: LayoutDashboard },
      { href: '/carte',        label: 'Carte GIS',          icon: Map },
      { href: '/operations',   label: 'Centre Opérationnel',icon: Monitor },
    ]
  },
  {
    label: 'Camp',
    items: [
      { href: '/residences',   label: 'Résidences',  icon: Home },
      { href: '/personnel',    label: 'Personnel',   icon: Users },
      { href: '/induction',    label: 'Induction QHSE', icon: ShieldCheck },
      { href: '/rotations',    label: 'Rotations',   icon: Plane },
    ]
  },
  {
    label: 'Services',
    items: [
      { href: '/maintenance',  label: 'Maintenance', icon: Wrench,  badge: '4' },
      { href: '/boutique',     label: 'Bar & Boutique', icon: ShoppingCart },
      { href: '/reservations', label: 'Réservations', icon: Calendar },
    ]
  },
  {
    label: 'Analyse',
    items: [
      { href: '/analytics',    label: 'Analytics',   icon: BarChart3 },
      { href: '/assistant',    label: 'Assistant IA', icon: Bot },
    ]
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-[220px] flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex h-14 items-center gap-3 border-b px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a8a]">
          <Home className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">RZI Camp</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Roxgold Sango</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2">
        {NAV.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-3' : ''}>
            {section.label && (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
            )}
            {section.items.map(item => {
              const Icon = item.icon
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                      {item.badge}
                    </span>
                  )}
                  {active && <ChevronRight className="h-3 w-3 opacity-50" />}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t p-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-800">
            AR
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium">Admin RZI</p>
            <p className="truncate text-[10px] text-muted-foreground">Administrateur</p>
          </div>
          <button className="text-muted-foreground hover:text-foreground">
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
