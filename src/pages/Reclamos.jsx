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

const MOTIVOS = [
  'Facturación',
  'Medidor',
  'Calidad del servicio',
  'Daños en equipos',
  'Cobros indebidos',
  'Atención al cliente',
  'Instalación',
  'Suspensión',
  'Reconexión',
  'Otro'
]

const MEDIOS_RECEPCION = [
  'WhatsApp',
  'Llamada telefónica',
  'Correo electrónico',
  'Presencial',
  'App',
  'Web',
  'Redes sociales'
]

const CAUSALES = [
  'Error humano',
  'Falla técnica',
  'Problema de sistema',
  'Clima',
  'Terceros',
  'Materiales',
  'Programación',
  'No aplica'
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

export default function Reclamos({ onBack, rol }) {
  const [reclamos, setReclamos] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [excelData, setExcelData] = useState([])
  const [excelPreview, setExcelPreview] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    porDia: [],
    porMes: [],
    porMotivo: []
  })
  const [filters, setFilters] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    ciclo: '',
    nombre: ''
  })
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Formulario de reclamo
  const [formData, setFormData] = useState({
    ciclo: '',
    contrato: '',
    telecomunicaciones: '',
    servicios_publicos: '',
    nombre: '',
    contacto: '',
    direccion_reclamo: '',
    ruta: '',
    consecutivos: '',
    digital: '',
    medio_recepcion: '',
    motivo: '',
    gestion: '',
    observacion_reclamo: '',
    causal: '',
    gestion_realizada: '',
    justificacion: '',
    fecha_reclamo: obtenerFechaColombia()
  })

  useEffect(() => {
    cargarReclamos()
    cargarEstadisticas()
  }, [filters, page])

  async function cargarReclamos() {
    setLoading(true)
    try {
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('reclamos')
        .select('*', { count: 'exact' })
        .order('fecha_reclamo', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filters.fecha_desde) {
        query = query.gte('fecha_reclamo', filters.fecha_desde)
      }
      if (filters.fecha_hasta) {
        query = query.lte('fecha_reclamo', filters.fecha_hasta)
      }
      if (filters.ciclo) {
        query = query.ilike('ciclo', `%${filters.ciclo}%`)
      }
      if (filters.nombre) {
        query = query.ilike('nombre', `%${filters.nombre}%`)
      }

      const { data, count, error } = await query

      if (error) throw error
      setReclamos(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error cargando reclamos:', error)
    } finally {
      setLoading(false)
    }
  }

  async function cargarEstadisticas() {
    try {
      // Reclamos por día (últimos 30 días)
      const fechaLimite = new Date()
      fechaLimite.setDate(fechaLimite.getDate() - 30)
      
      const { data: datosPorDia } = await supabase
        .from('reclamos')
        .select('fecha_reclamo')
        .gte('fecha_reclamo', fechaLimite.toISOString().split('T')[0])
      
      const reclamosPorDia = {}
      datosPorDia?.forEach(r => {
        reclamosPorDia[r.fecha_reclamo] = (reclamosPorDia[r.fecha_reclamo] || 0) + 1
      })

      // Reclamos por mes (últimos 12 meses)
      const { data: datosPorMes } = await supabase
        .from('reclamos')
        .select('fecha_reclamo')
      
      const reclamosPorMes = {}
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
      
      datosPorMes?.forEach(r => {
        const fecha = new Date(r.fecha_reclamo)
        const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
        const mesLabel = `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`
        
        if (!reclamosPorMes[mesKey]) {
          reclamosPorMes[mesKey] = { mes: mesLabel, cantidad: 0, key: mesKey }
        }
        reclamosPorMes[mesKey].cantidad++
      })

      // Reclamos por motivo
      const { data: datosPorMotivo } = await supabase
        .from('reclamos')
        .select('motivo')
        .not('motivo', 'is', null)
      
      const reclamosPorMotivo = {}
      datosPorMotivo?.forEach(r => {
        reclamosPorMotivo[r.motivo] = (reclamosPorMotivo[r.motivo] || 0) + 1
      })

      // Total general
      const { count } = await supabase
        .from('reclamos')
        .select('*', { count: 'exact', head: true })

      setStats({
        total: count || 0,
        porDia: Object.entries(reclamosPorDia).map(([fecha, cantidad]) => ({ fecha, cantidad })),
        porMes: Object.values(reclamosPorMes).sort((a, b) => a.key.localeCompare(b.key)).slice(-12),
        porMotivo: Object.entries(reclamosPorMotivo)
          .map(([motivo, cantidad]) => ({ motivo, cantidad }))
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
        .from('reclamos')
        .select('*')
        .order('fecha_reclamo', { ascending: false })

      if (filters.fecha_desde) {
        query = query.gte('fecha_reclamo', filters.fecha_desde)
      }
      if (filters.fecha_hasta) {
        query = query.lte('fecha_reclamo', filters.fecha_hasta)
      }
      if (filters.ciclo) {
        query = query.ilike('ciclo', `%${filters.ciclo}%`)
      }
      if (filters.nombre) {
        query = query.ilike('nombre', `%${filters.nombre}%`)
      }

      const { data, error } = await query

      if (error) throw error

      const excelData = data.map(r => ({
        'Fecha': new Date(r.fecha_reclamo).toLocaleDateString('es-CO'),
        'Ciclo': r.ciclo || '',
        'Contrato': r.contrato || '',
        'Telecomunicaciones': r.telecomunicaciones || '',
        'Servicios Públicos': r.servicios_publicos || '',
        'Nombre': r.nombre || '',
        'Contacto': r.contacto || '',
        'Dirección del Reclamo': r.direccion_reclamo || '',
        'Ruta': r.ruta || '',
        'Consecutivos': r.consecutivos || '',
        'Digital': r.digital || '',
        'Medio de Recepción': r.medio_recepcion || '',
        'Motivo': r.motivo || '',
        'Gestión': r.gestion || '',
        'Observación Reclamo': r.observacion_reclamo || '',
        'Causal': r.causal || '',
        'Gestión Realizada': r.gestion_realizada || '',
        'Justificación': r.justificacion || '',
        'Fecha Creación': new Date(r.created_at).toLocaleString('es-CO'),
        'Creado Por': r.creado_por_nombre || ''
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelData)
      
      const colWidths = [
        { wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 30 }, { wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 15 },
        { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 30 },
        { wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 20 }, { wch: 25 }
      ]
      ws['!cols'] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, 'Reclamos')

      let nombreArchivo = 'reclamos'
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

      alert(`✅ ${data.length} reclamos exportados exitosamente`)

    } catch (error) {
      console.error('Error exportando a Excel:', error)
      alert('Error al exportar los datos')
    } finally {
      setExporting(false)
    }
  }

  async function guardarReclamo() {
    try {
      setLoading(true)
      
      if (!formData.nombre) {
        alert('El nombre es requerido')
        return
      }

      const user = (await supabase.auth.getUser()).data.user
      
      const reclamoData = {
        ...formData,
        creado_por_id: user?.id,
        creado_por_nombre: user?.email
      }

      let error
      if (editingId) {
        ({ error } = await supabase
          .from('reclamos')
          .update(reclamoData)
          .eq('id', editingId))
      } else {
        ({ error } = await supabase
          .from('reclamos')
          .insert([reclamoData]))
      }

      if (error) throw error

      setFormData({
        ciclo: '',
        contrato: '',
        telecomunicaciones: '',
        servicios_publicos: '',
        nombre: '',
        contacto: '',
        direccion_reclamo: '',
        ruta: '',
        consecutivos: '',
        digital: '',
        medio_recepcion: '',
        motivo: '',
        gestion: '',
        observacion_reclamo: '',
        causal: '',
        gestion_realizada: '',
        justificacion: '',
        fecha_reclamo: obtenerFechaColombia()
      })
      setEditingId(null)
      setShowForm(false)
      
      await cargarReclamos()
      await cargarEstadisticas()
      
      alert(editingId ? 'Reclamo actualizado' : 'Reclamo guardado')
    } catch (error) {
      console.error('Error guardando reclamo:', error)
      alert('Error al guardar el reclamo')
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

      const rows = jsonData.slice(1).filter(row => row.some(cell => cell))

      const columnMap = {
        'CICLO': 0,
        'CONTRATO': 1,
        'TELECOMUNICACIONES': 2,
        'SERVICIOS PUBLICOS': 3,
        'NOMBRE': 4,
        'CONTACTO': 5,
        'DIRECCION DEL RECLAMO': 6,
        'RUTA': 7,
        'CONSECUTIVOS': 8,
        'DIGITAL': 9,
        'MEDIO DE RECEPCION RECLAMO': 10,
        'Motivo': 11,
        'GESTION': 12,
        'OBSERVACION RECLAMO': 13,
        'CAUSAL': 14,
        'GESTION REALIZADA': 15,
        'JUSTIFICACION': 16
      }

      const reclamosExcel = rows.map(row => ({
        ciclo: row[columnMap['CICLO']] || '',
        contrato: row[columnMap['CONTRATO']] || '',
        telecomunicaciones: row[columnMap['TELECOMUNICACIONES']] || '',
        servicios_publicos: row[columnMap['SERVICIOS PUBLICOS']] || '',
        nombre: row[columnMap['NOMBRE']] || '',
        contacto: row[columnMap['CONTACTO']] || '',
        direccion_reclamo: row[columnMap['DIRECCION DEL RECLAMO']] || '',
        ruta: row[columnMap['RUTA']] || '',
        consecutivos: row[columnMap['CONSECUTIVOS']] || '',
        digital: row[columnMap['DIGITAL']] || '',
        medio_recepcion: row[columnMap['MEDIO DE RECEPCION RECLAMO']] || '',
        motivo: row[columnMap['Motivo']] || '',
        gestion: row[columnMap['GESTION']] || '',
        observacion_reclamo: row[columnMap['OBSERVACION RECLAMO']] || '',
        causal: row[columnMap['CAUSAL']] || '',
        gestion_realizada: row[columnMap['GESTION REALIZADA']] || '',
        justificacion: row[columnMap['JUSTIFICACION']] || '',
        fecha_reclamo: obtenerFechaColombia()
      }))

      setExcelData(reclamosExcel)
      setExcelPreview(reclamosExcel.slice(0, 5))
      setShowExcelModal(true)
    }
    reader.readAsArrayBuffer(file)
  }

  async function guardarExcel() {
    try {
      setLoading(true)
      const user = (await supabase.auth.getUser()).data.user
      
      const reclamosParaGuardar = excelData.map(r => ({
        ...r,
        creado_por_id: user?.id,
        creado_por_nombre: user?.email
      }))

      const { error } = await supabase
        .from('reclamos')
        .insert(reclamosParaGuardar)

      if (error) throw error

      setShowExcelModal(false)
      setExcelData([])
      setExcelPreview([])
      
      await cargarReclamos()
      await cargarEstadisticas()
      
      alert(`✅ ${reclamosParaGuardar.length} reclamos cargados exitosamente`)
    } catch (error) {
      console.error('Error guardando Excel:', error)
      alert('Error al guardar los reclamos desde Excel')
    } finally {
      setLoading(false)
    }
  }

  function editarReclamo(reclamo) {
    setFormData(reclamo)
    setEditingId(reclamo.id)
    setShowForm(true)
  }

  async function eliminarReclamo(id) {
    if (!confirm('¿Estás seguro de eliminar este reclamo?')) return
    
    try {
      setLoading(true)
      const { error } = await supabase
        .from('reclamos')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      await cargarReclamos()
      await cargarEstadisticas()
      alert('Reclamo eliminado')
    } catch (error) {
      console.error('Error eliminando reclamo:', error)
      alert('Error al eliminar el reclamo')
    } finally {
      setLoading(false)
    }
  }

  const resetFilters = () => {
    setFilters({
      fecha_desde: '',
      fecha_hasta: '',
      ciclo: '',
      nombre: ''
    })
    setPage(1)
  }

  return (
    <div className="page">
      <header className="topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>Reclamos de Reparto</h1>
        {rol === 'admin' && <span className="user-role">Admin</span>}
      </header>

      {/* Tarjetas de resumen */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#dbeafe' }}>⚠️</div>
          <div className="stat-info">
            <div className="stat-label">Total Reclamos</div>
            <div className="stat-value">{stats.total}</div>
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
              telecomunicaciones: '',
              servicios_publicos: '',
              nombre: '',
              contacto: '',
              direccion_reclamo: '',
              ruta: '',
              consecutivos: '',
              digital: '',
              medio_recepcion: '',
              motivo: '',
              gestion: '',
              observacion_reclamo: '',
              causal: '',
              gestion_realizada: '',
              justificacion: '',
              fecha_reclamo: obtenerFechaColombia()
            })
            setEditingId(null)
            setShowForm(true)
          }}
        >
          + Nuevo Reclamo
        </button>
      </div>

      {/* Modal de estadísticas */}
      {showStatsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 1200, maxHeight: '90vh' }}>
            <div className="modal-header">
              <h2>📊 Estadísticas de Reclamos</h2>
              <button className="close-btn" onClick={() => setShowStatsModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <div className="charts-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                
                {/* Gráfico por día */}
                <div className="dashboard-card">
                  <h3>📅 Reclamos por Día (últimos 30 días)</h3>
                  <div style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.porDia}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={formatearNumero} />
                        <Tooltip formatter={(value) => formatearNumero(value)} />
                        <Legend />
                        <Line type="monotone" dataKey="cantidad" stroke="#ef4444" strokeWidth={2}>
                          <LabelList dataKey="cantidad" position="top" formatter={formatearNumero} />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico por mes */}
                <div className="dashboard-card">
                  <h3>📊 Reclamos por Mes</h3>
                  <div style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.porMes}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={formatearNumero} />
                        <Tooltip formatter={(value) => formatearNumero(value)} />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#f97316" radius={[4, 4, 0, 0]}>
                          <LabelList dataKey="cantidad" position="top" formatter={formatearNumero} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico de motivos */}
                <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
                  <h3>🔍 Principales Motivos de Reclamo</h3>
                  <div style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.porMotivo} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={formatearNumero} />
                        <YAxis dataKey="motivo" type="category" width={150} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value) => formatearNumero(value)} />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#3b82f6" radius={[0, 4, 4, 0]}>
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

      {/* Modal de Excel */}
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
                      <th>Nombre</th>
                      <th>Motivo</th>
                      <th>Medio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelPreview.map((r, idx) => (
                      <tr key={idx}>
                        <td>{r.ciclo}</td>
                        <td>{r.nombre}</td>
                        <td>{r.motivo}</td>
                        <td>{r.medio_recepcion}</td>
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
                {loading ? 'Cargando...' : `Cargar ${excelData.length} reclamos`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulario de reclamo */}
      {showForm && (
        <div className="form-modal">
          <div className="form-modal-content">
            <div className="form-modal-header">
              <h2>{editingId ? 'Editar Reclamo' : 'Nuevo Reclamo'}</h2>
              <button className="close-btn" onClick={() => setShowForm(false)}>✕</button>
            </div>
            
            <div className="form-modal-body">
              <div className="form-tabs">
                <div className="tab active">Información General</div>
                <div className="tab">Detalles del Reclamo</div>
                <div className="tab">Gestión</div>
              </div>

              <div className="form-section">
                <h3>📋 Información del Cliente</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Fecha del Reclamo</label>
                    <input 
                      type="date"
                      value={formData.fecha_reclamo}
                      onChange={e => setFormData({...formData, fecha_reclamo: e.target.value})}
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
                    <label>Nombre *</label>
                    <input 
                      type="text"
                      required
                      value={formData.nombre}
                      onChange={e => setFormData({...formData, nombre: e.target.value})}
                      placeholder="Nombre del reclamante"
                    />
                  </div>

                  <div className="form-group">
                    <label>Contacto</label>
                    <input 
                      type="text"
                      value={formData.contacto}
                      onChange={e => setFormData({...formData, contacto: e.target.value})}
                      placeholder="Teléfono / Email"
                    />
                  </div>

                  <div className="form-group">
                    <label>Dirección del Reclamo</label>
                    <input 
                      type="text"
                      value={formData.direccion_reclamo}
                      onChange={e => setFormData({...formData, direccion_reclamo: e.target.value})}
                      placeholder="Dirección"
                    />
                  </div>

                  <div className="form-group">
                    <label>Ruta</label>
                    <input 
                      type="text"
                      value={formData.ruta}
                      onChange={e => setFormData({...formData, ruta: e.target.value})}
                      placeholder="Ruta"
                    />
                  </div>

                  <div className="form-group">
                    <label>Consecutivos</label>
                    <input 
                      type="text"
                      value={formData.consecutivos}
                      onChange={e => setFormData({...formData, consecutivos: e.target.value})}
                      placeholder="Consecutivos"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>📦 Servicios</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Telecomunicaciones</label>
                    <select 
                      value={formData.telecomunicaciones}
                      onChange={e => setFormData({...formData, telecomunicaciones: e.target.value})}
                    >
                      <option value="">Seleccionar</option>
                      <option value="Sí">Sí</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Servicios Públicos</label>
                    <select 
                      value={formData.servicios_publicos}
                      onChange={e => setFormData({...formData, servicios_publicos: e.target.value})}
                    >
                      <option value="">Seleccionar</option>
                      <option value="Sí">Sí</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Digital</label>
                    <input 
                      type="text"
                      value={formData.digital}
                      onChange={e => setFormData({...formData, digital: e.target.value})}
                      placeholder="Digital"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>⚠️ Detalles del Reclamo</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Medio de Recepción</label>
                    <select 
                      value={formData.medio_recepcion}
                      onChange={e => setFormData({...formData, medio_recepcion: e.target.value})}
                    >
                      <option value="">Seleccionar</option>
                      {MEDIOS_RECEPCION.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Motivo</label>
                    <select 
                      value={formData.motivo}
                      onChange={e => setFormData({...formData, motivo: e.target.value})}
                    >
                      <option value="">Seleccionar</option>
                      {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Observación del Reclamo</label>
                    <textarea 
                      value={formData.observacion_reclamo}
                      onChange={e => setFormData({...formData, observacion_reclamo: e.target.value})}
                      rows="3"
                      placeholder="Describa el reclamo..."
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>✅ Gestión del Reclamo</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Gestión</label>
                    <input 
                      type="text"
                      value={formData.gestion}
                      onChange={e => setFormData({...formData, gestion: e.target.value})}
                      placeholder="Tipo de gestión"
                    />
                  </div>

                  <div className="form-group">
                    <label>Causal</label>
                    <select 
                      value={formData.causal}
                      onChange={e => setFormData({...formData, causal: e.target.value})}
                    >
                      <option value="">Seleccionar</option>
                      {CAUSALES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Gestión Realizada</label>
                    <input 
                      type="text"
                      value={formData.gestion_realizada}
                      onChange={e => setFormData({...formData, gestion_realizada: e.target.value})}
                      placeholder="Gestión realizada"
                    />
                  </div>

                  <div className="form-group">
                    <label>Justificación</label>
                    <textarea 
                      value={formData.justificacion}
                      onChange={e => setFormData({...formData, justificacion: e.target.value})}
                      rows="3"
                      placeholder="Justificación..."
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="form-modal-footer">
              <button className="secondary-btn" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button className="primary-btn" onClick={guardarReclamo} disabled={loading}>
                {loading ? 'Guardando...' : (editingId ? 'Actualizar Reclamo' : 'Guardar Reclamo')}
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
          placeholder="Nombre"
          value={filters.nombre}
          onChange={e => setFilters({...filters, nombre: e.target.value, page: 1})}
        />
        <button onClick={resetFilters}>Limpiar</button>
      </div>

      {/* Tabla de reclamos */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Ciclo</th>
              <th>Nombre</th>
              <th>Motivo</th>
              <th>Medio</th>
              <th>Causal</th>
              <th>Gestión</th>
              {rol === 'admin' && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {reclamos.map(r => (
              <tr key={r.id}>
                <td>{new Date(r.fecha_reclamo).toLocaleDateString()}</td>
                <td>{r.ciclo || '-'}</td>
                <td>{r.nombre}</td>
                <td>{r.motivo || '-'}</td>
                <td>{r.medio_recepcion || '-'}</td>
                <td>
                  <span className={`badge ${r.causal === 'No aplica' ? 'success' : 'warning'}`}>
                    {r.causal || '-'}
                  </span>
                </td>
                <td>{r.gestion || '-'}</td>
                {rol === 'admin' && (
                  <td>
                    <button 
                      className="icon-btn" 
                      onClick={() => editarReclamo(r)}
                      style={{ marginRight: 8 }}
                    >
                      ✏️
                    </button>
                    <button 
                      className="icon-btn" 
                      onClick={() => eliminarReclamo(r.id)}
                    >
                      🗑️
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {reclamos.length === 0 && (
              <tr>
                <td colSpan={rol === 'admin' ? 8 : 7} style={{ textAlign: 'center', padding: 40 }}>
                  No hay reclamos registrados
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