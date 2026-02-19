import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import CostCalculation from './pages/CostCalculation'
import ComponentsCatalog from './pages/ComponentsCatalog'
import Transactions from './pages/Transactions'
import Counterparties from './pages/Counterparties'
import Categories from './pages/Categories'
import Reports from './pages/Reports'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/cost-calculation" element={<CostCalculation />} />
        <Route path="/components" element={<ComponentsCatalog />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/counterparties" element={<Counterparties />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </Layout>
  )
}

export default App
