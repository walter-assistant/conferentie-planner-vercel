'use client'

import { useState, useEffect } from 'react'
import { supabase, authService, conferenceService } from '../lib/supabase'

export default function ConferentiePlannerApp() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  // Check auth status on mount
  useEffect(() => {
    const getInitialSession = async () => {
      const session = await authService.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">📅</div>
          <div className="login-title">Laden...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthPage authMode={authMode} setAuthMode={setAuthMode} />
  }

  return <PlannerApp user={user} />
}

// Auth component
function AuthPage({ authMode, setAuthMode }: { authMode: 'login' | 'register', setAuthMode: (mode: 'login' | 'register') => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (authMode === 'login') {
        const { error } = await authService.signIn(email, password)
        if (error) {
          setError(error.message)
        }
      } else {
        const { error } = await authService.signUp(email, password)
        if (error) {
          setError(error.message)
        } else {
          setSuccess('Account aangemaakt! Check je email voor verificatie.')
        }
      }
    } catch (err: any) {
      setError('Er is een fout opgetreden. Probeer opnieuw.')
    }

    setLoading(false)
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">📅</div>
        <div className="login-title">Conferentie Planner</div>
        <div className="login-subtitle">
          {authMode === 'login' ? 'Inloggen om je conferenties te beheren' : 'Account aanmaken'}
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="je@email.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Wachtwoord</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading && <span className="loading-spinner"></span>}
            {authMode === 'login' ? 'Inloggen' : 'Account aanmaken'}
          </button>
        </form>

        <div className="auth-switch">
          <div className="auth-switch-text">
            {authMode === 'login' ? 'Nog geen account?' : 'Al een account?'}
          </div>
          <button
            type="button"
            className="auth-switch-btn"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login')
              setError('')
              setSuccess('')
            }}
          >
            {authMode === 'login' ? 'Account aanmaken' : 'Inloggen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Main planner app component
function PlannerApp({ user }: { user: any }) {
  useEffect(() => {
    // Make Supabase services available to external script
    ;(window as any).supabase = supabase
    ;(window as any).conferenceService = conferenceService
    ;(window as any).authService = authService

    // Load external conferentie app script
    const script = document.createElement('script')
    script.src = '/conferentie-app.js?v=' + Date.now()
    script.async = true
    document.body.appendChild(script)

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [])

  const handleLogout = async () => {
    await authService.signOut()
  }

  const getUserInitials = (user: any) => {
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  return (
    <>
      {/* User info bar */}
      <div className="user-bar">
        <div className="user-info">
          <div className="user-avatar">{getUserInitials(user)}</div>
          <span>Ingelogd als <strong>{user.email}</strong></span>
        </div>
        <button onClick={handleLogout} className="logout-btn">
          Uitloggen
        </button>
      </div>

      {/* Project bar placeholder - will be filled by external script */}
      <div id="project-bar" style={{background:'#f5f7fa',borderBottom:'1px solid var(--border)',padding:'8px 16px',display:'flex',alignItems:'center',gap:'12px',fontSize:'0.85rem'}}>
        <span style={{color:'var(--text-light)',fontWeight:'600'}}>Project:</span>
        <select id="projectSelect" style={{padding:'4px 8px',border:'1px solid var(--border)',borderRadius:'3px',fontSize:'0.85rem',minWidth:'180px'}} onChange={() => (window as any).switchProject?.()}>
        </select>
        <button className="btn btn-sm btn-outline" style={{color:'var(--text)',borderColor:'var(--border)'}} onClick={() => (window as any).newProject?.()}>+ Nieuw</button>
        <button className="btn btn-sm btn-danger" onClick={() => (window as any).deleteProject?.()}>🗑️ Verwijder</button>
        <span style={{marginLeft:'auto',color:'var(--text-light)',fontSize:'0.8rem'}} id="projectStatus"></span>
      </div>

      {/* Header */}
      <div className="header">
        <h1 style={{cursor:'pointer',display:'flex',alignItems:'center',gap:'8px'}} onClick={() => (window as any).editConferenceName?.()} title="Klik om te bewerken">
          📅 <span id="headerTitle">Conferentie Planner</span>
          <span style={{fontSize:'0.8rem',opacity:'0.7',fontWeight:'400'}}>✏️</span>
        </h1>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={() => (window as any).openHallModal?.()}>🏛 Zalen</button>
          <button className="btn btn-outline" onClick={() => (window as any).openSessionModal?.()}>➕ Programma</button>
          <button className="btn btn-outline" onClick={() => (window as any).openSettingsModal?.()}>⚙️ Instellingen</button>
          <button className="btn btn-outline" onClick={() => (window as any).exportPDF?.()}>📄 PDF</button>
          <button className="btn btn-outline" onClick={() => (window as any).exportCSV?.()}>📊 CSV</button>
          <button className="btn btn-outline" onClick={() => (window as any).exportJSON?.()}>💾 JSON</button>
          <button className="btn btn-outline" onClick={() => document.getElementById('importFile')?.click()}>📂 Import JSON</button>
          <input type="file" id="importFile" accept=".json" style={{display:'none'}} onChange={(e) => (window as any).importJSON?.(e)} />
          <button className="btn btn-outline" onClick={() => (window as any).toggleCSVDrop?.()}>📂 Import CSV</button>
          <input type="file" id="importCSVFile" accept=".csv,.txt,.xlsx" style={{display:'none'}} onChange={(e) => (window as any).importCSVFromInput?.(e)} />
        </div>
      </div>

      {/* CSV Drop Zone */}
      <div id="csvDropZone" style={{display:'none',margin:'0 16px',padding:'24px',border:'3px dashed #1e3a5f',borderRadius:'12px',background:'#e3f2fd',textAlign:'center',cursor:'pointer',transition:'all 0.2s'}}>
        <div style={{fontSize:'24px',marginBottom:'8px'}}>📂</div>
        <div style={{fontSize:'16px',fontWeight:'700',color:'#1e3a5f'}}>Sleep je CSV bestand hierheen</div>
        <div style={{fontSize:'13px',color:'#666',marginTop:'4px'}}>Of klik om een bestand te selecteren</div>
        <div id="csvDropStatus" style={{marginTop:'8px',fontSize:'13px',display:'none'}}></div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="date-tabs" id="dateTabs"></div>
        <button className="btn btn-sm btn-primary" onClick={() => (window as any).addDate?.()}>+ Dag</button>
        <div className="stats-bar" id="statsBar"></div>
      </div>

      {/* Main Layout */}
      <div className="main-layout" style={{position:'relative'}}>
        {/* Sidebar */}
        <div className="sidebar" id="sidebarPanel">
          <button className="sidebar-collapse-btn" onClick={() => (window as any).toggleSidebar?.()}>◀ Sidebar inklappen</button>
          <div className="sidebar-section" id="section-zalen">
            <h3 onClick={() => (window as any).toggleSection?.('section-zalen')}>🏛️ Zalen <span className="badge" id="hallCount">0</span><span className="collapse-arrow">▼</span></h3>
            <div className="section-content" id="hallListSidebar"></div>
          </div>
          <div className="sidebar-section" id="section-ongeplaatst">
            <h3 onClick={() => (window as any).toggleSection?.('section-ongeplaatst')}>Ongeplaatst <span className="badge" id="unplacedCount">0</span><span className="collapse-arrow">▼</span></h3>
            <div className="section-content" id="unplacedList"></div>
          </div>
          <div className="sidebar-section" id="section-versies">
            <h3 onClick={() => (window as any).toggleSection?.('section-versies')}>📋 Versies <span className="badge" id="versionCount">0</span><span className="collapse-arrow">▼</span></h3>
            <div className="section-content">
              <div style={{display:'flex',gap:'4px',marginBottom:'8px'}}>
                <button className="btn btn-sm btn-success" onClick={() => (window as any).saveCurrentVersion?.()}>💾 Versie opslaan</button>
                <button className="btn btn-sm btn-outline" style={{color:'var(--text)',borderColor:'var(--border)'}} onClick={() => (window as any).openVersionModal?.()}>📋 Versies</button>
              </div>
              <div id="versionListSidebar"></div>
            </div>
          </div>
          <div className="sidebar-section" id="section-stats">
            <h3 onClick={() => (window as any).toggleSection?.('section-stats')}>📊 Statistieken<span className="collapse-arrow">▼</span></h3>
            <div className="section-content" id="statsPanel"></div>
          </div>
        </div>
        <button className="sidebar-expand-btn" id="sidebarExpand" onClick={() => (window as any).toggleSidebar?.()} title="Sidebar tonen">▶</button>
        
        {/* Grid */}
        <div className="grid-container" id="gridContainer">
          <div className="empty-state" id="emptyState">
            <div className="empty-icon">🏛</div>
            <p>Voeg eerst zalen toe via de knop <strong>🏛 Zalen</strong> hierboven.</p>
          </div>
          <div className="grid-header-row" id="gridHeaderRow" style={{display:'none'}}></div>
          <div className="schedule-grid" id="scheduleGrid" style={{display:'none'}}></div>
        </div>
      </div>

      {/* Tooltip */}
      <div className="tooltip" id="tooltip"></div>

      {/* Toast Container */}
      <div className="toast-container" id="toastContainer"></div>

      {/* Modals */}
      {/* Session Modal */}
      <div className="modal-overlay" id="sessionModalOverlay">
        <div className="modal">
          <div className="modal-header">
            <h2 id="sessionModalTitle">Programma-onderdeel toevoegen</h2>
            <button className="modal-close" onClick={() => (window as any).closeModal?.('sessionModalOverlay')}>&times;</button>
          </div>
          <div className="modal-body">
            <input type="hidden" id="sessionId" />
            <div className="form-group">
              <label>Titel *</label>
              <input type="text" id="sessionName" placeholder="Bijv. Keynote: De Toekomst" />
            </div>
            <div className="form-group">
              <label>Spreker / Presentator</label>
              <input type="text" id="sessionSpeaker" placeholder="Naam van de spreker" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Type</label>
                <select id="sessionType" onChange={(e) => (window as any).onTypeChange?.()}>
                  <option value="lezing">Lezing</option>
                  <option value="workshop">Workshop</option>
                  <option value="paneldiscussie">Paneldiscussie</option>
                  <option value="pauze">Pauze</option>
                  <option value="lunch">Lunch</option>
                  <option value="netwerken">Netwerken</option>
                  <option value="registratie">Registratie</option>
                  <option value="overig">Overig</option>
                </select>
              </div>
              <div className="form-group">
                <label>Duur</label>
                <select id="sessionDuration">
                  <option value="1">15 min</option>
                  <option value="2" selected>30 min</option>
                  <option value="3">45 min</option>
                  <option value="4">60 min</option>
                  <option value="5">75 min</option>
                  <option value="6">90 min</option>
                  <option value="8">120 min</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Verwacht aantal deelnemers</label>
                <input type="number" id="sessionAttendees" min="0" placeholder="0" />
              </div>
              <div className="form-group">
                <label>Kleur</label>
                <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                  <input type="color" id="sessionColor" style={{width:'48px',height:'36px',padding:'2px',border:'1px solid var(--border)',borderRadius:'4px'}} />
                  <span className="color-preview" id="colorPreview"></span>
                  <div style={{display:'flex',gap:'4px',marginLeft:'8px'}}>
                    <button type="button" title="Gaat door ✅" onClick={() => { const el = document.getElementById('sessionColor') as HTMLInputElement; if(el){el.value='#a5d6a7';(window as any).updateColorPreview?.();} }} style={{width:'28px',height:'28px',borderRadius:'50%',border:'2px solid #81c784',background:'#a5d6a7',cursor:'pointer',fontSize:'12px',lineHeight:'24px',textAlign:'center' as const}}>✅</button>
                    <button type="button" title="Nog niet rond ⚠️" onClick={() => { const el = document.getElementById('sessionColor') as HTMLInputElement; if(el){el.value='#ffe0b2';(window as any).updateColorPreview?.();} }} style={{width:'28px',height:'28px',borderRadius:'50%',border:'2px solid #ffcc80',background:'#ffe0b2',cursor:'pointer',fontSize:'12px',lineHeight:'24px',textAlign:'center' as const}}>⚠️</button>
                    <button type="button" title="Niet rond ❌" onClick={() => { const el = document.getElementById('sessionColor') as HTMLInputElement; if(el){el.value='#ef9a9a';(window as any).updateColorPreview?.();} }} style={{width:'28px',height:'28px',borderRadius:'50%',border:'2px solid #e57373',background:'#ef9a9a',cursor:'pointer',fontSize:'12px',lineHeight:'24px',textAlign:'center' as const}}>❌</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Beschrijving / Notities</label>
              <textarea id="sessionNotes" placeholder="Optionele beschrijving..."></textarea>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-danger" id="deleteSessionBtn" style={{marginRight:'auto',display:'none'}} onClick={() => (window as any).deleteSession?.()}>🗑 Verwijderen</button>
            <button className="btn btn-outline" style={{color:'var(--text)'}} onClick={() => (window as any).closeModal?.('sessionModalOverlay')}>Annuleren</button>
            <button className="btn btn-primary" onClick={() => (window as any).saveSession?.()}>Opslaan</button>
          </div>
        </div>
      </div>

      {/* Halls Modal */}
      <div className="modal-overlay" id="hallModalOverlay">
        <div className="modal">
          <div className="modal-header">
            <h2>Zalen beheren</h2>
            <button className="modal-close" onClick={() => (window as any).closeModal?.('hallModalOverlay')}>&times;</button>
          </div>
          <div className="modal-body">
            <div id="hallList"></div>
            <hr style={{margin:'16px 0',border:'none',borderTop:'1px solid var(--border)'}} />
            <h3 style={{fontSize:'0.95rem',marginBottom:'10px'}}>Zaal toevoegen</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Naam *</label>
                <input type="text" id="hallName" placeholder="Bijv. Grote Zaal" />
              </div>
              <div className="form-group">
                <label>Capaciteit</label>
                <input type="number" id="hallCapacity" min="1" placeholder="100" />
              </div>
            </div>
            <div className="form-group">
              <label>Locatie / Verdieping</label>
              <input type="text" id="hallLocation" placeholder="Bijv. Begane grond" />
            </div>
            <button className="btn btn-success" onClick={() => (window as any).addHall?.()}>+ Zaal toevoegen</button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <div className="modal-overlay" id="settingsModalOverlay">
        <div className="modal">
          <div className="modal-header">
            <h2>Instellingen</h2>
            <button className="modal-close" onClick={() => (window as any).closeModal?.('settingsModalOverlay')}>&times;</button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label>Tijdbereik</label>
              <div className="time-range-inputs">
                <select id="startHour"></select>
                <span>tot</span>
                <select id="endHour"></select>
              </div>
            </div>
            <div className="form-group">
              <label>Conferentienaam</label>
              <input type="text" id="confName" placeholder="Bijv. TechConf 2026" />
            </div>
            <hr style={{margin:'16px 0',border:'none',borderTop:'1px solid var(--border)'}} />
            <h3 style={{fontSize:'0.95rem',marginBottom:'10px'}}>Data beheer</h3>
            <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
              <button className="btn btn-danger btn-sm" onClick={() => {if(confirm('Weet je zeker dat je ALLE data wilt wissen?')){(window as any).clearAllData?.();}}}>🗑 Alles wissen</button>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" style={{color:'var(--text)'}} onClick={() => (window as any).closeModal?.('settingsModalOverlay')}>Sluiten</button>
            <button className="btn btn-primary" onClick={() => (window as any).saveSettings?.()}>Opslaan</button>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      <div className="modal-overlay" id="confirmModalOverlay">
        <div className="modal" style={{width:'380px'}}>
          <div className="modal-header">
            <h2 id="confirmTitle">Bevestigen</h2>
            <button className="modal-close" onClick={() => (window as any).closeModal?.('confirmModalOverlay')}>&times;</button>
          </div>
          <div className="modal-body">
            <p id="confirmMessage"></p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" style={{color:'var(--text)'}} onClick={() => (window as any).closeModal?.('confirmModalOverlay')}>Annuleren</button>
            <button className="btn btn-danger" id="confirmBtn">Verwijderen</button>
          </div>
        </div>
      </div>

      {/* Versions Modal */}
      <div className="modal-overlay" id="versionModalOverlay">
        <div className="modal">
          <div className="modal-header">
            <h2>Versies beheren</h2>
            <button className="modal-close" onClick={() => (window as any).closeModal?.('versionModalOverlay')}>&times;</button>
          </div>
          <div className="modal-body">
            <div style={{marginBottom:'16px',padding:'12px',background:'#e3f2fd',borderRadius:'4px',fontSize:'0.85rem'}}>
              <strong>💡 Tip:</strong> Versies zijn snapshots van je programma. Gebruik dit om verschillende opstellingen uit te proberen.
            </div>
            <div id="versionList"></div>
            <hr style={{margin:'16px 0',border:'none',borderTop:'1px solid var(--border)'}} />
            <h3 style={{fontSize:'0.95rem',marginBottom:'10px'}}>Nieuwe versie opslaan</h3>
            <div className="form-group">
              <label>Versienaam *</label>
              <input type="text" id="versionName" placeholder="Bijv. Versie 1, Concept ochtendprogramma" />
            </div>
            <button className="btn btn-success" onClick={() => (window as any).saveNewVersion?.()}>💾 Versie opslaan</button>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" style={{color:'var(--text)'}} onClick={() => (window as any).closeModal?.('versionModalOverlay')}>Sluiten</button>
          </div>
        </div>
      </div>
    </>
  )
}