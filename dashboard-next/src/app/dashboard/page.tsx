'use client'

import { useEffect, useState, useCallback } from 'react'
import { Topbar } from '@/components/Topbar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { api, type StatsResidences, type Incident, type Notification } from '@/lib/api'
import { formatRelative, getStatusColor } from '@/lib/utils'
import {
  Home, Users, ShieldCheck, AlertTriangle, TrendingUp, TrendingDown,
  Minus, ArrowRight, Plane, Activity, Clock
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts'

// ── Types locaux ─────────────────────────────────────────────
interface DashboardData {
  stats: StatsResidences | null
  personnel: { count: number; par_societe: Record<string, number> } | null
  incidents: { declares: number; en_cours: number; resolus: number; critiques: number } | null
  voyages: { en_voyage: number; planifies: number } | null
  notifications: Notification[]
  induction: { total: number; induits: number; en_cours: number } | null
}

// ── Données de graphique mockées (tendance 7 jours) ──────────
const OCCUPATION_TREND = [
  { jour: 'Lun', pct: 78 }, { jour: 'Mar', pct: 81 },
  { jour: 'Mer', pct: 80 }, { jour: 'Jeu', pct: 83 },
  { jour: 'Ven', pct: 85 }, { jour: 'Sam', pct: 84 },
  { jour: 'Dim', pct: 84 },
]

// ── Composant KPI Card ────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, delta, deltaUp, color = 'blue' }: {
  icon: React.ElementType; label: string; value: string | number
  delta?: string; deltaUp?: boolean; color?: string
}) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    red:    'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1.5 text-2xl font-semibold text-foreground">{value ?? '—'}</p>
            {delta && (
              <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${
                deltaUp === true ? 'text-green-600' : deltaUp === false ? 'text-red-600' : 'text-muted-foreground'
              }`}>
                {deltaUp === true ? <TrendingUp className="h-3 w-3" /> :
                 deltaUp === false ? <TrendingDown className="h-3 w-3" /> :
                 <Minus className="h-3 w-3" />}
                {delta}
              </p>
            )}
          </div>
          <div className={`rounded-lg p-2 ${colors[color]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Composant Principal ───────────────────────────────────────
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    stats: null, personnel: null, incidents: null,
    voyages: null, notifications: [], induction: null,
  })
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.allSettled([
        api.get<any>('/api/batiments/stats/'),
        api.get<any>('/api/personnel/?page_size=1'),
        api.get<any>('/api/incidents/stats-sql/'),
        api.get<any>('/api/voyages/stats/'),
        api.get<any>('/api/notifications/compteur/'),
        api.get<any>('/api/personnel/?page_size=200'),
      ])

      const [statsR, persR, incR, voyR, notifR, persListR] = results

      // Induction: calculer depuis la liste du personnel
      let inductionData = null
      if (persListR.status === 'fulfilled') {
        const list = persListR.value?.results || persListR.value || []
        const total = list.length
        const induits = list.filter((p: any) => p.inductionrecord?.statut === 'valide').length
        const en_cours = list.filter((p: any) => p.inductionrecord?.statut === 'en_cours').length
        inductionData = { total, induits, en_cours }
      }

      setData({
        stats:         statsR.status === 'fulfilled' ? statsR.value : null,
        personnel:     persR.status === 'fulfilled'  ? { count: persR.value?.count || 0, par_societe: {} } : null,
        incidents:     incR.status === 'fulfilled'   ? incR.value : null,
        voyages:       voyR.status === 'fulfilled'   ? voyR.value : null,
        notifications: notifR.status === 'fulfilled' ? (notifR.value?.notifications || []) : [],
        induction:     inductionData,
      })
      setLastSync(new Date())
    } catch (e) {
      console.error('Dashboard load error:', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh 60s
  useEffect(() => {
    const iv = setInterval(load, 60_000)
    return () => clearInterval(iv)
  }, [load])

  const { stats, incidents, voyages, induction, notifications } = data
  const taux = stats?.taux_occupation ?? null
  const notifCount = notifications.filter(n => !n.lu).length

  const CONFORMITE = [
    { societe: 'ROXGOLD',        pct: 95, ok: true },
    { societe: 'SAPH Contractors', pct: 82, ok: true },
    { societe: 'GAROCORP',       pct: 71, ok: false },
    { societe: 'CIC',            pct: 58, ok: false },
    { societe: 'BNI',            pct: 33, ok: false },
    { societe: 'OCI',            pct: 41, ok: false },
  ]

  return (
    <div className="flex flex-col">
      <Topbar
        title="Tableau de bord"
        subtitle={lastSync ? `Sync ${lastSync.toLocaleTimeString('fr-FR')}` : 'Chargement...'}
        onRefresh={load}
        loading={loading}
        notifCount={notifCount}
      />

      <div className="flex-1 space-y-4 p-6">

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            icon={Home} label="Taux d'occupation" color="blue"
            value={taux !== null ? `${taux}%` : '—'}
            delta="+3% ce mois" deltaUp={true}
          />
          <KpiCard
            icon={Users} label="Personnel actif" color="green"
            value={data.personnel?.count ?? '—'}
            delta="Stable"
          />
          <KpiCard
            icon={AlertTriangle} label="Incidents ouverts" color="red"
            value={incidents ? (incidents.declares || 0) + (incidents.en_cours || 0) : '—'}
            delta={incidents?.critiques ? `${incidents.critiques} critique(s)` : undefined}
            deltaUp={false}
          />
          <KpiCard
            icon={ShieldCheck} label="Induction QHSE" color="purple"
            value={induction ? `${Math.round(induction.induits / Math.max(induction.total, 1) * 100)}%` : '—'}
            delta={induction ? `${induction.induits}/${induction.total} induits` : undefined}
            deltaUp={true}
          />
        </div>

        {/* ── Row 2 ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Graphique occupation */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Occupation — 7 derniers jours</CardTitle>
                  <CardDescription>Taux d'occupation des résidences</CardDescription>
                </div>
                <Badge variant="blue">{taux !== null ? `${taux}%` : '—'} aujourd'hui</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={OCCUPATION_TREND} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="occ" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="jour" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Occupation']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Area type="monotone" dataKey="pct" stroke="#1e3a8a" strokeWidth={2} fill="url(#occ)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Alertes opérationnelles */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Alertes opérationnelles</CardTitle>
                {incidents && (
                  <Badge variant="destructive">
                    {(incidents.declares || 0) + (incidents.en_cours || 0)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {incidents?.critiques && incidents.critiques > 0 ? (
                <div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                  <div>
                    <p className="text-xs font-semibold text-red-700">{incidents.critiques} incident(s) critique(s)</p>
                    <p className="text-xs text-red-600">Intervention immédiate requise</p>
                  </div>
                </div>
              ) : null}
              {incidents?.en_cours && incidents.en_cours > 0 ? (
                <div className="flex items-start gap-2.5 rounded-lg bg-orange-50 p-3">
                  <Activity className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
                  <div>
                    <p className="text-xs font-semibold text-orange-700">{incidents.en_cours} en cours de résolution</p>
                    <p className="text-xs text-orange-600">Suivi actif</p>
                  </div>
                </div>
              ) : null}
              {voyages?.en_voyage && voyages.en_voyage > 0 ? (
                <div className="flex items-start gap-2.5 rounded-lg bg-blue-50 p-3">
                  <Plane className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                  <div>
                    <p className="text-xs font-semibold text-blue-700">{voyages.en_voyage} personne(s) en déplacement</p>
                    <p className="text-xs text-blue-600">Rotations actives</p>
                  </div>
                </div>
              ) : null}
              {stats?.departs_s1 && stats.departs_s1 > 0 ? (
                <div className="flex items-start gap-2.5 rounded-lg bg-purple-50 p-3">
                  <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
                  <div>
                    <p className="text-xs font-semibold text-purple-700">{stats.departs_s1} départ(s) cette semaine</p>
                    <p className="text-xs text-purple-600">Libérations à planifier</p>
                  </div>
                </div>
              ) : null}
              {!incidents?.critiques && !incidents?.en_cours && !voyages?.en_voyage && !stats?.departs_s1 && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <ShieldCheck className="mb-2 h-8 w-8 text-green-500" />
                  <p className="text-xs font-semibold text-green-700">Tout est normal</p>
                  <p className="text-xs text-muted-foreground">Aucune alerte active</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Row 3 ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Conformité HSE */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Conformité Induction HSE</CardTitle>
                  <CardDescription>Par société sous-traitante</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  Détail <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {CONFORMITE.map(({ societe, pct, ok }) => (
                <div key={societe}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{societe}</span>
                    <span className={`text-xs font-semibold ${
                      pct >= 80 ? 'text-green-700' : pct >= 60 ? 'text-orange-600' : 'text-red-600'
                    }`}>{pct}%</span>
                  </div>
                  <Progress
                    value={pct}
                    indicatorClassName={pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-orange-500' : 'bg-red-500'}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Activité & Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Activité récente</CardTitle>
                  <CardDescription>Dernières notifications système</CardDescription>
                </div>
                {notifCount > 0 && <Badge variant="destructive">{notifCount} nouvelles</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              {notifications.length > 0 ? (
                <div className="space-y-0">
                  {notifications.slice(0, 6).map((n, i) => (
                    <div key={n.id || i} className="flex items-start gap-3 border-b py-2.5 last:border-0">
                      <div className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${
                        n.source === 'induction_expiry' ? 'bg-orange-400' :
                        !n.lu ? 'bg-blue-500' : 'bg-gray-200'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">
                          {n.evenement_titre || n.message || 'Notification'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{formatRelative(n.date_envoi)}</p>
                      </div>
                      {!n.lu && <Badge variant="blue" className="flex-shrink-0 text-[10px]">Nouveau</Badge>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Activity className="mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">Aucune notification récente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Row 4: Incidents + Induction bar chart ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Statut incidents bar */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Répartition des incidents</CardTitle>
              <CardDescription>Par statut de résolution</CardDescription>
            </CardHeader>
            <CardContent>
              {incidents ? (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart
                    data={[
                      { name: 'Déclarés',   val: incidents.declares || 0,  fill: '#ef4444' },
                      { name: 'En cours',   val: incidents.en_cours || 0,  fill: '#f59e0b' },
                      { name: 'Résolus',    val: incidents.resolus || 0,   fill: '#10b981' },
                    ]}
                    margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                      {[{ fill: '#ef4444' }, { fill: '#f59e0b' }, { fill: '#10b981' }].map((entry, i) => (
                        <rect key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[140px] items-center justify-center text-xs text-muted-foreground">
                  Chargement...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Induction summary */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Induction QHSE</CardTitle>
                  <CardDescription>État de conformité global</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  Gérer <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {induction ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">
                      {Math.round(induction.induits / Math.max(induction.total, 1) * 100)}%
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {induction.induits} / {induction.total} membres
                    </span>
                  </div>
                  <Progress
                    value={Math.round(induction.induits / Math.max(induction.total, 1) * 100)}
                    className="h-2.5"
                    indicatorClassName="bg-[#1e3a8a]"
                  />
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { label: 'Induits', count: induction.induits, color: 'bg-green-100 text-green-800' },
                      { label: 'En cours', count: induction.en_cours, color: 'bg-yellow-100 text-yellow-800' },
                      { label: 'Non commencé', count: induction.total - induction.induits - induction.en_cours, color: 'bg-gray-100 text-gray-700' },
                    ].map(({ label, count, color }) => (
                      <div key={label} className={`rounded-lg p-2.5 text-center ${color}`}>
                        <p className="text-lg font-semibold">{count}</p>
                        <p className="text-[10px] font-medium">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-[140px] items-center justify-center text-xs text-muted-foreground">
                  Chargement...
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
