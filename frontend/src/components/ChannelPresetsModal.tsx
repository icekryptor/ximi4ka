import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Plus, Percent, Settings } from 'lucide-react'
import { VariableBlock, VARIABLE_BLOCK_OPTIONS, CHANNEL_PRESETS } from '../api/unitEconomics'
import { ChannelPreset, channelPresetsApi } from '../api/channelPresets'

interface Props {
  isOpen: boolean
  onClose: () => void
  presets: ChannelPreset[]
  onPresetsUpdated: (presets: ChannelPreset[]) => void
}

const ChannelPresetsModal = ({ isOpen, onClose, presets, onPresetsUpdated }: Props) => {
  // Local editable copy
  const [localPresets, setLocalPresets] = useState<ChannelPreset[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [showBlockMenu, setShowBlockMenu] = useState(false)
  const [showAddChannel, setShowAddChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync local state when modal opens
  const handleEnter = () => {
    setLocalPresets(presets.map(p => ({ ...p, variable_blocks: p.variable_blocks.map(b => ({ ...b })) })))
    setActiveIdx(0)
    setShowBlockMenu(false)
    setShowAddChannel(false)
    setNewChannelName('')
  }

  const activePreset = localPresets[activeIdx] ?? null

  const updateActiveBlocks = (blocks: VariableBlock[]) => {
    setLocalPresets(prev => prev.map((p, i) => i === activeIdx ? { ...p, variable_blocks: blocks } : p))
  }

  const updateBlock = (blockIdx: number, updates: Partial<VariableBlock>) => {
    if (!activePreset) return
    const blocks = activePreset.variable_blocks.map((b, i) => i === blockIdx ? { ...b, ...updates } : b)
    updateActiveBlocks(blocks)
  }

  const removeBlock = (blockIdx: number) => {
    if (!activePreset) return
    updateActiveBlocks(activePreset.variable_blocks.filter((_, i) => i !== blockIdx))
  }

  const addBlock = (type: string) => {
    if (!activePreset) return
    const option = VARIABLE_BLOCK_OPTIONS.find(o => o.type === type)
    if (!option) return
    const block: VariableBlock = {
      type: option.type,
      label: option.label,
      value_type: option.default_value_type,
      value: 0,
    }
    updateActiveBlocks([...activePreset.variable_blocks, block])
    setShowBlockMenu(false)
  }

  const addPresetChannel = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (localPresets.some(p => p.channel_name === trimmed)) {
      setActiveIdx(localPresets.findIndex(p => p.channel_name === trimmed))
      setShowAddChannel(false)
      setNewChannelName('')
      return
    }
    const newPreset: ChannelPreset = {
      id: '',
      channel_name: trimmed,
      variable_blocks: [],
      created_at: '',
      updated_at: '',
    }
    const updated = [...localPresets, newPreset]
    setLocalPresets(updated)
    setActiveIdx(updated.length - 1)
    setShowAddChannel(false)
    setNewChannelName('')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated: ChannelPreset[] = []
      for (const preset of localPresets) {
        const saved = await channelPresetsApi.upsert(preset.channel_name, preset.variable_blocks)
        updated.push(saved)
      }
      onPresetsUpdated(updated)
      onClose()
    } catch (err) {
      console.error('Ошибка сохранения пресетов:', err)
    } finally {
      setSaving(false)
    }
  }

  const usedTypes = activePreset?.variable_blocks.map(b => b.type) ?? []
  const availableBlocks = VARIABLE_BLOCK_OPTIONS.filter(o => !usedTypes.includes(o.type))

  // Channels not yet in localPresets (from CHANNEL_PRESETS constants)
  const unusedPresetNames = CHANNEL_PRESETS.filter(name => !localPresets.some(p => p.channel_name === name))

  return (
    <Transition show={isOpen} as={Fragment} afterEnter={handleEnter}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95 translate-y-2"
            enterTo="opacity-100 scale-100 translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="modal-panel w-full max-w-xl">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-brand-border">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary-500" />
                  <h3 className="text-lg font-semibold text-brand-text">Настройки расходов по умолчанию</h3>
                </div>
                <button onClick={onClose} className="text-brand-text-secondary hover:text-brand-text">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Channel tabs */}
                <div className="flex items-center gap-1 flex-wrap">
                  {localPresets.map((preset, i) => (
                    <button
                      key={preset.channel_name}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        activeIdx === i
                          ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                          : 'text-brand-text-secondary hover:text-brand-text hover:bg-brand-surface'
                      }`}
                      onClick={() => { setActiveIdx(i); setShowBlockMenu(false) }}
                    >
                      {preset.channel_name}
                    </button>
                  ))}

                  {/* Add channel button */}
                  <div className="relative">
                    <button
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
                      onClick={() => setShowAddChannel(!showAddChannel)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Канал</span>
                    </button>
                    {showAddChannel && (
                      <div className="absolute top-9 left-0 z-20 bg-card rounded-lg shadow-lg border border-brand-border py-1 min-w-[180px]">
                        {unusedPresetNames.map(name => (
                          <button
                            key={name}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-brand-surface transition-colors"
                            onClick={() => addPresetChannel(name)}
                          >
                            {name}
                          </button>
                        ))}
                        {unusedPresetNames.length > 0 && <div className="border-t border-brand-border my-1" />}
                        <div className="px-3 py-2">
                          <input
                            type="text"
                            className="input w-full text-sm py-1"
                            placeholder="Свой канал..."
                            value={newChannelName}
                            onChange={e => setNewChannelName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') addPresetChannel(newChannelName)
                              if (e.key === 'Escape') setShowAddChannel(false)
                            }}
                            autoFocus
                          />
                        </div>
                        {newChannelName.trim() && (
                          <button
                            className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-brand-surface transition-colors"
                            onClick={() => addPresetChannel(newChannelName)}
                          >
                            + Добавить «{newChannelName.trim()}»
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Blocks editor */}
                {localPresets.length === 0 && (
                  <div className="bg-subtle rounded-lg p-6 text-center">
                    <p className="text-sm text-brand-text-secondary">
                      Добавьте канал, чтобы настроить расходы по умолчанию
                    </p>
                  </div>
                )}

                {activePreset && (
                  <div className="bg-subtle rounded-lg p-4">
                    {activePreset.variable_blocks.length === 0 && (
                      <p className="text-sm text-brand-text-secondary mb-3">
                        Нет расходов по умолчанию для этого канала
                      </p>
                    )}

                    <div className="space-y-0">
                      {activePreset.variable_blocks.map((block, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 border-b border-brand-border"
                        >
                          <span className="text-sm font-medium text-brand-text-secondary truncate">
                            {block.label}
                          </span>
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
                                  ? 'bg-primary-50 dark:bg-primary-900/50 border-primary-200 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                                  : 'bg-card border-brand-border text-brand-text-secondary'
                              }`}
                              onClick={() => updateBlock(i, { value_type: block.value_type === 'percent' ? 'fixed' : 'percent' })}
                              title={block.value_type === 'percent' ? 'Процент от цены' : 'Фиксированная сумма'}
                            >
                              {block.value_type === 'percent' ? <Percent className="h-3 w-3" /> : <span className="text-xs font-bold">₽</span>}
                            </button>
                          </div>
                          <button
                            type="button"
                            className="text-brand-text-secondary hover:text-red-500 transition-colors"
                            onClick={() => removeBlock(i)}
                            title="Удалить"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add block button */}
                    {availableBlocks.length > 0 && (
                      <div className="relative mt-3 pt-3 border-t border-brand-border">
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                          onClick={() => setShowBlockMenu(!showBlockMenu)}
                        >
                          <Plus className="h-4 w-4" />
                          <span>Добавить расход</span>
                        </button>
                        {showBlockMenu && (
                          <div className="absolute top-12 left-0 z-10 bg-card rounded-lg shadow-lg border border-brand-border py-1 min-w-[220px]">
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
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-4 pb-4 pt-2">
                <button type="button" onClick={onClose} className="btn btn-secondary">
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving || localPresets.length === 0}
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}

export default ChannelPresetsModal
