const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const cartRouter = require('./routes/cart.route');


app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));


app.use('/api/cart', cartRouter);

module.exports = app;