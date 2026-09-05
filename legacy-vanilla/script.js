const API_BASE_URL = 'http://127.0.0.1:8000/api';
let currentAdminTab = 'pending';
let currentUser = null;
let currentToken = localStorage.getItem('upliftToken');

// --- INITIALIZATION & AUTH ---
async function initApp() {
    initDisabilityChecklist();
    applyA11y();
    if (currentToken) {
        await fetchUser();
    } else {
        showLanding();
    }
}

async function fetchUser() {
    try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (res.ok) {
            currentUser = await res.json();
            updateSharedNav();
            handleAuthSuccess();
        } else {
            logout();
        }
    } catch (e) {
        console.error("Auth check failed", e);
        showLanding();
    }
}

function handleAuthSuccess() {
    // Setup Navigation based on role
    const pathname = window.location.pathname;
    
    if (currentUser.role === 'user') {
        if(pathname.endsWith('index.html') || pathname === '/' || pathname.endsWith('/')) {
            window.location.href = 'dashboard.html';
        }
    } else if (currentUser.role === 'employer') {
        if(pathname.endsWith('index.html') || pathname === '/' || pathname.endsWith('/')) {
            window.location.href = 'employer.html';
        }
    } else if (currentUser.role === 'admin') {
        if(pathname.endsWith('index.html') || pathname === '/' || pathname.endsWith('/')) {
            window.location.href = 'admin.html';
        }
    }
}

function updateSharedNav() {
    if(!currentUser) return;
    const authBtns = document.getElementById('auth-buttons');
    if(authBtns) authBtns.classList.add('hidden');
    
    const userMenu = document.getElementById('user-menu');
    if(userMenu) userMenu.classList.remove('hidden');
    
    const navInit = document.getElementById('nav-user-initials');
    if(navInit) navInit.innerText = currentUser.name.charAt(0).toUpperCase();
    
    const navName = document.getElementById('nav-user-name');
    if(navName) navName.innerText = currentUser.name;
    
    const dropName = document.getElementById('dropdown-name');
    if(dropName) dropName.innerText = currentUser.name;
    
    const dropEmail = document.getElementById('dropdown-email');
    if(dropEmail) dropEmail.innerText = currentUser.email;
    
    const fnameEl = document.getElementById('dashboard-first-name');
    if (fnameEl) fnameEl.innerText = currentUser.name.split(" ")[0];

    // Profile Sidebar if it exists
    const sideName = document.getElementById('sidebar-name');
    if(sideName) sideName.innerText = currentUser.name;
    const sideEmail = document.getElementById('sidebar-email');
    if(sideEmail) sideEmail.innerText = currentUser.email;
    const sideInit = document.getElementById('sidebar-initials');
    if(sideInit) sideInit.innerText = currentUser.name.charAt(0).toUpperCase();

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.add('hidden'));
    
    if (currentUser.role === 'user') {
        const pBtn = document.getElementById('nav-pwd-dashboard-view');
        if(pBtn) pBtn.classList.remove('hidden');
        loadProfileLocally();
    } else if (currentUser.role === 'employer') {
        const eBtn = document.getElementById('nav-employer-view');
        if(eBtn) eBtn.classList.remove('hidden');
    } else if (currentUser.role === 'admin') {
        const aBtn = document.getElementById('nav-admin-view');
        if(aBtn) aBtn.classList.remove('hidden');
    }
}

function logout() {
    currentToken = null;
    currentUser = null;
    localStorage.removeItem('upliftToken');
    document.getElementById('auth-buttons').classList.remove('hidden');
    document.getElementById('user-menu').classList.add('hidden');
    document.getElementById('profile-dropdown').classList.add('hidden');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.add('hidden'));
    showLanding();
}

function showLanding() {
    const pathname = window.location.pathname;
    if(!pathname.endsWith('index.html') && pathname !== '/' && !pathname.endsWith('/')) {
        window.location.href = 'index.html';
    }
}

// --- MODALS & NAVIGATION ---
function openModal(id) {
    const modal = document.getElementById(id);
    const content = document.getElementById(id + '-content');
    modal.classList.remove('hidden');
    // small delay for transition
    setTimeout(() => {
        modal.classList.add('modal-open');
        if(content) content.classList.add('modal-content-open');
    }, 10);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    const content = document.getElementById(id + '-content');
    modal.classList.remove('modal-open');
    if(content) content.classList.remove('modal-content-open');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function toggleDropdown(id) {
    const el = document.getElementById(id);
    el.classList.toggle('hidden');
}

// Removed switchView and switchTab logic as we are using MPA architecture
function switchProfileTab(tabId) {
    document.querySelectorAll('.profile-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.profile-tab').forEach(el => {
        el.classList.remove('active', 'bg-blue-600', 'text-white', 'shadow-sm');
        el.classList.add('text-slate-500', 'hover:bg-slate-50', 'border-transparent');
    });
    
    const target = document.getElementById(tabId);
    if(target) target.classList.remove('hidden');
    
    const btn = document.getElementById(`btn-${tabId}`);
    if(btn) {
        btn.classList.remove('text-slate-500', 'hover:bg-slate-50', 'border-transparent');
        btn.classList.add('active', 'bg-blue-600', 'text-white', 'shadow-sm');
    }
}

// --- AUTH API LOGIC ---
async function handleLogin(e) {
    e.preventDefault();
    const payload = {
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
    };
    try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (res.ok) {
            const data = await res.json();
            currentToken = data.token;
            localStorage.setItem('upliftToken', currentToken);
            currentUser = data.user;
            closeModal('login-modal');
            showToast('Logged in successfully!');
            await fetchUser(); // fetches user and redirects based on role
            handleAuthSuccess();
        } else {
            const err = await res.json();
            showToast(err.detail || 'Login failed', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const payload = {
        name: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
        role: document.getElementById('reg-role').value
    };
    try {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (res.ok) {
            closeModal('register-modal');
            showToast('Account created! Please log in.');
            openModal('login-modal');
            document.getElementById('login-email').value = payload.email;
        } else {
            const err = await res.json();
            showToast(err.detail || 'Registration failed', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
}

// --- PWD PROFILE LOGIC ---
function saveProfileLocally() {
    const selected = updateSelectedSummary();
    const skills = document.getElementById('pwd-skills') ? document.getElementById('pwd-skills').value : '';
    const capabilities = document.getElementById('pwd-capabilities') ? document.getElementById('pwd-capabilities').value : '';
    const profile = {
        skills: skills,
        capabilities: capabilities,
        disabilities: selected
    };
    localStorage.setItem('upliftPwdProfile', JSON.stringify(profile));
    
    const modal = document.getElementById('profile-modal');
    if(modal) {
        showToast('Profile saved successfully!');
        closeModal('profile-modal');
    }
}

function fillSearch(query) {
    const input = document.getElementById('semantic-search-input');
    input.value = query;
    input.focus();
}

function loadProfileLocally() {
    const profileStr = localStorage.getItem('upliftPwdProfile');
    if (profileStr) {
        const profile = JSON.parse(profileStr);
        const sk = document.getElementById('pwd-skills');
        if(sk) sk.value = profile.skills || '';
        
        const cap = document.getElementById('pwd-capabilities');
        if(cap) cap.value = profile.capabilities || '';
        
        if (profile.disabilities) {
            profile.disabilities.forEach(d => {
                const cb = document.getElementById(`cb-${d.category}-${d.sub}`);
                if (cb) cb.checked = true;
                const content = document.getElementById(`content-${d.category}`);
                if (content && !content.classList.contains('open')) {
                    toggleCategory(d.category);
                }
            });
            updateSelectedSummary();
        }
    }
}

async function triggerMatch() {
    if (!currentUser) return;
    
    const query = document.getElementById('semantic-search-input').value.trim();
    const useProfile = document.getElementById('use-profile-context').checked;
    
    let selected = [];
    let capabilities = "";
    let skills = "";
    
    if (useProfile) {
        selected = updateSelectedSummary();
        capabilities = document.getElementById('pwd-capabilities').value;
        skills = document.getElementById('pwd-skills').value;
    }

    if (!query && selected.length === 0) {
        showToast('Please enter a search query or enable your profile context!', 'error');
        return;
    }

    const payload = {
        name: currentUser.name,
        search_query: query,
        disability_types: selected.map(d => `${d.category} - ${d.sub}`),
        physical_capabilities: capabilities,
        skills: skills,
        weight_skill: parseFloat(document.getElementById('weight-skill').value) || 0.40,
        weight_semantic: parseFloat(document.getElementById('weight-semantic').value) || 0.40,
        weight_stamina: parseFloat(document.getElementById('weight-stamina').value) || 0.20
    };

    // Show Analyzing Modal flow
    const modal = document.getElementById('analyzing-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('opacity-100'), 10);
    
    document.getElementById('step-2').classList.add('opacity-50');
    document.getElementById('step-3').classList.add('opacity-30');
    
    setTimeout(() => {
        document.getElementById('step-2').classList.remove('opacity-50');
    }, 1500);
    
    setTimeout(() => {
        document.getElementById('step-3').classList.remove('opacity-30');
    }, 3000);

    try {
        const res = await fetch(`${API_BASE_URL}/pwd/match`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, 
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        setTimeout(() => {
            modal.classList.remove('opacity-100');
            setTimeout(() => modal.classList.add('hidden'), 300);
            renderMatches(data);
        }, 4000); // Simulate processing time for UX
        
    } catch(e) {
        modal.classList.add('hidden');
        showToast('Match engine error', 'error');
    }
}

function renderMatches(data) {
    const container = document.getElementById('matches-list');
    
    document.getElementById('example-queries-section').classList.add('hidden');
    document.getElementById('semantic-matches-section').classList.remove('hidden');
    
    if(data.total_safe_matches === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-400 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                                    <i class="fa-solid fa-triangle-exclamation text-4xl text-amber-500 mb-3"></i>
                                    <p>No safe matches found above 40%.</p>
                                    <p class="text-xs mt-2 text-slate-400">Try adjusting your query or profile.</p>
                               </div>`;
        return;
    }

    container.innerHTML = data.matches.map((match, idx) => {
        const overallScore = match.metrics.final_accessibility_percentage;
        const safetyClass = overallScore >= 80 ? 'safety-badge-high' : overallScore >= 50 ? 'safety-badge-med' : 'safety-badge-low';
        const safetyIcon = overallScore >= 80 ? 'fa-shield-check' : overallScore >= 50 ? 'fa-shield-halved' : 'fa-triangle-exclamation';
        const safetyLabel = overallScore >= 80 ? 'Recommended' : overallScore >= 50 ? 'Moderate Safety' : 'Warning: Review Required';
        
        return `
        <div class="match-card rounded-2xl p-6 mb-4 animate-in slide-in-from-bottom duration-500" style="animation-delay: ${idx * 100}ms">
            <div class="flex flex-col md:flex-row justify-between gap-6">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${safetyClass} flex items-center gap-1 ${overallScore < 50 ? 'animate-pulse' : ''}">
                            <i class="fa-solid ${safetyIcon}"></i> ${safetyLabel}
                        </span>
                        <span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">• ${match.employer_type}</span>
                    </div>
                    <h3 class="text-xl font-black text-slate-900 mb-1 leading-tight">${match.job_title}</h3>
                    <p class="text-sm font-bold text-blue-600 mb-3">${match.employer}</p>
                    
                    <div class="flex items-center gap-4 text-[11px] text-slate-500 font-medium">
                        <span><i class="fa-solid fa-location-dot mr-1"></i> ${match.location}</span>
                        <span><i class="fa-solid fa-clock mr-1"></i> ${match.job_type}</span>
                        <span><i class="fa-solid fa-money-bill-wave mr-1 text-emerald-500"></i> ₱${match.salary_range}</span>
                    </div>
                </div>

                <div class="flex items-center gap-6">
                    <div class="text-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Suitability</p>
                        <p class="text-2xl font-black ${match.metrics.final_accessibility_percentage >= 80 ? 'text-emerald-600' : 'text-blue-600'}">${Math.round(match.metrics.final_accessibility_percentage)}%</p>
                    </div>
                    <button onclick="toggleMatchDetails('match-${match.job_id}', this)" class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all transform active:scale-95 group" title="Toggle Detailed Report">
                        <i class="fa-solid fa-chevron-down transition-transform"></i>
                    </button>
                </div>
            </div>

            <!-- AI MATCH TEASER (Low Cognitive Load) -->
            <div class="mt-4 pt-4 border-t border-slate-100">
                <div class="mb-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                    <div class="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                        <span class="w-16">Skill</span>
                        <div class="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div class="bg-blue-500 h-full rounded-full transition-all duration-1000" style="width: ${match.metrics.skill_score}%"></div>
                        </div>
                        <span class="w-8 text-right text-blue-600">${match.metrics.skill_score.toFixed(0)}%</span>
                    </div>
                    <div class="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                        <span class="w-16">Safety</span>
                        <div class="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div class="bg-indigo-500 h-full rounded-full transition-all duration-1000" style="width: ${match.metrics.safety_score}%"></div>
                        </div>
                        <span class="w-8 text-right text-indigo-600">${match.metrics.safety_score.toFixed(0)}%</span>
                    </div>
                    <div class="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                        <span class="w-16">Stamina</span>
                        <div class="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div class="bg-emerald-500 h-full rounded-full transition-all duration-1000" style="width: ${match.metrics.stamina_score}%"></div>
                        </div>
                        <span class="w-8 text-right text-emerald-600">${match.metrics.stamina_score.toFixed(0)}%</span>
                    </div>
                </div>

                <div class="flex items-center justify-between">
                    <p class="text-xs text-slate-600 italic leading-relaxed flex-1">
                        <i class="fa-solid fa-robot mr-2 text-blue-400"></i>
                        ${(match.ai_insights[0] || 'Analyzing your fit...').split('.')[0]}.
                    </p>
                    <button onclick="showToast('Application sent to ${match.employer}!')" class="ml-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2">
                        Apply Now
                    </button>
                </div>
            </div>

            <!-- PROGRESSIVE DISCLOSURE CONTENT -->
            <div id="match-${match.job_id}" class="disclosure-content">
                <div class="disclosure-inner space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                            <p class="text-[9px] font-black text-emerald-800 uppercase mb-2">Operational Strengths</p>
                            <ul class="text-[11px] text-emerald-700 space-y-1.5">
                                ${(match.strengths || []).map(s => `<li><i class="fa-solid fa-check-circle mr-2 opacity-70"></i> ${s}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="p-3 bg-red-50 rounded-xl border border-red-100">
                            <p class="text-[9px] font-black text-red-800 uppercase mb-2">Identified Barriers</p>
                            <ul class="text-[11px] text-red-700 space-y-1.5">
                                ${(match.barriers || []).map(b => `<li><i class="fa-solid fa-circle-exclamation mr-2 opacity-70"></i> ${b}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="p-3 bg-blue-50 rounded-xl border border-blue-100">
                            <p class="text-[9px] font-black text-blue-800 uppercase mb-2">Job Benefits</p>
                            <div class="flex flex-wrap gap-1.5">
                                ${(match.benefits || '').split(',').filter(b => b.trim()).map(b => `
                                    <span class="px-2 py-1 bg-white rounded-lg text-[10px] font-bold text-blue-700 border border-blue-100">${b.trim()}</span>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <div class="bg-slate-900 rounded-2xl p-5 text-white shadow-xl">
                        <div class="flex items-center gap-2 mb-4 opacity-80">
                            <i class="fa-solid fa-file-medical text-blue-400"></i>
                            <span class="text-[10px] font-bold uppercase tracking-widest">Expert Suitability Report</span>
                        </div>
                        <div class="space-y-4">
                            ${(match.ai_insights || []).map((insight, i) => `
                                <div class="flex gap-4">
                                    <span class="text-blue-400 font-black text-sm">0${i+1}</span>
                                    <p class="text-xs leading-relaxed text-slate-300 font-medium">${insight}</p>
                                </div>
                            `).join('')}
                        </div>
                        <div class="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center text-[9px] opacity-50 font-mono">
                            <span>REF: UPLIFT-${match.job_id.substring(0,8)}</span>
                            <span>VERIFIED SAFE WORKPLACE</span>
                        </div>
                    </div>
                    
                    <div class="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Environmental Summary</p>
                        <p class="text-xs text-slate-600 leading-relaxed">${match.physical_requirements}</p>
                    </div>

                    <div class="flex flex-wrap gap-2 pt-2">
                        <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest self-center mr-2">Skill Alignment:</span>
                        ${(match.matched_skills || []).map(s => `<span class="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-200">${s}</span>`).join('')}
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function toggleMatchDetails(id, btn) {
    const content = document.getElementById(id);
    const icon = btn.querySelector('i');
    content.classList.toggle('open');
    icon.classList.toggle('rotate-180');
}


// --- REUSABLE UTILS ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-emerald-600' : 'bg-red-600';
    toast.className = `${bgColor} text-white px-4 py-3 rounded-lg shadow-lg transform transition-all translate-y-10 opacity-0`;
    toast.innerHTML = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 10);
    setTimeout(() => { toast.classList.add('translate-y-10', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, 4000);
}

// --- DISABILITY CHECKLIST LOGIC ---
const SUB_CATEGORIES = {
    'Physical': ['Wheelchair User', 'Amputee', 'Cerebral Palsy', 'Muscular Dystrophy', 'Chronic Pain', 'Other'],
    'Visual': ['Total Blindness', 'Low Vision', 'Color Blindness', 'Other'],
    'Hearing': ['Profoundly Deaf', 'Hard of Hearing', 'Auditory Processing', 'Other'],
    'Learning': ['Autism (ASD)', 'ADHD', 'Dyslexia', 'Dysgraphia', 'Other'],
    'Intellectual': ['Down Syndrome', 'Developmental Delay', 'Other'],
    'Psychosocial': ['Bipolar Disorder', 'Depression', 'Anxiety Disorder', 'PTSD', 'Schizophrenia', 'Other'],
    'Chronic_Illness': ['Cancer Patient/Survivor', 'Rare Disease', 'Speech Impairment', 'Chronic Respiratory', 'Other']
};

function initDisabilityChecklist() {
    const container = document.getElementById('disability-checklist');
    container.innerHTML = Object.keys(SUB_CATEGORIES).map(cat => `
        <div class="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <button type="button" 
                    id="btn-${cat}"
                    onclick="toggleCategory('${cat}')" 
                    aria-expanded="false"
                    aria-controls="content-${cat}"
                    class="w-full flex items-center justify-between p-2 hover:bg-slate-50 transition-all text-left">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center text-blue-600 text-xs">
                        <i class="fa-solid ${getCategoryIcon(cat)}"></i>
                    </div>
                    <span class="text-xs font-bold text-slate-700">${cat.replace('_', ' ')}</span>
                </div>
                <i id="icon-${cat}" class="fa-solid fa-chevron-down text-slate-300 text-[10px] transition-transform duration-300"></i>
            </button>
            <div id="content-${cat}" 
                    role="region"
                    aria-labelledby="btn-${cat}"
                    class="disclosure-content">
                <div class="disclosure-inner p-2 pt-0 grid grid-cols-1 gap-2">
                    ${SUB_CATEGORIES[cat].map(sub => `
                        <div class="flex items-center gap-3 p-1.5 rounded-lg hover:bg-slate-50 transition-colors group">
                            <div class="relative flex items-center h-4">
                                <input type="checkbox" 
                                        id="cb-${cat}-${sub}" 
                                        data-category="${cat}"
                                        data-sub="${sub}"
                                        onchange="updateSelectedSummary()"
                                        class="disability-checkbox w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer checkbox-bounce">
                            </div>
                            <label for="cb-${cat}-${sub}" class="text-[10px] font-medium text-slate-600 cursor-pointer group-hover:text-slate-900 transition-colors">
                                ${sub}
                            </label>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

function toggleCategory(cat) {
    const content = document.getElementById(`content-${cat}`);
    const icon = document.getElementById(`icon-${cat}`);
    const btn = document.getElementById(`btn-${cat}`);
    
    const isOpen = content.classList.contains('open');
    
    document.querySelectorAll('.disclosure-content').forEach(el => el.classList.remove('open'));
    document.querySelectorAll('[id^="icon-"]').forEach(el => el.classList.remove('rotate-180'));
    document.querySelectorAll('[aria-expanded]').forEach(el => el.setAttribute('aria-expanded', 'false'));
    
    if (!isOpen) {
        content.classList.add('open');
        icon.classList.add('rotate-180');
        btn.setAttribute('aria-expanded', 'true');
    }
}

function getCategoryIcon(cat) {
    const icons = {
        'Physical': 'fa-wheelchair', 'Visual': 'fa-eye', 'Hearing': 'fa-ear-listen',
        'Learning': 'fa-brain', 'Intellectual': 'fa-user-gear', 'Psychosocial': 'fa-heart-pulse',
        'Chronic_Illness': 'fa-stethoscope'
    };
    return icons[cat] || 'fa-notes-medical';
}

function updateSelectedSummary() {
    const container = document.getElementById('selected-summary');
    const checkboxes = document.querySelectorAll('.disability-checkbox:checked');
    
    if (checkboxes.length === 0) {
        container.innerHTML = '<span class="text-xs text-slate-400 italic self-center">No selection made yet</span>';
        return [];
    }

    const checked = Array.from(checkboxes).map(cb => ({ category: cb.dataset.category, sub: cb.dataset.sub }));

    container.innerHTML = checked.map(d => `
        <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold border border-blue-200 badge-pop flex items-center gap-1">
            ${d.category}: ${d.sub}
            <button type="button" onclick="document.getElementById('cb-${d.category}-${d.sub}').click()" class="ml-1 hover:text-blue-900"><i class="fa-solid fa-xmark"></i></button>
        </span>
    `).join('');
    
    return checked;
}

// --- ACCESSIBILITY LOGIC ---
let a11yConfig = JSON.parse(localStorage.getItem('upliftA11y')) || {
    theme: 'default', fontScale: 1.0, dyslexiaFont: false, readingGuide: false, largeCursor: false
};

function toggleA11yPanel() {
    const panel = document.getElementById('accessibility-panel');
    if(panel.innerHTML === '') renderA11yPanel();
    panel.classList.toggle('open');
}

function renderA11yPanel() {
    document.getElementById('accessibility-panel').innerHTML = `
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold flex items-center gap-2"><i class="fa-solid fa-sliders text-blue-600"></i> Accessibility Suite</h2>
            <button onclick="toggleA11yPanel()" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="mb-6">
            <p class="text-[10px] font-bold uppercase tracking-widest mb-3 opacity-60 text-slate-500">Visual Theme</p>
            <div class="grid grid-cols-2 gap-2">
                <button onclick="setTheme('default')" id="theme-default" class="a11y-option-card active flex flex-col items-center gap-1"><i class="fa-solid fa-sun"></i><span class="text-[10px] font-bold">Default</span></button>
                <button onclick="setTheme('dark')" id="theme-dark" class="a11y-option-card flex flex-col items-center gap-1"><i class="fa-solid fa-moon"></i><span class="text-[10px] font-bold">Dark Mode</span></button>
                <button onclick="setTheme('high-contrast')" id="theme-high-contrast" class="a11y-option-card flex flex-col items-center gap-1"><i class="fa-solid fa-circle-half-stroke"></i><span class="text-[10px] font-bold">Contrast</span></button>
                <button onclick="setTheme('grayscale')" id="theme-grayscale" class="a11y-option-card flex flex-col items-center gap-1"><i class="fa-solid fa-droplet-slash"></i><span class="text-[10px] font-bold">Grayscale</span></button>
            </div>
        </div>
        <div class="mb-6">
            <p class="text-[10px] font-bold uppercase tracking-widest mb-3 opacity-60 text-slate-500">Font Scaling</p>
            <div class="flex items-center justify-between bg-slate-50 p-2 rounded-xl border">
                <button onclick="changeFontSize(-0.1)" class="w-10 h-10 rounded-lg hover:bg-white flex items-center justify-center font-bold text-lg">-</button>
                <span id="font-size-label" class="text-xs font-bold">100%</span>
                <button onclick="changeFontSize(0.1)" class="w-10 h-10 rounded-lg hover:bg-white flex items-center justify-center font-bold text-lg">+</button>
            </div>
        </div>
        <div class="mb-6">
            <p class="text-[10px] font-bold uppercase tracking-widest mb-3 opacity-60 text-slate-500">Typography</p>
            <button onclick="toggleDyslexiaFont()" id="dyslexia-btn" class="w-full a11y-option-card flex items-center justify-between"><span class="text-xs font-bold">Dyslexia Friendly Font</span><i class="fa-solid fa-font"></i></button>
        </div>
        <div class="mb-6">
            <p class="text-[10px] font-bold uppercase tracking-widest mb-3 opacity-60 text-slate-500">Reading Aids</p>
            <div class="space-y-2">
                <button onclick="toggleReadingGuide()" id="reading-guide-btn" class="w-full a11y-option-card flex items-center justify-between"><span class="text-xs font-bold">Reading Guide Line</span><i class="fa-solid fa-grip-lines"></i></button>
                <button onclick="toggleLargeCursor()" id="large-cursor-btn" class="w-full a11y-option-card flex items-center justify-between"><span class="text-xs font-bold">Large Cursor</span><i class="fa-solid fa-arrow-pointer"></i></button>
            </div>
        </div>
        <div class="mb-6">
            <p class="text-[10px] font-bold uppercase tracking-widest mb-3 opacity-60 text-slate-500">Audio Support (Free)</p>
            <div class="flex gap-2">
                <button onclick="readPageContent()" class="flex-1 bg-emerald-600 text-white p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2"><i class="fa-solid fa-volume-high"></i> Read Page</button>
                <button onclick="stopTTS()" class="bg-red-100 text-red-600 p-3 rounded-xl"><i class="fa-solid fa-stop"></i></button>
            </div>
            <p class="text-[9px] mt-2 text-slate-400 italic">Uses native browser voice engine.</p>
        </div>
        <button onclick="resetA11y()" class="w-full text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors py-2">Reset to Default</button>
    `;
    applyA11yUIState();
}

function setTheme(theme) {
    a11yConfig.theme = theme;
    document.body.classList.remove('high-contrast', 'grayscale-theme', 'dark-mode');
    document.querySelectorAll('.a11y-option-card[id^="theme-"]').forEach(el => el.classList.remove('active'));
    
    if (theme !== 'default') {
        const themeClass = theme === 'high-contrast' ? 'high-contrast' : 
                            theme === 'grayscale' ? 'grayscale-theme' : 'dark-mode';
        document.body.classList.add(themeClass);
    }
    const themeBtn = document.getElementById(`theme-${theme}`);
    if (themeBtn) themeBtn.classList.add('active');
    saveA11y();
}

function changeFontSize(delta) {
    a11yConfig.fontScale = Math.min(Math.max(a11yConfig.fontScale + delta, 0.8), 1.8);
    document.documentElement.style.setProperty('--scale-factor', a11yConfig.fontScale);
    const label = document.getElementById('font-size-label');
    if (label) label.innerText = `${Math.round(a11yConfig.fontScale * 100)}%`;
    saveA11y();
}

function toggleDyslexiaFont() {
    a11yConfig.dyslexiaFont = !a11yConfig.dyslexiaFont;
    document.body.classList.toggle('dyslexia-font', a11yConfig.dyslexiaFont);
    const btn = document.getElementById('dyslexia-btn');
    if (btn) btn.classList.toggle('active', a11yConfig.dyslexiaFont);
    saveA11y();
}

function toggleReadingGuide() {
    a11yConfig.readingGuide = !a11yConfig.readingGuide;
    let guide = document.getElementById('reading-guide');
    if(!guide) {
        guide = document.createElement('div');
        guide.id = 'reading-guide';
        guide.className = 'reading-guide';
        document.body.appendChild(guide);
    }
    guide.style.display = a11yConfig.readingGuide ? 'block' : 'none';
    const btn = document.getElementById('reading-guide-btn');
    if (btn) btn.classList.toggle('active', a11yConfig.readingGuide);
    saveA11y();
}

function toggleLargeCursor() {
    a11yConfig.largeCursor = !a11yConfig.largeCursor;
    document.body.classList.toggle('large-cursor', a11yConfig.largeCursor);
    const btn = document.getElementById('large-cursor-btn');
    if (btn) btn.classList.toggle('active', a11yConfig.largeCursor);
    saveA11y();
}

function saveA11y() { localStorage.setItem('upliftA11y', JSON.stringify(a11yConfig)); }

function applyA11y() {
    setTheme(a11yConfig.theme);
    document.documentElement.style.setProperty('--scale-factor', a11yConfig.fontScale);
    if (a11yConfig.dyslexiaFont) document.body.classList.add('dyslexia-font');
    if (a11yConfig.readingGuide) toggleReadingGuide(); // will create and show it
    else if(document.getElementById('reading-guide')) document.getElementById('reading-guide').style.display = 'none';
    if (a11yConfig.largeCursor) document.body.classList.add('large-cursor');
}

function applyA11yUIState() {
    document.getElementById(`theme-${a11yConfig.theme}`).classList.add('active');
    document.getElementById('font-size-label').innerText = `${Math.round(a11yConfig.fontScale * 100)}%`;
    document.getElementById('dyslexia-btn').classList.toggle('active', a11yConfig.dyslexiaFont);
    document.getElementById('reading-guide-btn').classList.toggle('active', a11yConfig.readingGuide);
    document.getElementById('large-cursor-btn').classList.toggle('active', a11yConfig.largeCursor);
}

function resetA11y() {
    a11yConfig = { theme: 'default', fontScale: 1.0, dyslexiaFont: false, readingGuide: false, largeCursor: false };
    applyA11y();
    applyA11yUIState();
    saveA11y();
}

document.addEventListener('mousemove', (e) => {
    if (a11yConfig.readingGuide) {
        const guide = document.getElementById('reading-guide');
        if (guide) guide.style.top = `${e.clientY}px`;
    }
});

let speechSynth = window.speechSynthesis;
let speechUtterance = null;
function readPageContent() {
    stopTTS();
    const textToRead = document.querySelector('main').innerText;
    speechUtterance = new SpeechSynthesisUtterance(textToRead);
    speechUtterance.rate = 0.9;
    speechSynth.speak(speechUtterance);
}
function stopTTS() { if (speechSynth.speaking) speechSynth.cancel(); }

// Initialize App
window.onload = initApp;