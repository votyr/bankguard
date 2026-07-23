import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    recipient: { type: Object, required: true }, // { name, accountNumber, ifsc, email?, phone? }
    amount: { type: Number, required: true },
    reference: { type: String },
    status: {
      type: String,
      enum: ["PENDING", "VERIFYING", "PROCESSING", "SUCCESS", "FAILED", "VERIFICATION_FAILED"],
      default: "PENDING",
    },
    razorpayPayoutId: { type: String },
    razorpayStatus: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);