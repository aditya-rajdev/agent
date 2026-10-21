# Configurable AI Job Search & Application Automation Platform

A complete, production-oriented **AI Job Search & Application Automation Platform** featuring a modern **Web Dashboard** and a local **Windows Automation Engine**.

The platform enables job seekers to manage their preferences, target roles, locations, salary filters, and candidate profile on a web interface. A persistent local engine running on Windows consumes those preferences, discovers matching jobs, computes 5-factor AI match scores, prepares applications, submits applications on supported portals (**Naukri**, **Wellfound**, **Indeed**, **LinkedIn Jobs**, **Upstox Careers**, **Unstop**, **Internshala**, **External ATS**), and tracks status in real time.

---

## 🚀 Key Features & Supported Portals

1. **Web Dashboard (`http://localhost:3000`)**:
   - **Authentication & Multi-User Isolation**: Secure signup, login, JWT session management, isolated database records per user.
   - **Editable Job Preferences**: Select and customize job roles (Flutter Developer, Android Developer, React Native Developer, Full Stack Developer, Backend Developer, Data Analyst, AI/ML Engineer), job types (Internship, Fresher, Full-time, Remote, Contract), target locations, salary ranges, company blocklists, and excluded keywords.
   - **Candidate Profile & Resume Manager**: PDF/DOCX resume upload with `mammoth` & `pdf-parse` text extraction, identity details, skills, experience, LPA salary conversion, notice period, and portfolio links.
   - **Automation Control**: Master toggle (Enable/Pause), **DRY RUN MODE** (form filling without submitting), daily schedules, application caps, portal toggles, and live execution console logs.
   - **AI Job Matching**: 5-Factor relevance engine (Skills 30%, Roles 25%, Experience 20%, Location 15%, Compensation 10%) producing match scores (0-100%) and human-readable explanations.
   - **Application Tracking Pipeline**: Complete application history tracking across pipeline stages (`Discovered`, `Saved`, `Ready to apply`, `Application prepared`, `Submitted`, `Submission uncertain`, `Failed`, `Rejected`, `Interview`, `Offer`, `Withdrawn`).
   - **Global Emergency Stop**: Instantly halts all local background automation.

2. **Windows Local Engine & Multi-Portal Adapters**:
   - Persistent local daemon connecting securely to the Web Dashboard via User Engine API Keys.
   - Clean Playwright execution using standard `playwright-core` Chromium browser launcher.
   - Win32 background window management (runs Chrome off-screen or minimized without stealing user focus).
   - **Supported Platforms & Capability Matrix**:
     - **Naukri.com**: Profile refresh, job feed discovery, internal 1-click & chatbot forms, external ATS handoff.
     - **Wellfound**: Job feed & role discovery, modal form filling, relocation preference prompts.
     - **Indeed**: "Easily Apply" search discovery & SmartApply multi-step wizard.
     - **LinkedIn Jobs**: Search feed discovery, Easy Apply vs external redirect classification, candidate Q&A mapping.
     - **Upstox Careers**: Scrapes official Upstox engineering/corporate openings (`https://upstox.com/careers/`), connects to Lever/Greenhouse ATS flows.
     - **Unstop**: Job and internship discovery (`https://unstop.com/jobs`, `https://unstop.com/internships`), distinguishes jobs/internships from hackathons/challenges.
     - **Internshala**: Internship & fresher job discovery (`https://internshala.com/internships`), stipend, duration, and screening answer mapping.
     - **External ATS**: Greenhouse, Lever, Keka, SmartRecruiters, Freshteam. Clean skip for account-required Workday/Taleo/iCIMS.

---

## 🛠️ Installation & Execution Guide

### 1. Prerequisites
- **Node.js**: Version 18.0 or higher (`node -v`)
- **Google Chrome**: Installed on Windows 10/11

---

### 2. Clone Repository & Install Dependencies
```powershell
git clone https://github.com/aditya-rajdev/agent.git
cd agent
npm install
```

---

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
copy .env.example .env
```
Open `.env` in a text editor and add:
```env
PORT=3000
JWT_SECRET=your-secure-jwt-secret-key-2026
DASHBOARD_URL=http://localhost:3000
ENGINE_API_KEY=your_engine_api_key_from_dashboard
```

---

### 4. Start the Web Dashboard
In **Terminal 1**, start the server:
```powershell
npm start
```
Open your browser and navigate to:
👉 **`http://localhost:3000`**

1. Click **Login / Register** to create a user account.
2. Under **Candidate Profile**, upload your resume (PDF/DOCX) and update your profile details.
3. Under **Job Preferences**, configure your target job roles, locations, and salary filters.
4. Copy your **Engine API Key** displayed on the Dashboard and paste it as `ENGINE_API_KEY` in your `.env` file.

---

### 5. Start the Windows Automation Engine
In **Terminal 2**, start the local Windows engine process:
```powershell
npm run engine
```
The Web Dashboard status badge will update to **`Windows Engine: Online`** (Green).

---

## 🔑 How to Solve Portal Login Issues (Naukri / Wellfound / Indeed Session Management)

When running automation for the first time, job portals require a **one-time manual login** to save your session cookies inside persistent Chrome profile folders (`.naukri-apply-profile`, `.wellfound-chrome-profile`, `.indeed-chrome-profile`, etc.).

### Solution 1: One-Time Login Command
Run the login command for the portal you want to connect:

```powershell
# One-time login for Naukri
node auto-apply-runner.js naukri login

# One-time login for Wellfound
node auto-apply-runner.js wellfound login

# One-time login for Indeed
node auto-apply-runner.js indeed login
```

1. A visible Chrome window will open on the portal's login page.
2. Sign in to your account (via Google or Email/Password).
3. Once logged in, close the Chrome window.
4. Your session is now saved permanently in the local profile folder! All future auto-apply runs will execute fully logged-in.

---

### Solution 2: Bring the Automation Browser Window to Screen
If the local engine is running in the background and you want to bring the browser window to your screen to log in or inspect execution:

```powershell
# Show all automation browser windows on screen
node show-windows.js

# Hide automation browser windows back to background
node show-windows.js --hide
```

---

## ⚡ Unpausing Automation & Emergency Stop Recovery

If the engine logs state `Automation is currently PAUSED on Dashboard`:
1. Open the Web Dashboard (`http://localhost:3000`).
2. Go to the **Automation Settings** tab.
3. Check the **Enable Local Automation Scheduler** checkbox.
4. Click **💾 Save Automation Settings**.

If **🚨 Emergency Stop** was triggered, saving settings on the Dashboard re-enables normal execution.

---

## 🧪 Running Automated Tests

Run the comprehensive unit and integration test suite:
```powershell
npm test
```

Expected Output:
```text
=======================================================
🧪 Running Comprehensive Automated Test Suite...
=======================================================

[PASS] 1. Naukri Helpers - Headline dot cycling
[PASS] 2. External ATS Classification & Answer Bank
[PASS] 3. Job Matcher - 5-Factor Relevance Engine & Eligibility Filters
[PASS] 4. LinkedIn Adapter - Search URL & Capability Verification
[PASS] 5. Upstox Careers Adapter - URL & Script Verification
[PASS] 6. Unstop Adapter - Opportunity & Event Classification
[PASS] 7. Internshala Adapter - Internship Filters & Search URLs
[PASS] 8. Scenario 1 - Submitted + verified: 1 + Missing Evidence Demotion
[PASS] 9. Pipeline - Unique Job URL Constraint Prevention
[PASS] 10. Isolation - Multi-User Data Isolation

=======================================================
📊 Test Results: 10/10 Passed.
=======================================================
```

---

## 📁 Repository Architecture

```
.
├── client/                     # Web Dashboard Single Page Application
│   ├── index.html              # Dashboard HTML UI
│   ├── styles.css              # Responsive SaaS CSS Stylesheet
│   └── app.js                  # Frontend Controller & API Integration
├── server/                     # Backend Express API & Database
│   ├── server.js               # Express Server & Route Binding
│   ├── db/                     # SQLite Database Schema & Persistence
│   ├── routes/                 # Auth, Profile, Preferences, Jobs, Applications, Analytics, Engine APIs
│   └── services/               # Auth, Resume Parser, 5-Factor Job Matcher
├── engine/                     # Windows Local Automation Engine
│   ├── local-engine.js         # Persistent Windows Local Engine Daemon
│   └── adapters/               # Portal Adapters (Naukri, Wellfound, Indeed, LinkedIn, Upstox, Unstop, Internshala, External ATS)
├── tests/                      # Automated Test Suite
│   └── run-all-tests.js        # Test Runner
├── window-utils.js             # Win32 Off-Screen Window Management (PowerShell P/Invoke)
├── naukri-auto-apply.js        # Naukri Auto-Apply Engine
├── wellfound-auto-apply.js     # Wellfound Auto-Apply Engine
├── indeed-auto-apply.js        # Indeed SmartApply Engine
├── external-apply.js           # External ATS Form Filler Engine
└── naukri-profile-refresh.js   # Hourly Naukri Profile Headline Refresher
```

---

## 🔒 Security & Privacy

- All candidate data, credentials, resumes, and application history are isolated per user in the local relational database.
- Web Dashboard authenticates API requests using **JSON Web Tokens (JWT)**.
- Local Windows Engine authenticates using user-specific **Engine API Keys**.
- Sensitive credentials and tokens are stored in `.env` and database tables, never committed to git repositories.
- Includes a global **Emergency Stop** button to halt background execution instantly.

---

## 📄 License
ISC License
