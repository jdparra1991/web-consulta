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
  PieChart,
  Pie,
  Cell,
  LabelList
} from 'recharts'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import '../index.css'

const PAGE_SIZE = 10

// ------------------------- LISTAS DE ÍTEMS -------------------------
const ITEMS_FISICO = [
  "Consecutivo de impresión.",
  "Mensaje de cuentas vencidas.",
  "Localidad (Cali, Yumbo, Jamundí, Puerto Tejada).",
  "Fecha de vencimiento superior a cinco días hábiles.",
  "Fecha de vencimiento parte superior e inferior.",
  "Verificar que la Ruta con su Consecutivo tengan secuencia correcta.",
  "Verificar la fecha de expedición mes, día y año.",
  "Verificar que la fecha de cada FIFA en el reporte de cantidades por ciclo coincida con el periodo vigente",
  "Periodo de facturación, Días de facturación - Uso (Residencial, Comercial, etc.).",
  "Revisar liquidación-valores de subsidio-valores facturados.",
  "Revisar porcentaje de Contribución o Subsidio de Aseo.",
  "Valor total en la parte superior e inferior.",
  "La sumatoria de los valores parciales debe ser igual al total.",
  "Impresión del histórico de consumos de Energía, Acueducto y Aseo.",
  "En la factura de Telecomunicaciones verificar el detalle operadores.",
  "Verificar la correcta visualización de Alianzas EMCALI según el servicio en caso de que apliquen.",
  "Verificar que el periodo facturado de la ESPY sea igual al del ciclo 38 de EMCALI.",
  "En la factura de telecomunicaciones no deben figurar cobros de Energía ni Acueducto y viceversa.",
  "Se factura alumbrado público únicamente cuando se cobra energía.",
  "Verificar código de barras.",
  "Verificar Componentes del costo en acueducto y alcantarillado, en energía el NIU",
  "Verificar el respaldo de la factura física y digital, antes de empaquetar el arte correspondiente al mes.",
  "Verificar en las facturas de telecomunicaciones que el código QR, se pueda leer y muestre la información correspondiente.",
  "Verificar mensaje frontal en la parte inferior de la factura de servicios públicos domiciliarios en caso de que aplique",
  "Verificar que la factura de telecomunicaciones traiga el código alfanumérico CUFE (Parte inferior-central)",
  "Verificar que la factura de telecomunicaciones contenga la información Resolución DIAN - Rango Inicio - Rango Fin - Número total de servicios (Parte inferior)",
  "Verificar que la factura de telecomunicaciones contenga la siguiente informacion: (Margen derecho, pie de pagina) VIGILADA POR SUPERINTENDENCIA DE INDUSTRIA Y COMERCIO, Línea Gratuita Nacional: 01 8000 910165, info@sic.gov.co, Cra 13 No. 27-00 Piso 5 Bogotá D.C. Colombia. (Margen izquierdo): Gran Contribuyente, DIAN, Responsable de IVA.",
  "Verificar que la factura de servicios publicos domiciliarios contenga la siguiente informacion: (Margen derecho, pie de pagina) LOGO VIGILADO SUPERSERVICIOS (Margen Izquierdo): Gran Contribuyente, DIAN, Gran Contribuyente de Industria y Comercio Municipio de Cali.",
  "verificar que en las facturas este la taza de seguridad en estractos 4-5-6 o uso comercial e industrial.",
  "Verificar en las facturas de utilities que el codigo QR, se pueda leer y muestre la informacion correspondiente",
  "verificar en la factura, el uso (residencial, comercial, etc.) en la parte superior de la derecha al lado del consecutivo de impresión.",
  "Verificar que en la parte inferior de la factura figure el proveedor tecnologico de facturación electronica",
  "Verificar que la factura de telecomunicaciones contenga denominacion 'factura electronica de venta'",
  "Verificar que la factura de servicios publicos contenga denominacion 'documento equivalente electrónico'",
  "Apellidos, nombre o razón social, NIT del vendedor o de quien preste el servicio",
  "Discriminacion del IVA, impuesto nacional al consumo, otros impuestos con su correspondiente tarifa.",
  "Numeración consecutiva determinada por el sujeto obligado.",
  "Validar los logos (icontec, IQNET)"
]

const ITEMS_DIGITAL = [
  "Verificar en el asunto y cuerpo del correo el tipo de factura que se envía (Servicios Públicos Domiciliarios o Telecomunicaciones).",
  "Estructura del asunto en el mail: Telecomunicaciones: 890399003; EMCALI EICE ESP; 9013287; 01; EMCALI Servicios Públicos: 890399003; EMCALI EICE ESP; 2950366;60; EMCALI. Lo anterior corresponde a: NIT del Facturador Electrónico; Nombre del Facturador Electrónico; Número del Documento Electrónico; Código del tipo de documento (01 Factura Electrónica o 60 Documento Equivalente Electrónico); Nombre comercial del facturador.",
  "Archivos adjuntos: Corresponde a un único archivo .ZIP que contenga el XML y el PDF de la factura (Representación gráfica).",
  "Verificar en el asunto y cuerpo del correo el mes del período de la factura que se envía.",
  "Verificar contrato, fecha de vencimiento y valor a pagar.",
  "Verificar en el cuerpo del correo la imagen de publicidad, más la siguiente información: (a) Contrato (b) Fecha de vencimiento (c) Valor a pagar (d) El ícono del PSE debe remitirlo a la página de Emcali, link: https://www.emcali.com.co/pagosweb/",
  "Verificar cantidad de facturas digitales enviadas.",
  "Verificar que el informe adjunto corresponda al ciclo enviado.",
  "Verificar el respaldo de la factura física y digital, el arte correspondiente al mes.",
  "Los datos relacionados en el correo deben coincidir con la muestra adjunta.",
  "Verificar archivo xlm que corresponda con el contrato enviado"
]

const INCONSISTENCIAS = [
  'Documentación incompleta',
  'Error en datos del cliente',
  'Ciclo incorrecto',
  'Cálculos erróneos',
  'Formato inválido',
  'Falta firma',
  'Factura duplicada',
  'No cumple normativa',
  'Otro'
]

// Colores para gráficos
const COLORS = ['#10B981', '#EF4444', '#F59E0B']

// Función para formatear números
const formatearNumero = (num) => new Intl.NumberFormat('es-CO').format(num || 0)

// Función para obtener fecha actual Colombia
const obtenerFechaColombia = () => {
  const ahora = new Date()
  const colombia = new Date(ahora.getTime() - (5 * 60 * 60 * 1000))
  const año = colombia.getFullYear()
  const mes = String(colombia.getMonth() + 1).padStart(2, '0')
  const dia = String(colombia.getDate()).padStart(2, '0')
  return `${año}-${mes}-${dia}`
}

export default function AprobacionCiclosWeb({ onBack, rol }) {
  // ==================== ESTADOS ====================
  const [evaluaciones, setEvaluaciones] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [excelData, setExcelData] = useState([])
  const [excelPreview, setExcelPreview] = useState([])
  const [stats, setStats] = useState({
    totalEvaluaciones: 0,
    aprobadas: 0,
    rechazadas: 0,
    pendientes: 0,
    porMes: [],
    porTipo: []
  })
  const [filters, setFilters] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    ciclo: '',
    resultado: ''
  })
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Formulario de evaluación/cabecera
  const [formData, setFormData] = useState({
    vigencia: '',
    ciclo: '',
    tipo: 'fisico' // 'fisico' o 'digital'
  })

  // Estado de los ítems de la evaluación actual (se inicializa cuando cambia tipo)
  const [itemsEstado, setItemsEstado] = useState({})

  // ==================== CARGAR LISTADO DE EVALUACIONES ====================
  const cargarEvaluaciones = async () => {
    setLoading(true)
    try {
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('aprobaciones_ciclos')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filters.fecha_desde) query = query.gte('created_at', filters.fecha_desde)
      if (filters.fecha_hasta) query = query.lte('created_at', filters.fecha_hasta)
      if (filters.ciclo) query = query.ilike('ciclo', `%${filters.ciclo}%`)
      if (filters.resultado) query = query.eq('resultado', filters.resultado)

      const { data, count, error } = await query
      if (error) throw error

      setEvaluaciones(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error cargando evaluaciones:', error)
    } finally {
      setLoading(false)
    }
  }

  // ==================== CARGAR ESTADÍSTICAS ====================
  const cargarEstadisticas = async () => {
    try {
      // Totales por resultado
      const { data: resultados } = await supabase
        .from('aprobaciones_ciclos')
        .select('resultado')
      
      const total = resultados?.length || 0
      const aprobadas = resultados?.filter(r => r.resultado === 'APROBADO').length || 0
      const rechazadas = resultados?.filter(r => r.resultado === 'RECHAZADO').length || 0
      const pendientes = resultados?.filter(r => r.resultado === 'PENDIENTE').length || 0

      // Por mes (últimos 12 meses)
      const { data: porMes } = await supabase
        .from('aprobaciones_ciclos')
        .select('created_at, resultado')
      
      const mesesMap = {}
      const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
      porMes?.forEach(r => {
        const fecha = new Date(r.created_at)
        const key = `${fecha.getFullYear()}-${fecha.getMonth()+1}`
        const label = `${mesesNombres[fecha.getMonth()]} ${fecha.getFullYear()}`
        if (!mesesMap[key]) {
          mesesMap[key] = { mes: label, aprobadas: 0, rechazadas: 0, pendientes: 0, total: 0 }
        }
        mesesMap[key][r.resultado === 'APROBADO' ? 'aprobadas' : r.resultado === 'RECHAZADO' ? 'rechazadas' : 'pendientes']++
        mesesMap[key].total++
      })
      const porMesArray = Object.values(mesesMap).sort((a,b) => a.mes.localeCompare(b.mes)).slice(-12)

      // Por tipo (físico/digital)
      const { data: porTipo } = await supabase
        .from('aprobaciones_ciclos')
        .select('tipo, resultado')
      
      const tipoMap = {}
      porTipo?.forEach(r => {
        if (!tipoMap[r.tipo]) tipoMap[r.tipo] = { tipo: r.tipo === 'fisico' ? 'Físico' : 'Digital', aprobadas: 0, rechazadas: 0, total: 0 }
        tipoMap[r.tipo][r.resultado === 'APROBADO' ? 'aprobadas' : 'rechazadas']++
        tipoMap[r.tipo].total++
      })
      const porTipoArray = Object.values(tipoMap)

      setStats({
        totalEvaluaciones: total,
        aprobadas,
        rechazadas,
        pendientes,
        porMes: porMesArray,
        porTipo: porTipoArray
      })
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

  // ==================== INICIALIZAR ITEMS SEGÚN TIPO ====================
  useEffect(() => {
    const itemsActuales = formData.tipo === 'fisico' ? ITEMS_FISICO : ITEMS_DIGITAL
    const inicial = {}
    itemsActuales.forEach((texto, idx) => {
      inicial[idx] = {
        texto,
        estado: 'pendiente', // 'pendiente', 'aprobado', 'rechazado'
        inconsistencias: [],
        observacion: '',
        expandido: false
      }
    })
    setItemsEstado(inicial)
  }, [formData.tipo])

  useEffect(() => {
    cargarEvaluaciones()
    cargarEstadisticas()
  }, [filters, page])

  // ==================== MANEJADORES DE ITEMS ====================
  const setEstadoItem = (index, nuevoEstado) => {
    setItemsEstado(prev => {
      const updated = { ...prev }
      if (nuevoEstado === 'rechazado') {
        updated[index] = {
          ...updated[index],
          estado: nuevoEstado,
          expandido: true
        }
      } else if (nuevoEstado === 'aprobado') {
        updated[index] = {
          ...updated[index],
          estado: nuevoEstado,
          expandido: false,
          inconsistencias: [],
          observacion: ''
        }
      } else {
        updated[index] = { ...updated[index], estado: nuevoEstado }
      }
      return updated
    })
  }

  const toggleExpandido = (index) => {
    setItemsEstado(prev => ({
      ...prev,
      [index]: { ...prev[index], expandido: !prev[index].expandido }
    }))
  }

  const toggleInconsistencia = (index, inc) => {
    setItemsEstado(prev => {
      const actual = prev[index].inconsistencias
      const nuevas = actual.includes(inc)
        ? actual.filter(i => i !== inc)
        : [...actual, inc]
      return {
        ...prev,
        [index]: { ...prev[index], inconsistencias: nuevas }
      }
    })
  }

  const cambiarObservacion = (index, texto) => {
    setItemsEstado(prev => ({
      ...prev,
      [index]: { ...prev[index], observacion: texto }
    }))
  }

  // ==================== VALIDACIÓN Y GUARDADO ====================
  const validarFormulario = () => {
    if (!formData.vigencia) {
      alert('Selecciona una vigencia (mes)')
      return false
    }
    if (!formData.ciclo.trim()) {
      alert('Ingresa el ciclo')
      return false
    }
    const hayPendiente = Object.values(itemsEstado).some(item => item.estado === 'pendiente')
    if (hayPendiente) {
      alert('Aún hay ítems pendientes de evaluar. Debes marcar cada ítem como Aprobado o Rechazado.')
      return false
    }
    let error = false
    Object.entries(itemsEstado).forEach(([idx, item]) => {
      if (item.estado === 'rechazado' && !item.observacion.trim()) {
        alert(`El ítem ${parseInt(idx)+1} fue rechazado y debe tener una observación.`)
        error = true
      }
    })
    return !error
  }

  const guardarEvaluacion = async () => {
    if (!validarFormulario()) return
    setLoading(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      const hayRechazado = Object.values(itemsEstado).some(i => i.estado === 'rechazado')
      const resultadoGlobal = hayRechazado ? 'RECHAZADO' : 'APROBADO'

      // Insertar cabecera
      const { data: cabecera, error: errorCabecera } = await supabase
        .from('aprobaciones_ciclos')
        .insert({
          vigencia: formData.vigencia,
          ciclo: formData.ciclo.trim(),
          tipo: formData.tipo,
          resultado: resultadoGlobal,
          creado_por_id: user?.id,
          creado_por_nombre: user?.email
        })
        .select('id')
        .single()
      if (errorCabecera) throw errorCabecera

      const aprobacionId = cabecera.id

      // Insertar detalles
      const detalles = Object.entries(itemsEstado).map(([idx, item]) => ({
        aprobacion_id: aprobacionId,
        orden: parseInt(idx) + 1,
        texto: item.texto,
        aprobado: item.estado === 'aprobado',
        inconsistencias: item.inconsistencias,
        observacion: item.observacion?.trim() || null
      }))

      const { error: errorDetalle } = await supabase
        .from('aprobaciones_ciclos_detalle')
        .insert(detalles)
      if (errorDetalle) throw errorDetalle

      // Resetear formulario y recargar
      setFormData({
        vigencia: '',
        ciclo: '',
        tipo: 'fisico'
      })
      setEditingId(null)
      setShowForm(false)
      await cargarEvaluaciones()
      await cargarEstadisticas()
      alert(`✅ Evaluación ${resultadoGlobal}\nSe guardaron ${detalles.filter(d => d.aprobado).length} ítems aprobados.`)
    } catch (error) {
      console.error(error)
      alert('Error al guardar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // ==================== EXPORTAR / PLANTILLA / EXCEL ====================
  const descargarPlantilla = () => {
    const wb = XLSX.utils.book_new()
    const instructivo = [
      ['INSTRUCTIVO PARA CARGA MASIVA DE APROBACIÓN DE CICLOS'],
      [''],
      ['1. FORMATO DE FECHAS:'],
      ['   • vigencia debe estar en formato "Mes AAAA" (ej: "Enero 2026").'],
      ['   • No se requiere día.'],
      [''],
      ['2. CAMPOS OBLIGATORIOS:'],
      ['   • ciclo (texto)'],
      ['   • tipo (fisico o digital)'],
      ['   • vigencia (texto)'],
      [''],
      ['3. COLUMNAS (respetar este orden):'],
      ['   • Columna A: VIGENCIA (texto)'],
      ['   • Columna B: CICLO (texto)'],
      ['   • Columna C: TIPO (fisico/digital)'],
      [''],
      ['4. IMPORTANTE:'],
      ['   • Esta plantilla es solo para cargar cabeceras; los ítems se generan automáticamente según el tipo.'],
      ['   • Si la evaluación ya existe, se actualizará (usando combinación vigencia+ciclo).'],
    ]
    const wsInstructivo = XLSX.utils.aoa_to_sheet(instructivo)
    wsInstructivo['!cols'] = [{ wch: 80 }]
    XLSX.utils.book_append_sheet(wb, wsInstructivo, 'Instructivo')

    const header = ['VIGENCIA', 'CICLO', 'TIPO']
    const ejemplo = [
      ['Enero 2026', 'CICLO_001', 'fisico'],
      ['Febrero 2026', 'CICLO_002', 'digital'],
    ]
    const wsEjemplo = XLSX.utils.aoa_to_sheet([header, ...ejemplo])
    wsEjemplo['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(wb, wsEjemplo, 'Ejemplo')

    XLSX.writeFile(wb, 'plantilla_aprobacion_ciclos.xlsx')
  }

  const exportarExcel = async () => {
  try {
    setExporting(true)

    // 1. Obtener evaluaciones con filtros
    let query = supabase
      .from('aprobaciones_ciclos')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters.fecha_desde) query = query.gte('created_at', filters.fecha_desde)
    if (filters.fecha_hasta) query = query.lte('created_at', filters.fecha_hasta)
    if (filters.ciclo) query = query.ilike('ciclo', `%${filters.ciclo}%`)
    if (filters.resultado) query = query.eq('resultado', filters.resultado)

    const { data: evaluaciones, error } = await query
    if (error) throw error

    if (!evaluaciones || evaluaciones.length === 0) {
      alert('No hay datos para exportar con esos filtros.')
      return
    }

    // 2. Obtener IDs y sus detalles
    const ids = evaluaciones.map(e => e.id)
    const { data: detalles, error: detError } = await supabase
      .from('aprobaciones_ciclos_detalle')
      .select('*')
      .in('aprobacion_id', ids)
      .order('aprobacion_id', { ascending: true })
      .order('orden', { ascending: true })

    if (detError) throw detError

    // Mapa de detalles por evaluación
    const detallesPorEval = {}
    detalles?.forEach(d => {
      if (!detallesPorEval[d.aprobacion_id]) detallesPorEval[d.aprobacion_id] = []
      detallesPorEval[d.aprobacion_id].push(d)
    })

    // 3. Construir las filas del Excel (ESTRUCTURA AGRUPADA POR EVALUACIÓN)
    const filasHoja = []

    // Agregar encabezado corporativo
    filasHoja.push(['VERIFICACIÓN DE LAS FACTURAS ANTES DE IMPRIMIR'])
    filasHoja.push([`CÓDIGO: 169P01F004    VERSIÓN: 5`])
    filasHoja.push([])
    filasHoja.push([`Reporte generado: ${new Date().toLocaleString('es-CO')}`])
    let filtrosTexto = ''
    if (filters.fecha_desde) filtrosTexto += `Desde ${filters.fecha_desde} `
    if (filters.fecha_hasta) filtrosTexto += `Hasta ${filters.fecha_hasta} `
    if (filters.ciclo) filtrosTexto += `Ciclo: ${filters.ciclo} `
    if (filters.resultado) filtrosTexto += `Resultado: ${filters.resultado}`
    filasHoja.push([`Filtros aplicados: ${filtrosTexto || 'Ninguno'}`])
    filasHoja.push([])
    filasHoja.push([]) // separador

    // Ahora, para cada evaluación, agregamos sus datos
    for (const evalucion of evaluaciones) {
      // Fila de cabecera de la evaluación (datos comunes)
      filasHoja.push([
        `EVALUACIÓN - ${evalucion.ciclo} (${evalucion.vigencia})`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ])
      filasHoja.push([
        'Vigencia',
        'Ciclo',
        'Tipo',
        'Resultado',
        'Fecha Evaluación',
        'Evaluado Por',
        '',
        '',
        '',
        '',
        ''
      ])
      filasHoja.push([
        evalucion.vigencia,
        evalucion.ciclo,
        evalucion.tipo === 'fisico' ? 'Físico' : 'Digital',
        evalucion.resultado,
        new Date(evalucion.created_at).toLocaleString('es-CO'),
        evalucion.creado_por_nombre || '',
        '',
        '',
        '',
        '',
        ''
      ])
      filasHoja.push([]) // línea de separación

      // Encabezados de la tabla de ítems
      filasHoja.push([
        'Ítem #',
        'Descripción del Ítem',
        'Evaluación Ítem',
        'Inconsistencias',
        'Observación',
        '',
        '',
        '',
        '',
        '',
        ''
      ])

      // Ítems de esta evaluación
      const items = detallesPorEval[evalucion.id] || []
      for (const item of items) {
        filasHoja.push([
          item.orden,
          item.texto,
          item.aprobado ? 'APROBADO' : 'RECHAZADO',
          item.inconsistencias?.join(', ') || '',
          item.observacion || '',
          '',
          '',
          '',
          '',
          '',
          ''
        ])
      }

      // Línea en blanco entre evaluaciones
      filasHoja.push([])
      filasHoja.push([])
    }

    // Crear hoja y libro
    const ws = XLSX.utils.aoa_to_sheet(filasHoja)

    // Ajustar anchos de columnas (las que usamos)
    ws['!cols'] = [
      { wch: 10 }, // Ítem #
      { wch: 60 }, // Descripción
      { wch: 14 }, // Evaluación
      { wch: 30 }, // Inconsistencias
      { wch: 40 }  // Observación
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Validaciones por Ciclo')

    // Descargar
    const nombreArchivo = `aprobacion_ciclos_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buffer]), nombreArchivo)

    alert(`✅ Exportado: ${evaluaciones.length} evaluaciones con sus ítems.`)
  } catch (error) {
    console.error(error)
    alert('Error al exportar: ' + error.message)
  } finally {
    setExporting(false)
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
      const headers = rows[0]
      const dataRows = rows.slice(1).filter(r => r.some(cell => cell))

      const colMap = {
        vigencia: headers.findIndex(h => h?.toLowerCase() === 'vigencia'),
        ciclo: headers.findIndex(h => h?.toLowerCase() === 'ciclo'),
        tipo: headers.findIndex(h => h?.toLowerCase() === 'tipo')
      }

      const parsed = dataRows.map(row => ({
        vigencia: row[colMap.vigencia] || '',
        ciclo: row[colMap.ciclo] || '',
        tipo: row[colMap.tipo] || 'fisico'
      })).filter(r => r.vigencia && r.ciclo)

      setExcelData(parsed)
      setExcelPreview(parsed.slice(0,5))
      setShowExcelModal(true)
    }
    reader.readAsArrayBuffer(file)
  }

  const guardarExcel = async () => {
    setLoading(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      const evaluaciones = []
      for (const reg of excelData) {
        // Verificar si ya existe evaluación para esa vigencia+ciclo (para evitar duplicados)
        const { data: existente } = await supabase
          .from('aprobaciones_ciclos')
          .select('id')
          .eq('vigencia', reg.vigencia)
          .eq('ciclo', reg.ciclo)
          .maybeSingle()
        if (existente) {
          console.log(`Evaluación ${reg.ciclo} ya existe, omitiendo...`)
          continue
        }
        evaluaciones.push({
          vigencia: reg.vigencia,
          ciclo: reg.ciclo,
          tipo: reg.tipo,
          resultado: 'PENDIENTE', // inicialmente pendiente hasta que se complete
          creado_por_id: user?.id,
          creado_por_nombre: user?.email
        })
      }
      if (evaluaciones.length === 0) {
        alert('No se encontraron evaluaciones nuevas para cargar')
        setShowExcelModal(false)
        return
      }
      const { error } = await supabase.from('aprobaciones_ciclos').insert(evaluaciones)
      if (error) throw error
      setShowExcelModal(false)
      setExcelData([])
      setExcelPreview([])
      await cargarEvaluaciones()
      await cargarEstadisticas()
      alert(`✅ ${evaluaciones.length} evaluaciones cargadas exitosamente. Recuerda que los ítems deben ser evaluados uno por uno.`)
    } catch (error) {
      console.error(error)
      alert('Error al cargar desde Excel')
    } finally {
      setLoading(false)
    }
  }

  const eliminarEvaluacion = async (id) => {
    if (!confirm('¿Eliminar esta evaluación y todos sus ítems?')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('aprobaciones_ciclos').delete().eq('id', id)
      if (error) throw error
      await cargarEvaluaciones()
      await cargarEstadisticas()
      alert('Evaluación eliminada')
    } catch (error) {
      console.error(error)
      alert('Error al eliminar')
    } finally {
      setLoading(false)
    }
  }

  const resetFilters = () => {
    setFilters({ fecha_desde: '', fecha_hasta: '', ciclo: '', resultado: '' })
    setPage(1)
  }

  // ==================== RENDERIZADO ====================
  const hayPendienteEnForm = Object.values(itemsEstado).some(i => i.estado === 'pendiente')
  const hayRechazadoEnForm = Object.values(itemsEstado).some(i => i.estado === 'rechazado')
  const resultadoParcial = hayPendienteEnForm ? 'PENDIENTE' : (hayRechazadoEnForm ? 'RECHAZADO' : 'APROBADO')
  const colorResultadoParcial = 
    resultadoParcial === 'APROBADO' ? '#10B981' : 
    resultadoParcial === 'RECHAZADO' ? '#EF4444' : '#F59E0B'

  return (
    <div className="page">
      <header className="topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>Aprobación de Ciclos</h1>
        {rol === 'admin' && <span className="user-role">Admin</span>}
      </header>

      {/* Tarjetas de resumen */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 150 }}>
          <div className="stat-icon" style={{ background: '#dbeafe' }}>📋</div>
          <div className="stat-info">
            <div className="stat-label">Total Evaluaciones</div>
            <div className="stat-value">{stats.totalEvaluaciones}</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 150 }}>
          <div className="stat-icon" style={{ background: '#dcfce7' }}>✅</div>
          <div className="stat-info">
            <div className="stat-label">Aprobadas</div>
            <div className="stat-value">{stats.aprobadas}</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 150 }}>
          <div className="stat-icon" style={{ background: '#fee2e2' }}>❌</div>
          <div className="stat-info">
            <div className="stat-label">Rechazadas</div>
            <div className="stat-value">{stats.rechazadas}</div>
          </div>
        </div>
        <button className="action-btn primary" onClick={() => setShowStatsModal(true)} style={{ alignSelf: 'center' }}>
          📊 Ver Estadísticas
        </button>
      </div>

      {/* Botones de acción */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button className="action-btn secondary" onClick={descargarPlantilla}>
          📥 Plantilla Excel
        </button>
        <label className={`action-btn secondary ${exporting ? 'disabled' : ''}`}>
          📤 Cargar Excel
          <input type="file" accept=".xlsx,.xls,.csv" onChange={cargarExcel} style={{ display: 'none' }} disabled={exporting} />
        </label>
        <button className="action-btn success" onClick={exportarExcel} disabled={exporting || loading}>
          {exporting ? '⏳ Exportando...' : '📊 Exportar Excel'}
        </button>
        <button
          className="action-btn primary"
          onClick={() => {
            setFormData({ vigencia: '', ciclo: '', tipo: 'fisico' })
            setEditingId(null)
            setShowForm(true)
          }}
        >
          + Nueva Evaluación
        </button>
      </div>

      {/* Modal de estadísticas */}
      {showStatsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 1200, maxHeight: '90vh' }}>
            <div className="modal-header">
              <h2>📊 Estadísticas de Aprobación de Ciclos</h2>
              <button className="close-btn" onClick={() => setShowStatsModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <div className="charts-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                
                {/* Gráfico de pastel - Resultados generales */}
                <div className="dashboard-card">
                  <h3>📊 Resultados Generales</h3>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Aprobadas', value: stats.aprobadas, color: '#10B981' },
                            { name: 'Rechazadas', value: stats.rechazadas, color: '#EF4444' },
                            { name: 'Pendientes', value: stats.pendientes, color: '#F59E0B' }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent*100).toFixed(0)}%`}
                        >
                          {stats.aprobadas > 0 && <Cell fill="#10B981" />}
                          {stats.rechazadas > 0 && <Cell fill="#EF4444" />}
                          {stats.pendientes > 0 && <Cell fill="#F59E0B" />}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico de barras por mes */}
                <div className="dashboard-card">
                  <h3>📅 Evolución por Mes</h3>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.porMes}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="aprobadas" name="Aprobadas" stackId="a" fill="#10B981" />
                        <Bar dataKey="rechazadas" name="Rechazadas" stackId="a" fill="#EF4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico por tipo */}
                <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
                  <h3>📌 Resultados por Tipo de Servicio</h3>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.porTipo} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="tipo" type="category" />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="aprobadas" name="Aprobadas" fill="#10B981" radius={[0,4,4,0]}>
                          <LabelList dataKey="aprobadas" position="right" formatter={formatearNumero} />
                        </Bar>
                        <Bar dataKey="rechazadas" name="Rechazadas" fill="#EF4444" radius={[0,4,4,0]}>
                          <LabelList dataKey="rechazadas" position="right" formatter={formatearNumero} />
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

      {/* Modal de carga Excel */}
      {showExcelModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h2>Vista previa - Evaluaciones a cargar</h2>
              <button className="close-btn" onClick={() => setShowExcelModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p><strong>{excelData.length}</strong> evaluaciones para cargar</p>
              <div className="table-container" style={{ maxHeight: 300, overflow: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>Vigencia</th><th>Ciclo</th><th>Tipo</th></tr></thead>
                  <tbody>
                    {excelPreview.map((r, i) => (
                      <tr key={i}><td>{r.vigencia}</td><td>{r.ciclo}</td><td>{r.tipo}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {excelData.length > 5 && <p style={{ marginTop: 8, color: '#64748b' }}>... y {excelData.length - 5} más</p>}
            </div>
            <div className="modal-footer">
              <button className="secondary-btn" onClick={() => setShowExcelModal(false)}>Cancelar</button>
              <button className="primary-btn" onClick={guardarExcel} disabled={loading}>
                {loading ? 'Cargando...' : `Cargar ${excelData.length} evaluaciones`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal del formulario de evaluación */}
      {showForm && (
        <div className="form-modal">
          <div className="form-modal-content" style={{ maxWidth: 1000, maxHeight: '90vh' }}>
            <div className="form-modal-header">
              <h2>{editingId ? 'Editar Evaluación' : 'Nueva Evaluación de Ciclos'}</h2>
              <button className="close-btn" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="form-modal-body">
              <div className="form-section">
                <h3>📋 Datos Generales</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Vigencia (Mes - Año) *</label>
                    <input
                      type="month"
                      value={formData.vigencia}
                      onChange={e => setFormData({...formData, vigencia: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Ciclo *</label>
                    <input
                      type="text"
                      value={formData.ciclo}
                      onChange={e => setFormData({...formData, ciclo: e.target.value})}
                      placeholder="Ej: CICLO_001"
                    />
                  </div>
                  <div className="form-group">
                    <label>Tipo de Servicio *</label>
                    <select
                      value={formData.tipo}
                      onChange={e => setFormData({...formData, tipo: e.target.value})}
                    >
                      <option value="fisico">Físico</option>
                      <option value="digital">Digital</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3>📋 Validación de Ítems</h3>
                  <div style={{ padding: '6px 12px', borderRadius: 20, backgroundColor: colorResultadoParcial + '20', border: `1px solid ${colorResultadoParcial}` }}>
                    <strong style={{ color: colorResultadoParcial }}>Resultado parcial: {resultadoParcial}</strong>
                  </div>
                </div>
                <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                  {Object.entries(itemsEstado).map(([idx, item]) => (
                    <div key={idx} className="form-group" style={{ border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 12, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                          <strong>{parseInt(idx)+1}. {item.texto}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className={`badge ${item.estado === 'aprobado' ? 'success' : 'neutral'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setEstadoItem(parseInt(idx), 'aprobado')}
                          >
                            ✅ Aprobar
                          </button>
                          <button
                            className={`badge ${item.estado === 'rechazado' ? 'danger' : 'neutral'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setEstadoItem(parseInt(idx), 'rechazado')}
                          >
                            ❌ Rechazar
                          </button>
                          <button className="badge neutral" onClick={() => toggleExpandido(parseInt(idx))}>
                            {item.expandido ? '▲' : '▼'}
                          </button>
                        </div>
                      </div>
                      {item.expandido && item.estado === 'rechazado' && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                          <div className="form-group">
                            <label>Inconsistencias (opcional):</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                              {INCONSISTENCIAS.map(inc => (
                                <button
                                  key={inc}
                                  className={`badge ${item.inconsistencias.includes(inc) ? 'danger' : 'neutral'}`}
                                  onClick={() => toggleInconsistencia(parseInt(idx), inc)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  {inc}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="form-group">
                            <label>Observación * (obligatoria):</label>
                            <textarea
                              rows="2"
                              className="form-input"
                              placeholder="Detalla la razón del rechazo..."
                              value={item.observacion}
                              onChange={e => cambiarObservacion(parseInt(idx), e.target.value)}
                              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #cbd5e1' }}
                            />
                          </div>
                        </div>
                      )}
                      {item.expandido && item.estado === 'aprobado' && (
                        <div style={{ marginTop: 12, padding: 8, backgroundColor: '#dcfce7', borderRadius: 8, color: '#166534' }}>
                          ✓ Ítem aprobado sin observaciones
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="form-modal-footer">
              <button className="secondary-btn" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="primary-btn" onClick={guardarEvaluacion} disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar Evaluación'}
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
        <select value={filters.resultado} onChange={e => setFilters({...filters, resultado: e.target.value, page:1})}>
          <option value="">Todos los resultados</option>
          <option value="APROBADO">APROBADO</option>
          <option value="RECHAZADO">RECHAZADO</option>
          <option value="PENDIENTE">PENDIENTE</option>
        </select>
        <button onClick={resetFilters}>Limpiar</button>
      </div>

      {/* Tabla de evaluaciones */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Vigencia</th>
              <th>Ciclo</th>
              <th>Tipo</th>
              <th>Resultado</th>
              <th>Fecha Creación</th>
              <th>Creado Por</th>
              {rol === 'admin' && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {evaluaciones.map(e => (
              <tr key={e.id}>
                <td>{e.vigencia}</td>
                <td>{e.ciclo}</td>
                <td>{e.tipo === 'fisico' ? 'Físico' : 'Digital'}</td>
                <td>
                  <span className={`badge ${
                    e.resultado === 'APROBADO' ? 'success' : 
                    e.resultado === 'RECHAZADO' ? 'danger' : 'warning'
                  }`}>
                    {e.resultado}
                  </span>
                </td>
                <td>{new Date(e.created_at).toLocaleDateString()}</td>
                <td>{e.creado_por_nombre || '-'}</td>
                {rol === 'admin' && (
                  <td>
                    <button className="icon-btn" onClick={() => eliminarEvaluacion(e.id)} style={{ marginRight: 8 }}>🗑️</button>
                    {/* Podrías agregar edición si lo deseas */}
                  </td>
                )}
              </tr>
            ))}
            {evaluaciones.length === 0 && (
              <tr><td colSpan={rol === 'admin' ? 7 : 6} style={{ textAlign: 'center', padding: 40 }}>No hay evaluaciones registradas</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalCount > PAGE_SIZE && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(p => p-1)}>← Anterior</button>
          <span>Página {page} de {Math.ceil(totalCount / PAGE_SIZE)}</span>
          <button disabled={page >= Math.ceil(totalCount / PAGE_SIZE)} onClick={() => setPage(p => p+1)}>Siguiente →</button>
        </div>
      )}
    </div>
  )
}