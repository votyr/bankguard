import Payment from "../models/Payment.js";
import { initiateRazorpayPayout } from "./razorpayService.js";
import { verifyTransactionChallenge } from "./VisualPasswordService.js";

export async function createPayment({ transactionId, recipient, amount, reference }) {
  if (!transactionId || !recipient || !amount) {
    const err = new Error("Missing required payment fields");
    err.status = 400;
    throw err;
  }
  const payment = await Payment.create({ transactionId, recipient, amount, reference });
  return { status: payment.status, transactionId: payment.transactionId };
}

export async function confirmPayment({ transactionId, sessionId, registerInputs }) {
  const payment = await Payment.findOne({ transactionId });
  if (!payment) {
    const err = new Error("Payment not found or expired");
    err.status = 404;
    throw err;
  }

  const verification = await verifyTransactionChallenge({ sessionId, registerInputs });

  if (!verification.success) {
    payment.status = "VERIFICATION_FAILED";
    await payment.save();
    const err = new Error("Verification failed or expired. Please try again.");
    err.status = 401;
    throw err;
  }

  if (verification.transactionId && verification.transactionId !== transactionId) {
    const err = new Error("Transaction mismatch during verification.");
    err.status = 400;
    throw err;
  }

  payment.status = "PROCESSING";
  await payment.save();

  try {
    const payout = await initiateRazorpayPayout({
      recipient: payment.recipient,
      amount: payment.amount,
      reference: payment.reference,
    });

    payment.status = "SUCCESS";
    payment.razorpayPayoutId = payout.id;
    payment.razorpayStatus = payout.status;
    await payment.save();

    return { status: "SUCCESS", transactionId, payoutId: payout.id };
  } catch (err) {
    payment.status = "FAILED";
    await payment.save();

    if (err.code === "ECONNABORTED") {
      const e = new Error("Payment provider timed out. Please try again.");
      e.status = 504;
      throw e;
    }
    if (err.response?.status === 400 && err.response?.data?.error?.description?.includes("balance")) {
      const e = new Error("Insufficient funds.");
      e.status = 402;
      throw e;
    }
    const e = new Error("Payment failed. Please try again later.");
    e.status = 500;
    throw e;
  }
}

export async function getPaymentStatus(transactionId) {
  const payment = await Payment.findOne({ transactionId });
  if (!payment) {
    const err = new Error("Payment not found");
    err.status = 404;
    throw err;
  }
  return { status: payment.status, payoutId: payment.razorpayPayoutId || null };
}