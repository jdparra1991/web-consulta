// Dashboard.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  Legend
} from 'recharts'
import '../index.css'

const METAS = {
  lecturas: 30,
  revisiones: 20,
  reparto: 60
}

function getMonthRange(month) {
  const [year, monthNum] = month.split('-').map(Number)
  
  // Crear fechas en UTC para evitar problemas de zona horaria
  const start = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0))
  const end = new Date(Date.UTC(year, monthNum, 1, 0, 0, 0))
  
  return {
    from: start.toISOString(),
    to: end.toISOString()
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
  const [data, setData] = useState({
    lecturas: [],
    revisiones: [],
    repartos: []  // Cambiado de 'reparto' a 'repartos'
  })

  useEffect(() => {
    cargar()
  }, [month, compare])

  async function cargarTabla(tabla, meta, campoCiclo) {
    const rango = getMonthRange(month)
    
    console.log(`Cargando ${tabla}...`)

    const { data: actualData, error: errorActual } = await supabase
      .from(tabla)
      .select(campoCiclo)
      .gte('created_at', rango.from)
      .lt('created_at', rango.to)

    if (errorActual) {
      console.error(`Error cargando ${tabla}:`, errorActual)
      return []
    }

    let prevData = []
    if (compare) {
      const prevMonth = getPrevMonth(month)
      const rangoPrev = getMonthRange(prevMonth)
      const { data: prev } = await supabase
        .from(tabla)
        .select(campoCiclo)
        .gte('created_at', rangoPrev.from)
        .lt('created_at', rangoPrev.to)
      prevData = prev || []
    }

    console.log(`${tabla} - Registros encontrados:`, actualData?.length || 0)

    // Agrupar por ciclo
    const mapActual = {}
    actualData?.forEach(r => {
      const ciclo = r[campoCiclo]
      if (ciclo) {
        mapActual[ciclo] = (mapActual[ciclo] || 0) + 1
      }
    })

    const mapPrev = {}
    prevData?.forEach(r => {
      const ciclo = r[campoCiclo]
      if (ciclo) {
        mapPrev[ciclo] = (mapPrev[ciclo] || 0) + 1
      }
    })

    const resultado = Object.keys(mapActual).map(ciclo => ({
      ciclo,
      actual: mapActual[ciclo],
      anterior: mapPrev[ciclo] || 0,
      cumple: mapActual[ciclo] >= meta
    }))

    console.log(`${tabla} - Ciclos distintos:`, resultado.length)
    return resultado
  }

  async function cargar() {
    setLoading(true)
    try {
      console.log('=== INICIANDO CARGA DE DATOS ===')
      console.log('Mes seleccionado:', month)
      
      // CORREGIDO: Usamos 'repartos' (plural) que es el nombre correcto de la tabla
      const [lecturas, revisiones, repartos] = await Promise.all([
        cargarTabla('lecturas', METAS.lecturas, 'ciclo'),
        cargarTabla('revisiones', METAS.revisiones, 'ciclo'),
        cargarTabla('repartos', METAS.reparto, 'ciclo_reparto')  // ← CORREGIDO: 'repartos'
      ])

      console.log('=== RESULTADOS FINALES ===')
      console.log('Lecturas:', lecturas.length, 'ciclos')
      console.log('Revisiones:', revisiones.length, 'ciclos')
      console.log('Repartos:', repartos.length, 'ciclos')

      setData({ lecturas, revisiones, repartos })
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  function Chart({ title, rows, meta, color }) {
    // Si no hay datos, mostrar mensaje
    if (!rows || rows.length === 0) {
      return (
        <div className="dashboard-card" style={{ minHeight: 450, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h3>{title}</h3>
            <p style={{ color: '#64748b', marginTop: 16 }}>
              No hay datos para {formatearMes(month)}
            </p>
          </div>
        </div>
      )
    }

    const total = rows.reduce((acc, r) => acc + r.actual, 0)
    const cumplen = rows.filter(r => r.cumple).length
    const porcentaje = rows.length ? ((cumplen / rows.length) * 100).toFixed(1) : 0

    return (
      <div className="dashboard-card" style={{ height: 500, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexShrink: 0 }}>
          <div>
            <h3>{title}</h3>
            <div style={{ fontSize: 13, color: '#64748b' }}>Meta: {meta} por ciclo</div>
          </div>
          <div style={{ display: 'flex', gap: 16, background: '#f8fafc', padding: '8px 16px', borderRadius: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <strong style={{ fontSize: 20, color: '#0f172a' }}>{formatearNumero(total)}</strong>
              <div style={{ fontSize: 11, color: '#64748b' }}>total</div>
            </div>
            <div style={{ width: 1, background: '#e2e8f0' }} />
            <div style={{ textAlign: 'center' }}>
              <strong style={{ fontSize: 20, color: '#0f172a' }}>{rows.length}</strong>
              <div style={{ fontSize: 11, color: '#64748b' }}>ciclos</div>
            </div>
            <div style={{ width: 1, background: '#e2e8f0' }} />
            <div style={{ textAlign: 'center' }}>
              <strong style={{ fontSize: 20, color }}>{cumplen}</strong>
              <div style={{ fontSize: 11, color: '#64748b' }}>cumplen ({porcentaje}%)</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="ciclo" 
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'white',
                  border: 'none',
                  borderRadius: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  padding: '8px 12px'
                }}
              />
              <Legend 
                verticalAlign="top" 
                height={36}
                iconType="circle"
                iconSize={8}
              />
              <ReferenceLine 
                y={meta} 
                stroke="#94a3b8" 
                strokeDasharray="3 3"
                label={{ 
                  value: `meta ${meta}`, 
                  position: 'right',
                  fill: '#64748b',
                  fontSize: 11
                }} 
              />
              <Bar 
                dataKey="actual" 
                name="Mes actual" 
                fill={color} 
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              {compare && (
                <Bar 
                  dataKey="anterior" 
                  name="Mes anterior" 
                  fill="#cbd5e1" 
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: 40, 
              height: 40, 
              border: '3px solid #e2e8f0', 
              borderTopColor: '#1e40af', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite',
              marginBottom: 16
            }} />
            <p style={{ color: '#64748b' }}>Cargando datos...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="topbar">
        <h1>Dashboard de Ciclos</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span className="badge neutral" style={{ textTransform: 'capitalize' }}>
            {formatearMes(month)}
          </span>
        </div>
      </div>

      <div className="search-panel">
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          style={{ background: 'white' }}
        />
        
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          padding: '0 12px',
          background: 'white',
          borderRadius: 12,
          border: '1px solid #cbd5f5',
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={compare}
            onChange={e => setCompare(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 14, color: '#475569' }}>Comparar con mes anterior</span>
        </label>

        <button 
          onClick={cargar} 
          disabled={loading}
          style={{ background: '#1e40af' }}
          className="search-btn"
        >
          Actualizar
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary">
        <div className="summary-card">
          <span>Total Lecturas</span>
          <strong>{formatearNumero(data.lecturas.reduce((acc, r) => acc + r.actual, 0))}</strong>
          <small>{data.lecturas.length} ciclos activos</small>
        </div>
        <div className="summary-card">
          <span>Total Revisiones</span>
          <strong>{formatearNumero(data.revisiones.reduce((acc, r) => acc + r.actual, 0))}</strong>
          <small>{data.revisiones.length} ciclos activos</small>
        </div>
        <div className="summary-card">
          <span>Total Reparto</span>
          <strong>{formatearNumero(data.repartos.reduce((acc, r) => acc + r.actual, 0))}</strong>
          <small>{data.repartos.length} ciclos activos</small>
        </div>
      </div>

      <div className="charts">
        <Chart
          title="Lecturas por ciclo"
          rows={data.lecturas}
          meta={METAS.lecturas}
          color="#2563eb"
        />

        <Chart
          title="Revisiones por ciclo"
          rows={data.revisiones}
          meta={METAS.revisiones}
          color="#d97706"
        />

        <Chart
          title="Reparto por ciclo"
          rows={data.repartos}  // ← CORREGIDO: ahora usa 'repartos'
          meta={METAS.reparto}
          color="#059669"
        />
      </div>
    </div>
  )
}