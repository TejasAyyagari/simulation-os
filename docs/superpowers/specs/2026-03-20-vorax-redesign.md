# VORAX — Complete UI/UX Redesign Spec

## Overview
Rebrand "Simulation OS" to **VORAX** — a gamified productivity app where the AI coach IS the app. Complete visual overhaul from amateur terminal aesthetic to premium dark beast-themed UI. Client-side only (backend/multiplayer in future phase).

## Brand
- **Name**: VORAX (Latin: "voracious/devouring/insatiable")
- **Tagline**: "Feed the Beast"
- **Identity**: VORAX is a beast entity bonded to the user. Feeds on completed tasks. Starves when user is lazy.

## VORAX AI Personality
- Treats user as servant to their own goal
- Only approves when work is done. Never suggests breaks.
- Short punchy responses (1-3 sentences)
- Addresses user as "human" or nothing
- Mirrors swearing only if user swears first
- Time-gates idle chatting (4+ messages without task completion = interruption)
- Expression states: IDLE, LISTENING, PLEASED, DISAPPOINTED, FURIOUS, PROUD, DEMANDING

## Navigation (5 tabs)
1. VORAX (home) — AI chat + animated beast face + quick actions
2. QUESTS — Daily tasks
3. GOALS — Long-term boss fights
4. PROGRESS — Skill tree, stats, history
5. MORE — Shop, settings, help

## Removed Features
- NPC tab (unreliable tracking)
- Market/Stocks tab (off-brand distraction)
- Separate AI tab (merged into VORAX home)
- Old HQ dashboard (replaced by VORAX)
- Quote banner (VORAX speaks directly)
- "Operator" terminology

## Color System — Volcanic Default
| Token | Value | Usage |
|-------|-------|-------|
| --bg-deep | #080510 | Page background |
| --bg-surface | #0f0b1a | Cards |
| --bg-elevated | #161125 | Modals, HUD |
| --border | #1e1635 | Borders |
| --text-primary | #ede9f5 | Main text |
| --text-secondary | #7a7290 | Descriptions |
| --text-muted | #4a4460 | Disabled |
| --accent-fire | #FF5E1A | Primary actions |
| --accent-ember | #FF3D00 | Danger |
| --accent-gold | #FFAA00 | Credits/rewards |
| --accent-ice | #00B4FF | Stats/data |
| --accent-toxic | #7CFF3F | Success/buffs |
| --accent-royal | #A855F7 | Prestige/premium |

## 4 Themes
1. Volcanic (default) — purple-black, molten orange, electric blue
2. Ember — pure black, burning red-orange, bone white
3. Crimson — deep red-black, blood red, royal gold
4. Phantom — blue-black, cyan, violet

## Typography
- Headings: Inter (bold, tight tracking)
- Body: Inter
- Data/numbers: JetBrains Mono (monospace ONLY for numbers)

## VORAX Home Screen
- Animated beast avatar (CSS/SVG geometric wolf/dragon head) — top 40% of screen
- Expression changes based on context
- Chat bubbles below avatar — last 2-3 visible, no scroll dump
- Quick-prompt buttons adapt to context
- Task creation through natural conversation
- Simplified rating via chat: [Easy] [Moderate] [Brutal] → maps to Likert 2, 4, 7

## Animation System
- Task completion: fire particles + floating XP number
- Level up: screen flash, VORAX roars, ember particles
- Combo: banner with flame trail
- Button press: scale 0.97 spring-back
- Page transitions: fade + upward slide 200ms

## Sound Packs (3)
1. FORGE (default): anvil strikes, furnace roar
2. DIGITAL: clean synth, refined oscillator
3. SILENCE: visual-only

## Monetization Hooks (UI only, no backend)
- Locked themes with PRO badge
- Locked sound packs
- Locked weekly analytics
- No actual paywall code — just visual teasers

## Unchanged
- All game logic (XP, combos, sub-skills, Likert, decay)
- Boss/goal system
- Reward shop + AI pricing
- localStorage persistence
- Anthropic API integration
- Onboarding flow (restyled)
- completedHistory, skill tree data
