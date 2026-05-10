import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Folder, FileText, Plus, Upload, ArrowLeft, Home, Pencil, Trash2, ChevronDown } from 'lucide-react'
import CustomSelect from '../../../components/CustomSelect'
import TestEditorModal from '../../../components/TestEditorModal'
import { api } from '../../../lib/api'
import { useAuth } from '../../../context/AuthContext'

function makeId() {
  return String(Date.now() + Math.random())
}

function editTextClass(size, bold, align) {
  const sizeClass = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base'
  const boldClass = bold ? 'font-semibold' : 'font-normal'
  const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : align === 'justify' ? 'text-justify' : 'text-left'
  return [sizeClass, boldClass, alignClass].join(' ')
}
function seed() {
  return {
    id: 'root',
    name: 'Курсы',
    type: 'folder',
    children: [
      {
        id: makeId(),
        name: 'SQL Fundamentals',
        type: 'folder',
        children: [
          { id: makeId(), name: 'Тема 1: знакомство с SQL', type: 'folder', children: [], files: [] },
          { id: makeId(), name: 'Тема 2: SELECT и фильтрация', type: 'folder', children: [], files: [] },
        ],
        files: []
      },
      {
        id: makeId(),
        name: 'React Native Masterclass',
        type: 'folder',
        children: [
          { id: makeId(), name: 'Тема 1: установка и настройка', type: 'folder', children: [], files: [] },
          { id: makeId(), name: 'Тема 2: навигация', type: 'folder', children: [], files: [] },
        ],
        files: []
      },
      {
        id: makeId(),
        name: 'Fullstack Python',
        type: 'folder',
        children: [
          { id: makeId(), name: 'Тема 1: Django основы', type: 'folder', children: [], files: [] },
          { id: makeId(), name: 'Тема 2: FastAPI', type: 'folder', children: [], files: [] },
        ],
        files: []
      },
      {
        id: makeId(),
        name: 'UI/UX Design',
        type: 'folder',
        children: [
          { id: makeId(), name: 'Тема 1: композиция', type: 'folder', children: [], files: [] },
          { id: makeId(), name: 'Тема 2: типографика', type: 'folder', children: [], files: [] },
        ],
        files: []
      },
      {
        id: makeId(),
        name: 'DevOps Engineering',
        type: 'folder',
        children: [
          { id: makeId(), name: 'Тема 1: Docker', type: 'folder', children: [], files: [] },
          { id: makeId(), name: 'Тема 2: Kubernetes', type: 'folder', children: [], files: [] },
        ],
        files: []
      },
      {
        id: makeId(),
        name: 'Data Science',
        type: 'folder',
        children: [
          { id: makeId(), name: 'Тема 1: Python для анализа', type: 'folder', children: [], files: [] },
          { id: makeId(), name: 'Тема 2: Pandas', type: 'folder', children: [], files: [] },
        ],
        files: []
      }
    ],
    files: []
  }
}

const KEY = 'admin_courses_tree'
function loadTree() {
  try {
    const saved = localStorage.getItem(KEY)
    return saved ? JSON.parse(saved) : seed()
  } catch {
    return seed()
  }
}
function saveTree(tree) {
  try { localStorage.setItem(KEY, JSON.stringify(tree)) } catch {}
}

function findNodeByPath(root, path) {
  let node = root
  for (let i = 1; i < path.length; i++) {
    node = node.children.find(x => x.id === path[i]) || node
  }
  return node
}

function LegacyAdminCourses() {
  const [tree, setTree] = useState(() => loadTree())
  const [path, setPath] = useState([tree.id])
  const [newFolderName, setNewFolderName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [rootCreateOpen, setRootCreateOpen] = useState(false)
  const [rootCode, setRootCode] = useState('')
  const [rootTitle, setRootTitle] = useState('')
  const [rootKeywords, setRootKeywords] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editCode, setEditCode] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editKeywords, setEditKeywords] = useState('')
  const [editTitleOnlyOpen, setEditTitleOnlyOpen] = useState(false)
  const [editTitleOnly, setEditTitleOnly] = useState('')
  const [subCreateOpen, setSubCreateOpen] = useState(false)
  const [subTitle, setSubTitle] = useState('')
  const [textOpen, setTextOpen] = useState(false)
  const [textValue, setTextValue] = useState('')
  const [testOpen, setTestOpen] = useState(false)
  const [textSize, setTextSize] = useState('md')
  const [textBold, setTextBold] = useState(false)
  const [textAlign, setTextAlign] = useState('left')
  const [textIndent, setTextIndent] = useState('0')
  const [editTextOpen, setEditTextOpen] = useState(false)
  const [editTextId, setEditTextId] = useState(null)
  const [editTextValue, setEditTextValue] = useState('')
  const [editTextSize, setEditTextSize] = useState('md')
  const [editTextBold, setEditTextBold] = useState(false)
  const [editTextAlign, setEditTextAlign] = useState('left')
  const [editTextIndent, setEditTextIndent] = useState('0')
  const [expandedTests, setExpandedTests] = useState([])
  const [editTestOpen, setEditTestOpen] = useState(false)
  const [editTestId, setEditTestId] = useState(null)
  const [editItemIndex, setEditItemIndex] = useState(null)
  const [editItemQuestion, setEditItemQuestion] = useState('')
  const [editItemAnswers, setEditItemAnswers] = useState(['', '', '', ''])
  const [editItemCorrectIndex, setEditItemCorrectIndex] = useState(0)
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [addItemQuestion, setAddItemQuestion] = useState('')
  const [addItemAnswers, setAddItemAnswers] = useState(['', '', '', ''])
  const [addItemCorrectIndex, setAddItemCorrectIndex] = useState(0)
  const [adminQuery, setAdminQuery] = useState(() => {
    try { return localStorage.getItem('admin_search_query') || '' } catch { return '' }
  })
  useEffect(() => {
    const onAdminSearch = (e) => { setAdminQuery((e.detail && e.detail.query) || '') }
    window.addEventListener('admin_search_update', onAdminSearch)
    return () => window.removeEventListener('admin_search_update', onAdminSearch)
  }, [])

  useEffect(() => { saveTree(tree) }, [tree])
  useEffect(() => { setPath([tree.id]) }, [tree.id])

  const MAX_DEPTH = 10
  const current = useMemo(() => findNodeByPath(tree, path), [tree, path])
  const filteredChildren = useMemo(() => {
    const list = current.children || []
    const q = (adminQuery || '').trim().toLowerCase()
    if (!q) return list
    if (path.length === 1) {
      return list.filter(f => {
        const code = (f.name || '').toLowerCase()
        const title = (f.title || '').toLowerCase()
        const tags = (f.tags || []).join(',').toLowerCase()
        return code.includes(q) || title.includes(q) || tags.includes(q)
      })
    }
    return list.filter(f => (f.title || f.name || '').toLowerCase().includes(q))
  }, [current, path, adminQuery])

  const filteredFiles = useMemo(() => {
    const list = current.files || []
    const q = (adminQuery || '').trim().toLowerCase()
    if (!q || path.length === 1) return list
    return list.filter(f => (f.name || '').toLowerCase().includes(q))
  }, [current, path, adminQuery])

  const renderHighlight = (text) => {
    const q = (adminQuery || '').trim()
    if (!q) return text
    const source = String(text || '')
    const lower = source.toLowerCase()
    const qLower = q.toLowerCase()
    let i = 0
    const parts = []
    while (true) {
      const pos = lower.indexOf(qLower, i)
      if (pos === -1) {
        parts.push(source.slice(i))
        break
      }
      if (pos > i) parts.push(source.slice(i, pos))
      parts.push(
        <span key={`${pos}-${qLower}`} className="px-1 rounded bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-200">
          {source.slice(pos, pos + qLower.length)}
        </span>
      )
      i = pos + qLower.length
    }
    return <>{parts}</>
  }

  const enterFolder = (id) => setPath(p => (p.length - 1 >= MAX_DEPTH ? p : [...p, id]))
  const goUp = () => setPath(p => p.length > 1 ? p.slice(0, -1) : p)
  const goRoot = () => setPath([tree.id])

  const addSubFolder = () => {
    const title = subTitle.trim()
    if (!title) return
    if ((path.length - 1) >= MAX_DEPTH) return
    const folder = { id: makeId(), name: '', title, type: 'folder', children: [], files: [], blocks: [] }
    setTree(prev => {
      const copy = JSON.parse(JSON.stringify(prev))
      const node = findNodeByPath(copy, path)
      node.children.push(folder)
      return copy
    })
    setSubTitle('')
    setSubCreateOpen(false)
  }
  const addRootFolder = () => {
    const code = rootCode.trim()
    const title = rootTitle.trim()
    const keywords = rootKeywords.split(',').map(s => s.trim()).filter(Boolean)
    if (!code) return
    const folder = { id: makeId(), name: code, title, tags: keywords, type: 'folder', children: [], files: [] }
    setTree(prev => {
      const copy = JSON.parse(JSON.stringify(prev))
      copy.children.push(folder)
      return copy
    })
    setRootCode('')
    setRootTitle('')
    setRootKeywords('')
    setRootCreateOpen(false)
  }

  const onUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    const readAll = await Promise.all(files.map(f => new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve({ name: f.name, url: reader.result, type: f.type })
      reader.readAsDataURL(f)
    })))
    setTree(prev => {
      const copy = JSON.parse(JSON.stringify(prev))
      const node = findNodeByPath(copy, path)
      if (path.length > 2) {
        node.blocks = node.blocks || []
        readAll.forEach(r => node.blocks.push({ id: makeId(), type: 'file', name: r.name, url: r.url, mime: r.type }))
      } else {
        node.files = node.files || []
        readAll.forEach(r => node.files.push({ id: makeId(), name: r.name, type: 'file', url: r.url, mime: r.type }))
      }
      return copy
    })
    setUploading(false)
    e.target.value = ''
  }

  const breadcrumbs = useMemo(() => {
    const names = []
    let node = tree
    names.push({ id: node.id, name: node.name })
    for (let i = 1; i < path.length; i++) {
      node = node.children.find(x => x.id === path[i]) || node
      names.push({ id: node.id, name: node.name })
    }
    return names
  }, [tree, path])

  const openEditRootFolder = (id) => {
    if (path.length !== 1) return
    const node = tree.children.find(x => x.id === id)
    if (!node) return
    setEditId(id)
    setEditCode(node.name || '')
    setEditTitle(node.title || '')
    setEditKeywords((node.tags || []).join(', '))
    setEditOpen(true)
  }
  const saveEditRootFolder = () => {
    const code = editCode.trim()
    const title = editTitle.trim()
    const tags = editKeywords.split(',').map(s => s.trim()).filter(Boolean)
    if (!code || !editId) return
    setTree(prev => {
      const copy = JSON.parse(JSON.stringify(prev))
      const idx = copy.children.findIndex(x => x.id === editId)
      if (idx >= 0) {
        copy.children[idx].name = code
        copy.children[idx].title = title
        copy.children[idx].tags = tags
      }
      return copy
    })
    setEditOpen(false)
    setEditId(null)
  }

  const openEditFolder = (id) => {
    if (path.length === 1) {
      openEditRootFolder(id)
      return
    }
    const node = current.children.find(x => x.id === id)
    if (!node) return
    setEditId(id)
    setEditTitleOnly(node.title || '')
    setEditTitleOnlyOpen(true)
  }
  const saveEditTitleOnly = () => {
    const title = editTitleOnly.trim()
    if (!editId) return
    setTree(prev => {
      const copy = JSON.parse(JSON.stringify(prev))
      const node = findNodeByPath(copy, path)
      const idx = node.children.findIndex(x => x.id === editId)
      if (idx >= 0) node.children[idx].title = title
      return copy
    })
    setEditTitleOnlyOpen(false)
    setEditId(null)
  }
  const addTextBlock = () => {
    const text = textValue.trim()
    if (!text) return
    setTree(prev => {
      const copy = JSON.parse(JSON.stringify(prev))
      const node = findNodeByPath(copy, path)
      node.blocks = node.blocks || []
      node.blocks.push({
        id: makeId(),
        type: 'text',
        text,
        style: {
          size: textSize,
          bold: textBold,
          align: textAlign,
          indent: textIndent
        }
      })
      return copy
    })
    setTextValue('')
    setTextSize('md')
    setTextBold(false)
    setTextAlign('left')
    setTextIndent('0')
    setTextOpen(false)
  }
  function shuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = a[i]; a[i] = a[j]; a[j] = t
    }
    return a
  }
  const handleTestCsv = async (file) => {
    const text = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.readAsText(file, 'utf-8')
    })
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const items = []
    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim())
      if (parts.length < 2) continue
      const q = parts[0]
      const answersRaw = parts.slice(1)
      const shuffled = shuffle(answersRaw)
      const correctIndex = shuffled.indexOf(answersRaw[0])
      items.push({ question: q, answers: shuffled, correctIndex })
    }
    setTree(prev => {
      const copy = JSON.parse(JSON.stringify(prev))
      const node = findNodeByPath(copy, path)
      node.blocks = node.blocks || []
      node.blocks.push({ id: makeId(), type: 'test', items })
      return copy
    })
    setTestOpen(false)
  }
  const downloadCsvTemplate = () => {
    const header = 'Вопрос,Ответ1(правильный),Ответ2,Ответ3,Ответ4\n'
    const sample = 'Сколько будет 2+2?,4,3,5,6\nСтолица Франции?,Париж,Лион,Марсель,Ницца\n'
    const blob = new Blob([header + sample], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'test_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  const deleteBlock = (id) => {
    setTree(prev => {
      const copy = JSON.parse(JSON.stringify(prev))
      const node = findNodeByPath(copy, path)
      node.blocks = (node.blocks || []).filter(b => b.id !== id)
      return copy
    })
  }
  const deleteFileShallow = (id) => {
    setTree(prev => {
      const copy = JSON.parse(JSON.stringify(prev))
      const node = findNodeByPath(copy, path)
      node.files = (node.files || []).filter(f => f.id !== id)
      return copy
    })
  }
  const toggleExpandTest = (id) => {
    setExpandedTests(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const openEditTestItem = (testId, idx) => {
    const node = findNodeByPath(tree, path)
    const block = (node.blocks || []).find(b => b.id === testId)
    if (!block) return
    const item = block.items[idx]
    setEditTestId(testId)
    setEditItemIndex(idx)
    setEditItemQuestion(item.question)
    setEditItemAnswers(item.answers.slice(0, 4))
    setEditItemCorrectIndex(item.correctIndex)
    setEditTestOpen(true)
  }
  const saveEditTestItem = () => {
    setTree(prev => {
      const copy = JSON.parse(JSON.stringify(prev))
      const node = findNodeByPath(copy, path)
      const block = (node.blocks || []).find(b => b.id === editTestId)
      if (block && block.items[editItemIndex]) {
        block.items[editItemIndex] = {
          question: editItemQuestion.trim(),
          answers: editItemAnswers.map(a => a.trim()).filter(Boolean),
          correctIndex: editItemCorrectIndex
        }
      }
      return copy
    })
    setEditTestOpen(false)
    setEditTestId(null)
    setEditItemIndex(null)
  }
  const deleteEditTestItem = () => {
    setTree(prev => {
      const copy = JSON.parse(JSON.stringify(prev))
      const node = findNodeByPath(copy, path)
      const block = (node.blocks || []).find(b => b.id === editTestId)
      if (block && typeof editItemIndex === 'number') {
        block.items.splice(editItemIndex, 1)
      }
      return copy
    })
    setEditTestOpen(false)
    setEditTestId(null)
    setEditItemIndex(null)
  }
  const openAddTestItem = (testId) => {
    setAddItemQuestion('')
    setAddItemAnswers(['', '', '', ''])
    setAddItemCorrectIndex(0)
    setEditTestId(testId)
    setAddItemOpen(true)
  }
  const saveAddTestItem = () => {
    setTree(prev => {
      const copy = JSON.parse(JSON.stringify(prev))
      const node = findNodeByPath(copy, path)
      const block = (node.blocks || []).find(b => b.id === editTestId)
      if (block) {
        block.items.push({
          question: addItemQuestion.trim(),
          answers: addItemAnswers.map(a => a.trim()).filter(Boolean),
          correctIndex: addItemCorrectIndex
        })
      }
      return copy
    })
    setAddItemOpen(false)
    setEditTestId(null)
  }

  return (
    <motion.div className="space-y-6 pt-4" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <div>
        <h2 className="text-2xl font-bold text-[#0f2e3a]">Курсы</h2>
      </div>

      <div className="admin-card rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm flex-1 min-w-0 overflow-x-auto whitespace-nowrap pr-2">
          {breadcrumbs.map((b, idx) => (
            <button
              key={b.id}
              onClick={() => setPath(path.slice(0, idx + 1))}
              className={`px-3 py-1 rounded-lg border max-w-[240px] ${
                idx === 1
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-white hover:bg-emerald-500/15'
                  : 'bg-white/10 border-white/20 text-white/80 hover:text-white'
              }`}
              title={b.name}
            >
              <span className="truncate">{b.name}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3" />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={goRoot} className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white flex items-center gap-2">
            <Home size={16} />
            <span>Главная</span>
          </button>
          <button onClick={goUp} className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white flex items-center gap-2">
            <ArrowLeft size={16} />
            <span>Назад</span>
          </button>
        </div>
        {path.length === 1 && (
          <button
            onClick={() => setRootCreateOpen(true)}
            className="px-4 py-2 rounded-xl !bg-emerald-600 !border-emerald-600/40 whitespace-nowrap sm:mt-0 mt-2"
          >
            Создать папку в корне
          </button>
        )}
        {path.length > 1 && (
          <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-nowrap lg:items-center lg:gap-3 lg:overflow-x-auto lg:whitespace-nowrap">
            <button
              onClick={() => setSubCreateOpen(true)}
              disabled={(path.length - 1) >= MAX_DEPTH}
              className={`w-full px-4 py-2 rounded-xl border ${((path.length - 1) >= MAX_DEPTH) ? 'border-white/10 bg-white/10 text-white/60 cursor-not-allowed' : '!border-emerald-600/40 !bg-emerald-600 hover:!bg-emerald-700'}`}
            >
              Создать папку
            </button>
            <label className="w-full px-4 py-2 rounded-xl !bg-orange-500 !border-orange-600/40 text-white flex items-center gap-2 cursor-pointer">
              <Upload size={16} />
              <span>{uploading ? 'Загрузка…' : 'Прикрепить файлы'}</span>
              <input type="file" multiple accept="*/*" onChange={onUpload} className="hidden" />
            </label>
            {path.length > 2 && (
              <>
                <button
                  onClick={() => setTextOpen(true)}
                  className="w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 border border-emerald-600/40 text-white"
                >
                  Добавить описание
                </button>
                <button
                  onClick={() => setTestOpen(true)}
                  className="w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 border border-emerald-600/40 text-white"
                >
                  Добавить тестирование
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {path.length > 1 && (
        <div className="mt-2">
          {(path.length - 1) >= MAX_DEPTH && (
            <span className="ml-2 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[#266479] text-xs">
              Лимит вложенности 10
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3">
        {filteredChildren.map((child, idx) => (
          <div
            key={child.id}
            className="admin-card rounded-2xl p-4 flex items-center gap-3 text-left hover:bg-white/10 relative w-full"
            onClick={() => enterFolder(child.id)}
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Folder size={18} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white font-medium truncate">{renderHighlight(child.title || child.name)}</div>
              <div className="text-[#266479] text-xs truncate">{child.title ? child.name : 'Папка'}</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); openEditFolder(child.id) }}
              className="absolute top-2 right-2 px-1.5 py-1.5 rounded-md bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/15"
              title="Редактировать"
            >
              <Pencil size={12} />
            </button>
          </div>
        ))}
        {filteredFiles.map(f => (
          <div
            key={f.id}
            className="admin-card rounded-2xl p-4 flex items-center gap-3 hover:bg-white/10 relative w-full"
          >
            <a href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                <FileText size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-white font-medium truncate">{renderHighlight(f.name)}</div>
                <div className="text-gray-400 text-xs">Файл</div>
              </div>
            </a>
            <button
              onClick={() => deleteFileShallow(f.id)}
              className="icon-btn absolute top-2 right-2 p-1.5 rounded-md bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/15"
              title="Удалить файл"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      {path.length > 2 && (
        <div className="space-y-3">
          {(current.blocks || []).map(b => {
            if (b.type === 'text') {
              return (
                <div key={b.id} className="admin-card rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-gray-400 text-xs">Описание</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditTextId(b.id)
                          setEditTextValue(b.text || '')
                          setEditTextSize(b.style?.size || 'md')
                          setEditTextBold(!!b.style?.bold)
                          setEditTextAlign(b.style?.align || 'left')
                          setEditTextIndent(String(b.style?.indent || '0'))
                          setEditTextOpen(true)
                        }}
                        className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/15 text-sm"
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => deleteBlock(b.id)}
                        className="icon-btn p-2 rounded-lg bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/15"
                        title="Удалить описание"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div
                    className={[
                      'text-white/90',
                      editTextClass(b.style?.size, b.style?.bold, b.style?.align)
                    ].join(' ')}
                    style={{ textIndent: `${Number(b.style?.indent || 0)}em` }}
                  >
                    {b.text}
                  </div>
                </div>
              )
            }
            if (b.type === 'file') {
              return (
                <div key={b.id} className="admin-card rounded-2xl p-4 flex items-center gap-3 hover:bg-white/10 relative">
                  <a href={b.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                      <FileText size={18} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">{b.name}</div>
                      <div className="text-gray-400 text-xs">Файл</div>
                    </div>
                  </a>
                  <button
                    onClick={() => deleteBlock(b.id)}
                    className="icon-btn absolute top-2 right-2 p-1.5 rounded-md bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/15"
                    title="Удалить файл"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            }
            if (b.type === 'test') {
              const isExpanded = expandedTests.includes(b.id)
              return (
                <div key={b.id} className="admin-card rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">Тест</div>
                      <div className="text-gray-400 text-sm">Вопросов: {b.items.length}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-center lg:flex-nowrap lg:overflow-x-auto lg:whitespace-nowrap">
                      <button
                        onClick={() => openAddTestItem(b.id)}
                        className="px-3 lg:px-4 h-11 rounded-xl bg-white/10 border border-white/20 text-white flex items-center gap-2 shrink-0"
                      >
                        <FileText size={16} />
                        <span className="hidden sm:inline whitespace-nowrap btn-label">Добавить вопрос</span>
                      </button>
                      <button
                        onClick={() => toggleExpandTest(b.id)}
                        className="px-3 lg:px-4 h-11 rounded-xl bg-white/10 border border-white/20 text-white flex items-center gap-2 shrink-0"
                      >
                        <ChevronDown size={16} />
                        <span className="hidden sm:inline whitespace-nowrap btn-label">{isExpanded ? 'Свернуть' : 'Раскрыть'}</span>
                      </button>
                      <button
                        onClick={() => deleteBlock(b.id)}
                        className="px-3 lg:px-4 h-11 rounded-xl bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/15 flex items-center gap-2 shrink-0"
                        title="Удалить тест"
                      >
                        <Trash2 size={16} />
                        <span className="hidden sm:inline whitespace-nowrap btn-label">Удалить</span>
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-4 space-y-4">
                      {b.items.map((it, idx) => (
                        <div key={idx} className="rounded-xl border border-white/10 p-4">
                          <div className="flex items-center justify-between">
                            <div className="text-white font-medium">{it.question}</div>
                            <button
                              onClick={() => openEditTestItem(b.id, idx)}
                              className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/15 text-sm"
                            >
                              Редактировать
                            </button>
                          </div>
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                            {it.answers.map((ans, i) => (
                              <div
                                key={i}
                                className={`px-3 py-2 rounded-lg border text-sm ${
                                  i === it.correctIndex
                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                    : 'bg-white/5 border-white/10 text-white/80'
                                }`}
                              >
                                {ans}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            }
            return null
          })}
        </div>
      )}
      {createPortal(
        <AnimatePresence>
          {rootCreateOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setRootCreateOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-2xl"
              />
              <motion.div
                className="relative w-full max-w-xl admin-card rounded-3xl p-6 shadow-2xl"
                data-panel="true"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-white font-semibold mb-4">Создание папки в корне</div>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Код папки</label>
                      <input
                        value={rootCode}
                        onChange={(e) => setRootCode(e.target.value)}
                        placeholder="mat-1132-2017"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Название</label>
                      <input
                        value={rootTitle}
                        onChange={(e) => setRootTitle(e.target.value)}
                        placeholder="Математика 2017, поток 1132"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Ключевые слова</label>
                      <input
                        value={rootKeywords}
                        onChange={(e) => setRootKeywords(e.target.value)}
                        placeholder="math, математика, 2017, 1132"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={addRootFolder} className="px-4 py-2 rounded-xl !bg-emerald-600 !border-emerald-600/40">
                      Создать
                    </button>
                    <button onClick={() => setRootCreateOpen(false)} className="px-4 py-2 rounded-xl !bg-red-600 !border-red-600/40">
                      Отмена
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
      {createPortal(
        <AnimatePresence>
          {editTestOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditTestOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-2xl"
              />
              <motion.div
                className="relative w-full max-w-xl admin-card rounded-3xl p-6 shadow-2xl"
                data-panel="true"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-white font-semibold">Редактировать вопрос</div>
                  <button
                    onClick={deleteEditTestItem}
                    className="px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/25 text-sm"
                  >
                    Удалить вопрос
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Вопрос</label>
                    <input
                      value={editItemQuestion}
                      onChange={(e) => setEditItemQuestion(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                      placeholder="Текст вопроса"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {editItemAnswers.map((a, i) => (
                      <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
                        <input
                          value={a}
                          onChange={(e) => {
                            const v = e.target.value
                            setEditItemAnswers(prev => prev.map((x, idx) => idx === i ? v : x))
                          }}
                          className="w-full flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                          placeholder={`Ответ ${i + 1}`}
                        />
                        <label className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
                          <input
                            type="radio"
                            checked={editItemCorrectIndex === i}
                            onChange={() => setEditItemCorrectIndex(i)}
                          />
                          правильный
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={saveEditTestItem} className="px-4 py-2 rounded-xl bg-osnova-pink hover:bg-osnova-pink/90 text-white border border-white/10">
                      Сохранить
                    </button>
                    <button onClick={() => setEditTestOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white">
                      Отмена
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
      {createPortal(
        <AnimatePresence>
          {addItemOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setAddItemOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-2xl"
              />
              <motion.div
                className="relative w-full max-w-xl glass border border-white/10 rounded-3xl p-6 shadow-2xl"
                data-panel="true"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-white font-semibold mb-4">Добавить вопрос</div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Вопрос</label>
                    <input
                      value={addItemQuestion}
                      onChange={(e) => setAddItemQuestion(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                      placeholder="Текст вопроса"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {addItemAnswers.map((a, i) => (
                      <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
                        <input
                          value={a}
                          onChange={(e) => {
                            const v = e.target.value
                            setAddItemAnswers(prev => prev.map((x, idx) => idx === i ? v : x))
                          }}
                          className="w-full flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                          placeholder={`Ответ ${i + 1}`}
                        />
                        <label className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
                          <input
                            type="radio"
                            checked={addItemCorrectIndex === i}
                            onChange={() => setAddItemCorrectIndex(i)}
                          />
                          правильный
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={saveAddTestItem} className="px-4 py-2 rounded-xl bg-osnova-pink hover:bg-osnova-pink/90 text-white border border-white/10">
                      Добавить
                    </button>
                    <button onClick={() => setAddItemOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white">
                      Отмена
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
      {createPortal(
        <AnimatePresence>
          {subCreateOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSubCreateOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-2xl"
              />
              <motion.div
                className="relative w-full max-w-md modal-panel rounded-3xl p-6 shadow-2xl"
                data-panel="true"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-[#0f2e3a] font-semibold mb-4">Создать папку</div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-[#266479] mb-1">Название</label>
                    <input
                      value={subTitle}
                      onChange={(e) => setSubTitle(e.target.value)}
                      placeholder="Новая папка"
                      className="w-full bg-white/80 border border-[#266479]/20 rounded-xl px-3 py-2 text-[#0f2e3a] placeholder-[#5a7280] focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={addSubFolder} className="px-4 py-2 rounded-xl !bg-emerald-600 !border-emerald-600/40">
                      Создать
                    </button>
                    <button onClick={() => setSubCreateOpen(false)} className="px-4 py-2 rounded-xl !bg-red-600 !border-red-600/40">
                      Отмена
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
      {createPortal(
        <AnimatePresence>
          {textOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setTextOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-2xl"
              />
              <motion.div
                className="relative w-full max-w-xl glass border border-white/10 rounded-3xl p-6 shadow-2xl"
                data-panel="true"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-white font-semibold mb-4">Добавить описание</div>
                <textarea
                  rows={6}
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-[#266479]/70 focus:outline-none"
                  placeholder="Текст описания"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-[#266479] mb-1">Размер шрифта</label>
                    <CustomSelect
                      value={textSize}
                      onChange={setTextSize}
                      options={[
                        { value: 'sm', label: 'Маленький' },
                        { value: 'md', label: 'Средний' },
                        { value: 'lg', label: 'Большой' }
                      ]}
                      variant="glass"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[#266479]">Жирный</label>
                    <input type="checkbox" checked={textBold} onChange={(e) => setTextBold(e.target.checked)} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#266479] mb-1">Выравнивание</label>
                    <CustomSelect
                      value={textAlign}
                      onChange={setTextAlign}
                      options={[
                        { value: 'left', label: 'По левому краю' },
                        { value: 'center', label: 'По центру' },
                        { value: 'right', label: 'По правому краю' },
                        { value: 'justify', label: 'По ширине' }
                      ]}
                      variant="glass"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Отступ первой строки (em)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={textIndent}
                      onChange={(e) => setTextIndent(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={addTextBlock} className="px-4 py-2 rounded-xl bg-osnova-pink hover:bg-osnova-pink/90 text-white border border-white/10">
                    Добавить
                  </button>
                  <button onClick={() => setTextOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white">
                    Отмена
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
      {createPortal(
        <AnimatePresence>
          {editTextOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditTextOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-2xl"
              />
              <motion.div
                className="relative w-full max-w-xl glass border border-white/10 rounded-3xl p-6 shadow-2xl"
                data-panel="true"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-white font-semibold mb-4">Редактировать описание</div>
                <textarea
                  rows={6}
                  value={editTextValue}
                  onChange={(e) => setEditTextValue(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Размер шрифта</label>
                    <CustomSelect
                      value={editTextSize}
                      onChange={setEditTextSize}
                      options={[
                        { value: 'sm', label: 'Маленький' },
                        { value: 'md', label: 'Средний' },
                        { value: 'lg', label: 'Большой' }
                      ]}
                      variant="glass"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Жирный</label>
                    <input type="checkbox" checked={editTextBold} onChange={(e) => setEditTextBold(e.target.checked)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Выравнивание</label>
                    <CustomSelect
                      value={editTextAlign}
                      onChange={setEditTextAlign}
                      options={[
                        { value: 'left', label: 'По левому краю' },
                        { value: 'center', label: 'По центру' },
                        { value: 'right', label: 'По правому краю' },
                        { value: 'justify', label: 'По ширине' }
                      ]}
                      variant="glass"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Отступ первой строки (em)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={editTextIndent}
                      onChange={(e) => setEditTextIndent(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => {
                      setTree(prev => {
                        const copy = JSON.parse(JSON.stringify(prev))
                        const node = findNodeByPath(copy, path)
                        const idx = (node.blocks || []).findIndex(x => x.id === editTextId)
                        if (idx >= 0) {
                          node.blocks[idx].text = editTextValue.trim()
                          node.blocks[idx].style = {
                            size: editTextSize,
                            bold: editTextBold,
                            align: editTextAlign,
                            indent: editTextIndent
                          }
                        }
                        return copy
                      })
                      setEditTextOpen(false)
                      setEditTextId(null)
                    }}
                    className="px-4 py-2 rounded-xl bg-osnova-pink hover:bg-osnova-pink/90 text-white border border-white/10"
                  >
                    Сохранить
                  </button>
                  <button onClick={() => setEditTextOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white">
                    Отмена
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
      {createPortal(
        <AnimatePresence>
          {testOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setTestOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-2xl"
              />
              <motion.div
                className="relative w-full max-w-xl glass border border-white/10 rounded-3xl p-6 shadow-2xl"
                data-panel="true"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-white font-semibold mb-4">Добавить тестирование</div>
                <div className="flex items-center gap-3">
                  <label className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white flex items-center gap-2 cursor-pointer">
                    <Upload size={16} />
                    <span>Загрузить CSV</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleTestCsv(f)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  <button
                    onClick={downloadCsvTemplate}
                    className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white"
                  >
                    Скачать шаблон CSV
                  </button>
                </div>
                <div className="text-gray-400 text-xs mt-3">
                  Первый ответ в строке считается правильным, при сохранении ответы перемешиваются
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
      {createPortal(
        <AnimatePresence>
          {editTitleOnlyOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditTitleOnlyOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-2xl"
              />
              <motion.div
                className="relative w-full max-w-md glass border border-white/10 rounded-3xl p-6 shadow-2xl"
                data-panel="true"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-white font-semibold mb-4">Переименовать папку</div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Название</label>
                    <input
                      value={editTitleOnly}
                      onChange={(e) => setEditTitleOnly(e.target.value)}
                      placeholder="Новое название"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={saveEditTitleOnly} className="px-4 py-2 rounded-xl bg-osnova-pink hover:bg-osnova-pink/90 text-white border border-white/10">
                      Сохранить
                    </button>
                    <button onClick={() => setEditTitleOnlyOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white">
                      Отмена
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
      {createPortal(
        <AnimatePresence>
          {editOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-2xl"
              />
              <motion.div
                className="relative w-full max-w-xl glass border border-white/10 rounded-3xl p-6 shadow-2xl"
                data-panel="true"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-white font-semibold mb-4">Редактирование корневой папки</div>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Код папки</label>
                      <input
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                        placeholder="mat-1132-2017"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Название</label>
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Математика 2017, поток 1132"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Ключевые слова</label>
                      <input
                        value={editKeywords}
                        onChange={(e) => setEditKeywords(e.target.value)}
                        placeholder="math, математика, 2017, 1132"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={saveEditRootFolder} className="px-4 py-2 rounded-xl bg-osnova-pink hover:bg-osnova-pink/90 text-white border border-white/10">
                      Сохранить
                    </button>
                    <button onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white">
                      Отмена
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

    </motion.div>
  )
}

function AdminCoursesBackend() {
  const { isAuthenticated } = useAuth()
  const { universitySlug } = useParams()
  const uniOpts = universitySlug ? { universitySlug } : {}
  const [view, setView] = useState({ type: 'root', id: null })
  const [courses, setCourses] = useState([])
  const [contents, setContents] = useState(null)
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [createKind, setCreateKind] = useState('')
  const [editTarget, setEditTarget] = useState(null)
  const [testEditor, setTestEditor] = useState({ open: false, materialId: null, testId: null, title: '' })
  const [createError, setCreateError] = useState('')
  const [isCreateMenuOpen, setCreateMenuOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    delay_published_at: '',
    course_type: 'full',
    is_active: true,
    material_type: 'lecture',
    is_published: true,
    free_preview: false,
    max_grade: 5,
    // lecture
    lecture_content: '',
    lecture_duration_minutes: '',
    // presentation
    presentation_speaker_notes: '',
    presentation_slides_count: '',
    // document
    document_format: 'other',
    document_extracted_text: '',
    // test
    test_time_limit_minutes: '',
    test_attempts_limit: '',
    test_shuffle_questions: false,
    test_show_correct_answers_after_submit: false,
    test_excel_file: null,
    test_questions: [],
    // file
    upload_file: null,
    file_role: 'attachment',
  })

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      delay_published_at: '',
      course_type: 'full',
      is_active: true,
      material_type: 'lecture',
      is_published: true,
      free_preview: false,
      max_grade: 5,
      lecture_content: '',
      lecture_duration_minutes: '',
      presentation_speaker_notes: '',
      presentation_slides_count: '',
      document_format: 'other',
      document_extracted_text: '',
      test_time_limit_minutes: '',
      test_attempts_limit: '',
      test_shuffle_questions: false,
      test_show_correct_answers_after_submit: false,
      test_excel_file: null,
      test_questions: [],
      upload_file: null,
      file_role: 'attachment',
    })
    setCreateError('')
  }

  const importTestFromExcel = async (file) => {
    if (!file) return
    const XLSX = await import('xlsx').then(m => m.default || m).catch(() => null)
    if (!XLSX) {
      setCreateError('Не удалось загрузить модуль для Excel')
      return
    }
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const name = wb.SheetNames?.[0]
      const ws = name ? wb.Sheets[name] : null
      const rows = ws ? XLSX.utils.sheet_to_json(ws, { header: 1 }) : []
      const normalized = (Array.isArray(rows) ? rows : []).slice(1).filter(r => Array.isArray(r) && r.some(v => String(v || '').trim()))

      const errors = []
      const questions = []

      for (let i = 0; i < normalized.length; i++) {
        const row = normalized[i]
        const rowNumber = i + 2
        const text = String(row?.[0] || '').trim()
        const answers = [row?.[1], row?.[2], row?.[3], row?.[4]].map(v => String(v || '').trim())
        const correctRaw = row?.[5]
        const correctNum = Number(String(correctRaw || '').trim())

        if (!text) {
          errors.push(`Строка ${rowNumber}: пустой текст вопроса`)
          continue
        }
        if (answers.some(a => !a)) {
          errors.push(`Строка ${rowNumber}: все 4 варианта ответа должны быть заполнены`)
          continue
        }
        if (!Number.isInteger(correctNum) || correctNum < 1 || correctNum > 4) {
          errors.push(`Строка ${rowNumber}: "Правильный ответ" должен быть числом от 1 до 4`)
          continue
        }

        questions.push({
          text,
          question_type: 'single',
          explanation: '',
          points: 1,
          order: questions.length + 1,
          correct_text_answers: [],
          case_sensitive: false,
          options: answers.map((a, idx) => ({
            text: a,
            is_correct: idx + 1 === correctNum,
            order: idx + 1,
          })),
        })
      }

      setForm(prev => ({ ...prev, test_excel_file: file, test_questions: questions }))
      if (errors.length) {
        setCreateError(`Есть ошибки в Excel:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n…и ещё ${errors.length - 5}` : ''}`)
      } else {
        setCreateError('')
      }
    } catch {
      setCreateError('Не удалось прочитать Excel-файл теста')
    }
  }

  const downloadTestExcelTemplate = async () => {
    const XLSX = await import('xlsx').then(m => m.default || m).catch(() => null)
    if (!XLSX) {
      setCreateError('Не удалось загрузить модуль для Excel')
      return
    }
    const rows = [
      ['Вопрос', 'Ответ 1', 'Ответ 2', 'Ответ 3', 'Ответ 4', 'Правильный ответ'],
      ['Пример вопроса', 'Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4', 1],
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Тест')
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'test_template.xlsx'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  const loadRoot = async () => {
    setError('')
    setLoading(true)
    try {
      const list = await api.courses.list(uniOpts)
      setCourses(Array.isArray(list) ? list : [])
      setContents(null)
      setView({ type: 'root', id: null })
    } catch {
      setError('Не удалось загрузить курсы')
    } finally {
      setLoading(false)
    }
  }

  const loadNode = async (type, id) => {
    setError('')
    setLoading(true)
    try {
      let data
      if (type === 'course') data = await api.courses.courseContents(id, uniOpts)
      else if (type === 'semester') data = await api.courses.semesterContents(id, uniOpts)
      else if (type === 'subject') data = await api.courses.subjectContents(id, uniOpts)
      else if (type === 'topic') data = await api.courses.topicContents(id, uniOpts)
      else if (type === 'material') data = await api.courses.materialContents(id, uniOpts)
      else if (type === 'folder') data = await api.courses.folderContents(id, uniOpts)
      else data = null

      setContents(data)
      setView({ type, id })
    } catch {
      setError('Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoot()
  }, [])

  const availableCreates = useMemo(() => {
    if (!contents?.node_type) return []
    if (contents.node_type === 'course') {
      if (contents.current?.course_type === 'full') return ['semester']
      return ['topic', 'material']
    }
    if (contents.node_type === 'semester') return ['subject']
    if (contents.node_type === 'subject') return ['topic']
    if (contents.node_type === 'topic') {
      if (contents.current?.subject) return ['material', 'assignment']
      return ['material']
    }
    if (contents.node_type === 'material') {
      if (contents.current?.material_type === 'test') return []
      return ['folder', 'file']
    }
    if (contents.node_type === 'folder') return ['folder', 'file']
    return []
  }, [contents])

  const labelForCreateKind = (k) => {
    if (k === 'course') return 'Создать курс'
    if (k === 'semester') return 'Создать семестр'
    if (k === 'subject') return 'Создать предмет'
    if (k === 'topic') return 'Создать тему'
    if (k === 'assignment') return 'Создать задание'
    if (k === 'material') return 'Создать материал'
    if (k === 'folder') return 'Создать папку'
    if (k === 'file') return 'Загрузить файл'
    return 'Создать'
  }

  const childrenItems = useMemo(() => {
    if (!contents?.children) return []
    const ch = contents.children
    const res = []
    const nodeType = contents.node_type
    const semesters = Array.isArray(ch.semesters) ? ch.semesters : []
    const subjects = Array.isArray(ch.subjects) ? ch.subjects : []
    const topics = Array.isArray(ch.topics) ? ch.topics : []
    const materials = Array.isArray(ch.materials) ? ch.materials : []
    const topicAssignments = Array.isArray(ch.assignments) ? ch.assignments : []
    const folders = Array.isArray(ch.folders) ? ch.folders : []
    const files = Array.isArray(ch.files) ? ch.files : []

    semesters.forEach(s => res.push({ kind: 'semester', id: s.id, title: s.title, subtitle: 'Семестр', _raw: s }))
    subjects.forEach(s => res.push({ kind: 'subject', id: s.id, title: s.title, subtitle: 'Предмет', description: s.description, _raw: s }))
    topics.forEach(t => res.push({ kind: 'topic', id: t.id, title: t.title, subtitle: 'Тема', description: t.description, _raw: t }))
    materials.forEach(m => res.push({ kind: 'material', id: m.id, title: m.title, subtitle: m.material_type_display || 'Материал', description: m.description, is_published: m.is_published, free_preview: m.free_preview, material_type: m.material_type, _raw: m }))
    topicAssignments.forEach(a => {
      res.push({ kind: 'assignment', id: a.id, title: a.title, subtitle: `Задание • макс. ${a.max_grade}`, description: a.description, max_grade: a.max_grade, position: a.position, _raw: a })
    })
    folders.forEach(f => res.push({ kind: 'folder', id: f.id, title: f.title, subtitle: 'Папка', _raw: f }))
    files.forEach(f => res.push({ kind: 'file', id: f.id, title: f.title || 'Файл', subtitle: f.file_role_display || 'Файл', file: f.file, file_role: f.file_role, _raw: f }))
    return res
  }, [contents])

  const openBreadcrumb = (crumb) => {
    if (!crumb) return
    if (crumb.type === 'root') {
      loadRoot()
      return
    }
    if (crumb.type === 'course') loadNode('course', crumb.id)
    else if (crumb.type === 'semester') loadNode('semester', crumb.id)
    else if (crumb.type === 'subject') loadNode('subject', crumb.id)
    else if (crumb.type === 'topic') loadNode('topic', crumb.id)
    else if (crumb.type === 'material') loadNode('material', crumb.id)
    else if (crumb.type === 'folder') loadNode('folder', crumb.id)
  }

  const goBack = () => {
    if (view.type === 'root') return
    const raw = Array.isArray(contents?.breadcrumbs) ? contents.breadcrumbs : []
    const chain = raw.filter(b => b && b.type)
    if (chain.length >= 2) {
      openBreadcrumb(chain[chain.length - 2])
      return
    }
    loadRoot()
  }

  const submitCreate = async () => {
    try {
      setCreateError('')
      if (!createKind) return
      if (createKind !== 'file' && !form.title.trim()) {
        setCreateError('Заполните поле «Название»')
        return
      }
      if (!editTarget && createKind === 'file' && !form.upload_file) {
        setCreateError('Выберите файл для загрузки')
        return
      }

      if (editTarget) {
        if (editTarget.kind === 'course') {
          await api.courses.updateCourse(editTarget.id, {
            title: form.title,
            description: form.description || '',
            is_active: !!form.is_active,
          }, uniOpts)
          setCreating(false)
          setEditTarget(null)
          resetForm()
          await loadRoot()
          return
        }
        if (editTarget.kind === 'semester') {
          const delay = (form.delay_published_at || '').trim()
          const ms = delay ? Date.parse(delay) : NaN
          const delayIso = Number.isFinite(ms) ? new Date(ms).toISOString() : null
          await api.courses.updateSemester(editTarget.id, { title: form.title, delay_published_at: delayIso }, uniOpts)
        } else if (editTarget.kind === 'subject') {
          await api.courses.updateSubject(editTarget.id, { title: form.title, description: form.description || '' }, uniOpts)
        } else if (editTarget.kind === 'topic') {
          await api.courses.updateTopic(editTarget.id, { title: form.title, description: form.description || '' }, uniOpts)
        } else if (editTarget.kind === 'material') {
          const payload = { 
            title: form.title, 
            description: form.description || '', 
            is_published: !!form.is_published, 
            free_preview: !!form.free_preview 
          }
          if (form.material_type === 'test') {
            payload.test_data = {
              attempts_limit: form.test_attempts_limit ? Number(form.test_attempts_limit) : null,
            }
          }
          await api.courses.updateMaterial(editTarget.id, payload, uniOpts)
        } else if (editTarget.kind === 'assignment') {
          await api.courses.assignments.update(editTarget.id, {
            title: form.title,
            description: form.description || '',
          }, uniOpts)
        } else if (editTarget.kind === 'folder') {
          await api.courses.updateFolder(editTarget.id, { title: form.title }, uniOpts)
        } else if (editTarget.kind === 'file') {
          await api.courses.updateFile(editTarget.id, { title: form.title || '', file_role: form.file_role }, uniOpts)
        }

        setCreating(false)
        setEditTarget(null)
        resetForm()
        await loadNode(view.type, view.id)
        return
      }
      if (createKind === 'course') {
        await api.courses.createCourse({
          title: form.title,
          description: form.description || '',
          course_type: form.course_type,
          is_active: !!form.is_active,
        }, uniOpts)
        setCreating(false)
        resetForm()
        await loadRoot()
        return
      }

      const cur = contents?.current
      const nodeType = contents?.node_type
      if (!cur || !nodeType) {
        setCreateError('Нет активного узла для создания')
        return
      }
      if (createKind === 'semester') {
        const delay = (form.delay_published_at || '').trim()
        const ms = delay ? Date.parse(delay) : NaN
        const delayIso = Number.isFinite(ms) ? new Date(ms).toISOString() : undefined
        await api.courses.createSemester({ course: cur.id, title: form.title, delay_published_at: delayIso }, uniOpts)
      } else if (createKind === 'subject') {
        await api.courses.createSubject({ semester: cur.id, title: form.title, description: form.description || '' }, uniOpts)
      } else if (createKind === 'topic') {
        if (nodeType === 'course') {
          await api.courses.createTopic({ course: cur.id, subject: null, title: form.title, description: form.description || '' }, uniOpts)
        } else if (nodeType === 'subject') {
          await api.courses.createTopic({ course: null, subject: cur.id, title: form.title, description: form.description || '' }, uniOpts)
        } else {
          setCreateError('Тему можно создать только внутри курса или предмета')
          return
        }
      } else if (createKind === 'material') {
        const common = {
          title: form.title,
          material_type: form.material_type,
          description: form.description || '',
          is_published: form.material_type === 'test' ? true : !!form.is_published,
          free_preview: false,
        }
        let extra = undefined
        if (form.material_type === 'lecture') {
          extra = {
            lecture_data: {
              content: form.lecture_content || '',
              duration_minutes: form.lecture_duration_minutes ? Number(form.lecture_duration_minutes) : null,
            },
          }
        } else if (form.material_type === 'presentation') {
          extra = {
            presentation_data: {
              speaker_notes: form.presentation_speaker_notes || '',
              slides_count: form.presentation_slides_count ? Number(form.presentation_slides_count) : null,
            },
          }
        } else if (form.material_type === 'document') {
          extra = {
            document_data: {
              document_format: form.document_format || 'other',
              extracted_text: form.document_extracted_text || '',
            },
          }
        } else if (form.material_type === 'test') {
          extra = {
            test_data: {
              attempts_limit: form.test_attempts_limit ? Number(form.test_attempts_limit) : null,
              shuffle_questions: !!form.test_shuffle_questions,
              show_correct_answers_after_submit: !!form.test_show_correct_answers_after_submit,
              questions: Array.isArray(form.test_questions) ? form.test_questions : [],
            },
          }
        }
        if (nodeType === 'course') await api.courses.createMaterial({ course: cur.id, ...common, extra }, uniOpts)
        else if (nodeType === 'topic') await api.courses.createMaterial({ topic: cur.id, ...common, extra }, uniOpts)
        else {
          setCreateError('Материал можно создать у курса или темы')
          return
        }
      } else if (createKind === 'folder') {
        if (nodeType === 'material') {
          await api.courses.createFolder({ material: cur.id, parent: null, title: form.title }, uniOpts)
        } else if (nodeType === 'folder') {
          await api.courses.createFolder({ material: cur.material, parent: cur.id, title: form.title }, uniOpts)
        } else {
          setCreateError('Папку можно создать только внутри материала или папки')
          return
        }
      } else if (createKind === 'file') {
        if (nodeType === 'material') {
          await api.courses.uploadFile({
            material: cur.id,
            folder: null,
            title: form.title || '',
            file: form.upload_file,
            file_role: form.file_role,
          }, uniOpts)
        } else if (nodeType === 'folder') {
          await api.courses.uploadFile({
            material: cur.material,
            folder: cur.id,
            title: form.title || '',
            file: form.upload_file,
            file_role: form.file_role,
          }, uniOpts)
        } else {
          setCreateError('Файл можно загрузить только внутри материала или папки')
          return
        }
      } else if (createKind === 'assignment') {
        if (nodeType !== 'topic') {
          setCreateError('Задание можно создать только внутри темы')
          return
        }
        const subjectId = cur.subject || (Array.isArray(contents?.breadcrumbs) ? contents.breadcrumbs.slice().reverse().find(b => b?.type === 'subject')?.id : null)
        if (!subjectId) {
          setCreateError('Не удалось определить предмет для задания')
          return
        }
        await api.courses.assignments.create({
          topic: cur.id,
          subject: subjectId,
          title: form.title,
          description: form.description || '',
          max_grade: 5,
        }, uniOpts)
      }

      setCreating(false)
      resetForm()
      await loadNode(view.type, view.id)
    } catch (e) {
      const body = e?.body
      let msg = 'Не удалось создать объект'
      if (body && typeof body === 'object') {
        if (body.non_field_errors?.[0]) msg = body.non_field_errors[0]
        else if (body.detail) msg = body.detail
        else if (body.title?.[0]) msg = body.title[0]
        else if (body.course?.[0]) msg = body.course[0]
        else if (body.subject?.[0]) msg = body.subject[0]
        else if (body.topic?.[0]) msg = body.topic[0]
      }
      setCreateError(msg)
    }
  }

  const openCreate = (kind) => {
    setCreateError('')
    setCreateKind(kind)
    setCreating(true)
    setEditTarget(null)
    setCreateMenuOpen(false)
    resetForm()
  }

  const openTestEditor = (it) => {
    const testId = it?._raw?.test_id || it?._raw?.test_data?.id || null
    if (!testId) return
    setTestEditor({ open: true, materialId: it.id, testId, title: it.title || '' })
  }

  const openEdit = (kind, obj) => {
    if (!obj) return
    if (kind === 'material' && contents?.node_type === 'topic') return
    setCreateError('')
    setCreateKind(kind)
    setCreating(true)
    setCreateMenuOpen(false)
    setEditTarget({ kind, id: obj.id })
    resetForm()
    if (kind === 'course') {
      setForm(prev => ({ ...prev, title: obj.title || '', description: obj.description || '', course_type: obj.course_type || 'full', is_active: obj.is_active !== false }))
    } else if (kind === 'semester') {
      let formatted = ''
      try {
        const ms = obj.delay_published_at ? Date.parse(obj.delay_published_at) : NaN
        if (Number.isFinite(ms)) {
          const d = new Date(ms)
          const pad = (n) => String(n).padStart(2, '0')
          formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
        }
      } catch { void 0 }
      setForm(prev => ({ ...prev, title: obj.title || '', delay_published_at: formatted }))
    } else if (kind === 'subject') {
      setForm(prev => ({ ...prev, title: obj.title || '', description: obj.description || '' }))
    } else if (kind === 'topic') {
      setForm(prev => ({ ...prev, title: obj.title || '', description: obj.description || '' }))
    } else if (kind === 'material') {
      setForm(prev => ({ 
        ...prev, 
        title: obj.title || '', 
        description: obj.description || '', 
        material_type: obj.material_type || prev.material_type, 
        is_published: obj.is_published !== false, 
        free_preview: !!obj.free_preview,
        test_attempts_limit: obj.test_data?.attempts_limit || '',
      }))
    } else if (kind === 'assignment') {
      setForm(prev => ({ ...prev, title: obj.title || '', description: obj.description || '', max_grade: 5 }))
    } else if (kind === 'folder') {
      setForm(prev => ({ ...prev, title: obj.title || '' }))
    } else if (kind === 'file') {
      setForm(prev => ({ ...prev, title: obj.title || '', file_role: obj.file_role || 'attachment' }))
    }
  }

  const deleteItem = async (kind, id) => {
    const label = kind === 'course' ? 'курс' : kind === 'semester' ? 'семестр' : kind === 'subject' ? 'предмет' : kind === 'topic' ? 'тему' : kind === 'assignment' ? 'задание' : kind === 'material' ? 'материал' : kind === 'folder' ? 'папку' : 'файл'
    if (!window.confirm(`Удалить ${label}?`)) return
    setError('')
    try {
      if (kind === 'course') await api.courses.deleteCourse(id, uniOpts)
      else if (kind === 'semester') await api.courses.deleteSemester(id, uniOpts)
      else if (kind === 'subject') await api.courses.deleteSubject(id, uniOpts)
      else if (kind === 'topic') await api.courses.deleteTopic(id, uniOpts)
      else if (kind === 'assignment') await api.courses.assignments.remove(id, uniOpts)
      else if (kind === 'material') await api.courses.deleteMaterial(id, uniOpts)
      else if (kind === 'folder') await api.courses.deleteFolder(id, uniOpts)
      else if (kind === 'file') await api.courses.deleteFile(id, uniOpts)

      if (view.type === 'root') await loadRoot()
      else await loadNode(view.type, view.id)
    } catch {
      setError('Не удалось удалить объект')
    }
  }

  return (
    <motion.div className="space-y-6 pt-4" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-bold text-[#0f2e3a]">Курсы</h2>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:justify-end">
          <button onClick={loadRoot} className="w-full sm:w-auto px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white inline-flex items-center justify-center">
            Главная
          </button>
          {view.type !== 'root' && (
            <button
              onClick={goBack}
              className="w-full sm:w-auto px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              <span>Назад</span>
            </button>
          )}
          {isAuthenticated && (
            view.type === 'root' ? (
              <button
                onClick={() => openCreate('course')}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border bg-emerald-600 text-white text-center whitespace-normal sm:whitespace-nowrap"
              >
                Создать курс
              </button>
            ) : (
              availableCreates.length === 0 ? null : (
                availableCreates.length === 1 ? (
                  <button
                    onClick={() => openCreate(availableCreates[0])}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl border bg-emerald-600 text-white text-center whitespace-normal sm:whitespace-nowrap"
                  >
                    {labelForCreateKind(availableCreates[0])}
                  </button>
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => setCreateMenuOpen(v => !v)}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl border bg-emerald-600 text-white whitespace-normal sm:whitespace-nowrap inline-flex items-center justify-center gap-2"
                    >
                      <span>Создать</span>
                      <ChevronDown size={16} />
                    </button>
                    {isCreateMenuOpen && (
                      <div className="absolute right-0 mt-2 z-[10001] admin-card rounded-2xl p-2 min-w-[220px]">
                        {availableCreates.map(k => (
                          <button
                            key={k}
                            onClick={() => openCreate(k)}
                            className="w-full text-left px-3 py-2 rounded-xl hover:bg-black/5 text-[#0f2e3a]"
                          >
                            {labelForCreateKind(k)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              )
            )
          )}
        </div>
      </div>

      <div className="admin-card rounded-2xl p-4 flex items-center gap-2 text-sm overflow-x-auto whitespace-nowrap pr-2">
        <button
          onClick={loadRoot}
          className="px-3 py-1 rounded-lg border bg-white/10 border-white/20 text-white/80 hover:text-white shrink-0"
          title="Курсы"
        >
          <span className="whitespace-nowrap">Курсы</span>
        </button>
        {Array.isArray(contents?.breadcrumbs) && contents.breadcrumbs
          .filter(b => b?.type !== 'root')
          .map((b, idx) => (
            <React.Fragment key={`${b.type}-${b.id ?? 'root'}-${idx}`}>
              <span className="text-white/50 shrink-0">/</span>
              <button
                onClick={() => openBreadcrumb(b)}
                className="px-3 py-1 rounded-lg border bg-white/10 border-white/20 text-white/80 hover:text-white shrink-0"
                title={b.title}
              >
                <span className="whitespace-nowrap">{b.title}</span>
              </button>
            </React.Fragment>
          ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-red-100">
          {error}
        </div>
      )}

      {view.type === 'root' ? (
        isLoading ? (
          <div className="text-white/80">Загрузка…</div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {courses.map(c => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => loadNode('course', c.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') loadNode('course', c.id) }}
                className="admin-card rounded-2xl p-4 text-left flex items-center justify-between cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-[#0f2e3a] font-semibold truncate">{c.title}</div>
                  <div className="text-[#5a7280] text-sm truncate">{c.course_type_display || c.course_type}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); openEdit('course', c) }} className="icon-btn p-2 rounded-xl bg-white/10 border border-white/20 text-[#0f2e3a]" title="Редактировать">
                    <Pencil size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deleteItem('course', c.id) }} className="icon-btn p-2 rounded-xl bg-white/10 border border-white/20 text-[#0f2e3a]" title="Удалить">
                    <Trash2 size={16} />
                  </button>
                  <ChevronDown className="text-[#5a7280] -rotate-90" size={18} />
                </div>
              </div>
            ))}
            {!courses.length && <div className="text-[#0f2e3a]">Курсов пока нет</div>}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-white/80">Загрузка…</div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {childrenItems.map(it => (
                (it.kind === 'file' || it.kind === 'assignment' || (it.kind === 'material' && it.material_type === 'test'))
                  ? (
                    <div key={`${it.kind}-${it.id}`} className="admin-card rounded-2xl p-4 flex items-center justify-between">
                      <div className="text-left min-w-0">
                        <div className="text-[#0f2e3a] font-semibold truncate">{it.title}</div>
                        <div className="text-[#5a7280] text-sm truncate">{it.subtitle}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(it.kind === 'material' && it.material_type === 'test')
                          ? (
                            <button onClick={() => openTestEditor(it)} className="icon-btn p-2 rounded-xl bg-white/10 border border-white/20 text-[#0f2e3a]" title="Редактировать тест">
                              <Pencil size={16} />
                            </button>
                          )
                          : (!(it.kind === 'material' && contents?.node_type === 'topic') && (
                            <button onClick={() => openEdit(it.kind, it)} className="icon-btn p-2 rounded-xl bg-white/10 border border-white/20 text-[#0f2e3a]" title="Редактировать">
                              <Pencil size={16} />
                            </button>
                          ))}
                        <button onClick={() => deleteItem(it.kind, it.id)} className="icon-btn p-2 rounded-xl bg-white/10 border border-white/20 text-[#0f2e3a]" title="Удалить">
                          <Trash2 size={16} />
                        </button>
                        {it.kind === 'file' && (
                          <a
                          href={it.file}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-[#0f2e3a] hover:bg-white/15 transition"
                        >
                          Открыть
                        </a>
                        )}
                      </div>
                    </div>
                  )
                  : (
                    <div
                      key={`${it.kind}-${it.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => loadNode(it.kind, it.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') loadNode(it.kind, it.id) }}
                      className="admin-card rounded-2xl p-4 flex items-center justify-between cursor-pointer"
                    >
                      <div className="text-left min-w-0">
                        <div className="text-[#0f2e3a] font-semibold truncate">{it.title}</div>
                        <div className="text-[#5a7280] text-sm truncate">{it.subtitle}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!(it.kind === 'material' && contents?.node_type === 'topic') && (
                          <button onClick={(e) => { e.stopPropagation(); openEdit(it.kind, it) }} className="icon-btn p-2 rounded-xl bg-white/10 border border-white/20 text-[#0f2e3a]" title="Редактировать">
                            <Pencil size={16} />
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); deleteItem(it.kind, it.id) }} className="icon-btn p-2 rounded-xl bg-white/10 border border-white/20 text-[#0f2e3a]" title="Удалить">
                          <Trash2 size={16} />
                        </button>
                        <ChevronDown className="text-[#5a7280] -rotate-90" size={18} />
                      </div>
                    </div>
                  )
              ))}
              {!childrenItems.length && <div className="text-[#0f2e3a]">Пусто</div>}
            </div>
          )}
        </div>
      )}

      {createPortal(
        <AnimatePresence>
          {creating && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setCreating(false); setEditTarget(null) }}
                className="absolute inset-0 modal-overlay"
              />
              <motion.div
                className="relative w-full max-w-xl modal-panel rounded-3xl p-6 shadow-2xl"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="font-semibold mb-4">
                  {editTarget
                    ? (createKind === 'course'
                      ? 'Редактирование курса'
                      : createKind === 'semester'
                      ? 'Редактирование семестра'
                      : createKind === 'subject'
                      ? 'Редактирование предмета'
                      : createKind === 'topic'
                      ? 'Редактирование темы'
                      : createKind === 'material'
                      ? 'Редактирование материала'
                      : createKind === 'folder'
                      ? 'Редактирование папки'
                      : 'Редактирование файла')
                    : (createKind === 'course'
                      ? 'Новый курс'
                      : createKind === 'semester'
                      ? 'Новый семестр'
                      : createKind === 'subject'
                      ? 'Новый предмет'
                      : createKind === 'topic'
                      ? 'Новая тема'
                      : createKind === 'material'
                      ? 'Новый материал'
                      : createKind === 'folder'
                      ? 'Новая папка'
                      : createKind === 'file'
                      ? 'Загрузка файла'
                      : 'Создание')}
                </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#5a7280] mb-1">
                  {createKind === 'file' ? 'Название (необязательно)' : 'Название'}
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 placeholder-gray-500 focus:outline-none"
                />
              </div>
              {createKind === 'semester' && (
                <div>
                  <label className="block text-xs text-[#5a7280] mb-1">Автопубликация (дата)</label>
                  <input
                    type="datetime-local"
                    value={form.delay_published_at}
                    onChange={(e) => setForm({ ...form, delay_published_at: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 placeholder-gray-500 focus:outline-none"
                  />
                </div>
              )}
              {createKind === 'file' && (
                <div className="space-y-3">
                  {!editTarget && (
                    <div>
                      <label className="block text-xs text-[#5a7280] mb-1">Файл</label>
                      <input
                        type="file"
                        onChange={(e) => setForm({ ...form, upload_file: e.target.files && e.target.files[0] ? e.target.files[0] : null })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus:outline-none"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-[#5a7280] mb-1">Роль файла</label>
                    <select
                      value={form.file_role}
                      onChange={(e) => setForm({ ...form, file_role: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus:outline-none"
                    >
                      <option value="main">Основной</option>
                      <option value="attachment">Вложение</option>
                      <option value="image">Изображение</option>
                      <option value="other">Другое</option>
                    </select>
                  </div>
                </div>
              )}
              {(createKind === 'course' || createKind === 'subject' || createKind === 'topic' || createKind === 'material' || createKind === 'assignment') && (
                <div>
                  <label className="block text-xs text-[#5a7280] mb-1">Описание</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 placeholder-gray-500 focus:outline-none"
                  />
                </div>
              )}
              {createKind === 'assignment' && (
                <div>
                  <div>
                    <label className="block text-xs text-[#5a7280] mb-1">Максимальный балл</label>
                    <div className="w-full bg-white/5 border border-white/10 rounded-xl px-3 h-10 flex items-center text-white/80">
                      5
                    </div>
                  </div>
                </div>
              )}
              {createKind === 'course' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#5a7280] mb-1">Тип курса</label>
                    <CustomSelect
                      value={form.course_type}
                      onChange={(v) => setForm({ ...form, course_type: String(v) })}
                      options={[
                        { value: 'full', label: 'Высшее образование' },
                        { value: 'simple', label: 'Дополнительное образование' },
                      ]}
                      variant="glass"
                      className={editTarget ? 'pointer-events-none opacity-70' : ''}
                      buttonStyle={{
                        backgroundColor: 'var(--btn-primary-bg)',
                        color: 'var(--btn-primary-text)',
                        borderColor: 'var(--btn-primary-border)'
                      }}
                      menuStyle={{
                        backgroundColor: 'var(--btn-primary-bg)',
                        color: 'var(--btn-primary-text)',
                        borderColor: 'var(--btn-primary-border)'
                      }}
                      optionStyle={{
                        color: 'var(--btn-primary-text)'
                      }}
                      selectedOptionStyle={{
                        backgroundColor: 'rgba(0,0,0,0.18)',
                        color: 'var(--btn-primary-text)'
                      }}
                      noGlobalButtonStyles
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm mt-6">
                    <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                    Активен
                  </label>
                </div>
              )}
              {createKind === 'material' && (
                <>
                  <div>
                    <label className="block text-xs text-[#5a7280] mb-1">Тип материала</label>
                    <CustomSelect
                      value={form.material_type}
                      onChange={(v) => {
                        const next = String(v)
                        setForm(prev => ({
                          ...prev,
                          material_type: next,
                          free_preview: next === 'test' ? false : prev.free_preview,
                          is_published: next === 'test' ? true : prev.is_published,
                          test_excel_file: next === 'test' ? prev.test_excel_file : null,
                          test_questions: next === 'test' ? prev.test_questions : [],
                        }))
                      }}
                      options={[
                        { value: 'lecture', label: 'Лекция' },
                        { value: 'presentation', label: 'Презентация' },
                        { value: 'document', label: 'Документ' },
                        { value: 'test', label: 'Тест' },
                        { value: 'other', label: 'Другое' },
                      ]}
                      variant="light"
                      noGlobalButtonStyles
                    />
                  </div>
                  {form.material_type === 'lecture' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-[#5a7280] mb-1">Содержимое</label>
                        <textarea
                          value={form.lecture_content}
                          onChange={(e) => setForm({ ...form, lecture_content: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus:outline-none"
                          rows={4}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#5a7280] mb-1">Длительность (мин.)</label>
                        <input
                          type="number"
                          value={form.lecture_duration_minutes}
                          onChange={(e) => setForm({ ...form, lecture_duration_minutes: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                  {form.material_type === 'presentation' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-[#5a7280] mb-1">Заметки докладчика</label>
                        <textarea
                          value={form.presentation_speaker_notes}
                          onChange={(e) => setForm({ ...form, presentation_speaker_notes: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus:outline-none"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#5a7280] mb-1">Количество слайдов</label>
                        <input
                          type="number"
                          value={form.presentation_slides_count}
                          onChange={(e) => setForm({ ...form, presentation_slides_count: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                  {form.material_type === 'document' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-[#5a7280] mb-1">Формат документа</label>
                        <select
                          value={form.document_format}
                          onChange={(e) => setForm({ ...form, document_format: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus:outline-none"
                        >
                          <option value="pdf">PDF</option>
                          <option value="doc">DOC</option>
                          <option value="docx">DOCX</option>
                          <option value="xls">XLS</option>
                          <option value="xlsx">XLSX</option>
                          <option value="txt">TXT</option>
                          <option value="other">Другое</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[#5a7280] mb-1">Извлечённый текст</label>
                        <textarea
                          value={form.document_extracted_text}
                          onChange={(e) => setForm({ ...form, document_extracted_text: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus:outline-none"
                          rows={3}
                        />
                      </div>
                    </div>
                  )}
                  {form.material_type === 'test' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-[#5a7280] mb-1">Ограничение попыток</label>
                        <input
                          type="number"
                          value={form.test_attempts_limit}
                          onChange={(e) => setForm({ ...form, test_attempts_limit: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#5a7280] mb-1">Excel-файл теста</label>
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={(e) => {
                            const file = e.target.files && e.target.files[0] ? e.target.files[0] : null
                            setForm(prev => ({ ...prev, test_excel_file: file, test_questions: [] }))
                            if (file) importTestFromExcel(file)
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus:outline-none"
                        />
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={downloadTestExcelTemplate}
                            className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/15 transition"
                          >
                            Скачать Excel-шаблон
                          </button>
                        </div>
                        {Array.isArray(form.test_questions) && form.test_questions.length > 0 && (
                          <div className="text-xs text-[#5a7280] mt-1">Импортировано вопросов: {form.test_questions.length}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={form.test_shuffle_questions}
                            onChange={(e) => setForm({ ...form, test_shuffle_questions: e.target.checked })}
                          />
                          Перемешивать вопросы
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={form.test_show_correct_answers_after_submit}
                            onChange={(e) => setForm({ ...form, test_show_correct_answers_after_submit: e.target.checked })}
                          />
                          Показывать ответы после сдачи
                        </label>
                      </div>
                    </div>
                  )}
                  {form.material_type !== 'test' && (
                    <div className="flex items-center gap-4">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
                        Опубликовано
                      </label>
                    </div>
                  )}
                </>
              )}
              {createError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{createError}</div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="px-4 py-2 rounded-xl border bg-red-600" onClick={() => { setCreating(false); setEditTarget(null); resetForm() }}>Отмена</button>
              <button className="px-4 py-2 rounded-xl border bg-emerald-600" onClick={submitCreate}>{editTarget ? 'Сохранить' : 'Создать'}</button>
            </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <TestEditorModal
        open={!!testEditor.open}
        materialId={testEditor.materialId}
        testId={testEditor.testId}
        materialTitle={testEditor.title}
        universitySlug={universitySlug || null}
        onClose={() => setTestEditor({ open: false, materialId: null, testId: null, title: '' })}
        onSaved={() => loadNode(view.type, view.id)}
      />
    </motion.div>
  )
}

export default AdminCoursesBackend
