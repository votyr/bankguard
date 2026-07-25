import { getAuthedEmail, getAuthedUser } from "../services/requireAuth.js";
import {
  createPayment as createPaymentService,
  confirmPayment as confirmPaymentService,
  getPaymentStatus,
} from "../services/paymentsService.js";

export async function createPayment(body, req) {
  const user = getAuthedUser(req);
  return createPaymentService({ ...body, ownerEmail: user.email, visualPasswordValue: user.visualPasswordValue });
}

export async function confirmPayment(body, req) {
  const email = getAuthedEmail(req);
  return confirmPaymentService({ ...body, ownerEmail: email });
}