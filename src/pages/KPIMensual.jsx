import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import '../index.css'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const AÑOS = [2025, 2026]

const METAS_DIARIAS = {
  lectura: 30,
  reparto: 60,
  revision: 30
}

// Función para obtener fecha actual de Colombia (UTC-5)
const obtenerFechaColombia = () => {
  const ahora = new Date()
  const colombia = new Date(ahora.getTime() - (5 * 60 * 60 * 1000))
  const año = colombia.getFullYear()
  const mes = String(colombia.getMonth() + 1).padStart(2, '0')
  const dia = String(colombia.getDate()).padStart(2, '0')
  return `${año}-${mes}-${dia}`
}

export default function KPIMensual({ onBack }) {
  const [vista, setVista] = useState('dia')
  const [cargando, setCargando] = useState(false)
  const [refrescando, setRefrescando] = useState(false)

  // Estado para DÍA
  const [fechaSeleccionada, setFechaSeleccionada] = useState(obtenerFechaColombia())
  const [datosDia, setDatosDia] = useState([])
  const [resumenDia, setResumenDia] = useState({
    lectura: { realizado: 0, meta: 0 },
    reparto: { realizado: 0, meta: 0 },
    revision: { realizado: 0, meta: 0 }
  })

  // Estado para MES
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth())
  const [añoSeleccionado, setAñoSeleccionado] = useState(new Date().getFullYear())
  const [datosMes, setDatosMes] = useState([])
  const [resumenMes, setResumenMes] = useState({
    lectura: { realizado: 0, meta: 0 },
    reparto: { realizado: 0, meta: 0 },
    revision: { realizado: 0, meta: 0 }
  })
  const [mostrarSelectorMes, setMostrarSelectorMes] = useState(false)

  // Estado para el modal de ranking
  const [showRankingModal, setShowRankingModal] = useState(false)
  const [rankingTab, setRankingTab] = useState('general')

  // ============================================
  // Cálculo KPI DÍA
  // ============================================
  const calcularKPIDia = useCallback(async () => {
    try {
      setCargando(true)

      const { data: programacion, error: errorProg } = await supabase
        .from('programacion_actividades')
        .select('usuario_nombre, actividad, ciclo, fecha')
        .eq('fecha', fechaSeleccionada)
        .order('actividad')

      if (errorProg) throw errorProg

      if (!programacion || programacion.length === 0) {
        setDatosDia([])
        setResumenDia({
          lectura: { realizado: 0, meta: 0 },
          reparto: { realizado: 0, meta: 0 },
          revision: { realizado: 0, meta: 0 }
        })
        return
      }

      const inicioDia = `${fechaSeleccionada}T00:00:00-05:00`
      const finDia = `${fechaSeleccionada}T23:59:59-05:00`

      const [lecturas, repartos, revisiones] = await Promise.all([
        supabase.from('lecturas').select('creado_por_nombre').gte('created_at', inicioDia).lte('created_at', finDia),
        supabase.from('repartos').select('creado_por_nombre').gte('created_at', inicioDia).lte('created_at', finDia),
        supabase.from('revisiones').select('creado_por_nombre').gte('created_at', inicioDia).lte('created_at', finDia)
      ])

      const actividades = {}
      const contar = (data, tipo) => {
        data?.forEach(item => {
          const usuario = item.creado_por_nombre
          if (!usuario) return
          if (!actividades[usuario]) actividades[usuario] = { lectura: 0, reparto: 0, revision: 0 }
          actividades[usuario][tipo]++
        })
      }
      contar(lecturas.data, 'lectura')
      contar(repartos.data, 'reparto')
      contar(revisiones.data, 'revision')

      const usuariosProgramados = []
      const resumen = {
        lectura: { realizado: 0, meta: 0, usuarios: [] },
        reparto: { realizado: 0, meta: 0, usuarios: [] },
        revision: { realizado: 0, meta: 0, usuarios: [] }
      }

      programacion.forEach(prog => {
        const { usuario_nombre, actividad, ciclo } = prog
        const metaDiaria = METAS_DIARIAS[actividad] || 0
        const realizado = actividades[usuario_nombre]?.[actividad] || 0
        const eficiencia = metaDiaria > 0 ? (realizado / metaDiaria) * 100 : 0
        const cumplio = realizado >= metaDiaria

        resumen[actividad].realizado += realizado
        resumen[actividad].meta += metaDiaria

        resumen[actividad].usuarios.push({
          usuario: usuario_nombre,
          programacion: {
            actividad,
            ciclo: ciclo || 40,
            meta: metaDiaria,
            realizado,
            eficiencia,
            cumplio
          },
          desglose: {
            lectura: actividades[usuario_nombre]?.lectura || 0,
            reparto: actividades[usuario_nombre]?.reparto || 0,
            revision: actividades[usuario_nombre]?.revision || 0
          }
        })
      })

      Object.keys(resumen).forEach(act => {
        resumen[act].usuarios.sort((a, b) => b.programacion.eficiencia - a.programacion.eficiencia)
      })

      const ordenActividades = ['lectura', 'reparto', 'revision']
      ordenActividades.forEach(act => {
        usuariosProgramados.push(...resumen[act].usuarios)
      })

      setDatosDia(usuariosProgramados)
      setResumenDia({
        lectura: { realizado: resumen.lectura.realizado, meta: resumen.lectura.meta },
        reparto: { realizado: resumen.reparto.realizado, meta: resumen.reparto.meta },
        revision: { realizado: resumen.revision.realizado, meta: resumen.revision.meta }
      })
    } catch (error) {
      console.error('Error calculando KPI día:', error)
      alert('Error al cargar los indicadores del día')
    } finally {
      setCargando(false)
    }
  }, [fechaSeleccionada])

  // ============================================
  // Cálculo KPI MES
  // ============================================
  const calcularKPIMes = useCallback(async () => {
    try {
      setCargando(true)

      const fechaInicio = `${añoSeleccionado}-${String(mesSeleccionado + 1).padStart(2, '0')}-01`
      const ultimoDia = new Date(añoSeleccionado, mesSeleccionado + 1, 0)
      const fechaFin = ultimoDia.toISOString().split('T')[0]

      const { data: programacion, error: errorProg } = await supabase
        .from('programacion_actividades')
        .select('usuario_nombre, actividad, fecha')
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)

      if (errorProg) throw errorProg

      if (!programacion || programacion.length === 0) {
        setDatosMes([])
        setResumenMes({
          lectura: { realizado: 0, meta: 0 },
          reparto: { realizado: 0, meta: 0 },
          revision: { realizado: 0, meta: 0 }
        })
        return
      }

      const rangoInicio = `${fechaInicio}T00:00:00-05:00`
      const rangoFin = `${fechaFin}T23:59:59-05:00`

      const [lecturas, repartos, revisiones] = await Promise.all([
        supabase.from('lecturas').select('creado_por_nombre').gte('created_at', rangoInicio).lte('created_at', rangoFin),
        supabase.from('repartos').select('creado_por_nombre').gte('created_at', rangoInicio).lte('created_at', rangoFin),
        supabase.from('revisiones').select('creado_por_nombre').gte('created_at', rangoInicio).lte('created_at', rangoFin)
      ])

      const actividadesPorUsuario = {}
      const contarActividad = (data, tipo) => {
        data?.forEach(item => {
          const usuario = item.creado_por_nombre
          if (!usuario) return
          if (!actividadesPorUsuario[usuario]) actividadesPorUsuario[usuario] = { lectura: 0, reparto: 0, revision: 0 }
          actividadesPorUsuario[usuario][tipo]++
        })
      }
      contarActividad(lecturas.data, 'lectura')
      contarActividad(repartos.data, 'reparto')
      contarActividad(revisiones.data, 'revision')

      const programacionPorUsuario = {}
      const resumen = {
        lectura: { realizado: 0, meta: 0 },
        reparto: { realizado: 0, meta: 0 },
        revision: { realizado: 0, meta: 0 }
      }

      programacion.forEach(prog => {
        const { usuario_nombre, actividad } = prog
        if (!programacionPorUsuario[usuario_nombre]) {
          programacionPorUsuario[usuario_nombre] = {
            lectura: { dias: 0, metaTotal: 0 },
            reparto: { dias: 0, metaTotal: 0 },
            revision: { dias: 0, metaTotal: 0 }
          }
        }
        programacionPorUsuario[usuario_nombre][actividad].dias += 1
        programacionPorUsuario[usuario_nombre][actividad].metaTotal += METAS_DIARIAS[actividad] || 0
        resumen[actividad].meta += METAS_DIARIAS[actividad] || 0
      })

      const usuarios = []

      Object.keys(programacionPorUsuario).forEach(usuario => {
        const progUsuario = programacionPorUsuario[usuario]
        const actUsuario = actividadesPorUsuario[usuario] || { lectura: 0, reparto: 0, revision: 0 }

        resumen.lectura.realizado += actUsuario.lectura
        resumen.reparto.realizado += actUsuario.reparto
        resumen.revision.realizado += actUsuario.revision

        const actividades = []

        if (progUsuario.lectura.dias > 0) {
          const meta = progUsuario.lectura.metaTotal
          const realizado = actUsuario.lectura
          const eficiencia = meta > 0 ? (realizado / meta) * 100 : 0
          actividades.push({
            tipo: 'lectura',
            icono: '📄',
            color: '#3B82F6',
            dias: progUsuario.lectura.dias,
            meta,
            realizado,
            eficiencia,
            promedioDiario: progUsuario.lectura.dias > 0 ? realizado / progUsuario.lectura.dias : 0,
            cumplio: realizado >= meta
          })
        }
        if (progUsuario.reparto.dias > 0) {
          const meta = progUsuario.reparto.metaTotal
          const realizado = actUsuario.reparto
          const eficiencia = meta > 0 ? (realizado / meta) * 100 : 0
          actividades.push({
            tipo: 'reparto',
            icono: '📦',
            color: '#10B981',
            dias: progUsuario.reparto.dias,
            meta,
            realizado,
            eficiencia,
            promedioDiario: progUsuario.reparto.dias > 0 ? realizado / progUsuario.reparto.dias : 0,
            cumplio: realizado >= meta
          })
        }
        if (progUsuario.revision.dias > 0) {
          const meta = progUsuario.revision.metaTotal
          const realizado = actUsuario.revision
          const eficiencia = meta > 0 ? (realizado / meta) * 100 : 0
          actividades.push({
            tipo: 'revision',
            icono: '🔍',
            color: '#F59E0B',
            dias: progUsuario.revision.dias,
            meta,
            realizado,
            eficiencia,
            promedioDiario: progUsuario.revision.dias > 0 ? realizado / progUsuario.revision.dias : 0,
            cumplio: realizado >= meta
          })
        }

        actividades.sort((a, b) => b.eficiencia - a.eficiencia)

        if (actividades.length > 0) {
          usuarios.push({
            usuario,
            actividades,
            totalDias: Object.values(progUsuario).reduce((acc, act) => acc + act.dias, 0)
          })
        }
      })

      usuarios.sort((a, b) => {
        const maxA = Math.max(...a.actividades.map(act => act.eficiencia))
        const maxB = Math.max(...b.actividades.map(act => act.eficiencia))
        return maxB - maxA
      })

      setDatosMes(usuarios)
      setResumenMes(resumen)
    } catch (error) {
      console.error('Error calculando KPI mes:', error)
      alert('Error al cargar los indicadores del mes')
    } finally {
      setCargando(false)
    }
  }, [mesSeleccionado, añoSeleccionado])

  useEffect(() => {
    calcularKPIDia()
  }, [calcularKPIDia])

  useEffect(() => {
    calcularKPIMes()
  }, [calcularKPIMes])

  const onRefresh = async () => {
    setRefrescando(true)
    await Promise.all([calcularKPIDia(), calcularKPIMes()])
    setRefrescando(false)
  }

  const cambiarFecha = (dias) => {
    const fecha = new Date(fechaSeleccionada + 'T12:00:00')
    fecha.setDate(fecha.getDate() + dias)
    const nuevaFecha = fecha.toISOString().split('T')[0]
    setFechaSeleccionada(nuevaFecha)
  }

  // ============================================
  // Función para obtener ranking (con rankings por actividad)
  // ============================================
  const obtenerRanking = () => {
    if (!datosMes || datosMes.length === 0) return { 
      general: { top: [], necesitaApoyo: [] },
      lectura: [],
      reparto: [],
      revision: []
    }

    // Calcular score general para cada usuario
    const usuariosConScore = datosMes.map(u => {
      const promedioEficiencia = u.actividades.reduce((acc, act) => acc + act.eficiencia, 0) / u.actividades.length
      const requiereApoyo = u.actividades.some(act => act.eficiencia < 70) || promedioEficiencia < 70
      return {
        ...u,
        score: promedioEficiencia,
        requiereApoyo
      }
    }).sort((a, b) => b.score - a.score)

    const topGeneral = usuariosConScore.slice(0, 10)
    const necesitaApoyo = usuariosConScore
      .filter(u => u.requiereApoyo && !topGeneral.some(t => t.usuario === u.usuario))
      .slice(0, 10)

    // Rankings por actividad
    const lecturaRanking = datosMes
      .map(u => {
        const act = u.actividades.find(a => a.tipo === 'lectura')
        return act ? { usuario: u.usuario, ...act } : null
      })
      .filter(Boolean)
      .sort((a, b) => b.eficiencia - a.eficiencia)
      .slice(0, 8)

    const repartoRanking = datosMes
      .map(u => {
        const act = u.actividades.find(a => a.tipo === 'reparto')
        return act ? { usuario: u.usuario, ...act } : null
      })
      .filter(Boolean)
      .sort((a, b) => b.eficiencia - a.eficiencia)
      .slice(0, 8)

    const revisionRanking = datosMes
      .map(u => {
        const act = u.actividades.find(a => a.tipo === 'revision')
        return act ? { usuario: u.usuario, ...act } : null
      })
      .filter(Boolean)
      .sort((a, b) => b.eficiencia - a.eficiencia)
      .slice(0, 8)

    return {
      general: { top: topGeneral, necesitaApoyo },
      lectura: lecturaRanking,
      reparto: repartoRanking,
      revision: revisionRanking
    }
  }

  // ============================================
  // Renderizado de la vista DÍA
  // ============================================
  const renderVistaDia = () => {
    const totalRealizado = resumenDia.lectura.realizado + resumenDia.reparto.realizado + resumenDia.revision.realizado
    const totalMeta = resumenDia.lectura.meta + resumenDia.reparto.meta + resumenDia.revision.meta
    const avanceGlobal = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : 0

    return (
      <>
        {/* Selector de fecha */}
        <div className="search-panel" style={{ gridTemplateColumns: '1fr auto auto', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="icon-btn" onClick={() => cambiarFecha(-1)}>←</button>
            <input
              type="date"
              value={fechaSeleccionada}
              onChange={e => setFechaSeleccionada(e.target.value)}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <button className="icon-btn" onClick={() => cambiarFecha(1)}>→</button>
          </div>
          <button className="action-btn primary" onClick={onRefresh} disabled={refrescando}>
            {refrescando ? '⏳' : '↻ Actualizar'}
          </button>
        </div>

        {/* KPIs Generales */}
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dbeafe' }}>👥</div>
            <div className="stat-info">
              <div className="stat-label">Programados</div>
              <div className="stat-value">{datosDia.length}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fee2e2' }}>✅</div>
            <div className="stat-info">
              <div className="stat-label">Total Realizado</div>
              <div className="stat-value">{totalRealizado}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fef3c7' }}>📈</div>
            <div className="stat-info">
              <div className="stat-label">Avance Global</div>
              <div className="stat-value">{avanceGlobal.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* Resumen por actividad */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 className="card-title">📊 Resumen del Día</h3>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {['lectura', 'reparto', 'revision'].map(act => {
              const data = resumenDia[act]
              const icono = act === 'lectura' ? '📄' : act === 'reparto' ? '📦' : '🔍'
              const porcentaje = data.meta > 0 ? ((data.realizado / data.meta) * 100).toFixed(1) : 0
              return (
                <div key={act} className="stat-card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{icono}</div>
                  <div className="stat-label" style={{ textTransform: 'capitalize' }}>{act}</div>
                  <div className="stat-value">{data.realizado}</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>Meta: {data.meta}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: data.realizado >= data.meta ? '#10b981' : '#ef4444', marginTop: 4 }}>
                    {porcentaje}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Usuarios del día */}
        <div className="card">
          <h3 className="card-title">👥 Usuarios Programados Hoy</h3>
          <p style={{ color: '#64748b', marginBottom: 16 }}>{datosDia.length} usuarios</p>

          {datosDia.length > 0 ? (
            datosDia.map((item, index) => (
              <div key={`${item.usuario}-${index}`} className="usuario-card" style={{
                background: '#fff',
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    background: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                    fontWeight: 'bold',
                    color: '#64748b'
                  }}>{index + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{item.usuario}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="badge" style={{
                        background: item.programacion.actividad === 'lectura' ? '#dbeafe' :
                                   item.programacion.actividad === 'reparto' ? '#d9f99d' : '#fed7aa'
                      }}>
                        {item.programacion.actividad === 'lectura' ? '📄 Lectura' :
                         item.programacion.actividad === 'reparto' ? '📦 Reparto' : '🔍 Revisión'}
                      </span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>Ciclo {item.programacion.ciclo}</span>
                    </div>
                  </div>
                  <div style={{
                    padding: '6px 12px',
                    borderRadius: 16,
                    background: item.programacion.cumplio ? '#10b98120' : '#ef444420'
                  }}>
                    <span style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: item.programacion.cumplio ? '#10b981' : '#ef4444'
                    }}>{item.programacion.eficiencia.toFixed(1)}%</span>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  background: '#f8fafc',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12,
                  gap: 8
                }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>🎯 Meta</div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{item.programacion.meta}</div>
                  </div>
                  <div style={{ width: 1, background: '#e2e8f0' }} />
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>✅ Realizado</div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{item.programacion.realizado}</div>
                  </div>
                  <div style={{ width: 1, background: '#e2e8f0' }} />
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>📊 Cumplimiento</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: item.programacion.cumplio ? '#10b981' : '#ef4444' }}>
                      {item.programacion.eficiencia.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>📋 Actividades realizadas hoy:</div>
                  <div style={{ display: 'flex', gap: 20, justifyContent: 'space-around' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>📄</span>
                      <span style={{ fontWeight: 600 }}>{item.desglose.lectura}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>📦</span>
                      <span style={{ fontWeight: 600 }}>{item.desglose.reparto}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>🔍</span>
                      <span style={{ fontWeight: 600 }}>{item.desglose.revision}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <span style={{ fontSize: 48 }}>📭</span>
              <p style={{ color: '#64748b', marginTop: 16 }}>No hay programación para este día</p>
            </div>
          )}
        </div>
      </>
    )
  }

  // ============================================
  // Renderizado de la vista MES
  // ============================================
  const renderVistaMes = () => {
    const totalRealizado = resumenMes.lectura.realizado + resumenMes.reparto.realizado + resumenMes.revision.realizado
    const totalMeta = resumenMes.lectura.meta + resumenMes.reparto.meta + resumenMes.revision.meta
    const avanceGlobal = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : 0

    return (
      <>
        {/* Selector de mes/año */}
        <div className="search-panel" style={{ gridTemplateColumns: '1fr auto', marginBottom: 20 }}>
          <div style={{ position: 'relative' }}>
            <button
              className="action-btn secondary"
              onClick={() => setMostrarSelectorMes(!mostrarSelectorMes)}
              style={{ width: '100%', justifyContent: 'space-between' }}
            >
              <span>📅 {MESES[mesSeleccionado]} {añoSeleccionado}</span>
              <span style={{ marginLeft: 8 }}>▼</span>
            </button>
            {mostrarSelectorMes && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 16,
                zIndex: 10,
                marginTop: 4,
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {MESES.map((mes, index) => (
                    <button
                      key={index}
                      className={`badge ${mesSeleccionado === index ? 'badge-active' : ''}`}
                      onClick={() => {
                        setMesSeleccionado(index)
                        setMostrarSelectorMes(false)
                      }}
                      style={{
                        background: mesSeleccionado === index ? '#3b82f6' : '#f1f5f9',
                        color: mesSeleccionado === index ? '#fff' : '#475569',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '6px 12px'
                      }}
                    >
                      {mes}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  {AÑOS.map(año => (
                    <button
                      key={año}
                      className={`badge ${añoSeleccionado === año ? 'badge-active' : ''}`}
                      onClick={() => setAñoSeleccionado(año)}
                      style={{
                        background: añoSeleccionado === año ? '#3b82f6' : '#f1f5f9',
                        color: añoSeleccionado === año ? '#fff' : '#475569',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '6px 16px'
                      }}
                    >
                      {año}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className="action-btn primary" onClick={onRefresh} disabled={refrescando}>
            {refrescando ? '⏳' : '↻ Actualizar'}
          </button>
        </div>

        {/* KPIs Generales */}
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dbeafe' }}>👥</div>
            <div className="stat-info">
              <div className="stat-label">Programados</div>
              <div className="stat-value">{datosMes.length}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fee2e2' }}>✅</div>
            <div className="stat-info">
              <div className="stat-label">Total Realizado</div>
              <div className="stat-value">{totalRealizado}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fef3c7' }}>📈</div>
            <div className="stat-info">
              <div className="stat-label">Avance Global</div>
              <div className="stat-value">{avanceGlobal.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* Resumen por actividad */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 className="card-title">📊 Resumen del Mes</h3>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {['lectura', 'reparto', 'revision'].map(act => {
              const data = resumenMes[act]
              const icono = act === 'lectura' ? '📄' : act === 'reparto' ? '📦' : '🔍'
              const color = act === 'lectura' ? '#3b82f6' : act === 'reparto' ? '#10b981' : '#f59e0b'
              const porcentaje = data.meta > 0 ? ((data.realizado / data.meta) * 100).toFixed(1) : 0
              return (
                <div key={act} className="stat-card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{icono}</div>
                  <div className="stat-label" style={{ textTransform: 'capitalize' }}>{act}</div>
                  <div className="stat-value">{data.realizado}</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>Meta: {data.meta}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color, marginTop: 4 }}>
                    {porcentaje}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Botón para abrir ranking */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button className="action-btn primary" onClick={() => setShowRankingModal(true)}>
            🏆 Ver Ranking de Usuarios
          </button>
        </div>

        {/* Usuarios del mes (detalle completo) */}
        <div className="card">
          <h3 className="card-title">👥 Desempeño Mensual por Usuario</h3>
          <p style={{ color: '#64748b', marginBottom: 16 }}>{datosMes.length} usuarios programados</p>

          {datosMes.length > 0 ? (
            datosMes.map((usuario, index) => (
              <div key={usuario.usuario} className="usuario-card" style={{
                background: '#fff',
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    background: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                    fontWeight: 'bold',
                    color: '#64748b'
                  }}>{index + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{usuario.usuario}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>📅 {usuario.totalDias} días programado</div>
                  </div>
                </div>

                {usuario.actividades.map((act, idx) => (
                  <div key={idx} style={{
                    background: '#f8fafc',
                    borderRadius: 10,
                    padding: 12,
                    marginTop: 12,
                    borderLeft: `4px solid ${act.color}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 20 }}>{act.icono}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{act.tipo}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{act.dias} días</div>
                        </div>
                      </div>
                      <div style={{
                        padding: '4px 10px',
                        borderRadius: 12,
                        background: act.color + '20'
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: act.color }}>
                          {act.eficiencia.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>🎯 Meta</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{Math.round(act.meta)}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>✅ Realizado</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{act.realizado}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>📊 Prom./día</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{act.promedioDiario.toFixed(1)}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4 }}>
                        <div style={{
                          width: `${Math.min(act.eficiencia, 100)}%`,
                          height: '100%',
                          background: act.color,
                          borderRadius: 4
                        }} />
                      </div>
                      {act.eficiencia > 100 && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#10b981' }}>
                          +{(act.eficiencia - 100).toFixed(1)}%
                        </span>
                      )}
                    </div>

                    <div style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: act.cumplio ? '#10b981' : '#ef4444',
                      textAlign: 'right'
                    }}>
                      {act.cumplio ? '✅ Meta cumplida' : '❌ Meta no cumplida'}
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <span style={{ fontSize: 48 }}>📭</span>
              <p style={{ color: '#64748b', marginTop: 16 }}>No hay programación para este mes</p>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <div className="page">
      <header className="topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>{vista === 'dia' ? '📅 Desempeño Diario' : '📊 Desempeño Mensual'}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="action-btn secondary"
            onClick={() => setVista(vista === 'dia' ? 'mes' : 'dia')}
          >
            {vista === 'dia' ? '📅 Ver Mes' : '📆 Ver Día'}
          </button>
        </div>
      </header>

      {cargando && !refrescando ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="loading-spinner" />
          <p className="loading-text">Cargando indicadores...</p>
        </div>
      ) : (
        vista === 'dia' ? renderVistaDia() : renderVistaMes()
      )}

      {/* Modal de ranking */}
      {showRankingModal && (
        <div className="modal-overlay" onClick={() => setShowRankingModal(false)}>
          <div className="modal-content" style={{ maxWidth: 700, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🏆 Ranking de Usuarios</h2>
              <button className="close-btn" onClick={() => setShowRankingModal(false)}>✕</button>
            </div>
            
            {/* Pestañas */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
              <button
                className={`badge ${rankingTab === 'general' ? 'badge-active' : ''}`}
                onClick={() => setRankingTab('general')}
                style={{
                  background: rankingTab === 'general' ? '#3b82f6' : '#f1f5f9',
                  color: rankingTab === 'general' ? '#fff' : '#475569',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 16px'
                }}
              >
                📊 General
              </button>
              <button
                className={`badge ${rankingTab === 'lectura' ? 'badge-active' : ''}`}
                onClick={() => setRankingTab('lectura')}
                style={{
                  background: rankingTab === 'lectura' ? '#3b82f6' : '#f1f5f9',
                  color: rankingTab === 'lectura' ? '#fff' : '#475569',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 16px'
                }}
              >
                📄 Lectura
              </button>
              <button
                className={`badge ${rankingTab === 'reparto' ? 'badge-active' : ''}`}
                onClick={() => setRankingTab('reparto')}
                style={{
                  background: rankingTab === 'reparto' ? '#3b82f6' : '#f1f5f9',
                  color: rankingTab === 'reparto' ? '#fff' : '#475569',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 16px'
                }}
              >
                📦 Reparto
              </button>
              <button
                className={`badge ${rankingTab === 'revision' ? 'badge-active' : ''}`}
                onClick={() => setRankingTab('revision')}
                style={{
                  background: rankingTab === 'revision' ? '#3b82f6' : '#f1f5f9',
                  color: rankingTab === 'revision' ? '#fff' : '#475569',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 16px'
                }}
              >
                🔍 Revisión
              </button>
            </div>

            <div className="modal-body">
              {(() => {
                const ranking = obtenerRanking()
                
                if (rankingTab === 'general') {
                  if (ranking.general.top.length === 0) {
                    return <p style={{ textAlign: 'center', color: '#64748b' }}>No hay datos suficientes</p>
                  }
                  return (
                    <>
                      {/* Top 10 General */}
                      <h3 style={{ marginBottom: 12 }}>🥇 Top 10 General</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                        {ranking.general.top.map((usuario, index) => {
                          const medalla = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`
                          return (
                            <div key={usuario.usuario} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: 12,
                              background: '#f8fafc',
                              borderRadius: 8
                            }}>
                              <span style={{ fontSize: 20, minWidth: 30 }}>{medalla}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{usuario.usuario}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>Score: {usuario.score.toFixed(1)}%</div>
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: usuario.score >= 90 ? '#10b981' : '#f59e0b' }}>
                                {usuario.score.toFixed(1)}%
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Usuarios que requieren apoyo */}
                      {ranking.general.necesitaApoyo.length > 0 && (
                        <>
                          <h3 style={{ marginBottom: 12 }}>⚠️ Requieren Apoyo</h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {ranking.general.necesitaApoyo.map(usuario => (
                              <div key={usuario.usuario} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: 10,
                                background: '#fee2e2',
                                borderRadius: 8
                              }}>
                                <span>⚠️</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 500 }}>{usuario.usuario}</div>
                                  <div style={{ fontSize: 11, color: '#991b1b' }}>Score: {usuario.score.toFixed(1)}%</div>
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>
                                  {usuario.score.toFixed(1)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )
                }

                // Rankings por actividad
                if (rankingTab === 'lectura') {
                  const data = ranking.lectura
                  return (
                    <>
                      <h3 style={{ marginBottom: 12 }}>📄 Top Lectura</h3>
                      {data.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#64748b' }}>Sin datos</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {data.map((item, index) => (
                            <div key={item.usuario} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: 12,
                              background: '#f8fafc',
                              borderRadius: 8
                            }}>
                              <span style={{ fontSize: 20, minWidth: 30 }}>{index + 1}.</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{item.usuario}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{item.dias} días, meta {Math.round(item.meta)}</div>
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: item.eficiencia >= 90 ? '#10b981' : '#f59e0b' }}>
                                {item.eficiencia.toFixed(1)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )
                }

                if (rankingTab === 'reparto') {
                  const data = ranking.reparto
                  return (
                    <>
                      <h3 style={{ marginBottom: 12 }}>📦 Top Reparto</h3>
                      {data.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#64748b' }}>Sin datos</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {data.map((item, index) => (
                            <div key={item.usuario} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: 12,
                              background: '#f8fafc',
                              borderRadius: 8
                            }}>
                              <span style={{ fontSize: 20, minWidth: 30 }}>{index + 1}.</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{item.usuario}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{item.dias} días, meta {Math.round(item.meta)}</div>
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: item.eficiencia >= 90 ? '#10b981' : '#f59e0b' }}>
                                {item.eficiencia.toFixed(1)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )
                }

                if (rankingTab === 'revision') {
                  const data = ranking.revision
                  return (
                    <>
                      <h3 style={{ marginBottom: 12 }}>🔍 Top Revisión</h3>
                      {data.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#64748b' }}>Sin datos</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {data.map((item, index) => (
                            <div key={item.usuario} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: 12,
                              background: '#f8fafc',
                              borderRadius: 8
                            }}>
                              <span style={{ fontSize: 20, minWidth: 30 }}>{index + 1}.</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{item.usuario}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{item.dias} días, meta {Math.round(item.meta)}</div>
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: item.eficiencia >= 90 ? '#10b981' : '#f59e0b' }}>
                                {item.eficiencia.toFixed(1)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )
                }
              })()}
            </div>
            <div className="modal-footer">
              <button className="primary-btn" onClick={() => setShowRankingModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}