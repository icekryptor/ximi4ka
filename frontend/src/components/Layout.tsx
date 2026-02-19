import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Users, FolderOpen, BarChart3, Beaker, Package } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

type NavItem =
  | { type: 'link'; name: string; href: string; icon: React.ElementType }
  | { type: 'group'; label: string }

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation()

  const navigation: NavItem[] = [
    { type: 'link', name: 'Главная', href: '/', icon: LayoutDashboard },
    { type: 'group', label: 'Экономика' },
    { type: 'link', name: 'Себестоимость', href: '/cost-calculation', icon: Beaker },
    { type: 'link', name: 'Компоненты', href: '/components', icon: Package },
    { type: 'group', label: 'Финансы' },
    { type: 'link', name: 'Транзакции', href: '/transactions', icon: ArrowLeftRight },
    { type: 'link', name: 'Контрагенты', href: '/counterparties', icon: Users },
    { type: 'link', name: 'Категории', href: '/categories', icon: FolderOpen },
    { type: 'link', name: 'Отчёты', href: '/reports', icon: BarChart3 },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Beaker className="h-6 w-6 text-gray-900" />
            <h1 className="text-lg font-semibold text-gray-900">XimFinance</h1>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-0.5">
          {navigation.map((item, i) => {
            if (item.type === 'group') {
              return (
                <div key={`group-${i}`} className="pt-4 pb-1 px-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {item.label}
                  </span>
                </div>
              )
            }
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive(item.href)
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">
            © 2025
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}

export default Layout
