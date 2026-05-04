// Dashboard.jsx - con corrección definitiva para repartos
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Legend, LineChart, Line
} from 'recharts'
import '../index.css'

const METAS = {
  lecturas: 30,
  revisiones: 20,
  reparto: 60
}

// Devuelve fechas ISO en UTC para el rango del mes
function getMonthRangeUTC(month) {
  const [year, monthNum] = month.split('-').map(Number)
  const startDate = new Date(Date.UTC(year, monthNum - 1, 1))
  const endDate = new Date(Date.UTC(year, monthNum, 1))
  return {
    from: startDate.toISOString(),
    to: endDate.toISOString()
  }
}

function getPrevMonth(month) {
  const [year, monthNum] = month.split('-').map(Number)
  const d = new Date(Date.UTC(year, monthNum - 1, 1))
  d.setUTCMonth(d.getUTCMonth() - 1)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function formatearNumero(num) {
  return new Intl.NumberFormat('es-CO').format(num || 0)
}

function formatearMes(mes) {
  const [year, month] = mes.split('-')
  const fecha = new Date(year, month - 1)
  return fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
}

export default function Dashboard() {
  const [month, setMonth] = useState(() => {
    const ahora = new Date()
    const y = ahora.getUTCFullYear()
    const m = String(ahora.getUTCMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  })
  const [compare, setCompare] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingExtra, setLoadingExtra] = useState(false)

  const [data, setData] = useState({ lecturas: [], revisiones: [], repartos: [] })
  const [viewType, setViewType] = useState('ciclo')
  const [filtroCiclo, setFiltroCiclo] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [listaUsuarios, setListaUsuarios] = useState([])
  const [dailyData, setDailyData] = useState([])
  const [userData, setUserData] = useState([])

  useEffect(() => { cargar() }, [month, compare])
  useEffect(() => { if (viewType !== 'ciclo') cargarDatosExtra() }, [month, viewType, filtroCiclo, filtroUsuario])

  // ========== VISTA POR CICLO ==========
  async function cargarTabla(tabla, meta, campoCiclo) {
    const { from, to } = getMonthRangeUTC(month)
    let query = supabase
      .from(tabla)
      .select(campoCiclo)
      .gte('created_at', from)
      .lt('created_at', to)

    const { data: actualData, error } = await query
    if (error) console.error(`Error en ${tabla}:`, error)

    let prevData = []
    if (compare) {
      const prevMonth = getPrevMonth(month)
      const { from: prevFrom, to: prevTo } = getMonthRangeUTC(prevMonth)
      const { data: prev } = await supabase
        .from(tabla)
        .select(campoCiclo)
        .gte('created_at', prevFrom)
        .lt('created_at', prevTo)
      prevData = prev || []
    }

    const mapActual = {}
    actualData?.forEach(r => {
      const cicloVal = r[campoCiclo]
      if (cicloVal && cicloVal.trim() !== '') {
        mapActual[cicloVal] = (mapActual[cicloVal] || 0) + 1
      }
    })
    const mapPrev = {}
    prevData?.forEach(r => {
      const cicloVal = r[campoCiclo]
      if (cicloVal && cicloVal.trim() !== '') {
        mapPrev[cicloVal] = (mapPrev[cicloVal] || 0) + 1
      }
    })

    return Object.keys(mapActual).map(ciclo => ({
      ciclo,
      actual: mapActual[ciclo],
      anterior: mapPrev[ciclo] || 0,
      cumple: mapActual[ciclo] >= meta
    }))
  }

  async function cargar() {
    setLoading(true)
    try {
      const [lecturas, revisiones, repartos] = await Promise.all([
        cargarTabla('lecturas', METAS.lecturas, 'ciclo'),
        cargarTabla('revisiones', METAS.revisiones, 'ciclo'),
        cargarTabla('repartos', METAS.reparto, 'ciclo_reparto')
      ])
      setData({ lecturas, revisiones, repartos })
    } catch (error) {
      console.error('Error cargando datos por ciclo:', error)
    } finally {
      setLoading(false)
    }
  }

  // ========== DATOS PARA VISTAS DÍA Y USUARIO ==========
  async function cargarDatosExtra() {
    setLoadingExtra(true)
    try {
      const { from, to } = getMonthRangeUTC(month)
      console.log('=== Cargando datos extra (día/usuario) ===')
      console.log('Rango UTC:', from, 'a', to)

      // Lecturas
      const lecturasRes = await supabase
        .from('lecturas')
        .select('created_at, ciclo, creado_por_nombre')
        .gte('created_at', from)
        .lt('created_at', to)
      
      // Revisiones
      const revisionesRes = await supabase
        .from('revisiones')
        .select('created_at, ciclo, creado_por_nombre')
        .gte('created_at', from)
        .lt('created_at', to)
      
      // Repartos: usamos el mismo campo created_at
      const repartosRes = await supabase
        .from('repartos')
        .select('created_at, ciclo_reparto, creado_por_nombre')
        .gte('created_at', from)
        .lt('created_at', to)

      let lecturas = lecturasRes.data || []
      let revisiones = revisionesRes.data || []
      let repartos = repartosRes.data || []

      console.log('Raw - Lecturas:', lecturas.length, 'Revisiones:', revisiones.length, 'Repartos:', repartos.length)
      
      // Diagnóstico: si repartos sigue en 0, hacemos una consulta sin filtro de fecha para ver si la tabla tiene datos
      if (repartos.length === 0) {
        const { count, error: countError } = await supabase
          .from('repartos')
          .select('*', { count: 'exact', head: true })
        if (!countError) {
          console.log(`Total de repartos en toda la tabla: ${count}`)
          if (count > 0) {
            console.warn('La tabla repartos contiene registros, pero ninguno en el rango UTC actual. Verifica la zona horaria de created_at.')
          }
        }
      } else {
        console.log('Primer reparto:', repartos[0])
      }

      // Aplicar filtros extra (por ciclo y usuario)
      if (filtroCiclo) {
        lecturas = lecturas.filter(r => r.ciclo === filtroCiclo)
        revisiones = revisiones.filter(r => r.ciclo === filtroCiclo)
        repartos = repartos.filter(r => r.ciclo_reparto === filtroCiclo)
      }
      if (filtroUsuario) {
        lecturas = lecturas.filter(r => r.creado_por_nombre === filtroUsuario)
        revisiones = revisiones.filter(r => r.creado_por_nombre === filtroUsuario)
        repartos = repartos.filter(r => r.creado_por_nombre === filtroUsuario)
      }

      console.log('Después de filtros - Lecturas:', lecturas.length, 'Revisiones:', revisiones.length, 'Repartos:', repartos.length)

      // Función para extraer fecha en YYYY-MM-DD desde ISO string
      const getDateStr = (timestamp) => timestamp ? timestamp.split('T')[0] : null

      // --- Por día ---
      const dayMap = new Map()
      const addDay = (tipo, fechaStr) => {
        if (!fechaStr) return
        if (!dayMap.has(fechaStr)) {
          dayMap.set(fechaStr, { fecha: fechaStr, lecturas: 0, revisiones: 0, repartos: 0, total: 0 })
        }
        const day = dayMap.get(fechaStr)
        day[tipo]++
        day.total++
      }

      lecturas.forEach(r => addDay('lecturas', getDateStr(r.created_at)))
      revisiones.forEach(r => addDay('revisiones', getDateStr(r.created_at)))
      repartos.forEach(r => addDay('repartos', getDateStr(r.created_at)))

      const daily = Array.from(dayMap.values()).sort((a, b) => a.fecha.localeCompare(b.fecha))
      setDailyData(daily)
      console.log('Datos diarios generados:', daily.length)

      // --- Por usuario ---
      const userMap = new Map()
      const addUser = (tipo, usuario) => {
        if (!usuario) return
        if (!userMap.has(usuario)) {
          userMap.set(usuario, { usuario, lecturas: 0, revisiones: 0, repartos: 0, total: 0 })
        }
        const u = userMap.get(usuario)
        u[tipo]++
        u.total++
      }

      lecturas.forEach(r => addUser('lecturas', r.creado_por_nombre))
      revisiones.forEach(r => addUser('revisiones', r.creado_por_nombre))
      repartos.forEach(r => addUser('repartos', r.creado_por_nombre))

      const users = Array.from(userMap.values()).sort((a, b) => b.total - a.total)
      setUserData(users)
      console.log('Usuarios encontrados:', users.length)

      if (!filtroUsuario) {
        const allUsers = new Set()
        lecturas.forEach(r => r.creado_por_nombre && allUsers.add(r.creado_por_nombre))
        revisiones.forEach(r => r.creado_por_nombre && allUsers.add(r.creado_por_nombre))
        repartos.forEach(r => r.creado_por_nombre && allUsers.add(r.creado_por_nombre))
        setListaUsuarios(Array.from(allUsers).sort())
      }
    } catch (error) {
      console.error('Error cargando datos extra:', error)
    } finally {
      setLoadingExtra(false)
    }
  }

  // ========== COMPONENTES DE VISTA ==========
  const VistaPorCiclo = () => {
    const Chart = ({ title, rows, meta, color }) => {
      if (!rows.length) return <div className="dashboard-card">Sin datos para {title}</div>
      const total = rows.reduce((a, b) => a + b.actual, 0)
      const cumplen = rows.filter(r => r.cumple).length
      const porcentaje = rows.length ? ((cumplen / rows.length) * 100).toFixed(1) : 0

      return (
        <div className="dashboard-card" style={{ height: 500 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div><h3>{title}</h3><div style={{ fontSize: 13 }}>Meta: {meta} por ciclo</div></div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div><strong>{formatearNumero(total)}</strong><div style={{ fontSize: 11 }}>total</div></div>
              <div><strong>{rows.length}</strong><div style={{ fontSize: 11 }}>ciclos</div></div>
              <div><strong style={{ color }}>{cumplen}</strong><div style={{ fontSize: 11 }}>cumplen ({porcentaje}%)</div></div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="ciclo" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <ReferenceLine y={meta} stroke="#94a3b8" strokeDasharray="3 3" label="meta" />
              <Bar dataKey="actual" name="Mes actual" fill={color} radius={[4, 4, 0, 0]} />
              {compare && <Bar dataKey="anterior" name="Mes anterior" fill="#cbd5e1" radius={[4, 4, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )
    }

    return (
      <div className="charts">
        <Chart title="Lecturas por ciclo" rows={data.lecturas} meta={METAS.lecturas} color="#2563eb" />
        <Chart title="Revisiones por ciclo" rows={data.revisiones} meta={METAS.revisiones} color="#d97706" />
        <Chart title="Reparto por ciclo" rows={data.repartos} meta={METAS.reparto} color="#059669" />
      </div>
    )
  }

  const VistaPorDia = () => {
    if (loadingExtra) return <div className="loading-spinner" />
    if (!dailyData.length) return <div className="dashboard-card">No hay registros en el período con los filtros actuales.</div>
    const totalGeneral = dailyData.reduce((acc, d) => acc + d.total, 0)

    return (
      <div className="dashboard-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3>Actividad diaria</h3>
          <div><strong>Total registros: {formatearNumero(totalGeneral)}</strong></div>
        </div>
        <ResponsiveContainer width="100%" height={450}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="fecha" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="lecturas" stroke="#2563eb" name="Lecturas" strokeWidth={2} />
            <Line type="monotone" dataKey="revisiones" stroke="#d97706" name="Revisiones" strokeWidth={2} />
            <Line type="monotone" dataKey="repartos" stroke="#059669" name="Reparto" strokeWidth={2} />
            <Line type="monotone" dataKey="total" stroke="#8b5cf6" name="Total" strokeWidth={2} strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const VistaPorUsuario = () => {
    if (loadingExtra) return <div className="loading-spinner" />
    if (!userData.length) return <div className="dashboard-card">No hay datos de usuarios en el período seleccionado.</div>

    return (
      <div className="dashboard-card">
        <h3>Ranking de usuarios (por nombre)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Lecturas</th>
                <th>Revisiones</th>
                <th>Reparto</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {userData.map(u => (
                <tr key={u.usuario}>
                  <td><strong>{u.usuario || 'Sin nombre'}</strong></td>
                  <td>{formatearNumero(u.lecturas)}</td>
                  <td>{formatearNumero(u.revisiones)}</td>
                  <td>{formatearNumero(u.repartos)}</td>
                  <td><strong>{formatearNumero(u.total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ========== RENDER PRINCIPAL ==========
  if (loading && viewType === 'ciclo') {
    return (
      <div className="page">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <div className="page">
      <div className="topbar">
        <h1>Dashboard de Operaciones</h1>
        <div className="badge neutral">{formatearMes(month)}</div>
      </div>

      <div className="search-panel">
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ background: 'white' }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', padding: '0 12px', borderRadius: 12, border: '1px solid #cbd5f5' }}>
          <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />
          <span style={{ fontSize: 14 }}>Comparar meses (solo vista por ciclo)</span>
        </label>

        <select value={viewType} onChange={e => setViewType(e.target.value)} style={{ background: 'white' }}>
          <option value="ciclo">📊 Por ciclo</option>
          <option value="dia">📅 Por día</option>
          <option value="usuario">👥 Por usuario</option>
        </select>

        {viewType !== 'ciclo' && (
          <>
            <input
              type="text"
              placeholder="Filtrar por ciclo"
              value={filtroCiclo}
              onChange={e => setFiltroCiclo(e.target.value)}
              style={{ background: 'white' }}
            />
            <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)} style={{ background: 'white' }}>
              <option value="">Todos los usuarios</option>
              {listaUsuarios.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <button onClick={() => { setFiltroCiclo(''); setFiltroUsuario(''); }} className="secondary-btn">Limpiar filtros</button>
          </>
        )}

        <button onClick={cargar} disabled={loading} className="primary-btn">Actualizar</button>
      </div>

      {/* Tarjetas de resumen */}
      <div className="summary">
        <div className="summary-card">
          <span>Lecturas</span>
          <strong>{formatearNumero(data.lecturas.reduce((a, b) => a + b.actual, 0))}</strong>
          <small>{data.lecturas.length} ciclos</small>
        </div>
        <div className="summary-card">
          <span>Revisiones</span>
          <strong>{formatearNumero(data.revisiones.reduce((a, b) => a + b.actual, 0))}</strong>
          <small>{data.revisiones.length} ciclos</small>
        </div>
        <div className="summary-card">
          <span>Reparto</span>
          <strong>{formatearNumero(data.repartos.reduce((a, b) => a + b.actual, 0))}</strong>
          <small>{data.repartos.length} ciclos</small>
        </div>
      </div>

      {viewType === 'ciclo' && <VistaPorCiclo />}
      {viewType === 'dia' && <VistaPorDia />}
      {viewType === 'usuario' && <VistaPorUsuario />}
    </div>
  )
}