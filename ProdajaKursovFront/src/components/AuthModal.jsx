import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/useTheme'
import { useNavigate } from 'react-router-dom'
import { api, formatApiError } from '../lib/api'

export default function AuthModal({ isOpenOverride, onCloseOverride, isInitialScreen = false }) {
  const { isAuthModalOpen, closeAuthModal, loginWithEmail } = useAuth()
  const { brandText } = useTheme()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryStatus, setRecoveryStatus] = useState(null) // null | 'success' | 'error'
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const [recoveryError, setRecoveryError] = useState('')

  const isOpen = isInitialScreen || (isOpenOverride !== undefined && isOpenOverride !== false ? isOpenOverride : isAuthModalOpen)
  const handleClose = onCloseOverride || closeAuthModal

  if (!isOpen) return null

  const handleRecoverySubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    setRecoveryStatus(null)
    setRecoveryError('')
    setRecoveryLoading(true)
    try {
      await api.users.passwordResetRequest(recoveryEmail.trim())
      setRecoveryStatus('success')
    } catch (e2) {
      setRecoveryStatus('error')
      setRecoveryError(formatApiError(e2, 'Не удалось отправить письмо. Попробуйте позже.'))
    } finally {
      setRecoveryLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoginError('')
    setIsLoading(true)
    try {
      const newUser = await loginWithEmail(email, password)
      // Determine base path: user's university slug takes priority, then URL slug
      let base = ''
      if (newUser?.university_slug) {
        base = `/${newUser.university_slug}`
      } else {
        try {
          const p = String(window.location.pathname || '/')
          const seg = p.replace(/^\//, '').split('/')[0] || ''
          const reserved = new Set([
            '',
            'courses',
            'overview',
            'my-courses',
            'payments',
            'archived',
            'recent',
            'settings',
            'theme',
            'appearance',
            'themes',
            'chat',
            'teacher',
            'admin'
          ])
          if (seg && !reserved.has(seg)) base = `/${seg}`
        } catch { void 0 }
      }

      if (newUser?.account_type === 'teacher') {
        navigate(`${base}/teacher/groups`)
      } else if (newUser?.account_type === 'student') {
        navigate(`${base}/my-courses`)
      } else {
        navigate(`${base}/admin`)
      }
      handleClose()
    } catch (e2) {
      setLoginError(formatApiError(e2, 'Не удалось войти. Проверьте email и пароль.'))
    } finally {
      setIsLoading(false)
    }
  }

  const openRecovery = () => {
    setRecoveryEmail(String(email || '').trim())
    setRecoveryStatus(null)
    setRecoveryError('')
    setRecoveryOpen(true)
  }

  const closeRecovery = () => {
    setRecoveryOpen(false)
  }

  const modalLayout = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-5 overflow-hidden">
      {/* Background Layer: matches site background when initial screen, else standard overlay */}
      <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={!isInitialScreen ? handleClose : undefined}
        className={`absolute inset-0 ${isInitialScreen ? 'bg-transparent' : 'bg-black/40 backdrop-blur-md'}`}
        style={isInitialScreen ? { zIndex: -30 } : {}}
      />

      {/* Modal Content */}
      <Motion.div
        className="relative w-[92vw] sm:w-full max-w-md rounded-3xl p-5 sm:p-8 shadow-2xl z-10 border max-h-[84vh] sm:max-h-[92vh] overflow-auto"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.3 } }}
        transition={{ duration: 0.4, type: "spring", stiffness: 100, damping: 20 }}
        style={{
          background: 'var(--surface-bg)',
          borderColor: 'rgba(38, 100, 121, 0.18)',
          color: 'var(--content-text)'
        }}
      >
        {!isInitialScreen && (
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 w-10 h-10 transition-colors rounded-lg border hover:brightness-110 flex items-center justify-center leading-none"
            style={{
              background: 'var(--surface-bg-strong)',
              color: 'var(--content-text)',
              borderColor: 'rgba(38, 100, 121, 0.18)'
            }}
          >
            <X size={20} />
          </button>
        )}

        <div className="text-center mb-5 sm:mb-8">
          <div
            className="px-4 py-2 rounded-full mx-auto inline-flex items-center justify-center mb-3 border"
            style={{
              background: 'var(--surface-bg-strong)',
              borderColor: 'rgba(38, 100, 121, 0.18)'
            }}
          >
            <span className="font-semibold tracking-wide" style={{ color: 'var(--content-text)' }}>{brandText}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mb-1.5 sm:mb-2" style={{ color: 'var(--content-text)' }}>Вход</h2>
          <p className="text-sm" style={{ color: 'var(--content-text-muted)' }}>Авторизуйтесь чтобы продолжить</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs mb-1.5 ml-1" style={{ color: 'var(--content-text-muted)' }}>Почта</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              className="w-full border rounded-xl px-4 py-2.5 sm:py-3 focus:outline-none focus:border-osnova-pink focus:ring-1 focus:ring-osnova-pink/20 transition-all"
              style={{
                background: 'var(--surface-bg-strong)',
                borderColor: 'rgba(38, 100, 121, 0.18)',
                color: 'var(--content-text)'
              }}
            />
          </div>

          <div>
            <label className="block text-xs mb-1.5 ml-1" style={{ color: 'var(--content-text-muted)' }}>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border rounded-xl px-4 py-2.5 sm:py-3 focus:outline-none focus:border-osnova-pink focus:ring-1 focus:ring-osnova-pink/20 transition-all"
              style={{
                background: 'var(--surface-bg-strong)',
                borderColor: 'rgba(38, 100, 121, 0.18)',
                color: 'var(--content-text)'
              }}
            />
          </div>

          {loginError && (
            <div className="space-y-2">
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {loginError}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full font-medium rounded-xl py-2.5 sm:py-3 transition-colors border mt-2 flex items-center justify-center hover:brightness-110"
            style={{
              backgroundColor: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              borderColor: 'var(--btn-primary-border)'
            }}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Войти'
            )}
          </button>

          {loginError && (
            <button
              type="button"
              onClick={openRecovery}
              className="w-full rounded-xl py-2 sm:py-2.5 border transition hover:brightness-110 mt-2"
              style={{
                background: 'var(--surface-bg-strong)',
                color: 'var(--content-text)',
                borderColor: 'rgba(38, 100, 121, 0.18)',
              }}
            >
              Восстановить пароль
            </button>
          )}
        </form>

        <div className="mt-5 sm:mt-6 text-center">
          <p className="text-xs mb-1" style={{ color: 'var(--content-text-muted)' }}>Нет аккаунта?</p>
          <p className="text-xs" style={{ color: 'var(--content-text-muted)' }}>Приобретите курс по одной из наших программ.</p>
        </div>

      </Motion.div>

      <AnimatePresence>
        {recoveryOpen && (
          <Motion.div className="fixed inset-0 z-[10020] flex items-center justify-center p-5">
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeRecovery}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <Motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="relative w-[92vw] sm:w-full max-w-md rounded-3xl p-5 sm:p-8 shadow-2xl z-10 border max-h-[84vh] sm:max-h-[92vh] overflow-auto"
              style={{
                background: 'var(--surface-bg)',
                borderColor: 'rgba(38, 100, 121, 0.18)',
                color: 'var(--content-text)',
              }}
            >
              <button
                onClick={closeRecovery}
                className="absolute top-3 right-3 w-10 h-10 transition-colors rounded-lg border hover:brightness-110 flex items-center justify-center leading-none"
                style={{
                  background: 'var(--surface-bg-strong)',
                  color: 'var(--content-text)',
                  borderColor: 'rgba(38, 100, 121, 0.18)',
                }}
              >
                <X size={20} />
              </button>

              <div className="mb-6">
                <div className="text-lg font-semibold" style={{ color: 'var(--content-text)' }}>Восстановление пароля</div>
                <div className="text-sm mt-1" style={{ color: 'var(--content-text-muted)' }}>Введите почту, чтобы получить ссылку для сброса пароля</div>
              </div>

              <div className="space-y-3">
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => { setRecoveryEmail(e.target.value); setRecoveryStatus(null); setRecoveryError('') }}
                  placeholder="Введите ваш email"
                  className="w-full border rounded-xl px-4 py-2.5 sm:py-3 focus:outline-none focus:border-osnova-pink focus:ring-1 focus:ring-osnova-pink/20 transition-all"
                  style={{
                    background: 'var(--surface-bg-strong)',
                    borderColor: 'rgba(38, 100, 121, 0.18)',
                    color: 'var(--content-text)',
                  }}
                />

                {recoveryStatus === 'success' && (
                  <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    Если аккаунт найден, письмо отправлено.
                  </div>
                )}
                {recoveryError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    {recoveryError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRecoverySubmit}
                  disabled={recoveryLoading || !String(recoveryEmail || '').trim()}
                  className="w-full font-medium rounded-xl py-2.5 sm:py-3 transition-colors border flex items-center justify-center hover:brightness-110 disabled:opacity-60"
                  style={{
                    backgroundColor: 'var(--btn-primary-bg)',
                    color: 'var(--btn-primary-text)',
                    borderColor: 'var(--btn-primary-border)',
                  }}
                >
                  {recoveryLoading
                    ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : 'Отправить письмо'
                  }
                </button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  if (isInitialScreen) return modalLayout
  return createPortal(<AnimatePresence>{modalLayout}</AnimatePresence>, document.body)
}
