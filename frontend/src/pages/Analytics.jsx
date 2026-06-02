import React from 'react'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js'
import KpiCard from '../components/KpiCard'
import BarChart from '../components/BarChart'
import ProgressBar from '../components/ProgressBar'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler)

export default function Analytics() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const commonOpts = (extra = {}) => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 14, font: { family: 'Outfit', size: 12 } } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'Outfit', size: 11 } } },
      y: { grid: { color: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)' }, ticks: { font: { family: 'Outfit', size: 11 } } },
    },
    ...extra,
  })

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Analytics IA</h1>
          <p className="page-sub">Tableaux de bord avancés · prévisions · tendances · 30 derniers jours</p>
        </div>
        <div className="flex gap-2">
          <div className="tabs">
            <button>7j</button>
            <button className="active">30j</button>
            <button>90j</button>
            <button>1an</button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <KpiCard label="Taux occupation moy" value="89.2%" delta="3.1 pts" deltaDir="up" progress={89.2} progressColor="emerald" progressLabel="Cible 85%" />
        <KpiCard label="MTTR moyen" value="4h 12m" delta="47 min" deltaDir="down" progress={68} progressColor="emerald" progressLabel="Cible 6h" />
        <KpiCard label="Coût / pers / jour" value="87.40€" delta="4.2%" deltaDir="up" progress={42} progressColor="copper" progressLabel="Budget" />
        <KpiCard label="Fraude bloquée" value={14} delta="5 ce mois" deltaDir="up" progress={100} progressColor="emerald" progressLabel="Détecté" />
      </div>

      <div className="card card-pad-lg mb-4">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Tendances occupation & incidents · 30 jours</h3>
        <div style={{ height: 320 }}>
          <Line
            data={{
              labels: Array.from({ length: 30 }, (_, i) => i + 1),
              datasets: [
                { label: 'Occupation %', data: Array.from({ length: 30 }, () => 80 + Math.random() * 12), borderColor: '#003b7a', backgroundColor: 'rgba(0,59,122,.10)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0 },
                { label: 'Incidents', data: Array.from({ length: 30 }, () => Math.round(2 + Math.random() * 10)), borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,.06)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0, yAxisID: 'y1' },
              ],
            }}
            options={commonOpts({ scales: { ...commonOpts().scales, y1: { position: 'right', grid: { display: false }, beginAtZero: true } } })}
          />
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card card-pad-lg">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Top types d'incidents</h3>
          <BarChart
            data={[
              { label: 'Plomberie', value: 18 },
              { label: 'Électricité', value: 12 },
              { label: 'HVAC', value: 9 },
              { label: 'Serrurerie', value: 6 },
              { label: 'Toiture', value: 4 },
              { label: 'Autre', value: 3 },
            ]}
            color="var(--copper-500)"
            unit=" incidents"
          />
        </div>
        <div className="card card-pad-lg">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Consommation énergétique</h3>
          <div style={{ height: 240 }}>
            <Line
              data={{
                labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
                datasets: [
                  { label: 'Électricité (kWh)', data: [8420, 8680, 8510, 8790, 8820, 7400, 7200], borderColor: '#003b7a', backgroundColor: 'rgba(0,59,122,.10)', fill: true, tension: 0.35, borderWidth: 2.5, pointRadius: 0 },
                  { label: 'Eau (m³)', data: [142, 148, 145, 151, 153, 120, 118], borderColor: '#0c4ea2', backgroundColor: 'rgba(12,78,162,.06)', fill: false, tension: 0.35, borderWidth: 2.5, pointRadius: 0, yAxisID: 'y1' },
                ],
              }}
              options={commonOpts({ scales: { ...commonOpts().scales, y1: { position: 'right', grid: { display: false } } } })}
            />
          </div>
        </div>
      </div>

      <style>{`
        .grid { display: grid; } .gap-2 { gap: 8px; } .gap-4 { gap: 16px; } .mb-4 { margin-bottom: 16px; }
        .flex { display: flex; }
        @media (max-width: 900px) { .grid[style*="repeat(4"] { grid-template-columns: 1fr 1fr !important; } }
      `}</style>
    </div>
  )
}
