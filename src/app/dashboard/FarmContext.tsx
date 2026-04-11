'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Farm {
  id:           string
  name:         string
  location:     string | null
  lat:          number | null
  lng:          number | null
  feed_mill_id: string | null
}

interface FarmContextType {
  farms:             Farm[]
  visibleFarms:      Farm[]
  currentFarm:       Farm | null
  setCurrentFarm:    (farm: Farm) => void
  selectedMillId:    string
  setSelectedMillId: (id: string) => void
  loading:           boolean
}

const FarmContext = createContext<FarmContextType>({
  farms: [], visibleFarms: [], currentFarm: null, setCurrentFarm: () => {},
  selectedMillId: '', setSelectedMillId: () => {}, loading: true,
})

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const [farms,           setFarms]             = useState<Farm[]>([])
  const [currentFarm,     setCurrentFarmState]  = useState<Farm | null>(null)
  const [selectedMillId,  setSelectedMillId]    = useState<string>('')
  const [loading,         setLoading]           = useState(true)

  useEffect(() => {
    async function loadFarms() {
      const { data: { user } } = await supabase.auth.getUser()
      let farmList: Farm[] = []

      if (user) {
        // 1. Intentar cargar desde user_farms
        const { data: ufData, error: ufError } = await supabase
          .from('user_farms')
          .select('farms(id, name, location, lat, lng, feed_mill_id)')
          .eq('user_id', user.id)

        if (!ufError && ufData && ufData.length > 0) {
          farmList = ufData.map((row: any) => row.farms).filter(Boolean)
        } else {
          // 2. Verificar rol del usuario
          const { data: roleData } = await supabase
            .from('roles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle()

          if (roleData?.role === 'admin') {
            // Admin ve todas las granjas
            const { data } = await supabase
              .from('farms')
              .select('id, name, location, lat, lng, feed_mill_id')
              .order('name')
            farmList = data || []
          } else {
            // 3. Intentar cargar por client_users
            const { data: cuData } = await supabase
              .from('client_users')
              .select('client_id')
              .eq('user_id', user.id)
              .maybeSingle()

            if (cuData?.client_id) {
              const { data } = await supabase
                .from('farms')
                .select('id, name, location, lat, lng, feed_mill_id')
                .eq('client_id', cuData.client_id)
                .order('name')
              farmList = data || []
            } else {
              // 4. Último fallback — todas las granjas
              const { data } = await supabase
                .from('farms')
                .select('id, name, location, lat, lng, feed_mill_id')
                .order('name')
              farmList = data || []
            }
          }
        }
      } else {
        // Sin usuario — cargar todas
        const { data } = await supabase
          .from('farms')
          .select('id, name, location, lat, lng, feed_mill_id')
          .order('name')
        farmList = data || []
      }

      setFarms(farmList)
      const saved     = typeof window !== 'undefined' ? localStorage.getItem('feedflow_farm_id') : null
      const savedFarm = saved ? farmList.find(f => f.id === saved) : null
      setCurrentFarmState(savedFarm || farmList[0] || null)
      setLoading(false)
    }

    loadFarms()
  }, [])

  // Cuando cambia el mill filter, auto-seleccionar primera granja del mill
  useEffect(() => {
    if (selectedMillId) {
      const millFarms  = farms.filter(f => f.feed_mill_id === selectedMillId)
      const stillValid = millFarms.find(f => f.id === currentFarm?.id)
      if (!stillValid && millFarms.length > 0) setCurrentFarmState(millFarms[0])
    }
  }, [selectedMillId])

  const visibleFarms = selectedMillId
    ? farms.filter(f => f.feed_mill_id === selectedMillId)
    : farms

  function setCurrentFarm(farm: Farm) {
    setCurrentFarmState(farm)
    if (typeof window !== 'undefined') localStorage.setItem('feedflow_farm_id', farm.id)
    window.location.reload()
  }

  return (
    <FarmContext.Provider value={{
      farms, visibleFarms, currentFarm, setCurrentFarm,
      selectedMillId, setSelectedMillId, loading,
    }}>
      {children}
    </FarmContext.Provider>
  )
}

export function useFarm() {
  return useContext(FarmContext)
}
