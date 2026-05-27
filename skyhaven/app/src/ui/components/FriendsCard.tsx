/**
 * Friends section for the Office panel (BRD §12.2).
 *
 * Three sub-views in one card:
 *  - Your friend code (with copy-to-clipboard)
 *  - Send a request by entering someone else's code
 *  - Live list of incoming requests + accepted friends
 *
 * The list is driven by a Firestore snapshot subscription so it
 * updates in real time as friends accept / decline.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../../backend/useAuth';
import {
  acceptFriendRequest,
  claimFriendCode,
  declineFriendRequest,
  sendFriendRequest,
  subscribeFriendships,
  unfriend,
  type Friendship,
} from '../../backend/friends';
import { fetchProfile, type PublicProfile } from '../../backend/profiles';
import { formatCash } from '../format';

export function FriendsCard() {
  const user = useAuth();
  const [myCode, setMyCode] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [sendNote, setSendNote] = useState<string | null>(null);
  const [friendships, setFriendships] = useState<readonly Friendship[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PublicProfile | null>>({});

  // First open: claim a code so the player has something to share.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setClaiming(true);
    void (async () => {
      const code = await claimFriendCode();
      if (!cancelled) {
        setMyCode(code);
        setClaiming(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Live friendships subscription.
  useEffect(() => {
    if (!user) { setFriendships([]); return; }
    const unsub = subscribeFriendships(setFriendships);
    return () => { unsub?.(); };
  }, [user]);

  // Lazy-fetch the public profile for each "other" uid in the list,
  // so the row can show the friend's airline name.
  useEffect(() => {
    const toFetch = friendships
      .map((f) => f.otherUid)
      .filter((u) => !(u in profiles));
    if (toFetch.length === 0) return;
    void (async () => {
      const fetched = await Promise.all(toFetch.map((u) => fetchProfile(u).then((p) => [u, p] as const)));
      setProfiles((cur) => {
        const next = { ...cur };
        for (const [u, p] of fetched) next[u] = p;
        return next;
      });
    })();
  }, [friendships, profiles]);

  const incoming = friendships.filter(
    (f) => f.status === 'pending' && user && f.requestedByUid !== user.uid,
  );
  const outgoing = friendships.filter(
    (f) => f.status === 'pending' && user && f.requestedByUid === user.uid,
  );
  const accepted = friendships.filter((f) => f.status === 'accepted');

  const onSend = async (): Promise<void> => {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    setSendBusy(true);
    setSendNote(null);
    const res = await sendFriendRequest(code);
    setSendBusy(false);
    if (res.ok) {
      if (res.status === 'sent') setSendNote('Request sent.');
      else if (res.status === 'already-pending') setSendNote('Already pending.');
      else setSendNote('You\'re already friends.');
      setCodeInput('');
    } else {
      setSendNote(`${res.code}: ${res.message}`);
    }
  };

  const onCopy = (): void => {
    if (!myCode) return;
    void navigator.clipboard?.writeText(myCode).catch(() => undefined);
  };

  return (
    <section style={card}>
      <div style={sectionHead}>Friends</div>

      <div style={codeRow}>
        <div>
          <div style={codeKicker}>Your friend code</div>
          <div style={codeValue}>{claiming ? '…' : myCode ?? '—'}</div>
        </div>
        <button onClick={onCopy} disabled={!myCode} style={copyBtn}>Copy</button>
      </div>

      <div style={sendRow}>
        <input
          value={codeInput}
          onChange={(e): void => setCodeInput(e.target.value.toUpperCase().slice(0, 12))}
          placeholder="Enter friend code"
          style={input}
          maxLength={12}
        />
        <button onClick={(): void => { void onSend(); }} disabled={sendBusy || !codeInput.trim()} style={sendBtn}>
          {sendBusy ? '…' : 'Send'}
        </button>
      </div>
      {sendNote && <div style={note}>{sendNote}</div>}

      {incoming.length > 0 && (
        <Group label={`Incoming requests (${incoming.length})`}>
          {incoming.map((f) => (
            <Row
              key={f.id}
              friendship={f}
              profile={profiles[f.otherUid] ?? null}
              actions={
                <>
                  <button onClick={(): void => { void acceptFriendRequest(f.id); }} style={acceptBtn}>Accept</button>
                  <button onClick={(): void => { void declineFriendRequest(f.id); }} style={smallSecondaryBtn}>Decline</button>
                </>
              }
            />
          ))}
        </Group>
      )}
      {outgoing.length > 0 && (
        <Group label={`Outgoing requests (${outgoing.length})`}>
          {outgoing.map((f) => (
            <Row
              key={f.id}
              friendship={f}
              profile={profiles[f.otherUid] ?? null}
              actions={
                <button onClick={(): void => { void declineFriendRequest(f.id); }} style={smallSecondaryBtn}>Cancel</button>
              }
              pending
            />
          ))}
        </Group>
      )}
      {accepted.length > 0 && (
        <Group label={`Friends (${accepted.length})`}>
          {accepted.map((f) => (
            <Row
              key={f.id}
              friendship={f}
              profile={profiles[f.otherUid] ?? null}
              actions={
                <button onClick={(): void => { void unfriend(f.id); }} style={smallSecondaryBtn}>Unfriend</button>
              }
            />
          ))}
        </Group>
      )}
      {accepted.length === 0 && incoming.length === 0 && outgoing.length === 0 && (
        <div style={empty}>
          No friends yet. Share your code with friends or paste theirs in
          the box above.
        </div>
      )}
    </section>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={groupLabel}>{label}</div>
      <ul style={list}>{children}</ul>
    </div>
  );
}

function Row({
  friendship, profile, actions, pending,
}: {
  friendship: Friendship;
  profile: PublicProfile | null;
  actions: React.ReactNode;
  pending?: boolean;
}) {
  const tail = profile?.tailColor ?? '#5AC8FA';
  const name = profile?.airlineName ?? friendship.otherUid.slice(0, 8);
  return (
    <li style={row}>
      <span style={chip(tail)} aria-hidden />
      <div style={rowMain}>
        <div style={rowName}>{name}</div>
        {profile && (
          <div style={rowMeta}>
            T{profile.tier} · ${formatCash(profile.lifetimeEarnings)} lifetime
          </div>
        )}
        {!profile && <div style={rowMetaDim}>Loading…</div>}
      </div>
      {pending && <span style={pendingPill}>pending</span>}
      <div style={rowActions}>{actions}</div>
    </li>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 12, padding: '12px 14px',
  border: '1px solid rgba(255,255,255,0.06)',
  display: 'flex', flexDirection: 'column', gap: 10,
};
const sectionHead: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: '#94A3B8', fontWeight: 700, marginBottom: 4,
};
const codeRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
};
const codeKicker: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94A3B8',
};
const codeValue: React.CSSProperties = {
  fontSize: 22, fontWeight: 800, color: '#F4C75B',
  letterSpacing: '0.16em', fontFeatureSettings: '"tnum" 1', marginTop: 2,
};
const copyBtn: React.CSSProperties = {
  background: 'transparent', color: '#5AC8FA',
  border: '1px solid rgba(90,200,250,0.4)',
  borderRadius: 8, padding: '8px 14px', minHeight: 36,
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
};
const sendRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr auto', gap: 8,
};
const input: React.CSSProperties = {
  background: 'rgba(11,17,32,0.6)', color: '#F8FAFC',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '10px 12px', minHeight: 40,
  fontFamily: 'inherit', fontSize: 14,
  letterSpacing: '0.12em', textTransform: 'uppercase',
};
const sendBtn: React.CSSProperties = {
  background: '#5AC8FA', color: '#0B1120', border: 0,
  borderRadius: 8, padding: '0 14px', minHeight: 40,
  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
};
const note: React.CSSProperties = {
  fontSize: 11, color: '#94A3B8', padding: '4px 2px',
};
const list: React.CSSProperties = {
  listStyle: 'none', margin: 0, padding: 0,
  display: 'flex', flexDirection: 'column', gap: 6,
};
const groupLabel: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
  color: '#5AC8FA', fontWeight: 700, marginTop: 6, marginBottom: 4,
};
const row: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '14px 1fr auto auto', gap: 10,
  alignItems: 'center', padding: '10px 12px',
  background: 'rgba(11,17,32,0.5)', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.06)',
};
const chip = (color: string): React.CSSProperties => ({
  width: 12, height: 12, borderRadius: 3, background: color,
  boxShadow: `0 0 8px ${color}AA`,
});
const rowMain: React.CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0 };
const rowName: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: '#F8FAFC',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const rowMeta: React.CSSProperties = { fontSize: 11, color: '#94A3B8', marginTop: 2 };
const rowMetaDim: React.CSSProperties = { fontSize: 11, color: '#475569', marginTop: 2 };
const pendingPill: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: '#F4C75B', background: 'rgba(244,199,91,0.14)',
  border: '1px solid rgba(244,199,91,0.4)',
  padding: '2px 6px', borderRadius: 4,
};
const rowActions: React.CSSProperties = { display: 'flex', gap: 6 };
const acceptBtn: React.CSSProperties = {
  background: '#34D399', color: '#0B1120', border: 0,
  borderRadius: 6, padding: '6px 12px', minHeight: 32,
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
};
const smallSecondaryBtn: React.CSSProperties = {
  background: 'transparent', color: '#94A3B8',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 6, padding: '6px 12px', minHeight: 32,
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
};
const empty: React.CSSProperties = {
  padding: '12px 4px', textAlign: 'center', color: '#64748B', fontSize: 12,
};
