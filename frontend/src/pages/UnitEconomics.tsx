import { useState, useEffect, useCallback } from 'react'
import { Save, FolderOpen, Plus, X, Calculator, Share2, Copy, Check, Settings } from 'lucide-react'
import { kitsApi, Kit } from '../api/kits'
import {
  ChannelConfig,
  CHANNEL_PRESETS,
  createDefaultChannel,
  unitEconomicsApi,
} from '../api/unitEconomics'
import { channelPresetsApi, ChannelPreset } from '../api/channelPresets'
import UnitEconomicsChannel from '../components/UnitEconomicsChannel'
import SaveCalculationModal from '../components/SaveCalculationModal'
import LoadCalculationModal from '../components/LoadCalculationModal'
import ChannelPresetsModal from '../components/ChannelPresetsModal'
import { ActualCalcsPanel } from '../components/unit-economics/ActualCalcsPanel'

const UnitEconomics = () => {
  // Data
  const [kits, setKits] = useState<Kit[]>([])
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Channels
  const [channels, setChannels] = useState<ChannelConfig[]>([])
  const [activeChannelIdx, setActiveChannelIdx] = useState(0)

  // Loaded group tracking
  const [loadedGroupId, setLoadedGroupId] = useState<string | null>(null)
  const [loadedGroupName, setLoadedGroupName] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Presets
  const [presets, setPresets] = useState<ChannelPreset[]>([])

  // Modals
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [showChannelMenu, setShowChannelMenu] = useState(false)
  const [showPresetsModal, setShowPresetsModal] = useState(false)

  // Share
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [copied, setCopied] = useState(false)

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

  // Load channel presets once on mount
  useEffect(() => {
    channelPresetsApi.getAll().then(setPresets).catch(console.error)
  }, [])

  // Auto-load last group when kit changes
  useEffect(() => {
    if (!selectedKitId) {
      setChannels([])
      setActiveChannelIdx(0)
      setLoadedGroupId(null)
      setLoadedGroupName('')
      setHasChanges(false)
      return
    }

    const autoLoad = async () => {
      try {
        const groups = await unitEconomicsApi.getGroups(selectedKitId)
        if (groups.length > 0) {
          const latestGroup = groups[0]
          const calcs = await unitEconomicsApi.getByGroup(latestGroup.group_id)
          if (calcs.length > 0) {
            const loadedChannels: ChannelConfig[] = calcs.map(calc => ({
              channel_name: calc.channel_name,
              seller_price: Number(calc.seller_price),
              ...(calc.start_price != null && { start_price: Number(calc.start_price) }),
              ...(calc.seller_discount != null && { seller_discount: Number(calc.seller_discount) }),
              ...(calc.marketplace_price != null && { marketplace_price: Number(calc.marketplace_price) }),
              cost_type: calc.cost_type,
              tax_rate: Number(calc.tax_rate),
              variable_blocks: calc.variable_blocks || [],
            }))
            setChannels(loadedChannels)
            setActiveChannelIdx(0)
            setLoadedGroupId(latestGroup.group_id)
            setLoadedGroupName(latestGroup.name)
            setHasChanges(false)
            return
          }
        }
        // No saved groups — start fresh
        setChannels([])
        setActiveChannelIdx(0)
        setLoadedGroupId(null)
        setLoadedGroupName('')
        setHasChanges(false)
      } catch (err) {
        console.error('Ошибка автозагрузки расчёта:', err)
        setChannels([])
        setActiveChannelIdx(0)
        setLoadedGroupId(null)
        setLoadedGroupName('')
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
    const preset = presets.find(p => p.channel_name === name)
    const newChannel = createDefaultChannel(name)
    if (preset && preset.variable_blocks.length > 0) {
      newChannel.variable_blocks = preset.variable_blocks
    }
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

  // Save ALL channels as a new group
  const handleSave = async (name: string) => {
    if (!selectedKitId || channels.length === 0) return
    try {
      const result = await unitEconomicsApi.batchSave({
        kit_id: selectedKitId,
        name,
        channels,
      })
      setLoadedGroupId(result.group_id)
      setLoadedGroupName(result.name)
      setHasChanges(false)
    } catch (err) {
      console.error('Ошибка сохранения:', err)
    }
  }

  // Overwrite ALL channels of the existing group
  const handleUpdate = async () => {
    if (!loadedGroupId || !selectedKitId || channels.length === 0) return
    try {
      const result = await unitEconomicsApi.batchSave({
        kit_id: selectedKitId,
        name: loadedGroupName,
        group_id: loadedGroupId,
        channels,
      })
      setLoadedGroupId(result.group_id)
      setLoadedGroupName(result.name)
      setHasChanges(false)
    } catch (err) {
      console.error('Ошибка обновления:', err)
    }
  }

  // Save ALL channels as a brand new group with a new name
  const handleSaveAsNew = async (name: string) => {
    if (!selectedKitId || channels.length === 0) return
    try {
      const result = await unitEconomicsApi.batchSave({
        kit_id: selectedKitId,
        name,
        channels,
      })
      setLoadedGroupId(result.group_id)
      setLoadedGroupName(result.name)
      setHasChanges(false)
    } catch (err) {
      console.error('Ошибка сохранения как новый:', err)
    }
  }

  // Load ALL channels from a group
  const handleLoad = (loadedChannels: ChannelConfig[], groupId: string, groupName: string) => {
    setChannels(loadedChannels)
    setActiveChannelIdx(0)
    setLoadedGroupId(groupId)
    setLoadedGroupName(groupName)
    setHasChanges(false)
  }

  const handleShare = async () => {
    if (!loadedGroupId) return
    setShareLoading(true)
    try {
      const result = await unitEconomicsApi.createShare(loadedGroupId)
      setShareUrl(result.share_url)
      setShowShareModal(true)
      setCopied(false)
    } catch (err) {
      console.error('Ошибка создания ссылки:', err)
    } finally {
      setShareLoading(false)
    }
  }

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback for older browsers
      const el = document.createElement('textarea')
      el.value = shareUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
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
          {loadedGroupId && (
            <span className="text-xs text-brand-text-secondary hidden md:flex items-center gap-1">
              {loadedGroupName}
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
          {loadedGroupId && (
            <button
              className="btn btn-secondary flex items-center gap-1 text-sm py-1.5 px-3"
              onClick={handleShare}
              disabled={shareLoading}
              title="Поделиться расчётом"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Поделиться</span>
            </button>
          )}
          <button
            className="btn btn-secondary flex items-center gap-1 text-sm py-1.5 px-3"
            onClick={() => setShowPresetsModal(true)}
            title="Настройки расходов по умолчанию"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Шаблоны</span>
          </button>
        </div>
      </div>

      {/* Channel tabs — visually connected to content */}
      {selectedKitId && channels.length > 0 && (
        <div className="flex items-end gap-0 flex-wrap">
          {channels.map((ch, i) => (
            <button
              key={i}
              className={`flex items-center gap-1.5 shrink-0 px-4 py-2.5 text-sm font-medium transition-colors border-t border-x rounded-t-lg ${
                activeChannelIdx === i
                  ? 'bg-card text-primary-700 dark:text-primary-300 border-brand-border -mb-px z-10'
                  : 'bg-subtle text-brand-text-secondary hover:text-brand-text border-transparent hover:bg-muted'
              }`}
              onClick={() => setActiveChannelIdx(i)}
            >
              {ch.channel_name}
              {channels.length > 1 && (
                <span
                  className="ml-1 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
                  onClick={(e) => { e.stopPropagation(); removeChannel(i) }}
                  title="Удалить канал"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </button>
          ))}

          {/* Add channel */}
          <div className="relative shrink-0">
            <button
              className="flex items-center gap-1 px-3 py-2.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-t-lg transition-colors"
              onClick={() => setShowChannelMenu(!showChannelMenu)}
            >
              <Plus className="h-4 w-4" />
              <span>Канал</span>
            </button>
            {showChannelMenu && (
              <div className="absolute top-11 left-0 z-20 bg-card rounded-lg shadow-lg border border-brand-border py-1 min-w-[180px]">
                {availablePresets.map(name => (
                  <button
                    key={name}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-brand-surface transition-colors"
                    onClick={() => addChannel(name)}
                  >
                    {name}
                  </button>
                ))}
                <div className="border-t border-brand-border mt-1 pt-1">
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
        <div className="bg-card border border-brand-border rounded-b-lg rounded-tr-lg p-5 -mt-px">
          <UnitEconomicsChannel
            kit={selectedKit}
            channel={channels[activeChannelIdx]}
            onChange={updateChannel}
            presetBlocks={presets.find(p => p.channel_name === channels[activeChannelIdx]?.channel_name)?.variable_blocks}
          />
        </div>
      )}

      {/* Актуальные расчёты — источник истины для планирования/аналитики */}
      {selectedKitId && (
        <div className="mt-4">
          <ActualCalcsPanel kitId={selectedKitId} />
        </div>
      )}

      {/* Empty state — no channels yet */}
      {selectedKitId && channels.length === 0 && (
        <div className="card p-8 text-center mt-2">
          <Calculator className="h-12 w-12 text-brand-text-secondary mx-auto mb-3" />
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
          <Calculator className="h-12 w-12 text-brand-text-secondary mx-auto mb-3" />
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
        loadedGroupId={loadedGroupId}
        loadedGroupName={loadedGroupName}
        hasChanges={hasChanges}
      />
      <LoadCalculationModal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        kitId={selectedKitId}
        onLoad={handleLoad}
      />
      <ChannelPresetsModal
        isOpen={showPresetsModal}
        onClose={() => setShowPresetsModal(false)}
        presets={presets}
        onPresetsUpdated={setPresets}
      />

      {/* Share modal */}
      {showShareModal && shareUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowShareModal(false)}
          />
          <div className="relative bg-card rounded-2xl shadow-xl border border-brand-border p-6 max-w-md w-full z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-brand-text">Поделиться расчётом</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-brand-text-secondary hover:text-brand-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-brand-text-secondary mb-3">
              Ссылка открывает публичный вид расчёта без возможности редактирования.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="input text-sm flex-1 min-w-0"
                onFocus={e => e.target.select()}
              />
              <button
                className="btn btn-primary flex items-center gap-1.5 text-sm py-2 px-3 shrink-0"
                onClick={handleCopyShareUrl}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Скопировано!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Копировать</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UnitEconomics
