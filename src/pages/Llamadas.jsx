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

const RESULTADOS_LLAMADA = [
  'SE CONCRETA VISITA',
  'REPROGRAMADA',
  'TELEFONO DAÑADO U OCUPADO',
  'Número equivocado',
  'NUMERO ERRADO',
  'BUZON LLENO ',
  'BUZON DE MENSAJE',
  'CLIENTE NO CUENTA CON DISPONIBILIDAD',
  'SIN DATOS',
  'NO CONTESTA'
]

const GESTORES = [
  'Paula Andrea Pareja',
  'Katerin Rincon Valencia',
  'Aylin Estefani Maje',
  'Diejo Javier Marmolejo',
  'Carlos Enriqez',
  'Lady Laura Bolaños'
]

const SERVICIOS = [
  'Acueducto',
  'Energía',
  'Otro'
]

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']

// Función para formatear números
const formatearNumero = (num) => new Intl.NumberFormat('es-CO').format(num || 0)

export default function Llamadas({ onBack, rol }) {
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
    porResultado: [],
    porGestor: []
  })
  const [filters, setFilters] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    ciclo: '',
    gestor: '',
    resultado: ''
  })
  const [selectedMonth, setSelectedMonth] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Formulario
  const [formData, setFormData] = useState({
    ciclo: '',
    orden: '',
    cliente: '',
    nombre_reclamante: '',
    telefono: '',
    fecha_visita_programada: '',
    servicio: '',
    fecha_gestion: new Date().toISOString().split('T')[0],
    gestor: '',
    nombre_suscriptor: '',
    direccion_predio: '',
    fecha_llamada: '',
    hora_primera_llamada: '',
    hora_segunda_llamada: '',
    persona_atiende: '',
    resultado_llamada: '',
    comentario: ''
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
        .from('llamadas')
        .select('*', { count: 'exact' })
        .order('fecha_gestion', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filters.fecha_desde) query = query.gte('fecha_gestion', filters.fecha_desde)
      if (filters.fecha_hasta) query = query.lte('fecha_gestion', filters.fecha_hasta)
      if (filters.ciclo) query = query.ilike('ciclo', `%${filters.ciclo}%`)
      if (filters.gestor) query = query.ilike('gestor', `%${filters.gestor}%`)
      if (filters.resultado) query = query.eq('resultado_llamada', filters.resultado)

      const { data, count, error } = await query
      if (error) throw error
      setItems(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error cargando llamadas:', error)
    } finally {
      setLoading(false)
    }
  }

  async function cargarEstadisticas() {
    try {
      // Función para construir la consulta base con todos los filtros (sin ejecutar)
      const buildBaseQuery = () => {
        let query = supabase.from('llamadas').select('*')
        if (filters.fecha_desde) query = query.gte('fecha_gestion', filters.fecha_desde)
        if (filters.fecha_hasta) query = query.lte('fecha_gestion', filters.fecha_hasta)
        if (filters.ciclo) query = query.ilike('ciclo', `%${filters.ciclo}%`)
        if (filters.gestor) query = query.ilike('gestor', `%${filters.gestor}%`)
        if (filters.resultado) query = query.eq('resultado_llamada', filters.resultado)
        return query
      }

      // --- GRÁFICO POR MES (filtrado) ---
      const queryMes = buildBaseQuery().select('fecha_gestion')
      const { data: datosMes } = await queryMes
      const porMes = {}
      const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
      datosMes?.forEach(r => {
        if (!r.fecha_gestion) return
        const fecha = new Date(r.fecha_gestion)
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}`
        const label = `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`
        if (!porMes[key]) porMes[key] = { mes: label, cantidad: 0, key }
        porMes[key].cantidad++
      })
      const porMesArray = Object.values(porMes)
        .sort((a,b) => a.key.localeCompare(b.key))
        .slice(-12) // últimos 12 meses dentro del filtro

      // --- GRÁFICO POR DÍA (todos los días del filtro) ---
      const queryDia = buildBaseQuery().select('fecha_gestion')
      const { data: datosDia } = await queryDia
      const porDia = {}
      datosDia?.forEach(r => {
        if (r.fecha_gestion) porDia[r.fecha_gestion] = (porDia[r.fecha_gestion] || 0) + 1
      })
      const porDiaArray = Object.entries(porDia)
        .map(([fecha, cantidad]) => ({ fecha, cantidad }))
        .sort((a,b) => a.fecha.localeCompare(b.fecha))

      // --- GRÁFICO POR RESULTADO ---
      const queryResultado = buildBaseQuery().select('resultado_llamada').not('resultado_llamada', 'is', null)
      const { data: datosResultado } = await queryResultado
      const porResultado = {}
      datosResultado?.forEach(r => {
        porResultado[r.resultado_llamada] = (porResultado[r.resultado_llamada] || 0) + 1
      })
      const porResultadoArray = Object.entries(porResultado)
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a,b) => b.cantidad - a.cantidad)

      // --- GRÁFICO POR GESTOR (top 5) ---
      const queryGestor = buildBaseQuery().select('gestor').not('gestor', 'is', null)
      const { data: datosGestor } = await queryGestor
      const porGestor = {}
      datosGestor?.forEach(r => {
        porGestor[r.gestor] = (porGestor[r.gestor] || 0) + 1
      })
      const porGestorArray = Object.entries(porGestor)
        .map(([gestor, cantidad]) => ({ gestor, cantidad }))
        .sort((a,b) => b.cantidad - a.cantidad)
        .slice(0, 5)

      // --- TOTAL DE REGISTROS FILTRADOS ---
      const queryTotal = buildBaseQuery().select('*', { count: 'exact', head: true })
      const { count } = await queryTotal

      setStats({
        total: count || 0,
        porDia: porDiaArray,
        porMes: porMesArray,
        porResultado: porResultadoArray,
        porGestor: porGestorArray
      })
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

  // Función para descargar plantilla Excel con instructivo y ejemplo
  const descargarPlantilla = () => {
    const wb = XLSX.utils.book_new()

    // HOJA 1: INSTRUCTIVO
    const instructivo = [
      ['INSTRUCTIVO PARA CARGA DE LLAMADAS'],
      [''],
      ['1. FORMATO DE FECHAS:'],
      ['   • Fecha de gestión (principal): YYYY-MM-DD (ej: 2026-02-17)'],
      ['   • Fecha de visita programada: YYYY-MM-DD'],
      ['   • Fecha de llamada: YYYY-MM-DD (opcional, si se quiere registrar)'],
      [''],
      ['2. FORMATO DE HORAS:'],
      ['   • Hora primera llamada: HH:MM (formato 24h, ej: 14:30)'],
      ['   • Hora segunda llamada: HH:MM (opcional, dejar vacío si no aplica)'],
      [''],
      ['3. CAMPOS OBLIGATORIOS:'],
      ['   • Cliente o Nombre del reclamante (al menos uno)'],
      ['   • Teléfono'],
      ['   • Fecha de gestión'],
      ['   • Resultado de llamada'],
      [''],
      ['4. VALORES PERMITIDOS:'],
      ['   • Servicio: "Telecomunicaciones", "Servicios Públicos", "Ambos"'],
      ['   • Gestor: "Gestor 1", "Gestor 2", "Gestor 3", "Gestor 4", "Gestor 5", "Gestor 6"'],
      ['   • Resultado llamada: "Contestó", "No contestó", "Ocupado", "Número equivocado", "Prometió pago", "Solicitó información", "Rechazó llamada", "Otro"'],
      [''],
      ['5. NOTAS:'],
      ['   • No modificar los encabezados de columna.'],
      ['   • Las columnas vacías se ignorarán.'],
      ['   • Para la segunda llamada, si no se realiza, dejar la celda vacía.'],
    ]
    const wsInstructivo = XLSX.utils.aoa_to_sheet(instructivo)
    wsInstructivo['!cols'] = [{ wch: 80 }]
    XLSX.utils.book_append_sheet(wb, wsInstructivo, 'Instructivo')

    // HOJA 2: EJEMPLO CON DATOS
    const ejemplo = [
      ['CICLO', 'ORDEN', 'CLIENTE', 'NOMBRE DEL RECLAMANTE', 'TELEFONO', 
       'FECHA DE VISITA PROGRAMADA', 'SERVICIO', 'FECHA DE GESTION', 'GESTOR',
       'NOMBRE SUSCRIPTOR', 'DIRECCION PREDIO', 'FECHA DE LLAMADA',
       'HORA PRIMERA LLAMADA', 'HORA SEGUNDA LLAMADA', 'PERSONA QUE ATIENDE',
       'RESULTADO LLAMADA', 'COMENTARIO'],
      ['40', 'ORD-001', 'Cliente Ejemplo S.A.S.', 'Juan Pérez', '3001234567',
       '2026-02-17', 'Telecomunicaciones', '2026-02-17', 'Gestor 1',
       'María Gómez', 'Calle 123 #45-67', '2026-02-17',
       '10:30', '11:15', 'Juan Pérez',
       'Contestó', 'Cliente informó que pagará la próxima semana'],
      ['42', 'ORD-002', 'Empresa XYZ', 'Carlos Rodríguez', '3107654321',
       '2026-02-18', 'Servicios Públicos', '2026-02-18', 'Gestor 3',
       'Ana Martínez', 'Carrera 50 #20-30', '2026-02-18',
       '09:00', '', 'Secretaria',
       'No contestó', 'Se dejó mensaje en contestadora'],
    ]
    const wsEjemplo = XLSX.utils.aoa_to_sheet(ejemplo)
    wsEjemplo['!cols'] = [
      { wch: 8 }, { wch: 10 }, { wch: 25 }, { wch: 25 }, { wch: 15 },
      { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 10 },
      { wch: 25 }, { wch: 30 }, { wch: 12 },
      { wch: 10 }, { wch: 10 }, { wch: 20 },
      { wch: 25 }, { wch: 30 }
    ]
    XLSX.utils.book_append_sheet(wb, wsEjemplo, 'Ejemplo')

    // HOJA 3: PLANTILLA VACÍA
    const plantilla = [
      ['CICLO', 'ORDEN', 'CLIENTE', 'NOMBRE DEL RECLAMANTE', 'TELEFONO', 
       'FECHA DE VISITA PROGRAMADA', 'SERVICIO', 'FECHA DE GESTION', 'GESTOR',
       'NOMBRE SUSCRIPTOR', 'DIRECCION PREDIO', 'FECHA DE LLAMADA',
       'HORA PRIMERA LLAMADA', 'HORA SEGUNDA LLAMADA', 'PERSONA QUE ATIENDE',
       'RESULTADO LLAMADA', 'COMENTARIO'],
      []
    ]
    const wsPlantilla = XLSX.utils.aoa_to_sheet(plantilla)
    wsPlantilla['!cols'] = wsEjemplo['!cols']
    XLSX.utils.book_append_sheet(wb, wsPlantilla, 'Plantilla')

    XLSX.writeFile(wb, 'plantilla_llamadas.xlsx')
  }

  const exportarExcel = async () => {
    try {
      setExporting(true)
      let query = supabase.from('llamadas').select('*').order('fecha_gestion', { ascending: false })
      if (filters.fecha_desde) query = query.gte('fecha_gestion', filters.fecha_desde)
      if (filters.fecha_hasta) query = query.lte('fecha_gestion', filters.fecha_hasta)
      if (filters.ciclo) query = query.ilike('ciclo', `%${filters.ciclo}%`)
      if (filters.gestor) query = query.ilike('gestor', `%${filters.gestor}%`)
      if (filters.resultado) query = query.eq('resultado_llamada', filters.resultado)

      const { data, error } = await query
      if (error) throw error

      const excelRows = data.map(r => ({
        'Ciclo': r.ciclo,
        'Orden': r.orden,
        'Cliente': r.cliente,
        'Nombre Reclamante': r.nombre_reclamante,
        'Teléfono': r.telefono,
        'Fecha Visita Prog.': r.fecha_visita_programada,
        'Servicio': r.servicio,
        'Fecha Gestión': r.fecha_gestion,
        'Gestor': r.gestor,
        'Nombre Suscriptor': r.nombre_suscriptor,
        'Dirección Predio': r.direccion_predio,
        'Fecha Llamada': r.fecha_llamada,
        'Hora 1ª Llamada': r.hora_primera_llamada,
        'Hora 2ª Llamada': r.hora_segunda_llamada,
        'Persona Atiende': r.persona_atiende,
        'Resultado': r.resultado_llamada,
        'Comentario': r.comentario,
        'Creado': new Date(r.created_at).toLocaleString('es-CO'),
        'Creado Por': r.creado_por_nombre || ''
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelRows)
      ws['!cols'] = [
        { wch: 8 }, { wch: 12 }, { wch: 20 }, { wch: 25 }, { wch: 15 },
        { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 25 },
        { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 20 },
        { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 25 }
      ]
      XLSX.utils.book_append_sheet(wb, ws, 'Llamadas')

      let nombre = 'llamadas'
      if (filters.fecha_desde || filters.fecha_hasta) nombre += `_${filters.fecha_desde || 'inicio'}_${filters.fecha_hasta || 'fin'}`
      if (filters.ciclo) nombre += `_ciclo_${filters.ciclo}`
      nombre += '.xlsx'

      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      saveAs(new Blob([buffer]), nombre)
      alert(`✅ ${data.length} llamadas exportadas`)
    } catch (error) {
      console.error('Error exportando:', error)
      alert('Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  async function guardarItem() {
    if (!formData.cliente && !formData.nombre_reclamante) {
      alert('Debe ingresar al menos cliente o nombre del reclamante')
      return
    }
    setLoading(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      const dataToSave = {
        ...formData,
        hora_primera_llamada: formData.hora_primera_llamada || null,
        hora_segunda_llamada: formData.hora_segunda_llamada || null,
        creado_por_id: user?.id,
        creado_por_nombre: user?.email
      }
      let error
      if (editingId) {
        ({ error } = await supabase.from('llamadas').update(dataToSave).eq('id', editingId))
      } else {
        ({ error } = await supabase.from('llamadas').insert([dataToSave]))
      }
      if (error) throw error

      setFormData({
        ciclo: '', orden: '', cliente: '', nombre_reclamante: '', telefono: '',
        fecha_visita_programada: '', servicio: '', fecha_gestion: new Date().toISOString().split('T')[0],
        gestor: '', nombre_suscriptor: '', direccion_predio: '', fecha_llamada: '',
        hora_primera_llamada: '', hora_segunda_llamada: '', persona_atiende: '',
        resultado_llamada: '', comentario: ''
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
      const headers = rows[0]
      const dataRows = rows.slice(1).filter(r => r.some(cell => cell))

      // Mapeo de columnas según el orden esperado (debe coincidir con la plantilla)
      const colMap = {
        'CICLO': 0,
        'ORDEN': 1,
        'CLIENTE': 2,
        'NOMBRE DEL RECLAMANTE': 3,
        'TELEFONO': 4,
        'FECHA DE VISITA PROGRAMADA': 5,
        'SERVICIO': 6,
        'FECHA DE GESTION': 7,
        'GESTOR': 8,
        'NOMBRE SUSCRIPTOR': 9,
        'DIRECCION PREDIO': 10,
        'FECHA DE LLAMADA': 11,
        'HORA PRIMERA LLAMADA': 12,
        'HORA SEGUNDA LLAMADA': 13,
        'PERSONA QUE ATIENDE': 14,
        'RESULTADO LLAMADA': 15,
        'COMENTARIO': 16
      }

      const parsed = dataRows.map(row => ({
        ciclo: row[colMap['CICLO']] || '',
        orden: row[colMap['ORDEN']] || '',
        cliente: row[colMap['CLIENTE']] || '',
        nombre_reclamante: row[colMap['NOMBRE DEL RECLAMANTE']] || '',
        telefono: row[colMap['TELEFONO']] || '',
        fecha_visita_programada: row[colMap['FECHA DE VISITA PROGRAMADA']] || '',
        servicio: row[colMap['SERVICIO']] || '',
        fecha_gestion: row[colMap['FECHA DE GESTION']] || new Date().toISOString().split('T')[0],
        gestor: row[colMap['GESTOR']] || '',
        nombre_suscriptor: row[colMap['NOMBRE SUSCRIPTOR']] || '',
        direccion_predio: row[colMap['DIRECCION PREDIO']] || '',
        fecha_llamada: row[colMap['FECHA DE LLAMADA']] || '',
        hora_primera_llamada: row[colMap['HORA PRIMERA LLAMADA']] || '',
        hora_segunda_llamada: row[colMap['HORA SEGUNDA LLAMADA']] || '',
        persona_atiende: row[colMap['PERSONA QUE ATIENDE']] || '',
        resultado_llamada: row[colMap['RESULTADO LLAMADA']] || '',
        comentario: row[colMap['COMENTARIO']] || ''
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
        hora_primera_llamada: r.hora_primera_llamada || null,
        hora_segunda_llamada: r.hora_segunda_llamada || null,
        creado_por_id: user?.id,
        creado_por_nombre: user?.email
      }))
      const { error } = await supabase.from('llamadas').insert(toInsert)
      if (error) throw error
      setShowExcelModal(false)
      setExcelData([])
      setExcelPreview([])
      await cargarItems()
      await cargarEstadisticas()
      alert(`✅ ${toInsert.length} llamadas cargadas`)
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
    if (!confirm('¿Eliminar esta llamada?')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('llamadas').delete().eq('id', id)
      if (error) throw error
      await cargarItems()
      await cargarEstadisticas()
      alert('Eliminada')
    } catch (error) {
      console.error('Error eliminando:', error)
      alert('Error al eliminar')
    } finally {
      setLoading(false)
    }
  }

  const resetFilters = () => {
    setFilters({ fecha_desde: '', fecha_hasta: '', ciclo: '', gestor: '', resultado: '' })
    setSelectedMonth('')
    setPage(1)
  }

  return (
    <div className="page">
      <header className="topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>Llamadas Realizadas</h1>
        {rol === 'admin' && <span className="user-role">Admin</span>}
      </header>

      {/* Tarjeta de total y botón de estadísticas */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="stat-card" style={{ width: 'auto', minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#dbeafe' }}>📞</div>
          <div className="stat-info">
            <div className="stat-label">Total Llamadas</div>
            <div className="stat-value">{stats.total}</div>
          </div>
        </div>
        <button className="action-btn primary" onClick={() => setShowStatsModal(true)}>
          📊 Ver Estadísticas
        </button>
      </div>

      {/* Botones de acción */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
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
        <button className="action-btn primary" onClick={() => { setFormData({ ...formData, fecha_gestion: new Date().toISOString().split('T')[0] }); setEditingId(null); setShowForm(true); }}>
          + Nueva Llamada
        </button>
      </div>

      {/* Filtros: selector de mes automático + fechas manuales */}
      <div className="search-panel" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => {
            const month = e.target.value;
            setSelectedMonth(month);
            if (month) {
              const [year, monthNum] = month.split('-');
              const fechaDesde = `${year}-${monthNum}-01`;
              const ultimoDia = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
              const fechaHasta = `${year}-${monthNum}-${String(ultimoDia).padStart(2, '0')}`;
              setFilters(prev => ({ ...prev, fecha_desde: fechaDesde, fecha_hasta: fechaHasta, page: 1 }));
            } else {
              // Si se borra el mes, limpiamos las fechas
              setFilters(prev => ({ ...prev, fecha_desde: '', fecha_hasta: '', page: 1 }));
            }
          }}
          style={{ width: 'auto' }}
          placeholder="Seleccionar mes"
        />
        <input type="date" placeholder="Fecha desde" value={filters.fecha_desde} onChange={e => setFilters({...filters, fecha_desde: e.target.value, page:1})} />
        <input type="date" placeholder="Fecha hasta" value={filters.fecha_hasta} onChange={e => setFilters({...filters, fecha_hasta: e.target.value, page:1})} />
        <input type="text" placeholder="Ciclo" value={filters.ciclo} onChange={e => setFilters({...filters, ciclo: e.target.value, page:1})} />
        <select value={filters.gestor} onChange={e => setFilters({...filters, gestor: e.target.value, page:1})}>
          <option value="">Todos los gestores</option>
          {GESTORES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={filters.resultado} onChange={e => setFilters({...filters, resultado: e.target.value, page:1})}>
          <option value="">Todos los resultados</option>
          {RESULTADOS_LLAMADA.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={resetFilters}>Limpiar</button>
      </div>

      {/* Modal de estadísticas */}
      {showStatsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 1200, maxHeight: '90vh' }}>
            <div className="modal-header">
              <h2>📊 Estadísticas de Llamadas</h2>
              <button className="close-btn" onClick={() => setShowStatsModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', padding: '20px' }}>
              <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Gráfico por día (fecha_gestion) */}
                <div className="dashboard-card" style={{ padding: '16px' }}>
                  <h3 style={{ marginBottom: '12px' }}>📅 Llamadas por Día</h3>
                  <div style={{ height: 350 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.porDia}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="fecha" 
                          tick={{ fontSize: 10 }} 
                          angle={-45} 
                          textAnchor="end" 
                          height={60}
                          interval={0}
                        />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="cantidad" stroke="#3b82f6" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico por mes (fecha_gestion) - AHORA FILTRADO */}
                <div className="dashboard-card" style={{ padding: '16px' }}>
                  <h3 style={{ marginBottom: '12px' }}>📊 Llamadas por Mes</h3>
                  <div style={{ height: 350 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.porMes}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#f59e0b" radius={[4,4,0,0]}>
                          <LabelList dataKey="cantidad" position="top" formatter={formatearNumero} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico de resultados (barras) */}
                <div className="dashboard-card" style={{ padding: '16px' }}>
                  <h3 style={{ marginBottom: '12px' }}>🎯 Resultados de Llamada</h3>
                  <div style={{ height: 350 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.porResultado} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="nombre" 
                          tick={{ fontSize: 10 }} 
                          angle={-45} 
                          textAnchor="end" 
                          height={80} 
                          interval={0}
                        />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#10b981" radius={[4,4,0,0]}>
                          <LabelList dataKey="cantidad" position="top" formatter={formatearNumero} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico de gestores (top 5) */}
                <div className="dashboard-card" style={{ padding: '16px' }}>
                  <h3 style={{ marginBottom: '12px' }}>👥 Top Gestores</h3>
                  <div style={{ height: 350 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.porGestor} layout="vertical" margin={{ left: 100, right: 20, top: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="gestor" type="category" width={120} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#8b5cf6" radius={[0,4,4,0]}>
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
                    <tr><th>Ciclo</th><th>Cliente</th><th>Teléfono</th><th>Resultado</th></tr>
                  </thead>
                  <tbody>
                    {excelPreview.map((r,i) => (
                      <tr key={i}><td>{r.ciclo}</td><td>{r.cliente}</td><td>{r.telefono}</td><td>{r.resultado_llamada}</td></tr>
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
              <h2>{editingId ? 'Editar Llamada' : 'Nueva Llamada'}</h2>
              <button className="close-btn" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="form-modal-body">
              <div className="form-tabs">
                <div className="tab active">Datos de la llamada</div>
              </div>
              <div className="form-section">
                <h3>📋 Información general</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Ciclo</label>
                    <input type="text" value={formData.ciclo} onChange={e => setFormData({...formData, ciclo: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Orden</label>
                    <input type="text" value={formData.orden} onChange={e => setFormData({...formData, orden: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Cliente</label>
                    <input type="text" value={formData.cliente} onChange={e => setFormData({...formData, cliente: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Nombre del Reclamante</label>
                    <input type="text" value={formData.nombre_reclamante} onChange={e => setFormData({...formData, nombre_reclamante: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Teléfono</label>
                    <input type="text" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Fecha Visita Programada</label>
                    <input type="date" value={formData.fecha_visita_programada} onChange={e => setFormData({...formData, fecha_visita_programada: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Servicio</label>
                    <select value={formData.servicio} onChange={e => setFormData({...formData, servicio: e.target.value})}>
                      <option value="">Seleccionar</option>
                      {SERVICIOS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Fecha Gestión *</label>
                    <input type="date" value={formData.fecha_gestion} onChange={e => setFormData({...formData, fecha_gestion: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Gestor</label>
                    <select value={formData.gestor} onChange={e => setFormData({...formData, gestor: e.target.value})}>
                      <option value="">Seleccionar</option>
                      {GESTORES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Nombre Suscriptor</label>
                    <input type="text" value={formData.nombre_suscriptor} onChange={e => setFormData({...formData, nombre_suscriptor: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Dirección Predio</label>
                    <input type="text" value={formData.direccion_predio} onChange={e => setFormData({...formData, direccion_predio: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Fecha Llamada (opcional)</label>
                    <input type="date" value={formData.fecha_llamada} onChange={e => setFormData({...formData, fecha_llamada: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Hora 1ª Llamada</label>
                    <input type="time" value={formData.hora_primera_llamada} onChange={e => setFormData({...formData, hora_primera_llamada: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Hora 2ª Llamada (opcional)</label>
                    <input type="time" value={formData.hora_segunda_llamada} onChange={e => setFormData({...formData, hora_segunda_llamada: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Persona que Atiende</label>
                    <input type="text" value={formData.persona_atiende} onChange={e => setFormData({...formData, persona_atiende: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Resultado Llamada</label>
                    <select value={formData.resultado_llamada} onChange={e => setFormData({...formData, resultado_llamada: e.target.value})}>
                      <option value="">Seleccionar</option>
                      {RESULTADOS_LLAMADA.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Comentario</label>
                    <textarea rows="3" value={formData.comentario} onChange={e => setFormData({...formData, comentario: e.target.value})} />
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

      {/* Tabla de resultados */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Fecha Gestión</th><th>Ciclo</th><th>Cliente</th><th>Reclamante</th><th>Teléfono</th>
              <th>Resultado</th><th>Gestor</th>
              {rol === 'admin' && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>{item.fecha_gestion}</td>
                <td>{item.ciclo}</td>
                <td>{item.cliente}</td>
                <td>{item.nombre_reclamante}</td>
                <td>{item.telefono}</td>
                <td><span className="badge" style={{ background: '#dbeafe' }}>{item.resultado_llamada}</span></td>
                <td>{item.gestor}</td>
                {rol === 'admin' && (
                  <td>
                    <button className="icon-btn" onClick={() => editar(item)} style={{ marginRight:8 }}>✏️</button>
                    <button className="icon-btn" onClick={() => eliminar(item.id)}>🗑️</button>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={rol==='admin'?8:7} style={{textAlign:'center', padding:40}}>No hay llamadas registradas</td></tr>
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