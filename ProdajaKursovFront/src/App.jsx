import React, { useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import { AuthProvider } from './context/AuthProvider'
import { SearchProvider } from './context/SearchContext'
import Layout from './pages/core/Layout'
import RedirectRoot from './pages/core/RedirectRoot'
import CoursesPage from './pages/student/CoursesPage'
import MyCoursesPage from './pages/student/MyCoursesPage'
import SchedulePage from './pages/student/SchedulePage'
import PaymentsPage from './pages/student/PaymentsPage'
import CourseOverviewPage from './pages/student/CourseOverviewPage'
import CourseTopicPage from './pages/student/CourseTopicPage'
import ProgressPage from './pages/student/ProgressPage'
import WelcomeScreen from './components/WelcomeScreen'
import AuthModal from './components/AuthModal'
import { AnimatePresence, motion } from 'framer-motion'
import AdminLayout from './pages/admin/AdminLayout'
import AdminCourses from './pages/admin/AdminCourses'
import AdminStaff from './pages/admin/AdminStaff'
import AdminStudents from './pages/admin/AdminStudents'
import AdminStore from './pages/admin/AdminStore'
import AdminDistribution from './pages/admin/AdminDistribution'
import AdminTickets from './pages/admin/AdminTickets'
import UserChat from './pages/student/UserChat'
import AdminChat from './pages/admin/AdminChat'
import AdminDocuments from './pages/admin/AdminDocuments'
import AdminPayments from './pages/admin/AdminPayments'
import AdminBanner from './pages/admin/AdminBanner'
import AdminUniversity from './pages/admin/AdminUniversity'
import ThemeSettingsPage from './pages/theme/ThemeSettingsPage'
import ThemesGalleryPage from './pages/theme/ThemesGalleryPage'
import { useEffect } from 'react'
import { applyGradientVariety } from './utils/gradientVariety'
import FluidBackground from './components/FluidBackground'
import BackgroundImagesLayer from './components/BackgroundImagesLayer'
import MarqueeLayer from './components/MarqueeLayer'
import TeacherLayout from './pages/teacher/TeacherLayout'
import TeacherGroups from './pages/teacher/TeacherGroups'
import TeacherGroupDetails from './pages/teacher/TeacherGroupDetails'
import TeacherAssignment from './pages/teacher/TeacherAssignment'
import TeacherSchedulePage from './pages/teacher/TeacherSchedulePage'
import UniversityLayout from './pages/university/core/Layout'
import UniversityRedirectRoot from './pages/university/core/RedirectRoot'
import UniversityCoursesPage from './pages/university/student/CoursesPage'
import UniversityMyCoursesPage from './pages/university/student/MyCoursesPage'
import UniversityPaymentsPage from './pages/university/student/PaymentsPage'
import UniversityCourseOverviewPage from './pages/university/student/CourseOverviewPage'
import UniversityCourseTopicPage from './pages/university/student/CourseTopicPage'
import UniversityProgressPage from './pages/university/student/ProgressPage'
import UniversityUserChat from './pages/university/student/UserChat'
import UniversityThemeSettingsPage from './pages/university/theme/ThemeSettingsPage'
import UniversityThemesGalleryPage from './pages/university/theme/ThemesGalleryPage'
import UniversityTeacherLayout from './pages/university/teacher/TeacherLayout'
import UniversityTeacherGroups from './pages/university/teacher/TeacherGroups'
import UniversityTeacherGroupDetails from './pages/university/teacher/TeacherGroupDetails'
import UniversityTeacherAssignment from './pages/university/teacher/TeacherAssignment'
import UniversityAdminLayout from './pages/university/admin/AdminLayout'
import UniversityAdminStore from './pages/university/admin/AdminStore'
import UniversityAdminBanner from './pages/university/admin/AdminBanner'
import UniversityAdminUniversity from './pages/university/admin/AdminUniversity'
import UniversityAdminCourses from './pages/university/admin/AdminCourses'
import UniversityAdminStaff from './pages/university/admin/AdminStaff'
import UniversityAdminStudents from './pages/university/admin/AdminStudents'
import UniversityAdminPayments from './pages/university/admin/AdminPayments'
import UniversityAdminDistribution from './pages/university/admin/AdminDistribution'
import UniversityAdminDocuments from './pages/university/admin/AdminDocuments'
import UniversityAdminChat from './pages/university/admin/AdminChat'
import PasswordResetConfirmPage from './pages/PasswordResetConfirmPage'

export default function App() {
  return (
    <>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <SearchProvider>
              <AppContent />
            </SearchProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </>
  )
}

const RESERVED_TOP_SEGMENTS = new Set([
  'admin', 'teacher', 'courses', 'overview', 'my-courses', 'payments', 'schedule',
  'archived', 'recent', 'settings', 'theme', 'appearance', 'themes', 'chat', 'grades',
  'reset-password',
])

function isWelcomePath(pathname) {
  try {
    const segs = String(pathname || '/').split('/').filter(Boolean)
    if (segs.length === 0) return true
    if (segs.length === 1 && !RESERVED_TOP_SEGMENTS.has(segs[0])) return true
    return false
  } catch {
    return false
  }
}

function StripGradesPrefix() {
  const location = useLocation()
  const path = String(location.pathname || '')
  const rest = path.replace(/^\/grades/, '') || '/'
  if (rest === '/' || rest === '') {
    return <Navigate to="/grades" replace />
  }
  const next = rest.startsWith('/') ? rest : `/${rest}`
  return <Navigate to={next} replace />
}

function AppContent() {
  const [showWelcome, setShowWelcome] = useState(() => isWelcomePath(window.location.pathname))
  const [showAuthAfterWelcome, setShowAuthAfterWelcome] = useState(false)

  const handleWelcomeDismiss = () => {
    setShowWelcome(false)
    setShowAuthAfterWelcome(true)
  }

  const handleAuthClose = () => {
    setShowAuthAfterWelcome(false)
  }

  useEffect(() => {
    applyGradientVariety(document)
  }, [])

  useEffect(() => {
    const onShowWelcome = () => {
      setShowWelcome(true)
      setShowAuthAfterWelcome(false)
    }
    window.addEventListener('app:show-welcome', onShowWelcome)
    return () => window.removeEventListener('app:show-welcome', onShowWelcome)
  }, [])

  return (
    <>
      <FluidBackground zIndex={-25} />
      <BackgroundImagesLayer mode={showWelcome ? 'welcome' : showAuthAfterWelcome ? 'auth' : 'app'} />
      <MarqueeLayer mode={showWelcome ? 'welcome' : showAuthAfterWelcome ? 'auth' : 'app'} />
      <AnimatePresence mode="wait">
        {showWelcome ? (
          <WelcomeScreen key="welcome" onDismiss={handleWelcomeDismiss} />
        ) : showAuthAfterWelcome ? (
          <motion.div
            key="initial-auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <AuthModal isInitialScreen={true} onCloseOverride={handleAuthClose} />
          </motion.div>
        ) : (
          <motion.div
            key="main-app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <Routes>
              <Route path="/reset-password" element={<PasswordResetConfirmPage />} />
              <Route path="/progress" element={<Navigate to="/grades" replace />} />
              <Route path="/grades" element={<Layout />}>
                <Route index element={<ProgressPage />} />
              </Route>
              <Route path="/grades/*" element={<StripGradesPrefix />} />
              <Route element={<Layout />}>
                <Route path="/" element={<RedirectRoot />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/overview" element={<Navigate to="/courses" replace />} />
                <Route path="/my-courses" element={<MyCoursesPage />} />
                <Route path="/schedule" element={<SchedulePage />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="/my-courses/:id" element={<CourseOverviewPage />} />
                <Route path="/my-courses/:id/topics/:topicId" element={<CourseTopicPage />} />
                <Route path="/archived" element={<Navigate to="/my-courses" replace />} />
                <Route path="/recent" element={<div className="text-2xl font-bold">Недавние</div>} />
                <Route path="/settings" element={<div className="text-2xl font-bold">Настройки</div>} />
                <Route path="/theme" element={<ThemeSettingsPage />} />
                <Route path="/appearance" element={<ThemesGalleryPage />} />
                <Route path="/themes" element={<Navigate to="/appearance" replace />} />
                <Route path="/chat" element={<UserChat />} />
                <Route path="/teacher" element={<TeacherLayout />}>
                  <Route index element={<Navigate to="groups" replace />} />
                  <Route path="groups" element={<TeacherGroups />} />
                  <Route path="schedule" element={<TeacherSchedulePage />} />
                  <Route path="groups/:id" element={<TeacherGroupDetails />} />
                  <Route path="groups/:id/assignments/:aid" element={<TeacherAssignment />} />
                  <Route path="archived" element={<Navigate to="groups" replace />} />
                  <Route path="chat" element={<UserChat />} />
                  <Route path="recent" element={<Navigate to="/teacher/groups" replace />} />
                  <Route path="appearance" element={<ThemesGalleryPage />} />
                </Route>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="courses" replace />} />
                  <Route path="store" element={<AdminStore />} />
                  <Route path="banner" element={<AdminBanner />} />
                  <Route path="university" element={<AdminUniversity />} />
                  <Route path="courses" element={<AdminCourses />} />
                  <Route path="staff" element={<AdminStaff />} />
                  <Route path="students" element={<AdminStudents />} />
                  <Route path="payments" element={<AdminPayments />} />
                  <Route path="distribution" element={<AdminDistribution />} />
                  <Route path="documents" element={<AdminDocuments />} />
                  <Route path="tickets" element={<AdminTickets />} />
                  <Route path="chat" element={<AdminChat />} />
                </Route>
              </Route>
              <Route path="/:universitySlug" element={<UniversityLayout />}>
                <Route index element={<UniversityRedirectRoot />} />
                <Route path="courses" element={<UniversityCoursesPage />} />
                <Route path="overview" element={<Navigate to="courses" replace />} />
                <Route path="my-courses" element={<UniversityMyCoursesPage />} />
                <Route path="payments" element={<UniversityPaymentsPage />} />
                <Route path="schedule" element={<SchedulePage />} />
                <Route path="progress" element={<Navigate to="grades" replace />} />
                <Route path="grades" element={<UniversityProgressPage />} />
                <Route path="my-courses/:id" element={<UniversityCourseOverviewPage />} />
                <Route path="my-courses/:id/topics/:topicId" element={<UniversityCourseTopicPage />} />
                <Route path="archived" element={<Navigate to="my-courses" replace />} />
                <Route path="recent" element={<div className="text-2xl font-bold">Недавние</div>} />
                <Route path="settings" element={<div className="text-2xl font-bold">Настройки</div>} />
                <Route path="theme" element={<UniversityThemeSettingsPage />} />
                <Route path="appearance" element={<UniversityThemesGalleryPage />} />
                <Route path="themes" element={<Navigate to="appearance" replace />} />
                <Route path="chat" element={<UniversityUserChat />} />
                <Route path="teacher" element={<UniversityTeacherLayout />}>
                  <Route index element={<Navigate to="groups" replace />} />
                  <Route path="groups" element={<UniversityTeacherGroups />} />
                  <Route path="schedule" element={<TeacherSchedulePage />} />
                  <Route path="groups/:id" element={<UniversityTeacherGroupDetails />} />
                  <Route path="groups/:id/assignments/:aid" element={<UniversityTeacherAssignment />} />
                  <Route path="archived" element={<Navigate to="groups" replace />} />
                  <Route path="chat" element={<UniversityUserChat />} />
                  <Route path="recent" element={<Navigate to="groups" replace />} />
                  <Route path="appearance" element={<UniversityThemesGalleryPage />} />
                </Route>
                <Route path="admin" element={<UniversityAdminLayout />}>
                  <Route index element={<Navigate to="courses" replace />} />
                  <Route path="store" element={<UniversityAdminStore />} />
                  <Route path="banner" element={<UniversityAdminBanner />} />
                  <Route path="university" element={<UniversityAdminUniversity />} />
                  <Route path="courses" element={<UniversityAdminCourses />} />
                  <Route path="staff" element={<UniversityAdminStaff />} />
                  <Route path="students" element={<UniversityAdminStudents />} />
                  <Route path="payments" element={<UniversityAdminPayments />} />
                  <Route path="distribution" element={<UniversityAdminDistribution />} />
                  <Route path="documents" element={<UniversityAdminDocuments />} />
                  <Route path="tickets" element={<AdminTickets />} />
                  <Route path="chat" element={<UniversityAdminChat />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/my-courses" replace />} />
            </Routes>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
