import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Users, FolderOpen, BarChart3, Beaker } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation()

  const navigation = [
    { name: 'Главная', href: '/', icon: LayoutDashboard },
    { name: 'Себестоимость', href: '/cost-calculation', icon: Beaker },
    { name: 'Транзакции', href: '/transactions', icon: ArrowLeftRight },
    { name: 'Контрагенты', href: '/counterparties', icon: Users },
    { name: 'Категории', href: '/categories', icon: FolderOpen },
    { name: 'Отчёты', href: '/reports', icon: BarChart3 },
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
        
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  flex items-center space-x-3 px-3 py-2 text-sm font-medium transition-colors
                  ${isActive(item.href)
                    ? 'text-gray-900'
                    : 'text-gray-500 hover:text-gray-900'
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">
            © 2024
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
