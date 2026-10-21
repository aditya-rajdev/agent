# Configurable AI Job Search & Application Automation Platform

A complete, production-oriented **AI Job Search & Application Automation Platform** with a modern **Web Dashboard** and a local **Windows Automation Engine**.

The platform enables job seekers to configure their job preferences, target roles, locations, salary filters, and candidate profile on a web website. A persistent local engine running on Windows consumes those preferences, discovers matching jobs, computes explainable AI match scores, prepares applications, submits applications on supported portals (**Naukri**, **Wellfound**, **Indeed**, **External ATS**), and tracks status.

---

## 🚀 Key Features

1. **Web Dashboard (`http://localhost:3000`)**:
   - **Authentication & Multi-User Isolation**: Secure signup, login, JWT session management, isolated database records.
   - **Editable Job Preferences**: Select and customize job roles (Flutter, Android, React Native, Full Stack, Backend, Data Analyst, AI/ML, etc.), job types (Internship, Fresher, Full-time, Remote, Contract), target locations, salary ranges, company blocklists, and excluded keywords.
   - **Candidate Profile & Resume Manager**: PDF/DOCX resume upload, automated parsing, identity details, skills, experience, LPA salary conversion, notice period, and links.
   - **Automation Control**: Master toggle (Enable/Pause), **DRY RUN MODE** (form filling without submitting), daily schedules, application caps, portal toggles, and live execution console logs.
   - **AI Job Matching**: 5-Factor relevance engine (Skills 30%, Roles 25%, Experience 20%, Location 15%, Compensation 10%) producing match scores (0-100%) and human-readable explanations.
   - **Application Tracking Pipeline**: Complete application history tracking across pipeline stages (`Discovered`, `Saved`, `Ready to apply`, `Application prepared`, `Submitted`, `Submission uncertain`, `Failed`, `Rejected`, `Interview`, `Offer`, `Withdrawn`).
   - **Global Emergency Stop**: Instantly halts all local background automation.

2. **Windows Local Engine (`engine/local-engine.js`)**:
   - Persistent local daemon connecting securely to the Web Dashboard via User Engine API Keys.
   - Stealth Playwright execution (`playwright-extra`, `puppeteer-extra-plugin-stealth`).
   - Win32 background window management (runs Chrome off-screen or minimized without stealing user focus).
   - Modular portal adapters for **Naukri**, **Wellfound**, **Indeed**, and **External ATS** (Greenhouse, Lever, Keka, SmartRecruiters, Freshteam).

---

## 🛠️ Installation & Setup Guide

### 1. Prerequisites
- **Node.js** 18 or higher (`node -v`)
- **Google Chrome** installed on Windows 10/11

### 2. Clone & Install Dependencies
```powershell
git clone https://github.com/ankitbaghel01/naukri_update.git
cd naukri_update
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
copy .env.example .env
```
Fill in basic server configuration:
```env
PORT=3000
JWT_SECRET=your-secure-jwt-secret
DASHBOARD_URL=http://localhost:3000
ENGINE_API_KEY=your_engine_api_key_from_dashboard
```

### 4. Start the Web Dashboard
```powershell
npm start
```
Open `http://localhost:3000` in your web browser.
1. Register a new user account or log in.
2. Navigate to **Candidate Profile** to upload your resume (PDF/DOCX).
3. Navigate to **Job Preferences** to set target roles, locations, salary filters, and daily limits.
4. Copy your **Engine API Key** shown on the Dashboard.

### 5. Start the Windows Automation Engine
In a separate terminal on your Windows machine, set `ENGINE_API_KEY` in `.env` and run:
```powershell
npm run engine
```
The Web Dashboard status badge will update to **`Windows Engine: Online`**.

---

## 🧪 Running Automated Tests

Run the comprehensive test suite (Unit tests, Integration tests, AI Job Matcher, Auth isolation, Database schema):
```powershell
npm test
```

---

## 📁 Repository Architecture

```
.
├── client/                     # Web Dashboard Single Page Application
│   ├── index.html              # Main SaaS Dashboard HTML Layout
│   ├── styles.css              # Modern Responsive SaaS Stylesheet
│   └── app.js                  # Frontend Controller & API Integration
├── server/                     # Backend Express API & Database
│   ├── server.js               # Express Server Setup & Route Binding
│   ├── db/                     # SQLite Database Schema & Persistence
│   ├── routes/                 # Auth, Profile, Preferences, Jobs, Applications, Analytics, Engine APIs
│   └── services/               # Auth, Resume Parser, 5-Factor Job Matcher, Automation Services
├── engine/                     # Windows Local Automation Engine
│   ├── local-engine.js         # Persistent Windows Local Engine Daemon Process
│   └── adapters/               # Portal Adapters (Naukri, Wellfound, Indeed, External ATS)
├── tests/                      # Automated Unit & Integration Test Suite
│   └── run-all-tests.js        # Test Suite Runner
├── window-utils.js             # Win32 Off-Screen Window Management (PowerShell P/Invoke)
├── naukri-auto-apply.js        # In-browser Naukri Auto-Apply Engine
├── wellfound-auto-apply.js     # In-browser Wellfound Auto-Apply Engine
├── indeed-auto-apply.js        # In-browser Indeed SmartApply Engine
├── external-apply.js           # External ATS Form Filler Engine
└── naukri-profile-refresh.js   # Hourly Naukri Profile Headline Refresher
```

---

## 🔒 Security & Privacy

- All user data, credentials, resumes, and application records are isolated per user in the local relational database.
- Web Dashboard authenticates API requests via **JSON Web Tokens (JWT)**.
- Local Windows Engine authenticates via user-specific **Engine API Keys**.
- Sensitive credentials and tokens are stored securely in `.env` and database tables, never committed to git repositories.
- Includes a global **Emergency Stop** button to immediately pause all background automation.

---

## 📄 License
ISC License
