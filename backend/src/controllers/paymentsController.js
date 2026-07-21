import {
  createPayment as createPaymentService,
  confirmPayment as confirmPaymentService,
  getPaymentStatus,
} from "../services/paymentsService.js";

export async function createPayment(body) {
  return createPaymentService(body);
}

export async function confirmPayment(body) {
  return confirmPaymentService(body);
}

export async function getPaymentStatusHandler(transactionId) {
  return getPaymentStatus(transactionId);
}