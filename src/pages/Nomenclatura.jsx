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
  PieChart,
  Pie,
  Cell,
  LabelList
} from 'recharts'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import '../index.css'

const PAGE_SIZE = 10

const TIPOS = ['Asignacion', 'Certificacion']
const COLORS_TIPO = ['#3b82f6', '#f59e0b'] // Azul, Naranja

// Función para formatear números
const formatearNumero = (num) => new Intl.NumberFormat('es-CO').format(num || 0)

// Función para obtener fecha actual de Colombia
const obtenerFechaColombia = () => {
  const ahora = new Date()
  const colombia = new Date(ahora.getTime() - (5 * 60 * 60 * 1000))
  const año = colombia.getFullYear()
  const mes = String(colombia.getMonth() + 1).padStart(2, '0')
  const dia = String(colombia.getDate()).padStart(2, '0')
  return `${año}-${mes}-${dia}`
}

export default function Nomenclatura({ onBack, rol }) {
  const [items, setItems] = useState([])
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
    porTipo: []
  })
  const [filters, setFilters] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    tipo: '',
    zona: '',
    ciclo: ''
  })
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Formulario
  const [formData, setFormData] = useState({
    fecha_recepcion: obtenerFechaColombia(),
    tipo: '',
    zona_visitar: '',
    fecha_visita: '',
    nombres_solicitante: '',
    cedula: '',
    lugar_expedicion: '',
    telefono: '',
    documento: '',
    contrato_vecino: '',
    ruta_consecutivo: '',
    ciclo: '',
    direccion_asignada: '',
    tipo_soporte: '',
    nota: ''
  })

  useEffect(() => {
    cargarItems()
    cargarEstadisticas()
  }, [filters, page])

  async function cargarItems() {
    setLoading(true)
    try {
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('nomenclatura')
        .select('*', { count: 'exact' })
        .order('fecha_recepcion', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filters.fecha_desde) query = query.gte('fecha_recepcion', filters.fecha_desde)
      if (filters.fecha_hasta) query = query.lte('fecha_recepcion', filters.fecha_hasta)
      if (filters.tipo) query = query.eq('tipo', filters.tipo)
      if (filters.zona) query = query.ilike('zona_visitar', `%${filters.zona}%`)
      if (filters.ciclo) query = query.ilike('ciclo', `%${filters.ciclo}%`)

      const { data, count, error } = await query
      if (error) throw error
      setItems(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error cargando nomenclatura:', error)
    } finally {
      setLoading(false)
    }
  }

  async function cargarEstadisticas() {
    try {
      // Por día (últimos 30)
      const fechaLimite = new Date()
      fechaLimite.setDate(fechaLimite.getDate() - 30)
      const { data: datosDia } = await supabase
        .from('nomenclatura')
        .select('fecha_recepcion')
        .gte('fecha_recepcion', fechaLimite.toISOString().split('T')[0])
      const porDia = {}
      datosDia?.forEach(r => { porDia[r.fecha_recepcion] = (porDia[r.fecha_recepcion] || 0) + 1 })

      // Por mes (últimos 12)
      const { data: datosMes } = await supabase.from('nomenclatura').select('fecha_recepcion')
      const porMes = {}
      const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
      datosMes?.forEach(r => {
        const fecha = new Date(r.fecha_recepcion)
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}`
        const label = `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`
        if (!porMes[key]) porMes[key] = { mes: label, cantidad: 0, key }
        porMes[key].cantidad++
      })

      // Por tipo
      const { data: datosTipo } = await supabase
        .from('nomenclatura')
        .select('tipo')
        .not('tipo', 'is', null)
      const porTipo = {}
      datosTipo?.forEach(r => { porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1 })

      // Total
      const { count } = await supabase
        .from('nomenclatura')
        .select('*', { count: 'exact', head: true })

      setStats({
        total: count || 0,
        porDia: Object.entries(porDia).map(([fecha, c]) => ({ fecha, cantidad: c })),
        porMes: Object.values(porMes).sort((a,b) => a.key.localeCompare(b.key)).slice(-12),
        porTipo: Object.entries(porTipo).map(([tipo, c]) => ({ tipo, cantidad: c }))
      })
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

  const exportarExcel = async () => {
    try {
      setExporting(true)
      let query = supabase.from('nomenclatura').select('*').order('fecha_recepcion', { ascending: false })
      if (filters.fecha_desde) query = query.gte('fecha_recepcion', filters.fecha_desde)
      if (filters.fecha_hasta) query = query.lte('fecha_recepcion', filters.fecha_hasta)
      if (filters.tipo) query = query.eq('tipo', filters.tipo)
      if (filters.zona) query = query.ilike('zona_visitar', `%${filters.zona}%`)
      if (filters.ciclo) query = query.ilike('ciclo', `%${filters.ciclo}%`)

      const { data, error } = await query
      if (error) throw error

      const excelRows = data.map(r => ({
        'Fecha Recepción': r.fecha_recepcion,
        'Tipo': r.tipo,
        'Zona a Visitar': r.zona_visitar,
        'Fecha Visita': r.fecha_visita,
        'Nombres Solicitante': r.nombres_solicitante,
        'Cédula': r.cedula,
        'Lugar Expedición': r.lugar_expedicion,
        'Teléfono': r.telefono,
        'Documento': r.documento,
        'Contrato Vecino': r.contrato_vecino,
        'Ruta/Consecutivo': r.ruta_consecutivo,
        'Ciclo': r.ciclo,
        'Dirección Asignada': r.direccion_asignada,
        'Tipo Soporte': r.tipo_soporte,
        'Nota': r.nota,
        'Creado': new Date(r.created_at).toLocaleString('es-CO'),
        'Creado Por': r.creado_por_nombre || ''
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelRows)
      ws['!cols'] = [
        { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 30 },
        { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 15 },
        { wch: 18 }, { wch: 8 }, { wch: 30 }, { wch: 20 }, { wch: 30 },
        { wch: 20 }, { wch: 25 }
      ]
      XLSX.utils.book_append_sheet(wb, ws, 'Nomenclatura')

      let nombre = 'nomenclatura'
      if (filters.fecha_desde || filters.fecha_hasta) nombre += `_${filters.fecha_desde || 'inicio'}_${filters.fecha_hasta || 'fin'}`
      if (filters.tipo) nombre += `_${filters.tipo}`
      nombre += '.xlsx'

      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      saveAs(new Blob([buffer]), nombre)
      alert(`✅ ${data.length} registros exportados`)
    } catch (error) {
      console.error('Error exportando:', error)
      alert('Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  async function guardarItem() {
    if (!formData.nombres_solicitante) {
      alert('El nombre del solicitante es obligatorio')
      return
    }
    setLoading(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      const data = { ...formData, creado_por_id: user?.id, creado_por_nombre: user?.email }
      let error
      if (editingId) {
        ({ error } = await supabase.from('nomenclatura').update(data).eq('id', editingId))
      } else {
        ({ error } = await supabase.from('nomenclatura').insert([data]))
      }
      if (error) throw error

      setFormData({
        fecha_recepcion: obtenerFechaColombia(),
        tipo: '', zona_visitar: '', fecha_visita: '', nombres_solicitante: '',
        cedula: '', lugar_expedicion: '', telefono: '', documento: '',
        contrato_vecino: '', ruta_consecutivo: '', ciclo: '',
        direccion_asignada: '', tipo_soporte: '', nota: ''
      })
      setEditingId(null)
      setShowForm(false)
      await cargarItems()
      await cargarEstadisticas()
      alert(editingId ? 'Actualizado' : 'Guardado')
    } catch (error) {
      console.error('Error guardando:', error)
      alert('Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  // Carga desde Excel
  const cargarExcel = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target.result)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
      const dataRows = rows.slice(1).filter(r => r.some(cell => cell))

      const colMap = {
        'FECHA RECEPCION': 0,
        'TIPO': 1,
        'ZONA A VISITAR': 2,
        'FECHA VISITA': 3,
        'NOMBRES SOLICITANTE': 4,
        'CEDULA': 5,
        'LUGAR EXPEDICION': 6,
        'TELEFONO': 7,
        'DOCUMENTO': 8,
        'CONTRATO VECINO': 9,
        'RUTA/CONSECUTIVO': 10,
        'CICLO': 11,
        'DIRECCION ASIGNADA': 12,
        'TIPO SOPORTE': 13,
        'NOTA': 14
      }

      const parsed = dataRows.map(row => ({
        fecha_recepcion: row[colMap['FECHA RECEPCION']] || obtenerFechaColombia(),
        tipo: row[colMap['TIPO']] || '',
        zona_visitar: row[colMap['ZONA A VISITAR']] || '',
        fecha_visita: row[colMap['FECHA VISITA']] || '',
        nombres_solicitante: row[colMap['NOMBRES SOLICITANTE']] || '',
        cedula: row[colMap['CEDULA']] || '',
        lugar_expedicion: row[colMap['LUGAR EXPEDICION']] || '',
        telefono: row[colMap['TELEFONO']] || '',
        documento: row[colMap['DOCUMENTO']] || '',
        contrato_vecino: row[colMap['CONTRATO VECINO']] || '',
        ruta_consecutivo: row[colMap['RUTA/CONSECUTIVO']] || '',
        ciclo: row[colMap['CICLO']] || '',
        direccion_asignada: row[colMap['DIRECCION ASIGNADA']] || '',
        tipo_soporte: row[colMap['TIPO SOPORTE']] || '',
        nota: row[colMap['NOTA']] || ''
      }))

      setExcelData(parsed)
      setExcelPreview(parsed.slice(0,5))
      setShowExcelModal(true)
    }
    reader.readAsArrayBuffer(file)
  }

  async function guardarExcel() {
    setLoading(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      const toInsert = excelData.map(r => ({
        ...r,
        creado_por_id: user?.id,
        creado_por_nombre: user?.email
      }))
      const { error } = await supabase.from('nomenclatura').insert(toInsert)
      if (error) throw error
      setShowExcelModal(false)
      setExcelData([])
      setExcelPreview([])
      await cargarItems()
      await cargarEstadisticas()
      alert(`✅ ${toInsert.length} registros cargados`)
    } catch (error) {
      console.error('Error guardando Excel:', error)
      alert('Error al cargar Excel')
    } finally {
      setLoading(false)
    }
  }

  function editar(item) {
    setFormData(item)
    setEditingId(item.id)
    setShowForm(true)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este registro?')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('nomenclatura').delete().eq('id', id)
      if (error) throw error
      await cargarItems()
      await cargarEstadisticas()
      alert('Eliminado')
    } catch (error) {
      console.error('Error eliminando:', error)
      alert('Error al eliminar')
    } finally {
      setLoading(false)
    }
  }

  const resetFilters = () => {
    setFilters({ fecha_desde: '', fecha_hasta: '', tipo: '', zona: '', ciclo: '' })
    setPage(1)
  }

  return (
    <div className="page">
      <header className="topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>Asignación de Nomenclatura</h1>
        {rol === 'admin' && <span className="user-role">Admin</span>}
      </header>

      {/* Tarjetas de resumen */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#e0f2fe' }}>🏷️</div>
          <div className="stat-info">
            <div className="stat-label">Total Solicitudes</div>
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
          <input type="file" accept=".xlsx,.xls,.csv" onChange={cargarExcel} style={{ display: 'none' }} disabled={exporting} />
        </label>
        <button className="action-btn success" onClick={exportarExcel} disabled={exporting || loading}>
          {exporting ? '⏳ Exportando...' : '📊 Exportar Excel'}
        </button>
        <button className="action-btn primary" onClick={() => { setFormData({ ...formData, fecha_recepcion: obtenerFechaColombia() }); setEditingId(null); setShowForm(true); }}>
          + Nueva Solicitud
        </button>
      </div>

      {/* Modal de estadísticas */}
      {showStatsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 1200, maxHeight: '90vh' }}>
            <div className="modal-header">
              <h2>📊 Estadísticas de Nomenclatura</h2>
              <button className="close-btn" onClick={() => setShowStatsModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <div className="charts-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                
                {/* Línea por día */}
                <div className="dashboard-card">
                  <h3>📅 Solicitudes por Día (últimos 30)</h3>
                  <div style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.porDia}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={formatearNumero} />
                        <Tooltip formatter={(value) => formatearNumero(value)} />
                        <Legend />
                        <Line type="monotone" dataKey="cantidad" stroke="#3b82f6" strokeWidth={2}>
                          <LabelList dataKey="cantidad" position="top" formatter={formatearNumero} />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Barras por mes */}
                <div className="dashboard-card">
                  <h3>📊 Solicitudes por Mes</h3>
                  <div style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.porMes}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={formatearNumero} />
                        <Tooltip formatter={(value) => formatearNumero(value)} />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#f59e0b" radius={[4,4,0,0]}>
                          <LabelList dataKey="cantidad" position="top" formatter={formatearNumero} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pastel por tipo */}
                <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
                  <h3>🥧 Distribución por Tipo</h3>
                  <div style={{ height: 250, display: 'flex', justifyContent: 'center' }}>
                    <ResponsiveContainer width="70%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.porTipo}
                          cx="50%" cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          dataKey="cantidad"
                          nameKey="tipo"
                          label={entry => entry.tipo}
                        >
                          {stats.porTipo.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS_TIPO[index % COLORS_TIPO.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatearNumero(value)} />
                      </PieChart>
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

      {/* Modal de vista previa Excel */}
      {showExcelModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h2>Vista previa carga Excel</h2>
              <button className="close-btn" onClick={() => setShowExcelModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p><strong>{excelData.length}</strong> registros a cargar</p>
              <div className="table-container" style={{ maxHeight: 300, overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr><th>Nombre</th><th>Cédula</th><th>Tipo</th><th>Ciclo</th></tr>
                  </thead>
                  <tbody>
                    {excelPreview.map((r,i) => (
                      <tr key={i}><td>{r.nombres_solicitante}</td><td>{r.cedula}</td><td>{r.tipo}</td><td>{r.ciclo}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-btn" onClick={() => setShowExcelModal(false)}>Cancelar</button>
              <button className="primary-btn" onClick={guardarExcel} disabled={loading}>
                {loading ? 'Cargando...' : `Cargar ${excelData.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulario modal */}
      {showForm && (
        <div className="form-modal">
          <div className="form-modal-content">
            <div className="form-modal-header">
              <h2>{editingId ? 'Editar Solicitud' : 'Nueva Solicitud'}</h2>
              <button className="close-btn" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="form-modal-body">
              <div className="form-section">
                <h3>📋 Datos de la Solicitud</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Fecha Recepción *</label>
                    <input type="date" value={formData.fecha_recepcion} onChange={e => setFormData({...formData, fecha_recepcion: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Tipo *</label>
                    <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}>
                      <option value="">Seleccionar</option>
                      {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Zona a Visitar</label>
                    <input type="text" value={formData.zona_visitar} onChange={e => setFormData({...formData, zona_visitar: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Fecha Visita (opcional)</label>
                    <input type="date" value={formData.fecha_visita} onChange={e => setFormData({...formData, fecha_visita: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Nombres y Apellidos *</label>
                    <input type="text" value={formData.nombres_solicitante} onChange={e => setFormData({...formData, nombres_solicitante: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Cédula</label>
                    <input type="text" value={formData.cedula} onChange={e => setFormData({...formData, cedula: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Lugar Expedición</label>
                    <input type="text" value={formData.lugar_expedicion} onChange={e => setFormData({...formData, lugar_expedicion: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Teléfono</label>
                    <input type="text" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Documento (Texto Libre)</label>
                    <textarea rows="2" value={formData.documento} onChange={e => setFormData({...formData, documento: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Contrato Vecino</label>
                    <input type="text" value={formData.contrato_vecino} onChange={e => setFormData({...formData, contrato_vecino: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Ruta/Consecutivo</label>
                    <input type="text" value={formData.ruta_consecutivo} onChange={e => setFormData({...formData, ruta_consecutivo: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Ciclo</label>
                    <input type="text" value={formData.ciclo} onChange={e => setFormData({...formData, ciclo: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Dirección Asignada</label>
                    <input type="text" value={formData.direccion_asignada} onChange={e => setFormData({...formData, direccion_asignada: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Tipo de Soporte</label>
                    <input type="text" value={formData.tipo_soporte} onChange={e => setFormData({...formData, tipo_soporte: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Nota</label>
                    <textarea rows="2" value={formData.nota} onChange={e => setFormData({...formData, nota: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>
            <div className="form-modal-footer">
              <button className="secondary-btn" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="primary-btn" onClick={guardarItem} disabled={loading}>
                {loading ? 'Guardando...' : (editingId ? 'Actualizar' : 'Guardar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="search-panel">
        <input type="date" placeholder="Fecha desde" value={filters.fecha_desde} onChange={e => setFilters({...filters, fecha_desde: e.target.value, page:1})} />
        <input type="date" placeholder="Fecha hasta" value={filters.fecha_hasta} onChange={e => setFilters({...filters, fecha_hasta: e.target.value, page:1})} />
        <select value={filters.tipo} onChange={e => setFilters({...filters, tipo: e.target.value, page:1})}>
          <option value="">Todos los tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="text" placeholder="Zona" value={filters.zona} onChange={e => setFilters({...filters, zona: e.target.value, page:1})} />
        <input type="text" placeholder="Ciclo" value={filters.ciclo} onChange={e => setFilters({...filters, ciclo: e.target.value, page:1})} />
        <button onClick={resetFilters}>Limpiar</button>
      </div>

      {/* Tabla de resultados */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Fecha Recep.</th><th>Tipo</th><th>Zona</th><th>Nombre</th><th>Cédula</th><th>Ciclo</th><th>Dirección</th>
              {rol === 'admin' && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>{item.fecha_recepcion}</td>
                <td><span className="badge" style={{ background: item.tipo === 'Asignacion' ? '#dbeafe' : '#fed7aa' }}>{item.tipo}</span></td>
                <td>{item.zona_visitar}</td>
                <td>{item.nombres_solicitante}</td>
                <td>{item.cedula}</td>
                <td>{item.ciclo}</td>
                <td>{item.direccion_asignada}</td>
                {rol === 'admin' && (
                  <td>
                    <button className="icon-btn" onClick={() => editar(item)} style={{ marginRight:8 }}>✏️</button>
                    <button className="icon-btn" onClick={() => eliminar(item.id)}>🗑️</button>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={rol==='admin'?8:7} style={{textAlign:'center', padding:40}}>No hay registros</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalCount > PAGE_SIZE && (
        <div className="pagination">
          <button disabled={page===1} onClick={() => setPage(p=>p-1)}>← Anterior</button>
          <span>Página {page} de {Math.ceil(totalCount/PAGE_SIZE)}</span>
          <button disabled={page>=Math.ceil(totalCount/PAGE_SIZE)} onClick={() => setPage(p=>p+1)}>Siguiente →</button>
        </div>
      )}
    </div>
  )
}