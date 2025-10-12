require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/db/db');

// Connect to the database
connectDB();

app.listen(process.env.PORT || 3002, () => {
  console.log(`cart service is running on port ${process.env.PORT || 3002}`);
});