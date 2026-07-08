import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Check, ShieldCheck } from 'lucide-react'
import { settingsApi, IntegrationsStatus } from '../api/settings'
import { useToast } from '../contexts/ToastContext'

const formatDateTime = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

const Settings = () => {
  const toast = useToast()
  const [status, setStatus] = useState<IntegrationsStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [ozon, setOzon] = useState({ perf_client_id: '', perf_client_secret: '', seller_client_id: '', seller_api_key: '' })
  const [savingOzon, setSavingOzon] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStatus(await settingsApi.integrations())
    } catch {
      toast.error('Не удалось загрузить настройки')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    if (!token.trim()) {
      toast.error('Введите токен')
      return
    }
    setSaving(true)
    try {
      await settingsApi.saveWbToken(token.trim())
      toast.success('WB-токен сохранён — применён во всех WB-разделах')
      setToken('')
      await load()
    } catch (err: any) {
      toast.error('Ошибка: ' + (err.response?.data?.error || err.message))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveOzon = async () => {
    const patch = Object.fromEntries(Object.entries(ozon).filter(([, v]) => v.trim()))
    if (Object.keys(patch).length === 0) {
      toast.error('Заполните хотя бы одно поле Ozon')
      return
    }
    setSavingOzon(true)
    try {
      await settingsApi.saveOzonCreds(patch)
      toast.success('Креды Ozon сохранены')
      setOzon({ perf_client_id: '', perf_client_secret: '', seller_client_id: '', seller_api_key: '' })
      await load()
    } catch (err: any) {
      toast.error('Ошибка: ' + (err.response?.data?.error || err.message))
    } finally {
      setSavingOzon(false)
    }
  }

  const wb = status?.wb
  const oz = status?.ozon

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center space-x-3">
        <KeyRound className="h-6 w-6 text-primary-500" />
        <h1 className="text-2xl font-bold text-brand-text">Интеграции</h1>
      </div>

      <div className="card space-y-4">
        <div>
          <h2 className="text-base font-semibold text-brand-text">WB API токен</h2>
          <p className="mt-1 text-sm text-brand-text-secondary">
            Один токен на все WB-разделы: <b>Реклама</b>, <b>Финансы</b> и <b>Трекер СПП</b>. Сохраняется в БД и
            переживает перезапуски — вводить повторно не нужно. Нужны скоупы: <b>Продвижение</b>, <b>Статистика</b>/
            <b>Финансы</b>, <b>Цены и скидки</b>, <b>Аналитика</b>.
          </p>
        </div>

        {/* Текущий статус */}
        {loading ? (
          <div className="h-10 animate-pulse rounded-xl bg-muted/60" />
        ) : wb?.configured ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm">
            <ShieldCheck className="h-4 w-4 shrink-0 text-green-600" />
            <span className="font-medium text-green-700">Токен задан</span>
            <span className="font-mono text-green-700/80">{wb.masked}</span>
            <span className="text-green-700/60">· обновлён {formatDateTime(wb.updated_at)}</span>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Токен не задан — WB-разделы не смогут синхронизироваться.
          </div>
        )}

        {/* Ввод нового токена */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-brand-text">
            {wb?.configured ? 'Заменить токен' : 'Задать токен'}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Вставьте новый WB API токен"
              className="input flex-1 font-mono"
            />
            <button
              onClick={handleSave}
              disabled={saving || !token.trim()}
              className="btn btn-primary flex items-center justify-center gap-2"
            >
              {saving ? 'Сохраняю...' : <><Check className="h-4 w-4" /> Сохранить</>}
            </button>
          </div>
          <p className="text-xs text-brand-text-secondary/70">
            Значение хранится закрыто и не отображается целиком — только маска первых/последних символов.
          </p>
        </div>
      </div>

      {/* ── Ozon ── */}
      <div className="card space-y-4">
        <div>
          <h2 className="text-base font-semibold text-brand-text">Ozon API</h2>
          <p className="mt-1 text-sm text-brand-text-secondary">
            Два набора кредов: <b>Performance API</b> (реклама → синк в «Реклама») и <b>Seller API</b>
            (аналитика/воронка → «Аналитика продаж»). Сохраняются в БД, переживают перезапуски.
            Заполняй только то, что меняешь — пустые поля не затирают сохранённое.
          </p>
        </div>

        {/* Статус */}
        {loading ? (
          <div className="h-10 animate-pulse rounded-xl bg-muted/60" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm ${oz?.perf_configured ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
              {oz?.perf_configured
                ? <><ShieldCheck className="h-4 w-4 shrink-0 text-green-600" /><span className="font-medium text-green-700">Performance задан</span><span className="font-mono text-green-700/80">{oz.perf_client_id_masked}</span></>
                : <span className="text-amber-800">Performance (реклама) не задан</span>}
            </div>
            <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm ${oz?.seller_configured ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
              {oz?.seller_configured
                ? <><ShieldCheck className="h-4 w-4 shrink-0 text-green-600" /><span className="font-medium text-green-700">Seller задан</span><span className="font-mono text-green-700/80">{oz.seller_client_id_masked}</span></>
                : <span className="text-amber-800">Seller (аналитика) не задан</span>}
            </div>
          </div>
        )}

        {/* Ввод */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-brand-text-secondary">Performance · Client ID</label>
            <input type="text" autoComplete="off" value={ozon.perf_client_id}
              onChange={(e) => setOzon((s) => ({ ...s, perf_client_id: e.target.value }))}
              placeholder="client_id" className="input w-full font-mono" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-brand-text-secondary">Performance · Client Secret</label>
            <input type="password" autoComplete="off" value={ozon.perf_client_secret}
              onChange={(e) => setOzon((s) => ({ ...s, perf_client_secret: e.target.value }))}
              placeholder="client_secret" className="input w-full font-mono" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-brand-text-secondary">Seller · Client-Id</label>
            <input type="text" autoComplete="off" value={ozon.seller_client_id}
              onChange={(e) => setOzon((s) => ({ ...s, seller_client_id: e.target.value }))}
              placeholder="Client-Id (номер магазина)" className="input w-full font-mono" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-brand-text-secondary">Seller · Api-Key</label>
            <input type="password" autoComplete="off" value={ozon.seller_api_key}
              onChange={(e) => setOzon((s) => ({ ...s, seller_api_key: e.target.value }))}
              placeholder="Api-Key" className="input w-full font-mono" />
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={handleSaveOzon} disabled={savingOzon}
            className="btn btn-primary flex items-center justify-center gap-2">
            {savingOzon ? 'Сохраняю...' : <><Check className="h-4 w-4" /> Сохранить креды Ozon</>}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Settings
