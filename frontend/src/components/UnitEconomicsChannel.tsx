import { useState } from 'react'
import { Plus, X, Percent, ChevronUp, ChevronDown } from 'lucide-react'
import {
  ChannelConfig,
  VariableBlock,
  CostType,
  VARIABLE_BLOCK_OPTIONS,
  calculateUnitEconomics,
  isWbChannel,
  computeSellerPrice,
} from '../api/unitEconomics'
import { Kit } from '../api/kits'

interface Props {
  kit: Kit
  channel: ChannelConfig
  onChange: (channel: ChannelConfig) => void
}

const fmt = (n: number) =>
  new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const UnitEconomicsChannel = ({ kit, channel, onChange }: Props) => {
  const [showBlockMenu, setShowBlockMenu] = useState(false)

  const isWb = isWbChannel(channel.channel_name)

  const costPrice =
    channel.cost_type === 'estimated'
      ? Number(kit.estimated_cost || 0)
      : Number(kit.total_cost || 0)

  const result = calculateUnitEconomics(
    channel.seller_price,
    costPrice,
    channel.tax_rate,
    channel.variable_blocks
  )

  const updateField = <K extends keyof ChannelConfig>(key: K, value: ChannelConfig[K]) => {
    const updated = { ...channel, [key]: value }
    // For WB: auto-compute seller_price from start_price and seller_discount
    if (isWb && (key === 'start_price' || key === 'seller_discount')) {
      updated.seller_price = computeSellerPrice(
        Number(updated.start_price || 0),
        Number(updated.seller_discount || 0)
      )
    }
    onChange(updated)
  }

  const updateBlock = (index: number, updates: Partial<VariableBlock>) => {
    const blocks = [...channel.variable_blocks]
    blocks[index] = { ...blocks[index], ...updates }
    updateField('variable_blocks', blocks)
  }

  const addBlock = (type: string) => {
    const option = VARIABLE_BLOCK_OPTIONS.find(o => o.type === type)
    if (!option) return
    const block: VariableBlock = {
      type: option.type,
      label: option.label,
      value_type: option.default_value_type,
      value: 0,
    }
    updateField('variable_blocks', [...channel.variable_blocks, block])
    setShowBlockMenu(false)
  }

  const removeBlock = (index: number) => {
    const blocks = channel.variable_blocks.filter((_, i) => i !== index)
    updateField('variable_blocks', blocks)
  }

  const moveBlock = (index: number, direction: -1 | 1) => {
    const blocks = [...channel.variable_blocks]
    const target = index + direction
    if (target < 0 || target >= blocks.length) return
    ;[blocks[index], blocks[target]] = [blocks[target], blocks[index]]
    updateField('variable_blocks', blocks)
  }

  const usedTypes = channel.variable_blocks.map(b => b.type)
  const availableBlocks = VARIABLE_BLOCK_OPTIONS.filter(o => !usedTypes.includes(o.type))

  // Computed amounts for each variable block
  const blockAmounts = channel.variable_blocks.map(block =>
    block.value_type === 'percent'
      ? channel.seller_price * block.value / 100
      : block.value
  )

  const profitPositive = result.profit >= 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      {/* ─── Левая колонка: доход + результат ─── */}
      <div className="lg:col-span-2 space-y-4">
        {/* Цена продавца */}
        <div className="bg-gray-50 rounded-lg p-5">
          {isWb ? (
            <>
              {/* ВБ: Стартовая цена + Скидка → вычисленная Цена продавца */}
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                Ценообразование
              </label>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Стартовая цена</div>
                  <div className="flex items-baseline gap-2">
                    <input
                      type="number"
                      className="input text-lg font-semibold w-full text-right tabular-nums"
                      value={channel.start_price || ''}
                      onChange={e => updateField('start_price', Number(e.target.value) || 0)}
                      placeholder="0"
                      min="0"
                      step="1"
                    />
                    <span className="text-sm text-gray-400 shrink-0">₽</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Скидка продавца</div>
                  <div className="flex items-baseline gap-2">
                    <input
                      type="number"
                      className="input text-lg font-semibold w-full text-right tabular-nums"
                      value={channel.seller_discount || ''}
                      onChange={e => updateField('seller_discount', Number(e.target.value) || 0)}
                      placeholder="0"
                      min="0"
                      max="100"
                      step="1"
                    />
                    <span className="text-sm text-gray-400 shrink-0">%</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-xs text-gray-400 mb-1">Цена продавца</div>
                  <div className="text-2xl font-bold tabular-nums text-gray-900">
                    {fmt(channel.seller_price)} ₽
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Другие каналы: прямой ввод Цены продавца */}
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                Цена продавца
              </label>
              <div className="flex items-baseline gap-2">
                <input
                  type="number"
                  className="input text-2xl font-bold w-full text-right tabular-nums"
                  value={channel.seller_price || ''}
                  onChange={e => updateField('seller_price', Number(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  step="1"
                />
                <span className="text-lg text-gray-400 shrink-0">₽</span>
              </div>
            </>
          )}
        </div>

        {/* Результат */}
        <div className={`rounded-lg p-5 border-2 ${profitPositive ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200'}`}>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-400 mb-1">Чистая прибыль</div>
              <div className={`text-3xl font-bold tabular-nums ${profitPositive ? 'text-green-600' : 'text-red-600'}`}>
                {result.profit >= 0 ? '+' : ''}{fmt(result.profit)} ₽
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Маржинальность</div>
              <div className={`text-2xl font-bold tabular-nums ${profitPositive ? 'text-green-600' : 'text-red-600'}`}>
                {result.margin.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Разбивка расходов */}
          {channel.seller_price > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Себестоимость</span>
                <span className="tabular-nums">{fmt(costPrice)} ₽</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Налог ({channel.tax_rate}%)</span>
                <span className="tabular-nums">{fmt(result.taxAmount)} ₽</span>
              </div>
              {result.variableTotal > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Переменные</span>
                  <span className="tabular-nums">{fmt(result.variableTotal)} ₽</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-gray-700 pt-1 border-t border-gray-100">
                <span>Итого расходов</span>
                <span className="tabular-nums">{fmt(result.totalExpenses)} ₽</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Правая колонка: расходы ─── */}
      <div className="lg:col-span-3">
        <div className="bg-gray-50 rounded-lg p-5">
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">
            Расходы
          </label>

          <div className="space-y-0">
            {/* Себестоимость */}
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">Себестоимость</span>
              <select
                className="input text-sm w-36 py-1.5"
                value={channel.cost_type}
                onChange={e => updateField('cost_type', e.target.value as CostType)}
              >
                <option value="estimated">расчётная</option>
                <option value="actual">фактическая</option>
              </select>
              <span className="text-sm font-semibold text-gray-900 w-28 text-right tabular-nums">
                {fmt(costPrice)} ₽
              </span>
            </div>

            {/* Налог */}
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">Налоговая ставка</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  className="input w-20 text-right text-sm py-1.5 tabular-nums"
                  value={channel.tax_rate || ''}
                  onChange={e => updateField('tax_rate', Number(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  max="100"
                  step="0.1"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
              <span className="text-sm text-gray-500 w-28 text-right tabular-nums">
                {fmt(result.taxAmount)} ₽
              </span>
            </div>

            {/* Вариативные блоки */}
            {channel.variable_blocks.map((block, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 border-b border-gray-100 group">
                <div className="flex items-center gap-1.5 min-w-0">
                  {/* Стрелки перемещения */}
                  <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity -ml-1">
                    <button
                      type="button"
                      className="text-gray-300 hover:text-gray-600 disabled:opacity-20"
                      onClick={() => moveBlock(i, -1)}
                      disabled={i === 0}
                      title="Вверх"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="text-gray-300 hover:text-gray-600 disabled:opacity-20 -mt-1"
                      onClick={() => moveBlock(i, 1)}
                      disabled={i === channel.variable_blocks.length - 1}
                      title="Вниз"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-sm font-medium text-gray-700 truncate">{block.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    className="input w-20 text-right text-sm py-1.5 tabular-nums"
                    value={block.value || ''}
                    onChange={e => updateBlock(i, { value: Number(e.target.value) || 0 })}
                    placeholder="0"
                    min="0"
                    step="0.1"
                  />
                  <button
                    type="button"
                    className={`flex items-center justify-center w-7 h-7 rounded border text-xs transition-colors ${
                      block.value_type === 'percent'
                        ? 'bg-primary-50 border-primary-200 text-primary-700'
                        : 'bg-gray-50 border-gray-200 text-gray-500'
                    }`}
                    onClick={() => updateBlock(i, { value_type: block.value_type === 'percent' ? 'fixed' : 'percent' })}
                    title={block.value_type === 'percent' ? 'Процент от цены' : 'Фиксированная сумма'}
                  >
                    {block.value_type === 'percent' ? <Percent className="h-3 w-3" /> : <span className="text-xs font-bold">₽</span>}
                  </button>
                  <button
                    type="button"
                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    onClick={() => removeBlock(i)}
                    title="Удалить"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <span className="text-sm text-gray-500 w-28 text-right tabular-nums">
                  {fmt(blockAmounts[i])} ₽
                </span>
              </div>
            ))}
          </div>

          {/* Добавить расход */}
          {availableBlocks.length > 0 && (
            <div className="relative mt-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 transition-colors"
                onClick={() => setShowBlockMenu(!showBlockMenu)}
              >
                <Plus className="h-4 w-4" />
                <span>Добавить расход</span>
              </button>
              {showBlockMenu && (
                <div className="absolute top-12 left-0 z-10 bg-white rounded-lg shadow-lg border border-brand-border py-1 min-w-[220px]">
                  {availableBlocks.map(option => (
                    <button
                      key={option.type}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm hover:bg-brand-surface transition-colors"
                      onClick={() => addBlock(option.type)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Итого расходов */}
          {channel.seller_price > 0 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
              <span className="text-sm font-semibold text-gray-700">Итого расходов</span>
              <span className="text-lg font-bold text-gray-900 tabular-nums">{fmt(result.totalExpenses)} ₽</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UnitEconomicsChannel
