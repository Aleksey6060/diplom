import React from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'

const RESERVED_UNIVERSITY_SLUGS = new Set([
  'admin',
  'teacher',
  'courses',
  'overview',
  'my-courses',
  'payments',
  'archived',
  'recent',
  'settings',
  'chat',
  'theme',
  'appearance',
  'themes',
  'grades',
  'progress',
])

export default function RedirectRoot() {
  const { isAdmin, user, isAuthenticated } = useAuth()
  const { universitySlug } = useParams()
  if (!isAuthenticated) return null
  if (universitySlug && RESERVED_UNIVERSITY_SLUGS.has(String(universitySlug))) {
    if (String(universitySlug) === 'grades' || String(universitySlug) === 'progress') return <Navigate to="/grades" replace />
    return <Navigate to="/" replace />
  }
  const isOwner = !!user && (user.is_superuser || user.account_type === 'owner')
  const isTeacher = user?.account_type === 'teacher'
  const base = universitySlug ? `/${universitySlug}` : ''
  if (isOwner) return <Navigate to="/admin" replace />
  return <Navigate to={isAdmin ? `${base}/admin` : isTeacher ? `${base}/teacher/groups` : `${base}/my-courses`} replace />
}
