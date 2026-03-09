import { Fragment, useRef, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Upload, UserCircle } from 'lucide-react'
import { employeesApi, Employee } from '../api/employees'
import { useToast } from '../App'

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:3001'

interface Props {
  employee: Employee | null
  onClose: () => void
}

const EmployeeModal = ({ employee, onClose }: Props) => {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    name: employee?.name ?? '',
    phone: employee?.phone ?? '',
    telegram: employee?.telegram ?? '',
    position: employee?.position ?? '',
    passport_data: employee?.passport_data ?? '',
    hourly_rate: employee?.hourly_rate ?? 0,
    notes: employee?.notes ?? '',
    is_active: employee?.is_active ?? true,
  })
  const [preview, setPreview] = useState<string | null>(
    employee?.photo_url ? `${API_BASE}${employee.photo_url}` : null
  )
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { showToast('Укажите имя сотрудника', 'error'); return }

    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('name', form.name.trim())
      fd.append('phone', form.phone.trim())
      fd.append('telegram', form.telegram.trim())
      fd.append('position', form.position.trim())
      fd.append('passport_data', form.passport_data.trim())
      fd.append('hourly_rate', String(form.hourly_rate))
      fd.append('notes', form.notes.trim())
      fd.append('is_active', String(form.is_active))
      if (photoFile) fd.append('photo', photoFile)

      if (employee) {
        await employeesApi.update(employee.id, fd)
      } else {
        await employeesApi.create(fd)
      }
      onClose()
    } catch (error) {
      console.error('Ошибка сохранения сотрудника:', error)
      showToast('Не удалось сохранить', 'error')
    } finally {
      setSaving(false)
    }
  }

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }))

  return (
    <Transition show={true} as={Fragment}>
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
            <Dialog.Panel className="modal-panel max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {employee ? 'Редактировать сотрудника' : 'Новый сотрудник'}
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Фото */}
                <div className="flex items-center gap-5">
                  <div
                    className="relative h-20 w-20 rounded-full overflow-hidden bg-gray-100 shrink-0 cursor-pointer group"
                    onClick={() => fileRef.current?.click()}
                  >
                    {preview ? (
                      <img src={preview} alt="Фото" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <UserCircle className="h-10 w-10 text-gray-300" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all">
                      <Upload className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    <p className="font-medium text-gray-700">Фото сотрудника</p>
                    <p className="text-xs mt-0.5">Нажмите на аватар для загрузки. JPG, PNG до 5 МБ.</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </div>

                {/* Имя + должность */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Имя *</label>
                    <input
                      type="text"
                      required
                      className="input"
                      placeholder="Иванов Иван"
                      value={form.name}
                      onChange={e => set('name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Должность</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Лаборант"
                      value={form.position}
                      onChange={e => set('position', e.target.value)}
                    />
                  </div>
                </div>

                {/* Телефон + Telegram */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Телефон</label>
                    <input
                      type="tel"
                      className="input"
                      placeholder="+7 (999) 123-45-67"
                      value={form.phone}
                      onChange={e => set('phone', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Telegram</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="@username"
                      value={form.telegram}
                      onChange={e => set('telegram', e.target.value)}
                    />
                  </div>
                </div>

                {/* Стоимость часа */}
                <div className="w-1/2">
                  <label className="label">Стоимость часа, ₽</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="input"
                    placeholder="500"
                    value={form.hourly_rate || ''}
                    onChange={e => set('hourly_rate', e.target.value === '' ? 0 : Number(e.target.value))}
                  />
                </div>

                {/* Паспортные данные */}
                <div>
                  <label className="label">Паспортные данные</label>
                  <textarea
                    className="input font-mono text-sm"
                    rows={2}
                    placeholder="Серия, номер, кем выдан, дата выдачи…"
                    value={form.passport_data}
                    onChange={e => set('passport_data', e.target.value)}
                  />
                  <p className="text-xs text-gray-400 mt-1">Конфиденциальная информация. На карточке скрыта по умолчанию.</p>
                </div>

                {/* Заметки */}
                <div>
                  <label className="label">Заметки</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Дополнительная информация…"
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)}
                  />
                </div>

                {/* Активен */}
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => set('is_active', e.target.checked)}
                    className="rounded text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Активен</span>
                </label>

                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button type="button" onClick={onClose} className="btn btn-secondary" disabled={saving}>
                    Отмена
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Сохранение…' : employee ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
              </form>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}

export default EmployeeModal
