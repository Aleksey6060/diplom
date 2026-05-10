import React, { useMemo, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useSearch } from '../../../context/SearchContext'
import { Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ArchivedPage() {
  const { archivedCourses } = useAuth()
  const { searchQuery } = useSearch()

  const filtered = useMemo(() => {
    return archivedCourses.filter(c =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [archivedCourses, searchQuery])

  return (
    <div className="space-y-8 pb-20">
      <div className="w-full max-w-7xl mx-auto px-4 mt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filtered.map(course => (
              <motion.div
                key={course.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="relative rounded-3xl overflow-hidden"
              >
                <div className="relative h-48 rounded-3xl bg-gradient-to-br from-gray-600 to-gray-800">
                  <img src={course.image} alt={course.title} className="absolute inset-0 w-full h-full object-cover opacity-0" />
                  <div className="absolute left-6 right-6 -bottom-8 bg-black/50 text-white rounded-2xl shadow-xl backdrop-blur-md border border-white/10 px-5 py-4">
                    <div className="text-sm font-semibold">{course.title}</div>
                    <div className="text-xs text-gray-300">Архивировано</div>
                  </div>
                </div>
                <div className="h-10" />
              </motion.div>
            ))}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-500">
              Пусто
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
