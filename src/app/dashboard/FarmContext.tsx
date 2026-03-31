'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Farm {
  id: string
  name: string
  location: string | null
}

interface FarmContextType {
  farms: Farm[]
  currentFarm: Farm | null
  setCurrentFarm: (farm: Farm) => void
  loading: boolean
}

const FarmContext = createContext<FarmContextType>({
  farms: [],
  currentFarm: null,
  setCurrentFarm: () => {},
  loading: true,
})

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const [farms, setFarms] = useState<Farm[]>([])
  const [currentFarm, setCurrentFarmState] = useState<Farm | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadFarms() {
      const { data, error } = await supabase
        .from('farms')
        .select('id, name, location')
        .order('name')

      if (error) {
        console.error('FarmProvider:', error)
        setLoading(false)
        return
      }

      const farmList = data || []
      setFarms(farmList)

      // Restore last selected farm from localStorage
      const saved = typeof window !== 'undefined'
        ? localStorage.getItem('feedflow_farm_id')
        : null
      const savedFarm = saved ? farmList.find(f => f.id === saved) : null
      setCurrentFarmState(savedFarm || farmList[0] || null)
      setLoading(false)
    }

    loadFarms()
  }, [])

  function setCurrentFarm(farm: Farm) {
    setCurrentFarmState(farm)
    if (typeof window !== 'undefined') {
      localStorage.setItem('feedflow_farm_id', farm.id)
    }
    // Reload the page so all queries pick up the new farm ID
    window.location.reload()
  }

  return (
    <FarmContext.Provider value={{ farms, currentFarm, setCurrentFarm, loading }}>
      {children}
    </FarmContext.Provider>
  )
}

export function useFarm() {
  return useContext(FarmContext)
}
