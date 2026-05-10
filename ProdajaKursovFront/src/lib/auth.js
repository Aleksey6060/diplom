import { api, clearAuthTokens, getAuthTokens } from './api'

const storage = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) ? sessionStorage : localStorage

export function getUser() {
  const user = storage.getItem('glassroom_user')
  return user ? JSON.parse(user) : null
}

function setUser(user) {
  if (!user) return
  storage.setItem('glassroom_user', JSON.stringify(user))
}

export async function signInWithEmail(email, password) {
  const res = await api.users.login({ email, password })
  const u = res?.user && typeof res.user === 'object' ? res.user : null
  const normalized = u ? { ...u, authed: true } : { authed: true }
  setUser(normalized)
  return normalized
}

export function signInDemo(kind) {
  const base = {
    id: `demo-${kind}`,
    authed: true,
    email: kind === 'teacher' ? 'teacher@demo.local' : 'student@demo.local',
    first_name: kind === 'teacher' ? 'Учитель' : 'Студент',
    last_name: 'Демо',
    middle_name: '',
    phone: null,
    avatar: null,
    must_change_password: false,
    date_joined: new Date().toISOString(),
  }
  const user = kind === 'teacher'
    ? { ...base, account_type: 'teacher', account_type_display: 'Учитель', role: null }
    : { ...base, account_type: 'student', account_type_display: 'Учащийся', role: null }

  setUser(user)
  return user
}

export function signOut() {
  storage.removeItem('glassroom_user')
  return api.users.logout()
}

export async function refreshMeIfPossible() {
  const tokens = getAuthTokens()
  if (!tokens) return null
  try {
    const me = await api.users.me()
    const normalized = { ...me, authed: true }
    setUser(normalized)
    return normalized
  } catch {
    clearAuthTokens()
    storage.removeItem('glassroom_user')
    return null
  }
}

export function getAllAccounts() {
  const user = getUser()
  return user ? [user] : []
}
