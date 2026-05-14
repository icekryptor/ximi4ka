import { StrategyDocSection } from '../components/marketing/StrategyDocSection'
import { SegmentsSection } from '../components/marketing/SegmentsSection'
import { ThemesSection } from '../components/marketing/ThemesSection'
import { BrandDocCardsSection } from '../components/marketing/BrandDocCardsSection'
import { BudgetsSection } from '../components/marketing/BudgetsSection'

const MarketingStrategy = () => {
  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-brand-text">Маркетинг-стратегия</h1>
        <p className="text-brand-text-secondary mt-1">
          Стратегический документ, целевые сегменты, тематические фокусы и бюджеты каналов.
        </p>
      </header>

      <StrategyDocSection />
      <SegmentsSection />
      <ThemesSection />
      <BrandDocCardsSection />
      <BudgetsSection />
    </div>
  )
}

export default MarketingStrategy
