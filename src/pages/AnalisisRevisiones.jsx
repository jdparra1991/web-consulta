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
const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

const GESTORES = ['Aylin Estefani Maje', 'Diego Hernandez', 'Andres Arboleda']
const TIPOS_REVISION = ['Critica', 'Pqr']

// Definición de los campos que suman al total (causas + lecturas)
const CAMPOS_TOTAL = [
  { id: 'causa_13', nombre: 'Causa 13' },
  { id: 'causa_15', nombre: 'Causa 15' },
  { id: 'causa_16', nombre: 'Causa 16' },
  { id: 'causa_34', nombre: 'Causa 34' },
  { id: 'causa_36', nombre: 'Causa 36' },
  { id: 'causa_37', nombre: 'Causa 37' },
  { id: 'causa_58', nombre: 'Causa 58' },
  { id: 'causa_71', nombre: 'Causa 71' },
  { id: 'cantidad_lectura_observacion', nombre: 'Lectura/Observación' }
]

// Campos de distribución por empresa
const CAMPOS_EMPRESA = [
  { id: 'cantidad_emcali', nombre: 'Emcali' },
  { id: 'cantidad_consorcio', nombre: 'Consorcio' }
]

// Campos de conformidad
const CAMPOS_CONFORMIDAD = [
  { id: 'cantidad_conformes', nombre: 'Conformes' },
  { id: 'cantidad_inconsistencias', nombre: 'Inconsistencias' }
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

export default function AnalisisRevisiones({ onBack, rol }) {
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
    totalGeneral: 0,
    porCiclo: [],
    porTipo: [],
    porGestor: []
  })
  const [filters, setFilters] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    ciclo: '',
    gestor: ''
  })
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Formulario con todos los campos
  const [formData, setFormData] = useState({
    fecha_revision: obtenerFechaColombia(),
    ciclo: '',
    tipo_revision: '', // NUEVO CAMPO
    causa_13: 0,
    causa_15: 0,
    causa_16: 0,
    causa_34: 0,
    causa_36: 0,
    causa_37: 0,
    causa_58: 0,
    causa_71: 0,
    cantidad_lectura_observacion: 0,
    cantidad_emcali: 0,
    cantidad_consorcio: 0,
    cantidad_conformes: 0,
    cantidad_inconsistencias: 0,
    analizado_por: ''
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
        .from('analisis_revisiones')
        .select('*', { count: 'exact' })
        .order('fecha_revision', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filters.fecha_desde) query = query.gte('fecha_revision', filters.fecha_desde)
      if (filters.fecha_hasta) query = query.lte('fecha_revision', filters.fecha_hasta)
      if (filters.ciclo) query = query.ilike('ciclo', `%${filters.ciclo}%`)
      if (filters.gestor) query = query.eq('analizado_por', filters.gestor)

      const { data, count, error } = await query
      if (error) throw error
      setItems(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error cargando análisis de revisiones:', error)
    } finally {
      setLoading(false)
    }
  }

  async function cargarEstadisticas() {
    try {
      // Datos del período filtrado
      let query = supabase
        .from('analisis_revisiones')
        .select('ciclo, analizado_por, ' + 
          [...CAMPOS_TOTAL, ...CAMPOS_EMPRESA, ...CAMPOS_CONFORMIDAD].map(c => c.id).join(','))
      if (filters.fecha_desde) query = query.gte('fecha_revision', filters.fecha_desde)
      if (filters.fecha_hasta) query = query.lte('fecha_revision', filters.fecha_hasta)
      if (filters.ciclo) query = query.ilike('ciclo', `%${filters.ciclo}%`)
      if (filters.gestor) query = query.eq('analizado_por', filters.gestor)

      const { data, error } = await query
      if (error) throw error

      let totalGeneral = 0
      const porCiclo = {}
      const porTipo = {}
      const porGestor = {}

      data?.forEach(r => {
        // Suma solo los campos que definen el total
        let sumaRegistro = 0
        CAMPOS_TOTAL.forEach(c => {
          const valor = r[c.id] || 0
          sumaRegistro += valor
          if (!porTipo[c.id]) porTipo[c.id] = 0
          porTipo[c.id] += valor
        })
        totalGeneral += sumaRegistro

        // Por ciclo
        if (r.ciclo) {
          if (!porCiclo[r.ciclo]) porCiclo[r.ciclo] = 0
          porCiclo[r.ciclo] += sumaRegistro
        }

        // Por gestor
        if (r.analizado_por) {
          if (!porGestor[r.analizado_por]) porGestor[r.analizado_por] = 0
          porGestor[r.analizado_por] += sumaRegistro
        }

        // Para los otros campos (empresa y conformidad) también los acumulamos para el gráfico por tipo
        CAMPOS_EMPRESA.concat(CAMPOS_CONFORMIDAD).forEach(c => {
          const valor = r[c.id] || 0
          if (!porTipo[c.id]) porTipo[c.id] = 0
          porTipo[c.id] += valor
        })
      })

      setStats({
        totalRegistros: data?.length || 0,
        totalGeneral,
        porCiclo: Object.entries(porCiclo).map(([c, v]) => ({ ciclo: c, cantidad: v })),
        porTipo: [...CAMPOS_TOTAL, ...CAMPOS_EMPRESA, ...CAMPOS_CONFORMIDAD].map(c => ({ 
          nombre: c.nombre, 
          cantidad: porTipo[c.id] || 0 
        })),
        porGestor: Object.entries(porGestor).map(([g, v]) => ({ gestor: g, cantidad: v }))
      })
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

  // Plantilla Excel
  const descargarPlantilla = () => {
    const wb = XLSX.utils.book_new()

    const instructivo = [
      ['INSTRUCTIVO PARA CARGA DE ANÁLISIS DE REVISIONES'],
      [''],
      ['1. FORMATO DE FECHAS: YYYY-MM-DD (ej: 2026-02-17)'],
      ['2. CAMPOS NUMÉRICOS: Solo números enteros'],
      ['3. COLUMNAS (en este orden):'],
      ['   • fecha_revision (fecha)'],
      ['   • ciclo (texto)'],
      ['   • tipo_revision (Critica / Pqr)'], // NUEVO
      ['   • causa_13 (número)'],
      ['   • causa_15 (número)'],
      ['   • causa_16 (número)'],
      ['   • causa_34 (número)'],
      ['   • causa_36 (número)'],
      ['   • causa_37 (número)'],
      ['   • causa_58 (número)'],
      ['   • causa_71 (número)'],
      ['   • cantidad_lectura_observacion (número)'],
      ['   • cantidad_emcali (número)'],
      ['   • cantidad_consorcio (número)'],
      ['   • cantidad_conformes (número)'],
      ['   • cantidad_inconsistencias (número)'],
      ['   • analizado_por (Gestor 1, Gestor 2, Gestor 3)'],
      [''],
      ['4. NOTA: El total general se calcula automáticamente como la suma de las causas más lectura/observación.'],
      ['   Los campos Emcali, Consorcio, Conformes e Inconsistencias son subconjuntos de ese total.'],
    ]
    const wsInstructivo = XLSX.utils.aoa_to_sheet(instructivo)
    wsInstructivo['!cols'] = [{ wch: 80 }]
    XLSX.utils.book_append_sheet(wb, wsInstructivo, 'Instructivo')

    const ejemplo = [
      ['fecha_revision', 'ciclo', 'tipo_revision', 'causa_13', 'causa_15', 'causa_16', 'causa_34', 'causa_36', 'causa_37', 'causa_58', 'causa_71', 'cantidad_lectura_observacion', 'cantidad_emcali', 'cantidad_consorcio', 'cantidad_conformes', 'cantidad_inconsistencias', 'analizado_por'],
      ['2026-02-17', '40', 'Critica', '5', '3', '2', '1', '0', '4', '2', '1', '10', '5', '3', '20', '2', 'Gestor 1'],
      ['2026-02-18', '42', 'Pqr', '2', '1', '0', '0', '1', '2', '0', '0', '8', '2', '1', '15', '3', 'Gestor 2'],
    ]
    const wsEjemplo = XLSX.utils.aoa_to_sheet(ejemplo)
    wsEjemplo['!cols'] = Array(17).fill({ wch: 15 })
    XLSX.utils.book_append_sheet(wb, wsEjemplo, 'Ejemplo')

    const plantilla = [ejemplo[0], []]
    const wsPlantilla = XLSX.utils.aoa_to_sheet(plantilla)
    wsPlantilla['!cols'] = wsEjemplo['!cols']
    XLSX.utils.book_append_sheet(wb, wsPlantilla, 'Plantilla')

    XLSX.writeFile(wb, 'plantilla_analisis_revisiones.xlsx')
  }

  // Exportar datos actuales a Excel
  const exportarExcel = async () => {
    try {
      setExporting(true)
      let query = supabase.from('analisis_revisiones').select('*').order('fecha_revision', { ascending: false })
      if (filters.fecha_desde) query = query.gte('fecha_revision', filters.fecha_desde)
      if (filters.fecha_hasta) query = query.lte('fecha_revision', filters.fecha_hasta)
      if (filters.ciclo) query = query.ilike('ciclo', `%${filters.ciclo}%`)
      if (filters.gestor) query = query.eq('analizado_por', filters.gestor)

      const { data, error } = await query
      if (error) throw error

      const excelRows = data.map(r => ({
        'Fecha Revisión': r.fecha_revision,
        'Ciclo': r.ciclo,
        'Tipo Revisión': r.tipo_revision || '', // NUEVO
        'Causa 13': r.causa_13,
        'Causa 15': r.causa_15,
        'Causa 16': r.causa_16,
        'Causa 34': r.causa_34,
        'Causa 36': r.causa_36,
        'Causa 37': r.causa_37,
        'Causa 58': r.causa_58,
        'Causa 71': r.causa_71,
        'Lectura/Obs': r.cantidad_lectura_observacion,
        'Emcali': r.cantidad_emcali,
        'Consorcio': r.cantidad_consorcio,
        'Conformes': r.cantidad_conformes,
        'Inconsistencias': r.cantidad_inconsistencias,
        'Total General': r.total_general,
        'Analizado Por': r.analizado_por,
        'Creado': new Date(r.created_at).toLocaleString('es-CO'),
        'Creado Por': r.creado_por_nombre || ''
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelRows)
      XLSX.utils.book_append_sheet(wb, ws, 'AnalisisRevisiones')

      let nombre = 'analisis_revisiones'
      if (filters.fecha_desde || filters.fecha_hasta) nombre += `_${filters.fecha_desde || 'inicio'}_${filters.fecha_hasta || 'fin'}`
      if (filters.ciclo) nombre += `_ciclo_${filters.ciclo}`
      if (filters.gestor) nombre += `_${filters.gestor.replace(' ', '')}`
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

  // Guardar un registro individual con validaciones
  async function guardarItem() {
    setLoading(true)
    try {
      // Calcular total actual (solo causas + lecturas)
      const totalCalculado = 
        (formData.causa_13 || 0) +
        (formData.causa_15 || 0) +
        (formData.causa_16 || 0) +
        (formData.causa_34 || 0) +
        (formData.causa_36 || 0) +
        (formData.causa_37 || 0) +
        (formData.causa_58 || 0) +
        (formData.causa_71 || 0) +
        (formData.cantidad_lectura_observacion || 0)

      // Validar que Emcali + Consorcio no excedan el total
      const sumaEmpresa = (formData.cantidad_emcali || 0) + (formData.cantidad_consorcio || 0)
      if (sumaEmpresa > totalCalculado) {
        alert('La suma de Emcali y Consorcio no puede ser mayor que el total de causas + lecturas')
        setLoading(false)
        return
      }

      // Validar que Conformes + Inconsistencias no excedan el total
      const sumaConformidad = (formData.cantidad_conformes || 0) + (formData.cantidad_inconsistencias || 0)
      if (sumaConformidad > totalCalculado) {
        alert('La suma de Conformes e Inconsistencias no puede ser mayor que el total de causas + lecturas')
        setLoading(false)
        return
      }

      const user = (await supabase.auth.getUser()).data.user
      const data = {
        ...formData,
        creado_por_id: user?.id,
        creado_por_nombre: user?.email
      }
      let error
      if (editingId) {
        ({ error } = await supabase.from('analisis_revisiones').update(data).eq('id', editingId))
      } else {
        ({ error } = await supabase.from('analisis_revisiones').insert([data]))
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
        'fecha_revision': 0,
        'ciclo': 1,
        'tipo_revision': 2, // NUEVO
        'causa_13': 3,
        'causa_15': 4,
        'causa_16': 5,
        'causa_34': 6,
        'causa_36': 7,
        'causa_37': 8,
        'causa_58': 9,
        'causa_71': 10,
        'cantidad_lectura_observacion': 11,
        'cantidad_emcali': 12,
        'cantidad_consorcio': 13,
        'cantidad_conformes': 14,
        'cantidad_inconsistencias': 15,
        'analizado_por': 16
      }

      const parsed = dataRows.map(row => ({
        fecha_revision: row[colMap['fecha_revision']] || obtenerFechaColombia(),
        ciclo: row[colMap['ciclo']] || '',
        tipo_revision: row[colMap['tipo_revision']] || '', // NUEVO
        causa_13: parseInt(row[colMap['causa_13']]) || 0,
        causa_15: parseInt(row[colMap['causa_15']]) || 0,
        causa_16: parseInt(row[colMap['causa_16']]) || 0,
        causa_34: parseInt(row[colMap['causa_34']]) || 0,
        causa_36: parseInt(row[colMap['causa_36']]) || 0,
        causa_37: parseInt(row[colMap['causa_37']]) || 0,
        causa_58: parseInt(row[colMap['causa_58']]) || 0,
        causa_71: parseInt(row[colMap['causa_71']]) || 0,
        cantidad_lectura_observacion: parseInt(row[colMap['cantidad_lectura_observacion']]) || 0,
        cantidad_emcali: parseInt(row[colMap['cantidad_emcali']]) || 0,
        cantidad_consorcio: parseInt(row[colMap['cantidad_consorcio']]) || 0,
        cantidad_conformes: parseInt(row[colMap['cantidad_conformes']]) || 0,
        cantidad_inconsistencias: parseInt(row[colMap['cantidad_inconsistencias']]) || 0,
        analizado_por: row[colMap['analizado_por']] || ''
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
        .from('analisis_revisiones')
        .insert(toInsert)

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
    setFormData(item)
    setEditingId(item.id)
    setShowForm(true)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este registro?')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('analisis_revisiones').delete().eq('id', id)
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
      fecha_revision: obtenerFechaColombia(),
      ciclo: '',
      tipo_revision: '', // NUEVO
      causa_13: 0,
      causa_15: 0,
      causa_16: 0,
      causa_34: 0,
      causa_36: 0,
      causa_37: 0,
      causa_58: 0,
      causa_71: 0,
      cantidad_lectura_observacion: 0,
      cantidad_emcali: 0,
      cantidad_consorcio: 0,
      cantidad_conformes: 0,
      cantidad_inconsistencias: 0,
      analizado_por: ''
    })
  }

  const resetFilters = () => {
    setFilters({ fecha_desde: '', fecha_hasta: '', ciclo: '', gestor: '' })
    setPage(1)
  }

  return (
    <div className="page">
      <header className="topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>Análisis de Revisiones</h1>
        {rol === 'admin' && <span className="user-role">Admin</span>}
      </header>

      {/* Tarjetas de resumen */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#dbeafe' }}>📊</div>
          <div className="stat-info">
            <div className="stat-label">Total Registros</div>
            <div className="stat-value">{stats.totalRegistros}</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#fee2e2' }}>🔢</div>
          <div className="stat-info">
            <div className="stat-label">Total Causas + Lecturas</div>
            <div className="stat-value">{formatearNumero(stats.totalGeneral)}</div>
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
          + Nuevo Análisis
        </button>
      </div>

      {/* Modal de estadísticas */}
      {showStatsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 1200, maxHeight: '90vh' }}>
            <div className="modal-header">
              <h2>📊 Estadísticas de Análisis de Revisiones</h2>
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
                        <Bar dataKey="cantidad" fill="#3b82f6" radius={[4,4,0,0]}>
                          <LabelList dataKey="cantidad" position="top" formatter={formatearNumero} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico: Cantidad por Tipo */}
                <div className="dashboard-card">
                  <h3>📊 Cantidad por Tipo</h3>
                  <div style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.porTipo}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="nombre" angle={-45} textAnchor="end" height={100} interval={0} tick={{ fontSize: 10 }} />
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

                {/* Gráfico: Cantidad por Gestor */}
                <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
                  <h3>👥 Cantidad por Gestor</h3>
                  <div style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.porGestor}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="gestor" />
                        <YAxis tickFormatter={formatearNumero} />
                        <Tooltip formatter={(value) => formatearNumero(value)} />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#10b981" radius={[4,4,0,0]}>
                          <LabelList dataKey="cantidad" position="top" formatter={formatearNumero} />
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
                    <tr><th>Fecha</th><th>Ciclo</th><th>Tipo</th><th>Analizado por</th></tr>
                  </thead>
                  <tbody>
                    {excelPreview.map((r,i) => (
                      <tr key={i}>
                        <td>{r.fecha_revision}</td>
                        <td>{r.ciclo}</td>
                        <td>{r.tipo_revision}</td>
                        <td>{r.analizado_por}</td>
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
              <h2>{editingId ? 'Editar Análisis' : 'Nuevo Análisis'}</h2>
              <button className="close-btn" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="form-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="form-tabs">
                <div className="tab active">Datos del Análisis</div>
              </div>
              <div className="form-section">
                <h3>📋 Información</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Fecha Revisión</label>
                    <input type="date" value={formData.fecha_revision} onChange={e => setFormData({...formData, fecha_revision: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Ciclo</label>
                    <input type="text" value={formData.ciclo} onChange={e => setFormData({...formData, ciclo: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Tipo Revisión</label> {/* NUEVO */}
                    <select value={formData.tipo_revision} onChange={e => setFormData({...formData, tipo_revision: e.target.value})}>
                      <option value="">Seleccionar</option>
                      {TIPOS_REVISION.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Analizado Por</label>
                    <select value={formData.analizado_por} onChange={e => setFormData({...formData, analizado_por: e.target.value})}>
                      <option value="">Seleccionar</option>
                      {GESTORES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="form-section">
                <h3>🔢 Causas</h3>
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
                <h3>📖 Lectura/Observación</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Lectura/Observación</label>
                    <input type="number" min="0" value={formData.cantidad_lectura_observacion} onChange={e => setFormData({...formData, cantidad_lectura_observacion: parseInt(e.target.value) || 0})} />
                  </div>
                </div>
              </div>
              <div className="form-section">
                <h3>🏢 Distribución por Empresa</h3>
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="form-group"><label>Emcali</label><input type="number" min="0" value={formData.cantidad_emcali} onChange={e => setFormData({...formData, cantidad_emcali: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Consorcio</label><input type="number" min="0" value={formData.cantidad_consorcio} onChange={e => setFormData({...formData, cantidad_consorcio: parseInt(e.target.value) || 0})} /></div>
                </div>
              </div>
              <div className="form-section">
                <h3>✅ Calidad</h3>
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="form-group"><label>Conformes</label><input type="number" min="0" value={formData.cantidad_conformes} onChange={e => setFormData({...formData, cantidad_conformes: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Inconsistencias</label><input type="number" min="0" value={formData.cantidad_inconsistencias} onChange={e => setFormData({...formData, cantidad_inconsistencias: parseInt(e.target.value) || 0})} /></div>
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
        <select value={filters.gestor} onChange={e => setFilters({...filters, gestor: e.target.value, page:1})}>
          <option value="">Todos los gestores</option>
          {GESTORES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <button onClick={resetFilters}>Limpiar</button>
      </div>

      {/* Tabla de resultados */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>Ciclo</th><th>Tipo</th> {/* NUEVA COLUMNA */}
              <th>C13</th><th>C15</th><th>C16</th><th>C34</th><th>C36</th><th>C37</th><th>C58</th><th>C71</th>
              <th>Lect/Obs</th><th>Emcali</th><th>Consorcio</th><th>Conformes</th><th>Inconsist</th>
              <th>Total</th><th>Analizado por</th>
              {rol === 'admin' && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const total = (item.causa_13 || 0) + (item.causa_15 || 0) + (item.causa_16 || 0) + (item.causa_34 || 0) +
                            (item.causa_36 || 0) + (item.causa_37 || 0) + (item.causa_58 || 0) + (item.causa_71 || 0) +
                            (item.cantidad_lectura_observacion || 0)
              return (
                <tr key={item.id}>
                  <td>{item.fecha_revision}</td>
                  <td>{item.ciclo}</td>
                  <td>{item.tipo_revision || '-'}</td> {/* NUEVO */}
                  <td>{item.causa_13}</td>
                  <td>{item.causa_15}</td>
                  <td>{item.causa_16}</td>
                  <td>{item.causa_34}</td>
                  <td>{item.causa_36}</td>
                  <td>{item.causa_37}</td>
                  <td>{item.causa_58}</td>
                  <td>{item.causa_71}</td>
                  <td>{item.cantidad_lectura_observacion}</td>
                  <td>{item.cantidad_emcali}</td>
                  <td>{item.cantidad_consorcio}</td>
                  <td>{item.cantidad_conformes}</td>
                  <td>{item.cantidad_inconsistencias}</td>
                  <td><strong>{total}</strong></td>
                  <td>{item.analizado_por}</td>
                  {rol === 'admin' && (
                    <td>
                      <button className="icon-btn" onClick={() => editar(item)} style={{ marginRight:8 }}>✏️</button>
                      <button className="icon-btn" onClick={() => eliminar(item.id)}>🗑️</button>
                    </td>
                  )}
                </tr>
              )
            })}
            {items.length === 0 && (
              <tr><td colSpan={rol==='admin'?19:18} style={{textAlign:'center', padding:40}}>No hay registros</td></tr>
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