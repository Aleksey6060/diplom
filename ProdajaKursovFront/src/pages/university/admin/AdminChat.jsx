import React from 'react'
import { useParams } from 'react-router-dom'
import ChatShell from '../../../components/ChatShell'

export default function AdminChat() {
  const { universitySlug } = useParams()
  return <ChatShell role="admin" title="Чаты" readOnly={true} universitySlug={universitySlug || null} />
}
