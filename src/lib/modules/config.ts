export type ModuleKey =
  | 'dashboard' | 'alerts' | 'sensors' | 'map_view'
  | 'feed_library' | 'animals' | 'feed_costs'
  | 'analytics' | 'forecast' | 'ai_insights'
  | 'nutrition_overview' | 'commodity_library'
  | 'formula_manager' | 'demand_forecast'
  | 'farm_monitor' | 'orders' | 'route_planner' | 'drivers'
  | 'account'

export type FeatureLevel = 'readonly' | 'basic' | 'full' | 'ai'

export interface SidebarItem {
  key: ModuleKey
  label: string
  href: string
  icon: string
  badge?: boolean
}

export interface SidebarGroup {
  section: string
  items: SidebarItem[]
}

export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    section: 'Monitor',
    items: [
      { key: 'dashboard',   label: 'Dashboard',   href: '/dashboard',           icon: 'grid'     },
      { key: 'alerts',      label: 'Alerts',      href: '/dashboard/alerts',    icon: 'bell', badge: true },
      { key: 'analytics',   label: 'Analytics',   href: '/dashboard/analytics', icon: 'activity' },
      { key: 'forecast',    label: 'Forecast',    href: '/dashboard/forecast',  icon: 'trending' },
      { key: 'ai_insights', label: 'AI Insights', href: '/dashboard/insights',  icon: 'ai'       },
      { key: 'map_view',    label: 'Map View',    href: '/dashboard/map',       icon: 'map'      },
    ],
  },
  {
    section: 'Manage',
    items: [
      { key: 'feed_library', label: 'Feed Library', href: '/dashboard/feeds',   icon: 'grain'  },
      { key: 'feed_costs',   label: 'Feed Costs',   href: '/dashboard/costs',   icon: 'dollar' },
      { key: 'animals',      label: 'Animals',      href: '/dashboard/animals', icon: 'users'  },
      { key: 'sensors',      label: 'Sensors',      href: '/dashboard/sensors', icon: 'wifi'   },
    ],
  },
  {
    section: 'Nutrition',
    items: [
      { key: 'nutrition_overview', label: 'Overview',          href: '/dashboard/nutrition',                          icon: 'nutrition' },
      { key: 'commodity_library',  label: 'Commodity Library', href: '/dashboard/nutrition/library',                  icon: 'grain'     },
      { key: 'formula_manager',    label: 'Formula Manager',   href: '/dashboard/nutrition/formulas',                 icon: 'formula'   },
      { key: 'demand_forecast',    label: 'Demand Forecast',   href: '/dashboard/nutrition/forecast_nutrition',       icon: 'forecast'  },
    ],
  },
  {
    section: 'Logistics',
    items: [
      { key: 'farm_monitor',  label: 'Farm Monitor',  href: '/dashboard/logistics',         icon: 'truck'     },
      { key: 'orders',        label: 'Orders',        href: '/dashboard/logistics/orders',  icon: 'clipboard' },
      { key: 'route_planner', label: 'Route Planner', href: '/dashboard/logistics/routes',  icon: 'route'     },
      { key: 'drivers',       label: 'Drivers',       href: '/dashboard/logistics/drivers', icon: 'driver'    },
    ],
  },
  {
    section: 'Settings',
    items: [
      { key: 'account', label: 'Account', href: '/dashboard/account', icon: 'settings' },
    ],
  },
]

// Mapa ruta → module_key para middleware
export const ROUTE_MODULE_MAP: Partial<Record<string, ModuleKey>> = {
  '/dashboard':                                    'dashboard',
  '/dashboard/alerts':                             'alerts',
  '/dashboard/analytics':                          'analytics',
  '/dashboard/forecast':                           'forecast',
  '/dashboard/insights':                           'ai_insights',
  '/dashboard/map':                                'map_view',
  '/dashboard/feeds':                              'feed_library',
  '/dashboard/costs':                              'feed_costs',
  '/dashboard/animals':                            'animals',
  '/dashboard/sensors':                            'sensors',
  '/dashboard/nutrition':                          'nutrition_overview',
  '/dashboard/nutrition/library':                  'commodity_library',
  '/dashboard/nutrition/formulas':                 'formula_manager',
  '/dashboard/nutrition/forecast_nutrition':       'demand_forecast',
  '/dashboard/logistics':                          'farm_monitor',
  '/dashboard/logistics/orders':                   'orders',
  '/dashboard/logistics/routes':                   'route_planner',
  '/dashboard/logistics/drivers':                  'drivers',
  '/dashboard/account':                            'account',
}
