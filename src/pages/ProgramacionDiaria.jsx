import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']

const ACTIVIDADES = [
  { id: 'lectura', nombre: '📄 Lectura', color: '#3B82F6', meta: 30 },
  { id: 'reparto', nombre: '📦 Reparto', color: '#10B981', meta: 60 },
  { id: 'revision', nombre: '🔍 Revisión', color: '#F59E0B', meta: 30 }
]

const CICLOS_MAESTROS = {
  lectura: [
    "2", "4", "5", "6", "8", "10", "12", "14", "16", "18", "19", "20", "21", "22",
    "24", "26", "28", "29", "30", "32", "33", "34", "35", "36", "37", "38", "39",
    "40", "41", "44", "46", "47", "48", "49", "50", "51", "53", "55", "60",
    "61", "62", "63", "91"
  ],
  reparto: [
    "02-102", "04-104", "05-104", "06-106", "08-108", "10-110", "12-112", "14-114", 
    "16-116", "18-118", "19-118", "20-120", "21-120", "22-122", "24-124", "26-126", 
    "28-128", "29-128", "30-130", "32-132", "33-134", "34-134", "35-134", "36-136", 
    "37-134", "38-138", "39-134", "40-140", "41-140", "42", "44", "145", "46-146", 
    "47-146", "48-148", "49-146", "50-150", "51-146", "53-146", "55-150", "60-160", 
    "61-162", "62-162", "63-163"
  ],
  revision: [
    "2", "4", "5", "6", "8", "10", "12", "14", "16", "18", "19", "20", "21", "22",
    "24", "26", "28", "29", "30", "32", "33", "34", "35", "36", "37", "38", "39",
    "40", "41", "44", "46", "47", "48", "49", "50", "51", "53", "55", "60",
    "61", "62", "63", "91"
  ]
}

const obtenerFechaColombia = () => {
  const ahora = new Date();
  const colombia = new Date(ahora.getTime() - (5 * 60 * 60 * 1000));
  const año = colombia.getUTCFullYear();
  const mes = String(colombia.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(colombia.getUTCDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
};

const obtenerRangoMes = (mes) => {
  const [año, mesNum] = mes.split('-').map(Number);
  const inicio = new Date(Date.UTC(año, mesNum - 1, 1));
  const fin = new Date(Date.UTC(año, mesNum, 0));
  const formato = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  return { inicio: formato(inicio), fin: formato(fin) };
};

const formatearFechaLocal = (fechaStr) => {
  if (!fechaStr) return '';
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const [año, mes, dia] = fechaStr.split('-').map(Number);
  const fecha = new Date(Date.UTC(año, mes - 1, dia, 12, 0, 0));
  const diaSemana = dias[fecha.getUTCDay()];
  return `${diaSemana}, ${dia} de ${meses[mes - 1]} de ${año}`;
};

export default function ProgramacionDiaria({ onBack, rol }) {
  const [programacion, setProgramacion] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelData, setExcelData] = useState([]);
  const [excelPreview, setExcelPreview] = useState([]);
  const [filters, setFilters] = useState({ fecha: obtenerFechaColombia() });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // ESTADO PARA VISTA MENSUAL
  const [viewMode, setViewMode] = useState('diario');
  const [datosMensualesMap, setDatosMensualesMap] = useState({});
  const [mesControl, setMesControl] = useState(obtenerFechaColombia().slice(0, 7));

  // NUEVO: Estado para Festivos
  const [festivos, setFestivos] = useState(new Set());

  // Incidencias
  const [incidencias, setIncidencias] = useState([]);
  const [mostrarIncidencias, setMostrarIncidencias] = useState(false);

  const [ciclosAsignados, setCiclosAsignados] = useState({ lectura: new Set(), reparto: new Set(), revision: new Set() });

  const [modalActividadVisible, setModalActividadVisible] = useState(false);
  const [actividadSeleccionada, setActividadSeleccionada] = useState(null);
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState([]);
  const [cicloAsignado, setCicloAsignado] = useState('40');
  const [usuariosProgramadosHoy, setUsuariosProgramadosHoy] = useState(new Set());
  const [cicloPreseleccionado, setCicloPreseleccionado] = useState(null);

  const [calendarioData, setCalendarioData] = useState({});
  const [calendarioCargando, setCalendarioCargando] = useState(false);
  const [mesCalendario, setMesCalendario] = useState(mesControl);

  const [stats, setStats] = useState({ total: 0, porActividad: [], porDia: [], porMes: [], topCiclos: [] });
  const [statsMesFiltro, setStatsMesFiltro] = useState('');
  const [statsLoading, setStatsLoading] = useState(false);

  const [modalIncidenciaVisible, setModalIncidenciaVisible] = useState(false);
  const [usuarioIncidencia, setUsuarioIncidencia] = useState(null);
  const [motivoIncidencia, setMotivoIncidencia] = useState('');

  useEffect(() => {
    cargarUsuarios();
  }, []);

  useEffect(() => {
    if (viewMode === 'diario') {
      cargarProgramacion();
      cargarIncidencias();
    }
  }, [filters, page, viewMode]);

  // Cargar datos mensuales y festivos al cambiar el mes o la vista
  useEffect(() => {
    if (viewMode === 'mensual') {
      cargarDatosMensuales();
      cargarFestivos();
    }
  }, [mesControl, viewMode]);

  useEffect(() => {
    cargarCiclosAsignados();
  }, [mesControl]);

  useEffect(() => {
    if (showMonthModal) {
      cargarCalendario(mesCalendario);
    }
  }, [showMonthModal, mesCalendario]);

  useEffect(() => {
    if (showStatsModal) {
      cargarEstadisticas(statsMesFiltro);
    }
  }, [showStatsModal, statsMesFiltro]);

  // ========== FUNCIONES ==========
  const cargarUsuarios = async () => {
    try {
      const [lecturas, repartos, revisiones] = await Promise.all([
        supabase.from('lecturas').select('creado_por_nombre'),
        supabase.from('repartos').select('creado_por_nombre'),
        supabase.from('revisiones').select('creado_por_nombre'),
      ]);
      const nombres = [
        ...(lecturas.data || []).map(l => l.creado_por_nombre),
        ...(repartos.data || []).map(r => r.creado_por_nombre),
        ...(revisiones.data || []).map(r => r.creado_por_nombre),
      ].filter(Boolean);
      setUsuarios([...new Set(nombres)].sort());
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    }
  };

  const cargarProgramacion = async () => {
    setLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count, error } = await supabase
        .from('programacion_actividades')
        .select('*', { count: 'exact' })
        .eq('fecha', filters.fecha)
        .order('actividad', { ascending: true })
        .range(from, to);
      if (error) throw error;
      setProgramacion(data || []);
      setTotalCount(count || 0);
      const usuariosHoy = new Set(data?.map(item => item.usuario_nombre) || []);
      setUsuariosProgramadosHoy(usuariosHoy);
    } catch (error) {
      console.error('Error cargando programación:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarDatosMensuales = async () => {
    if (!mesControl) return;
    const { inicio, fin } = obtenerRangoMes(mesControl);
    setLoading(true);
    try {
      const [progRes, lecRes, repRes, revRes] = await Promise.all([
        supabase.from('programacion_actividades').select('*').gte('fecha', inicio).lte('fecha', fin),
        supabase.from('lecturas').select('creado_por_nombre, ciclo, created_at').gte('created_at', inicio).lte('created_at', fin),
        supabase.from('repartos').select('creado_por_nombre, ciclo_reparto, created_at').gte('created_at', inicio).lte('created_at', fin),
        supabase.from('revisiones').select('creado_por_nombre, ciclo, created_at').gte('created_at', inicio).lte('created_at', fin)
      ]);

      if (progRes.error) throw progRes.error;
      if (lecRes.error) throw lecRes.error;
      if (repRes.error) throw repRes.error;
      if (revRes.error) throw revRes.error;

      // 1. Construir el mapa de conteos reales
      const countMap = {};
      const procesarConteos = (data, actividad) => {
        data?.forEach(item => {
          const fechaRaw = item.created_at;
          if (!fechaRaw) return;
          const fecha = new Date(fechaRaw);
          const colombia = new Date(fecha.getTime() - (5 * 60 * 60 * 1000));
          const fechaStr = `${colombia.getUTCFullYear()}-${String(colombia.getUTCMonth()+1).padStart(2,'0')}-${String(colombia.getUTCDate()).padStart(2,'0')}`;

          const usuario = item.creado_por_nombre;
          let ciclo = null;
          if (actividad === 'reparto') {
            ciclo = item.ciclo_reparto;
          } else {
            ciclo = item.ciclo;
          }
          
          if (!fechaStr || !usuario) return;
          
          if (!countMap[fechaStr]) countMap[fechaStr] = {};
          if (!countMap[fechaStr][usuario]) countMap[fechaStr][usuario] = {};
          if (!countMap[fechaStr][usuario][actividad]) countMap[fechaStr][usuario][actividad] = {};
          if (!countMap[fechaStr][usuario][actividad][ciclo]) countMap[fechaStr][usuario][actividad][ciclo] = 0;
          countMap[fechaStr][usuario][actividad][ciclo]++;
        });
      };
      procesarConteos(lecRes.data, 'lectura');
      procesarConteos(repRes.data, 'reparto');
      procesarConteos(revRes.data, 'revision');

      // 2. Generar todos los días del mes
      const generarDiasSimples = (mes) => {
        const [año, mesNum] = mes.split('-').map(Number);
        const dias = [];
        const totalDias = new Date(Date.UTC(año, mesNum, 0)).getUTCDate();
        for (let d = 1; d <= totalDias; d++) {
          dias.push(`${año}-${String(mesNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        }
        return dias;
      };

      const map = {};
      const diasMes = generarDiasSimples(mesControl);
      diasMes.forEach(fecha => {
        map[fecha] = {};
      });

      // 3. Rellenar el mapa con la programación y los conteos reales
      (progRes.data || []).forEach(item => {
        const fecha = item.fecha;
        const usuario = item.usuario_nombre;
        if (!map[fecha]) map[fecha] = {};
        if (!map[fecha][usuario]) map[fecha][usuario] = {};
        
        const actividad = item.actividad;
        const cicloProgramado = item.ciclo;
        const count = countMap[fecha]?.[usuario]?.[actividad]?.[cicloProgramado] || 
                      countMap[fecha]?.[usuario]?.[actividad]?.[null] || 0;
        
        map[fecha][usuario][actividad] = {
          ciclo: cicloProgramado,
          count: count
        };
      });

      setDatosMensualesMap(map);
    } catch (error) {
      console.error('Error cargando datos mensuales:', error);
      alert('Error al cargar datos mensuales');
    } finally {
      setLoading(false);
    }
  };

  // ========== NUEVAS FUNCIONES PARA FESTIVOS ==========
  const cargarFestivos = async () => {
    try {
      const { data, error } = await supabase
        .from('festivos')
        .select('fecha');
      if (error) throw error;
      setFestivos(new Set((data || []).map(item => item.fecha)));
    } catch (error) {
      console.error('Error cargando festivos:', error);
    }
  };

  const toggleFestivo = async (fechaStr) => {
    if (rol !== 'admin') return alert('Solo los administradores pueden gestionar festivos.');
    try {
      if (festivos.has(fechaStr)) {
        // Quitar festivo
        const { error } = await supabase
          .from('festivos')
          .delete()
          .eq('fecha', fechaStr);
        if (error) throw error;
        const newSet = new Set(festivos);
        newSet.delete(fechaStr);
        setFestivos(newSet);
      } else {
        // Agregar festivo
        const { error } = await supabase
          .from('festivos')
          .insert({ fecha: fechaStr, nombre: 'Festivo' });
        if (error) throw error;
        const newSet = new Set(festivos);
        newSet.add(fechaStr);
        setFestivos(newSet);
      }
    } catch (error) {
      console.error('Error modificando festivo:', error);
      alert('Error al modificar el día festivo');
    }
  };

  // ========== INCIDENCIAS ==========
  const cargarIncidencias = async () => {
    try {
      const { data, error } = await supabase
        .from('incidencias')
        .select('*')
        .eq('fecha', filters.fecha);
      if (error) throw error;
      setIncidencias(data || []);
    } catch (error) {
      console.error('Error cargando incidencias:', error);
    }
  };

  const agregarIncidencia = async () => {
    if (!usuarioIncidencia) return;
    if (!motivoIncidencia.trim()) {
      alert('Debes escribir un motivo');
      return;
    }
    try {
      const { error } = await supabase
        .from('incidencias')
        .insert({
          fecha: filters.fecha,
          usuario_nombre: usuarioIncidencia,
          motivo: motivoIncidencia.trim()
        });
      if (error) throw error;
      await cargarIncidencias();
      await cargarProgramacion();
      setModalIncidenciaVisible(false);
      setUsuarioIncidencia(null);
      setMotivoIncidencia('');
      alert('✅ Incidencia registrada');
    } catch (error) {
      console.error('Error agregando incidencia:', error);
      alert('Error al agregar incidencia');
    }
  };

  const eliminarIncidencia = async (id) => {
    if (!confirm('¿Eliminar esta incidencia?')) return;
    try {
      const { error } = await supabase
        .from('incidencias')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await cargarIncidencias();
      await cargarProgramacion();
      alert('Incidencia eliminada');
    } catch (error) {
      console.error('Error eliminando incidencia:', error);
      alert('Error al eliminar incidencia');
    }
  };

  // ========== RESTO DE FUNCIONES ==========
  const cargarCiclosAsignados = async () => {
    if (!mesControl) return;
    const { inicio, fin } = obtenerRangoMes(mesControl);
    try {
      const { data, error } = await supabase
        .from('programacion_actividades')
        .select('actividad, ciclo')
        .gte('fecha', inicio)
        .lte('fecha', fin);
      if (error) throw error;
      const asignados = { lectura: new Set(), reparto: new Set(), revision: new Set() };
      data?.forEach(item => {
        if (item.ciclo) asignados[item.actividad]?.add(item.ciclo);
      });
      setCiclosAsignados(asignados);
    } catch (error) {
      console.error('Error cargando ciclos asignados:', error);
    }
  };

  const cargarCalendario = async (mes) => {
    if (!mes) return;
    setCalendarioCargando(true);
    const { inicio, fin } = obtenerRangoMes(mes);
    try {
      const [progRes, incRes] = await Promise.all([
        supabase
          .from('programacion_actividades')
          .select('fecha, actividad, usuario_nombre, ciclo, id')
          .gte('fecha', inicio)
          .lte('fecha', fin),
        supabase
          .from('incidencias')
          .select('fecha, usuario_nombre, motivo, id')
          .gte('fecha', inicio)
          .lte('fecha', fin)
      ]);
      if (progRes.error) throw progRes.error;
      if (incRes.error) throw incRes.error;

      const grouped = {};
      [...(progRes.data || []), ...(incRes.data || [])].forEach(item => {
        const key = item.fecha;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ ...item, tipo: item.motivo ? 'incidencia' : 'programacion' });
      });
      setCalendarioData(grouped);
    } catch (error) {
      console.error('Error cargando calendario:', error);
      alert('Error al cargar el calendario');
    } finally {
      setCalendarioCargando(false);
    }
  };

  const cargarEstadisticas = async (mesFiltro = null) => {
    setStatsLoading(true);
    try {
      let query = supabase.from('programacion_actividades').select('fecha, actividad, ciclo');
      if (mesFiltro) {
        const { inicio, fin } = obtenerRangoMes(mesFiltro);
        query = query.gte('fecha', inicio).lte('fecha', fin);
      }
      const { data, error } = await query;
      if (error) throw error;

      const porActividad = {}, porDia = {}, porMes = {}, ciclosCount = {};
      const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

      data?.forEach(r => {
        porActividad[r.actividad] = (porActividad[r.actividad] || 0) + 1;
        porDia[r.fecha] = (porDia[r.fecha] || 0) + 1;
        const fecha = new Date(Date.UTC(parseInt(r.fecha.slice(0,4)), parseInt(r.fecha.slice(5,7))-1, parseInt(r.fecha.slice(8,10))));
        const key = `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth()+1).padStart(2,'0')}`;
        const label = `${meses[fecha.getUTCMonth()]} ${fecha.getUTCFullYear()}`;
        if (!porMes[key]) porMes[key] = { mes: label, cantidad: 0, key };
        porMes[key].cantidad++;
        if (r.ciclo) ciclosCount[r.ciclo] = (ciclosCount[r.ciclo] || 0) + 1;
      });

      const topCiclos = Object.entries(ciclosCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([ciclo, count]) => ({ ciclo, count }));

      setStats({
        total: data?.length || 0,
        porActividad: Object.entries(porActividad).map(([a, c]) => ({ actividad: a, cantidad: c })),
        porDia: Object.entries(porDia).map(([f, c]) => ({ fecha: f, cantidad: c })),
        porMes: Object.values(porMes).sort((a,b) => a.key.localeCompare(b.key)).slice(-12),
        topCiclos
      });
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const cambiarFecha = (dias) => {
    const [año, mes, dia] = filters.fecha.split('-').map(Number);
    const fecha = new Date(Date.UTC(año, mes - 1, dia, 12, 0, 0));
    fecha.setUTCDate(fecha.getUTCDate() + dias);
    setFilters({ fecha: `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth()+1).padStart(2,'0')}-${String(fecha.getUTCDate()).padStart(2,'0')}` });
    setPage(1);
  };

  const guardarAsignacion = async () => {
    if (usuariosSeleccionados.length === 0 || !actividadSeleccionada || !cicloAsignado.trim()) {
      alert('Completa todos los campos');
      return;
    }
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const inserts = usuariosSeleccionados.map(usuario => ({
        fecha: filters.fecha,
        usuario_nombre: usuario,
        actividad: actividadSeleccionada.id,
        ciclo: cicloAsignado.trim(),
        creado_por_id: user?.id,
        creado_por_nombre: user?.email
      }));
      const { error } = await supabase
        .from('programacion_actividades')
        .upsert(inserts, { onConflict: 'fecha, usuario_nombre' });
      if (error) throw error;
      setModalActividadVisible(false);
      setUsuariosSeleccionados([]);
      setActividadSeleccionada(null);
      setCicloAsignado('40');
      setCicloPreseleccionado(null);
      await cargarProgramacion();
      await cargarCiclosAsignados();
      await cargarIncidencias();
      if (showMonthModal) await cargarCalendario(mesCalendario);
      if (showStatsModal) await cargarEstadisticas(statsMesFiltro);
      alert(`✅ ${inserts.length} asignaciones guardadas`);
    } catch (error) {
      console.error('Error guardando asignación:', error);
      alert('Error al guardar: ' + (error.message || JSON.stringify(error)));
    } finally {
      setLoading(false);
    }
  };

  const eliminarProgramacion = async (id) => {
    if (!confirm('¿Eliminar esta asignación?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('programacion_actividades').delete().eq('id', id);
      if (error) throw error;
      await cargarProgramacion();
      await cargarCiclosAsignados();
      await cargarIncidencias();
      if (showMonthModal) await cargarCalendario(mesCalendario);
      if (showStatsModal) await cargarEstadisticas(statsMesFiltro);
      alert('Eliminada');
    } catch (error) {
      console.error('Error eliminando:', error);
      alert('Error al eliminar');
    } finally {
      setLoading(false);
    }
  };

  // ========== EXPORTAR EXCEL Y PLANTILLA ==========
  const exportarExcel = async () => {
    try {
      setExporting(true);
      const [progRes, incRes] = await Promise.all([
        supabase.from('programacion_actividades').select('*').order('fecha', { ascending: false }),
        supabase.from('incidencias').select('*').order('fecha', { ascending: false })
      ]);
      if (progRes.error) throw progRes.error;
      if (incRes.error) throw incRes.error;

      const progRows = (progRes.data || []).map(r => ({
        'Fecha': r.fecha,
        'Usuario': r.usuario_nombre,
        'Actividad': r.actividad,
        'Ciclo': r.ciclo,
        'Tipo': 'Programación',
        'Creado': new Date(r.created_at).toLocaleString('es-CO'),
        'Creado Por': r.creado_por_nombre || ''
      }));
      const incRows = (incRes.data || []).map(r => ({
        'Fecha': r.fecha,
        'Usuario': r.usuario_nombre,
        'Actividad': 'Incidencia',
        'Ciclo': '',
        'Tipo': 'Incidencia',
        'Motivo': r.motivo,
        'Creado': new Date(r.created_at).toLocaleString('es-CO'),
        'Creado Por': ''
      }));
      const allRows = [...progRows, ...incRows];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(allRows);
      XLSX.utils.book_append_sheet(wb, ws, 'Programacion_e_Incidencias');
      saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), 'programacion_incidencias.xlsx');
      alert(`✅ ${allRows.length} registros exportados`);
    } catch (error) {
      console.error('Error exportando:', error);
      alert('Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const descargarPlantilla = () => {
    const plantilla = [
      { Fecha: '2026-04-13', Usuario: 'Ejemplo Usuario', Actividad: 'lectura', Ciclo: '40' },
      { Fecha: '2026-04-13', Usuario: 'María López', Actividad: 'reparto', Ciclo: '60-160' },
      { Fecha: '2026-04-14', Usuario: 'Carlos Ruiz', Actividad: 'revision', Ciclo: '20' }
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(plantilla);
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla_Programacion');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), 'plantilla_programacion.xlsx');
  };

  const cargarExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (!rows || rows.length < 2) { alert("El archivo debe tener al menos una fila de datos"); e.target.value = ''; return; }
        const encabezados = rows[0].map(cell => (cell || "").toString().toLowerCase());
        const colFechaIdx = encabezados.findIndex(h => h.includes("fecha"));
        const colUsuarioIdx = encabezados.findIndex(h => h.includes("usuario"));
        const colActividadIdx = encabezados.findIndex(h => h.includes("actividad"));
        const colCicloIdx = encabezados.findIndex(h => h.includes("ciclo"));
        if (colFechaIdx === -1 || colUsuarioIdx === -1 || colActividadIdx === -1) {
          alert("El archivo debe tener columnas: Fecha, Usuario y Actividad (Ciclo opcional)");
          e.target.value = ''; return;
        }
        const errores = [], datosValidos = [];
        const fechaActual = obtenerFechaColombia();
        for (let i = 1; i < rows.length; i++) {
          const fila = rows[i];
          if (!fila || fila.every(cell => !cell || cell.toString().trim() === "")) continue;
          const fechaRaw = fila[colFechaIdx]?.toString().trim() || "";
          const usuario = fila[colUsuarioIdx]?.toString().trim() || "";
          const actividadRaw = fila[colActividadIdx]?.toString().trim() || "";
          const ciclo = fila[colCicloIdx]?.toString().trim() || "40";
          let fechaValida = fechaRaw || fechaActual;
          if (fechaRaw && !/^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)) {
            errores.push(`Fila ${i+1}: Fecha "${fechaRaw}" no es YYYY-MM-DD`); continue;
          }
          if (!usuario) { errores.push(`Fila ${i+1}: Usuario vacío`); continue; }
          const actividad = actividadRaw.toLowerCase();
          if (!['lectura', 'reparto', 'revision'].includes(actividad)) {
            errores.push(`Fila ${i+1}: Actividad "${actividadRaw}" no válida`); continue;
          }
          if (!CICLOS_MAESTROS[actividad].includes(ciclo)) {
            errores.push(`Fila ${i+1}: Ciclo "${ciclo}" no válido para ${actividad}`); continue;
          }
          datosValidos.push({ fecha: fechaValida, usuario, actividad, ciclo });
        }
        if (errores.length > 0) {
          alert(`❌ Errores:\n${errores.slice(0, 10).join('\n')}${errores.length > 10 ? '\n...' : ''}`);
          e.target.value = ''; return;
        }
        if (datosValidos.length === 0) { alert("No hay datos válidos"); e.target.value = ''; return; }
        const mapa = new Map();
        datosValidos.forEach(item => mapa.set(`${item.fecha}|${item.usuario}`, item));
        const unicos = Array.from(mapa.values());
        if (unicos.length !== datosValidos.length) {
          alert(`⚠️ Se encontraron ${datosValidos.length - unicos.length} duplicados. Se cargará solo el último.`);
        }
        setExcelData(unicos);
        setExcelPreview(unicos.slice(0, 5));
        setShowExcelModal(true);
      } catch (error) {
        alert("Error al leer el archivo: " + error.message);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const guardarExcel = async () => {
    if (!excelData.length) { alert("No hay datos"); return; }
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      let toInsert = excelData.map(r => ({
        fecha: r.fecha,
        usuario_nombre: r.usuario,
        actividad: r.actividad,
        ciclo: r.ciclo,
        creado_por_id: user?.id,
        creado_por_nombre: user?.email
      }));
      const uniqueMap = new Map();
      toInsert.forEach(item => uniqueMap.set(`${item.fecha}|${item.usuario_nombre}`, item));
      toInsert = Array.from(uniqueMap.values());
      const batchSize = 100;
      let success = 0, errors = 0;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        const { error } = await supabase
          .from('programacion_actividades')
          .upsert(batch, { onConflict: 'fecha, usuario_nombre' });
        if (error) { errors += batch.length; console.error(error); } else success += batch.length;
      }
      alert(`✅ ${success} registros cargados${errors ? `, ${errors} fallaron` : ''}`);
      setShowExcelModal(false);
      setExcelData([]);
      setExcelPreview([]);
      await cargarProgramacion();
      await cargarCiclosAsignados();
      await cargarIncidencias();
      if (showMonthModal) await cargarCalendario(mesCalendario);
      if (showStatsModal) await cargarEstadisticas(statsMesFiltro);
    } catch (error) {
      alert('Error al cargar Excel: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUsuarioSeleccionado = (usuario) => {
    setUsuariosSeleccionados(prev =>
      prev.includes(usuario) ? prev.filter(u => u !== usuario) : [...prev, usuario]
    );
  };

  const seleccionarTodos = () => {
    const disponibles = usuarios.filter(u => !usuariosProgramadosHoy.has(u));
    setUsuariosSeleccionados(prev =>
      prev.length === disponibles.length ? [] : disponibles
    );
  };

  // ========== MEMOIZACIÓN ==========
  const programacionPorActividad = useMemo(() => ({
    lectura: programacion.filter(p => p.actividad === 'lectura'),
    reparto: programacion.filter(p => p.actividad === 'reparto'),
    revision: programacion.filter(p => p.actividad === 'revision')
  }), [programacion]);

  const pendientesPorActividad = useMemo(() => {
    const result = {};
    ACTIVIDADES.forEach(act => {
      const total = CICLOS_MAESTROS[act.id]?.length || 0;
      const asignados = ciclosAsignados[act.id]?.size || 0;
      const pendientes = CICLOS_MAESTROS[act.id]?.filter(c => !ciclosAsignados[act.id]?.has(c)) || [];
      result[act.id] = { total, asignados, pendientes };
    });
    return result;
  }, [ciclosAsignados]);

  // ========== CALENDARIO / VISTA MENSUAL ==========
  const generarDiasDelMes = useCallback((mes) => {
    const [año, mesNum] = mes.split('-').map(Number);
    const primerDia = new Date(Date.UTC(año, mesNum - 1, 1));
    const ultimoDia = new Date(Date.UTC(año, mesNum, 0));
    const diasEnMes = ultimoDia.getUTCDate();
    const diaSemanaInicio = primerDia.getUTCDay() === 0 ? 6 : primerDia.getUTCDay() - 1;
    const dias = [];
    for (let i = 0; i < diaSemanaInicio; i++) dias.push({ fecha: null, vacio: true, asignaciones: [] });
    for (let d = 1; d <= diasEnMes; d++) {
      const fechaStr = `${año}-${String(mesNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dias.push({ fecha: fechaStr, dia: d, asignaciones: calendarioData[fechaStr] || [], vacio: false });
    }
    return dias;
  }, [calendarioData]);

  // ========== RENDER ==========
  return (
    <div className="page">
      <header className="topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>Programación Diaria</h1>
        {rol === 'admin' && <span className="user-role">Admin</span>}
      </header>

      {/* Pestañas para cambiar de vista */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 8, padding: 4 }}>
          <button
            className={`action-btn ${viewMode === 'diario' ? 'primary' : 'secondary'}`}
            onClick={() => setViewMode('diario')}
            style={{ margin: 0, borderRadius: 6 }}
          >
            📅 Vista Diaria
          </button>
          <button
            className={`action-btn ${viewMode === 'mensual' ? 'primary' : 'secondary'}`}
            onClick={() => setViewMode('mensual')}
            style={{ margin: 0, borderRadius: 6 }}
          >
            📊 Vista Mensual (Matriz)
          </button>
        </div>
      </div>

      {/* ========== VISTA DIARIA (ORIGINAL) ========== */}
      {viewMode === 'diario' && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="icon-btn" onClick={() => cambiarFecha(-1)}>←</button>
              <input type="date" value={filters.fecha} onChange={e => setFilters({ fecha: e.target.value, page: 1 })} style={{ padding: '8px', borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <button className="icon-btn" onClick={() => cambiarFecha(1)}>→</button>
            </div>
            <div className="actions-dropdown" style={{ position: 'relative', display: 'inline-block' }}>
              <button className="action-btn secondary">Acciones ▼</button>
              <div className="dropdown-content" style={{ display: 'none', position: 'absolute', background: '#fff', boxShadow: '0 8px 16px rgba(0,0,0,0.1)', borderRadius: 8, padding: 8, zIndex: 10, minWidth: '180px' }}>
                <button className="action-btn success" onClick={exportarExcel} disabled={exporting || loading} style={{ display: 'block', width: '100%', marginBottom: 4 }}>
                  {exporting ? '⏳' : '📊 Exportar Excel'}
                </button>
                <button className="action-btn secondary" onClick={descargarPlantilla} style={{ display: 'block', width: '100%', marginBottom: 4 }}>📋 Plantilla</button>
                <label className="action-btn secondary" style={{ display: 'block', width: '100%', cursor: 'pointer' }}>
                  📥 Cargar Excel
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={cargarExcel} style={{ display: 'none' }} />
                </label>
                <button className="action-btn primary" onClick={() => setShowStatsModal(true)} style={{ display: 'block', width: '100%' }}>📊 Ver Estadísticas</button>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 20, padding: 16, background: '#fff', borderRadius: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginBottom: 12 }}>📋 Control de Ciclos del Mes</h3>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="month" value={mesControl} onChange={e => setMesControl(e.target.value)} style={{ padding: '8px', borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <button className="action-btn secondary" onClick={() => { setMesCalendario(mesControl); setShowMonthModal(true); }}>📅 Ver Calendario Mensual</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>
              {ACTIVIDADES.map(act => {
                const { total, asignados } = pendientesPorActividad[act.id] || {};
                return (
                  <div key={act.id} className="stat-card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 600 }}>{act.nombre}</span>
                      <span style={{ background: act.color, color: 'white', padding: '4px 8px', borderRadius: 12, fontSize: 12 }}>
                        {asignados}/{total}
                      </span>
                    </div>
                    <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, marginBottom: 12 }}>
                      <div style={{ width: `${(asignados/total)*100}%`, height: '100%', background: act.color, borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 12 }}>⏳ Ciclos Pendientes de Asignación</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {ACTIVIDADES.map(act => {
                const pendientes = pendientesPorActividad[act.id]?.pendientes || [];
                return (
                  <div key={act.id} style={{ background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0' }}>
                    <h4 style={{ color: act.color, marginBottom: 8, fontSize: 14, fontWeight: 600 }}>{act.nombre}</h4>
                    {pendientes.length === 0 ? (
                      <p style={{ color: '#10b981', fontSize: 13 }}>✓ Todos asignados</p>
                    ) : (
                      <div style={{ maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {pendientes.map(ciclo => (
                            <button key={ciclo} className="badge" style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 16, cursor: 'pointer', border: '1px solid #e2e8f0', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                              onClick={() => {
                                setActividadSeleccionada(act);
                                setCicloAsignado(ciclo);
                                setCicloPreseleccionado(ciclo);
                                setUsuariosSeleccionados([]);
                                setModalActividadVisible(true);
                              }}>
                              {ciclo} ➕
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {usuarios.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 12 }}>
              <p>No hay usuarios disponibles.</p>
              <button className="action-btn primary" onClick={cargarUsuarios}>Reintentar</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                {ACTIVIDADES.map(act => {
                  const count = programacionPorActividad[act.id].length;
                  return (
                    <div key={act.id} className="stat-card" style={{ cursor: 'pointer', padding: 16 }}
                      onClick={() => {
                        setActividadSeleccionada(act);
                        setUsuariosSeleccionados([]);
                        setCicloAsignado(act.meta.toString());
                        setCicloPreseleccionado(null);
                        setModalActividadVisible(true);
                      }}>
                      <div className="stat-info">
                        <div className="stat-label">{act.nombre}</div>
                        <div className="stat-value">{count}</div>
                        <small>programados hoy</small>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginBottom: 24, padding: 16, background: '#fef2f2', borderRadius: 12, border: '1px solid #fecaca' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ color: '#b91c1c' }}>⚠️ Incidencias del día</h3>
                  <button className="action-btn primary" onClick={() => {
                    setUsuarioIncidencia(null);
                    setMotivoIncidencia('');
                    setModalIncidenciaVisible(true);
                  }}>
                    + Agregar incidencia
                  </button>
                </div>
                {incidencias.length === 0 ? (
                  <p style={{ color: '#64748b' }}>No hay incidencias para esta fecha.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {incidencias.map(inc => (
                      <li key={inc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #fecaca' }}>
                        <span><strong>{inc.usuario_nombre}</strong> - {inc.motivo}</span>
                        {rol === 'admin' && (
                          <button className="icon-btn" onClick={() => eliminarIncidencia(inc.id)}>🗑️</button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          <div className="table-container">
            <table>
              <thead><tr><th>Actividad</th><th>Usuario</th><th>Ciclo</th><th>Estado</th>{rol === 'admin' && <th>Acciones</th>}</tr></thead>
              <tbody>
                {programacion.map(item => {
                  const tieneIncidencia = incidencias.some(inc => inc.usuario_nombre === item.usuario_nombre);
                  return (
                    <tr key={item.id}>
                      <td><span className="badge" style={{ background: item.actividad === 'lectura' ? '#dbeafe' : item.actividad === 'reparto' ? '#d9f99d' : '#fed7aa' }}>{item.actividad}</span></td>
                      <td>{item.usuario_nombre}</td>
                      <td>{item.ciclo}</td>
                      <td>{tieneIncidencia ? <span style={{ color: '#dc2626', fontWeight: 'bold' }}>⚠️ Incidencia</span> : <span style={{ color: '#16a34a' }}>✅ Normal</span>}</td>
                      {rol === 'admin' && (
                        <td>
                          <button className="icon-btn" onClick={() => eliminarProgramacion(item.id)}>🗑️</button>
                          {!tieneIncidencia && (
                            <button className="icon-btn" onClick={() => {
                              setUsuarioIncidencia(item.usuario_nombre);
                              setMotivoIncidencia('');
                              setModalIncidenciaVisible(true);
                            }} style={{ color: '#dc2626' }}>⚠️</button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {programacion.length === 0 && (
                  <tr><td colSpan={rol === 'admin' ? 5 : 4} style={{ textAlign: 'center', padding: 40 }}>No hay programación para esta fecha</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalCount > PAGE_SIZE && (
            <div className="pagination">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>← Anterior</button>
              <span>Página {page} de {Math.ceil(totalCount / PAGE_SIZE)}</span>
              <button onClick={() => setPage(p => p+1)} disabled={page >= Math.ceil(totalCount / PAGE_SIZE)}>Siguiente →</button>
            </div>
          )}
        </>
      )}

      {/* ========== VISTA MENSUAL CON COLORES Y FESTIVOS ========== */}
      {viewMode === 'mensual' && (
        <div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <label style={{ fontWeight: 600 }}>Seleccionar mes:</label>
            <input type="month" value={mesControl} onChange={e => setMesControl(e.target.value)} style={{ padding: '8px', borderRadius: 8, border: '1px solid #e2e8f0' }} />
            {loading && <span style={{ color: '#64748b' }}>Cargando datos del mes...</span>}
          </div>

          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 8 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '1000px', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th rowSpan="3" style={{ border: '1px solid #cbd5e1', padding: '8px', background: '#e2e8f0', fontWeight: 'bold', textAlign: 'center' }}>
                    Mes
                  </th>
                  {usuarios.map(usuario => (
                    <th key={usuario} colSpan="6" style={{ border: '1px solid #cbd5e1', padding: '8px', background: '#f1f5f9', fontWeight: 'bold', textAlign: 'center' }}>
                      {usuario}
                    </th>
                  ))}
                </tr>
                <tr style={{ background: '#f8fafc' }}>
                  {usuarios.map(usuario => (
                    <React.Fragment key={`sub-${usuario}`}>
                      <th colSpan="2" style={{ border: '1px solid #cbd5e1', padding: '4px', background: '#e2e8f0', textAlign: 'center', fontWeight: 'bold' }}>Lectura</th>
                      <th colSpan="2" style={{ border: '1px solid #cbd5e1', padding: '4px', background: '#e2e8f0', textAlign: 'center', fontWeight: 'bold' }}>Reparto</th>
                      <th colSpan="2" style={{ border: '1px solid #cbd5e1', padding: '4px', background: '#e2e8f0', textAlign: 'center', fontWeight: 'bold' }}>Revisión</th>
                    </React.Fragment>
                  ))}
                </tr>
                <tr style={{ background: '#f8fafc' }}>
                  {usuarios.map(usuario => (
                    <React.Fragment key={`cols-${usuario}`}>
                      <th style={{ border: '1px solid #cbd5e1', padding: '4px', background: '#f1f5f9', textAlign: 'center', fontWeight: 'bold' }}>Ciclo</th>
                      <th style={{ border: '1px solid #cbd5e1', padding: '4px', background: '#f1f5f9', textAlign: 'center', fontWeight: 'bold' }}>Cant</th>
                      <th style={{ border: '1px solid #cbd5e1', padding: '4px', background: '#f1f5f9', textAlign: 'center', fontWeight: 'bold' }}>Ciclo</th>
                      <th style={{ border: '1px solid #cbd5e1', padding: '4px', background: '#f1f5f9', textAlign: 'center', fontWeight: 'bold' }}>Cant</th>
                      <th style={{ border: '1px solid #cbd5e1', padding: '4px', background: '#f1f5f9', textAlign: 'center', fontWeight: 'bold' }}>Ciclo</th>
                      <th style={{ border: '1px solid #cbd5e1', padding: '4px', background: '#f1f5f9', textAlign: 'center', fontWeight: 'bold' }}>Cant</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {generarDiasDelMes(mesControl).map(dia => {
                  if (dia.vacio) return null;
                  const fechaStr = dia.fecha;
                  
                  // Calcular día de la semana para resaltar sábados y domingos
                  const partes = fechaStr.split('-').map(Number);
                  const fechaObj = new Date(Date.UTC(partes[0], partes[1] - 1, partes[2]));
                  const diaSemana = fechaObj.getUTCDay(); // 0: Dom, 6: Sab
                  const esFinDeSemana = diaSemana === 0 || diaSemana === 6;
                  const esFestivo = festivos.has(fechaStr);
                  
                  return (
                    <tr key={fechaStr} style={{ 
                      borderBottom: '1px solid #e2e8f0', 
                      backgroundColor: esFestivo ? '#fef3c7' : (esFinDeSemana ? '#f1f5f9' : 'transparent'),
                      opacity: esFinDeSemana ? 0.6 : 1
                    }}>
                      <td style={{ border: '1px solid #cbd5e1', padding: '6px', whiteSpace: 'nowrap', textAlign: 'left' }}>
                        {formatearFechaLocal(fechaStr)}
                        {/* Botón para Admin: Marcar/Quitar Festivo */}
                        {rol === 'admin' && (
                          <button 
                            onClick={() => toggleFestivo(fechaStr)} 
                            style={{ marginLeft: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 'bold' }}
                            title="Marcar / Quitar día festivo"
                          >
                            {esFestivo ? '⛔' : '📅'}
                          </button>
                        )}
                      </td>
                      {usuarios.map(usuario => {
                        const diaUsuario = datosMensualesMap[fechaStr]?.[usuario] || {};
                        const lect = diaUsuario['lectura'];
                        const rep = diaUsuario['reparto'];
                        const rev = diaUsuario['revision'];
                        
                        return (
                          <React.Fragment key={`${fechaStr}-${usuario}`}>
                            <td style={{ border: '1px solid #cbd5e1', padding: '4px', textAlign: 'center', color: lect ? 'inherit' : '#94a3b8' }}>
                              {lect ? lect.ciclo : '-'}
                            </td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '4px', textAlign: 'center', color: lect ? 'inherit' : '#94a3b8' }}>
                              {lect ? lect.count : '-'}
                            </td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '4px', textAlign: 'center', color: rep ? 'inherit' : '#94a3b8' }}>
                              {rep ? rep.ciclo : '-'}
                            </td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '4px', textAlign: 'center', color: rep ? 'inherit' : '#94a3b8' }}>
                              {rep ? rep.count : '-'}
                            </td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '4px', textAlign: 'center', color: rev ? 'inherit' : '#94a3b8' }}>
                              {rev ? rev.ciclo : '-'}
                            </td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '4px', textAlign: 'center', color: rev ? 'inherit' : '#94a3b8' }}>
                              {rev ? rev.count : '-'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========== MODALES ========== */}
      {modalActividadVisible && (
        <div className="modal-overlay" onClick={() => setModalActividadVisible(false)}>
          <div className="modal-content" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Asignar {actividadSeleccionada?.nombre}</h2>
              <button className="close-btn" onClick={() => setModalActividadVisible(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16 }}>Fecha: {formatearFechaLocal(filters.fecha)} {cicloPreseleccionado && <span style={{ marginLeft: 16, fontWeight: 600 }}>Ciclo: {cicloPreseleccionado}</span>}</p>
              <div style={{ marginBottom: 16 }}>
                <label className="modal-label">👥 Seleccionar usuarios</label>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <button className="secondary-btn" onClick={seleccionarTodos}>
                    {usuariosSeleccionados.length === usuarios.filter(u => !usuariosProgramadosHoy.has(u)).length ? 'Deseleccionar todos' : 'Seleccionar todos disponibles'}
                  </button>
                  <span>{usuariosSeleccionados.length} de {usuarios.filter(u => !usuariosProgramadosHoy.has(u)).length} disponibles</span>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
                  {usuarios.map(usuario => {
                    const yaProgramado = usuariosProgramadosHoy.has(usuario);
                    const programadoEnEsta = programacionPorActividad[actividadSeleccionada?.id]?.some(p => p.usuario_nombre === usuario);
                    const tieneIncidencia = incidencias.some(inc => inc.usuario_nombre === usuario);
                    return (
                      <div key={usuario} style={{ padding: 8, marginBottom: 4, borderRadius: 6, backgroundColor: yaProgramado ? (programadoEnEsta ? '#fef9c3' : '#fee2e2') : (usuariosSeleccionados.includes(usuario) ? '#dbeafe' : '#fff'), border: '1px solid #e2e8f0', cursor: yaProgramado ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onClick={() => !yaProgramado && toggleUsuarioSeleccionado(usuario)}>
                        <span>{usuario} {tieneIncidencia && <span style={{ color: '#dc2626', fontSize: 12 }}>⚠️</span>}</span>
                        {yaProgramado && <span style={{ fontSize: 12, color: programadoEnEsta ? '#f59e0b' : '#ef4444' }}>{programadoEnEsta ? 'Ya asignado' : 'Otra actividad'}</span>}
                        {usuariosSeleccionados.includes(usuario) && <span>✅</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="modal-label">🔄 Ciclo de trabajo</label>
                <input type="text" className="form-input" value={cicloAsignado} onChange={e => setCicloAsignado(e.target.value)} placeholder={`Ej: ${actividadSeleccionada?.id === 'reparto' ? '40-140' : '40'}`} />
                <small style={{ color: '#64748b', display: 'block', marginTop: 4 }}>{actividadSeleccionada && CICLOS_MAESTROS[actividadSeleccionada.id]?.length} ciclos disponibles</small>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-btn" onClick={() => setModalActividadVisible(false)}>Cancelar</button>
              <button className="primary-btn" onClick={guardarAsignacion} disabled={usuariosSeleccionados.length === 0 || loading}>
                {loading ? 'Guardando...' : `Programar ${usuariosSeleccionados.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalIncidenciaVisible && (
        <div className="modal-overlay" onClick={() => setModalIncidenciaVisible(false)}>
          <div className="modal-content" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrar Incidencia</h2>
              <button className="close-btn" onClick={() => setModalIncidenciaVisible(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}>
                <label className="modal-label">👤 Usuario</label>
                <select
                  className="form-input"
                  value={usuarioIncidencia || ''}
                  onChange={e => setUsuarioIncidencia(e.target.value)}
                >
                  <option value="">Seleccionar usuario</option>
                  {usuarios.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="modal-label">📝 Motivo</label>
                <input
                  type="text"
                  className="form-input"
                  value={motivoIncidencia}
                  onChange={e => setMotivoIncidencia(e.target.value)}
                  placeholder="Ej: Permiso, Incapacidad, etc."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-btn" onClick={() => setModalIncidenciaVisible(false)}>Cancelar</button>
              <button className="primary-btn" onClick={agregarIncidencia}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {showStatsModal && (
        <div className="modal-overlay" onClick={() => setShowStatsModal(false)}>
          <div className="modal-content" style={{ maxWidth: 1000 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📊 Estadísticas de Programación</h2>
              <button className="close-btn" onClick={() => setShowStatsModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontWeight: 500 }}>📅 Filtrar por mes:</label>
                <input type="month" value={statsMesFiltro} onChange={e => setStatsMesFiltro(e.target.value)} style={{ padding: '8px', borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <button className="secondary-btn" onClick={() => setStatsMesFiltro('')}>Todos</button>
                <span style={{ marginLeft: 'auto', fontSize: 14, color: '#64748b' }}>Total: <strong>{stats.total}</strong> registros</span>
              </div>
              {statsLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>Cargando estadísticas...</div>
              ) : (
                <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div className="dashboard-card">
                    <h3>📅 Registros por Día</h3>
                    <div style={{ height: 250 }}>
                      {stats.porDia?.length > 0 && (
                        <ResponsiveContainer width="100%" height="100%" key={`line-${statsMesFiltro || 'all'}-${stats.porDia.length}`}>
                          <LineChart data={stats.porDia}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="fecha" tick={{ fontSize: 10 }} interval={Math.floor(stats.porDia.length / 20)} />
                            <YAxis />
                            <Tooltip formatter={(value) => `${value} asignaciones`} labelFormatter={(label) => `Fecha: ${formatearFechaLocal(label)}`} />
                            <Legend />
                            <Line type="monotone" dataKey="cantidad" stroke="#3b82f6" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                  <div className="dashboard-card">
                    <h3>📊 Registros por Mes</h3>
                    <div style={{ height: 250 }}>
                      {stats.porMes?.length > 0 && (
                        <ResponsiveContainer width="100%" height="100%" key={`bar-${statsMesFiltro || 'all'}-${stats.porMes.length}`}>
                          <BarChart data={stats.porMes}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="cantidad" fill="#f59e0b" radius={[4,4,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                  <div className="dashboard-card" style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div>
                      <h3>🥧 Distribución por Actividad</h3>
                      <div style={{ height: 250 }}>
                        {stats.porActividad?.length > 0 && (
                          <ResponsiveContainer width="100%" height="100%" key={`pie-${statsMesFiltro || 'all'}-${stats.porActividad.length}`}>
                            <PieChart>
                              <Pie data={stats.porActividad} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="cantidad" nameKey="actividad" label={entry => entry.actividad}>
                                {stats.porActividad.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3>🔄 Ciclos más frecuentes</h3>
                      {stats.topCiclos?.length > 0 ? (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                          {stats.topCiclos.map((item, idx) => (
                            <li key={idx} style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                              <span>Ciclo {item.ciclo}</span>
                              <span style={{ fontWeight: 600 }}>{item.count} veces</span>
                            </li>
                          ))}
                        </ul>
                      ) : <p style={{ color: '#94a3b8' }}>No hay ciclos registrados</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="primary-btn" onClick={() => setShowStatsModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showMonthModal && (
        <div className="modal-overlay" onClick={() => setShowMonthModal(false)}>
          <div className="modal-content" style={{ maxWidth: 1000, maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button className="icon-btn" onClick={() => cambiarMesCalendario(-1)}>←</button>
                <h2>{new Date(mesCalendario + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h2>
                <button className="icon-btn" onClick={() => cambiarMesCalendario(1)}>→</button>
              </div>
              <button className="close-btn" onClick={() => setShowMonthModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              {calendarioCargando ? (
                <div style={{ textAlign: 'center', padding: 40 }}>Cargando calendario...</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8, textAlign: 'center', fontWeight: 600 }}>
                    <div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div><div>Dom</div>
                  </div>
                  <div className="calendario-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                    {generarDiasDelMes(mesCalendario).map((dia, idx) => (
                      <div key={idx} onClick={() => handleDayClick(dia)} className="dia-cell" style={{
                        minHeight: 140, maxHeight: 200, overflowY: 'auto', background: dia.vacio ? '#f9f9f9' : '#fff',
                        border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, position: 'relative',
                        opacity: dia.vacio ? 0.5 : 1, cursor: dia.vacio ? 'default' : 'pointer',
                        transition: 'all 0.2s ease', boxShadow: dia.vacio ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
                      }}>
                        {!dia.vacio && (
                          <>
                            <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                              <span>{dia.dia}</span>
                              <span style={{ fontSize: 12, color: '#64748b' }}>{dia.asignaciones?.length || 0}</span>
                            </div>
                            {dia.asignaciones?.length > 0 ? (
                              dia.asignaciones.slice(0, 4).map((a, i) => {
                                const isIncidencia = a.tipo === 'incidencia';
                                return (
                                  <div key={i} style={{
                                    background: isIncidencia ? '#fee2e2' : (a.actividad === 'lectura' ? '#dbeafe' : a.actividad === 'reparto' ? '#d9f99d' : '#fed7aa'),
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    marginBottom: 2,
                                    fontSize: 11,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    border: isIncidencia ? '1px solid #fecaca' : 'none'
                                  }}>
                                    {isIncidencia ? `⚠️ ${a.usuario_nombre} (${a.motivo})` : `${a.usuario_nombre} (${a.ciclo})`}
                                  </div>
                                );
                              })
                            ) : (
                              <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 20 }}>─</div>
                            )}
                            {dia.asignaciones?.length > 4 && (
                              <div style={{ color: '#3b82f6', fontSize: 10, marginTop: 4, textAlign: 'center' }}>
                                +{dia.asignaciones.length - 4} más
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="primary-btn" onClick={() => setShowMonthModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showDayModal && selectedDay && (
        <div className="modal-overlay" onClick={() => setShowDayModal(false)}>
          <div className="modal-content" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalle del {formatearFechaLocal(selectedDay.fecha)}</h2>
              <button className="close-btn" onClick={() => setShowDayModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {selectedDay.asignaciones?.length > 0 ? (
                <table className="table-container" style={{ width: '100%' }}>
                  <thead><tr><th>Tipo</th><th>Usuario</th><th>Detalle</th></tr></thead>
                  <tbody>
                    {selectedDay.asignaciones.map((a, idx) => {
                      const isIncidencia = a.tipo === 'incidencia';
                      return (
                        <tr key={idx}>
                          <td>
                            <span className="badge" style={{
                              background: isIncidencia ? '#fee2e2' : (a.actividad === 'lectura' ? '#dbeafe' : a.actividad === 'reparto' ? '#d9f99d' : '#fed7aa'),
                              color: isIncidencia ? '#b91c1c' : 'inherit'
                            }}>
                              {isIncidencia ? '⚠️ Incidencia' : a.actividad}
                            </span>
                          </td>
                          <td>{a.usuario_nombre}</td>
                          <td>{isIncidencia ? a.motivo : `Ciclo ${a.ciclo}`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <p style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>No hay registros para este día.</p>}
            </div>
            <div className="modal-footer">
              <button className="primary-btn" onClick={() => setShowDayModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showExcelModal && (
        <div className="modal-overlay" onClick={() => setShowExcelModal(false)}>
          <div className="modal-content" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Vista previa Excel</h2>
              <button className="close-btn" onClick={() => setShowExcelModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p><strong>{excelData.length}</strong> registros a cargar</p>
              <table className="table-container" style={{ maxHeight: 300, overflow: 'auto', display: 'block' }}>
                <thead><tr><th>Fecha</th><th>Usuario</th><th>Actividad</th></tr></thead>
                <tbody>
                  {excelPreview.map((r, i) => <tr key={i}><td>{r.fecha}</td><td>{r.usuario}</td><td>{r.actividad}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="secondary-btn" onClick={() => setShowExcelModal(false)}>Cancelar</button>
              <button className="primary-btn" onClick={guardarExcel} disabled={loading}>{loading ? 'Cargando...' : `Cargar ${excelData.length}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}