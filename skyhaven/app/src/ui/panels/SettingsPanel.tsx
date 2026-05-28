/**
 * Settings panel (Design Review v2 — point 8 split).
 *
 * Cloud sync + Friends + Sign in / out + reset progress used to sit
 * inside the CEO Office, dampening the "command center" fantasy. They
 * now live in their own Settings surface, accessible from the Office
 * "Settings" button.
 */
import { Suspense, lazy } from 'react';
import { PanelHeader } from '../design/PanelHeader';
import { COLOR, SPACE } from '../design/tokens';

const CloudAccountCard = lazy(() =>
  import('../components/CloudAccountCard').then((m) => ({ default: m.CloudAccountCard })),
);
const FriendsCard = lazy(() =>
  import('../components/FriendsCard').then((m) => ({ default: m.FriendsCard })),
);

export function SettingsPanel() {
  return (
    <div style={shell}>
      <PanelHeader
        kicker="Account"
        title="Settings"
        subtitle="Cloud sync, friend codes, and other preferences."
      />
      <div style={body}>
        <Suspense fallback={<div style={fallback}>Loading…</div>}>
          <CloudAccountCard />
          <FriendsCard />
        </Suspense>
        <p style={hint}>
          Tip: enable Google sign-in to keep your progress on multiple devices.
          Anonymous sync still works without an account but stays on this device.
        </p>
      </div>
    </div>
  );
}

const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const body: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: SPACE.m,
  display: 'flex', flexDirection: 'column', gap: SPACE.m,
};
const fallback: React.CSSProperties = {
  padding: SPACE.l, textAlign: 'center', color: COLOR.ink.muted,
};
const hint: React.CSSProperties = {
  margin: 0,
  padding: SPACE.m,
  fontSize: 11,
  color: COLOR.ink.faint,
  textAlign: 'center',
  lineHeight: 1.5,
  background: COLOR.bg.glass,
  borderRadius: 8,
  border: `1px solid ${COLOR.border.soft}`,
};
