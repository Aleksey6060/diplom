import React, { useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import ChatShell from '../../components/ChatShell'

export default function UserChat() {
  const { user } = useAuth()
  const role = useMemo(() => (user?.account_type === 'teacher' ? 'teacher' : 'student'), [user?.account_type])
  return <ChatShell role={role} title="Чаты" />
}
