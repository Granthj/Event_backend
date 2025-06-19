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

// Initialize Cloudinary once at startup
cloudinary.config({ 
  cloud_name: process.env.CLOUD_NAME, 
  api_key: process.env.CLOUD_API_KEY, 
  api_secret: process.env.CLOUD_API_SECRET
});

const app = express();

// Enable CORS for production
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:1234',
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());

// Health check endpoint
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/', (req, res) => {
  res.status(200).send('✅ Event Backend is running on Vercel');
});

// Initialize database connection ONCE at startup
mongoose.connect(process.env.DB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10, // Increased connection pool
  socketTimeoutMS: 30000,
  serverSelectionTimeoutMS: 5000
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Middlewares
app.use(authorization);
app.use(adminAuth);

// Configure file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB limit
});

// Image upload endpoint with timeout handling
app.post('/upload-img', upload.single('file'), (req, res) => {
  req.setTimeout(8000, () => {
    res.status(504).json({ error: 'Upload timeout' });
  });

  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const start = Date.now();
  const stream = cloudinary.uploader.upload_stream(
    {
      folder: 'event_images',
      public_id: `${Date.now()}-${req.file.originalname}`,
    },
    (error, result) => {
      const end = Date.now();
      console.log(`🖼️ Cloudinary upload took ${end - start}ms`);
      if (error) {
        console.error('Cloudinary Upload Error:', error);
        return res.status(500).json({ error: 'Upload failed' });
      }
      return res.status(200).json({ imageUrl: result.secure_url });
    }
  );
  
  stream.end(req.file.buffer);
});

// GraphQL endpoint with timeout handling
app.use('/graphql', (req, res) => {
  req.setTimeout(8000, () => {
    res.status(504).json({ error: 'GraphQL request timeout' });
  });

  const start = Date.now();
  res.on('finish', () => {
    const end = Date.now();
    console.log(`📤 GraphQL responded in ${end - start}ms`);
  });

  return createHandler({
    schema: Schema,
    rootValue: Resolver,
    context: () => ({ req, res }),
    graphiql: process.env.NODE_ENV !== 'production',
  })(req, res);
});

// City search endpoint
app.get('/api/search-cities', (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    const regex = new RegExp(`^${query}`, "i");
    const filtered = cities.filter((item) => regex.test(item.name));
    res.json(filtered.slice(0, 10));
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = serverless(app);