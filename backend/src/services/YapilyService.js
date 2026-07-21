import axios from "axios";
import { yapilyConfig } from "../config/yapilyConfig.js";

const yapily = axios.create({
  baseURL: yapilyConfig.baseUrl,
  timeout: 15000,
});

function authHeader() {
  const token = Buffer.from(
    `${yapilyConfig.applicationId}:${yapilyConfig.applicationSecret}`
  ).toString("base64");
  return `Basic ${token}`;
}

export async function createYapilyPayment({ amount, currency, reference, recipient }) {
  const payload = {
    applicationUserId: "bankguard-demo-user",
    paymentRequest: {
      amount: { amount, currency: currency || "GBP" },
      reference: reference || "BankGuard Payment",
      payerReference: reference || "BankGuard Payment",
      payee: {
        accountIdentifications: [
          { type: "SORT_CODE", identification: recipient.sortCode },
          { type: "ACCOUNT_NUMBER", identification: recipient.accountNumber },
        ],
        name: recipient.name,
      },
    },
    institutionId: yapilyConfig.institutionId,
    callback: yapilyConfig.callbackUrl,
  };

  const { data } = await yapily.post("/payments", payload, {
    headers: { Authorization: authHeader() },
  });

  return data;
}

export async function getYapilyPaymentStatus(paymentId) {
  const { data } = await yapily.get(`/payments/${paymentId}`, {
    headers: { Authorization: authHeader() },
  });
  return data;
}