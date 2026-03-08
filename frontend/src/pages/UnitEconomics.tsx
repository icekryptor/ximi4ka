import { useState, useEffect, useCallback } from 'react'
import { Save, FolderOpen, Plus, X, Calculator } from 'lucide-react'
import { kitsApi, Kit } from '../api/kits'
import {
  ChannelConfig,
  UnitEconomicsCalculation,
  CHANNEL_PRESETS,
  createDefaultChannel,
  unitEconomicsApi,
} from '../api/unitEconomics'
import UnitEconomicsChannel from '../components/UnitEconomicsChannel'
import SaveCalculationModal from '../components/SaveCalculationModal'
import LoadCalculationModal from '../components/LoadCalculationModal'

const UnitEconomics = () => {
  // Data
  const [kits, setKits] = useState<Kit[]>([])
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Channels
  const [channels, setChannels] = useState<ChannelConfig[]>([])
  const [activeChannelIdx, setActiveChannelIdx] = useState(0)

  // Loaded calculation tracking
  const [loadedCalcId, setLoadedCalcId] = useState<string | null>(null)
  const [loadedCalcName, setLoadedCalcName] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Modals
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [showChannelMenu, setShowChannelMenu] = useState(false)

  // Load kits
  useEffect(() => {
    const fetchKits = async () => {
      try {
        const data = await kitsApi.getAll()
        setKits(data.filter(k => k.is_active))
        if (data.length > 0) {
          setSelectedKitId(data[0].id)
        }
      } catch (err) {
        console.error('Ошибка загрузки артикулов:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchKits()
  }, [])

  // Reset channels when kit changes
  useEffect(() => {
    setChannels([])
    setActiveChannelIdx(0)
    setLoadedCalcId(null)
    setLoadedCalcName('')
    setHasChanges(false)
  }, [selectedKitId])

  const selectedKit = kits.find(k => k.id === selectedKitId) || null

  const updateChannel = useCallback((channel: ChannelConfig) => {
    setChannels(prev => {
      const updated = [...prev]
      updated[activeChannelIdx] = channel
      return updated
    })
    setHasChanges(true)
  }, [activeChannelIdx])

  const addChannel = (name: string) => {
    const newChannel = createDefaultChannel(name)
    setChannels(prev => [...prev, newChannel])
    setActiveChannelIdx(channels.length)
    setShowChannelMenu(false)
    setHasChanges(true)
  }

  const removeChannel = (index: number) => {
    if (channels.length <= 1) return
    setChannels(prev => prev.filter((_, i) => i !== index))
    if (activeChannelIdx >= index && activeChannelIdx > 0) {
      setActiveChannelIdx(activeChannelIdx - 1)
    }
    setHasChanges(true)
  }

  // Save
  const handleSave = async (name: string) => {
    if (!selectedKitId || !channels[activeChannelIdx]) return
    try {
      const ch = channels[activeChannelIdx]
      const saved = await unitEconomicsApi.save({
        kit_id: selectedKitId,
        name,
        channel_name: ch.channel_name,
        seller_price: ch.seller_price,
        cost_type: ch.cost_type,
        tax_rate: ch.tax_rate,
        variable_blocks: ch.variable_blocks,
      })
      setLoadedCalcId(saved.id)
      setLoadedCalcName(saved.name)
      setHasChanges(false)
    } catch (err) {
      console.error('Ошибка сохранения:', err)
    }
  }

  const handleUpdate = async () => {
    if (!loadedCalcId || !channels[activeChannelIdx]) return
    try {
      const ch = channels[activeChannelIdx]
      await unitEconomicsApi.update(loadedCalcId, {
        channel_name: ch.channel_name,
        seller_price: ch.seller_price,
        cost_type: ch.cost_type,
        tax_rate: ch.tax_rate,
        variable_blocks: ch.variable_blocks,
      })
      setHasChanges(false)
    } catch (err) {
      console.error('Ошибка обновления:', err)
    }
  }

  const handleSaveAsNew = async (name: string) => {
    if (!loadedCalcId) return
    try {
      const cloned = await unitEconomicsApi.clone(loadedCalcId, name)
      // Now update the clone with current data
      const ch = channels[activeChannelIdx]
      const updated = await unitEconomicsApi.update(cloned.id, {
        channel_name: ch.channel_name,
        seller_price: ch.seller_price,
        cost_type: ch.cost_type,
        tax_rate: ch.tax_rate,
        variable_blocks: ch.variable_blocks,
      })
      setLoadedCalcId(updated.id)
      setLoadedCalcName(updated.name)
      setHasChanges(false)
    } catch (err) {
      console.error('Ошибка сохранения как новый:', err)
    }
  }

  // Load
  const handleLoad = (calc: UnitEconomicsCalculation) => {
    const ch: ChannelConfig = {
      channel_name: calc.channel_name,
      seller_price: Number(calc.seller_price),
      cost_type: calc.cost_type,
      tax_rate: Number(calc.tax_rate),
      variable_blocks: calc.variable_blocks || [],
    }
    setChannels([ch])
    setActiveChannelIdx(0)
    setLoadedCalcId(calc.id)
    setLoadedCalcName(calc.name)
    setHasChanges(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const usedChannelNames = channels.map(c => c.channel_name)
  const availablePresets = CHANNEL_PRESETS.filter(p => !usedChannelNames.includes(p))

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Calculator className="h-6 w-6 text-primary-500" />
          <h1 className="text-2xl font-bold text-brand-text">UNIT-экономика</h1>
        </div>
        <div className="flex items-center space-x-2">
          <button
            className="btn btn-secondary flex items-center space-x-1"
            onClick={() => setShowLoadModal(true)}
            disabled={!selectedKitId}
          >
            <FolderOpen className="h-4 w-4" />
            <span>Загрузить</span>
          </button>
          <button
            className="btn btn-primary flex items-center space-x-1"
            onClick={() => setShowSaveModal(true)}
            disabled={channels.length === 0}
          >
            <Save className="h-4 w-4" />
            <span>Сохранить</span>
          </button>
        </div>
      </div>

      {/* Kit selector */}
      <div className="card p-4 mb-4">
        <label className="block text-sm font-medium text-brand-text mb-1">Артикул (набор)</label>
        <select
          className="input w-full"
          value={selectedKitId || ''}
          onChange={e => setSelectedKitId(e.target.value || null)}
        >
          <option value="">Выберите артикул...</option>
          {kits.map(kit => (
            <option key={kit.id} value={kit.id}>
              {kit.name} {kit.sku ? `(${kit.sku})` : ''}
            </option>
          ))}
        </select>
        {selectedKit && (
          <div className="mt-2 text-xs text-brand-text-secondary flex space-x-4">
            <span>Фактическая: {Number(selectedKit.total_cost || 0).toFixed(2)} ₽</span>
            <span>Расчётная: {Number(selectedKit.estimated_cost || 0).toFixed(2)} ₽</span>
          </div>
        )}
      </div>

      {/* Loaded info */}
      {loadedCalcId && (
        <div className="text-sm text-brand-text-secondary mb-3 flex items-center space-x-2">
          <span>📄 Загружен: «{loadedCalcName}»</span>
          {hasChanges && (
            <span className="text-amber-600 text-xs font-medium">(изменён)</span>
          )}
        </div>
      )}

      {/* Channel tabs */}
      {selectedKitId && (
        <div className="flex items-center space-x-1 mb-4 overflow-x-auto pb-1">
          {channels.map((ch, i) => (
            <div key={i} className="flex items-center">
              <button
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeChannelIdx === i
                    ? 'bg-white text-primary-700 border border-b-0 border-brand-border'
                    : 'text-brand-text-secondary hover:text-brand-text hover:bg-white/50'
                }`}
                onClick={() => setActiveChannelIdx(i)}
              >
                {ch.channel_name}
              </button>
              {channels.length > 1 && (
                <button
                  className="text-gray-400 hover:text-red-500 ml-0.5 -mr-1"
                  onClick={() => removeChannel(i)}
                  title="Удалить канал"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          {/* Add channel */}
          <div className="relative">
            <button
              className="flex items-center space-x-1 px-3 py-2 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
              onClick={() => setShowChannelMenu(!showChannelMenu)}
            >
              <Plus className="h-4 w-4" />
              <span>Канал</span>
            </button>
            {showChannelMenu && (
              <div className="absolute top-10 left-0 z-10 bg-white rounded-lg shadow-lg border border-brand-border py-1 min-w-[180px]">
                {availablePresets.map(name => (
                  <button
                    key={name}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-brand-surface transition-colors"
                    onClick={() => addChannel(name)}
                  >
                    {name}
                  </button>
                ))}
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-brand-surface transition-colors"
                    onClick={() => {
                      const name = prompt('Название канала:')
                      if (name?.trim()) addChannel(name.trim())
                      setShowChannelMenu(false)
                    }}
                  >
                    + Свой канал...
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Channel content */}
      {selectedKit && channels.length > 0 && channels[activeChannelIdx] && (
        <UnitEconomicsChannel
          kit={selectedKit}
          channel={channels[activeChannelIdx]}
          onChange={updateChannel}
        />
      )}

      {/* Empty state */}
      {selectedKitId && channels.length === 0 && (
        <div className="card p-8 text-center">
          <Calculator className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-brand-text-secondary mb-4">
            Добавьте канал продаж для начала расчёта
          </p>
          <div className="flex justify-center space-x-2">
            {CHANNEL_PRESETS.slice(0, 3).map(name => (
              <button
                key={name}
                className="btn btn-secondary text-sm"
                onClick={() => addChannel(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <SaveCalculationModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSave}
        onUpdate={handleUpdate}
        onSaveAsNew={handleSaveAsNew}
        loadedCalcId={loadedCalcId}
        loadedCalcName={loadedCalcName}
        hasChanges={hasChanges}
      />
      <LoadCalculationModal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        kitId={selectedKitId}
        onLoad={handleLoad}
      />
    </div>
  )
}

export default UnitEconomics
