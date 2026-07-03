import { useEffect, useState } from 'react'
import { AlertTriangle, Bot, FileText, User, Workflow } from 'lucide-react'
import { BlueprintData, contentEngineApi } from '../api/contentEngine'
import { errorMessage } from '../components/marketing/utils'
import { EngineSelection, EngineTree } from '../components/content-engine/EngineTree'
import { StepDetailPanel } from '../components/content-engine/StepDetailPanel'

const ContentEngineHarness = () => {
  const [data, setData] = useState<BlueprintData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<EngineSelection | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const blueprint = await contentEngineApi.blueprint()
      setData(blueprint)
    } catch (e) {
      setError(errorMessage(e, 'Не удалось загрузить схему движка'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-3 text-3xl font-bold text-brand-text">
          <Workflow className="h-8 w-8 text-primary-600" />
          <span>Контент-движок</span>
        </h1>
        <p className="mt-1 text-brand-text-secondary">
          Как агент-сценарист проходит конвейер шагов и какие инструкции читает на каждом.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-brand-text-secondary">
          <span className="flex items-center gap-1.5">
            <Bot className="h-4 w-4 text-primary-600" /> AI-шаг
          </span>
          <span className="flex items-center gap-1.5">
            <User className="h-4 w-4 text-brand-text-secondary" /> ручной шаг
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-primary-600" /> инструкция (brand_doc)
          </span>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 gap-3">
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : error ? (
        <section className="card py-12 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <p className="mb-4 text-brand-text-secondary">{error}</p>
          <button type="button" onClick={() => void load()} className="btn btn-primary">
            Повторить
          </button>
        </section>
      ) : data ? (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <EngineTree
              contentTypes={data.contentTypes}
              docs={data.docs}
              selected={selection}
              onSelect={setSelection}
            />
          </div>
          <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-[28rem]">
            <StepDetailPanel selection={selection} docs={data.docs} onSelect={setSelection} />
          </aside>
        </div>
      ) : null}
    </div>
  )
}

export default ContentEngineHarness
