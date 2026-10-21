/**
 * Web Dashboard Frontend Application Logic
 */
let currentUser = null;
let token = localStorage.getItem('token');

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupAuth();
  setupForms();

  if (token) {
    fetchUser();
  } else {
    showAuthModal('login');
  }
});

// --- TABS NAVIGATION ---
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.tab);
      if (target) target.classList.add('active');

      if (tab.dataset.tab === 'tab-overview') loadMetrics();
      if (tab.dataset.tab === 'tab-jobs') loadDiscoveredJobs();
      if (tab.dataset.tab === 'tab-applications') loadApplications();
      if (tab.dataset.tab === 'tab-automation') loadLogs();
    });
  });
}

// --- AUTHENTICATION ---
function setupAuth() {
  const authModal = document.getElementById('authModal');
  const authForm = document.getElementById('authForm');
  const authBtn = document.getElementById('authBtn');
  const toggleLink = document.getElementById('authToggleLink');
  let isRegistering = false;

  authBtn.addEventListener('click', () => {
    if (currentUser) {
      // Logout
      localStorage.removeItem('token');
      currentUser = null;
      token = null;
      document.getElementById('userInfo').textContent = 'Guest';
      authBtn.textContent = 'Login';
      showAuthModal('login');
    } else {
      showAuthModal('login');
    }
  });

  toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isRegistering = !isRegistering;
    showAuthModal(isRegistering ? 'register' : 'login');
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const name = document.getElementById('authName').value;

    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegistering ? { email, password, name } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      token = data.token;
      localStorage.setItem('token', token);
      authModal.style.display = 'none';
      fetchUser();
    } catch (err) {
      alert(err.message);
    }
  });
}

function showAuthModal(mode) {
  const authModal = document.getElementById('authModal');
  const modalTitle = document.getElementById('modalTitle');
  const nameGroup = document.getElementById('nameGroup');
  const submitBtn = document.getElementById('authSubmitBtn');
  const toggleText = document.getElementById('authToggleText');
  const toggleLink = document.getElementById('authToggleLink');

  authModal.style.display = 'flex';
  if (mode === 'register') {
    modalTitle.textContent = 'Create Account';
    nameGroup.style.display = 'block';
    submitBtn.textContent = 'Register';
    toggleText.textContent = 'Already have an account?';
    toggleLink.textContent = 'Login';
  } else {
    modalTitle.textContent = 'Sign In to JobPilot AI';
    nameGroup.style.display = 'none';
    submitBtn.textContent = 'Login';
    toggleText.textContent = 'Need an account?';
    toggleLink.textContent = 'Register';
  }
}

async function fetchUser() {
  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Session expired');
    const data = await res.json();
    currentUser = data.user;

    document.getElementById('userInfo').textContent = currentUser.name;
    document.getElementById('authBtn').textContent = 'Logout';
    document.getElementById('apiKeyDisplay').value = currentUser.engine_api_key;

    loadAllData();
  } catch (err) {
    localStorage.removeItem('token');
    showAuthModal('login');
  }
}

function loadAllData() {
  loadMetrics();
  loadPreferences();
  loadProfile();
  loadAutomationSettings();
  checkEngineStatus();
}

// --- DATA FETCHING ---
async function loadMetrics() {
  try {
    const res = await fetch('/api/analytics', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();

    document.getElementById('metricDiscovered').textContent = data.metrics.discovered;
    document.getElementById('metricMatched').textContent = data.metrics.matched;
    document.getElementById('metricSubmitted').textContent = data.metrics.submitted;
    document.getElementById('metricInterviews').textContent = `${data.metrics.interviews} / ${data.metrics.offers}`;
  } catch (e) {}
}

async function loadPreferences() {
  try {
    const res = await fetch('/api/preferences', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const p = data.preferences;

    document.getElementById('prefRoles').value = (p.roles || []).join(', ');
    document.getElementById('prefLocations').value = (p.locations || []).join(', ');
    document.getElementById('prefExcludedCompanies').value = (p.excluded_companies || []).join(', ');
    document.getElementById('prefExcludedKeywords').value = (p.excluded_keywords || []).join(', ');
    document.getElementById('prefMinMatchScore').value = p.min_match_score || 60;
    document.getElementById('prefMaxDaily').value = p.max_applications_per_day || 30;

    // Checkboxes
    document.querySelectorAll('input[name="jobType"]').forEach(cb => {
      cb.checked = (p.job_types || []).includes(cb.value);
    });
  } catch (e) {}
}

async function loadProfile() {
  try {
    const res = await fetch('/api/profile', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const p = data.profile || {};

    document.getElementById('profFullName').value = p.full_name || currentUser.name || '';
    document.getElementById('profEmail').value = p.email || currentUser.email || '';
    document.getElementById('profPhone').value = p.phone || currentUser.phone || '';
    document.getElementById('profLocation').value = p.location || '';
    document.getElementById('profDOB').value = p.dob || '';
    document.getElementById('profGender').value = p.gender || 'Prefer not to say';
    document.getElementById('profEducation').value = p.education || '';
    document.getElementById('profGraduationYear').value = p.graduation_year || '';
    document.getElementById('profYearsExp').value = p.years_experience || '';
    document.getElementById('profSkills').value = p.skills || '';
    document.getElementById('profCurrentRole').value = p.current_role || '';
    document.getElementById('profCompany').value = p.company || '';
    document.getElementById('profCurrentCTC').value = p.current_ctc || '0';
    document.getElementById('profExpectedCTC').value = p.expected_ctc || '0';
    document.getElementById('profNoticePeriod').value = p.notice_period || '30 days';
    document.getElementById('profStartDate').value = p.start_date || '';
    document.getElementById('profWorkAuth').value = p.work_auth || 'Authorized to work in my country of residence.';
    document.getElementById('profSponsorship').value = p.sponsorship_req || 'No';
    document.getElementById('profRelocatePref').value = p.relocate_pref || 'Yes, open to relocation.';
    document.getElementById('profRemotePref').value = p.remote_pref || 'Yes, set up for remote work.';
    document.getElementById('profLinkedin').value = p.linkedin_url || '';
    document.getElementById('profGithub').value = p.github_url || '';
    document.getElementById('profPortfolio').value = p.portfolio_url || '';

    // Render uploaded resumes
    const list = document.getElementById('uploadedResumesList');
    if (data.resumes && data.resumes.length > 0) {
      list.innerHTML = '<strong>Uploaded Resumes:</strong>' + data.resumes.map(r => `
        <div style="background:var(--bg-input); padding:8px 12px; border-radius:6px; margin-top:6px; display:flex; justify-content:space-between; align-items:center;">
          <span>📄 ${r.filename} ${r.is_primary ? '<strong style="color:var(--success)">(Primary)</strong>' : ''}</span>
          <div>
            <a href="/api/profile/resumes/download/${r.id}" target="_blank" style="color:var(--primary); text-decoration:none; margin-right:12px; font-weight:600;">Download</a>
            <button onclick="deleteResume('${r.id}')" style="background:none; border:none; color:var(--danger); cursor:pointer; font-weight:600;">Delete</button>
          </div>
        </div>
      `).join('');
    } else {
      list.innerHTML = '<span style="color:var(--text-muted);">No resume uploaded yet.</span>';
    }
  } catch (e) {}
}

async function loadAutomationSettings() {
  try {
    const res = await fetch('/api/automation/settings', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const s = data.settings;

    document.getElementById('autoEnabled').checked = !!s.enabled;
    document.getElementById('autoDryRun').checked = !!s.dry_run;

    document.querySelectorAll('input[name="portal"]').forEach(cb => {
      cb.checked = (s.enabled_portals || []).includes(cb.value);
    });
  } catch (e) {}
}

async function checkEngineStatus() {
  try {
    const res = await fetch('/api/automation/settings', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const session = data.engineSession;

    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');

    if (session && session.connection_status === 'Online') {
      dot.className = 'status-indicator online';
      text.textContent = 'Windows Engine: Online';
    } else {
      dot.className = 'status-indicator offline';
      text.textContent = 'Windows Engine: Offline';
    }
  } catch (e) {}
}

async function loadDiscoveredJobs() {
  try {
    const res = await fetch('/api/jobs', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const tbody = document.getElementById('jobsTableBody');

    if (!data.jobs || data.jobs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No jobs discovered yet. Run local Windows Engine to discover jobs.</td></tr>';
      return;
    }

    tbody.innerHTML = data.jobs.map(job => {
      const scoreClass = job.match_score >= 75 ? 'score-high' : job.match_score >= 50 ? 'score-medium' : 'score-low';
      return `
        <tr>
          <td><strong>${job.title}</strong></td>
          <td>${job.company || 'N/A'}</td>
          <td>${job.location || 'Remote'}</td>
          <td><span style="text-transform:capitalize; font-weight:600;">${job.portal}</span></td>
          <td><span class="score-badge ${scoreClass}">${job.match_score}%</span></td>
          <td>${job.status}</td>
          <td>
            <a href="${job.original_url}" target="_blank" rel="noopener noreferrer" style="color:var(--primary); text-decoration:none; font-weight:600;">Open Listing ↗</a>
          </td>
        </tr>
      `;
    }).join('');
  } catch (e) {}
}

async function loadApplications() {
  try {
    const res = await fetch('/api/applications', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const tbody = document.getElementById('applicationsTableBody');

    if (!data.applications || data.applications.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No applications logged yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.applications.map(app => {
      const verifiedBadge = app.verified ? '✅ Verified' : app.status === 'Submission uncertain' ? '❓ Uncertain' : app.status === 'Application prepared' ? '📝 Prepared' : '⚠️ Pending';
      const linkHtml = app.job_url ? `<a href="${app.job_url}" target="_blank" rel="noopener noreferrer" style="color:var(--primary); text-decoration:none; font-weight:600;">Open Listing ↗</a>` : '<span style="color:var(--text-muted)">N/A</span>';
      return `
        <tr>
          <td><strong>${app.title}</strong></td>
          <td>${app.company || 'N/A'}</td>
          <td><span style="text-transform:capitalize; font-weight:600;">${app.portal}</span></td>
          <td><span style="padding:4px 8px; border-radius:12px; background:var(--bg-input); font-weight:600;">${app.status}</span></td>
          <td>${verifiedBadge}</td>
          <td>${new Date(app.submitted_at).toLocaleDateString()}</td>
          <td>${linkHtml}</td>
        </tr>
      `;
    }).join('');
  } catch (e) {}
}

async function loadLogs() {
  try {
    const res = await fetch('/api/automation/logs', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const consoleEl = document.getElementById('logConsole');

    if (data.logs && data.logs.length > 0) {
      consoleEl.innerHTML = data.logs.map(l => `[${new Date(l.created_at).toLocaleTimeString()}] [${l.portal}] [${l.level}] ${l.message}`).join('\n');
    }
  } catch (e) {}
}

// --- FORM HANDLERS ---
function setupForms() {
  // Preferences Form
  document.getElementById('preferencesForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const roles = document.getElementById('prefRoles').value.split(',').map(s => s.trim()).filter(Boolean);
    const locations = document.getElementById('prefLocations').value.split(',').map(s => s.trim()).filter(Boolean);
    const excludedCompanies = document.getElementById('prefExcludedCompanies').value.split(',').map(s => s.trim()).filter(Boolean);
    const excludedKeywords = document.getElementById('prefExcludedKeywords').value.split(',').map(s => s.trim()).filter(Boolean);
    const minScore = parseInt(document.getElementById('prefMinMatchScore').value) || 60;
    const maxDaily = parseInt(document.getElementById('prefMaxDaily').value) || 30;

    const jobTypes = Array.from(document.querySelectorAll('input[name="jobType"]:checked')).map(cb => cb.value);

    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          roles, locations, excluded_companies: excludedCompanies, excluded_keywords: excludedKeywords,
          min_match_score: minScore, max_applications_per_day: maxDaily, job_types: jobTypes
        })
      });
      const data = await res.json();
      alert(data.message || 'Preferences updated');
    } catch (err) {
      alert(err.message);
    }
  });

  // Profile Form
  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const full_name = document.getElementById('profFullName').value;
    const email = document.getElementById('profEmail').value;
    const phone = document.getElementById('profPhone').value;
    const location = document.getElementById('profLocation').value;
    const dob = document.getElementById('profDOB').value;
    const gender = document.getElementById('profGender').value;
    const education = document.getElementById('profEducation').value;
    const graduation_year = document.getElementById('profGraduationYear').value;
    const years_experience = document.getElementById('profYearsExp').value;
    const skills = document.getElementById('profSkills').value;
    const current_role = document.getElementById('profCurrentRole').value;
    const company = document.getElementById('profCompany').value;
    const current_ctc = document.getElementById('profCurrentCTC').value;
    const expected_ctc = document.getElementById('profExpectedCTC').value;
    const notice_period = document.getElementById('profNoticePeriod').value;
    const start_date = document.getElementById('profStartDate').value;
    const work_auth = document.getElementById('profWorkAuth').value;
    const sponsorship_req = document.getElementById('profSponsorship').value;
    const relocate_pref = document.getElementById('profRelocatePref').value;
    const remote_pref = document.getElementById('profRemotePref').value;
    const linkedin_url = document.getElementById('profLinkedin').value;
    const github_url = document.getElementById('profGithub').value;
    const portfolio_url = document.getElementById('profPortfolio').value;

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          full_name, email, phone, location, dob, gender, education, graduation_year,
          years_experience, skills, current_role, company, current_ctc, expected_ctc,
          notice_period, start_date, work_auth, sponsorship_req, relocate_pref, remote_pref,
          linkedin_url, github_url, portfolio_url
        })
      });
      const data = await res.json();
      alert(data.message || 'Profile updated');
    } catch (err) {
      alert(err.message);
    }
  });

  // Upload Resume
  document.getElementById('uploadResumeBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('resumeFileInput');
    if (!fileInput.files || fileInput.files.length === 0) {
      return alert('Please select a PDF or DOCX resume file.');
    }

    const formData = new FormData();
    formData.append('resume', fileInput.files[0]);

    try {
      const res = await fetch('/api/profile/resumes', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert('Resume uploaded successfully!');
      loadProfile();
    } catch (err) {
      alert(err.message);
    }
  });

  // Automation Form
  document.getElementById('automationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const enabled = document.getElementById('autoEnabled').checked;
    const dryRun = document.getElementById('autoDryRun').checked;
    const portals = Array.from(document.querySelectorAll('input[name="portal"]:checked')).map(cb => cb.value);

    try {
      const res = await fetch('/api/automation/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ enabled, dry_run: dryRun, enabled_portals: portals })
      });
      const data = await res.json();
      alert(data.message || 'Automation settings updated');
    } catch (err) {
      alert(err.message);
    }
  });

  // Emergency Stop
  document.getElementById('emergencyStopBtn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to trigger GLOBAL EMERGENCY STOP? This will immediately halt all local automation processes.')) return;

    try {
      const res = await fetch('/api/automation/emergency-stop', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      alert(data.message);
      document.getElementById('autoEnabled').checked = false;
    } catch (err) {
      alert(err.message);
    }
  });
}

async function deleteResume(id) {
  if (!confirm('Are you sure you want to delete this resume?')) return;
  try {
    const res = await fetch(`/api/profile/resumes/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    alert(data.message);
    loadProfile();
  } catch (err) {
    alert(err.message);
  }
}
