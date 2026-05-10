function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }
function h(s) {
  let x = 5381
  for (let i = 0; i < s.length; i++) x = ((x << 5) + x) + s.charCodeAt(i)
  return String(x >>> 0)
}
function keyFor(el) {
  const t = el.tagName || ''
  const c = (el.className || '').toString().slice(0, 160)
  const k = el.getAttribute('data-key') || ''
  return h([t, c, k].join('|'))
}
function read(k) {
  try { const v = localStorage.getItem('gv:' + k); return v ? JSON.parse(v) : null } catch { return null }
}
function write(k, v) {
  try {
    localStorage.setItem('gv:' + k, JSON.stringify(v))
    const idxRaw = localStorage.getItem('gv:index')
    const idx = idxRaw ? JSON.parse(idxRaw) : []
    if (!idx.includes(k)) idx.push(k)
    while (idx.length > 600) {
      const r = idx.shift()
      try { localStorage.removeItem('gv:' + r) } catch (e) { void e }
    }
    localStorage.setItem('gv:index', JSON.stringify(idx))
  } catch (e) { void e }
}
function setVars(el, v) {
  el.style.setProperty('--g1x', v.g1x); el.style.setProperty('--g1y', v.g1y)
  el.style.setProperty('--g2x', v.g2x); el.style.setProperty('--g2y', v.g2y)
  el.style.setProperty('--g3x', v.g3x); el.style.setProperty('--g3y', v.g3y)
  el.style.setProperty('--g4x', v.g4x); el.style.setProperty('--g4y', v.g4y)
  el.style.setProperty('--g1w', v.g1w); el.style.setProperty('--g1h', v.g1h)
  el.style.setProperty('--g2w', v.g2w); el.style.setProperty('--g2h', v.g2h)
  el.style.setProperty('--g3w', v.g3w); el.style.setProperty('--g3h', v.g3h)
  el.style.setProperty('--g4w', v.g4w); el.style.setProperty('--g4h', v.g4h)
}
function already(el) { return !!el.style.getPropertyValue('--g1x') }
function gen() {
  return {
    g1x: rnd(0, 100) + '%', g1y: rnd(0, 100) + '%',
    g2x: rnd(0, 100) + '%', g2y: rnd(0, 100) + '%',
    g3x: rnd(0, 100) + '%', g3y: rnd(0, 100) + '%',
    g4x: rnd(0, 100) + '%', g4y: rnd(0, 100) + '%',
    g1w: rnd(400, 900) + 'px', g1h: rnd(200, 600) + 'px',
    g2w: rnd(300, 800) + 'px', g2h: rnd(150, 500) + 'px',
    g3w: rnd(400, 900) + 'px', g3h: rnd(200, 600) + 'px',
    g4w: rnd(300, 800) + 'px', g4h: rnd(150, 500) + 'px'
  }
}
function assign(el) {
  if (already(el)) return
  const k = keyFor(el)
  const stored = read(k)
  const v = stored || gen()
  setVars(el, v)
  if (!stored) write(k, v)
}
export function applyGradientVariety(root = document) {
  if (window.__gvInit) return
  window.__gvInit = true
  const targets = root.querySelectorAll('button, .btn, .button, input, textarea, select, .course-card')
  targets.forEach(assign)
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType === 1) {
          const el = n
          if (el.matches && el.matches('button, .btn, .button, input, textarea, select, .course-card')) assign(el)
          el.querySelectorAll?.('button, .btn, .button, input, textarea, select, .course-card').forEach(assign)
        }
      })
    }
  })
  mo.observe(root.body || root, { childList: true, subtree: true })
}
