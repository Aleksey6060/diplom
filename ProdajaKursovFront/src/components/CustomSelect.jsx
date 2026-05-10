import React, { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'

export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Выберите...',
  variant = 'glass', // 'glass' (dark/blur) or 'light' (white/clean)
  disabled = false,
  className = '',
  menuClassName = '',
  buttonStyle = null,
  menuStyle = null,
  optionStyle = null,
  selectedOptionStyle = null,
  noGlobalButtonStyles = false,
  usePortal = false,
  portalZIndex = 12000
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const [menuPos, setMenuPos] = useState(null)

  const selectedOption = options.find(opt => opt.value === value)
  const portalTarget = useMemo(() => (typeof document !== 'undefined' ? document.body : null), [])
  
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        if (menuRef.current && menuRef.current.contains(event.target)) return
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!usePortal || !isOpen) return
    const update = () => {
      const el = buttonRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setMenuPos({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [usePortal, isOpen])

  const baseStyles = variant === 'glass' 
    ? 'bg-white/5 border border-white/10 text-white/80 hover:bg-white/10'
    : 'bg-white border border-[#266479]/20 text-[#0f2e3a] hover:bg-[#266479]/5 shadow-sm'

  const menuStyles = variant === 'glass'
    ? 'bg-white/10 backdrop-blur border border-white/20 text-white shadow-xl'
    : 'bg-white border border-[#266479]/10 text-[#0f2e3a] shadow-xl shadow-[#266479]/10'

  const optionStyles = variant === 'glass'
    ? 'hover:bg-black/10 text-white/80 hover:text-white'
    : 'hover:bg-emerald-50 text-[#5a7280] hover:text-emerald-800'

  const selectedOptionStyles = variant === 'glass'
    ? 'bg-black/20 text-white font-medium'
    : 'bg-emerald-50 text-emerald-700 font-medium'

  const menuNode = (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={usePortal ? { ...(menuStyle || undefined), position: 'fixed', top: menuPos?.top, left: menuPos?.left, width: menuPos?.width, zIndex: portalZIndex } : (menuStyle || undefined)}
      className={`${usePortal ? '' : 'absolute'} z-50 w-full mt-2 rounded-xl max-h-60 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1 ${menuStyles} ${menuClassName}`}
    >
      {options.map((option) => {
        const isSelected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              onChange(option.value)
              setIsOpen(false)
            }}
            data-theme-preview={noGlobalButtonStyles ? 'true' : undefined}
            style={(isSelected ? selectedOptionStyle : optionStyle) || undefined}
            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between rounded-lg ${
              isSelected ? selectedOptionStyles : optionStyles
            }`}
          >
            <span className="truncate">{option.label}</span>
            {isSelected && <Check size={16} className={variant === 'glass' ? 'text-emerald-400' : 'text-emerald-600'} />}
          </button>
        )
      })}
      {options.length === 0 && (
        <div className="px-4 py-3 text-sm opacity-50 text-center">Нет опций</div>
      )}
    </motion.div>
  )

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          if (disabled) return
          setIsOpen(!isOpen)
        }}
        disabled={disabled}
        data-theme-preview={noGlobalButtonStyles ? 'true' : undefined}
        style={buttonStyle || undefined}
        ref={buttonRef}
        className={`w-full px-4 py-2.5 rounded-xl flex items-center justify-between transition-all outline-none focus:ring-2 focus:ring-emerald-500/50 ${baseStyles} ${isOpen ? 'ring-2 ring-emerald-500/50' : ''} ${disabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''}`}
      >
        <span className={`truncate ${!selectedOption ? 'opacity-60' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          size={18} 
          className={`transition-transform duration-200 opacity-70 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          usePortal
            ? (portalTarget ? createPortal(menuNode, portalTarget) : null)
            : menuNode
        )}
      </AnimatePresence>
    </div>
  )
}
