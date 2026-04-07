'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Farm {
  id:       string
  name:     string
  location: string | null
}

interface FarmContextType {
  farms:          Farm[]
  currentFarm:    Farm | null
  setCurrentFarm: (farm: Farm) => void
  loading:        boolean
}

const FarmContext = createContext<FarmContextType>({
  farms: [], currentFarm: null, setCurrentFarm: () => {}, loading: true,
})

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const [farms,        setFarms]            = useState<Farm[]>([])
  const [currentFarm,  setCurrentFarmState] = useState<Farm | null>(null)
  const [loading,      setLoading]          = useState(true)

  useEffect(() => {
    async function loadFarms() {
      const { data: { user } } = await supabase.auth.getUser()

      let farmList: Farm[] = []

      if (user) {
        const { data, error } = await supabase
          .from('user_farms')
          .select('farms(id, name, location)')
          .eq('user_id', user.id)
        if (!error && data) {
          farmList = data.map((row: any) => row.farms).filter(Boolean)
        }
      } else {
        const { data, error } = await supabase
          .from('farms')
          .select('id, name, location')
          .order('name')
        if (!error && data) farmList = data
      }

      setFarms(farmList)
      const saved     = typeof window !== 'undefined' ? localStorage.getItem('feedflow_farm_id') : null
      const savedFarm = saved ? farmList.find(f => f.id === saved) : null
      setCurrentFarmState(savedFarm || farmList[0] || null)
      setLoading(false)
    }
    loadFarms()
  }, [])

  function setCurrentFarm(farm: Farm) {
    setCurrentFarmState(farm)
    if (typeof window !== 'undefined') localStorage.setItem('feedflow_farm_id', farm.id)
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
