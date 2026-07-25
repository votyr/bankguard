import React, { useEffect, useRef, useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

const baseApiUrl = import.meta.env.VITE_API_BASE_URL;

async function apiPost(path, body, token) {
  const response = await fetch(`${baseApiUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data?.error || 'Request failed');
    err.status = response.status;
    throw err;
  }
  return data;
}

function ShieldIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.5c3.6 2.6 7.4 2.7 9 2.7V12c0 6-4.3 9.3-9 10.5C7.3 21.3 3 18 3 12V5.2c1.6 0 5.4-.1 9-2.7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.2 12.2l2.2 2.2 5.4-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function ArrowIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function KeyIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="15" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 12l9-9M17 6l2 2M14 9l2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function formatAmountINR(amount) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `₹${amount}`;
  }
}

function OTPInputs({ count, values, onChange, disabled }) {
  const refs = useRef([]);
  useEffect(() => {
    const firstEmpty = values.findIndex((v) => !v);
    if (firstEmpty !== -1 && !disabled) refs.current[firstEmpty]?.focus();
  }, [disabled]);
  return (
    <div className="otpRow">
      {Array.from({ length: count }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => { refs.current[idx] = el; }}
          className={`otpBox ${disabled ? 'otpDisabled' : ''}`}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={values[idx] || ''}
          disabled={disabled}
          aria-label={`Register digit ${idx + 1}`}
          onChange={(e) => {
            const digit = e.target.value.replace(/\D/g, '').slice(-1);
            const next = [...values];
            next[idx] = digit;
            onChange(next);
            if (digit && idx < count - 1 && !disabled) refs.current[idx + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              const next = [...values];
              if (next[idx]) { next[idx] = ''; onChange(next); }
              else if (idx > 0) { next[idx - 1] = ''; onChange(next); refs.current[idx - 1]?.focus(); }
            } else if (e.key === 'ArrowLeft' && idx > 0) refs.current[idx - 1]?.focus();
            else if (e.key === 'ArrowRight' && idx < count - 1) refs.current[idx + 1]?.focus();
            else if (!/^[0-9]$/.test(e.key) && e.key !== 'Tab') e.preventDefault();
          }}
        />
      ))}
    </div>
  );
}

function RegisterLetters({ letters, values, onChange, error }) {
  return (
    <div className={`registerBlock ${error ? 'shake' : ''}`}>
      <div className="registerLabels">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="registerLabel">{letters?.[idx] ? letters[idx] : idx + 1}</div>
        ))}
      </div>
      <OTPInputs count={5} values={values} onChange={onChange} disabled={false} />
      {error ? <div className="errorText">Incorrect register values. Please try again.</div> : null}
    </div>
  );
}

function BoxGrid({ boxes }) {
  return (
    <div className="challengeGrid" aria-label="Visual Password challenge grid">
      {(boxes || []).map((box, i) => (
        <div key={i} className="challengeCard" style={{ animationDelay: `${i * 35}ms` }}>
          <div className="challengeMask">{box.name}</div>
          <div className="challengeValue">
            {box.numbers.map((n, j) => <span key={j} className="numChip">{n}</span>)}
            <span className="circledChip">{box.circled}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState({ name: 'login' });
  const [formErrors, setFormErrors] = useState({});
  const [passkeyStatus, setPasskeyStatus] = useState(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [session, setSession] = useState({ token: null, email: null });

  // login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginChallenge, setLoginChallenge] = useState(null);
  const [loginOtp, setLoginOtp] = useState(['', '', '', '', '']);
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState(null);

  // recovery (visual password -> new passkey)
  const [recoveryChallenge, setRecoveryChallenge] = useState(null);
  const [recoveryOtp, setRecoveryOtp] = useState(['', '', '', '', '']);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [recoveryError, setRecoveryError] = useState(null);

  // transaction draft
  const [txDraft, setTxDraft] = useState({
    email: 'bankguard@mail.com',
    transactionId: '',
    amount: 500000,
    recipientName: 'Rahul Sharma',
    recipientAccountNumber: '',
    recipientIfsc: '',
    reference: '',
  });

  // payment verification (registerLetters based, from /api/payments/create)
  const [payment, setPayment] = useState(null); // { transactionId, registerLetters }
  const [payOtp, setPayOtp] = useState(['', '', '', '', '']);
  const [confirmName, setConfirmName] = useState('');
  const [txPending, setTxPending] = useState(false);
  const [verifyPending, setVerifyPending] = useState(false);
  const [verifyError, setVerifyError] = useState(null);
  const [expiredMsg, setExpiredMsg] = useState(null);
  const [successData, setSuccessData] = useState(null);

  function resetPaymentState() {
    setPayOtp(['', '', '', '', '']);
    setConfirmName('');
    setVerifyPending(false);
    setVerifyError(null);
    setExpiredMsg(null);
    setSuccessData(null);
  }

  useEffect(() => {
    setTxDraft((d) => ({ ...d, transactionId: `BANK-${Date.now()}` }));
  }, []);

  function validateBankDetails() {
    const errors = {};
    const ifsc = txDraft.recipientIfsc.trim();
    const acc = txDraft.recipientAccountNumber.trim();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) errors.ifsc = 'IFSC must be 11 characters: 4 letters, a 0, then 6 letters/numbers (e.g. HDFC0001234).';
    if (!/^[0-9]{9,18}$/.test(acc)) errors.account = 'Account number should be 9–18 digits.';
    if (!txDraft.recipientName.trim()) errors.name = 'Recipient name is required.';
    if (!txDraft.amount || txDraft.amount <= 0) errors.amount = 'Enter a valid amount.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function startLogin() {
    setLoginError(null);
    setLoginPending(true);
    try {
      const result = await apiPost('/api/auth/login-start', { email: loginEmail });
      setLoginChallenge(result);
      setLoginOtp(['', '', '', '', '']);
      setScreen({ name: 'loginChallenge' });
    } catch (e) {
      setLoginError(e?.message || 'Unable to start login.');
    } finally {
      setLoginPending(false);
    }
  }

  async function verifyLogin() {
    setLoginPending(true);
    setLoginError(null);
    const registerInputs = loginOtp.map((v) => Number(v));
    if (registerInputs.some((n) => !Number.isFinite(n))) {
      setLoginError('Enter all five register values.');
      setLoginPending(false);
      return;
    }
    try {
      const result = await apiPost('/api/auth/login-verify', {
        sessionId: loginChallenge.sessionId,
        registerInputs,
      });
      setSession({ token: result.token, email: result.user?.email || loginEmail });
      setTxDraft((d) => ({ ...d, email: result.user?.email || loginEmail }));
      setScreen({ name: 'transactionForm' });
    } catch (e) {
      setLoginError(e?.message || 'Login verification failed.');
    } finally {
      setLoginPending(false);
    }
  }

  async function startTransaction() {
    const freshTransactionId = `BANK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setTxDraft((d) => ({ ...d, transactionId: freshTransactionId }));
    resetPaymentState();
    setTxPending(true);
    try {
      const result = await apiPost('/api/payments/create', {
        transactionId: freshTransactionId,
        recipient: { name: txDraft.recipientName, accountNumber: txDraft.recipientAccountNumber, ifsc: txDraft.recipientIfsc },
        amount: txDraft.amount,
        reference: txDraft.reference,
      }, session.token);
      setPayment({ transactionId: result.transactionId, registerLetters: result.registerLetters });
      setScreen({ name: 'payVerify' });
    } catch (e) {
      setExpiredMsg(e?.message || 'Unable to start payment.');
      setScreen({ name: 'expired' });
    } finally {
      setTxPending(false);
    }
  }

  async function verifyTransaction() {
    if (!payment) return;
    setVerifyPending(true);
    setVerifyError(null);
    const registerInputs = payOtp.map((v) => Number(v));
    if (registerInputs.some((n) => !Number.isFinite(n)) || !confirmName.trim()) {
      setVerifyError('Enter all five register values and the recipient name.');
      setVerifyPending(false);
      return;
    }
    try {
      setScreen({ name: 'processing' });
      const result = await apiPost('/api/payments/confirm', {
        transactionId: payment.transactionId,
        registerInputs,
        enteredRecipientName: confirmName,
      }, session.token);
      setSuccessData(result);
      setScreen({ name: 'success' });
    } catch (e) {
      setExpiredMsg(e?.message || String(e));
      setScreen({ name: 'expired' });
    } finally {
      setVerifyPending(false);
    }
  }

  async function registerPasskey() {
    setPasskeyBusy(true);
    setPasskeyStatus(null);
    try {
      const options = await apiPost('/api/passkey/register-options', { email: txDraft.email }, session.token);
      const response = await startRegistration(options);
      await apiPost('/api/passkey/register-verify', { email: txDraft.email, response }, session.token);
      setPasskeyStatus({ type: 'success', message: 'Passkey registered on this device.' });
    } catch (e) {
      setPasskeyStatus({ type: 'error', message: e?.message || 'Passkey registration failed.' });
    } finally {
      setPasskeyBusy(false);
    }
  }

  // Recovery: Visual Password verifies identity -> then register a NEW passkey
  async function startRecovery() {
    setRecoveryError(null);
    setRecoveryPending(true);
    try {
      const result = await apiPost('/api/auth/login-start', { email: txDraft.email });
      setRecoveryChallenge(result);
      setRecoveryOtp(['', '', '', '', '']);
      setScreen({ name: 'recoveryChallenge' });
    } catch (e) {
      setRecoveryError(e?.message || 'Unable to start recovery.');
    } finally {
      setRecoveryPending(false);
    }
  }

  async function verifyRecovery() {
    setRecoveryPending(true);
    setRecoveryError(null);
    const registerInputs = recoveryOtp.map((v) => Number(v));
    if (registerInputs.some((n) => !Number.isFinite(n))) {
      setRecoveryError('Enter all five register values.');
      setRecoveryPending(false);
      return;
    }
    try {
      const result = await apiPost('/api/auth/login-verify', {
        sessionId: recoveryChallenge.sessionId,
        registerInputs,
      });
      setSession({ token: result.token, email: result.user?.email || txDraft.email });
      setTxDraft((d) => ({ ...d, email: result.user?.email || d.email }));
      setScreen({ name: 'passkeySetup' });
    } catch (e) {
      setRecoveryError(e?.message || 'Recovery verification failed.');
    } finally {
      setRecoveryPending(false);
    }
  }
  return (
    <div className="appRoot">
      <style>{CSS}</style>

      <header className="topHeader">
        <div className="brand">
          <div className="shieldWrap"><ShieldIcon size={20} /></div>
          <div>
            <div className="brandName">BankGuard</div>
            <div className="brandSub">Secured by Scam2Safe</div>
          </div>
        </div>
        <div className="headerMeta">
          <span className="statusDot" /> Encrypted session
          {session.email ? (
            <button className="signOutBtn" onClick={() => { setSession({ token: null, email: null }); setScreen({ name: 'login' }); }}>
              {session.email} · Sign out
            </button>
          ) : null}
        </div>
      </header>

      <main className="stage">
        <div className="phoneFrame">
          <div className="phoneNotch" />

          {screen.name === 'login' && (
            <section className="screen fadeIn">
              <div className="screenEyebrow">Sign in</div>
              <h1 className="screenTitle">Welcome to BankGuard</h1>
              <p className="screenMuted">Enter your email to begin identity verification.</p>
              <label className="field">
                <span className="fieldLabel">Email</span>
                <input className="fieldInput" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && startLogin()} autoFocus />
              </label>
              <button className="btnPrimary" onClick={startLogin} disabled={loginPending || !loginEmail.trim()}>
                {loginPending ? 'Starting…' : <>Continue <ArrowIcon /></>}
              </button>
              {loginError ? <div className="warnCard">{loginError}</div> : null}
            </section>
          )}

          {screen.name === 'loginChallenge' && (
            <section className="screen fadeIn">
              <div className="screenEyebrow">Verify</div>
              <h1 className="screenTitle">Identity check</h1>
              <p className="screenMuted">Find your secret number, then complete your register row.</p>
              <BoxGrid boxes={loginChallenge?.boxes} />
              <RegisterLetters letters={loginChallenge?.registerLetters || []} values={loginOtp} onChange={setLoginOtp} error={!!loginError} />
              <button className="btnPrimary" onClick={verifyLogin} disabled={loginPending}>
                {loginPending ? 'Verifying…' : 'Verify & sign in'}
              </button>
              {loginError ? <div className="errorInline">{loginError}</div> : null}
              <button className="btnGhost" onClick={() => setScreen({ name: 'login' })}>← Back</button>
            </section>
          )}

          {screen.name === 'transactionForm' && (
            <section className="screen fadeIn">
              <div className="screenEyebrow">New transfer</div>
              <h1 className="screenTitle">Send money</h1>
              <p className="screenMuted">Enter the amount and recipient to begin.</p>
              <div className="amountField">
                <span className="amountCurrency">₹</span>
                <input className="amountInput" type="number" min={1} value={txDraft.amount} onChange={(e) => setTxDraft((d) => ({ ...d, amount: Number(e.target.value) }))} />
              </div>
              <label className="field">
                <span className="fieldLabel">Recipient name</span>
                <input className="fieldInput" value={txDraft.recipientName} onChange={(e) => setTxDraft((d) => ({ ...d, recipientName: e.target.value }))} />
              </label>
              <label className="field">
                <span className="fieldLabel">Account number</span>
                <input className="fieldInput" value={txDraft.recipientAccountNumber} onChange={(e) => setTxDraft((d) => ({ ...d, recipientAccountNumber: e.target.value }))} />
                {formErrors.account ? <div className="errorText">{formErrors.account}</div> : null}
              </label>
              <label className="field">
                <span className="fieldLabel">IFSC code</span>
                <input className="fieldInput" value={txDraft.recipientIfsc} onChange={(e) => setTxDraft((d) => ({ ...d, recipientIfsc: e.target.value.toUpperCase() }))} />
                {formErrors.ifsc ? <div className="errorText">{formErrors.ifsc}</div> : null}
              </label>
              <label className="field">
                <span className="fieldLabel">Reference (optional)</span>
                <input className="fieldInput" value={txDraft.reference} onChange={(e) => setTxDraft((d) => ({ ...d, reference: e.target.value }))} />
              </label>
              <div className="summaryLine"><span>Account</span><span>{txDraft.recipientAccountNumber ? `········${txDraft.recipientAccountNumber.slice(-4)}` : '—'}</span></div>
              <button className="btnPrimary" onClick={() => { if (validateBankDetails()) setScreen({ name: 'transactionConfirm' }); }}>
                Review transfer <ArrowIcon />
              </button>
              <button className="btnGhost" onClick={() => setScreen({ name: 'recoveryForm' })}>Recover account instead</button>
            </section>
          )}

          {screen.name === 'transactionConfirm' && (
            <section className="screen fadeIn">
              <div className="screenEyebrow">Confirm</div>
              <h1 className="screenTitle">Review &amp; send</h1>
              <div className="receiptCard">
                <div className="receiptAmount">{formatAmountINR(txDraft.amount)}</div>
                <div className="receiptTo">to {txDraft.recipientName}</div>
                <div className="receiptDivider" />
                <div className="receiptRow"><span>Account</span><span>········{txDraft.recipientAccountNumber.slice(-4) || '····'}</span></div>
                <div className="receiptRow"><span>IFSC</span><span>{txDraft.recipientIfsc || '—'}</span></div>
              </div>
              <div className="protectedNotice">
                <ShieldIcon size={16} />
                <div>
                  <div className="protectedTitle">Verification required</div>
                  <div className="protectedText">You'll confirm the recipient name and a register code before this transfer is authorized.</div>
                </div>
              </div>
              <button className="btnPrimary" onClick={startTransaction} disabled={txPending}>
                {txPending ? 'Preparing…' : 'Continue to verification'}
              </button>
              {expiredMsg ? <div className="warnCard">{expiredMsg}</div> : null}
              <button className="btnGhost" onClick={() => setScreen({ name: 'transactionForm' })}>Back</button>
            </section>
          )}

          {screen.name === 'payVerify' && (
            <section className="screen fadeIn">
              <div className="screenEyebrow">Verify</div>
              <h1 className="screenTitle">Confirm this transfer</h1>
              <p className="screenMuted">Type the recipient's name exactly, then complete your register row.</p>

              <label className="field">
                <span className="fieldLabel">Recipient name</span>
                <input className="fieldInput" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={txDraft.recipientName} />
              </label>

              <RegisterLetters letters={payment?.registerLetters || []} values={payOtp} onChange={setPayOtp} error={!!verifyError} />

              <button className={`btnPrimary ${verifyPending ? 'btnDisabled' : ''}`} onClick={verifyTransaction} disabled={verifyPending}>
                {verifyPending ? <span className="spinnerWrap"><span className="spinner" />Verifying…</span> : 'Authorize payment'}
              </button>
              {verifyError ? <div className="errorInline">{verifyError}</div> : null}
              <div className="finePrint">This step confirms it's really you — never share these values.</div>
            </section>
          )}

          {screen.name === 'processing' && (
            <section className="screen fadeIn">
              <div className="successWrap">
                <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderColor: 'rgba(11,30,61,0.15)', borderTopColor: 'var(--navy)' }} />
                <div className="successTitle" style={{ marginTop: 12 }}>Processing payment</div>
                <div className="successSub">Verifying and transferring funds — this takes a few seconds.</div>
              </div>
            </section>
          )}

          {screen.name === 'success' && (
            <section className="screen fadeIn">
              <div className="successWrap">
                <div className="successCheck">✓</div>
                <div className="successTitle">Payment sent</div>
                <div className="successSub">{formatAmountINR(Number(txDraft.amount))} to {txDraft.recipientName}</div>
              </div>
              <div className="receiptCard">
                <div className="receiptRow"><span>Recipient</span><span>{txDraft.recipientName}</span></div>
                <div className="receiptRow"><span>Amount</span><span>{formatAmountINR(Number(txDraft.amount))}</span></div>
                <div className="receiptRow"><span>Reference</span><span className="mono">{successData?.transactionId}</span></div>
                <div className="receiptRow"><span>Payout ID</span><span className="mono">{successData?.payoutId || '—'}</span></div>
              </div>
              <button className="btnGhost" onClick={registerPasskey} disabled={passkeyBusy} style={{ border: '1px solid var(--line)', color: 'var(--navy)' }}>
                {passkeyBusy ? 'Setting up passkey…' : <><KeyIcon /> Add a passkey for faster sign-in</>}
              </button>
              {passkeyStatus ? <div className={passkeyStatus.type === 'success' ? 'okCard' : 'warnCard'}>{passkeyStatus.message}</div> : null}
              <button className="btnPrimary" onClick={() => setScreen({ name: 'transactionForm' })}>Done</button>
            </section>
          )}

          {screen.name === 'expired' && (
            <section className="screen fadeIn">
              <div className="warnIcon">!</div>
              <h1 className="screenTitle">Verification expired</h1>
              <div className="warnCard">{expiredMsg || 'This challenge is no longer valid. Start again to continue.'}</div>
              <button className="btnPrimary" onClick={() => setScreen({ name: 'transactionConfirm' })}>Try again</button>
              <button className="btnGhost" onClick={() => setScreen({ name: 'transactionForm' })}>Back to payment</button>
            </section>
          )}

          {screen.name === 'recoveryForm' && (
            <section className="screen fadeIn">
              <div className="screenEyebrow">Recovery</div>
              <h1 className="screenTitle">Recover your account</h1>
              <p className="screenMuted">Verify with your Visual Password, then set up a new passkey on this device.</p>
              <label className="field">
                <span className="fieldLabel">Email</span>
                <input className="fieldInput" type="email" value={txDraft.email} onChange={(e) => setTxDraft((d) => ({ ...d, email: e.target.value }))} />
              </label>
              <button className="btnPrimary" onClick={startRecovery} disabled={recoveryPending}>
                {recoveryPending ? 'Starting…' : 'Continue with Visual Password'}
              </button>
              {recoveryError ? <div className="warnCard">{recoveryError}</div> : null}
              <button className="btnGhost" onClick={() => setScreen({ name: 'transactionForm' })}>Back</button>
            </section>
          )}

          {screen.name === 'recoveryChallenge' && (
            <section className="screen fadeIn">
              <div className="screenEyebrow">Verify</div>
              <h1 className="screenTitle">Recovery check</h1>
              <p className="screenMuted">Find your secret number, then complete your register row.</p>
              <BoxGrid boxes={recoveryChallenge?.boxes} />
              <RegisterLetters letters={recoveryChallenge?.registerLetters || []} values={recoveryOtp} onChange={setRecoveryOtp} error={!!recoveryError} />
              <button className="btnPrimary" onClick={verifyRecovery} disabled={recoveryPending}>
                {recoveryPending ? 'Verifying…' : 'Verify identity'}
              </button>
              {recoveryError ? <div className="errorInline">{recoveryError}</div> : null}
            </section>
          )}

          {screen.name === 'passkeySetup' && (
            <section className="screen fadeIn">
              <div className="screenEyebrow">Recovery</div>
              <h1 className="screenTitle">Set up a new passkey</h1>
              <p className="screenMuted">You're verified. Register a passkey on this device to sign in faster next time.</p>
              <button className="btnPrimary" onClick={async () => { await registerPasskey(); setScreen({ name: 'transactionForm' }); }} disabled={passkeyBusy}>
                {passkeyBusy ? 'Setting up…' : <><KeyIcon /> Register passkey on this device</>}
              </button>
              {passkeyStatus ? <div className={passkeyStatus.type === 'success' ? 'okCard' : 'warnCard'}>{passkeyStatus.message}</div> : null}
              <button className="btnGhost" onClick={() => setScreen({ name: 'transactionForm' })}>Skip for now</button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
button,input{font-family:inherit;}

:root{
  --navy:#1E2A4A;
  --gold:#E8B86D;
  --ink:#1A1D29;
  --mute:#6B7280;
  --line:rgba(255,255,255,0.4);
  --good:#22A66B;
  --danger:#E2554A;
  --glass:rgba(255,255,255,0.55);
  --glass-strong:rgba(255,255,255,0.75);
}

.appRoot{
  min-height:100vh;
  color:var(--ink);
  font-family:'Inter',sans-serif;
  display:flex;
  flex-direction:column;
  position:relative;
  overflow-x:hidden;
  background:
    radial-gradient(circle at 15% 20%, rgba(232,184,109,0.35) 0%, transparent 45%),
    radial-gradient(circle at 85% 15%, rgba(120,150,255,0.3) 0%, transparent 45%),
    radial-gradient(circle at 50% 90%, rgba(255,140,180,0.25) 0%, transparent 50%),
    linear-gradient(160deg, #EEF1FA 0%, #F7EDE2 50%, #EAF0F6 100%);
  background-attachment:fixed;
}

.topHeader{
  display:flex;align-items:center;justify-content:space-between;
  padding:16px 28px;
  background:rgba(30,42,74,0.55);
  backdrop-filter:blur(18px) saturate(160%);
  -webkit-backdrop-filter:blur(18px) saturate(160%);
  color:#fff;
  position:sticky;top:0;z-index:10;
  border-bottom:1px solid rgba(255,255,255,0.12);
}
.brand{display:flex;align-items:center;gap:12px;}
.shieldWrap{width:38px;height:38px;border-radius:12px;background:rgba(232,184,109,0.18);border:1px solid rgba(232,184,109,0.4);color:var(--gold);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);}
.brandName{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:1.05rem;letter-spacing:0.01em;}
.brandSub{font-size:0.72rem;color:rgba(255,255,255,0.6);letter-spacing:0.03em;}
.headerMeta{display:flex;align-items:center;gap:12px;font-size:0.76rem;color:rgba(255,255,255,0.65);}
.statusDot{width:7px;height:7px;border-radius:50%;background:#4FE3A1;box-shadow:0 0 0 4px rgba(79,227,161,0.2), 0 0 10px rgba(79,227,161,0.6);}
.signOutBtn{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);color:#fff;padding:6px 14px;border-radius:99px;font-size:0.74rem;cursor:pointer;transition:background .2s;backdrop-filter:blur(4px);}
.signOutBtn:hover{background:rgba(255,255,255,0.2);}

.stage{flex:1;display:flex;align-items:center;justify-content:center;padding:48px 20px;position:relative;z-index:1;}

.phoneFrame{
  position:relative;width:410px;max-width:100%;
  background:var(--glass);
  backdrop-filter:blur(28px) saturate(180%);
  -webkit-backdrop-filter:blur(28px) saturate(180%);
  border-radius:32px;
  border:1px solid rgba(255,255,255,0.6);
  box-shadow:
    0 30px 80px rgba(30,42,74,0.18),
    0 8px 24px rgba(30,42,74,0.08),
    inset 0 1px 0 rgba(255,255,255,0.8);
  padding:38px 30px 32px;
  min-height:630px;
  display:flex;flex-direction:column;
}
.phoneNotch{position:absolute;top:16px;left:50%;transform:translateX(-50%);width:56px;height:5px;border-radius:99px;background:rgba(30,42,74,0.15);}

.screen{display:flex;flex-direction:column;gap:15px;flex:1;padding-top:14px;}
.fadeIn{animation:fadeUp 0.4s cubic-bezier(.2,.8,.3,1) both;}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}

.screenEyebrow{font-size:0.7rem;font-weight:700;color:#C68A3E;letter-spacing:0.14em;text-transform:uppercase;}
.screenTitle{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:1.65rem;color:var(--navy);letter-spacing:-0.02em;margin-top:-4px;}
.screenMuted{font-size:0.85rem;color:var(--mute);line-height:1.55;margin-top:-6px;}

.amountField{
  display:flex;align-items:baseline;gap:6px;padding:18px;
  border:1px solid rgba(255,255,255,0.7);
  border-radius:18px;
  background:rgba(255,255,255,0.4);
  backdrop-filter:blur(10px);
  margin-top:4px;transition:border-color .2s, background .2s;
}
.amountField:focus-within{border-color:var(--navy);background:rgba(255,255,255,0.6);}
.amountCurrency{font-family:'Space Grotesk',sans-serif;font-size:1.6rem;color:var(--navy);font-weight:700;}
.amountInput{border:none;background:transparent;outline:none;font-family:'Space Grotesk',sans-serif;font-size:2rem;font-weight:700;color:var(--navy);width:100%;}
.amountInput::-webkit-outer-spin-button,.amountInput::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}

.field{display:flex;flex-direction:column;gap:6px;}
.fieldLabel{font-size:0.72rem;font-weight:700;color:var(--mute);letter-spacing:0.05em;text-transform:uppercase;}
.fieldInput{
  padding:12px 14px;border-radius:14px;
  border:1px solid rgba(255,255,255,0.7);
  background:rgba(255,255,255,0.45);
  backdrop-filter:blur(8px);
  font-size:0.92rem;color:var(--ink);outline:none;
  transition:border-color .2s,box-shadow .2s,background .2s;
}
.fieldInput:focus{border-color:var(--navy);background:rgba(255,255,255,0.7);box-shadow:0 0 0 4px rgba(30,42,74,0.08);}

.receiptCard{
  background:rgba(255,255,255,0.4);
  backdrop-filter:blur(14px);
  border:1px solid rgba(255,255,255,0.7);
  border-radius:20px;padding:20px 22px;display:flex;flex-direction:column;gap:10px;
}
.summaryLine,.receiptRow{display:flex;justify-content:space-between;font-size:0.85rem;color:var(--mute);}
.summaryLine span:last-child,.receiptRow span:last-child{color:var(--ink);font-weight:600;}
.receiptDivider{height:1px;background:linear-gradient(90deg,transparent,rgba(30,42,74,0.15),transparent);margin:3px 0;}
.mono{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:0.78rem;}
.receiptAmount{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:2.2rem;color:var(--navy);text-align:center;}
.receiptTo{text-align:center;font-size:0.86rem;color:var(--mute);margin-top:-4px;}

.protectedNotice{
  display:flex;gap:10px;align-items:flex-start;padding:15px 17px;border-radius:16px;
  background:rgba(232,184,109,0.14);
  border:1px solid rgba(232,184,109,0.35);
  backdrop-filter:blur(8px);
  color:var(--navy);
}
.protectedTitle{font-size:0.84rem;font-weight:700;}
.protectedText{font-size:0.78rem;color:var(--mute);line-height:1.5;margin-top:2px;}

.btnPrimary{
  width:100%;padding:15px;border-radius:16px;border:none;
  background:linear-gradient(135deg,#243158,var(--navy));
  color:#fff;font-weight:700;font-size:0.92rem;cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:8px;
  transition:transform .18s,box-shadow .18s,opacity .18s;
  box-shadow:0 14px 30px rgba(30,42,74,0.28), inset 0 1px 0 rgba(255,255,255,0.15);
}
.btnPrimary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 18px 38px rgba(30,42,74,0.36), inset 0 1px 0 rgba(255,255,255,0.2);}
.btnPrimary:disabled{opacity:0.45;cursor:not-allowed;transform:none;}
.btnGhost{
  width:100%;padding:12px;border-radius:14px;border:1px solid transparent;
  background:transparent;color:var(--mute);font-size:0.86rem;font-weight:600;cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:6px;
  transition:color .18s,background .18s,border-color .18s;
}
.btnGhost:hover{color:var(--navy);background:rgba(255,255,255,0.4);border-color:rgba(255,255,255,0.6);}

.warnCard{
  padding:13px 15px;border-radius:14px;
  background:rgba(226,85,74,0.1);
  border:1px solid rgba(226,85,74,0.28);
  backdrop-filter:blur(8px);
  color:var(--danger);font-size:0.83rem;line-height:1.5;
}
.okCard{
  padding:13px 15px;border-radius:14px;
  background:rgba(34,166,107,0.1);
  border:1px solid rgba(34,166,107,0.28);
  backdrop-filter:blur(8px);
  color:var(--good);font-size:0.83rem;line-height:1.5;
}
.warnIcon{
  width:50px;height:50px;border-radius:50%;
  background:rgba(226,85,74,0.12);
  border:1px solid rgba(226,85,74,0.3);
  color:var(--danger);display:flex;align-items:center;justify-content:center;
  font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:1.3rem;margin-bottom:2px;
  backdrop-filter:blur(6px);
}

.challengeGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.challengeCard{
  border:1px solid rgba(255,255,255,0.7);
  border-radius:16px;padding:13px 8px;
  display:flex;flex-direction:column;align-items:center;gap:9px;
  background:rgba(255,255,255,0.4);
  backdrop-filter:blur(10px);
  animation:fadeUp 0.35s ease both;
  transition:border-color .2s,box-shadow .2s,transform .2s,background .2s;
}
.challengeCard:hover{border-color:rgba(30,42,74,0.3);box-shadow:0 8px 22px rgba(30,42,74,0.1);transform:translateY(-2px);background:rgba(255,255,255,0.55);}
.challengeMask{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:0.9rem;color:var(--navy);letter-spacing:0.02em;}
.challengeValue{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;align-items:center;}
.numChip{font-size:0.78rem;font-weight:600;color:var(--ink);background:rgba(255,255,255,0.6);border-radius:8px;padding:3px 7px;}
.circledChip{
  display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;padding:0 5px;
  border-radius:50%;border:2px solid var(--gold);font-weight:700;font-size:0.85rem;color:var(--navy);
  background:rgba(232,184,109,0.15);
}

.registerBlock{display:flex;flex-direction:column;gap:9px;}
.registerLabels{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
.registerLabel{
  text-align:center;font-size:0.78rem;font-weight:700;color:var(--navy);
  background:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.7);border-radius:10px;padding:7px 0;
  backdrop-filter:blur(6px);
}
.otpRow{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
.otpBox{
  aspect-ratio:1;border-radius:14px;
  border:1px solid rgba(255,255,255,0.7);
  background:rgba(255,255,255,0.45);
  backdrop-filter:blur(8px);
  text-align:center;font-size:1.2rem;font-weight:700;color:var(--navy);outline:none;
  transition:border-color .18s,box-shadow .18s,background .18s;
}
.otpBox:focus{border-color:var(--navy);box-shadow:0 0 0 4px rgba(30,42,74,0.1);background:rgba(255,255,255,0.7);}
.otpDisabled{background:rgba(0,0,0,0.04);color:#9ca3af;}
.shake{animation:shakeX 0.35s ease;}
@keyframes shakeX{0%,100%{transform:translateX(0);}25%{transform:translateX(-5px);}75%{transform:translateX(5px);}}
.errorText{font-size:0.78rem;color:var(--danger);}
.errorInline{
  padding:11px 14px;border-radius:12px;
  background:rgba(226,85,74,0.1);border:1px solid rgba(226,85,74,0.25);
  backdrop-filter:blur(6px);
  color:var(--danger);font-size:0.82rem;
}
.finePrint{font-size:0.74rem;color:var(--mute);text-align:center;line-height:1.5;}

.spinnerWrap{display:flex;align-items:center;gap:8px;}
.spinner{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;animation:spin 0.7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

.successWrap{display:flex;flex-direction:column;align-items:center;gap:11px;padding:18px 0 6px;text-align:center;}
.successCheck{
  width:64px;height:64px;border-radius:50%;
  background:rgba(34,166,107,0.12);border:2px solid rgba(34,166,107,0.3);
  color:var(--good);display:flex;align-items:center;justify-content:center;
  font-size:1.7rem;font-weight:700;
  backdrop-filter:blur(8px);
  animation:popIn .4s cubic-bezier(.34,1.56,.64,1) both;
  box-shadow:0 0 0 8px rgba(34,166,107,0.06);
}
@keyframes popIn{from{transform:scale(0.6);opacity:0;}to{transform:scale(1);opacity:1;}}
.successTitle{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:1.4rem;color:var(--navy);}
.successSub{font-size:0.85rem;color:var(--mute);}

@media(max-width:420px){.phoneFrame{padding:30px 18px 24px;}}
`;