// utils/db.js
const mongoose = require('mongoose');

let isConnected = false;

async function connectToDatabase() {
  if (isConnected) {
    return;
  }

  try {
    await mongoose.connect('mongodb+srv://root:8318383381@cluster0.i6ysx75.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    isConnected = true;
    console.log('✅ MongoDB connected.');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    throw err;
  }
}

module.exports = connectToDatabase;
