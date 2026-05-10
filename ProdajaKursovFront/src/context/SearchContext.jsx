import React, { createContext, useContext, useState } from 'react'

const SearchContext = createContext()

export function useSearch() {
  return useContext(SearchContext)
}

export function SearchProvider({ children }) {
  const [searchQuery, setSearchQuery] = useState('')
  
  // Generic event system for specific page actions (like filtering)
  const [events, setEvents] = useState({})

  const triggerEvent = (eventName, data) => {
    // We can dispatch a window event for simplicity, or use this state
    window.dispatchEvent(new CustomEvent(eventName, { detail: data }))
  }

  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery, triggerEvent }}>
      {children}
    </SearchContext.Provider>
  )
}
