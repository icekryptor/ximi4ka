import { ReactNode, useState, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

interface LayoutProps {
  children: ReactNode
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconDashboard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)

const IconTransactions = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 16V4m0 0L3 8m4-4l4 4" />
    <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
  </svg>
)

const IconCategories = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
)

const IconCounterparties = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const IconReports = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
)

const IconFinancialReports = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

const IconCashflow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="M7 14l4-4 4 4 5-5" />
    <polyline points="14 5 20 5 20 11" />
  </svg>
)

const IconComponents = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
  </svg>
)

const IconCostCalc = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
  </svg>
)

const IconUnitEconomics = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
)

const IconMarginMatrix = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </svg>
)

const IconSupplies = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" rx="1" />
    <path d="M16 8h4l3 3v5h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
)

const IconProductionOrders = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
)

const IconQualityControl = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)

const IconPlanning = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 3v18" />
  </svg>
)

const IconContent = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
)

const IconMic = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
)

const IconMarketing = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l18-5v12L3 14v-3z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </svg>
)


const IconMarketplace = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
)

const IconWbAds = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
)

const IconWbFinance = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
)

const IconEmployees = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const IconSalesChannels = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
)

const IconSalesReport = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
)

const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
      transition: 'transform 0.2s ease',
    }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const IconHamburger = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)

const IconClose = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const IconLogo = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
    <defs>
      <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#8d67ff" />
        <stop offset="100%" stopColor="#c856ff" />
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="10" fill="url(#logo-grad)" />
    <path d="M9 22 L16 10 L23 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M11 18 L21 18" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <circle cx="16" cy="10" r="2" fill="white" />
  </svg>
)

const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const IconMoon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

// ─── Nav structure ─────────────────────────────────────────────────────────────

interface NavLink {
  type: 'link'
  name: string
  href: string
  icon: () => JSX.Element
}

interface NavGroup {
  id: string
  label: string
  items: NavLink[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    label: 'Обзор',
    items: [
      { type: 'link', name: 'Дашборд', href: '/', icon: IconDashboard },
    ],
  },
  {
    id: 'finance',
    label: 'Финансы',
    items: [
      { type: 'link', name: 'Транзакции', href: '/transactions', icon: IconTransactions },
      { type: 'link', name: 'Категории', href: '/categories', icon: IconCategories },
      { type: 'link', name: 'Контрагенты', href: '/counterparties', icon: IconCounterparties },
      { type: 'link', name: 'Отчёты', href: '/reports', icon: IconReports },
      { type: 'link', name: 'Фин. отчёты', href: '/financial-reports', icon: IconFinancialReports },
      { type: 'link', name: 'БДДС', href: '/financial-reports/cashflow', icon: IconCashflow },
    ],
  },
  {
    id: 'cost',
    label: 'Себестоимость',
    items: [
      { type: 'link', name: 'Компоненты', href: '/components', icon: IconComponents },
      { type: 'link', name: 'Расчёт себестоимости', href: '/cost-calculation', icon: IconCostCalc },
      { type: 'link', name: 'Юнит-экономика', href: '/unit-economics', icon: IconUnitEconomics },
      { type: 'link', name: 'Матрица маржи', href: '/margin-matrix', icon: IconMarginMatrix },
      { type: 'link', name: 'Отчёт о продажах', href: '/sales-report', icon: IconSalesReport },
    ],
  },
  {
    id: 'procurement',
    label: 'Закупки',
    items: [
      { type: 'link', name: 'Поставки', href: '/supplies', icon: IconSupplies },
    ],
  },
  {
    id: 'production',
    label: 'Производство',
    items: [
      { type: 'link', name: 'Заказы на производство', href: '/production-orders', icon: IconProductionOrders },
      { type: 'link', name: 'Контроль качества', href: '/quality-control', icon: IconQualityControl },
    ],
  },
  {
    id: 'planning',
    label: 'Планирование',
    items: [
      { type: 'link', name: 'Направления', href: '/planning/departments', icon: IconPlanning },
      { type: 'link', name: 'Регулярные задачи', href: '/planning/recurring', icon: IconPlanning },
      { type: 'link', name: 'Проекты', href: '/planning/projects', icon: IconPlanning },
      { type: 'link', name: 'Канбан-доски', href: '/planning', icon: IconPlanning },
    ],
  },
  {
    id: 'marketing',
    label: 'Маркетинг',
    items: [
      { type: 'link', name: 'Стратегия', href: '/marketing/strategy', icon: IconMarketing },
      { type: 'link', name: 'Контент-банк', href: '/content-bank', icon: IconContent },
      { type: 'link', name: 'Войсовер', href: '/voiceover', icon: IconMic },
      { type: 'link', name: 'Аналитика', href: '/marketing/analytics', icon: IconMarketing },
    ],
  },
  {
    id: 'marketplaces',
    label: 'Маркетплейсы',
    items: [
      { type: 'link', name: 'Продажи', href: '/marketplace', icon: IconMarketplace },
      { type: 'link', name: 'Реклама WB', href: '/wb-ads', icon: IconWbAds },
      { type: 'link', name: 'Финансы WB', href: '/wb-finance', icon: IconWbFinance },
    ],
  },
  {
    id: 'settings',
    label: 'Настройки',
    items: [
      { type: 'link', name: 'Сотрудники', href: '/employees', icon: IconEmployees },
      { type: 'link', name: 'Каналы продаж', href: '/sales-channels', icon: IconSalesChannels },
      { type: 'link', name: 'Каналы публикации', href: '/settings/channels', icon: IconMarketing },
    ],
  },
]

// ─── Collapse state helpers ────────────────────────────────────────────────────

const STORAGE_KEY = 'ximfinance-nav-collapsed'

function loadCollapsedState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveCollapsedState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

// ─── NavGroupSection component ─────────────────────────────────────────────────

interface NavGroupSectionProps {
  group: NavGroup
  isOpen: boolean
  onToggle: () => void
  currentPath: string
  onNavClick: () => void
}

const NavGroupSection = ({ group, isOpen, onToggle, currentPath, onNavClick }: NavGroupSectionProps) => {
  const isActive = (href: string) => {
    if (href === '/') return currentPath === '/'
    return currentPath === href
  }

  return (
    <div>
      {/* Group header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 mt-2 mb-0.5 group"
        aria-expanded={isOpen}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-widest text-brand-text-secondary opacity-60"
        >
          {group.label}
        </span>
        <span className="text-brand-text-secondary opacity-50 group-hover:opacity-80 transition-opacity">
          <IconChevron open={isOpen} />
        </span>
      </button>

      {/* Group items with smooth collapse */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: isOpen ? `${group.items.length * 52}px` : '0px',
          transition: 'max-height 0.25s ease',
        }}
      >
        <div className="space-y-0.5 pb-1">
          {group.items.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onNavClick}
                className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-150"
                style={{
                  borderRadius: '16px',
                  background: active
                    ? 'linear-gradient(135deg, rgba(141,103,255,1) 0%, rgba(200,86,255,1) 100%)'
                    : 'transparent',
                  color: active ? '#ffffff' : 'var(--color-text-secondary)',
                  boxShadow: active ? '0 4px 12px rgba(131,110,254,0.3)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'var(--color-bg-hover)'
                    e.currentTarget.style.color = 'var(--color-text-primary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--color-text-secondary)'
                  }
                }}
              >
                <span style={{ flexShrink: 0 }}>
                  <Icon />
                </span>
                <span className="leading-tight">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── User Footer with auth ───────────────────────────────────────────────────

const IconLogout = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const UserFooter = () => {
  const { user, logout } = useAuth()
  const { resolved, toggle } = useTheme()
  const initials = user?.name ? user.name.slice(0, 2).toUpperCase() : '??'

  return (
    <div className="px-4 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(141,103,255,1) 0%, rgba(200,86,255,1) 100%)',
          }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight truncate text-brand-text">
            {user?.name || 'Пользователь'}
          </p>
          <p className="text-xs leading-tight truncate text-brand-text-secondary">
            {user?.email || ''}
          </p>
        </div>
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="flex-shrink-0 p-1.5 rounded-lg transition-colors text-brand-text-secondary hover:text-brand-text hover:bg-surface-hover"
          title={resolved === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        >
          {resolved === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
        {/* Logout */}
        <button
          onClick={logout}
          className="flex-shrink-0 p-1.5 rounded-lg transition-colors text-brand-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
          title="Выйти"
        >
          <IconLogout />
        </button>
      </div>
    </div>
  )
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

interface SidebarContentProps {
  currentPath: string
  onNavClick: () => void
}

const SidebarContent = ({ currentPath, onNavClick }: SidebarContentProps) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => loadCollapsedState())

  const toggle = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = { ...prev, [id]: !prev[id] }
      saveCollapsedState(next)
      return next
    })
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-5 py-5"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <IconLogo />
        <span
          className="text-lg font-bold tracking-tight"
          style={{
            background: 'linear-gradient(135deg, rgba(141,103,255,1) 0%, rgba(200,86,255,1) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          XimOS
        </span>
      </div>

      {/* Nav */}
      <nav
        className="flex-1 px-3 py-3"
        style={{
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--color-border) transparent',
        }}
      >
        {NAV_GROUPS.map((group) => (
          <NavGroupSection
            key={group.id}
            group={group}
            isOpen={collapsed[group.id] !== true}
            onToggle={() => toggle(group.id)}
            currentPath={currentPath}
            onNavClick={onNavClick}
          />
        ))}
      </nav>

      {/* User info + logout */}
      <UserFooter />
    </div>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close sidebar on route change on mobile
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const closeSidebar = useCallback(() => setMobileOpen(false), [])

  return (
    <div className="min-h-screen flex font-sans">
      {/* ── Desktop sidebar (always visible ≥ 1024px) ── */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0"
        style={{
          width: '260px',
          background: 'var(--color-bg-card)',
          borderRight: '1px solid var(--color-border)',
          boxShadow: '2px 0 12px rgba(131,110,254,0.06)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        <SidebarContent currentPath={location.pathname} onNavClick={() => {}} />
      </aside>

      {/* ── Mobile: Hamburger button ── */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 flex items-center justify-center w-10 h-10 rounded-xl bg-card shadow-md"
        style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
        onClick={() => setMobileOpen(true)}
        aria-label="Открыть меню"
      >
        <IconHamburger />
      </button>

      {/* ── Mobile: Backdrop ── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(28,21,40,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile: Slide-in sidebar ── */}
      <aside
        className="lg:hidden fixed left-0 top-0 bottom-0 z-50 flex flex-col"
        style={{
          width: '260px',
          background: 'var(--color-bg-card)',
          boxShadow: '4px 0 24px rgba(131,110,254,0.15)',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}
        aria-hidden={!mobileOpen}
      >
        {/* Close button */}
        <button
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-brand-text-secondary bg-surface-hover"
          onClick={closeSidebar}
          aria-label="Закрыть меню"
        >
          <IconClose />
        </button>

        <SidebarContent currentPath={location.pathname} onNavClick={closeSidebar} />
      </aside>

      {/* ── Main content ── */}
      <main
        className="flex-1 overflow-auto bg-page p-6"
        style={{ minWidth: 0 }}
      >
        {children}
      </main>
    </div>
  )
}

export default Layout
