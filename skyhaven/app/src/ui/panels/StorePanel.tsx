/**
 * Executive Deals — the IAP store (Phase 15, Stage B).
 *
 * Sells directly (no premium currency): the VIP Pass and six cash
 * boosts. Cash boosts are sized in hours of the player's current yield
 * (a backend detail) — the card shows the resulting in-game cash, never
 * the hour count. Billing is simulated until Play Billing is wired
 * (`ui/monetize/iap.ts`).
 */
import { useEffect, useState } from 'react';
import { track } from '../../backend/analytics';
import { effectiveIncomePerSec } from '../../engine/economy';
import { isVipActive } from '../../engine/yield';
import { useGameStore } from '../../state/store';
import { PanelHeader } from '../design/PanelHeader';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';
import { IAP_PRODUCTS, purchaseProduct, restorePurchases, type IapProduct } from '../monetize/iap';

export function StorePanel() {
  const state = useGameStore((s) => s.state);
  const grantYieldSeconds = useGameStore((s) => s.grantYieldSeconds);
  const activateVip = useGameStore((s) => s.activateVip);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => { track.storeOpened(); }, []);

  if (!state) return null;
  const now = Date.now();
  const perSec = effectiveIncomePerSec(state, now);
  const vipActive = isVipActive(state, now);
  const vipDaysLeft = Math.ceil(Math.max(0, (state.vipUntilMs ?? 0) - now) / 86_400_000);

  const buyVip = async (): Promise<void> => {
    setBusy('vip_pass_7d'); setNote(null);
    const ok = await purchaseProduct('vip_pass_7d');
    if (ok) { activateVip(Date.now()); track.vipActivated(); haptics.success(); sfx.play('achievement_unlock'); }
    setBusy(null);
  };
  const buyCash = async (p: IapProduct): Promise<void> => {
    setBusy(p.id); setNote(null);
    const ok = await purchaseProduct(p.id);
    if (ok && p.hours) { grantYieldSeconds(p.hours * 3600, Date.now()); haptics.success(); sfx.play('claim_coin'); }
    setBusy(null);
  };
  const restore = async (): Promise<void> => {
    setBusy('restore'); setNote(null);
    const owned = await restorePurchases();
    setBusy(null);
    setNote(owned.length ? 'Purchases restored.' : 'No previous purchases found.');
  };

  const cashPacks = IAP_PRODUCTS.filter((p) => p.kind === 'cash');

  return (
    <div style={shell}>
      <PanelHeader kicker="Executive deals" title="Store" subtitle="Direct purchases — no premium currency." />
      <div style={body}>
        {/* VIP Pass */}
        <section style={vipCard}>
          <div style={vipHead}>
            <div>
              <div style={vipKicker}>VIP PASS · 7 DAYS</div>
              <div style={vipTitle}>Executive Club</div>
            </div>
            <div style={vipPrice}>{vipActive ? `${vipDaysLeft}d left` : '$4.99'}</div>
          </div>
          <ul style={benefits}>
            <li>+50% revenue on every route</li>
            <li>+50% fuel supply</li>
            <li>Instant 5 hours of income on purchase</li>
          </ul>
          <button
            style={{ ...buyBtn, background: '#F4C75B', color: '#0B1120' }}
            disabled={busy !== null}
            onClick={(): void => { void buyVip(); }}
          >
            {busy === 'vip_pass_7d' ? 'Processing…' : vipActive ? 'Extend +7 days' : 'Get VIP Pass'}
          </button>
        </section>

        {/* Cash boosts */}
        <div style={sectionHead}>Cash boosts</div>
        <div style={grid}>
          {cashPacks.map((p) => {
            const amount = perSec * (p.hours ?? 0) * 3600;
            return (
              <div key={p.id} style={packCard}>
                <div style={packAmount}>${formatCash(amount)}</div>
                <div style={packSub}>instant cash</div>
                <button
                  style={buyBtn}
                  disabled={busy !== null}
                  onClick={(): void => { void buyCash(p); }}
                >
                  {busy === p.id ? '…' : p.priceLabel}
                </button>
              </div>
            );
          })}
        </div>

        {perSec <= 0 && (
          <p style={hint}>Open a route to start earning — cash boosts scale with your income.</p>
        )}

        <button style={restoreBtn} disabled={busy !== null} onClick={(): void => { void restore(); }}>
          {busy === 'restore' ? 'Restoring…' : 'Restore purchases'}
        </button>
        {note && <div style={noteStyle}>{note}</div>}
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const body: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: 14,
  display: 'flex', flexDirection: 'column', gap: 12,
};
const vipCard: React.CSSProperties = {
  background: 'linear-gradient(150deg, rgba(244,199,91,0.14), rgba(11,17,32,0.6))',
  border: '1px solid rgba(244,199,91,0.4)', borderRadius: 14, padding: '14px 16px',
};
const vipHead: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const vipKicker: React.CSSProperties = { fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', color: '#F4C75B' };
const vipTitle: React.CSSProperties = { fontSize: 18, fontWeight: 800, color: '#F8FAFC', marginTop: 2 };
const vipPrice: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#F4C75B' };
const benefits: React.CSSProperties = {
  margin: '10px 0 12px', paddingLeft: 18, color: '#E2E8F0', fontSize: 12, lineHeight: 1.7,
};
const sectionHead: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 700,
};
const grid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
};
const packCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12, padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
};
const packAmount: React.CSSProperties = { fontSize: 18, fontWeight: 800, color: '#34D399', fontFeatureSettings: '"tnum" 1' };
const packSub: React.CSSProperties = { fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' };
const buyBtn: React.CSSProperties = {
  marginTop: 8, width: '100%', minHeight: 38, borderRadius: 8, border: 0,
  background: '#5AC8FA', color: '#0B1120', fontWeight: 800, fontSize: 13,
  cursor: 'pointer', fontFamily: 'inherit',
};
const restoreBtn: React.CSSProperties = {
  marginTop: 4, alignSelf: 'center', background: 'transparent',
  border: '1px solid rgba(255,255,255,0.15)', color: '#94A3B8',
  borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
};
const hint: React.CSSProperties = { fontSize: 11, color: '#94A3B8', textAlign: 'center', margin: 0 };
const noteStyle: React.CSSProperties = { fontSize: 11, color: '#34D399', textAlign: 'center' };
