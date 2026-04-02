import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Calculator } from 'lucide-react'
import {
  unitEconomicsApi,
  UnitEconomicsCalculation,
  calculateUnitEconomics,
  isWbChannel,
  isMarketplaceChannel,
} from '../api/unitEconomics'

const fmt = (n: number) =>
  new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const COST_TYPE_LABEL: Record<string, string> = {
  estimated: 'расчётная',
  actual: 'фактическая',
}

interface ShareData {
  name: string
  share_token: string
  calculations: UnitEconomicsCalculation[]
  kit: {
    name: string
    sku?: string
    seller_sku?: string
    estimated_cost?: number
    total_cost?: number
  }
}

const ChannelView = ({ calc }: { calc: UnitEconomicsCalculation }) => {
  const isWb = isWbChannel(calc.channel_name)
  const isMarketplace = isMarketplaceChannel(calc.channel_name)
  const marketplacePrice = Number(calc.marketplace_price || 0)
  const costPrice = Number(calc.cost_price || 0)

  const result = calculateUnitEconomics(
    Number(calc.seller_price),
    costPrice,
    Number(calc.tax_rate),
    calc.variable_blocks || []
  )

  const profitPositive = result.profit >= 0

  // Computed amounts for each variable block
  const blockAmounts = (calc.variable_blocks || []).map(block =>
    block.value_type === 'percent'
      ? Number(calc.seller_price) * block.value / 100
      : block.value
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      {/* Left column: pricing + result */}
      <div className="lg:col-span-2 space-y-4">
        {/* Pricing */}
        <div className="rounded-xl border border-[#e8e5ef] bg-[#eeebf3]/50 p-5">
          <div className="text-xs font-medium text-[#524667] uppercase tracking-wider mb-4">
            {isWb || isMarketplace ? 'Ценообразование' : 'Цена продавца'}
          </div>
          <div className="space-y-3">
            {isWb && (
              <>
                <div>
                  <div className="text-xs text-[#524667] mb-1">Цена до скидки</div>
                  <div className="text-2xl font-bold tabular-nums text-[#1c1528]">
                    {fmt(Number(calc.start_price || 0))} ₽
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#524667] mb-1">Скидка продавца</div>
                  <div className="text-2xl font-bold tabular-nums text-[#1c1528]">
                    {Number(calc.seller_discount || 0)}%
                  </div>
                </div>
                <div className="pt-2 border-t border-[#e8e5ef]">
                  <div className="text-xs text-[#524667] mb-1">Цена продавца</div>
                  <div className="text-2xl font-bold tabular-nums text-[#1c1528]">
                    {fmt(Number(calc.seller_price))} ₽
                  </div>
                </div>
              </>
            )}
            {!isWb && (
              <div>
                <div className="text-xs text-[#524667] mb-1">Цена продавца</div>
                <div className="text-2xl font-bold tabular-nums text-[#1c1528]">
                  {fmt(Number(calc.seller_price))} ₽
                </div>
              </div>
            )}
            {isMarketplace && marketplacePrice > 0 && (
              <div className="pt-2 border-t border-[#e8e5ef]">
                <div className="text-xs text-[#524667] mb-1">Цена на площадке</div>
                <div className="text-2xl font-bold tabular-nums text-[#1c1528]">
                  {fmt(marketplacePrice)} ₽
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Result */}
        <div
          className={`rounded-xl border-2 p-5 ${
            profitPositive
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="space-y-3">
            <div>
              <div className="text-xs text-[#524667] mb-1">Чистая прибыль</div>
              <div
                className={`text-3xl font-bold tabular-nums ${
                  profitPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {result.profit >= 0 ? '+' : ''}{fmt(result.profit)} ₽
              </div>
            </div>
            <div>
              <div className="text-xs text-[#524667] mb-1">Маржинальность</div>
              <div
                className={`text-2xl font-bold tabular-nums ${
                  profitPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {result.margin.toFixed(1)}%
              </div>
            </div>
            {isMarketplace && marketplacePrice > 0 && (
              <div className="pt-3 mt-3 border-t border-[#e8e5ef]">
                <div className="text-xs text-[#524667] mb-1">
                  Маржинальность от цены на площадке
                </div>
                <div
                  className={`text-2xl font-bold tabular-nums ${
                    profitPositive ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {(result.profit / marketplacePrice * 100).toFixed(1)}%
                </div>
              </div>
            )}
          </div>

          {Number(calc.seller_price) > 0 && (
            <div className="mt-4 pt-4 border-t border-[#e8e5ef] space-y-1.5 text-sm">
              <div className="flex justify-between text-[#524667]">
                <span>Себестоимость</span>
                <span className="tabular-nums">{fmt(costPrice)} ₽</span>
              </div>
              <div className="flex justify-between text-[#524667]">
                <span>Налог ({Number(calc.tax_rate)}%)</span>
                <span className="tabular-nums">{fmt(result.taxAmount)} ₽</span>
              </div>
              {result.variableTotal > 0 && (
                <div className="flex justify-between text-[#524667]">
                  <span>Переменные</span>
                  <span className="tabular-nums">{fmt(result.variableTotal)} ₽</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-[#524667] pt-1 border-t border-[#e8e5ef]">
                <span>Итого расходов</span>
                <span className="tabular-nums">{fmt(result.totalExpenses)} ₽</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right column: expenses */}
      <div className="lg:col-span-3">
        <div className="rounded-xl border border-[#e8e5ef] bg-[#eeebf3]/50 p-5">
          <div className="text-xs font-medium text-[#524667] uppercase tracking-wider mb-4">
            Расходы
          </div>

          <div className="space-y-0">
            {/* Себестоимость */}
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 border-b border-[#e8e5ef]">
              <span className="text-sm font-medium text-[#524667]">Себестоимость</span>
              <span className="text-xs text-[#524667] bg-white border border-[#e8e5ef] rounded-lg px-2 py-1">
                {COST_TYPE_LABEL[calc.cost_type] ?? calc.cost_type}
              </span>
              <span className="text-sm font-semibold text-[#1c1528] w-28 text-right tabular-nums">
                {fmt(costPrice)} ₽
              </span>
            </div>

            {/* Налог */}
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 border-b border-[#e8e5ef]">
              <span className="text-sm font-medium text-[#524667]">Налоговая ставка</span>
              <span className="text-sm text-[#524667]">{Number(calc.tax_rate)}%</span>
              <span className="text-sm text-[#524667] w-28 text-right tabular-nums">
                {fmt(result.taxAmount)} ₽
              </span>
            </div>

            {/* Variable blocks */}
            {(calc.variable_blocks || []).map((block, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 border-b border-[#e8e5ef]"
              >
                <span className="text-sm font-medium text-[#524667] truncate">{block.label}</span>
                <span className="text-sm text-[#524667]">
                  {block.value_type === 'percent' ? `${block.value}%` : `${fmt(block.value)} ₽`}
                </span>
                <span className="text-sm text-[#524667] w-28 text-right tabular-nums">
                  {fmt(blockAmounts[i])} ₽
                </span>
              </div>
            ))}
          </div>

          {Number(calc.seller_price) > 0 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-[#e8e5ef]">
              <span className="text-sm font-semibold text-[#524667]">Итого расходов</span>
              <span className="text-lg font-bold text-[#1c1528] tabular-nums">
                {fmt(result.totalExpenses)} ₽
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const PublicUnitEconomics = () => {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<ShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeChannelIdx, setActiveChannelIdx] = useState(0)

  useEffect(() => {
    if (!token) {
      setError('Ссылка недействительна')
      setLoading(false)
      return
    }

    const fetch = async () => {
      try {
        const result = await unitEconomicsApi.getPublicShare(token)
        setData(result)
      } catch {
        setError('Расчёт не найден или ссылка устарела')
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eeebf3] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-10 w-10 border-4 border-[#836efe] border-t-transparent rounded-full mx-auto" />
          <p className="text-[#524667]">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#eeebf3] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-sm border border-[#e8e5ef] p-10 text-center max-w-md w-full">
          <Calculator className="h-12 w-12 text-[#836efe] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#1c1528] mb-2">Расчёт не найден</h2>
          <p className="text-[#524667]">
            {error ?? 'Эта ссылка недействительна или истёк срок её действия.'}
          </p>
        </div>
      </div>
    )
  }

  const calculations = data.calculations ?? []
  const activeCalc = calculations[activeChannelIdx] ?? null

  const kitLabel = [
    data.kit?.name,
    data.kit?.seller_sku
      ? `[${data.kit.seller_sku}]`
      : data.kit?.sku
      ? `(${data.kit.sku})`
      : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="min-h-screen bg-[#eeebf3] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#e8e5ef] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(141,103,255,1) 0%, rgba(200,86,255,1) 100%)' }}
            >
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[#524667] font-medium">Ximi4ka | UNIT-экономика</div>
              <div className="text-base font-bold text-[#1c1528] truncate">{data.name}</div>
            </div>
          </div>
          {kitLabel && (
            <div className="text-xs text-[#524667] bg-[#eeebf3] rounded-lg px-3 py-1.5 shrink-0 hidden sm:block">
              {kitLabel}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">
        {calculations.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#e8e5ef] p-10 text-center">
            <p className="text-[#524667]">Каналы не найдены</p>
          </div>
        ) : (
          <>
            {/* Channel tabs */}
            {calculations.length > 1 && (
              <div className="flex items-end gap-0 flex-wrap mb-0">
                {calculations.map((calc, i) => (
                  <button
                    key={calc.id}
                    className={`flex items-center gap-1.5 shrink-0 px-5 py-2.5 text-sm font-medium transition-colors border-t border-x rounded-t-xl ${
                      activeChannelIdx === i
                        ? 'bg-white text-[#836efe] border-[#e8e5ef] -mb-px z-10'
                        : 'bg-[#eeebf3]/60 text-[#524667] border-transparent hover:text-[#1c1528] hover:bg-[#eeebf3]'
                    }`}
                    onClick={() => setActiveChannelIdx(i)}
                  >
                    {calc.channel_name}
                  </button>
                ))}
              </div>
            )}

            {/* Channel content */}
            {activeCalc && (
              <div
                className={`bg-white border border-[#e8e5ef] p-5 sm:p-6 ${
                  calculations.length > 1
                    ? 'rounded-b-2xl rounded-tr-2xl -mt-px'
                    : 'rounded-2xl'
                }`}
              >
                <ChannelView calc={activeCalc} />
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-xs text-[#524667]">Создано в Ximi4ka Finance</p>
      </footer>
    </div>
  )
}

export default PublicUnitEconomics
