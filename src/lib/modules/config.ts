'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SIDEBAR_GROUPS, type ModuleKey, type FeatureLevel, type SidebarGroup } from '@/lib/modules/config'

interface ClientModule {
  module:        ModuleKey
  is_enabled:    boolean
  feature_level: FeatureLevel
  source:        'PLAN' | 'OVERRIDE' | 'ADDON'
}

export function useClientModules(userId: string | null) {
  const [modules,  setModules]  = useState<Map<ModuleKey, ClientModule>>(new Map())
  const [loading,  setLoading]  = useState(true)
  const [clientId, setClientId] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    async function load() {
      // Buscar client_id del usuario
      const { data: cuData } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', userId)
        .single()

      // Si no tiene client_users, verificar si es admin
      if (!cuData) {
        const { data: roleData } = await supabase
          .from('roles')
          .select('role')
          .eq('user_id', userId)
          .single()

        // Admin ve todo
        if (roleData?.role === 'admin') {
          const allModules = new Map<ModuleKey, ClientModule>()
          SIDEBAR_GROUPS.forEach(g => g.items.forEach(item => {
            allModules.set(item.key, { module: item.key, is_enabled: true, feature_level: 'ai', source: 'PLAN' })
          }))
          setModules(allModules)
          setLoading(false)
          return
        }

        // Usuario sin cliente — mostrar solo dashboard
        const fallback = new Map<ModuleKey, ClientModule>()
        fallback.set('dashboard', { module: 'dashboard', is_enabled: true, feature_level: 'basic', source: 'PLAN' })
        setModules(fallback)
        setLoading(false)
        return
      }

      setClientId(cuData.client_id)

      // Cargar módulos del cliente
      const { data: modulesData } = await supabase
        .from('client_modules')
        .select('module, is_enabled, feature_level, source')
        .eq('client_id', cuData.client_id)
        .eq('is_enabled', true)

      const map = new Map<ModuleKey, ClientModule>()
      ;(modulesData || []).forEach(m => {
        map.set(m.module as ModuleKey, m as ClientModule)
      })
      setModules(map)
      setLoading(false)
    }
    load()
  }, [userId])

  // Sidebar filtrado — solo grupos con al menos un módulo activo
  const sidebarGroups: SidebarGroup[] = SIDEBAR_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => modules.has(item.key)),
    }))
    .filter(group => group.items.length > 0)

  const hasModule    = (key: ModuleKey) => modules.has(key)
  const featureLevel = (key: ModuleKey): FeatureLevel | null => modules.get(key)?.feature_level ?? null
  const hasAI        = (key: ModuleKey) => featureLevel(key) === 'ai'
  const isReadonly   = (key: ModuleKey) => featureLevel(key) === 'readonly'
  const canEdit      = (key: ModuleKey) => { const l = featureLevel(key); return l === 'full' || l === 'ai' }

  return { modules, sidebarGroups, hasModule, featureLevel, hasAI, isReadonly, canEdit, loading, clientId }
}
