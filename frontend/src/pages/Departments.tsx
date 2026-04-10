import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { departmentsApi, Department } from '../api/departments'

export default function Departments() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    departmentsApi.getAll()
      .then(setDepartments)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-text">Направления</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept) => (
          <div
            key={dept.id}
            onClick={() => navigate(`/planning/departments/${dept.id}`)}
            className="bg-brand-surface border border-brand-border rounded-2xl p-6 cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: dept.color || '#836efe' }}
              />
              <h2 className="text-lg font-semibold text-brand-text">{dept.name}</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-card rounded-xl">
                <div className="text-2xl font-bold text-brand-text">{dept.board_count}</div>
                <div className="text-xs text-brand-text-secondary">Досок</div>
              </div>
              <div className="text-center p-3 bg-card rounded-xl">
                <div className="text-2xl font-bold text-brand-text">{dept.member_count}</div>
                <div className="text-xs text-brand-text-secondary">Участников</div>
              </div>
              <div className="text-center p-3 bg-card rounded-xl">
                <div className="text-2xl font-bold text-brand-text">{dept.project_count}</div>
                <div className="text-xs text-brand-text-secondary">Проектов</div>
              </div>
              <div className="text-center p-3 bg-card rounded-xl">
                <div className="text-2xl font-bold text-brand-text">{dept.recurring_task_count}</div>
                <div className="text-xs text-brand-text-secondary">Регулярных</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
