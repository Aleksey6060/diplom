import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { ArrowLeft, CornerUpLeft, Image as ImageIcon, Paperclip, Search, SendHorizonal, UserRound, Users, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

function initials(value) {
  const str = String(value || '').trim()
  if (!str) return ''
  const parts = str.split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] || ''
  const b = parts[1]?.[0] || ''
  return (a + b).toUpperCase()
}

function normalizeRoom(r) {
  if (!r || typeof r !== 'object') return null
  const kind = r.room_type === 'group' ? 'group' : 'personal'
  return {
    id: r.id,
    kind,
    title: r.title || '',
    subjectTitle: r.subject_title || '',
    courseTitle: r.course_title || '',
    groupTitle: r.student_group_title || '',
    partner: r.partner || null,
    teacher: r.teacher || null,
    participantsShort: r.participants_short || null,
    participantEmails: Array.isArray(r.participant_emails) ? r.participant_emails : [],
    participantsCount: Number(r.participants_count || 0),
    unreadCount: Number(r.unread_count || 0),
    isAdminTeacherChat: Boolean(r.is_admin_teacher_chat),
    lastMessage: r.last_message || null,
    updatedAt: r.updated_at || null,
    raw: r,
  }
}

function normalizeMessage(m) {
  if (!m || typeof m !== 'object') return null
  return {
    id: m.id,
    senderId: m.sender ?? m.sender_id ?? null,
    senderName: m.sender_display_name || m.sender_name || '',
    text: m.text || '',
    messageType: m.message_type || 'text',
    fileUrl: m.file_url || m.file || null,
    fileName: m.file_name || null,
    replyTo: m.reply_to || null,
    isRead: Boolean(m.is_read),
    createdAt: m.created_at || null,
  }
}

function roomTitleLines(room, role) {
  if (!room) return { line1: 'Чат', line2: '' }
  if (room.isAdminTeacherChat) {
    if (role === 'teacher') {
      return { line1: 'Администратор', line2: '' }
    }
    if (role === 'admin') {
      const t = room.participantsShort?.teacher
      const name = t?.display_name || t?.email || room.title || 'Преподаватель'
      return { line1: name, line2: '' }
    }
    return { line1: room.title || 'Чат', line2: '' }
  }
  if (room.kind === 'group') {
    if (role === 'teacher') {
      const line1 = room.groupTitle || room.subjectTitle || 'Групповой чат'
      const line2 = [room.subjectTitle, room.courseTitle].filter(Boolean).join(' • ')
      return { line1, line2 }
    }
    const line1 = room.subjectTitle || room.groupTitle || 'Групповой чат'
    const line2 = [room.groupTitle, room.courseTitle].filter(Boolean).join(' • ')
    return { line1, line2 }
  }
  const partner = room.partner
  if (role === 'admin') {
    const short = room.participantsShort || {}
    const teacherName = short.teacher?.display_name || short.teacher?.email
    const studentName = short.student?.display_name || short.student?.email
    if (teacherName || studentName) {
      return {
        line1: [teacherName, studentName].filter(Boolean).join(' — '),
        line2: room.subjectTitle || '',
      }
    }
    return {
      line1: room.title || 'Личный чат',
      line2: room.subjectTitle || '',
    }
  }
  const line1 = [room.subjectTitle, partner?.display_name].filter(Boolean).join(' • ')
    || partner?.display_name
    || partner?.email
    || room.title
    || 'Личный чат'
  const line2 = partner?.email || ''
  return { line1, line2 }
}

function formatTime(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

function formatDateTime(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString() } catch { return '' }
}

function badge(count) {
  const n = Number(count || 0)
  if (!Number.isFinite(n) || n <= 0) return null
  return (
    <span className="min-w-[22px] h-[22px] px-1 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center">
      {n > 99 ? '99+' : n}
    </span>
  )
}

function ChatList({ kind, items, activeId, isCollapsed, onOpenChat, role }) {
  const header = kind === 'group'
    ? 'Групповые чаты'
    : kind === 'admin_teacher'
      ? (role === 'admin' ? 'Чаты с учителями' : 'Администратор')
      : 'Личные чаты'
  const rowHeightPx = isCollapsed ? 56 : 84
  const gapPx = 8
  const maxRows = 5
  const maxHeightPx = rowHeightPx * maxRows + gapPx * (maxRows - 1)
  return (
    <div className={`rounded-2xl border border-[#266479]/20 bg-white overflow-hidden ${isCollapsed ? 'p-2' : 'p-4 sm:p-5'}`}>
      <div className={`flex items-center justify-between gap-2 mb-3 ${isCollapsed ? 'justify-center' : ''}`}>
        {!isCollapsed && <div className="text-[#0f2e3a] font-semibold">{header}</div>}
        {isCollapsed && (
          <div className="w-9 h-9 rounded-xl bg-white border border-[#266479]/20 flex items-center justify-center">
            {kind === 'group' ? <Users size={16} className="text-[#0f2e3a]/70" /> : <UserRound size={16} className="text-[#0f2e3a]/70" />}
          </div>
        )}
      </div>
      <div className="space-y-2 overflow-auto pr-1 custom-scrollbar" style={{ maxHeight: `${maxHeightPx}px` }}>
        {items.length === 0 && !isCollapsed && (
          <div className="text-[#5a7280] text-sm">Нет чатов</div>
        )}
        {items.map(c => {
          const selected = String(activeId) === String(c.id)
          const { line1, line2 } = roomTitleLines(c, role)
          const unread = c.unreadCount
          const avatarText = initials(kind === 'group'
            ? (c.subjectTitle || c.groupTitle)
            : kind === 'admin_teacher'
              ? (role === 'teacher'
                  ? 'Администратор'
                  : (c.participantsShort?.teacher?.display_name || c.partner?.display_name || c.title))
              : (c.partner?.display_name || c.partner?.email))
          return (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenChat(c)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenChat(c) }}
              className={`w-full text-left rounded-xl border transition flex items-center gap-3 cursor-pointer select-none outline-none overflow-hidden ${isCollapsed ? 'p-2 justify-center h-14' : 'p-3 h-[84px]'} ${selected ? 'border-emerald-300 bg-white shadow-sm' : 'border-[#266479]/20 bg-white hover:bg-black/5'}`}
              title={isCollapsed ? line1 : undefined}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-white border border-[#266479]/20 flex items-center justify-center text-[#0f2e3a] font-semibold">
                  {avatarText || (kind === 'group' ? <Users size={16} className="text-[#0f2e3a]/70" /> : <UserRound size={16} className="text-[#0f2e3a]/70" />)}
                </div>
                {role !== 'admin' && unread > 0 && (
                  <div className="absolute -top-1 -right-1">{badge(unread)}</div>
                )}
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-[#0f2e3a] font-semibold truncate">{line1 || 'Чат'}</div>
                  <div className="text-[#5a7280] text-sm truncate">{line2}</div>
                  <div className="text-[#5a7280] text-xs truncate">{formatDateTime(c.updatedAt)}</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MessageList({ messages, currentUserId, showSender, listRef, messageById, onReply, onJumpTo, onContextMenuMessage }) {
  return (
    <div ref={listRef} className="flex-1 overflow-auto space-y-3 pr-1 custom-scrollbar">
      {messages.length === 0 && (
        <div className="text-[#5a7280] text-sm">Нет сообщений</div>
      )}
      {messages.map((m) => {
        const mine = currentUserId != null && m.senderId === currentUserId
        const bubbleBase = mine ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-[#266479]/20'
        const textBase = 'text-[#0f2e3a]'
        const replyId = m.replyTo != null ? String(m.replyTo) : ''
        const replied = replyId ? messageById?.get?.(replyId) : null
        const repliedSender = replied?.senderName || ''
        const repliedText = replied
          ? (replied.text || (replied.messageType === 'image' ? 'Фото' : replied.messageType === 'file' ? 'Файл' : 'Сообщение'))
          : (replyId ? '...' : '')
        const canReply = typeof onReply === 'function' && Boolean(m?.id)

        const replyBlock = replyId ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => { if (typeof onJumpTo === 'function') onJumpTo(replyId) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (typeof onJumpTo === 'function') onJumpTo(replyId) } }}
            className="w-full text-left cursor-pointer select-none outline-none"
            title="Перейти к сообщению"
          >
            <div className="mx-3 mt-2 mb-1 admin-card rounded-lg px-2 py-1">
              {repliedSender && <div className="text-[11px] text-[#266479] truncate">{repliedSender}</div>}
              {repliedText && <div className="text-[11px] text-[#5a7280] truncate">{repliedText}</div>}
            </div>
          </div>
        ) : null

        return (
          <div
            key={m.id}
            data-message-id={String(m.id)}
            onContextMenu={(e) => {
              if (!canReply || typeof onContextMenuMessage !== 'function') return
              e.preventDefault()
              e.stopPropagation()
              const bubbleEl = e.currentTarget?.querySelector?.('[data-chat-bubble="1"]') || null
              const rect = bubbleEl?.getBoundingClientRect?.() || e.currentTarget?.getBoundingClientRect?.()
              onContextMenuMessage(e, m, { mine, rect })
            }}
            className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
          >
            <div className="max-w-[75%]">
              {showSender && !mine && m.senderName && (
                <div className="text-[11px] text-[#266479] mb-0.5 px-1">{m.senderName}</div>
              )}
              {m.messageType === 'image' && m.fileUrl ? (
                <div data-chat-bubble="1" className={`rounded-xl overflow-hidden border ${bubbleBase}`}>
                  {replyBlock}
                  <a href={m.fileUrl} target="_blank" rel="noreferrer">
                    <img src={m.fileUrl} alt={m.fileName || 'image'} className="w-full h-auto block max-h-72 object-cover" />
                  </a>
                  {m.text && <div className={`px-3 py-1 text-sm ${textBase}`}>{m.text}</div>}
                  <div className="px-2 pb-2 pt-1 text-[10px] text-[#5a7280]">{formatTime(m.createdAt)}</div>
                </div>
              ) : m.messageType === 'file' && m.fileUrl ? (
                <div data-chat-bubble="1" className={`rounded-xl border ${bubbleBase}`}>
                  {replyBlock}
                  <a
                    href={m.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`px-3 py-2 text-sm flex items-center gap-2 ${textBase}`}
                  >
                    <Paperclip size={14} />
                    <span className="truncate">{m.fileName || 'Файл'}</span>
                    <span className="text-[10px] ml-auto text-[#5a7280]">{formatTime(m.createdAt)}</span>
                  </a>
                </div>
              ) : (
                <div data-chat-bubble="1" className={`rounded-xl text-sm border ${bubbleBase} ${textBase}`}>
                  {replyBlock}
                  <div className="px-3 py-2">
                    <div className="whitespace-pre-wrap break-words">{m.text}</div>
                    <div className="mt-1 text-[10px] text-[#5a7280]">{formatTime(m.createdAt)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ChatShell({ role, title = 'Чаты', universitySlug = null, readOnly = false }) {
  const { user } = useAuth()
  const currentUserId = user?.id ?? null

  const [isMobile, setIsMobile] = useState(() => {
    try { return window.matchMedia('(max-width: 639px)').matches } catch { return false }
  })
  const [rooms, setRooms] = useState([])
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [activeId, setActiveId] = useState('')
  const [activeKind, setActiveKind] = useState('')
  const [query, setQuery] = useState('')
  const [mobileRoomsTab, setMobileRoomsTab] = useState('personal')
  const [text, setText] = useState('')
  const [messages, setMessages] = useState([])
  const [replyTarget, setReplyTarget] = useState(null)
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, message: null })
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [roomsError, setRoomsError] = useState('')
  const [chatScope, setChatScope] = useState('all')
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const wsRef = useRef(null)

  const closeContextMenu = useCallback(() => {
    setContextMenu({ open: false, x: 0, y: 0, message: null })
  }, [])

  useEffect(() => {
    if (!contextMenu.open) return () => {}
    const onKeyDown = (e) => { if (e.key === 'Escape') closeContextMenu() }
    const onScroll = () => closeContextMenu()
    const onResize = () => closeContextMenu()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [contextMenu.open, closeContextMenu])

  useEffect(() => {
    let mql
    try { mql = window.matchMedia('(max-width: 639px)') } catch { mql = null }
    if (!mql) return () => {}
    const onChange = () => setIsMobile(Boolean(mql.matches))
    onChange()
    try { mql.addEventListener('change', onChange) } catch { mql.addListener?.(onChange) }
    return () => {
      try { mql.removeEventListener('change', onChange) } catch { mql.removeListener?.(onChange) }
    }
  }, [])

  const loadRooms = useCallback(async () => {
    try {
      setRoomsError('')
      let data
      try {
        if (readOnly && role === 'admin' && chatScope === 'teachers') {
          data = await api.chats.admin.teacherChats({ universitySlug })
        } else {
          data = readOnly
            ? await api.chats.admin.list({ universitySlug })
            : await api.chats.list({ universitySlug })
        }
      } catch (e) {
        if (!readOnly) throw e
        data = await api.chats.list({ universitySlug })
      }
      const items = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
      const norm = items.map(normalizeRoom).filter(Boolean)
      setRooms(norm)
    } catch (e) {
      setRooms([])
      setRoomsError(e?.body?.detail || 'Не удалось загрузить чаты')
    } finally {
      setLoadingRooms(false)
    }
  }, [universitySlug, readOnly, role, chatScope])

  useEffect(() => { loadRooms() }, [loadRooms])

  useEffect(() => {
    const id = setInterval(() => { loadRooms() }, 15000)
    return () => clearInterval(id)
  }, [loadRooms])

  const canWriteRoom = useCallback((room) => {
    if (!room) return !readOnly
    if (!readOnly) return true
    return role === 'admin' && room.isAdminTeacherChat
  }, [readOnly, role])

  const scopedRooms = useMemo(() => {
    let list = rooms
    if (role === 'admin' && chatScope === 'all') list = list.filter(r => !r.isAdminTeacherChat)
    if (role === 'admin' && chatScope === 'teachers') list = list.filter(r => r.isAdminTeacherChat)
    if (role === 'teacher' && chatScope === 'all') list = list.filter(r => !r.isAdminTeacherChat)
    if (role === 'teacher' && chatScope === 'admin') list = list.filter(r => r.isAdminTeacherChat)
    return list
  }, [rooms, role, chatScope])

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase()
    const qCompact = q.replace(/\s+/g, '')
    let list = scopedRooms
    if (q) {
      list = scopedRooms.filter(r => {
        const { line1, line2 } = roomTitleLines(r, role)
        const candidates = [
          r.title, r.subjectTitle, r.courseTitle, r.groupTitle,
          r.partner?.display_name, r.partner?.email,
          r.teacher?.display_name, r.teacher?.email,
          r.participantsShort?.teacher?.display_name, r.participantsShort?.teacher?.email,
          r.participantsShort?.student?.display_name, r.participantsShort?.student?.email,
          r.participantEmails,
          line1, line2,
        ]
        return candidates.some(v => {
          const s = String(v || '').toLowerCase()
          if (!s) return false
          if (s.includes(q)) return true
          if (qCompact && s.replace(/\s+/g, '').includes(qCompact)) return true
          return false
        })
      })
    }
    return list.slice().sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  }, [scopedRooms, query, role])

  const groupRooms = useMemo(() => filtered.filter(r => r.kind === 'group'), [filtered])
  const adminTeacherRooms = useMemo(() => filtered.filter(r => r.isAdminTeacherChat), [filtered])
  const personalRooms = useMemo(() => filtered.filter(r => r.kind !== 'group' && !r.isAdminTeacherChat), [filtered])
  const active = useMemo(() => filtered.find(r => String(r.id) === String(activeId)) || null, [filtered, activeId])
  const canWriteActive = canWriteRoom(active)

  useEffect(() => {
    if (!activeId) return
    const stillVisible = filtered.some(r => String(r.id) === String(activeId))
    if (!stillVisible) {
      setActiveId('')
      setActiveKind('')
      setMessages([])
      setText('')
    }
  }, [filtered, activeId])

  const loadMessages = useCallback(async (roomId) => {
    if (!roomId) return
    setLoadingMessages(true)
    setError('')
    try {
      const room = rooms.find(r => String(r.id) === String(roomId))
      const canWrite = canWriteRoom(room)
      const data = !canWrite
        ? await api.chats.admin.messages(roomId, { universitySlug, limit: 200 })
        : await api.chats.messages(roomId, { universitySlug, limit: 100 })
      const items = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
      setMessages(items.map(normalizeMessage).filter(Boolean))
      setTimeout(() => { try { listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight }) } catch { void 0 } }, 50)
    } catch (e) {
      setError(e?.body?.detail || 'Не удалось загрузить сообщения')
    } finally {
      setLoadingMessages(false)
    }
  }, [universitySlug, rooms, canWriteRoom])

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    loadMessages(activeId)
  }, [activeId, loadMessages])

  useEffect(() => {
    if (!activeId || !canWriteActive) return
    const url = api.chats.websocketUrl(activeId, { universitySlug })
    if (!url) return
    let ws
    try {
      ws = new WebSocket(url)
    } catch {
      return
    }
    wsRef.current = ws
    ws.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data)
        if (payload?.type === 'chat.message' && payload.message) {
          const m = normalizeMessage(payload.message)
          if (!m) return
          setMessages(prev => {
            if (prev.some(x => String(x.id) === String(m.id))) return prev
            const next = [...prev, m]
            setTimeout(() => { try { listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: 'smooth' }) } catch { void 0 } }, 30)
            return next
          })
          if (m.id && currentUserId != null && m.senderId !== currentUserId) {
            try {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'chat.read', message_ids: [m.id] }))
              }
            } catch { void 0 }
          }
          loadRooms()
        }
      } catch { void 0 }
    }
    ws.onerror = () => { void 0 }
    return () => {
      try { ws.close() } catch { void 0 }
      if (wsRef.current === ws) wsRef.current = null
    }
  }, [activeId, universitySlug, canWriteActive, loadRooms, currentUserId])

  const openChat = (chat) => {
    if (!chat) return
    setActiveId(chat.id)
    setActiveKind(chat.kind)
    setError('')
    setReplyTarget(null)
    closeContextMenu()
    setRooms(prev => prev.map(r => String(r.id) === String(chat.id) ? { ...r, unreadCount: 0 } : r))
  }

  const closeChat = () => {
    setActiveId('')
    setActiveKind('')
    setText('')
    setMessages([])
    setReplyTarget(null)
    closeContextMenu()
  }

  const messageById = useMemo(() => {
    const map = new Map()
    for (const m of (Array.isArray(messages) ? messages : [])) {
      if (!m?.id) continue
      map.set(String(m.id), m)
    }
    return map
  }, [messages])

  const scrollToMessage = useCallback((messageId) => {
    const id = messageId == null ? '' : String(messageId)
    if (!id) return
    try {
      const el = listRef.current?.querySelector?.(`[data-message-id="${CSS.escape(id)}"]`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      try { el.animate([{ backgroundColor: 'rgba(16, 185, 129, 0.25)' }, { backgroundColor: 'rgba(0,0,0,0)' }], { duration: 700 }) } catch { void 0 }
    } catch { void 0 }
  }, [])

  const onPickReply = useCallback((m) => {
    if (!m?.id) return
    const textPreview = m.text || (m.messageType === 'image' ? 'Фото' : m.messageType === 'file' ? 'Файл' : 'Сообщение')
    setReplyTarget({
      id: m.id,
      senderName: m.senderName || '',
      text: String(textPreview || '').slice(0, 140),
    })
    setTimeout(() => { try { inputRef.current?.focus?.() } catch { void 0 } }, 0)
  }, [])

  const sendText = async () => {
    if (!canWriteRoom(active)) return
    const t = String(text || '').trim()
    if (!t || !active || sending) return
    setSending(true)
    try {
      const data = await api.chats.sendMessage(active.id, { text: t, replyTo: replyTarget?.id || null }, { universitySlug })
      const m = normalizeMessage(data)
      if (m) {
        setMessages(prev => prev.some(x => String(x.id) === String(m.id)) ? prev : [...prev, m])
      }
      setText('')
      setReplyTarget(null)
      closeContextMenu()
      loadRooms()
      setTimeout(() => { try { listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: 'smooth' }) } catch { void 0 } }, 30)
    } catch (e) {
      setError(e?.body?.detail || 'Не удалось отправить сообщение')
    } finally {
      setSending(false)
    }
  }

  const uploadFiles = async (files, type) => {
    if (!canWriteRoom(active) || !active || !files?.length) return
    setSending(true)
    try {
      for (const f of files) {
        const data = await api.chats.sendMessage(active.id, { file: f, messageType: type, replyTo: replyTarget?.id || null }, { universitySlug })
        const m = normalizeMessage(data)
        if (m) setMessages(prev => prev.some(x => String(x.id) === String(m.id)) ? prev : [...prev, m])
      }
      setReplyTarget(null)
      closeContextMenu()
      loadRooms()
    } catch (e) {
      setError(e?.body?.detail || 'Не удалось загрузить файл')
    } finally {
      setSending(false)
    }
  }

  const focusKind = active ? (activeKind === 'group' ? 'group' : 'personal') : ''
  const compactLists = !!active
  const narrowListPx = 92
  const layoutSpring = { type: 'spring', stiffness: 220, damping: 28, mass: 0.9 }
  const leftAnim = !active
    ? { flexGrow: 1, flexBasis: '0px' }
    : focusKind === 'personal' ? { flexGrow: 0, flexBasis: `${narrowListPx}px` } : { flexGrow: 1, flexBasis: '0px' }
  const rightAnim = !active
    ? { flexGrow: 1, flexBasis: '0px' }
    : focusKind === 'group' ? { flexGrow: 0, flexBasis: `${narrowListPx}px` } : { flexGrow: 1, flexBasis: '0px' }

  const subtitle = readOnly
    ? 'Журнал сообщений. В чатах с учителями доступна отправка.'
    : role === 'teacher' ? 'Чаты преподавателя' : 'Мои чаты'

  const mode = useMemo(() => {
    if (role === 'admin' && chatScope === 'teachers') return 'admin_teacher_only'
    if (role === 'teacher' && chatScope === 'admin') return 'admin_teacher_only'
    return 'all'
  }, [role, chatScope])

  useEffect(() => {
    if (mode === 'admin_teacher_only') {
      if (mobileRoomsTab !== 'admin_teacher') setMobileRoomsTab('admin_teacher')
      return
    }
    if (mobileRoomsTab !== 'group' && mobileRoomsTab !== 'personal') setMobileRoomsTab('personal')
  }, [mode, mobileRoomsTab])

  const renderChatPanel = () => {
    if (!active) return null
    const { line1, line2 } = roomTitleLines(active, role)
    const showSender = active.kind === 'group' || active.isAdminTeacherChat || !canWriteActive
    const panelClass = isMobile
      ? 'fixed left-2 right-2 top-[calc(76px+2vh)] bottom-2 z-[9985] rounded-2xl border border-[#266479]/20 bg-white p-4 flex flex-col'
      : 'rounded-2xl border border-[#266479]/20 bg-white p-4 sm:p-5 h-[56vh] flex flex-col'
    return (
      <div className={panelClass}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={closeChat} className="w-10 h-10 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a]/80 hover:bg-black/5 shrink-0 flex items-center justify-center leading-none" title="Назад">
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <div className="text-[#0f2e3a] font-semibold truncate">{line1 || 'Чат'}</div>
              <div className="text-[#5a7280] text-sm truncate">{line2}</div>
            </div>
          </div>
          {!canWriteActive && (
            <div className="text-xs text-[#266479] px-2 py-1 rounded-lg bg-[#266479]/10">только чтение</div>
          )}
        </div>

        {loadingMessages ? (
          <div className="flex-1 flex items-center justify-center text-[#5a7280] text-sm">Загрузка...</div>
        ) : (
          <MessageList
            messages={messages}
            currentUserId={currentUserId}
            showSender={showSender}
            listRef={listRef}
            messageById={messageById}
            onReply={canWriteActive ? onPickReply : null}
            onJumpTo={scrollToMessage}
            onContextMenuMessage={(e, m, meta) => {
              if (!canWriteActive) return
              const menuW = 48
              const menuH = 48
              const pad = 8
              const rect = meta?.rect || null
              const mine = Boolean(meta?.mine)
              const maxX = Math.max(pad, window.innerWidth - menuW - pad)
              const maxY = Math.max(pad, window.innerHeight - menuH - pad)
              let x = e.clientX
              let y = e.clientY
              if (rect && typeof rect.left === 'number') {
                const gap = 8
                x = mine ? (rect.left - menuW - gap) : (rect.right + gap)
                if (x < pad) x = rect.right + gap
                if (x > maxX) x = rect.left - menuW - gap
                y = rect.top + (rect.height / 2) - (menuH / 2)
              }
              x = Math.min(Math.max(pad, x), maxX)
              y = Math.min(Math.max(pad, y), maxY)
              setContextMenu({ open: true, x, y, message: m })
            }}
          />
        )}
        {error && <div className="mt-2 text-xs text-red-500">{error}</div>}

        {canWriteActive && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <label className="px-3 lg:px-4 h-11 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a] flex items-center gap-2 cursor-pointer shrink-0 hover:bg-black/5">
                <ImageIcon size={16} />
                <span className="hidden sm:inline whitespace-nowrap">Фото</span>
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { const f = Array.from(e.target.files || []); uploadFiles(f, 'image'); e.target.value = '' }} />
              </label>
              <label className="px-3 lg:px-4 h-11 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a] flex items-center gap-2 cursor-pointer shrink-0 hover:bg-black/5">
                <Paperclip size={16} />
                <span className="hidden sm:inline whitespace-nowrap">Файл</span>
                <input type="file" multiple className="hidden"
                  onChange={(e) => { const f = Array.from(e.target.files || []); uploadFiles(f, 'file'); e.target.value = '' }} />
              </label>
            </div>
            {replyTarget?.id && (
              <div className="admin-card rounded-xl px-3 py-2 flex items-start justify-between gap-2">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => scrollToMessage(replyTarget.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollToMessage(replyTarget.id) } }}
                  className="text-left min-w-0 flex-1 cursor-pointer select-none outline-none"
                  title="Перейти к сообщению"
                >
                  <div className="text-[11px] text-[#266479] truncate">{replyTarget.senderName ? `Ответ: ${replyTarget.senderName}` : 'Ответ'}</div>
                  <div className="text-[11px] text-[#5a7280] truncate">{replyTarget.text || ''}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTarget(null)}
                  className="btn-plain w-8 h-8 rounded-lg border border-[#266479]/20 text-[#0f2e3a]/70 hover:text-[#0f2e3a] flex items-center justify-center shrink-0"
                  title="Отменить ответ"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 min-w-0">
              <input
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText() } }}
                placeholder="Напишите сообщение..."
                className="min-w-0 flex-1 bg-white border border-[#266479]/20 rounded-xl px-3 py-2 text-[#0f2e3a] placeholder-[#5a7280]/70 focus:outline-none"
              />
              <button
                onClick={sendText}
                disabled={sending || !text.trim()}
                className="h-11 px-4 rounded-xl border flex items-center gap-2 shrink-0 font-semibold !bg-emerald-600 text-white disabled:opacity-60"
              >
                <SendHorizonal size={16} />
                <span className="hidden sm:inline">Отправить</span>
              </button>
            </div>
          </div>
        )}

        {contextMenu.open && createPortal(
          <div
            className="fixed inset-0 z-[12000]"
            onMouseDown={closeContextMenu}
          >
            <div
              className="fixed"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onMouseDown={(e) => { e.stopPropagation() }}
              onClick={(e) => { e.stopPropagation() }}
            >
              <div className="admin-card rounded-xl shadow-xl p-1">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (contextMenu.message) onPickReply(contextMenu.message)
                    closeContextMenu()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (contextMenu.message) onPickReply(contextMenu.message)
                      closeContextMenu()
                    }
                  }}
                  className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-black/5 transition cursor-pointer select-none outline-none"
                  title="Ответить"
                >
                  <CornerUpLeft size={18} />
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    )
  }

  return (
    <Motion.div className="overflow-hidden" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <div className="w-full max-w-screen-2xl mx-auto px-2 sm:px-4">
        <div className="mb-3">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-2xl font-bold text-[#0f2e3a]">{title}</h2>
              <div className="mt-1 text-[#266479] text-xs">{subtitle}</div>
              {roomsError && (
                <div className="mt-2 text-xs text-red-500">{roomsError}</div>
              )}
              {isMobile ? (
                <div className="mt-2 inline-flex gap-2 p-1 rounded-xl border border-[#266479]/20 bg-white">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileRoomsTab('personal')
                      setChatScope('all')
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${mobileRoomsTab === 'personal' ? 'bg-[#266479] text-white' : 'text-[#0f2e3a] hover:bg-black/5'}`}
                  >
                    Личные чаты
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileRoomsTab('group')
                      setChatScope('all')
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${mobileRoomsTab === 'group' ? 'bg-[#266479] text-white' : 'text-[#0f2e3a] hover:bg-black/5'}`}
                  >
                    Групповые чаты
                  </button>
                  {(role === 'admin' || role === 'teacher') && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileRoomsTab('admin_teacher')
                        setChatScope(role === 'admin' ? 'teachers' : 'admin')
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${mobileRoomsTab === 'admin_teacher' ? 'bg-[#266479] text-white' : 'text-[#0f2e3a] hover:bg-black/5'}`}
                    >
                      {role === 'admin' ? 'Чат с учителем' : 'Чат с администратором'}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {role === 'admin' && (
                    <div className="mt-2 inline-flex gap-2 p-1 rounded-xl border border-[#266479]/20 bg-white">
                      <button
                        type="button"
                        onClick={() => setChatScope('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${chatScope === 'all' ? 'bg-[#266479] text-white' : 'text-[#0f2e3a] hover:bg-black/5'}`}
                      >
                        Все чаты
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatScope('teachers')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${chatScope === 'teachers' ? 'bg-[#266479] text-white' : 'text-[#0f2e3a] hover:bg-black/5'}`}
                      >
                        Чаты с учителями
                      </button>
                    </div>
                  )}
                  {role === 'teacher' && (
                    <div className="mt-2 inline-flex gap-2 p-1 rounded-xl border border-[#266479]/20 bg-white">
                      <button
                        type="button"
                        onClick={() => setChatScope('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${chatScope === 'all' ? 'bg-[#266479] text-white' : 'text-[#0f2e3a] hover:bg-black/5'}`}
                      >
                        Все чаты
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatScope('admin')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${chatScope === 'admin' ? 'bg-[#266479] text-white' : 'text-[#0f2e3a] hover:bg-black/5'}`}
                      >
                        Администратор
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#266479]/70" size={16} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Поиск по чатам"
                className="w-full bg-white border border-[#266479]/20 rounded-xl py-2 pl-9 pr-3 text-[#0f2e3a] placeholder-[#5a7280]/70 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {loadingRooms && rooms.length === 0 ? (
          <div className="text-[#5a7280] text-sm py-6">Загрузка чатов...</div>
        ) : filtered.length === 0 ? (
          <div className="text-[#5a7280] text-sm py-6">
            {readOnly
                ? 'Чатов пока нет.'
                : 'Чатов пока нет. Они появятся автоматически, когда вас добавят в группу или назначат преподавателем.'}
          </div>
        ) : (
          isMobile ? (
            active ? (
              <div className="min-w-0">
                {renderChatPanel()}
              </div>
            ) : mode === 'admin_teacher_only' ? (
              <div className="grid grid-cols-1 gap-3">
                <ChatList kind="admin_teacher" items={adminTeacherRooms} activeId={activeId} isCollapsed={false} onOpenChat={openChat} role={role} />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <ChatList
                  kind={mobileRoomsTab === 'group' ? 'group' : 'personal'}
                  items={mobileRoomsTab === 'group' ? groupRooms : personalRooms}
                  activeId={activeId}
                  isCollapsed={false}
                  onOpenChat={openChat}
                  role={role}
                />
              </div>
            )
          ) : mode === 'admin_teacher_only' ? (
            <Motion.div layout className="flex gap-3 sm:gap-4 items-stretch">
              <Motion.div
                layout
                transition={layoutSpring}
                className="min-w-0 shrink-0"
                animate={active ? { width: `${narrowListPx}px` } : { width: '100%' }}
              >
                <ChatList
                  kind="admin_teacher"
                  items={adminTeacherRooms}
                  activeId={activeId}
                  isCollapsed={!!active}
                  onOpenChat={openChat}
                  role={role}
                />
              </Motion.div>
              <AnimatePresence>
                {active && (
                  <Motion.div
                    key="admin-teacher-panel"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.18 }}
                    className="min-w-0 flex-1"
                  >
                    {renderChatPanel()}
                  </Motion.div>
                )}
              </AnimatePresence>
            </Motion.div>
          ) : (
            <Motion.div layout className="flex gap-3 sm:gap-4 items-stretch">
              <Motion.div layout transition={layoutSpring} className="min-w-0" animate={leftAnim}>
                {active && focusKind === 'group' ? (
                  <div className="flex gap-3 sm:gap-4">
                    <Motion.div layout transition={layoutSpring} style={{ width: narrowListPx }}>
                      <ChatList kind="group" items={groupRooms} activeId={activeId} isCollapsed={true} onOpenChat={openChat} role={role} />
                    </Motion.div>
                    <div className="min-w-0 flex-1">{renderChatPanel()}</div>
                  </div>
                ) : (
                  <ChatList kind="group" items={groupRooms} activeId={activeId} isCollapsed={compactLists} onOpenChat={openChat} role={role} />
                )}
              </Motion.div>

              <Motion.div layout transition={layoutSpring} className="min-w-0" animate={rightAnim}>
                {active && focusKind === 'personal' ? (
                  <div className="flex gap-3 sm:gap-4">
                    <Motion.div layout transition={layoutSpring} style={{ width: narrowListPx }}>
                      <ChatList kind="personal" items={personalRooms} activeId={activeId} isCollapsed={true} onOpenChat={openChat} role={role} />
                    </Motion.div>
                    <div className="min-w-0 flex-1">{renderChatPanel()}</div>
                  </div>
                ) : (
                  <ChatList kind="personal" items={personalRooms} activeId={activeId} isCollapsed={compactLists} onOpenChat={openChat} role={role} />
                )}
              </Motion.div>
            </Motion.div>
          )
        )}

        <AnimatePresence>
          {!active && (groupRooms.length > 0 || personalRooms.length > 0 || adminTeacherRooms.length > 0) && (
            <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 text-[#266479] text-xs">
              Выберите чат слева, чтобы открыть диалог
            </Motion.div>
          )}
        </AnimatePresence>
      </div>
    </Motion.div>
  )
}
