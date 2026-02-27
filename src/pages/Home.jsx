import '../index.css'

export default function Home({ onSelect, onLogout, userEmail, rol }) {
  const menuItems = {
    lecturas: {
      titulo: '📄 Lecturas',
      color: '#3b82f6',
      items: [
        { id: 'lecturas', titulo: '📄 Lecturas', descripcion: 'Consulta de lecturas realizadas', color: '#3b82f6', principal: true },
        { id: 'programacion-diaria', titulo: '📅 Programación Diaria', descripcion: 'Asignación de actividades diarias', color: '#8b5cf6' },
        { id: 'analisis-causas', titulo: '🔍 Análisis de Causas', descripcion: 'Análisis de causas raíz', color: '#06b6d4' },
        { id: 'ciclos-procesados', titulo: '✅ Ciclos Procesados', descripcion: 'Ciclos procesados y órdenes', color: '#14b8a6' },
        { id: 'ami', titulo: '📊 AMI', descripcion: 'Análisis de medidores inteligentes', color: '#8b5cf6' }
      ]
    },
    revisiones: {
      titulo: '🔍 Revisiones',
      color: '#f59e0b',
      items: [
        { id: 'revisiones', titulo: '🔍 Revisiones', descripcion: 'Revisión de equipos y EPP', color: '#f59e0b', principal: true },
        { id: 'analisis-revisiones', titulo: '📊 Análisis Revisiones', descripcion: 'Métricas y análisis', color: '#6366f1' },
        { id: 'llamadas', titulo: '📞 Llamadas Realizadas', descripcion: 'Registro de llamadas', color: '#a855f7' }
      ]
    },
    reparto: {
      titulo: '📦 Reparto',
      color: '#10b981',
      items: [
        { id: 'reparto', titulo: '📦 Reparto', descripcion: 'Control de reparto', color: '#10b981', principal: true },
        { id: 'reclamos', titulo: '⚠️ Reclamos de Reparto', descripcion: 'Gestión de reclamos', color: '#ef4444' },
        { id: 'devoluciones', titulo: '🔄 Devoluciones', descripcion: 'Devoluciones de reparto', color: '#f97316' },
        { id: 'nomenclatura', titulo: '🏷️ Asignación Nomenclatura', descripcion: 'Asignación de nomenclatura', color: '#8b5cf6' },
        { id: 'alistamiento-facturas', titulo: '📋 Alistamiento Facturas', descripcion: 'Gestión de alistamiento de facturas', color: '#9c89b8' },
        { id: 'resultados-digitales', titulo: '📧 Resultados Digitales', descripcion: 'Gestión de resultados digitales', color: '#8b5cf6' }
      ]
    }
  }

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="header-left">
          <h1>Panel de Consultas</h1>
          <span className="header-badge">{rol === 'admin' ? 'Administrador' : 'Supervisor'}</span>
        </div>
        <div className="header-right">
          <span className="user-email">{userEmail}</span>
          <button className="logout" onClick={onLogout}>
            <span>🚪</span>
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="home-welcome">
        <h2>Bienvenido al Sistema de Consultas</h2>
        <p>Selecciona una opción para visualizar la información</p>
      </div>

      <div className="home-columns-container">
        {/* Columna Lecturas */}
        <div className="home-column">
          <div className="column-header" style={{ borderBottomColor: menuItems.lecturas.color }}>
            <span className="column-icon">{menuItems.lecturas.titulo.split(' ')[0]}</span>
            <h3>{menuItems.lecturas.titulo}</h3>
          </div>
          <div className="column-cards">
            {menuItems.lecturas.items.map(item => (
              <div 
                key={item.id}
                className={`home-card ${item.principal ? 'principal-card' : ''}`}
                onClick={() => onSelect(item.id)}
                style={{ borderLeftColor: item.color }}
              >
                <div className="card-icon" style={{ backgroundColor: item.color + '20' }}>
                  <span className="icon">{item.titulo.split(' ')[0]}</span>
                </div>
                <div className="card-content">
                  <h3>{item.titulo}</h3>
                  <p>{item.descripcion}</p>
                </div>
                <div className="card-arrow" style={{ color: item.color }}>
                  →
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Columna Revisiones */}
        <div className="home-column">
          <div className="column-header" style={{ borderBottomColor: menuItems.revisiones.color }}>
            <span className="column-icon">{menuItems.revisiones.titulo.split(' ')[0]}</span>
            <h3>{menuItems.revisiones.titulo}</h3>
          </div>
          <div className="column-cards">
            {menuItems.revisiones.items.map(item => (
              <div 
                key={item.id}
                className={`home-card ${item.principal ? 'principal-card' : ''}`}
                onClick={() => onSelect(item.id)}
                style={{ borderLeftColor: item.color }}
              >
                <div className="card-icon" style={{ backgroundColor: item.color + '20' }}>
                  <span className="icon">{item.titulo.split(' ')[0]}</span>
                </div>
                <div className="card-content">
                  <h3>{item.titulo}</h3>
                  <p>{item.descripcion}</p>
                </div>
                <div className="card-arrow" style={{ color: item.color }}>
                  →
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Columna Reparto */}
        <div className="home-column">
          <div className="column-header" style={{ borderBottomColor: menuItems.reparto.color }}>
            <span className="column-icon">{menuItems.reparto.titulo.split(' ')[0]}</span>
            <h3>{menuItems.reparto.titulo}</h3>
          </div>
          <div className="column-cards">
            {menuItems.reparto.items.map(item => (
              <div 
                key={item.id}
                className={`home-card ${item.principal ? 'principal-card' : ''}`}
                onClick={() => onSelect(item.id)}
                style={{ borderLeftColor: item.color }}
              >
                <div className="card-icon" style={{ backgroundColor: item.color + '20' }}>
                  <span className="icon">{item.titulo.split(' ')[0]}</span>
                </div>
                <div className="card-content">
                  <h3>{item.titulo}</h3>
                  <p>{item.descripcion}</p>
                </div>
                <div className="card-arrow" style={{ color: item.color }}>
                  →
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="home-footer">
        <p>© 2026 - Sistema de Consultas Operativas</p>
      </div>
    </div>
  )
}