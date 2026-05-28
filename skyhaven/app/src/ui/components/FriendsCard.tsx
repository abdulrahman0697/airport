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
import { useEffect, useMemo, useState } from 'react';
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
import {
  claimGift,
  sendGift,
  subscribeInbox,
  type Gift,
  type GiftKind,
} from '../../backend/gifts';
import { fetchProfile, type PublicProfile } from '../../backend/profiles';
import { useGameStore } from '../../state/store';
import { AirlineCrest } from '../design/AirlineCrest';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';

export function FriendsCard() {
  const user = useAuth();
  const [myCode, setMyCode] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [sendNote, setSendNote] = useState<string | null>(null);
  const [friendships, setFriendships] = useState<readonly Friendship[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PublicProfile | null>>({});
  const [inbox, setInbox] = useState<readonly Gift[]>([]);
  const [giftFor, setGiftFor] = useState<{ uid: string; name: string } | null>(null);
  const credit = useGameStore((s) => s.creditGift);

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

  // Live gift inbox.
  useEffect(() => {
    if (!user) { setInbox([]); return; }
    const unsub = subscribeInbox(setInbox);
    return () => { unsub?.(); };
  }, [user]);

  const onClaimGift = async (gift: Gift): Promise<void> => {
    const res = await claimGift(gift.id);
    if (res.ok) {
      credit(res.kind, res.amount);
      haptics.success();
    } else {
      haptics.warning();
    }
  };

  // Lazy-fetch the public profile for each "other" uid (friendships
  // list + inbox senders) so rows can show airline names.
  const profileTargets = useMemo(() => {
    const set = new Set<string>();
    for (const f of friendships) set.add(f.otherUid);
    for (const g of inbox) set.add(g.fromUid);
    return Array.from(set);
  }, [friendships, inbox]);
  useEffect(() => {
    const toFetch = profileTargets.filter((u) => !(u in profiles));
    if (toFetch.length === 0) return;
    void (async () => {
      const fetched = await Promise.all(toFetch.map((u) => fetchProfile(u).then((p) => [u, p] as const)));
      setProfiles((cur) => {
        const next = { ...cur };
        for (const [u, p] of fetched) next[u] = p;
        return next;
      });
    })();
  }, [profileTargets, profiles]);

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
      {inbox.length > 0 && (
        <Group label={`Gifts in your inbox (${inbox.length})`}>
          {inbox.map((g) => (
            <li key={g.id} style={row}>
              <span style={chip(g.kind === 'cash' ? '#F4C75B' : '#5AC8FA')} aria-hidden />
              <div style={rowMain}>
                <div style={rowName}>
                  {g.kind === 'cash' ? `+$${formatCash(g.amount)}` : `+${g.amount} fuel`}
                </div>
                <div style={rowMetaDim}>
                  from {profiles[g.fromUid]?.airlineName ?? g.fromUid.slice(0, 8)}
                </div>
              </div>
              <div style={rowActions}>
                <button onClick={(): void => { void onClaimGift(g); }} style={acceptBtn}>Claim</button>
              </div>
            </li>
          ))}
        </Group>
      )}
      {accepted.length > 0 && (
        <Group label={`Friends (${accepted.length})`}>
          {accepted.map((f) => {
            const name = profiles[f.otherUid]?.airlineName ?? f.otherUid.slice(0, 8);
            return (
              <Row
                key={f.id}
                friendship={f}
                profile={profiles[f.otherUid] ?? null}
                actions={
                  <>
                    <button
                      onClick={(): void => setGiftFor({ uid: f.otherUid, name })}
                      style={giftBtn}
                    >
                      Gift
                    </button>
                    <button onClick={(): void => { void unfriend(f.id); }} style={smallSecondaryBtn}>Unfriend</button>
                  </>
                }
              />
            );
          })}
        </Group>
      )}
      {giftFor && (
        <SendGiftModal
          toUid={giftFor.uid}
          toName={giftFor.name}
          onClose={(): void => setGiftFor(null)}
        />
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

function SendGiftModal({
  toUid, toName, onClose,
}: {
  toUid: string;
  toName: string;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<GiftKind>('cash');
  const [amount, setAmount] = useState<number>(2_500);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const presets = kind === 'cash'
    ? [1_000, 2_500, 5_000, 10_000]
    : [100, 250, 500];
  // Ensure the picked amount stays in-range when the kind changes.
  useEffect(() => {
    if (kind === 'cash' && amount < 1_000) setAmount(1_000);
    if (kind === 'cash' && amount > 10_000) setAmount(10_000);
    if (kind === 'fuel' && amount < 100) setAmount(100);
    if (kind === 'fuel' && amount > 500) setAmount(500);
  }, [kind, amount]);

  const onSend = async (): Promise<void> => {
    setBusy(true);
    setNote(null);
    const res = await sendGift(toUid, kind, amount);
    setBusy(false);
    if ('ok' in res && res.ok) {
      if (res.status === 'sent') {
        haptics.success();
        onClose();
      } else {
        setNote('Already a pending gift to this friend.');
      }
    } else if (!('ok' in res) || !res.ok) {
      const err = res as { code: string; message: string };
      setNote(`${err.code}: ${err.message}`);
      haptics.warning();
    }
  };

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalShell} onClick={(e): void => e.stopPropagation()}>
        <h3 style={modalTitle}>Send a gift to {toName}</h3>
        <p style={modalBody}>One gift per friend at a time, max 10 sends per day.</p>

        <div style={kindRow}>
          <button
            onClick={(): void => setKind('cash')}
            style={{ ...kindBtn, ...(kind === 'cash' ? kindBtnActive : {}) }}
          >
            Cash
          </button>
          <button
            onClick={(): void => setKind('fuel')}
            style={{ ...kindBtn, ...(kind === 'fuel' ? kindBtnActive : {}) }}
          >
            Fuel
          </button>
        </div>

        <div style={presetRow}>
          {presets.map((p) => (
            <button
              key={p}
              onClick={(): void => setAmount(p)}
              style={{ ...presetBtn, ...(amount === p ? presetBtnActive : {}) }}
            >
              {kind === 'cash' ? `$${formatCash(p)}` : `${p}`}
            </button>
          ))}
        </div>

        {note && <div style={modalNote}>{note}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={cancelBtn}>Cancel</button>
          <button onClick={(): void => { void onSend(); }} disabled={busy} style={confirmBtn}>
            {busy ? '…' : `Send ${kind === 'cash' ? `$${formatCash(amount)}` : `${amount} fuel`}`}
          </button>
        </div>
      </div>
    </div>
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
      <AirlineCrest name={name} tailColor={tail} size={26} />
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
  display: 'grid', gridTemplateColumns: '26px 1fr auto auto', gap: 10,
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
const giftBtn: React.CSSProperties = {
  background: 'rgba(244,199,91,0.18)', color: '#F4C75B',
  border: '1px solid rgba(244,199,91,0.5)',
  borderRadius: 6, padding: '6px 12px', minHeight: 32,
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
};
const modalBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
  display: 'grid', placeItems: 'center', padding: 16, zIndex: 100,
};
const modalShell: React.CSSProperties = {
  background: '#111A2E', borderRadius: 14, padding: 18,
  width: '100%', maxWidth: 360,
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
};
const modalTitle: React.CSSProperties = {
  margin: '0 0 8px', color: '#F8FAFC', fontSize: 16,
};
const modalBody: React.CSSProperties = {
  margin: 0, color: '#94A3B8', fontSize: 12, lineHeight: 1.5,
};
const kindRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 14,
};
const kindBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', color: '#94A3B8',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '10px', minHeight: 40,
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
};
const kindBtnActive: React.CSSProperties = {
  background: 'rgba(90,200,250,0.18)', color: '#5AC8FA',
  borderColor: 'rgba(90,200,250,0.5)',
};
const presetRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 10,
};
const presetBtn: React.CSSProperties = {
  background: 'rgba(11,17,32,0.6)', color: '#94A3B8',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6, padding: '8px 4px', minHeight: 36,
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
  fontFeatureSettings: '"tnum" 1',
};
const presetBtnActive: React.CSSProperties = {
  background: 'rgba(244,199,91,0.18)', color: '#F4C75B',
  borderColor: 'rgba(244,199,91,0.45)',
};
const modalNote: React.CSSProperties = {
  marginTop: 10, padding: '6px 10px', fontSize: 11,
  color: '#F87171', background: 'rgba(248,113,113,0.08)', borderRadius: 6,
};
const cancelBtn: React.CSSProperties = {
  flex: 1, padding: 10, background: 'transparent', color: '#94A3B8',
  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
  cursor: 'pointer', minHeight: 40, fontFamily: 'inherit',
};
const confirmBtn: React.CSSProperties = {
  flex: 1, padding: 10, background: '#F4C75B', color: '#0B1120',
  border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700,
  minHeight: 40, fontFamily: 'inherit',
};
