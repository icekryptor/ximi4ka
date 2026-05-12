import { useEffect, useState, FormEvent, Fragment } from 'react'
import axios from 'axios'
import { Plus, Edit2, Trash2, Check, X, Save, FileText, Users, Tag, Wallet } from 'lucide-react'
import { brandDocsApi } from '../api/brandDocs'
import { icpSegmentsApi } from '../api/icpSegments'
import { strategicThemesApi } from '../api/strategicThemes'
import { channelBudgetsApi } from '../api/channelBudgets'
import { publishChannelsApi } from '../api/publishChannels'
import {
  BrandDoc,
  IcpSegment,
  StrategicTheme,
  ChannelBudget,
  PublishChannel,
} from '../api/types'
import { useToast } from '../contexts/ToastContext'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'

const STRATEGY_SLUG = 'strategy_current'
const STRATEGY_TITLE = 'Маркетинг-стратегия'

const rubFormatter = new Intl.NumberFormat('ru-RU')

const truncate = (s: string | null | undefined, n = 80) => {
  if (!s) return ''
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s
}

const errorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error) && typeof error.response?.data?.error === 'string') {
    return error.response.data.error
  }
  return fallback
}

// ─── Section 1: Strategy doc ─────────────────────────────────────────────────

interface StrategyDocSectionProps {
  doc: BrandDoc | null
  content: string
  onContentChange: (v: string) => void
  onSave: () => Promise<void>
  saving: boolean
}

const StrategyDocSection = ({ doc, content, onContentChange, onSave, saving }: StrategyDocSectionProps) => {
  return (
    <section className="card mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-semibold text-brand-text flex items-center space-x-2">
            <FileText className="h-6 w-6 text-primary-600" />
            <span>Стратегический документ</span>
          </h2>
          <p className="text-brand-text-secondary mt-1">
            Стратегический документ в markdown. Используется AI-промптами при генерации контента.
          </p>
          {doc?.updated_at && (
            <p className="text-xs text-brand-text-secondary/70 mt-1">
              Обновлён: {new Date(doc.updated_at).toLocaleString('ru-RU')}
              {doc.version ? ` · версия ${doc.version}` : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Сохранение…' : 'Сохранить'}</span>
        </button>
      </div>
      <textarea
        className="w-full min-h-[24rem] p-4 border border-brand-border rounded-2xl font-mono text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/40"
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="# Маркетинг-стратегия&#10;&#10;## Позиционирование&#10;..."
        spellCheck={false}
      />
    </section>
  )
}

// ─── Section 2: ICP segments ─────────────────────────────────────────────────

interface SegmentsSectionProps {
  segments: IcpSegment[]
  newSegment: Partial<IcpSegment>
  setNewSegment: (s: Partial<IcpSegment>) => void
  onCreate: (e: FormEvent) => Promise<void>
  editingId: string | null
  setEditingId: (id: string | null) => void
  editForm: Partial<IcpSegment>
  setEditForm: (s: Partial<IcpSegment>) => void
  onUpdate: (e: FormEvent) => Promise<void>
  onDelete: (s: IcpSegment) => Promise<void>
  submitting: boolean
}

const SegmentsSection = ({
  segments,
  newSegment,
  setNewSegment,
  onCreate,
  editingId,
  setEditingId,
  editForm,
  setEditForm,
  onUpdate,
  onDelete,
  submitting,
}: SegmentsSectionProps) => {
  return (
    <section className="card mb-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-brand-text flex items-center space-x-2">
          <Users className="h-6 w-6 text-primary-600" />
          <span>ICP-сегменты</span>
        </h2>
        <p className="text-brand-text-secondary mt-1">
          Целевые аудитории, к которым относятся контент-юниты и рекламные кампании.
        </p>
      </div>

      <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
        <input
          type="text"
          className="input"
          placeholder="slug"
          value={newSegment.slug ?? ''}
          onChange={(e) => setNewSegment({ ...newSegment, slug: e.target.value })}
          required
        />
        <input
          type="text"
          className="input"
          placeholder="Название"
          value={newSegment.name ?? ''}
          onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })}
          required
        />
        <input
          type="text"
          className="input"
          placeholder="Возраст (например 8-12)"
          value={newSegment.age_range ?? ''}
          onChange={(e) => setNewSegment({ ...newSegment, age_range: e.target.value })}
        />
        <input
          type="text"
          className="input"
          placeholder="Роль (родитель/ребёнок/педагог)"
          value={newSegment.role ?? ''}
          onChange={(e) => setNewSegment({ ...newSegment, role: e.target.value })}
        />
        <button type="submit" className="btn btn-primary flex items-center justify-center space-x-2" disabled={submitting}>
          <Plus className="h-4 w-4" />
          <span>Добавить</span>
        </button>
      </form>

      {segments.length === 0 ? (
        <div className="text-center py-8 text-brand-text-secondary">Сегменты не настроены</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-left text-brand-text-secondary">
                <th className="px-3 py-2 font-medium">Slug</th>
                <th className="px-3 py-2 font-medium">Название</th>
                <th className="px-3 py-2 font-medium">Описание</th>
                <th className="px-3 py-2 font-medium">Возраст</th>
                <th className="px-3 py-2 font-medium">Роль</th>
                <th className="px-3 py-2 font-medium text-center">Активен</th>
                <th className="px-3 py-2 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((s) => (
                <Fragment key={s.id}>
                  <tr className="border-b border-brand-border last:border-b-0 hover:bg-muted/40">
                    <td className="px-3 py-2 font-mono text-xs">{s.slug}</td>
                    <td className="px-3 py-2 text-brand-text">{s.name}</td>
                    <td className="px-3 py-2 text-brand-text-secondary" title={s.description ?? ''}>
                      {truncate(s.description) || <span className="text-brand-text-secondary/60">—</span>}
                    </td>
                    <td className="px-3 py-2 text-brand-text-secondary">{s.age_range || <span className="text-brand-text-secondary/60">—</span>}</td>
                    <td className="px-3 py-2 text-brand-text-secondary">{s.role || <span className="text-brand-text-secondary/60">—</span>}</td>
                    <td className="px-3 py-2 text-center">
                      {s.active ? <Check className="h-4 w-4 text-green-600 inline" /> : <X className="h-4 w-4 text-brand-text-secondary/60 inline" />}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end space-x-1">
                        <button
                          onClick={() => {
                            if (editingId === s.id) {
                              setEditingId(null)
                            } else {
                              setEditForm({
                                slug: s.slug,
                                name: s.name,
                                description: s.description,
                                age_range: s.age_range,
                                role: s.role,
                                active: s.active,
                              })
                              setEditingId(s.id)
                            }
                          }}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          aria-label="Редактировать"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(s)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingId === s.id && (
                    <tr className="bg-primary-50/30 border-b border-brand-border">
                      <td colSpan={7} className="px-3 py-4">
                        <form onSubmit={onUpdate} className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input
                              type="text"
                              className="input"
                              placeholder="slug"
                              value={editForm.slug ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                              required
                            />
                            <input
                              type="text"
                              className="input"
                              placeholder="Название"
                              value={editForm.name ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              required
                            />
                            <input
                              type="text"
                              className="input"
                              placeholder="Возраст"
                              value={editForm.age_range ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, age_range: e.target.value })}
                            />
                            <input
                              type="text"
                              className="input"
                              placeholder="Роль"
                              value={editForm.role ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                            />
                          </div>
                          <textarea
                            className="input min-h-[6rem]"
                            placeholder="Описание сегмента"
                            value={editForm.description ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          />
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editForm.active ?? true}
                              onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                              className="h-4 w-4 rounded border-brand-border text-primary-600 focus:ring-primary-400/50"
                            />
                            <span className="text-sm text-brand-text">Активен</span>
                          </label>
                          <div className="flex justify-end space-x-2">
                            <button type="button" onClick={() => setEditingId(null)} className="btn btn-secondary" disabled={submitting}>
                              Отмена
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                              {submitting ? 'Сохранение…' : 'Сохранить'}
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ─── Section 3: Strategic themes ─────────────────────────────────────────────

interface ThemesSectionProps {
  themes: StrategicTheme[]
  newTheme: Partial<StrategicTheme>
  setNewTheme: (t: Partial<StrategicTheme>) => void
  onCreate: (e: FormEvent) => Promise<void>
  editingId: string | null
  setEditingId: (id: string | null) => void
  editForm: Partial<StrategicTheme>
  setEditForm: (t: Partial<StrategicTheme>) => void
  onUpdate: (e: FormEvent) => Promise<void>
  onDelete: (t: StrategicTheme) => Promise<void>
  submitting: boolean
}

const ThemesSection = ({
  themes,
  newTheme,
  setNewTheme,
  onCreate,
  editingId,
  setEditingId,
  editForm,
  setEditForm,
  onUpdate,
  onDelete,
  submitting,
}: ThemesSectionProps) => {
  return (
    <section className="card mb-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-brand-text flex items-center space-x-2">
          <Tag className="h-6 w-6 text-primary-600" />
          <span>Стратегические темы</span>
        </h2>
        <p className="text-brand-text-secondary mt-1">
          Тематические фокусы на квартал/период. Контент тегается темой для аналитики.
        </p>
      </div>

      <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
        <input
          type="text"
          className="input"
          placeholder="slug"
          value={newTheme.slug ?? ''}
          onChange={(e) => setNewTheme({ ...newTheme, slug: e.target.value })}
          required
        />
        <input
          type="text"
          className="input"
          placeholder="Название темы"
          value={newTheme.name ?? ''}
          onChange={(e) => setNewTheme({ ...newTheme, name: e.target.value })}
          required
        />
        <input
          type="date"
          className="input"
          value={newTheme.active_from ?? ''}
          onChange={(e) => setNewTheme({ ...newTheme, active_from: e.target.value })}
        />
        <input
          type="date"
          className="input"
          value={newTheme.active_to ?? ''}
          onChange={(e) => setNewTheme({ ...newTheme, active_to: e.target.value })}
        />
        <button type="submit" className="btn btn-primary flex items-center justify-center space-x-2" disabled={submitting}>
          <Plus className="h-4 w-4" />
          <span>Добавить</span>
        </button>
      </form>

      {themes.length === 0 ? (
        <div className="text-center py-8 text-brand-text-secondary">Темы не настроены</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-left text-brand-text-secondary">
                <th className="px-3 py-2 font-medium">Slug</th>
                <th className="px-3 py-2 font-medium">Название</th>
                <th className="px-3 py-2 font-medium">Описание</th>
                <th className="px-3 py-2 font-medium">С</th>
                <th className="px-3 py-2 font-medium">По</th>
                <th className="px-3 py-2 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {themes.map((t) => (
                <Fragment key={t.id}>
                  <tr className="border-b border-brand-border last:border-b-0 hover:bg-muted/40">
                    <td className="px-3 py-2 font-mono text-xs">{t.slug}</td>
                    <td className="px-3 py-2 text-brand-text">{t.name}</td>
                    <td className="px-3 py-2 text-brand-text-secondary" title={t.description ?? ''}>
                      {truncate(t.description) || <span className="text-brand-text-secondary/60">—</span>}
                    </td>
                    <td className="px-3 py-2 text-brand-text-secondary">{t.active_from || <span className="text-brand-text-secondary/60">—</span>}</td>
                    <td className="px-3 py-2 text-brand-text-secondary">{t.active_to || <span className="text-brand-text-secondary/60">—</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end space-x-1">
                        <button
                          onClick={() => {
                            if (editingId === t.id) {
                              setEditingId(null)
                            } else {
                              setEditForm({
                                slug: t.slug,
                                name: t.name,
                                description: t.description,
                                active_from: t.active_from,
                                active_to: t.active_to,
                              })
                              setEditingId(t.id)
                            }
                          }}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          aria-label="Редактировать"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(t)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingId === t.id && (
                    <tr className="bg-primary-50/30 border-b border-brand-border">
                      <td colSpan={6} className="px-3 py-4">
                        <form onSubmit={onUpdate} className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input
                              type="text"
                              className="input"
                              placeholder="slug"
                              value={editForm.slug ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                              required
                            />
                            <input
                              type="text"
                              className="input"
                              placeholder="Название"
                              value={editForm.name ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              required
                            />
                            <input
                              type="date"
                              className="input"
                              value={editForm.active_from ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, active_from: e.target.value })}
                            />
                            <input
                              type="date"
                              className="input"
                              value={editForm.active_to ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, active_to: e.target.value })}
                            />
                          </div>
                          <textarea
                            className="input min-h-[6rem]"
                            placeholder="Описание темы"
                            value={editForm.description ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          />
                          <div className="flex justify-end space-x-2">
                            <button type="button" onClick={() => setEditingId(null)} className="btn btn-secondary" disabled={submitting}>
                              Отмена
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                              {submitting ? 'Сохранение…' : 'Сохранить'}
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ─── Section 4: Channel budgets ─────────────────────────────────────────────

interface BudgetsSectionProps {
  channels: PublishChannel[]
  budgets: ChannelBudget[]
  newBudget: Partial<ChannelBudget>
  setNewBudget: (b: Partial<ChannelBudget>) => void
  onCreate: (e: FormEvent) => Promise<void>
  editingId: string | null
  setEditingId: (id: string | null) => void
  editForm: Partial<ChannelBudget>
  setEditForm: (b: Partial<ChannelBudget>) => void
  onUpdate: (e: FormEvent) => Promise<void>
  onDelete: (b: ChannelBudget) => Promise<void>
  submitting: boolean
}

const BudgetsSection = ({
  channels,
  budgets,
  newBudget,
  setNewBudget,
  onCreate,
  editingId,
  setEditingId,
  editForm,
  setEditForm,
  onUpdate,
  onDelete,
  submitting,
}: BudgetsSectionProps) => {
  const channelById = (id: string | undefined): PublishChannel | undefined =>
    id ? channels.find((c) => c.id === id) : undefined

  return (
    <section className="card mb-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-brand-text flex items-center space-x-2">
          <Wallet className="h-6 w-6 text-primary-600" />
          <span>Бюджеты каналов</span>
        </h2>
        <p className="text-brand-text-secondary mt-1">
          Плановые бюджеты на платную рекламу по каналам. Сверяется с фактом расходов в PPC-модуле и аналитике.
        </p>
      </div>

      <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
        <select
          className="input"
          value={newBudget.channel_id ?? ''}
          onChange={(e) => setNewBudget({ ...newBudget, channel_id: e.target.value })}
          required
        >
          <option value="">— Канал —</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="input"
          value={newBudget.period_start ?? ''}
          onChange={(e) => setNewBudget({ ...newBudget, period_start: e.target.value })}
          required
        />
        <input
          type="date"
          className="input"
          value={newBudget.period_end ?? ''}
          onChange={(e) => setNewBudget({ ...newBudget, period_end: e.target.value })}
          required
        />
        <input
          type="number"
          step="0.01"
          min="0"
          className="input"
          placeholder="Бюджет, ₽"
          value={newBudget.amount_rub ?? ''}
          onChange={(e) => setNewBudget({ ...newBudget, amount_rub: e.target.value })}
          required
        />
        <button type="submit" className="btn btn-primary flex items-center justify-center space-x-2" disabled={submitting}>
          <Plus className="h-4 w-4" />
          <span>Добавить</span>
        </button>
      </form>

      {budgets.length === 0 ? (
        <div className="text-center py-8 text-brand-text-secondary">Бюджеты не настроены</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-left text-brand-text-secondary">
                <th className="px-3 py-2 font-medium">Канал</th>
                <th className="px-3 py-2 font-medium">С</th>
                <th className="px-3 py-2 font-medium">По</th>
                <th className="px-3 py-2 font-medium text-right">Бюджет</th>
                <th className="px-3 py-2 font-medium">Заметки</th>
                <th className="px-3 py-2 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => {
                const channel = b.channel ?? channelById(b.channel_id)
                return (
                  <Fragment key={b.id}>
                    <tr className="border-b border-brand-border last:border-b-0 hover:bg-muted/40">
                      <td className="px-3 py-2 text-brand-text">
                        {channel?.display_name ?? <span className="text-brand-text-secondary/60">— канал не найден —</span>}
                      </td>
                      <td className="px-3 py-2 text-brand-text-secondary">{b.period_start}</td>
                      <td className="px-3 py-2 text-brand-text-secondary">{b.period_end}</td>
                      <td className="px-3 py-2 text-brand-text text-right font-medium tabular-nums">
                        {rubFormatter.format(parseFloat(b.amount_rub))} ₽
                      </td>
                      <td className="px-3 py-2 text-brand-text-secondary" title={b.notes ?? ''}>
                        {truncate(b.notes, 60) || <span className="text-brand-text-secondary/60">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end space-x-1">
                          <button
                            onClick={() => {
                              if (editingId === b.id) {
                                setEditingId(null)
                              } else {
                                setEditForm({
                                  channel_id: b.channel_id,
                                  period_start: b.period_start,
                                  period_end: b.period_end,
                                  amount_rub: b.amount_rub,
                                  notes: b.notes,
                                })
                                setEditingId(b.id)
                              }
                            }}
                            className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            aria-label="Редактировать"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onDelete(b)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            aria-label="Удалить"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === b.id && (
                      <tr className="bg-primary-50/30 border-b border-brand-border">
                        <td colSpan={6} className="px-3 py-4">
                          <form onSubmit={onUpdate} className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                              <select
                                className="input"
                                value={editForm.channel_id ?? ''}
                                onChange={(e) => setEditForm({ ...editForm, channel_id: e.target.value })}
                                required
                              >
                                <option value="">— Канал —</option>
                                {channels.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.display_name}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="date"
                                className="input"
                                value={editForm.period_start ?? ''}
                                onChange={(e) => setEditForm({ ...editForm, period_start: e.target.value })}
                                required
                              />
                              <input
                                type="date"
                                className="input"
                                value={editForm.period_end ?? ''}
                                onChange={(e) => setEditForm({ ...editForm, period_end: e.target.value })}
                                required
                              />
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="input"
                                placeholder="Бюджет, ₽"
                                value={editForm.amount_rub ?? ''}
                                onChange={(e) => setEditForm({ ...editForm, amount_rub: e.target.value })}
                                required
                              />
                            </div>
                            <textarea
                              className="input min-h-[5rem]"
                              placeholder="Заметки"
                              value={editForm.notes ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                            />
                            <div className="flex justify-end space-x-2">
                              <button type="button" onClick={() => setEditingId(null)} className="btn btn-secondary" disabled={submitting}>
                                Отмена
                              </button>
                              <button type="submit" className="btn btn-primary" disabled={submitting}>
                                {submitting ? 'Сохранение…' : 'Сохранить'}
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

const MarketingStrategy = () => {
  const toast = useToast()
  const { confirm } = useConfirmDialog()

  const [strategyDoc, setStrategyDoc] = useState<BrandDoc | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [savingDoc, setSavingDoc] = useState(false)

  const [segments, setSegments] = useState<IcpSegment[]>([])
  const [newSegment, setNewSegment] = useState<Partial<IcpSegment>>({})
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
  const [editingSegmentForm, setEditingSegmentForm] = useState<Partial<IcpSegment>>({})

  const [themes, setThemes] = useState<StrategicTheme[]>([])
  const [newTheme, setNewTheme] = useState<Partial<StrategicTheme>>({})
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null)
  const [editingThemeForm, setEditingThemeForm] = useState<Partial<StrategicTheme>>({})

  const [channels, setChannels] = useState<PublishChannel[]>([])
  const [budgets, setBudgets] = useState<ChannelBudget[]>([])
  const [newBudget, setNewBudget] = useState<Partial<ChannelBudget>>({})
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null)
  const [editingBudgetForm, setEditingBudgetForm] = useState<Partial<ChannelBudget>>({})

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void loadAll()
  }, [])

  const loadAll = async () => {
    try {
      setLoading(true)
      const [doc, segs, ths, buds, chs] = await Promise.all([
        brandDocsApi.get(STRATEGY_SLUG),
        icpSegmentsApi.getAll(),
        strategicThemesApi.getAll(),
        channelBudgetsApi.getAll(),
        publishChannelsApi.getAll(),
      ])
      setStrategyDoc(doc)
      setEditingContent(doc?.content ?? '')
      setSegments(segs)
      setThemes(ths)
      setBudgets(buds)
      setChannels(chs)
    } catch (error) {
      console.error('Ошибка загрузки маркетинг-стратегии:', error)
      toast.error('Не удалось загрузить данные маркетинг-стратегии')
    } finally {
      setLoading(false)
    }
  }

  // ─── Strategy doc save ───
  const handleSaveStrategy = async () => {
    try {
      setSavingDoc(true)
      const updated = await brandDocsApi.upsert(STRATEGY_SLUG, {
        title: STRATEGY_TITLE,
        content: editingContent,
      })
      setStrategyDoc(updated)
      toast.success('Стратегический документ сохранён')
    } catch (error) {
      console.error('Ошибка сохранения стратегии:', error)
      toast.error(errorMessage(error, 'Не удалось сохранить стратегический документ'))
    } finally {
      setSavingDoc(false)
    }
  }

  // ─── Segments handlers ───
  const handleCreateSegment = async (e: FormEvent) => {
    e.preventDefault()
    if (!newSegment.slug?.trim() || !newSegment.name?.trim()) {
      toast.error('Заполните slug и название сегмента')
      return
    }
    try {
      setSubmitting(true)
      const payload: Partial<IcpSegment> = {
        slug: newSegment.slug.trim(),
        name: newSegment.name.trim(),
        age_range: newSegment.age_range?.trim() ? newSegment.age_range.trim() : null,
        role: newSegment.role?.trim() ? newSegment.role.trim() : null,
        active: true,
      }
      const created = await icpSegmentsApi.create(payload)
      setSegments((prev) => [...prev, created])
      setNewSegment({})
      toast.success('Сегмент создан')
    } catch (error) {
      console.error('Ошибка создания сегмента:', error)
      toast.error(errorMessage(error, 'Не удалось создать сегмент'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateSegment = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingSegmentId) return
    if (!editingSegmentForm.slug?.toString().trim() || !editingSegmentForm.name?.toString().trim()) {
      toast.error('Заполните slug и название')
      return
    }
    try {
      setSubmitting(true)
      const payload: Partial<IcpSegment> = {
        slug: editingSegmentForm.slug!.toString().trim(),
        name: editingSegmentForm.name!.toString().trim(),
        description: editingSegmentForm.description?.toString().trim()
          ? editingSegmentForm.description!.toString().trim()
          : null,
        age_range: editingSegmentForm.age_range?.toString().trim()
          ? editingSegmentForm.age_range!.toString().trim()
          : null,
        role: editingSegmentForm.role?.toString().trim() ? editingSegmentForm.role!.toString().trim() : null,
        active: editingSegmentForm.active ?? true,
      }
      const updated = await icpSegmentsApi.update(editingSegmentId, payload)
      setSegments((prev) => prev.map((s) => (s.id === editingSegmentId ? updated : s)))
      setEditingSegmentId(null)
      setEditingSegmentForm({})
      toast.success('Сегмент обновлён')
    } catch (error) {
      console.error('Ошибка обновления сегмента:', error)
      toast.error(errorMessage(error, 'Не удалось обновить сегмент'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSegment = async (s: IcpSegment) => {
    const ok = await confirm({
      title: 'Удалить сегмент?',
      message: 'Удалить сегмент? Это нельзя отменить.',
      confirmText: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await icpSegmentsApi.delete(s.id)
      setSegments((prev) => prev.filter((x) => x.id !== s.id))
      if (editingSegmentId === s.id) setEditingSegmentId(null)
      toast.success('Сегмент удалён')
    } catch (error) {
      console.error('Ошибка удаления сегмента:', error)
      toast.error(errorMessage(error, 'Не удалось удалить сегмент'))
    }
  }

  // ─── Themes handlers ───
  const handleCreateTheme = async (e: FormEvent) => {
    e.preventDefault()
    if (!newTheme.slug?.trim() || !newTheme.name?.trim()) {
      toast.error('Заполните slug и название темы')
      return
    }
    try {
      setSubmitting(true)
      const payload: Partial<StrategicTheme> = {
        slug: newTheme.slug.trim(),
        name: newTheme.name.trim(),
        active_from: newTheme.active_from?.trim() ? newTheme.active_from.trim() : null,
        active_to: newTheme.active_to?.trim() ? newTheme.active_to.trim() : null,
      }
      const created = await strategicThemesApi.create(payload)
      setThemes((prev) => [...prev, created])
      setNewTheme({})
      toast.success('Тема создана')
    } catch (error) {
      console.error('Ошибка создания темы:', error)
      toast.error(errorMessage(error, 'Не удалось создать тему'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateTheme = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingThemeId) return
    if (!editingThemeForm.slug?.toString().trim() || !editingThemeForm.name?.toString().trim()) {
      toast.error('Заполните slug и название')
      return
    }
    try {
      setSubmitting(true)
      const payload: Partial<StrategicTheme> = {
        slug: editingThemeForm.slug!.toString().trim(),
        name: editingThemeForm.name!.toString().trim(),
        description: editingThemeForm.description?.toString().trim()
          ? editingThemeForm.description!.toString().trim()
          : null,
        active_from: editingThemeForm.active_from?.toString().trim()
          ? editingThemeForm.active_from!.toString().trim()
          : null,
        active_to: editingThemeForm.active_to?.toString().trim()
          ? editingThemeForm.active_to!.toString().trim()
          : null,
      }
      const updated = await strategicThemesApi.update(editingThemeId, payload)
      setThemes((prev) => prev.map((t) => (t.id === editingThemeId ? updated : t)))
      setEditingThemeId(null)
      setEditingThemeForm({})
      toast.success('Тема обновлена')
    } catch (error) {
      console.error('Ошибка обновления темы:', error)
      toast.error(errorMessage(error, 'Не удалось обновить тему'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteTheme = async (t: StrategicTheme) => {
    const ok = await confirm({
      title: 'Удалить тему?',
      message: 'Удалить тему? Это нельзя отменить.',
      confirmText: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await strategicThemesApi.delete(t.id)
      setThemes((prev) => prev.filter((x) => x.id !== t.id))
      if (editingThemeId === t.id) setEditingThemeId(null)
      toast.success('Тема удалена')
    } catch (error) {
      console.error('Ошибка удаления темы:', error)
      toast.error(errorMessage(error, 'Не удалось удалить тему'))
    }
  }

  // ─── Budgets handlers ───
  const handleCreateBudget = async (e: FormEvent) => {
    e.preventDefault()
    if (!newBudget.channel_id || !newBudget.period_start || !newBudget.period_end || !newBudget.amount_rub) {
      toast.error('Заполните все обязательные поля бюджета')
      return
    }
    try {
      setSubmitting(true)
      const payload: Partial<ChannelBudget> = {
        channel_id: newBudget.channel_id,
        period_start: newBudget.period_start.toString(),
        period_end: newBudget.period_end.toString(),
        amount_rub: newBudget.amount_rub.toString(),
        notes: newBudget.notes?.toString().trim() ? newBudget.notes!.toString().trim() : null,
      }
      const created = await channelBudgetsApi.create(payload)
      setBudgets((prev) => [...prev, created])
      setNewBudget({})
      toast.success('Бюджет создан')
    } catch (error) {
      console.error('Ошибка создания бюджета:', error)
      toast.error(errorMessage(error, 'Не удалось создать бюджет'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateBudget = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingBudgetId) return
    if (
      !editingBudgetForm.channel_id ||
      !editingBudgetForm.period_start ||
      !editingBudgetForm.period_end ||
      editingBudgetForm.amount_rub === undefined ||
      editingBudgetForm.amount_rub === null ||
      editingBudgetForm.amount_rub === ''
    ) {
      toast.error('Заполните все обязательные поля бюджета')
      return
    }
    try {
      setSubmitting(true)
      const payload: Partial<ChannelBudget> = {
        channel_id: editingBudgetForm.channel_id.toString(),
        period_start: editingBudgetForm.period_start.toString(),
        period_end: editingBudgetForm.period_end.toString(),
        amount_rub: editingBudgetForm.amount_rub.toString(),
        notes: editingBudgetForm.notes?.toString().trim()
          ? editingBudgetForm.notes!.toString().trim()
          : null,
      }
      const updated = await channelBudgetsApi.update(editingBudgetId, payload)
      setBudgets((prev) => prev.map((b) => (b.id === editingBudgetId ? updated : b)))
      setEditingBudgetId(null)
      setEditingBudgetForm({})
      toast.success('Бюджет обновлён')
    } catch (error) {
      console.error('Ошибка обновления бюджета:', error)
      toast.error(errorMessage(error, 'Не удалось обновить бюджет'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteBudget = async (b: ChannelBudget) => {
    const ok = await confirm({
      title: 'Удалить бюджет?',
      message: 'Удалить бюджет? Это нельзя отменить.',
      confirmText: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await channelBudgetsApi.delete(b.id)
      setBudgets((prev) => prev.filter((x) => x.id !== b.id))
      if (editingBudgetId === b.id) setEditingBudgetId(null)
      toast.success('Бюджет удалён')
    } catch (error) {
      console.error('Ошибка удаления бюджета:', error)
      toast.error(errorMessage(error, 'Не удалось удалить бюджет'))
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-brand-text">Маркетинг-стратегия</h1>
        <p className="text-brand-text-secondary mt-1">
          Стратегический документ, целевые сегменты, тематические фокусы и бюджеты каналов.
        </p>
      </header>

      <StrategyDocSection
        doc={strategyDoc}
        content={editingContent}
        onContentChange={setEditingContent}
        onSave={handleSaveStrategy}
        saving={savingDoc}
      />

      <SegmentsSection
        segments={segments}
        newSegment={newSegment}
        setNewSegment={setNewSegment}
        onCreate={handleCreateSegment}
        editingId={editingSegmentId}
        setEditingId={setEditingSegmentId}
        editForm={editingSegmentForm}
        setEditForm={setEditingSegmentForm}
        onUpdate={handleUpdateSegment}
        onDelete={handleDeleteSegment}
        submitting={submitting}
      />

      <ThemesSection
        themes={themes}
        newTheme={newTheme}
        setNewTheme={setNewTheme}
        onCreate={handleCreateTheme}
        editingId={editingThemeId}
        setEditingId={setEditingThemeId}
        editForm={editingThemeForm}
        setEditForm={setEditingThemeForm}
        onUpdate={handleUpdateTheme}
        onDelete={handleDeleteTheme}
        submitting={submitting}
      />

      <BudgetsSection
        channels={channels}
        budgets={budgets}
        newBudget={newBudget}
        setNewBudget={setNewBudget}
        onCreate={handleCreateBudget}
        editingId={editingBudgetId}
        setEditingId={setEditingBudgetId}
        editForm={editingBudgetForm}
        setEditForm={setEditingBudgetForm}
        onUpdate={handleUpdateBudget}
        onDelete={handleDeleteBudget}
        submitting={submitting}
      />
    </div>
  )
}

export default MarketingStrategy
