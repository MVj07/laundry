const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const router = express.Router()
const items = require('./models/itemsModel');
const routes = require('./app/router');
// const authRoutes = require('./routes/auth'/);

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/Laundry';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// app.use('/api', router)
routes(app)

// MongoDB connection
// mongoose.connect(MONGO_URI)
// const db = mongoose.connection
// db.on('error', console.error.bind(console, 'connection error'))
// db.once('open', function () {
//   console.log('Mongodb connected')
// })
// const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
  }
}

connectDB();


app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));