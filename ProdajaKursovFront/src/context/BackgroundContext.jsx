import { createContext, useContext, useState, useEffect } from "react"

const BackgroundContext = createContext()

export function BackgroundProvider({ children }) {
  const [blobs, setBlobs] = useState([
    { x: 10, y: 10, size: 40, color: '#0080ff', opacity: 0.15, type: 'circle' },
    { x: 90, y: 10, size: 35, color: '#ff00c8', opacity: 0.12, type: 'circle' },
    { x: 50, y: 90, size: 45, color: '#00ffc8', opacity: 0.13, type: 'circle' }
  ])

  useEffect(() => {
    const saved = localStorage.getItem("user_background_blobs")
    if (saved) {
      try {
        setBlobs(JSON.parse(saved))
      } catch {
        // use defaults
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("user_background_blobs", JSON.stringify(blobs))
  }, [blobs])

  return (
    <BackgroundContext.Provider value={{ blobs, setBlobs }}>
      {children}
    </BackgroundContext.Provider>
  )
}

export function useBackgrounds() {
  return useContext(BackgroundContext)
}
