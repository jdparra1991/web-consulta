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
  LabelList
} from 'recharts'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import '../index.css'

const PAGE_SIZE = 10
const COLORS = ['#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#a855f7']

// Lista de resultados digitales
const RESULTADOS_DIGITALES = [
  { id: 'buzones_inactivo', nombre: 'Buzón inactivo' },
  { id: 'buzones_lleno', nombre: 'Buzón lleno' },
  { id: 'buzones_no_existe', nombre: 'Buzón no existe' },
  { id: 'correo_mal_escrito', nombre: 'Correo mal escrito' },
  { id: 'dominio_no_existe', nombre: 'Dominio no existe' },
  { id: 'enviados', nombre: 'Enviados' },
  { id: 'rechazado_varios_intentos', nombre: 'Rechazado varios intentos' },
  { id: 'reporta_spam', nombre: 'Reporta como spam' },
  { id: 'sin_adjunto', nombre: 'Sin adjunto' },
  { id: 'servidor_destino_no_responde', nombre: 'Servidor destino no responde' },
]

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

// Obtener primer día del mes actual
const obtenerInicioMes = () => {
  const ahora = new Date()
  const colombia = new Date(ahora.getTime() - (5 * 60 * 60 * 1000))
  const año = colombia.getFullYear()
  const mes = String(colombia.getMonth() + 1).padStart(2, '0')
  return `${año}-${mes}-01`
}

// Obtener último día del mes actual
const obtenerFinMes = () => {
  const ahora = new Date()
  const colombia = new Date(ahora.getTime() - (5 * 60 * 60 * 1000))
  const año = colombia.getFullYear()
  const mes = colombia.getMonth() + 1
  const ultimoDia = new Date(año, mes, 0).getDate()
  return `${año}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
}

export default function ResultadosDigitales({ onBack, rol }) {
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
    totalRegistros: 0,
    porCiclo: [],
    porMes: [],
    porResultado: []
  })
  const [filters, setFilters] = useState({
    fecha_desde: obtenerInicioMes(),
    fecha_hasta: obtenerFinMes(),
    ciclo: ''
  })
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Formulario
  const [formData, setFormData] = useState({
    ciclo_id: '',
    mes_trabajo: obtenerFechaColombia(),
    buzones_inactivo: 0,
    buzones_lleno: 0,
    buzones_no_existe: 0,
    correo_mal_escrito: 0,
    dominio_no_existe: 0,
    enviados: 0,
    rechazado_varios_intentos: 0,
    reporta_spam: 0,
    sin_adjunto: 0,
    servidor_destino_no_responde: 0
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
        .from('resultados_digitales')
        .select('*', { count: 'exact' })
        .order('mes_trabajo', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filters.fecha_desde) query = query.gte('mes_trabajo', filters.fecha_desde)
      if (filters.fecha_hasta) query = query.lte('mes_trabajo', filters.fecha_hasta)
      if (filters.ciclo) query = query.eq('ciclo_id', parseInt(filters.ciclo))

      const { data, count, error } = await query
      if (error) throw error
      setItems(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error cargando resultados digitales:', error)
    } finally {
      setLoading(false)
    }
  }

  async function cargarEstadisticas() {
    try {
      // Datos del período filtrado
      let query = supabase
        .from('resultados_digitales')
        .select('ciclo_id, mes_trabajo, ' + RESULTADOS_DIGITALES.map(r => r.id).join(','))
        .gte('mes_trabajo', filters.fecha_desde)
        .lte('mes_trabajo', filters.fecha_hasta)

      if (filters.ciclo) query = query.eq('ciclo_id', parseInt(filters.ciclo))

      const { data, error } = await query
      if (error) throw error

      const porCiclo = {}
      const porResultado = {}
      RESULTADOS_DIGITALES.forEach(r => porResultado[r.id] = 0)

      data?.forEach(r => {
        // Por ciclo (suma de todos los resultados)
        if (r.ciclo_id) {
          const suma = RESULTADOS_DIGITALES.reduce((acc, res) => acc + (r[res.id] || 0), 0)
          porCiclo[r.ciclo_id] = (porCiclo[r.ciclo_id] || 0) + suma
        }

        // Por tipo de resultado
        RESULTADOS_DIGITALES.forEach(res => {
          porResultado[res.id] += r[res.id] || 0
        })
      })

      setStats({
        totalRegistros: data?.length || 0,
        porCiclo: Object.entries(porCiclo).map(([c, v]) => ({ ciclo: c, cantidad: v })),
        porResultado: RESULTADOS_DIGITALES.map(r => ({ nombre: r.nombre, cantidad: porResultado[r.id] })),
        porMes: [] // opcional, se puede agregar más adelante
      })
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

const descargarPlantilla = () => {
  const wb = XLSX.utils.book_new();

  // --- Hoja 1: Instructivo (estático) ---
  const instructivo = [
    ['INSTRUCTIVO PARA CARGA DE RESULTADOS DIGITALES'],
    [''],
    ['1. FORMATO DE FECHAS:'],
    ['   • mes_trabajo debe estar en formato YYYY-MM-DD (ej: 2026-02-01).'],
    ['   • La fecha debe corresponder al primer día del mes de vigencia (siempre día 01).'],
    [''],
    ['2. CAMPOS NUMÉRICOS:'],
    ['   • Todos los campos de resultados deben ser números enteros (sin decimales).'],
    ['   • Si no hay registros para un resultado, colocar 0 o dejar la celda vacía (se interpretará como 0).'],
    [''],
    ['3. COLUMNAS (respetar este orden):'],
    ['   • Columna A: ciclo_id (número entero)'],
    ['   • Columna B: mes_trabajo (fecha en formato YYYY-MM-DD)'],
    ['   • Columna C: buzones_inactivo'],
    ['   • Columna D: buzones_lleno'],
    ['   • Columna E: buzones_no_existe'],
    ['   • Columna F: correo_mal_escrito'],
    ['   • Columna G: dominio_no_existe'],
    ['   • Columna H: enviados'],
    ['   • Columna I: rechazado_varios_intentos'],
    ['   • Columna J: reporta_spam'],
    ['   • Columna K: sin_adjunto'],
    ['   • Columna L: servidor_destino_no_responde'],
    [''],
    ['4. IMPORTANTE:'],
    ['   • La combinación ciclo_id + mes_trabajo debe ser única.'],
    ['   • Si ya existe un registro con el mismo ciclo y mes, se actualizarán solo los campos incluidos en el archivo.'],
    ['   • Los campos no incluidos conservarán su valor anterior.'],
    [''],
    ['5. EJEMPLO:'],
    ['   • Ver la hoja "Ejemplo" para una muestra de datos correctos.'],
  ];
  const wsInstructivo = XLSX.utils.aoa_to_sheet(instructivo);
  wsInstructivo['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInstructivo, 'Instructivo');

  // --- Hoja 2: Ejemplo con datos (usando RESULTADOS_DIGITALES) ---
  const ejemploHeader = ['ciclo_id', 'mes_trabajo', ...RESULTADOS_DIGITALES.map(r => r.id)];
  const ejemploData = [
    ['40', '2026-02-01', '5', '2', '1', '0', '3', '120', '4', '2', '1', '0'],
    ['42', '2026-02-01', '2', '1', '0', '1', '2', '85', '1', '0', '1', '1'],
    ['45', '2026-02-01', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
  ];
  const wsEjemplo = XLSX.utils.aoa_to_sheet([ejemploHeader, ...ejemploData]);
  wsEjemplo['!cols'] = [
    { wch: 10 }, // ciclo_id
    { wch: 12 }, // mes_trabajo
    ...RESULTADOS_DIGITALES.map(() => ({ wch: 15 }))
  ];
  XLSX.utils.book_append_sheet(wb, wsEjemplo, 'Ejemplo');

  // --- Hoja 3: Plantilla vacía (solo encabezados) ---
  const wsPlantilla = XLSX.utils.aoa_to_sheet([ejemploHeader]);
  wsPlantilla['!cols'] = wsEjemplo['!cols'];
  XLSX.utils.book_append_sheet(wb, wsPlantilla, 'Plantilla');

  XLSX.writeFile(wb, 'plantilla_resultados_digitales.xlsx');
};

  // Exportar datos actuales a Excel
  const exportarExcel = async () => {
    try {
      setExporting(true)
      let query = supabase.from('resultados_digitales').select('*').order('mes_trabajo', { ascending: false })
      if (filters.fecha_desde) query = query.gte('mes_trabajo', filters.fecha_desde)
      if (filters.fecha_hasta) query = query.lte('mes_trabajo', filters.fecha_hasta)
      if (filters.ciclo) query = query.eq('ciclo_id', parseInt(filters.ciclo))

      const { data, error } = await query
      if (error) throw error

      const excelRows = data.map(r => ({
        'Ciclo ID': r.ciclo_id,
        'Mes Trabajo': r.mes_trabajo,
        ...RESULTADOS_DIGITALES.reduce((acc, res) => ({ ...acc, [res.nombre]: r[res.id] }), {})
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelRows)
      XLSX.utils.book_append_sheet(wb, ws, 'ResultadosDigitales')

      let nombre = 'resultados_digitales'
      if (filters.fecha_desde || filters.fecha_hasta) nombre += `_${filters.fecha_desde || 'inicio'}_${filters.fecha_hasta || 'fin'}`
      if (filters.ciclo) nombre += `_ciclo_${filters.ciclo}`
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

  // Guardar un registro individual (usando upsert por si ya existe)
  async function guardarItem() {
    if (!formData.ciclo_id || !formData.mes_trabajo) {
      alert('El ciclo y el mes son obligatorios')
      return
    }
    setLoading(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      const data = {
        ciclo_id: parseInt(formData.ciclo_id),
        mes_trabajo: formData.mes_trabajo,
        ...RESULTADOS_DIGITALES.reduce((acc, res) => ({ ...acc, [res.id]: formData[res.id] }), {}),
        creado_por_id: user?.id,
        creado_por_nombre: user?.email
      }
      let error
      if (editingId) {
        ({ error } = await supabase.from('resultados_digitales').update(data).eq('id', editingId))
      } else {
        // Usar upsert para evitar duplicados
        ({ error } = await supabase
          .from('resultados_digitales')
          .upsert(data, { onConflict: 'ciclo_id, mes_trabajo' }))
      }
      if (error) throw error

      resetForm()
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

  // Carga desde Excel (usando upsert)
  const cargarExcel = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target.result)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
      const headers = rows[0]
      const dataRows = rows.slice(1).filter(r => r.some(cell => cell))

      const colMap = {
        'ciclo_id': 0,
        'mes_trabajo': 1,
        ...RESULTADOS_DIGITALES.reduce((acc, r, idx) => ({ ...acc, [r.id]: idx + 2 }), {})
      }

      const parsed = dataRows.map(row => ({
        ciclo_id: parseInt(row[colMap['ciclo_id']]) || 0,
        mes_trabajo: row[colMap['mes_trabajo']] || obtenerFechaColombia(),
        ...RESULTADOS_DIGITALES.reduce((acc, res) => ({
          ...acc,
          [res.id]: parseInt(row[colMap[res.id]]) || 0
        }), {})
      })).filter(r => r.ciclo_id > 0 && r.mes_trabajo)

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
      
      const { error } = await supabase
        .from('resultados_digitales')
        .upsert(toInsert, { onConflict: 'ciclo_id, mes_trabajo' })

      if (error) throw error
      setShowExcelModal(false)
      setExcelData([])
      setExcelPreview([])
      await cargarItems()
      await cargarEstadisticas()
      alert(`✅ ${toInsert.length} registros procesados (insertados/actualizados)`)
    } catch (error) {
      console.error('Error guardando Excel:', error)
      alert('Error al cargar Excel: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  function editar(item) {
    setFormData({
      ciclo_id: item.ciclo_id,
      mes_trabajo: item.mes_trabajo,
      ...RESULTADOS_DIGITALES.reduce((acc, res) => ({ ...acc, [res.id]: item[res.id] }), {})
    })
    setEditingId(item.id)
    setShowForm(true)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este registro?')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('resultados_digitales').delete().eq('id', id)
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

  const resetForm = () => {
    setFormData({
      ciclo_id: '',
      mes_trabajo: obtenerFechaColombia(),
      buzones_inactivo: 0,
      buzones_lleno: 0,
      buzones_no_existe: 0,
      correo_mal_escrito: 0,
      dominio_no_existe: 0,
      enviados: 0,
      rechazado_varios_intentos: 0,
      reporta_spam: 0,
      sin_adjunto: 0,
      servidor_destino_no_responde: 0
    })
  }

  const resetFilters = () => {
    setFilters({ fecha_desde: obtenerInicioMes(), fecha_hasta: obtenerFinMes(), ciclo: '' })
    setPage(1)
  }

  return (
    <div className="page">
      <header className="topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>Resultados Digitales</h1>
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
        <button className="action-btn primary" onClick={() => setShowStatsModal(true)} style={{ alignSelf: 'center' }}>
          📊 Ver Estadísticas
        </button>
      </div>

      {/* Botones de acción */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <button className="action-btn secondary" onClick={descargarPlantilla}>
          📥 Descargar Plantilla
        </button>
        <label className={`action-btn secondary ${exporting ? 'disabled' : ''}`}>
          📤 Cargar Excel
          <input type="file" accept=".xlsx,.xls,.csv" onChange={cargarExcel} style={{ display: 'none' }} disabled={exporting} />
        </label>
        <button className="action-btn success" onClick={exportarExcel} disabled={exporting || loading}>
          {exporting ? '⏳ Exportando...' : '📊 Exportar Excel'}
        </button>
        <button className="action-btn primary" onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }}>
          + Nuevo Registro
        </button>
      </div>

      {/* Modal de estadísticas */}
      {showStatsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 1200, maxHeight: '90vh' }}>
            <div className="modal-header">
              <h2>📊 Estadísticas de Resultados Digitales</h2>
              <button className="close-btn" onClick={() => setShowStatsModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <div className="charts-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                
                {/* Gráfico: Cantidad por Ciclo */}
                <div className="dashboard-card">
                  <h3>🔢 Cantidad por Ciclo</h3>
                  <div style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.porCiclo}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="ciclo" />
                        <YAxis tickFormatter={formatearNumero} />
                        <Tooltip formatter={(value) => formatearNumero(value)} />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#8b5cf6" radius={[4,4,0,0]}>
                          <LabelList dataKey="cantidad" position="top" formatter={formatearNumero} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico de barras horizontales: Resultados Digitales */}
                <div className="dashboard-card">
                  <h3>📊 Detalle por Resultado</h3>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.porResultado} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={formatearNumero} />
                        <YAxis dataKey="nombre" type="category" width={150} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatearNumero(value)} />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#14b8a6" radius={[0,4,4,0]}>
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
                    <tr><th>Ciclo</th><th>Mes</th><th>Enviados</th></tr>
                  </thead>
                  <tbody>
                    {excelPreview.map((r,i) => (
                      <tr key={i}>
                        <td>{r.ciclo_id}</td>
                        <td>{r.mes_trabajo}</td>
                        <td>{r.enviados}</td>
                      </tr>
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
              <h2>{editingId ? 'Editar Registro' : 'Nuevo Registro'}</h2>
              <button className="close-btn" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="form-modal-body">
              <div className="form-section">
                <h3>📋 Identificación</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Ciclo ID *</label>
                    <input type="number" min="1" value={formData.ciclo_id} onChange={e => setFormData({...formData, ciclo_id: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Mes de Trabajo *</label>
                    <input type="date" value={formData.mes_trabajo} onChange={e => setFormData({...formData, mes_trabajo: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="form-section">
                <h3>📧 Resultados</h3>
                <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {RESULTADOS_DIGITALES.map(res => (
                    <div className="form-group" key={res.id}>
                      <label>{res.nombre}</label>
                      <input 
                        type="number" 
                        min="0" 
                        value={formData[res.id]} 
                        onChange={e => setFormData({...formData, [res.id]: parseInt(e.target.value) || 0})} 
                      />
                    </div>
                  ))}
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
        <input type="date" placeholder="Mes desde" value={filters.fecha_desde} onChange={e => setFilters({...filters, fecha_desde: e.target.value, page:1})} />
        <input type="date" placeholder="Mes hasta" value={filters.fecha_hasta} onChange={e => setFilters({...filters, fecha_hasta: e.target.value, page:1})} />
        <input type="number" placeholder="Ciclo" value={filters.ciclo} onChange={e => setFilters({...filters, ciclo: e.target.value, page:1})} />
        <button onClick={resetFilters}>Limpiar</button>
      </div>

      {/* Tabla de resultados */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Mes</th><th>Ciclo</th>
              {RESULTADOS_DIGITALES.map(r => <th key={r.id}>{r.nombre}</th>)}
              {rol === 'admin' && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>{item.mes_trabajo}</td>
                <td>{item.ciclo_id}</td>
                {RESULTADOS_DIGITALES.map(r => <td key={r.id}>{item[r.id]}</td>)}
                {rol === 'admin' && (
                  <td>
                    <button className="icon-btn" onClick={() => editar(item)} style={{ marginRight:8 }}>✏️</button>
                    <button className="icon-btn" onClick={() => eliminar(item.id)}>🗑️</button>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={2 + RESULTADOS_DIGITALES.length + (rol==='admin'?1:0)} style={{textAlign:'center', padding:40}}>No hay registros</td></tr>
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