import { lazy, Suspense, createContext, useContext, useState, useCallback } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'

// Lazy-load all pages for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'))
const CostCalculation = lazy(() => import('./pages/CostCalculation'))
const ComponentsCatalog = lazy(() => import('./pages/ComponentsCatalog'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Counterparties = lazy(() => import('./pages/Counterparties'))
const Categories = lazy(() => import('./pages/Categories'))
const Reports = lazy(() => import('./pages/Reports'))
const Supplies = lazy(() => import('./pages/Supplies'))
const FinancialReports = lazy(() => import('./pages/FinancialReports'))
const Marketplace = lazy(() => import('./pages/Marketplace'))
const WbAdsAnalytics = lazy(() => import('./pages/WbAdsAnalytics'))
const WbFinanceReports = lazy(() => import('./pages/WbFinanceReports'))
const UnitEconomics = lazy(() => import('./pages/UnitEconomics'))
const SalesReport = lazy(() => import('./pages/SalesReport'))

// === Toast System ===
type ToastType = 'success' | 'error'
interface Toast { id: number; message: string; type: ToastType }

const ToastContext = createContext<{
  showToast: (message: string, type?: ToastType) => void
}>({ showToast: () => {} })

export const useToast = () => useContext(ToastContext)

const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={toast.type === 'success' ? 'toast-success' : 'toast-error'}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// === Page Transition ===
const PageTransition = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-enter">
      {children}
    </div>
  )
}

// === Loaders ===
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center space-y-4">
      <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
      <div className="space-y-2">
        <div className="skeleton h-4 w-32 mx-auto" />
        <div className="skeleton h-3 w-24 mx-auto" />
      </div>
    </div>
  </div>
)

const NotFound = () => (
  <div className="flex items-center justify-center min-h-[400px] p-8">
    <div className="text-center">
      <p className="text-6xl font-bold text-primary-200 mb-4">404</p>
      <h2 className="text-xl font-bold text-brand-text mb-2">Страница не найдена</h2>
      <p className="text-brand-text-secondary mb-4">Запрошенная страница не существует</p>
      <a href="/" className="btn btn-primary">На главную</a>
    </div>
  </div>
)

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <ErrorBoundary>
              <PageTransition>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/cost-calculation" element={<CostCalculation />} />
                  <Route path="/components" element={<ComponentsCatalog />} />
                  <Route path="/supplies" element={<Supplies />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/counterparties" element={<Counterparties />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/financial-reports" element={<FinancialReports />} />
                  <Route path="/marketplace" element={<Marketplace />} />
                  <Route path="/wb-ads" element={<WbAdsAnalytics />} />
                  <Route path="/wb-finance" element={<WbFinanceReports />} />
                  <Route path="/unit-economics" element={<UnitEconomics />} />
                  <Route path="/sales-report" element={<SalesReport />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </PageTransition>
            </ErrorBoundary>
          </Suspense>
        </Layout>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
