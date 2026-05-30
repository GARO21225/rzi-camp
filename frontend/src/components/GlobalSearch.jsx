import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { batiments, personnel as personnelAPI, evenements as evtAPI, voyages as voyAPI } from '../api'

const CATEGORIES = [
  { key:'personnel', label:'Personnel', icon:'👤', color:'#7c3aed' },
  { key:'batiments',  label:'Résidences', icon:'🏠', color:'#2563eb' },
  { key:'evenements', label:'Événements', icon:'📅', color:'#16a34a' },
  { key:'voyages',    label:'Voyages',    icon:'✈️', color:'#f97316' },
]

export default function GlobalSearch() {
  const [q,       setQ]       = useState('')
  const [results, setResults] = useState([])
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const ref = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!q.trim() || q.length < 2) { setResults([]); setOpen(false); return }
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const p = { search: q, page_size: 4 }
        const [pers, bats, evts, voys] = await Promise.allSettled([
          personnelAPI.list(p),
          batiments.list(p),
          evtAPI.list(p),
          voyAPI.list(p),
        ])
        const all = []
        if (pers.status==='fulfilled') {
          const items = pers.value.data.results || pers.value.data || []
          items.slice(0,3).forEach(x => all.push({
            cat:'personnel', icon:'👤', title:`${x.nom} ${x.prenom}`,
            sub: x.societe || x.type_personnel || '', url:'/personnel', color:'#7c3aed'
          }))
        }
        if (bats.status==='fulfilled') {
          const items = bats.value.data.results || bats.value.data || []
          items.slice(0,3).forEach(x => all.push({
            cat:'batiments', icon:'🏠', title: x.nom || x.residence,
            sub: x.residence || x.bloc || '', url:'/residences', color:'#2563eb'
          }))
        }
        if (evts.status==='fulfilled') {
          const items = evts.value.data.results || evts.value.data || []
          items.slice(0,3).forEach(x => all.push({
            cat:'evenements', icon:'📅', title: x.titre || x.title,
            sub: x.lieu || x.type_evenement || '', url:'/evenements', color:'#16a34a'
          }))
        }
        if (voys.status==='fulfilled') {
          const items = voys.value.data.results || voys.value.data || []
          items.slice(0,3).forEach(x => all.push({
            cat:'voyages', icon:'✈️', title: x.destination || `Voyage ${x.id}`,
            sub: x.personnel_nom || x.statut_label || '', url:'/voyages', color:'#f97316'
          }))
        }
        setResults(all)
        setOpen(all.length > 0)
      } catch {}
      setLoading(false)
    }, 320)
  }, [q])

  const go = (url) => { navigate(url); setQ(''); setOpen(false) }

  return (
    <div ref={ref} style={{ position:'relative', flex:1, maxWidth:340 }}>
      <div className="global-search">
        <span style={{ fontSize:15, opacity:.7 }}>🔍</span>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Rechercher personnel, résidence, événement…"
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && <div className="spinner" style={{ width:14, height:14, borderTopColor:'#fff', borderWidth:2 }} />}
      </div>
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((r, i) => (
            <div key={i} onClick={() => go(r.url)}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', cursor:'pointer', borderBottom:'1px solid var(--border)', transition:'background .1s' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--c-blue-l)'}
              onMouseLeave={e => e.currentTarget.style.background=''}>
              <div style={{ width:34, height:34, borderRadius:10, background:`${r.color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                {r.icon}
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</div>
                <div style={{ fontSize:11, color:'var(--text-4)', marginTop:1 }}>{r.cat} · {r.sub}</div>
              </div>
            </div>
          ))}
          <div onClick={() => setOpen(false)}
            style={{ padding:'8px 16px', fontSize:12, color:'var(--text-4)', textAlign:'center', cursor:'pointer' }}>
            Appuyer sur Entrée pour tout voir
          </div>
        </div>
      )}
    </div>
  )
}
