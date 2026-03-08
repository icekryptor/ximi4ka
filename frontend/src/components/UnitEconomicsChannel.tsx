import { useState } from 'react'
import { Plus, X, DollarSign, Percent } from 'lucide-react'
import {
  ChannelConfig,
  VariableBlock,
  CostType,
  VARIABLE_BLOCK_OPTIONS,
  calculateUnitEconomics,
} from '../api/unitEconomics'
import { Kit } from '../api/kits'

interface Props {
  kit: Kit
  channel: ChannelConfig
  onChange: (channel: ChannelConfig) => void
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const UnitEconomicsChannel = ({ kit, channel, onChange }: Props) => {
  const [showBlockMenu, setShowBlockMenu] = useState(false)

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
    onChange({ ...channel, [key]: value })
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

  const usedTypes = channel.variable_blocks.map(b => b.type)
  const availableBlocks = VARIABLE_BLOCK_OPTIONS.filter(o => !usedTypes.includes(o.type))

  return (
    <div className="space-y-4">
      {/* Перманентные блоки */}
      <div className="card p-4 space-y-3">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Постоянные</h4>

        {/* Цена продавца */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">💰</span>
            <span className="text-sm font-medium text-brand-text">Цена продавца</span>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              className="input w-32 text-right"
              value={channel.seller_price || ''}
              onChange={e => updateField('seller_price', Number(e.target.value) || 0)}
              placeholder="0"
            />
            <span className="text-sm text-brand-text-secondary">₽</span>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">доход</span>
          </div>
        </div>

        {/* Себестоимость */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">📦</span>
            <span className="text-sm font-medium text-brand-text">Себестоимость</span>
          </div>
          <div className="flex items-center space-x-2">
            <select
              className="input w-36 text-sm"
              value={channel.cost_type}
              onChange={e => updateField('cost_type', e.target.value as CostType)}
            >
              <option value="estimated">расчётная</option>
              <option value="actual">фактическая</option>
            </select>
            <span className="text-sm font-medium text-brand-text w-24 text-right">
              {formatCurrency(costPrice)} ₽
            </span>
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">расход</span>
          </div>
        </div>

        {/* Налоговая ставка */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">📊</span>
            <span className="text-sm font-medium text-brand-text">Налоговая ставка</span>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              className="input w-20 text-right"
              value={channel.tax_rate || ''}
              onChange={e => updateField('tax_rate', Number(e.target.value) || 0)}
              placeholder="0"
              min="0"
              max="100"
              step="0.1"
            />
            <span className="text-sm text-brand-text-secondary">%</span>
            {result.taxAmount > 0 && (
              <span className="text-xs text-brand-text-secondary">= {formatCurrency(result.taxAmount)} ₽</span>
            )}
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">расход</span>
          </div>
        </div>
      </div>

      {/* Вариативные блоки */}
      <div className="card p-4 space-y-3">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Вариативные расходы</h4>

        {channel.variable_blocks.map((block, i) => {
          const computed = block.value_type === 'percent'
            ? channel.seller_price * block.value / 100
            : block.value
          return (
            <div key={i} className="flex items-center justify-between">
              <span className="text-sm font-medium text-brand-text flex-shrink-0">{block.label}</span>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  className="input w-24 text-right"
                  value={block.value || ''}
                  onChange={e => updateBlock(i, { value: Number(e.target.value) || 0 })}
                  placeholder="0"
                  min="0"
                  step="0.1"
                />
                {/* Toggle ₽ / % */}
                <button
                  type="button"
                  className={`flex items-center justify-center w-8 h-8 rounded border transition-colors ${
                    block.value_type === 'percent'
                      ? 'bg-primary-50 border-primary-200 text-primary-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}
                  onClick={() => updateBlock(i, { value_type: block.value_type === 'percent' ? 'fixed' : 'percent' })}
                  title={block.value_type === 'percent' ? 'Процент от цены' : 'Фиксированная сумма'}
                >
                  {block.value_type === 'percent' ? <Percent className="h-3.5 w-3.5" /> : <DollarSign className="h-3.5 w-3.5" />}
                </button>
                {block.value_type === 'percent' && block.value > 0 && (
                  <span className="text-xs text-brand-text-secondary w-20 text-right">
                    = {formatCurrency(computed)} ₽
                  </span>
                )}
                <button
                  type="button"
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  onClick={() => removeBlock(i)}
                  title="Удалить"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}

        {/* Добавить расход */}
        {availableBlocks.length > 0 && (
          <div className="relative">
            <button
              type="button"
              className="flex items-center space-x-1 text-sm text-primary-600 hover:text-primary-700 transition-colors"
              onClick={() => setShowBlockMenu(!showBlockMenu)}
            >
              <Plus className="h-4 w-4" />
              <span>Добавить расход</span>
            </button>
            {showBlockMenu && (
              <div className="absolute top-8 left-0 z-10 bg-white rounded-lg shadow-lg border border-brand-border py-1 min-w-[220px]">
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
      </div>

      {/* Результат */}
      <div className={`card p-4 border-2 ${result.profit >= 0 ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-brand-text">Чистая прибыль</span>
          <span className={`text-xl font-bold ${result.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {result.profit >= 0 ? '+' : ''}{formatCurrency(result.profit)} ₽
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-brand-text">Маржинальность</span>
          <span className={`text-lg font-bold ${result.margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {result.margin.toFixed(1)}%
          </span>
        </div>
        {channel.seller_price > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-brand-text-secondary space-y-1">
            <div className="flex justify-between">
              <span>Себестоимость</span>
              <span>{formatCurrency(costPrice)} ₽</span>
            </div>
            <div className="flex justify-between">
              <span>Налог</span>
              <span>{formatCurrency(result.taxAmount)} ₽</span>
            </div>
            {result.variableTotal > 0 && (
              <div className="flex justify-between">
                <span>Вариативные расходы</span>
                <span>{formatCurrency(result.variableTotal)} ₽</span>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span>Итого расходы</span>
              <span>{formatCurrency(result.totalExpenses)} ₽</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default UnitEconomicsChannel
