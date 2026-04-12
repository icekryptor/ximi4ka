import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ConfirmDialogProvider } from './contexts/ConfirmDialogContext'
import { ThemeProvider } from './contexts/ThemeContext'

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
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const MarginMatrix = lazy(() => import('./pages/MarginMatrix'))
const ProductionOrders = lazy(() => import('./pages/ProductionOrders'))
const QualityControl = lazy(() => import('./pages/QualityControl'))
const Employees = lazy(() => import('./pages/Employees'))
const SalesChannels = lazy(() => import('./pages/SalesChannels'))
const SalesReport = lazy(() => import('./pages/SalesReport'))
const Planning = lazy(() => import('./pages/Planning'))
const Departments = lazy(() => import('./pages/Departments'))
const DepartmentDetail = lazy(() => import('./pages/DepartmentDetail'))
const PublicUnitEconomics = lazy(() => import('./pages/PublicUnitEconomics'))
const RecurringTasks = lazy(() => import('./pages/RecurringTasks'))
const RecurringTaskDetail = lazy(() => import('./pages/RecurringTaskDetail'))
const ContentUnits = lazy(() => import('./pages/ContentUnits'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const PublicProject = lazy(() => import('./pages/PublicProject'))

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
      <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <ConfirmDialogProvider>
            <Suspense fallback={<PageLoader />}>
              <ErrorBoundary>
                <Routes>
                  {/* Public routes */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/public/unit-economics/:token" element={<PublicUnitEconomics />} />
                  <Route path="/project/:id" element={<PublicProject />} />

                  {/* Protected routes — wrapped in Layout */}
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Suspense fallback={<PageLoader />}>
                            <PageTransition>
                              <Routes>
                                <Route path="/" element={<Dashboard />} />
                                {/* Финансы */}
                                <Route path="/transactions" element={<Transactions />} />
                                <Route path="/categories" element={<Categories />} />
                                <Route path="/counterparties" element={<Counterparties />} />
                                <Route path="/reports" element={<Reports />} />
                                <Route path="/financial-reports" element={<FinancialReports />} />
                                {/* Себестоимость */}
                                <Route path="/components" element={<ComponentsCatalog />} />
                                <Route path="/cost-calculation" element={<CostCalculation />} />
                                <Route path="/unit-economics" element={<UnitEconomics />} />
                                <Route path="/margin-matrix" element={<MarginMatrix />} />
                                {/* Закупки */}
                                <Route path="/supplies" element={<Supplies />} />
                                {/* Производство */}
                                <Route path="/production-orders" element={<ProductionOrders />} />
                                <Route path="/quality-control" element={<QualityControl />} />
                                <Route path="/planning" element={<Planning />} />
                                <Route path="/planning/departments" element={<Departments />} />
                                <Route path="/planning/departments/:id" element={<DepartmentDetail />} />
                                <Route path="/planning/recurring" element={<RecurringTasks />} />
                                <Route path="/planning/recurring/:id" element={<RecurringTaskDetail />} />
                                <Route path="/planning/projects" element={<Projects />} />
                                <Route path="/planning/projects/:id" element={<ProjectDetail />} />
                                <Route path="/content-units" element={<ContentUnits />} />
                                {/* Маркетплейсы */}
                                <Route path="/marketplace" element={<Marketplace />} />
                                <Route path="/wb-ads" element={<WbAdsAnalytics />} />
                                <Route path="/wb-finance" element={<WbFinanceReports />} />
                                {/* Продажи */}
                                <Route path="/sales-report" element={<SalesReport />} />
                                {/* Настройки */}
                                <Route path="/employees" element={<Employees />} />
                                <Route path="/sales-channels" element={<SalesChannels />} />
                                <Route path="*" element={<NotFound />} />
                              </Routes>
                            </PageTransition>
                          </Suspense>
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </ErrorBoundary>
            </Suspense>
          </ConfirmDialogProvider>
        </ToastProvider>
      </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
