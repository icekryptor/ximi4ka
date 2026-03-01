import { useRef, useState } from 'react'
import { X, Upload, ImageIcon, ExternalLink } from 'lucide-react'
import { Component, componentsApi } from '../api/components'
import { kitsApi } from '../api/kits'
import ComponentPartsEditor from './ComponentPartsEditor'

const CATEGORIES = [
  { value: 'reagent', label: 'Реактив' },
  { value: 'equipment', label: 'Комплектующее' },
  { value: 'print', label: 'Печатная продукция' },
  { value: 'labor', label: 'Работа' },
] as const

interface Props {
  component?: Component | null
  kitId?: string          // если передан — новый компонент добавляется в кит после создания
  onClose: () => void
  onSaved: () => void
}

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:3001'

export default function ComponentModal({ component, kitId, onClose, onSaved }: Props) {
  const isEdit = !!component
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    name: component?.name ?? '',
    sku: component?.sku ?? '',
    category: component?.category ?? ('equipment' as const),
    weight_kg: component?.weight_kg ?? '',
    dimensions: component?.dimensions ?? '',
    link_1688: component?.link_1688 ?? '',
    factory: component?.factory ?? '',
    unit_price: component?.unit_price ?? 0,
    notes: component?.notes ?? '',
    is_active: component?.is_active ?? true,
    is_composite: component?.is_composite ?? false,
  })

  // После создания — сохранённый компонент (для управления составом)
  const [savedComponent, setSavedComponent] = useState<Component | null>(
    isEdit ? component : null
  )

  const [imagePreview, setImagePreview] = useState<string | null>(component?.image_url ?? null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Итоги из состава (только для сложных)
  const [compositePrice, setCompositePrice] = useState(component?.unit_price ?? 0)
  const [compositeWeight, setCompositeWeight] = useState(component?.weight_kg ?? 0)

  const set = (field: string, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }))

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Укажите название'); return }
    setSaving(true)
    setError('')

    const payload = {
      ...form,
      weight_kg: form.weight_kg !== '' ? Number(form.weight_kg) : undefined,
      unit_price: form.is_composite ? compositePrice : Number(form.unit_price),
      quantity_per_kit: 1,
      price_per_kit: form.is_composite ? compositePrice : Number(form.unit_price),
    }

    try {
      let saved: Component
      if (isEdit && savedComponent) {
        saved = await componentsApi.update(savedComponent.id, payload)
      } else {
        saved = await componentsApi.create(payload)
        if (kitId) await kitsApi.addComponent(kitId, saved.id, 1)
      }

      if (imageFile) {
        await componentsApi.uploadImage(saved.id, imageFile)
      }

      // Сложный компонент только что создан — показать редактор состава
      if (!isEdit && form.is_composite) {
        setSavedComponent(saved)
        setSaving(false)
        return  // не закрываем модалку — ждём добавления деталей
      }

      onSaved()
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const imgSrc = imagePreview
    ? imagePreview.startsWith('blob:') ? imagePreview : `${API_BASE}${imagePreview}`
    : null

  // Состояние: базовые поля сохранены, теперь редактируем состав
  const inCompositeEditMode = savedComponent && form.is_composite

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[94vh] flex flex-col">

        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? 'Редактировать компонент' : 'Добавить компонент'}
            </h2>
            {inCompositeEditMode && !isEdit && (
              <p className="text-xs text-gray-400 mt-0.5">
                Компонент создан — добавьте детали в состав
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Переключатель Простой / Сложный */}
          <div className="flex rounded-lg border border-gray-200 p-1 gap-1 bg-gray-50">
            {[
              { value: false, label: 'Простой' },
              { value: true, label: 'Сложный (состоит из деталей)' },
            ].map(opt => (
              <button
                key={String(opt.value)}
                type="button"
                disabled={isEdit && savedComponent?.is_composite !== opt.value && (savedComponent?.parts?.length ?? 0) > 0}
                onClick={() => set('is_composite', opt.value)}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  form.is_composite === opt.value
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Блок отображения авторасчётных значений для сложного компонента */}
          {form.is_composite && savedComponent && (
            <div className="flex gap-4 text-sm bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Цена (из состава)</div>
                <div className="font-semibold text-gray-900">
                  {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(compositePrice)}
                </div>
              </div>
              {compositeWeight > 0 && (
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Вес (из состава)</div>
                  <div className="font-semibold text-gray-900">{compositeWeight.toFixed(3)} кг</div>
                </div>
              )}
            </div>
          )}

          {/* Фото */}
          <div>
            <label className="label">Фото</label>
            <div
              className="border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-colors py-4"
              onClick={() => fileRef.current?.click()}
            >
              {imgSrc ? (
                <img src={imgSrc} alt="preview" className="h-28 w-28 object-contain rounded" />
              ) : (
                <div className="flex flex-col items-center text-gray-400">
                  <ImageIcon className="h-10 w-10 mb-1" />
                  <span className="text-sm">Нажмите для загрузки</span>
                </div>
              )}
              <span className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <Upload className="h-3 w-3" /> JPG, PNG, WEBP до 5 МБ
              </span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>

          {/* Название + Артикул */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Название *</label>
              <input
                className="input"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Например: Пробирки"
              />
            </div>
            <div>
              <label className="label">Артикул</label>
              <input
                className="input"
                value={form.sku}
                onChange={e => set('sku', e.target.value)}
                placeholder="SKU-001"
              />
            </div>
          </div>

          {/* Категория */}
          <div>
            <label className="label">Категория *</label>
            <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Вес + Размеры */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                Вес, кг
                {form.is_composite && savedComponent && (
                  <span className="text-gray-400 font-normal ml-1">(авто)</span>
                )}
              </label>
              <input
                className="input"
                type="number"
                step="0.001"
                min="0"
                value={form.is_composite && savedComponent ? compositeWeight.toFixed(3) : form.weight_kg}
                readOnly={form.is_composite && !!savedComponent}
                onChange={e => set('weight_kg', e.target.value)}
                placeholder="0.050"
              />
            </div>
            <div>
              <label className="label">Размеры (Д×Ш×В)</label>
              <input
                className="input"
                value={form.dimensions}
                onChange={e => set('dimensions', e.target.value)}
                placeholder="10×5×3 см"
              />
            </div>
          </div>

          {/* Фабрика */}
          <div>
            <label className="label">Фабрика / поставщик</label>
            <input
              className="input"
              value={form.factory}
              onChange={e => set('factory', e.target.value)}
              placeholder="Название фабрики или поставщика"
            />
          </div>

          {/* Ссылка 1688 */}
          <div>
            <label className="label flex items-center gap-1">
              Ссылка на 1688
              {form.link_1688 && (
                <a
                  href={form.link_1688}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-primary-500 hover:text-primary-700 ml-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </label>
            <input
              className="input"
              type="url"
              value={form.link_1688}
              onChange={e => set('link_1688', e.target.value)}
              placeholder="https://detail.1688.com/..."
            />
          </div>

          {/* Цена — только для простых */}
          {!form.is_composite && (
            <div>
              <label className="label">Цена за единицу, ₽</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={form.unit_price}
                onChange={e => set('unit_price', e.target.value)}
                placeholder="0.00"
              />
            </div>
          )}

          {/* Примечания */}
          <div>
            <label className="label">Примечания</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            <span className="text-sm text-gray-700">Активен</span>
          </label>

          {/* Секция состава — только для сложного, только после сохранения */}
          {form.is_composite && savedComponent && (
            <div className="border border-gray-200 rounded-lg p-4">
              <ComponentPartsEditor
                compositeId={savedComponent.id}
                onTotalsChange={(price, weight) => {
                  setCompositePrice(price)
                  setCompositeWeight(weight)
                }}
              />
            </div>
          )}

          {form.is_composite && !savedComponent && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
              Сначала сохраните компонент, затем добавьте детали в состав.
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Кнопки */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            {inCompositeEditMode && !isEdit ? 'Готово' : 'Отмена'}
          </button>
          {(!inCompositeEditMode || isEdit) && (
            <button onClick={handleSubmit} className="btn btn-primary" disabled={saving}>
              {saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Добавить'}
            </button>
          )}
          {inCompositeEditMode && !isEdit && (
            <button onClick={handleSubmit} className="btn btn-secondary" disabled={saving}>
              {saving ? 'Сохранение…' : 'Обновить данные'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
