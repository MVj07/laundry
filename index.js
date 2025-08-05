const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const router = express.Router()
const items = require('./models/itemsModel');
const routes = require('./app/router');
// const authRoutes = require('./routes/auth'/);

const app = express();
const PORT = 5000;
const MONGO_URI = 'mongodb+srv://msvijay6661:Timemachine7@laundry.yo8k1gx.mongodb.net/Laundry';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// app.use('/api', router)
routes(app)

// MongoDB connection
mongoose.connect(MONGO_URI)
const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error'))
db.once('open', function () {
  console.log('Mongodb connected')
})


app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));