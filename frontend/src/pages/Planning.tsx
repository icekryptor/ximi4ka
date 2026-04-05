import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus,
  MoreHorizontal,
  Search,
  Calendar,
  MessageSquare,
  Paperclip,
  X,
  Archive,
  Pencil,
  Check,
} from 'lucide-react'
import { boardsApi, Board } from '../api/boards'
import {
  tasksApi,
  tagsApi,
  TaskItem,
  TaskTag,
  TaskColumn,
  COLUMNS,
  COLUMN_LABELS,
  COLUMN_COLORS,
  PRIORITY_LABELS,
} from '../api/tasks'
import { employeesApi, Employee } from '../api/employees'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

// ─── Task Card (pure display) ────────────────────────────────────────────

interface TaskCardProps {
  task: TaskItem
  onClick: () => void
  isDragging?: boolean
}

function TaskCard({ task, onClick, isDragging }: TaskCardProps) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date()
  return (
    <div
      onClick={onClick}
      className={`bg-card rounded-xl p-3 shadow-sm border border-brand-border cursor-pointer
        hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 transition-all ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.map(tag => (
            <span
              key={tag.id}
              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-semibold text-brand-text mb-1 line-clamp-2">{task.title}</p>

      {/* Assignee → Supervisor */}
      {(task.assignee || task.supervisor) && (
        <div className="flex items-center gap-1 text-xs text-brand-text-secondary mb-1.5">
          {task.assignee && (
            <span className="flex items-center gap-0.5">
              <span className="w-4 h-4 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-[9px] flex items-center justify-center font-bold">
                {task.assignee.name.charAt(0)}
              </span>
              {task.assignee.name.split(' ')[0]}
            </span>
          )}
          {task.assignee && task.supervisor && <span className="text-brand-border">→</span>}
          {task.supervisor && (
            <span className="flex items-center gap-0.5 text-brand-text-secondary">
              <span className="w-4 h-4 rounded-full bg-muted text-brand-text-secondary text-[9px] flex items-center justify-center font-bold">
                {task.supervisor.name.charAt(0)}
              </span>
              {task.supervisor.name.split(' ')[0]}
            </span>
          )}
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-2 text-[11px] text-brand-text-secondary">
        {task.due_date && (
          <span className={`flex items-center gap-0.5 ${isOverdue ? 'text-red-500 dark:text-red-400 font-medium' : ''}`}>
            <Calendar size={11} />
            {new Date(task.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
          </span>
        )}
        {task.comment_count > 0 && (
          <span className="flex items-center gap-0.5">
            <MessageSquare size={11} />
            {task.comment_count}
          </span>
        )}
        <span
          className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium ${
            task.priority === 'high'
              ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'
              : task.priority === 'low'
              ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
              : 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
          }`}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>
      </div>
    </div>
  )
}

// ─── Sortable Task Card wrapper ──────────────────────────────────────────

interface SortableTaskCardProps {
  task: TaskItem
  onClick: () => void
}

function SortableTaskCard({ task, onClick }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <TaskCard task={task} onClick={onClick} isDragging={isDragging} />
    </div>
  )
}

// ─── Kanban Column ───────────────────────────────────────────────────────

interface KanbanColumnProps {
  column: TaskColumn
  tasks: TaskItem[]
  onTaskClick: (task: TaskItem) => void
  onQuickAdd: (column: TaskColumn, title: string) => void
}

function KanbanColumn({ column, tasks, onTaskClick, onQuickAdd }: KanbanColumnProps) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus()
  }, [adding])

  const handleSubmit = () => {
    const trimmed = newTitle.trim()
    if (trimmed) {
      onQuickAdd(column, trimmed)
      setNewTitle('')
    }
    setAdding(false)
  }

  const sortedIds = useMemo(() => tasks.map(t => t.id), [tasks])

  return (
    <div className="flex flex-col min-w-[240px] flex-1">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLUMN_COLORS[column] }} />
        <h3 className="text-sm font-semibold text-brand-text">{COLUMN_LABELS[column]}</h3>
        <span className="text-xs text-brand-text-secondary bg-muted px-1.5 py-0.5 rounded-full">{tasks.length}</span>
      </div>

      {/* Cards area */}
      <div className="flex-1 rounded-2xl bg-subtle border border-brand-border p-2 space-y-2 min-h-[120px] overflow-y-auto max-h-[calc(100vh-280px)]">
        <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <SortableTaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>

        {/* Quick add */}
        {adding ? (
          <div className="bg-card rounded-xl p-2 shadow-sm border border-brand-border">
            <input
              ref={inputRef}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSubmit()
                if (e.key === 'Escape') { setAdding(false); setNewTitle('') }
              }}
              onBlur={handleSubmit}
              className="w-full text-sm border-none outline-none bg-transparent text-brand-text placeholder:text-brand-text-secondary"
              placeholder="Название задачи..."
            />
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 w-full px-2 py-1.5 text-xs text-brand-text-secondary hover:text-primary-600 dark:hover:text-primary-400
              hover:bg-surface-hover rounded-xl transition-colors"
          >
            <Plus size={14} />
            Задача
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Board Tabs ──────────────────────────────────────────────────────────

interface BoardTabsProps {
  boards: Board[]
  activeId: string
  onSelect: (id: string) => void
  onCreate: () => void
  onRename: (id: string, name: string) => void
  onArchive: (id: string) => void
  canManage: boolean
}

function BoardTabs({ boards, activeId, onSelect, onCreate, onRename, onArchive, canManage }: BoardTabsProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
      {boards.map(board => (
        <div key={board.id} className="relative flex-shrink-0">
          {editing === board.id ? (
            <div className="flex items-center bg-card rounded-xl px-2 py-1 border border-primary-300 dark:border-primary-600">
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    onRename(board.id, editName.trim() || board.name)
                    setEditing(null)
                  }
                  if (e.key === 'Escape') setEditing(null)
                }}
                onBlur={() => {
                  onRename(board.id, editName.trim() || board.name)
                  setEditing(null)
                }}
                className="text-sm w-32 border-none outline-none bg-transparent text-brand-text"
              />
              <Check size={14} className="text-primary-600 dark:text-primary-400 cursor-pointer" onClick={() => {
                onRename(board.id, editName.trim() || board.name)
                setEditing(null)
              }} />
            </div>
          ) : (
            <button
              onClick={() => onSelect(board.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                activeId === board.id
                  ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                  : 'text-brand-text-secondary hover:bg-surface-hover'
              }`}
            >
              {board.color && (
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: board.color }} />
              )}
              {board.name}
              {canManage && (
                <span
                  onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === board.id ? null : board.id) }}
                  className="ml-1 p-0.5 rounded hover:bg-surface-hover transition-colors"
                >
                  <MoreHorizontal size={14} />
                </span>
              )}
            </button>
          )}

          {/* Context menu */}
          {menuOpen === board.id && (
            <div
              ref={menuRef}
              className="absolute top-full left-0 mt-1 bg-card rounded-xl shadow-lg border border-brand-border py-1 z-50 min-w-[140px]"
            >
              <button
                onClick={() => { setEditing(board.id); setEditName(board.name); setMenuOpen(null) }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-brand-text hover:bg-surface-hover"
              >
                <Pencil size={14} /> Переименовать
              </button>
              <button
                onClick={() => { onArchive(board.id); setMenuOpen(null) }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <Archive size={14} /> Архивировать
              </button>
            </div>
          )}
        </div>
      ))}

      {canManage && (
        <button
          onClick={onCreate}
          className="flex items-center gap-1 px-3 py-2 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950 rounded-xl
            transition-colors whitespace-nowrap flex-shrink-0"
        >
          <Plus size={14} /> Доска
        </button>
      )}
    </div>
  )
}

// ─── Filter Bar ──────────────────────────────────────────────────────────

interface FilterBarProps {
  search: string
  onSearchChange: (v: string) => void
  assigneeId: string
  onAssigneeChange: (v: string) => void
  tagId: string
  onTagChange: (v: string) => void
  myTasks: boolean
  onMyTasksChange: (v: boolean) => void
  employees: Employee[]
  tags: TaskTag[]
}

function FilterBar({
  search, onSearchChange,
  assigneeId, onAssigneeChange,
  tagId, onTagChange,
  myTasks, onMyTasksChange,
  employees, tags,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Поиск..."
          className="pl-9 pr-3 py-1.5 text-sm rounded-xl border border-brand-border bg-card text-brand-text
            focus:border-primary-400 focus:ring-1 focus:ring-primary-200 dark:focus:ring-primary-800 outline-none w-52 transition-colors
            placeholder:text-brand-text-secondary"
        />
        {search && (
          <button onClick={() => onSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-text-secondary hover:text-brand-text">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Assignee filter */}
      <select
        value={assigneeId}
        onChange={e => onAssigneeChange(e.target.value)}
        className="text-sm rounded-xl border border-brand-border bg-card text-brand-text px-3 py-1.5 outline-none
          focus:border-primary-400 transition-colors"
      >
        <option value="">Все исполнители</option>
        {employees.map(emp => (
          <option key={emp.id} value={emp.id}>{emp.name}</option>
        ))}
      </select>

      {/* Tag filter */}
      <select
        value={tagId}
        onChange={e => onTagChange(e.target.value)}
        className="text-sm rounded-xl border border-brand-border bg-card text-brand-text px-3 py-1.5 outline-none
          focus:border-primary-400 transition-colors"
      >
        <option value="">Все теги</option>
        {tags.map(tag => (
          <option key={tag.id} value={tag.id}>{tag.name}</option>
        ))}
      </select>

      {/* My tasks toggle */}
      <button
        onClick={() => onMyTasksChange(!myTasks)}
        className={`px-3 py-1.5 text-sm rounded-xl border transition-colors ${
          myTasks
            ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-300 dark:border-primary-600 text-primary-700 dark:text-primary-300'
            : 'bg-card border-brand-border text-brand-text-secondary hover:border-primary-300 dark:hover:border-primary-600'
        }`}
      >
        Мои задачи
      </button>
    </div>
  )
}

// ─── New Board Modal ─────────────────────────────────────────────────────

interface NewBoardModalProps {
  open: boolean
  onClose: () => void
  onSave: (name: string, color: string) => void
}

function NewBoardModal({ open, onClose, onSave }: NewBoardModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#836efe')
  const colors = ['#836efe', '#22c55e', '#f59e0b', '#ef4444', '#38bdf8', '#a78bfa', '#ec4899']

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-card rounded-3xl p-6 shadow-xl w-96 border border-brand-border">
        <h3 className="text-lg font-semibold text-brand-text mb-4">Новая доска</h3>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onSave(name.trim(), color); setName('') } }}
          placeholder="Название доски..."
          className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-subtle text-brand-text text-sm outline-none
            focus:border-primary-400 focus:ring-1 focus:ring-primary-200 dark:focus:ring-primary-800 mb-3
            placeholder:text-brand-text-secondary"
        />
        <div className="flex gap-2 mb-4">
          {colors.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-primary-400 scale-110 dark:ring-offset-gray-800' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-brand-text-secondary hover:bg-surface-hover rounded-xl">
            Отмена
          </button>
          <button
            disabled={!name.trim()}
            onClick={() => { onSave(name.trim(), color); setName('') }}
            className="px-4 py-2 text-sm bg-primary-600 text-white rounded-xl hover:bg-primary-700
              disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Planning Page ──────────────────────────────────────────────────

export default function Planning() {
  const { user } = useAuth()
  const toast = useToast()
  const canManage = user?.role === 'admin' || user?.role === 'manager'

  // Data state
  const [boards, setBoards] = useState<Board[]>([])
  const [activeBoardId, setActiveBoardId] = useState<string>('')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [tags, setTags] = useState<TaskTag[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  // Filter state
  const [search, setSearch] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [myTasks, setMyTasks] = useState(false)

  // DnD state
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null)

  // Modal state
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null)
  const [showNewBoard, setShowNewBoard] = useState(false)

  // Sensors for drag
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // ─── Data loading ────────────────────────────────────────

  const loadBoards = useCallback(async () => {
    try {
      const data = await boardsApi.getAll()
      setBoards(data)
      return data
    } catch {
      toast.error('Ошибка загрузки досок')
      return []
    }
  }, [toast])

  const loadTasks = useCallback(async (boardId: string) => {
    try {
      const data = await tasksApi.getAll(boardId)
      setTasks(data)
    } catch {
      toast.error('Ошибка загрузки задач')
    }
  }, [toast])

  const loadTags = useCallback(async (boardId: string) => {
    try {
      const data = await tagsApi.getAll(boardId)
      setTags(data)
    } catch { /* silent */ }
  }, [])

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const [boardList, empList] = await Promise.all([
        loadBoards(),
        employeesApi.getAll().catch(() => [] as Employee[]),
      ])
      setEmployees(empList)
      if (boardList.length > 0) {
        setActiveBoardId(boardList[0].id)
        await Promise.all([loadTasks(boardList[0].id), loadTags(boardList[0].id)])
      }
      setLoading(false)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When active board changes
  const handleSelectBoard = useCallback(async (id: string) => {
    setActiveBoardId(id)
    setTasks([])
    setTags([])
    await Promise.all([loadTasks(id), loadTags(id)])
  }, [loadTasks, loadTags])

  // ─── Board CRUD ──────────────────────────────────────────

  const handleCreateBoard = useCallback(async (name: string, color: string) => {
    try {
      const board = await boardsApi.create({ name, color })
      setBoards(prev => [...prev, board])
      setActiveBoardId(board.id)
      setTasks([])
      setTags([])
      setShowNewBoard(false)
      toast.success('Доска создана')
    } catch {
      toast.error('Ошибка создания доски')
    }
  }, [toast])

  const handleRenameBoard = useCallback(async (id: string, name: string) => {
    try {
      await boardsApi.update(id, { name })
      setBoards(prev => prev.map(b => b.id === id ? { ...b, name } : b))
    } catch {
      toast.error('Ошибка переименования')
    }
  }, [toast])

  const handleArchiveBoard = useCallback(async (id: string) => {
    try {
      await boardsApi.archive(id)
      const remaining = boards.filter(b => b.id !== id)
      setBoards(remaining)
      if (activeBoardId === id && remaining.length > 0) {
        handleSelectBoard(remaining[0].id)
      } else if (remaining.length === 0) {
        setActiveBoardId('')
        setTasks([])
        setTags([])
      }
      toast.success('Доска архивирована')
    } catch {
      toast.error('Ошибка архивации')
    }
  }, [boards, activeBoardId, handleSelectBoard, toast])

  // ─── Task quick-add ──────────────────────────────────────

  const handleQuickAdd = useCallback(async (column: TaskColumn, title: string) => {
    if (!activeBoardId) return
    try {
      const maxSort = tasks
        .filter(t => t.column === column)
        .reduce((max, t) => Math.max(max, t.sort_order), 0)

      const task = await tasksApi.create(activeBoardId, {
        title,
        column,
        priority: 'medium',
      })
      // API returns task without sort_order set correctly sometimes — ensure local state
      setTasks(prev => [...prev, { ...task, sort_order: task.sort_order || maxSort + 1000 }])
    } catch {
      toast.error('Ошибка создания задачи')
    }
  }, [activeBoardId, tasks, toast])

  // ─── Drag handlers ───────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id)
    if (task) setActiveTask(task)
  }, [tasks])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Determine target column
    const overTask = tasks.find(t => t.id === overId)
    const targetColumn = overTask ? overTask.column : (COLUMNS.includes(overId as TaskColumn) ? overId as TaskColumn : null)
    if (!targetColumn) return

    const activeTaskItem = tasks.find(t => t.id === activeId)
    if (!activeTaskItem || activeTaskItem.column === targetColumn) return

    // Optimistic move to new column
    setTasks(prev => prev.map(t =>
      t.id === activeId ? { ...t, column: targetColumn } : t
    ))
    setActiveTask(prev => prev ? { ...prev, column: targetColumn } : null)
  }, [tasks])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    if (!over || !activeBoardId) return

    const activeId = active.id as string
    const overId = over.id as string
    const task = tasks.find(t => t.id === activeId)
    if (!task) return

    // Determine target column and position
    const overTask = tasks.find(t => t.id === overId)
    const targetColumn = overTask ? overTask.column : task.column

    // Calculate new sort_order
    const columnTasks = tasks
      .filter(t => t.column === targetColumn && t.id !== activeId)
      .sort((a, b) => a.sort_order - b.sort_order)

    let newOrder: number
    if (overTask && overTask.id !== activeId) {
      const overIndex = columnTasks.findIndex(t => t.id === overId)
      if (overIndex === 0) {
        newOrder = columnTasks[0].sort_order - 1000
      } else if (overIndex >= columnTasks.length) {
        newOrder = columnTasks[columnTasks.length - 1].sort_order + 1000
      } else {
        newOrder = Math.floor(
          (columnTasks[overIndex - 1].sort_order + columnTasks[overIndex].sort_order) / 2
        )
      }
    } else {
      newOrder = columnTasks.length > 0
        ? columnTasks[columnTasks.length - 1].sort_order + 1000
        : 1000
    }

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === activeId ? { ...t, column: targetColumn, sort_order: newOrder } : t
    ))

    // Persist
    try {
      await tasksApi.move(activeBoardId, activeId, { column: targetColumn, sort_order: newOrder })
    } catch {
      // Rollback — reload tasks
      toast.error('Ошибка перемещения')
      loadTasks(activeBoardId)
    }
  }, [tasks, activeBoardId, loadTasks, toast])

  // ─── Task modal callbacks ────────────────────────────────

  const handleTaskSaved = useCallback((updated: TaskItem) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
    setSelectedTask(null)
  }, [])

  const handleTaskDeleted = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setSelectedTask(null)
  }, [])

  const handleTagCreated = useCallback((tag: TaskTag) => {
    setTags(prev => [...prev, tag])
  }, [])

  // ─── Filtered tasks per column ───────────────────────────

  const tasksByColumn = useMemo(() => {
    let filtered = [...tasks]

    if (search) {
      const lower = search.toLowerCase()
      filtered = filtered.filter(t => t.title.toLowerCase().includes(lower))
    }
    if (filterAssignee) {
      filtered = filtered.filter(t => t.assignee_id === filterAssignee)
    }
    if (filterTag) {
      filtered = filtered.filter(t => t.tags.some(tag => tag.id === filterTag))
    }
    if (myTasks && user) {
      filtered = filtered.filter(t =>
        t.assignee_id === user.id || t.supervisor_id === user.id || t.created_by === user.id
      )
    }

    const map: Record<TaskColumn, TaskItem[]> = {
      backlog: [], todo: [], in_progress: [], review: [], done: [],
    }
    for (const t of filtered) {
      if (map[t.column]) {
        map[t.column].push(t)
      }
    }
    // Sort within columns
    for (const col of COLUMNS) {
      map[col].sort((a, b) => a.sort_order - b.sort_order)
    }
    return map
  }, [tasks, search, filterAssignee, filterTag, myTasks, user])

  // ─── Render ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-8">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-brand-text mb-3">Планирование</h1>

        {/* Board tabs */}
        <BoardTabs
          boards={boards}
          activeId={activeBoardId}
          onSelect={handleSelectBoard}
          onCreate={() => setShowNewBoard(true)}
          onRename={handleRenameBoard}
          onArchive={handleArchiveBoard}
          canManage={canManage}
        />
      </div>

      {boards.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-brand-text-secondary mb-3">Нет досок</p>
            {canManage && (
              <button
                onClick={() => setShowNewBoard(true)}
                className="px-4 py-2 bg-primary-600 text-white text-sm rounded-xl hover:bg-primary-700 transition-colors"
              >
                <Plus size={16} className="inline mr-1" />
                Создать первую доску
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="mb-4">
            <FilterBar
              search={search} onSearchChange={setSearch}
              assigneeId={filterAssignee} onAssigneeChange={setFilterAssignee}
              tagId={filterTag} onTagChange={setFilterTag}
              myTasks={myTasks} onMyTasksChange={setMyTasks}
              employees={employees}
              tags={tags}
            />
          </div>

          {/* Kanban board */}
          <div className="flex-1 overflow-x-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-3 pb-4">
                {COLUMNS.map(column => (
                  <KanbanColumn
                    key={column}
                    column={column}
                    tasks={tasksByColumn[column]}
                    onTaskClick={setSelectedTask}
                    onQuickAdd={handleQuickAdd}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeTask && (
                  <div className="w-60 rotate-2 opacity-90">
                    <TaskCard task={activeTask} onClick={() => {}} isDragging />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>
        </>
      )}

      {/* New board modal */}
      <NewBoardModal
        open={showNewBoard}
        onClose={() => setShowNewBoard(false)}
        onSave={handleCreateBoard}
      />

      {/* Task detail modal — will be built in Task 7 */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          boardId={activeBoardId}
          employees={employees}
          tags={tags}
          onClose={() => setSelectedTask(null)}
          onSaved={handleTaskSaved}
          onDeleted={handleTaskDeleted}
          onTagCreated={handleTagCreated}
        />
      )}
    </div>
  )
}

// Lazy import for TaskModal — will be created in Task 7
// For now we define a placeholder that the real TaskModal will replace
import TaskModal from '../components/TaskModal'
