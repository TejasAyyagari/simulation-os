# Simulation OS — Implementation Prompt for Claude Code
# Paste this entire file as your prompt to Claude Code.

You are implementing three features into /src/App.jsx for Simulation OS v5.0.
Read the full App.jsx before making any changes.
Make all changes in a single editing pass. Do not break existing functionality.

---

## FEATURE 1: COMBO MULTIPLIER SYSTEM

### Context
`state.consecutiveCompletions` already exists and increments in `rateAndAward()` at line ~1142.
It currently only triggers a quiet flow_state buff at con >= 3. We are adding a full visual combo engine on top of this.

### New state variables to add inside SimulationOS() (near other useState declarations):
```js
const [showComboBanner, setShowComboBanner] = useState(false);
const [comboBannerData, setComboBannerData] = useState({ count: 0, label: '', color: '#00ff41' });
```

### New constant to add near the top of the file (after BUFF_DEFS):
```js
const COMBO_THRESHOLDS = {
  2:  { label: 'WARMING UP',      color: '#FFAA00', sound: 'coin',     xpBonus: 0.10 },
  3:  { label: '🔥 FLOW STATE',   color: '#00FF41', sound: 'event',    xpBonus: 0.25 },
  5:  { label: 'LOCKED IN',       color: '#00D4FF', sound: 'hit',      xpBonus: 0.40 },
  7:  { label: '⚡ UNSTOPPABLE',   color: '#FF0040', sound: 'critical', xpBonus: 0.60 },
  10: { label: '♛ LEGENDARY',     color: '#CC44FF', sound: 'levelup',  xpBonus: 1.00 },
};
function getComboThreshold(count) {
  const keys = [10, 7, 5, 3, 2];
  for (const k of keys) { if (count >= k) return COMBO_THRESHOLDS[k]; }
  return null;
}
function getComboXpBonus(count) {
  const t = getComboThreshold(count);
  return t ? t.xpBonus : 0;
}
```

### Modify rateAndAward() — after the setState call, add:
```js
// Fire combo banner
const newCon = state.consecutiveCompletions + 1;
const comboThreshold = getComboThreshold(newCon);
if (comboThreshold) {
  AudioEngine.play(comboThreshold.sound);
  setComboBannerData({ count: newCon, label: comboThreshold.label, color: comboThreshold.color });
  setShowComboBanner(true);
  setTimeout(() => setShowComboBanner(false), 2400);
}
```

### Modify the XP calculation inside rateAndAward() setState:
In the line where `finalXp` is computed, add the combo bonus:
```js
const comboBonus = getComboXpBonus(prev.consecutiveCompletions + 1);
const finalXp = Math.floor(baseXp * mult * (1 + comboBonus));
```

### New ComboBanner component — add after the BloodSplatter component:
```jsx
function ComboBanner({ active, count, label, color }) {
  if (!active) return null;
  return (
    <div style={{
      position: 'fixed', top: '22%', left: '50%', transform: 'translateX(-50%)',
      zIndex: 10000, pointerEvents: 'none', textAlign: 'center',
      animation: 'comboBannerAnim 2.4s ease-out forwards',
    }}>
      <div style={{
        background: `${color}18`, border: `2px solid ${color}`,
        padding: '10px 28px', fontFamily: 'monospace',
      }}>
        <div style={{ color, fontSize: 22, fontWeight: 900, letterSpacing: 4 }}>{label}</div>
        <div style={{ color: `${color}99`, fontSize: 12, letterSpacing: 3, marginTop: 4 }}>
          x{count} COMBO
        </div>
      </div>
    </div>
  );
}
```

### Add comboBannerAnim to globalStyles CSS string (wherever @keyframes are defined):
```css
@keyframes comboBannerAnim {
  0%   { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.85); }
  15%  { opacity: 1; transform: translateX(-50%) translateY(0px) scale(1.08); }
  40%  { opacity: 1; transform: translateX(-50%) translateY(0px) scale(1); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-40px) scale(0.95); }
}
```

### Render ComboBanner in the JSX (near where Particles is rendered):
```jsx
<ComboBanner active={showComboBanner} count={comboBannerData.count} label={comboBannerData.label} color={comboBannerData.color} />
```

### Add persistent combo pill in the nav bar area:
In the main tab bar render area, after the tab buttons, add a small pill on the right side:
```jsx
{state.consecutiveCompletions >= 2 && (
  <div style={{
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    background: '#0a0a0a', border: `1px solid ${getComboThreshold(state.consecutiveCompletions)?.color || '#00ff41'}`,
    color: getComboThreshold(state.consecutiveCompletions)?.color || '#00ff41',
    fontFamily: 'monospace', fontSize: 11, padding: '4px 10px', letterSpacing: 2,
  }}>
    ⚡ x{state.consecutiveCompletions}
  </div>
)}
```

---

## FEATURE 2: AI REWARD PRICING — TIERED SYSTEM

### Context
`AddRewardModal` currently has a manual cost input (min 50, max 500).
We are adding an "⚡ AI PRICE" button that calls the Anthropic API and sets the cost automatically.
The pricing uses a TIERED system based on reward magnitude, not a flat 2-5 day rule.
The UPGRADE category costs half of equivalent ENTERTAINMENT to reward productive leisure.
Micro-rewards (5 min Twitter, one YouTube video) should be affordable in a single session.

### Reward tier detection logic (add as a helper near AddRewardModal):
```js
function detectRewardTier(name, category) {
  const n = name.toLowerCase();
  // Micro: minutes of content / quick digital entertainment
  if (/\b(5 min|quick|short|one video|one episode|tweet|scroll|check|browse|browse)\b/.test(n) ||
      (n.includes('youtube') && !n.includes('hour')) ||
      (n.includes('twitter') && !n.includes('hour'))) return 'micro';
  // Major: purchases, travel, nights out, experiences
  if (/\b(buy|purchase|trip|vacation|concert|dinner out|restaurant|new |upgrade)\b/.test(n)) return 'major';
  // Large: multi-hour entertainment blocks, nights off
  if (/\b(movie|game night|binge|evening|night off|full day|weekend)\b/.test(n)) return 'large';
  // Default to medium
  return 'medium';
}
```

### Modify AddRewardModal to accept avgDailyCredits as a prop:
Change the modal signature to:
```js
function AddRewardModal({ onAdd, onClose, lifeMission, avgDailyCredits = 80, anthropicKey = '' })
```

### Add state inside AddRewardModal:
```js
const [aiPricing, setAiPricing] = useState(false);
const [aiReason, setAiReason] = useState('');
```

### Add the pricing function inside AddRewardModal:
```js
const handleAiPrice = async () => {
  if (!anthropicKey || !name.trim()) return;
  setAiPricing(true);
  setAiReason('');
  const tier = detectRewardTier(name, cat);
  const categoryNote = cat === 'UPGRADE'
    ? 'This is an UPGRADE reward (educational/productive leisure) — price it at roughly half what pure entertainment would cost.'
    : cat === 'ENTERTAINMENT'
    ? 'This is pure entertainment. Price it so it feels earned but not impossible.'
    : 'Price it reasonably.';

  const tierNote = {
    micro: 'This is a MICRO reward (a few minutes of content/quick activity). Price it between 15-50 credits — earnable in a single productive session.',
    medium: `This is a medium reward. The user earns ~${avgDailyCredits} credits/day. Price it so it takes 1-3 days of consistent work.`,
    large: `This is a large reward (multi-hour block or significant activity). Price it so it takes 3-6 days at ~${avgDailyCredits} credits/day.`,
    major: `This is a major reward (purchase or significant experience). Price it so it takes 7-14 days at ~${avgDailyCredits} credits/day.`,
  }[tier];

  const prompt = `You are a reward economy designer for a gamified self-improvement app.
${categoryNote}
${tierNote}
Reward name: "${name.trim()}"
Respond ONLY with valid JSON in this exact format: {"cost": NUMBER, "reason": "one sentence"}
Round cost to nearest 5. No markdown, no explanation outside the JSON.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
    if (parsed.cost) {
      setCost(Math.max(5, Math.min(2000, Math.round(parsed.cost / 5) * 5)));
      setAiReason(parsed.reason || '');
    }
  } catch (e) {
    setAiReason('Could not reach AI. Set price manually.');
  }
  setAiPricing(false);
};
```

### Modify the cost row UI inside AddRewardModal (replace the existing cost row):
```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
  <span style={{ color: '#ffaa00', fontFamily: 'monospace', fontSize: 13 }}>COST:</span>
  <input
    type="number" min={5} max={2000} step={5} value={cost}
    onChange={e => { setCost(Math.max(5, parseInt(e.target.value) || 5)); setAiReason(''); }}
    style={{ width: 90, background: '#111', border: '1px solid #222', color: '#ffaa00', padding: 10, fontFamily: 'monospace', fontSize: 14, fontWeight: 900, textAlign: 'center' }}
  />
  <span style={{ color: '#ffaa00', fontFamily: 'monospace', fontSize: 14, fontWeight: 900 }}>¢</span>
  {anthropicKey && (
    <button
      onClick={handleAiPrice}
      disabled={aiPricing || !name.trim()}
      style={{
        background: aiPricing ? '#0a0a0a' : '#ffaa0012',
        border: `1px solid ${name.trim() ? '#ffaa00' : '#333'}`,
        color: name.trim() ? '#ffaa00' : '#555',
        fontFamily: 'monospace', fontSize: 11, padding: '8px 12px',
        cursor: name.trim() ? 'pointer' : 'not-allowed', letterSpacing: 1,
      }}
    >
      {aiPricing ? '...' : '⚡ AI PRICE'}
    </button>
  )}
</div>
{aiReason ? (
  <div style={{ color: '#00ff4199', fontSize: 11, fontFamily: 'monospace', marginBottom: 12, lineHeight: 1.6, padding: '6px 10px', background: '#00ff4108', border: '1px solid #00ff4122' }}>
    ⚡ AI: {aiReason}
  </div>
) : (
  <div style={{ color: '#555', fontSize: 11, fontFamily: 'monospace', marginBottom: 12 }}>
    min 5 — max 2000  ·  {anthropicKey ? 'or tap ⚡ AI PRICE for a suggestion' : 'add API key in settings for AI pricing'}
  </div>
)}
```

### Update the AddRewardModal call site (where it's rendered in the JSX) to pass the new props:
Find where `<AddRewardModal` is rendered and add:
```jsx
avgDailyCredits={(() => {
  const daily = {};
  (state.completedHistory || []).forEach(e => { daily[e.date] = (daily[e.date] || 0) + (e.creditsEarned || 0); });
  const vals = Object.values(daily);
  return vals.length > 0 ? Math.round(vals.reduce((a,b) => a+b,0) / vals.length) : 80;
})()}
anthropicKey={settings.anthropicKey || ''}
```

---

## FEATURE 3: AI DEBUFF DETECTION FROM CHAT

### Design principle
Remove manual debuff-logging UI clutter. The AI coach is now the ONLY way debuffs enter the system.
When a user mentions symptoms in any chat message, the coach detects them and applies the debuff automatically,
then tells the user what it did. The debuff display panel remains (read-only) but the manual trigger buttons are removed.

### Add debuff detection parsing helper (near DEBUFF_DEFS):
```js
const DEBUFF_CHAT_SIGNALS = {
  sleep_deprived: ['tired', 'exhausted', 'sleep deprived', 'no sleep', "didn't sleep", 'barely slept', 'slept bad', 'fatigue', 'drowsy', 'groggy'],
  doomscrolling:  ['doom scroll', 'doomscroll', 'wasted time', 'scrolled for hours', 'on my phone', 'just scrolled', 'distracted', 'phone for an hour'],
  post_nut:       ['post nut', 'pmo', 'relapsed', 'fapped', 'masturbated'],
  rage:           ['angry', 'furious', 'pissed off', 'losing my temper', 'rage', 'losing it', 'exploded', 'snapped'],
  melancholy:     ['depressed', 'sad', 'empty', 'melancholy', 'unmotivated', 'hopeless', 'down bad', 'feeling low'],
  social_anxiety: ['social anxiety', 'anxious', 'nervous around people', 'panicking', 'panic attack'],
  isolation:      ['isolated', 'alone for days', 'havent talked to anyone', "haven't talked to anyone", 'nobody'],
  overstimulated: ['overstimulated', 'overwhelmed', 'too much going on', 'cant focus', "can't focus", 'scattered'],
};

function detectDebuffsFromMessage(message) {
  const lower = message.toLowerCase();
  const detected = [];
  for (const [id, signals] of Object.entries(DEBUFF_CHAT_SIGNALS)) {
    if (signals.some(s => lower.includes(s))) detected.push(id);
  }
  return detected;
}
```

### Modify sendToAI() and sendToCoach() — BEFORE the API call, run detection:
At the top of both sendToAI and sendToCoach, after getting userMessage, add:
```js
// Auto-detect debuffs from user message
const detectedDebuffs = detectDebuffsFromMessage(userMessage);
if (detectedDebuffs.length > 0) {
  setState(prev => {
    const existing = (prev.activeDebuffs || []).map(d => d.id);
    const newDebuffs = detectedDebuffs
      .filter(id => !existing.includes(id))
      .map(id => ({ id, appliedAt: Date.now(), source: 'ai_chat' }));
    return newDebuffs.length > 0
      ? { ...prev, activeDebuffs: [...prev.activeDebuffs, ...newDebuffs] }
      : prev;
  });
}
```

### Modify the system prompt in buildCoachContext() — add this to the personality section:
```js
// Add after the personality line:
const autoDebuffNote = detectedDebuffIds.length > 0
  ? `\nNOTE: You just detected the following debuffs from the user's message and applied them: ${detectedDebuffIds.join(', ')}. Acknowledge this naturally at the start of your response (e.g. "I've logged that you're sleep deprived — XP is reduced 25% today. Here's your protocol:"). Be direct, not clinical.`
  : '';
```
Pass `detectedDebuffIds` from the outer scope into buildCoachContext or directly into the system prompt string.

### Remove manual debuff-logging buttons from the UI:
Find the section in the dashboard or debug view where users manually click to add debuffs.
Replace those click-to-add buttons with a read-only display:
```jsx
<div style={{ color: '#999', fontSize: 11, fontFamily: 'monospace', marginTop: 4, letterSpacing: 1 }}>
  DEBUFFS ARE AUTO-DETECTED FROM YOUR AI COACH CONVERSATION
</div>
```
Keep the display of active debuffs (the list showing current debuffs and their effects) — just remove any interactive "add debuff" buttons.

### Keep the existing manual debuff removal (the × button to clear a debuff) — that stays.

---

## IMPORTANT NOTES FOR IMPLEMENTATION

1. Do NOT remove `state.consecutiveCompletions` — it is used by the combo system.
2. The combo XP bonus in `rateAndAward()` should be applied AFTER the prestige multiplier and debuff multipliers (multiply them all together).
3. The cost input in AddRewardModal should now support min=5 and max=2000 (previously min=50 max=500). Update validation accordingly.
4. When adding the ComboBanner to the render tree, place it AFTER the Particles component and BEFORE any modal overlays.
5. The persistent combo pill in the nav bar should use `position: relative` on the nav bar container if it isn't already, so the absolute-positioned pill doesn't escape.
6. Test that the existing Flow State buff at consecutiveCompletions >= 3 still fires (it should — we are ADDING to that behavior, not replacing it).
7. Do not modify the onboarding flow, the UPGRADE/ENTERTAINMENT classification, or the existing reward justification system — those are working correctly and the AI pricing respects them.
