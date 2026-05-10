import React from 'react'
import ChatShell from '../../components/ChatShell'

export default function AdminChat() {
  return <ChatShell role="admin" title="Чаты" readOnly={true} />
}
