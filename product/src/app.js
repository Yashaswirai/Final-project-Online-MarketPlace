const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const productRoutes = require('./routes/product.routes');

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use('/api/products', productRoutes);



module.exports = app;