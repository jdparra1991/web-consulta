// Reparto.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import '../index.css'
import { exportToExcel } from '../utils/exportExcel'

const PAGE_SIZE = 10

export default function Reparto({ onBack, rol }) {
  const [items, setItems] = useState([])
  const [repartidor, setRepartidor] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [imagenActiva, setImagenActiva] = useState(null)

  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  async function consultar(p = 1) {
    const from = (p - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    // CORREGIDO: La tabla se llama 'repartos' (plural)
    let query = supabase
      .from('repartos')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    // CORREGIDO: El campo se llama 'gestor_nombre' no 'repartidor_nombre'
    if (repartidor) {
      query = query.ilike('gestor_nombre', `%${repartidor}%`)
    }
    
    // CORREGIDO: Ajuste de fechas para incluir todo el día
    if (fechaDesde) {
      const fechaInicio = new Date(fechaDesde)
      fechaInicio.setUTCHours(0, 0, 0, 0)
      query = query.gte('created_at', fechaInicio.toISOString())
    }
    
    if (fechaHasta) {
      const fechaFin = new Date(fechaHasta)
      fechaFin.setUTCHours(23, 59, 59, 999)
      query = query.lte('created_at', fechaFin.toISOString())
    }

    const { data, count, error } = await query
    
    if (error) {
      console.error('Error consultando repartos:', error)
      return
    }
    
    setItems(data || [])
    setTotal(count || 0)
    setPage(p)
  }

  useEffect(() => {
    consultar(1)
  }, [])

  async function exportarExcel() {
    // CORREGIDO: La tabla se llama 'repartos' (plural)
    let query = supabase.from('repartos').select('*')
    
    if (repartidor) {
      query = query.ilike('gestor_nombre', `%${repartidor}%`)
    }
    
    if (fechaDesde) {
      const fechaInicio = new Date(fechaDesde)
      fechaInicio.setUTCHours(0, 0, 0, 0)
      query = query.gte('created_at', fechaInicio.toISOString())
    }
    
    if (fechaHasta) {
      const fechaFin = new Date(fechaHasta)
      fechaFin.setUTCHours(23, 59, 59, 999)
      query = query.lte('created_at', fechaFin.toISOString())
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error exportando:', error)
      return
    }
    
    exportToExcel(data, 'repartos')
  }

  // Función para formatear fecha
  const formatearFecha = (fecha) => {
    if (!fecha) return 'N/A'
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Función para obtener el estado con badge
  const getEstadoBadge = (item) => {
    // Determinar estado basado en los campos disponibles
    if (item.observaciones) return { texto: 'Completado', clase: 'success' }
    if (item.estado_gorra || item.estado_camisa || item.estado_botas || item.estado_pantalon) {
      return { texto: 'En proceso', clase: 'warning' }
    }
    return { texto: 'Pendiente', clase: 'danger' }
  }

  return (
    <div className="page">
      <header className="topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>Consulta de Reparto</h1>
        {rol === 'admin' && (
          <span className="user-role">Admin</span>
        )}
      </header>

      <section className="search-panel">
        <input
          placeholder="Nombre del repartidor"
          value={repartidor}
          onChange={e => setRepartidor(e.target.value)}
        />

        <input 
          type="date" 
          value={fechaDesde} 
          onChange={e => setFechaDesde(e.target.value)} 
          placeholder="Fecha desde"
        />
        
        <input 
          type="date" 
          value={fechaHasta} 
          onChange={e => setFechaHasta(e.target.value)} 
          placeholder="Fecha hasta"
        />

        <button onClick={() => consultar(1)}>Buscar</button>

        {rol === 'admin' && (
          <button className="export-btn" onClick={exportarExcel}>
            📥 Exportar Excel
          </button>
        )}
      </section>

      <section className="summary">
        <div className="summary-card">
          <strong>{total}</strong>
          <span>Entregas encontradas</span>
        </div>
      </section>

      <section className="results">
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            No se encontraron resultados
          </div>
        ) : (
          items.map(r => {
            const images = Array.isArray(r.evidencias_imagenes) ? r.evidencias_imagenes : []
            const estado = getEstadoBadge(r)

            return (
              <article key={r.id} className="reading-card">
                <div className="reading-header">
                  <div>
                    <h2>{r.gestor_nombre || 'Sin nombre'}</h2>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                      <span className="cycle">Ciclo: {r.ciclo_reparto || 'N/A'}</span>
                      <span className={`badge ${estado.clase}`}>{estado.texto}</span>
                    </div>
                  </div>
                  <time>
                    📅 {formatearFecha(r.created_at)}
                  </time>
                </div>

                {/* Información adicional */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: 12,
                  marginTop: 12,
                  padding: 12,
                  background: '#f8fafc',
                  borderRadius: 12
                }}>
                  {r.cliente_nombre && (
                    <div>
                      <small style={{ color: '#64748b' }}>Cliente</small>
                      <div>{r.cliente_nombre}</div>
                    </div>
                  )}
                  {r.direccion && (
                    <div>
                      <small style={{ color: '#64748b' }}>Dirección</small>
                      <div>{r.direccion}</div>
                    </div>
                  )}
                  {r.cantidad_facturas && (
                    <div>
                      <small style={{ color: '#64748b' }}>Facturas</small>
                      <div>{r.cantidad_facturas}</div>
                    </div>
                  )}
                </div>

                {/* Estado de uniforme */}
                {(r.estado_gorra || r.estado_camisa || r.estado_botas || r.estado_pantalon) && (
                  <div style={{ 
                    display: 'flex', 
                    gap: 12, 
                    marginTop: 12,
                    padding: 12,
                    background: '#f8fafc',
                    borderRadius: 12
                  }}>
                    {r.estado_gorra && <span>🧢 Gorra: {r.estado_gorra}</span>}
                    {r.estado_camisa && <span>👕 Camisa: {r.estado_camisa}</span>}
                    {r.estado_botas && <span>👢 Botas: {r.estado_botas}</span>}
                    {r.estado_pantalon && <span>👖 Pantalón: {r.estado_pantalon}</span>}
                  </div>
                )}

                {/* Observaciones */}
                {r.observaciones && (
                  <div style={{ 
                    marginTop: 12,
                    padding: 12,
                    background: '#fef3c7',
                    borderRadius: 12,
                    color: '#92400e'
                  }}>
                    <strong>📝 Observaciones:</strong> {r.observaciones}
                  </div>
                )}

                {/* Imágenes y mapa */}
                {(images.length > 0 || r.ubicacion_lat) && (
                  <div className="media-row">
                    {images.length > 0 && (
                      <div className="media-images">
                        <img
                          src={images[0]}
                          style={{ objectFit: 'contain', cursor: 'pointer' }}
                          onClick={() => setImagenActiva(images[0])}
                          alt="Evidencia"
                        />
                        {images.length > 1 && (
                          <div style={{ 
                            display: 'flex', 
                            gap: 8, 
                            marginTop: 8,
                            flexWrap: 'wrap'
                          }}>
                            {images.slice(1).map((img, idx) => (
                              <img
                                key={idx}
                                src={img}
                                style={{ 
                                  width: 60, 
                                  height: 60, 
                                  objectFit: 'cover',
                                  borderRadius: 8,
                                  cursor: 'pointer'
                                }}
                                onClick={() => setImagenActiva(img)}
                                alt={`Evidencia ${idx + 2}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {r.ubicacion_lat && r.ubicacion_lon && (
                      <div className="media-map">
                        <iframe
                          title="Ubicación"
                          src={`https://maps.google.com/maps?q=${r.ubicacion_lat},${r.ubicacion_lon}&z=16&output=embed`}
                          style={{ border: 'none' }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </article>
            )
          })
        )}
      </section>

      {items.length > 0 && (
        <div className="pagination">
          <button 
            disabled={page === 1} 
            onClick={() => consultar(page - 1)}
          >
            ← Anterior
          </button>
          <span>
            Página {page} de {Math.max(1, Math.ceil(total / PAGE_SIZE))}
          </span>
          <button
            disabled={page >= Math.ceil(total / PAGE_SIZE)}
            onClick={() => consultar(page + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}

      {imagenActiva && (
        <div className="modal" onClick={() => setImagenActiva(null)}>
          <img src={imagenActiva} alt="Evidencia ampliada" />
        </div>
      )}
    </div>
  )
}