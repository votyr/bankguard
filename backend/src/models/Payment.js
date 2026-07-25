import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  recipient: { type: Object, required: true },
  amount: { type: Number, required: true },
  reference: { type: String },
  ownerEmail: { type: String },
  status: {
    type: String,
    enum: ["PENDING_VERIFICATION", "PROCESSING", "SUCCESS", "FAILED", "VERIFICATION_FAILED"],
    default: "PENDING_VERIFICATION",
  },
  razorpayPayoutId: { type: String },
  razorpayStatus: { type: String },
  recipientCode: Number,
  amountCode: Number,
  verificationValue: Number,
  expectedD1: Number,
  expectedD2: Number,
  pos1: Number,
  pos2: Number,
  registerLetters: [String],
  verifiedRecipientName: String,
}, { timestamps: true });

export default mongoose.model("Payment", paymentSchema);