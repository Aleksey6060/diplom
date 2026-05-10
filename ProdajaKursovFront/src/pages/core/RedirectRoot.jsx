import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function RedirectRoot() {
  const { isAdmin, user, isAuthenticated } = useAuth()
  if (!isAuthenticated) return null
  const isOwner = !!user && (user.is_superuser || user.account_type === 'owner')
  const isTeacher = user?.account_type === 'teacher'
  const slug = user?.university_slug

  if (isOwner) {
    return <Navigate to="/admin" replace />
  }

  // Users bound to a university always go to their university scope
  if (slug) {
    const dest = isAdmin ? `/${slug}/admin` : isTeacher ? `/${slug}/teacher/groups` : `/${slug}/my-courses`
    return <Navigate to={dest} replace />
  }

  return <Navigate to={isAdmin ? '/admin' : isTeacher ? '/teacher/groups' : '/my-courses'} replace />
}
