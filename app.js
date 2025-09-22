// ---------- Utilities ----------
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function todayISO(){const d=new Date();return d.toISOString().slice(0,10)}
function getWeekKey(date){
    const d=new Date(date);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 4 - (d.getDay()||7));
    const year = d.getFullYear();
    const week = Math.ceil(((d - new Date(year,0,1)) / 86400000 + 1)/7);
    return `${year}-W${String(week).padStart(2,'0')}`;
}
function getMonthKey(date){ const d=new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }

const STORAGE_KEY = 'gymPro_v3_dark';
function loadState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')}catch(e){return {entries:[],goals:[]}}}
function saveAll(data){localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}

// Small toast helper
function toast(msg, type='success', timeout=3500){
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type==='error' ? 'error' : 'success'}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(()=> el.style.opacity = '0.0', timeout - 400);
    setTimeout(()=> { try{ container.removeChild(el); } catch(e){} }, timeout);
}

// Firebase Configuration - REPLACE WITH YOURS
const firebaseConfig = {
    "apiKey": "TU_API_KEY_AQUI",
    "authDomain": "TU_DOMINIO_AQUI.firebaseapp.com",
    "projectId": "TU_PROJECT_ID_AQUI",
    "storageBucket": "TU_STORAGE_BUCKET_AQUI",
    "messagingSenderId": "TU_SENDER_ID_AQUI",
    "appId": "TU_APP_ID_AQUI"
};

// Initialize Firebase
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDB = null;
let isCloudEnabled = false;
let currentUser = null;

try {
    if(firebaseConfig && firebaseConfig.apiKey){
        firebaseApp = firebase.initializeApp(firebaseConfig);
        firebaseAuth = firebase.auth();
        firebaseDB = firebase.database();
        isCloudEnabled = true;
    }
} catch(err) {
    console.error("Error al inicializar Firebase: ", err);
    isCloudEnabled = false;
}

// Initialize state
const state = loadState();
if(!state.entries) state.entries = [];
if(!state.goals) state.goals = [];
document.getElementById('dateInput').value = todayISO();

// DOM refs
const exercisesEl = document.getElementById('exercises');
const filterWeekEl = document.getElementById('filterWeek');
const chartExerciseEl = document.getElementById('chartExercise');
const progressChartCtx = document.getElementById('progressChart').getContext('2d');
const viewModeEl = document.getElementById('viewMode');
const signBtn = document.getElementById('signBtn');
const syncBtn = document.getElementById('syncNow');
const logoutBtn = document.getElementById('logout');
const welcomeTitle = document.getElementById('welcomeTitle');
const themeToggle = document.getElementById('themeToggle');
const appRoot = document.getElementById('appRoot');

// Auth Modal DOM refs
const authModal = document.getElementById('authModal');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const switchToRegisterBtn = document.getElementById('switchToRegister');
const switchToLoginBtn = document.getElementById('switchToLogin');
const authLoginView = document.getElementById('authLogin');
const authRegisterView = document.getElementById('authRegister');
const closeAuthModalBtn = document.getElementById('closeAuthModal');

// History Modal DOM refs
const historyModal = document.getElementById('historyModal');
const historyTitle = document.getElementById('historyTitle');
const historyList = document.getElementById('historyList');
const closeHistoryModalBtn = document.getElementById('closeHistoryModal');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');

// weight elements
const weightInput = document.getElementById('weightInput');
const weightSlider = document.getElementById('weightSlider');
const weightDisplay = document.getElementById('weightDisplay');
const incBtn = document.getElementById('incWeightBtn');
const decBtn = document.getElementById('decWeightBtn');

function syncWeightFromInput(){
    const v = Math.round((parseFloat(weightInput.value) || 0)*2)/2;
    weightSlider.value = v;
    weightDisplay.textContent = `${v} kg`;
    weightInput.value = v;
}
function syncWeightFromSlider(){
    const v = Math.round((parseFloat(weightSlider.value) || 0)*2)/2;
    weightInput.value = v;
    weightDisplay.textContent = `${v} kg`;
}
weightInput.addEventListener('input', ()=>{ syncWeightFromInput(); });
weightSlider.addEventListener('input', syncWeightFromSlider);
incBtn.addEventListener('click', ()=>{ let v = parseFloat(weightInput.value)||0; v = Math.round((v+0.5)*2)/2; weightInput.value = v; syncWeightFromInput(); });
decBtn.addEventListener('click', ()=>{ let v = parseFloat(weightInput.value)||0; v = Math.round((v-0.5)*2)/2; if(v<0) v=0; weightInput.value = v; syncWeightFromInput(); });
syncWeightFromInput();

// ---------- Add entry ----------
document.getElementById('entryForm').addEventListener('submit', e=>{
    e.preventDefault();
    const ex = document.getElementById('exerciseInput').value.trim();
    if(!ex) return alert('Ingresa el nombre del ejercicio');
    const weight = Math.round((parseFloat(weightInput.value)||0)*2)/2;
    const reps = parseInt(document.getElementById('repsInput').value)||0;
    const rpe = parseInt(document.getElementById('rpeInput').value)||0;
    const date = document.getElementById('dateInput').value || todayISO();
    const note = document.getElementById('noteInput').value.trim();
    state.entries.push({id:uid(), exercise:ex, weight, reps, rpe, date, note});
    saveAll(state);
    render();
    document.getElementById('noteInput').value='';
    toast('Registro agregado');
    if (currentUser) {
        syncDataToCloud();
    }
});

// ---------- Goals ----------
function renderGoals(){
    const el = document.getElementById('goalsList');
    el.innerHTML = '';
    state.goals.forEach((g,idx)=>{
        const div = document.createElement('div');
        div.className='exercise';
        div.innerHTML = `<div>
            <div style="font-weight:700">${g.exercise}</div>
            <div class="meta">Meta: ${g.target} kg</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
            <button class="small" data-idx="${idx}">Eliminar</button>
        </div>`;
        el.appendChild(div);
    });
}
document.getElementById('addGoalBtn').addEventListener('click', ()=>{
    const ex = document.getElementById('goalExerciseInput').value.trim();
    const target = parseFloat(document.getElementById('goalTargetInput').value)||0;
    if (target < 0) {
        toast('El peso de la meta no puede ser negativo', 'error');
        return;
    }
    if(!ex || !target) return toast('Completa ejercicio y meta', 'error');
    state.goals.push({id:uid(), exercise:ex, target});
    saveAll(state);
    render();
    document.getElementById('goalExerciseInput').value='';
    document.getElementById('goalTargetInput').value='';
    toast('Meta añadida');
    if (currentUser) {
        syncDataToCloud();
    }
});
document.getElementById('goalsList').addEventListener('click', e=>{
    if(e.target.tagName==='BUTTON'){
        const idx=parseInt(e.target.dataset.idx);
        state.goals.splice(idx,1);
        saveAll(state);
        render();
        toast('Meta eliminada');
        if (currentUser) {
            syncDataToCloud();
        }
    }
});

// ---------- View and stats ----------
let progressChart = null;

function render(){
    renderExercises();
    renderStats();
    updateChart();
    renderGoals();
}

function renderExercises(){
    const filteredEntries = filterAndSortEntries();
    const uniqueExercises = [...new Set(filteredEntries.map(e => e.exercise))];
    const exercisesWithData = uniqueExercises.map(ex => {
        const data = filteredEntries.filter(e => e.exercise === ex);
        const lastEntry = data.at(-1);
        const pr = Math.max(...data.map(e => e.weight));
        return {
            exercise: ex,
            lastWeight: lastEntry ? lastEntry.weight : 0,
            pr: pr,
            data: data
        };
    }).sort((a, b) => b.data[0].date.localeCompare(a.data[0].date));
    
    exercisesEl.innerHTML = '';
    exercisesWithData.forEach(item => {
        const div = document.createElement('div');
        div.className = 'exercise';
        div.innerHTML = `
            <div>
                <strong>${item.exercise}</strong>
                <div class="meta">Último: ${item.lastWeight} kg | PR: ${item.pr} kg</div>
            </div>
            <div style="display:flex;gap:6px">
                <button class="small" onclick="openHistory('${item.exercise}')">Historial</button>
                <button class="small ghost" onclick="prefillForm('${item.exercise}', ${item.lastWeight}, ${item.data.at(-1)?.reps}, ${item.data.at(-1)?.rpe})">Cargar</button>
            </div>
        `;
        exercisesEl.appendChild(div);
    });
    
    // update chart exercise select
    chartExerciseEl.innerHTML = uniqueExercises.map(ex => `<option value="${ex}">${ex}</option>`).join('');
    // select first item if available
    if(uniqueExercises.length > 0){
        chartExerciseEl.value = chartExerciseEl.dataset.selected || uniqueExercises[0];
    }
}

function prefillForm(exercise, weight, reps, rpe){
    document.getElementById('exerciseInput').value = exercise;
    document.getElementById('weightInput').value = weight;
    document.getElementById('repsInput').value = reps;
    document.getElementById('rpeInput').value = rpe;
    syncWeightFromInput();
    window.scrollTo({top:0, behavior:'smooth'});
    toast('Formulario precargado');
}

function renderStats(){
    const filteredEntries = filterAndSortEntries();
    const statsEl = document.getElementById('quickStats');
    statsEl.innerHTML = '';
    const uniqueExercises = new Set(filteredEntries.map(e => e.exercise)).size;
    const totalEntries = filteredEntries.length;
    const totalVolume = filteredEntries.reduce((sum, e) => sum + (e.weight * e.reps), 0);
    const avgRpe = totalEntries > 0 ? (filteredEntries.reduce((sum, e) => sum + e.rpe, 0) / totalEntries).toFixed(1) : 0;
    
    statsEl.innerHTML = `
        <div class="stat"><strong>${uniqueExercises}</strong><div class="meta">Ejercicios</div></div>
        <div class="stat"><strong>${totalEntries}</strong><div class="meta">Series</div></div>
        <div class="stat"><strong>${totalVolume.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kg</strong><div class="meta">Volumen</div></div>
        <div class="stat"><strong>${avgRpe}</strong><div class="meta">RPE promedio</div></div>
    `;
}

function openHistory(exercise){
    const historyData = state.entries
        .filter(e => e.exercise === exercise)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    historyTitle.textContent = `Historial de ${exercise}`;
    historyList.innerHTML = '';
    
    historyData.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.id = entry.id;
        item.innerHTML = `
            <div class="info">
                <div><strong>${entry.weight} kg x ${entry.reps} reps</strong> @ ${entry.rpe} RPE</div>
                <div class="muted-small">${entry.date} ${entry.note ? '| ' + entry.note : ''}</div>
            </div>
            <div class="history-actions">
                <button class="ghost small delete-entry" data-id="${entry.id}">Eliminar</button>
                <button class="ghost small edit-entry" data-id="${entry.id}">Editar</button>
            </div>
        `;
        historyList.appendChild(item);
    });

    historyModal.style.display = 'flex';
}

function filterAndSortEntries(){
    let filtered = [...state.entries];
    const viewMode = viewModeEl.value;
    const selectedFilter = filterWeekEl.value;
    
    if(selectedFilter && selectedFilter !== 'all'){
        if(viewMode === 'weekly'){
            filtered = filtered.filter(e => getWeekKey(e.date) === selectedFilter);
        } else { // monthly
            filtered = filtered.filter(e => getMonthKey(e.date) === selectedFilter);
        }
    }
    
    return filtered.sort((a,b) => new Date(b.date) - new Date(a.date));
}

// History modal events
historyModal.addEventListener('click', e => {
    if(e.target.id === 'closeHistoryModal' || e.target.id === 'closeHistoryBtn' || e.target.classList.contains('modal-overlay')) {
        historyModal.style.display = 'none';
        render(); // Re-render to update the list if needed
    }
    if(e.target.classList.contains('delete-entry')) {
        const id = e.target.dataset.id;
        state.entries = state.entries.filter(entry => entry.id !== id);
        saveAll(state);
        openHistory(historyTitle.textContent.replace('Historial de ', ''));
        toast('Entrada eliminada', 'error');
        if (currentUser) {
            syncDataToCloud();
        }
    }
    if(e.target.classList.contains('edit-entry')) {
        // Simple edit logic - can be expanded
        const id = e.target.dataset.id;
        const entry = state.entries.find(e => e.id === id);
        if (entry) {
            const newWeight = prompt(`Editar peso (kg):`, entry.weight);
            if(newWeight !== null && !isNaN(parseFloat(newWeight))){
                entry.weight = parseFloat(newWeight);
                saveAll(state);
                openHistory(historyTitle.textContent.replace('Historial de ', ''));
                toast('Entrada editada');
                if (currentUser) {
                    syncDataToCloud();
                }
            }
        }
    }
});


// Filtering logic
function populateFilters(){
    const uniqueDates = [...new Set(state.entries.map(e => e.date))];
    const uniqueWeeks = [...new Set(uniqueDates.map(date => getWeekKey(date)))];
    const uniqueMonths = [...new Set(uniqueDates.map(date => getMonthKey(date)))];
    
    const viewMode = viewModeEl.value;
    const filterSelect = document.getElementById('filterWeek');
    filterSelect.innerHTML = `<option value="all">Todo</option>`;
    
    const filters = viewMode === 'weekly' ? uniqueWeeks : uniqueMonths;
    filters.sort().reverse().forEach(f => {
        const option = document.createElement('option');
        option.value = f;
        option.textContent = f;
        filterSelect.appendChild(option);
    });
}
filterWeekEl.addEventListener('change', render);
viewModeEl.addEventListener('change', ()=>{
    populateFilters();
    render();
});

// ---------- Chart ----------
function linearTrend(data){
    const n = data.length;
    if(n < 2) return {slope:0, rSquared:0};
    const x = data.map((_, i) => i);
    const y = data.map(d => d.weight * d.reps);
    
    const sumX = x.reduce((a,b)=>a+b,0);
    const sumY = y.reduce((a,b)=>a+b,0);
    const sumXY = x.reduce((s, val, i)=>s + val*y[i],0);
    const sumX2 = x.reduce((s, val)=>s+val*val,0);
    
    const slope = (n*sumXY-sumX*sumY) / (n*sumX2-sumX*sumX);
    
    const meanY = sumY / n;
    const sst = y.reduce((s,val)=>s+Math.pow(val-meanY,2),0);
    const ssr = y.reduce((s,val,i)=>s+Math.pow(slope*x[i]-y[i],2),0); // Simplified SSR calc, could be improved
    const rSquared = 1 - (ssr/sst);
    
    return {slope, rSquared};
}

function updateChart(){
    if(!progressChart) return;
    const exercise = chartExerciseEl.value;
    chartExerciseEl.dataset.selected = exercise;
    const data = state.entries.filter(e => e.exercise === exercise);
    const sortedData = data.sort((a,b) => new Date(a.date) - new Date(b.date));
    
    const labels = sortedData.map(e => e.date);
    const weights = sortedData.map(e => e.weight);
    
    const trendData = linearTrend(sortedData);
    const trendLine = sortedData.map((d, i) => d.weight + (i * trendData.slope));

    // Get goal if exists
    const goal = state.goals.find(g => g.exercise === exercise);
    const goalData = goal ? sortedData.map(() => goal.target) : [];

    if(progressChart) progressChart.destroy();
    progressChart = new Chart(progressChartCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Peso (kg)',
                    data: weights,
                    borderColor: 'rgba(15, 59, 102, 1)',
                    backgroundColor: 'rgba(15, 59, 102, 0.2)',
                    fill: 'start',
                    tension: 0.3,
                    pointRadius: 4,
                },
                {
                    label: 'Tendencia',
                    data: trendLine,
                    borderColor: 'rgba(15, 59, 102, 0.4)',
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    tension: 0.4,
                },
                ...(goal ? [{
                    label: `Meta (${goal.target} kg)`,
                    data: goalData,
                    borderColor: 'rgba(107, 191, 127, 0.6)',
                    borderDash: [8, 4],
                    pointStyle: false,
                    fill: false,
                }] : []),
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: 'var(--muted)' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: 'var(--muted)' }
                }
            },
            plugins: {
                legend: { labels: { color: 'var(--text)' } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw} kg`;
                        }
                    }
                }
            }
        }
    });

    const trendPercEl = document.getElementById('trendPerc');
    const isIncreasing = trendData.slope > 0;
    const change = Math.abs(trendData.slope * 100).toFixed(2);
    const confidence = (trendData.rSquared * 100).toFixed(0);
    
    trendPercEl.textContent = trendData.slope !== 0 ? `Tendencia de progreso: ${isIncreasing ? '+' : '-'}${change}% por serie.` : 'No hay suficiente data para ver tendencia.';
}

chartExerciseEl.addEventListener('change', updateChart);
document.getElementById('downloadChart').addEventListener('click', ()=>{
    const link = document.createElement('a');
    link.download = 'progreso.png';
    link.href = document.getElementById('progressChart').toDataURL('image/png', 1.0);
    link.click();
});

// ---------- Theme toggle ----------
themeToggle.addEventListener('click', ()=>{
    if(appRoot.classList.contains('light-theme')){
        appRoot.classList.remove('light-theme');
        themeToggle.textContent = 'Modo Claro';
        localStorage.setItem('theme', 'dark');
    } else {
        appRoot.classList.add('light-theme');
        themeToggle.textContent = 'Modo Oscuro';
        localStorage.setItem('theme', 'light');
    }
});

// Initial theme load
if(localStorage.getItem('theme') === 'light'){
    appRoot.classList.add('light-theme');
    themeToggle.textContent = 'Modo Oscuro';
}

// Initial render
populateFilters();
render();


// --- PWA, Firebase, etc. ---
document.addEventListener('DOMContentLoaded', () => {
    // PWA setup
    (function(){
        try{
            const manifest = {
                name: "GymPro",
                short_name: "GymPro",
                description: "Registro de Gimnasio Profesional",
                lang: "es",
                display: "standalone",
                start_url: "/",
                background_color: "#041526",
                theme_color: "#0f3b66",
                icons: [
                    { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
                    { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" }
                ]
            };
            const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('link');
            link.rel = 'manifest';
            link.href = url;
            document.head.appendChild(link);

            if('serviceWorker' in navigator){
                const swSource = `
                const CACHE = 'gimpro-v1';
                const ASSETS = ['/', '/index.html', '/style.css', '/app.js', 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js', 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js', 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js'];
                self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{}))); });
                self.addEventListener('activate', e => e.waitUntil(clients.claim()));
                self.addEventListener('fetch', e => { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).catch(()=>r))); });
                `;
                const swBlob = new Blob([swSource], { type: 'application/javascript' });
                const swUrl = URL.createObjectURL(swBlob);
                navigator.serviceWorker.register(swUrl).then(()=> console.log('SW registrado')).catch(err=>console.warn('SW error',err));
            }
        }catch(e){ console.warn('PWA setup failed',e) }
    })();
});


// Firebase auth
if (isCloudEnabled) {
    firebaseAuth.onAuthStateChanged(user => {
        currentUser = user;
        updateUIForUser();
        if (user) {
            fetchDataFromCloud();
        } else {
            // No user, nothing to do
        }
    });

    const updateUIForUser = () => {
        if (currentUser) {
            signBtn.style.display = 'none';
            logoutBtn.style.display = 'inline';
            syncBtn.style.display = 'inline';
            welcomeTitle.textContent = `Bienvenido, ${currentUser.displayName || 'atleta'}!`;
        } else {
            signBtn.style.display = 'inline';
            logoutBtn.style.display = 'none';
            syncBtn.style.display = 'none';
            welcomeTitle.textContent = 'Registro de Gimnasio — Pro';
        }
    };
    
    // Auth Modal
    signBtn.addEventListener('click', () => {
        authModal.style.display = 'flex';
    });
    closeAuthModalBtn.addEventListener('click', () => {
        authModal.style.display = 'none';
    });
    switchToRegisterBtn.addEventListener('click', () => {
        authLoginView.style.display = 'none';
        authRegisterView.style.display = 'block';
    });
    switchToLoginBtn.addEventListener('click', () => {
        authLoginView.style.display = 'block';
        authRegisterView.style.display = 'none';
    });
    
    // Auth Forms
    loginForm.addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        firebaseAuth.signInWithEmailAndPassword(email, password)
            .then(() => {
                toast('Sesión iniciada correctamente');
                authModal.style.display = 'none';
            })
            .catch(error => {
                toast(`Error al iniciar sesión: ${error.message}`, 'error');
            });
    });

    registerForm.addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const username = document.getElementById('registerUsername').value;
        const age = document.getElementById('registerAge').value;
        const weight = document.getElementById('registerWeight').value;
        const height = document.getElementById('registerHeight').value;

        firebaseAuth.createUserWithEmailAndPassword(email, password)
            .then(userCredential => {
                const user = userCredential.user;
                // Update user profile
                return user.updateProfile({ displayName: username })
                    .then(() => {
                        // Save extra user info to database
                        const dbRef = firebaseDB.ref(`users/${user.uid}/profile`);
                        return dbRef.set({ username, age, weight, height });
                    });
            })
            .then(() => {
                toast('Cuenta creada y sesión iniciada');
                authModal.style.display = 'none';
            })
            .catch(error => {
                toast(`Error al registrarse: ${error.message}`, 'error');
            });
    });

    logoutBtn.addEventListener('click', () => {
        firebaseAuth.signOut().then(() => {
            toast('Sesión cerrada');
            currentUser = null;
            updateUIForUser();
            state.entries = [];
            state.goals = [];
            saveAll(state);
            render();
        }).catch(error => {
            toast(`Error al cerrar sesión: ${error.message}`, 'error');
        });
    });
    
    syncBtn.addEventListener('click', syncDataToCloud);

    // Sync data functions
    function syncDataToCloud() {
        if (!currentUser) {
            toast('Inicia sesión para sincronizar', 'error');
            return;
        }
        const userRef = firebaseDB.ref(`users/${currentUser.uid}/data`);
        userRef.set({ entries: state.entries, goals: state.goals })
            .then(() => toast('Datos sincronizados con la nube'))
            .catch(error => toast(`Error de sincronización: ${error.message}`, 'error'));
    }

    function fetchDataFromCloud() {
        if (!currentUser) return;
        const userRef = firebaseDB.ref(`users/${currentUser.uid}/data`);
        userRef.once('value').then(snapshot => {
            const cloudData = snapshot.val();
            if (cloudData) {
                // Simple merge strategy: prefer cloud data
                state.entries = cloudData.entries || [];
                state.goals = cloudData.goals || [];
                saveAll(state);
                render();
                toast('Datos cargados desde la nube');
            } else {
                // If no cloud data, sync local data to cloud for the first time
                syncDataToCloud();
            }
        }).catch(error => toast(`Error al cargar datos: ${error.message}`, 'error'));
    }

}