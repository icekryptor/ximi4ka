import { useEffect, useState } from 'react'
import { Landmark, RefreshCw, Settings, CheckCircle2, AlertTriangle } from 'lucide-react'
import { bankSyncApi, BankSyncConfig } from '../../api/bankSync'
import { useToast } from '../../contexts/ToastContext'
import { BankSyncConfigModal } from './BankSyncConfigModal'

interface BankAccount {
  id: string
  name: string
}

interface Props {
  bankAccounts: BankAccount[]
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function BankSyncSection({ bankAccounts }: Props) {
  const toast = useToast()
  const [configs, setConfigs] = useState<BankSyncConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ accountId: string; accountName: string; configId?: string } | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await bankSyncApi.listConfigs()
      setConfigs(r)
    } catch {
      toast.error('Не удалось загрузить конфиги синхронизации')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleRun = async (configId: string) => {
    setRunningId(configId)
    try {
      const r = await bankSyncApi.run(configId)
      toast.success(`Готово: ${r.log.rows_imported} новых, ${r.log.rows_skipped_dup} дубликатов`)
      await load()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Ошибка синхронизации')
    } finally {
      setRunningId(null)
    }
  }

  if (loading) {
    return (
      <section className="card mb-6">
        <div className="h-6 bg-muted rounded w-1/4 mb-3 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="card mb-6">
        <h2 className="text-2xl font-semibold text-brand-text flex items-center gap-2 mb-1">
          <Landmark className="h-6 w-6 text-primary-600" /> Источники данных
        </h2>
        <p className="text-brand-text-secondary text-sm mb-4">
          Автоматическая синхронизация транзакций из банков. Точка — через JWT API. Озон-расчётник — пока вручную (Phase 2).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {bankAccounts.map((account) => {
            const config = configs.find((c) => c.bank_account_id === account.id && c.provider === 'tochka')
            const isOk = config?.enabled && config.last_sync_at
            return (
              <div key={account.id} className="rounded-2xl border border-brand-border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-brand-text">🏦 {account.name}</h3>
                    <p className="text-xs text-brand-text-secondary">Точка API</p>
                  </div>
                  {config ? (
                    isOk ? (
                      <span className="flex items-center gap-1 text-xs text-green-700">
                        <CheckCircle2 size={12} /> синк ОК
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-700">
                        <AlertTriangle size={12} /> не синкан
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-brand-text-secondary">не настроено</span>
                  )}
                </div>
                {config && (
                  <p className="text-xs text-brand-text-secondary mb-3">
                    Последний sync: {formatDate(config.last_sync_at)}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing({ accountId: account.id, accountName: account.name, configId: config?.id })}
                    className="text-xs px-2 py-1 rounded-lg border border-brand-border hover:bg-subtle flex items-center gap-1"
                  >
                    <Settings size={12} /> {config ? 'Изменить' : 'Подключить'}
                  </button>
                  {config && (
                    <button
                      onClick={() => handleRun(config.id)}
                      disabled={runningId === config.id}
                      className="text-xs px-2 py-1 rounded-lg border border-primary-300 text-primary-700 hover:bg-primary-50 flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={runningId === config.id ? 'animate-spin' : ''} />
                      Синк сейчас
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {editing && (
        <BankSyncConfigModal
          bankAccountId={editing.accountId}
          bankAccountName={editing.accountName}
          configId={editing.configId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void load()
          }}
        />
      )}
    </>
  )
}
