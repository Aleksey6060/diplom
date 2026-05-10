import React, { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import NavBar from '../../../components/NavBar'
import UserHeader from '../../../components/UserHeader'
import { useAuth } from '../../../context/AuthContext'
import AuthModal from '../../../components/AuthModal'
import StudentBanner from '../../../components/StudentBanner'
import { api } from '../../../lib/api'

const RESERVED_UNIVERSITY_SLUGS = new Set([
  'admin',
  'teacher',
  'courses',
  'overview',
  'my-courses',
  'payments',
  'schedule',
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

export default function Layout() {
  const { isAuthenticated, isAdmin, user } = useAuth()
  const location = useLocation()
  const { universitySlug } = useParams()
  const isReservedSlug = !!universitySlug && RESERVED_UNIVERSITY_SLUGS.has(String(universitySlug))
  const safeUniversitySlug = isReservedSlug ? null : universitySlug
  const pathWithoutUniversity = universitySlug ? location.pathname.replace(new RegExp(`^/${universitySlug}`), '') || '/' : location.pathname
  const isTeacherRoute = pathWithoutUniversity.startsWith('/teacher')
  const hideTopHeader = isAdmin && (pathWithoutUniversity === '/theme' || pathWithoutUniversity === '/appearance' || pathWithoutUniversity === '/themes')
  const contentClass = isAdmin
    ? 'w-full max-w-[1400px] pb-8'
    : (isTeacherRoute ? 'w-full md:w-[80%] max-w-[1600px] pb-8' : 'w-full max-w-5xl pb-8')
  const bannerHeightPx = 280
  const [bannerSrc, setBannerSrc] = useState('')
  const showBanner = !!(isAuthenticated && !isAdmin && bannerSrc)
  const isOwner = !!user && (user.is_superuser || user.account_type === 'owner')
  const allowOwnerUniversityAdmin = isOwner && pathWithoutUniversity.startsWith('/admin') && (() => {
    try {
      return new URLSearchParams(location.search || '').get('university_scope') === '1'
    } catch {
      return false
    }
  })()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (isOwner) {
        setBannerSrc('')
        return
      }
      if (!isAuthenticated || isAdmin) {
        setBannerSrc('')
        return
      }
      try {
        const data = await api.banner.current({ universitySlug: safeUniversitySlug })
        const src = data && typeof data === 'object' ? (data.image || '') : ''
        if (!cancelled) setBannerSrc(src)
      } catch {
        if (!cancelled) setBannerSrc('')
      }
    })()
    return () => { cancelled = true }
  }, [isAuthenticated, isAdmin, isOwner, safeUniversitySlug])

  if (isReservedSlug) {
    const search = location.search || ''
    if (pathWithoutUniversity === '/' && String(universitySlug) === 'grades') return <Navigate to={`/grades${search}`} replace />
    if (pathWithoutUniversity === '/' && String(universitySlug) === 'progress') return <Navigate to={`/grades${search}`} replace />
    return <Navigate to={`${pathWithoutUniversity}${search}`} replace />
  }

  if (isOwner && !allowOwnerUniversityAdmin) {
    if (pathWithoutUniversity.startsWith('/admin')) {
      return <Navigate to={pathWithoutUniversity} replace />
    }
    return <Navigate to="/admin" replace />
  }

  return (
    <div className="relative min-h-screen text-ink font-sans">
      {!hideTopHeader && <NavBar />}
      <div className={hideTopHeader ? 'pt-6' : 'pt-20 sm:pt-24'}>
        {showBanner && (
          <div className="-mt-2.5">
            <StudentBanner src={bannerSrc} fit="cover" heightPx={bannerHeightPx} />
          </div>
        )}
        {isAuthenticated && !isAdmin && (
          <div className={showBanner ? 'mt-1 sm:mt-2' : 'mt-2 sm:mt-4'}>
            <UserHeader />
          </div>
        )}
        <main className={isTeacherRoute ? 'w-full max-w-[1600px] mx-auto px-4 flex justify-center relative pt-3 sm:pt-6 mt-1 sm:mt-2' : 'w-full max-w-7xl mx-auto px-4 flex justify-center relative pt-3 sm:pt-6 mt-1 sm:mt-2'}>
          <div className={contentClass}>
            <Outlet />
          </div>
        </main>
      </div>
      <AuthModal />
    </div>
  )
}
