require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/db/db');

// Connect to the database
connectDB();

const PORT = process.env.PORT || 3004;

app.listen(PORT, () => {
  console.log(`payment service is running on port ${PORT}`);
});
