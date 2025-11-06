require('dotenv').config();
const app = require('./src/app');
const http = require('http');
const createSocketServer = require('./src/socket/socket.server');

const httpServer = http.createServer(app);
createSocketServer(httpServer);

const PORT = process.env.PORT || 3005;

httpServer.listen(PORT, () => {
  console.log(`ai-buddy Service is running on port ${PORT}`);
});