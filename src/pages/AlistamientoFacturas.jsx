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
} from 'recharts'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import '../index.css'

const PAGE_SIZE = 10
const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

// Lista maestra de ciclos
const CICLOS_MAESTROS = [
  { ciclo: 2, tipo: 'servicios_publicos' },
  { ciclo: 4, tipo: 'servicios_publicos' },
  { ciclo: 5, tipo: 'servicios_publicos' },
  { ciclo: 6, tipo: 'servicios_publicos' },
  { ciclo: 8, tipo: 'servicios_publicos' },
  { ciclo: 10, tipo: 'servicios_publicos' },
  { ciclo: 12, tipo: 'servicios_publicos' },
  { ciclo: 14, tipo: 'servicios_publicos' },
  { ciclo: 16, tipo: 'servicios_publicos' },
  { ciclo: 18, tipo: 'servicios_publicos' },
  { ciclo: 19, tipo: 'servicios_publicos' },
  { ciclo: 20, tipo: 'servicios_publicos' },
  { ciclo: 21, tipo: 'servicios_publicos' },
  { ciclo: 22, tipo: 'servicios_publicos' },
  { ciclo: 24, tipo: 'servicios_publicos' },
  { ciclo: 26, tipo: 'servicios_publicos' },
  { ciclo: 28, tipo: 'servicios_publicos' },
  { ciclo: 29, tipo: 'servicios_publicos' },
  { ciclo: 30, tipo: 'servicios_publicos' },
  { ciclo: 32, tipo: 'servicios_publicos' },
  { ciclo: 33, tipo: 'servicios_publicos' },
  { ciclo: 34, tipo: 'servicios_publicos' },
  { ciclo: 35, tipo: 'servicios_publicos' },
  { ciclo: 36, tipo: 'servicios_publicos' },
  { ciclo: 37, tipo: 'servicios_publicos' },
  { ciclo: 38, tipo: 'servicios_publicos' },
  { ciclo: 39, tipo: 'servicios_publicos' },
  { ciclo: 40, tipo: 'servicios_publicos' },
  { ciclo: 41, tipo: 'servicios_publicos' },
  { ciclo: 42, tipo: 'servicios_publicos' },
  { ciclo: 44, tipo: 'servicios_publicos' },
  { ciclo: 46, tipo: 'servicios_publicos' },
  { ciclo: 47, tipo: 'servicios_publicos' },
  { ciclo: 48, tipo: 'servicios_publicos' },
  { ciclo: 49, tipo: 'servicios_publicos' },
  { ciclo: 50, tipo: 'servicios_publicos' },
  { ciclo: 51, tipo: 'servicios_publicos' },
  { ciclo: 53, tipo: 'servicios_publicos' },
  { ciclo: 55, tipo: 'servicios_publicos' },
  { ciclo: 58, tipo: 'servicios_publicos' },
  { ciclo: 60, tipo: 'servicios_publicos' },
  { ciclo: 61, tipo: 'servicios_publicos' },
  { ciclo: 62, tipo: 'servicios_publicos' },
  { ciclo: 63, tipo: 'servicios_publicos' },
  { ciclo: 64, tipo: 'servicios_publicos' },
  { ciclo: 66, tipo: 'servicios_publicos' },
  { ciclo: 67, tipo: 'servicios_publicos' },
  { ciclo: 69, tipo: 'servicios_publicos' },
  { ciclo: 70, tipo: 'servicios_publicos' },
  { ciclo: 71, tipo: 'servicios_publicos' },
  { ciclo: 72, tipo: 'servicios_publicos' },
  { ciclo: 74, tipo: 'servicios_publicos' },
  { ciclo: 76, tipo: 'servicios_publicos' },
  { ciclo: 77, tipo: 'servicios_publicos' },
  { ciclo: 80, tipo: 'servicios_publicos' },
  { ciclo: 81, tipo: 'servicios_publicos' },
  { ciclo: 84, tipo: 'servicios_publicos' },
  { ciclo: 91, tipo: 'servicios_publicos' },
  { ciclo: 102, tipo: 'telecomunicaciones' },
  { ciclo: 104, tipo: 'telecomunicaciones' },
  { ciclo: 106, tipo: 'telecomunicaciones' },
  { ciclo: 108, tipo: 'telecomunicaciones' },
  { ciclo: 110, tipo: 'telecomunicaciones' },
  { ciclo: 112, tipo: 'telecomunicaciones' },
  { ciclo: 114, tipo: 'telecomunicaciones' },
  { ciclo: 116, tipo: 'telecomunicaciones' },
  { ciclo: 118, tipo: 'telecomunicaciones' },
  { ciclo: 120, tipo: 'telecomunicaciones' },
  { ciclo: 122, tipo: 'telecomunicaciones' },
  { ciclo: 124, tipo: 'telecomunicaciones' },
  { ciclo: 126, tipo: 'telecomunicaciones' },
  { ciclo: 128, tipo: 'telecomunicaciones' },
  { ciclo: 130, tipo: 'telecomunicaciones' },
  { ciclo: 132, tipo: 'telecomunicaciones' },
  { ciclo: 134, tipo: 'telecomunicaciones' },
  { ciclo: 136, tipo: 'telecomunicaciones' },
  { ciclo: 138, tipo: 'telecomunicaciones' },
  { ciclo: 140, tipo: 'telecomunicaciones' },
  { ciclo: 142, tipo: 'telecomunicaciones' },
  { ciclo: 144, tipo: 'telecomunicaciones' },
  { ciclo: 145, tipo: 'telecomunicaciones' },
  { ciclo: 146, tipo: 'telecomunicaciones' },
  { ciclo: 148, tipo: 'telecomunicaciones' },
  { ciclo: 150, tipo: 'telecomunicaciones' },
  { ciclo: 160, tipo: 'telecomunicaciones' },
  { ciclo: 162, tipo: 'telecomunicaciones' },
  { ciclo: 164, tipo: 'telecomunicaciones' },
  { ciclo: 166, tipo: 'telecomunicaciones' },
  { ciclo: 191, tipo: 'telecomunicaciones' },
]

// Resultados de facturas digitales
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

// Función para formatear números con separador de miles
const formatearNumero = (num) => {
  return new Intl.NumberFormat('es-CO').format(num || 0)
}

// Función para obtener fecha actual de Colombia (UTC-5)
const obtenerFechaColombia = () => {
  const ahora = new Date()
  const colombia = new Date(ahora.getTime() - (5 * 60 * 60 * 1000))
  const año = colombia.getFullYear()
  const mes = String(colombia.getMonth() + 1).padStart(2, '0')
  const dia = String(colombia.getDate()).padStart(2, '0')
  return `${año}-${mes}-${dia}`
}

// Función para obtener el primer día del mes actual
const obtenerInicioMes = () => {
  const ahora = new Date()
  const colombia = new Date(ahora.getTime() - (5 * 60 * 60 * 1000))
  const año = colombia.getFullYear()
  const mes = String(colombia.getMonth() + 1).padStart(2, '0')
  return `${año}-${mes}-01`
}

// Función para obtener el último día del mes actual
const obtenerFinMes = () => {
  const ahora = new Date()
  const colombia = new Date(ahora.getTime() - (5 * 60 * 60 * 1000))
  const año = colombia.getFullYear()
  const mes = colombia.getMonth() + 1
  const ultimoDia = new Date(año, mes, 0).getDate()
  return `${año}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
}

// Nombres de servicios
const NOMBRES_SERVICIO = {
  servicios_publicos: 'Servicios Públicos',
  telecomunicaciones: 'Telecomunicaciones'
}

export default function AlistamientoFacturas({ onBack, rol }) {
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
    totalFacturas: 0,
    totalAnexos: 0,
    totalPaquetes: 0,
    facturasPorServicio: [],
    registrosPorDia: [],
    facturasPorMes: [],
    resultadosDigitales: []
  })
  const [controlCiclos, setControlCiclos] = useState({
    totalServiciosPublicos: 0,
    totalTelecomunicaciones: 0,
    procesadosServiciosPublicos: 0,
    procesadosTelecomunicaciones: 0,
    pendientesServiciosPublicos: [],
    pendientesTelecomunicaciones: []
  })

  // Filtros iniciales con el mes actual
  const [filters, setFilters] = useState({
    fecha_desde: obtenerInicioMes(),
    fecha_hasta: obtenerFinMes(),
    ciclo: '',
    servicio: '',
    usuario: ''
  })
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Formulario
  const [formData, setFormData] = useState({
    tipo_servicio: '',
    ciclo_id: '',
    ciclo_nombre: '',
    mes_trabajo: obtenerFechaColombia(),
    fecha_envio: obtenerFechaColombia(),
    fecha_vencimiento: obtenerFechaColombia(),
    fecha_aprobacion: obtenerFechaColombia(),
    fecha_alistamiento: obtenerFechaColombia(),
    cantidad_facturas: 0,
    cantidad_anexos: 0,
    cantidad_facturas_digitales: 0,
    cantidad_facturas_pdf: 0,
    cantidad_sin_ruta: 0,
    cantidad_empresas: 0,
    cantidad_retenidas: 0,
    cantidad_da: 0,
    cantidad_paquetes: 0,
    paquetes: '[]',
    aprobado_por: '',
    alistado_por: '',
    novedades: '',
    cantidad_cartas_impedimento: 0,
    cantidad_facturas_blancas: 0,
    cantidad_facturas_amarillas: 0,
    cantidad_pdf_adicionales: 0,
    hora_envio_ciclo: '',
    hora_aprobacion: '',
    hora_alistamiento: '',
    cantidad_cartas_desviaciones: 0,
    cantidad_cartera: 0,
    fecha_envio_muestras: '',
    hora_envio_muestras: '',
    // Resultados digitales
    buzones_inactivo: 0,
    buzones_lleno: 0,
    buzones_no_existe: 0,
    correo_mal_escrito: 0,
    dominio_no_existe: 0,
    enviados: 0,
    rechazado_varios_intentos: 0,
    reporta_spam: 0,
    sin_adjunto: 0,
    servidor_destino_no_responde: 0,
    // Nuevos campos para manejo de paquetes
    paquete_tipo: 'general',
    paquetes_cantidades: [] // Array de números, uno por paquete
  })

  useEffect(() => {
    cargarItems()
    cargarEstadisticas()
    calcularControlCiclos()
  }, [filters, page])

  async function cargarItems() {
    setLoading(true)
    try {
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('alistamiento_facturas')
        .select('*', { count: 'exact' })
        .order('mes_trabajo', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filters.fecha_desde) query = query.gte('mes_trabajo', filters.fecha_desde)
      if (filters.fecha_hasta) query = query.lte('mes_trabajo', filters.fecha_hasta)
      if (filters.ciclo) query = query.ilike('ciclo_nombre', `%${filters.ciclo}%`)
      if (filters.servicio) query = query.eq('tipo_servicio', filters.servicio)
      if (filters.usuario) query = query.ilike('alistado_por', `%${filters.usuario}%`)

      const { data, count, error } = await query
      if (error) throw error
      setItems(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error cargando alistamiento:', error)
    } finally {
      setLoading(false)
    }
  }

  async function cargarEstadisticas() {
    try {
      // 1. Datos del período filtrado (para totales, facturas por servicio, registros por día, resultados digitales)
      let queryPeriodo = supabase
        .from('alistamiento_facturas')
        .select('tipo_servicio, mes_trabajo, created_at, cantidad_facturas, cantidad_anexos, cantidad_paquetes, ' +
          RESULTADOS_DIGITALES.map(r => r.id).join(','))
        .gte('mes_trabajo', filters.fecha_desde)
        .lte('mes_trabajo', filters.fecha_hasta)

      const { data: dataPeriodo, error: errorPeriodo } = await queryPeriodo
      if (errorPeriodo) throw errorPeriodo

      // Calcular totales del período
      let totalFacturas = 0, totalAnexos = 0, totalPaquetes = 0
      const facturasPorServicio = {}
      const registrosPorDia = {}
      const resultados = {}
      RESULTADOS_DIGITALES.forEach(r => resultados[r.id] = 0)

      dataPeriodo?.forEach(r => {
        totalFacturas += r.cantidad_facturas || 0
        totalAnexos += r.cantidad_anexos || 0
        totalPaquetes += r.cantidad_paquetes || 0

        const servicio = r.tipo_servicio
        facturasPorServicio[servicio] = (facturasPorServicio[servicio] || 0) + (r.cantidad_facturas || 0)

        // Agrupar por fecha de creación (zona horaria Colombia)
        const fechaCreacion = new Date(r.created_at)
        const fechaColombia = new Date(fechaCreacion.getTime() - (5 * 60 * 60 * 1000))
        const fechaKey = fechaColombia.toISOString().split('T')[0] // YYYY-MM-DD
        registrosPorDia[fechaKey] = (registrosPorDia[fechaKey] || 0) + 1

        RESULTADOS_DIGITALES.forEach(res => {
          resultados[res.id] += r[res.id] || 0
        })
      })

      // Convertir registrosPorDia a array con objetos Date y ordenar ascendente (más antiguo a más reciente)
      const registrosArray = Object.entries(registrosPorDia)
        .map(([fecha, cantidad]) => ({ fecha: new Date(fecha), cantidad }))
        .sort((a, b) => a.fecha - b.fecha)

      // 2. Datos para facturas por mes (últimos 12 meses) - sin filtro de fecha
      const hace12Meses = new Date()
      hace12Meses.setMonth(hace12Meses.getMonth() - 11)
      hace12Meses.setDate(1)
      const inicio12 = hace12Meses.toISOString().split('T')[0]

      const { data: dataMensual, error: errorMensual } = await supabase
        .from('alistamiento_facturas')
        .select('mes_trabajo, tipo_servicio, cantidad_facturas')
        .gte('mes_trabajo', inicio12)

      if (errorMensual) throw errorMensual

      const facturasPorMes = {}
      dataMensual?.forEach(r => {
        const mes = r.mes_trabajo.slice(0, 7) // YYYY-MM
        if (!facturasPorMes[mes]) {
          facturasPorMes[mes] = { mes, publicas: 0, telecom: 0 }
        }
        if (r.tipo_servicio === 'servicios_publicos') {
          facturasPorMes[mes].publicas += r.cantidad_facturas || 0
        } else {
          facturasPorMes[mes].telecom += r.cantidad_facturas || 0
        }
      })

      const facturasPorMesArray = Object.values(facturasPorMes).sort((a,b) => a.mes.localeCompare(b.mes))

      setStats({
        totalRegistros: dataPeriodo?.length || 0,
        totalFacturas,
        totalAnexos,
        totalPaquetes,
        facturasPorServicio: Object.entries(facturasPorServicio).map(([s, c]) => ({
          nombre: NOMBRES_SERVICIO[s] || s,
          cantidad: c
        })),
        registrosPorDia: registrosArray,
        facturasPorMes: facturasPorMesArray,
        resultadosDigitales: RESULTADOS_DIGITALES.map(r => ({ nombre: r.nombre, cantidad: resultados[r.id] }))
      })

    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

  async function calcularControlCiclos() {
    try {
      const { data, error } = await supabase
        .from('alistamiento_facturas')
        .select('ciclo_id, tipo_servicio')
        .gte('mes_trabajo', filters.fecha_desde)
        .lte('mes_trabajo', filters.fecha_hasta)

      if (error) throw error

      const procesadosSet = new Set()
      data?.forEach(r => procesadosSet.add(`${r.tipo_servicio}-${r.ciclo_id}`))

      const publicos = CICLOS_MAESTROS.filter(c => c.tipo === 'servicios_publicos')
      const telecom = CICLOS_MAESTROS.filter(c => c.tipo === 'telecomunicaciones')

      const procesadosPublicos = publicos.filter(c => procesadosSet.has(`servicios_publicos-${c.ciclo}`)).length
      const procesadosTelecom = telecom.filter(c => procesadosSet.has(`telecomunicaciones-${c.ciclo}`)).length

      const pendientesPublicos = publicos
        .filter(c => !procesadosSet.has(`servicios_publicos-${c.ciclo}`))
        .map(c => c.ciclo)
        .sort((a,b) => a - b)

      const pendientesTelecom = telecom
        .filter(c => !procesadosSet.has(`telecomunicaciones-${c.ciclo}`))
        .map(c => c.ciclo)
        .sort((a,b) => a - b)

      setControlCiclos({
        totalServiciosPublicos: publicos.length,
        totalTelecomunicaciones: telecom.length,
        procesadosServiciosPublicos: procesadosPublicos,
        procesadosTelecomunicaciones: procesadosTelecom,
        pendientesServiciosPublicos: pendientesPublicos,
        pendientesTelecomunicaciones: pendientesTelecom
      })
    } catch (error) {
      console.error('Error calculando control de ciclos:', error)
    }
  }

  // Plantilla Excel
  const descargarPlantilla = () => {
    const wb = XLSX.utils.book_new()

    const instructivo = [
      ['INSTRUCTIVO PARA CARGA DE ALISTAMIENTO DE FACTURAS'],
      [''],
      ['1. FORMATO DE FECHAS: YYYY-MM-DD (ej: 2026-02-17)'],
      ['2. FORMATO DE HORAS: HH:MM (24h, ej: 14:30)'],
      ['3. CAMPOS NUMÉRICOS: Solo números enteros'],
      ['4. COLUMNAS (en este orden):'],
      ['   • tipo_servicio (servicios_publicos / telecomunicaciones)'],
      ['   • ciclo_id (número)'],
      ['   • ciclo_nombre (texto)'],
      ['   • mes_trabajo (fecha)'],
      ['   • fecha_envio (fecha)'],
      ['   • fecha_vencimiento (fecha)'],
      ['   • fecha_aprobacion (fecha)'],
      ['   • fecha_alistamiento (fecha)'],
      ['   • cantidad_facturas'],
      ['   • cantidad_anexos'],
      ['   • cantidad_facturas_digitales'],
      ['   • cantidad_facturas_pdf'],
      ['   • cantidad_sin_ruta'],
      ['   • cantidad_empresas'],
      ['   • cantidad_retenidas'],
      ['   • cantidad_da'],
      ['   • cantidad_paquetes'],
      ['   • paquetes (JSON, ej: [{"tipo":"normal","cantidad":5}])'],
      ['   • aprobado_por'],
      ['   • alistado_por'],
      ['   • novedades'],
      ['   • cantidad_cartas_impedimento'],
      ['   • cantidad_facturas_blancas'],
      ['   • cantidad_facturas_amarillas'],
      ['   • cantidad_pdf_adicionales'],
      ['   • hora_envio_ciclo (HH:MM)'],
      ['   • hora_aprobacion (HH:MM)'],
      ['   • hora_alistamiento (HH:MM)'],
      ['   • cantidad_cartas_desviaciones'],
      ['   • cantidad_cartera'],
      ['   • fecha_envio_muestras (fecha)'],
      ['   • hora_envio_muestras (HH:MM)'],
      ['   • buzones_inactivo'],
      ['   • buzones_lleno'],
      ['   • buzones_no_existe'],
      ['   • correo_mal_escrito'],
      ['   • dominio_no_existe'],
      ['   • enviados'],
      ['   • rechazado_varios_intentos'],
      ['   • reporta_spam'],
      ['   • sin_adjunto'],
      ['   • servidor_destino_no_responde'],
      [''],
      ['5. NOTA: Los campos id, created_at, updated_at, user_id se generan automáticamente.'],
    ]
    const wsInstructivo = XLSX.utils.aoa_to_sheet(instructivo)
    wsInstructivo['!cols'] = [{ wch: 80 }]
    XLSX.utils.book_append_sheet(wb, wsInstructivo, 'Instructivo')

    const ejemplo = [
      ['tipo_servicio','ciclo_id','ciclo_nombre','mes_trabajo','fecha_envio','fecha_vencimiento','fecha_aprobacion','fecha_alistamiento','cantidad_facturas','cantidad_anexos','cantidad_facturas_digitales','cantidad_facturas_pdf','cantidad_sin_ruta','cantidad_empresas','cantidad_retenidas','cantidad_da','cantidad_paquetes','paquetes','aprobado_por','alistado_por','novedades','cantidad_cartas_impedimento','cantidad_facturas_blancas','cantidad_facturas_amarillas','cantidad_pdf_adicionales','hora_envio_ciclo','hora_aprobacion','hora_alistamiento','cantidad_cartas_desviaciones','cantidad_cartera','fecha_envio_muestras','hora_envio_muestras','buzones_inactivo','buzones_lleno','buzones_no_existe','correo_mal_escrito','dominio_no_existe','enviados','rechazado_varios_intentos','reporta_spam','sin_adjunto','servidor_destino_no_responde'],
      ['servicios_publicos','40','Ciclo 40','2026-02-01','2026-02-01','2026-02-15','2026-02-10','2026-02-05','150','10','120','20','5','3','2','0','2','[{"tipo":"normal","cantidad":2}]','Juan Perez','Maria Gomez','Todo correcto','0','0','0','0','08:00','09:30','07:45','0','0','2026-02-06','10:15','2','1','0','1','0','50','3','1','0'],
      ['telecomunicaciones','42','Ciclo 42','2026-02-01','2026-02-02','2026-02-16','2026-02-11','2026-02-06','80','5','60','15','2','1','1','1','1','[{"tipo":"express","cantidad":1}]','Carlos Ruiz','Ana Torres','Sin novedad','1','2','1','2','09:00','10:00','08:00','1','0','2026-02-07','11:00','0','2','1','0','1','30','2','0','1'],
    ]
    const wsEjemplo = XLSX.utils.aoa_to_sheet(ejemplo)
    wsEjemplo['!cols'] = Array(41).fill({ wch: 15 })
    XLSX.utils.book_append_sheet(wb, wsEjemplo, 'Ejemplo')

    const plantilla = [ejemplo[0], []]
    const wsPlantilla = XLSX.utils.aoa_to_sheet(plantilla)
    wsPlantilla['!cols'] = wsEjemplo['!cols']
    XLSX.utils.book_append_sheet(wb, wsPlantilla, 'Plantilla')

    XLSX.writeFile(wb, 'plantilla_alistamiento_facturas.xlsx')
  }

  // Exportar datos actuales a Excel
  const exportarExcel = async () => {
    try {
      setExporting(true)
      let query = supabase.from('alistamiento_facturas').select('*').order('mes_trabajo', { ascending: false })
      if (filters.fecha_desde) query = query.gte('mes_trabajo', filters.fecha_desde)
      if (filters.fecha_hasta) query = query.lte('mes_trabajo', filters.fecha_hasta)
      if (filters.ciclo) query = query.ilike('ciclo_nombre', `%${filters.ciclo}%`)
      if (filters.servicio) query = query.eq('tipo_servicio', filters.servicio)
      if (filters.usuario) query = query.ilike('alistado_por', `%${filters.usuario}%`)

      const { data, error } = await query
      if (error) throw error

      const excelRows = data.map(r => ({
        'ID': r.id,
        'Servicio': NOMBRES_SERVICIO[r.tipo_servicio] || r.tipo_servicio,
        'Ciclo ID': r.ciclo_id,
        'Ciclo': r.ciclo_nombre,
        'Mes Trabajo': r.mes_trabajo,
        'Fecha Envío': r.fecha_envio,
        'Fecha Vencimiento': r.fecha_vencimiento,
        'Fecha Aprobación': r.fecha_aprobacion,
        'Fecha Alistamiento': r.fecha_alistamiento,
        'Facturas': r.cantidad_facturas,
        'Anexos': r.cantidad_anexos,
        'Digitales': r.cantidad_facturas_digitales,
        'PDF': r.cantidad_facturas_pdf,
        'Sin Ruta': r.cantidad_sin_ruta,
        'Empresas': r.cantidad_empresas,
        'Retenidas': r.cantidad_retenidas,
        'DA': r.cantidad_da,
        'Paquetes': r.cantidad_paquetes,
        'Paquetes (JSON)': JSON.stringify(r.paquetes),
        'Aprobado por': r.aprobado_por,
        'Alistado por': r.alistado_por,
        'Novedades': r.novedades,
        'Cartas Impedimento': r.cantidad_cartas_impedimento,
        'Facturas Blancas': r.cantidad_facturas_blancas,
        'Facturas Amarillas': r.cantidad_facturas_amarillas,
        'PDF Adicionales': r.cantidad_pdf_adicionales,
        'Hora Envío Ciclo': r.hora_envio_ciclo,
        'Hora Aprobación': r.hora_aprobacion,
        'Hora Alistamiento': r.hora_alistamiento,
        'Cartas Desviaciones': r.cantidad_cartas_desviaciones,
        'Cartera': r.cantidad_cartera,
        'Fecha Envío Muestras': r.fecha_envio_muestras,
        'Hora Envío Muestras': r.hora_envio_muestras,
        'Buzón inactivo': r.buzones_inactivo,
        'Buzón lleno': r.buzones_lleno,
        'Buzón no existe': r.buzones_no_existe,
        'Correo mal escrito': r.correo_mal_escrito,
        'Dominio no existe': r.dominio_no_existe,
        'Enviados': r.enviados,
        'Rechazado varios intentos': r.rechazado_varios_intentos,
        'Reporta como spam': r.reporta_spam,
        'Sin adjunto': r.sin_adjunto,
        'Servidor destino no responde': r.servidor_destino_no_responde,
        'Creado': new Date(r.created_at).toLocaleString('es-CO'),
        'Actualizado': new Date(r.updated_at).toLocaleString('es-CO'),
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelRows)
      XLSX.utils.book_append_sheet(wb, ws, 'Alistamiento')

      let nombre = 'alistamiento_facturas'
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

      // Construir el array de paquetes a partir de las cantidades ingresadas
      const paquetesArray = (formData.paquetes_cantidades || []).map(cant => ({
        tipo: formData.paquete_tipo?.trim() || 'general',
        cantidad: cant
      }))

      // Preparar datos para enviar (excluir campos auxiliares)
      const data = {
        ...formData,
        paquetes: paquetesArray,
        user_id: user?.id,
      }
      delete data.paquete_tipo
      delete data.paquetes_cantidades

      let error
      if (editingId) {
        ({ error } = await supabase.from('alistamiento_facturas').update(data).eq('id', editingId))
      } else {
        ({ error } = await supabase.from('alistamiento_facturas').insert([data]))
      }
      if (error) throw error

      resetForm()
      setEditingId(null)
      setShowForm(false)
      await cargarItems()
      await cargarEstadisticas()
      await calcularControlCiclos()
      alert(editingId ? 'Actualizado' : 'Guardado')
    } catch (error) {
      console.error('Error guardando:', error)
      alert('Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  // ----- FUNCIONES AUXILIARES PARA PROCESAR EXCEL -----
  // Convierte número de Excel a HH:MM
  function excelNumberToTime(valor) {
    if (valor === undefined || valor === null || valor === '') return '';
    if (typeof valor === 'string') return valor; // ya viene como texto
    if (typeof valor === 'number') {
      const totalMinutos = Math.round(valor * 24 * 60);
      const horas = Math.floor(totalMinutos / 60);
      const minutos = totalMinutos % 60;
      return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
    }
    return String(valor);
  }

  // Normalizar tipo_servicio
  function normalizarTipoServicio(valor) {
    if (!valor) return '';
    const str = String(valor).trim().toLowerCase();
    if (str.includes('publico') || str.includes('público') || str === 'servicios_publicos') {
      return 'servicios_publicos';
    }
    if (str.includes('telecom') || str === 'telecomunicaciones') {
      return 'telecomunicaciones';
    }
    return str;
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
        'tipo_servicio': 0,
        'ciclo_id': 1,
        'ciclo_nombre': 2,
        'mes_trabajo': 3,
        'fecha_envio': 4,
        'fecha_vencimiento': 5,
        'fecha_aprobacion': 6,
        'fecha_alistamiento': 7,
        'cantidad_facturas': 8,
        'cantidad_anexos': 9,
        'cantidad_facturas_digitales': 10,
        'cantidad_facturas_pdf': 11,
        'cantidad_sin_ruta': 12,
        'cantidad_empresas': 13,
        'cantidad_retenidas': 14,
        'cantidad_da': 15,
        'cantidad_paquetes': 16,
        'paquetes': 17,
        'aprobado_por': 18,
        'alistado_por': 19,
        'novedades': 20,
        'cantidad_cartas_impedimento': 21,
        'cantidad_facturas_blancas': 22,
        'cantidad_facturas_amarillas': 23,
        'cantidad_pdf_adicionales': 24,
        'hora_envio_ciclo': 25,
        'hora_aprobacion': 26,
        'hora_alistamiento': 27,
        'cantidad_cartas_desviaciones': 28,
        'cantidad_cartera': 29,
        'fecha_envio_muestras': 30,
        'hora_envio_muestras': 31,
        'buzones_inactivo': 32,
        'buzones_lleno': 33,
        'buzones_no_existe': 34,
        'correo_mal_escrito': 35,
        'dominio_no_existe': 36,
        'enviados': 37,
        'rechazado_varios_intentos': 38,
        'reporta_spam': 39,
        'sin_adjunto': 40,
        'servidor_destino_no_responde': 41,
      }

      const parsed = dataRows.map(row => {
        const rawTipo = row[colMap['tipo_servicio']];
        const tipoNormalizado = normalizarTipoServicio(rawTipo);

        return {
          tipo_servicio: tipoNormalizado,
          ciclo_id: parseInt(row[colMap['ciclo_id']]) || 0,
          ciclo_nombre: row[colMap['ciclo_nombre']] || '',
          mes_trabajo: row[colMap['mes_trabajo']] || obtenerFechaColombia(),
          fecha_envio: row[colMap['fecha_envio']] || obtenerFechaColombia(),
          fecha_vencimiento: row[colMap['fecha_vencimiento']] || obtenerFechaColombia(),
          fecha_aprobacion: row[colMap['fecha_aprobacion']] || obtenerFechaColombia(),
          fecha_alistamiento: row[colMap['fecha_alistamiento']] || obtenerFechaColombia(),
          cantidad_facturas: parseInt(row[colMap['cantidad_facturas']]) || 0,
          cantidad_anexos: parseInt(row[colMap['cantidad_anexos']]) || 0,
          cantidad_facturas_digitales: parseInt(row[colMap['cantidad_facturas_digitales']]) || 0,
          cantidad_facturas_pdf: parseInt(row[colMap['cantidad_facturas_pdf']]) || 0,
          cantidad_sin_ruta: parseInt(row[colMap['cantidad_sin_ruta']]) || 0,
          cantidad_empresas: parseInt(row[colMap['cantidad_empresas']]) || 0,
          cantidad_retenidas: parseInt(row[colMap['cantidad_retenidas']]) || 0,
          cantidad_da: parseInt(row[colMap['cantidad_da']]) || 0,
          cantidad_paquetes: parseInt(row[colMap['cantidad_paquetes']]) || 0,
          paquetes: row[colMap['paquetes']] || '[]',
          aprobado_por: row[colMap['aprobado_por']] || '',
          alistado_por: row[colMap['alistado_por']] || '',
          novedades: row[colMap['novedades']] || '',
          cantidad_cartas_impedimento: parseInt(row[colMap['cantidad_cartas_impedimento']]) || 0,
          cantidad_facturas_blancas: parseInt(row[colMap['cantidad_facturas_blancas']]) || 0,
          cantidad_facturas_amarillas: parseInt(row[colMap['cantidad_facturas_amarillas']]) || 0,
          cantidad_pdf_adicionales: parseInt(row[colMap['cantidad_pdf_adicionales']]) || 0,
          hora_envio_ciclo: excelNumberToTime(row[colMap['hora_envio_ciclo']]),
          hora_aprobacion: excelNumberToTime(row[colMap['hora_aprobacion']]),
          hora_alistamiento: excelNumberToTime(row[colMap['hora_alistamiento']]),
          cantidad_cartas_desviaciones: parseInt(row[colMap['cantidad_cartas_desviaciones']]) || 0,
          cantidad_cartera: parseInt(row[colMap['cantidad_cartera']]) || 0,
          fecha_envio_muestras: row[colMap['fecha_envio_muestras']] || '',
          hora_envio_muestras: excelNumberToTime(row[colMap['hora_envio_muestras']]),
          buzones_inactivo: parseInt(row[colMap['buzones_inactivo']]) || 0,
          buzones_lleno: parseInt(row[colMap['buzones_lleno']]) || 0,
          buzones_no_existe: parseInt(row[colMap['buzones_no_existe']]) || 0,
          correo_mal_escrito: parseInt(row[colMap['correo_mal_escrito']]) || 0,
          dominio_no_existe: parseInt(row[colMap['dominio_no_existe']]) || 0,
          enviados: parseInt(row[colMap['enviados']]) || 0,
          rechazado_varios_intentos: parseInt(row[colMap['rechazado_varios_intentos']]) || 0,
          reporta_spam: parseInt(row[colMap['reporta_spam']]) || 0,
          sin_adjunto: parseInt(row[colMap['sin_adjunto']]) || 0,
          servidor_destino_no_responde: parseInt(row[colMap['servidor_destino_no_responde']]) || 0,
        }
      });

      setExcelData(parsed)
      setExcelPreview(parsed.slice(0,5))
      setShowExcelModal(true)
    }
    reader.readAsArrayBuffer(file)
  }

  async function guardarExcel() {
    setLoading(true);
    try {
      const valoresPermitidos = ['servicios_publicos', 'telecomunicaciones'];
      const invalidos = excelData.filter(r => !valoresPermitidos.includes(r.tipo_servicio));
      if (invalidos.length > 0) {
        const ejemplos = invalidos.slice(0, 3).map(r => `'${r.tipo_servicio}'`).join(', ');
        throw new Error(`Hay ${invalidos.length} registro(s) con tipo de servicio inválido. Valores permitidos: ${valoresPermitidos.join(', ')}. Ejemplos: ${ejemplos}`);
      }

      const user = (await supabase.auth.getUser()).data.user;
      const toInsert = excelData.map(r => {
        let paquetesArray;
        try {
          paquetesArray = JSON.parse(r.paquetes);
        } catch {
          paquetesArray = [];
        }
        return {
          ...r,
          user_id: user?.id,
          paquetes: paquetesArray
        };
      });
      
      const { error } = await supabase
        .from('alistamiento_facturas')
        .upsert(toInsert, { 
          onConflict: 'ciclo_id, mes_trabajo',
          ignoreDuplicates: false
        });

      if (error) throw error;
      
      setShowExcelModal(false);
      setExcelData([]);
      setExcelPreview([]);
      await cargarItems();
      await cargarEstadisticas();
      await calcularControlCiclos();
      alert(`✅ ${toInsert.length} registros procesados (insertados/actualizados)`);
    } catch (error) {
      console.error('Error guardando Excel:', error);
      alert('Error al cargar Excel: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function editar(item) {
    // Extraer las cantidades del JSON de paquetes
    const paquetesArray = Array.isArray(item.paquetes) ? item.paquetes : [];
    const cantidades = paquetesArray.map(p => p.cantidad || 0);
    const tipo = paquetesArray.length > 0 ? (paquetesArray[0].tipo || 'general') : 'general';
    
    setFormData({
      ...item,
      paquete_tipo: tipo,
      cantidad_paquetes: paquetesArray.length,
      paquetes_cantidades: cantidades,
      paquetes: JSON.stringify(item.paquetes, null, 2) // opcional, para referencia
    });
    setEditingId(item.id);
    setShowForm(true);
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este registro?')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('alistamiento_facturas').delete().eq('id', id)
      if (error) throw error
      await cargarItems()
      await cargarEstadisticas()
      await calcularControlCiclos()
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
      tipo_servicio: '',
      ciclo_id: '',
      ciclo_nombre: '',
      mes_trabajo: obtenerFechaColombia(),
      fecha_envio: obtenerFechaColombia(),
      fecha_vencimiento: obtenerFechaColombia(),
      fecha_aprobacion: obtenerFechaColombia(),
      fecha_alistamiento: obtenerFechaColombia(),
      cantidad_facturas: 0,
      cantidad_anexos: 0,
      cantidad_facturas_digitales: 0,
      cantidad_facturas_pdf: 0,
      cantidad_sin_ruta: 0,
      cantidad_empresas: 0,
      cantidad_retenidas: 0,
      cantidad_da: 0,
      cantidad_paquetes: 0,
      paquetes: '[]',
      aprobado_por: '',
      alistado_por: '',
      novedades: '',
      cantidad_cartas_impedimento: 0,
      cantidad_facturas_blancas: 0,
      cantidad_facturas_amarillas: 0,
      cantidad_pdf_adicionales: 0,
      hora_envio_ciclo: '',
      hora_aprobacion: '',
      hora_alistamiento: '',
      cantidad_cartas_desviaciones: 0,
      cantidad_cartera: 0,
      fecha_envio_muestras: '',
      hora_envio_muestras: '',
      buzones_inactivo: 0,
      buzones_lleno: 0,
      buzones_no_existe: 0,
      correo_mal_escrito: 0,
      dominio_no_existe: 0,
      enviados: 0,
      rechazado_varios_intentos: 0,
      reporta_spam: 0,
      sin_adjunto: 0,
      servidor_destino_no_responde: 0,
      paquete_tipo: 'general',
      paquetes_cantidades: [],
    })
  }

  const resetFilters = () => {
    setFilters({
      fecha_desde: obtenerInicioMes(),
      fecha_hasta: obtenerFinMes(),
      ciclo: '',
      servicio: '',
      usuario: ''
    })
    setPage(1)
  }

  // Formatear fecha para mostrar en eje X (DD/MM)
  const formatearFechaEje = (fechaStr) => {
    if (!fechaStr) return '';
    const [año, mes, dia] = fechaStr.split('-');
    return `${dia}/${mes}`;
  }

  // Manejador para cambio en cantidad_paquetes (desde la pestaña Cantidades)
  const handleCantidadPaquetesChange = (e) => {
    const newVal = parseInt(e.target.value) || 0;
    setFormData(prev => {
      const currentArray = prev.paquetes_cantidades || [];
      let newArray;
      if (newVal > currentArray.length) {
        newArray = [...currentArray, ...Array(newVal - currentArray.length).fill(0)];
      } else if (newVal < currentArray.length) {
        newArray = currentArray.slice(0, newVal);
      } else {
        newArray = currentArray;
      }
      return { ...prev, cantidad_paquetes: newVal, paquetes_cantidades: newArray };
    });
  };

  return (
    <div className="page">
      <header className="topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>Alistamiento de Facturas</h1>
        {rol === 'admin' && <span className="user-role">Admin</span>}
      </header>

      {/* Tarjetas de resumen (sin cambios) */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#dbeafe' }}>📋</div>
          <div className="stat-info">
            <div className="stat-label">Total Registros</div>
            <div className="stat-value">{stats.totalRegistros}</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#fee2e2' }}>📄</div>
          <div className="stat-info">
            <div className="stat-label">Facturas</div>
            <div className="stat-value">{formatearNumero(stats.totalFacturas)}</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#fef3c7' }}>📎</div>
          <div className="stat-info">
            <div className="stat-label">Anexos</div>
            <div className="stat-value">{formatearNumero(stats.totalAnexos)}</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 200 }}>
          <div className="stat-icon" style={{ background: '#d9f99d' }}>📦</div>
          <div className="stat-info">
            <div className="stat-label">Paquetes</div>
            <div className="stat-value">{formatearNumero(stats.totalPaquetes)}</div>
          </div>
        </div>
        <button className="action-btn primary" onClick={() => setShowStatsModal(true)} style={{ alignSelf: 'center' }}>
          📊 Ver Estadísticas
        </button>
      </div>

      {/* Sección de Control de Ciclos (sin cambios) */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>📋 Control de Ciclos del Mes</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Servicios Públicos */}
          <div className="dashboard-card">
            <h3 style={{ color: '#3b82f6' }}>Servicios Públicos</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span>Procesados: <strong>{controlCiclos.procesadosServiciosPublicos} / {controlCiclos.totalServiciosPublicos}</strong></span>
              <span style={{ 
                background: '#3b82f6', 
                color: 'white', 
                padding: '4px 12px', 
                borderRadius: 20,
                fontSize: 14,
                fontWeight: 600
              }}>
                {Math.round((controlCiclos.procesadosServiciosPublicos / controlCiclos.totalServiciosPublicos) * 100)}%
              </span>
            </div>
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, marginBottom: 16 }}>
              <div style={{ 
                width: `${(controlCiclos.procesadosServiciosPublicos / controlCiclos.totalServiciosPublicos) * 100}%`, 
                height: '100%', 
                background: '#3b82f6', 
                borderRadius: 4 
              }} />
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>Pendientes: </span>
              {controlCiclos.pendientesServiciosPublicos.length > 0 ? (
                <span style={{ color: '#ef4444' }}>
                  {controlCiclos.pendientesServiciosPublicos.join(', ')}
                </span>
              ) : (
                <span style={{ color: '#10b981' }}>✓ Todos procesados</span>
              )}
            </div>
          </div>

          {/* Telecomunicaciones */}
          <div className="dashboard-card">
            <h3 style={{ color: '#f59e0b' }}>Telecomunicaciones</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span>Procesados: <strong>{controlCiclos.procesadosTelecomunicaciones} / {controlCiclos.totalTelecomunicaciones}</strong></span>
              <span style={{ 
                background: '#f59e0b', 
                color: 'white', 
                padding: '4px 12px', 
                borderRadius: 20,
                fontSize: 14,
                fontWeight: 600
              }}>
                {Math.round((controlCiclos.procesadosTelecomunicaciones / controlCiclos.totalTelecomunicaciones) * 100)}%
              </span>
            </div>
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, marginBottom: 16 }}>
              <div style={{ 
                width: `${(controlCiclos.procesadosTelecomunicaciones / controlCiclos.totalTelecomunicaciones) * 100}%`, 
                height: '100%', 
                background: '#f59e0b', 
                borderRadius: 4 
              }} />
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>Pendientes: </span>
              {controlCiclos.pendientesTelecomunicaciones.length > 0 ? (
                <span style={{ color: '#ef4444' }}>
                  {controlCiclos.pendientesTelecomunicaciones.join(', ')}
                </span>
              ) : (
                <span style={{ color: '#10b981' }}>✓ Todos procesados</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Botones de acción (sin cambios) */}
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

      {/* Modal de estadísticas (sin cambios) */}
      {showStatsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 1200, maxHeight: '90vh' }}>
            <div className="modal-header">
              <h2>📊 Estadísticas de Alistamiento</h2>
              <button className="close-btn" onClick={() => setShowStatsModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                
                {/* Gráfico 1: Facturas por Servicio */}
                <div className="dashboard-card">
                  <h3>🧾 Facturas por Servicio (período)</h3>
                  <div style={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.facturasPorServicio} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="nombre" />
                        <YAxis tickFormatter={formatearNumero} />
                        <Tooltip formatter={(value) => formatearNumero(value)} />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#3b82f6" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico 2: Registros por Día */}
                <div className="dashboard-card">
                  <h3>📅 Registros por Día (período) - por fecha de creación</h3>
                  <div style={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.registrosPorDia} margin={{ top: 5, right: 20, left: 0, bottom: 80 }}>
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
                          height={90}
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
                        <Line type="monotone" dataKey="cantidad" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico 3: Facturas por Mes */}
                <div className="dashboard-card">
                  <h3>📊 Facturas por Mes (últimos 12 meses)</h3>
                  <div style={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.facturasPorMes} margin={{ top: 10, right: 30, left: 0, bottom: 70 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="mes"
                          tickFormatter={(mes) => {
                            const [año, mesNum] = mes.split('-');
                            return `${mesNum}/${año.slice(2)}`;
                          }}
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis tickFormatter={formatearNumero} />
                        <Tooltip
                          labelFormatter={(label) => `Mes: ${label}`}
                          formatter={(value) => formatearNumero(value)}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="publicas" stroke="#3b82f6" name="Servicios Públicos" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="telecom" stroke="#f59e0b" name="Telecomunicaciones" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
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

      {/* Modal de vista previa Excel (sin cambios) */}
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
                    <tr><th>Servicio</th><th>Ciclo</th><th>Mes</th><th>Facturas</th></tr>
                  </thead>
                  <tbody>
                    {excelPreview.map((r,i) => (
                      <tr key={i}>
                        <td>{r.tipo_servicio}</td>
                        <td>{r.ciclo_nombre}</td>
                        <td>{r.mes_trabajo}</td>
                        <td>{r.cantidad_facturas}</td>
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
            <div className="form-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="form-tabs">
                <div className="tab active">Información General</div>
                <div className="tab">Cantidades</div>
                <div className="tab">Resultados Digitales</div>
                <div className="tab">Paquetes y Novedades</div>
                <div className="tab">Horarios</div>
              </div>

              {/* Pestaña 1: Información General (sin cambios) */}
              <div className="form-section">
                <h3>📋 Datos básicos</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Tipo de Servicio *</label>
                    <select value={formData.tipo_servicio} onChange={e => setFormData({...formData, tipo_servicio: e.target.value})}>
                      <option value="">Seleccionar</option>
                      <option value="servicios_publicos">Servicios Públicos</option>
                      <option value="telecomunicaciones">Telecomunicaciones</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Ciclo ID</label>
                    <input type="number" value={formData.ciclo_id} onChange={e => setFormData({...formData, ciclo_id: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="form-group">
                    <label>Nombre del Ciclo</label>
                    <input type="text" value={formData.ciclo_nombre} onChange={e => setFormData({...formData, ciclo_nombre: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Mes de Trabajo</label>
                    <input type="date" value={formData.mes_trabajo} onChange={e => setFormData({...formData, mes_trabajo: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Fecha de Envío</label>
                    <input type="date" value={formData.fecha_envio} onChange={e => setFormData({...formData, fecha_envio: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Fecha de Vencimiento</label>
                    <input type="date" value={formData.fecha_vencimiento} onChange={e => setFormData({...formData, fecha_vencimiento: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Fecha de Aprobación</label>
                    <input type="date" value={formData.fecha_aprobacion} onChange={e => setFormData({...formData, fecha_aprobacion: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Fecha de Alistamiento</label>
                    <input type="date" value={formData.fecha_alistamiento} onChange={e => setFormData({...formData, fecha_alistamiento: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Pestaña 2: Cantidades (modificada: usar handleCantidadPaquetesChange) */}
              <div className="form-section">
                <h3>🔢 Cantidades</h3>
                <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  <div className="form-group"><label>Facturas</label><input type="number" value={formData.cantidad_facturas} onChange={e => setFormData({...formData, cantidad_facturas: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Anexos</label><input type="number" value={formData.cantidad_anexos} onChange={e => setFormData({...formData, cantidad_anexos: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Digitales</label><input type="number" value={formData.cantidad_facturas_digitales} onChange={e => setFormData({...formData, cantidad_facturas_digitales: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>PDF</label><input type="number" value={formData.cantidad_facturas_pdf} onChange={e => setFormData({...formData, cantidad_facturas_pdf: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Sin Ruta</label><input type="number" value={formData.cantidad_sin_ruta} onChange={e => setFormData({...formData, cantidad_sin_ruta: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Empresas</label><input type="number" value={formData.cantidad_empresas} onChange={e => setFormData({...formData, cantidad_empresas: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Retenidas</label><input type="number" value={formData.cantidad_retenidas} onChange={e => setFormData({...formData, cantidad_retenidas: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>DA</label><input type="number" value={formData.cantidad_da} onChange={e => setFormData({...formData, cantidad_da: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Paquetes (cant.)</label><input type="number" value={formData.cantidad_paquetes} onChange={handleCantidadPaquetesChange} /></div>
                  <div className="form-group"><label>Cartas Impedimento</label><input type="number" value={formData.cantidad_cartas_impedimento} onChange={e => setFormData({...formData, cantidad_cartas_impedimento: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Facturas Blancas</label><input type="number" value={formData.cantidad_facturas_blancas} onChange={e => setFormData({...formData, cantidad_facturas_blancas: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Facturas Amarillas</label><input type="number" value={formData.cantidad_facturas_amarillas} onChange={e => setFormData({...formData, cantidad_facturas_amarillas: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>PDF Adicionales</label><input type="number" value={formData.cantidad_pdf_adicionales} onChange={e => setFormData({...formData, cantidad_pdf_adicionales: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Cartas Desviaciones</label><input type="number" value={formData.cantidad_cartas_desviaciones} onChange={e => setFormData({...formData, cantidad_cartas_desviaciones: parseInt(e.target.value) || 0})} /></div>
                  <div className="form-group"><label>Cartera</label><input type="number" value={formData.cantidad_cartera} onChange={e => setFormData({...formData, cantidad_cartera: parseInt(e.target.value) || 0})} /></div>
                </div>
              </div>

              {/* Pestaña 3: Resultados Digitales (sin cambios) */}
              <div className="form-section">
                <h3>📧 Resultados de Facturas Digitales</h3>
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

              {/* Pestaña 4: Paquetes y Novedades (totalmente renovada) */}
              <div className="form-section">
                <h3>📦 Paquetes y Novedades</h3>
                <div className="form-grid">
                  {/* Campo para tipo de paquete (opcional) */}
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Tipo de paquete (se aplica a todos)</label>
                    <input
                      type="text"
                      value={formData.paquete_tipo || ''}
                      onChange={e => setFormData({ ...formData, paquete_tipo: e.target.value })}
                      placeholder="ej. normal, express, etc. (por defecto 'general')"
                    />
                  </div>

                  {/* Lista dinámica de inputs para cada paquete */}
                  {formData.paquetes_cantidades.map((cant, index) => (
                    <div key={index} className="form-group" style={{ gridColumn: 'span 1' }}>
                      <label>Paquete {index + 1}</label>
                      <input
                        type="number"
                        min="0"
                        value={cant}
                        onChange={e => {
                          const newVal = parseInt(e.target.value) || 0;
                          setFormData(prev => {
                            const newArray = [...prev.paquetes_cantidades];
                            newArray[index] = newVal;
                            return { ...prev, paquetes_cantidades: newArray };
                          });
                        }}
                      />
                    </div>
                  ))}

                  {/* Área de solo lectura que muestra el JSON generado (opcional) */}
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Vista previa del JSON (solo lectura)</label>
                    <textarea
                      rows="3"
                      readOnly
                      value={JSON.stringify(
                        (formData.paquetes_cantidades || []).map(c => ({
                          tipo: formData.paquete_tipo?.trim() || 'general',
                          cantidad: c
                        })),
                        null, 2
                      )}
                    />
                  </div>

                  <div className="form-group">
                    <label>Aprobado por</label>
                    <input type="text" value={formData.aprobado_por} onChange={e => setFormData({...formData, aprobado_por: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Alistado por</label>
                    <input type="text" value={formData.alistado_por} onChange={e => setFormData({...formData, alistado_por: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Novedades</label>
                    <textarea rows="3" value={formData.novedades} onChange={e => setFormData({...formData, novedades: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Pestaña 5: Horarios (sin cambios) */}
              <div className="form-section">
                <h3>⏰ Horarios</h3>
                <div className="form-grid">
                  <div className="form-group"><label>Hora Envío Ciclo</label><input type="time" value={formData.hora_envio_ciclo} onChange={e => setFormData({...formData, hora_envio_ciclo: e.target.value})} /></div>
                  <div className="form-group"><label>Hora Aprobación</label><input type="time" value={formData.hora_aprobacion} onChange={e => setFormData({...formData, hora_aprobacion: e.target.value})} /></div>
                  <div className="form-group"><label>Hora Alistamiento</label><input type="time" value={formData.hora_alistamiento} onChange={e => setFormData({...formData, hora_alistamiento: e.target.value})} /></div>
                  <div className="form-group"><label>Fecha Envío Muestras</label><input type="date" value={formData.fecha_envio_muestras} onChange={e => setFormData({...formData, fecha_envio_muestras: e.target.value})} /></div>
                  <div className="form-group"><label>Hora Envío Muestras</label><input type="time" value={formData.hora_envio_muestras} onChange={e => setFormData({...formData, hora_envio_muestras: e.target.value})} /></div>
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

      {/* Filtros (sin cambios) */}
      <div className="search-panel">
        <input type="date" placeholder="Mes desde" value={filters.fecha_desde} onChange={e => setFilters({...filters, fecha_desde: e.target.value, page:1})} />
        <input type="date" placeholder="Mes hasta" value={filters.fecha_hasta} onChange={e => setFilters({...filters, fecha_hasta: e.target.value, page:1})} />
        <input type="text" placeholder="Ciclo" value={filters.ciclo} onChange={e => setFilters({...filters, ciclo: e.target.value, page:1})} />
        <select value={filters.servicio} onChange={e => setFilters({...filters, servicio: e.target.value, page:1})}>
          <option value="">Todos los servicios</option>
          <option value="servicios_publicos">Servicios Públicos</option>
          <option value="telecomunicaciones">Telecomunicaciones</option>
        </select>
        <input type="text" placeholder="Usuario" value={filters.usuario} onChange={e => setFilters({...filters, usuario: e.target.value, page:1})} />
        <button onClick={resetFilters}>Limpiar</button>
      </div>

      {/* Tabla de resultados (sin cambios) */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Mes</th><th>Ciclo</th><th>Servicio</th><th>Facturas</th><th>Anexos</th><th>Paquetes</th>
              <th>Digitales</th><th>PDF</th><th>Sin Ruta</th><th>Empresas</th><th>Retenidas</th><th>DA</th>
              <th>Alistado por</th><th>Novedades</th>
              {rol === 'admin' && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>{item.mes_trabajo}</td>
                <td>{item.ciclo_nombre}</td>
                <td>{NOMBRES_SERVICIO[item.tipo_servicio]}</td>
                <td>{item.cantidad_facturas}</td>
                <td>{item.cantidad_anexos}</td>
                <td>{item.cantidad_paquetes}</td>
                <td>{item.cantidad_facturas_digitales}</td>
                <td>{item.cantidad_facturas_pdf}</td>
                <td>{item.cantidad_sin_ruta}</td>
                <td>{item.cantidad_empresas}</td>
                <td>{item.cantidad_retenidas}</td>
                <td>{item.cantidad_da}</td>
                <td>{item.alistado_por}</td>
                <td>{item.novedades ? (item.novedades.length > 20 ? item.novedades.substring(0,20)+'…' : item.novedades) : '-'}</td>
                {rol === 'admin' && (
                  <td>
                    <button className="icon-btn" onClick={() => editar(item)} style={{ marginRight:8 }}>✏️</button>
                    <button className="icon-btn" onClick={() => eliminar(item.id)}>🗑️</button>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={rol==='admin'?15:14} style={{textAlign:'center', padding:40}}>No hay registros</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación (sin cambios) */}
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