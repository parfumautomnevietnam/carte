import { useState, useRef } from 'react'
import { toPng } from 'html-to-image'
import MapView from './components/MapView.jsx'
import { cities } from './cities.js'

const COUNTRY_LABEL = { VN: 'VN', LA: 'LA', KH: 'KH' }

const TRANSPORT_OPTIONS = [
  { value: 'car',   icon: '🚗', label: 'Voiture' },
  { value: 'train', icon: '🚂', label: 'Train' },
  { value: 'plane', icon: '✈', label: 'Avion' },
]

export default function App() {
  const [itinerary, setItinerary] = useState([])
  const [query, setQuery] = useState('')
  const [exporting, setExporting] = useState(false)
  const mapRef = useRef(null)

  const filtered = query.trim().length > 0
    ? cities.filter(c => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 12)
    : []

  const addCity = (city) => {
    setItinerary(prev => [...prev, { ...city, uid: Date.now() + Math.random(), transport: 'car' }])
    setQuery('')
  }

  const removeCity = (uid) => setItinerary(prev => prev.filter(c => c.uid !== uid))

  const setTransport = (uid, transport) => {
    setItinerary(prev => prev.map(c => c.uid === uid ? { ...c, transport } : c))
  }

  const moveUp = (idx) => {
    if (idx === 0) return
    setItinerary(prev => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  const moveDown = (idx) => {
    setItinerary(prev => {
      if (idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  const handleExport = async () => {
    if (!mapRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(mapRef.current, {
        pixelRatio: 3,
        backgroundColor: '#b8d0de',
      })
      const a = document.createElement('a')
      a.download = `itineraire-vietnam-${Date.now()}.png`
      a.href = dataUrl
      a.click()
    } catch (e) {
      console.error(e)
      alert('Erreur lors de l\'export. Réessayez.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Créateur de Cartes</h1>
          <p>Vietnam · Laos · Cambodge</p>
        </div>

        {/* Search */}
        <div className="search-section">
          <div className="search-label">Ajouter une étape</div>
          <input
            className="search-input"
            type="text"
            placeholder="Rechercher une ville…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {filtered.length > 0 && (
            <div className="city-results">
              {filtered.map(city => {
                const count = itinerary.filter(c => c.id === city.id).length
                return (
                  <div key={city.id} className="city-result-item" onClick={() => addCity(city)}>
                    <span className="city-flag">{COUNTRY_LABEL[city.country] || city.country}</span>
                    <span>{city.name}</span>
                    {count > 0 && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)' }}>×{count}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Itinerary */}
        <div className="itinerary-section">
          <div className="section-label">
            Itinéraire {itinerary.length > 0 && `(${itinerary.length} étape${itinerary.length > 1 ? 's' : ''})`}
          </div>
          {itinerary.length === 0 ? (
            <div className="itinerary-empty">Aucune étape sélectionnée.<br />Recherchez une ville ci-dessus.</div>
          ) : (
            itinerary.map((city, idx) => (
              <div key={city.uid}>
                {/* Sélecteur de transport (entre deux étapes) */}
                {idx > 0 && (
                  <div className="transport-selector">
                    {TRANSPORT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        className={`transport-btn${city.transport === opt.value ? ' active' : ''}`}
                        onClick={() => setTransport(city.uid, opt.value)}
                        title={opt.label}
                      >
                        {opt.icon}
                      </button>
                    ))}
                  </div>
                )}
                <div className="itinerary-item">
                  <span className="step-number">{idx + 1}</span>
                  <span className="step-name">{city.name}</span>
                  <div className="step-actions">
                    <button className="step-btn" onClick={() => moveUp(idx)}>↑</button>
                    <button className="step-btn" onClick={() => moveDown(idx)}>↓</button>
                    <button className="step-btn remove" onClick={() => removeCity(city.uid)}>✕</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Export */}
        <div className="sidebar-footer">
          <button className="btn-export" onClick={handleExport} disabled={itinerary.length < 2 || exporting}>
            {exporting ? 'Export en cours…' : '⬇ Exporter en PNG'}
          </button>
          {itinerary.length > 0 && (
            <button className="btn-reset" onClick={() => setItinerary([])}>Réinitialiser</button>
          )}
        </div>
      </aside>

      <div className="map-container" ref={mapRef}>
        <MapView itinerary={itinerary} />
        <div className="map-hint">molette = zoom · cliquer-glisser = déplacer</div>
      </div>
    </div>
  )
}
