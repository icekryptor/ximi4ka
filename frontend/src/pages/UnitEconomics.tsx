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

  // Auto-load last calculation when kit changes
  useEffect(() => {
    if (!selectedKitId) {
      setChannels([])
      setActiveChannelIdx(0)
      setLoadedCalcId(null)
      setLoadedCalcName('')
      setHasChanges(false)
      return
    }

    const autoLoad = async () => {
      try {
        const calcs = await unitEconomicsApi.getAll(selectedKitId)
        if (calcs.length > 0) {
          // Load the most recent calculation (already sorted by updated_at DESC)
          const latest = calcs[0]
          const ch: ChannelConfig = {
            channel_name: latest.channel_name,
            seller_price: Number(latest.seller_price),
            ...(latest.start_price != null && { start_price: Number(latest.start_price) }),
            ...(latest.seller_discount != null && { seller_discount: Number(latest.seller_discount) }),
            cost_type: latest.cost_type,
            tax_rate: Number(latest.tax_rate),
            variable_blocks: latest.variable_blocks || [],
          }
          setChannels([ch])
          setActiveChannelIdx(0)
          setLoadedCalcId(latest.id)
          setLoadedCalcName(latest.name)
          setHasChanges(false)
        } else {
          // No saved calculations — start fresh
          setChannels([])
          setActiveChannelIdx(0)
          setLoadedCalcId(null)
          setLoadedCalcName('')
          setHasChanges(false)
        }
      } catch (err) {
        console.error('Ошибка автозагрузки расчёта:', err)
        setChannels([])
        setActiveChannelIdx(0)
        setLoadedCalcId(null)
        setLoadedCalcName('')
        setHasChanges(false)
      }
    }

    autoLoad()
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
        start_price: ch.start_price,
        seller_discount: ch.seller_discount,
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
        start_price: ch.start_price,
        seller_discount: ch.seller_discount,
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
        start_price: ch.start_price,
        seller_discount: ch.seller_discount,
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
      ...(calc.start_price != null && { start_price: Number(calc.start_price) }),
      ...(calc.seller_discount != null && { seller_discount: Number(calc.seller_discount) }),
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
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Calculator className="h-6 w-6 text-primary-500" />
          <h1 className="text-2xl font-bold text-brand-text">UNIT-экономика</h1>
          {/* Kit selector — compact inline */}
          <select
            className="input text-sm py-1.5 w-52 ml-2"
            value={selectedKitId || ''}
            onChange={e => setSelectedKitId(e.target.value || null)}
          >
            <option value="">Артикул...</option>
            {kits.map(kit => (
              <option key={kit.id} value={kit.id}>
                {kit.name} {kit.seller_sku ? `[${kit.seller_sku}]` : kit.sku ? `(${kit.sku})` : ''}
              </option>
            ))}
          </select>
          {selectedKit && (
            <span className="text-xs text-brand-text-secondary hidden sm:inline">
              факт {Number(selectedKit.total_cost || 0).toFixed(0)} ₽ / расч {Number(selectedKit.estimated_cost || 0).toFixed(0)} ₽
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loadedCalcId && (
            <span className="text-xs text-brand-text-secondary hidden md:flex items-center gap-1">
              📄 {loadedCalcName}
              {hasChanges && <span className="text-amber-600 font-medium">•</span>}
            </span>
          )}
          <button
            className="btn btn-secondary flex items-center gap-1 text-sm py-1.5 px-3"
            onClick={() => setShowLoadModal(true)}
            disabled={!selectedKitId}
          >
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Загрузить</span>
          </button>
          <button
            className="btn btn-primary flex items-center gap-1 text-sm py-1.5 px-3"
            onClick={() => setShowSaveModal(true)}
            disabled={channels.length === 0}
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">Сохранить</span>
          </button>
        </div>
      </div>

      {/* Channel tabs — visually connected to content */}
      {selectedKitId && channels.length > 0 && (
        <div className="flex items-end gap-0 flex-wrap">
          {channels.map((ch, i) => (
            <div key={i} className="flex items-center shrink-0">
              <button
                className={`px-5 py-2.5 text-sm font-medium transition-colors border-t border-x rounded-t-lg ${
                  activeChannelIdx === i
                    ? 'bg-white text-primary-700 border-brand-border -mb-px z-10'
                    : 'bg-gray-50 text-brand-text-secondary hover:text-brand-text border-transparent hover:bg-gray-100'
                }`}
                onClick={() => setActiveChannelIdx(i)}
              >
                {ch.channel_name}
              </button>
              {channels.length > 1 && (
                <button
                  className={`-ml-1 mr-1 transition-opacity ${
                    activeChannelIdx === i ? 'text-gray-400 hover:text-red-500' : 'text-gray-300 hover:text-red-400'
                  }`}
                  onClick={() => removeChannel(i)}
                  title="Удалить канал"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          {/* Add channel */}
          <div className="relative shrink-0">
            <button
              className="flex items-center gap-1 px-3 py-2.5 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-t-lg transition-colors"
              onClick={() => setShowChannelMenu(!showChannelMenu)}
            >
              <Plus className="h-4 w-4" />
              <span>Канал</span>
            </button>
            {showChannelMenu && (
              <div className="absolute top-11 left-0 z-20 bg-white rounded-lg shadow-lg border border-brand-border py-1 min-w-[180px]">
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

      {/* Channel content — visually connected to tabs */}
      {selectedKit && channels.length > 0 && channels[activeChannelIdx] && (
        <div className="bg-white border border-brand-border rounded-b-lg rounded-tr-lg p-5 -mt-px">
          <UnitEconomicsChannel
            kit={selectedKit}
            channel={channels[activeChannelIdx]}
            onChange={updateChannel}
          />
        </div>
      )}

      {/* Empty state — no channels yet */}
      {selectedKitId && channels.length === 0 && (
        <div className="card p-8 text-center mt-2">
          <Calculator className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-brand-text-secondary mb-4">
            Добавьте канал продаж для начала расчёта
          </p>
          <div className="flex justify-center gap-2">
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

      {/* Empty state — no kit selected */}
      {!selectedKitId && (
        <div className="card p-8 text-center mt-2">
          <Calculator className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-brand-text-secondary">
            Выберите артикул для начала расчёта
          </p>
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
