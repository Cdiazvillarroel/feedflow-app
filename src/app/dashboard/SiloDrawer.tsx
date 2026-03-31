'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  getSiloById,
  getLatestReading,
  getReadingHistory,
  getSensorBySiloId,
  getDailyConsumption,
} from '@/lib/queries'
import type { Silo, Reading, Sensor } from '@/lib/types'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
)

function levelColor(pct: number) {
  return pct <= 20 ? '#E24B4A' : pct <= 40 ? '#EF9F27' : '#4CAF7D'
}

export default function SiloDrawer({
  siloId,
  open,
  onClose,
}: {
  siloId: string | null
  open: boolean
  onClose: () => void
}) {
  const [silo, setSilo] = useState<Silo | null>(null)
  const [reading, setReading] = useState<Reading | null>(null)
  const [history, setHistory] = useState<Reading[]>([])
  const [sensor, setSensor] = useState<Sensor | null>(null)
  const [kgDay, setKgDay] = useState(400)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !siloId) return

    async function load() {
      setLoading(true)

      const currentSiloId = siloId
      if (!currentSiloId) return

      const [s, r, h, sen, consumption] = await Promise.all([
        getSiloById(currentSiloId),
        getLatestReading(currentSiloId),
        getReadingHistory(currentSiloId, 30),
        getSensorBySiloId(currentSiloId),
        getDailyConsumption(currentSiloId),
      ])

      setSilo(s)
      setReading(r)
      setHistory(h)
      setSensor(sen)
      setKgDay(consumption)
      setLoading(false)
    }

    load()
  }, [siloId, open])

  const pct = reading?.level_pct ?? 0
  const kg = reading?.kg_remaining ?? 0
  const color = levelColor(pct)
  const days = kgDay > 0 ? Math.floor(kg / kgDay) : 0

  const labels = history.map(r =>
    new Date(r.recorded_at).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
    })
  )

  const chartData = history.map(r => r.level_pct)

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.28)',
            zIndex: 40,
          }}
        />
      )}

      <div
        style={{
          position: 'fixed',
          top: 56,
          right: 0,
          width: 460,
          maxWidth: '92vw',
          height: 'calc(100vh - 56px)',
          background: '#ffffff',
          borderLeft: '1px solid #e5e7eb',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
          zIndex: 50,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.24s ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid #eef2f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#1a2530' }}>
              {silo?.name || 'Silo detail'}
            </div>
            <div style={{ fontSize: 12, color: '#8a9aaa', marginTop: 4 }}>
              {silo?.material || 'Loading...'}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: '0.5px solid #dbe4de',
              background: '#fff',
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: 'pointer',
              color: '#6a7a8a',
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            padding: 20,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {loading ? (
            <div style={{ color: '#8a9aaa', fontSize: 13 }}>Loading silo data...</div>
          ) : !silo ? (
            <div style={{ color: '#8a9aaa', fontSize: 13 }}>Silo not found.</div>
          ) : (
            <>
              <div
                style={{
                  background: '#fff',
                  border: '0.5px solid #e8ede9',
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                <div style={{ fontSize: 12, color: '#8a9aaa', marginBottom: 10 }}>
                  Current level
                </div>

                <div
                  style={{
                    fontSize: 42,
                    fontWeight: 600,
                    color,
                    letterSpacing: -1.5,
                    marginBottom: 8,
                  }}
                >
                  {pct.toFixed(1)}%
                </div>

                <div
                  style={{
                    height: 8,
                    background: '#f3f5f4',
                    borderRadius: 999,
                    overflow: 'hidden',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: color,
                      borderRadius: 999,
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                  }}
                >
                  {[
                    { label: 'Available', value: `${Math.round(kg).toLocaleString()} kg` },
                    { label: 'Days left', value: `${days}` },
                    {
                      label: 'Volume',
                      value: reading?.cubic_meters
                        ? `${reading.cubic_meters.toFixed(1)} m³`
                        : '—',
                    },
                    {
                      label: 'Distance',
                      value: reading?.distance_cm
                        ? `${reading.distance_cm.toFixed(0)} cm`
                        : '—',
                    },
                  ].map(item => (
                    <div
                      key={item.label}
                      style={{
                        background: '#f7f9f8',
                        borderRadius: 10,
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ fontSize: 10, color: '#8a9aaa', marginBottom: 4 }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2530' }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  background: '#1a2530',
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.45)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: 10,
                  }}
                >
                  Forecast
                </div>

                <div
                  style={{
                    fontSize: 34,
                    fontWeight: 600,
                    color: '#fff',
                    marginBottom: 6,
                  }}
                >
                  {days}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.5)',
                    marginBottom: 14,
                  }}
                >
                  days of feed remaining
                </div>

                {[
                  { k: 'Daily consumption', v: `~${kgDay.toLocaleString()} kg/day` },
                  {
                    k: 'Suggested order',
                    v: silo.capacity_kg
                      ? `${Math.round((silo.capacity_kg * 0.85) / 1000) * 1000} kg`
                      : '—',
                  },
                ].map(row => (
                  <div
                    key={row.k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '7px 0',
                      borderTop: '0.5px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                      {row.k}
                    </span>
                    <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>
                      {row.v}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  background: '#fff',
                  border: '0.5px solid #e8ede9',
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                <div style={{ fontSize: 12, color: '#8a9aaa', marginBottom: 12 }}>
                  Sensor status
                </div>

                {[
                  {
                    k: 'Connection',
                    v: sensor?.status
                      ? sensor.status.charAt(0).toUpperCase() + sensor.status.slice(1)
                      : 'No sensor',
                  },
                  { k: 'Battery', v: sensor?.battery_pct ? `${sensor.battery_pct}%` : '—' },
                  { k: 'Serial', v: sensor?.serial || '—' },
                  { k: 'Model', v: sensor?.model || '—' },
                ].map(row => (
                  <div
                    key={row.k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '7px 0',
                      borderBottom: '0.5px solid #f0f4f0',
                    }}
                  >
                    <span style={{ fontSize: 12, color: '#8a9aaa' }}>{row.k}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#1a2530' }}>
                      {row.v}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  background: '#fff',
                  border: '0.5px solid #e8ede9',
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                <div style={{ fontSize: 12, color: '#8a9aaa', marginBottom: 12 }}>
                  Level history
                </div>

                {history.length > 0 ? (
                  <div style={{ height: 220, position: 'relative' }}>
                    <Line
                      data={{
                        labels,
                        datasets: [
                          {
                            label: 'Level %',
                            data: chartData,
                            borderColor: '#4CAF7D',
                            backgroundColor: 'rgba(76,175,125,0.08)',
                            borderWidth: 1.5,
                            pointRadius: 0,
                            fill: true,
                            tension: 0.3,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          x: {
                            grid: { display: false },
                            ticks: {
                              font: { size: 9 },
                              color: '#aab8c0',
                              maxTicksLimit: 8,
                              maxRotation: 0,
                            },
                            border: { display: false },
                          },
                          y: {
                            min: 0,
                            max: 100,
                            grid: { color: 'rgba(0,0,0,0.04)' },
                            ticks: {
                              font: { size: 10 },
                              color: '#aab8c0',
                              callback: (v: any) => `${v}%`,
                            },
                            border: { display: false },
                          },
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ color: '#8a9aaa', fontSize: 13 }}>
                    Waiting for sensor readings to build the history chart.
                  </div>
                )}
              </div>

              {siloId && (
                <Link
                  href={`/dashboard/silo/${siloId}`}
                  style={{
                    display: 'inline-block',
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#4A90C4',
                  }}
                >
                  Open full silo page →
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
