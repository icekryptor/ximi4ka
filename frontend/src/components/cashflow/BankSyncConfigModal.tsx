import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Save } from 'lucide-react'
import { bankSyncApi } from '../../api/bankSync'
import { useToast } from '../../contexts/ToastContext'

interface Props {
  bankAccountId: string
  bankAccountName: string
  /** If editing existing — pass id; otherwise creates new */
  configId?: string
  onClose: () => void
  onSaved: () => void
}

export function BankSyncConfigModal({ bankAccountId, bankAccountName, configId, onClose, onSaved }: Props) {
  const toast = useToast()
  const [token, setToken] = useState('')
  const [clientId, setClientId] = useState('')
  const [customerCode, setCustomerCode] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!token.trim() || !clientId.trim()) {
      toast.error('Заполни Token и Client_ID')
      return
    }
    setSaving(true)
    try {
      const credentials = {
        token: token.trim(),
        client_id: clientId.trim(),
        ...(customerCode.trim() && { customer_code: customerCode.trim() }),
      }
      if (configId) {
        await bankSyncApi.updateConfig(configId, { credentials })
        toast.success('Креды обновлены')
      } else {
        await bankSyncApi.createConfig({
          bank_account_id: bankAccountId,
          provider: 'tochka',
          credentials,
          run_initial_sync: true,
        })
        toast.success('Подключено — синхронизация запущена в фоне')
      }
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-lg shadow-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-brand-border">
          <h2 className="text-xl font-semibold text-brand-text">
            Точка API — {bankAccountName}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg" aria-label="Закрыть">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Token (JWT)</label>
            <textarea
              autoFocus
              className="input font-mono text-xs"
              rows={4}
              placeholder="eyJhbGciOiJSUzI1NiIs..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Client_ID</label>
            <input
              type="text"
              className="input"
              placeholder="6d90284ab1375a352f2d1fa6..."
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Customer Code (опционально)</label>
            <input
              type="text"
              className="input"
              placeholder="Если у тебя несколько customer-кодов — укажи нужный. Иначе оставь пустым."
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value)}
            />
          </div>
          <p className="text-xs text-brand-text-secondary">
            Креды шифруются AES-256-GCM перед сохранением в БД. После сохранения запустится синхронизация за последние 30 дней.
          </p>
        </div>
        <div className="flex justify-end gap-2 p-6 border-t border-brand-border">
          <button onClick={onClose} className="btn btn-secondary" disabled={saving}>
            Отмена
          </button>
          <button onClick={handleSave} className="btn btn-primary flex items-center gap-2" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'Сохранение…' : 'Сохранить и синхронизировать'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
