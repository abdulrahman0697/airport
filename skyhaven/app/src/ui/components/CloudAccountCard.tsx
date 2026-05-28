/**
 * Cloud-save account card (BRD §11).
 *
 * Extracted from OfficePanel during Design Review v2 (X8 split) so it
 * can live in the new Settings panel without the Office screen feeling
 * like a settings page.
 */
import { useState } from 'react';
import { signInWithGoogle, signOut } from '../../backend/auth';
import { useAuth } from '../../backend/useAuth';

export function CloudAccountCard() {
  const user = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = async (): Promise<void> => {
    setBusy(true); setError(null);
    const res = await signInWithGoogle();
    setBusy(false);
    if (!res.ok) setError(`${res.code}: ${res.message}`);
  };
  const onSignOut = async (): Promise<void> => {
    setBusy(true); setError(null);
    await signOut();
    setBusy(false);
  };

  const status =
    !user ? 'Offline' :
    user.providerId === 'google.com' ? 'Cloud sync enabled' :
    'Anonymous device sync';
  const statusColor =
    !user ? '#94A3B8' :
    user.providerId === 'google.com' ? '#34D399' :
    '#5AC8FA';

  return (
    <section style={card}>
      <div style={sectionHead}>Cloud Save</div>
      <div style={row}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: statusColor }}>{status}</div>
          <div style={subStat}>
            {!user
              ? 'Trying to connect — local progress is always safe.'
              : user.providerId === 'google.com'
                ? `Signed in as ${user.displayName ?? user.email ?? user.uid.slice(0, 8)}`
                : 'Sign in to keep your progress across devices.'}
          </div>
        </div>
        {user?.providerId === 'google.com' ? (
          <button onClick={(): void => { void onSignOut(); }} disabled={busy} style={btnSecondary}>
            Sign out
          </button>
        ) : (
          <button onClick={(): void => { void onSignIn(); }} disabled={busy} style={btnPrimary}>
            {busy ? '…' : 'Sign in with Google'}
          </button>
        )}
      </div>
      {error && <div style={errorText}>{error}</div>}
    </section>
  );
}

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 12, padding: '12px 14px',
  border: '1px solid rgba(255,255,255,0.06)',
};
const sectionHead: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: '#94A3B8', fontWeight: 700, marginBottom: 8,
};
const row: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
};
const subStat: React.CSSProperties = { marginTop: 8, color: '#94A3B8', fontSize: 11 };
const btnPrimary: React.CSSProperties = {
  background: '#5AC8FA', color: '#0B1120', border: 0,
  borderRadius: 8, padding: '10px 14px', fontWeight: 700,
  cursor: 'pointer', minHeight: 40, fontFamily: 'inherit',
  fontSize: 12, whiteSpace: 'nowrap',
};
const btnSecondary: React.CSSProperties = {
  background: 'transparent', color: '#94A3B8',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8, padding: '8px 14px', minHeight: 36,
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
};
const errorText: React.CSSProperties = {
  marginTop: 8, padding: '6px 10px', fontSize: 11, color: '#F87171',
  background: 'rgba(248,113,113,0.08)', borderRadius: 6,
};
