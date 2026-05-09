import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { unitsApi, ContentUnit, ContentRubric } from '../api/contentBank'
import { voiceoverApi, BootstrapResponse, FactcheckItem } from '../api/voiceover'
import { StepNav } from '../components/voiceover/StepNav'
import { UnitPicker } from '../components/voiceover/UnitPicker'
import { GenerateStep } from '../components/voiceover/GenerateStep'
import { FactcheckStep } from '../components/voiceover/FactcheckStep'
import { StyleStep } from '../components/voiceover/StyleStep'
import { PreprocessStep } from '../components/voiceover/PreprocessStep'

export type StepKey = 'pick' | 'generate' | 'factcheck' | 'style' | 'preprocess'

export interface WizardState {
  step: StepKey
  unit: ContentUnit | null

  topic: string
  duration: '60' | '90' | '120'
  styles: string[]

  draft: string
  factcheck: FactcheckItem[]
  finalScript: string
  editNotes: string
  chunks: string[]
}

const INITIAL: WizardState = {
  step: 'pick',
  unit: null,
  topic: '',
  duration: '60',
  styles: [],
  draft: '',
  factcheck: [],
  finalScript: '',
  editNotes: '',
  chunks: [],
}

export default function VoiceoverStudio() {
  const toast = useToast()
  const navigate = useNavigate()
  const { unitId } = useParams<{ unitId?: string }>()

  const [state, setState] = useState<WizardState>(INITIAL)
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Load bootstrap once
  useEffect(() => {
    voiceoverApi
      .bootstrap()
      .then(setBootstrap)
      .catch(() => toast.error('Не удалось загрузить данные студии'))
      .finally(() => setLoading(false))
  }, [toast])

  // If unitId is in URL — preload that unit and skip pick step
  useEffect(() => {
    if (!unitId) return
    unitsApi
      .getOne(unitId)
      .then(unit => {
        const topic = buildTopicFromUnit(unit, bootstrap?.rubrics ?? [])
        setState(s => ({
          ...s,
          step: 'generate',
          unit,
          topic,
          draft: unit.script_text ?? '',
          finalScript: unit.script_text ?? '',
        }))
      })
      .catch(() => toast.error('Не удалось загрузить юнит'))
  }, [unitId, bootstrap, toast])

  const update = useCallback(
    (patch: Partial<WizardState>) => setState(s => ({ ...s, ...patch })),
    [],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <StepNav currentStep={state.step} onJump={(s) => update({ step: s })} />

      {state.step === 'pick' && bootstrap && (
        <UnitPicker
          rubrics={bootstrap.rubrics}
          onSelect={(unit: ContentUnit) => {
            const topic = buildTopicFromUnit(unit, bootstrap.rubrics)
            update({
              step: 'generate',
              unit,
              topic,
              draft: unit.script_text ?? '',
              finalScript: unit.script_text ?? '',
            })
          }}
        />
      )}

      {state.step === 'generate' && (
        <GenerateStep state={state} update={update} onBack={() => update({ step: 'pick' })} onNext={() => update({ step: 'factcheck' })} />
      )}

      {state.step === 'factcheck' && (
        <FactcheckStep state={state} update={update} onBack={() => update({ step: 'generate' })} onNext={() => update({ step: 'style' })} />
      )}

      {state.step === 'style' && (
        <StyleStep state={state} update={update} onBack={() => update({ step: 'factcheck' })} onNext={() => update({ step: 'preprocess' })} />
      )}

      {state.step === 'preprocess' && (
        <PreprocessStep
          state={state}
          update={update}
          onBack={() => update({ step: 'style' })}
          onDone={() => navigate(`/content-bank?search=${encodeURIComponent(state.unit?.title ?? '')}`)}
        />
      )}
    </div>
  )
}

function buildTopicFromUnit(unit: ContentUnit, rubrics: ContentRubric[]): string {
  let t = unit.title
  if (unit.hook) t += `\n\nХук: ${unit.hook}`
  if (unit.essence) t += `\n\nСуть: ${unit.essence}`
  const rubric = rubrics.find(r => r.id === unit.rubric_id)
  if (rubric) {
    t += `\n\nРубрика: ${rubric.title}${rubric.tone ? ' | Тон: ' + rubric.tone : ''}`
  }
  return t
}
