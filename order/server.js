require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/db/db');

// Connect to the database
connectDB();
const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(`Order service is running on port ${PORT}`);
});