import React from 'react'
import { motion } from 'framer-motion'

export default function GlassCard({ children, className = '', ...rest }) {
  return (
    <motion.div
      {...rest}
      className={`glass rounded-2xl p-6 shadow-glass ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
