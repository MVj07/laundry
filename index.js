const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const router = express.Router()
// const items = require('./models/itemsModel');
const routes = require('./app/router');
// const authRoutes = require('./routes/auth'/);

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = 'mongodb+srv://msvijay6661:Timemachine7@laundry.yo8k1gx.mongodb.net/Laundry'
// const MONGO_URI = 'mongodb://msvijay6661:Timemachine7@ac-5qixhnh-shard-00-00.yo8k1gx.mongodb.net:27017,ac-5qixhnh-shard-00-01.yo8k1gx.mongodb.net:27017,ac-5qixhnh-shard-00-02.yo8k1gx.mongodb.net:27017/Laundry?authSource=admin&replicaSet=atlas-y6lmew-shard-0&ssl=true'
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

    // Clean up any corrupted 'type' values from previous runs
    const orders = require('./models/ordersModel');
    const result = await orders.updateMany({ type: 'status' }, { $set: { type: 'item' } });
    if (result.modifiedCount > 0) {
      console.log(`Database Migration: Repaired ${result.modifiedCount} order(s) with invalid type 'status' to 'item'.`);
    }
  } catch (err) {
    console.error("MongoDB connection failed:", err);
  }
}

connectDB();


app.listen(PORT, () => console.log(`Server running on ${PORT}`));