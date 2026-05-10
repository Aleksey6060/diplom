const AUTH_STORAGE_KEY = 'glassroom_auth_v1'

function getBaseUrl() {
  try {
    const raw = import.meta?.env?.VITE_API_BASE_URL
    return typeof raw === 'string' ? raw.replace(/\/+$/, '') : ''
  } catch {
    return ''
  }
}

export function getAuthTokens() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.access !== 'string' || typeof parsed.refresh !== 'string') return null
    return { access: parsed.access, refresh: parsed.refresh }
  } catch {
    return null
  }
}

export function setAuthTokens(tokens) {
  if (!tokens || typeof tokens !== 'object') return
  if (typeof tokens.access !== 'string' || typeof tokens.refresh !== 'string') return
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ access: tokens.access, refresh: tokens.refresh }))
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent('auth_tokens_update'))
  } catch {}
}

export function clearAuthTokens() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent('auth_tokens_update'))
  } catch {}
}

async function safeReadJson(res) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function requestRaw(path, options = {}) {
  const baseUrl = getBaseUrl()
  const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`

  const method = options.method || 'GET'
  const headers = new Headers(options.headers || {})

  const tokens = getAuthTokens()
  if (options.auth !== false && tokens?.access && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${tokens.access}`)
  }

  let body = options.body
  if (body && typeof body === 'object' && !(body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(body)
  }

  return fetch(url, {
    method,
    headers,
    body,
  })
}

function normalizeNextPath(nextUrl) {
  if (!nextUrl) return null
  try {
    const u = new URL(String(nextUrl), 'http://local')
    return `${u.pathname}${u.search || ''}`
  } catch {
    return null
  }
}

function normalizeErrorText(s) {
  const v = String(s == null ? '' : s).trim()
  return v
}

function humanizeFieldName(key) {
  const k = String(key || '').trim()
  if (!k) return 'Ошибка'
  const map = {
    non_field_errors: 'Ошибка',
    detail: 'Ошибка',
    entries: 'Расписание',
    start_time: 'Начало',
    lessons_per_day: 'Пар в день',
    lesson_duration_minutes: 'Длительность пары',
    break_minutes: 'Перерыв',
    breaks_minutes: 'Перерывы',
    subject: 'Предмет',
    teacher: 'Преподаватель',
  }
  return map[k] || k
}

function stringifyErrorValue(val) {
  if (val == null) return ''
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (Array.isArray(val)) return val.map(stringifyErrorValue).filter(Boolean).join(', ')
  if (typeof val === 'object') {
    if (typeof val.detail === 'string') return val.detail
    return Object.entries(val)
      .map(([k, v]) => {
        const msg = stringifyErrorValue(v)
        if (!msg) return ''
        return `${humanizeFieldName(k)}: ${msg}`
      })
      .filter(Boolean)
      .join('; ')
  }
  return String(val)
}

export function formatApiError(err, fallback = 'Произошла ошибка') {
  try {
    if (!err) return normalizeErrorText(fallback) || 'Произошла ошибка'
    const status = err?.status
    const body = err?.body
    const rawMsg = normalizeErrorText(err?.message)

    if (rawMsg && (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError') || rawMsg.includes('Load failed'))) {
      return 'Не удалось соединиться с сервером. Проверьте интернет или попробуйте позже.'
    }

    const detail = typeof body?.detail === 'string' ? normalizeErrorText(body.detail) : ''
    if (detail) return detail

    if (typeof body === 'string') {
      const t = normalizeErrorText(body)
      if (t) return t
    }

    if (body && typeof body === 'object') {
      const pieces = []
      for (const [k, v] of Object.entries(body)) {
        if (k === 'conflict') continue
        const msg = stringifyErrorValue(v)
        if (!msg) continue
        if (k === 'non_field_errors') {
          pieces.push(msg)
        } else {
          pieces.push(`${humanizeFieldName(k)}: ${msg}`)
        }
      }
      const joined = normalizeErrorText(pieces.join('\n'))
      if (joined) return joined
    }

    if (status === 401 || status === 403) return 'Недостаточно прав для выполнения действия.'
    if (status === 404) return 'Объект не найден.'
    if (status === 429) return 'Слишком много запросов. Попробуйте позже.'
    if (status >= 500) return 'Ошибка сервера. Попробуйте позже.'

    return normalizeErrorText(fallback) || (rawMsg || 'Произошла ошибка')
  } catch {
    return normalizeErrorText(fallback) || 'Произошла ошибка'
  }
}

async function refreshAccessToken(refresh) {
  const res = await requestRaw('/api/users/token/refresh/', {
    method: 'POST',
    auth: false,
    body: { refresh },
  })

  if (!res.ok) return null
  const data = await safeReadJson(res)
  if (!data || typeof data !== 'object' || typeof data.access !== 'string') return null
  return data.access
}

export async function apiRequest(path, options = {}) {
  const res = await requestRaw(path, options)
  const shouldAttemptRefresh = (res.status === 401 || res.status === 403) && options.auth !== false
  if (!shouldAttemptRefresh) {
    if (res.ok) return safeReadJson(res)
    const errBody = await safeReadJson(res)
    const error = new Error('Ошибка API-запроса')
    error.status = res.status
    error.body = errBody
    error.userMessage = formatApiError(error)
    error.message = error.userMessage
    throw error
  }

  const tokens = getAuthTokens()
  if (!tokens?.refresh) {
    const errBody = await safeReadJson(res)
    const error = new Error('Не авторизован')
    error.status = res.status
    error.body = errBody
    error.userMessage = formatApiError(error)
    error.message = error.userMessage
    throw error
  }

  const nextAccess = await refreshAccessToken(tokens.refresh)
  if (!nextAccess) {
    clearAuthTokens()
    const errBody = await safeReadJson(res)
    const error = new Error('Не авторизован')
    error.status = res.status
    error.body = errBody
    error.userMessage = formatApiError(error)
    error.message = error.userMessage
    throw error
  }

  setAuthTokens({ access: nextAccess, refresh: tokens.refresh })

  const retryRes = await requestRaw(path, options)
  if (retryRes.ok) return safeReadJson(retryRes)
  const errBody = await safeReadJson(retryRes)
  const error = new Error('Ошибка API-запроса')
  error.status = retryRes.status
  error.body = errBody
  error.userMessage = formatApiError(error)
  error.message = error.userMessage
  throw error
}

export async function apiRequestResponse(path, options = {}) {
  const res = await requestRaw(path, options)
  const shouldAttemptRefresh = (res.status === 401 || res.status === 403) && options.auth !== false
  if (!shouldAttemptRefresh) {
    if (res.ok) return res
    const errBody = await safeReadJson(res)
    const error = new Error('Ошибка API-запроса')
    error.status = res.status
    error.body = errBody
    error.userMessage = formatApiError(error)
    error.message = error.userMessage
    throw error
  }

  const tokens = getAuthTokens()
  if (!tokens?.refresh) {
    const errBody = await safeReadJson(res)
    const error = new Error('Не авторизован')
    error.status = res.status
    error.body = errBody
    error.userMessage = formatApiError(error)
    error.message = error.userMessage
    throw error
  }

  const nextAccess = await refreshAccessToken(tokens.refresh)
  if (!nextAccess) {
    clearAuthTokens()
    const errBody = await safeReadJson(res)
    const error = new Error('Не авторизован')
    error.status = res.status
    error.body = errBody
    error.userMessage = formatApiError(error)
    error.message = error.userMessage
    throw error
  }

  setAuthTokens({ access: nextAccess, refresh: tokens.refresh })

  const retryRes = await requestRaw(path, options)
  if (retryRes.ok) return retryRes
  const errBody = await safeReadJson(retryRes)
  const error = new Error('Ошибка API-запроса')
  error.status = retryRes.status
  error.body = errBody
  error.userMessage = formatApiError(error)
  error.message = error.userMessage
  throw error
}

export const api = {
  universities: {
    async list() {
      return apiRequest('/api/universities/', { method: 'GET' })
    },
    async retrieve(slug) {
      return apiRequest(`/api/universities/${encodeURIComponent(slug)}/`, { method: 'GET' })
    },
    async create({ name, description, logo, slug, is_active, expires_at, owner_email, owner_password, owner_first_name, owner_last_name }) {
      const form = new FormData()
      form.append('name', name || '')
      if (description) form.append('description', description)
      if (slug) form.append('slug', slug)
      if (typeof is_active === 'boolean') form.append('is_active', String(is_active))
      if (expires_at) form.append('expires_at', expires_at)
      form.append('owner_email', owner_email || '')
      form.append('owner_password', owner_password || '')
      if (owner_first_name) form.append('owner_first_name', owner_first_name)
      if (owner_last_name) form.append('owner_last_name', owner_last_name)
      if (logo instanceof File) form.append('logo', logo)
      return apiRequest('/api/universities/', { method: 'POST', body: form })
    },
    async update(slug, payload) {
      const hasFile = payload && typeof payload === 'object' && Object.values(payload).some(v => v instanceof File)
      if (hasFile) {
        const form = new FormData()
        for (const [k, v] of Object.entries(payload)) {
          if (v != null && v !== '') form.append(k, v instanceof File ? v : String(v))
        }
        return apiRequest(`/api/universities/${encodeURIComponent(slug)}/`, { method: 'PATCH', body: form })
      }
      return apiRequest(`/api/universities/${encodeURIComponent(slug)}/`, { method: 'PATCH', body: payload })
    },
    async remove(slug) {
      return apiRequest(`/api/universities/${encodeURIComponent(slug)}/`, { method: 'DELETE' })
    },
  },
  users: {
    async login({ email, password }) {
      const data = await apiRequest('/api/users/login/', {
        method: 'POST',
        auth: false,
        body: { email, password },
      })
      if (!data || typeof data !== 'object') throw new Error('Некорректный ответ сервера при входе')
      if (typeof data.access !== 'string' || typeof data.refresh !== 'string') throw new Error('Некорректный ответ сервера при входе')
      setAuthTokens({ access: data.access, refresh: data.refresh })
      const user = data.user && typeof data.user === 'object' ? data.user : null
      return { access: data.access, refresh: data.refresh, user }
    },
    async me() {
      return apiRequest('/api/users/me/', { method: 'GET' })
    },
    async updateMe(payload) {
      return apiRequest('/api/users/me/', { method: 'PATCH', body: payload })
    },
    async access() {
      return apiRequest('/api/users/me/access/', { method: 'GET' })
    },
    roles: {
      async list({ universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/roles` : '/api/users/roles'
        return apiRequest(`${base}/`, { method: 'GET' })
      },
      async retrieve(id, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/roles` : '/api/users/roles'
        return apiRequest(`${base}/${id}/`, { method: 'GET' })
      },
      async create({ name, description = '', is_active = true, permission_codes = [] }, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/roles` : '/api/users/roles'
        return apiRequest(`${base}/`, {
          method: 'POST',
          body: { name, description, is_active, permission_codes },
        })
      },
      async update(id, payload, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/roles` : '/api/users/roles'
        return apiRequest(`${base}/${id}/`, {
          method: 'PATCH',
          body: payload,
        })
      },
      async remove(id, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/roles` : '/api/users/roles'
        return apiRequest(`${base}/${id}/`, { method: 'DELETE' })
      },
      async staffs(id, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/roles` : '/api/users/roles'
        return apiRequest(`${base}/${id}/staffs/`, { method: 'GET' })
      },
    },
    permissions: {
      async modules({ universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/permission-modules` : '/api/users/permission-modules'
        return apiRequest(`${base}/`, { method: 'GET' })
      },
    },
    students: {
      async list({ universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/students` : '/api/users/students'
        return apiRequest(`${base}/`, { method: 'GET' })
      },
      async retrieve(id, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/students` : '/api/users/students'
        return apiRequest(`${base}/${id}/`, { method: 'GET' })
      },
      async update(id, payload, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/students` : '/api/users/students'
        return apiRequest(`${base}/${id}/`, { method: 'PATCH', body: payload })
      },
      async remove(id, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/students` : '/api/users/students'
        return apiRequest(`${base}/${id}/`, { method: 'DELETE' })
      },
      async courses(id, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/students` : '/api/users/students'
        return apiRequest(`${base}/${id}/courses/`, { method: 'GET' })
      },
      async simpleCourses(studentId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/students` : '/api/users/students'
        return apiRequest(`${base}/${studentId}/simple_courses/`, { method: 'GET' })
      },
      async bindToSimpleCourses(studentId, courseIds, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/students` : '/api/users/students'
        const ids = Array.isArray(courseIds) ? courseIds.map(Number).filter(v => Number.isFinite(v)) : []
        return apiRequest(`${base}/${studentId}/bind_to_simple_courses/`, {
          method: 'POST',
          body: { courses: ids },
        })
      },
      async create({ email, first_name, last_name, middle_name, password, phone = '', group = null }, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/students` : '/api/users/students'
        const normalizedGroup = (group && String(group).trim()) ? String(group).trim() : null
        const body = {
          email,
          first_name,
          last_name,
          middle_name,
          password,
          phone: (phone && String(phone).trim()) ? String(phone).trim() : null,
        }
        const normalizedPhone = (phone && String(phone).trim()) ? String(phone).trim() : null
        return apiRequest(`${base}/`, {
          method: 'POST',
          body: { ...body, phone: normalizedPhone, ...(normalizedGroup ? { group: normalizedGroup } : {}) },
        })
      },
      async manyCreate(rows, { ignore_conflicts = false, universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/students` : '/api/users/students'
        const qs = ignore_conflicts ? '?ignore_conflicts=true' : ''
        const payload = Array.isArray(rows) ? rows.map(r => {
          const phone = r?.phone
          const group = r?.group
          const normalizedGroup = (group && String(group).trim()) ? String(group).trim() : null
          const out = {
            ...r,
            phone: (phone && String(phone).trim()) ? String(phone).trim() : null,
            password: r?.password,
          }
          if (normalizedGroup) out.group = normalizedGroup
          else delete out.group
          return out
        }) : []
        return apiRequest(`${base}/many_create/${qs}`, {
          method: 'POST',
          body: payload,
        })
      },
    },
    studentFiles: {
      async list(studentId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/students` : '/api/users/students'
        return apiRequest(`${base}/${studentId}/files/`, { method: 'GET' })
      },
      async upload(studentId, { name, file }, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/students` : '/api/users/students'
        const form = new FormData()
        form.append('name', String(name || 'Документ'))
        form.append('file', file)
        return apiRequest(`${base}/${studentId}/files/`, { method: 'POST', body: form })
      },
      async remove(studentId, fileId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/students` : '/api/users/students'
        return apiRequest(`${base}/${studentId}/files/${fileId}/`, { method: 'DELETE' })
      },
      async fetchFile(studentId, fileId, { download = false, universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/students` : '/api/users/students'
        const qs = download ? '?download=true' : ''
        const res = await apiRequestResponse(`${base}/${studentId}/files/${fileId}/${qs}`, { method: 'GET' })
        const blob = await res.blob()
        const cd = res.headers.get('content-disposition') || ''
        const match = cd.match(/filename="([^"]+)"/i)
        const filename = match?.[1] || null
        return { blob, filename, contentType: res.headers.get('content-type') || null }
      },
    },
    groups: {
      async list({ universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
        return apiRequest(`${base}/`, { method: 'GET' })
      },
      async create({ name }, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
        return apiRequest(`${base}/`, { method: 'POST', body: { name } })
      },
      async update(groupId, payload, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
        return apiRequest(`${base}/${groupId}/`, { method: 'PATCH', body: payload })
      },
      async remove(groupId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
        return apiRequest(`${base}/${groupId}/`, { method: 'DELETE' })
      },
      async participants(groupId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
        return apiRequest(`${base}/${groupId}/participants/`, { method: 'GET' })
      },
      async courses(groupId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
        return apiRequest(`${base}/${groupId}/courses/`, { method: 'GET' })
      },
      async bindToCourses(groupId, courseIds, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
        const ids = Array.isArray(courseIds) ? courseIds.map(Number).filter(v => Number.isFinite(v)) : []
        return apiRequest(`${base}/${groupId}/bind_to_courses/`, {
          method: 'POST',
          body: { courses: ids },
        })
      },
      async detachFromGroup(groupId, courseId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
        return apiRequest(`${base}/${groupId}/detach_from_group/`, {
          method: 'POST',
          body: { course: courseId },
        })
      },
      schedule: {
        async get(groupId, courseId, semesterId, { universitySlug = null } = {}) {
          const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
          return apiRequest(`${base}/${groupId}/courses/${courseId}/semesters/${semesterId}/schedule/`, { method: 'GET' })
        },
        async save(groupId, courseId, semesterId, payload, { universitySlug = null } = {}) {
          const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
          return apiRequest(`${base}/${groupId}/courses/${courseId}/semesters/${semesterId}/schedule/`, { method: 'PUT', body: payload })
        },
      },
      async courseSemesters(groupId, courseId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
        return apiRequest(`${base}/${groupId}/courses/${courseId}/semesters/`, { method: 'GET' })
      },
      async semesterSubjects(groupId, courseId, semesterId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
        return apiRequest(`${base}/${groupId}/courses/${courseId}/semesters/${semesterId}/subjects/`, { method: 'GET' })
      },
      teacherAttachments: {
        async list(groupId, courseId, { semesterId = null, universitySlug = null } = {}) {
          const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
          const q = semesterId ? `?semester_id=${encodeURIComponent(String(semesterId))}` : ''
          return apiRequest(`${base}/${groupId}/courses/${courseId}/teachers/${q}`, { method: 'GET' })
        },
        async create(groupId, courseId, { teacher, subject }, { universitySlug = null } = {}) {
          const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
          return apiRequest(`${base}/${groupId}/courses/${courseId}/teachers/`, {
            method: 'POST',
            body: { teacher, subject },
          })
        },
        async remove(groupId, courseId, attachmentId, { universitySlug = null } = {}) {
          const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
          return apiRequest(`${base}/${groupId}/courses/${courseId}/teachers/${attachmentId}/`, { method: 'DELETE' })
        },
      },
      async addToGroup(groupId, participantIds, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
        return apiRequest(`${base}/${groupId}/add_to_group/`, {
          method: 'POST',
          body: { participants: participantIds },
        })
      },
      async removeFromGroup(groupId, participantIds, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
        return apiRequest(`${base}/${groupId}/remove_from_group/`, {
          method: 'DELETE',
          body: { participants: participantIds },
        })
      },
      teacher: {
        async myGroups({ universitySlug = null } = {}) {
          const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
          return apiRequest(`${base}/teacher/my-groups/`, { method: 'GET' })
        },
        async semesters(groupId, { universitySlug = null } = {}) {
          const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
          return apiRequest(`${base}/teacher/groups/${groupId}/semesters/`, { method: 'GET' })
        },
        async schedule(groupId, courseId, semesterId, { universitySlug = null } = {}) {
          const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
          return apiRequest(`${base}/teacher/groups/${groupId}/courses/${courseId}/semesters/${semesterId}/schedule/`, { method: 'GET' })
        },
        async groupAssignments(groupId, { semesterId = null, universitySlug = null } = {}) {
          const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
          const q = semesterId ? `?semester_id=${encodeURIComponent(String(semesterId))}` : ''
          return apiRequest(`${base}/teacher/groups/${groupId}/assignments/${q}`, { method: 'GET' })
        },
        async assignmentDetail(groupId, assignmentId, { universitySlug = null } = {}) {
          const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
          return apiRequest(`${base}/teacher/groups/${groupId}/assignments/${assignmentId}/`, { method: 'GET' })
        },
        async studentWork(groupId, assignmentId, studentId, { universitySlug = null } = {}) {
          const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
          return apiRequest(`${base}/teacher/groups/${groupId}/assignments/${assignmentId}/students/${studentId}/`, { method: 'GET' })
        },
        async setGrade(groupId, assignmentId, studentId, payload, { universitySlug = null } = {}) {
          const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
          return apiRequest(`${base}/teacher/groups/${groupId}/assignments/${assignmentId}/students/${studentId}/grade/`, { method: 'PUT', body: payload })
        },
        async fetchStudentFile(groupId, assignmentId, studentId, fileId, { universitySlug = null } = {}) {
          const base = universitySlug ? `/api/u/${universitySlug}/groups` : '/api/groups'
          const res = await apiRequestResponse(`${base}/teacher/groups/${groupId}/assignments/${assignmentId}/students/${studentId}/files/${fileId}/`, { method: 'GET' })
          const blob = await res.blob()
          const cd = res.headers.get('content-disposition') || ''
          const match = cd.match(/filename="([^"]+)"/i)
          const filename = match?.[1] || null
          return { blob, filename, contentType: res.headers.get('content-type') || null }
        },
      },
    },
    staff: {
      async list({ universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/staffs` : '/api/users/staffs'
        return apiRequest(`${base}/`, { method: 'GET' })
      },
      async create({ first_name, last_name, middle_name = '', email, phone = '', avatar = null, password, account_type, role = null }, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/staffs` : '/api/users/staffs'
        const normalizedPhone = (phone && String(phone).trim()) ? String(phone).trim() : null
        const body = {
          first_name,
          last_name,
          middle_name,
          email,
          phone: normalizedPhone,
          password,
          account_type,
          ...(role ? { role } : {}),
        }
        return apiRequest(`${base}/`, { method: 'POST', body })
      },
      async update(id, payload, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/staffs` : '/api/users/staffs'
        return apiRequest(`${base}/${id}/`, { method: 'PATCH', body: payload })
      },
      async read(id, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/staffs` : '/api/users/staffs'
        return apiRequest(`${base}/${id}/`, { method: 'GET' })
      },
      async remove(id, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/users/staffs` : '/api/users/staffs'
        return apiRequest(`${base}/${id}/`, { method: 'DELETE' })
      },
    },
    async passwordResetRequest(email) {
      return apiRequest('/api/users/password-reset/', {
        method: 'POST',
        auth: false,
        body: { email },
      })
    },
    async passwordResetConfirm({ uid, token, new_password }) {
      return apiRequest('/api/users/password-reset/confirm/', {
        method: 'POST',
        auth: false,
        body: { uid, token, new_password },
      })
    },
    async logout() {
      const tokens = getAuthTokens()
      if (!tokens?.refresh) {
        clearAuthTokens()
        return true
      }
      try {
        await apiRequest('/api/users/logout/', {
          method: 'POST',
          body: { refresh_token: tokens.refresh },
        })
      } catch {
        return true
      } finally {
        clearAuthTokens()
      }
      return true
    },
  },
  banner: {
    async current({ universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/banner` : '/api/banner'
      return apiRequest(`${base}/`, { method: 'GET', auth: false })
    },
    async manage({ universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/banner` : '/api/banner'
      return apiRequest(`${base}/manage/`, { method: 'GET' })
    },
    async upload(file, { is_active = true, universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/banner` : '/api/banner'
      const form = new FormData()
      form.append('image', file)
      form.append('is_active', String(!!is_active))
      return apiRequest(`${base}/manage/`, { method: 'POST', body: form })
    },
    async remove({ universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/banner` : '/api/banner'
      return apiRequest(`${base}/manage/`, { method: 'DELETE' })
    },
    async toggle(is_active, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/banner` : '/api/banner'
      return apiRequest(`${base}/toggle/`, { method: 'POST', body: { is_active: !!is_active } })
    },
  },
  documents: {
    async list({ universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/documents` : '/api/documents'
      return apiRequest(`${base}/`, { method: 'GET' })
    },
    async listAll({ universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/documents` : '/api/documents'
      const first = await apiRequest(`${base}/`, { method: 'GET' })
      if (Array.isArray(first)) return first
      const results = Array.isArray(first?.results) ? [...first.results] : []
      let nextPath = normalizeNextPath(first?.next)
      let guard = 0
      while (nextPath && guard < 100) {
        guard += 1
        const page = await apiRequest(nextPath, { method: 'GET' })
        if (Array.isArray(page)) {
          results.push(...page)
          break
        }
        if (Array.isArray(page?.results)) results.push(...page.results)
        nextPath = normalizeNextPath(page?.next)
      }
      return results
    },
    async upload(file, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/documents` : '/api/documents'
      const form = new FormData()
      form.append('file', file)
      return apiRequest(`${base}/`, { method: 'POST', body: form })
    },
    async remove(id, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/documents` : '/api/documents'
      return apiRequest(`${base}/${id}/`, { method: 'DELETE' })
    },
  },
  appearance: {
    async settings({ universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/appearance` : '/api/appearance'
      return apiRequest(`${base}/settings/`, { method: 'GET' })
    },
    async updateSettings(settings, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/appearance` : '/api/appearance'
      return apiRequest(`${base}/settings/`, { method: 'PATCH', body: { settings } })
    },
    themes: {
      async list({ universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/appearance` : '/api/appearance'
        return apiRequest(`${base}/themes/`, { method: 'GET' })
      },
      async create(payload, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/appearance` : '/api/appearance'
        return apiRequest(`${base}/themes/`, { method: 'POST', body: payload })
      },
      async update(id, payload, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/appearance` : '/api/appearance'
        return apiRequest(`${base}/themes/${id}/`, { method: 'PATCH', body: payload })
      },
      async remove(id, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/appearance` : '/api/appearance'
        return apiRequest(`${base}/themes/${id}/`, { method: 'DELETE' })
      },
      async publish(id, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/appearance` : '/api/appearance'
        return apiRequest(`${base}/themes/${id}/publish/`, { method: 'POST' })
      },
      async unpublish(id, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/appearance` : '/api/appearance'
        return apiRequest(`${base}/themes/${id}/unpublish/`, { method: 'POST' })
      },
    },
  },
  tickets: {
    templates: {
      async list({ universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/tickets` : '/api/tickets'
        return apiRequest(`${base}/templates/`, { method: 'GET' })
      },
      async create(payload, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/tickets` : '/api/tickets'
        return apiRequest(`${base}/templates/`, { method: 'POST', body: payload })
      },
      async update(id, payload, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/tickets` : '/api/tickets'
        return apiRequest(`${base}/templates/${id}/`, { method: 'PATCH', body: payload })
      },
      async remove(id, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/tickets` : '/api/tickets'
        return apiRequest(`${base}/templates/${id}/`, { method: 'DELETE' })
      },
    },
    requests: {
      async create(payload, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/tickets` : '/api/tickets'
        return apiRequest(`${base}/requests/`, { method: 'POST', body: payload })
      },
      async my({ universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/tickets` : '/api/tickets'
        return apiRequest(`${base}/requests/my/`, { method: 'GET' })
      },
      async open({ universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/tickets` : '/api/tickets'
        return apiRequest(`${base}/requests/open/`, { method: 'GET' })
      },
      async mine({ universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/tickets` : '/api/tickets'
        return apiRequest(`${base}/requests/mine/`, { method: 'GET' })
      },
      async done({ universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/tickets` : '/api/tickets'
        return apiRequest(`${base}/requests/done/`, { method: 'GET' })
      },
      async assign(id, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/tickets` : '/api/tickets'
        return apiRequest(`${base}/requests/${id}/assign/`, { method: 'POST' })
      },
      async complete(id, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/tickets` : '/api/tickets'
        return apiRequest(`${base}/requests/${id}/complete/`, { method: 'POST' })
      },
    },
  },
  courses: {
    async list({ universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/`, { method: 'GET', auth: false })
    },
    async contents(courseId, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/${courseId}/contents/`, { method: 'GET', auth: false })
    },
    async listSimple({ universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses/` : '/api/courses/'
      const list = await apiRequest(base, { method: 'GET', auth: false })
      const items = Array.isArray(list) ? list : (Array.isArray(list?.results) ? list.results : [])
      return items.filter(c => c?.course_type === 'simple')
    },
    storeCards: {
      async list({ universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/store-cards/`, { method: 'GET', auth: false })
      },
      async create(payload, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/store-cards/`, {
          method: 'POST',
          body: payload,
        })
      },
      async update(id, payload, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/store-cards/${id}/`, {
          method: 'PATCH',
          body: payload,
        })
      },
      async remove(id, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/store-cards/${id}/`, {
          method: 'DELETE',
        })
      },
    },
    filters: {
      async serialize(filters, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/filter/receive/`, {
          method: 'POST',
          body: { filters },
        })
      },
      async apply(token, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        const q = encodeURIComponent(String(token || ''))
        return apiRequest(`${base}/filter/apply/?token=${q}`, {
          method: 'GET',
          auth: false,
        })
      },
    },
    async courseSubjects(courseId, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      try {
        return await apiRequest(`${base}/${courseId}/subjects/`, { method: 'GET' })
      } catch (e) {
        if (e?.status === 404) {
          return apiRequest(`${base}/courses/${courseId}/subjects/`, { method: 'GET' })
        }
        throw e
      }
    },
    async createCourse({ title, description = '', course_type, is_active = true }, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/`, {
        method: 'POST',
        body: { title, description, course_type, is_active },
      })
    },
    async updateCourse(id, payload, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/${id}/`, {
        method: 'PATCH',
        body: payload,
      })
    },
    async deleteCourse(id, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/${id}/`, {
        method: 'DELETE',
      })
    },
    async courseContents(courseId, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/${courseId}/contents/`, { method: 'GET' })
    },
    async semesterContents(semesterId, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/semesters/${semesterId}/contents/`, { method: 'GET' })
    },
    async subjectContents(subjectId, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/subjects/${subjectId}/contents/`, { method: 'GET' })
    },
    async topicContents(topicId, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/topics/${topicId}/contents/`, { method: 'GET' })
    },
    async materialContents(materialId, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/materials/${materialId}/contents/`, { method: 'GET' })
    },
    async folderContents(folderId, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/folders/${folderId}/contents/`, { method: 'GET' })
    },
    async myCourses({ universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/my/`, { method: 'GET' })
    },
    async mySchedule({ semesterId = null, universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      const q = semesterId ? `?semester_id=${encodeURIComponent(String(semesterId))}` : ''
      return apiRequest(`${base}/schedule/my/${q}`, { method: 'GET' })
    },
    async createSemester({ course, title, delay_published_at = null }, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/semesters/`, {
        method: 'POST',
        body: { course, title, ...(delay_published_at ? { delay_published_at } : {}) },
      })
    },
    async updateSemester(id, payload, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/semesters/${id}/`, {
        method: 'PATCH',
        body: payload,
      })
    },
    async deleteSemester(id, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/semesters/${id}/`, {
        method: 'DELETE',
      })
    },
    async createSubject({ semester, title, description = '' }, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/subjects/`, {
        method: 'POST',
        body: { semester, title, description },
      })
    },
    async updateSubject(id, payload, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/subjects/${id}/`, {
        method: 'PATCH',
        body: payload,
      })
    },
    async deleteSubject(id, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/subjects/${id}/`, {
        method: 'DELETE',
      })
    },
    async createTopic({ course = null, subject = null, title, description = '' }, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      const body = { course, subject, title, description }
      return apiRequest(`${base}/topics/`, {
        method: 'POST',
        body,
      })
    },
    async updateTopic(id, payload, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/topics/${id}/`, {
        method: 'PATCH',
        body: payload,
      })
    },
    async deleteTopic(id, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/topics/${id}/`, {
        method: 'DELETE',
      })
    },
    async createMaterial({ course = null, subject = null, topic = null, title, material_type, description = '', is_published = true, free_preview = false, extra = null }, { universitySlug = null } = {}) {
      const base0 = { course, subject, topic, title, material_type, description, is_published, free_preview }
      let body = base0
      if (extra && typeof extra === 'object') {
        body = { ...base0, ...extra }
      }
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/materials/`, {
        method: 'POST',
        body,
      })
    },
    async updateMaterial(id, payload, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/materials/${id}/`, {
        method: 'PATCH',
        body: payload,
      })
    },
    async deleteMaterial(id, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/materials/${id}/`, {
        method: 'DELETE',
      })
    },
    async createFolder({ material, parent = null, title }, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/folders/`, {
        method: 'POST',
        body: { material, parent, title },
      })
    },
    async updateFolder(id, payload, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/folders/${id}/`, {
        method: 'PATCH',
        body: payload,
      })
    },
    async deleteFolder(id, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/folders/${id}/`, {
        method: 'DELETE',
      })
    },
    async uploadFile({ material, folder = null, title = '', file, file_role = 'attachment' }, { universitySlug = null } = {}) {
      const form = new FormData()
      form.append('material', String(material))
      if (folder) form.append('folder', String(folder))
      if (title) form.append('title', String(title))
      form.append('file', file)
      form.append('file_role', String(file_role))
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/files/`, {
        method: 'POST',
        body: form,
      })
    },
    async updateFile(id, payload, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/files/${id}/`, {
        method: 'PATCH',
        body: payload,
      })
    },
    async deleteFile(id, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
      return apiRequest(`${base}/files/${id}/`, {
        method: 'DELETE',
      })
    },
    progress: {
      async studentCourse({ groupId, courseId, studentId, semesterId = null, universitySlug = null }) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        const qs = semesterId ? `?semester=${encodeURIComponent(String(semesterId))}` : ''
        return apiRequest(`${base}/progress/group/${groupId}/course/${courseId}/student/${studentId}/${qs}`, {
          method: 'GET',
        })
      },
    },
    grades: {
      async groupSubject({ groupId, subjectId, universitySlug = null }) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/grades/group/${groupId}/subject/${subjectId}/`, { method: 'GET' })
      },
      async my({ universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/grades/my/`, { method: 'GET' })
      },
      async exportGroupSubject({ groupId, subjectId, universitySlug = null }) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        const res = await apiRequestResponse(`${base}/grades/export/group/${groupId}/subject/${subjectId}/`, { method: 'GET' })
        const blob = await res.blob()
        const cd = res.headers.get('content-disposition') || ''
        const match = cd.match(/filename="([^"]+)"/i)
        const filename = match?.[1] || null
        return { blob, filename, contentType: res.headers.get('content-type') || null }
      },
      async set(payload, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/grades/`, { method: 'POST', body: payload })
      },
      async update(payload, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/grades/`, { method: 'PUT', body: payload })
      },
    },
    assignments: {
      async list(subjectId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/assignments/?subject=${subjectId}`, { method: 'GET' })
      },
      async listByTopic(topicId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/assignments/?topic=${topicId}`, { method: 'GET' })
      },
      async create({ topic, subject, title, description = '', max_grade = 5, position = 0 }, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/assignments/`, {
          method: 'POST',
          body: { topic, subject, title, description, max_grade, position },
        })
      },
      async update(id, payload, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/assignments/${id}/`, {
          method: 'PATCH',
          body: payload,
        })
      },
      async remove(id, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/assignments/${id}/`, {
          method: 'DELETE',
        })
      },
      async myBySubject(subjectId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/subjects/${subjectId}/assignments/my/`, { method: 'GET' })
      },
      async myByTopic(topicId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/topics/${topicId}/assignments/my/`, { method: 'GET' })
      },
      async mySubmission(assignmentId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/assignments/${assignmentId}/my-submission/`, { method: 'GET' })
      },
      async saveMySubmission(assignmentId, payload, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/assignments/${assignmentId}/my-submission/`, { method: 'PUT', body: payload })
      },
      async myFiles(assignmentId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/assignments/${assignmentId}/my-submission/files/`, { method: 'GET' })
      },
      async uploadMyFile(assignmentId, { name, file }, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        const form = new FormData()
        form.append('name', String(name || file?.name || 'Файл'))
        form.append('file', file)
        return apiRequest(`${base}/assignments/${assignmentId}/my-submission/files/`, { method: 'POST', body: form })
      },
      async removeMyFile(assignmentId, fileId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/assignments/${assignmentId}/my-submission/files/${fileId}/`, { method: 'DELETE' })
      },
      async fetchMyFile(assignmentId, fileId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        const res = await apiRequestResponse(`${base}/assignments/${assignmentId}/my-submission/files/${fileId}/`, { method: 'GET' })
        const blob = await res.blob()
        const cd = res.headers.get('content-disposition') || ''
        const match = cd.match(/filename="([^"]+)"/i)
        const filename = match?.[1] || null
        return { blob, filename, contentType: res.headers.get('content-type') || null }
      },
    },
    tests: {
      async bySubject(subjectId, { universitySlug = null, ...requestOptions } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/subjects/${subjectId}/tests/`, { method: 'GET', ...requestOptions })
      },
      async detail(testId, { universitySlug = null, ...requestOptions } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/tests/${testId}/`, { method: 'GET', ...requestOptions })
      },
      async start(testId, { universitySlug = null, ...requestOptions } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/tests/${testId}/start/`, { method: 'POST', ...requestOptions })
      },
      async submit(testId, payload, { universitySlug = null, ...requestOptions } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/tests/${testId}/submit/`, { method: 'POST', body: payload, ...requestOptions })
      },
      async results(testId, { universitySlug = null, ...requestOptions } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/tests/${testId}/results/`, { method: 'GET', ...requestOptions })
      },
      async attempt(attemptId, { universitySlug = null, ...requestOptions } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/courses` : '/api/courses'
        return apiRequest(`${base}/tests/attempts/${attemptId}/`, { method: 'GET', ...requestOptions })
      },
    },
  },
  chats: {
    async list({ universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/chats` : '/api/chats'
      return apiRequest(`${base}/`, { method: 'GET' })
    },
    async retrieve(roomId, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/chats` : '/api/chats'
      return apiRequest(`${base}/${roomId}/`, { method: 'GET' })
    },
    async messages(roomId, { universitySlug = null, before = null, limit = 50 } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/chats` : '/api/chats'
      const params = new URLSearchParams()
      if (before) params.set('before', String(before))
      if (limit) params.set('limit', String(limit))
      const qs = params.toString()
      return apiRequest(`${base}/${roomId}/messages/${qs ? `?${qs}` : ''}`, { method: 'GET' })
    },
    async sendMessage(roomId, { text, file = null, messageType = null, replyTo = null } = {}, { universitySlug = null } = {}) {
      const base = universitySlug ? `/api/u/${universitySlug}/chats` : '/api/chats'
      if (file instanceof File) {
        const form = new FormData()
        form.append('file', file)
        const mime = String(file.type || '').toLowerCase()
        const resolvedType = messageType || (mime.startsWith('image/') ? 'image' : 'file')
        form.append('message_type', resolvedType)
        if (text) form.append('text', String(text))
        if (replyTo) form.append('reply_to', String(replyTo))
        return apiRequest(`${base}/${roomId}/messages/`, { method: 'POST', body: form })
      }
      const body = {
        text: text == null ? '' : String(text),
        message_type: messageType || 'text',
      }
      if (replyTo) body.reply_to = replyTo
      return apiRequest(`${base}/${roomId}/messages/`, { method: 'POST', body })
    },
    admin: {
      async list({ universitySlug = null, roomType = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/chats` : '/api/chats'
        const qs = roomType ? `?room_type=${encodeURIComponent(roomType)}` : ''
        return apiRequest(`${base}/admin/${qs}`, { method: 'GET' })
      },
      async teacherChats({ universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/chats` : '/api/chats'
        return apiRequest(`${base}/admin/teachers/`, { method: 'GET' })
      },
      async retrieve(roomId, { universitySlug = null } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/chats` : '/api/chats'
        return apiRequest(`${base}/admin/${roomId}/`, { method: 'GET' })
      },
      async messages(roomId, { universitySlug = null, before = null, limit = 200 } = {}) {
        const base = universitySlug ? `/api/u/${universitySlug}/chats` : '/api/chats'
        const params = new URLSearchParams()
        if (before) params.set('before', String(before))
        if (limit) params.set('limit', String(limit))
        const qs = params.toString()
        return apiRequest(`${base}/admin/${roomId}/messages/${qs ? `?${qs}` : ''}`, { method: 'GET' })
      },
    },
    websocketUrl(roomId, { universitySlug = null } = {}) {
      void universitySlug
      try {
        const base = getBaseUrl()
        const loc = typeof window !== 'undefined' ? window.location : { protocol: 'http:', host: '' }
        let host = ''
        if (base) {
          try {
            const u = new URL(base)
            host = u.host
          } catch {
            host = loc.host
          }
        } else {
          host = loc.host
        }
        const scheme = (base?.startsWith('https:') || loc.protocol === 'https:') ? 'wss' : 'ws'
        const tokens = getAuthTokens()
        const token = tokens?.access ? `?token=${encodeURIComponent(tokens.access)}` : ''
        return `${scheme}://${host}/ws/chat/${roomId}/${token}`
      } catch {
        return ''
      }
    },
  },
}
