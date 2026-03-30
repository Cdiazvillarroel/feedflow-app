'use client'
import { useState } from 'react'
import { ANIMAL_GROUPS } from '@/lib/data'

export default function AnimalsPage() {
  const [selectedId, setSelectedId] = useState(ANIMAL_GROUPS[0].id)
  const [counts, setCounts] = useState<Record<string, number>>(
    Object.fromEntries(ANIMAL_GROUPS.map(g => [g.id, g.count]))
  )
  const [prices] = useState<Record<string, number>>({
    'Maize meal': 420,
    'Wheat bran': 310,
    'Soybean meal': 680,
    'Barley': 290,
  })

  const selected =
    ANIMAL_GROUPS.find(g => g.id === selectedId) || ANIMAL_GROUPS[0]

  function dailyFeed(g: typeof ANIMAL_GROUPS[0]) {
    const count = counts[g.id] || g.count
    return g.rations.reduce((s, r) => s + r.kgPerHead * count, 0)
  }

  function dailyCost(g: typeof ANIMAL_GROUPS[0]) {
    const count = counts[g.id] || g.count
    return g.rations.reduce(
      (s, r) => s + (r.kgPerHead * count) / 1000 * (prices[r.material] || 300),
      0
    )
  }

  function costPerHead(g: typeof ANIMAL_GROUPS[0]) {
    return dailyCost(g) / (counts[g.id] || g.count)
  }

  const totalAnimals = ANIMAL_GROUPS.reduce(
    (s, g) => s + (counts[g.id] || g.count),
    0
  )
  const totalFeed = ANIMAL_GROUPS.reduce((s, g) => s + dailyFeed(g), 0)
  const totalCost = ANIMAL_GROUPS.reduce((s, g) => s + dailyCost(g), 0)

  const typeBadge = (type: string) =>
    type === 'pig'
      ? { bg: '#FAEEDA', color: '#633806', label: 'Pigs' }
      : type === 'poultry'
      ? { bg: '#eaf5ee', color: '#27500A', label: 'Poultry' }
      : { bg: '#E6F1FB', color: '#0C447C', label: 'Cattle' }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Animals</div>
          <div className="page-sub">
            Herd groups · Feed rations · Cost per head
          </div>
        </div>
        <div className="page-actions">
          <button className="btn-outline">Export</button>
          <button className="btn-primary">+ Add group</button>
        </div>
      </div>

      <div className="summary-row">
        <div className="sum-card">
          <div className="sum-label">Total animals</div>
          <div className="sum-val">{totalAnimals.toLocaleString()}</div>
          <div className="sum-sub">{ANIMAL_GROUPS.length} groups</div>
        </div>
        <div className="sum-card">
          <div className="sum-label">Total feed / day</div>
          <div className="sum-val">
            {Math.round(totalFeed).toLocaleString()} kg
          </div>
          <div className="sum-sub">{(totalFeed / 1000).toFixed(1)} t/day</div>
        </div>
        <div className="sum-card">
          <div className="sum-label">Total cost / day</div>
          <div className="sum-val">${Math.round(totalCost).toLocaleString()}</div>
          <div className="sum-sub">across all groups</div>
        </div>
        <div className="sum-card">
          <div className="sum-label">Avg $/head/day</div>
          <div className="sum-val green">
            ${(totalCost / totalAnimals).toFixed(2)}
          </div>
          <div className="sum-sub">all animal types</div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
          gap: 14,
          marginBottom: 16,
        }}
      >
        {ANIMAL_GROUPS.map(g => {
          const badge = typeBadge(g.type)
          const cpp = costPerHead(g)

          return (
            <div
              key={g.id}
              onClick={() => setSelectedId(g.id)}
              style={{
                border: `0.5px solid ${
                  g.id === selectedId ? '#4CAF7D' : '#e8ede9'
                }`,
                borderRadius: 10,
                padding: '16px 18px',
                cursor: 'pointer',
                background: g.id === selectedId ? '#f4fbf7' : '#fff',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 22 }}>{g.icon}</div>
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontWeight: 500,
                    background: badge.bg,
                    color: badge.color,
                  }}
                >
                  {badge.label}
                </span>
              </div>

              <div
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: '#1a2530',
                  marginBottom: 3,
                }}
              >
                {g.name}
              </div>

              <div
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  color: '#1a2530',
                  letterSpacing: -0.5,
                  marginBottom: 2,
                }}
              >
                {(counts[g.id] || g.count).toLocaleString()}
              </div>

              <div style={{ fontSize: 11, color: '#aab8c0', marginBottom: 10 }}>
                animals
              </div>

              <div
                style={{
                  height: '0.5px',
                  background: '#e8ede9',
                  marginBottom: 10,
                }}
              />

              {[
                {
                  k: 'Feed/day',
                  v: `${Math.round(dailyFeed(g)).toLocaleString()} kg`,
                },
                {
                  k: 'Cost/day',
                  v: `$${Math.round(dailyCost(g)).toLocaleString()}`,
                },
                { k: '$/head/day', v: `$${cpp.toFixed(3)}`, green: true },
                ...(g.daysToMarket
                  ? [{ k: 'Days to market', v: `${g.daysToMarket}d` }]
                  : []),
              ].map(r => (
                <div
                  key={r.k}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '3px 0',
                  }}
                >
                  <span style={{ fontSize: 11, color: '#8a9aaa' }}>{r.k}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: (r as any).green ? '#27500A' : '#1a2530',
                    }}
                  >
                    {r.v}
                  </span>
                </div>
              ))}
            </div>
          )
        })}

        <div
          onClick={() => {}}
          style={{
            border: '0.5px dashed #c8d8cc',
            borderRadius: 10,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            minHeight: 140,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#aab8c0"
            strokeWidth="1.5"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span style={{ fontSize: 12, color: '#aab8c0' }}>
            Add animal group
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">Feed ration — {selected.name}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {selected.phases.map((p, i) => (
                <span
                  key={p}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 11,
                    cursor: 'pointer',
                    border: '0.5px solid',
                    borderColor:
                      i === selected.activePhase ? '#1a2530' : '#e8ede9',
                    background:
                      i === selected.activePhase ? '#1a2530' : '#fff',
                    color: i === selected.activePhase ? '#fff' : '#6a7a8a',
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  'Material',
                  'kg/head/day',
                  '% of ration',
                  'Daily total',
                  'Daily cost',
                ].map(h => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      fontSize: 11,
                      color: '#aab8c0',
                      fontWeight: 500,
                      padding: '0 10px 10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      borderBottom: '0.5px solid #f0f4f0',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {selected.rations.map(r => {
                const count = counts[selected.id] || selected.count
                const totalKg = r.kgPerHead * count
                const cost = (totalKg / 1000) * (prices[r.material] || 300)
                const totalKgHead = selected.rations.reduce(
                  (s, x) => s + x.kgPerHead,
                  0
                )
                const pct = Math.round((r.kgPerHead / totalKgHead) * 100)

                return (
                  <tr key={r.material}>
                    <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: r.color,
                          }}
                        />
                        {r.material}
                      </div>
                    </td>

                    <td
                      style={{
                        padding: 10,
                        borderBottom: '0.5px solid #f0f4f0',
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#1a2530',
                      }}
                    >
                      {r.kgPerHead}
                    </td>

                    <td style={{ padding: 10, borderBottom: '0.5px solid #f0f4f0' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            color: '#8a9aaa',
                            minWidth: 28,
                          }}
                        >
                          {pct}%
                        </span>
                        <div
                          style={{
                            flex: 1,
                            height: 5,
                            background: '#f7f9f8',
                            borderRadius: 3,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              borderRadius: 3,
                              background: r.color,
                              width: `${pct}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td
                      style={{
                        padding: 10,
                        borderBottom: '0.5px solid #f0f4f0',
                        fontSize: 12,
                        color: '#8a9aaa',
                      }}
                    >
                      {Math.round(totalKg).toLocaleString()} kg
                    </td>

                    <td
                      style={{
                        padding: 10,
                        borderBottom: '0.5px solid #f0f4f0',
                        fontSize: 12,
                        fontWeight: 500,
                        color: '#27500A',
                      }}
                    >
                      ${Math.round(cost).toLocaleString()}
                    </td>
                  </tr>
                )
              })}

              <tr style={{ background: '#f7f9f8' }}>
                <td style={{ padding: 10, fontSize: 13, fontWeight: 500 }}>
                  Total
                </td>
                <td style={{ padding: 10, fontSize: 13, fontWeight: 500 }}>
                  {selected.rations
                    .reduce((s, r) => s + r.kgPerHead, 0)
                    .toFixed(2)}{' '}
                  kg
                </td>
                <td style={{ padding: 10, fontSize: 12, fontWeight: 500 }}>
                  100%
                </td>
                <td style={{ padding: 10, fontSize: 12, fontWeight: 500 }}>
                  {Math.round(dailyFeed(selected)).toLocaleString()} kg
                </td>
                <td
                  style={{
                    padding: 10,
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#27500A',
                  }}
                >
                  ${Math.round(dailyCost(selected)).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">Cost per head</div>
          </div>

          <div
            style={{
              fontSize: 32,
              fontWeight: 500,
              color: '#27500A',
              letterSpacing: -1,
              margin: '8px 0 4px',
            }}
          >
            ${costPerHead(selected).toFixed(3)}
          </div>

          <div style={{ fontSize: 11, color: '#aab8c0', marginBottom: 14 }}>
            per animal per day
          </div>

          <div
            style={{
              height: '0.5px',
              background: '#e8ede9',
              marginBottom: 14,
            }}
          />

          {[
            { k: 'Animals', v: (counts[selected.id] || selected.count).toLocaleString() },
            { k: 'Feed/day', v: `${Math.round(dailyFeed(selected)).toLocaleString()} kg` },
            { k: 'Cost/day', v: `$${Math.round(dailyCost(selected)).toLocaleString()}`, g: true },
            { k: 'Cost/head/week', v: `$${(costPerHead(selected) * 7).toFixed(2)}`, g: true },
            { k: 'Cost/head/month', v: `$${Math.round(costPerHead(selected) * 30)}`, g: true },
            ...(selected.daysToMarket
              ? [
                  {
                    k: 'Cost to market',
                    v: `$${Math.round(costPerHead(selected) * selected.daysToMarket)}`,
                    g: false,
                  },
                ]
              : []),
            { k: 'Avg weight', v: `${selected.avgWeight} kg` },
            { k: 'Target weight', v: `${selected.targetWeight} kg` },
          ].map(r => (
            <div
              key={r.k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '7px 0',
                borderBottom: '0.5px solid #f0f4f0',
              }}
            >
              <span style={{ fontSize: 12, color: '#8a9aaa' }}>{r.k}</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: (r as any).g ? '#27500A' : '#1a2530',
                }}
              >
                {r.v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
