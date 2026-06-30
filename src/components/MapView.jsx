import { useRef, useState, useEffect, useCallback } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { select } from 'd3-selection'
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom'
import { cities } from '../cities.js'

const GEO_WORLD = '/countries-110m.json'
const GEO_PROVINCES = '/provinces-vn-la-kh.geojson'

const COUNTRY_COLORS = {
  '704': { fill: '#eee8cc', stroke: '#b0a870' },  // Vietnam — crème
  '418': { fill: '#d8d4c8', stroke: '#a8a490' },  // Laos
  '116': { fill: '#d4cfc0', stroke: '#a8a490' },  // Cambodge
  '764': { fill: '#d0ccc0', stroke: '#b0ac9e' },  // Thaïlande
  '156': { fill: '#cccac0', stroke: '#aca8a0' },  // Chine
  '104': { fill: '#d0ccc0', stroke: '#b0ac9e' },  // Myanmar
}

const PROVINCE_COLORS = {
  VN: { fill: '#eee8cc', stroke: '#b0a870', strokeWidth: 0.3 },
  LA: { fill: '#d8d4c8', stroke: '#a8a490', strokeWidth: 0.25 },
  KH: { fill: '#d4cfc0', stroke: '#a8a490', strokeWidth: 0.25 },
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

const DOT_R = 6
const FONT_SIZE = 12

export default function MapView({ itinerary }) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const zoomRef = useRef(null)
  const projRef = useRef(null)

  const [dims, setDims] = useState({ w: 800, h: 600 })
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })
  const [projectedCities, setProjectedCities] = useState({})

  // Mesure les dimensions réelles du conteneur
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect
        setDims({ w: width, h: height })
        projRef.current = null // force recalcul de la projection
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Init D3 zoom sur le SVG
  useEffect(() => {
    if (!svgRef.current) return
    const svg = select(svgRef.current)
    const behavior = d3Zoom()
      .scaleExtent([0.5, 14])
      .on('zoom', (e) => {
        const { x, y, k } = e.transform
        setTransform({ x, y, k })
      })
    svg.call(behavior)
    zoomRef.current = behavior
    return () => svg.on('.zoom', null)
  }, [])

  const zoomIn    = () => select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, 1.5)
  const zoomOut   = () => select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, 1 / 1.5)
  const zoomReset = () => select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, zoomIdentity)

  // Récupère la projection quand les Geographies chargent
  const handleGeos = useCallback(({ projection }) => {
    if (projection && !projRef.current) {
      projRef.current = projection
      const coords = {}
      cities.forEach(c => {
        const pt = projection([c.lng, c.lat])
        if (pt) coords[c.id] = pt
      })
      setProjectedCities(coords)
    }
  }, [dims]) // recalcule quand dims changent

  const itineraryIds = new Set(itinerary.map(c => c.id))
  const firstStepByCity = {}
  itinerary.forEach((c, idx) => {
    if (!(c.id in firstStepByCity)) firstStepByCity[c.id] = idx + 1
  })

  // Ville unique par id pour les marqueurs
  const uniqueSelected = itinerary.filter((c, idx, arr) => arr.findIndex(x => x.id === c.id) === idx)

  // Coordonnées écran = coords projection + transform zoom
  const toScreen = (cityId) => {
    const base = projectedCities[cityId]
    if (!base) return null
    return [transform.x + base[0] * transform.k, transform.y + base[1] * transform.k]
  }

  const routeScreenPoints = itinerary.map(c => toScreen(c.id)).filter(Boolean)

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#b8d0de', cursor: 'grab' }}>

      {/* SVG carte — dimensions réelles, pas de viewBox qui décale */}
      <ComposableMap
        ref={svgRef}
        projection="geoMercator"
        projectionConfig={{ center: [106.5, 16], scale: 1600 }}
        width={dims.w}
        height={dims.h}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <rect x="-9999" y="-9999" width="19998" height="19998" fill="#b8d0de" />
          {/* Fond : pays voisins (110m) */}
          <Geographies geography={GEO_WORLD}>
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
                    strokeWidth={0.4}
                    style={{ default: { outline: 'none' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
                  />
                )
              })
            }}
          </Geographies>

          {/* Provinces VN / Laos / Cambodge par-dessus */}
          <Geographies geography={GEO_PROVINCES}>
            {({ geographies }) =>
              geographies.map(geo => {
                const iso = geo.properties?.iso_a2
                const style = PROVINCE_COLORS[iso] ?? { fill: '#ccc8bc', stroke: '#aaa898', strokeWidth: 0.3 }
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth={style.strokeWidth}
                    style={{ default: { outline: 'none' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
                  />
                )
              })
            }
          </Geographies>
        </g>
      </ComposableMap>

      {/* Overlay : route + marqueurs en coords écran, taille fixe */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>

        {routeScreenPoints.length >= 2 && (
          <>
            <path d={catmullRomPath(routeScreenPoints)} fill="none" stroke="#c9603a" strokeWidth={8} strokeOpacity={0.15} strokeLinecap="round" />
            <path d={catmullRomPath(routeScreenPoints)} fill="none" stroke="#c9603a" strokeWidth={2} strokeLinecap="round" strokeDasharray="8 5" />
          </>
        )}

        {uniqueSelected.map(city => {
          const sc = toScreen(city.id)
          if (!sc) return null
          const stepIdx = itinerary.findIndex(c => c.id === city.id)
          const side = stepIdx % 2 === 0 ? 1 : -1
          const off = DOT_R + 14

          return (
            <g key={city.id} transform={`translate(${sc[0]},${sc[1]})`}>
              <circle r={DOT_R} fill="#c9603a" stroke="#8a3020" strokeWidth={1.5} />
              <line x1={0} y1={0} x2={side * off * 0.65} y2={-off * 0.65} stroke="#c9603a" strokeWidth={1} strokeOpacity={0.5} />
              <text
                textAnchor="middle"
                x={side * off * 0.65} y={-off * 0.65 - 5}
                stroke="#e8e0c5" strokeWidth={2.5} strokeLinejoin="round" paintOrder="stroke"
                style={{ fontSize: `${FONT_SIZE * 0.8}px`, fill: '#8a3020', fontFamily: 'Inter', fontWeight: 700 }}
              >
                {firstStepByCity[city.id]}
              </text>
              <text
                textAnchor={side > 0 ? 'start' : 'end'}
                x={side * off * 0.65} y={-off * 0.65 + FONT_SIZE * 0.45}
                stroke="#e8e0c5" strokeWidth={2.5} strokeLinejoin="round" paintOrder="stroke"
                style={{ fontSize: `${FONT_SIZE}px`, fill: '#3a2010', fontFamily: 'Inter', fontWeight: 600 }}
              >
                {city.name}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="zoom-controls">
        <button className="zoom-btn" onClick={zoomIn}>+</button>
        <button className="zoom-btn" onClick={zoomOut}>−</button>
        <button className="zoom-btn zoom-reset" onClick={zoomReset}>↺</button>
      </div>
      <div className="map-hint">molette = zoom · cliquer-glisser = déplacer</div>
    </div>
  )
}
