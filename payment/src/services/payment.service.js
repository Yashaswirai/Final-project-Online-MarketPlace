const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createRazorpayOrder = async (totalAmount) => {
    try {
        let options = {};
        if (totalAmount.currency == 'INR') {
            options = {
                amount: totalAmount.amount * 100, // amount in the smallest currency unit
                currency: totalAmount.currency,
            };
        }
        const order = await razorpay.orders.create(options);
        return order;
    } catch (error) {
        const order = await razorpay.orders.create(options);
        return order;
    }
}

const verifyRazorpayPayment = async (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
    const secret = process.env.RAZORPAY_KEY_SECRET
    try {
        const { validatePaymentVerification  } = require('../../node_modules/razorpay/dist/utils/razorpay-utils.js');
        const result = validatePaymentVerification({
            order_id: razorpayOrderId,
            payment_id: razorpayPaymentId,
        }, razorpaySignature, secret);
        return result;
    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

module.exports = {
    createRazorpayOrder,
    verifyRazorpayPayment
}