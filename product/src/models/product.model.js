const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        amount: {
            type: Number,
            required: true
        },
        currency: {
            type: String,
            enum: ['USD', 'INR'],
            required: true
        }
    },
    seller:{
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    images: [
        {
            url: String,
            thumbnail: String,
            id: String,
        }
    ]
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;