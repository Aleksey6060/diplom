import React, { useEffect, useMemo, useState, useRef } from 'react'
import { Pencil, Trash2, UserPlus, Shield, ChevronDown, CheckCircle2, X, Info } from 'lucide-react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { api } from '../../lib/api'
import CustomSelect from '../../components/CustomSelect'
import { useAuth } from '../../context/AuthContext'

// PERMISSION_CATALOG fetched dynamically from backend via api.users.permissions.modules()

export default function AdminStaff() {
  const { hasPermission, accessModules } = useAuth()
  const canViewStaff = hasPermission('employees.staff.view')
  const canCreateStaff = hasPermission('employees.staff.create')
  const canEditStaff = hasPermission('employees.staff.edit')
  const canRemoveStaff = hasPermission('employees.staff.remove')
  const canViewRoles = hasPermission('employees.roles.view')
  const canCreateRole = hasPermission('employees.roles.create')
  const canConfigureRole = hasPermission('employees.roles.configure')
  const canDeleteRole = hasPermission('employees.roles.delete')
  const canAccessRolesList = canViewRoles || canCreateStaff || canEditStaff
  const [roles, setRoles] = useState([])
  const [items, setItems] = useState([])
  const [permissionCatalog, setPermissionCatalog] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(null)
  const [showRole, setShowRole] = useState(false)
  const [staffCreateError, setStaffCreateError] = useState('')
  const [staffEditError, setStaffEditError] = useState('')
  const [roleError, setRoleError] = useState('')
  const [showRoleStaffs, setShowRoleStaffs] = useState(false)
  const [roleStaffRole, setRoleStaffRole] = useState(null)
  const [roleStaffItems, setRoleStaffItems] = useState([])
  const [roleStaffError, setRoleStaffError] = useState('')

  useEffect(() => {
    if (accessModules === null) return
    let cancelled = false
    ;(async () => {
      try {
        const [r, s, p] = await Promise.all([
          canAccessRolesList ? api.users.roles.list() : Promise.resolve([]),
          canViewStaff ? api.users.staff.list() : Promise.resolve([]),
          (canCreateRole || canConfigureRole)
            ? api.users.permissions.modules().catch(() => [])
            : Promise.resolve([]),
        ])
        if (!cancelled) {
          setRoles(Array.isArray(r) ? r : [])
          setItems(Array.isArray(s) ? s : [])
          setPermissionCatalog(Array.isArray(p) ? p : (Array.isArray(p?.results) ? p.results : []))
        }
      } catch {
        if (!cancelled) {
          setRoles([])
          setItems([])
        }
      }
    })()
    return () => { cancelled = true }
  }, [accessModules, canAccessRolesList, canViewStaff, canCreateRole, canConfigureRole])

  const [form, setForm] = useState({
    lastName: '',
    firstName: '',
    patronymic: '',
    email: '',
    phone: '',
    accountType: 'teacher',
    password: '',
    roleId: ''
  })

  const [editForm, setEditForm] = useState({
    id: '',
    lastName: '',
    firstName: '',
    patronymic: '',
    email: '',
    phone: '',
    accountType: 'teacher',
    password: '',
    roleId: ''
  })

  const [roleForm, setRoleForm] = useState({ name: '', permissions: [] })
  const [showRoleEdit, setShowRoleEdit] = useState(false)
  const [roleEditForm, setRoleEditForm] = useState({ id: null, name: '', permissions: [] })
  const [roleEditLoading, setRoleEditLoading] = useState(false)
  const [roleEditError, setRoleEditError] = useState('')
  const [adminQuery, setAdminQuery] = useState(() => {
    try { return localStorage.getItem('admin_search_query') || '' } catch { return '' }
  })
  const [roleFilter, setRoleFilter] = useState('')
  const [roleFilterOpen, setRoleFilterOpen] = useState(false)
  const roleFilterRef = useRef(null)
  const [roleMenuPos, setRoleMenuPos] = useState({ left: 0, top: 0, width: 0 })
  useEffect(() => {
    const onAdminSearch = (e) => { setAdminQuery((e.detail && e.detail.query) || '') }
    window.addEventListener('admin_search_update', onAdminSearch)
    return () => window.removeEventListener('admin_search_update', onAdminSearch)
  }, [])
  useEffect(() => {
    const onDocClick = (e) => {
      if (roleFilterOpen && roleFilterRef.current && !roleFilterRef.current.contains(e.target)) {
        setRoleFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [roleFilterOpen])

  const roleNameById = (id) => {
    if (!id) return ''
    return roles.find(r => String(r.id) === String(id))?.name || ''
  }
  const isOwner = (s) => s?.is_superuser || String(s?.account_type || '') === 'owner' || String(s?.account_type_display || '').toLowerCase() === 'владелец'
  const staffRoleLabel = (s) => {
    if (isOwner(s)) return 'Владелец'
    const roleId = (typeof s?.role === 'object' && s.role) ? s.role.id : s?.role
    return roleNameById(roleId) || ''
  }
  const permissionLabelByCode = useMemo(() => {
    const map = {}
    for (const module of permissionCatalog) {
      for (const action of (module.actions || [])) {
        map[action.code] = `${module.title}: ${action.title}`
      }
    }
    return (code) => map[code] || code
  }, [permissionCatalog])
  const [showRolesList, setShowRolesList] = useState(false)
  const [showRoleDetails, setShowRoleDetails] = useState(false)
  const [roleDetailsRole, setRoleDetailsRole] = useState(null)
  const [roleDetailsError, setRoleDetailsError] = useState('')

  const submitNewStaff = async () => {
    if (!canCreateStaff) return
    if (!form.lastName || !form.firstName || !form.email || !form.accountType || !form.password) return
    if (form.accountType === 'employee' && !form.roleId) return
    setStaffCreateError('')
    try {
      await api.users.staff.create({
        first_name: form.firstName,
        last_name: form.lastName,
        middle_name: form.patronymic || '',
        email: form.email,
        phone: (form.phone && form.phone.trim()) ? form.phone.trim() : null,
        password: form.password,
        account_type: form.accountType,
        role: form.accountType === 'employee' && form.roleId ? Number(form.roleId) : null,
      })
      const [r, s] = await Promise.all([
        canAccessRolesList ? api.users.roles.list() : Promise.resolve([]),
        canViewStaff ? api.users.staff.list() : Promise.resolve([]),
      ])
      setRoles(Array.isArray(r) ? r : [])
      setItems(Array.isArray(s) ? s : [])
      setShowCreate(false)
      setForm({ lastName: '', firstName: '', patronymic: '', email: '', phone: '', accountType: 'teacher', password: '', roleId: '' })
    } catch (e) {
      const msg = e?.body?.email?.[0] || e?.body?.password?.[0] || e?.body?.detail || 'Не удалось создать сотрудника'
      setStaffCreateError(String(msg))
    }
  }

  const openEdit = (item) => {
    if (!canViewStaff) return
    const roleId = (typeof item.role === 'object' && item.role) ? item.role.id : item.role
    setEditForm({
      id: item.id,
      lastName: (item.last_name || item.display_name || '').split(' ')[0] || '',
      firstName: item.first_name || '',
      patronymic: item.middle_name || '',
      email: item.email || '',
      phone: item.phone || '',
      accountType: item.account_type || 'teacher',
      password: '',
      roleId: roleId || ''
    })
    setShowEdit(true)
  }

  const submitEditStaff = async () => {
    if (!canEditStaff) return
    setStaffEditError('')
    const payload = {
      first_name: editForm.firstName,
      last_name: editForm.lastName,
      middle_name: editForm.patronymic || '',
      email: editForm.email,
      phone: (editForm.phone && String(editForm.phone).trim()) ? String(editForm.phone).trim() : null,
      account_type: editForm.accountType,
    }
    if (editForm.accountType === 'employee') payload.role = editForm.roleId ? Number(editForm.roleId) : null
    else payload.role = null
    try {
      await api.users.staff.update(editForm.id, payload)
      const [r, s] = await Promise.all([
        canAccessRolesList ? api.users.roles.list() : Promise.resolve([]),
        canViewStaff ? api.users.staff.list() : Promise.resolve([]),
      ])
      setRoles(Array.isArray(r) ? r : [])
      setItems(Array.isArray(s) ? s : [])
      setShowEdit(false)
    } catch (e) {
      const msg = e?.body?.email?.[0] || e?.body?.detail || 'Не удалось сохранить сотрудника'
      setStaffEditError(String(msg))
    }
  }

  const deleteStaff = async (id) => {
    if (!canRemoveStaff) return
    setStaffEditError('')
    try {
      await api.users.staff.remove(id)
      if (canViewStaff) {
        const s = await api.users.staff.list()
        setItems(Array.isArray(s) ? s : [])
      } else {
        setItems([])
      }
      setShowEdit(false)
    } catch (e) {
      const msg = e?.body?.detail || 'Не удалось удалить сотрудника'
      setStaffEditError(String(msg))
    }
  }

  const submitRole = async () => {
    if (!canCreateRole) return
    setRoleError('')
    const perms = [...new Set(roleForm.permissions)].sort()
    const name = (roleForm.name || '').trim()
    if (!name) { setRoleError('Заполните название роли'); return }
    try {
      await api.users.roles.create({ name, permission_codes: perms, is_active: true })
      if (canAccessRolesList) {
        const r = await api.users.roles.list()
        setRoles(Array.isArray(r) ? r : [])
      } else {
        setRoles([])
      }
      setRoleForm({ name: '', permissions: [] })
      setShowRole(false)
    } catch (e) {
      const msg = e?.body?.name?.[0] || e?.body?.detail || 'Не удалось создать роль'
      setRoleError(String(msg))
    }
  }

  const openRoleEdit = async (r) => {
    if (!canConfigureRole || !r || r.is_system) return
    setShowRolesList(false)
    setShowRoleEdit(true)
    setRoleEditError('')
    setRoleEditLoading(true)
    setRoleEditForm({ id: r.id, name: r.name || '', permissions: [] })
    try {
      const full = await api.users.roles.retrieve(r.id)
      setRoleEditForm({
        id: full?.id,
        name: full?.name || '',
        permissions: Array.isArray(full?.permission_codes) ? full.permission_codes : [],
      })
    } catch {
      setRoleEditError('Не удалось загрузить роль')
    } finally {
      setRoleEditLoading(false)
    }
  }

  const submitRoleEdit = async () => {
    if (!canConfigureRole) return
    setRoleEditError('')
    const id = roleEditForm?.id
    const name = (roleEditForm?.name || '').trim()
    if (!id) { setRoleEditError('Роль не выбрана'); return }
    if (!name) { setRoleEditError('Заполните название роли'); return }
    const perms = [...new Set(Array.isArray(roleEditForm?.permissions) ? roleEditForm.permissions : [])].sort()
    try {
      await api.users.roles.update(id, {
        name,
        permission_codes: perms,
      })
      if (canAccessRolesList) {
        const r = await api.users.roles.list()
        setRoles(Array.isArray(r) ? r : [])
      } else {
        setRoles([])
      }
      setShowRoleEdit(false)
      setShowRolesList(true)
    } catch (e) {
      const msg = e?.body?.name?.[0] || e?.body?.detail || 'Не удалось сохранить роль'
      setRoleEditError(String(msg))
    }
  }

  return (
    <div className="space-y-6 pt-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
        <h2 className="text-2xl font-bold text-[#0f2e3a]">Сотрудники</h2>
        <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-nowrap lg:items-center lg:gap-2 lg:overflow-x-auto lg:whitespace-nowrap">
          <div className="relative w-full" ref={roleFilterRef}>
            <button
              type="button"
              data-no-lift="true"
              onClick={() => {
                const el = roleFilterRef.current
                if (el) {
                  const r = el.getBoundingClientRect()
                  const labels = ['Все роли', ...roles.map(x => x.name || '')]
                  let widest = 0
                  try {
                    const span = document.createElement('span')
                    span.style.position = 'fixed'
                    span.style.visibility = 'hidden'
                    span.style.whiteSpace = 'nowrap'
                    span.style.fontSize = '14px'
                    span.style.fontFamily = getComputedStyle(document.body).fontFamily || 'sans-serif'
                    document.body.appendChild(span)
                    for (const text of labels) {
                      span.textContent = String(text)
                      widest = Math.max(widest, span.getBoundingClientRect().width)
                    }
                    document.body.removeChild(span)
                  } catch {}
                  const desiredWidth = Math.max(r.width, Math.ceil(widest + 48))
                  const width = Math.min(desiredWidth, window.innerWidth - 16)
                  const left = Math.max(8, Math.min(r.left, window.innerWidth - 8 - width))
                  setRoleMenuPos({ left, top: r.bottom + 8, width })
                }
                setRoleFilterOpen(o => !o)
              }}
              className="w-full px-3 h-10 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 flex items-center justify-between gap-2"
              title="Фильтр по роли"
            >
              <span className="text-sm truncate max-w-[160px] text-white/90">
                {roleFilter ? roles.find(r => r.id === roleFilter)?.name : 'Все роли'}
              </span>
              <ChevronDown size={16} className={`text-white/70 transition-transform ${roleFilterOpen ? 'rotate-180' : ''}`} />
            </button>
            {roleFilterOpen && createPortal(
              <div
                className="fixed z-[11000] bg-white/10 backdrop-blur border border-white/20 rounded-xl shadow-xl p-2 flex flex-col gap-1"
                style={{ left: roleMenuPos.left, top: roleMenuPos.top, width: roleMenuPos.width }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setRoleFilter('')
                    setRoleFilterOpen(false)
                  }}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors rounded-lg whitespace-nowrap ${roleFilter === '' ? 'bg-black/20 text-white font-medium' : 'text-white/80 hover:bg-black/10 hover:text-white'}`}
                >
                  Все роли
                </button>
                {roles.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setRoleFilter(r.id)
                      setRoleFilterOpen(false)
                    }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors rounded-lg whitespace-nowrap ${roleFilter === r.id ? 'bg-black/20 text-white font-medium' : 'text-white/80 hover:bg-black/10 hover:text-white'}`}
                  >
                    <span className="block">{r.name}</span>
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>
          {canViewRoles && (
            <button data-no-lift="true" onClick={() => setShowRolesList(true)} className="w-full px-4 h-10 rounded-xl bg-white/10 text-white hover:bg-white/15 flex items-center gap-2">
              <Shield size={16} />
              <span>Список ролей</span>
            </button>
          )}
          {canCreateRole && (
            <button data-no-lift="true" onClick={() => { setRoleError(''); setRoleForm({ name: '', permissions: [] }); setShowRole(true) }} className="w-full px-4 h-10 rounded-xl !bg-emerald-600 !border-emerald-600/40 text-white flex items-center gap-2">
              <Shield size={16} />
              <span>Создать роль</span>
            </button>
          )}
          {canCreateStaff && (
            <button
              data-no-lift="true"
              onClick={() => {
                setStaffCreateError('')
                setForm({ lastName: '', firstName: '', patronymic: '', email: '', phone: '', accountType: 'teacher', password: '', roleId: '' })
                setShowCreate(true)
              }}
              className="w-full px-4 h-10 rounded-xl !bg-emerald-600 !border-emerald-600/40 text-white flex items-center gap-2"
            >
              <UserPlus size={16} />
              <span className="whitespace-nowrap">Добавить сотрудника</span>
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {!canViewStaff ? (
          <div className="admin-card rounded-2xl p-4 text-white/80">
            Недостаточно прав для просмотра сотрудников
          </div>
        ) : (
          items
            .filter(s => {
              const roleId = (typeof s.role === 'object' && s.role) ? s.role.id : s.role
              if (roleFilter && String(roleId) !== String(roleFilter)) return false
              const fio = [s.last_name, s.first_name, s.middle_name, s.display_name].filter(Boolean).join(' ').toLowerCase()
              const email = (s.email || '').toLowerCase()
              const q = (adminQuery || '').trim().toLowerCase()
              if (!q) return true
              return fio.includes(q) || email.includes(q)
            })
            .map(s => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`admin-card rounded-2xl p-4 flex items-center justify-between cursor-pointer ${isOwner(s) ? 'border border-fuchsia-400/80 shadow-[0_0_18px_rgba(217,70,239,0.55)]' : ''}`}
                onClick={() => openEdit(s)}
              >
                <div>
                  <div className="text-white font-semibold text-lg leading-snug">{s.display_name || [s.last_name, s.first_name, s.middle_name].filter(Boolean).join(' ')}</div>
                  {!!staffRoleLabel(s) && (
                    <div className="text-[#266479] text-base">{staffRoleLabel(s)}</div>
                  )}
                  <div className="text-[#266479] text-sm">{s.email}</div>
                  <div className="text-[#266479] text-sm">{String(s.phone || '').trim() ? s.phone : 'Телефон не указан'}</div>
                </div>
              </motion.div>
            ))
        )}
      </div>
      {showCreate && (
        <motion.div className="fixed inset-0 z-[9990] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => { setShowCreate(false); setStaffCreateError('') }} />
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="admin-card rounded-2xl w-full max-w-2xl relative mx-4 my-6 max-h-[calc(100vh-3rem)] overflow-y-auto p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#266479] mb-1">Фамилия</label>
                <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
              </div>
              <div>
                <label className="block text-xs text-[#266479] mb-1">Имя</label>
                <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
              </div>
              <div>
                <label className="block text-xs text-[#266479] mb-1">Отчество</label>
                <input value={form.patronymic} onChange={e => setForm(f => ({ ...f, patronymic: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
              </div>
              <div>
                <label className="block text-xs text-[#266479] mb-1">Почта</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
              </div>
              <div>
                <label className="block text-xs text-[#266479] mb-1">Телефон (необязательно)</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
              </div>
              <div>
                <label className="block text-xs text-[#266479] mb-1">Пароль</label>
                <input autoComplete="new-password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
              </div>
              <div>
                <label className="block text-xs text-[#266479] mb-1">Тип аккаунта</label>
                <CustomSelect
                  value={form.accountType}
                  onChange={(v) => setForm(f => ({ ...f, accountType: v, roleId: v === 'employee' ? f.roleId : '' }))}
                  options={[
                    { value: 'teacher', label: 'Учитель' },
                    { value: 'employee', label: 'Сотрудник' },
                  ]}
                  variant="glass"
                />
              </div>
              {form.accountType === 'employee' && (
                <div>
                  <label className="block text-xs text-[#266479] mb-1">Роль</label>
                  <CustomSelect
                    value={form.roleId ? String(form.roleId) : ''}
                    onChange={(v) => setForm(f => ({ ...f, roleId: v }))}
                    options={[
                      { value: '', label: 'Выберите роль' },
                      ...roles.map(r => ({ value: String(r.id), label: r.name })),
                    ]}
                    placeholder="Выберите роль"
                    variant="glass"
                  />
                </div>
              )}
            </div>
            {staffCreateError && (
              <div className="mt-4 text-sm text-red-200 bg-red-500/20 border border-red-500/30 rounded-xl px-3 py-2">
                {staffCreateError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 mt-6 flex-wrap justify-center lg:flex-nowrap lg:overflow-x-auto lg:whitespace-nowrap">
                <button onClick={() => { setShowCreate(false); setStaffCreateError('') }} className="px-3 lg:px-4 h-11 rounded-xl !bg-red-600 !border-red-600/40 text-white flex items-center gap-2 shrink-0">
                <X size={16} />
                <span className="hidden sm:inline whitespace-nowrap btn-label">Отмена</span>
              </button>
              <button onClick={submitNewStaff} className="px-4 py-2 rounded-xl !bg-emerald-600 !border-emerald-600/40 text-white">Создать</button>
            </div>
          </motion.div>
        </motion.div>
      )}
      {showEdit && (
        <motion.div className="fixed inset-0 z-[9990] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => { setShowEdit(false); setStaffEditError('') }} />
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="modal-panel rounded-2xl border border-white/15 w-full max-w-xl p-6 relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#266479] mb-1">Фамилия</label>
                <input disabled={!canEditStaff} value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
              </div>
              <div>
                <label className="block text-xs text-[#266479] mb-1">Имя</label>
                <input disabled={!canEditStaff} value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
              </div>
              <div>
                <label className="block text-xs text-[#266479] mb-1">Отчество</label>
                <input disabled={!canEditStaff} value={editForm.patronymic} onChange={e => setEditForm(f => ({ ...f, patronymic: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
              </div>
              <div>
                <label className="block text-xs text-[#266479] mb-1">Почта</label>
                <input disabled={!canEditStaff} type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
              </div>
              <div>
                <label className="block text-xs text-[#266479] mb-1">Телефон (необязательно)</label>
                <input disabled={!canEditStaff} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
              </div>
              <div>
                <label className="block text-xs text-[#266479] mb-1">Тип аккаунта</label>
                <CustomSelect
                  value={editForm.accountType}
                  onChange={(v) => setEditForm(f => ({ ...f, accountType: v, roleId: v === 'employee' ? f.roleId : '' }))}
                  disabled={!canEditStaff}
                  options={[
                    { value: 'teacher', label: 'Учитель' },
                    { value: 'employee', label: 'Сотрудник' },
                  ]}
                  variant="glass"
                />
              </div>
              {editForm.accountType === 'employee' && (
                <div>
                  <label className="block text-xs text-[#266479] mb-1">Роль</label>
                  <CustomSelect
                    value={editForm.roleId ? String(editForm.roleId) : ''}
                    onChange={(v) => setEditForm(f => ({ ...f, roleId: v }))}
                    disabled={!canEditStaff}
                    options={[
                      { value: '', label: 'Выберите роль' },
                      ...roles.map(r => ({ value: String(r.id), label: r.name })),
                    ]}
                    placeholder="Выберите роль"
                    variant="glass"
                  />
                </div>
              )}
            </div>
            {staffEditError && (
              <div className="mt-4 text-sm text-red-200 bg-red-500/20 border border-red-500/30 rounded-xl px-3 py-2">
                {staffEditError}
              </div>
            )}
            <div className="flex items-center justify-between gap-2 mt-6">
              <button disabled={!canRemoveStaff} onClick={() => deleteStaff(editForm.id)} className={`px-3 lg:px-4 h-11 rounded-xl text-white flex items-center gap-2 shrink-0 ${canRemoveStaff ? '!bg-red-600 !border-red-600/40' : 'bg-black/10 border border-black/10 cursor-not-allowed opacity-40'}`}>
                <Trash2 size={16} />
                <span className="hidden sm:inline whitespace-nowrap btn-label">Удалить</span>
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowEdit(false); setStaffEditError('') }} className="px-3 lg:px-4 h-11 rounded-xl !bg-red-600 !border-red-600/40 text-white flex items-center gap-2 shrink-0">
                  <X size={16} />
                  <span className="hidden sm:inline whitespace-nowrap btn-label">Отмена</span>
                </button>
                <button disabled={!canEditStaff} onClick={submitEditStaff} className={`px-3 lg:px-4 h-11 rounded-xl text-white flex items-center gap-2 shrink-0 ${canEditStaff ? '!bg-emerald-600 !border-emerald-600/40' : 'bg-black/10 border border-black/10 cursor-not-allowed opacity-40'}`}>
                  <CheckCircle2 size={16} />
                  <span className="hidden sm:inline whitespace-nowrap btn-label">Сохранить</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      {showRole && (
        <motion.div className="fixed inset-0 z-[9990] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowRole(false)} />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="modal-panel rounded-2xl border border-white/15 w-full max-w-xl p-6 relative max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#266479] mb-1 font-semibold uppercase tracking-wider">Название роли</label>
                <input value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[#0f2e3a] focus:outline-none focus:border-emerald-500/50 transition-all" />
              </div>
              <div>
                <div className="text-xs text-[#266479] mb-2 font-semibold uppercase tracking-wider">Модули и действия</div>
                <div className="space-y-2">
                  {permissionCatalog
                    .slice()
                    .sort((a, b) => (a.position || 0) - (b.position || 0))
                    .map(mod => {
                      const actions = (mod.actions || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0))
                      const actionCodes = actions.map(a => a.code)
                      const moduleChecked = actionCodes.length > 0 && actionCodes.every(c => roleForm.permissions.includes(c))

                      return (
                        <div key={mod.code} className="bg-white/40 rounded-xl border border-black/5 p-4 transition-all hover:bg-white/60">
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="font-semibold text-[#0f2e3a]">{mod.title}</span>
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded accent-emerald-600"
                              checked={moduleChecked}
                              onChange={(e) => {
                                const on = e.target.checked
                                setRoleForm(f => {
                                  if (on) {
                                    return { ...f, permissions: [...new Set([...f.permissions, ...actionCodes])] }
                                  }
                                  return { ...f, permissions: f.permissions.filter(p => !actionCodes.includes(p)) }
                                })
                              }}
                            />
                          </label>

                          {mod.allow_partial_permissions && actions.length > 0 && (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {actions.map(act => {
                                const pid = act.code
                                const checked = roleForm.permissions.includes(pid)
                                return (
                                  <label
                                    key={pid}
                                    className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                                      checked
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 font-medium'
                                        : 'bg-black/5 border-black/5 text-[#0f2e3a]/70 hover:bg-black/10'
                                    }`}
                                  >
                                    <span className="text-sm">{act.title}</span>
                                    <input
                                      type="checkbox"
                                      className="w-3.5 h-3.5 rounded accent-emerald-600"
                                      checked={checked}
                                      onChange={(e) => {
                                        const on = e.target.checked
                                        setRoleForm(f => ({
                                          ...f,
                                          permissions: on ? [...new Set([...f.permissions, pid])] : f.permissions.filter(p => p !== pid)
                                        }))
                                      }}
                                    />
                                  </label>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              </div>
              {roleError && <div className="text-sm text-red-500 font-medium">{roleError}</div>}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={() => setShowRole(false)} className="px-5 py-2.5 rounded-xl !bg-red-600 !border-red-500/20 text-white font-semibold hover:!bg-red-700 transition-all shadow-md flex items-center gap-2">
                  <X size={18} />
                  <span>Отмена</span>
                </button>
                <button onClick={submitRole} className="px-5 py-2.5 rounded-xl !bg-emerald-600 !border-emerald-500/20 text-white font-semibold hover:!bg-emerald-700 transition-all shadow-md flex items-center gap-2">
                  <CheckCircle2 size={18} />
                  <span>Создать роль</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      {showRoleEdit && (
        <motion.div className="fixed inset-0 z-[9991] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowRoleEdit(false)} />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="modal-panel rounded-2xl border border-white/15 w-full max-w-xl p-6 relative max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-[#5a7280]">Редактирование роли</div>
                  <div className="text-xl font-bold text-[#0f2e3a]">{roleEditForm?.name || 'Роль'}</div>
                </div>
                <button onClick={() => setShowRoleEdit(false)} className="px-3 h-10 rounded-xl !bg-red-600 !border-red-500/20 text-white font-semibold hover:!bg-red-700 transition-all flex items-center gap-2">
                  <X size={16} />
                  <span>Закрыть</span>
                </button>
              </div>

              <div>
                <label className="block text-xs text-[#266479] mb-1 font-semibold uppercase tracking-wider">Название роли</label>
                <input
                  value={roleEditForm?.name || ''}
                  onChange={e => setRoleEditForm(f => ({ ...(f || {}), name: e.target.value }))}
                  className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[#0f2e3a] focus:outline-none focus:border-emerald-500/50 transition-all"
                  disabled={roleEditLoading}
                />
              </div>

              <div>
                <div className="text-xs text-[#266479] mb-2 font-semibold uppercase tracking-wider">Модули и действия</div>
                <div className="space-y-2">
                  {permissionCatalog
                    .slice()
                    .sort((a, b) => (a.position || 0) - (b.position || 0))
                    .map(mod => {
                      const actions = (mod.actions || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0))
                      const actionCodes = actions.map(a => a.code)
                      const current = Array.isArray(roleEditForm?.permissions) ? roleEditForm.permissions : []
                      const moduleChecked = actionCodes.length > 0 && actionCodes.every(c => current.includes(c))

                      return (
                        <div key={mod.code} className="bg-white/40 rounded-xl border border-black/5 p-4 transition-all hover:bg-white/60">
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="font-semibold text-[#0f2e3a]">{mod.title}</span>
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded accent-emerald-600"
                              checked={moduleChecked}
                              disabled={roleEditLoading}
                              onChange={(e) => {
                                const on = e.target.checked
                                setRoleEditForm(f => {
                                  const prev = Array.isArray(f?.permissions) ? f.permissions : []
                                  if (on) {
                                    return { ...(f || {}), permissions: [...new Set([...prev, ...actionCodes])] }
                                  }
                                  return { ...(f || {}), permissions: prev.filter(p => !actionCodes.includes(p)) }
                                })
                              }}
                            />
                          </label>

                          {mod.allow_partial_permissions && actions.length > 0 && (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {actions.map(act => {
                                const pid = act.code
                                const checked = current.includes(pid)
                                return (
                                  <label
                                    key={pid}
                                    className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                                      checked
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 font-medium'
                                        : 'bg-black/5 border-black/5 text-[#0f2e3a]/70 hover:bg-black/10'
                                    }`}
                                  >
                                    <span className="text-sm">{act.title}</span>
                                    <input
                                      type="checkbox"
                                      className="w-3.5 h-3.5 rounded accent-emerald-600"
                                      checked={checked}
                                      disabled={roleEditLoading}
                                      onChange={(e) => {
                                        const on = e.target.checked
                                        setRoleEditForm(f => {
                                          const prev = Array.isArray(f?.permissions) ? f.permissions : []
                                          return {
                                            ...(f || {}),
                                            permissions: on ? [...new Set([...prev, pid])] : prev.filter(p => p !== pid)
                                          }
                                        })
                                      }}
                                    />
                                  </label>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              </div>

              {!!roleEditError && <div className="text-sm text-red-500 font-medium">{roleEditError}</div>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => { setShowRoleEdit(false); setShowRolesList(true) }}
                  className="px-5 py-2.5 rounded-xl bg-white border border-black/10 text-[#0f2e3a] font-semibold hover:bg-white/90 transition-all shadow-md"
                >
                  Назад
                </button>
                <button
                  onClick={submitRoleEdit}
                  disabled={roleEditLoading}
                  className={`px-5 py-2.5 rounded-xl text-white font-semibold transition-all shadow-md flex items-center gap-2 ${
                    roleEditLoading ? 'bg-black/20 border border-black/10 cursor-not-allowed opacity-60' : '!bg-emerald-600 !border-emerald-500/20 hover:!bg-emerald-700'
                  }`}
                >
                  <CheckCircle2 size={18} />
                  <span>Сохранить</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      {showRolesList && (
        <motion.div className="fixed inset-0 z-[9990] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowRolesList(false)} />
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="modal-panel rounded-2xl border border-white/15 w-full max-w-2xl relative mx-4 my-6 h-[81vh] overflow-hidden p-4 sm:p-6">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4 shrink-0">
                <h3 className="text-xl font-bold text-[#0f2e3a]">Созданные роли</h3>
                <div className="px-3 py-1 bg-black/5 rounded-full text-sm font-bold text-[#266479]">{roles.length}</div>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {roles.map(r => (
                  <div key={r.id} className="bg-white/50 rounded-2xl border border-black/5 p-4 sm:p-5 space-y-3 transition-all hover:bg-white/70">
                    <div className="min-w-0">
                      <div className="text-[#0f2e3a] font-bold text-lg break-words">{r.name}</div>
                      {r.permission_codes && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {r.permission_codes.map(p => (
                            <span key={p} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-[10px] font-semibold uppercase tracking-wider">
                              {permissionLabelByCode(p)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="w-full flex flex-col gap-2">
                      <div className="text-xs text-[#5a7280] font-semibold whitespace-nowrap">{r.user_count || 0} чел.</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
                        <button
                          onClick={async () => {
                            setRoleDetailsError('')
                            setShowRolesList(false)
                            setShowRoleDetails(true)
                            setRoleDetailsRole({ id: r.id, name: r.name, permission_codes: [], modules: [] })
                            try {
                              const full = await api.users.roles.retrieve(r.id)
                              setRoleDetailsRole(full)
                            } catch {
                              setRoleDetailsError('Не удалось загрузить доступы роли')
                            }
                          }}
                          className="w-full px-3 h-9 rounded-lg border text-xs font-semibold transition-all bg-white border-black/10 text-[#0f2e3a] hover:bg-white/90 flex items-center justify-center gap-2"
                          type="button"
                        >
                          <Info size={16} />
                          <span className="whitespace-nowrap">Подробности</span>
                        </button>
                        <button
                          onClick={() => openRoleEdit(r)}
                          className={`w-full px-3 h-9 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                            !canConfigureRole || r.is_system
                              ? 'bg-black/5 border-black/5 text-[#0f2e3a]/20 cursor-not-allowed'
                              : 'bg-white border-black/10 text-[#0f2e3a] hover:bg-white/90'
                          }`}
                          disabled={!canConfigureRole || r.is_system}
                          title={
                            !canConfigureRole ? 'Нет прав на редактирование ролей'
                              : r.is_system ? 'Системную роль редактировать нельзя'
                              : 'Редактировать роль'
                          }
                          type="button"
                        >
                          <Pencil size={16} />
                          <span className="whitespace-nowrap">Редактировать</span>
                        </button>
                        <button
                          onClick={async () => {
                            if (!(r.user_count || 0)) return
                            setRoleStaffError('')
                            try {
                              const list = await api.users.roles.staffs(r.id)
                              setRoleStaffRole(r)
                              setRoleStaffItems(Array.isArray(list) ? list : (Array.isArray(list?.results) ? list.results : []))
                              setShowRolesList(false)
                              setShowRoleStaffs(true)
                            } catch {
                              setRoleStaffError('Не удалось загрузить сотрудников')
                            }
                          }}
                          className={`w-full px-3 h-9 rounded-lg border text-xs font-semibold transition-all ${
                            (r.user_count || 0) > 0
                              ? 'bg-white border-black/10 text-[#0f2e3a] hover:bg-white/90'
                              : 'bg-black/5 border-black/5 text-[#0f2e3a]/20 cursor-not-allowed'
                          }`}
                          disabled={!((r.user_count || 0) > 0)}
                          type="button"
                        >
                          <span className="whitespace-nowrap">Сотрудники</span>
                        </button>
                        <button
                          onClick={async () => {
                            if (!canDeleteRole || r.is_system || (r.user_count || 0) > 0) return
                            await api.users.roles.remove(r.id)
                            const next = await api.users.roles.list()
                            setRoles(Array.isArray(next) ? next : [])
                          }}
                          className={`w-full px-3 h-9 rounded-lg border text-xs font-semibold transition-all ${
                            !canDeleteRole || r.is_system || (r.user_count || 0) > 0
                              ? 'bg-black/5 border-black/5 text-[#0f2e3a]/20 cursor-not-allowed'
                              : 'bg-red-50 border-red-100 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 shadow-sm'
                          }`}
                          disabled={!canDeleteRole || r.is_system || (r.user_count || 0) > 0}
                          title={
                            !canDeleteRole ? 'Нет прав на удаление роли'
                              : r.is_system ? 'Системную роль нельзя удалить'
                              : (r.user_count || 0) > 0 ? 'Нельзя удалить: к роли прикреплены сотрудники'
                              : 'Удалить роль'
                          }
                          type="button"
                        >
                          <span className="whitespace-nowrap">Удалить</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end mt-4 shrink-0">
                <button onClick={() => setShowRolesList(false)} className="px-6 h-11 rounded-xl !bg-red-600 !border-red-500/20 text-white font-bold hover:!bg-red-700 transition-all flex items-center gap-2 shadow-md">
                  <X size={18} />
                  <span>Закрыть</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      {showRoleDetails && (
        <motion.div className="fixed inset-0 z-[9992] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowRoleDetails(false)} />
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="modal-panel rounded-2xl border border-white/15 w-full max-w-3xl p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-[#0f2e3a]">{roleDetailsRole?.name || 'Роль'}</h3>
                <div className="text-sm text-[#5a7280]">Доступные вкладки и возможности</div>
              </div>
              <div className="px-3 py-1 bg-black/5 rounded-full text-sm font-bold text-[#266479]">{(roleDetailsRole?.permission_codes || []).length}</div>
            </div>
            {!!roleDetailsError && (
              <div className="mb-4 rounded-xl p-3 bg-red-50 border border-red-100 text-red-700 text-sm">{roleDetailsError}</div>
            )}
            {(() => {
              const fullModules = Array.isArray(roleDetailsRole?.modules) ? roleDetailsRole.modules : null
              const derived = fullModules
                ? fullModules.filter(m => !!m?.has_access).map(m => ({
                  code: m?.code,
                  title: m?.title,
                  actions: (Array.isArray(m?.actions) ? m.actions : []).filter(a => !!a?.granted).map(a => ({ code: a?.code, title: a?.title }))
                }))
                : null

              const codes = new Set(Array.isArray(roleDetailsRole?.permission_codes) ? roleDetailsRole.permission_codes : [])
              const fallback = (Array.isArray(permissionCatalog) ? permissionCatalog : []).map(m => {
                const actions = (Array.isArray(m?.actions) ? m.actions : []).filter(a => codes.has(a.code))
                return { code: m?.code, title: m?.title, actions }
              }).filter(m => m.actions.length > 0)

              const modules = derived && derived.length > 0 ? derived : fallback
              if (!modules || modules.length === 0) {
                return (
                  <div className="rounded-xl p-4 bg-white/50 border border-black/5 text-[#5a7280]">
                    У роли нет выбранных доступов
                  </div>
                )
              }
              return (
                <div className="space-y-3 max-h-[60vh] overflow-auto pr-1 custom-scrollbar">
                  <div className="rounded-2xl p-4 bg-white/50 border border-black/5">
                    <div className="text-[#0f2e3a] font-semibold mb-2">Вкладки</div>
                    <div className="flex flex-wrap gap-2">
                      {modules.map(m => (
                        <span key={m.code || m.title} className="px-3 py-1.5 rounded-xl bg-black/5 border border-black/10 text-[#0f2e3a] text-xs font-semibold">
                          {m.title || m.code}
                        </span>
                      ))}
                    </div>
                  </div>
                  {modules.map(m => (
                    <div key={m.code || m.title} className="bg-white/50 rounded-2xl border border-black/5 p-5">
                      <div className="text-[#0f2e3a] font-bold">{m.title || m.code}</div>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {(Array.isArray(m.actions) ? m.actions : []).map(a => (
                          <span key={a.code} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-[10px] font-semibold uppercase tracking-wider">
                            {a.title || a.code}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
            <div className="flex items-center justify-end mt-6 gap-3">
              <button
                onClick={() => {
                  setShowRoleDetails(false)
                  setShowRolesList(true)
                }}
                className="px-6 h-11 rounded-xl bg-white border border-black/10 text-[#0f2e3a] font-bold hover:bg-white/90 transition-all"
              >
                Назад
              </button>
              <button onClick={() => setShowRoleDetails(false)} className="px-6 h-11 rounded-xl !bg-red-600 !border-red-500/20 text-white font-bold hover:!bg-red-700 transition-all flex items-center gap-2 shadow-md">
                <X size={18} />
                <span>Закрыть</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      {showRoleStaffs && (
        <motion.div className="fixed inset-0 z-[9991] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-md" onClick={() => setShowRoleStaffs(false)} />
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="modal-panel rounded-2xl border border-white/15 w-full max-w-2xl p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[#0f2e3a]">{roleStaffRole?.name || 'Сотрудники роли'}</h3>
              <div className="px-3 py-1 bg-black/5 rounded-full text-sm font-bold text-[#266479]">{roleStaffItems.length}</div>
            </div>
            {!!roleStaffError && (
              <div className="mb-4 rounded-xl p-3 bg-red-50 border border-red-100 text-red-700 text-sm">{roleStaffError}</div>
            )}
            <div className="space-y-2 max-h-[60vh] overflow-auto pr-1 custom-scrollbar">
              {roleStaffItems.length === 0 ? (
                <div className="rounded-xl p-4 bg-white/50 border border-black/5 text-[#5a7280]">Нет сотрудников</div>
              ) : roleStaffItems.map(u => (
                <div key={u.id} className="bg-white/50 rounded-2xl border border-black/5 p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[#0f2e3a] font-semibold truncate">{u.display_name || u.email}</div>
                    <div className="text-[#5a7280] text-sm truncate">{u.email}</div>
                  </div>
                  <button
                    onClick={async () => {
                      setRoleStaffError('')
                      try {
                        await api.users.staff.update(u.id, { role: null })
                        setRoleStaffItems(prev => (Array.isArray(prev) ? prev : []).filter(x => String(x?.id) !== String(u.id)))
                        setItems(prev => (Array.isArray(prev) ? prev : []).map(x => String(x?.id) === String(u.id) ? { ...x, role: null } : x))
                        setRoles(prev => (Array.isArray(prev) ? prev : []).map(rr => String(rr?.id) === String(roleStaffRole?.id) ? { ...rr, user_count: Math.max(0, Number(rr.user_count || 0) - 1) } : rr))
                      } catch {
                        setRoleStaffError('Не удалось открепить сотрудника')
                      }
                    }}
                    className="px-4 py-2 rounded-xl border text-sm font-semibold bg-red-50 border-red-100 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-sm shrink-0"
                  >
                    Открепить
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end mt-6 gap-3">
              <button
                onClick={() => {
                  setShowRoleStaffs(false)
                  setShowRolesList(true)
                }}
                className="px-6 h-11 rounded-xl bg-white border border-black/10 text-[#0f2e3a] font-bold hover:bg-white/90 transition-all"
              >
                Назад
              </button>
              <button onClick={() => setShowRoleStaffs(false)} className="px-6 h-11 rounded-xl !bg-red-600 !border-red-500/20 text-white font-bold hover:!bg-red-700 transition-all flex items-center gap-2 shadow-md">
                <X size={18} />
                <span>Закрыть</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
