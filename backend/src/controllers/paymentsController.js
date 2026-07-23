import { getAuthedEmail } from "../services/requireAuth.js";
import {
  createPayment as createPaymentService,
  confirmPayment as confirmPaymentService,
  getPaymentStatus,
} from "../services/paymentsService.js";

export async function createPayment(body, req) {
  const email = getAuthedEmail(req);
  return createPaymentService({ ...body, ownerEmail: email });
}

export async function confirmPayment(body, req) {
  const email = getAuthedEmail(req);
  return confirmPaymentService({ ...body, ownerEmail: email });
}

export async function getPaymentStatusHandler(transactionId, req) {
  const email = getAuthedEmail(req);
  return getPaymentStatus(transactionId, email);
}