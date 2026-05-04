import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import '../index.css'

const PAGE_SIZE = 10

export default function Consultadigitales({ onBack, rol }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [excelData, setExcelData] = useState([])
  const [excelPreview, setExcelPreview] = useState([])

  // Resumen estadístico
  const [stats, setStats] = useState({
    total: 0,
    pendiente: 0,
    enviado: 0,
    fallido: 0,
    reintentando: 0
  })

  // Filtros (incluye direccion)
  const [filters, setFilters] = useState({
    ciclo: '',
    contrato: '',
    cliente: '',
    direccion: '',
    estado_envio: ''
  })
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Formulario
  const [formData, setFormData] = useState({
    ciclo: '',
    contrato: '',
    cliente: '',
    correo: '',
    direccion: '',
    estado_envio: 'Pendiente'
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
        .from('factura_digital')
        .select('*', { count: 'exact' })
        .order('fecha_creacion', { ascending: false })
        .range(from, to)

      if (filters.ciclo) query = query.eq('ciclo', filters.ciclo)
      if (filters.contrato) query = query.ilike('contrato', `%${filters.contrato}%`)
      if (filters.cliente) query = query.ilike('cliente', `%${filters.cliente}%`)
      if (filters.direccion) query = query.ilike('direccion', `%${filters.direccion}%`)
      if (filters.estado_envio) query = query.eq('estado_envio', filters.estado_envio)

      const { data, count, error } = await query
      if (error) throw error
      setItems(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error cargando factura digital:', error)
    } finally {
      setLoading(false)
    }
  }

  async function cargarEstadisticas() {
    try {
      let query = supabase.from('factura_digital').select('estado_envio')
      if (filters.ciclo) query = query.eq('ciclo', filters.ciclo)
      if (filters.contrato) query = query.ilike('contrato', `%${filters.contrato}%`)
      if (filters.cliente) query = query.ilike('cliente', `%${filters.cliente}%`)
      if (filters.direccion) query = query.ilike('direccion', `%${filters.direccion}%`)
      if (filters.estado_envio) query = query.eq('estado_envio', filters.estado_envio)

      const { data, error } = await query
      if (error) throw error

      const total = data.length
      const pendiente = data.filter(r => r.estado_envio === 'Pendiente').length
      const enviado = data.filter(r => r.estado_envio === 'Enviado').length
      const fallido = data.filter(r => r.estado_envio === 'Fallido').length
      const reintentando = data.filter(r => r.estado_envio === 'Reintentando').length

      setStats({ total, pendiente, enviado, fallido, reintentando })
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

  // ---- Eliminar todos los registros ----
  async function eliminarTodos() {
    const confirm1 = confirm('⚠️ ADVERTENCIA: Esta acción ELIMINARÁ TODOS los registros de factura digital. ¿Estás ABSOLUTAMENTE seguro?')
    if (!confirm1) return

    const confirm2 = prompt('Escribe "ELIMINAR TODOS" para confirmar la eliminación masiva:')
    if (confirm2 !== 'ELIMINAR TODOS') {
      alert('Operación cancelada. No se eliminaron registros.')
      return
    }

    setLoading(true)
    try {
      // Eliminar todos los registros (sin condiciones)
      const { error } = await supabase
        .from('factura_digital')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // truco para eliminar todos
      if (error) throw error

      await cargarItems()
      await cargarEstadisticas()
      alert('✅ Todos los registros han sido eliminados.')
    } catch (error) {
      console.error('Error eliminando todos:', error)
      alert('Error al eliminar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // ---- Funciones Excel ----
  const descargarPlantilla = () => {
    const wb = XLSX.utils.book_new()
    const header = ['ciclo', 'contrato', 'cliente', 'correo', 'direccion', 'estado_envio']
    const ejemplo = [
      ['CICLO001', 'CON-001', 'Juan Pérez', 'juan@example.com', 'Calle 123', 'Pendiente'],
      ['CICLO002', 'CON-002', 'María López', 'maria@example.com', 'Av. Siempre Viva 742', 'Enviado']
    ]
    const ws = XLSX.utils.aoa_to_sheet([header, ...ejemplo])
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla')
    XLSX.writeFile(wb, 'plantilla_factura_digital.xlsx')
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

      const idx = {
        ciclo: headers.findIndex(h => h?.toLowerCase() === 'ciclo'),
        contrato: headers.findIndex(h => h?.toLowerCase() === 'contrato'),
        cliente: headers.findIndex(h => h?.toLowerCase() === 'cliente'),
        correo: headers.findIndex(h => h?.toLowerCase() === 'correo'),
        direccion: headers.findIndex(h => h?.toLowerCase() === 'direccion'),
        estado_envio: headers.findIndex(h => h?.toLowerCase() === 'estado_envio')
      }

      const parsed = dataRows.map(row => ({
        ciclo: row[idx.ciclo] || '',
        contrato: row[idx.contrato] || '',
        cliente: row[idx.cliente] || '',
        correo: row[idx.correo] || '',
        direccion: row[idx.direccion] || '',
        estado_envio: row[idx.estado_envio] || 'Pendiente'
      })).filter(r => r.ciclo && r.contrato && r.cliente)

      setExcelData(parsed)
      setExcelPreview(parsed.slice(0, 5))
      setShowExcelModal(true)
    }
    reader.readAsArrayBuffer(file)
  }

  async function guardarExcel() {
    setLoading(true)
    try {
      const now = new Date().toISOString()
      const toInsert = excelData.map(r => ({
        ...r,
        fecha_actualizacion: now,
        fecha_creacion: now
      }))

      const { error } = await supabase
        .from('factura_digital')
        .upsert(toInsert, { onConflict: 'contrato' })

      if (error) throw error
      setShowExcelModal(false)
      setExcelData([])
      setExcelPreview([])
      await cargarItems()
      await cargarEstadisticas()
      alert(`✅ ${toInsert.length} registros procesados`)
    } catch (error) {
      console.error('Error guardando Excel:', error)
      alert('Error al cargar Excel: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // ---- CRUD ----
  async function guardarItem() {
    if (!formData.ciclo || !formData.contrato || !formData.cliente) {
      alert('Ciclo, contrato y cliente son obligatorios')
      return
    }
    setLoading(true)
    try {
      const now = new Date().toISOString()
      const data = {
        ciclo: formData.ciclo,
        contrato: formData.contrato,
        cliente: formData.cliente,
        correo: formData.correo || null,
        direccion: formData.direccion || null,
        estado_envio: formData.estado_envio,
        fecha_actualizacion: now
      }

      let error
      if (editingId) {
        ({ error } = await supabase
          .from('factura_digital')
          .update(data)
          .eq('id', editingId))
      } else {
        ({ error } = await supabase
          .from('factura_digital')
          .insert([{ ...data, fecha_creacion: now }]))
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
      alert('Error al guardar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este registro?')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('factura_digital').delete().eq('id', id)
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

  function editar(item) {
    setFormData({
      ciclo: item.ciclo,
      contrato: item.contrato,
      cliente: item.cliente,
      correo: item.correo || '',
      direccion: item.direccion || '',
      estado_envio: item.estado_envio || 'Pendiente'
    })
    setEditingId(item.id)
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      ciclo: '',
      contrato: '',
      cliente: '',
      correo: '',
      direccion: '',
      estado_envio: 'Pendiente'
    })
  }

  const resetFilters = () => {
    setFilters({ ciclo: '', contrato: '', cliente: '', direccion: '', estado_envio: '' })
    setPage(1)
  }

  const exportarExcel = async () => {
    try {
      setExporting(true)
      let query = supabase.from('factura_digital').select('*')
      if (filters.ciclo) query = query.eq('ciclo', filters.ciclo)
      if (filters.contrato) query = query.ilike('contrato', `%${filters.contrato}%`)
      if (filters.cliente) query = query.ilike('cliente', `%${filters.cliente}%`)
      if (filters.direccion) query = query.ilike('direccion', `%${filters.direccion}%`)
      if (filters.estado_envio) query = query.eq('estado_envio', filters.estado_envio)

      const { data, error } = await query
      if (error) throw error

      const excelRows = data.map(r => ({
        Ciclo: r.ciclo,
        Contrato: r.contrato,
        Cliente: r.cliente,
        Correo: r.correo,
        Dirección: r.direccion,
        Estado: r.estado_envio,
        'Fecha creación': new Date(r.fecha_creacion).toLocaleString(),
        'Última actualización': new Date(r.fecha_actualizacion).toLocaleString()
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelRows)
      XLSX.utils.book_append_sheet(wb, ws, 'FacturaDigital')
      const nombre = `factura_digital_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`
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

  return (
    <div className="page">
      <header className="topbar">
        <button className="back-btn" onClick={onBack}>← Volver</button>
        <h1>Factura Digital</h1>
        {rol === 'admin' && <span className="user-role">Admin</span>}
      </header>

      {/* Tarjetas de resumen */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 150 }}>
          <div className="stat-icon" style={{ background: '#dbeafe' }}>📊</div>
          <div className="stat-info">
            <div className="stat-label">Total</div>
            <div className="stat-value">{stats.total}</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 150 }}>
          <div className="stat-icon" style={{ background: '#fef3c7' }}>⏳</div>
          <div className="stat-info">
            <div className="stat-label">Pendiente</div>
            <div className="stat-value">{stats.pendiente}</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 150 }}>
          <div className="stat-icon" style={{ background: '#dcfce7' }}>✅</div>
          <div className="stat-info">
            <div className="stat-label">Enviado</div>
            <div className="stat-value">{stats.enviado}</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 150 }}>
          <div className="stat-icon" style={{ background: '#fee2e2' }}>❌</div>
          <div className="stat-info">
            <div className="stat-label">Fallido</div>
            <div className="stat-value">{stats.fallido}</div>
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <button className="action-btn secondary" onClick={descargarPlantilla}>
          📥 Plantilla Excel
        </button>
        <label className={`action-btn secondary ${exporting ? 'disabled' : ''}`}>
          📤 Cargar Excel
          <input type="file" accept=".xlsx,.xls,.csv" onChange={cargarExcel} style={{ display: 'none' }} />
        </label>
        <button className="action-btn success" onClick={exportarExcel} disabled={exporting || loading}>
          {exporting ? '⏳ Exportando...' : '📊 Exportar Excel'}
        </button>
        {rol === 'admin' && (
          <>
            <button className="action-btn primary" onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }}>
              + Nuevo Registro
            </button>
            <button className="action-btn danger" onClick={eliminarTodos} style={{ background: '#dc2626', color: 'white' }}>
              🗑️ Eliminar todos
            </button>
          </>
        )}
      </div>

      {/* Modal vista previa Excel */}
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
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ciclo</th><th>Contrato</th><th>Cliente</th><th>Correo</th><th>Dirección</th><th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelPreview.map((r, i) => (
                      <tr key={i}>
                        <td>{r.ciclo}</td> <td>{r.contrato}</td> <td>{r.cliente}</td> <td>{r.correo}</td> <td>{r.direccion}</td> <td>{r.estado_envio}</td>
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

      {/* Modal formulario */}
      {showForm && (
        <div className="form-modal">
          <div className="form-modal-content">
            <div className="form-modal-header">
              <h2>{editingId ? 'Editar Registro' : 'Nuevo Registro'}</h2>
              <button className="close-btn" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="form-modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Ciclo *</label>
                  <input type="text" value={formData.ciclo} onChange={e => setFormData({...formData, ciclo: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Contrato * (único)</label>
                  <input type="text" value={formData.contrato} onChange={e => setFormData({...formData, contrato: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Cliente *</label>
                  <input type="text" value={formData.cliente} onChange={e => setFormData({...formData, cliente: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Correo electrónico</label>
                  <input type="email" value={formData.correo} onChange={e => setFormData({...formData, correo: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Dirección</label>
                  <input type="text" value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Estado de envío</label>
                  <select value={formData.estado_envio} onChange={e => setFormData({...formData, estado_envio: e.target.value})}>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Enviado">Enviado</option>
                    <option value="Fallido">Fallido</option>
                    <option value="Reintentando">Reintentando</option>
                  </select>
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
        <input type="text" placeholder="Ciclo" value={filters.ciclo} onChange={e => setFilters({...filters, ciclo: e.target.value, page: 1})} />
        <input type="text" placeholder="Contrato" value={filters.contrato} onChange={e => setFilters({...filters, contrato: e.target.value, page: 1})} />
        <input type="text" placeholder="Cliente" value={filters.cliente} onChange={e => setFilters({...filters, cliente: e.target.value, page: 1})} />
        <input type="text" placeholder="Dirección" value={filters.direccion} onChange={e => setFilters({...filters, direccion: e.target.value, page: 1})} />
        <select value={filters.estado_envio} onChange={e => setFilters({...filters, estado_envio: e.target.value, page: 1})}>
          <option value="">Todos los estados</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Enviado">Enviado</option>
          <option value="Fallido">Fallido</option>
          <option value="Reintentando">Reintentando</option>
        </select>
        <button onClick={resetFilters}>Limpiar</button>
      </div>

      {/* Tabla */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ciclo</th><th>Contrato</th><th>Cliente</th><th>Correo</th><th>Dirección</th><th>Estado</th><th>Fecha creación</th>
              {rol === 'admin' && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>{item.ciclo}</td>
                <td>{item.contrato}</td>
                <td>{item.cliente}</td>
                <td>{item.correo}</td>
                <td>{item.direccion}</td>
                <td>{item.estado_envio}</td>
                <td>{new Date(item.fecha_creacion).toLocaleDateString()}</td>
                {rol === 'admin' && (
                  <td>
                    <button className="icon-btn" onClick={() => editar(item)} style={{ marginRight: 8 }}>✏️</button>
                    <button className="icon-btn" onClick={() => eliminar(item.id)}>🗑️</button>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={rol === 'admin' ? 8 : 7} style={{ textAlign: 'center', padding: 40 }}>No hay registros</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalCount > PAGE_SIZE && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Anterior</button>
          <span>Página {page} de {Math.ceil(totalCount / PAGE_SIZE)}</span>
          <button disabled={page >= Math.ceil(totalCount / PAGE_SIZE)} onClick={() => setPage(p => p + 1)}>Siguiente →</button>
        </div>
      )}
    </div>
  )
}