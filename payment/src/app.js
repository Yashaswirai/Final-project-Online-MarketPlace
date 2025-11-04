const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const paymentRoutes = require('./routes/payment.route');

app.use(express.json());
app.use(cookieParser());

app.use('/api/payments', paymentRoutes);

module.exports = app;