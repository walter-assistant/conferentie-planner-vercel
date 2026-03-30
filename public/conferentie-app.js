/* ═══════════════════════════════════════════════════════════════
   CONFERENTIE PLANNER - SUPABASE VERSION
   Extracted from HTML version and adapted for Supabase cloud storage
   ═══════════════════════════════════════════════════════════════ */

// Prevent double-loading (React strict mode / re-renders)
if (window.__confPlannerLoaded) { console.warn('Conferentie script already loaded, skipping'); }

// Global variables
var TYPE_COLORS = {
  lezing: '#1565c0', workshop: '#2e7d32', paneldiscussie: '#6a1b9a',
  pauze: '#ff8f00', lunch: '#e65100', netwerken: '#00838f',
  registratie: '#455a64', overig: '#c62828'
};
var TYPE_LABELS = {
  lezing: 'Lezing', workshop: 'Workshop', paneldiscussie: 'Paneldiscussie',
  pauze: 'Pauze', lunch: 'Lunch', netwerken: 'Netwerken',
  registratie: 'Registratie', overig: 'Overig'
};
var BREAK_TYPES = ['pauze', 'lunch'];

let state = {
  halls: [],
  sessions: [],
  dates: [],
  activeDate: null,
  startHour: 8,
  endHour: 22,
  confName: 'Conferentie',
  nextId: 1,
  versions: []
};

let undoStack = [];
var MAX_UNDO = 20;
let currentConferenceId = null;
let saveDebounceTimer = null;

// Supabase integration - access from window
const getSupabase = () => window.supabase;
const getConferenceService = () => window.conferenceService;
const getAuthService = () => window.authService;

/* ═══════════════════════════════════════════════════════════════
   ENHANCED PERSISTENCE WITH SUPABASE
   ═══════════════════════════════════════════════════════════════ */

// Auto-save with debounce
function saveState() {
  // Clear existing timer
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }
  
  // Save to localStorage immediately for cache
  try {
    if (currentConferenceId) {
      localStorage.setItem(`conf_cache_${currentConferenceId}`, JSON.stringify(state));
      localStorage.setItem('conf_last_id', currentConferenceId);
      localStorage.setItem('conf_last_name', state.confName || '');
    }
  } catch(e) {}
  
  // Debounced save to Supabase
  saveDebounceTimer = setTimeout(async () => {
    await saveToSupabase();
  }, 500);
}

async function saveToSupabase() {
  if (!currentConferenceId) return;
  
  try {
    const conferenceService = getConferenceService();
    if (!conferenceService) return;
    
    const user = await getAuthService()?.getUser();
    await conferenceService.updateConference(
      currentConferenceId,
      state.confName,
      {
        halls: state.halls,
        sessions: state.sessions,
        dates: state.dates,
        activeDate: state.activeDate,
        startHour: state.startHour,
        endHour: state.endHour,
        nextId: state.nextId,
        versions: state.versions
      }
    );
    
    // Auto-save version (max 1 per 10 minutes)
    await autoSaveVersion();
    
    updateProjectUI();
  } catch (error) {
    console.error('Error saving to Supabase:', error);
    showToast('Opslaan mislukt - controleer je internetverbinding');
  }
}

async function loadState() {
  try {
    const conferenceService = getConferenceService();
    if (!conferenceService) { console.error('No conferenceService available'); return; }
    
    // Get list of conferences
    console.log('Loading conferences...');
    const conferences = await conferenceService.getConferences();
    console.log('Found', conferences.length, 'conferences:', conferences.map(c => c.name));
    
    if (conferences.length === 0) {
      // Create first conference
      const newConf = await conferenceService.createConference(
        'Mijn Eerste Conferentie',
        {
          halls: [],
          sessions: [],
          dates: [new Date().toISOString().split('T')[0]],
          activeDate: new Date().toISOString().split('T')[0],
          startHour: 8,
          endHour: 22,
          nextId: 1,
          versions: []
        }
      );
      currentConferenceId = newConf.id;
      state = {
        confName: newConf.name,
        ...newConf.data,
        halls: newConf.data.halls || [],
        sessions: newConf.data.sessions || [],
        dates: newConf.data.dates || [new Date().toISOString().split('T')[0]],
        activeDate: newConf.data.activeDate || new Date().toISOString().split('T')[0],
        startHour: newConf.data.startHour || 8,
        endHour: newConf.data.endHour || 22,
        nextId: newConf.data.nextId || 1,
        versions: newConf.data.versions || []
      };
    } else {
      // Load first conference
      currentConferenceId = conferences[0].id;
      await loadConference(currentConferenceId);
    }
    
    // Update project dropdown
    renderProjectSelect(conferences);
    
  } catch (error) {
    console.error('Error loading from Supabase:', error);
    showToast('Laden mislukt - check internet verbinding');
    
    // Fallback to localStorage cache
    loadFromCache();
  }
}

function loadFromCache() {
  try {
    // Restore conference ID from localStorage if not set
    if (!currentConferenceId) {
      const savedId = localStorage.getItem('conf_last_id');
      if (savedId) {
        currentConferenceId = savedId;
        console.log('Restored conference ID from cache:', savedId);
      }
    }
    if (currentConferenceId) {
      const cached = localStorage.getItem(`conf_cache_${currentConferenceId}`);
      if (cached) {
        const data = JSON.parse(cached);
        state = { ...state, ...data };
        console.log('Loaded state from localStorage cache');
        showToast('Offline modus - data geladen uit cache');
      }
    }
  } catch(e) {
    // Default state
    const today = new Date().toISOString().split('T')[0];
    state = {
      halls: [],
      sessions: [],
      dates: [today],
      activeDate: today,
      startHour: 8,
      endHour: 22,
      confName: 'Nieuwe Conferentie',
      nextId: 1,
      versions: []
    };
  }
}

async function loadConference(conferenceId) {
  try {
    const conferenceService = getConferenceService();
    const conf = await conferenceService.getConference(conferenceId);
    
    if (conf) {
      currentConferenceId = conf.id;
      state = {
        confName: conf.name,
        halls: conf.data.halls || [],
        sessions: conf.data.sessions || [],
        dates: conf.data.dates || [new Date().toISOString().split('T')[0]],
        activeDate: conf.data.activeDate || conf.data.dates?.[0] || new Date().toISOString().split('T')[0],
        startHour: conf.data.startHour || 8,
        endHour: conf.data.endHour || 22,
        nextId: conf.data.nextId || 1,
        versions: conf.data.versions || []
      };
      
      // Load versions from database
      const versions = await conferenceService.getVersions(conferenceId);
      state.versions = versions.map(v => ({
        id: v.id,
        name: v.name || 'Unnamed Version',
        savedAt: v.created_at,
        sessions: v.data.sessions || []
      }));
    }
  } catch (error) {
    console.error('Error loading conference:', error);
    loadFromCache();
  }
}

// Auto version saving
let lastAutoSave = 0;
async function autoSaveVersion() {
  const now = Date.now();
  if (now - lastAutoSave < 10 * 60 * 1000) return; // Max 1 auto-save per 10 minutes
  
  try {
    const conferenceService = getConferenceService();
    if (!conferenceService || !currentConferenceId) return;
    
    const versionName = `Auto-save ${new Date().toLocaleString('nl-NL')}`;
    await conferenceService.saveVersion(currentConferenceId, versionName, { sessions: state.sessions });
    lastAutoSave = now;
  } catch (error) {
    console.error('Auto-save version failed:', error);
  }
}

/* ═══════════════════════════════════════════════════════════════
   PROJECT MANAGEMENT (ENHANCED FOR SUPABASE)
   ═══════════════════════════════════════════════════════════════ */

function renderProjectSelect(conferences) {
  const select = document.getElementById('projectSelect');
  if (!select || !conferences) return;
  
  select.innerHTML = conferences.map(conf => 
    `<option value="${conf.id}" ${conf.id === currentConferenceId ? 'selected' : ''}>${conf.name}</option>`
  ).join('');
}

async function switchProject() {
  const select = document.getElementById('projectSelect');
  const newProjectId = select.value;
  
  if (newProjectId === currentConferenceId) return;
  
  // Save current project first
  await saveToSupabase();
  
  // Load new project
  await loadConference(newProjectId);
  
  // Update UI
  renderAll();
  updateProjectUI();
}

async function newProject() {
  const name = prompt('Naam van de nieuwe conferentie:', 'Nieuwe Conferentie');
  if (!name || !name.trim()) return;
  
  try {
    // Save current project first
    await saveToSupabase();
    
    // Create new conference
    const conferenceService = getConferenceService();
    const newConf = await conferenceService.createConference(
      name.trim(),
      {
        halls: [],
        sessions: [],
        dates: [new Date().toISOString().split('T')[0]],
        activeDate: new Date().toISOString().split('T')[0],
        startHour: 8,
        endHour: 22,
        nextId: 1,
        versions: []
      }
    );
    
    // Switch to new conference
    currentConferenceId = newConf.id;
    state = {
      confName: newConf.name,
      ...newConf.data
    };
    
    // Update UI
    const conferences = await conferenceService.getConferences();
    renderProjectSelect(conferences);
    document.getElementById('projectSelect').value = newConf.id;
    renderAll();
    updateProjectUI();
    
    showToast(`Nieuwe conferentie "${name}" aangemaakt`);
  } catch (error) {
    console.error('Error creating project:', error);
    showToast('Fout bij aanmaken nieuwe conferentie');
  }
}

async function deleteProject() {
  try {
    const conferenceService = getConferenceService();
    const conferences = await conferenceService.getConferences();
    
    if (conferences.length <= 1) {
      alert('Je kunt niet de laatste conferentie verwijderen.');
      return;
    }
    
    const currentConf = conferences.find(c => c.id === currentConferenceId);
    const projectName = currentConf ? currentConf.name : 'deze conferentie';
    
    if (!confirm(`Weet je zeker dat je "${projectName}" wilt verwijderen? Alle data gaat verloren.`)) {
      return;
    }
    
    // Delete from database
    await conferenceService.deleteConference(currentConferenceId);
    
    // Switch to first available conference
    const remainingConfs = conferences.filter(c => c.id !== currentConferenceId);
    await loadConference(remainingConfs[0].id);
    
    // Update UI
    const updatedConferences = await conferenceService.getConferences();
    renderProjectSelect(updatedConferences);
    document.getElementById('projectSelect').value = currentConferenceId;
    renderAll();
    updateProjectUI();
    
    showToast(`Conferentie "${projectName}" verwijderd`);
  } catch (error) {
    console.error('Error deleting project:', error);
    showToast('Fout bij verwijderen conferentie');
  }
}

/* ═══════════════════════════════════════════════════════════════
   VERSION MANAGEMENT (ENHANCED FOR SUPABASE)
   ═══════════════════════════════════════════════════════════════ */

async function saveCurrentVersion() {
  const name = prompt('Naam voor deze versie:', `Versie ${state.versions.length + 1}`);
  if (!name || !name.trim()) return;
  
  try {
    const conferenceService = getConferenceService();
    if (!conferenceService || !currentConferenceId) return;
    
    pushUndo('Versie opslaan: ' + name.trim());
    
    const version = await conferenceService.saveVersion(
      currentConferenceId, 
      name.trim(), 
      { sessions: state.sessions }
    );
    
    // Add to local state
    state.versions.push({
      id: version.id,
      name: version.name,
      savedAt: version.created_at,
      sessions: [...state.sessions]
    });
    
    saveState();
    renderVersions();
    showToast(`Versie "${name.trim()}" opgeslagen`);
  } catch (error) {
    console.error('Error saving version:', error);
    showToast('Fout bij opslaan versie');
  }
}

async function saveNewVersion() {
  const name = document.getElementById('versionName').value.trim();
  if (!name) { 
    alert('Versienaam is verplicht.'); 
    return; 
  }
  
  try {
    const conferenceService = getConferenceService();
    if (!conferenceService || !currentConferenceId) return;
    
    // Check for duplicate names locally
    if (state.versions.find(v => v.name === name)) {
      if (!confirm(`Er bestaat al een versie met de naam "${name}". Overschrijven?`)) {
        return;
      }
      // Remove existing version with same name from local state
      state.versions = state.versions.filter(v => v.name !== name);
    }
    
    pushUndo('Versie opslaan: ' + name);
    
    const version = await conferenceService.saveVersion(
      currentConferenceId, 
      name, 
      { sessions: state.sessions }
    );
    
    // Add to local state
    state.versions.push({
      id: version.id,
      name: version.name,
      savedAt: version.created_at,
      sessions: [...state.sessions]
    });
    
    // Clear input and close modal
    document.getElementById('versionName').value = '';
    saveState();
    renderVersionList();
    renderVersions();
    showToast(`Versie "${name}" opgeslagen`);
  } catch (error) {
    console.error('Error saving version:', error);
    showToast('Fout bij opslaan versie');
  }
}

async function loadVersion(versionId) {
  const version = state.versions.find(v => v.id === versionId);
  if (!version) return;
  
  if (!confirm(`Huidige programma wordt overschreven met versie "${version.name}". Doorgaan?`)) {
    return;
  }
  
  pushUndo('Versie laden: ' + version.name);
  
  // Replace current sessions with version sessions (deep copy)
  state.sessions = JSON.parse(JSON.stringify(version.sessions));
  
  saveState();
  closeModal('versionModalOverlay');
  renderAll();
  showToast(`Versie "${version.name}" geladen`);
}

async function deleteVersion(versionId) {
  const version = state.versions.find(v => v.id === versionId);
  if (!version) return;
  
  if (!confirm(`Weet je zeker dat je versie "${version.name}" wilt verwijderen?`)) {
    return;
  }
  
  try {
    const conferenceService = getConferenceService();
    if (conferenceService) {
      await conferenceService.deleteVersion(versionId);
    }
    
    pushUndo('Versie verwijderen: ' + version.name);
    
    state.versions = state.versions.filter(v => v.id !== versionId);
    saveState();
    renderVersionList();
    renderVersions();
    showToast(`Versie "${version.name}" verwijderd`);
  } catch (error) {
    console.error('Error deleting version:', error);
    showToast('Fout bij verwijderen versie');
  }
}

/* ═══════════════════════════════════════════════════════════════
   REST OF THE ORIGINAL FUNCTIONALITY
   (Copy remaining functions from original script)
   ═══════════════════════════════════════════════════════════════ */

function genId() { return state.nextId++; }
function slotCount() { return (state.endHour - state.startHour) * 4; }
function slotToTime(slot) {
  const totalMin = state.startHour * 60 + slot * 15;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function formatDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
}

function pushUndo(description) {
  undoStack.push({ description, snapshot: JSON.stringify(state) });
  if (undoStack.length > MAX_UNDO) undoStack.shift();
}

function undo() {
  if (!undoStack.length) return;
  const entry = undoStack.pop();
  state = JSON.parse(entry.snapshot);
  saveState();
  renderAll();
  showToast(`Ongedaan gemaakt: ${entry.description}`);
}

function updateProjectUI() {
  document.getElementById('headerTitle').textContent = state.confName;
  const placed = state.sessions.filter(s => s.hallId !== null && s.slotIndex !== null).length;
  const unplaced = state.sessions.length - placed;
  const dateInfo = state.dates.length > 1 ? `${state.dates.length} dagen` : formatDate(state.activeDate);
  
  let statusText = `${state.sessions.length} onderdelen`;
  if (unplaced > 0) statusText += ` (${unplaced} ongeplaatst)`;
  statusText += ` · ${state.halls.length} zalen · ${dateInfo}`;
  
  const statusEl = document.getElementById('projectStatus');
  if (statusEl) statusEl.textContent = statusText;
  document.title = `${state.confName} - Conferentie Planner`;
}

function editConferenceName() {
  const newName = prompt('Conferentienaam:', state.confName);
  if (newName === null || !newName.trim()) return;
  
  state.confName = newName.trim();
  saveState();
  updateProjectUI();
  showToast('Conferentienaam bijgewerkt');
}

/* ═══════════════════════════════════════════════════════════════
   MODALS
   ═══════════════════════════════════════════════════════════════ */
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

/* Session modal */
function openSessionModal(session, slotIndex, hallId) {
  const isEdit = !!session;
  document.getElementById('sessionModalTitle').textContent = isEdit ? 'Programma-onderdeel bewerken' : 'Programma-onderdeel toevoegen';
  document.getElementById('deleteSessionBtn').style.display = isEdit ? 'block' : 'none';
  document.getElementById('sessionId').value = isEdit ? session.id : '';
  document.getElementById('sessionName').value = isEdit ? session.name : '';
  document.getElementById('sessionSpeaker').value = isEdit ? session.speaker : '';
  document.getElementById('sessionType').value = isEdit ? session.type : 'lezing';
  document.getElementById('sessionDuration').value = isEdit ? session.duration : '2';
  document.getElementById('sessionAttendees').value = isEdit ? (session.attendees || '') : '';
  document.getElementById('sessionNotes').value = isEdit ? (session.notes || '') : '';
  document.getElementById('sessionColor').value = isEdit ? session.color : TYPE_COLORS['lezing'];
  updateColorPreview();

  // Store placement context
  document.getElementById('sessionId').dataset.slotIndex = slotIndex !== undefined ? slotIndex : '';
  document.getElementById('sessionId').dataset.hallId = hallId !== undefined ? hallId : '';

  openModal('sessionModalOverlay');
  setTimeout(() => document.getElementById('sessionName').focus(), 100);
}

function onTypeChange() {
  const type = document.getElementById('sessionType').value;
  document.getElementById('sessionColor').value = TYPE_COLORS[type];
  updateColorPreview();
}

function updateColorPreview() {
  const preview = document.getElementById('colorPreview');
  if (preview) {
    preview.style.background = document.getElementById('sessionColor').value;
  }
}

function saveSession() {
  const name = document.getElementById('sessionName').value.trim();
  if (!name) { alert('Titel is verplicht.'); return; }
  const idField = document.getElementById('sessionId');
  const id = idField.value ? parseInt(idField.value) : null;
  const type = document.getElementById('sessionType').value;
  const data = {
    name,
    speaker: document.getElementById('sessionSpeaker').value.trim(),
    type,
    duration: parseInt(document.getElementById('sessionDuration').value),
    attendees: parseInt(document.getElementById('sessionAttendees').value) || 0,
    notes: document.getElementById('sessionNotes').value.trim(),
    color: document.getElementById('sessionColor').value
  };

  if (id) {
    pushUndo('Bewerken: ' + name);
    const session = state.sessions.find(s => s.id === id);
    Object.assign(session, data);
  } else {
    pushUndo('Toevoegen: ' + name);
    const newSession = {
      id: genId(), ...data,
      date: null, hallId: null, slotIndex: null
    };
    // If opened from a cell click, place it
    const slotIndex = idField.dataset.slotIndex;
    const hallId = idField.dataset.hallId;
    if (slotIndex !== '' && hallId !== '') {
      newSession.date = state.activeDate;
      newSession.hallId = parseInt(hallId);
      newSession.slotIndex = parseInt(slotIndex);
    }
    state.sessions.push(newSession);
  }
  saveState();
  closeModal('sessionModalOverlay');
  renderAll();
  updateProjectUI();
}

function deleteSession() {
  const id = parseInt(document.getElementById('sessionId').value);
  if (!id) return;
  const session = state.sessions.find(s => s.id === id);
  if (!confirm(`Weet je zeker dat je "${session.name}" wilt verwijderen?`)) return;
  pushUndo('Verwijderen: ' + session.name);
  state.sessions = state.sessions.filter(s => s.id !== id);
  saveState();
  closeModal('sessionModalOverlay');
  renderAll();
  updateProjectUI();
  showToast(`"${session.name}" verwijderd`, true);
}

/* Hall modal */
function openHallModal() {
  renderHallList();
  openModal('hallModalOverlay');
}

function renderHallList() {
  const list = document.getElementById('hallList');
  if (!state.halls.length) {
    list.innerHTML = '<p style="color:var(--text-light);font-size:0.85rem;">Nog geen zalen. Voeg hieronder een zaal toe.</p>';
    return;
  }
  list.innerHTML = state.halls.map(h => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px;margin-bottom:6px;background:#f5f5f5;border-radius:4px;">
      <div style="flex:1;">
        <strong>${h.name}</strong>
        <span style="font-size:0.8rem;color:var(--text-light);margin-left:8px;">${h.capacity ? h.capacity + ' pers.' : ''} ${h.location ? '· ' + h.location : ''}</span>
      </div>
      <button class="btn btn-sm btn-outline" style="color:var(--text);border-color:var(--border);" onclick="editHall(${h.id})">✏️</button>
      <button class="btn btn-sm btn-danger" onclick="removeHall(${h.id})">🗑</button>
    </div>
  `).join('');
}

function addHall() {
  const name = document.getElementById('hallName').value.trim();
  if (!name) { alert('Zaalnaam is verplicht.'); return; }
  pushUndo('Zaal toevoegen: ' + name);
  state.halls.push({
    id: genId(),
    name,
    capacity: parseInt(document.getElementById('hallCapacity').value) || 0,
    location: document.getElementById('hallLocation').value.trim()
  });
  document.getElementById('hallName').value = '';
  document.getElementById('hallCapacity').value = '';
  document.getElementById('hallLocation').value = '';
  saveState();
  renderHallList();
  renderAll();
  updateProjectUI();
}

function editHall(id) {
  const hall = state.halls.find(h => h.id === id);
  const name = prompt('Zaalnaam:', hall.name);
  if (name === null) return;
  const cap = prompt('Capaciteit:', hall.capacity || '');
  const loc = prompt('Locatie:', hall.location || '');
  pushUndo('Zaal bewerken: ' + hall.name);
  hall.name = name.trim() || hall.name;
  hall.capacity = parseInt(cap) || 0;
  hall.location = loc ? loc.trim() : '';
  saveState();
  renderHallList();
  renderAll();
  updateProjectUI();
}

function removeHall(id) {
  const hall = state.halls.find(h => h.id === id);
  if (!confirm(`Zaal "${hall.name}" verwijderen? Geplaatste programma-onderdelen worden ongeplaatst.`)) return;
  pushUndo('Zaal verwijderen: ' + hall.name);
  // Unplace sessions in this hall
  state.sessions.filter(s => s.hallId === id).forEach(s => {
    s.hallId = null; s.slotIndex = null; s.date = null;
  });
  state.halls = state.halls.filter(h => h.id !== id);
  saveState();
  renderHallList();
  renderAll();
  updateProjectUI();
}

/* Settings modal */
function openSettingsModal() {
  const startSel = document.getElementById('startHour');
  const endSel = document.getElementById('endHour');
  startSel.innerHTML = '';
  endSel.innerHTML = '';
  for (let h = 0; h <= 23; h++) {
    const label = `${String(h).padStart(2,'0')}:00`;
    startSel.innerHTML += `<option value="${h}" ${h === state.startHour ? 'selected' : ''}>${label}</option>`;
    endSel.innerHTML += `<option value="${h}" ${h === state.endHour ? 'selected' : ''}>${label}</option>`;
  }
  document.getElementById('confName').value = state.confName;
  openModal('settingsModalOverlay');
}

function saveSettings() {
  const s = parseInt(document.getElementById('startHour').value);
  const e = parseInt(document.getElementById('endHour').value);
  if (e <= s) { alert('Eindtijd moet na starttijd liggen.'); return; }
  
  const newName = document.getElementById('confName').value.trim() || 'Conferentie';
  
  pushUndo('Instellingen gewijzigd');
  state.startHour = s;
  state.endHour = e;
  state.confName = newName;
  
  saveState();
  closeModal('settingsModalOverlay');
  updateProjectUI();
  renderAll();
}

/* ═══════════════════════════════════════════════════════════════
   DATE TABS
   ═══════════════════════════════════════════════════════════════ */
function addDate() {
  const last = state.dates[state.dates.length - 1];
  const next = new Date(last + 'T00:00:00');
  next.setDate(next.getDate() + 1);
  const iso = next.toISOString().split('T')[0];
  if (!state.dates.includes(iso)) {
    state.dates.push(iso);
    state.dates.sort();
  }
  state.activeDate = iso;
  saveState();
  renderAll();
}

function removeDate(date) {
  if (state.dates.length <= 1) { alert('Er moet minimaal één dag zijn.'); return; }
  if (!confirm(`Dag ${formatDate(date)} verwijderen? Programma-onderdelen op deze dag worden ongeplaatst.`)) return;
  pushUndo('Dag verwijderen: ' + formatDate(date));
  state.sessions.filter(s => s.date === date).forEach(s => {
    s.date = null; s.hallId = null; s.slotIndex = null;
  });
  state.dates = state.dates.filter(d => d !== date);
  if (state.activeDate === date) state.activeDate = state.dates[0];
  saveState();
  renderAll();
}

function renderDateTabs() {
  const container = document.getElementById('dateTabs');
  if (!container) return;
  
  container.innerHTML = state.dates.map(d => `
    <div class="date-tab ${d === state.activeDate ? 'active' : ''}" onclick="state.activeDate='${d}';saveState();renderAll();">
      ${formatDate(d)}
      ${state.dates.length > 1 ? `<span class="remove-date" onclick="event.stopPropagation();removeDate('${d}')">×</span>` : ''}
    </div>
  `).join('');
}

/* ═══════════════════════════════════════════════════════════════
   RENDERING
   ═══════════════════════════════════════════════════════════════ */
function renderAll() {
  renderDateTabs();
  renderHallListSidebar();
  renderGrid();
  renderUnplaced();
  renderStats();
  renderVersions();
}

function getPlacedSessions(date) {
  return state.sessions.filter(s => s.date === date && s.hallId !== null && s.slotIndex !== null);
}

function getUnplacedSessions() {
  return state.sessions.filter(s => s.hallId === null || s.slotIndex === null);
}

function hasCollision(hallId, slotIndex, duration, excludeId, date) {
  const placed = getPlacedSessions(date || state.activeDate);
  for (const s of placed) {
    if (s.id === excludeId) continue;
    if (s.hallId !== hallId) continue;
    const sEnd = s.slotIndex + s.duration;
    const newEnd = slotIndex + duration;
    if (slotIndex < sEnd && newEnd > s.slotIndex) return true;
  }
  return false;
}

let draggedHallId = null;

function renderHallListSidebar() {
  const container = document.getElementById('hallListSidebar');
  const countEl = document.getElementById('hallCount');
  
  if (!container || !countEl) return;
  
  countEl.textContent = state.halls.length;
  
  if (!state.halls.length) {
    container.innerHTML = '<p style="color:var(--text-light);font-size:0.8rem;">Geen zalen. Klik op 🏛 Zalen om toe te voegen.</p>';
    return;
  }
  
  let html = '';
  state.halls.forEach((hall, index) => {
    html += `<div class="hall-drop-indicator" data-index="${index}"></div>`;
    html += `
      <div class="hall-list-item" draggable="true" data-hall-id="${hall.id}">
        <div class="drag-handle">≡</div>
        <div class="hall-info">
          <div class="hall-name">${hall.name}</div>
          <div class="hall-details">${hall.capacity ? hall.capacity + ' pers.' : 'Capaciteit onbekend'}${hall.location ? ' · ' + hall.location : ''}</div>
        </div>
      </div>
    `;
  });
  html += `<div class="hall-drop-indicator" data-index="${state.halls.length}"></div>`;
  
  container.innerHTML = html;
  
  // Add drag event listeners for hall reordering
  container.querySelectorAll('.hall-list-item').forEach(item => {
    item.addEventListener('dragstart', function(e) {
      draggedHallId = parseInt(e.target.closest('[data-hall-id]').dataset.hallId);
      e.target.closest('[data-hall-id]').classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedHallId);
    });
    item.addEventListener('dragend', function(e) {
      e.target.closest('[data-hall-id]')?.classList.remove('dragging');
      document.querySelectorAll('.hall-drop-indicator').forEach(el => el.classList.remove('active'));
      draggedHallId = null;
    });
  });
  
  container.querySelectorAll('.hall-drop-indicator').forEach(indicator => {
    indicator.addEventListener('dragover', function(e) {
      if (draggedHallId === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.hall-drop-indicator').forEach(el => el.classList.remove('active'));
      e.target.classList.add('active');
    });
    indicator.addEventListener('drop', function(e) {
      e.preventDefault();
      if (draggedHallId === null) return;
      
      const dropIndex = parseInt(e.target.dataset.index);
      const draggedHall = state.halls.find(h => h.id === draggedHallId);
      const currentIndex = state.halls.findIndex(h => h.id === draggedHallId);
      
      if (currentIndex === dropIndex || currentIndex === dropIndex - 1) return;
      
      pushUndo('Zaal volgorde wijzigen: ' + draggedHall.name);
      state.halls.splice(currentIndex, 1);
      const insertIndex = dropIndex > currentIndex ? dropIndex - 1 : dropIndex;
      state.halls.splice(insertIndex, 0, draggedHall);
      
      saveState();
      renderAll();
      showToast(`Zaal "${draggedHall.name}" verplaatst`);
    });
  });
}

function renderGrid() {
  const grid = document.getElementById('scheduleGrid');
  const empty = document.getElementById('emptyState');
  const headerRow = document.getElementById('gridHeaderRow');
  
  if (!grid || !empty || !headerRow) return;
  
  if (!state.halls.length) {
    grid.style.display = 'none';
    headerRow.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  grid.style.display = 'grid';
  headerRow.style.display = 'grid';

  const cols = state.halls.length;
  const slots = slotCount();
  const colTemplate = `70px repeat(${cols}, minmax(140px, 1fr))`;
  grid.style.gridTemplateColumns = colTemplate;
  grid.style.gridTemplateRows = `repeat(${slots}, 28px)`;
  headerRow.style.gridTemplateColumns = colTemplate;

  // Render header row
  let headerHtml = '';
  headerHtml += `<div class="grid-header time-header">Tijd</div>`;
  state.halls.forEach((h, idx) => {
    headerHtml += `<div class="grid-header" draggable="true" data-hall-idx="${idx}" style="cursor:grab;" title="Sleep om volgorde te wijzigen">${h.name}${h.capacity ? `<div class="hall-capacity">${h.capacity} pers.${h.location ? ' · ' + h.location : ''}</div>` : ''}</div>`;
  });
  headerRow.innerHTML = headerHtml;

  // Drag & drop on grid headers to reorder halls
  let dragHallIdx = null;
  headerRow.querySelectorAll('.grid-header[draggable]').forEach(el => {
    el.addEventListener('dragstart', e => {
      dragHallIdx = parseInt(el.dataset.hallIdx);
      el.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', e => { el.style.opacity = '1'; dragHallIdx = null; });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.style.background = '#bbdefb';
    });
    el.addEventListener('dragleave', e => { el.style.background = ''; });
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.style.background = '';
      const dropIdx = parseInt(el.dataset.hallIdx);
      if (dragHallIdx !== null && dragHallIdx !== dropIdx) {
        pushUndo('Zalen herschikt');
        const moved = state.halls.splice(dragHallIdx, 1)[0];
        state.halls.splice(dropIdx, 0, moved);
        saveState();
        renderAll();
        showToast('Zalen herschikt');
      }
    });
  });

  let html = '';

  // Time slots
  for (let i = 0; i < slots; i++) {
    const isHour = i % 4 === 0;
    const timeStr = slotToTime(i);
    html += `<div class="time-label ${isHour ? 'hour-mark' : ''}">${isHour ? timeStr : ''}</div>`;

    state.halls.forEach(h => {
      html += `<div class="grid-cell ${isHour ? 'hour-mark' : ''}" 
        data-slot="${i}" data-hall="${h.id}"
        ondragover="onCellDragOver(event, ${i}, ${h.id})"
        ondragleave="onCellDragLeave(event)"
        ondrop="onCellDrop(event, ${i}, ${h.id})"
        ondblclick="onCellDblClick(${i}, ${h.id})"></div>`;
    });
  }

  grid.innerHTML = html;

  // Place session blocks
  const placed = getPlacedSessions(state.activeDate);
  placed.forEach(s => {
    const hallIndex = state.halls.findIndex(h => h.id === s.hallId);
    if (hallIndex < 0) return;

    const cell = grid.querySelector(`.grid-cell[data-slot="${s.slotIndex}"][data-hall="${s.hallId}"]`);
    if (!cell) return;

    const block = document.createElement('div');
    block.className = 'session-block';
    block.style.background = s.color;
    block.style.height = `${s.duration * 28 - 2}px`;
    block.draggable = true;
    block.dataset.sessionId = s.id;

    // Capacity warning
    const hall = state.halls.find(h => h.id === s.hallId);
    const overCap = hall && hall.capacity > 0 && s.attendees > hall.capacity;

    const timeStart = s.slotIndex !== null ? slotToTime(s.slotIndex) : '';
    const timeEnd = s.slotIndex !== null ? slotToTime(s.slotIndex + s.duration) : '';
    const timeStr = timeStart && timeEnd ? `${timeStart} - ${timeEnd}` : '';

    block.innerHTML = `
      <div class="sb-title">${s.name}</div>
      ${timeStr ? `<div class="sb-time">${timeStr}</div>` : ''}
      ${s.speaker ? `<div class="sb-speaker">👤 ${s.speaker}</div>` : ''}
      ${s.attendees ? `<div class="sb-attendees">👥 ${s.attendees}</div>` : ''}
      ${overCap ? '<div class="capacity-warning" title="Meer deelnemers dan zaalcapaciteit!">⚠️</div>' : ''}
    `;

    block.addEventListener('dragstart', e => onBlockDragStart(e, s));
    block.addEventListener('dragend', e => onBlockDragEnd(e));
    block.addEventListener('click', e => { e.stopPropagation(); openSessionModal(s); });

    cell.appendChild(block);
  });
}

function renderUnplaced() {
  const list = document.getElementById('unplacedList');
  const countEl = document.getElementById('unplacedCount');
  
  if (!list || !countEl) return;
  
  const items = getUnplacedSessions();
  countEl.textContent = items.length;

  if (!items.length) {
    list.innerHTML = '<p style="color:var(--text-light);font-size:0.8rem;">Alle onderdelen zijn geplaatst.</p>';
    return;
  }

  list.innerHTML = items.map(s => `
    <div class="unplaced-item" style="background:${s.color}" draggable="true"
      data-session-id="${s.id}"
      onclick="openSessionModal(state.sessions.find(x=>x.id===${s.id}))">
      <div class="item-title">${s.name}</div>
      <div class="item-meta">${TYPE_LABELS[s.type]} · ${s.duration * 15} min${s.speaker ? ' · ' + s.speaker : ''}</div>
    </div>
  `).join('');

  // Add drag listeners
  list.querySelectorAll('.unplaced-item').forEach(el => {
    el.addEventListener('dragstart', e => {
      const sid = parseInt(el.dataset.sessionId);
      const session = state.sessions.find(s => s.id === sid);
      onBlockDragStart(e, session);
    });
    el.addEventListener('dragend', onBlockDragEnd);
  });
}

function renderStats() {
  const panel = document.getElementById('statsPanel');
  const statsBar = document.getElementById('statsBar');
  
  if (!panel || !statsBar) return;
  
  const total = state.sessions.length;
  const placed = state.sessions.filter(s => s.hallId !== null && s.slotIndex !== null).length;
  const unplaced = total - placed;
  const slots = slotCount();
  const warnings = [];

  // Per-hall occupancy
  const hallStats = state.halls.map(h => {
    const hallSessions = getPlacedSessions(state.activeDate).filter(s => s.hallId === h.id);
    const usedSlots = hallSessions.reduce((sum, s) => sum + s.duration, 0);
    const pct = slots > 0 ? Math.round(usedSlots / slots * 100) : 0;
    // Capacity warnings
    hallSessions.forEach(s => {
      if (h.capacity > 0 && s.attendees > h.capacity) {
        warnings.push(`"${s.name}" (${s.attendees}) > ${h.name} (${h.capacity})`);
      }
    });
    return { name: h.name, pct, usedSlots };
  });

  const totalUsed = hallStats.reduce((sum, h) => sum + h.usedSlots, 0);
  const totalAvailable = slots * state.halls.length;
  const totalPct = totalAvailable > 0 ? Math.round(totalUsed / totalAvailable * 100) : 0;

  let html = `<div class="stats-grid">
    <div class="stat-card"><div class="stat-number">${total}</div><div class="stat-label">Totaal</div></div>
    <div class="stat-card"><div class="stat-number">${placed}</div><div class="stat-label">Geplaatst</div></div>
    <div class="stat-card"><div class="stat-number">${unplaced}</div><div class="stat-label">Ongeplaatst</div></div>
    <div class="stat-card"><div class="stat-number">${totalPct}%</div><div class="stat-label">Bezetting</div></div>
  </div>`;

  if (hallStats.length) {
    html += '<div class="hall-stats">';
    hallStats.forEach(h => {
      html += `<div class="hall-stat-row">
        <span>${h.name}</span>
        <div class="hall-stat-bar"><div class="hall-stat-bar-fill" style="width:${h.pct}%"></div></div>
        <span>${h.pct}%</span>
      </div>`;
    });
    html += '</div>';
  }

  if (warnings.length) {
    html += `<div style="margin-top:10px;padding:8px;background:#fff3e0;border-radius:4px;font-size:0.78rem;">
      <strong>⚠️ Capaciteitswaarschuwingen:</strong><br>${warnings.join('<br>')}
    </div>`;
  }

  panel.innerHTML = html;

  // Stats bar in toolbar
  statsBar.innerHTML = `
    <div class="stat-item">📋 <span class="stat-value">${total}</span> onderdelen</div>
    <div class="stat-item">✅ <span class="stat-value">${placed}</span> geplaatst</div>
    ${unplaced > 0 ? `<div class="stat-item">📌 <span class="stat-warn">${unplaced}</span> ongeplaatst</div>` : ''}
    <div class="stat-item">📊 <span class="stat-value">${totalPct}%</span> bezet</div>
    ${warnings.length ? `<div class="stat-item"><span class="stat-warn">⚠️ ${warnings.length}</span></div>` : ''}
  `;
}

function renderVersions() {
  const container = document.getElementById('versionListSidebar');
  const versionCount = document.getElementById('versionCount');
  
  if (!container || !versionCount) return;
  
  versionCount.textContent = state.versions.length;
  
  if (!state.versions.length) {
    container.innerHTML = '<p style="color:var(--text-light);font-size:0.8rem;margin-top:4px;">Geen versies opgeslagen.</p>';
    return;
  }
  
  // Show last 3 versions in sidebar
  const recentVersions = [...state.versions]
    .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
    .slice(0, 3);
  
  container.innerHTML = recentVersions.map(v => {
    const savedDate = new Date(v.savedAt);
    const formattedDate = savedDate.toLocaleDateString('nl-NL', { 
      day: 'numeric', 
      month: 'short'
    });
    
    const sessionCount = v.sessions.length;
    
    return `
      <div style="padding:6px 8px;margin-bottom:4px;background:#f0f2f5;border-radius:4px;font-size:0.8rem;cursor:pointer;transition:background 0.15s;"
           onmouseover="this.style.background='#e3f2fd'"
           onmouseout="this.style.background='#f0f2f5'"
           onclick="loadVersion('${v.id}')"
           title="Klik om te laden">
        <div style="font-weight:600;margin-bottom:1px;">${v.name}</div>
        <div style="color:var(--text-light);font-size:0.72rem;">${formattedDate} · ${sessionCount} onderdelen</div>
      </div>
    `;
  }).join('');
  
  if (state.versions.length > 3) {
    container.innerHTML += `<div style="text-align:center;margin-top:4px;"><button class="btn btn-sm btn-outline" style="color:var(--text);border-color:var(--border);font-size:0.75rem;" onclick="openVersionModal()">Alle versies...</button></div>`;
  }
}

function renderVersionList() {
  const list = document.getElementById('versionList');
  
  if (!list) return;
  
  if (!state.versions.length) {
    list.innerHTML = '<p style="color:var(--text-light);font-size:0.85rem;">Nog geen versies opgeslagen. Maak hieronder je eerste versie aan.</p>';
    return;
  }
  
  // Sort versions by date (newest first)
  const sortedVersions = [...state.versions].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  
  list.innerHTML = sortedVersions.map(v => {
    const savedDate = new Date(v.savedAt);
    const formattedDate = savedDate.toLocaleDateString('nl-NL', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const sessionCount = v.sessions.length;
    const placedCount = v.sessions.filter(s => s.hallId !== null && s.slotIndex !== null).length;
    const summary = `${sessionCount} onderdelen (${placedCount} geplaatst)`;
    
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:12px;margin-bottom:8px;background:#f8f9fa;border-radius:6px;border:1px solid var(--border);">
        <div style="flex:1;">
          <div style="font-weight:600;margin-bottom:2px;">${v.name}</div>
          <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:2px;">${formattedDate}</div>
          <div style="font-size:0.75rem;color:var(--text-light);">${summary}</div>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-sm btn-primary" onclick="loadVersion('${v.id}')" title="Laden">📂</button>
          <button class="btn btn-sm btn-danger" onclick="deleteVersion('${v.id}')" title="Verwijderen">🗑</button>
        </div>
      </div>
    `;
  }).join('');
}

function openVersionModal() {
  renderVersionList();
  openModal('versionModalOverlay');
  setTimeout(() => {
    const nameField = document.getElementById('versionName');
    if (nameField) nameField.focus();
  }, 100);
}

/* ═══════════════════════════════════════════════════════════════
   DRAG & DROP
   ═══════════════════════════════════════════════════════════════ */
let dragSession = null;

function onBlockDragStart(e, session) {
  dragSession = session;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', session.id);
  requestAnimationFrame(() => {
    const el = e.target.closest('.session-block, .unplaced-item');
    if (el) el.classList.add('dragging');
  });
}

function onBlockDragEnd(e) {
  dragSession = null;
  document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.drop-target, .drop-invalid').forEach(el => {
    el.classList.remove('drop-target', 'drop-invalid');
  });
}

function onCellDragOver(e, slotIndex, hallId) {
  if (!dragSession) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  // Highlight affected cells
  const grid = document.getElementById('scheduleGrid');
  if (!grid) return;
  
  grid.querySelectorAll('.drop-target, .drop-invalid').forEach(el => {
    el.classList.remove('drop-target', 'drop-invalid');
  });

  const collision = hasCollision(hallId, slotIndex, dragSession.duration, dragSession.id);
  const outOfBounds = slotIndex + dragSession.duration > slotCount();

  for (let i = 0; i < dragSession.duration; i++) {
    const cell = grid.querySelector(`.grid-cell[data-slot="${slotIndex + i}"][data-hall="${hallId}"]`);
    if (cell) {
      cell.classList.add(collision || outOfBounds ? 'drop-invalid' : 'drop-target');
    }
  }
}

function onCellDragLeave(e) {
  // Handled in onCellDragOver
}

function onCellDrop(e, slotIndex, hallId) {
  e.preventDefault();
  if (!dragSession) return;

  const collision = hasCollision(hallId, slotIndex, dragSession.duration, dragSession.id);
  const outOfBounds = slotIndex + dragSession.duration > slotCount();

  if (collision || outOfBounds) {
    showToast(collision ? 'Kan niet plaatsen: tijdslot is bezet!' : 'Kan niet plaatsen: past niet in het tijdbereik!');
    onBlockDragEnd(e);
    return;
  }

  pushUndo('Verplaatsen: ' + dragSession.name);
  const session = state.sessions.find(s => s.id === dragSession.id);
  session.date = state.activeDate;
  session.hallId = hallId;
  session.slotIndex = slotIndex;
  saveState();
  onBlockDragEnd(e);
  renderAll();
}

function onCellDblClick(slotIndex, hallId) {
  openSessionModal(null, slotIndex, hallId);
}

/* ═══════════════════════════════════════════════════════════════
   UTILITY & EXPORT FUNCTIONS
   ═══════════════════════════════════════════════════════════════ */

function showToast(message, canUndo = false) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${message}</span>${canUndo ? '<button class="btn-undo" onclick="undo();this.parentElement.remove();">Ongedaan maken</button>' : ''}`;
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, canUndo ? 8000 : 3000);
}

// Sidebar functions
function toggleSidebar() {
  const sidebar = document.getElementById('sidebarPanel');
  if (sidebar) {
    sidebar.classList.toggle('collapsed-sidebar');
  }
}

function toggleSection(id) {
  const section = document.getElementById(id);
  if (section) section.classList.toggle('collapsed');
}

// Export functions (simplified versions - implement full versions as needed)
function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `conferentie-${state.confName.replace(/\s/g, '_')}.json`);
  showToast('JSON geëxporteerd');
}

function exportCSV() {
  const headers = ['Titel', 'Spreker', 'Type', 'Duur (min)', 'Deelnemers', 'Datum', 'Zaal', 'Starttijd', 'Eindtijd', 'Notities'];
  const rows = state.sessions.map(s => {
    const hall = state.halls.find(h => h.id === s.hallId);
    return [
      `"${s.name}"`,
      `"${s.speaker || ''}"`,
      TYPE_LABELS[s.type],
      s.duration * 15,
      s.attendees || '',
      s.date || '',
      hall ? `"${hall.name}"` : '',
      s.slotIndex !== null ? slotToTime(s.slotIndex) : '',
      s.slotIndex !== null ? slotToTime(s.slotIndex + s.duration) : '',
      `"${(s.notes || '').replace(/"/g, '""')}"`
    ].join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `conferentie-${state.confName.replace(/\s/g, '_')}.csv`);
  showToast('CSV geëxporteerd');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; 
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function clearAllData() {
  pushUndo('Alles gewist');
  state.halls = [];
  state.sessions = [];
  state.nextId = 1;
  saveState();
  closeModal('settingsModalOverlay');
  renderAll();
  showToast('Alle data gewist', true);
}

// Placeholder functions for features not yet implemented
function exportPDF() {
  showToast('PDF export wordt geladen...');
  // Implementation would go here
}

function importJSON(event) {
  showToast('JSON import functionaliteit komt binnenkort');
  // Implementation would go here
}

function toggleCSVDrop() {
  const zone = document.getElementById('csvDropZone');
  if (zone) zone.style.display = zone.style.display === 'none' ? 'block' : 'none';
}

// Init CSV drop zone events (with retry for React-rendered elements)
function initCSVDropZone() {
  const zone = document.getElementById('csvDropZone');
  const fileInput = document.getElementById('importCSVFile');
  if (!zone || !fileInput) {
    // Elements not yet rendered by React, retry
    setTimeout(initCSVDropZone, 500);
    return;
  }
  // Prevent double-init
  if (zone.dataset.csvInit) return;
  zone.dataset.csvInit = 'true';
  
  zone.addEventListener('click', function(e) {
    // Only trigger file picker if not clicking on status text
    if (e.target.id !== 'csvDropStatus') fileInput.click();
  });
  zone.addEventListener('dragover', function(e) { e.preventDefault(); e.stopPropagation(); zone.style.background='#bbdefb'; zone.style.borderColor='#0d47a1'; });
  zone.addEventListener('dragleave', function(e) { e.preventDefault(); e.stopPropagation(); zone.style.background='#e3f2fd'; zone.style.borderColor='#1e3a5f'; });
  zone.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    zone.style.background='#e3f2fd'; zone.style.borderColor='#1e3a5f';
    if (e.dataTransfer.files.length > 0) processCSVFile(e.dataTransfer.files[0]);
  });
  
  fileInput.addEventListener('change', function() {
    if (fileInput.files.length > 0) processCSVFile(fileInput.files[0]);
    fileInput.value = '';
  });
  
  console.log('CSV drop zone initialized');
}
// DOMContentLoaded already fired when React loads this script
initCSVDropZone();
// Also try after a delay for React-rendered pages
setTimeout(initCSVDropZone, 1000);
setTimeout(initCSVDropZone, 3000);

function importCSVFromInput(event) {
  if (event.target.files.length > 0) processCSVFile(event.target.files[0]);
  event.target.value = '';
}

function processCSVFile(file) {
  const statusEl = document.getElementById('csvDropStatus');
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.color = '#1e3a5f';
    statusEl.textContent = 'Laden: ' + file.name + '...';
  }
  const reader = new FileReader();
  reader.onload = function(e) { importCSVData(e.target.result, file.name, statusEl); };
  reader.readAsText(file);
}

function importCSVData(text, fileName, statusEl) {
  try {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) { showToast('CSV is leeg', 'error'); return; }

    // Detect separator
    let sep = ',';
    if (lines[0].indexOf(';') > -1 && lines[0].indexOf(',') === -1) sep = ';';
    if (lines[0].indexOf('\t') > -1 && lines[0].split('\t').length > lines[0].split(sep).length) sep = '\t';

    // Parse headers
    const headers = lines[0].split(sep).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

    // Find column indices
    let colTitel = headers.findIndex(h => h.includes('titel') || h.includes('title') || h.includes('naam') || h.includes('sessie'));
    let colSpreker = headers.findIndex(h => h.includes('spreker') || h.includes('speaker') || h.includes('presentator'));
    let colType = headers.findIndex(h => h === 'type' || h.includes('soort'));
    let colDuur = headers.findIndex(h => h.includes('duur') || h.includes('duration') || h.includes('min'));
    let colDeelnemers = headers.findIndex(h => h.includes('deelnemer') || h.includes('attendees') || h.includes('aantal'));
    let colDatum = headers.findIndex(h => h.includes('datum') || h.includes('date'));
    let colZaal = headers.findIndex(h => h.includes('zaal') || h.includes('hall') || h.includes('room'));
    let colStart = headers.findIndex(h => h.includes('start'));
    let colNotities = headers.findIndex(h => h.includes('notit') || h.includes('notes') || h.includes('beschrijving'));
    let colKleur = headers.findIndex(h => h.includes('kleur') || h.includes('color'));

    if (colTitel < 0) colTitel = 0; // fallback

    // Reverse TYPE_LABELS lookup
    const typeLookup = {};
    Object.entries(TYPE_LABELS).forEach(([k, v]) => { typeLookup[v.toLowerCase()] = k; });

    pushUndo('CSV Import');

    let imported = 0;
    const hallsNeeded = new Set();

    // First pass: collect halls
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i], sep);
      const zaalNaam = colZaal >= 0 ? (vals[colZaal] || '').trim() : '';
      if (zaalNaam) hallsNeeded.add(zaalNaam);
    }

    // Create missing halls
    hallsNeeded.forEach(name => {
      if (!state.halls.find(h => h.name.toLowerCase() === name.toLowerCase())) {
        state.halls.push({ id: genId(), name: name, capacity: 0, location: '' });
      }
    });

    // Second pass: import sessions
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i], sep);
      const titel = (vals[colTitel] || '').trim();
      if (!titel) continue;

      const spreker = colSpreker >= 0 ? (vals[colSpreker] || '').trim() : '';
      const typeRaw = colType >= 0 ? (vals[colType] || '').trim().toLowerCase() : '';
      const type = typeLookup[typeRaw] || 'lezing';
      const duurMin = colDuur >= 0 ? parseInt(vals[colDuur]) || 30 : 30;
      const duration = Math.max(1, Math.round(duurMin / 15));
      const deelnemers = colDeelnemers >= 0 ? parseInt(vals[colDeelnemers]) || 0 : 0;
      const datum = colDatum >= 0 ? (vals[colDatum] || '').trim() : '';
      const zaalNaam = colZaal >= 0 ? (vals[colZaal] || '').trim() : '';
      const startTijd = colStart >= 0 ? (vals[colStart] || '').trim() : '';
      const notities = colNotities >= 0 ? (vals[colNotities] || '').trim() : '';
      const kleur = colKleur >= 0 ? (vals[colKleur] || '').trim() : '';

      // Find hall
      const hall = zaalNaam ? state.halls.find(h => h.name.toLowerCase() === zaalNaam.toLowerCase()) : null;

      // Calculate slot from start time
      let slotIndex = null;
      if (startTijd) {
        const timeParts = startTijd.match(/(\d{1,2})[:\.](\d{2})/);
        if (timeParts) {
          const totalMin = parseInt(timeParts[1]) * 60 + parseInt(timeParts[2]);
          slotIndex = Math.round((totalMin - state.startHour * 60) / 15);
          if (slotIndex < 0) slotIndex = null;
        }
      }

      // Parse datum
      let sessionDate = null;
      if (datum) {
        const dateMatch = datum.match(/(\d{4})-(\d{2})-(\d{2})/) || datum.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (dateMatch) {
          if (dateMatch[0].match(/^\d{4}/)) {
            sessionDate = dateMatch[0];
          } else {
            sessionDate = `${dateMatch[3]}-${dateMatch[2].padStart(2,'0')}-${dateMatch[1].padStart(2,'0')}`;
          }
        }
      }
      if (!sessionDate && state.dates.length > 0) sessionDate = state.dates[0];

      // Ensure date exists
      if (sessionDate && !state.dates.includes(sessionDate)) {
        state.dates.push(sessionDate);
        state.dates.sort();
      }

      const typeColors = {lezing:'#1565c0',workshop:'#2e7d32',paneldiscussie:'#6a1b9a',pauze:'#ff8f00',lunch:'#e65100',netwerken:'#00838f',registratie:'#455a64',overig:'#c62828'};
      const sessionColor = kleur || typeColors[type] || '#1565c0';

      state.sessions.push({
        id: genId(),
        name: titel,
        speaker: spreker,
        type: type,
        duration: duration,
        attendees: deelnemers,
        color: sessionColor,
        notes: notities,
        hallId: hall ? hall.id : null,
        slotIndex: slotIndex,
        date: sessionDate
      });
      imported++;
    }

    saveState();
    state.activeDate = state.dates[0] || null;
    renderAll();
    if (statusEl) { statusEl.style.color = '#2e7d32'; statusEl.textContent = '✅ ' + imported + ' sessies geïmporteerd uit ' + fileName; }
    showToast(imported + ' sessies geïmporteerd uit CSV');
    setTimeout(function() { const z = document.getElementById('csvDropZone'); if (z) z.style.display = 'none'; }, 2000);
  } catch(err) {
    if (statusEl) { statusEl.style.color = '#c62828'; statusEl.textContent = '❌ Fout: ' + err.message; }
    showToast('Fout bij CSV import: ' + err.message, 'error');
  }
}

// Helper: parse CSV line respecting quoted fields
function parseCSVLine(line, sep) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === sep) { result.push(current); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

/* ═══════════════════════════════════════════════════════════════
   INITIALIZATION
   ═══════════════════════════════════════════════════════════════ */

// Initialize immediately — DOMContentLoaded already fired when React loads this script
(function() {
  console.log('🚀 Conferentie script starting...');
  console.log('  window.supabase:', !!window.supabase);
  console.log('  window.conferenceService:', !!window.conferenceService);
  
  // Wait for Supabase to be available
  var waitCount = 0;
  var initInterval = setInterval(function() {
    waitCount++;
    if (waitCount % 10 === 0) {
      console.log('⏳ Waiting... attempt', waitCount, 'supabase:', !!window.supabase, 'service:', !!window.conferenceService);
    }
    if (waitCount > 100) { clearInterval(initInterval); console.error('❌ Timeout waiting for Supabase'); return; }
    if (window.supabase && window.conferenceService) {
      clearInterval(initInterval);
      console.log('✅ Supabase found after', waitCount, 'attempts');
      
      // Expose functions to global scope for React component
      window.switchProject = switchProject;
      window.newProject = newProject;
      window.deleteProject = deleteProject;
      window.editConferenceName = editConferenceName;
      window.openHallModal = openHallModal;
      window.openSessionModal = openSessionModal;
      window.openSettingsModal = openSettingsModal;
      window.openVersionModal = openVersionModal;
      window.exportPDF = exportPDF;
      window.exportCSV = exportCSV;
      window.exportJSON = exportJSON;
      window.importJSON = importJSON;
      window.toggleCSVDrop = toggleCSVDrop;
      window.importCSVFromInput = importCSVFromInput;
      window.addDate = addDate;
      window.toggleSidebar = toggleSidebar;
      window.toggleSection = toggleSection;
      window.saveCurrentVersion = saveCurrentVersion;
      window.saveNewVersion = saveNewVersion;
      window.loadVersion = loadVersion;
      window.deleteVersion = deleteVersion;
      window.closeModal = closeModal;
      window.onTypeChange = onTypeChange;
      window.saveSession = saveSession;
      window.deleteSession = deleteSession;
      window.addHall = addHall;
      window.editHall = editHall;
      window.removeHall = removeHall;
      window.saveSettings = saveSettings;
      window.clearAllData = clearAllData;
      window.renderVersionList = renderVersionList;
      
      // Wait for auth session to be restored before loading
      async function initApp() {
        // Script only loads when React confirms user is authenticated
        // But verify we have a valid session before querying
        try {
          const { data: { session } } = await window.supabase.auth.getSession();
          console.log('Auth check:', session ? 'Logged in as ' + session.user.email : 'NOT authenticated');
          
          if (!session) {
            // Wait and retry — React loaded us but session may not be synced yet
            console.log('Waiting for auth sync...');
            await new Promise(r => setTimeout(r, 2000));
            const { data: { session: s2 } } = await window.supabase.auth.getSession();
            if (s2) {
              console.log('Auth synced:', s2.user.email);
            } else {
              console.warn('Still no auth session, loading from cache');
            }
          }
        } catch(e) {
          console.warn('Auth check error:', e);
        }
        
        await loadState();
        renderAll();
        updateProjectUI();
      }
      initApp();
    }
  }, 100);
})();

// Auto-save timer
setInterval(() => {
  if (currentConferenceId && state) {
    saveState();
  }
}, 30000);