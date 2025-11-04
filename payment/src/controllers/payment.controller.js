const paymentModel = require("../models/payment.model");
const {
  createRazorpayOrder,
  verifyRazorpayPayment,
} = require("../services/payment.service");
const axios = require("axios");

const createPayment = async (req, res) => {
  const orderId = req.params.orderId;
  const token =
    req.cookies["token"] || req.headers["authorization"]?.split(" ")[1];
  try {
    const orderResponse = await axios.get(
      `http://localhost:3003/api/orders/${orderId}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      }
    );
    const paymentAmount = orderResponse.data.order.totalAmount;
    const order = await createRazorpayOrder(paymentAmount);
    const payment = await paymentModel.create({
      userId: req.user.id,
      orderId: orderId,
      razorpayOrderId: order.id,
      price: paymentAmount,
    });
    return res
      .status(201)
      .json({ message: "Payment created successfully", payment });
  } catch (error) {
    console.error("Error fetching order:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const verifyPayment = async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  try {
    const isValid = await verifyRazorpayPayment(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
    if (isValid) {
      await paymentModel.findOneAndUpdate(
        { razorpayOrderId: razorpayOrderId, status: "PENDING" },
        { status: "COMPLETED", razorpayPaymentId: razorpayPaymentId }
      );
      return res.status(200).json({ message: "Payment verified successfully" });
    } else {
      return res.status(400).json({ message: "Invalid payment signature" });
    }
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  createPayment,
  verifyPayment,
};
