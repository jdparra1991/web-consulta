import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  LabelList
} from 'recharts'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import '../index.css'

const PAGE_SIZE = 10

const CAUSALES_DEVOLUCION = [
  '2 - Demolicion',
  '4 - Lote',
  '5 - No Existe Direccion',
  '8 - No Reciben',
  '9 - Ruta Errada',
  '10 - Repetida',
  'Otro'
]

const OPCIONES_VERIFICACION = [
  'Devolucion Correcta',
  'Devolucion Incorrecta',
  'No es Posible Determinar'
]

// Función para formatear números
const formatearNumero = (num) => new Intl.NumberFormat('es-CO').format(num || 0)

// Función para obtener fecha actual de Colombia (UTC-5)
const obtenerFechaColombia = () => {
  const ahora = new Date()
  const colombia = new Date(ahora.getTime() - (5 * 60 * 60 * 1000))
  const año = colombia.getFullYear()
  const mes = String(colombia.getMonth() + 1).padStart(2, '0')
  const dia = String(colombia.getDate()).padStart(2, '0')
  return `${año}-${mes}-${dia}`
}

export default function Devoluciones({ onBack, rol }) {
  const [devoluciones, setDevoluciones] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [excelData, setExcelData] = useState([])
  const [excelPreview, setExcelPreview] = useState([])
  const [stats, setStats] = useState({
    totalRegistros: 0,
    totalDevoluciones: 0,
    porDia: [],
    porMes: [],
    porCausal: []
  })
  const [filters, setFilters] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    ciclo: '',
    causal: ''
  })
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Formulario de devolución
  const [formData, setFormData] = useState({
    ciclo: '',
    contrato: '',
    direccion: '',
    causal_devolucion: '',
    cuentas_vencidas: '',
    verificacion: '',
    fecha_devolucion: obtenerFechaColombia()
  })

  useEffect(() => {
    cargarDevoluciones()
    cargarEstadisticas()
  }, [filters, page])

  async function cargarDevoluciones() {
    setLoading(true)
    try {
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('devoluciones')
        .select('*', { count: 'exact' })
        .order('fecha_devolucion', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filters.fecha_desde) {
        query = query.gte('fecha_devolucion', filters.fecha_desde)
      }
      if (filters.fecha_hasta) {
        query = query.lte('fecha_devolucion', filters.fecha_hasta)
      }
      if (filters.ciclo) {
        query = query.ilike('ciclo', `%${filters.ciclo}%`)
      }
      if (filters.causal) {
        query = query.ilike('causal_devolucion', `%${filters.causal}%`)
      }

      const { data, count, error } = await query

      if (error) throw error
      setDevoluciones(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error cargando devoluciones:', error)
    } finally {
      setLoading(false)
    }
  }

  async function cargarEstadisticas() {
    try {
      // Devoluciones por día (últimos 30 días)
      const fechaLimite = new Date()
      fechaLimite.setDate(fechaLimite.getDate() - 30)
      
      const { data: datosPorDia } = await supabase
        .from('devoluciones')
        .select('fecha_devolucion')
        .gte('fecha_devolucion', fechaLimite.toISOString().split('T')[0])
      
      const devolucionesPorDia = {}
      datosPorDia?.forEach(r => {
        devolucionesPorDia[r.fecha_devolucion] = (devolucionesPorDia[r.fecha_devolucion] || 0) + 1
      })

      // Devoluciones por mes (últimos 12 meses)
      const { data: datosPorMes } = await supabase
        .from('devoluciones')
        .select('fecha_devolucion')
      
      const devolucionesPorMes = {}
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
      
      datosPorMes?.forEach(r => {
        const fecha = new Date(r.fecha_devolucion)
        const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
        const mesLabel = `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`
        
        if (!devolucionesPorMes[mesKey]) {
          devolucionesPorMes[mesKey] = { mes: mesLabel, cantidad: 0, key: mesKey }
        }
        devolucionesPorMes[mesKey].cantidad++
      })

      // Devoluciones por causal
      const { data: datosPorCausal } = await supabase
        .from('devoluciones')
        .select('causal_devolucion')
        .not('causal_devolucion', 'is', null)
      
      const devolucionesPorCausal = {}
      datosPorCausal?.forEach(r => {
        devolucionesPorCausal[r.causal_devolucion] = (devolucionesPorCausal[r.causal_devolucion] || 0) + 1
      })

      // Total general
      const { count } = await supabase
        .from('devoluciones')
        .select('*', { count: 'exact', head: true })

      setStats({
        totalRegistros: count || 0,
        totalDevoluciones: count || 0,
        porDia: Object.entries(devolucionesPorDia).map(([fecha, cantidad]) => ({ fecha, cantidad })),
        porMes: Object.values(devolucionesPorMes).sort((a, b) => a.key.localeCompare(b.key)).slice(-12),
        porCausal: Object.entries(devolucionesPorCausal)
          .map(([causal, cantidad]) => ({ causal, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad)
          .slice(0, 5)
      })

    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

  // Función para exportar a Excel
  const exportarExcel = async () => {
    try {
      setExporting(true)
      
      let query = supabase
        .from('devoluciones')
        .select('*')
        .order('fecha_devolucion', { ascending: false })

      if (filters.fecha_desde) {
        query = query.gte('fecha_devolucion', filters.fecha_desde)
      }
      if (filters.fecha_hasta) {
        query = query.lte('fecha_devolucion', filters.fecha_hasta)
      }
      if (filters.ciclo) {
        query = query.ilike('ciclo', `%${filters.ciclo}%`)
      }
      if (filters.causal) {
        query = query.ilike('causal_devolucion', `%${filters.causal}%`)
      }

      const { data, error } = await query

      if (error) throw error

      const excelData = data.map(r => ({
        'Fecha': new Date(r.fecha_devolucion).toLocaleDateString('es-CO'),
        'Ciclo': r.ciclo || '',
        'Contrato': r.contrato || '',
        'Dirección': r.direccion || '',
        'Causal Devolución': r.causal_devolucion || '',
        'Cuentas Vencidas': r.cuentas_vencidas || '',
        'Verificación': r.verificacion || '',
        'Fecha Creación': new Date(r.created_at).toLocaleString('es-CO'),
        'Creado Por': r.creado_por_nombre || ''
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelData)
      
      const colWidths = [
        { wch: 12 }, // Fecha
        { wch: 8 },  // Ciclo
        { wch: 15 }, // Contrato
        { wch: 30 }, // Dirección
        { wch: 25 }, // Causal
        { wch: 15 }, // Cuentas Vencidas
        { wch: 20 }, // Verificación
        { wch: 20 }, // Fecha Creación
        { wch: 25 }  // Creado Por
      ]
      ws['!cols'] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, 'Devoluciones')

      let nombreArchivo = 'devoluciones'
      if (filters.fecha_desde || filters.fecha_hasta) {
        nombreArchivo += `_${filters.fecha_desde || 'inicio'}_${filters.fecha_hasta || 'fin'}`
      }
      if (filters.ciclo) {
        nombreArchivo += `_ciclo_${filters.ciclo}`
      }
      nombreArchivo += `.xlsx`

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/octet-stream' })
      saveAs(blob, nombreArchivo)

      alert(`✅ ${data.length} devoluciones exportadas exitosamente`)

    } catch (error) {
      console.error('Error exportando a Excel:', error)
      alert('Error al exportar los datos')
    } finally {
      setExporting(false)
    }
  }

  async function guardarDevolucion() {
    try {
      setLoading(true)
      
      if (!formData.ciclo && !formData.contrato) {
        alert('Debe ingresar al menos ciclo o contrato')
        return
      }

      const user = (await supabase.auth.getUser()).data.user
      
      const devolucionData = {
        ...formData,
        creado_por_id: user?.id,
        creado_por_nombre: user?.email
      }

      let error
      if (editingId) {
        ({ error } = await supabase
          .from('devoluciones')
          .update(devolucionData)
          .eq('id', editingId))
      } else {
        ({ error } = await supabase
          .from('devoluciones')
          .insert([devolucionData]))
      }

      if (error) throw error

      setFormData({
        ciclo: '',
        contrato: '',
        direccion: '',
        causal_devolucion: '',
        cuentas_vencidas: '',
        verificacion: '',
        fecha_devolucion: obtenerFechaColombia()
      })
      setEditingId(null)
      setShowForm(false)
      
      await cargarDevoluciones()
      await cargarEstadisticas()
      
      alert(editingId ? 'Devolución actualizada' : 'Devolución guardada')
    } catch (error) {
      console.error('Error guardando devolución:', error)
      alert('Error al guardar la devolución')
    } finally {
      setLoading(false)
    }
  }

  // Cargar desde Excel
  const cargarExcel = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      const headers = jsonData[0]
      const rows = jsonData.slice(1).filter(row => row.some(cell => cell))

      // Mapeo de columnas esperadas en el Excel
      const columnMap = {
        'CICLO': 0,
        'CONTRATO': 1,
        'DIRECCION': 2,
        'CAUSAL DEVOLUCION': 3,
        'CUENTAS VENCIDAS': 4,
        'VERIFICACION': 5
      }

      const devolucionesExcel = rows.map(row => ({
        ciclo: row[columnMap['CICLO']] || '',
        contrato: row[columnMap['CONTRATO']] || '',
        direccion: row[columnMap['DIRECCION']] || '',
        causal_devolucion: row[columnMap['CAUSAL DEVOLUCION']] || '',
        cuentas_vencidas: row[columnMap['CUENTAS VENCIDAS']] || '',
        verificacion: row[columnMap['VERIFICACION']] || '',
        fecha_devolucion: obtenerFechaColombia()
      }))

      setExcelData(devolucionesExcel)
      setExcelPreview(devolucionesExcel.slice(0, 5))
      setShowExcelModal(true)
    }
    reader.readAsArrayBuffer(file)
  }

  async function guardarExcel() {
    try {
      setLoading(true)
      const user = (await supabase.auth.getUser()).data.user
      
      const devolucionesParaGuardar = excelData.map(r => ({
        ...r,
        creado_por_id: user?.id,
        creado_por_nombre: user?.email
      }))

      const { error } = await supabase
        .from('devoluciones')
        .insert(devolucionesParaGuardar)

      if (error) throw error

      setShowExcelModal(false)
      setExcelData([])
      setExcelPreview([])
      
      await cargarDevoluciones()
      await cargarEstadisticas()
      
      alert(`✅ ${devolucionesParaGuardar.length} devoluciones cargadas exitosamente`)
    } catch (error) {
      console.error('Error guardando Excel:', error)
      alert('Error al guardar las devoluciones desde Excel')
    } finally {
      setLoading(false)
    }
  }

  function editarDevolucion(devolucion) {
    setFormData(devolucion)
    setEditingId(devolucion.id)
    setShowForm(true)
  }

  async function eliminarDevolucion(id) {
    if (!confirm('¿Estás seguro de eliminar esta devolución?')) return
    
    try {
      setLoading(true)
      const { error } = await supabase
        .from('devoluciones')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      await cargarDevoluciones()
      await cargarEstadisticas()
      alert('Devolución eliminada')
    } catch (error) {
      console.error('Error eliminando devolución:', error)
      alert('Error al eliminar la devolución')
    } finally {
      setLoading(false)
    }
  }

  const resetFilters = () => {
    setFilters({
      fecha_desde: '',
      fecha_hasta: '',
      ciclo: '',
      causal: ''
    })
    setPage(1)
  }

  return (
    <div className="page">
      <header className="topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>Devoluciones de Reparto</h1>
        {rol === 'admin' && <span className="user-role">Admin</span>}
      </header>

      {/* Tarjetas de resumen */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#dbeafe' }}>📋</div>
          <div className="stat-info">
            <div className="stat-label">Total Registros</div>
            <div className="stat-value">{stats.totalRegistros}</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#fee2e2' }}>🔄</div>
          <div className="stat-info">
            <div className="stat-label">Total Devoluciones</div>
            <div className="stat-value">{stats.totalDevoluciones}</div>
          </div>
        </div>
        <button className="action-btn primary" onClick={() => setShowStatsModal(true)} style={{ alignSelf: 'center' }}>
          📊 Ver Estadísticas
        </button>
      </div>

      {/* Botones de acción */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <label className={`action-btn secondary ${exporting ? 'disabled' : ''}`}>
          📥 Cargar Excel
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={cargarExcel}
            style={{ display: 'none' }}
            disabled={exporting}
          />
        </label>
        <button 
          className="action-btn success"
          onClick={exportarExcel}
          disabled={exporting || loading}
        >
          {exporting ? '⏳ Exportando...' : '📊 Exportar Excel'}
        </button>
        <button 
          className="action-btn primary"
          onClick={() => {
            setFormData({
              ciclo: '',
              contrato: '',
              direccion: '',
              causal_devolucion: '',
              cuentas_vencidas: '',
              verificacion: '',
              fecha_devolucion: obtenerFechaColombia()
            })
            setEditingId(null)
            setShowForm(true)
          }}
        >
          + Nueva Devolución
        </button>
      </div>

      {/* Modal de estadísticas */}
      {showStatsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 1200, maxHeight: '90vh' }}>
            <div className="modal-header">
              <h2>📊 Estadísticas de Devoluciones</h2>
              <button className="close-btn" onClick={() => setShowStatsModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <div className="charts-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                
                {/* Gráfico por día (línea) */}
                <div className="dashboard-card">
                  <h3>📅 Devoluciones por Día (últimos 30 días)</h3>
                  <div style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.porDia}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip formatter={(value) => formatearNumero(value)} />
                        <Legend />
                        <Line type="monotone" dataKey="cantidad" stroke="#f97316" strokeWidth={2}>
                          <LabelList dataKey="cantidad" position="top" formatter={formatearNumero} />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico por mes (barras) */}
                <div className="dashboard-card">
                  <h3>📊 Devoluciones por Mes</h3>
                  <div style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.porMes}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={formatearNumero} />
                        <Tooltip formatter={(value) => formatearNumero(value)} />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                          <LabelList dataKey="cantidad" position="top" formatter={formatearNumero} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico de causales (barras horizontales) */}
                <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
                  <h3>🔍 Principales Causales de Devolución</h3>
                  <div style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.porCausal} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={formatearNumero} />
                        <YAxis dataKey="causal" type="category" width={150} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value) => formatearNumero(value)} />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                          <LabelList dataKey="cantidad" position="right" formatter={formatearNumero} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </div>
            <div className="modal-footer">
              <button className="primary-btn" onClick={() => setShowStatsModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Excel (sin cambios) */}
      {showExcelModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h2>Vista previa de carga Excel</h2>
              <button className="close-btn" onClick={() => setShowExcelModal(false)}>✕</button>
            </div>
            
            <div className="modal-body">
              <p style={{ marginBottom: 16 }}>
                Se encontraron <strong>{excelData.length}</strong> registros para cargar
              </p>
              
              <div className="table-container" style={{ maxHeight: 300, overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Ciclo</th>
                      <th>Contrato</th>
                      <th>Causal</th>
                      <th>Verificación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelPreview.map((r, idx) => (
                      <tr key={idx}>
                        <td>{r.ciclo}</td>
                        <td>{r.contrato}</td>
                        <td>{r.causal_devolucion}</td>
                        <td>{r.verificacion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {excelData.length > 5 && (
                <p style={{ marginTop: 8, color: '#64748b' }}>
                  ... y {excelData.length - 5} registros más
                </p>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="secondary-btn" onClick={() => setShowExcelModal(false)}>
                Cancelar
              </button>
              <button className="primary-btn" onClick={guardarExcel} disabled={loading}>
                {loading ? 'Cargando...' : `Cargar ${excelData.length} devoluciones`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulario modal (sin cambios) */}
      {showForm && (
        <div className="form-modal">
          <div className="form-modal-content">
            <div className="form-modal-header">
              <h2>{editingId ? 'Editar Devolución' : 'Nueva Devolución'}</h2>
              <button className="close-btn" onClick={() => setShowForm(false)}>✕</button>
            </div>
            
            <div className="form-modal-body">
              <div className="form-tabs">
                <div className="tab active">Información General</div>
              </div>

              <div className="form-section">
                <h3>📋 Datos de la Devolución</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Fecha de Devolución</label>
                    <input 
                      type="date"
                      value={formData.fecha_devolucion}
                      onChange={e => setFormData({...formData, fecha_devolucion: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label>Ciclo</label>
                    <input 
                      type="text"
                      value={formData.ciclo}
                      onChange={e => setFormData({...formData, ciclo: e.target.value})}
                      placeholder="Ej: 40"
                    />
                  </div>

                  <div className="form-group">
                    <label>Contrato</label>
                    <input 
                      type="text"
                      value={formData.contrato}
                      onChange={e => setFormData({...formData, contrato: e.target.value})}
                      placeholder="Número de contrato"
                    />
                  </div>

                  <div className="form-group">
                    <label>Dirección</label>
                    <input 
                      type="text"
                      value={formData.direccion}
                      onChange={e => setFormData({...formData, direccion: e.target.value})}
                      placeholder="Dirección de la devolución"
                    />
                  </div>

                  <div className="form-group">
                    <label>Causal de Devolución</label>
                    <select 
                      value={formData.causal_devolucion}
                      onChange={e => setFormData({...formData, causal_devolucion: e.target.value})}
                    >
                      <option value="">Seleccionar</option>
                      {CAUSALES_DEVOLUCION.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Cuentas Vencidas (valor numérico)</label>
                    <input 
                      type="number"
                      value={formData.cuentas_vencidas}
                      onChange={e => setFormData({...formData, cuentas_vencidas: e.target.value})}
                      placeholder="Ej: 150000"
                    />
                  </div>

                  <div className="form-group">
                    <label>Verificación</label>
                    <select 
                      value={formData.verificacion}
                      onChange={e => setFormData({...formData, verificacion: e.target.value})}
                    >
                      <option value="">Seleccionar</option>
                      {OPCIONES_VERIFICACION.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="form-modal-footer">
              <button className="secondary-btn" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button className="primary-btn" onClick={guardarDevolucion} disabled={loading}>
                {loading ? 'Guardando...' : (editingId ? 'Actualizar Devolución' : 'Guardar Devolución')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="search-panel" style={{ marginBottom: 20 }}>
        <input
          type="date"
          placeholder="Fecha desde"
          value={filters.fecha_desde}
          onChange={e => setFilters({...filters, fecha_desde: e.target.value, page: 1})}
        />
        <input
          type="date"
          placeholder="Fecha hasta"
          value={filters.fecha_hasta}
          onChange={e => setFilters({...filters, fecha_hasta: e.target.value, page: 1})}
        />
        <input
          type="text"
          placeholder="Ciclo"
          value={filters.ciclo}
          onChange={e => setFilters({...filters, ciclo: e.target.value, page: 1})}
        />
        <input
          type="text"
          placeholder="Causal"
          value={filters.causal}
          onChange={e => setFilters({...filters, causal: e.target.value, page: 1})}
        />
        <button onClick={resetFilters}>Limpiar</button>
      </div>

      {/* Tabla de devoluciones */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Ciclo</th>
              <th>Contrato</th>
              <th>Dirección</th>
              <th>Causal</th>
              <th>Cuentas Vencidas</th>
              <th>Verificación</th>
              {rol === 'admin' && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {devoluciones.map(r => (
              <tr key={r.id}>
                <td>{new Date(r.fecha_devolucion).toLocaleDateString()}</td>
                <td>{r.ciclo || '-'}</td>
                <td>{r.contrato || '-'}</td>
                <td>{r.direccion || '-'}</td>
                <td>
                  <span className="badge warning">
                    {r.causal_devolucion || '-'}
                  </span>
                </td>
                <td>{r.cuentas_vencidas ? `$${Number(r.cuentas_vencidas).toLocaleString('es-CO')}` : '-'}</td>
                <td>
                  <span className={`badge ${
                    r.verificacion === 'Devolucion Correcta' ? 'success' : 
                    r.verificacion === 'Devolucion Incorrecta' ? 'danger' : 'warning'
                  }`}>
                    {r.verificacion || '-'}
                  </span>
                </td>
                {rol === 'admin' && (
                  <td>
                    <button 
                      className="icon-btn" 
                      onClick={() => editarDevolucion(r)}
                      style={{ marginRight: 8 }}
                    >
                      ✏️
                    </button>
                    <button 
                      className="icon-btn" 
                      onClick={() => eliminarDevolucion(r.id)}
                    >
                      🗑️
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {devoluciones.length === 0 && (
              <tr>
                <td colSpan={rol === 'admin' ? 8 : 7} style={{ textAlign: 'center', padding: 40 }}>
                  No hay devoluciones registradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalCount > PAGE_SIZE && (
        <div className="pagination">
          <button 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Anterior
          </button>
          <span>Página {page} de {Math.ceil(totalCount / PAGE_SIZE)}</span>
          <button 
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(totalCount / PAGE_SIZE)}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}