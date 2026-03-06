import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Users, FolderOpen, BarChart3, Beaker, Package, Truck, FileText, ShoppingBag, Megaphone } from 'lucide-react'

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
    { type: 'link', name: 'Поставки', href: '/supplies', icon: Truck },
    { type: 'group', label: 'Финансы' },
    { type: 'link', name: 'Транзакции', href: '/transactions', icon: ArrowLeftRight },
    { type: 'link', name: 'Контрагенты', href: '/counterparties', icon: Users },
    { type: 'link', name: 'Категории', href: '/categories', icon: FolderOpen },
    { type: 'link', name: 'Отчёты', href: '/reports', icon: BarChart3 },
    { type: 'link', name: 'Финотчёты', href: '/financial-reports', icon: FileText },
    { type: 'group', label: 'Маркетплейсы' },
    { type: 'link', name: 'Аналитика', href: '/marketplace', icon: ShoppingBag },
    { type: 'link', name: 'Реклама WB', href: '/wb-ads', icon: Megaphone },
    { type: 'link', name: 'Финотчёты WB', href: '/wb-finance', icon: FileText },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-brand-border flex flex-col">
        <div className="p-6 border-b border-brand-border">
          <div className="flex items-center space-x-3">
            <Beaker className="h-6 w-6 text-primary-500" />
            <h1 className="text-lg font-semibold text-brand-text">XimFinance</h1>
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
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-brand-text-secondary hover:text-brand-text hover:bg-brand-surface'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-brand-border">
          <p className="text-xs text-brand-text-secondary text-center">
            © 2025
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-brand-surface">
        {children}
      </main>
    </div>
  )
}

export default Layout
