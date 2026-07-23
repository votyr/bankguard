import React, { useEffect, useMemo, useRef, useState } from 'react';

const baseApiUrl = import.meta.env.VITE_API_BASE_URL;

async function apiPost(path, body) {
  const response = await fetch(`${baseApiUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

function ShieldIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2.5c3.6 2.6 7.4 2.7 9 2.7V12c0 6-4.3 9.3-9 10.5C7.3 21.3 3 18 3 12V5.2c1.6 0 5.4-.1 9-2.7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
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

function formatAmountINR(amount) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `₹${amount}`;
  }
}

function maskOnlyGrid(grid) {
  const arr = Array.isArray(grid) ? grid : [];
  const nine = arr.slice(0, 9);
  while (nine.length < 9) nine.push({ mask: '' });
  return nine;
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

function ChallengeGrid({ masks }) {
  return (
    <div className="challengeGrid" aria-label="Visual Password challenge grid">
      {masks.map((cell, i) => (
        <div key={i} className="challengeCard" style={{ animationDelay: `${i * 35}ms` }}>
          <div className="challengeMask">{cell.mask}</div>
          <div className="challengeValue">{cell.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState({ name: 'transactionForm' });
  const [apiState, setApiState] = useState({});
  const [challenge, setChallenge] = useState(null);

  const [txDraft, setTxDraft] = useState({
    email: 'bankguard@mail.com',
    transactionId: '',
    amount: 500000,
    recipientName: 'Rahul Sharma',
    recipientAccountNumber: '',   // NEW
    recipientIfsc: '',            // NEW
    reference: '',                // NEW (optional)
  });

  const [otpValues, setOtpValues] = useState(['', '', '', '', '']);
  const [verifyPending, setVerifyPending] = useState(false);
  const [inputShake, setInputShake] = useState(false);
  const [verifyError, setVerifyError] = useState(null);
  const [expiredMsg, setExpiredMsg] = useState(null);
  const [successData, setSuccessData] = useState(null);

  function resetChallengeState() {
    setOtpValues(['', '', '', '', '']);
    setVerifyPending(false);
    setInputShake(false);
    setVerifyError(null);
    setExpiredMsg(null);
    setSuccessData(null);
  }

  useEffect(() => {
    setTxDraft((d) => ({ ...d, transactionId: `BANK-${Date.now()}` }));
  }, []);

  async function startTransaction() {
    resetChallengeState();
    setApiState({ lastCallLabel: 'POST /api/payments/create', lastCallAt: Date.now() });

    try {
      // STEP 1: create pending payment before any verification
      await apiPost('/api/payments/create', {
        transactionId: txDraft.transactionId,
        recipient: {
          name: txDraft.recipientName,
          accountNumber: txDraft.recipientAccountNumber,
          ifsc: txDraft.recipientIfsc,
        },
        amount: txDraft.amount,
        reference: txDraft.reference,
      });

      // STEP 2: launch Scam2Safe challenge (unchanged)
      const result = await apiPost('/api/transactions/challenge', {
        email: txDraft.email,
        transactionId: txDraft.transactionId,
      });
      setChallenge(result);
      setScreen({ name: 'challenge', mode: 'transaction' });
      setApiState((s) => ({ ...s, lastCallResponse: result }));
    } catch (e) {
      const msg = e?.message || 'Unable to start payment.';
      setExpiredMsg(msg);
      setScreen({ name: 'expired', mode: 'transaction' });
      setApiState((s) => ({ ...s, lastCallError: msg }));
    }
  }

  async function verifyTransaction() {
    if (!challenge) return;
    setVerifyPending(true);
    setVerifyError(null);
    setInputShake(false);

    const registerInputs = otpValues.map((v) => Number(v));
    if (registerInputs.some((n) => !Number.isFinite(n))) {
      setInputShake(true);
      setVerifyError('Enter all five register values.');
      setVerifyPending(false);
      return;
    }

    setApiState({ lastCallLabel: 'POST /api/payments/confirm', lastCallAt: Date.now() });

    try {
      // show processing screen while the backend verifies + calls Razorpay
      setScreen({ name: 'processing' });

      const result = await apiPost('/api/payments/confirm', {
        transactionId: txDraft.transactionId,
        sessionId: challenge.sessionId,
        registerInputs,
      });

      setApiState((s) => ({ ...s, lastCallResponse: result }));
      setSuccessData(result);
      setScreen({ name: 'success' });
      setVerifyPending(false);
    } catch (e) {
      const msg = e?.message || String(e);
      setApiState((s) => ({ ...s, lastCallError: msg }));

      const isExpired = /expired|session|time/i.test(msg);
      if (isExpired) {
        setExpiredMsg(msg);
        setScreen({ name: 'expired', mode: 'transaction' });
      } else {
        // go back to challenge screen to show the error rather than staying on processing
        setScreen({ name: 'challenge', mode: 'transaction' });
        setInputShake(true);
        setVerifyError(msg);
      }
      setVerifyPending(false);
    }
  }

  async function startRecovery(email) {
    resetChallengeState();
    setApiState({ lastCallLabel: 'POST /api/recovery/start', lastCallAt: Date.now() });
    try {
      const result = await apiPost('/api/recovery/start', { email });
      setChallenge(result);
      setScreen({ name: 'recoveryChallenge', mode: 'recovery' });
      setApiState((s) => ({ ...s, lastCallResponse: result }));
    } catch (e) {
      const msg = e?.message || 'Recovery failed.';
      setExpiredMsg(msg);
      setScreen({ name: 'expired', mode: 'recovery' });
      setApiState((s) => ({ ...s, lastCallError: msg }));
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
        </div>
      </header>

      <main className="stage">
        <div className="phoneFrame">
          <div className="phoneNotch" />

          {screen.name === 'transactionForm' ? (
            <section className="screen fadeIn">
              <div className="screenEyebrow">New transfer</div>
              <h1 className="screenTitle">Send money</h1>
              <p className="screenMuted">Enter the amount and recipient to begin.</p>

              <div className="amountField">
                <span className="amountCurrency">₹</span>
                <input
                  className="amountInput"
                  type="number"
                  min={1}
                  value={txDraft.amount}
                  onChange={(e) => setTxDraft((d) => ({ ...d, amount: Number(e.target.value) }))}
                />
              </div>

              <label className="field">
                <span className="fieldLabel">Recipient name</span>
                <input
                  className="fieldInput"
                  value={txDraft.recipientName}
                  onChange={(e) => setTxDraft((d) => ({ ...d, recipientName: e.target.value }))}
                />
              </label>

              <label className="field">
                <span className="fieldLabel">Account number</span>
                <input
                  className="fieldInput"
                  value={txDraft.recipientAccountNumber}
                  onChange={(e) => setTxDraft((d) => ({ ...d, recipientAccountNumber: e.target.value }))}
                />
              </label>

              <label className="field">
                <span className="fieldLabel">IFSC code</span>
                <input
                  className="fieldInput"
                  value={txDraft.recipientIfsc}
                  onChange={(e) => setTxDraft((d) => ({ ...d, recipientIfsc: e.target.value.toUpperCase() }))}
                />
              </label>

              <label className="field">
                <span className="fieldLabel">Reference (optional)</span>
                <input
                  className="fieldInput"
                  value={txDraft.reference}
                  onChange={(e) => setTxDraft((d) => ({ ...d, reference: e.target.value }))}
                />
              </label>

              <div className="summaryLine">
                <span>Account</span><span>{txDraft.recipientAccountNumber ? `········${txDraft.recipientAccountNumber.slice(-4)}` : '—'}</span>
              </div>

              <button className="btnPrimary" onClick={() => setScreen({ name: 'transactionConfirm' })}>
                Review transfer <ArrowIcon />
              </button>

              <button className="btnGhost" onClick={() => setScreen({ name: 'recoveryForm' })}>
                Recover account instead
              </button>
            </section>
          ) : null}

          {screen.name === 'transactionConfirm' ? (
            <section className="screen fadeIn">
              <div className="screenEyebrow">Confirm</div>
              <h1 className="screenTitle">Review &amp; send</h1>

              <div className="receiptCard">
                <div className="receiptAmount">{formatAmountINR(txDraft.amount)}</div>
                <div className="receiptTo">to {txDraft.recipientName}</div>
                <div className="receiptDivider" />
                <div className="receiptRow"><span>Bank</span><span>ICICI Bank</span></div>
                <div className="receiptRow"><span>Account</span><span>········5678</span></div>
                <div className="receiptRow"><span>Reference</span><span className="mono">{txDraft.transactionId}</span></div>
              </div>

              <div className="protectedNotice">
                <ShieldIcon size={16} />
                <div>
                  <div className="protectedTitle">Visual Password required</div>
                  <div className="protectedText">Verify with your personal challenge to authorize this payment.</div>
                </div>
              </div>

              <button className="btnPrimary" onClick={startTransaction} disabled={verifyPending}>
                {verifyPending ? 'Preparing challenge…' : 'Continue to verification'}
              </button>

              {expiredMsg ? <div className="warnCard">{expiredMsg}</div> : null}

              <button className="btnGhost" onClick={() => setScreen({ name: 'transactionForm' })}>
                Back
              </button>
            </section>
          ) : null}

          {screen.name === 'challenge' || screen.name === 'recoveryChallenge' ? (
            <section className="screen fadeIn">
              <div className="screenEyebrow">Verify</div>
              <h1 className="screenTitle">Visual Password</h1>
              <p className="screenMuted">Find your word, then complete your register row.</p>

              <ChallengeGrid masks={maskOnlyGrid(challenge?.challengeGrid)} />

              <RegisterLetters
                letters={challenge?.registerLetters || []}
                values={otpValues}
                onChange={(next) => {
                  setOtpValues(next);
                  if (inputShake) setInputShake(false);
                  setVerifyError(null);
                }}
                error={!!verifyError}
              />

              <button
                className={`btnPrimary ${verifyPending ? 'btnDisabled' : ''}`}
                onClick={verifyTransaction}
                disabled={verifyPending}
              >
                {verifyPending ? (
                  <span className="spinnerWrap"><span className="spinner" />Verifying…</span>
                ) : (
                  'Authorize payment'
                )}
              </button>

              {verifyError ? <div className="errorInline">{verifyError}</div> : null}

              <div className="finePrint">This step confirms it's really you — never share these values.</div>
            </section>
          ) : null}

          {screen.name === 'success' ? (
            <section className="screen fadeIn">
              <div className="successWrap">
                <div className="successCheck">✓</div>
                <div className="successTitle">Payment sent</div>
                <div className="successSub">{formatAmountINR(Number(successData?.amount || txDraft.amount))} to {txDraft.recipientName}</div>
              </div>

              {screen.name === 'processing' ? (
                <section className="screen fadeIn">
                  <div className="successWrap">
                    <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderColor: 'rgba(11,30,61,0.15)', borderTopColor: 'var(--navy)' }} />
                    <div className="successTitle" style={{ marginTop: 12 }}>Processing payment</div>
                    <div className="successSub">Verifying and transferring funds — this takes a few seconds.</div>
                  </div>
                </section>
              ) : null}

              <div className="receiptCard">
                <div className="receiptRow"><span>Recipient</span><span>{txDraft.recipientName}</span></div>
                <div className="receiptRow"><span>Amount</span><span>{formatAmountINR(Number(successData?.amount || txDraft.amount))}</span></div>
                <div className="receiptRow"><span>Reference</span><span className="mono">{successData?.transactionId || txDraft.transactionId}</span></div>
                <div className="receiptRow"><span>Payout ID</span><span className="mono">{successData?.payoutId || '—'}</span></div>
              </div>

              <button className="btnPrimary" onClick={() => setScreen({ name: 'transactionForm' })}>
                Done
              </button>
            </section>
          ) : null}

          {screen.name === 'expired' ? (
            <section className="screen fadeIn">
              <div className="warnIcon">!</div>
              <h1 className="screenTitle">Verification expired</h1>
              <div className="warnCard">{expiredMsg || 'This challenge is no longer valid. Start again to continue.'}</div>
              <button className="btnPrimary" onClick={() => setScreen({ name: 'transactionConfirm' })}>
                Try again
              </button>
              <button className="btnGhost" onClick={() => setScreen({ name: 'transactionForm' })}>
                Back to payment
              </button>
            </section>
          ) : null}

          {screen.name === 'recoveryForm' ? (
            <section className="screen fadeIn">
              <div className="screenEyebrow">Recovery</div>
              <h1 className="screenTitle">Recover your account</h1>
              <p className="screenMuted">Recovery uses your Visual Password to confirm it's you.</p>

              <label className="field">
                <span className="fieldLabel">Email</span>
                <input
                  className="fieldInput"
                  type="email"
                  defaultValue={txDraft.email}
                  onChange={(e) => setTxDraft((d) => ({ ...d, email: e.target.value }))}
                />
              </label>

              <button className="btnPrimary" onClick={() => startRecovery(txDraft.email)}>
                Send verification
              </button>

              <button className="btnGhost" onClick={() => setScreen({ name: 'transactionForm' })}>
                Back
              </button>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
button,input{font-family:inherit;}

:root{
  --navy:#0B1E3D;
  --navy-2:#122A52;
  --gold:#C9A24B;
  --paper:#F6F4EF;
  --ink:#0F1720;
  --mute:#5B6472;
  --line:#E4E1D8;
  --good:#1B7A4A;
  --danger:#B3413A;
}

.appRoot{min-height:100vh;background:var(--paper);color:var(--ink);font-family:'Inter',sans-serif;display:flex;flex-direction:column;}

.topHeader{display:flex;align-items:center;justify-content:space-between;padding:18px 28px;background:var(--navy);color:#fff;}
.brand{display:flex;align-items:center;gap:12px;}
.shieldWrap{width:36px;height:36px;border-radius:10px;background:rgba(201,162,75,0.16);border:1px solid rgba(201,162,75,0.35);color:var(--gold);display:flex;align-items:center;justify-content:center;}
.brandName{font-family:'Fraunces',serif;font-weight:600;font-size:1.05rem;letter-spacing:0.01em;}
.brandSub{font-size:0.72rem;color:rgba(255,255,255,0.55);letter-spacing:0.03em;}
.headerMeta{display:flex;align-items:center;gap:8px;font-size:0.76rem;color:rgba(255,255,255,0.6);}
.statusDot{width:7px;height:7px;border-radius:50%;background:#3ED598;box-shadow:0 0 0 3px rgba(62,213,152,0.18);}

.stage{flex:1;display:flex;align-items:center;justify-content:center;padding:40px 20px;}

.phoneFrame{position:relative;width:392px;max-width:100%;background:#fff;border-radius:28px;border:1px solid var(--line);box-shadow:0 20px 60px rgba(11,30,61,0.12),0 2px 8px rgba(11,30,61,0.06);padding:34px 26px 28px;min-height:600px;display:flex;flex-direction:column;}
.phoneNotch{position:absolute;top:14px;left:50%;transform:translateX(-50%);width:60px;height:5px;border-radius:99px;background:var(--line);}

.screen{display:flex;flex-direction:column;gap:14px;flex:1;padding-top:10px;}
.fadeIn{animation:fadeUp 0.32s ease both;}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}

.screenEyebrow{font-size:0.7rem;font-weight:600;color:var(--gold);letter-spacing:0.12em;text-transform:uppercase;}
.screenTitle{font-family:'Fraunces',serif;font-weight:600;font-size:1.55rem;color:var(--navy);letter-spacing:-0.01em;margin-top:-4px;}
.screenMuted{font-size:0.85rem;color:var(--mute);line-height:1.55;margin-top:-6px;}

.amountField{display:flex;align-items:baseline;gap:6px;padding:18px 18px;border:1.5px solid var(--line);border-radius:14px;background:var(--paper);margin-top:4px;}
.amountCurrency{font-family:'Fraunces',serif;font-size:1.6rem;color:var(--navy);font-weight:600;}
.amountInput{border:none;background:transparent;outline:none;font-family:'Fraunces',serif;font-size:2rem;font-weight:600;color:var(--navy);width:100%;}
.amountInput::-webkit-outer-spin-button,.amountInput::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}

.field{display:flex;flex-direction:column;gap:6px;}
.fieldLabel{font-size:0.72rem;font-weight:600;color:var(--mute);letter-spacing:0.04em;text-transform:uppercase;}
.fieldInput{padding:12px 14px;border-radius:11px;border:1.5px solid var(--line);background:#fff;font-size:0.92rem;color:var(--ink);outline:none;transition:border-color .15s,box-shadow .15s;}
.fieldInput:focus{border-color:var(--navy);box-shadow:0 0 0 3px rgba(11,30,61,0.08);}

.summaryCard,.receiptCard{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:9px;}
.summaryLine,.receiptRow{display:flex;justify-content:space-between;font-size:0.85rem;color:var(--mute);}
.summaryLine span:last-child,.receiptRow span:last-child{color:var(--ink);font-weight:500;}
.summaryLine.total{font-weight:700;color:var(--navy);}
.summaryLine.total span:last-child{font-family:'Fraunces',serif;font-size:1.1rem;color:var(--navy);}
.summaryDivider,.receiptDivider{height:1px;background:var(--line);margin:2px 0;}
.mono{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:0.78rem;}

.receiptAmount{font-family:'Fraunces',serif;font-weight:600;font-size:2rem;color:var(--navy);text-align:center;}
.receiptTo{text-align:center;font-size:0.86rem;color:var(--mute);margin-top:-4px;}

.protectedNotice{display:flex;gap:10px;align-items:flex-start;padding:13px 15px;border-radius:12px;background:rgba(11,30,61,0.05);border:1px solid rgba(11,30,61,0.12);color:var(--navy);}
.protectedTitle{font-size:0.84rem;font-weight:700;}
.protectedText{font-size:0.78rem;color:var(--mute);line-height:1.5;margin-top:2px;}

.btnPrimary{width:100%;padding:14px;border-radius:12px;border:none;background:var(--navy);color:#fff;font-weight:600;font-size:0.92rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform .15s,box-shadow .15s,opacity .15s;box-shadow:0 8px 20px rgba(11,30,61,0.18);}
.btnPrimary:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 10px 26px rgba(11,30,61,0.26);}
.btnPrimary:disabled{opacity:0.5;cursor:not-allowed;transform:none;}
.btnGhost{width:100%;padding:11px;border-radius:12px;border:none;background:transparent;color:var(--mute);font-size:0.86rem;font-weight:500;cursor:pointer;transition:color .15s;}
.btnGhost:hover{color:var(--navy);}

.warnCard{padding:12px 14px;border-radius:11px;background:rgba(179,65,58,0.08);border:1px solid rgba(179,65,58,0.22);color:var(--danger);font-size:0.83rem;line-height:1.5;}
.warnIcon{width:48px;height:48px;border-radius:50%;background:rgba(179,65,58,0.1);border:1.5px solid rgba(179,65,58,0.28);color:var(--danger);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-weight:700;font-size:1.3rem;margin-bottom:2px;}

.challengeGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.challengeCard{border:1.5px solid var(--line);border-radius:11px;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;background:#fff;animation:fadeUp 0.3s ease both;}
.challengeMask{font-family:'Fraunces',serif;font-weight:600;font-size:0.98rem;color:var(--navy);letter-spacing:0.02em;}
.challengeValue{font-size:1.15rem;font-weight:700;color:var(--gold);}

.registerBlock{display:flex;flex-direction:column;gap:8px;}
.registerLabels{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
.registerLabel{text-align:center;font-size:0.78rem;font-weight:700;color:var(--navy);background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:6px 0;}
.otpRow{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
.otpBox{aspect-ratio:1;border-radius:10px;border:1.5px solid var(--line);text-align:center;font-size:1.2rem;font-weight:700;color:var(--navy);outline:none;transition:border-color .15s,box-shadow .15s;}
.otpBox:focus{border-color:var(--navy);box-shadow:0 0 0 3px rgba(11,30,61,0.1);}
.otpDisabled{background:#f1f1f1;color:#9ca3af;}
.shake{animation:shakeX 0.35s ease;}
@keyframes shakeX{0%,100%{transform:translateX(0);}25%{transform:translateX(-5px);}75%{transform:translateX(5px);}}
.errorText{font-size:0.78rem;color:var(--danger);}

.errorInline{padding:10px 13px;border-radius:10px;background:rgba(179,65,58,0.08);border:1px solid rgba(179,65,58,0.2);color:var(--danger);font-size:0.82rem;}
.finePrint{font-size:0.74rem;color:var(--mute);text-align:center;line-height:1.5;}

.spinnerWrap{display:flex;align-items:center;gap:8px;}
.spinner{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;animation:spin 0.7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

.successWrap{display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px 0 6px;text-align:center;}
.successCheck{width:60px;height:60px;border-radius:50%;background:rgba(27,122,74,0.1);border:2px solid rgba(27,122,74,0.3);color:var(--good);display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:700;}
.successTitle{font-family:'Fraunces',serif;font-weight:600;font-size:1.3rem;color:var(--navy);}
.successSub{font-size:0.85rem;color:var(--mute);}

.tokenDetails{margin-top:4px;font-size:0.78rem;color:var(--mute);cursor:pointer;}
.tokenValue{margin-top:6px;word-break:break-all;font-size:0.72rem;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px;}

@media(max-width:420px){.phoneFrame{padding:30px 18px 22px;}}
`;