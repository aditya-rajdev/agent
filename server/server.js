/**
 * Main Web Dashboard & API Server
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth').router;
const profileRoutes = require('./routes/profile');
const preferencesRoutes = require('./routes/preferences');
const automationRoutes = require('./routes/automation');
const jobsRoutes = require('./routes/jobs');
const applicationsRoutes = require('./routes/applications');
const analyticsRoutes = require('./routes/analytics');
const engineApiRoutes = require('./routes/engineApi').router;

const app = express();
const PORT = process.env.PORT || 3000;

// Configured CORS middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Engine-API-Key']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file hosting for Web Dashboard UI
app.use(express.static(path.join(__dirname, '../client')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/engine', engineApiRoutes);

// Single Page Application Fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 AI Job Automation Web Dashboard running on http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
