import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    recipient: { type: Object, required: true },
    amount: { type: Number, required: true },
    reference: { type: String },
    status: {
      type: String,
      enum: ["PENDING", "VERIFYING", "PROCESSING", "SUCCESS", "FAILED", "VERIFICATION_FAILED"],
      default: "PENDING",
    },
    yapilyPaymentId: { type: String },
    yapilyStatus: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);