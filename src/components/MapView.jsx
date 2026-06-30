import { useRef, useState } from 'react'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import { cities } from '../cities.js'

const GEO_URL = '/countries-110m.json'

const COUNTRY_COLORS = {
  '704': { fill: '#e8e0c5', stroke: '#a89870' },
  '418': { fill: '#d8d4c8', stroke: '#a8a490' },
  '116': { fill: '#d4cfc0', stroke: '#a8a490' },
  '764': { fill: '#d0ccc0', stroke: '#b0ac9e' },
  '156': { fill: '#cccac0', stroke: '#aca8a0' },
  '104': { fill: '#d0ccc0', stroke: '#b0ac9e' },
}

function catmullRomPath(pts) {
  if (pts.length < 2) return ''
  if (pts.length === 2) return `M ${pts[0][0]},${pts[0][1]} L ${pts[1][0]},${pts[1][1]}`
  let d = `M ${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(i + 2, pts.length - 1)]
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`
  }
  return d
}

const INIT_CENTER = [106.5, 16]
const INIT_ZOOM = 1

export default function MapView({ itinerary }) {
  const [position, setPosition] = useState({ center: INIT_CENTER, zoom: INIT_ZOOM })
  const projRef = useRef(null)
  const [projectedCities, setProjectedCities] = useState({})

  const handleMove = ({ zoom }) => setPosition(prev => ({ ...prev, zoom }))
  const handleMoveEnd = (pos) => setPosition(pos)

  const zoomIn  = () => setPosition(p => ({ ...p, zoom: Math.min(14, +(p.zoom * 1.5).toFixed(3)) }))
  const zoomOut = () => setPosition(p => ({ ...p, zoom: Math.max(0.8, +(p.zoom / 1.5).toFixed(3)) }))
  const zoomReset = () => setPosition({ center: INIT_CENTER, zoom: INIT_ZOOM })

  // Recompute projected coords when projection is available
  const handleGeos = ({ projection }) => {
    if (projection && !projRef.current) {
      projRef.current = projection
      const coords = {}
      cities.forEach(c => {
        const pt = projection([c.lng, c.lat])
        if (pt) coords[c.id] = pt
      })
      setProjectedCities(coords)
    }
  }

  const itineraryIds = new Set(itinerary.map(c => c.id))
  const routePoints = itinerary.map(c => projectedCities[c.id]).filter(Boolean)
  const firstStepByCity = {}
  itinerary.forEach((c, idx) => {
    if (!(c.id in firstStepByCity)) firstStepByCity[c.id] = idx + 1
  })

  // Taille des éléments inversement proportionnelle au zoom pour rester constants
  const z = position.zoom
  const dotR = 4 / z
  const dotRSelected = 6 / z
  const fontSize = 8 / z
  const strokeW = 1.5 / z
  const routeW = 2 / z

  return (
    <>
    <ComposableMap
      projection="geoMercator"
      projectionConfig={{ center: INIT_CENTER, scale: 1600 }}
      style={{ width: '100%', height: '100%', background: '#b8d0de' }}
    >
      <ZoomableGroup
        center={position.center}
        zoom={position.zoom}
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
        minZoom={0.8}
        maxZoom={14}
      >
        <rect x="-9999" y="-9999" width="19998" height="19998" fill="#b8d0de" />

        <Geographies geography={GEO_URL}>
          {(args) => {
            handleGeos(args)
            return args.geographies.map(geo => {
              const style = COUNTRY_COLORS[geo.id] ?? { fill: '#ccc8bc', stroke: '#aaa898' }
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={0.4 / z}
                  style={{ default: { outline: 'none' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
                />
              )
            })
          }}
        </Geographies>

        {/* Route */}
        {routePoints.length >= 2 && (
          <g>
            <path d={catmullRomPath(routePoints)} fill="none" stroke="#c9603a" strokeWidth={routeW * 4} strokeOpacity={0.15} strokeLinecap="round" />
            <path d={catmullRomPath(routePoints)} fill="none" stroke="#c9603a" strokeWidth={routeW} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${6 / z} ${4 / z}`} />
          </g>
        )}

        {/* Marqueurs */}
        {cities.map(city => {
          const isSelected = itineraryIds.has(city.id)
          const r = isSelected ? dotRSelected : dotR
          const stepIdx = itinerary.findIndex(c => c.id === city.id)
          // Alterne le côté du label selon l'index pour éviter les chevauchements
          const labelSide = stepIdx % 2 === 0 ? 1 : -1
          const offset = (r + 10 / z)

          return (
            <Marker key={city.id} coordinates={[city.lng, city.lat]}>
              <circle
                r={r}
                fill={isSelected ? '#c9603a' : 'rgba(100,74,42,0.45)'}
                stroke={isSelected ? '#8a3020' : 'rgba(100,74,42,0.3)'}
                strokeWidth={isSelected ? strokeW : strokeW * 0.5}
              />
              {isSelected && (
                <>
                  {/* Petite ligne de repère */}
                  <line
                    x1={0} y1={0}
                    x2={labelSide * offset * 0.6} y2={-offset * 0.6}
                    stroke="#c9603a" strokeWidth={0.8 / z} strokeOpacity={0.5}
                  />
                  {/* Numéro */}
                  <text
                    textAnchor="middle"
                    x={labelSide * offset * 0.6}
                    y={-offset * 0.6 - 4 / z}
                    stroke="#e8e0c5"
                    strokeWidth={2 / z}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    style={{ fontSize: `${fontSize * 0.85}px`, fill: '#8a3020', fontFamily: 'Inter', fontWeight: 700, pointerEvents: 'none' }}
                  >
                    {firstStepByCity[city.id]}
                  </text>
                  {/* Nom */}
                  <text
                    textAnchor={labelSide > 0 ? 'start' : 'end'}
                    x={labelSide * offset * 0.6}
                    y={-offset * 0.6 + fontSize * 0.4}
                    stroke="#e8e0c5"
                    strokeWidth={2.5 / z}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    style={{ fontSize: `${fontSize}px`, fill: '#3a2010', fontFamily: 'Inter', fontWeight: 600, pointerEvents: 'none' }}
                  >
                    {city.name}
                  </text>
                </>
              )}
            </Marker>
          )
        })}
      </ZoomableGroup>
    </ComposableMap>

    {/* Boutons zoom — en dehors du SVG, positionnés en absolu */}
    <div className="zoom-controls">
      <button className="zoom-btn" onClick={zoomIn} title="Zoom +">+</button>
      <button className="zoom-btn" onClick={zoomOut} title="Zoom −">−</button>
      <button className="zoom-btn zoom-reset" onClick={zoomReset} title="Vue globale">↺</button>
    </div>
    </>
  )
}
