const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const serverless = require('serverless-http');
const authorization = require('../utils/authorization.js');
const adminAuth = require('../utils/adminAuth.js');
const { createHandler } = require('graphql-http/lib/use/express');
const Schema = require('../graphql/schema/index.js');
const Resolver = require('../graphql/resolver/index.js');
const cities = require('../graphql/data_utils/cities.json');
const app = express();
app.get('/favicon.ico', (req, res) => {
  console.log("in /favicon.ico route")
  res.end();
});

app.get('/', (req, res) => {
  console.log("in / route")
  res.json({ 
    status: 'OK',
  });
});
app.use(cors({
    origin: 'http://localhost:1234', // ✅ your frontend origin
    credentials: true                // ✅ allow cookies
}));

// Initialize Cloudinary
cloudinary.config({ 
  cloud_name: process.env.CLOUD_NAME, 
  api_key: process.env.CLOUD_API_KEY, 
  api_secret: process.env.CLOUD_API_SECRET
});


app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
// Routes

// Database connection with enhanced configuration
const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 15,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  retryWrites: true,
  retryReads: true
};

let isDbConnected = false;
mongoose.connection.on('connected', () => {
  isDbConnected = true;
  console.log('✅ MongoDB connected successfully');
});

mongoose.connection.on('disconnected', () => {
  isDbConnected = false;
  console.log('❌ MongoDB disconnected');
});

(async function connectDB() {
  try {
    await mongoose.connect(process.env.DB_URL, mongoOptions);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
  }
})();

// Database ready middleware
app.use((req, res, next) => {
  if (!isDbConnected) {
    return res.status(503).json({ 
      error: 'Database not ready',
      status: mongoose.STATES[mongoose.connection.readyState]
    });
  }
  next();
});


// Middlewares
app.use(authorization);
app.use(adminAuth);

// File upload configuration
const upload = multer({ storage })

app.post('/upload-img', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'event_images',
          public_id: `${Date.now()}-${req.file.originalname}`,
        },
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.end(req.file.buffer);
    });

    res.status(200).json({ imageUrl: result.secure_url });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GraphQL endpoint
app.use('/graphql', (req, res) => {
  return createHandler({
    schema: Schema,
    rootValue: Resolver,
    context: () => ({ req, res }),
    graphiql: true
  })(req, res);
});

// City search endpoint
app.get('/api/search-cities', (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: 'Query parameter required' });

    const regex = new RegExp(`^${query}`, "i");
    const filtered = cities.filter(item => regex.test(item.name));
    res.json(filtered.slice(0, 10));
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});


module.exports = serverless(app);