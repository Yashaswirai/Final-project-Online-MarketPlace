jest.setTimeout(30000);

// Prevent tests from accidentally using the real DB connection from server.js
process.env.NODE_ENV = 'test';
