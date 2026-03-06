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
  Cell
} from 'recharts'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import '../index.css'

const PAGE_SIZE = 10
const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

// Función para obtener fecha actual de Colombia (UTC-5)
const obtenerFechaColombia = () => {
  const ahora = new Date()
  const colombia = new Date(ahora.getTime() - (5 * 60 * 60 * 1000))
  const año = colombia.getFullYear()
  const mes = String(colombia.getMonth() + 1).padStart(2, '0')
  const dia = String(colombia.getDate()).padStart(2, '0')
  return `${año}-${mes}-${dia}`
}

export default function CiclosProcesados({ onBack, rol }) {
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
    totalProcesado: 0,
    totalOrdenes: 0,
    totalAcueducto: 0,
    totalEnergia: 0,
    ordenesPorMes: [],          // para gráfico de órdenes generadas por mes
    comparativoCausas: []       // para gráfico de líneas comparativo
  })
  const [filters, setFilters] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    ciclo: ''
  })
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Formulario: fecha por defecto = hoy Colombia
  const [formData, setFormData] = useState({
    fecha_procesamiento: obtenerFechaColombia(),
    ciclo: '',
    cantidad_acueducto: 0,
    cantidad_energia: 0,
    causa_13: 0,
    causa_15: 0,
    causa_16: 0,
    causa_34: 0,
    causa_36: 0,
    causa_37: 0,
    causa_58: 0,
    causa_71: 0,
    linea_accion: 0
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
        .from('ciclos_procesados')
        .select('*', { count: 'exact' })
        .order('fecha_procesamiento', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filters.fecha_desde) query = query.gte('fecha_procesamiento', filters.fecha_desde)
      if (filters.fecha_hasta) query = query.lte('fecha_procesamiento', filters.fecha_hasta)
      if (filters.ciclo) query = query.ilike('ciclo', `%${filters.ciclo}%`)

      const { data, count, error } = await query
      if (error) throw error
      setItems(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error cargando ciclos:', error)
    } finally {
      setLoading(false)
    }
  }

  async function cargarEstadisticas() {
    try {
      // Obtener todos los registros para estadísticas (sin paginación)
      const { data: todos, error } = await supabase
        .from('ciclos_procesados')
        .select('*')
      if (error) throw error

      // Totales generales
      let totalProcesado = 0
      let totalOrdenes = 0
      let totalAcueducto = 0
      let totalEnergia = 0
      todos?.forEach(r => {
        totalProcesado += r.total_procesado || 0
        totalOrdenes += r.total_ordenes_causa || 0
        totalAcueducto += r.cantidad_acueducto || 0
        totalEnergia += r.cantidad_energia || 0
      })

      // Por día (últimos 30)
      const fechaLimite = new Date()
      fechaLimite.setDate(fechaLimite.getDate() - 30)
      const datosUltimos30 = todos?.filter(r => r.fecha_procesamiento >= fechaLimite.toISOString().split('T')[0]) || []
      const porDia = {}
      datosUltimos30.forEach(r => {
        porDia[r.fecha_procesamiento] = (porDia[r.fecha_procesamiento] || 0) + 1
      })

      // Convertir a array con objetos Date y ordenar ascendente
      const porDiaArray = Object.entries(porDia)
        .map(([fecha, cantidad]) => ({ fecha: new Date(fecha), cantidad }))
        .sort((a, b) => a.fecha - b.fecha)

      // Por mes (para registros)
      const porMes = {}
      const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
      todos?.forEach(r => {
        const fecha = new Date(r.fecha_procesamiento)
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}`
        const label = `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`
        if (!porMes[key]) porMes[key] = { mes: label, cantidad: 0, key }
        porMes[key].cantidad++
      })

      // Órdenes generadas por mes (total_ordenes_causa)
      const ordenesPorMes = {}
      todos?.forEach(r => {
        const fecha = new Date(r.fecha_procesamiento)
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}`
        const label = `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`
        if (!ordenesPorMes[key]) ordenesPorMes[key] = { mes: label, ordenes: 0, key }
        ordenesPorMes[key].ordenes += r.total_ordenes_causa || 0
      })

      // Comparativo de causas: último mes completo vs anterior
      // Ordenar claves de mes
      const mesesKeys = Object.keys(ordenesPorMes).sort()
      const ultimoMesKey = mesesKeys[mesesKeys.length - 1]
      const anteriorMesKey = mesesKeys[mesesKeys.length - 2]

      // Inicializar objeto para causas
      const causas = ['causa_13', 'causa_15', 'causa_16', 'causa_34', 'causa_36', 'causa_37', 'causa_58', 'causa_71', 'linea_accion']
      const nombresCausas = {
        causa_13: 'C13', causa_15: 'C15', causa_16: 'C16', causa_34: 'C34',
        causa_36: 'C36', causa_37: 'C37', causa_58: 'C58', causa_71: 'C71',
        linea_accion: 'Línea'
      }

      const comparativo = causas.map(c => {
        let actual = 0
        let anterior = 0
        if (ultimoMesKey) {
          todos?.forEach(r => {
            const fecha = new Date(r.fecha_procesamiento)
            const key = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}`
            if (key === ultimoMesKey) actual += r[c] || 0
            if (key === anteriorMesKey) anterior += r[c] || 0
          })
        }
        return {
          causa: nombresCausas[c] || c,
          actual,
          anterior
        }
      })

      setStats({
        total: todos?.length || 0,
        porDia: porDiaArray,
        porMes: Object.values(porMes).sort((a,b) => a.key.localeCompare(b.key)).slice(-12),
        totalProcesado,
        totalOrdenes,
        totalAcueducto,
        totalEnergia,
        ordenesPorMes: Object.values(ordenesPorMes).sort((a,b) => a.key.localeCompare(b.key)).slice(-12),
        comparativoCausas: comparativo
      })

    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

  // Plantilla Excel
  const descargarPlantilla = () => {
    const wb = XLSX.utils.book_new()

    const instructivo = [
      ['INSTRUCTIVO PARA CARGA DE CICLOS PROCESADOS Y ÓRDENES'],
      [''],
      ['1. FORMATO DE FECHA: YYYY-MM-DD (ej: 2026-02-17)'],
      [''],
      ['2. CAMPOS NUMÉRICOS: Solo números enteros (sin decimales)'],
      [''],
      ['3. COLUMNAS (en este orden):'],
      ['   • fecha_procesamiento (obligatorio)'],
      ['   • ciclo'],
      ['   • cantidad_acueducto'],
      ['   • cantidad_energia'],
      ['   • causa_13'],
      ['   • causa_15'],
      ['   • causa_16'],
      ['   • causa_34'],
      ['   • causa_36'],
      ['   • causa_37'],
      ['   • causa_58'],
      ['   • causa_71'],
      ['   • linea_accion (valor numérico)'],
      [''],
      ['4. NOTA: Los totales se calculan automáticamente.'],
      ['5. Puede cargar el archivo en dos momentos: primero solo datos de procesamiento (dejando causas en 0) y luego otro archivo con las causas para la misma fecha y ciclo; se actualizarán sin duplicar.'],
    ]
    const wsInstructivo = XLSX.utils.aoa_to_sheet(instructivo)
    wsInstructivo['!cols'] = [{ wch: 80 }]
    XLSX.utils.book_append_sheet(wb, wsInstructivo, 'Instructivo')

    const ejemplo = [
      ['fecha_procesamiento', 'ciclo', 'cantidad_acueducto', 'cantidad_energia', 'causa_13', 'causa_15', 'causa_16', 'causa_34', 'causa_36', 'causa_37', 'causa_58', 'causa_71', 'linea_accion'],
      ['2026-02-17', '40', '150', '200', '5', '3', '2', '1', '0', '4', '2', '1', '2'],
      ['2026-02-18', '42', '80', '120', '2', '1', '0', '0', '1', '2', '0', '0', '0'],
    ]
    const wsEjemplo = XLSX.utils.aoa_to_sheet(ejemplo)
    wsEjemplo['!cols'] = [
      { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 10 }
    ]
    XLSX.utils.book_append_sheet(wb, wsEjemplo, 'Ejemplo')

    const plantilla = [
      ['fecha_procesamiento', 'ciclo', 'cantidad_acueducto', 'cantidad_energia', 'causa_13', 'causa_15', 'causa_16', 'causa_34', 'causa_36', 'causa_37', 'causa_58', 'causa_71', 'linea_accion'],
      []
    ]
    const wsPlantilla = XLSX.utils.aoa_to_sheet(plantilla)
    wsPlantilla['!cols'] = wsEjemplo['!cols']
    XLSX.utils.book_append_sheet(wb, wsPlantilla, 'Plantilla')

    XLSX.writeFile(wb, 'plantilla_ciclos_procesados.xlsx')
  }

  // Exportar datos actuales a Excel
  const exportarExcel = async () => {
    try {
      setExporting(true)
      let query = supabase.from('ciclos_procesados').select('*').order('fecha_procesamiento', { ascending: false })
      if (filters.fecha_desde) query = query.gte('fecha_procesamiento', filters.fecha_desde)
      if (filters.fecha_hasta) query = query.lte('fecha_procesamiento', filters.fecha_hasta)
      if (filters.ciclo) query = query.ilike('ciclo', `%${filters.ciclo}%`)

      const { data, error } = await query
      if (error) throw error

      const excelRows = data.map(r => ({
        'Fecha': r.fecha_procesamiento,
        'Ciclo': r.ciclo,
        'Acueducto': r.cantidad_acueducto,
        'Energía': r.cantidad_energia,
        'Total Procesado': r.total_procesado,
        'Causa 13': r.causa_13,
        'Causa 15': r.causa_15,
        'Causa 16': r.causa_16,
        'Causa 34': r.causa_34,
        'Causa 36': r.causa_36,
        'Causa 37': r.causa_37,
        'Causa 58': r.causa_58,
        'Causa 71': r.causa_71,
        'Línea Acción': r.linea_accion,
        'Total Órdenes': r.total_ordenes_causa,
        'Creado': new Date(r.created_at).toLocaleString('es-CO'),
        'Creado Por': r.creado_por_nombre || ''
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelRows)
      ws['!cols'] = [
        { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
        { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
        { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 },
        { wch: 20 }, { wch: 25 }
      ]
      XLSX.utils.book_append_sheet(wb, ws, 'Ciclos')

      let nombre = 'ciclos_procesados'
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

  // Guardar un registro individual
  async function guardarItem() {
    setLoading(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      const data = { ...formData, creado_por_id: user?.id, creado_por_nombre: user?.email }
      let error
      if (editingId) {
        ({ error } = await supabase.from('ciclos_procesados').update(data).eq('id', editingId))
      } else {
        ({ error } = await supabase.from('ciclos_procesados').insert([data]))
      }
      if (error) throw error

      setFormData({
        fecha_procesamiento: obtenerFechaColombia(),
        ciclo: '',
        cantidad_acueducto: 0,
        cantidad_energia: 0,
        causa_13: 0,
        causa_15: 0,
        causa_16: 0,
        causa_34: 0,
        causa_36: 0,
        causa_37: 0,
        causa_58: 0,
        causa_71: 0,
        linea_accion: 0
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

  // Cargar desde Excel
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
        'fecha_procesamiento': 0,
        'ciclo': 1,
        'cantidad_acueducto': 2,
        'cantidad_energia': 3,
        'causa_13': 4,
        'causa_15': 5,
        'causa_16': 6,
        'causa_34': 7,
        'causa_36': 8,
        'causa_37': 9,
        'causa_58': 10,
        'causa_71': 11,
        'linea_accion': 12
      }

      const parsed = dataRows.map(row => ({
        fecha_procesamiento: row[colMap['fecha_procesamiento']] || obtenerFechaColombia(),
        ciclo: row[colMap['ciclo']] || '',
        cantidad_acueducto: parseInt(row[colMap['cantidad_acueducto']]) || 0,
        cantidad_energia: parseInt(row[colMap['cantidad_energia']]) || 0,
        causa_13: parseInt(row[colMap['causa_13']]) || 0,
        causa_15: parseInt(row[colMap['causa_15']]) || 0,
        causa_16: parseInt(row[colMap['causa_16']]) || 0,
        causa_34: parseInt(row[colMap['causa_34']]) || 0,
        causa_36: parseInt(row[colMap['causa_36']]) || 0,
        causa_37: parseInt(row[colMap['causa_37']]) || 0,
        causa_58: parseInt(row[colMap['causa_58']]) || 0,
        causa_71: parseInt(row[colMap['causa_71']]) || 0,
        linea_accion: parseInt(row[colMap['linea_accion']]) || 0
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
      
      const { error } = await supabase
        .from('ciclos_procesados')
        .upsert(toInsert, { onConflict: 'fecha_procesamiento, ciclo' })

      if (error) throw error
      setShowExcelModal(false)
      setExcelData([])
      setExcelPreview([])
      await cargarItems()
      await cargarEstadisticas()
      alert(`✅ ${toInsert.length} registros cargados/actualizados`)
    } catch (error) {
      console.error('Error guardando Excel:', error)
      alert('Error al cargar Excel')
    } finally {
      setLoading(false)
    }
  }

  function editar(item) {
    setFormData({
      fecha_procesamiento: item.fecha_procesamiento,
      ciclo: item.ciclo || '',
      cantidad_acueducto: Number(item.cantidad_acueducto) || 0,
      cantidad_energia: Number(item.cantidad_energia) || 0,
      causa_13: Number(item.causa_13) || 0,
      causa_15: Number(item.causa_15) || 0,
      causa_16: Number(item.causa_16) || 0,
      causa_34: Number(item.causa_34) || 0,
      causa_36: Number(item.causa_36) || 0,
      causa_37: Number(item.causa_37) || 0,
      causa_58: Number(item.causa_58) || 0,
      causa_71: Number(item.causa_71) || 0,
      linea_accion: Number(item.linea_accion) || 0,
    })
    setEditingId(item.id)
    setShowForm(true)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este registro?')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('ciclos_procesados').delete().eq('id', id)
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
    setFilters({ fecha_desde: '', fecha_hasta: '', ciclo: '' })
    setPage(1)
  }

  return (
    <div className="page">
      <header className="topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>Ciclos Procesados y Órdenes Generadas</h1>
        {rol === 'admin' && <span className="user-role">Admin</span>}
      </header>

      {/* Tarjetas de resumen */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#dbeafe' }}>✅</div>
          <div className="stat-info">
            <div className="stat-label">Total Procesado</div>
            <div className="stat-value">{stats.totalProcesado.toLocaleString()}</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#fee2e2' }}>📋</div>
          <div className="stat-info">
            <div className="stat-label">Total Órdenes</div>
            <div className="stat-value">{stats.totalOrdenes.toLocaleString()}</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#fef3c7' }}>📊</div>
          <div className="stat-info">
            <div className="stat-label">Registros</div>
            <div className="stat-value">{stats.total}</div>
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
        <button className="action-btn primary" onClick={() => { setFormData({ ...formData, fecha_procesamiento: obtenerFechaColombia() }); setEditingId(null); setShowForm(true); }}>
          + Nuevo Registro
        </button>
      </div>

      {/* Modal de estadísticas */}
      {showStatsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 1200, maxHeight: '90vh' }}>
            <div className="modal-header">
              <h2>📊 Estadísticas de Ciclos</h2>
              <button className="close-btn" onClick={() => setShowStatsModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <div className="charts-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                
                {/* Gráfico 1: Cantidad por servicio (Acueducto vs Energía) */}
                <div className="dashboard-card">
                  <h3>🔧 Cantidad por Servicio</h3>
                  <div style={{ height: 300, display: 'flex', justifyContent: 'center' }}>
                    <ResponsiveContainer width="70%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Acueducto', value: stats.totalAcueducto },
                            { name: 'Energía', value: stats.totalEnergia }
                          ]}
                          cx="50%" cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          dataKey="value"
                          label={entry => entry.name}
                        >
                          <Cell fill="#3b82f6" />
                          <Cell fill="#f59e0b" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico 2: Órdenes generadas por mes */}
                <div className="dashboard-card">
                  <h3>📈 Órdenes Generadas por Mes</h3>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.ordenesPorMes}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="ordenes" stroke="#10b981" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico 3: Comparativo de causas (mes actual vs anterior) */}
                <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
                  <h3>🔄 Comparativo de Causas (último mes vs anterior)</h3>
                  <div style={{ height: 350 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.comparativoCausas}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="causa" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="actual" stroke="#3b82f6" name="Mes actual" strokeWidth={2} />
                        <Line type="monotone" dataKey="anterior" stroke="#94a3b8" name="Mes anterior" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico 4: Registros por Día (últimos 30) - con escala de tiempo */}
                <div className="dashboard-card">
                  <h3>📅 Registros por Día (últimos 30)</h3>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.porDia} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="fecha"
                          type="number"
                          scale="time"
                          domain={['auto', 'auto']}
                          tickFormatter={(date) => {
                            const d = new Date(date);
                            return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                          }}
                          interval={0}
                          angle={-60}
                          textAnchor="end"
                          height={80}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis allowDecimals={false} />
                        <Tooltip
                          labelFormatter={(label) => {
                            const d = new Date(label);
                            return `Fecha: ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                          }}
                          formatter={(value) => [`${value} registros`, 'Cantidad']}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="cantidad" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico 5: Registros por Mes */}
                <div className="dashboard-card">
                  <h3>📊 Registros por Mes</h3>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.porMes}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#f97316" radius={[4,4,0,0]} />
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
                    <tr><th>Fecha</th><th>Ciclo</th><th>Acueducto</th><th>Energía</th><th>Línea Acción</th></tr>
                  </thead>
                  <tbody>
                    {excelPreview.map((r,i) => (
                      <tr key={i}><td>{r.fecha_procesamiento}</td><td>{r.ciclo}</td><td>{r.cantidad_acueducto}</td><td>{r.cantidad_energia}</td><td>{r.linea_accion}</td></tr>
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
              <div className="form-tabs">
                <div className="tab active">Datos del Ciclo</div>
              </div>
              <div className="form-section">
                <h3>📋 Información general</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Fecha de Procesamiento *</label>
                    <input type="date" value={formData.fecha_procesamiento} onChange={e => setFormData({...formData, fecha_procesamiento: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Ciclo</label>
                    <input type="text" value={formData.ciclo} onChange={e => setFormData({...formData, ciclo: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="form-section">
                <h3>🔢 Cantidades Procesadas</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Acueducto</label>
                    <input type="number" min="0" value={formData.cantidad_acueducto} onChange={e => setFormData({...formData, cantidad_acueducto: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="form-group">
                    <label>Energía</label>
                    <input type="number" min="0" value={formData.cantidad_energia} onChange={e => setFormData({...formData, cantidad_energia: parseInt(e.target.value) || 0})} />
                  </div>
                </div>
              </div>
              <div className="form-section">
                <h3>📌 Órdenes por Causas</h3>
                <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  <div className="form-group"><label>Causa 13</label><input type="number" min="0" value={formData.causa_13} onChange={e => setFormData({...formData, causa_13: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Causa 15</label><input type="number" min="0" value={formData.causa_15} onChange={e => setFormData({...formData, causa_15: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Causa 16</label><input type="number" min="0" value={formData.causa_16} onChange={e => setFormData({...formData, causa_16: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Causa 34</label><input type="number" min="0" value={formData.causa_34} onChange={e => setFormData({...formData, causa_34: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Causa 36</label><input type="number" min="0" value={formData.causa_36} onChange={e => setFormData({...formData, causa_36: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Causa 37</label><input type="number" min="0" value={formData.causa_37} onChange={e => setFormData({...formData, causa_37: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Causa 58</label><input type="number" min="0" value={formData.causa_58} onChange={e => setFormData({...formData, causa_58: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Causa 71</label><input type="number" min="0" value={formData.causa_71} onChange={e => setFormData({...formData, causa_71: parseInt(e.target.value) || 0})} /></div>
                </div>
              </div>
              <div className="form-section">
                <h3>📝 Línea de Acción</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Línea de Acción (cantidad)</label>
                    <input type="number" min="0" value={formData.linea_accion} onChange={e => setFormData({...formData, linea_accion: parseInt(e.target.value) || 0})} />
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
        <input type="text" placeholder="Ciclo" value={filters.ciclo} onChange={e => setFilters({...filters, ciclo: e.target.value, page:1})} />
        <button onClick={resetFilters}>Limpiar</button>
      </div>

      {/* Tabla de resultados */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>Ciclo</th><th>Acueducto</th><th>Energía</th><th>Total Proc.</th>
              <th>C13</th><th>C15</th><th>C16</th><th>C34</th><th>C36</th><th>C37</th><th>C58</th><th>C71</th><th>Línea Acc.</th><th>Total Órd.</th>
              {rol === 'admin' && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>{item.fecha_procesamiento}</td>
                <td>{item.ciclo}</td>
                <td>{item.cantidad_acueducto}</td>
                <td>{item.cantidad_energia}</td>
                <td><strong>{item.total_procesado}</strong></td>
                <td>{item.causa_13}</td>
                <td>{item.causa_15}</td>
                <td>{item.causa_16}</td>
                <td>{item.causa_34}</td>
                <td>{item.causa_36}</td>
                <td>{item.causa_37}</td>
                <td>{item.causa_58}</td>
                <td>{item.causa_71}</td>
                <td>{item.linea_accion}</td>
                <td><strong>{item.total_ordenes_causa}</strong></td>
                {rol === 'admin' && (
                  <td>
                    <button className="icon-btn" onClick={() => editar(item)} style={{ marginRight:8 }}>✏️</button>
                    <button className="icon-btn" onClick={() => eliminar(item.id)}>🗑️</button>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={rol==='admin'?16:15} style={{textAlign:'center', padding:40}}>No hay registros</td></tr>
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