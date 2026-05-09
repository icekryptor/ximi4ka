import { useState } from 'react'
import { Loader2, Copy, Download } from 'lucide-react'
import { voiceoverApi } from '../../api/voiceover'
import { unitsApi } from '../../api/contentBank'
import { useToast } from '../../contexts/ToastContext'
import type { WizardState } from '../../pages/VoiceoverStudio'

interface Props {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  onBack: () => void
  onDone: () => void
}

function buildTZ(state: WizardState): string {
  const lines = [
    'ТЗ для монтажника',
    `Проект: Химичка · Войсовер`,
    `Тема: ${(state.unit?.title ?? state.topic).slice(0, 80)}`,
    `Длина: ~${state.duration} сек`,
    `Чанков: ${state.chunks.length}`,
    '',
    'НАСТРОЙКИ ELEVENLABS:',
    'Модель: Turbo v2.5',
    'Stability: 0.55',
    'Similarity: 0.80',
    'Style exaggeration: 0',
    'Speaker Boost: включён',
    'Output format: mp3_44100_128',
    '',
    'ВОЙСОВЕР:',
    'Загружай каждый чанк ОТДЕЛЬНО (не bulk!).',
    'Файлы: chunk_01.mp3, chunk_02.mp3 …',
    '',
    'МОНТАЖ:',
    'Склеивать в порядке нумерации.',
    'Пауза между чанками: 100–200 мс.',
    'Нормализация: -16 LUFS.',
    'Постобработка: de-click (iZotope RX / Adobe Podcast).',
    '',
    'ТЕКСТ ПО ЧАНКАМ:',
    ...state.chunks.map((c, i) => `\n[${i + 1}] ${c}`),
  ]
  return lines.join('\n')
}

export function PreprocessStep({ state, update, onBack, onDone }: Props) {
  const toast = useToast()
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)

  const run = async () => {
    setRunning(true)
    try {
      const r = await voiceoverApi.preprocess(state.finalScript)
      update({ chunks: r.chunks })
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Ошибка препроцессинга')
    } finally {
      setRunning(false)
    }
  }

  const copyChunk = async (text: string) => {
    await navigator.clipboard.writeText(text)
    toast.success('Чанк скопирован')
  }

  const downloadTZ = () => {
    const blob = new Blob([buildTZ(state)], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'tz_voiceover.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const finish = async () => {
    if (!state.unit) return onDone()
    const assembled = state.chunks.join(' ').trim()
    if (!assembled) return onDone()
    setSaving(true)
    try {
      await unitsApi.update(state.unit.id, { voiceover_text: assembled })
      toast.success('Сценарий и озвучка сохранены в контент-банк')
      onDone()
    } catch {
      toast.error('Не удалось сохранить озвучку')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-brand-text">ТЗ для ElevenLabs</h2>
        <p className="text-sm text-brand-text-secondary mt-1">
          Расстановка ударений (U+0301), эмоциональные теги, чанки 200-350 символов.
        </p>
      </div>

      {state.chunks.length === 0 && !running && (
        <button onClick={run} className="btn btn-primary">
          🎙 Запустить препроцессор
        </button>
      )}

      {running && (
        <div className="flex items-center gap-2 text-brand-text-secondary">
          <Loader2 size={16} className="animate-spin" /> Расставляем ударения и режем на чанки…
        </div>
      )}

      {state.chunks.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={run} disabled={running} className="btn btn-secondary text-sm">
              🔄 Перезапустить
            </button>
            <button onClick={downloadTZ} className="btn btn-secondary text-sm">
              <Download size={14} /> Скачать ТЗ
            </button>
            <span className="text-xs text-brand-text-secondary ml-auto">{state.chunks.length} чанков</span>
          </div>

          <div className="space-y-2">
            {state.chunks.map((c, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-xl border border-brand-border bg-subtle">
                <div className="text-xs font-mono text-brand-text-secondary w-6 shrink-0">{i + 1}</div>
                <pre className="flex-1 text-sm whitespace-pre-line font-mono text-brand-text">{c}</pre>
                <button
                  onClick={() => copyChunk(c)}
                  className="text-brand-text-secondary hover:text-primary-600"
                  title="Копировать"
                >
                  <Copy size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-brand-border">
        <button onClick={onBack} className="btn btn-secondary">← К стилю</button>
        <button
          onClick={finish}
          disabled={saving || state.chunks.length === 0}
          className="btn btn-primary"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : '✅'} Готово
        </button>
      </div>
    </div>
  )
}
