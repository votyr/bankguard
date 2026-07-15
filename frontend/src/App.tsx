import React, { useEffect, useMemo, useRef, useState } from 'react';

type ApiState = {
  lastCallLabel?: string;
  lastCallAt?: number;
  lastCallError?: string;
  lastCallResponse?: any;
};

type TransactionChallenge = {
  sessionId: string;
  registerLetters?: string[];
  challengeGrid?: Array<{ mask: string }>;
  verificationToken?: string;
  amountCode?: string;
  recipientCode?: string;
  expiry?: string | number;
};

type TransactionVerifyResult = {
  success?: boolean;
  error?: string;
  transactionId?: string;
  verificationToken?: string;
  recipientName?: string;
  amount?: number;
};

type RecoveryStartResult = any;

type Screen =
  | { name: 'transactionForm' }
  | { name: 'transactionConfirm' }
  | { name: 'challenge'; mode: 'transaction' }
  | { name: 'success' }
  | { name: 'expired'; mode: 'transaction' | 'recovery' }
  | { name: 'recoveryForm' }
  | { name: 'recoveryChallenge'; mode: 'recovery' }
  | { name: 'recoverySuccess' };

const baseApiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function apiPost(path: string, body: any) {
  const response = await fetch(`${baseApiUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

function ShieldIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2.5c3.6 2.6 7.4 2.7 9 2.7V12c0 6-4.3 9.3-9 10.5C7.3 21.3 3 18 3 12V5.2c1.6 0 5.4-.1 9-2.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8.2 12.2l2.2 2.2 5.4-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function formatAmountINR(amount: number) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  } catch {
    return `₹${amount}`;
  }
}

function maskOnlyGrid(grid?: Array<{ mask: string }>) {
  const arr = Array.isArray(grid) ? grid : [];
  const nine = arr.slice(0, 9);
  while (nine.length < 9) nine.push({ mask: '' });
  return nine;
}

function OTPInputs({ count, values, onChange, disabled }: { count: number; values: string[]; onChange: (next: string[]) => void; disabled?: boolean }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const firstEmpty = values.findIndex((v) => !v);
    if (firstEmpty !== -1 && !disabled) refs.current[firstEmpty]?.focus();
  }, [disabled]);

  return (
    <div className="otpRow">
      {Array.from({ length: count }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => {
            refs.current[idx] = el;
          }}
          className={`otpBox ${disabled ? 'otpDisabled' : ''}`}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={values[idx] || ''}
          disabled={disabled}
          aria-label={`Register digit ${idx + 1}`}
          onFocus={(e) => e.currentTarget.classList.add('otpFocusGlow')}
          onBlur={(e) => e.currentTarget.classList.remove('otpFocusGlow')}
          onChange={(e) => {
            const raw = e.target.value;
            const digit = raw.replace(/\D/g, '').slice(-1);
            const next = [...values];
            next[idx] = digit;
            onChange(next);
            if (digit && idx < count - 1 && !disabled) refs.current[idx + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              const next = [...values];
              if (next[idx]) {
                next[idx] = '';
                onChange(next);
              } else if (idx > 0) {
                next[idx - 1] = '';
                onChange(next);
                refs.current[idx - 1]?.focus();
              }
            } else if (e.key === 'ArrowLeft' && idx > 0) {
              refs.current[idx - 1]?.focus();
            } else if (e.key === 'ArrowRight' && idx < count - 1) {
              refs.current[idx + 1]?.focus();
            } else if (!/^[0-9]$/.test(e.key) && e.key !== 'Tab') {
              e.preventDefault();
            }
          }}
        />
      ))}
    </div>
  );
}

function RegisterLetters({ letters, values, onChange, error }: { letters: string[]; values: string[]; onChange: (next: string[]) => void; error?: boolean }) {
  return (
    <div className={`registerBlock ${error ? 'shake' : ''}`}>
      <div className="registerLabels">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="registerLabel">
            {letters?.[idx] ? `Register ${letters[idx]}` : `Register ${idx + 1}`}
          </div>
        ))}
      </div>
      <OTPInputs count={5} values={values} onChange={onChange} disabled={false} />
      {error ? <div className="errorText">Incorrect register values. Please try again.</div> : null}
    </div>
  );
}

function ChallengeGrid({ masks }: { masks: Array<{ mask: string }> }) {
  return (
    <div className="challengeGrid" aria-label="Visual Password challenge grid">
      {masks.map((cell, i) => (
        <div key={i} className="challengeCard fadeIn">
          <div className="challengeMask">{cell.mask}</div>
        </div>
      ))}
    </div>
  );
}

function CollapsibleDevPanel({ open, onToggle, apiState, details }: { open: boolean; onToggle: () => void; apiState: ApiState; details: any }) {
  return (
    <aside className={`devPanel ${open ? 'devOpen' : 'devClosed'}`}>
      <div className="devHeader">
        <div>
          <div className="devTitle">Developer Panel</div>
          <div className="devSub">Live SDK status & responses</div>
        </div>
        <button className="devToggle" onClick={onToggle} aria-expanded={open}>
          {open ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {open ? (
        <div className="devBody">
          <div className="devGrid">
            <div className="devItem">
              <div className="devKey">Session ID</div>
              <div className="devVal">{details?.sessionId || '—'}</div>
            </div>
            <div className="devItem">
              <div className="devKey">Register Letters</div>
              <div className="devVal">{Array.isArray(details?.registerLetters) ? details.registerLetters.join(', ') : '—'}</div>
            </div>
            <div className="devItem">
              <div className="devKey">Challenge Grid JSON</div>
              <div className="devVal pre">{details?.challengeGridJson ? JSON.stringify(details.challengeGridJson, null, 2) : '—'}</div>
            </div>
            <div className="devItem">
              <div className="devKey">Verification Token</div>
              <div className="devVal">{details?.verificationToken || '—'}</div>
            </div>
            <div className="devItem">
              <div className="devKey">Expiry</div>
              <div className="devVal">{details?.expiry || '—'}</div>
            </div>
          </div>

          <div className="devRaw">
            <div className="devKey">Last API call</div>
            <div className="devMeta">
              <span>{apiState.lastCallLabel || '—'}</span>
              <span className="dot">•</span>
              <span>{apiState.lastCallAt ? new Date(apiState.lastCallAt).toLocaleTimeString() : '—'}</span>
            </div>
            {apiState.lastCallError ? <div className="devError pre">{apiState.lastCallError}</div> : null}
            {apiState.lastCallResponse ? <div className="devResponse pre">{JSON.stringify(apiState.lastCallResponse, null, 2)}</div> : null}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

export default function App() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [screen, setScreen] = useState<Screen>({ name: 'transactionForm' });

  const [apiState, setApiState] = useState<ApiState>({});
  const [challenge, setChallenge] = useState<TransactionChallenge | null>(null);
  const [recoveryResult, setRecoveryResult] = useState<RecoveryStartResult | null>(null);

  const [txDraft, setTxDraft] = useState({
    email: 'bankguard@mail.com',
    transactionId: '',
    amount: 500000,
    recipientName: 'Rahul Sharma',
  });

  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '']);
  const [verifyPending, setVerifyPending] = useState(false);
  const [inputShake, setInputShake] = useState(false);

  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [expiredMsg, setExpiredMsg] = useState<string | null>(null);

  const [successData, setSuccessData] = useState<TransactionVerifyResult | null>(null);

  const devDetails = useMemo(() => {
    if (!challenge) return { challengeGridJson: null };
    return {
      sessionId: challenge.sessionId,
      registerLetters: challenge.registerLetters,
      challengeGridJson: challenge.challengeGrid,
      verificationToken: challenge.verificationToken,
      expiry: challenge.expiry,
    };
  }, [challenge]);

  function resetChallengeState() {
    setOtpValues(['', '', '', '', '']);
    setVerifyPending(false);
    setInputShake(false);
    setVerifyError(null);
    setExpiredMsg(null);
    setSuccessData(null);
    setRecoveryResult(null);
  }

  useEffect(() => {
    // default transaction id
    setTxDraft((d) => ({ ...d, transactionId: `BANK-${Date.now()}` }));
  }, []);

  async function startTransaction() {
    resetChallengeState();
    setApiState({ lastCallLabel: 'POST /api/transactions/challenge', lastCallAt: Date.now(), lastCallResponse: undefined, lastCallError: undefined });
    try {
      const result = await apiPost('/api/transactions/challenge', {
        email: txDraft.email,
        transactionId: txDraft.transactionId,
        amount: Number(txDraft.amount),
        recipientName: txDraft.recipientName,
      });
      setChallenge(result);
      setScreen({ name: 'challenge', mode: 'transaction' });
      setApiState((s) => ({ ...s, lastCallResponse: result }));
    } catch (e: any) {
      setExpiredMsg(e?.message || 'Challenge failed.');
      setScreen({ name: 'expired', mode: 'transaction' });
      setApiState((s) => ({ ...s, lastCallError: e?.message || String(e) }));
    }
  }

  async function verifyTransaction() {
    if (!challenge) return;
    setVerifyPending(true);
    setVerifyError(null);
    setInputShake(false);

    setApiState({ lastCallLabel: 'POST /api/transactions/verify', lastCallAt: Date.now(), lastCallResponse: undefined, lastCallError: undefined });

    const registerInputs = otpValues.map((v) => Number(v));
    if (registerInputs.some((n) => !Number.isFinite(n))) {
      setInputShake(true);
      setVerifyError('Enter all five register values.');
      setVerifyPending(false);
      return;
    }

    try {
      const result = await apiPost('/api/transactions/verify', {
        sessionId: challenge.sessionId,
        registerInputs,
      });
      setApiState((s) => ({ ...s, lastCallResponse: result }));
      setSuccessData(result);
      setScreen({ name: 'success' });
      setVerifyPending(false);
    } catch (e: any) {
      const msg = e?.message || String(e);
      setApiState((s) => ({ ...s, lastCallError: msg }));

      const isExpired = /expired|session|time/i.test(msg);
      if (isExpired) {
        setExpiredMsg(msg);
        setScreen({ name: 'expired', mode: 'transaction' });
      } else {
        setInputShake(true);
        setVerifyError(msg);
      }
      setVerifyPending(false);
    }
  }

  async function startRecovery(email: string) {
    resetChallengeState();
    setApiState({ lastCallLabel: 'POST /api/recovery/start', lastCallAt: Date.now(), lastCallResponse: undefined, lastCallError: undefined });
    try {
      const result = await apiPost('/api/recovery/start', { email });
      setRecoveryResult(result);
      // backend likely returns same challenge shape
      setChallenge(result);
      setScreen({ name: 'recoveryChallenge', mode: 'recovery' });
      setApiState((s) => ({ ...s, lastCallResponse: result }));
    } catch (e: any) {
      setExpiredMsg(e?.message || 'Recovery failed.');
      setScreen({ name: 'expired', mode: 'recovery' });
      setApiState((s) => ({ ...s, lastCallError: e?.message || String(e) }));
    }
  }

  return (
    <div className="appRoot">
      <header className="topHeader">
        <div className="brand">
          <div className="shieldWrap">
            <ShieldIcon size={20} />
          </div>
          <div>
            <div className="brandName">BankGuard</div>
            <div className="brandSub">Powered by Scam2Safe SDK</div>
          </div>
        </div>
      </header>

      <div className="layout">
        <main className="left">
          <div className="phoneFrame">
            {/* Transaction form */}
            {screen.name === 'transactionForm' ? (
              <section className="screen">
                <div className="screenTitle">New transfer</div>
                <div className="screenMuted">Confirm the payment details to start Visual Password verification.</div>

                <div className="formGrid">
                  <label className="field">
                    <span className="fieldLabel">Amount</span>
                    <input
                      className="fieldInput"
                      type="number"
                      min={1}
                      value={txDraft.amount}
                      onChange={(e) => setTxDraft((d) => ({ ...d, amount: Number(e.target.value) }))}
                    />
                  </label>

                  <label className="field">
                    <span className="fieldLabel">Recipient</span>
                    <input
                      className="fieldInput"
                      value={txDraft.recipientName}
                      onChange={(e) => setTxDraft((d) => ({ ...d, recipientName: e.target.value }))}
                    />
                  </label>
                </div>

                <div className="confirmCard">
                  <div className="confirmRow">
                    <div className="confirmLabel">Recipient</div>
                    <div className="confirmValue">{txDraft.recipientName}</div>
                  </div>
                  <div className="confirmRow">
                    <div className="confirmLabel">Bank</div>
                    <div className="confirmValue">ICICI Bank</div>
                  </div>
                  <div className="confirmRow">
                    <div className="confirmLabel">Account</div>
                    <div className="confirmValue">********5678</div>
                  </div>
                  <div className="confirmRow">
                    <div className="confirmLabel">Amount</div>
                    <div className="confirmValue amount">{formatAmountINR(txDraft.amount)}</div>
                  </div>
                </div>

                <button className="primaryBtn" onClick={() => setScreen({ name: 'transactionConfirm' })}>
                  Continue
                </button>

                <button className="secondaryLink" onClick={() => setScreen({ name: 'recoveryForm' })}>
                  Passkey Recovery
                </button>
              </section>
            ) : null}

            {/* Transaction confirm screen */}
            {screen.name === 'transactionConfirm' ? (
              <section className="screen">
                <div className="screenTitle">Payment confirmation</div>
                <div className="confirmSheet">
                  <div className="sheetRow">
                    <div className="sheetLabel">Recipient</div>
                    <div className="sheetValue">{txDraft.recipientName}</div>
                  </div>
                  <div className="sheetRow">
                    <div className="sheetLabel">Bank</div>
                    <div className="sheetValue">ICICI Bank</div>
                  </div>
                  <div className="sheetRow">
                    <div className="sheetLabel">Account</div>
                    <div className="sheetValue">********5678</div>
                  </div>
                  <div className="sheetRow">
                    <div className="sheetLabel">Amount</div>
                    <div className="sheetValue amount">{formatAmountINR(txDraft.amount)}</div>
                  </div>
                </div>

                <div className="protectedNotice">
                  <div className="protectedTitle">Protected by Scam2Safe</div>
                  <div className="protectedText">Complete Visual Password verification before continuing.</div>
                </div>

                <button className="primaryBtn primaryBtnBig" onClick={startTransaction} disabled={verifyPending}>
                  {verifyPending ? 'Loading…' : 'Continue Verification'}
                </button>

                {expiredMsg ? <div className="warnCard">{expiredMsg}</div> : null}

                <button className="secondaryBack" onClick={() => setScreen({ name: 'transactionForm' })}>
                  Back
                </button>
              </section>
            ) : null}

            {/* Challenge */}
            {screen.name === 'challenge' || screen.name === 'recoveryChallenge' ? (
              <section className="screen">
                <div className="screenTitle">Visual Password</div>
                <div className="challengeIntro">Enter the five values requested by the challenge.</div>

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

                <button className={`primaryBtn primaryBtnBig ${verifyPending ? 'btnDisabled' : ''}`} onClick={verifyTransaction} disabled={verifyPending}>
                  {verifyPending ? (
                    <span className="spinnerWrap">
                      <span className="spinner" />
                      Verifying…
                    </span>
                  ) : (
                    'Verify Transaction'
                  )}
                </button>

                {verifyError ? <div className="errorInline">{verifyError}</div> : null}

                <div className="finePrint">This verification protects this sensitive operation.</div>
              </section>
            ) : null}

            {/* Success */}
            {screen.name === 'success' ? (
              <section className="screen">
                <div className="successWrap fadeIn">
                  <div className="successCheck">✓</div>
                  <div className="successTitle">Transaction Verified</div>
                  <div className="successSub">Your bank transfer is confirmed.</div>
                </div>

                <div className="successSummary">
                  <div className="summaryRow">
                    <div className="summaryKey">Recipient</div>
                    <div className="summaryVal">{successData?.recipientName || txDraft.recipientName}</div>
                  </div>
                  <div className="summaryRow">
                    <div className="summaryKey">Amount</div>
                    <div className="summaryVal amount">{formatAmountINR(Number(successData?.amount || txDraft.amount))}</div>
                  </div>
                  <div className="summaryRow">
                    <div className="summaryKey">Transaction ID</div>
                    <div className="summaryVal">{successData?.transactionId || txDraft.transactionId}</div>
                  </div>
                  <details className="tokenDetails">
                    <summary>Verification Token</summary>
                    <div className="tokenValue pre">{successData?.verificationToken || challenge?.verificationToken || '—'}</div>
                  </details>
                </div>

                <button className="primaryBtn primaryBtnBig" onClick={() => setScreen({ name: 'transactionForm' })}>
                  Continue
                </button>
              </section>
            ) : null}

            {/* Expired */}
            {screen.name === 'expired' ? (
              <section className="screen">
                <div className="warnTitle">Challenge expired</div>
                <div className="warnCard">{expiredMsg || 'This Visual Password challenge is no longer valid.'}</div>
                <button
                  className="primaryBtn primaryBtnBig"
                  onClick={() => {
                    setScreen({ name: 'transactionConfirm' });
                  }}
                >
                  Restart Verification
                </button>
                <button className="secondaryBack" onClick={() => setScreen({ name: 'transactionForm' })}>
                  Back to payment
                </button>
              </section>
            ) : null}

            {/* Recovery form */}
            {screen.name === 'recoveryForm' ? (
              <section className="screen">
                <div className="screenTitle">Recover your passkey</div>
                <div className="screenMuted">Recovery requires both email OTP and your Visual Password.</div>

                <div className="formGrid">
                  <label className="field">
                    <span className="fieldLabel">Email</span>
                    <input
                      className="fieldInput"
                      type="email"
                      defaultValue="demo@bankguard.local"
                      onChange={(e) => setTxDraft((d) => ({ ...d, email: e.target.value }))}
                    />
                  </label>
                </div>

                <button className="primaryBtn primaryBtnBig" onClick={() => startRecovery(txDraft.email)}>
                  Send OTP
                </button>

                <button className="secondaryBack" onClick={() => setScreen({ name: 'transactionForm' })}>
                  Back
                </button>
              </section>
            ) : null}

            {/* Recovery challenge reuses same UI */}
          </div>
        </main>

        <CollapsibleDevPanel
          open={panelOpen}
          onToggle={() => setPanelOpen((v) => !v)}
          apiState={apiState}
          details={devDetails}
        />
      </div>
    </div>
  );
}

