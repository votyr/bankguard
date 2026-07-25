import Payment from "../models/Payment.js";
import { initiateRazorpayPayout } from "./razorpayService.js";

function deriveAmountCode(amount) {
  const digits = String(Math.trunc(amount));
  const firstDigit = parseInt(digits[0], 10);
  const digitCount = digits.length;
  return firstDigit + digitCount;
}

export async function createPayment({
  transactionId, recipient, amount, reference, ownerEmail,
  visualPasswordValue, registerLetters, pos1, pos2,
}) {
  if (!transactionId || !recipient || !amount || visualPasswordValue == null || pos1 == null || pos2 == null) {
    const err = new Error("Missing required payment fields");
    err.status = 400;
    throw err;
  }

  const amountCode = deriveAmountCode(amount);
  const recipientCode = amountCode; // per spec: recipient component == amount component
  const verificationValue = (recipientCode + visualPasswordValue) % 100;
  const normalized = String(verificationValue).padStart(2, "0");
  const expectedD1 = parseInt(normalized[0], 10);
  const expectedD2 = parseInt(normalized[1], 10);

  const payment = await Payment.create({
    transactionId, recipient, amount, reference, ownerEmail,
    recipientCode, amountCode, verificationValue,
    expectedD1, expectedD2, pos1, pos2,
    registerLetters,
    status: "PENDING_VERIFICATION",
  });

  return {
    transactionId: payment.transactionId,
    status: payment.status,
    registerLetters, // so the frontend can render the same 5-slot bar as login
  };
}

export async function confirmPayment({ transactionId, registerInputs, enteredRecipientName, ownerEmail }) {
  const payment = await Payment.findOne({ transactionId, ownerEmail });
  if (!payment) {
    const err = new Error("Payment not found or expired");
    err.status = 404;
    throw err;
  }
  if (payment.status !== "PENDING_VERIFICATION") {
    const err = new Error("This payment has already been processed or is in an invalid state.");
    err.status = 409;
    throw err;
  }
  if (!Array.isArray(registerInputs) || registerInputs.length !== 5) {
    const err = new Error("Five register values are required.");
    err.status = 400;
    throw err;
  }

  const input1 = parseInt(registerInputs[payment.pos1], 10);
  const input2 = parseInt(registerInputs[payment.pos2], 10);
  const validFormat = !isNaN(input1) && !isNaN(input2);
  const codeMatch = validFormat && (
    (input1 === payment.expectedD1 && input2 === payment.expectedD2) ||
    (input1 === payment.expectedD2 && input2 === payment.expectedD1)
  );
  const nameMatch = enteredRecipientName?.trim().toLowerCase() === payment.recipient?.name?.trim().toLowerCase();

  if (!codeMatch || !nameMatch) {
    payment.status = "VERIFICATION_FAILED";
    await payment.save();
    const err = new Error("Verification failed. Check the recipient name and register code.");
    err.status = 401;
    throw err;
  }

  payment.verifiedRecipientName = enteredRecipientName;
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
    console.error("====== RAZORPAY ERROR ======", err);
    payment.status = "FAILED";
    await payment.save();
    if (err.response?.data?.error) {
      const e = new Error(err.response.data.error.description || "Payment provider error");
      e.status = err.response.status;
      throw e;
    }
    throw err;
  }
}

export async function getPaymentStatus(transactionId, ownerEmail) {
  const payment = await Payment.findOne({ transactionId, ownerEmail });
  if (!payment) {
    const err = new Error("Payment not found");
    err.status = 404;
    throw err;
  }
  return { status: payment.status, payoutId: payment.razorpayPayoutId || null };
}