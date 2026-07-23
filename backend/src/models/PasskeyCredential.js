import mongoose from "mongoose";

const passkeyCredentialSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    credentialId: { type: String, required: true, unique: true },
    publicKey: { type: String, required: true }, // base64
    counter: { type: Number, default: 0 },
    transports: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("PasskeyCredential", passkeyCredentialSchema);