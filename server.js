/**
 * server.js – Entry point for Revision OS backend
 * Initializes Express app, middleware, routes, and starts the server.
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Load env vars
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL
    : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/ai',        require('./routes/aiRoutes'));
app.use('/api/auth',        require('./routes/authRoutes'));
app.use('/api/topics',      require('./routes/topicRoutes'));
app.use('/api/revisions',   require('./routes/revisionRoutes'));
app.use('/api/dashboard',   require('./routes/dashboardRoutes'));
// ── Stage 5 & 6 ──────────────────────────────────────────────────────────────
app.use('/api/missions',    require('./routes/missionRoutes'));
app.use('/api/boss-battle', require('./routes/bossBattleRoutes'));
// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Revision OS API is running 🚀' });
});

// ── Error Handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

app.get("/", (req, res) => {
  res.send("Backend is working! 🚀");
});

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`\n🚀 Revision OS Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  
  
  // Seed default admin if none exists
  // try {
  //   const User = require('./models/User');
  //   const adminCount = await User.countDocuments({ role: 'admin' });
  //   if (adminCount === 0) {
  //     console.log('👤 [Admin Seeding] No admin users found. Creating default admin...');
  //     await User.create({
  //       name: 'System Admin',
  //       email: 'admin@neuronest.com',
  //       password: 'adminpassword123',
  //       role: 'admin'
  //     });
  //     console.log('✅ [Admin Seeding] Default admin created: admin@neuronest.com / adminpassword123');
  //   }
  // } catch (err) {
  //   console.error('❌ [Admin Seeding] Seeding failed:', err.message);
  // }
});
