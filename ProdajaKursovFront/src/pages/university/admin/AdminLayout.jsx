import { NavLink, Outlet, Navigate, useLocation, useParams } from 'react-router-dom'
import { Shield, BookOpen, Users, GraduationCap, Settings, Inbox, FileText, MessageCircle, CreditCard, Image as ImageIcon, Building2 } from 'lucide-react'
import { motion as fmMotion } from 'framer-motion'
import { useAuth } from '../../../context/AuthContext'
import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, message: String(error && error.message || 'Ошибка') }
  }
  componentDidCatch(error) {
    try { console.error(error) } catch {}
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 admin-card rounded-xl">
          <div className="text-white font-semibold mb-2">Произошла ошибка</div>
          <div className="text-red-400 font-semibold text-sm mb-3 whitespace-pre-line">{this.state.message}</div>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white"
          >
            Обновить
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
export default function AdminLayout() {
  const { isAdmin, isAuthenticated, user, accessModules, hasModuleAccess } = useAuth()
  const { universitySlug } = useParams()
  const location = useLocation()
  const base = universitySlug ? `/${universitySlug}` : ''
  React.useEffect(() => {
    if (!isAdmin) return
    try { localStorage.setItem('admin_search_query', '') } catch {}
    try { window.dispatchEvent(new CustomEvent('admin_search_update', { detail: { query: '' } })) } catch {}
  }, [isAdmin])
  React.useEffect(() => {
    if (!isAdmin) return
    try {
      const seeded = localStorage.getItem('admin_demo_seeded_v1')
      if (seeded) return
      let roles = []
      try {
        const raw = localStorage.getItem('admin_roles')
        roles = raw ? JSON.parse(raw) : []
      } catch {
        roles = []
      }
      if (roles.length === 0) {
        roles = [
          { id: 'role-mentor', name: 'Ментор', permissions: ['courses', 'students', 'distribution'] },
          { id: 'role-methodist', name: 'Методист', permissions: ['courses', 'store', 'distribution'] }
        ]
        localStorage.setItem('admin_roles', JSON.stringify(roles))
      }
      let staff = []
      try {
        const raw = localStorage.getItem('admin_staff')
        staff = raw ? JSON.parse(raw) : []
      } catch {
        staff = []
      }
      {
        const names = [
          ['Иванов', 'Иван'], ['Петров', 'Алексей'], ['Смирнова', 'Анна'],
          ['Козлова', 'Екатерина'], ['Николаев', 'Дмитрий'], ['Васильева', 'Мария'],
          ['Соколов', 'Павел'], ['Кузнецова', 'Ольга'], ['Орлова', 'Юлия'], ['Егоров', 'Михаил']
        ]
        const now = Date.now()
        const toAdd = []
        for (let i = 0; i < 6; i++) {
          const pair = names[(i % names.length)]
          const id = `staff-${now}-${i}`
          const roleId = roles[i % roles.length].id
          toAdd.push({
            id,
            lastName: pair[0],
            firstName: pair[1],
            patronymic: '',
            email: `staff_demo_${now}_${i}@example.com`,
            password: 'pass123',
            roleId
          })
        }
        staff = [...staff, ...toAdd]
        localStorage.setItem('admin_staff', JSON.stringify(staff))
      }
      let students = []
      try {
        const raw = localStorage.getItem('admin_students_list')
        students = raw ? JSON.parse(raw) : []
      } catch {
        students = []
      }
      {
        const sNames = [
          ['Морозов', 'Илья'], ['Фёдорова', 'Виктория'], ['Андреев', 'Сергей'],
          ['Павлова', 'Ксения'], ['Григорьев', 'Никита'], ['Макарова', 'Полина'],
          ['Семенов', 'Роман'], ['Степанова', 'Алёна']
        ]
        const now2 = Date.now()
        const staffIds = staff.map(s => s.id)
        const pickStaff = () => {
          if (staffIds.length === 0) return []
          const a = staffIds[Math.floor(Math.random() * staffIds.length)]
          const b = staffIds[Math.floor(Math.random() * staffIds.length)]
          return Array.from(new Set([a, b])).filter(Boolean)
        }
        const toAddS = []
        for (let i = 0; i < 6; i++) {
          const pair = sNames[(i % sNames.length)]
          const id = `stu-${now2}-${i}`
          toAddS.push({
            id,
            lastName: pair[0],
            firstName: pair[1],
            patronymic: '',
            email: `student_demo_${now2}_${i}@example.com`,
            password: '123456',
            birthYear: '',
            courses: [],
            assignedStaffIds: pickStaff()
          })
        }
        students = [...students, ...toAddS]
        localStorage.setItem('admin_students_list', JSON.stringify(students))
      }
      let groups = []
      try {
        const raw = localStorage.getItem('admin_groups')
        groups = raw ? JSON.parse(raw) : []
      } catch {
        groups = []
      }
      if (groups.length === 0) {
        const allStudentIds = students.map(s => s.id)
        const rndSubset = (n) => {
          const copy = [...allStudentIds]
          const res = []
          for (let i = 0; i < n && copy.length > 0; i++) {
            const idx = Math.floor(Math.random() * copy.length)
            res.push(copy.splice(idx, 1)[0])
          }
          return res
        }
        groups = [
          { id: `grp_${Date.now()}_a`, name: 'Группа Альфа', type: 'слушатели', memberIds: rndSubset(4) },
          { id: `grp_${Date.now()}_b`, name: 'Группа Бета', type: 'студенты', memberIds: rndSubset(4) }
        ]
        localStorage.setItem('admin_groups', JSON.stringify(groups))
      }
      let tickets = []
      try {
        tickets = JSON.parse(localStorage.getItem('admin_tickets')) || []
      } catch {
        tickets = []
      }
      if (tickets.length === 0) {
        const sampleSubjects = [
          'Вопрос по оплате рассрочки',
          'Не приходит доступ к курсу',
          'Ошибка при входе в аккаунт',
          'Проблема с загрузкой материалов'
        ]
        const sampleMessages = [
          'Оплатил первый платеж по рассрочке, но не отразилось в разделе платежей.',
          'Купил курс, но нет доступа в «Мои курсы». Помогите, пожалуйста.',
          'Сбрасываю пароль, но письмо не приходит. Проверил спам, нет письма.',
          'При открытии темы браузер зависает, материалы не загружаются.'
        ]
        const toAddT = sampleSubjects.map((subj, i) => {
          const s = students[i % students.length] || null
          const studName = s ? [s.lastName, s.firstName, s.patronymic].filter(Boolean).join(' ').trim() : 'Демо Пользователь'
          const studEmail = s?.email || `demo_student_${i}@example.com`
          const assignedIds = Array.isArray(s?.assignedStaffIds) ? s.assignedStaffIds : []
          const moderators = assignedIds.map(id => {
            const st = staff.find(x => x.id === id)
            return st ? { id: st.id, firstName: st.firstName, lastName: st.lastName, email: st.email } : null
          }).filter(Boolean)
          return {
            id: `t_${Date.now()}_${i}`,
            subject: subj,
            message: sampleMessages[i % sampleMessages.length],
            images: [],
            createdAt: new Date(Date.now() - i * 3600_000).toISOString(),
            student: { name: studName, email: studEmail },
            courses: [],
            moderators,
            status: 'open',
            assignedTo: null
          }
        })
        localStorage.setItem('admin_tickets', JSON.stringify(toAddT))
      }
      localStorage.setItem('admin_demo_seeded_v1', '1')
    } catch { void 0 }
  }, [isAdmin])
  React.useEffect(() => {
    if (!isAdmin) return
    try {
      const rawG = localStorage.getItem('admin_groups')
      const groups = rawG ? JSON.parse(rawG) : []
      const needNames = [
        { name: 'П50-8-22', type: 'студенты' },
        { name: 'П50-9-22', type: 'слушатели' }
      ]
      const missing = needNames.filter(n => !groups.some(g => (g.name || '').toLowerCase() === n.name.toLowerCase()))
      if (missing.length > 0) {
        let students = []
        try { students = JSON.parse(localStorage.getItem('admin_students_list')) || [] } catch { students = [] }
        const allIds = students.map(s => s.id)
        const rndSubset = (n) => {
          const copy = [...allIds]
          const res = []
          for (let i = 0; i < n && copy.length > 0; i++) {
            const idx = Math.floor(Math.random() * copy.length)
            res.push(copy.splice(idx, 1)[0])
          }
          return res
        }
        const toAdd = missing.map((m, i) => ({
          id: `grp_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`,
          name: m.name,
          type: m.type,
          memberIds: rndSubset(4)
        }))
        const next = [...groups, ...toAdd]
        localStorage.setItem('admin_groups', JSON.stringify(next))
      }
    } catch { void 0 }
  }, [isAdmin])
  React.useEffect(() => {
    if (!isAdmin) return
    try {
      if (!localStorage.getItem('admin_payments_seeded_v1')) {
        let students = []
        let staff = []
        try { students = JSON.parse(localStorage.getItem('admin_students_list')) || [] } catch { students = [] }
        try { staff = JSON.parse(localStorage.getItem('admin_staff')) || [] } catch { staff = [] }
        const ids = staff.map(s => s.id)
        const pickStaff = () => {
          if (ids.length === 0) return []
          const a = ids[Math.floor(Math.random() * ids.length)]
          const b = ids[Math.floor(Math.random() * ids.length)]
          return Array.from(new Set([a, b])).filter(Boolean)
        }
        if (students.length < 28) {
          const extra = [
            ['Зайцев','Егор'], ['Медведева','Алиса'], ['Назаров','Тимур'], ['Михайлова','Вера'],
            ['Крылов','Арсений'], ['Комарова','Диана'], ['Сафонов','Иван'], ['Яковлева','Елизавета'],
            ['Ефимов','Кирилл'], ['Литвинова','Софья'], ['Сергеев','Максим'], ['Романова','Дарья'],
            ['Данилов','Артём'], ['Киселёва','Анастасия'], ['Беляев','Матвей'], ['Галкина','Ева']
          ]
          const now = Date.now()
          const add = extra.slice(0, 30 - students.length).map((p, i) => ({
            id: `stu-${now}-ex-${i}`,
            lastName: p[0],
            firstName: p[1],
            patronymic: '',
            email: `student_extra_${now}_${i}@example.com`,
            password: '123456',
            birthYear: '',
            courses: [],
            assignedStaffIds: pickStaff()
          }))
          students = [...students, ...add]
          localStorage.setItem('admin_students_list', JSON.stringify(students))
        }
        let storeCourses = []
        try { storeCourses = JSON.parse(localStorage.getItem('store_courses')) || [] } catch { storeCourses = [] }
        const baseCourses = storeCourses.length > 0
          ? storeCourses.map(c => ({ id: c.id, title: c.title, price: Number(c.price || 9990) }))
          : [
              { id: 'c1', title: 'React Native Masterclass', price: 19990 },
              { id: 'c2', title: 'SQL Fundamentals', price: 14990 },
              { id: 'c3', title: 'Fullstack Python', price: 24990 },
              { id: 'c4', title: 'UI/UX Design', price: 12990 }
            ]
        const pickCourse = () => baseCourses[Math.floor(Math.random() * baseCourses.length)]
        let plans = []
        try { plans = JSON.parse(localStorage.getItem('payments_plans')) || [] } catch { plans = [] }
        const existed = new Set(plans.map(p => `${(p.email || '').toLowerCase()}__${p.courseId}`))
        const addPlan = (email) => {
          const course = pickCourse()
          const monthsOpts = [3, 6, 12]
          const planMonths = monthsOpts[Math.floor(Math.random() * monthsOpts.length)]
          const total = course.price + Math.floor(Math.random() * 5000)
          const monthlyAmount = Math.ceil(total / planMonths)
          const startDate = new Date()
          startDate.setMonth(startDate.getMonth() - Math.floor(Math.random() * (planMonths - 1)))
          const paidCount = Math.max(0, Math.min(planMonths - 1, Math.floor(Math.random() * planMonths)))
          const payments = []
          for (let i = 0; i < paidCount; i++) {
            const d = new Date(startDate.getTime())
            d.setMonth(startDate.getMonth() + i + 1)
            payments.push({ date: d.toISOString(), amount: monthlyAmount })
          }
          const key = `${email.toLowerCase()}__${course.id}`
          if (!existed.has(key)) {
            existed.add(key)
            plans.push({
              email,
              courseId: course.id,
              title: course.title,
              total,
              planMonths,
              monthlyAmount,
              startDate: startDate.toISOString(),
              payments,
              firstName: '',
              lastName: '',
              interestRatePerDay: 0.001
            })
          }
        }
        const emails = students.map(s => s.email).filter(Boolean)
        emails.forEach(e => {
          if (Math.random() < 0.7) addPlan(e)
          if (Math.random() < 0.25) addPlan(e)
        })
        localStorage.setItem('payments_plans', JSON.stringify(plans))
        let groups = []
        try { groups = JSON.parse(localStorage.getItem('admin_groups')) || [] } catch { groups = [] }
        if (groups.length > 0) {
          const allIds = students.map(s => s.id)
          groups = groups.map(g => {
            const set = new Set(g.memberIds || [])
            for (let i = 0; i < 8; i++) {
              const id = allIds[Math.floor(Math.random() * allIds.length)]
              if (id) set.add(id)
            }
            return { ...g, memberIds: Array.from(set) }
          })
          localStorage.setItem('admin_groups', JSON.stringify(groups))
        }
        localStorage.setItem('admin_payments_seeded_v1', '1')
      }
    } catch { void 0 }
  }, [isAdmin])

  if (!isAuthenticated) return <Navigate to={base || '/'} replace />
  if (!isAdmin) return <Navigate to={`${base}/courses`} replace />
  const isEmployee = user?.account_type === 'employee'
  const canDecideAccess = !isEmployee || accessModules !== null
  const canSee = (moduleCode) => (!isEmployee ? true : hasModuleAccess(moduleCode))
  const isOwner = user?.is_superuser || user?.account_type === 'owner'
  const ownerUniversityScope = isOwner && (() => {
    try {
      return new URLSearchParams(location.search || '').get('university_scope') === '1'
    } catch {
      return false
    }
  })()
  const scopeSuffix = ownerUniversityScope ? '?university_scope=1' : ''
  const withScope = (to) => `${to}${scopeSuffix}`
  const sections = [
    { to: 'store', module: 'store_settings' },
    { to: 'banner', module: 'banner' },
    { to: 'courses', module: 'courses' },
    { to: 'staff', module: 'employees' },
    { to: 'distribution', module: 'distribution' },
    { to: 'students', module: 'students' },
    { to: 'payments', module: 'payments' },
    { to: 'documents', module: 'documents' },
    { to: 'chat', module: 'chats' },
    { to: 'tickets', module: 'applications' },
  ]
  const allowedSections = !isEmployee ? sections : sections.filter(s => hasModuleAccess(s.module))
  if (isEmployee && canDecideAccess) {
    const segs = String(location.pathname || '').split('/').filter(Boolean)
    const idx = segs.indexOf('admin')
    const activeSeg = idx >= 0 ? (segs[idx + 1] || '') : ''
    const allowedSet = new Set(allowedSections.map(s => s.to))
    if (allowedSections.length > 0 && (!activeSeg || !allowedSet.has(activeSeg))) {
      return <Navigate to={`${base}/admin/${allowedSections[0].to}`} replace />
    }
  }
  return (
    <div className="space-y-2 sm:space-y-8 pb-20 pt-28 sm:pt-32">
      <div className="fixed inset-x-0 top-24 z-[9980] px-4 md:px-6 flex justify-center">
        <fmMotion.div
          className="p-4 glass rounded-xl w-full sm:w-[80%] max-w-[1600px] mx-auto shadow-xl"

          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          data-header="true"
          data-admin-header="true"
        >
          <div className="w-full mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center admin-mobile-hide">
                <Shield size={18} className="text-white/80" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">Админ-панель</h1>
                <p className="text-white/80 text-xs admin-mobile-hide">Управление платформой</p>
              </div>
            </div>
            <div className="mt-3 w-full flex flex-col lg:flex-row items-stretch lg:items-center gap-2 sm:gap-3">
              <div className="grid grid-flow-col auto-cols-max sm:auto-cols-fr gap-2 text-sm w-full mx-auto overflow-x-auto whitespace-nowrap pr-2">
                {canSee('store_settings') && <NavLink
                  to={withScope('store')}
                  className={({ isActive }) =>
                    `px-2 h-11 rounded-md border flex items-center justify-center gap-2 transition w-full
                    ${isActive ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`
                  }
                >
                  <Settings size={16} className="shrink-0" />
                  <span className="inline xl:hidden whitespace-nowrap overflow-hidden text-ellipsis">Магазин</span>
                  <span className="hidden xl:inline whitespace-nowrap overflow-hidden text-ellipsis">Настройка магазина</span>
                </NavLink>}
                {canSee('banner') && <NavLink
                  to={withScope('banner')}
                  className={({ isActive }) =>
                    `px-2 h-11 rounded-md border flex items-center justify-center gap-2 transition w-full
                    ${isActive ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`
                  }
                >
                  <ImageIcon size={16} className="shrink-0" />
                  <span className="inline xl:hidden whitespace-nowrap overflow-hidden text-ellipsis">Баннер</span>
                  <span className="hidden xl:inline whitespace-nowrap overflow-hidden text-ellipsis">Управление баннером</span>
                </NavLink>}
                {canSee('courses') && <NavLink
                  to={withScope('courses')}
                  className={({ isActive }) =>
                    `px-2 h-11 rounded-md border flex items-center justify-center gap-2 transition w-full
                    ${isActive ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`
                  }
                >
                  <BookOpen size={16} className="shrink-0" />
                  <span className="inline xl:hidden whitespace-nowrap overflow-hidden text-ellipsis">Курсы</span>
                  <span className="hidden xl:inline whitespace-nowrap overflow-hidden text-ellipsis">Курсы</span>
                </NavLink>}
                {canSee('employees') && <NavLink
                  to={withScope('staff')}
                  className={({ isActive }) =>
                    `px-2 h-11 rounded-md border flex items-center justify-center gap-2 transition w-full
                    ${isActive ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`
                  }
                >
                  <Users size={16} className="shrink-0" />
                  <span className="inline xl:hidden whitespace-nowrap overflow-hidden text-ellipsis">Сотр.</span>
                  <span className="hidden xl:inline whitespace-nowrap overflow-hidden text-ellipsis">Сотрудники</span>
                </NavLink>}
                {canSee('distribution') && <NavLink
                  to={withScope('distribution')}
                  className={({ isActive }) =>
                    `px-2 h-11 rounded-md border flex items-center justify-center gap-2 transition w-full
                    ${isActive ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`
                  }
                >
                  <Users size={16} className="shrink-0" />
                  <span className="inline xl:hidden whitespace-nowrap overflow-hidden text-ellipsis">Расп.</span>
                  <span className="hidden xl:inline whitespace-nowrap overflow-hidden text-ellipsis">Распределение</span>
                </NavLink>}
                {canSee('students') && <NavLink
                  to={withScope('students')}
                  className={({ isActive }) =>
                    `px-2 h-11 rounded-md border flex items-center justify-center gap-2 transition w-full
                    ${isActive ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`
                  }
                >
                  <GraduationCap size={16} className="shrink-0" />
                  <span className="inline xl:hidden whitespace-nowrap overflow-hidden text-ellipsis">Уч.</span>
                  <span className="hidden xl:inline whitespace-nowrap overflow-hidden text-ellipsis">Учащиеся</span>
                </NavLink>}
                {canSee('payments') && <NavLink
                  to={withScope('payments')}
                  className={({ isActive }) =>
                    `px-2 h-11 rounded-md border flex items-center justify-center gap-2 transition w-full
                    ${isActive ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`
                  }
                >
                  <CreditCard size={16} className="shrink-0" />
                  <span className="inline xl:hidden whitespace-nowrap overflow-hidden text-ellipsis">Опл.</span>
                  <span className="hidden xl:inline whitespace-nowrap overflow-hidden text-ellipsis">Оплата</span>
                </NavLink>}
                {canSee('documents') && <NavLink
                  to={withScope('documents')}
                  className={({ isActive }) =>
                    `px-2 h-11 rounded-md border flex items-center justify-center gap-2 transition w-full
                    ${isActive ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`
                  }
                >
                  <FileText size={16} className="shrink-0" />
                  <span className="inline xl:hidden whitespace-nowrap overflow-hidden text-ellipsis">Док.</span>
                  <span className="hidden xl:inline whitespace-nowrap overflow-hidden text-ellipsis">Документы</span>
                </NavLink>}
                {canSee('chats') && <NavLink
                  to={withScope('chat')}
                  className={({ isActive }) =>
                    `px-2 h-11 rounded-md border flex items-center justify-center gap-2 transition w-full
                    ${isActive ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`
                  }
                >
                  <MessageCircle size={16} className="shrink-0" />
                  <span className="inline xl:hidden whitespace-nowrap overflow-hidden text-ellipsis">Чаты</span>
                  <span className="hidden xl:inline whitespace-nowrap overflow-hidden text-ellipsis">Чаты</span>
                </NavLink>}
                {canSee('applications') && <NavLink
                  to={withScope('tickets')}
                  className={({ isActive }) =>
                    `px-2 h-11 rounded-md border flex items-center justify-center gap-2 transition w-full
                    ${isActive ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`
                  }
                >
                  <Inbox size={16} className="shrink-0" />
                  <span className="inline xl:hidden whitespace-nowrap overflow-hidden text-ellipsis">Заявки</span>
                  <span className="hidden xl:inline whitespace-nowrap overflow-hidden text-ellipsis">Принятие заявок</span>
                </NavLink>}
                {!universitySlug && (
                  <NavLink
                    to="university"
                    className={({ isActive }) =>
                      `px-2 h-11 rounded-md border flex items-center justify-center gap-2 transition w-full
                      ${isActive ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`
                    }
                  >
                    <Building2 size={16} className="shrink-0" />
                    <span className="inline xl:hidden whitespace-nowrap overflow-hidden text-ellipsis">ВУЗы</span>
                    <span className="hidden xl:inline whitespace-nowrap overflow-hidden text-ellipsis">Университеты</span>
                  </NavLink>
                )}
              </div>
            </div>
          </div>
        </fmMotion.div>
      </div>
      <div className="w-full max-w-screen-2xl mx-auto px-4 md:px-6">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  )
}
