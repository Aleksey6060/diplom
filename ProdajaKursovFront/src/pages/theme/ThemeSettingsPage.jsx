import React, { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import ThemeSettingsModal from '../../components/ThemeSettingsModal'
import { useAuth } from '../../context/AuthContext'

export default function ThemeSettingsPage() {
  const { user, isAdmin, hasPermission, accessModules } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)

  if (accessModules === null && user) return null
  if (isAdmin && user?.account_type === 'employee' && !hasPermission('design.access')) {
    return <Navigate to="/admin/courses" replace />
  }

  return (
    <div className="min-h-screen">
      <ThemeSettingsModal
        open={open}
        variant="page"
        onClose={() => {
          setOpen(false)
          try {
            window.close()
          } catch {
            void 0
          }
          navigate('/my-courses')
        }}
      />
    </div>
  )
}
