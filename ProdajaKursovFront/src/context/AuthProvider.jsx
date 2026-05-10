import React, { useState, useEffect } from 'react'
import { getUser, signOut, signInWithEmail, refreshMeIfPossible, signInDemo } from '../lib/auth'
import { api } from '../lib/api'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getUser())
  const [accessModules, setAccessModules] = useState(null)
  const [isAuthModalOpen, setAuthModalOpen] = useState(false)
  const [isAuthLoading, setAuthLoading] = useState(false)
  const [purchasedCourses, setPurchasedCourses] = useState(() => {
    try {
      const saved = localStorage.getItem('purchased_courses')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [paymentPlans, setPaymentPlans] = useState(() => {
    try {
      const saved = localStorage.getItem('payments_plans')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [archivedCourses, setArchivedCourses] = useState(() => {
    try {
      const saved = localStorage.getItem('archived_courses')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('purchased_courses', JSON.stringify(purchasedCourses))
  }, [purchasedCourses])
  useEffect(() => {
    localStorage.setItem('archived_courses', JSON.stringify(archivedCourses))
  }, [archivedCourses])
  useEffect(() => {
    localStorage.setItem('payments_plans', JSON.stringify(paymentPlans))
  }, [paymentPlans])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setAuthLoading(true)
      const fresh = await refreshMeIfPossible()
      if (!cancelled && fresh) setUser(fresh)
      if (!cancelled) setAuthLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!user) {
      setAccessModules(null)
      return () => { cancelled = true }
    }
    ;(async () => {
      try {
        const data = await api.users.access()
        if (cancelled) return
        const modules = Array.isArray(data?.modules) ? data.modules : []
        setAccessModules(modules)
      } catch {
        if (!cancelled) setAccessModules([])
      }
    })()
    return () => { cancelled = true }
  }, [user?.id, user?.role?.id, user?.account_type, user?.is_superuser])

  const logout = async () => {
    const isOwner = !!user && (user.is_superuser || user.account_type === 'owner')
    try {
      await signOut()
    } catch {
      void 0
    }
    setUser(null)
    setAccessModules(null)
    setPurchasedCourses([])
    setArchivedCourses([])
    setPaymentPlans([])
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(k => {
        if (k.startsWith('topic_result_') || k.startsWith('topic_test_completed_') || k.startsWith('course_topics_')) {
          localStorage.removeItem(k)
        }
      })
    } catch { void 0 }
    let dest = '/'
    try {
      if (!isOwner) {
        const remembered = localStorage.getItem('last_university_slug') || ''
        if (remembered) dest = `/${remembered}`
      }
    } catch { void 0 }
    try {
      window.history.pushState({}, '', dest)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch { void 0 }
    try {
      window.dispatchEvent(new CustomEvent('app:show-welcome'))
    } catch { void 0 }
  }

  const openAuthModal = () => setAuthModalOpen(true)
  const closeAuthModal = () => setAuthModalOpen(false)

  const loginWithEmail = async (email, password) => {
    const newUser = await signInWithEmail(email, password)
    setUser(newUser)
    try {
      const isOwner = !!newUser && (newUser.is_superuser || newUser.account_type === 'owner')
      if (isOwner) {
        localStorage.removeItem('last_university_slug')
      } else {
        const slug = String(newUser?.university_slug || '').trim()
        if (slug) {
          localStorage.setItem('last_university_slug', slug)
        }
      }
    } catch { void 0 }
    setAuthModalOpen(false)
    return newUser
  }

  const loginAsDemoStudent = () => {
    const demo = signInDemo('student')
    setUser(demo)
    setAuthModalOpen(false)
    return demo
  }

  const loginAsDemoTeacher = () => {
    const demo = signInDemo('teacher')
    setUser(demo)
    setAuthModalOpen(false)
    return demo
  }

  const purchaseCourse = (course) => {
    setPurchasedCourses(prev => {
      const exists = prev.some(c => c.id === course.id)
      if (exists) return prev
      return [...prev, { id: course.id, title: course.title, image: course.image }]
    })
  }
  const purchaseCourseWithPlan = (course, { firstName, lastName, months }) => {
    purchaseCourse(course)
    const total = Number(course.price || 0)
    const planMonths = Number(months || 0)
    const monthlyAmount = planMonths > 0 ? Math.ceil(total / planMonths) : total
    const startDate = new Date().toISOString()
    const interestRatePerDay = 0.001
    setPaymentPlans(prev => {
      const next = prev.filter(p => !(p.email === (user?.email || '') && p.courseId === course.id))
      return [
        ...next,
        {
          email: user?.email || '',
          courseId: course.id,
          title: course.title,
          total,
          planMonths,
          monthlyAmount,
          startDate,
          payments: [],
          firstName: firstName || user?.first_name || '',
          lastName: lastName || user?.last_name || '',
          interestRatePerDay
        }
      ]
    })
  }

  const removePurchasedCourse = (id) => {
    setPurchasedCourses(prev => prev.filter(c => c.id !== id))
  }

  const isCoursePurchased = (id) => purchasedCourses.some(c => c.id === id)
  const archiveCourse = (id) => {
    setPurchasedCourses(prev => {
      const course = prev.find(c => c.id === id)
      if (!course) return prev
      setArchivedCourses(a => {
        const exists = a.some(c => c.id === id)
        return exists ? a : [...a, course]
      })
      return prev.filter(c => c.id !== id)
    })
  }
  const unarchiveCourse = (id) => {
    setArchivedCourses(prev => prev.filter(c => c.id !== id))
  }
  const getUserPayments = () => {
    const email = String(user?.email || '').trim().toLowerCase()
    try {
      const raw = JSON.parse(localStorage.getItem('payments_plans') || '[]')
      const normalized = raw.map(p => ({ ...p, email: String(p.email || '').trim().toLowerCase() }))
      if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
        try { localStorage.setItem('payments_plans', JSON.stringify(normalized)) } catch { void 0 }
      }
      return normalized.filter(p => p.email === email)
    } catch {
      return paymentPlans.filter(p => String(p.email || '').trim().toLowerCase() === email)
    }
  }

  const hasModuleAccess = (moduleCode) => {
    if (!user) return false
    if (user.is_superuser || user.account_type === 'owner') return true
    const list = Array.isArray(accessModules) ? accessModules : []
    const code = String(moduleCode || '')
    if (!code) return false
    const m = list.find(x => String(x?.code || '') === code)
    return !!m?.has_access
  }

  const hasPermission = (permissionCode) => {
    if (!user) return false
    if (user.is_superuser || user.account_type === 'owner') return true
    const codes = Array.isArray(permissionCode) ? permissionCode : [permissionCode]
    const wanted = codes.map(c => String(c || '').trim()).filter(Boolean)
    if (wanted.length === 0) return false
    const modules = Array.isArray(accessModules) ? accessModules : []
    for (const m of modules) {
      const actions = Array.isArray(m?.actions) ? m.actions : []
      for (const a of actions) {
        if (a?.granted && wanted.includes(String(a?.code || ''))) return true
      }
    }
    return false
  }

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isAuthLoading,
      isAdmin: !!user && user.account_type !== 'teacher' && user.account_type !== 'student',
      accessModules,
      hasModuleAccess,
      hasPermission,
      loginWithEmail,
      loginAsDemoStudent,
      loginAsDemoTeacher,
      logout,
      isAuthModalOpen,
      openAuthModal,
      closeAuthModal,
      purchasedCourses,
      purchaseCourse,
      purchaseCourseWithPlan,
      removePurchasedCourse,
      isCoursePurchased,
      archivedCourses,
      archiveCourse,
      unarchiveCourse,
      paymentPlans,
      getUserPayments
    }}>
      {children}
    </AuthContext.Provider>
  )
}
