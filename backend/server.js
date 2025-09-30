require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require("cookie-parser");
const path = require('path');
const fs = require('fs');

const chatbotRouter = require('./routes/chatbot');
const adsRouter  = require('./routes/ads');
const adminRouter = require('./routes/admin');
const authRoutes = require("./routes/auth");
const subscriptionRoutes = require("./routes/subscription");
const seedRouter = require('./routes/seed');
const apiRouter = require('./routes/api');
const announcementsRouter = require('./routes/announcements');

const { initFirebaseAdmin } = require("./utils/firebaseAdmin");
try {
  initFirebaseAdmin();
  console.log("Firebase admin initialized.");
} catch (e) {
  console.warn("Firebase not initialized:", e.message);
}

const app = express();

// --- DEBUG LOGGING: show every incoming request ---
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.originalUrl, 'headers:', {
    origin: req.headers.origin,
    'content-type': req.headers['content-type'],
  });
  next();
});

// create uploads folder if missing
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'ads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// serve uploads statically
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads'), {
  maxAge: '1d'
}));

// CORS configuration
const FRONTEND_ORIGIN = ["http://localhost:3000","http://localhost:3001","https://universalparts.vercel.app"];
const corsOptions = {
  origin: FRONTEND_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
};
app.use(cors(corsOptions));

// ensure explicit preflight handling for chatbot route (helps debug preflight issues)
app.options('/api/chatbot', cors(corsOptions));

// body parser and cookie parser
app.use(express.json());
app.use(cookieParser());

// --- DEBUG: show what the router export looks like ---
console.log('chatbotRouter type:', typeof chatbotRouter);
try {
  console.log('chatbotRouter keys:', Object.keys(chatbotRouter || {}));
  console.log('chatbotRouter.stack length:', chatbotRouter && chatbotRouter.stack && chatbotRouter.stack.length);
} catch (e) {
  console.log('chatbotRouter debug error:', e && e.message);
}

// quick inline test route (bypass router) to prove express receives POST json
app.post('/api/chatbot-inline', (req, res) => {
  console.log('INLINE handler got body:', req.body);
  res.json({ response: 'inline OK' });
});

// register routes (chatbot mounted early)
app.use('/api/announcements', announcementsRouter);
app.use("/api/chatbot", chatbotRouter);
app.use("/api/auth", authRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use('/api/admin', adminRouter);
app.use('/api/seed', seedRouter);
app.use('/api', apiRouter);
app.use("/api/ads", adsRouter);

// rest of file: mongoose.connect + listen (unchanged)
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true, useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
  app.listen(PORT, () => console.log(`Server on ${PORT}`));
}).catch(err => console.error('Mongo connect err', err));
