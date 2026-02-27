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
// Colores más suaves para los gráficos
const COLORS = {
  integracion: '#60a5fa', // azul claro
  recuperados: '#fbbf24', // amarillo/ámbar
  sinAccion: '#f87171',   // rojo claro
  lineaIntegracion: '#3b82f6', // azul más fuerte para línea
  lineaRecuperados: '#f59e0b', // naranja para línea
  lineaSinAccion: '#ef4444'    // rojo para línea
}

const formatearNumero = (num) => new Intl.NumberFormat('es-CO').format(num || 0)

const obtenerFechaColombia = () => {
  const ahora = new Date()
  const colombia = new Date(ahora.getTime() - (5 * 60 * 60 * 1000))
  const año = colombia.getFullYear()
  const mes = String(colombia.getMonth() + 1).padStart(2, '0')
  const dia = String(colombia.getDate()).padStart(2, '0')
  return `${año}-${mes}-${dia}`
}

export default function AMI({ onBack, rol }) {
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
    totalEnviados: 0,
    totalIntegracion: 0,
    totalRecuperados: 0,
    totalSinAccion: 0,
    porCiclo: [],
    porMes: []
  })
  const [filters, setFilters] = useState({
    mes_desde: '',
    mes_hasta: '',
    ciclo: ''
  })
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [formData, setFormData] = useState({
    ciclo: '',
    mes_vigencia: obtenerFechaColombia().slice(0, 7), // YYYY-MM
    fecha_reporte: obtenerFechaColombia(),
    total_enviados: 0,
    total_integracion: 0,
    total_recuperados: 0,
    archivo_enviados: '',
    archivo_integracion: '',
    archivo_recuperados: '',
    observaciones: ''
  })

  const totalSinAccion = Math.max(
    (formData.total_enviados || 0) - (formData.total_integracion || 0) - (formData.total_recuperados || 0),
    0
  )
  const porcentajeIntegracion = formData.total_enviados > 0
    ? ((formData.total_integracion / formData.total_enviados) * 100).toFixed(1)
    : 0
  const porcentajeRecuperados = formData.total_enviados > 0
    ? ((formData.total_recuperados / formData.total_enviados) * 100).toFixed(1)
    : 0
  const porcentajeSinLectura = formData.total_enviados > 0
    ? ((totalSinAccion / formData.total_enviados) * 100).toFixed(1)
    : 0

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
        .from('ami_reportes')
        .select('*', { count: 'exact' })
        .order('mes_vigencia', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filters.mes_desde) query = query.gte('mes_vigencia', filters.mes_desde)
      if (filters.mes_hasta) query = query.lte('mes_vigencia', filters.mes_hasta)
      if (filters.ciclo) query = query.eq('ciclo', parseInt(filters.ciclo))

      const { data, count, error } = await query
      if (error) throw error
      setItems(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error cargando reportes AMI:', error)
    } finally {
      setLoading(false)
    }
  }

  async function cargarEstadisticas() {
    try {
      const { data, error } = await supabase
        .from('ami_reportes')
        .select('ciclo, mes_vigencia, total_enviados, total_integracion, total_recuperados, total_sin_accion, porcentaje_integracion, porcentaje_recuperados, porcentaje_sin_lectura')
      if (error) throw error

      let totalEnviados = 0, totalIntegracion = 0, totalRecuperados = 0, totalSinAccion = 0
      const porCiclo = {}
      const porMes = {}

      data?.forEach(r => {
        totalEnviados += r.total_enviados || 0
        totalIntegracion += r.total_integracion || 0
        totalRecuperados += r.total_recuperados || 0
        totalSinAccion += r.total_sin_accion || 0

        // Por ciclo
        if (!porCiclo[r.ciclo]) {
          porCiclo[r.ciclo] = { ciclo: r.ciclo, enviados: 0, integracion: 0, recuperados: 0, sinAccion: 0, pctInt: 0, pctRec: 0, pctSin: 0 }
        }
        porCiclo[r.ciclo].enviados += r.total_enviados || 0
        porCiclo[r.ciclo].integracion += r.total_integracion || 0
        porCiclo[r.ciclo].recuperados += r.total_recuperados || 0
        porCiclo[r.ciclo].sinAccion += r.total_sin_accion || 0

        // Por mes
        if (!porMes[r.mes_vigencia]) {
          porMes[r.mes_vigencia] = { mes: r.mes_vigencia, enviados: 0, integracion: 0, recuperados: 0, sinAccion: 0, pctInt: 0, pctRec: 0, pctSin: 0 }
        }
        porMes[r.mes_vigencia].enviados += r.total_enviados || 0
        porMes[r.mes_vigencia].integracion += r.total_integracion || 0
        porMes[r.mes_vigencia].recuperados += r.total_recuperados || 0
        porMes[r.mes_vigencia].sinAccion += r.total_sin_accion || 0
      })

      // Calcular porcentajes para cada ciclo y mes
      Object.values(porCiclo).forEach(c => {
        c.pctInt = c.enviados > 0 ? ((c.integracion / c.enviados) * 100).toFixed(1) : 0
        c.pctRec = c.enviados > 0 ? ((c.recuperados / c.enviados) * 100).toFixed(1) : 0
        c.pctSin = c.enviados > 0 ? ((c.sinAccion / c.enviados) * 100).toFixed(1) : 0
      })
      Object.values(porMes).forEach(m => {
        m.pctInt = m.enviados > 0 ? ((m.integracion / m.enviados) * 100).toFixed(1) : 0
        m.pctRec = m.enviados > 0 ? ((m.recuperados / m.enviados) * 100).toFixed(1) : 0
        m.pctSin = m.enviados > 0 ? ((m.sinAccion / m.enviados) * 100).toFixed(1) : 0
      })

      // Ordenar ciclos por número de ciclo
      const ciclosOrdenados = Object.values(porCiclo).sort((a,b) => a.ciclo - b.ciclo)

      setStats({
        totalRegistros: data?.length || 0,
        totalEnviados,
        totalIntegracion,
        totalRecuperados,
        totalSinAccion,
        porCiclo: ciclosOrdenados,
        porMes: Object.values(porMes).sort((a,b) => a.mes.localeCompare(b.mes))
      })
    } catch (error) {
      console.error('Error cargando estadísticas AMI:', error)
    }
  }

  const descargarPlantilla = () => {
    const wb = XLSX.utils.book_new()
    const instructivo = [
      ['INSTRUCTIVO PARA CARGA DE REPORTES AMI'],
      [''],
      ['1. FORMATO DE FECHAS: YYYY-MM-DD para fecha_reporte, YYYY-MM para mes_vigencia'],
      ['2. CAMPOS NUMÉRICOS: Solo números enteros'],
      ['3. COLUMNAS (en este orden):'],
      ['   • ciclo (número)'],
      ['   • mes_vigencia (texto YYYY-MM)'],
      ['   • fecha_reporte (fecha)'],
      ['   • total_enviados (número)'],
      ['   • total_integracion (número)'],
      ['   • total_recuperados (número)'],
      ['   • archivo_enviados (texto)'],
      ['   • archivo_integracion (texto)'],
      ['   • archivo_recuperados (texto)'],
      ['   • observaciones (texto)'],
    ]
    const wsInstructivo = XLSX.utils.aoa_to_sheet(instructivo)
    wsInstructivo['!cols'] = [{ wch: 80 }]
    XLSX.utils.book_append_sheet(wb, wsInstructivo, 'Instructivo')

    const ejemplo = [
      ['ciclo','mes_vigencia','fecha_reporte','total_enviados','total_integracion','total_recuperados','archivo_enviados','archivo_integracion','archivo_recuperados','observaciones'],
      ['40','2026-02','2026-02-17','1500','1200','250','Enviados_40.xlsx','Integracion_40.xlsx','Recuperados_40.xlsx','Reporte normal'],
      ['42','2026-02','2026-02-18','800','600','150','Enviados_42.xlsx','Integracion_42.xlsx','Recuperados_42.xlsx','Sin novedad'],
    ]
    const wsEjemplo = XLSX.utils.aoa_to_sheet(ejemplo)
    wsEjemplo['!cols'] = Array(10).fill({ wch: 15 })
    XLSX.utils.book_append_sheet(wb, wsEjemplo, 'Ejemplo')

    const plantilla = [ejemplo[0], []]
    const wsPlantilla = XLSX.utils.aoa_to_sheet(plantilla)
    wsPlantilla['!cols'] = wsEjemplo['!cols']
    XLSX.utils.book_append_sheet(wb, wsPlantilla, 'Plantilla')

    XLSX.writeFile(wb, 'plantilla_ami.xlsx')
  }

  const exportarExcel = async () => {
    try {
      setExporting(true)
      let query = supabase.from('ami_reportes').select('*').order('mes_vigencia', { ascending: false })
      if (filters.mes_desde) query = query.gte('mes_vigencia', filters.mes_desde)
      if (filters.mes_hasta) query = query.lte('mes_vigencia', filters.mes_hasta)
      if (filters.ciclo) query = query.eq('ciclo', parseInt(filters.ciclo))

      const { data, error } = await query
      if (error) throw error

      const excelRows = data.map(r => ({
        'Ciclo': r.ciclo,
        'Mes Vigencia': r.mes_vigencia,
        'Fecha Reporte': r.fecha_reporte,
        'Total Enviados': r.total_enviados,
        'Integración': r.total_integracion,
        'Recuperados': r.total_recuperados,
        'Sin Acción': r.total_sin_accion,
        '% Integración': r.porcentaje_integracion + '%',
        '% Recuperados': r.porcentaje_recuperados + '%',
        '% Sin Lectura': r.porcentaje_sin_lectura + '%',
        'Archivo Enviados': r.archivo_enviados || '',
        'Archivo Integración': r.archivo_integracion || '',
        'Archivo Recuperados': r.archivo_recuperados || '',
        'Observaciones': r.observaciones || '',
        'Creado': new Date(r.created_at).toLocaleString('es-CO'),
        'Creado Por': r.creado_por_nombre || ''
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelRows)
      XLSX.utils.book_append_sheet(wb, ws, 'AMI')

      let nombre = 'ami_reportes'
      if (filters.mes_desde || filters.mes_hasta) nombre += `_${filters.mes_desde || 'inicio'}_${filters.mes_hasta || 'fin'}`
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

  async function guardarItem() {
    if (!formData.ciclo || !formData.mes_vigencia) {
      alert('El ciclo y el mes de vigencia son obligatorios')
      return
    }
    setLoading(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      const data = {
        ciclo: parseInt(formData.ciclo),
        mes_vigencia: formData.mes_vigencia,
        fecha_reporte: formData.fecha_reporte,
        total_enviados: formData.total_enviados,
        total_integracion: formData.total_integracion,
        total_recuperados: formData.total_recuperados,
        archivo_enviados: formData.archivo_enviados || null,
        archivo_integracion: formData.archivo_integracion || null,
        archivo_recuperados: formData.archivo_recuperados || null,
        observaciones: formData.observaciones || null,
        creado_por_id: user?.id,
        creado_por_nombre: user?.email
      }
      let error
      if (editingId) {
        ({ error } = await supabase.from('ami_reportes').update(data).eq('id', editingId))
      } else {
        ({ error } = await supabase.from('ami_reportes').insert([data]))
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
        'ciclo': 0,
        'mes_vigencia': 1,
        'fecha_reporte': 2,
        'total_enviados': 3,
        'total_integracion': 4,
        'total_recuperados': 5,
        'archivo_enviados': 6,
        'archivo_integracion': 7,
        'archivo_recuperados': 8,
        'observaciones': 9
      }

      const parsed = dataRows.map(row => ({
        ciclo: parseInt(row[colMap['ciclo']]) || 0,
        mes_vigencia: row[colMap['mes_vigencia']] || '',
        fecha_reporte: row[colMap['fecha_reporte']] || obtenerFechaColombia(),
        total_enviados: parseInt(row[colMap['total_enviados']]) || 0,
        total_integracion: parseInt(row[colMap['total_integracion']]) || 0,
        total_recuperados: parseInt(row[colMap['total_recuperados']]) || 0,
        archivo_enviados: row[colMap['archivo_enviados']] || '',
        archivo_integracion: row[colMap['archivo_integracion']] || '',
        archivo_recuperados: row[colMap['archivo_recuperados']] || '',
        observaciones: row[colMap['observaciones']] || ''
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
      const { error } = await supabase.from('ami_reportes').insert(toInsert)
      if (error) throw error
      setShowExcelModal(false)
      setExcelData([])
      setExcelPreview([])
      await cargarItems()
      await cargarEstadisticas()
      alert(`✅ ${toInsert.length} registros cargados`)
    } catch (error) {
      console.error('Error guardando Excel:', error)
      alert('Error al cargar Excel: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  function editar(item) {
    setFormData({
      ciclo: item.ciclo,
      mes_vigencia: item.mes_vigencia,
      fecha_reporte: item.fecha_reporte,
      total_enviados: item.total_enviados,
      total_integracion: item.total_integracion,
      total_recuperados: item.total_recuperados,
      archivo_enviados: item.archivo_enviados || '',
      archivo_integracion: item.archivo_integracion || '',
      archivo_recuperados: item.archivo_recuperados || '',
      observaciones: item.observaciones || ''
    })
    setEditingId(item.id)
    setShowForm(true)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este reporte?')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('ami_reportes').delete().eq('id', id)
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
      ciclo: '',
      mes_vigencia: obtenerFechaColombia().slice(0,7),
      fecha_reporte: obtenerFechaColombia(),
      total_enviados: 0,
      total_integracion: 0,
      total_recuperados: 0,
      archivo_enviados: '',
      archivo_integracion: '',
      archivo_recuperados: '',
      observaciones: ''
    })
  }

  const resetFilters = () => {
    setFilters({ mes_desde: '', mes_hasta: '', ciclo: '' })
    setPage(1)
  }

  return (
    <div className="page">
      <header className="topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>Análisis de Medidores Inteligentes (AMI)</h1>
        {rol === 'admin' && <span className="user-role">Admin</span>}
      </header>

      {/* Tarjetas de resumen */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#dbeafe' }}>📋</div>
          <div className="stat-info">
            <div className="stat-label">Total Reportes</div>
            <div className="stat-value">{stats.totalRegistros}</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#fee2e2' }}>📤</div>
          <div className="stat-info">
            <div className="stat-label">Total Enviados</div>
            <div className="stat-value">{formatearNumero(stats.totalEnviados)}</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#fef3c7' }}>✅</div>
          <div className="stat-info">
            <div className="stat-label">Integración</div>
            <div className="stat-value">{formatearNumero(stats.totalIntegracion)}</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#d9f99d' }}>🔄</div>
          <div className="stat-info">
            <div className="stat-label">Recuperados</div>
            <div className="stat-value">{formatearNumero(stats.totalRecuperados)}</div>
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
          + Nuevo Reporte
        </button>
      </div>

      {/* Modal de estadísticas */}
      {showStatsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 1200, maxHeight: '90vh' }}>
            <div className="modal-header">
              <h2>📊 Estadísticas AMI</h2>
              <button className="close-btn" onClick={() => setShowStatsModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                
                {/* Gráfico de columnas: Totales por Ciclo (barras independientes) */}
                <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
                  <h3>📊 Totales por Ciclo</h3>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <div style={{ width: Math.max(800, stats.porCiclo.length * 60) }}> {/* Ancho dinámico según cantidad de ciclos */}
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={stats.porCiclo} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="ciclo" 
                            angle={-45} 
                            textAnchor="end" 
                            height={70} 
                            interval={0}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis tickFormatter={formatearNumero} />
                          <Tooltip formatter={(value) => formatearNumero(value)} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar 
                            dataKey="integracion" 
                            fill={COLORS.integracion} 
                            name="Integración" 
                            radius={[4,4,0,0]}
                          >
                            <LabelList 
                              dataKey="integracion" 
                              position="top" 
                              fontSize={10} 
                              formatter={(v) => v > 0 ? formatearNumero(v) : ''} 
                            />
                          </Bar>
                          <Bar 
                            dataKey="recuperados" 
                            fill={COLORS.recuperados} 
                            name="Recuperados" 
                            radius={[4,4,0,0]}
                          >
                            <LabelList 
                              dataKey="recuperados" 
                              position="top" 
                              fontSize={10} 
                              formatter={(v) => v > 0 ? formatearNumero(v) : ''} 
                            />
                          </Bar>
                          <Bar 
                            dataKey="sinAccion" 
                            fill={COLORS.sinAccion} 
                            name="Sin Acción" 
                            radius={[4,4,0,0]}
                          >
                            <LabelList 
                              dataKey="sinAccion" 
                              position="top" 
                              fontSize={10} 
                              formatter={(v) => v > 0 ? formatearNumero(v) : ''} 
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Gráfico de líneas: Porcentajes por Ciclo */}
                <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
                  <h3>📈 Porcentajes por Ciclo</h3>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <div style={{ width: Math.max(800, stats.porCiclo.length * 60) }}>
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={stats.porCiclo} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="ciclo" 
                            angle={-45} 
                            textAnchor="end" 
                            height={70} 
                            interval={0}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis domain={[0, 100]} tickFormatter={(v) => v + '%'} />
                          <Tooltip formatter={(value) => value + '%'} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Line 
                            type="monotone" 
                            dataKey="pctInt" 
                            stroke={COLORS.lineaIntegracion} 
                            name="% Integración" 
                            strokeWidth={2} 
                            dot={{ r: 3 }}
                          >
                            <LabelList dataKey="pctInt" position="top" fontSize={10} formatter={(v) => v > 0 ? v + '%' : ''} />
                          </Line>
                          <Line 
                            type="monotone" 
                            dataKey="pctRec" 
                            stroke={COLORS.lineaRecuperados} 
                            name="% Recuperados" 
                            strokeWidth={2} 
                            dot={{ r: 3 }}
                          >
                            <LabelList dataKey="pctRec" position="top" fontSize={10} formatter={(v) => v > 0 ? v + '%' : ''} />
                          </Line>
                          <Line 
                            type="monotone" 
                            dataKey="pctSin" 
                            stroke={COLORS.lineaSinAccion} 
                            name="% Sin Acción" 
                            strokeWidth={2} 
                            dot={{ r: 3 }}
                          >
                            <LabelList dataKey="pctSin" position="top" fontSize={10} formatter={(v) => v > 0 ? v + '%' : ''} />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Gráfico de líneas: Evolución Mensual */}
                <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
                  <h3>📅 Evolución Mensual</h3>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <div style={{ width: Math.max(800, stats.porMes.length * 80) }}>
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={stats.porMes} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                          <YAxis tickFormatter={formatearNumero} />
                          <Tooltip formatter={(value) => formatearNumero(value)} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Line 
                            type="monotone" 
                            dataKey="integracion" 
                            stroke={COLORS.lineaIntegracion} 
                            name="Integración" 
                            strokeWidth={2} 
                            dot={{ r: 4 }}
                          >
                            <LabelList dataKey="integracion" position="top" fontSize={10} formatter={(v) => v > 0 ? formatearNumero(v) : ''} />
                          </Line>
                          <Line 
                            type="monotone" 
                            dataKey="recuperados" 
                            stroke={COLORS.lineaRecuperados} 
                            name="Recuperados" 
                            strokeWidth={2} 
                            dot={{ r: 4 }}
                          >
                            <LabelList dataKey="recuperados" position="top" fontSize={10} formatter={(v) => v > 0 ? formatearNumero(v) : ''} />
                          </Line>
                          <Line 
                            type="monotone" 
                            dataKey="sinAccion" 
                            stroke={COLORS.lineaSinAccion} 
                            name="Sin Acción" 
                            strokeWidth={2} 
                            dot={{ r: 4 }}
                          >
                            <LabelList dataKey="sinAccion" position="top" fontSize={10} formatter={(v) => v > 0 ? formatearNumero(v) : ''} />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
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
                        <td>{r.ciclo}</td>
                        <td>{r.mes_vigencia}</td>
                        <td>{r.total_enviados}</td>
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
              <h2>{editingId ? 'Editar Reporte' : 'Nuevo Reporte AMI'}</h2>
              <button className="close-btn" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="form-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="form-tabs">
                <div className="tab active">Datos del Reporte</div>
              </div>
              <div className="form-section">
                <h3>📋 Información General</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Ciclo *</label>
                    <input type="number" min="1" value={formData.ciclo} onChange={e => setFormData({...formData, ciclo: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Mes Vigencia *</label>
                    <input type="month" value={formData.mes_vigencia} onChange={e => setFormData({...formData, mes_vigencia: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Fecha Reporte</label>
                    <input type="date" value={formData.fecha_reporte} onChange={e => setFormData({...formData, fecha_reporte: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="form-section">
                <h3>📊 Totales</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Total Enviados</label>
                    <input type="number" min="0" value={formData.total_enviados} onChange={e => setFormData({...formData, total_enviados: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="form-group">
                    <label>Total Integración Automática</label>
                    <input type="number" min="0" value={formData.total_integracion} onChange={e => setFormData({...formData, total_integracion: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="form-group">
                    <label>Total Recuperados Manual</label>
                    <input type="number" min="0" value={formData.total_recuperados} onChange={e => setFormData({...formData, total_recuperados: parseInt(e.target.value) || 0})} />
                  </div>
                </div>
              </div>
              <div className="form-section">
                <h3>📈 Resultados Calculados</h3>
                <div className="form-grid" style={{ background: '#f8f9fa', padding: 16, borderRadius: 8 }}>
                  <div className="form-group">
                    <label>Total Sin Acción</label>
                    <input type="number" value={totalSinAccion} disabled style={{ background: '#e9ecef' }} />
                  </div>
                  <div className="form-group">
                    <label>% Integración</label>
                    <input type="text" value={`${porcentajeIntegracion}%`} disabled style={{ background: '#e9ecef' }} />
                  </div>
                  <div className="form-group">
                    <label>% Recuperados</label>
                    <input type="text" value={`${porcentajeRecuperados}%`} disabled style={{ background: '#e9ecef' }} />
                  </div>
                  <div className="form-group">
                    <label>% Sin Lectura</label>
                    <input type="text" value={`${porcentajeSinLectura}%`} disabled style={{ background: '#e9ecef' }} />
                  </div>
                </div>
              </div>
              <div className="form-section">
                <h3>📁 Archivos (opcional)</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Archivo Enviados</label>
                    <input type="text" value={formData.archivo_enviados} onChange={e => setFormData({...formData, archivo_enviados: e.target.value})} placeholder="Nombre del archivo" />
                  </div>
                  <div className="form-group">
                    <label>Archivo Integración</label>
                    <input type="text" value={formData.archivo_integracion} onChange={e => setFormData({...formData, archivo_integracion: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Archivo Recuperados</label>
                    <input type="text" value={formData.archivo_recuperados} onChange={e => setFormData({...formData, archivo_recuperados: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="form-section">
                <h3>📝 Observaciones</h3>
                <div className="form-grid">
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <textarea rows="3" value={formData.observaciones} onChange={e => setFormData({...formData, observaciones: e.target.value})} placeholder="Notas adicionales..." />
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
        <input type="month" placeholder="Mes desde" value={filters.mes_desde} onChange={e => setFilters({...filters, mes_desde: e.target.value, page:1})} />
        <input type="month" placeholder="Mes hasta" value={filters.mes_hasta} onChange={e => setFilters({...filters, mes_hasta: e.target.value, page:1})} />
        <input type="number" placeholder="Ciclo" value={filters.ciclo} onChange={e => setFilters({...filters, ciclo: e.target.value, page:1})} />
        <button onClick={resetFilters}>Limpiar</button>
      </div>

      {/* Tabla de resultados */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Mes</th><th>Ciclo</th><th>Fecha</th><th>Env</th><th>Int</th><th>Rec</th><th>Sin</th><th>%Int</th><th>%Rec</th><th>%Sin</th>
              {rol === 'admin' && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>{item.mes_vigencia}</td>
                <td>{item.ciclo}</td>
                <td>{item.fecha_reporte}</td>
                <td>{item.total_enviados}</td>
                <td>{item.total_integracion}</td>
                <td>{item.total_recuperados}</td>
                <td>{item.total_sin_accion}</td>
                <td>{item.porcentaje_integracion}%</td>
                <td>{item.porcentaje_recuperados}%</td>
                <td>{item.porcentaje_sin_lectura}%</td>
                {rol === 'admin' && (
                  <td>
                    <button className="icon-btn" onClick={() => editar(item)} style={{ marginRight:8 }}>✏️</button>
                    <button className="icon-btn" onClick={() => eliminar(item.id)}>🗑️</button>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={rol==='admin'?11:10} style={{textAlign:'center', padding:40}}>No hay reportes</td></tr>
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