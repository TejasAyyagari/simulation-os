# VORAX UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform "Simulation OS" into VORAX — a premium, beast-themed gamified productivity app with an AI character as the home screen.

**Architecture:** Complete visual rewrite of App.jsx (3090 lines). All game logic stays intact. Replace every inline style with new design tokens. Restructure navigation from 9 horizontal tabs to 5 bottom tabs. Replace HQ dashboard with VORAX AI character home screen. Remove NPC and Market features.

**Tech Stack:** React (existing), Vite (existing), Google Fonts (Inter + JetBrains Mono), CSS custom properties for theming, CSS animations, SVG for VORAX avatar, Anthropic API (existing).

---

## File Map

All changes in a single file:
- **Modify:** `src/App.jsx` — complete visual overhaul (~3090 lines, every section touched)
- **Modify:** `index.html` — add Google Fonts link tags

No new files. Single-file architecture preserved per existing pattern.

---

### Task 1: Foundations — Fonts, Theme Engine, Global CSS

**Files:**
- Modify: `index.html` — add font links
- Modify: `src/App.jsx:1196-1217` — replace `globalStyles` entirely

- [ ] **Step 1: Add Google Fonts to index.html**

Add Inter and JetBrains Mono font imports via `<link>` in the `<head>`.

- [ ] **Step 2: Create THEMES constant**

Define 4 theme objects (Volcanic, Ember, Crimson, Phantom) with all CSS custom property values. Add after ACCENT_COLORS constant (~line 394).

```javascript
const THEMES = {
  volcanic: {
    id: 'volcanic', name: 'VOLCANIC',
    bgDeep: '#080510', bgSurface: '#0f0b1a', bgElevated: '#161125',
    border: '#1e1635', borderGlow: '#2a1f45',
    textPrimary: '#ede9f5', textSecondary: '#7a7290', textMuted: '#4a4460',
    accentFire: '#FF5E1A', accentEmber: '#FF3D00', accentGold: '#FFAA00',
    accentIce: '#00B4FF', accentToxic: '#7CFF3F', accentRoyal: '#A855F7',
  },
  ember: { ... },
  crimson: { ... },
  phantom: { ... },
};
```

- [ ] **Step 3: Replace globalStyles with new CSS**

Complete rewrite of the CSS string. New keyframe animations, CSS custom properties applied via `:root`, new scrollbar styles, selection styles, font-family defaults. Include fire particle animations, page transitions, VORAX-specific animations (breathing, mouth open/close, eye glow).

- [ ] **Step 4: Add theme application helper**

Function `getThemeCSS(themeId)` that returns CSS custom properties string for injection.

- [ ] **Step 5: Verify build passes**

Run `npx vite build`. Must succeed.

---

### Task 2: VORAX Avatar Component

**Files:**
- Modify: `src/App.jsx` — add new component after existing components (~line 700)

- [ ] **Step 1: Create VoraxAvatar component**

SVG-based geometric beast head. Props: `expression` (idle/pleased/disappointed/furious/proud/demanding), `theme`, `speaking` (boolean for mouth animation). Built with CSS animations for:
- Eye glow pulsing (ember orbs)
- Mouth open/close (speaking animation)
- Breathing (subtle scale pulse)
- Ambient ember particles floating around head
- Expression-based color shifts (furious = red flare, pleased = warm glow)

- [ ] **Step 2: Verify avatar renders standalone**

Temporarily render in main app to test all 6 expressions.

---

### Task 3: Navigation Overhaul — Bottom Tab Bar

**Files:**
- Modify: `src/App.jsx:1962-1968` — replace `allTabs` definition
- Modify: `src/App.jsx:2314-2318` — replace horizontal tab bar with bottom nav
- Modify: `src/App.jsx:2237-2240` — adjust main layout for bottom nav

- [ ] **Step 1: Replace allTabs with 5-tab structure**

```javascript
const TABS = [
  { id: 'vorax', label: 'VORAX', icon: '🔥' },
  { id: 'quests', label: 'QUESTS', icon: '⚡' },
  { id: 'goals', label: 'GOALS', icon: '☠' },
  { id: 'progress', label: 'PROGRESS', icon: '📊' },
  { id: 'more', label: 'MORE', icon: '⚙' },
];
```

- [ ] **Step 2: Build BottomNav component**

Fixed to bottom of screen. 5 equally-spaced icons with labels. Active tab has fire-colored indicator + subtle glow. Z-index above content but below modals.

- [ ] **Step 3: Remove old horizontal tab bar**

Delete the `<div style={{ display: "flex", overflowX: "auto" }}>` tab bar.

- [ ] **Step 4: Adjust main content area**

Add `padding-bottom: 70px` to content area to account for fixed bottom nav. Remove the quote banner div.

- [ ] **Step 5: Update default view**

Change `useState("dashboard")` to `useState("vorax")`.

- [ ] **Step 6: Update keyboard shortcuts**

Map 1-5 to new tab IDs.

---

### Task 4: HUD Redesign — Slim Header

**Files:**
- Modify: `src/App.jsx:2276-2312` — replace entire HUD section

- [ ] **Step 1: Rewrite HUD**

New slim HUD (~56px): VORAX branding left, level + credits + streak right. Single horizontal XP bar spanning full width below. Debuff/buff pills in a compact row. No quote banner. Uses theme CSS variables.

- [ ] **Step 2: Remove quote system from HUD**

Move `getRandomQuote()` usage — it will be used by VORAX as occasional messages instead.

---

### Task 5: VORAX Home Screen (Primary Tab)

**Files:**
- Modify: `src/App.jsx` — replace `view === "dashboard"` section and merge `view === "ai"` coach section

- [ ] **Step 1: Build VORAX home view**

Layout (top to bottom):
1. VoraxAvatar component (40% viewport, centered)
2. VORAX expression changes based on context (idle, hungry if no tasks, pleased if streak)
3. Current VORAX message bubble (last message only, no scroll dump)
4. Quick-prompt buttons (context-adaptive)
5. Chat input bar at bottom

- [ ] **Step 2: Integrate sendToCoach into VORAX home**

Merge the coach streaming chat logic into the VORAX view. VORAX IS the coach. Remove the separate AI/coach view.

- [ ] **Step 3: Update VORAX system prompt**

Replace the coach personality system prompt with VORAX personality:
- Never calls user "operator" — uses "human" or nothing
- Treats user as servant to their goal
- Only approves when work is done
- Short responses (1-3 sentences)
- Mirrors swearing only if user swears first
- Time-gates idle chatting

- [ ] **Step 4: Add VORAX proactive greeting**

On app open, VORAX generates a greeting based on state:
- Morning + no plan: "What's the plan today, human. Talk or work."
- Has pending tasks: "X quests waiting. Zero done. Move."
- After absence: "You vanished for X days. Your skills decayed. Prove you're back."
- All tasks done: "Acceptable. For today."

- [ ] **Step 5: Expression engine**

Function `getVoraxExpression(state)` that returns expression string based on:
- completedToday count vs total tasks
- streak status
- decay status
- last interaction time
- recent message sentiment

- [ ] **Step 6: Chat-based task creation**

When VORAX detects task intent in user message (keywords: "I need to", "add task", "I did", "just finished"), it creates tasks automatically and confirms in chat.

---

### Task 6: Restyle QUESTS View

**Files:**
- Modify: `src/App.jsx:2385-2431` — replace quests view

- [ ] **Step 1: Redesign quest cards**

New card design:
- Rounded corners (6px)
- Left accent stripe (3px) in skill color
- Proper typography (Inter for text, JetBrains Mono for XP values)
- Larger touch targets for complete button (48x48)
- Smooth hover/press animations
- Remove ugly arrow buttons — use drag handle icon instead
- Remove back button (bottom nav handles navigation)

- [ ] **Step 2: Redesign empty state**

Premium empty state with VORAX-themed messaging.

- [ ] **Step 3: Redesign completed tasks section**

Subtle, elegant completed list with checkmarks and fade styling.

---

### Task 7: Restyle GOALS View

**Files:**
- Modify: `src/App.jsx:2433-2499` — replace goals/bosses view

- [ ] **Step 1: Redesign goal cards**

New goal card with progress ring instead of flat bar. Deadline with urgency coloring. Milestone checklist redesigned. Remove MatrixAgent (replaced by VORAX-themed progress visualization).

- [ ] **Step 2: Redesign add-goal modal**

Restyle AddBossModal with new theme. Better form layout, proper spacing.

---

### Task 8: Build PROGRESS View (New — Merges Stats)

**Files:**
- Modify: `src/App.jsx` — replace `view === "skills"` section

- [ ] **Step 1: Build progress view**

Sections:
1. Overall level + class card (redesigned)
2. Radar-style skill overview (4 skills as visual bars, not flat XPBar)
3. Expandable skill tree (existing logic, new styling)
4. Streak calendar / history summary
5. Stats grid (total tasks, total XP, prestige, credits)

- [ ] **Step 2: Restyle skill tree expansion**

Smooth expand/collapse animation. Sub-skill bars with theme colors.

---

### Task 9: Build MORE View (Shop + Settings Combined)

**Files:**
- Modify: `src/App.jsx` — replace `view === "shop"` and `view === "settings"` sections

- [ ] **Step 1: Build MORE menu**

Grid of options: SHOP, SETTINGS, ABOUT, HELP. Each is a card that navigates to sub-view.

- [ ] **Step 2: Restyle shop**

Premium card layout for rewards. Category headers. Purchase confirmation redesigned.

- [ ] **Step 3: Restyle settings**

Theme picker with visual preview cards. Sound picker with preview buttons. Clean grouped sections. Remove NPC-related settings. Remove market-related settings.

- [ ] **Step 4: Add theme selector**

Visual cards showing each theme's colors. Tap to apply. Saved to settingsConfig.

---

### Task 10: Restyle All Modals

**Files:**
- Modify: `src/App.jsx` — all modal components

- [ ] **Step 1: Restyle RatingModal**

Larger tappable blocks. Show XP/credit preview per rating. Theme-consistent. Fire particles on selection.

- [ ] **Step 2: Restyle AddTaskModal**

New input design. AI classification status refined. Theme colors.

- [ ] **Step 3: Restyle QuickLogModal**

Skill selector pills redesigned. Theme colors.

- [ ] **Step 4: Restyle DailyLoginModal**

VORAX-themed. Beast awakening vibe. Ember particles.

- [ ] **Step 5: Restyle AbsenceReportModal**

VORAX is furious. Red theme. "I was starving" messaging from VORAX.

- [ ] **Step 6: Restyle MorningPlanModal**

VORAX demands the plan. Cleaner input fields.

- [ ] **Step 7: Restyle LevelUpOverlay**

Full VORAX celebration. Fire burst. Skill icon with ember glow.

- [ ] **Step 8: Restyle remaining modals**

EndOfDayModal, RewardReflectionModal, AddRewardModal, AddBossModal — all get theme treatment.

---

### Task 11: Rebrand Onboarding Flow

**Files:**
- Modify: `src/App.jsx:1983-2204` — all 7 onboarding screens

- [ ] **Step 1: Rebrand all onboarding screens**

- Replace "SIMULATION OS" with "VORAX"
- Replace "operator" with nothing or "human"
- Update boot sequence messages
- VORAX personality in all copy
- Theme-consistent styling
- Boot screen: VORAX awakening animation instead of terminal lines

---

### Task 12: Remove Dead Features

**Files:**
- Modify: `src/App.jsx` — multiple sections

- [ ] **Step 1: Remove NPC view and related code**

Remove `view === "npcs"` section, AddNPCModal, interactNPC, removeNPC handlers. Keep state fields for backwards compat (don't break existing saves).

- [ ] **Step 2: Remove Market view**

Remove `view === "market"` section, investIn, sellInvestment handlers. Keep state fields.

- [ ] **Step 3: Remove old AI tab**

Remove `view === "ai"` section (merged into VORAX home). Remove sendToAI function (replaced by sendToCoach in VORAX home).

- [ ] **Step 4: Remove old dashboard**

Remove `view === "dashboard"` section (replaced by VORAX home).

- [ ] **Step 5: Remove FABs**

Remove floating action buttons (VORAX home has integrated quick actions).

- [ ] **Step 6: Clean up orphaned state/functions**

Remove SettingsModal component (orphaned from previous session). Remove any references to removed views in keyboard shortcuts, tab definitions, etc.

---

### Task 13: Enhanced Particles & Animations

**Files:**
- Modify: `src/App.jsx` — Particles component + globalStyles

- [ ] **Step 1: Upgrade Particles component**

Fire-themed particles. Multiple particle types (ember, spark, smoke). Theme-aware colors.

- [ ] **Step 2: Add page transition animations**

Wrap view content in animated container. Fade + upward slide on tab switch.

- [ ] **Step 3: Add micro-interactions**

Button press scale animation. Card hover glow. Input focus glow.

---

### Task 14: Sound System Expansion

**Files:**
- Modify: `src/App.jsx:34-147` — AudioEngine

- [ ] **Step 1: Add FORGE sound pack**

Deeper, more percussive sounds. Anvil-like strikes for completion. Furnace ambience for level up. Metallic clinks for credits.

- [ ] **Step 2: Add sound pack selection**

Settings option to choose FORGE, DIGITAL (current), or SILENCE. AudioEngine checks selected pack before playing.

---

### Task 15: Final Polish & Verification

- [ ] **Step 1: Build verification**

Run `npx vite build` — must pass clean.

- [ ] **Step 2: Visual review**

Open localhost, test every view, every modal, every interaction.

- [ ] **Step 3: Theme verification**

Switch between all 4 themes. Verify all views look correct in each.

- [ ] **Step 4: Mobile verification**

Test at 375px width (iPhone SE). All touch targets 44px+. Bottom nav usable.
