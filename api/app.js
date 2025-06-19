require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
// const fs = require('fs');
// const Event = require('./model/Event.js')
// const User = require('./model/User.js');
// const nodemailer = require('nodemailer');
const cloudinary = require('cloudinary').v2;
// const axios = require('axios');
const multer = require('multer');
const serverless = require('serverless-http');
const authorization = require('../utils/authorization.js')
const { createHandler } = require('graphql-http/lib/use/express');
const Schema = require('../graphql/schema/index.js');
const Resolver = require('../graphql/resolver/index.js');
const cities = require('../graphql/data_utils/cities.json'); // Assuming you have a file with city data
cloudinary.config({ 
    cloud_name: process.env.CLOUD_NAME, 
    api_key: process.env.CLOUD_API_KEY, 
    api_secret: process.env.CLOUD_API_SECRET // Click 'View API Keys' above to copy your API secret
});

const app = express();
app.use(cors({
    origin: 'http://localhost:1234', // ✅ your frontend origin
    credentials: true                // ✅ allow cookies
}));
app.use(cookieParser());
app.use(express.json()); 
app.use(authorization);

const storage = multer.memoryStorage();
const upload = multer({ storage })

app.post('/upload-img',upload.single('file'),function(req,res){
    if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
    }
     const stream = cloudinary.uploader.upload_stream(
    {
      folder: 'event_images', // optional folder
      public_id: `${Date.now()}-${req.file.originalname}`,
    },
    (error, result) => {
      if (error) {
        console.error('Cloudinary Upload Error:', error);
        return res.status(500).json({ error: 'Upload failed' });
      }
      return res.status(200).json({ imageUrl: result.secure_url });
    })
     stream.end(req.file.buffer);
})

app.use('/graphql', (req, res) =>
  createHandler({
    schema: Schema,
    rootValue: Resolver,
    context: () => ({ req, res }), 
    graphiql: true,
  })(req, res)
);
app.get('/api/search-cities', async (req, res) => {

    const { query } = req.query; 
   
    try {  
        const regex = new RegExp(`^${query}`, "i"); 
        const filtered = cities.filter((item) => regex.test(item.name));
        res.json(filtered.slice(0, 10)); 
    } catch (error) {
        console.error('Error fetching cities:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

mongoose.connect(process.env.DB_URL)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.log('MongoDB connection error:', err));

module.exports = serverless(app);