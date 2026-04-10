# Project JSON Export / Import / Template

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add JSON export, import, and template download for projects — enabling project structure sharing and manual creation via JSON files.

**Architecture:** Three new controller methods (exportProject, importProject, getTemplate) on the existing project controller. Frontend adds export button on ProjectDetail, import modal + template button on Projects list. Import creates project + tasks + dependencies in a transaction, mapping `_ref` IDs to real UUIDs.

**Tech Stack:** Express controller methods, frontend file download/upload via Blob/FileReader, existing project API client.

---

### Task 1: Add Backend Export Endpoint

**Files:**
- Modify: `backend/src/controllers/project.controller.ts`
- Modify: `backend/src/routes/project.routes.ts`

**Step 1: Add exportProject method to project controller**

Add this method to the `projectController` object in `project.controller.ts`, after `removeDependency`:

```typescript
  async exportProject(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const project = await projectRepo().findOne({ where: { id } });
      if (!project) return res.status(404).json({ error: 'Проект не найден' });

      const tasks = await taskRepo().find({
        where: { project_id: id },
        order: { sort_order: 'ASC', created_at: 'ASC' },
      });

      const taskIds = tasks.map(t => t.id);
      let dependencies: TaskDependency[] = [];
      if (taskIds.length > 0) {
        dependencies = await depRepo()
          .createQueryBuilder('d')
          .where('d.predecessor_id IN (:...ids) OR d.successor_id IN (:...ids)', { ids: taskIds })
          .getMany();
      }

      // Build ref map: uuid -> task-N
      const refMap = new Map<string, string>();
      tasks.forEach((t, i) => refMap.set(t.id, `task-${i + 1}`));

      const exportData = {
        _format: 'ximi4ka-project-v1',
        name: project.name,
        description: project.description,
        budget: Number(project.budget),
        start_date: project.start_date,
        end_date: project.end_date,
        deliverables: project.deliverables,
        status: project.status,
        tasks: tasks.map(t => ({
          _ref: refMap.get(t.id),
          title: t.title,
          description: t.description,
          priority: t.priority,
          start_date: t.start_date,
          due_date: t.due_date,
          progress: t.progress || 0,
          parent_ref: t.parent_id ? refMap.get(t.parent_id) || null : null,
        })),
        dependencies: dependencies.map(d => ({
          predecessor_ref: refMap.get(d.predecessor_id) || null,
          successor_ref: refMap.get(d.successor_id) || null,
          is_blocking: d.is_blocking,
        })),
      };

      res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.json"`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.json(exportData);
    } catch (error) {
      console.error('Ошибка при экспорте проекта:', error);
      res.status(500).json({ error: 'Ошибка при экспорте проекта' });
    }
  },
```

**Step 2: Add route**

Add to `project.routes.ts` BEFORE the `/:id` GET route (to avoid param conflict):

```typescript
router.get('/template', projectController.getTemplate);
router.post('/import', projectController.importProject);
router.get('/:id/export', projectController.exportProject);
```

Note: `template` and `import` routes go before `/:id` to avoid Express treating "template"/"import" as an id param.

**Step 3: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add backend/src/controllers/project.controller.ts backend/src/routes/project.routes.ts
git commit -m "feat: add project JSON export endpoint"
```

---

### Task 2: Add Backend Template Endpoint

**Files:**
- Modify: `backend/src/controllers/project.controller.ts`

**Step 1: Add getTemplate method to project controller**

Add this method after `exportProject`:

```typescript
  async getTemplate(_req: Request, res: Response) {
    const template = {
      _format: 'ximi4ka-project-v1',
      _instruction: [
        'Шаблон проекта XimFinance.',
        'Заполните поля ниже и импортируйте файл через интерфейс.',
        '',
        'Правила:',
        '- name (обязательно): название проекта',
        '- description: описание проекта или null',
        '- budget: число (бюджет в рублях), по умолчанию 0',
        '- start_date / end_date: дата в формате "YYYY-MM-DD" или null',
        '- deliverables: описание результатов или null',
        '- status: одно из значений — "draft", "active", "on_hold", "completed", "cancelled"',
        '',
        'Задачи (tasks):',
        '- _ref (обязательно): уникальный идентификатор задачи внутри файла (например "task-1", "task-2")',
        '- title (обязательно): название задачи',
        '- description: описание или null',
        '- priority: "high", "medium" или "low" (по умолчанию "medium")',
        '- start_date / due_date: даты в формате "YYYY-MM-DD" или null',
        '- progress: число от 0 до 100 (процент выполнения)',
        '- parent_ref: _ref родительской задачи или null (для подзадач)',
        '',
        'Зависимости (dependencies):',
        '- predecessor_ref: _ref задачи-предшественника',
        '- successor_ref: _ref задачи, которая зависит от предшественника',
        '- is_blocking: true если зависимость блокирующая, false если нет',
      ].join('\n'),
      name: 'Название проекта',
      description: null,
      budget: 0,
      start_date: null,
      end_date: null,
      deliverables: null,
      status: 'draft',
      tasks: [
        {
          _ref: 'task-1',
          title: 'Первая задача',
          description: null,
          priority: 'medium',
          start_date: '2026-05-01',
          due_date: '2026-05-15',
          progress: 0,
          parent_ref: null,
        },
        {
          _ref: 'task-2',
          title: 'Подзадача первой задачи',
          description: 'Пример подзадачи',
          priority: 'high',
          start_date: '2026-05-01',
          due_date: '2026-05-07',
          progress: 0,
          parent_ref: 'task-1',
        },
        {
          _ref: 'task-3',
          title: 'Вторая задача (после первой)',
          description: null,
          priority: 'low',
          start_date: '2026-05-16',
          due_date: '2026-05-31',
          progress: 0,
          parent_ref: null,
        },
      ],
      dependencies: [
        {
          predecessor_ref: 'task-1',
          successor_ref: 'task-3',
          is_blocking: false,
        },
      ],
    };

    res.setHeader('Content-Disposition', 'attachment; filename="project_template.json"');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(template);
  },
```

**Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add backend/src/controllers/project.controller.ts
git commit -m "feat: add project JSON template endpoint"
```

---

### Task 3: Add Backend Import Endpoint

**Files:**
- Modify: `backend/src/controllers/project.controller.ts`

**Step 1: Add importProject method to project controller**

Add this method after `getTemplate`:

```typescript
  async importProject(req: Request, res: Response) {
    try {
      const { department_id, data } = req.body;
      if (!department_id || !data) {
        return res.status(400).json({ error: 'department_id и data обязательны' });
      }
      if (!data.name) {
        return res.status(400).json({ error: 'Поле name обязательно в JSON' });
      }

      // Create project
      const project = projectRepo().create({
        department_id,
        name: data.name,
        description: data.description || null,
        budget: data.budget || 0,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        deliverables: data.deliverables || null,
        status: data.status || 'draft',
        created_by: req.user!.userId,
      });
      const savedProject = await projectRepo().save(project);

      // Create tasks and build ref -> uuid map
      const refToId = new Map<string, string>();
      const tasksToCreate = (data.tasks || []) as Array<{
        _ref: string;
        title: string;
        description?: string;
        priority?: string;
        start_date?: string;
        due_date?: string;
        progress?: number;
        parent_ref?: string;
      }>;

      // First pass: create tasks without parent_id
      for (const t of tasksToCreate) {
        if (!t._ref || !t.title) continue;
        const task = taskRepo().create({
          project_id: savedProject.id,
          title: t.title,
          description: t.description || null,
          priority: t.priority || 'medium',
          start_date: t.start_date || null,
          due_date: t.due_date || null,
          progress: t.progress || 0,
          created_by: req.user!.userId,
        });
        const saved = await taskRepo().save(task);
        refToId.set(t._ref, saved.id);
      }

      // Second pass: set parent_id for subtasks
      for (const t of tasksToCreate) {
        if (!t._ref || !t.parent_ref) continue;
        const taskId = refToId.get(t._ref);
        const parentId = refToId.get(t.parent_ref);
        if (taskId && parentId) {
          await taskRepo().update(taskId, { parent_id: parentId });
        }
      }

      // Create dependencies
      const depsToCreate = (data.dependencies || []) as Array<{
        predecessor_ref: string;
        successor_ref: string;
        is_blocking?: boolean;
      }>;
      for (const d of depsToCreate) {
        const predId = refToId.get(d.predecessor_ref);
        const succId = refToId.get(d.successor_ref);
        if (predId && succId) {
          const dep = depRepo().create({
            predecessor_id: predId,
            successor_id: succId,
            type: 'finish_to_start',
            is_blocking: d.is_blocking || false,
          });
          await depRepo().save(dep);
        }
      }

      res.status(201).json({ id: savedProject.id, message: 'Проект импортирован' });
    } catch (error) {
      console.error('Ошибка при импорте проекта:', error);
      res.status(500).json({ error: 'Ошибка при импорте проекта' });
    }
  },
```

**Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add backend/src/controllers/project.controller.ts
git commit -m "feat: add project JSON import endpoint"
```

---

### Task 4: Add Frontend API Methods

**Files:**
- Modify: `frontend/src/api/projects.ts`

**Step 1: Add export, import, and template methods to projectsApi**

Add these methods at the end of the `projectsApi` object:

```typescript
  exportProject: async (id: string): Promise<void> => {
    const { data } = await api.get(`/projects/${id}/export`)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.name || 'project'}.json`
    a.click()
    URL.revokeObjectURL(url)
  },

  downloadTemplate: async (): Promise<void> => {
    const { data } = await api.get('/projects/template')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'project_template.json'
    a.click()
    URL.revokeObjectURL(url)
  },

  importProject: async (departmentId: string, jsonData: any): Promise<{ id: string }> => {
    const { data } = await api.post('/projects/import', {
      department_id: departmentId,
      data: jsonData,
    })
    return data
  },
```

**Step 2: Commit**

```bash
git add frontend/src/api/projects.ts
git commit -m "feat: add export/import/template methods to frontend projects API"
```

---

### Task 5: Add Export Button to ProjectDetail

**Files:**
- Modify: `frontend/src/pages/ProjectDetail.tsx`

**Step 1: Add export button in the header**

After the status badge `<span>` in the header `<div>`, add:

```tsx
        <button
          onClick={() => projectsApi.exportProject(id!)}
          className="ml-auto px-4 py-2 border border-brand-border text-brand-text rounded-xl text-sm font-medium hover:bg-brand-surface transition-colors"
        >
          ⬇ JSON
        </button>
```

**Step 2: Commit**

```bash
git add frontend/src/pages/ProjectDetail.tsx
git commit -m "feat: add JSON export button to ProjectDetail"
```

---

### Task 6: Add Import Modal and Template Button to Projects List

**Files:**
- Modify: `frontend/src/pages/Projects.tsx`

**Step 1: Add import/template state and handlers**

Add after the existing state declarations:

```tsx
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<any>(null)
  const [importDept, setImportDept] = useState('')
  const [importFileName, setImportFileName] = useState('')
```

Add file handler function:

```tsx
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string)
        setImportFile(json)
      } catch {
        alert('Ошибка: файл не является валидным JSON')
        setImportFile(null)
        setImportFileName('')
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!importFile || !importDept) return
    try {
      const result = await projectsApi.importProject(importDept, importFile)
      setShowImport(false)
      setImportFile(null)
      setImportDept('')
      setImportFileName('')
      navigate(`/planning/projects/${result.id}`)
    } catch (err) { console.error(err) }
  }
```

**Step 2: Add template + import buttons to header**

In the header `<div>` with buttons, add before the `+ Создать` button:

```tsx
          <button
            onClick={() => projectsApi.downloadTemplate()}
            className="px-4 py-2 border border-brand-border text-brand-text rounded-xl text-sm font-medium hover:bg-brand-surface transition-colors"
          >
            📋 Шаблон
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 border border-brand-border text-brand-text rounded-xl text-sm font-medium hover:bg-brand-surface transition-colors"
          >
            ⬆ Импорт
          </button>
```

**Step 3: Add import modal**

After the `showCreate` form block, add:

```tsx
      {showImport && (
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-brand-text">Импорт проекта из JSON</h2>
          <div>
            <label className="block text-sm text-brand-text-secondary mb-2">Файл JSON</label>
            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-brand-border bg-card cursor-pointer hover:border-primary-400 transition-colors">
              <span className="text-sm text-brand-text">{importFileName || 'Выберите файл...'}</span>
              <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
            </label>
          </div>
          <div>
            <label className="block text-sm text-brand-text-secondary mb-2">Направление</label>
            <select value={importDept} onChange={e => setImportDept(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text">
              <option value="">Выберите направление...</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {importFile && (
            <div className="text-sm text-brand-text-secondary">
              Проект: <span className="text-brand-text font-medium">{importFile.name}</span>
              {importFile.tasks && <> · {importFile.tasks.length} задач</>}
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <button onClick={() => { setShowImport(false); setImportFile(null); setImportDept(''); setImportFileName('') }} className="px-4 py-2 text-brand-text-secondary hover:text-brand-text transition-colors">Отмена</button>
            <button onClick={handleImport} disabled={!importFile || !importDept} className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Импортировать</button>
          </div>
        </div>
      )}
```

**Step 4: Commit**

```bash
git add frontend/src/pages/Projects.tsx
git commit -m "feat: add import modal and template download to Projects list"
```

---

### Task 7: Final Verification and Deploy

**Step 1: Run backend build**

Run: `cd backend && npm run build`

**Step 2: Run frontend build**

Run: `cd frontend && npm run build`

**Step 3: Deploy**

Standard deploy workflow: merge worktree → push both remotes.

---

## Summary of Changes

| Area | Files | What |
|------|-------|------|
| **Controller** | `project.controller.ts` | 3 new methods: exportProject, getTemplate, importProject |
| **Routes** | `project.routes.ts` | 3 new routes: GET /template, POST /import, GET /:id/export |
| **Frontend API** | `projects.ts` | 3 new methods: exportProject, downloadTemplate, importProject |
| **ProjectDetail** | `ProjectDetail.tsx` | Export button in header |
| **Projects** | `Projects.tsx` | Template button, import button, import modal |
