'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getSilosWithReadings, getFarmSummary } from '@/lib/queries'
import type { SiloWithReading, FarmSummary } from '@/lib/types'

export default function DashboardPage() {
  const [silos, setSilos] = useState<SiloWithReading[]>([])
  const [summary, setSummary] = useState<FarmSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name')

  useEffect(() => {
    async function load() {
      setLoading(true)

      const [silosData, summaryData] = await Promise.all([
        getSilosWithReadings(),
        getFarmSummary(),
      ])

      setSilos(silosData)
      setSummary(summaryData)
      setLoading(false)
    }

    load()
  }, [])

  const levelColor = (pct: number) =>
    pct <= 20 ? '#E24B4A' : pct <= 40 ? '#EF9F27' : '#4CAF7D'

  const borderColor = (alert: string) =>
    alert === 'critical' ? '#E24B4A' : alert === 'low' ? '#EF9F27' : '#4CAF7D'

  const filtered = useMemo(() => {
    let data = [...silos]

    if (filter !== 'all') {
      data = data.filter(s => s.alert_level === filter)
    }

    if (search) {
      const q = search.toLowerCase()
      data = data.filter(
        s =>
          s.name.toLowerCase().includes(q) ||
          (s.material || '').toLowerCase().includes(q)
      )
    }

    if (sort === 'level') {
      data.sort((a, b) => a.level_pct - b.level_pct)
    } else if (sort === 'days') {
      data.sort((a, b) => a.days_remaining - b.days_remaining)
    } else {
      data.sort((a, b) => a.name.localeCompare(b.name))
    }

    return data
  }, [silos, filter, search, sort])

  const critical = silos.filter(s => s.alert_level === 'critical').length
  const low = silos.filter(s => s.alert_level === 'low').length
  const totalKg = silos.reduce((sum, s) => sum + (s.kg_remaining || 0), 0)

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 300,
          color: '#8a9aaa',
          fontSize: 14,
        }}
      >
        Loading dashboard...
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Silo Dashboard</div>
          <div className="page-sub">
            {summary?.farm_name || 'Granja El Roble'} · {silos.length} sensors · Live
            data from Supabase
          </div>
        </div>
        <div className="page-actions">
          <button className="btn-outline">Export CSV</button>
          <Link
            href="/dashboard/alerts"
            className="btn-primary"
            style={{ display: 'inline-block', lineHeight: '1' }}
          >
            + New alarm
          </Link>
        </div>
      </div>

      <div className="summary-row">
        <div className="sum-card">
          <div className="sum-label">Total silos</div>
          <div className="sum-val">{silos.length}</div>
          <div className="sum-sub">Active & transmitting</div>
        </div>
        <div className="sum-card">
          <div className="sum-label">Critical (≤ 20%)</div>
          <div className="sum-val red">{critical}</div>
          <div className="sum-sub">Action required</div>
        </div>
        <div className="sum-card">
          <div className="sum-label">Low (21–40%)</div>
          <div className="sum-val" style={{ color: '#633806' }}>
            {low}
          </div>
          <div className="sum-sub">Order soon</div>
        </div>
        <div className="sum-card">
          <div className="sum-label">Total available</div>
          <div className="sum-val green">{(totalKg / 1000).toFixed(1)} t</div>
          <div className="sum-sub">Across all silos</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#fff',
            border: '0.5px solid #c8d8cc',
            borderRadius: 6,
            padding: '0 10px',
            flex: 1,
            maxWidth: 280,
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#aab8c0"
            strokeWidth="1.5"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search silo or material..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              fontSize: 12,
              color: '#1a2530',
              background: 'transparent',
              width: '100%',
              padding: '7px 0',
            }}
          />
        </div>

        {['all', 'critical', 'low', 'ok'].map(f => {
          const count =
            f === 'all'
              ? silos.length
              : silos.filter(s => s.alert_level === f).length

          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 11px',
                borderRadius: 20,
                fontSize: 11,
                cursor: 'pointer',
                border: '0.5px solid',
                borderColor: filter === f ? '#1a2530' : '#e8ede9',
                background: filter === f ? '#1a2530' : '#fff',
                color: filter === f ? '#fff' : '#6a7a8a',
              }}
            >
              {f === 'all'
                ? `All (${count})`
                : f === 'critical'
                ? `Critical (${count})`
                : f === 'low'
                ? `Low (${count})`
                : `OK (${count})`}
            </button>
          )
        })}

        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          style={{
            border: '0.5px solid #c8d8cc',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            color: '#6a7a8a',
            background: '#fff',
            marginLeft: 'auto',
          }}
        >
          <option value="name">Sort: Name</option>
          <option value="level">Sort: Level (low first)</option>
          <option value="days">Sort: Days remaining</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#8a9aaa',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: '#1a2530',
              marginBottom: 8,
            }}
          >
            No silos found
          </div>
          <div style={{ fontSize: 13 }}>
            Try changing the filters or search term.
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '200px 1fr 120px 130px 110px 100px',
              gap: 16,
              padding: '0 20px 8px',
              marginBottom: 2,
            }}
          >
            {['Silo / Material', 'Level', 'Days left', 'Sensor status', 'Last reading', ''].map(
              h => (
                <div
                  key={h}
                  style={{
                    fontSize: 11,
                    color: '#aab8c0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    fontWeight: 500,
                  }}
                >
                  {h}
                </div>
              )
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(s => (
              <Link
                key={s.id}
                href={`/dashboard/silo/${s.id}`}
                style={{
                  background: '#fff',
                  borderRadius: 10,
                  padding: '16px 20px',
                  display: 'grid',
                  gridTemplateColumns: '200px 1fr 120px 130px 110px 100px',
                  gap: 16,
                  alignItems: 'center',
                  textDecoration: 'none',
                  border: '0.5px solid #e8ede9',
                  borderLeft: `3px solid ${borderColor(s.alert_level)}`,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#1a2530',
                    }}
                  >
                    {s.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#8a9aaa' }}>
                    {s.material}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 5,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 500,
                        color: '#1a2530',
                      }}
                    >
                      {s.level_pct.toFixed(1)}%
                    </span>
                    <span style={{ fontSize: 11, color: '#8a9aaa' }}>
                      {Math.round(s.kg_remaining).toLocaleString()} kg
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: '#f7f9f8',
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        borderRadius: 3,
                        background: levelColor(s.level_pct),
                        width: `${s.level_pct}%`,
                      }}
                    />
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 500,
                      color:
                        s.days_remaining <= 7
                          ? '#A32D2D'
                          : s.days_remaining <= 14
                          ? '#633806'
                          : '#27500A',
                    }}
                  >
                    {s.days_remaining}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: '#aab8c0',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                    }}
                  >
                    days left
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background:
                        s.sensor?.status === 'online'
                          ? '#4CAF7D'
                          : s.sensor?.status === 'delayed'
                          ? '#EF9F27'
                          : s.sensor
                          ? '#E24B4A'
                          : '#aab8c0',
                    }}
                  />
                  <div style={{ fontSize: 11, color: '#8a9aaa' }}>
                    {s.sensor?.status === 'online'
                      ? 'Online'
                      : s.sensor?.status === 'delayed'
                      ? 'Delayed'
                      : s.sensor
                      ? 'Offline'
                      : 'No sensor'}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: '#aab8c0',
                    textAlign: 'right',
                  }}
                >
                  {s.hours_since_reading < 1
                    ? 'Just now'
                    : s.hours_since_reading < 24
                    ? `${Math.round(s.hours_since_reading)}h ago`
                    : `${Math.round(s.hours_since_reading / 24)}d ago`}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: 11,
                      color: '#4CAF7D',
                      fontWeight: 500,
                    }}
                  >
                    View →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}
