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
const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']

const ACTIVIDADES = [
  { id: 'lectura', nombre: '📄 Lectura', color: '#3B82F6', meta: 30 },
  { id: 'reparto', nombre: '📦 Reparto', color: '#10B981', meta: 60 },
  { id: 'revision', nombre: '🔍 Revisión', color: '#F59E0B', meta: 30 }
]

// Listas maestras de ciclos por actividad
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

// Función para obtener fecha actual de Colombia (UTC-5) en formato YYYY-MM-DD
const obtenerFechaColombia = () => {
  const ahora = new Date();
  const colombia = new Date(ahora.getTime() - (5 * 60 * 60 * 1000));
  const año = colombia.getUTCFullYear();
  const mes = String(colombia.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(colombia.getUTCDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
};

// Obtener primer y último día del mes (en formato YYYY-MM-DD)
const obtenerRangoMes = (mes) => {
  const [año, mesNum] = mes.split('-').map(Number);
  const inicio = new Date(Date.UTC(año, mesNum - 1, 1));
  const fin = new Date(Date.UTC(año, mesNum, 0));
  const formato = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  return { inicio: formato(inicio), fin: formato(fin) };
};

// Formatear fecha para mostrar en el modal (ej: "viernes, 20 de febrero de 2026")
const formatearFechaLocal = (fechaStr) => {
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const [año, mes, dia] = fechaStr.split('-').map(Number);
  const fecha = new Date(Date.UTC(año, mes - 1, dia, 12, 0, 0));
  const diaSemana = dias[fecha.getUTCDay()];
  return `${diaSemana}, ${dia} de ${meses[mes - 1]} de ${año}`;
};

const formatearNumero = (num) => new Intl.NumberFormat('es-CO').format(num || 0);

export default function ProgramacionDiaria({ onBack, rol }) {
  const [programacion, setProgramacion] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelData, setExcelData] = useState([]);
  const [excelPreview, setExcelPreview] = useState([]);
  const [resultadoCarga, setResultadoCarga] = useState(null);
  const [filters, setFilters] = useState({
    fecha: obtenerFechaColombia()
  });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Para control de ciclos por mes
  const [mesControl, setMesControl] = useState(obtenerFechaColombia().slice(0, 7)); // YYYY-MM
  const [ciclosAsignados, setCiclosAsignados] = useState({
    lectura: new Set(),
    reparto: new Set(),
    revision: new Set()
  });

  // Para asignación rápida
  const [modalActividadVisible, setModalActividadVisible] = useState(false);
  const [actividadSeleccionada, setActividadSeleccionada] = useState(null);
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState([]);
  const [cicloAsignado, setCicloAsignado] = useState('40');
  const [usuariosProgramadosHoy, setUsuariosProgramadosHoy] = useState(new Set());
  const [cicloPreseleccionado, setCicloPreseleccionado] = useState(null);

  // Para vista calendario mensual
  const [calendarioData, setCalendarioData] = useState({});
  const [calendarioCargando, setCalendarioCargando] = useState(false);
  const [mesCalendario, setMesCalendario] = useState(mesControl);

  // Estadísticas
  const [stats, setStats] = useState({
    total: 0,
    porActividad: [],
    porDia: [],
    porMes: []
  });

  useEffect(() => {
    cargarUsuarios();
  }, []);

  useEffect(() => {
    cargarProgramacion();
    cargarEstadisticas();
  }, [filters, page]);

  useEffect(() => {
    cargarCiclosAsignados();
  }, [mesControl]);

  // Cargar usuarios desde las tablas de supervisiones
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
      const usuariosUnicos = [...new Set(nombres)].sort();
      setUsuarios(usuariosUnicos);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    }
  };

  // Cargar programación de la fecha seleccionada
  const cargarProgramacion = async () => {
    setLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('programacion_actividades')
        .select('*', { count: 'exact' })
        .eq('fecha', filters.fecha)
        .order('actividad', { ascending: true })
        .range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;
      setProgramacion(data || []);
      setTotalCount(count || 0);

      const usuariosHoy = new Set();
      data?.forEach(item => usuariosHoy.add(item.usuario_nombre));
      setUsuariosProgramadosHoy(usuariosHoy);
    } catch (error) {
      console.error('Error cargando programación:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar ciclos asignados en el mes seleccionado
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

      const asignados = {
        lectura: new Set(),
        reparto: new Set(),
        revision: new Set()
      };
      data?.forEach(item => {
        if (item.ciclo) {
          asignados[item.actividad]?.add(item.ciclo);
        }
      });
      setCiclosAsignados(asignados);
    } catch (error) {
      console.error('Error cargando ciclos asignados:', error);
    }
  };

  // Cargar datos para el calendario mensual
  const cargarCalendario = async (mes) => {
    if (!mes) return;
    setCalendarioCargando(true);
    const { inicio, fin } = obtenerRangoMes(mes);
    try {
      const { data, error } = await supabase
        .from('programacion_actividades')
        .select('fecha, actividad, usuario_nombre, ciclo, id')
        .gte('fecha', inicio)
        .lte('fecha', fin)
        .order('fecha', { ascending: true });

      if (error) throw error;

      const grouped = {};
      data?.forEach(item => {
        if (!grouped[item.fecha]) {
          grouped[item.fecha] = [];
        }
        grouped[item.fecha].push(item);
      });
      setCalendarioData(grouped);
    } catch (error) {
      console.error('Error cargando calendario:', error);
      alert('Error al cargar el calendario');
    } finally {
      setCalendarioCargando(false);
    }
  };

  // Cargar estadísticas generales
  const cargarEstadisticas = async () => {
    try {
      const { data, error } = await supabase
        .from('programacion_actividades')
        .select('fecha, actividad, ciclo');
      if (error) throw error;

      const porActividad = {};
      const porDia = {};
      const porMes = {};
      const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

      data?.forEach(r => {
        porActividad[r.actividad] = (porActividad[r.actividad] || 0) + 1;
        porDia[r.fecha] = (porDia[r.fecha] || 0) + 1;

        const fecha = new Date(Date.UTC(parseInt(r.fecha.slice(0,4)), parseInt(r.fecha.slice(5,7))-1, parseInt(r.fecha.slice(8,10))));
        const key = `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth()+1).padStart(2,'0')}`;
        const label = `${meses[fecha.getUTCMonth()]} ${fecha.getUTCFullYear()}`;
        if (!porMes[key]) porMes[key] = { mes: label, cantidad: 0, key };
        porMes[key].cantidad++;
      });

      setStats({
        total: data?.length || 0,
        porActividad: Object.entries(porActividad).map(([a, c]) => ({ actividad: a, cantidad: c })),
        porDia: Object.entries(porDia).map(([f, c]) => ({ fecha: f, cantidad: c })),
        porMes: Object.values(porMes).sort((a,b) => a.key.localeCompare(b.key)).slice(-12)
      });
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  // Cambiar fecha (suma/resta días) usando UTC
  const cambiarFecha = (dias) => {
    const [año, mes, dia] = filters.fecha.split('-').map(Number);
    const fecha = new Date(Date.UTC(año, mes - 1, dia, 12, 0, 0));
    fecha.setUTCDate(fecha.getUTCDate() + dias);
    const nuevoAño = fecha.getUTCFullYear();
    const nuevoMes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const nuevoDia = String(fecha.getUTCDate()).padStart(2, '0');
    setFilters({ fecha: `${nuevoAño}-${nuevoMes}-${nuevoDia}` });
    setPage(1);
  };

  // Guardar asignación de actividad a usuarios seleccionados
  const guardarAsignacion = async () => {
    if (usuariosSeleccionados.length === 0) {
      alert('Selecciona al menos un usuario');
      return;
    }
    if (!actividadSeleccionada) return;
    if (!cicloAsignado.trim()) {
      alert('El ciclo es requerido');
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
      await cargarEstadisticas();
      await cargarCiclosAsignados();
      if (showMonthModal) {
        await cargarCalendario(mesCalendario);
      }
      alert(`✅ ${inserts.length} asignaciones guardadas`);
    } catch (error) {
      console.error('Error guardando asignación:', error);
      alert('Error al guardar: ' + (error.message || JSON.stringify(error)));
    } finally {
      setLoading(false);
    }
  };

  // Eliminar programación
  const eliminarProgramacion = async (id) => {
    if (!confirm('¿Eliminar esta asignación?')) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('programacion_actividades')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await cargarProgramacion();
      await cargarEstadisticas();
      await cargarCiclosAsignados();
      if (showMonthModal) {
        await cargarCalendario(mesCalendario);
      }
      alert('Eliminada');
    } catch (error) {
      console.error('Error eliminando:', error);
      alert('Error al eliminar');
    } finally {
      setLoading(false);
    }
  };

  // Exportar a Excel
  const exportarExcel = async () => {
    try {
      setExporting(true);
      const { data, error } = await supabase
        .from('programacion_actividades')
        .select('*')
        .order('fecha', { ascending: false });
      if (error) throw error;

      const excelRows = data.map(r => ({
        'Fecha': r.fecha,
        'Usuario': r.usuario_nombre,
        'Actividad': r.actividad,
        'Ciclo': r.ciclo,
        'Creado': new Date(r.created_at).toLocaleString('es-CO'),
        'Creado Por': r.creado_por_nombre || ''
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelRows);
      XLSX.utils.book_append_sheet(wb, ws, 'Programacion');
      saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), 'programacion_diaria.xlsx');
      alert(`✅ ${data.length} registros exportados`);
    } catch (error) {
      console.error('Error exportando:', error);
      alert('Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  // Cargar desde Excel (simplificado)
  const cargarExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const dataRows = rows.slice(1).filter(r => r.some(cell => cell));
      const parsed = dataRows.map(row => ({
        fecha: row[0] || obtenerFechaColombia(),
        usuario: row[1] || '',
        actividad: row[2] || '',
        ciclo: row[3] ? row[3].toString() : '40'
      })).filter(r => r.usuario && r.actividad);
      setExcelData(parsed);
      setExcelPreview(parsed.slice(0,5));
      setShowExcelModal(true);
    };
    reader.readAsArrayBuffer(file);
  };

  const guardarExcel = async () => {
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const toInsert = excelData.map(r => ({
        fecha: r.fecha,
        usuario_nombre: r.usuario,
        actividad: r.actividad.toLowerCase(),
        ciclo: r.ciclo,
        creado_por_id: user?.id,
        creado_por_nombre: user?.email
      }));
      const { error } = await supabase
        .from('programacion_actividades')
        .upsert(toInsert, { onConflict: 'fecha, usuario_nombre' });
      if (error) throw error;
      setShowExcelModal(false);
      setExcelData([]);
      setExcelPreview([]);
      await cargarProgramacion();
      await cargarEstadisticas();
      await cargarCiclosAsignados();
      if (showMonthModal) {
        await cargarCalendario(mesCalendario);
      }
      alert(`✅ ${toInsert.length} registros cargados`);
    } catch (error) {
      console.error('Error guardando Excel:', error);
      alert('Error al cargar Excel');
    } finally {
      setLoading(false);
    }
  };

  // Toggle selección de usuario en modal
  const toggleUsuarioSeleccionado = (usuario) => {
    if (usuariosSeleccionados.includes(usuario)) {
      setUsuariosSeleccionados(usuariosSeleccionados.filter(u => u !== usuario));
    } else {
      setUsuariosSeleccionados([...usuariosSeleccionados, usuario]);
    }
  };

  const seleccionarTodos = () => {
    const disponibles = usuarios.filter(u => !usuariosProgramadosHoy.has(u));
    if (usuariosSeleccionados.length === disponibles.length) {
      setUsuariosSeleccionados([]);
    } else {
      setUsuariosSeleccionados(disponibles);
    }
  };

  const programacionPorActividad = {
    lectura: programacion.filter(p => p.actividad === 'lectura'),
    reparto: programacion.filter(p => p.actividad === 'reparto'),
    revision: programacion.filter(p => p.actividad === 'revision')
  };

  // Calcular pendientes por actividad
  const pendientesPorActividad = {};
  ACTIVIDADES.forEach(act => {
    const total = CICLOS_MAESTROS[act.id]?.length || 0;
    const asignados = ciclosAsignados[act.id]?.size || 0;
    const pendientes = CICLOS_MAESTROS[act.id]?.filter(ciclo => !ciclosAsignados[act.id]?.has(ciclo)) || [];
    pendientesPorActividad[act.id] = { total, asignados, pendientes };
  });

  // Funciones auxiliares para el calendario
  const cambiarMesCalendario = (delta) => {
    const [año, mes] = mesCalendario.split('-').map(Number);
    const fecha = new Date(Date.UTC(año, mes - 1, 1));
    fecha.setUTCMonth(fecha.getUTCMonth() + delta);
    const nuevoAño = fecha.getUTCFullYear();
    const nuevoMes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const nuevoMesStr = `${nuevoAño}-${nuevoMes}`;
    setMesCalendario(nuevoMesStr);
    cargarCalendario(nuevoMesStr);
  };

  const generarDiasDelMes = (mes) => {
    const [año, mesNum] = mes.split('-').map(Number);
    const primerDia = new Date(Date.UTC(año, mesNum - 1, 1));
    const ultimoDia = new Date(Date.UTC(año, mesNum, 0));
    const diasEnMes = ultimoDia.getUTCDate();
    
    // Ajustar para que la semana comience en lunes (getUTCDay() devuelve 0 domingo, 1 lunes, ... 6 sábado)
    const diaSemanaInicio = primerDia.getUTCDay() === 0 ? 6 : primerDia.getUTCDay() - 1; // 0=lunes, 1=martes, ..., 6=domingo
    
    const dias = [];
    // Rellenar celdas vacías antes del primer día
    for (let i = 0; i < diaSemanaInicio; i++) {
      dias.push({ fecha: null, vacio: true, asignaciones: [] });
    }
    // Rellenar los días del mes
    for (let d = 1; d <= diasEnMes; d++) {
      const fechaStr = `${año}-${String(mesNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const asignaciones = calendarioData[fechaStr] || [];
      dias.push({ fecha: fechaStr, dia: d, asignaciones, vacio: false });
    }
    return dias;
  };

  const handleDayClick = (dia) => {
    if (dia.vacio) return;
    setSelectedDay(dia);
    setShowDayModal(true);
  };

  return (
    <div className="page">
      <header className="topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>Programación Diaria</h1>
        {rol === 'admin' && <span className="user-role">Admin</span>}
      </header>

      {/* Selector de fecha y botones de acción */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="icon-btn" onClick={() => cambiarFecha(-1)}>←</button>
          <input
            type="date"
            value={filters.fecha}
            onChange={e => setFilters({ fecha: e.target.value, page: 1 })}
            style={{ padding: '8px', borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <button className="icon-btn" onClick={() => cambiarFecha(1)}>→</button>
        </div>
        <button className="action-btn success" onClick={exportarExcel} disabled={exporting || loading}>
          {exporting ? '⏳' : '📊 Exportar Excel'}
        </button>
        <label className="action-btn secondary">
          📥 Cargar Excel
          <input type="file" accept=".xlsx,.xls,.csv" onChange={cargarExcel} style={{ display: 'none' }} />
        </label>
        <button className="action-btn primary" onClick={() => setShowStatsModal(true)}>
          📊 Ver Estadísticas
        </button>
      </div>

      {/* Selector de mes para control de ciclos */}
      <div style={{ marginBottom: 20, padding: 16, background: '#fff', borderRadius: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h3 style={{ marginBottom: 12 }}>📋 Control de Ciclos del Mes</h3>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="month"
            value={mesControl}
            onChange={e => setMesControl(e.target.value)}
            style={{ padding: '8px', borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <button
            className="action-btn secondary"
            onClick={() => {
              setMesCalendario(mesControl);
              cargarCalendario(mesControl);
              setShowMonthModal(true);
            }}
          >
            📅 Ver Calendario Mensual
          </button>
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

      {/* Lista de ciclos pendientes por actividad - versión compacta */}
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
                        <button
                          key={ciclo}
                          className="badge"
                          style={{
                            background: '#f1f5f9',
                            padding: '4px 8px',
                            borderRadius: 16,
                            cursor: 'pointer',
                            border: '1px solid #e2e8f0',
                            fontSize: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2
                          }}
                          onClick={() => {
                            setActividadSeleccionada(act);
                            setCicloAsignado(ciclo);
                            setCicloPreseleccionado(ciclo);
                            setUsuariosSeleccionados([]);
                            setModalActividadVisible(true);
                          }}
                        >
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

      {/* Tarjetas de actividades del día */}
      {usuarios.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 12 }}>
          <p>No hay usuarios disponibles. Asegúrate de que existan supervisiones registradas.</p>
          <button className="action-btn primary" onClick={cargarUsuarios}>Reintentar</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {ACTIVIDADES.map(act => {
            const count = programacionPorActividad[act.id].length;
            return (
              <div
                key={act.id}
                className="stat-card"
                style={{ cursor: 'pointer', padding: 16 }}
                onClick={() => {
                  setActividadSeleccionada(act);
                  setUsuariosSeleccionados([]);
                  setCicloAsignado(act.meta.toString());
                  setCicloPreseleccionado(null);
                  setModalActividadVisible(true);
                }}
              >
                <div className="stat-info">
                  <div className="stat-label">{act.nombre}</div>
                  <div className="stat-value">{count}</div>
                  <small>programados hoy</small>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabla de programación del día */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Actividad</th>
              <th>Usuario</th>
              <th>Ciclo</th>
              {rol === 'admin' && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {programacion.map(item => (
              <tr key={item.id}>
                <td>
                  <span className="badge" style={{
                    background: item.actividad === 'lectura' ? '#dbeafe' :
                                 item.actividad === 'reparto' ? '#d9f99d' : '#fed7aa'
                  }}>
                    {item.actividad}
                  </span>
                </td>
                <td>{item.usuario_nombre}</td>
                <td>{item.ciclo}</td>
                {rol === 'admin' && (
                  <td>
                    <button className="icon-btn" onClick={() => eliminarProgramacion(item.id)}>🗑️</button>
                  </td>
                )}
              </tr>
            ))}
            {programacion.length === 0 && (
              <tr><td colSpan={rol === 'admin' ? 4 : 3} style={{ textAlign: 'center', padding: 40 }}>No hay programación para esta fecha</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de asignación de actividad */}
      {modalActividadVisible && (
        <div className="modal-overlay" onClick={() => setModalActividadVisible(false)}>
          <div className="modal-content" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Asignar {actividadSeleccionada?.nombre}</h2>
              <button className="close-btn" onClick={() => setModalActividadVisible(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16 }}>
                Fecha: {formatearFechaLocal(filters.fecha)}
                {cicloPreseleccionado && <span style={{ marginLeft: 16, fontWeight: 600 }}>Ciclo: {cicloPreseleccionado}</span>}
              </p>

              <div style={{ marginBottom: 16 }}>
                <label className="modal-label">👥 Seleccionar usuarios</label>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <button className="secondary-btn" onClick={seleccionarTodos}>
                    {usuariosSeleccionados.length === usuarios.filter(u => !usuariosProgramadosHoy.has(u)).length
                      ? 'Deseleccionar todos' : 'Seleccionar todos disponibles'}
                  </button>
                  <span>{usuariosSeleccionados.length} de {usuarios.filter(u => !usuariosProgramadosHoy.has(u)).length} disponibles</span>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
                  {usuarios.map(usuario => {
                    const yaProgramado = usuariosProgramadosHoy.has(usuario);
                    const programadoEnEsta = programacionPorActividad[actividadSeleccionada?.id]?.some(p => p.usuario_nombre === usuario);
                    return (
                      <div
                        key={usuario}
                        style={{
                          padding: 8,
                          marginBottom: 4,
                          borderRadius: 6,
                          backgroundColor: yaProgramado ? (programadoEnEsta ? '#fef9c3' : '#fee2e2') : (usuariosSeleccionados.includes(usuario) ? '#dbeafe' : '#fff'),
                          border: '1px solid #e2e8f0',
                          cursor: yaProgramado ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onClick={() => !yaProgramado && toggleUsuarioSeleccionado(usuario)}
                      >
                        <span>{usuario}</span>
                        {yaProgramado && <span style={{ fontSize: 12, color: programadoEnEsta ? '#f59e0b' : '#ef4444' }}>{programadoEnEsta ? 'Ya asignado' : 'Otra actividad'}</span>}
                        {usuariosSeleccionados.includes(usuario) && <span>✅</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="modal-label">🔄 Ciclo de trabajo</label>
                <input
                  type="text"
                  className="form-input"
                  value={cicloAsignado}
                  onChange={e => setCicloAsignado(e.target.value)}
                  placeholder={`Ej: ${actividadSeleccionada?.id === 'reparto' ? '40-140' : '40'}`}
                />
                <small style={{ color: '#64748b', display: 'block', marginTop: 4 }}>
                  {actividadSeleccionada && CICLOS_MAESTROS[actividadSeleccionada.id]?.length} ciclos disponibles
                </small>
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

      {/* Modal de estadísticas */}
      {showStatsModal && (
        <div className="modal-overlay" onClick={() => setShowStatsModal(false)}>
          <div className="modal-content" style={{ maxWidth: 1000 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📊 Estadísticas de Programación</h2>
              <button className="close-btn" onClick={() => setShowStatsModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="charts-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div className="dashboard-card">
                  <h3>📅 Registros por Día</h3>
                  <div style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.porDia}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="cantidad" stroke="#3b82f6" strokeWidth={2}>
                          <LabelList dataKey="cantidad" position="top" />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="dashboard-card">
                  <h3>📊 Registros por Mes</h3>
                  <div style={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.porMes}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="cantidad" fill="#f59e0b" radius={[4,4,0,0]}>
                          <LabelList dataKey="cantidad" position="top" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
                  <h3>🥧 Distribución por Actividad</h3>
                  <div style={{ height: 250, display: 'flex', justifyContent: 'center' }}>
                    <ResponsiveContainer width="70%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.porActividad}
                          cx="50%" cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          dataKey="cantidad"
                          nameKey="actividad"
                          label={entry => entry.actividad}
                        >
                          {stats.porActividad.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
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

      {/* Modal de calendario mensual */}
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
                  {/* Días de la semana */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8, textAlign: 'center', fontWeight: 600 }}>
                    <div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div><div>Dom</div>
                  </div>
                  {/* Cuadrícula de días */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                    {generarDiasDelMes(mesCalendario).map((dia, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleDayClick(dia)}
                        style={{
                          minHeight: 100,
                          background: dia.vacio ? '#f9f9f9' : '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: 8,
                          position: 'relative',
                          opacity: dia.vacio ? 0.5 : 1,
                          cursor: dia.vacio ? 'default' : 'pointer',
                          transition: 'all 0.2s',
                          ...(!dia.vacio && { ':hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transform: 'scale(1.02)' } })
                        }}
                      >
                        {!dia.vacio && (
                          <>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{dia.dia}</div>
                            {dia.asignaciones && dia.asignaciones.length > 0 ? (
                              <div style={{ fontSize: 12 }}>
                                {dia.asignaciones.slice(0, 3).map((a, i) => (
                                  <div key={i} style={{ 
                                    background: a.actividad === 'lectura' ? '#dbeafe' :
                                               a.actividad === 'reparto' ? '#d9f99d' : '#fed7aa',
                                    padding: '2px 4px',
                                    borderRadius: 4,
                                    marginBottom: 2,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    {a.usuario_nombre} ({a.ciclo})
                                  </div>
                                ))}
                                {dia.asignaciones.length > 3 && (
                                  <div style={{ color: '#64748b', marginTop: 2 }}>
                                    +{dia.asignaciones.length - 3} más
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ color: '#94a3b8', fontSize: 12 }}>Sin asignaciones</div>
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

      {/* Modal de detalle del día */}
      {showDayModal && selectedDay && (
        <div className="modal-overlay" onClick={() => setShowDayModal(false)}>
          <div className="modal-content" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalle del {formatearFechaLocal(selectedDay.fecha)}</h2>
              <button className="close-btn" onClick={() => setShowDayModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {selectedDay.asignaciones && selectedDay.asignaciones.length > 0 ? (
                <table className="table-container" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Actividad</th>
                      <th>Usuario</th>
                      <th>Ciclo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDay.asignaciones.map(asig => (
                      <tr key={asig.id}>
                        <td>
                          <span className="badge" style={{
                            background: asig.actividad === 'lectura' ? '#dbeafe' :
                                         asig.actividad === 'reparto' ? '#d9f99d' : '#fed7aa'
                          }}>
                            {asig.actividad}
                          </span>
                        </td>
                        <td>{asig.usuario_nombre}</td>
                        <td>{asig.ciclo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>No hay asignaciones para este día.</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="primary-btn" onClick={() => setShowDayModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de vista previa Excel */}
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
                <thead>
                  <tr><th>Fecha</th><th>Usuario</th><th>Actividad</th></tr>
                </thead>
                <tbody>
                  {excelPreview.map((r,i) => (
                    <tr key={i}><td>{r.fecha}</td><td>{r.usuario}</td><td>{r.actividad}</td></tr>
                  ))}
                </tbody>
              </table>
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

      {/* Paginación principal */}
      {totalCount > PAGE_SIZE && (
        <div className="pagination">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>← Anterior</button>
          <span>Página {page} de {Math.ceil(totalCount / PAGE_SIZE)}</span>
          <button onClick={() => setPage(p => p+1)} disabled={page >= Math.ceil(totalCount / PAGE_SIZE)}>Siguiente →</button>
        </div>
      )}
    </div>
  );
}