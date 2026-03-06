import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
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

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-brand-text-secondary">Загрузка...</p>
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
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <ErrorBoundary>
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </Suspense>
      </Layout>
    </ErrorBoundary>
  )
}

export default App
