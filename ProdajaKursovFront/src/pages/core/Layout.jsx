import React, { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import NavBar from '../../components/NavBar'
import UserHeader from '../../components/UserHeader'
import { useAuth } from '../../context/AuthContext'
import AuthModal from '../../components/AuthModal'
import StudentBanner from '../../components/StudentBanner'
import { api } from '../../lib/api'

export default function Layout() {
  const { isAuthenticated, isAdmin, user } = useAuth()
  const location = useLocation()

  // If the user is bound to a university, redirect to their university scope
  const slug = user?.university_slug

  const isTeacherRoute = location.pathname.startsWith('/teacher')
  const hideTopHeader = isAdmin && (location.pathname === '/theme' || location.pathname === '/appearance' || location.pathname === '/themes')
  const contentClass = isAdmin
    ? 'w-full max-w-[1400px] pb-8'
    : (isTeacherRoute ? 'w-full md:w-[80%] max-w-[1600px] pb-8' : 'w-full max-w-5xl pb-8')
  const bannerHeightPx = 280
  const [bannerSrc, setBannerSrc] = useState('')
  const showBanner = !!(isAuthenticated && !isAdmin && bannerSrc)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (isAuthenticated && slug) {
        setBannerSrc('')
        return
      }
      if (!isAuthenticated || isAdmin) {
        setBannerSrc('')
        return
      }
      try {
        const data = await api.banner.current()
        const src = data && typeof data === 'object' ? (data.image || '') : ''
        if (!cancelled) setBannerSrc(src)
      } catch {
        if (!cancelled) setBannerSrc('')
      }
    })()
    return () => { cancelled = true }
  }, [isAuthenticated, isAdmin, slug])

  if (isAuthenticated && slug) {
    const currentPath = location.pathname || '/'
    const newPath = `/${slug}${currentPath === '/' ? '' : currentPath}`
    return <Navigate to={newPath} replace />
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
