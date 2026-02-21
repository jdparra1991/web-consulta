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
export default function Revisiones({ onBack, rol }) {
  const [items, setItems] = useState([])
  const [creadoPor, setCreadoPor] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [imagenActiva, setImagenActiva] = useState(null)

  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  /* =======================
     CONSULTA
  ======================= */
  async function consultar(p = 1) {
    const from = (p - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('revisiones')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (creadoPor) query = query.ilike('creado_por_nombre', `%${creadoPor}%`)
    if (fechaDesde) query = query.gte('created_at', fechaDesde)
    if (fechaHasta) query = query.lte('created_at', fechaHasta)

    const { data, count } = await query
    setItems(data || [])
    setTotal(count || 0)
    setPage(p)
  }

  useEffect(() => {
    consultar(1)
  }, [])

  /* =======================
     EXPORTAR
  ======================= */
  async function exportarExcel() {
    let query = supabase.from('revisiones').select('*')

    if (creadoPor) query = query.ilike('creado_por_nombre', `%${creadoPor}%`)
    if (fechaDesde) query = query.gte('created_at', fechaDesde)
    if (fechaHasta) query = query.lte('created_at', fechaHasta)

    const { data } = await query
    exportToExcel(data, 'revisiones')
  }

  /* =======================
     RESUMEN
  ======================= */
  const resumen = [
    { name: 'Revisiones', total }
  ]

  return (
    <div className="page">
      <header className="topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>Consulta de Revisiones</h1>
      </header>

      {/* BUSCADOR */}
      <section className="search-panel">
        <input
          placeholder="Creado por"
          value={creadoPor}
          onChange={e => setCreadoPor(e.target.value)}
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
          <span>Revisiones</span>
        </div>
      </section>

      {/* GRÁFICO */}
      <section className="charts">
        <div className="chart-card">
          <h3>Total de Revisiones</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={resumen}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#16a34a" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* RESULTADOS */}
      <section className="results">
        {items.map(r => {
          const images = Array.isArray(r.evidencias_imagenes) ? r.evidencias_imagenes : []

          return (
            <article key={r.id} className="reading-card">
              <div className="reading-header">
                <div>
                  <h2>{r.creado_por_nombre}</h2>
                </div>
                <time>
                  📅 {new Date(r.created_at).toLocaleDateString()}
                </time>
              </div>

              <div className="reading-info">
                <Badge label="Estado general" value={r.estado_general} />
                <Badge label="Observación" value={r.resultado_revision} />
              </div>

              {(images.length > 0 || r.ubicacion_lat) && (
                <div className="media-row">
                  {images[0] && (
                    <div className="media-images">
                      <img
                        src={images[0]}
                        style={{ objectFit: 'contain' }}
                        onClick={() => setImagenActiva(images[0])}
                      />
                    </div>
                  )}

                  {r.ubicacion_lat && (
                    <div className="media-map">
                      <iframe
                        src={`https://maps.google.com/maps?q=${r.ubicacion_lat},${r.ubicacion_lon}&z=16&output=embed`}
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

      {imagenActiva && (
        <div className="modal" onClick={() => setImagenActiva(null)}>
          <img src={imagenActiva} />
        </div>
      )}
    </div>
  )
}
