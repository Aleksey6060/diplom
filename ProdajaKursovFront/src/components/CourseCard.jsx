import React from 'react'
import { motion as Motion } from 'framer-motion'
import { Clock, Check, Star } from 'lucide-react'

export default function CourseCard({ title, description, price, image, category, level, duration, rating, purchased }) {
  return (
    <Motion.div
      className="rounded-3xl overflow-hidden group cursor-pointer relative h-full flex flex-col glass course-card"
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Banner Image */}
      <div className="relative h-48 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent z-10 opacity-20" />
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
        />
        <div className="absolute top-3 left-3 z-20">
          <span className="px-3 py-1 bg-white/30 backdrop-blur-md rounded-full text-xs font-medium text-[#0f2e3a] border border-white/20">
            {category}
          </span>
        </div>
        {purchased && (
          <div className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-full bg-osnova-green/20 border border-osnova-green/40 text-osnova-green text-xs font-medium flex items-center gap-1.5 backdrop-blur-md">
            <Check size={14} />
            <span>Куплен</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1 relative z-20">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold text-white group-hover:text-[#266479] transition-colors line-clamp-1">
            {title}
          </h3>
        </div>

        <p className="text-[#266479] text-sm mb-4 line-clamp-3 flex-1">
          {description}
        </p>

        <div className="flex items-center gap-4 text-xs text-[#266479] mb-4">
          <div className="flex items-center gap-1">
            <Clock size={14} />
            <span>{duration}</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-[#266479]/50" />
          <span>{level}</span>
          <div className="w-1 h-1 rounded-full bg-[#266479]/50" />
          <div className="flex items-center gap-1">
            <Star size={14} className="text-[#266479]" />
            <span>{Number(rating || 0).toFixed(1)}</span>
          </div>
        </div>

        {/* Price & Action */}
        <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/5">
          <div className="flex flex-col">
            <span className="text-xs text-[#266479]">Стоимость</span>
            <span className="text-lg font-bold" style={{ color: 'var(--btn-primary-bg)' }}>{price.toLocaleString('ru-RU')} ₽</span>
          </div>
          <Motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-white hover:brightness-105 text-[#0f2e3a] rounded-xl text-sm font-medium transition-colors border border-[#266479]/20"
          >
            Подробнее
          </Motion.button>
        </div>
      </div>
    </Motion.div>
  )
}
