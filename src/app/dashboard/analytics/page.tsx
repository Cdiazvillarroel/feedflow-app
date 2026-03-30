'use client'
import { useEffect, useState } from 'react'
import { getFarmReadings, getSilos, getFeedPrices } from '@/lib/queries'
import type { Reading, Silo, FeedPrice } from '@/lib/types'
import { Bar, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

type RichReading = Reading & { silo_name: string; material: string }

const MATERIAL_COLORS: Record<string, string> = {
  'Maize meal':   '#4CAF7D',
  'Wheat bran':   '#4A90C4',
  'Soybean meal': '#EF9F27',
  'Barley':       '#E24B4A',
}

export default function AnalyticsPage() {
  const [readings, setReadings] = useState<RichReading[]>([])
  const [silos, setSilos] = useState<Silo[]>([])
  const [prices, setPrices] = useState<FeedPrice[]>([])
  const [period, setPeriod] = useState(30)
  const [loading, setLoading] = useState(true)
