require('dotenv').config();
const app = require('./src/app');
const PORT = process.env.PORT || 3001;
const connectDB = require('./src/db/db');

// Connect to the database
connectDB();

app.listen(PORT, () => {
  console.log(`Product service is running on port ${PORT}`);
});