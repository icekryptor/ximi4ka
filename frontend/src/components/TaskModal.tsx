import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Paperclip, Send, Trash2, Calendar, Download } from 'lucide-react'
import {
  tasksApi,
  commentsApi,
  TaskItem,
  TaskComment,
  TaskColumn,
  TaskPriority,
  TaskTag,
  COLUMNS,
  COLUMN_LABELS,
  COLUMN_COLORS,
  PRIORITY_LABELS,
} from '../api/tasks'
import { tagsApi } from '../api/tasks'
import { Employee } from '../api/employees'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

interface Props {
  task: TaskItem
  boardId: string
  employees: Employee[]
  tags: TaskTag[]
  onClose: () => void
  onSaved: (task: TaskItem) => void
  onDeleted: (taskId: string) => void
  onTagCreated: (tag: TaskTag) => void
}

export default function TaskModal({
  task,
  boardId,
  employees,
  tags,
  onClose,
  onSaved,
  onDeleted,
  onTagCreated,
}: Props) {
  const { user } = useAuth()
  const toast = useToast()

  // Editable fields
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [column, setColumn] = useState<TaskColumn>(task.column)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date || '')
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || '')
  const [supervisorId, setSupervisorId] = useState(task.supervisor_id || '')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(task.tags.map(t => t.id))

  // Comments
  const [comments, setComments] = useState<TaskComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentFile, setCommentFile] = useState<File | null>(null)
  const [sendingComment, setSendingComment] = useState(false)
  const [loadingComments, setLoadingComments] = useState(true)
  const commentsEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // New tag
  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#836efe')

  // Saving
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Can edit: creator, assignee, or supervisor
  const canEdit = user && (
    task.created_by === user.id ||
    task.assignee_id === user.id ||
    task.supervisor_id === user.id ||
    user.role === 'admin'
  )

  // Load comments
  useEffect(() => {
    const load = async () => {
      setLoadingComments(true)
      try {
        const data = await commentsApi.getAll(task.id)
        setComments(data)
      } catch { /* silent */ }
      setLoadingComments(false)
    }
    load()
  }, [task.id])

  // Scroll to bottom when new comments
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  // ─── Save handler ────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!canEdit) return
    setSaving(true)
    try {
      const updated = await tasksApi.update(boardId, task.id, {
        title: title.trim() || task.title,
        description: description.trim() || undefined,
        column,
        priority,
        due_date: dueDate || null,
        assignee_id: assigneeId || null,
        supervisor_id: supervisorId || null,
        tag_ids: selectedTagIds,
      })
      onSaved(updated)
      toast.success('Задача сохранена')
    } catch {
      toast.error('Ошибка сохранения')
    }
    setSaving(false)
  }, [boardId, task, title, description, column, priority, dueDate, assigneeId, supervisorId, selectedTagIds, canEdit, onSaved, toast])

  // ─── Delete handler ──────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!confirm('Удалить задачу?')) return
    setDeleting(true)
    try {
      await tasksApi.delete(boardId, task.id)
      onDeleted(task.id)
      toast.success('Задача удалена')
    } catch {
      toast.error('Ошибка удаления')
    }
    setDeleting(false)
  }, [boardId, task.id, onDeleted, toast])

  // ─── Comment handlers ────────────────────────────────────

  const handleSendComment = useCallback(async () => {
    if (!commentText.trim()) return
    setSendingComment(true)
    try {
      const comment = await commentsApi.create(task.id, commentText.trim(), commentFile || undefined)
      setComments(prev => [...prev, comment])
      setCommentText('')
      setCommentFile(null)
    } catch {
      toast.error('Ошибка отправки')
    }
    setSendingComment(false)
  }, [task.id, commentText, commentFile, toast])

  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      await commentsApi.delete(task.id, commentId)
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch {
      toast.error('Ошибка удаления комментария')
    }
  }, [task.id, toast])

  // ─── New tag handler ─────────────────────────────────────

  const handleCreateTag = useCallback(async () => {
    if (!newTagName.trim()) return
    try {
      const tag = await tagsApi.create(boardId, { name: newTagName.trim(), color: newTagColor })
      onTagCreated(tag)
      setSelectedTagIds(prev => [...prev, tag.id])
      setNewTagName('')
      setShowNewTag(false)
    } catch {
      toast.error('Ошибка создания тега')
    }
  }, [boardId, newTagName, newTagColor, onTagCreated, toast])

  // ─── Tag toggle ──────────────────────────────────────────

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }

  const TAG_COLORS = ['#836efe', '#22c55e', '#f59e0b', '#ef4444', '#38bdf8', '#ec4899', '#94a3b8']

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/30 overflow-y-auto" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-xl w-full max-w-2xl mb-12 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLUMN_COLORS[task.column] }} />
            <span className="text-xs text-gray-400">{COLUMN_LABELS[task.column]}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={!canEdit}
            className="w-full text-lg font-bold text-gray-800 border-none outline-none bg-transparent
              placeholder:text-gray-400 disabled:text-gray-800"
            placeholder="Название задачи..."
          />

          {/* Description */}
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={!canEdit}
            rows={3}
            className="w-full text-sm text-gray-600 border border-gray-200 rounded-xl p-3 outline-none
              focus:border-primary-400 resize-none disabled:bg-gray-50 disabled:text-gray-600"
            placeholder="Описание..."
          />

          {/* Column + Priority + Due date */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Статус</label>
              <select
                value={column}
                onChange={e => setColumn(e.target.value as TaskColumn)}
                disabled={!canEdit}
                className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 outline-none
                  focus:border-primary-400 disabled:bg-gray-50"
              >
                {COLUMNS.map(c => (
                  <option key={c} value={c}>{COLUMN_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Приоритет</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as TaskPriority)}
                disabled={!canEdit}
                className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 outline-none
                  focus:border-primary-400 disabled:bg-gray-50"
              >
                {(['high', 'medium', 'low'] as TaskPriority[]).map(p => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Срок</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  disabled={!canEdit}
                  className="w-full text-sm rounded-xl border border-gray-200 pl-9 pr-3 py-2 outline-none
                    focus:border-primary-400 disabled:bg-gray-50"
                />
              </div>
            </div>
          </div>

          {/* Assignee + Supervisor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Исполнитель</label>
              <select
                value={assigneeId}
                onChange={e => setAssigneeId(e.target.value)}
                disabled={!canEdit}
                className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 outline-none
                  focus:border-primary-400 disabled:bg-gray-50"
              >
                <option value="">Не назначен</option>
                {employees.filter(e => e.is_active).map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Супервайзер</label>
              <select
                value={supervisorId}
                onChange={e => setSupervisorId(e.target.value)}
                disabled={!canEdit}
                className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 outline-none
                  focus:border-primary-400 disabled:bg-gray-50"
              >
                <option value="">Не назначен</option>
                {employees.filter(e => e.is_active).map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Теги</label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => canEdit && toggleTag(tag.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedTagIds.includes(tag.id)
                      ? 'text-white ring-2 ring-offset-1'
                      : 'text-white opacity-40 hover:opacity-70'
                  }`}
                  style={{
                    backgroundColor: tag.color,
                    ...(selectedTagIds.includes(tag.id) ? { '--tw-ring-color': tag.color } as React.CSSProperties : {}),
                  }}
                >
                  {tag.name}
                </button>
              ))}
              {canEdit && !showNewTag && (
                <button
                  onClick={() => setShowNewTag(true)}
                  className="px-2.5 py-1 rounded-full text-xs text-gray-400 border border-dashed border-gray-300
                    hover:border-primary-400 hover:text-primary-600 transition-colors"
                >
                  + Тег
                </button>
              )}
            </div>

            {/* New tag inline form */}
            {showNewTag && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  autoFocus
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateTag(); if (e.key === 'Escape') setShowNewTag(false) }}
                  placeholder="Название тега..."
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-primary-400"
                />
                <div className="flex gap-1">
                  {TAG_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewTagColor(c)}
                      className={`w-5 h-5 rounded-full ${newTagColor === c ? 'ring-2 ring-offset-1 ring-primary-400' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <button onClick={handleCreateTag} className="text-xs text-primary-600 font-medium hover:underline">
                  OK
                </button>
                <button onClick={() => setShowNewTag(false)} className="text-xs text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Comments */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Комментарии {comments.length > 0 && <span className="text-gray-400 font-normal">({comments.length})</span>}
            </h4>

            <div className="space-y-3 max-h-64 overflow-y-auto mb-3">
              {loadingComments ? (
                <p className="text-xs text-gray-400 text-center py-4">Загрузка...</p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Нет комментариев</p>
              ) : (
                comments.map(comment => (
                  <div key={comment.id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-[10px]
                          flex items-center justify-center font-bold">
                          {comment.author_name.charAt(0)}
                        </span>
                        <span className="text-xs font-medium text-gray-700">{comment.author_name}</span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(comment.created_at).toLocaleString('ru-RU', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {user && comment.author_id === user.id && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 ml-8">{comment.text}</p>
                    {comment.attachment_url && (
                      <a
                        href={comment.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary-600 hover:underline ml-8 mt-1"
                      >
                        <Download size={12} />
                        {comment.attachment_name || 'Файл'}
                      </a>
                    )}
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Comment input */}
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment() }
                  }}
                  rows={1}
                  placeholder="Написать комментарий..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 pr-10 outline-none
                    focus:border-primary-400 resize-none"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute right-2 bottom-2 text-gray-400 hover:text-primary-600 transition-colors"
                >
                  <Paperclip size={16} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) setCommentFile(file)
                    e.target.value = ''
                  }}
                />
              </div>
              <button
                onClick={handleSendComment}
                disabled={sendingComment || !commentText.trim()}
                className="p-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700
                  disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} />
              </button>
            </div>

            {/* Attached file indicator */}
            {commentFile && (
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <Paperclip size={12} />
                <span className="truncate max-w-[200px]">{commentFile.name}</span>
                <button onClick={() => setCommentFile(null)} className="text-gray-400 hover:text-red-500">
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50">
          {canEdit ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 transition-colors
                disabled:opacity-40"
            >
              <Trash2 size={15} />
              Удалить
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl">
              Закрыть
            </button>
            {canEdit && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-sm bg-primary-600 text-white rounded-xl hover:bg-primary-700
                  disabled:opacity-40 transition-colors"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
