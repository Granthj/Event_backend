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
const db = process.env.DB_URL;
const app = express();
app.use(cors({
    origin: process.env.FRONTEND_URL, // ✅ your frontend origin //dont write localhost:1234 so anyone can access my backend api from their system localhost:1234 if they got my frontend code.
    credentials: true                // ✅ allow cookies
}));
app.options('*', cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
mongoose
  .connect(db, {})
  .then((con) => {
    console.log("db connected");
  })
  .catch((err) => {
    console.error("DB connection error", err);
  });
  // Initialize Cloudinary
  cloudinary.config({ 
    cloud_name: process.env.CLOUD_NAME, 
    api_key: process.env.CLOUD_API_KEY, 
    api_secret: process.env.CLOUD_API_SECRET
  });
  app.get('/favicon.ico', (req, res) => {
    console.log("in /favicon.ico route")
    res.end();
  });
  app.get('/api/test', (req, res) => {
  res.json({ message: "✅ Test passed" });
  });
  app.get("/", (req, res) => {
    res.json({ pong: "Server is up and running and working" });
  });



// Middlewares
app.use(authorization);
app.use(adminAuth);

// File upload configuration
const storage = multer.memoryStorage();
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
    graphiql: true,
    context: ({ req, res }) => ({ req, res })
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
    err.statusCode = err.statusCode || 500;
    err.status = err.status || "error";

    res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
    })
});
app.listen(8000, () => {
  console.log("listening");
});

 module.exports = app;