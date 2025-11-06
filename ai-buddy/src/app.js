const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');

// Middleware
app.use(express.json());
app.use(cookieParser());


module.exports = app;