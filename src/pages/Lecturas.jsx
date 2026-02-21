import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import '../index.css'
import { exportToExcel } from '../utils/exportExcel'

const PAGE_SIZE = 10

/* =======================
   BADGE
======================= */
function Badge({ label, value }) {
  if (!value) return null

  const v = value.toLowerCase()
  const isOk = v === 'bueno' || v === 'sí' || v === 'si'

  return (
    <span className={`badge ${isOk ? 'success' : 'danger'}`}>
      <strong>{label}:</strong> {value}
    </span>
  )
}

/* =======================
   COMPONENT
======================= */
export default function Lecturas({ onBack, rol }) {
  const [lecturas, setLecturas] = useState([])
  const [creadoPor, setCreadoPor] = useState('')
  const [ciclo, setCiclo] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [imagenActiva, setImagenActiva] = useState(null)

  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  /* =======================
     CONSULTA PAGINADA
  ======================= */
  async function consultar(p = 1) {
    const from = (p - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('lecturas')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (creadoPor) query = query.ilike('creado_por_nombre', `%${creadoPor}%`)
    if (ciclo) query = query.eq('ciclo', ciclo)
    if (fechaDesde) query = query.gte('created_at', fechaDesde)
    if (fechaHasta) query = query.lte('created_at', fechaHasta)

    const { data, count } = await query

    setLecturas(data || [])
    setTotal(count || 0)
    setPage(p)
  }

  useEffect(() => {
    consultar(1)
  }, [])

  /* =======================
     EXPORTAR EXCEL REAL
  ======================= */
  async function exportarExcel() {
    let query = supabase.from('lecturas').select('*')

    if (creadoPor) query = query.ilike('creado_por_nombre', `%${creadoPor}%`)
    if (ciclo) query = query.eq('ciclo', ciclo)
    if (fechaDesde) query = query.gte('created_at', fechaDesde)
    if (fechaHasta) query = query.lte('created_at', fechaHasta)

    const { data } = await query
    exportToExcel(data, 'lecturas')
  }

  /* =======================
     RESUMEN
  ======================= */
  const resumenCiclos = Object.values(
    lecturas.reduce((acc, l) => {
      if (!l.ciclo) return acc
      acc[l.ciclo] = acc[l.ciclo] || { ciclo: l.ciclo, total: 0 }
      acc[l.ciclo].total++
      return acc
    }, {})
  )

  return (
    <div className="page">
      {/* HEADER */}
      <header className="topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>Consulta de Lecturas</h1>
      </header>

      {/* BUSCADOR */}
      <section className="search-panel">
        <input
          placeholder="Creado por (nombre)"
          value={creadoPor}
          onChange={e => setCreadoPor(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && consultar(1)}
        />

        <input
          placeholder="Ciclo"
          value={ciclo}
          onChange={e => setCiclo(e.target.value)}
        />

        <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
        <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />

        <button onClick={() => consultar(1)}>Buscar</button>

        {rol === 'admin' && (
          <button className="export-btn" onClick={exportarExcel}>
            📥 Exportar Excel
          </button>
        )}
      </section>

      {/* RESUMEN */}
      <section className="summary">
        <div className="summary-card">
          <strong>{total}</strong>
          <span>Lecturas</span>
        </div>
        <div className="summary-card">
          <strong>{resumenCiclos.length}</strong>
          <span>Ciclos</span>
        </div>
      </section>

      {/* GRÁFICO */}
      <section className="charts">
        <div className="chart-card">
          <h3>Lecturas por ciclo</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={resumenCiclos}>
              <XAxis dataKey="ciclo" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#2563eb" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* RESULTADOS */}
      <section className="results">
        {lecturas.map(l => {
          const images = Array.isArray(l.evidencias_imagenes) ? l.evidencias_imagenes : []

          return (
            <article key={l.id} className="reading-card">
              <div className="reading-header">
                <div>
                  <h2>{l.creado_por_nombre}</h2>
                  {l.gestor_nombre && <div className="gestor">Gestor: {l.gestor_nombre}</div>}
                  <span className="cycle">Ciclo: {l.ciclo}</span>
                </div>

                <time>
                  📅 {new Date(l.created_at).toLocaleDateString()} <br />
                  ⏰ {new Date(l.created_at).toLocaleTimeString()}
                </time>
              </div>

              <div className="reading-info">
                <Badge label="🖨️ Impresora" value={l.estado_impresora} />
                <Badge label="🪪 Carnet" value={l.carnet_visible} />
                <Badge label="🧢 Gorra" value={l.estado_gorra} />
                <Badge label="👕 Camisa" value={l.estado_camisa} />
                <Badge label="👖 Pantalón" value={l.estado_pantalon} />
                <Badge label="👟 Botas" value={l.estado_botas} />
                <Badge label="🧥 Canguro" value={l.estado_canguro} />
                <Badge label="🧻 Rollo extra" value={l.rollo_extra} />
                <Badge label="🔭 Binoculares" value={l.binoculares} />
                <Badge label="🔦 Linterna" value={l.linterna} />
                <Badge label="🧴 Tiza / Atomizador" value={l.tiza_atomizador} />
                <Badge label="🪞 Espejo" value={l.espejo} />
                <Badge label="🪛 Herramienta" value={l.destornillador_gancho} />
                <Badge label="🕯️ Candela" value={l.candela} />
              </div>

              {(images.length > 0 || l.ubicacion_lat) && (
                <div className="media-row">
                  {images.length > 0 && (
                    <div className="media-images">
                      <img
                        src={images[0]}
                        loading="lazy"
                        style={{ objectFit: 'contain' }}
                        onClick={() => setImagenActiva(images[0])}
                      />
                    </div>
                  )}

                  {l.ubicacion_lat && (
                    <div className="media-map">
                      <iframe
                        loading="lazy"
                        src={`https://maps.google.com/maps?q=${l.ubicacion_lat},${l.ubicacion_lon}&z=16&output=embed`}
                      />
                    </div>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </section>

      {/* PAGINACIÓN */}
      <div className="pagination">
        <button disabled={page === 1} onClick={() => consultar(page - 1)}>← Anterior</button>
        <span>Página {page} de {Math.ceil(total / PAGE_SIZE)}</span>
        <button
          disabled={page >= Math.ceil(total / PAGE_SIZE)}
          onClick={() => consultar(page + 1)}
        >
          Siguiente →
        </button>
      </div>

      {/* MODAL */}
      {imagenActiva && (
        <div className="modal" onClick={() => setImagenActiva(null)}>
          <img src={imagenActiva} />
        </div>
      )}
    </div>
  )
}
