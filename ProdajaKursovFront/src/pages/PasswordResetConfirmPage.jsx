import React, { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion as Motion } from 'framer-motion'
import { useTheme } from '../context/useTheme'
import { api } from '../lib/api'

export default function PasswordResetConfirmPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { brandText } = useTheme()

  const uid = searchParams.get('uid') || ''
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают.')
      return
    }
    if (newPassword.length < 8) {
      setError('Пароль должен содержать минимум 8 символов.')
      return
    }

    setIsLoading(true)
    try {
      await api.users.passwordResetConfirm({ uid, token, new_password: newPassword })
      setSuccess(true)
      setTimeout(() => navigate('/'), 3000)
    } catch (e2) {
      const msg = (e2?.body && typeof e2.body === 'object')
        ? (e2.body.detail || Object.values(e2.body)[0])
        : null
      setError(msg || 'Ссылка недействительна или устарела.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <Motion.div
        className="relative w-full max-w-md rounded-3xl p-8 shadow-2xl border"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, type: 'spring', stiffness: 100, damping: 20 }}
        style={{
          background: 'var(--surface-bg)',
          borderColor: 'rgba(38, 100, 121, 0.18)',
          color: 'var(--content-text)',
        }}
      >
        <div className="text-center mb-8">
          <div
            className="px-4 py-2 rounded-full mx-auto inline-flex items-center justify-center mb-3 border"
            style={{ background: 'var(--surface-bg-strong)', borderColor: 'rgba(38, 100, 121, 0.18)' }}
          >
            <span className="font-semibold tracking-wide" style={{ color: 'var(--content-text)' }}>{brandText}</span>
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--content-text)' }}>Новый пароль</h2>
          <p className="text-sm" style={{ color: 'var(--content-text-muted)' }}>Введите новый пароль для вашего аккаунта</p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              Пароль успешно изменён. Перенаправление...
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5 ml-1" style={{ color: 'var(--content-text-muted)' }}>Новый пароль</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-osnova-pink focus:ring-1 focus:ring-osnova-pink/20 transition-all"
                style={{
                  background: 'var(--surface-bg-strong)',
                  borderColor: 'rgba(38, 100, 121, 0.18)',
                  color: 'var(--content-text)',
                }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5 ml-1" style={{ color: 'var(--content-text-muted)' }}>Подтвердите пароль</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-osnova-pink focus:ring-1 focus:ring-osnova-pink/20 transition-all"
                style={{
                  background: 'var(--surface-bg-strong)',
                  borderColor: 'rgba(38, 100, 121, 0.18)',
                  color: 'var(--content-text)',
                }}
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full font-medium rounded-xl py-3 transition-colors border mt-2 flex items-center justify-center hover:brightness-110"
              style={{
                backgroundColor: 'var(--btn-primary-bg)',
                color: 'var(--btn-primary-text)',
                borderColor: 'var(--btn-primary-border)',
              }}
            >
              {isLoading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Сохранить пароль'
              }
            </button>
          </form>
        )}
      </Motion.div>
    </div>
  )
}
