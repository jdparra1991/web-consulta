import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Páginas existentes
import Dashboard from './pages/Dashboard'
import Lecturas from './pages/Lecturas'
import Revisiones from './pages/Revisiones'
import Reparto from './pages/Reparto'

// Nuevas páginas
import Reclamos from './pages/Reclamos'
import Devoluciones from './pages/Devoluciones'
import Nomenclatura from './pages/Nomenclatura'
import AnalisisCausas from './pages/AnalisisCausas'
import AnalisisRevisiones from './pages/AnalisisRevisiones'
import CiclosProcesados from './pages/CiclosProcesados'
import Llamadas from './pages/Llamadas'
import AlistamientoFacturas from './pages/AlistamientoFacturas'
import AMI from './pages/AMI'
import ProgramacionDiaria from './pages/ProgramacionDiaria'
import ResultadosDigitales from './pages/ResultadosDigitales'

// Home
import Home from './pages/Home'

import './index.css'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('home')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [rol, setRol] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      if (data.session) cargarRol(data.session.user.id)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) cargarRol(session.user.id)
      else setRol(null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function cargarRol(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', userId)
      .single()

    setRol(data?.rol || 'consulta')
  }

  async function login(e) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Credenciales incorrectas')
  }

  async function logout() {
    await supabase.auth.signOut()
    setSession(null)
    setPage('home')
  }

  const handleSelectOption = (option) => {
    setPage(option)
  }

  const handleBackToHome = () => {
    setPage('home')
  }

  if (loading) return null

  /* LOGIN */
  if (!session) {
    return (
      <div className="login-page">
        <form className="login-card" onSubmit={login}>
          <h1>Bienvenido</h1>
          <p style={{ color: '#64748b', marginBottom: 20, fontSize: 14 }}>
            Sistema de Consultas Operativas
          </p>
          <input 
            type="email" 
            placeholder="Correo electrónico" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required
          />
          <input 
            type="password" 
            placeholder="Contraseña" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required
          />
          {error && <div className="error-message">{error}</div>}
          <button type="submit">Ingresar al sistema</button>
        </form>
      </div>
    )
  }

  if (page === 'home') {
    return (
      <Home 
        onSelect={handleSelectOption} 
        onLogout={logout} 
        userEmail={session.user.email}
        rol={rol}
      />
    )
  }

  return (
    <div className="layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>📊 Operaciones</h2>
          <span>{session.user.email}</span>
          <small>Rol: {rol === 'admin' ? 'Administrador' : 'Consulta'}</small>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={page === 'home' ? 'active' : ''} 
            onClick={() => setPage('home')}
          >
            🏠 Inicio
          </button>

          <div className="sidebar-divider">PRINCIPALES</div>
          <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>
            📈 Dashboard
          </button>
          <button className={page === 'programacion-diaria' ? 'active' : ''} onClick={() => setPage('programacion-diaria')}>
            📅 Programación Diaria
          </button>

          {/* Sección Lecturas */}
          <div className="sidebar-section">
            <div className="section-title" style={{ color: '#3b82f6' }}>
              📄 LECTURAS
            </div>
            <button className={page === 'analisis-causas' ? 'active' : ''} onClick={() => setPage('analisis-causas')}>
              🔍 Análisis de Causas
            </button>
            <button className={page === 'ciclos-procesados' ? 'active' : ''} onClick={() => setPage('ciclos-procesados')}>
              ✅ Ciclos Procesados
            </button>
            <button className={page === 'ami' ? 'active' : ''} onClick={() => setPage('ami')}>
              📊 AMI
            </button>
          </div>

          {/* Sección Revisiones */}
          <div className="sidebar-section">
            <div className="section-title" style={{ color: '#f59e0b' }}>
              🔍 REVISIONES
            </div>
            <button className={page === 'analisis-revisiones' ? 'active' : ''} onClick={() => setPage('analisis-revisiones')}>
              📊 Análisis Revisiones
            </button>
            <button className={page === 'llamadas' ? 'active' : ''} onClick={() => setPage('llamadas')}>
              📞 Llamadas Realizadas
            </button>
          </div>

          {/* Sección Reparto */}
          <div className="sidebar-section">
            <div className="section-title" style={{ color: '#10b981' }}>
              📦 REPARTO
            </div>
            <button className={page === 'reclamos' ? 'active' : ''} onClick={() => setPage('reclamos')}>
              ⚠️ Reclamos de Reparto
            </button>
            <button className={page === 'devoluciones' ? 'active' : ''} onClick={() => setPage('devoluciones')}>
              🔄 Devoluciones
            </button>
            <button className={page === 'nomenclatura' ? 'active' : ''} onClick={() => setPage('nomenclatura')}>
              🏷️ Asignación Nomenclatura
            </button>
            <button className={page === 'alistamiento-facturas' ? 'active' : ''} onClick={() => setPage('alistamiento-facturas')}>
              📋 Alistamiento Facturas
            </button>
            <button className={page === 'resultados-digitales' ? 'active' : ''} onClick={() => setPage('resultados-digitales')}>
              📧 Resultados Digitales
            </button>
          </div>
        </nav>

        <button className="logout-btn" onClick={logout}>
          <span>🚪</span>
          Cerrar sesión
        </button>
      </aside>

      {/* MAIN */}
      <main className="main-content">
        {page === 'dashboard' && <Dashboard rol={rol} />}
        {page === 'lecturas' && <Lecturas rol={rol} onBack={handleBackToHome} />}
        {page === 'revisiones' && <Revisiones rol={rol} onBack={handleBackToHome} />}
        {page === 'reparto' && <Reparto rol={rol} onBack={handleBackToHome} />}
        
        {/* Nuevas páginas */}
        {page === 'reclamos' && <Reclamos rol={rol} onBack={handleBackToHome} />}
        {page === 'devoluciones' && <Devoluciones rol={rol} onBack={handleBackToHome} />}
        {page === 'nomenclatura' && <Nomenclatura rol={rol} onBack={handleBackToHome} />}
        {page === 'analisis-causas' && <AnalisisCausas rol={rol} onBack={handleBackToHome} />}
        {page === 'analisis-revisiones' && <AnalisisRevisiones rol={rol} onBack={handleBackToHome} />}
        {page === 'ciclos-procesados' && <CiclosProcesados rol={rol} onBack={handleBackToHome} />}
        {page === 'llamadas' && <Llamadas rol={rol} onBack={handleBackToHome} />}
        {page === 'alistamiento-facturas' && <AlistamientoFacturas rol={rol} onBack={handleBackToHome} />}
        {page === 'ami' && <AMI rol={rol} onBack={handleBackToHome} />}
        {page === 'programacion-diaria' && <ProgramacionDiaria rol={rol} onBack={handleBackToHome} />}
        {page === 'resultados-digitales' && <ResultadosDigitales rol={rol} onBack={handleBackToHome} />}
      </main>
    </div>
  )
}