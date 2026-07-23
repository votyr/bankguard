// backend/src/services/RazorpayService.js
import axios from "axios";
import { razorpayConfig } from "../config/razorpayConfig.js";

const razorpay = axios.create({
  baseURL: razorpayConfig.baseUrl,
  timeout: 15000,
  auth: {
    username: razorpayConfig.keyId,
    password: razorpayConfig.keySecret,
  },
});

// STEP 1: create a Contact (the recipient as an entity in Razorpay)
async function createContact({ name, email, contact }) {
  const { data } = await razorpay.post("/contacts", {
    name,
    email: email || undefined,
    contact: contact || undefined,
    type: "customer",
  });
  return data; // data.id = contact_id
}

// STEP 2: create a Fund Account (recipient's bank account) linked to that Contact
async function createFundAccount({ contactId, accountNumber, ifsc, name }) {
  const { data } = await razorpay.post("/fund_accounts", {
    contact_id: contactId,
    account_type: "bank_account",
    bank_account: {
      name,
      ifsc,
      account_number: accountNumber,
    },
  });
  return data; // data.id = fund_account_id
}

// STEP 3: create the Payout against that Fund Account
async function createPayout({ fundAccountId, amount, reference }) {
  const { data } = await razorpay.post("/payouts", {
    account_number: razorpayConfig.accountNumber, // your RazorpayX test virtual account
    fund_account_id: fundAccountId,
    amount: Math.round(amount * 100), // Razorpay uses paise
    currency: "INR",
    mode: "IMPS", // sandbox supports IMPS/NEFT/RTGS
    purpose: "payout",
    queue_if_low_balance: true,
    reference_id: reference || undefined,
    narration: reference || "BankGuard Transfer",
  });
  return data; // data.id = payout_id, data.status
}

// Wraps all 3 steps into one call so paymentsService stays simple
export async function initiateRazorpayPayout({ recipient, amount, reference }) {
  const contact = await createContact({
    name: recipient.name,
    email: recipient.email,
    contact: recipient.phone,
  });

  const fundAccount = await createFundAccount({
    contactId: contact.id,
    accountNumber: recipient.accountNumber,
    ifsc: recipient.ifsc,
    name: recipient.name,
  });

  const payout = await createPayout({
    fundAccountId: fundAccount.id,
    amount,
    reference,
  });

  return payout;
}

export async function getRazorpayPayoutStatus(payoutId) {
  const { data } = await razorpay.get(`/payouts/${payoutId}`);
  return data;
}