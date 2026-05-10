import React from 'react'

const DEMO_ARCHIVED = [
  { id: 'a1', name: 'п50-8-21', note: 'Завершённая группа' },
  { id: 'a2', name: 'п44-7-20', note: 'Архив' },
]

export default function TeacherArchive() {
  return (
    <div className="space-y-3">
      {DEMO_ARCHIVED.map(g => (
        <div key={g.id} className="admin-card rounded-2xl p-4">
          <div className="text-[#0f2e3a] font-semibold">{g.name}</div>
          <div className="text-[#5a7280] text-sm">{g.note}</div>
        </div>
      ))}
      {!DEMO_ARCHIVED.length && <div className="text-[#0f2e3a]">Пусто</div>}
    </div>
  )
}

