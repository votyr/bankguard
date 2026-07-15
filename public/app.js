const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
async function api(url, body) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
document.querySelectorAll(".tab").forEach(tab => tab.onclick = () => { document.querySelectorAll(".tab").forEach(item => item.classList.remove("active")); document.querySelectorAll(".panel").forEach(item => item.classList.add("hidden")); tab.classList.add("active"); $(`#${tab.dataset.view}`).classList.remove("hidden"); });

function renderVerification(challenge) {
  const host = $("#transactionChallenge");
  const letters = Array.isArray(challenge.registerLetters) ? challenge.registerLetters : [];
  host.classList.remove("hidden");
  host.innerHTML = `<h3>Visual Password challenge</h3><p class="muted">Use the register letters issued by Scam2Safe to enter the five values requested by the challenge.</p><pre class="notice">${escapeHtml(JSON.stringify({ challengeGrid: challenge.challengeGrid, registerLetters: letters, amountCode: challenge.amountCode, recipientCode: challenge.recipientCode }, null, 2))}</pre><div class="grid" id="registerInputs">${[0, 1, 2, 3, 4].map(index => `<label>${escapeHtml(letters[index] || `Register ${index + 1}`)}<input type="number" class="register-input" inputmode="numeric" required></label>`).join("")}</div><button id="verifyTransaction">Verify with Scam2Safe</button><div id="verifyResult"></div>`;
  $("#verifyTransaction").onclick = async () => {
    const registerInputs = [...document.querySelectorAll(".register-input")].map(input => Number(input.value));
    if (registerInputs.length !== 5 || registerInputs.some(Number.isNaN)) { $("#verifyResult").innerHTML = '<p class="notice error">Enter all five register values.</p>'; return; }
    try {
      const result = await api("/api/transactions/verify", { sessionId: challenge.sessionId, registerInputs,});
      $("#verifyResult").innerHTML = `<pre class="notice success">${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
    } catch (error) { $("#verifyResult").innerHTML = `<p class="notice error">${escapeHtml(error.message)}</p>`; }
  };
}

$("#transactionForm").onsubmit = async event => {
  event.preventDefault(); const form = Object.fromEntries(new FormData(event.target)); const host = $("#transactionChallenge");
  try { renderVerification(await api("/api/transactions/challenge", {
    email: "bankguard@mail.com", // eventually the logged-in customer's email
    transactionId: `BANK-${Date.now()}`,
    amount: Number(form.amount),
    recipientName: form.recipient,
})); }
  catch (error) { host.classList.remove("hidden"); host.innerHTML = `<p class="notice error">${escapeHtml(error.message)}</p>`; }
};
$("#recoveryStart").onsubmit = async event => {
  event.preventDefault(); const host = $("#recoverySteps");
  try { const result = await api("/api/recovery/start", Object.fromEntries(new FormData(event.target))); host.classList.remove("hidden"); host.innerHTML = `<pre class="notice success">${escapeHtml(JSON.stringify(result, null, 2))}</pre>`; }
  catch (error) { host.classList.remove("hidden"); host.innerHTML = `<p class="notice error">${escapeHtml(error.message)}</p>`; }
};
