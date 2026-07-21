// Temporary in-memory store for pending payments (demo only)
const payments = new Map();

module.exports = {
  create(transactionId, payload) {
    payments.set(transactionId, {
      transactionId,
      ...payload,
      status: 'PENDING',
      createdAt: Date.now()
    });
    return payments.get(transactionId);
  },
  get(transactionId) {
    return payments.get(transactionId);
  },
  update(transactionId, updates) {
    const existing = payments.get(transactionId);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    payments.set(transactionId, updated);
    return updated;
  },
  clear(transactionId) {
    payments.delete(transactionId);
  }
};