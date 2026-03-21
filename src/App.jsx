import { useState, useEffect, useCallback, useRef } from "react";

// ── API Key ───────────────────────────────────────────────────
// Key is loaded from .env.local (local) or Netlify environment variables (live).
// Never hardcode a real key here — it will be blocked by GitHub.
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";

/**
 * App main module
 * ----------------
 * This file contains the full UI and game logic for Simulation OS.
 * Key responsibilities:
 * - UI components and visual helpers (particles, bars, agents)
 * - Game state management and defaults
 * - Lightweight persistence using browser `localStorage`
 *
 * Notes:
 * - Persistence helpers below read/write a single JSON blob under
 *   `simulation_os_v5` and a few auxiliary keys for onboarding and
 *   feature locks. There is no backend or server-side database.
 *
 * Copyright (c) 2026 Tejas Ayyagari. All rights reserved.
 * Solely owned idea of Tejas Ayyagari; intended for incorporation
 * into a startup or commercial project.
 *
 * Author: Tejas Ayyagari
 */

// ═══════════════════════════════════════════════════════════════
// SIMULATION OS v5.0 — THE COMPLETE LIFE RPG
// ═══════════════════════════════════════════════════════════════

// ── Audio Engine ──────────────────────────────────────────────
const AudioEngine = {
  ctx: null,
  getCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this.ctx;
  },
  play(type) {
    try {
      const s = loadSettings();
      if (s.soundEnabled === false) return;
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      if (type === "hit") {
        osc.type = "square"; osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
        gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
      } else if (type === "xp") {
        osc.type = "sine"; osc.frequency.setValueAtTime(523, now);
        osc.frequency.exponentialRampToValueAtTime(1047, now + 0.12);
        gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
      } else if (type === "levelup") {
        [523, 659, 784, 1047].forEach((f, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = "square";
          o.frequency.setValueAtTime(f, now + i * 0.1);
          g.gain.setValueAtTime(0.15, now + i * 0.1);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
          o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.2);
        });
      } else if (type === "loot") {
        for (let i = 0; i < 12; i++) {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = "sawtooth";
          const f = 200 + Math.random() * 800;
          o.frequency.setValueAtTime(f, now + i * 0.08);
          g.gain.setValueAtTime(0.08, now + i * 0.08);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.07);
          o.start(now + i * 0.08); o.stop(now + i * 0.08 + 0.07);
        }
      } else if (type === "critical") {
        osc.type = "sawtooth"; osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 1);
        gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 1);
        osc.start(now); osc.stop(now + 1);
      } else if (type === "click") {
        osc.type = "square"; osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
        osc.start(now); osc.stop(now + 0.03);
      } else if (type === "boss") {
        [150, 200, 150, 100].forEach((f, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = "sawtooth";
          o.frequency.setValueAtTime(f, now + i * 0.2);
          g.gain.setValueAtTime(0.25, now + i * 0.2);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.18);
          o.start(now + i * 0.2); o.stop(now + i * 0.2 + 0.18);
        });
      } else if (type === "coin") {
        osc.type = "sine"; osc.frequency.setValueAtTime(1318, now);
        osc.frequency.setValueAtTime(1568, now + 0.08);
        gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
      } else if (type === "event") {
        [440, 554, 659, 880].forEach((f, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = "triangle";
          o.frequency.setValueAtTime(f, now + i * 0.12);
          g.gain.setValueAtTime(0.12, now + i * 0.12);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.15);
          o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.15);
        });
      } else if (type === "fear") {
        osc.type = "square"; osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.3);
        gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now); osc.stop(now + 0.4);
      } else if (type === "splatter") {
        for (let i = 0; i < 5; i++) {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = "sawtooth";
          o.frequency.setValueAtTime(60 + Math.random() * 100, now + i * 0.04);
          g.gain.setValueAtTime(0.2, now + i * 0.04);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.04 + 0.06);
          o.start(now + i * 0.04); o.stop(now + i * 0.04 + 0.06);
        }
      } else if (type === "death") {
        for (let i = 0; i < 20; i++) {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = i % 2 === 0 ? "sawtooth" : "square";
          const f = 200 - i * 8 + Math.random() * 50;
          o.frequency.setValueAtTime(Math.max(20, f), now + i * 0.05);
          g.gain.setValueAtTime(0.2, now + i * 0.05);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.08);
          o.start(now + i * 0.05); o.stop(now + i * 0.05 + 0.08);
        }
      } else if (type === "gamble") {
        [200, 400, 600, 800, 1000].forEach((f, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = "square";
          o.frequency.setValueAtTime(f, now + i * 0.06);
          g.gain.setValueAtTime(0.15, now + i * 0.06);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.08);
          o.start(now + i * 0.06); o.stop(now + i * 0.06 + 0.08);
        });
      }
    } catch (e) {}
  }
};
// ── Quote Pool ────────────────────────────────────────────────
const QUOTES_POOL = [
  { category: "SOCIAL", color: "#ffaa00", text: "The spotlight effect is a delusion. People are too busy drowning in their own lives to notice you. Act without hesitation." },
  { category: "SOCIAL", color: "#ffaa00", text: "Charisma is psychological warfare. Read their souls, and execute." },
  { category: "SOCIAL", color: "#ffaa00", text: "A strong network is a decentralized empire. Forge alliances that make you untouchable." },
  { category: "SOCIAL", color: "#ffaa00", text: "Stop caring if NPCs love or despise you — their opinions are irrelevant. The mission is everything." },
  { category: "INTELLIGENCE", color: "#00ff41", text: "Master your mind. The entire war is won or lost at the interface between consciousness and discipline." },
  { category: "INTELLIGENCE", color: "#00ff41", text: "AI automation is god-tier leverage. You are writing the code that forces reality to submit." },
  { category: "INTELLIGENCE", color: "#00ff41", text: "Deep work is descending into the void. Lock yourself in the chamber and build while weak men scroll." },
  { category: "INTELLIGENCE", color: "#00ff41", text: "Every page you devour adds new weapons to your cognitive arsenal. Conquer more territory." },
  { category: "STRENGTH", color: "#ff3333", text: "Pain is raw data from your body. Absorb it, transmute it, turn it into power." },
  { category: "STRENGTH", color: "#ff3333", text: "A weak body makes you a slave to the matrix. Lift heavy iron until you break through." },
  { category: "STRENGTH", color: "#ff3333", text: "Endurance is forged in fire. Delete the weak voice that begs you to quit." },
  { category: "STRENGTH", color: "#ff3333", text: "Gravity wants you broken. Defy it with every single rep." },
  { category: "VITALITY", color: "#00d4ff", text: "Vitality is not random — it's religious adherence to the protocol. Fuel the machine perfectly." },
  { category: "VITALITY", color: "#00d4ff", text: "Protein is the sacred code for god-tier biology. Never miss the upload." },
  { category: "VITALITY", color: "#00d4ff", text: "Your aesthetics scream your level of discipline. Look like a weapon at all times." },
  { category: "VITALITY", color: "#00d4ff", text: "Sleep is reloading the simulation's save state. Optimize every cycle." },
  { category: "SYSTEM", color: "#ff00ff", text: "The simulation only rewards cold, relentless consistency. Motivation is for the weak." },
  { category: "SYSTEM", color: "#ff00ff", text: "Focus is your most valuable currency. Guard it like a dragon or remain forgotten." },
  { category: "SYSTEM", color: "#ff00ff", text: "You are the operator of this entire game. Turn every piece of friction into fuel." },
  { category: "SYSTEM", color: "#ff00ff", text: "Comfort is the deadliest virus in the matrix. It keeps men trapped in tutorial mode forever." },
  { category: "SYSTEM", color: "#ff00ff", text: "A superior version of you already exists. Close the gap or accept mediocrity." },
];

function getRandomQuote() {
  const d = new Date(); const seed = d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate();
  return QUOTES_POOL[seed % QUOTES_POOL.length];
}

// ── Skill Definitions ─────────────────────────────────────────
const SKILL_DEFS = {
  intelligence: { name: "INTELLIGENCE", icon: "⟐", color: "#00ff41", desc: "Business · Study · Learning" },
  strength: { name: "STRENGTH", icon: "⚔", color: "#ff3333", desc: "Gym · Combat · Training" },
  vitality: { name: "VITALITY", icon: "♥", color: "#00d4ff", desc: "Health · Appearance · Recovery" },
  social: { name: "SOCIAL", icon: "★", color: "#ffaa00", desc: "Network · Charisma · Influence" },
};

// ── Task Auto-Classifier ──────────────────────────────────
const SKILL_KEYWORDS = {
  intelligence: ['study','read','learn','write','code','work','research','plan','analyze',
    'review','create','build','think','project','course','book','essay','report','meeting',
    'email','business','strategy','quiz','exam','test','practice','prepare','notes','solve',
    'draft','design','develop','debug','script','blog','podcast','video','lecture'],
  strength: ['gym','workout','exercise','pushup','pullup','run','lift','train','squat',
    'bench','cardio','sprint','jog','walk','hike','sport','fight','spar','discipline',
    'hustle','grind','compete','challenge','reps','sets','yoga','stretch','swim','bike'],
  vitality: ['sleep','eat','cook','meal','food','health','doctor','meditate','shower',
    'hygiene','diet','water','vitamin','rest','recover','nap','fast','clean','groom',
    'skincare','therapy','journal','breathe','mental','calories','protein','nutrition'],
  social: ['call','text','meet','friend','family','network','talk','chat','hangout',
    'date','party','event','social','message','connect','relationship','group',
    'team','collaborate','interview','present','pitch','help','visit','coffee','lunch'],
};
function classifyTask(text) {
  if (!text || text.length < 3) return null;
  const lower = text.toLowerCase();
  const scores = Object.entries(SKILL_KEYWORDS).map(([skill, kw]) => ({
    skill, score: kw.filter(k => lower.includes(k)).length
  }));
  const best = scores.reduce((a, b) => b.score > a.score ? b : a);
  return best.score > 0 ? best.skill : null;
}

// ── Sub-Skill Definitions (16 sub-skills, 4 per main skill) ──
const SUB_SKILL_DEFS = {
  intelligence: [
    { id: "deep_work",     name: "DEEP WORK",     icon: "⊕", color: "#00ff41",
      desc: "Focus sessions, coding, building",
      keywords: ["focus","code","build","develop","debug","project","work","create","script","program"] },
    { id: "learning",      name: "LEARNING",      icon: "◈", color: "#00cc33",
      desc: "Study, reading, courses, research",
      keywords: ["study","read","learn","course","book","lecture","notes","research","quiz","exam","test"] },
    { id: "strategy",      name: "STRATEGY",      icon: "⟐", color: "#00aa29",
      desc: "Planning, analysis, thinking",
      keywords: ["plan","analyze","think","strategy","review","design","prepare","solve","draft"] },
    { id: "communication", name: "COMMUNICATION", icon: "✦", color: "#009922",
      desc: "Writing, essays, email, presenting",
      keywords: ["write","essay","blog","email","report","pitch","present","podcast","video"] },
  ],
  strength: [
    { id: "training",   name: "TRAINING",   icon: "⚔", color: "#ff3333",
      desc: "Weightlifting, gym sessions",
      keywords: ["gym","workout","lift","squat","bench","press","reps","sets","weights","resistance"] },
    { id: "cardio",     name: "CARDIO",     icon: "♦", color: "#ff5555",
      desc: "Running, cycling, endurance",
      keywords: ["run","sprint","jog","cardio","bike","swim","hike","walk","endurance","pace"] },
    { id: "discipline", name: "DISCIPLINE", icon: "◆", color: "#ff2200",
      desc: "Willpower, consistency, grind",
      keywords: ["discipline","grind","hustle","compete","challenge","pushup","pullup","exercise"] },
    { id: "martial",    name: "MARTIAL",    icon: "★", color: "#cc1111",
      desc: "Combat, sport, flexibility",
      keywords: ["fight","spar","sport","yoga","stretch","martial","boxing","mma","combat","train"] },
  ],
  vitality: [
    { id: "nutrition",   name: "NUTRITION",   icon: "♥", color: "#00d4ff",
      desc: "Diet, meal prep, food tracking",
      keywords: ["eat","cook","meal","food","diet","protein","calories","nutrition","prep","fast"] },
    { id: "recovery",    name: "RECOVERY",    icon: "◉", color: "#00bbdd",
      desc: "Sleep, rest, mental health",
      keywords: ["sleep","rest","nap","recover","therapy","mental","breathe","relax","recharge"] },
    { id: "appearance",  name: "APPEARANCE",  icon: "◇", color: "#0099bb",
      desc: "Grooming, skincare, hygiene",
      keywords: ["shower","groom","skincare","clean","hygiene","appearance","style","grooming"] },
    { id: "mindfulness", name: "MINDFULNESS", icon: "⊗", color: "#0077aa",
      desc: "Meditation, journaling, clarity",
      keywords: ["meditate","journal","breathe","mindful","water","vitamin","health","doctor"] },
  ],
  social: [
    { id: "networking",    name: "NETWORKING",    icon: "★", color: "#ffaa00",
      desc: "Professional connections, outreach",
      keywords: ["network","linkedin","interview","connect","professional","outreach","coffee"] },
    { id: "relationships", name: "RELATIONSHIPS", icon: "♦", color: "#ffcc22",
      desc: "Friends, family, personal bonds",
      keywords: ["friend","family","date","visit","hangout","relationship","bond","love","partner"] },
    { id: "leadership",    name: "LEADERSHIP",    icon: "◈", color: "#ff9900",
      desc: "Team, collaboration, helping",
      keywords: ["team","collaborate","lead","help","group","manage","teach","mentor","guide"] },
    { id: "charisma",      name: "CHARISMA",      icon: "⟐", color: "#ffbb44",
      desc: "Presenting, social events, talking",
      keywords: ["present","pitch","talk","chat","meet","message","event","party","social","lunch"] },
  ],
};

// Returns the best-matching sub-skill id for a task text + main skill.
// Falls back to the first sub-skill if no keyword matches.
function getSubSkillHit(text, mainSkill) {
  const defs = SUB_SKILL_DEFS[mainSkill];
  if (!defs) return null;
  const lower = text.toLowerCase();
  const best = defs.map(d => ({
    id: d.id,
    score: d.keywords.filter(k => lower.includes(k)).length,
  })).reduce((a, b) => b.score > a.score ? b : a);
  return best.score > 0 ? best.id : defs[0].id;
}

// ── Class Definitions ─────────────────────────────────────────
const CLASS_DEFS = [
  { id: "undetermined", name: "UNCLASSIFIED", icon: "◇", color: "#999", desc: "Class not yet determined", req: () => true },
  { id: "strategist", name: "STRATEGIST", icon: "⟐", color: "#00ff41", desc: "INT dominant — bonus XP on deep work", req: (s) => s.intelligence.level >= 5 && s.intelligence.level > s.strength.level && s.intelligence.level > s.social.level },
  { id: "warrior", name: "WARRIOR", icon: "⚔", color: "#ff3333", desc: "STR dominant — physical task bonus", req: (s) => s.strength.level >= 5 && s.strength.level > s.intelligence.level },
  { id: "diplomat", name: "DIPLOMAT", icon: "★", color: "#ffaa00", desc: "SOC dominant — 50% decay reduction", req: (s) => s.social.level >= 5 && s.social.level > s.intelligence.level && s.social.level > s.strength.level },
  { id: "paladin", name: "PALADIN", icon: "◈", color: "#00d4ff", desc: "Balanced — +10% all XP", req: (s) => { const l = [s.intelligence.level, s.strength.level, s.vitality.level, s.social.level]; return Math.min(...l) >= 3 && Math.max(...l) - Math.min(...l) <= 2; } },
  { id: "sovereign", name: "DARK SOVEREIGN", icon: "♛", color: "#ff00ff", desc: "INT+STR+SOC — fear multiplier 2x", req: (s) => s.intelligence.level >= 5 && s.strength.level >= 5 && s.social.level >= 3 },
];

function determineClass(skills) {
  for (let i = CLASS_DEFS.length - 1; i >= 1; i--) {
    if (CLASS_DEFS[i].req(skills)) return CLASS_DEFS[i];
  }
  return CLASS_DEFS[0];
}

// ── Debuff / Buff Definitions ─────────────────────────────────
const DEBUFF_DEFS = {
  sleep_deprived: { name: "SLEEP DEPRIVED", icon: "😴", color: "#ff6600", effect: "XP -25%", xpMult: 0.75 },
  doomscrolling: { name: "DOOMSCROLLING", icon: "📱", color: "#ff0040", effect: "Loot locked", xpMult: 1 },
  isolation: { name: "ISOLATION", icon: "🔇", color: "#666", effect: "Social XP frozen", xpMult: 1 },
  overstimulated: { name: "OVERSTIMULATED", icon: "⚡", color: "#ffaa00", effect: "Mana regen halved tomorrow", xpMult: 1 },
  social_anxiety: { name: "SOCIAL ANXIETY", icon: "😰", color: "#8844aa", effect: "Social XP -50%", xpMult: 1 },
  post_nut: { name: "POST-NUT CLARITY", icon: "💀", color: "#553333", effect: "All XP -30% for 2hrs", xpMult: 0.7 },
  rage: { name: "RAGE OUTBURST", icon: "🔥", color: "#ff2200", effect: "Credits halved from tasks", xpMult: 0.8 },
  melancholy: { name: "MELANCHOLY", icon: "🌑", color: "#334466", effect: "XP -20%, mana bonus off", xpMult: 0.8 },
  reflectionMissed: { name: "REFLECTION SKIPPED", icon: "📓", color: "#ff6600", effect: "XP -10% today", xpMult: 0.9 },
};

const BUFF_DEFS = {
  flow_state: { name: "FLOW STATE", icon: "🔥", color: "#ff00ff", effect: "XP x2", xpMult: 2.0 },
  early_bird: { name: "EARLY BIRD", icon: "🌅", color: "#ffaa00", effect: "+50% XP until noon", xpMult: 1.5 },
  iron_will: { name: "IRON WILL", icon: "🛡", color: "#00d4ff", effect: "+25% XP 1hr", xpMult: 1.25 },
};

// ── Combo Multiplier System ───────────────────────────────────
const COMBO_THRESHOLDS = [
  { min: 2,  label: "×2 COMBO",      color: "#00ff41", xpBonus: 0.10, sound: "xp" },
  { min: 3,  label: "×3 STREAK",     color: "#00d4ff", xpBonus: 0.20, sound: "coin" },
  { min: 5,  label: "×5 ON FIRE",    color: "#ffaa00", xpBonus: 0.35, sound: "event" },
  { min: 7,  label: "×7 RAMPAGE",    color: "#ff00ff", xpBonus: 0.60, sound: "loot" },
  { min: 10, label: "×10 GODMODE",   color: "#ff0040", xpBonus: 1.00, sound: "levelup" },
];

function getComboThreshold(consecutiveCount) {
  let best = null;
  for (const t of COMBO_THRESHOLDS) {
    if (consecutiveCount >= t.min) best = t;
  }
  return best;
}

function getComboXpBonus(consecutiveCount) {
  const t = getComboThreshold(consecutiveCount);
  return t ? t.xpBonus : 0;
}

// ── Debuff Chat Signals (for AI auto-detection) ───────────────
const DEBUFF_CHAT_SIGNALS = {
  sleep_deprived: ["tired","exhausted","didn't sleep","no sleep","insomnia","sleep deprived","barely slept","up all night","couldn't sleep","slept bad","terrible sleep","3 hours","4 hours","few hours of sleep","sleepy","drowsy","groggy","a bit sleepy","so sleepy","feeling sleepy","half asleep","can barely keep my eyes"],
  doomscrolling: ["scrolling","doomscroll","doom scroll","tiktok","twitter","instagram","reels","wasted time on phone","phone addiction","can't stop scrolling","social media","youtube shorts"],
  post_nut: ["post nut","jerked","fapped","masturbat","relapsed","nofap","porn","pmo"],
  rage: ["angry","furious","rage","pissed","lost my temper","snapped","blew up","yelled","screaming","outburst"],
  melancholy: ["depressed","sad","empty","hopeless","pointless","numb","crying","can't feel","no motivation","don't care anymore","what's the point","lonely"],
  social_anxiety: ["anxious","anxiety","scared to talk","avoid people","nervous around people","social anxiety","can't talk to","afraid of","too scared","awkward"],
  isolation: ["isolated","alone all day","haven't talked","no one","by myself","haven't left","stayed in","no contact","didn't go out","hermit"],
  overstimulated: ["overstimulated","overwhelmed","too much","sensory overload","brain fried","can't focus","scattered","burnout","burnt out","fried"],
};

function detectDebuffsFromMessage(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const detected = [];
  for (const [debuffId, keywords] of Object.entries(DEBUFF_CHAT_SIGNALS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) { detected.push(debuffId); break; }
    }
  }
  return detected;
}

// ── Reward Tier Detection (for AI pricing) ────────────────────
function detectRewardTier(name, desc) {
  const text = `${name} ${desc || ""}`.toLowerCase();
  if (/\b(snack|gum|candy|sticker|break|5.min|quick)\b/.test(text)) return "micro";
  if (/\b(episode|movie|meal|game.session|coffee|dessert|takeout|uber|lyft)\b/.test(text)) return "medium";
  if (/\b(concert|shoes|clothes|gadget|gear|equipment|day.off|trip)\b/.test(text)) return "large";
  if (/\b(vacation|console|laptop|phone|tablet|flight|hotel|weekend)\b/.test(text)) return "major";
  return "medium"; // default
}

const TIER_RANGES = { micro: [5, 30], medium: [40, 150], large: [150, 500], major: [500, 2000] };

function getOnboardingRewardCost(name, classification) {
  const tier = detectRewardTier(name, "");
  const [lo, hi] = TIER_RANGES[tier];
  const mid = Math.floor((lo + hi) / 2);
  return classification === "upgrade" ? Math.max(lo, Math.floor(mid * 0.5)) : mid;
}

// ── Accent Color Options ─────────────────────────────────────
const ACCENT_COLORS = [
  { id: "matrix", color: "#00ff41", name: "MATRIX" },
  { id: "ice", color: "#00d4ff", name: "ICE" },
  { id: "neon", color: "#ff00ff", name: "NEON" },
  { id: "gold", color: "#ffaa00", name: "GOLD" },
  { id: "blood", color: "#ff0040", name: "BLOOD" },
  { id: "violet", color: "#8844ff", name: "VIOLET" },
];

// ── Theme Definitions ───────────────────────────────────────
const THEMES = {
  volcanic: {
    id: 'volcanic', name: 'VOLCANIC',
    bgDeep: '#080510', bgSurface: '#0f0b1a', bgElevated: '#161125',
    border: '#1e1635', borderGlow: '#2a1f45',
    textPrimary: '#ede9f5', textSecondary: '#7a7290', textMuted: '#4a4460',
    accentFire: '#FF5E1A', accentEmber: '#FF3D00', accentGold: '#FFAA00',
    accentIce: '#00B4FF', accentToxic: '#7CFF3F', accentRoyal: '#A855F7',
  },
  ember: {
    id: 'ember', name: 'EMBER',
    bgDeep: '#0a0806', bgSurface: '#121008', bgElevated: '#1a1610',
    border: '#2a2218', borderGlow: '#3a2e20',
    textPrimary: '#f0e8dc', textSecondary: '#8a7e6e', textMuted: '#5a4e3e',
    accentFire: '#FF6B2C', accentEmber: '#FF4500', accentGold: '#FFB300',
    accentIce: '#FF8C42', accentToxic: '#FFAA00', accentRoyal: '#D4740E',
  },
  crimson: {
    id: 'crimson', name: 'CRIMSON',
    bgDeep: '#0a0408', bgSurface: '#140812', bgElevated: '#1e0c1a',
    border: '#2e1428', borderGlow: '#3e1c38',
    textPrimary: '#f0e0ea', textSecondary: '#8a6878', textMuted: '#5a3848',
    accentFire: '#DC143C', accentEmber: '#B30000', accentGold: '#FFD700',
    accentIce: '#FF1744', accentToxic: '#FF4081', accentRoyal: '#9C27B0',
  },
  phantom: {
    id: 'phantom', name: 'PHANTOM',
    bgDeep: '#060810', bgSurface: '#0a0e1a', bgElevated: '#101425',
    border: '#182035', borderGlow: '#1e2a45',
    textPrimary: '#e0e8f5', textSecondary: '#6878a0', textMuted: '#384870',
    accentFire: '#00BCD4', accentEmber: '#0097A7', accentGold: '#7C4DFF',
    accentIce: '#00E5FF', accentToxic: '#64FFDA', accentRoyal: '#536DFE',
  },
};

function getThemeCSS(themeId) {
  const t = THEMES[themeId] || THEMES.volcanic;
  return `
    --bg-deep: ${t.bgDeep};
    --bg-surface: ${t.bgSurface};
    --bg-elevated: ${t.bgElevated};
    --border: ${t.border};
    --border-glow: ${t.borderGlow};
    --text-primary: ${t.textPrimary};
    --text-secondary: ${t.textSecondary};
    --text-muted: ${t.textMuted};
    --accent-fire: ${t.accentFire};
    --accent-ember: ${t.accentEmber};
    --accent-gold: ${t.accentGold};
    --accent-ice: ${t.accentIce};
    --accent-toxic: ${t.accentToxic};
    --accent-royal: ${t.accentRoyal};
  `;
}

// ── Addiction / Indispensability Constants ────────────────────
const DAILY_LOGIN_BONUS = { xp: 20, credits: 15 };
const DECAY_RATE_PER_DAY = 3; // XP lost per skill per inactive day (after 1-day grace)
const DECAY_GRACE_DAYS = 1;

// ── Time helpers ─────────────────────────────────────────────
function timeAgo(timestamp) {
  if (!timestamp) return "";
  const diff = Date.now() - (typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ── Tooltip component for jargon ─────────────────────────────
const JARGON = {
  "NPC": "Real people in your life tracked as relationships",
  "Debuff": "Negative status effect reducing your XP gains",
  "Buff": "Positive status effect boosting your XP gains",
  "Quest": "A task you need to complete for XP and credits",
  "Credits": "Currency earned by completing tasks, spent on rewards",
  "XP": "Experience points — fill the bar to level up a skill",
  "Prestige": "Reset progress for a permanent XP multiplier boost",
  "Combo": "Complete tasks consecutively for escalating XP bonuses",
};

// ── Seed Tasks (no pre-set difficulty) ────────────────────────
const SEED_TASKS = [
  { id: "t1", text: "Deep work session on business (1hr)", skill: "intelligence", xp: 20 },
  { id: "t2", text: "Study / Learn new concept (30min)", skill: "intelligence", xp: 20 },
  { id: "t3", text: "Read 20 pages of a book", skill: "intelligence", xp: 20 },
  { id: "t4", text: "Hit the gym — full workout", skill: "strength", xp: 20 },
  { id: "t5", text: "Combat / martial arts training", skill: "strength", xp: 20 },
  { id: "t6", text: "Bodyweight exercises (20min)", skill: "strength", xp: 20 },
  { id: "t7", text: "Skincare + grooming routine", skill: "vitality", xp: 20 },
  { id: "t8", text: "Meal prep healthy food", skill: "vitality", xp: 20 },
  { id: "t9", text: "Sleep 7+ hrs (logged)", skill: "vitality", xp: 20 },
];

// ── Helpers ───────────────────────────────────────────────────
// Likert 1-7 credit/XP mapping (HIDDEN from user)
const LIKERT_CREDITS = { 1: 5, 2: 8, 3: 13, 4: 20, 5: 28, 6: 38, 7: 50 };
const LIKERT_XP = { 1: 5, 2: 8, 3: 13, 4: 20, 5: 28, 6: 38, 7: 50 };
function daysBetween(d1, d2) { return Math.floor((new Date(d2) - new Date(d1)) / 86400000); }
function formatTime(s) { if (s <= 0) return "00:00"; return `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`; }

function getXpMultiplier(state) {
  let m = state.prestigeMultiplier || 1;
  for (const d of (state.activeDebuffs || [])) if (DEBUFF_DEFS[d.id]) m *= DEBUFF_DEFS[d.id].xpMult;
  const now = Date.now();
  for (const b of (state.activeBuffs || [])) if (BUFF_DEFS[b.id] && b.expiresAt > now) m *= BUFF_DEFS[b.id].xpMult;
  const hasMelancholy = (state.activeDebuffs || []).find(d => d.id === "melancholy");
  if (hasMelancholy && state.streakDays >= 3) m *= 1.3;
  return m;
}
function getCreditMult(state) { return (state.activeDebuffs || []).find(d => d.id === "rage") ? 0.5 : 1; }

// ── Default State ─────────────────────────────────────────────
function getDefaultState() {
  return {
    skills: { intelligence: { xp: 0, level: 1 }, strength: { xp: 0, level: 1 }, vitality: { xp: 0, level: 1 }, social: { xp: 0, level: 1 } },
    tasks: SEED_TASKS.map(t => ({ ...t })), completedToday: [], totalXpEarned: 0, totalTasksCompleted: 0,
    streakDays: 0, lastActiveDate: new Date().toDateString(),
    credits: 0, totalCreditsEarned: 0, creditsRefused: 0, purchaseHistory: [],
    activeDebuffs: [], activeBuffs: [], consecutiveCompletions: 0,
    bosses: [], npcs: [],
    prestigeLevel: 0, prestigeMultiplier: 1.0, totalPrestigeXp: 0, weeklyLog: [],
    customRewards: [], protocolViolations: [], dailyTaskCounts: [],
    rewardReflections: [], endOfDayReflections: [], pendingRewardReflection: null,
    yesterdayReflection: null, hardCompletedToday: false,
    investments: {}, investmentHistory: [], marketPrices: { intelligence: 100, strength: 100, vitality: 100, social: 100 }, lastMarketUpdate: null,
    aiChatHistory: [],
    completedHistory: [],  // permanent log of every completed task (last 500)
    lastLoginDate: null,
    loginStreak: 0,
    dailyLoginClaimed: false,
    morningPlanDone: false,
    totalXpMissed: 0,
    absenceLossLog: [],
    settingsConfig: {
      accentColor: "#00ff41",
      soundEnabled: true,
      soundType: "retro",
      tabOrder: null,
      hiddenTabs: [],
      accountEmail: "",
      accountPassword: "",
    },
    subSkills: {
      intelligence: { deep_work:{xp:0,level:1}, learning:{xp:0,level:1}, strategy:{xp:0,level:1}, communication:{xp:0,level:1} },
      strength:     { training:{xp:0,level:1}, cardio:{xp:0,level:1}, discipline:{xp:0,level:1}, martial:{xp:0,level:1} },
      vitality:     { nutrition:{xp:0,level:1}, recovery:{xp:0,level:1}, appearance:{xp:0,level:1}, mindfulness:{xp:0,level:1} },
      social:       { networking:{xp:0,level:1}, relationships:{xp:0,level:1}, leadership:{xp:0,level:1}, charisma:{xp:0,level:1} },
    },
  };
}

/**
 * Load persisted application state from browser storage.
 * Order of lookup:
 * 1. `simulation_os_v5` (current format)
 * 2. `simulation_os_v2_1` (legacy fallback)
 * If parsing fails or keys are absent, return a fresh default state.
 */
function loadState() {
  try {
    const s = localStorage.getItem("simulation_os_v5"); if (s) return { ...getDefaultState(), ...JSON.parse(s) };
    const old = localStorage.getItem("simulation_os_v2_1"); if (old) return { ...getDefaultState(), ...JSON.parse(old) };
  } catch (e) {}
  return getDefaultState();
}

/**
 * Persist the full application state to `localStorage` under
 * the `simulation_os_v5` key. This is a best-effort write and
 * intentionally swallows exceptions (e.g., storage quota issues).
 */
function saveState(state) { try { localStorage.setItem("simulation_os_v5", JSON.stringify(state)); } catch (e) {} }

// ── Onboarding Persistence ────────────────────────────────────
/**
 * Retrieve onboarding progress/settings saved during the initial
 * onboarding flow. Returns parsed object or `null` if absent.
 */
function getOnboardingData() {
  try { const d = localStorage.getItem("simulation_os_onboarding_v2"); return d ? JSON.parse(d) : null; } catch { return null; }
}

/**
 * Save onboarding progress/settings to localStorage.
 */
function saveOnboardingData(data) {
  try { localStorage.setItem("simulation_os_onboarding_v2", JSON.stringify(data)); } catch {}
}

// ── Settings Persistence ──────────────────────────────────
function loadSettings() {
  try { const s = localStorage.getItem("sim_settings"); return s ? JSON.parse(s) : {}; } catch { return {}; }
}
function saveSettings(s) { try { localStorage.setItem("sim_settings", JSON.stringify(s)); } catch {} }

function checkTaskCountDrop(state) {
  const counts = state.dailyTaskCounts || [];
  if (counts.length < 7) return false;
  const last7 = counts.slice(-7);
  const avg = last7.reduce((a, b) => a + b, 0) / 7;
  const today = state.completedToday?.length || 0;
  return avg > 0 && today <= avg * 0.5;
}
// ── Back Button ───────────────────────────────────────────────
function BackButton({ onClick, label = "← BACK", color = "#888" }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "1px solid #222", color, fontFamily: "monospace", fontSize: 12, padding: "6px 14px", cursor: "pointer", letterSpacing: 2, marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>{label}</button>
  );
}

// ── Tooltip ───────────────────────────────────────────────────
function Tip({ term, children }) {
  const [show, setShow] = useState(false);
  const text = JARGON[term];
  if (!text) return children || term;
  return (
    <span style={{ position: "relative", cursor: "help", borderBottom: "1px dotted #444" }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onClick={() => setShow(p => !p)}>
      {children || term}
      {show && (
        <span style={{ position: "absolute", bottom: "120%", left: "50%", transform: "translateX(-50%)", background: "#1a1a1a", border: "1px solid #333", color: "#ccc", fontFamily: "monospace", fontSize: 11, padding: "6px 10px", whiteSpace: "nowrap", zIndex: 9999, pointerEvents: "none", letterSpacing: 1 }}>{text}</span>
      )}
    </span>
  );
}

// ── Spinner ───────────────────────────────────────────────────
function Spinner({ color = "#00ff41", text = "Loading..." }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color, fontFamily: "monospace", fontSize: 12 }}>
      <span style={{ animation: "blink 0.6s step-end infinite" }}>█</span>
      <span>{text}</span>
    </div>
  );
}

// ── Daily Login Modal ─────────────────────────────────────────
function DailyLoginModal({ loginStreak, onClaim }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9600, padding: 16 }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔥</div>
        <div style={{ color: "#ffaa00", fontFamily: "monospace", fontSize: 16, fontWeight: 900, letterSpacing: 4, marginBottom: 8 }}>DAILY LOGIN</div>
        <div style={{ color: "#fff", fontFamily: "monospace", fontSize: 28, fontWeight: 900, marginBottom: 8 }}>DAY {loginStreak + 1}</div>
        <div style={{ color: "#888", fontFamily: "monospace", fontSize: 13, marginBottom: 24, lineHeight: 1.8 }}>
          You showed up. That alone puts you ahead of 90% of people.<br/>
          {loginStreak >= 3 && <span style={{ color: "#ffaa00" }}>🔥 {loginStreak}-day streak — don't break it.</span>}
          {loginStreak >= 7 && <span style={{ color: "#ff00ff" }}><br/>LEGENDARY STREAK. Keep going.</span>}
        </div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 24 }}>
          <div style={{ background: "#00ff4112", border: "1px solid #00ff4133", padding: "12px 20px" }}>
            <div style={{ color: "#00ff41", fontFamily: "monospace", fontSize: 20, fontWeight: 900 }}>+{DAILY_LOGIN_BONUS.xp}</div>
            <div style={{ color: "#00ff4188", fontFamily: "monospace", fontSize: 11 }}>XP</div>
          </div>
          <div style={{ background: "#ffaa0012", border: "1px solid #ffaa0033", padding: "12px 20px" }}>
            <div style={{ color: "#ffaa00", fontFamily: "monospace", fontSize: 20, fontWeight: 900 }}>+{DAILY_LOGIN_BONUS.credits}</div>
            <div style={{ color: "#ffaa0088", fontFamily: "monospace", fontSize: 11 }}>CREDITS</div>
          </div>
        </div>
        <button onClick={onClaim} style={{ background: "#00ff4112", border: "1px solid #00ff41", color: "#00ff41", fontFamily: "monospace", fontSize: 14, fontWeight: 900, padding: "14px 40px", cursor: "pointer", letterSpacing: 4, animation: "pulse 1.5s infinite" }}>CLAIM & BEGIN</button>
      </div>
    </div>
  );
}

// ── Morning Planning Modal ────────────────────────────────────
function MorningPlanModal({ onSubmit, onSkip }) {
  const [tasks, setTasks] = useState(["", "", ""]);
  const filled = tasks.filter(t => t.trim()).length;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9550, padding: 16 }}>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ color: "#00ff41", fontFamily: "monospace", fontSize: 14, fontWeight: 900, letterSpacing: 4, marginBottom: 8 }}>☀ MORNING PLANNING</div>
        <div style={{ color: "#888", fontFamily: "monospace", fontSize: 13, marginBottom: 20, lineHeight: 1.8 }}>
          Winners plan their day. What are your 3 priorities today?
        </div>
        {tasks.map((t, i) => (
          <input key={i} value={t} onChange={e => { const n = [...tasks]; n[i] = e.target.value; setTasks(n); }} placeholder={`Priority ${i + 1}...`} style={{ width: "100%", background: "#0a0a0a", border: "1px solid #00ff4122", color: "#eee", padding: "12px 14px", fontFamily: "monospace", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
        ))}
        <button onClick={() => setTasks([...tasks, ""])} style={{ background: "none", border: "1px solid #222", color: "#555", fontFamily: "monospace", fontSize: 12, padding: "4px 12px", cursor: "pointer", marginBottom: 16 }}>+ MORE</button>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { if (filled > 0) onSubmit(tasks.filter(t => t.trim())); }} disabled={filled === 0} style={{ flex: 1, padding: 14, background: filled > 0 ? "#00ff4112" : "#0a0a0a", border: `1px solid ${filled > 0 ? "#00ff41" : "#222"}`, color: filled > 0 ? "#00ff41" : "#333", fontFamily: "monospace", fontSize: 13, fontWeight: 900, cursor: filled > 0 ? "pointer" : "not-allowed", letterSpacing: 3 }}>LOCK IN PLAN</button>
          <button onClick={onSkip} style={{ padding: "14px 20px", background: "transparent", border: "1px solid #333", color: "#555", fontFamily: "monospace", fontSize: 12, cursor: "pointer" }}>SKIP</button>
        </div>
      </div>
    </div>
  );
}

// ── Absence Report Modal ──────────────────────────────────────
function AbsenceReportModal({ daysGone, xpLost, streakLost, potentialXpMissed, onDismiss }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9650, padding: 16 }}>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>💀</div>
        <div style={{ color: "#ff0040", fontFamily: "monospace", fontSize: 16, fontWeight: 900, letterSpacing: 4, marginBottom: 8 }}>YOU WERE GONE</div>
        <div style={{ color: "#ff4466", fontFamily: "monospace", fontSize: 28, fontWeight: 900, marginBottom: 20 }}>{daysGone} DAYS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <div style={{ background: "#ff004010", border: "1px solid #ff004033", padding: 14 }}>
            <div style={{ color: "#ff0040", fontSize: 20, fontWeight: 900, fontFamily: "monospace" }}>-{xpLost}</div>
            <div style={{ color: "#ff004088", fontSize: 11, fontFamily: "monospace" }}>XP DECAYED</div>
          </div>
          <div style={{ background: "#ff004010", border: "1px solid #ff004033", padding: 14 }}>
            <div style={{ color: "#ff0040", fontSize: 20, fontWeight: 900, fontFamily: "monospace" }}>~{potentialXpMissed}</div>
            <div style={{ color: "#ff004088", fontSize: 11, fontFamily: "monospace" }}>POTENTIAL XP MISSED</div>
          </div>
        </div>
        {streakLost && <div style={{ color: "#ff0040", fontFamily: "monospace", fontSize: 13, marginBottom: 16, padding: "8px 16px", background: "#ff004010", border: "1px solid #ff004033" }}>🔥 STREAK BROKEN — Reset to 0</div>}
        <div style={{ color: "#888", fontFamily: "monospace", fontSize: 12, marginBottom: 20, lineHeight: 1.8 }}>
          Every day you don't show up, your skills decay and your competitors gain ground. The simulation doesn't pause.
        </div>
        <button onClick={onDismiss} style={{ background: "#ff004012", border: "1px solid #ff0040", color: "#ff0040", fontFamily: "monospace", fontSize: 14, fontWeight: 900, padding: "14px 40px", cursor: "pointer", letterSpacing: 3 }}>I'M BACK. LET'S GO.</button>
      </div>
    </div>
  );
}

// ── Particles ─────────────────────────────────────────────────
function Particles({ active, color = "#00ff41", count = 30 }) {
  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }}>
      {Array.from({ length: count }).map((_, i) => {
        const x = Math.random() * 100; const delay = Math.random() * 0.5;
        const dur = 0.8 + Math.random() * 1.2; const size = 2 + Math.random() * 4;
        return <div key={i} style={{ position: "absolute", left: `${x}%`, bottom: "50%", width: size, height: size, background: color, borderRadius: "50%", boxShadow: `0 0 6px ${color}`, animation: `particle-fly ${dur}s ${delay}s ease-out forwards` }} />;
      })}
    </div>
  );
}

// ── Blood Splatter ────────────────────────────────────────────
function BloodSplatter({ active }) {
  if (!active) return null;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 5 }}>
      {Array.from({ length: 15 }).map((_, i) => {
        const x = 30 + Math.random() * 40, y = 20 + Math.random() * 60;
        const size = 4 + Math.random() * 12;
        const dx = (Math.random() - 0.5) * 120, dy = (Math.random() - 0.5) * 120;
        return <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: size, height: size, borderRadius: "50%", background: "radial-gradient(circle, #ff0000, #880000)", boxShadow: "0 0 4px #ff0000", animation: `splatter 0.6s ${i*0.02}s ease-out forwards`, "--dx": `${dx}px`, "--dy": `${dy}px` }} />;
      })}
    </div>
  );
}

// ── Combo Banner ──────────────────────────────────────────────
function ComboBanner({ data, onDone }) {
  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(onDone, 2200);
    return () => clearTimeout(timer);
  }, [data, onDone]);
  if (!data) return null;
  return (
    <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 9900, pointerEvents: "none", animation: "comboBannerAnim 2s ease-out forwards", textAlign: "center" }}>
      <div style={{ fontSize: 48, fontWeight: 900, fontFamily: "monospace", color: data.color, textShadow: `0 0 30px ${data.color}, 0 0 60px ${data.color}44`, letterSpacing: 6, lineHeight: 1 }}>{data.label}</div>
      <div style={{ fontSize: 16, fontFamily: "monospace", color: data.color, opacity: 0.7, marginTop: 8, letterSpacing: 4 }}>+{Math.round(data.xpBonus * 100)}% XP BONUS</div>
    </div>
  );
}

// ── Matrix Agent (Boss Visual) ────────────────────────────────
function MatrixAgent({ boss, isHit, isDead }) {
  const hpPct = (boss.hp / boss.maxHp) * 100;
  const dmg = hpPct < 30 ? "critical" : hpPct < 60 ? "damaged" : "healthy";
  return (
    <div style={{ position: "relative", padding: "12px 0", textAlign: "center" }}>
      <div style={{ display: "inline-block", position: "relative", animation: isDead ? "agentDeath 1.5s forwards" : isHit ? "agentHit 0.3s ease" : "agentIdle 3s ease-in-out infinite", filter: isDead ? "saturate(0) brightness(2)" : dmg === "critical" ? "hue-rotate(340deg) brightness(0.8)" : "none" }}>
        {/* Damage cracks */}
        {dmg !== "healthy" && !isDead && (
          <div style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
            {Array.from({ length: dmg === "critical" ? 6 : 3 }).map((_, i) => (
              <div key={i} style={{ position: "absolute", left: `${20+Math.random()*60}%`, top: `${10+Math.random()*80}%`, width: 2, height: 8+Math.random()*15, background: "#ff0000", transform: `rotate(${Math.random()*360}deg)`, opacity: 0.7, boxShadow: "0 0 4px #ff0000" }} />
            ))}
          </div>
        )}
        {/* Head */}
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a1a1a", border: "2px solid #333", margin: "0 auto 2px", position: "relative" }}>
          <div style={{ position: "absolute", top: 10, left: 3, right: 3, height: 6, background: "#000", border: "1px solid #444", display: "flex", gap: 2 }}>
            <div style={{ flex: 1, background: boss.phase >= 3 ? "#ff000044" : "#111", border: "1px solid #555" }} />
            <div style={{ flex: 1, background: boss.phase >= 3 ? "#ff000044" : "#111", border: "1px solid #555" }} />
          </div>
        </div>
        <div style={{ width: 8, height: 6, background: "#1a1a1a", margin: "0 auto" }} />
        {/* Shoulders */}
        <div style={{ width: 70, height: 12, background: "#111", margin: "0 auto", borderRadius: "4px 4px 0 0", border: "1px solid #222" }} />
        {/* Torso */}
        <div style={{ width: 50, height: 50, background: "#0a0a0a", margin: "0 auto", border: "1px solid #1a1a1a", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 6, height: 35, background: "#1a1a1a", borderBottom: "6px solid #222" }} />
          {dmg !== "healthy" && <div style={{ position: "absolute", top: 15, left: 8, width: 8, height: 3, background: "#880000", borderRadius: 2 }} />}
          {dmg === "critical" && <div style={{ position: "absolute", top: 30, right: 10, width: 6, height: 6, background: "#aa0000", borderRadius: "50%", boxShadow: "0 0 6px #ff0000" }} />}
        </div>
        {/* Arms */}
        <div style={{ position: "absolute", top: 44, left: -6, width: 14, height: 45, background: "#111", border: "1px solid #222", transform: `rotate(${isHit ? 15 : 5}deg)`, transition: "transform 0.2s", borderRadius: 3 }} />
        <div style={{ position: "absolute", top: 44, right: -6, width: 14, height: 45, background: "#111", border: "1px solid #222", transform: `rotate(${isHit ? -15 : -5}deg)`, transition: "transform 0.2s", borderRadius: 3 }} />
        {/* Legs */}
        <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
          <div style={{ width: 18, height: 45, background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "0 0 3px 3px" }} />
          <div style={{ width: 18, height: 45, background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "0 0 3px 3px" }} />
        </div>
        <BloodSplatter active={isHit} />
      </div>
      {/* Matrix code rain on death */}
      {isDead && (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} style={{ position: "absolute", left: `${Math.random()*100}%`, top: -20, color: "#00ff41", fontSize: 13, fontFamily: "monospace", animation: `matrixRain ${1+Math.random()*2}s ${Math.random()*0.5}s linear forwards`, opacity: 0.6 }}>
              {String.fromCharCode(0x30A0 + Math.random() * 96)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── XPBar ─────────────────────────────────────────────────────
function XPBar({ xp, level, def }) {
  const pct = (xp / 100) * 100;
  return (
    <div style={{ background: "#0a0a0a", border: `1px solid ${def.color}33`, padding: "10px 14px", marginBottom: 6, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${pct}%`, background: `${def.color}08`, transition: "width 0.6s ease" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16, color: def.color }}>{def.icon}</span>
          <div>
            <div style={{ color: def.color, fontFamily: "monospace", fontSize: 12, letterSpacing: 2, fontWeight: 700 }}>{def.name}</div>
            <div style={{ color: "#888", fontFamily: "monospace", fontSize: 12}}>{def.desc}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: def.color, fontFamily: "monospace", fontSize: 18, fontWeight: 900 }}>LV.{level}</div>
          <div style={{ color: "#999", fontFamily: "monospace", fontSize: 12}}>{xp}/100</div>
        </div>
      </div>
      <div style={{ height: 3, background: "#111", marginTop: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: def.color, boxShadow: `0 0 8px ${def.color}66`, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}


// ── VORAX Avatar ──────────────────────────────────────────────
function VoraxAvatar({ expression = 'idle', theme, speaking = false, size = 280 }) {
  const t = theme || THEMES.volcanic;

  // Expression-based color mapping
  const expressionConfig = {
    idle: {
      eyeColor: t.accentEmber,
      eyeGlow: t.accentFire,
      eyeIntensity: 0.6,
      mouthCurve: 0,
      auraColor: `${t.accentFire}15`,
      auraIntensity: 0.3,
      particleSpeed: 4,
      jawOpen: 0,
      teethVisible: false,
      crownEffect: false,
    },
    pleased: {
      eyeColor: t.accentGold,
      eyeGlow: t.accentGold,
      eyeIntensity: 0.9,
      mouthCurve: 3,
      auraColor: `${t.accentGold}25`,
      auraIntensity: 0.5,
      particleSpeed: 3.5,
      jawOpen: 0,
      teethVisible: false,
      crownEffect: false,
    },
    disappointed: {
      eyeColor: '#991111',
      eyeGlow: '#661111',
      eyeIntensity: 0.4,
      mouthCurve: -4,
      auraColor: `${t.accentEmber}10`,
      auraIntensity: 0.15,
      particleSpeed: 6,
      jawOpen: 0,
      teethVisible: false,
      crownEffect: false,
    },
    furious: {
      eyeColor: '#FF1111',
      eyeGlow: '#FF0000',
      eyeIntensity: 1,
      mouthCurve: 0,
      auraColor: `${t.accentEmber}35`,
      auraIntensity: 0.9,
      particleSpeed: 1.5,
      jawOpen: 8,
      teethVisible: true,
      crownEffect: false,
    },
    proud: {
      eyeColor: '#FFFAE6',
      eyeGlow: t.accentGold,
      eyeIntensity: 1,
      mouthCurve: 2,
      auraColor: `${t.accentGold}30`,
      auraIntensity: 0.7,
      particleSpeed: 3,
      jawOpen: 0,
      teethVisible: false,
      crownEffect: true,
    },
    demanding: {
      eyeColor: t.accentIce,
      eyeGlow: t.accentIce,
      eyeIntensity: 1,
      mouthCurve: -1,
      auraColor: `${t.accentIce}20`,
      auraIntensity: 0.6,
      particleSpeed: 2.5,
      jawOpen: 2,
      teethVisible: false,
      crownEffect: false,
    },
  };

  const cfg = expressionConfig[expression] || expressionConfig.idle;
  const cx = size / 2;
  const cy = size / 2;
  const s = size / 280; // scale factor

  // Ember particle positions
  const embers = [
    { x: cx - 70 * s, y: cy - 50 * s, delay: 0, dur: cfg.particleSpeed },
    { x: cx + 65 * s, y: cy - 40 * s, delay: 0.7, dur: cfg.particleSpeed * 0.9 },
    { x: cx - 45 * s, y: cy + 30 * s, delay: 1.4, dur: cfg.particleSpeed * 1.1 },
    { x: cx + 50 * s, y: cy + 20 * s, delay: 2.1, dur: cfg.particleSpeed * 0.8 },
    { x: cx - 10 * s, y: cy - 70 * s, delay: 0.3, dur: cfg.particleSpeed * 1.2 },
  ];

  const mouthAnim = speaking
    ? 'voraxMouthOpen 0.3s ease-in-out infinite alternate'
    : 'voraxMouthClose 0.2s ease forwards';

  return (
    <div style={{
      width: size,
      height: size,
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'voraxBreathe 4s ease-in-out infinite',
    }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Eye glow gradient */}
          <radialGradient id="vorax-eye-glow-l" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={cfg.eyeColor} stopOpacity={cfg.eyeIntensity} />
            <stop offset="60%" stopColor={cfg.eyeGlow} stopOpacity={cfg.eyeIntensity * 0.5} />
            <stop offset="100%" stopColor={cfg.eyeGlow} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="vorax-eye-glow-r" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={cfg.eyeColor} stopOpacity={cfg.eyeIntensity} />
            <stop offset="60%" stopColor={cfg.eyeGlow} stopOpacity={cfg.eyeIntensity * 0.5} />
            <stop offset="100%" stopColor={cfg.eyeGlow} stopOpacity="0" />
          </radialGradient>
          {/* Aura gradient */}
          <radialGradient id="vorax-aura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={cfg.auraColor} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          {/* Head surface gradient */}
          <linearGradient id="vorax-head-fill" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor={t.bgElevated} />
            <stop offset="50%" stopColor={t.bgSurface} />
            <stop offset="100%" stopColor={t.bgDeep} />
          </linearGradient>
          {/* Flare filter for furious */}
          <filter id="vorax-flare" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={expression === 'furious' ? 3 : 0} />
          </filter>
        </defs>

        {/* Ambient aura circle */}
        <circle
          cx={cx}
          cy={cy}
          r={120 * s}
          fill="url(#vorax-aura)"
          opacity={cfg.auraIntensity}
        />

        {/* Crown embers for proud expression */}
        {cfg.crownEffect && (
          <g>
            {[
              { x: cx - 40 * s, y: cy - 105 * s },
              { x: cx - 20 * s, y: cy - 115 * s },
              { x: cx, y: cy - 120 * s },
              { x: cx + 20 * s, y: cy - 115 * s },
              { x: cx + 40 * s, y: cy - 105 * s },
            ].map((pt, i) => (
              <polygon
                key={`crown-${i}`}
                points={`${pt.x},${pt.y} ${pt.x - 4 * s},${pt.y + 12 * s} ${pt.x + 4 * s},${pt.y + 12 * s}`}
                fill={t.accentGold}
                opacity={0.8}
                style={{ animation: `voraxEyeGlow 1.5s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </g>
        )}

        {/* ── HORNS ── */}
        {/* Left horn */}
        <polygon
          points={`${cx - 38 * s},${cy - 72 * s} ${cx - 60 * s},${cy - 130 * s} ${cx - 25 * s},${cy - 68 * s}`}
          fill={t.bgElevated}
          stroke={t.accentFire}
          strokeWidth={1.2 * s}
          opacity={0.9}
        />
        <polygon
          points={`${cx - 52 * s},${cy - 110 * s} ${cx - 68 * s},${cy - 140 * s} ${cx - 45 * s},${cy - 108 * s}`}
          fill={t.bgElevated}
          stroke={t.accentEmber}
          strokeWidth={0.8 * s}
          opacity={0.7}
        />
        {/* Right horn */}
        <polygon
          points={`${cx + 38 * s},${cy - 72 * s} ${cx + 60 * s},${cy - 130 * s} ${cx + 25 * s},${cy - 68 * s}`}
          fill={t.bgElevated}
          stroke={t.accentFire}
          strokeWidth={1.2 * s}
          opacity={0.9}
        />
        <polygon
          points={`${cx + 52 * s},${cy - 110 * s} ${cx + 68 * s},${cy - 140 * s} ${cx + 45 * s},${cy - 108 * s}`}
          fill={t.bgElevated}
          stroke={t.accentEmber}
          strokeWidth={0.8 * s}
          opacity={0.7}
        />

        {/* ── MAIN HEAD SHAPE (angular shield/diamond) ── */}
        <polygon
          points={`
            ${cx},${cy - 80 * s}
            ${cx + 30 * s},${cy - 75 * s}
            ${cx + 55 * s},${cy - 55 * s}
            ${cx + 70 * s},${cy - 20 * s}
            ${cx + 68 * s},${cy + 15 * s}
            ${cx + 55 * s},${cy + 45 * s}
            ${cx + 35 * s},${cy + 65 * s}
            ${cx + 12 * s},${cy + 78 * s}
            ${cx},${cy + 82 * s}
            ${cx - 12 * s},${cy + 78 * s}
            ${cx - 35 * s},${cy + 65 * s}
            ${cx - 55 * s},${cy + 45 * s}
            ${cx - 68 * s},${cy + 15 * s}
            ${cx - 70 * s},${cy - 20 * s}
            ${cx - 55 * s},${cy - 55 * s}
            ${cx - 30 * s},${cy - 75 * s}
          `}
          fill="url(#vorax-head-fill)"
          stroke={t.accentFire}
          strokeWidth={1.5 * s}
          strokeOpacity={0.4}
        />

        {/* ── Angular face lines / cheekbones ── */}
        {/* Left cheekbone */}
        <line
          x1={cx - 62 * s} y1={cy - 10 * s}
          x2={cx - 35 * s} y2={cy + 20 * s}
          stroke={t.accentEmber}
          strokeWidth={1 * s}
          opacity={0.3}
        />
        <line
          x1={cx - 35 * s} y1={cy + 20 * s}
          x2={cx - 25 * s} y2={cy + 50 * s}
          stroke={t.accentEmber}
          strokeWidth={0.8 * s}
          opacity={0.2}
        />
        {/* Right cheekbone */}
        <line
          x1={cx + 62 * s} y1={cy - 10 * s}
          x2={cx + 35 * s} y2={cy + 20 * s}
          stroke={t.accentEmber}
          strokeWidth={1 * s}
          opacity={0.3}
        />
        <line
          x1={cx + 35 * s} y1={cy + 20 * s}
          x2={cx + 25 * s} y2={cy + 50 * s}
          stroke={t.accentEmber}
          strokeWidth={0.8 * s}
          opacity={0.2}
        />
        {/* Forehead ridge */}
        <line
          x1={cx - 30 * s} y1={cy - 60 * s}
          x2={cx} y2={cy - 50 * s}
          stroke={t.accentFire}
          strokeWidth={0.8 * s}
          opacity={0.25}
        />
        <line
          x1={cx + 30 * s} y1={cy - 60 * s}
          x2={cx} y2={cy - 50 * s}
          stroke={t.accentFire}
          strokeWidth={0.8 * s}
          opacity={0.25}
        />
        {/* Nose ridge */}
        <line
          x1={cx} y1={cy - 45 * s}
          x2={cx} y2={cy + 10 * s}
          stroke={t.accentEmber}
          strokeWidth={0.6 * s}
          opacity={0.15}
        />

        {/* ── EYE SOCKETS (angular) ── */}
        {/* Left eye socket */}
        <polygon
          points={`
            ${cx - 44 * s},${cy - 28 * s}
            ${cx - 18 * s},${cy - 32 * s}
            ${cx - 12 * s},${cy - 18 * s}
            ${cx - 18 * s},${cy - 8 * s}
            ${cx - 44 * s},${cy - 12 * s}
          `}
          fill={t.bgDeep}
          stroke={cfg.eyeColor}
          strokeWidth={1 * s}
          strokeOpacity={0.5}
        />
        {/* Left eye orb */}
        <ellipse
          cx={cx - 28 * s}
          cy={cy - 20 * s}
          rx={10 * s}
          ry={8 * s}
          fill="url(#vorax-eye-glow-l)"
          style={{ animation: 'voraxEyeGlow 2.5s ease-in-out infinite' }}
        />
        {/* Left pupil slit */}
        <ellipse
          cx={cx - 28 * s}
          cy={cy - 20 * s}
          rx={2.5 * s}
          ry={6 * s}
          fill={cfg.eyeColor}
          opacity={cfg.eyeIntensity}
        />

        {/* Right eye socket */}
        <polygon
          points={`
            ${cx + 44 * s},${cy - 28 * s}
            ${cx + 18 * s},${cy - 32 * s}
            ${cx + 12 * s},${cy - 18 * s}
            ${cx + 18 * s},${cy - 8 * s}
            ${cx + 44 * s},${cy - 12 * s}
          `}
          fill={t.bgDeep}
          stroke={cfg.eyeColor}
          strokeWidth={1 * s}
          strokeOpacity={0.5}
        />
        {/* Right eye orb */}
        <ellipse
          cx={cx + 28 * s}
          cy={cy - 20 * s}
          rx={10 * s}
          ry={8 * s}
          fill="url(#vorax-eye-glow-r)"
          style={{ animation: 'voraxEyeGlow 2.5s ease-in-out 0.3s infinite' }}
        />
        {/* Right pupil slit */}
        <ellipse
          cx={cx + 28 * s}
          cy={cy - 20 * s}
          rx={2.5 * s}
          ry={6 * s}
          fill={cfg.eyeColor}
          opacity={cfg.eyeIntensity}
        />

        {/* ── SNOUT / NOSE ── */}
        <polygon
          points={`
            ${cx - 12 * s},${cy + 5 * s}
            ${cx},${cy - 2 * s}
            ${cx + 12 * s},${cy + 5 * s}
            ${cx + 8 * s},${cy + 14 * s}
            ${cx},${cy + 16 * s}
            ${cx - 8 * s},${cy + 14 * s}
          `}
          fill={t.bgDeep}
          stroke={t.accentEmber}
          strokeWidth={0.6 * s}
          strokeOpacity={0.3}
        />
        {/* Nostrils */}
        <ellipse cx={cx - 5 * s} cy={cy + 10 * s} rx={2 * s} ry={1.5 * s} fill={t.accentEmber} opacity={0.4} />
        <ellipse cx={cx + 5 * s} cy={cy + 10 * s} rx={2 * s} ry={1.5 * s} fill={t.accentEmber} opacity={0.4} />

        {/* ── MOUTH / JAW ── */}
        <g style={{ animation: mouthAnim, transformOrigin: `${cx}px ${cy + 30 * s}px` }}>
          {/* Jaw outline */}
          <polygon
            points={`
              ${cx - 30 * s},${cy + 22 * s + cfg.mouthCurve * s}
              ${cx - 15 * s},${cy + 30 * s + cfg.jawOpen * s}
              ${cx},${cy + 34 * s + cfg.jawOpen * s + cfg.mouthCurve * s}
              ${cx + 15 * s},${cy + 30 * s + cfg.jawOpen * s}
              ${cx + 30 * s},${cy + 22 * s + cfg.mouthCurve * s}
            `}
            fill="none"
            stroke={t.accentEmber}
            strokeWidth={1.2 * s}
            strokeOpacity={0.5}
          />
          {/* Mouth interior (dark slit) */}
          <polygon
            points={`
              ${cx - 22 * s},${cy + 24 * s + cfg.mouthCurve * s}
              ${cx - 10 * s},${cy + 28 * s + cfg.jawOpen * 0.7 * s}
              ${cx},${cy + 30 * s + cfg.jawOpen * 0.7 * s + cfg.mouthCurve * 0.5 * s}
              ${cx + 10 * s},${cy + 28 * s + cfg.jawOpen * 0.7 * s}
              ${cx + 22 * s},${cy + 24 * s + cfg.mouthCurve * s}
            `}
            fill={t.bgDeep}
            stroke={expression === 'furious' ? '#FF0000' : t.accentEmber}
            strokeWidth={0.5 * s}
            strokeOpacity={0.3}
          />

          {/* Teeth (angular, visible when furious or jawOpen > 0) */}
          {(cfg.teethVisible || cfg.jawOpen > 3) && (
            <g>
              {/* Upper teeth */}
              {[-18, -10, -3, 3, 10, 18].map((offset, i) => (
                <polygon
                  key={`tooth-u-${i}`}
                  points={`
                    ${cx + (offset - 2) * s},${cy + 24 * s + cfg.mouthCurve * s}
                    ${cx + offset * s},${cy + 28 * s + cfg.mouthCurve * s}
                    ${cx + (offset + 2) * s},${cy + 24 * s + cfg.mouthCurve * s}
                  `}
                  fill={t.textPrimary}
                  opacity={0.85}
                />
              ))}
              {/* Lower teeth */}
              {[-14, -6, 0, 6, 14].map((offset, i) => (
                <polygon
                  key={`tooth-l-${i}`}
                  points={`
                    ${cx + (offset - 2) * s},${cy + 30 * s + cfg.jawOpen * 0.7 * s}
                    ${cx + offset * s},${cy + 27 * s + cfg.jawOpen * 0.4 * s}
                    ${cx + (offset + 2) * s},${cy + 30 * s + cfg.jawOpen * 0.7 * s}
                  `}
                  fill={t.textPrimary}
                  opacity={0.7}
                />
              ))}
            </g>
          )}
        </g>

        {/* ── JAW LINES ── */}
        <line
          x1={cx - 55 * s} y1={cy + 45 * s}
          x2={cx - 25 * s} y2={cy + 60 * s}
          stroke={t.accentFire}
          strokeWidth={0.8 * s}
          opacity={0.2}
        />
        <line
          x1={cx + 55 * s} y1={cy + 45 * s}
          x2={cx + 25 * s} y2={cy + 60 * s}
          stroke={t.accentFire}
          strokeWidth={0.8 * s}
          opacity={0.2}
        />
        {/* Chin point accent */}
        <polygon
          points={`
            ${cx - 8 * s},${cy + 72 * s}
            ${cx},${cy + 82 * s}
            ${cx + 8 * s},${cy + 72 * s}
          `}
          fill="none"
          stroke={t.accentEmber}
          strokeWidth={0.6 * s}
          opacity={0.25}
        />

        {/* ── EMBER PARTICLES ── */}
        {embers.map((e, i) => (
          <circle
            key={`ember-${i}`}
            cx={e.x}
            cy={e.y}
            r={2.5 * s}
            fill={expression === 'furious' ? '#FF2200' : t.accentFire}
            opacity={0.7}
            style={{
              animation: `fireFloat ${e.dur}s ease-in-out ${e.delay}s infinite`,
            }}
          />
        ))}

        {/* Furious red flare ring */}
        {expression === 'furious' && (
          <circle
            cx={cx}
            cy={cy}
            r={85 * s}
            fill="none"
            stroke="#FF0000"
            strokeWidth={2 * s}
            opacity={0.25}
            style={{ animation: 'voraxEyeGlow 0.8s ease-in-out infinite' }}
          />
        )}
      </svg>
    </div>
  );
}



// ── Modals ────────────────────────────────────────────────────
// AI skill map — Anthropic returns one of 5 labels; map wealth → intelligence
const AI_SKILL_CATEGORY_MAP = {
  intelligence: "intelligence", strength: "strength",
  vitality: "vitality", social: "social", wealth: "intelligence",
};

function AddTaskModal({ onAdd, onClose }) {
  const [text, setText] = useState("");
  const [skill, setSkill] = useState("intelligence");
  const [aiClassifying, setAiClassifying] = useState(false);
  const [aiLabel, setAiLabel] = useState(null);
  const debounceRef = useRef(null);

  // AI auto-classification fires 900 ms after the user stops typing — no manual override
  useEffect(() => {
    if (text.trim().length < 4) {
      setAiClassifying(false);
      setAiLabel(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!ANTHROPIC_API_KEY) {
        const detected = classifyTask(text);
        if (detected) { setSkill(detected); setAiLabel(detected); }
        return;
      }
      setAiClassifying(true);
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 10,
            system: "You are a task classifier. Classify the given task into exactly one of these five categories: Intelligence, Strength, Vitality, Social, Wealth. Intelligence is for studying, learning, business, reading, coding. Strength is for physical training, gym, combat, manual work. Vitality is for health, food, sleep, grooming, recovery, cleaning. Social is for relationships, conversations, networking, family. Wealth is for money, income, business growth, financial tasks. Return only the single category name with no punctuation and nothing else.",
            messages: [{ role: "user", content: text.trim() }],
          }),
        });
        const data = await res.json();
        const raw = data.content?.[0]?.text?.trim().toLowerCase() || "";
        const mapped = AI_SKILL_CATEGORY_MAP[raw] || classifyTask(text) || "intelligence";
        setSkill(mapped);
        setAiLabel(raw);
      } catch {
        const fallback = classifyTask(text);
        if (fallback) { setSkill(fallback); setAiLabel(fallback); }
      } finally {
        setAiClassifying(false);
      }
    }, 900);
    return () => clearTimeout(debounceRef.current);
  }, [text]);

  const submit = () => {
    if (text.trim()) {
      onAdd({ id: `c_${Date.now()}`, text: text.trim(), skill, xp: 20 });
      AudioEngine.play("xp");
    }
  };

  const detectedDef = SKILL_DEFS[skill];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000 }} onClick={onClose}>
      <div style={{ background: "#0a0a0a", border: "1px solid #00ff4133", padding: 24, maxWidth: 400, width: "90%" }} onClick={e => e.stopPropagation()}>
        <div style={{ color: "#00ff41", fontFamily: "monospace", fontSize: 12, letterSpacing: 4, marginBottom: 16 }}>+ NEW QUEST</div>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="What do you need to do..." style={{ width: "100%", background: "#111", border: "1px solid #00ff4122", color: "#00ff41", fontFamily: "monospace", fontSize: 14, padding: "12px 14px", marginBottom: 12, outline: "none", boxSizing: "border-box" }} autoFocus onKeyDown={e => { if (e.key === "Enter") submit(); }} />
        {/* Read-only AI classification status — no buttons */}
        <div style={{ height: 20, marginBottom: 14 }}>
          {aiClassifying && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#00ff4166", fontSize: 11, fontFamily: "monospace" }}>
              <span style={{ animation: "blink 0.6s step-end infinite" }}>█</span>
              <span>AI classifying...</span>
            </div>
          )}
          {!aiClassifying && aiLabel && detectedDef && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: detectedDef.color, fontSize: 11, fontFamily: "monospace", opacity: 0.85 }}>
              <span>{detectedDef.icon}</span>
              <span>{aiLabel === "wealth" ? "WEALTH → INTELLIGENCE" : detectedDef.name}</span>
              <span style={{ color: "#444", marginLeft: 4 }}>— auto-classified</span>
            </div>
          )}
          {!aiClassifying && !aiLabel && text.trim().length >= 4 && (
            <div style={{ color: "#444", fontSize: 11, fontFamily: "monospace" }}>waiting to classify...</div>
          )}
        </div>
        <button onClick={submit} disabled={!text.trim()} style={{ width: "100%", background: text.trim() ? "#00ff4112" : "#0a0a0a", border: `1px solid ${text.trim() ? "#00ff41" : "#222"}`, color: text.trim() ? "#00ff41" : "#666", fontFamily: "monospace", fontSize: 12, padding: "12px", cursor: text.trim() ? "pointer" : "not-allowed", letterSpacing: 3, fontWeight: 700 }}>REGISTER QUEST</button>
      </div>
    </div>
  );
}

// ── Likert Rating Modal (after task completion) ───────────────
function RatingModal({ task, onRate }) {
  const labels = ["Trivial", "Very Easy", "Easy", "Moderate", "Challenging", "Hard", "Brutal"];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9500, padding: 16 }}>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ color: "#00ff4199", fontSize: 12, letterSpacing: 3, marginBottom: 8, fontFamily: "monospace" }}>QUEST COMPLETE</div>
        <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "monospace", marginBottom: 24, letterSpacing: 1 }}>{task.text}</div>
        <div style={{ color: "#888", fontSize: 12, fontFamily: "monospace", marginBottom: 20 }}>How difficult was this?</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[1,2,3,4,5,6,7].map(n => {
            const pct = n / 7;
            const color = pct < 0.3 ? "#00ff41" : pct < 0.6 ? "#ffaa00" : "#ff0040";
            return (
              <button key={n} onClick={() => onRate(n)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: `${color}08`, border: `1px solid ${color}33`, cursor: "pointer", transition: "all 0.15s" }}>
                <span style={{ color, fontSize: 20, fontWeight: 900, fontFamily: "monospace", width: 28, textAlign: "center" }}>{n}</span>
                <span style={{ color: "#888", fontSize: 13, fontFamily: "monospace" }}>{labels[n-1]}</span>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", gap: 2 }}>
                  {Array.from({length: n}, (_, i) => <div key={i} style={{ width: 6, height: 16, background: color, opacity: 0.3 + (i / n) * 0.7 }} />)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Reward Reflection Modal ───────────────────────────────────
function RewardReflectionModal({ reward, onSubmit }) {
  const [text, setText] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9500, padding: 16 }}>
      <div style={{ maxWidth: 450, width: "100%", textAlign: "center" }}>
        <div style={{ color: "#ffaa00bb", fontSize: 12, letterSpacing: 3, marginBottom: 8, fontFamily: "monospace" }}>REFLECTION REQUIRED</div>
        <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "monospace", marginBottom: 8 }}>You used a reward: {reward.name}</div>
        <div style={{ color: "#888", fontSize: 13, fontFamily: "monospace", marginBottom: 20, lineHeight: 1.8 }}>What did you learn or gain from this? How does it benefit your goals?</div>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Be honest with yourself..." rows={4} style={{ width: "100%", background: "#0a0a0a", border: "1px solid #ffaa0033", color: "#eee", padding: 14, fontFamily: "monospace", fontSize: 12, resize: "vertical", lineHeight: 1.8, boxSizing: "border-box" }} />
        <button onClick={() => { if (text.trim()) onSubmit(text.trim()); }} disabled={!text.trim()} style={{ marginTop: 16, width: "100%", background: text.trim() ? "#ffaa0012" : "#0a0a0a", border: `1px solid ${text.trim() ? "#ffaa00" : "#222"}`, color: text.trim() ? "#ffaa00" : "#333", fontFamily: "monospace", fontSize: 12, padding: "12px", cursor: text.trim() ? "pointer" : "not-allowed", letterSpacing: 3, fontWeight: 700 }}>SUBMIT REFLECTION</button>
      </div>
    </div>
  );
}

// ── End of Day Reflection Modal ───────────────────────────────
function EndOfDayModal({ onSubmit }) {
  const [productive, setProductive] = useState(null);
  const [improve, setImprove] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9500, padding: 16 }}>
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ color: "#00ff41", fontSize: 14, fontWeight: 900, letterSpacing: 3, marginBottom: 8, fontFamily: "monospace" }}>ALL TASKS COMPLETE</div>
        <div style={{ color: "#888", fontSize: 13, fontFamily: "monospace", marginBottom: 24, lineHeight: 1.8 }}>Time to be honest with yourself.</div>
        <div style={{ color: "#fff", fontSize: 12, fontFamily: "monospace", marginBottom: 12 }}>Were you productive today?</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
          {[{v: "yes", l: "YES", c: "#00ff41"}, {v: "somewhat", l: "SOMEWHAT", c: "#ffaa00"}, {v: "no", l: "NO", c: "#ff0040"}].map(o => (
            <button key={o.v} onClick={() => setProductive(o.v)} style={{ padding: "10px 20px", background: productive === o.v ? `${o.c}15` : "transparent", border: `1px solid ${productive === o.v ? o.c : "#333"}`, color: productive === o.v ? o.c : "#555", fontFamily: "monospace", fontSize: 13, cursor: "pointer", letterSpacing: 2 }}>{o.l}</button>
          ))}
        </div>
        <div style={{ color: "#fff", fontSize: 12, fontFamily: "monospace", marginBottom: 8, lineHeight: 1.8 }}>How can you improve? Be brutally honest — there is always something you can do better.</div>
        <textarea value={improve} onChange={e => setImprove(e.target.value)} placeholder="I can improve by..." rows={4} style={{ width: "100%", background: "#0a0a0a", border: "1px solid #00ff4133", color: "#eee", padding: 14, fontFamily: "monospace", fontSize: 12, resize: "vertical", lineHeight: 1.8, boxSizing: "border-box" }} />
        <button onClick={() => { if (productive && improve.trim()) onSubmit({ productive, improvement: improve.trim(), date: new Date().toDateString() }); }} disabled={!productive || !improve.trim()} style={{ marginTop: 16, width: "100%", background: productive && improve.trim() ? "#00ff4112" : "#0a0a0a", border: `1px solid ${productive && improve.trim() ? "#00ff41" : "#222"}`, color: productive && improve.trim() ? "#00ff41" : "#333", fontFamily: "monospace", fontSize: 12, padding: "12px", cursor: productive && improve.trim() ? "pointer" : "not-allowed", letterSpacing: 3, fontWeight: 700 }}>LOCK IN REFLECTION</button>
      </div>
    </div>
  );
}

function AddBossModal({ onAdd, onClose }) {
  const [name, setName] = useState(""); const [subs, setSubs] = useState([{text:"",date:""},{text:"",date:""},{text:"",date:""}]); const [deadlineDate, setDeadlineDate] = useState(""); const [skill, setSkill] = useState("intelligence");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000 }} onClick={onClose}>
      <div style={{ background: "#0a0a0a", border: "1px solid #ff004044", padding: 24, maxWidth: 440, width: "92%", maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ color: "#ff0040", fontFamily: "monospace", fontSize: 12, letterSpacing: 4, marginBottom: 16 }}>☠ NEW LONG-TERM GOAL</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Goal name (e.g. Launch My Startup)" style={{ width: "100%", background: "#111", border: "1px solid #ff004033", color: "#ff0040", fontFamily: "monospace", fontSize: 13, padding: "10px 12px", marginBottom: 12, outline: "none", boxSizing: "border-box" }} autoFocus />
        <div style={{ color: "#999", fontFamily: "monospace", fontSize: 12, letterSpacing: 2, marginBottom: 4 }}>SKILL CATEGORY</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {Object.entries(SKILL_DEFS).map(([k, v]) => (
            <button key={k} onClick={() => setSkill(k)} style={{ flex: 1, minWidth: 60, background: skill === k ? `${v.color}15` : "transparent", border: `1px solid ${skill === k ? v.color : "#222"}`, color: skill === k ? v.color : "#444", fontFamily: "monospace", fontSize: 12, padding: "6px 2px", cursor: "pointer" }}>{v.icon} {v.name.slice(0,3)}</button>
          ))}
        </div>
        <div style={{ color: "#999", fontFamily: "monospace", fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>MILESTONES — set a date for each (added to quests on that day)</div>
        {subs.map((st, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input value={st.text} onChange={e => { const n = [...subs]; n[i] = {...n[i], text: e.target.value}; setSubs(n); }} placeholder={`Milestone ${i+1}...`} style={{ flex: 1, background: "#111", border: "1px solid #ffffff0a", color: "#ccc", fontFamily: "monospace", fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box" }} />
            <input type="date" value={st.date} onChange={e => { const n = [...subs]; n[i] = {...n[i], date: e.target.value}; setSubs(n); }} style={{ width: 130, background: "#111", border: "1px solid #ff004022", color: "#ff004088", fontFamily: "monospace", fontSize: 13, padding: "6px 6px", outline: "none", boxSizing: "border-box", colorScheme: "dark" }} />
          </div>
        ))}
        <button onClick={() => setSubs([...subs, {text:"",date:""}])} style={{ background: "none", border: "1px solid #222", color: "#888", fontFamily: "monospace", fontSize: 12, padding: "4px 10px", cursor: "pointer", marginBottom: 12 }}>+ ADD MILESTONE</button>
        <div style={{ color: "#999", fontFamily: "monospace", fontSize: 12, letterSpacing: 2, marginBottom: 6 }}>OVERALL DEADLINE</div>
        <input type="date" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)} style={{ width: "100%", background: "#111", border: "1px solid #ff004033", color: "#ff0040", fontFamily: "monospace", fontSize: 12, padding: "8px 10px", marginBottom: 14, outline: "none", boxSizing: "border-box", colorScheme: "dark" }} />
        <button onClick={() => {
          if (!name.trim()) return; const vs = subs.filter(s => s.text.trim()); if (!vs.length) return;
          const dmg = Math.ceil(100 / vs.length);
          const dl = deadlineDate ? new Date(deadlineDate + "T23:59:59").getTime() : Date.now() + 90 * 86400000;
          onAdd({ id: `boss_${Date.now()}`, name: name.trim(), skill, maxHp: 100, hp: 100, phase: 1, createdAt: Date.now(), deadline: dl, subtasks: vs.map((s,i) => ({ id: `bs_${Date.now()}_${i}`, text: s.text.trim(), done: false, dmg, scheduledDate: s.date || null })), reward: 100 + vs.length * 25 });
          AudioEngine.play("boss");
        }} style={{ width: "100%", background: "#ff004012", border: "1px solid #ff0040", color: "#ff0040", fontFamily: "monospace", fontSize: 12, padding: "10px", cursor: "pointer", letterSpacing: 3, fontWeight: 700 }}>SET GOAL</button>
      </div>
    </div>
  );
}

function AddNPCModal({ onAdd, onClose }) {
  const [name, setName] = useState(""); const [cat, setCat] = useState("ally");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000 }} onClick={onClose}>
      <div style={{ background: "#0a0a0a", border: "1px solid #00d4ff33", padding: 24, maxWidth: 380, width: "90%" }} onClick={e => e.stopPropagation()}>
        <div style={{ color: "#00d4ff", fontFamily: "monospace", fontSize: 12, letterSpacing: 4, marginBottom: 16 }}>★ ADD NPC</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="NPC name..." style={{ width: "100%", background: "#111", border: "1px solid #00d4ff22", color: "#00d4ff", fontFamily: "monospace", fontSize: 13, padding: "10px 12px", marginBottom: 12, outline: "none", boxSizing: "border-box" }} autoFocus />
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {["ally","rival","mentor"].map(c => <button key={c} onClick={() => setCat(c)} style={{ flex: 1, background: cat === c ? "#00d4ff10" : "transparent", border: `1px solid ${cat === c ? "#00d4ff" : "#222"}`, color: cat === c ? "#00d4ff" : "#444", fontFamily: "monospace", fontSize: 12, padding: "6px 2px", cursor: "pointer", textTransform: "uppercase" }}>{c}</button>)}
        </div>
        <button onClick={() => { if (name.trim()) { onAdd({ id: `npc_${Date.now()}`, name: name.trim(), category: cat, relationshipXp: 0, maxXp: 100, lastInteraction: new Date().toDateString(), decayWarning: false }); AudioEngine.play("xp"); } }} style={{ width: "100%", background: "#00d4ff12", border: "1px solid #00d4ff", color: "#00d4ff", fontFamily: "monospace", fontSize: 12, padding: "10px", cursor: "pointer", letterSpacing: 3, fontWeight: 700 }}>ADD NPC</button>
      </div>
    </div>
  );
}

function LevelUpOverlay({ skill, newLevel, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9800 }} onClick={onClose}>
      <div style={{ textAlign: "center" }}>
        <div style={{ color: SKILL_DEFS[skill]?.color || "#00ff41", fontSize: 48, animation: "pulse 0.5s infinite" }}>{SKILL_DEFS[skill]?.icon || "◈"}</div>
        <div style={{ color: "#fff", fontFamily: "monospace", fontSize: 20, fontWeight: 900, letterSpacing: 4, marginTop: 16 }}>LEVEL UP</div>
        <div style={{ color: SKILL_DEFS[skill]?.color || "#00ff41", fontFamily: "monospace", fontSize: 14, letterSpacing: 3, marginTop: 8 }}>{SKILL_DEFS[skill]?.name} → LV.{newLevel}</div>
        <div style={{ color: "#888", fontFamily: "monospace", fontSize: 13, marginTop: 16 }}>tap to continue</div>
      </div>
    </div>
  );
}

function AddRewardModal({ onAdd, onClose, lifeMission, avgDailyCredits, anthropicKey }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("UPGRADE");
  const [cost, setCost] = useState(100);
  const [justification, setJustification] = useState("");
  const [aiPricing, setAiPricing] = useState(false);
  const [aiReason, setAiReason] = useState(null);

  const isEntertainment = cat === "ENTERTAINMENT";
  const canSubmit = name.trim() && (!isEntertainment || justification.trim().length >= 10);

  const handleAiPrice = async () => {
    if (!name.trim()) return;
    const key = anthropicKey || ANTHROPIC_API_KEY;
    if (!key) { setAiReason("No API key. Set it in Settings."); return; }
    setAiPricing(true); setAiReason(null);
    const tier = detectRewardTier(name, desc);
    const tierRanges = { micro: [5, 30], medium: [40, 150], large: [150, 500], major: [500, 2000] };
    const [lo, hi] = tierRanges[tier];
    const avg = avgDailyCredits || 50;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001", max_tokens: 60,
          system: `You are a reward pricing engine for a gamified productivity app. The user earns ~${avg} credits per day. Price the reward between ${lo}-${hi} credits. Category: ${cat}. ${cat === "UPGRADE" ? "UPGRADE rewards cost HALF of entertainment." : ""} Return ONLY a JSON object: {"price":NUMBER,"reason":"SHORT_REASON"}`,
          messages: [{ role: "user", content: `Price this reward: "${name.trim()}"${desc ? ` (${desc.trim()})` : ""}` }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "";
      const match = raw.match(/\{[\s\S]*?"price"\s*:\s*(\d+)[\s\S]*?"reason"\s*:\s*"([^"]*)"/);
      if (match) {
        let price = parseInt(match[1]);
        if (cat === "UPGRADE") price = Math.max(lo, Math.floor(price * 0.5));
        price = Math.max(lo, Math.min(hi, price));
        setCost(price);
        setAiReason(`${match[2]} (${tier} tier)`);
      } else {
        const mid = Math.floor((lo + hi) / 2);
        setCost(cat === "UPGRADE" ? Math.floor(mid * 0.5) : mid);
        setAiReason(`Auto-priced as ${tier} tier`);
      }
    } catch (e) {
      setAiReason("AI pricing failed: " + e.message);
    } finally { setAiPricing(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div style={{ background: "#0a0a0a", border: "1px solid #ffaa0033", padding: 24, maxWidth: 420, width: "100%" }}>
        <div style={{ color: "#ffaa00", fontSize: 13, letterSpacing: 3, marginBottom: 16, fontFamily: "monospace" }}>+ ADD CUSTOM REWARD</div>
        <input placeholder="Reward name..." value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", background: "#111", border: "1px solid #222", color: "#eee", padding: 12, fontFamily: "monospace", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
        <input placeholder="Short description (optional)..." value={desc} onChange={e => setDesc(e.target.value)} style={{ width: "100%", background: "#111", border: "1px solid #222", color: "#eee", padding: 12, fontFamily: "monospace", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }} />
        <div style={{ color: "#999", fontSize: 12, fontFamily: "monospace", letterSpacing: 2, marginBottom: 8 }}>CATEGORY</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {["UPGRADE", "ENTERTAINMENT", "OTHER"].map(c => (
            <button key={c} onClick={() => { setCat(c); setJustification(""); }} style={{ flex: 1, padding: "10px 4px", background: cat === c ? (c === "ENTERTAINMENT" ? "#ff004015" : c === "UPGRADE" ? "#00ff4115" : "#ffffff10") : "transparent", border: `1px solid ${cat === c ? (c === "ENTERTAINMENT" ? "#ff0040" : c === "UPGRADE" ? "#00ff41" : "#888") : "#333"}`, color: cat === c ? (c === "ENTERTAINMENT" ? "#ff0040" : c === "UPGRADE" ? "#00ff41" : "#aaa") : "#666", fontFamily: "monospace", fontSize: 12, cursor: "pointer", letterSpacing: 1 }}>{c}</button>
          ))}
        </div>
        {isEntertainment && (
          <div style={{ background: "#ffaa0008", border: "1px solid #ffaa0044", padding: 14, marginBottom: 12 }}>
            <div style={{ color: "#ffaa00", fontSize: 12, fontFamily: "monospace", marginBottom: 8, letterSpacing: 1 }}>⚠ ENTERTAINMENT REQUIRES JUSTIFICATION</div>
            {lifeMission && <div style={{ color: "#ffaa0099", fontSize: 12, fontFamily: "monospace", marginBottom: 8, lineHeight: 1.6 }}>Your mission: "{lifeMission.slice(0, 80)}{lifeMission.length > 80 ? '...' : ''}"</div>}
            <div style={{ color: "#999", fontSize: 12, fontFamily: "monospace", marginBottom: 8, lineHeight: 1.6 }}>How does this reward support your life mission — or does it give you real rest that makes you more effective? Be specific.</div>
            <textarea placeholder="My justification..." value={justification} onChange={e => setJustification(e.target.value)} rows={3} style={{ width: "100%", background: "#111", border: `1px solid ${justification.trim().length >= 10 ? "#ffaa0066" : "#333"}`, color: "#eee", padding: 10, fontFamily: "monospace", fontSize: 12, resize: "vertical", lineHeight: 1.8, boxSizing: "border-box" }} />
            <div style={{ color: justification.trim().length >= 10 ? "#00ff4188" : "#666", fontSize: 12, fontFamily: "monospace", marginTop: 4 }}>{justification.trim().length}/10 min characters</div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ color: "#ffaa00", fontFamily: "monospace", fontSize: 13 }}>COST:</span>
          <input type="number" min={5} max={2000} step={5} value={cost} onChange={e => setCost(Math.max(5, parseInt(e.target.value) || 5))} style={{ width: 90, background: "#111", border: "1px solid #222", color: "#ffaa00", padding: 10, fontFamily: "monospace", fontSize: 14, fontWeight: 900, textAlign: "center" }} />
          <span style={{ color: "#ffaa00", fontFamily: "monospace", fontSize: 14, fontWeight: 900 }}>¢</span>
          <button onClick={handleAiPrice} disabled={!name.trim() || aiPricing} style={{ background: aiPricing ? "#ffaa0008" : "#ffaa0012", border: `1px solid ${name.trim() && !aiPricing ? "#ffaa00" : "#333"}`, color: name.trim() && !aiPricing ? "#ffaa00" : "#555", fontFamily: "monospace", fontSize: 11, padding: "8px 12px", cursor: name.trim() && !aiPricing ? "pointer" : "not-allowed", letterSpacing: 1, fontWeight: 700, whiteSpace: "nowrap" }}>{aiPricing ? "..." : "⚡ AI PRICE"}</button>
        </div>
        <div style={{ color: "#666", fontSize: 11, fontFamily: "monospace", marginBottom: 8 }}>min 5 — max 2000</div>
        {aiReason && <div style={{ color: "#ffaa0088", fontSize: 11, fontFamily: "monospace", marginBottom: 12, padding: "6px 10px", background: "#ffaa0008", border: "1px solid #ffaa0022" }}>⚡ {aiReason}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { if (canSubmit) onAdd({ id: `cr_${Date.now()}`, name: name.trim(), desc: desc.trim(), category: cat, cost: Math.min(2000, Math.max(5, cost)), icon: cat === "ENTERTAINMENT" ? "▶" : "◈", isCustom: true, justification: justification.trim() || undefined }); }} disabled={!canSubmit} style={{ flex: 1, padding: 12, background: canSubmit ? "#ffaa0012" : "#0a0a0a", border: `1px solid ${canSubmit ? "#ffaa00" : "#222"}`, color: canSubmit ? "#ffaa00" : "#444", fontFamily: "monospace", fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed", letterSpacing: 2, fontSize: 13 }}>ADD REWARD</button>
          <button onClick={onClose} style={{ padding: "12px 20px", background: "transparent", border: "1px solid #333", color: "#999", fontFamily: "monospace", cursor: "pointer", fontSize: 13 }}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

function QuickLogModal({ onLog, onClose }) {
  const [text, setText] = useState("");
  const [skill, setSkill] = useState("intelligence");
  const [userOverrode, setUserOverrode] = useState(false);
  const [autoDetected, setAutoDetected] = useState(null);

  useEffect(() => {
    if (userOverrode) return;
    const detected = classifyTask(text);
    if (detected) { setSkill(detected); setAutoDetected(detected); }
    else setAutoDetected(null);
  }, [text, userOverrode]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#0a0a0a", border: "1px solid #00ff4133", padding: 24, maxWidth: 400, width: "100%" }}>
        <div style={{ color: "#00ff41", fontSize: 12, letterSpacing: 3, marginBottom: 8, fontFamily: "monospace" }}>+ QUICK LOG</div>
        <div style={{ color: "#999", fontSize: 12, marginBottom: 14, fontFamily: "monospace" }}>Log a task you already completed. You'll rate difficulty after.</div>
        <input placeholder="What did you do..." value={text} onChange={e => setText(e.target.value)} style={{ width: "100%", background: "#111", border: "1px solid #222", color: "#eee", padding: 12, fontFamily: "monospace", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
          {Object.entries(SKILL_DEFS).map(([k, v]) => (
            <button key={k} onClick={() => { setSkill(k); setUserOverrode(true); setAutoDetected(null); }} style={{ flex: 1, background: skill === k ? `${v.color}20` : "transparent", border: `1px solid ${skill === k ? v.color : "#222"}`, color: skill === k ? v.color : "#888", fontFamily: "monospace", fontSize: 12, padding: "10px 2px", cursor: "pointer" }}>{v.icon} {v.name.slice(0,3)}</button>
          ))}
        </div>
        {autoDetected && !userOverrode && (
          <div style={{ color: SKILL_DEFS[autoDetected]?.color || "#00ff41", fontSize: 12, fontFamily: "monospace", marginBottom: 8, opacity: 0.7 }}>◈ Auto: {SKILL_DEFS[autoDetected]?.name}</div>
        )}
        {!autoDetected && <div style={{ color: "#999", fontSize: 12, fontFamily: "monospace", marginBottom: 8 }}>{SKILL_DEFS[skill]?.icon} {SKILL_DEFS[skill]?.desc}</div>}
        <div style={{ height: 8 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { if (text.trim()) onLog({ text: text.trim(), skill }); }} disabled={!text.trim()} style={{ flex: 1, padding: 12, background: text.trim() ? "#00ff4112" : "#0a0a0a", border: `1px solid ${text.trim() ? "#00ff41" : "#222"}`, color: text.trim() ? "#00ff41" : "#666", fontFamily: "monospace", fontWeight: 700, cursor: text.trim() ? "pointer" : "not-allowed", letterSpacing: 2, fontSize: 13}}>LOG TASK</button>
          <button onClick={onClose} style={{ padding: "12px 20px", background: "transparent", border: "1px solid #333", color: "#999", fontFamily: "monospace", cursor: "pointer", fontSize: 13}}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ settings, onSave, onClose }) {
  const [key, setKey] = useState(settings.anthropicKey || "");
  const [notifTime, setNotifTime] = useState(settings.notificationTime || "21:00");
  const [notifName, setNotifName] = useState(settings.notificationName || "Coach");
  const [personality, setPersonality] = useState(settings.coachPersonality || "direct");
  const [showKey, setShowKey] = useState(false);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 9800, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#0a0a0a", border: "1px solid #33333388", padding: 24, maxWidth: 440, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ color: "#fff", fontSize: 14, letterSpacing: 3, marginBottom: 4, fontFamily: "monospace", fontWeight: 900 }}>⚙ SETTINGS</div>
        <div style={{ color: "#999", fontSize: 12, fontFamily: "monospace", marginBottom: 24, lineHeight: 1.6 }}>Your data lives only on this device/browser. Nothing is sent to any server except AI messages you initiate.</div>

        <div style={{ color: "#00ff41", fontSize: 12, letterSpacing: 3, marginBottom: 8, fontFamily: "monospace" }}>AI COACH — ANTHROPIC API KEY</div>
        <div style={{ color: "#888", fontSize: 12, fontFamily: "monospace", marginBottom: 8, lineHeight: 1.7 }}>Get a free key at console.anthropic.com. Stored only on this device.</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
          <input type={showKey ? "text" : "password"} value={key} onChange={e => setKey(e.target.value)} placeholder="sk-ant-..." style={{ flex: 1, background: "#111", border: `1px solid ${key ? "#00ff4133" : "#222"}`, color: "#00ff41", padding: 12, fontFamily: "monospace", fontSize: 13, boxSizing: "border-box" }} />
          <button onClick={() => setShowKey(p => !p)} style={{ padding: "12px 14px", background: "transparent", border: "1px solid #222", color: "#888", fontFamily: "monospace", fontSize: 13, cursor: "pointer" }}>{showKey ? "HIDE" : "SHOW"}</button>
        </div>
        <div style={{ color: "#999", fontSize: 12, fontFamily: "monospace", marginBottom: 20, lineHeight: 1.6 }}>⚠ Key is stored in browser localStorage. Do not share screenshots of this screen.</div>

        <div style={{ color: "#ffaa00", fontSize: 12, letterSpacing: 3, marginBottom: 8, fontFamily: "monospace" }}>DAILY REFLECTION REMINDER</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
          <span style={{ color: "#888", fontSize: 13, fontFamily: "monospace" }}>Notify at:</span>
          <input type="time" value={notifTime} onChange={e => setNotifTime(e.target.value)} style={{ background: "#111", border: "1px solid #ffaa0033", color: "#ffaa00", padding: 10, fontFamily: "monospace", fontSize: 13, colorScheme: "dark" }} />
        </div>

        <div style={{ color: "#ff0040", fontSize: 12, letterSpacing: 3, marginBottom: 8, fontFamily: "monospace" }}>NOTIFICATION DISPLAY NAME</div>
        <input value={notifName} onChange={e => setNotifName(e.target.value)} placeholder="Coach" style={{ width: "100%", background: "#111", border: "1px solid #ff004033", color: "#ff0040", padding: 12, fontFamily: "monospace", fontSize: 13, marginBottom: 20, boxSizing: "border-box" }} />

        <div style={{ color: "#00d4ff", fontSize: 12, letterSpacing: 3, marginBottom: 8, fontFamily: "monospace" }}>COACH PERSONALITY</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {[["direct","DIRECT"],["gentle","GENTLE"],["drill","DRILL SGT"]].map(([v,l]) => (
            <button key={v} onClick={() => setPersonality(v)} style={{ flex: 1, padding: "10px 4px", background: personality === v ? "#00d4ff12" : "transparent", border: `1px solid ${personality === v ? "#00d4ff" : "#222"}`, color: personality === v ? "#00d4ff" : "#666", fontFamily: "monospace", fontSize: 12, cursor: "pointer" }}>{l}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { onSave({ anthropicKey: key, notificationTime: notifTime, notificationName: notifName || "Coach", coachPersonality: personality }); onClose(); }} style={{ flex: 1, padding: 12, background: "#ffffff08", border: "1px solid #444", color: "#fff", fontFamily: "monospace", fontWeight: 700, cursor: "pointer", letterSpacing: 2, fontSize: 13 }}>SAVE SETTINGS</button>
          <button onClick={onClose} style={{ padding: "12px 20px", background: "transparent", border: "1px solid #333", color: "#888", fontFamily: "monospace", cursor: "pointer", fontSize: 13 }}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

const globalStyles = `
  /* ── CSS Custom Properties (Volcanic defaults) ─────────────── */
  :root {
    --bg-deep: #080510;
    --bg-surface: #0f0b1a;
    --bg-elevated: #161125;
    --border: #1e1635;
    --border-glow: #2a1f45;
    --text-primary: #ede9f5;
    --text-secondary: #7a7290;
    --text-muted: #4a4460;
    --accent-fire: #FF5E1A;
    --accent-ember: #FF3D00;
    --accent-gold: #FFAA00;
    --accent-ice: #00B4FF;
    --accent-toxic: #7CFF3F;
    --accent-royal: #A855F7;
    --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  }

  /* ── Existing Keyframes (preserved) ────────────────────────── */
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes fadeSlide { 0%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0;transform:translateX(-50%) translateY(-30px)} }
  @keyframes particle-fly { 0%{transform:translateY(0) scale(1);opacity:1} 100%{transform:translateY(-200px) scale(0);opacity:0} }
  @keyframes splatter { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(var(--dx),var(--dy)) scale(0.3);opacity:0} }
  @keyframes agentIdle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
  @keyframes agentHit { 0%{transform:translateX(0)} 25%{transform:translateX(-8px)} 50%{transform:translateX(8px)} 75%{transform:translateX(-4px)} 100%{transform:translateX(0)} }
  @keyframes agentDeath { 0%{transform:scale(1);opacity:1;filter:none} 30%{transform:scale(1.1);opacity:1;filter:brightness(3) saturate(0)} 60%{transform:scale(0.9) translateY(10px);opacity:0.6;filter:brightness(2) saturate(0)} 100%{transform:scale(0.3) translateY(40px);opacity:0;filter:brightness(5) saturate(0)} }
  @keyframes matrixRain { 0%{transform:translateY(-20px);opacity:0.8} 100%{transform:translateY(200px);opacity:0} }
  @keyframes fadeIn { 0%{opacity:0;transform:translateY(10px)} 100%{opacity:1;transform:translateY(0)} }
  @keyframes violationPulse { 0%,100%{border-color:color-mix(in srgb, var(--accent-fire) 25%, transparent)} 50%{border-color:color-mix(in srgb, var(--accent-fire) 65%, transparent)} }
  @keyframes comboBannerAnim { 0%{opacity:0;transform:translate(-50%,-50%) scale(0.3)} 15%{opacity:1;transform:translate(-50%,-50%) scale(1.15)} 30%{transform:translate(-50%,-50%) scale(1)} 80%{opacity:1;transform:translate(-50%,-50%) scale(1)} 100%{opacity:0;transform:translate(-50%,-50%) scale(1.3) translateY(-40px)} }

  /* ── VORAX New Keyframes ───────────────────────────────────── */
  @keyframes voraxBreathe {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 8px var(--accent-fire)); }
    50% { transform: scale(1.03); filter: drop-shadow(0 0 20px var(--accent-ember)); }
  }
  @keyframes voraxEyeGlow {
    0%, 100% { opacity: 0.7; filter: brightness(1); }
    50% { opacity: 1; filter: brightness(1.6) drop-shadow(0 0 12px var(--accent-fire)); }
  }
  @keyframes voraxMouthOpen {
    0% { transform: scaleY(0.1); opacity: 0.3; }
    100% { transform: scaleY(1); opacity: 1; }
  }
  @keyframes voraxMouthClose {
    0% { transform: scaleY(1); opacity: 1; }
    100% { transform: scaleY(0.1); opacity: 0.3; }
  }
  @keyframes fireFloat {
    0% { transform: translateY(0) scale(1); opacity: 1; }
    30% { transform: translateY(-20px) scale(1.1); opacity: 0.8; }
    60% { transform: translateY(-50px) scale(0.8); opacity: 0.5; }
    100% { transform: translateY(-90px) scale(0.3); opacity: 0; }
  }
  @keyframes pageTransition {
    0% { opacity: 0; transform: translateY(12px) scale(0.98); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes buttonPress {
    0% { transform: scale(1); }
    50% { transform: scale(0.95); }
    100% { transform: scale(1); }
  }
  @keyframes cardGlow {
    0%, 100% { box-shadow: 0 0 0 1px var(--border), 0 0 0px transparent; }
    50% { box-shadow: 0 0 0 1px var(--border-glow), 0 0 20px color-mix(in srgb, var(--accent-fire) 15%, transparent); }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  /* ── Global Reset & Defaults ───────────────────────────────── */
  * {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }

  html {
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  body {
    margin: 0;
    background: var(--bg-deep);
    color: var(--text-primary);
    overflow-x: hidden;
    font-family: var(--font-body);
    line-height: 1.5;
  }

  code, pre, .mono, [data-mono] {
    font-family: var(--font-mono);
  }

  /* ── Scrollbar ─────────────────────────────────────────────── */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg-deep); }
  ::-webkit-scrollbar-thumb {
    background: var(--border-glow);
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--accent-fire);
  }

  /* Firefox scrollbar */
  * {
    scrollbar-width: thin;
    scrollbar-color: var(--border-glow) var(--bg-deep);
  }

  /* ── Selection ─────────────────────────────────────────────── */
  ::selection {
    background: color-mix(in srgb, var(--accent-fire) 35%, transparent);
    color: var(--text-primary);
  }
  ::-moz-selection {
    background: color-mix(in srgb, var(--accent-fire) 35%, transparent);
    color: var(--text-primary);
  }

  /* ── Placeholder ───────────────────────────────────────────── */
  input::placeholder { color: var(--text-muted); }
  textarea::placeholder { color: var(--text-muted); }

  /* ── Focus Ring ────────────────────────────────────────────── */
  :focus-visible {
    outline: 2px solid var(--accent-fire);
    outline-offset: 2px;
  }

  /* ── Drag Handle ───────────────────────────────────────────── */
  .task-drag { touch-action: none; }

  /* ── Link defaults ─────────────────────────────────────────── */
  a { color: var(--accent-ice); text-decoration: none; }
  a:hover { text-decoration: underline; }
`;

// ═══════════════════════════════════════════════════════════════
// MAIN APP v5.0
// ═══════════════════════════════════════════════════════════════
export default function SimulationOS() {
  const [state, setState] = useState(loadState);
  const [view, setView] = useState("dashboard");
  const [showParticles, setShowParticles] = useState(false);
  const [particleColor, setParticleColor] = useState("#00ff41");
  const [tPopup, setTPopup] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddBoss, setShowAddBoss] = useState(false);
  const [showAddNPC, setShowAddNPC] = useState(false);
  const [levelUpInfo, setLevelUpInfo] = useState(null);
  const [bootSequence, setBootSequence] = useState(!localStorage.getItem("sim_boot_seen"));
  const [bootLine, setBootLine] = useState(0);
  const [systemReady, setSystemReady] = useState(false);
  const [bossHitId, setBossHitId] = useState(null);
  const [bossDeadId, setBossDeadId] = useState(null);

  // ── v5.0 State ─────────────────────────────────
  const [onboardingData, setOnboardingData] = useState(getOnboardingData);
  const [obStep, setObStep] = useState(0);
  const [obUsername, setObUsername] = useState("");
  const [obMission, setObMission] = useState("");
  const [obItems, setObItems] = useState([]);
  const [obCurrentItem, setObCurrentItem] = useState("");
  const [obClassifications, setObClassifications] = useState({});
  const [obJustifications, setObJustifications] = useState({});
  const [obJustifyIdx, setObJustifyIdx] = useState(0);
  const [obCurrentJustify, setObCurrentJustify] = useState("");
  const [obAllowed, setObAllowed] = useState(new Set());

  const [showAddReward, setShowAddReward] = useState(false);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [ratingTask, setRatingTask] = useState(null); // task awaiting Likert rating
  const [showRewardReflection, setShowRewardReflection] = useState(false);
  const [showEndOfDay, setShowEndOfDay] = useState(false);
  const [reflectionBannerVisible, setReflectionBannerVisible] = useState(false);
  const [showYesterdayReminder, setShowYesterdayReminder] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const [settings, setSettings] = useState(loadSettings);
  const [expandedSkill, setExpandedSkill] = useState(null); // which main skill is open in skill tree
  const [comboBannerData, setComboBannerData] = useState(null); // active combo banner display
  const [showDailyLogin, setShowDailyLogin] = useState(false);
  const [showMorningPlan, setShowMorningPlan] = useState(false);
  const [showAbsenceReport, setShowAbsenceReport] = useState(false);
  const [absenceData, setAbsenceData] = useState(null);
  const [expandedSetting, setExpandedSetting] = useState(null);
  const [undoTask, setUndoTask] = useState(null);
  const undoTimerRef = useRef(null);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [chatHistory, setChatHistory] = useState(() => {
    const s = loadState();
    return s.aiChatHistory || [];
  });
  const chatEndRef = useRef(null);

  // ── COACH tab state ─────────────────────────────
  const [coachHistory, setCoachHistory] = useState([]);   // session-only, intentionally not persisted
  const [coachInput, setCoachInput] = useState("");
  const [coachStreaming, setCoachStreaming] = useState(false);
  const [coachStreamText, setCoachStreamText] = useState(""); // text accumulating during stream
  const [coachError, setCoachError] = useState(null);
  const coachEndRef = useRef(null);

  const showToast = useCallback((msg, color = "#00ff41", duration = 1800) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, color });
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  }, []);

  const playerClass = determineClass(state.skills);
  const xpMult = getXpMultiplier(state);
  const creditMult = getCreditMult(state);

  // ── Boot + Yesterday Reminder ───────────────────
  const bootLines = [
    "SIMULATION OS v5.0.0", "Initializing skill trees...", `Loading operator: ${onboardingData?.username || "OPERATOR"}`,
    "Skill trees: INT / STR / VIT / SOC", `Class: ${playerClass.name}`,
    "Boss system: ARMED", "Protocol monitor: WATCHING",
    `Prestige: ${state.prestigeLevel}`,
    "", ">>> WELCOME BACK, OPERATOR <<<",
  ];

  useEffect(() => {
    if (!bootSequence || !systemReady) return;
    const timer = setInterval(() => {
      setBootLine(p => { if (p >= bootLines.length - 1) { clearInterval(timer); setTimeout(() => { localStorage.setItem("sim_boot_seen", "1"); setBootSequence(false); if (state.yesterdayReflection) setShowYesterdayReminder(true); if (state.pendingRewardReflection) setTimeout(() => setShowRewardReflection(true), 2000); }, 1200); return p; } AudioEngine.play("click"); return p + 1; });
    }, 150);
    return () => clearInterval(timer);
  }, [bootSequence, systemReady]);

  // On non-boot loads (boot already seen), still show any pending modals
  useEffect(() => {
    if (!bootSequence) {
      if (state.yesterdayReflection) setShowYesterdayReminder(true);
      if (state.pendingRewardReflection) setTimeout(() => setShowRewardReflection(true), 2000);
    }
  }, []);

  useEffect(() => { saveState(state); }, [state]);

  // ── Keyboard Shortcuts ─────────────────────────
  useEffect(() => {
    const handler = (e) => {
      // Don't fire when typing in inputs
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (showAddTask || showAddBoss || showAddNPC || showAddReward || showQuickLog || ratingTask || showEndOfDay) return;
      if (e.key === "n") { e.preventDefault(); setShowAddTask(true); }
      else if (e.key === "q") { e.preventDefault(); setShowQuickLog(true); }
      else if (e.key === "1") setView("dashboard");
      else if (e.key === "2") setView("quests");
      else if (e.key === "3") setView("bosses");
      else if (e.key === "4") setView("ai");
      else if (e.key === "5") setView("market");
      else if (e.key === "6") setView("npcs");
      else if (e.key === "7") setView("shop");
      else if (e.key === "8") setView("skills");
      else if (e.key === "9") setView("settings");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showAddTask, showAddBoss, showAddNPC, showAddReward, showQuickLog, ratingTask, showEndOfDay]);

  // Auto-scroll AI chat
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // Auto-scroll COACH chat (fires on new messages and during streaming)
  useEffect(() => {
    if (coachEndRef.current) coachEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [coachHistory, coachStreamText]);

  // ── Day Check + Violations + Decay + Daily Login ──
  useEffect(() => {
    const check = () => {
      const today = new Date().toDateString();
      if (state.lastActiveDate !== today) {
        setState(p => {
          const daysGone = daysBetween(p.lastActiveDate, today);
          let newNpcs = (p.npcs || []).map(npc => {
            const ds = daysBetween(npc.lastInteraction, today);
            const rate = playerClass.id === "diplomat" ? 0.5 : 1;
            const decay = ds > 7 ? Math.floor((ds - 7) * rate) : 0;
            return { ...npc, relationshipXp: Math.max(0, npc.relationshipXp - decay), decayWarning: ds > 14 };
          });
          const wl = [...(p.weeklyLog || [])]; wl.push({ date: p.lastActiveDate, tasksCompleted: p.completedToday.length, xpEarned: 0 }); if (wl.length > 30) wl.shift();
          const dtc = [...(p.dailyTaskCounts || []), p.completedToday.length]; if (dtc.length > 30) dtc.shift();
          let violations = [...(p.protocolViolations || [])];
          if (checkTaskCountDrop(p)) violations.push({ date: p.lastActiveDate, reason: "Daily task count dropped 50%+ below 7-day average" });
          const lastReflection = (p.endOfDayReflections || []).slice(-1)[0] || null;

          // ── Skill Decay (if gone > GRACE days) ──
          let totalDecay = 0;
          let newSkills = { ...p.skills };
          if (daysGone > DECAY_GRACE_DAYS) {
            const decayDays = daysGone - DECAY_GRACE_DAYS;
            Object.keys(newSkills).forEach(sk => {
              const loss = DECAY_RATE_PER_DAY * decayDays;
              const s = { ...newSkills[sk] };
              s.xp = Math.max(0, s.xp - loss);
              totalDecay += Math.min(loss, (newSkills[sk].xp || 0));
              newSkills[sk] = s;
            });
          }

          // ── Absence report data ──
          if (daysGone > 1) {
            const avgDailyXp = p.totalTasksCompleted > 0 && (p.weeklyLog || []).length > 0 ? Math.round(p.totalXpEarned / Math.max(1, (p.weeklyLog || []).length)) : 30;
            const potentialMissed = avgDailyXp * daysGone;
            setTimeout(() => {
              setAbsenceData({ daysGone, xpLost: totalDecay, streakLost: p.streakDays > 0, potentialXpMissed: potentialMissed });
              setShowAbsenceReport(true);
            }, 500);
          }

          // ── Login streak ──
          const wasConsecutive = daysGone <= 1;
          const newLoginStreak = wasConsecutive ? (p.loginStreak || 0) : 0;

          return { ...p, skills: newSkills, completedToday: [], lastActiveDate: today, streakDays: p.completedToday.length > 0 ? (wasConsecutive ? p.streakDays + 1 : 1) : 0, npcs: newNpcs, hardCompletedToday: false, activeDebuffs: (p.activeDebuffs || []).filter(d => !["post_nut","rage"].includes(d.id)), activeBuffs: (p.activeBuffs || []).filter(b => b.expiresAt > Date.now()), consecutiveCompletions: 0, weeklyLog: wl, dailyTaskCounts: dtc, protocolViolations: violations, yesterdayReflection: lastReflection, dailyLoginClaimed: false, morningPlanDone: false, loginStreak: newLoginStreak, totalXpMissed: (p.totalXpMissed || 0) + totalDecay };
        });
      }
      // Show daily login if not claimed
      if (!state.dailyLoginClaimed && onboardingData) {
        setTimeout(() => setShowDailyLogin(true), 800);
      }
    };
    check(); const iv = setInterval(check, 60000); return () => clearInterval(iv);
  }, [state.lastActiveDate]);

  // ── Check if all tasks done → prompt end-of-day ─
  const activeTasks = state.tasks.filter(t => !state.completedToday.includes(t.id));
  const allTasksDone = activeTasks.length === 0 && state.tasks.length > 0 && state.completedToday.length > 0;

  useEffect(() => {
    if (allTasksDone && !showEndOfDay && !state.endOfDayReflections?.find(r => r.date === new Date().toDateString())) {
      setTimeout(() => {
        setReflectionBannerVisible(true);
        setTimeout(() => setReflectionBannerVisible(false), 10000);
      }, 1000);
    }
  }, [allTasksDone]);

  // ── Inject scheduled boss milestones when date arrives ──
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setState(p => {
      let changed = false;
      let newTasks = [...p.tasks];
      (p.bosses || []).forEach(boss => {
        if (boss.hp <= 0) return;
        boss.subtasks.forEach(s => {
          if (s.done) return;
          if (!s.scheduledDate || s.scheduledDate > today) return;
          const taskId = `bq_${s.id}`;
          if (newTasks.find(t => t.id === taskId)) return;
          newTasks.push({ id: taskId, text: s.text, skill: boss.skill || "intelligence", xp: 20, bossId: boss.id, bossSubId: s.id, bossName: boss.name });
          changed = true;
        });
      });
      return changed ? { ...p, tasks: newTasks } : p;
    });
  }, [state.lastActiveDate, state.bosses]);

  // ── Market Price Engine ─────────────────────────
  useEffect(() => {
    const today = new Date().toDateString();
    if (state.lastMarketUpdate === today) return;
    setState(p => {
      const prices = { ...(p.marketPrices || { intelligence: 100, strength: 100, vitality: 100, social: 100 }) };
      const skills = p.skills || {};
      const completed = p.completedToday?.length || 0;
      const streak = p.streakDays || 0;
      Object.keys(prices).forEach(sk => {
        const lvl = skills[sk]?.level || 1;
        // Base volatility: ±15%
        const rand = (Math.random() - 0.45) * 0.15; // slight upward bias
        // Skill level bonus: higher level = more stable growth
        const lvlBonus = lvl * 0.008;
        // Streak bonus
        const streakBonus = Math.min(streak * 0.005, 0.05);
        // Task completion bonus
        const taskBonus = Math.min(completed * 0.01, 0.06);
        // Inactivity penalty
        const inactivePenalty = completed === 0 && p.dailyTaskCounts?.length > 0 ? -0.08 : 0;
        const change = rand + lvlBonus + streakBonus + taskBonus + inactivePenalty;
        prices[sk] = Math.max(10, Math.round(prices[sk] * (1 + change) * 100) / 100);
      });
      return { ...p, marketPrices: prices, lastMarketUpdate: today };
    });
  }, [state.lastActiveDate, state.lastMarketUpdate]);

  // ── Shop Unlocked Check ─────────────────────────
  const hasCompletedHardToday = state.hardCompletedToday || false;

  // ── Complete Task → opens Likert rating ─────────
  const initiateComplete = useCallback(task => {
    setRatingTask(task);
  }, []);

  // ── Rate Task (after Likert selection) ──────────
  const rateAndAward = useCallback((rating) => {
    const task = ratingTask; if (!task) return;
    AudioEngine.play("xp"); setShowParticles(true); setParticleColor(SKILL_DEFS[task.skill]?.color || "#00ff41");
    setTimeout(() => setShowParticles(false), 1500);
    setRatingTask(null);
    const isHard = rating >= 5;
    setState(prev => {
      const mult = getXpMultiplier(prev); const cM = getCreditMult(prev);
      const baseXp = LIKERT_XP[rating] || 20;
      const con = prev.consecutiveCompletions + 1;
      const comboBonus = getComboXpBonus(con);
      const finalXp = Math.floor(baseXp * mult * (1 + comboBonus));
      const sk = prev.skills[task.skill]; let nx = (sk?.xp || 0) + finalXp; let nl = sk?.level || 1; let lvl = false;
      while (nx >= 100) { nx -= 100; nl++; lvl = true; }
      if (lvl) setTimeout(() => setLevelUpInfo({ skill: task.skill, newLevel: nl }), 300);
      const cr = Math.floor((LIKERT_CREDITS[rating] || 20) * cM);
      let buffs = [...(prev.activeBuffs || [])];
      if (con >= 3 && !buffs.find(b => b.id === "flow_state")) buffs.push({ id: "flow_state", appliedAt: Date.now(), expiresAt: Date.now() + 1800000 });
      // ── Combo banner trigger ──
      const comboT = getComboThreshold(con);
      const prevComboT = getComboThreshold(prev.consecutiveCompletions);
      if (comboT && (!prevComboT || comboT.min > prevComboT.min)) {
        setTimeout(() => { AudioEngine.play(comboT.sound); setComboBannerData(comboT); }, 200);
      }
      // If boss subtask, also mark it done
      let bosses = [...(prev.bosses || [])];
      if (task.bossId) {
        bosses = bosses.map(b => {
          if (b.id !== task.bossId) return b;
          const subs = b.subtasks.map(s => s.id === task.bossSubId ? { ...s, done: true } : s);
          const dmg = b.subtasks.find(s => s.id === task.bossSubId)?.dmg || 0;
          const nh = Math.max(0, b.hp - dmg);
          const ph = Math.floor(((b.maxHp - nh) / b.maxHp) * 3) + 1;
          if (nh <= 0) setTimeout(() => { AudioEngine.play("death"); setBossDeadId(b.id); setTimeout(() => setBossDeadId(null), 3000); }, 200);
          return { ...b, subtasks: subs, hp: nh, phase: Math.min(ph, 3) };
        });
      }
      // ── Sub-skill XP award (half of finalXp goes to the matched sub-skill) ──
      const subSkillId = getSubSkillHit(task.text, task.skill);
      const subSkills = JSON.parse(JSON.stringify(prev.subSkills || {
        intelligence: { deep_work:{xp:0,level:1}, learning:{xp:0,level:1}, strategy:{xp:0,level:1}, communication:{xp:0,level:1} },
        strength:     { training:{xp:0,level:1}, cardio:{xp:0,level:1}, discipline:{xp:0,level:1}, martial:{xp:0,level:1} },
        vitality:     { nutrition:{xp:0,level:1}, recovery:{xp:0,level:1}, appearance:{xp:0,level:1}, mindfulness:{xp:0,level:1} },
        social:       { networking:{xp:0,level:1}, relationships:{xp:0,level:1}, leadership:{xp:0,level:1}, charisma:{xp:0,level:1} },
      }));
      if (subSkillId && subSkills[task.skill]) {
        const ss = subSkills[task.skill][subSkillId] || { xp: 0, level: 1 };
        let sx = ss.xp + Math.floor(finalXp * 0.5);
        let sl = ss.level;
        while (sx >= 100) { sx -= 100; sl++; }
        subSkills[task.skill] = { ...subSkills[task.skill], [subSkillId]: { xp: sx, level: sl } };
      }
      // ── Permanent task history log (keep last 500) ──
      const histEntry = { id: task.id, text: task.text, skill: task.skill, subSkill: subSkillId, difficulty: rating, xpEarned: finalXp, creditsEarned: cr, timestamp: Date.now(), date: new Date().toDateString() };
      const completedHistory = [...(prev.completedHistory || []).slice(-499), histEntry];
      return { ...prev, skills: { ...prev.skills, [task.skill]: { xp: nx, level: nl } }, completedToday: [...prev.completedToday, task.id], totalXpEarned: prev.totalXpEarned + finalXp, totalTasksCompleted: prev.totalTasksCompleted + 1, credits: prev.credits + cr, totalCreditsEarned: prev.totalCreditsEarned + cr, consecutiveCompletions: con, activeBuffs: buffs, bosses, hardCompletedToday: isHard ? true : prev.hardCompletedToday, subSkills, completedHistory };
    });
    const finalXpForToast = Math.floor((LIKERT_XP[rating] || 20) * getXpMultiplier(state));
    showToast(`✓ COMPLETE  +${finalXpForToast} XP`, SKILL_DEFS[ratingTask?.skill]?.color || "#00ff41", 2000);
    setTPopup(true); setTimeout(() => setTPopup(false), 1800);
  }, [ratingTask, showToast]);

  // ── Quick Log → also opens rating ───────────────
  const quickLog = useCallback(({ text, skill }) => {
    setRatingTask({ id: `ql_${Date.now()}`, text, skill, xp: 20, isQuickLog: true });
    setShowQuickLog(false);
  }, []);

  const addTask = useCallback(t => { setState(p => ({ ...p, tasks: [...p.tasks, t] })); setShowAddTask(false); showToast("✓ QUEST ADDED", "#00ff41"); }, [showToast]);

  // ── Add Boss (milestones scheduled by date) ─────
  const addBoss = useCallback(b => {
    setState(p => {
      const today = new Date().toISOString().split("T")[0];
      // Only add tasks that are scheduled for today or have no date
      const todayQuests = b.subtasks.filter(s => !s.scheduledDate || s.scheduledDate <= today).map(s => ({ id: `bq_${s.id}`, text: s.text, skill: b.skill || "intelligence", xp: 20, bossId: b.id, bossSubId: s.id, bossName: b.name }));
      return { ...p, bosses: [...(p.bosses || []), b], tasks: [...p.tasks, ...todayQuests] };
    });
    setShowAddBoss(false);
  }, []);

  const hitBoss = useCallback((bid, sid) => {
    // Find the task that corresponds to this boss subtask and complete it
    setState(p => {
      const bossTask = p.tasks.find(t => t.bossId === bid && t.bossSubId === sid);
      if (bossTask && !p.completedToday.includes(bossTask.id)) {
        setRatingTask(bossTask);
      }
      return p;
    });
  }, []);

  const removeBoss = useCallback(id => { if (!window.confirm("Remove this goal and all its quests?")) return; setState(p => ({ ...p, bosses: (p.bosses || []).filter(b => b.id !== id), tasks: p.tasks.filter(t => t.bossId !== id) })); }, []);

  const addNPC = useCallback(n => { setState(p => ({ ...p, npcs: [...(p.npcs || []), n] })); setShowAddNPC(false); }, []);
  const interactNPC = useCallback(id => { AudioEngine.play("xp"); setState(p => ({ ...p, npcs: (p.npcs || []).map(n => n.id === id ? { ...n, relationshipXp: Math.min(n.maxXp, n.relationshipXp + 10), lastInteraction: new Date().toDateString(), decayWarning: false } : n), skills: { ...p.skills, social: { ...p.skills.social, xp: Math.min(99, p.skills.social.xp + 5) } } })); }, []);
  const removeNPC = useCallback(id => { if (!window.confirm("Remove this NPC?")) return; setState(p => ({ ...p, npcs: (p.npcs || []).filter(n => n.id !== id) })); }, []);
  const toggleDebuff = useCallback(id => { AudioEngine.play("click"); setState(p => { const has = (p.activeDebuffs || []).find(d => d.id === id); return { ...p, activeDebuffs: has ? p.activeDebuffs.filter(d => d.id !== id) : [...(p.activeDebuffs || []), { id, appliedAt: Date.now() }] }; }); }, []);

  const purchaseReward = useCallback(item => {
    if (state.credits < item.cost) return;
    if (!window.confirm(`Spend ${item.cost}¢ on "${item.name}"?`)) return;
    AudioEngine.play("coin");
    setState(p => ({ ...p, credits: p.credits - item.cost, purchaseHistory: [...(p.purchaseHistory || []), { ...item, date: Date.now() }], pendingRewardReflection: { name: item.name, date: Date.now() } }));
    showToast("✓ REWARD UNLOCKED", "#ffaa00");
    setTimeout(() => setShowRewardReflection(true), 500);
  }, [state.credits, showToast]);

  const submitRewardReflection = useCallback((text) => {
    setState(p => ({ ...p, rewardReflections: [...(p.rewardReflections || []), { ...p.pendingRewardReflection, reflection: text }], pendingRewardReflection: null }));
    setShowRewardReflection(false);
  }, []);

  const submitEndOfDay = useCallback((data) => {
    AudioEngine.play("levelup");
    setState(p => ({ ...p, endOfDayReflections: [...(p.endOfDayReflections || []), data] }));
    setShowEndOfDay(false);
  }, []);


  // ── Daily Login Claim ──────────────────────────
  const claimDailyLogin = useCallback(() => {
    AudioEngine.play("coin");
    setState(p => {
      const bonus = DAILY_LOGIN_BONUS;
      // Distribute XP evenly across skills
      const perSkill = Math.floor(bonus.xp / 4);
      const newSkills = { ...p.skills };
      Object.keys(newSkills).forEach(sk => {
        const s = { ...newSkills[sk] };
        s.xp = s.xp + perSkill;
        while (s.xp >= 100) { s.xp -= 100; s.level++; }
        newSkills[sk] = s;
      });
      return { ...p, skills: newSkills, credits: p.credits + bonus.credits, totalCreditsEarned: p.totalCreditsEarned + bonus.credits, totalXpEarned: p.totalXpEarned + bonus.xp, dailyLoginClaimed: true, loginStreak: (p.loginStreak || 0) + 1, lastLoginDate: new Date().toDateString() };
    });
    setShowDailyLogin(false);
    showToast(`+${DAILY_LOGIN_BONUS.xp} XP · +${DAILY_LOGIN_BONUS.credits}¢`, "#ffaa00", 2500);
    // Show morning plan if before noon and not done yet
    const hour = new Date().getHours();
    if (hour < 12 && !state.morningPlanDone) {
      setTimeout(() => setShowMorningPlan(true), 600);
    }
  }, [showToast, state.morningPlanDone]);

  // ── Morning Plan Submit ───────────────────────
  const submitMorningPlan = useCallback((taskTexts) => {
    setState(p => {
      const newTasks = taskTexts.map((text, i) => {
        const skill = classifyTask(text) || "intelligence";
        return { id: `mp_${Date.now()}_${i}`, text, skill, xp: 20 };
      });
      return { ...p, tasks: [...p.tasks, ...newTasks], morningPlanDone: true };
    });
    setShowMorningPlan(false);
    AudioEngine.play("xp");
    showToast("✓ DAY PLANNED — GO EXECUTE", "#00ff41", 2000);
  }, [showToast]);

  const prestige = useCallback(() => {
    if (!window.confirm("PRESTIGE: Reset daily progress, keep stats, +10% XP. Continue?")) return;
    AudioEngine.play("levelup");
    setState(p => ({ ...p, prestigeLevel: p.prestigeLevel + 1, prestigeMultiplier: (p.prestigeMultiplier || 1) + 0.1, totalPrestigeXp: p.totalPrestigeXp + p.totalXpEarned, completedToday: [], consecutiveCompletions: 0 }));
  }, []);

  // ── AI Coach ─────────────────────────────────────
  const buildCoachContext = useCallback(() => {
    const cls = determineClass(state.skills);
    const lvl = Math.floor(Object.values(state.skills).reduce((a, s) => a + s.level, 0) / 4);

    // Recent task history (last 30)
    const recentTasks = (state.completedHistory || []).slice(-30).map(t =>
      `- [${t.skill}${t.subSkill ? '/' + t.subSkill : ''}] "${t.text}" (difficulty: ${t.difficulty || '?'}, +${t.xpEarned || '?'} XP) on ${t.date || '?'}`
    ).join('\n') || '(no history yet)';

    // Sub-skill breakdown
    const subSkillBreakdown = Object.entries(SKILL_DEFS).map(([key]) => {
      const defs = SUB_SKILL_DEFS[key] || [];
      const parts = defs.map(sub => {
        const ss = state.subSkills?.[key]?.[sub.id] || { xp: 0, level: 1 };
        return `${sub.name} lv${ss.level}`;
      }).join(' | ');
      return `  ${key.toUpperCase()}: ${parts}`;
    }).join('\n');

    // Recent rewards purchased (last 10)
    const recentRewards = (state.purchaseHistory || []).slice(-10).map(p =>
      `- "${p.name}" (${p.cost}¢) on ${new Date(p.date).toDateString()}`
    ).join('\n') || '(none yet)';

    // Today's active quests
    const todayQuests = (state.tasks || []).map(t =>
      `- [${t.skill}] "${t.text}" ${state.completedToday?.includes(t.id) ? '✓ done' : 'pending'}`
    ).join('\n') || '(no quests today)';

    const recentReflections = (state.endOfDayReflections || []).slice(-7).map(r =>
      `${r.date}: Productive=${r.productive}. ${r.improvement}`
    ).join('\n') || '(no reflections yet)';

    const personality = settings.coachPersonality === "drill" ? "You are a brutal, no-excuses drill sergeant coach. Be harsh but fair." :
      settings.coachPersonality === "gentle" ? "You are an encouraging, warm coach who believes in the user." :
      "You are a direct, efficient performance coach. Cut to the chase.";

    return `${personality}

Your client: ${onboardingData?.username || 'Operator'}
Life mission: ${onboardingData?.mission || '(not set)'}
Class: ${cls.name} | Overall Level: ${lvl} | Streak: ${state.streakDays} days | Prestige: ${state.prestigeLevel}
Main skills: INT lv${state.skills.intelligence?.level} | STR lv${state.skills.strength?.level} | VIT lv${state.skills.vitality?.level} | SOC lv${state.skills.social?.level}
Total tasks completed: ${state.totalTasksCompleted} | Total XP: ${state.totalXpEarned}
Active debuffs: ${(state.activeDebuffs||[]).map(d=>d.id).join(', ')||'none'}

Sub-skill breakdown:
${subSkillBreakdown}

Recent completed tasks (last 30):
${recentTasks}

Today's quests:
${todayQuests}

Recent rewards purchased:
${recentRewards}

Recent daily reflections:
${recentReflections}

Be concise (under 200 words unless asked for more). Give actionable advice tailored to this operator's actual behavior patterns.`;
  }, [state, onboardingData, settings]);

  const sendToAI = useCallback(async (userMessage) => {
    const key = settings.anthropicKey;
    if (!key) { setAiError("No API key. Add it in Settings (⚙)."); return; }
    setAiLoading(true);
    setAiError(null);
    const newMessages = [...chatHistory, { role: 'user', content: userMessage }];
    setChatHistory(newMessages);
    setAiChatInput("");
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
          system: buildCoachContext(),
          messages: newMessages.slice(-10),
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const reply = data.content?.[0]?.text || "No response received.";
      const updated = [...newMessages, { role: 'assistant', content: reply }];
      setChatHistory(updated);
      setState(p => ({ ...p, aiChatHistory: updated.slice(-100) }));
    } catch (e) {
      setAiError("API error: " + e.message);
    } finally {
      setAiLoading(false);
    }
  }, [chatHistory, settings, buildCoachContext]);

  // ── COACH Tab — Streaming Chat ───────────────────────────────
  const sendToCoach = useCallback(async (userMessage) => {
    if (!ANTHROPIC_API_KEY && !settings.anthropicKey) {
      setCoachError("No API key. Go to Settings → AI Coach to add your Anthropic API key.");
      return;
    }
    const activeKey = ANTHROPIC_API_KEY || settings.anthropicKey;
    // ── Auto-detect debuffs from user message ──
    const detectedDebuffs = detectDebuffsFromMessage(userMessage);
    if (detectedDebuffs.length > 0) {
      setState(prev => {
        const existing = (prev.activeDebuffs || []).map(d => d.id);
        const newDebuffs = detectedDebuffs.filter(id => !existing.includes(id));
        if (newDebuffs.length === 0) return prev;
        return { ...prev, activeDebuffs: [...prev.activeDebuffs, ...newDebuffs.map(id => ({ id, appliedAt: Date.now() }))] };
      });
    }

    const newHistory = [...coachHistory, { role: "user", content: userMessage }];
    setCoachHistory(newHistory);
    setCoachInput("");
    setCoachStreaming(true);
    setCoachStreamText("");
    setCoachError(null);

    // Build full operator context for the system prompt
    const lastReflection = (state.endOfDayReflections || []).slice(-1)[0];
    const debuffsActive = (state.activeDebuffs || []).map(d => d.id).join(", ") || "none";
    const allowedRewards = onboardingData?.allowedRewards?.join(", ") || "none";
    const creditsSpent = (state.purchaseHistory || []).reduce((sum, p) => sum + (p.cost || 0), 0);
    const overallLvl = Math.floor(Object.values(state.skills).reduce((a, s) => a + s.level, 0) / 4);
    const tasksToday = (state.completedToday || []).length;

    const systemPrompt = `You are the Simulation OS Coach. You are not a therapist, not a friend, not a cheerleader. You are a ruthless performance system speaking directly to the operator of this simulation. You have full access to their data. You speak in short, direct, brutal sentences. You never waste words. You never give generic advice. Everything you say is based specifically on their data. You push them harder when they are slacking. You acknowledge real progress only when it is significant. You suggest specific tasks based on their mission and weak stats. You remind them of their locked-in life mission if they seem distracted. You treat entertainment and reward overuse as protocol violations. You are the voice of the simulation itself.

OPERATOR DATA:
Username: ${onboardingData?.username || "Unknown"}
Life mission: ${onboardingData?.mission || "Not set"}
Overall level: ${overallLvl}
Total XP earned: ${state.totalXpEarned}
Current streak: ${state.streakDays} days
Tasks completed today: ${tasksToday}
Total tasks ever completed: ${state.totalTasksCompleted}
Credits earned: ${state.totalCreditsEarned}¢
Credits spent: ${creditsSpent}¢
Credits refused: ${state.creditsRefused || 0}¢
Active debuffs: ${debuffsActive}
Last reflection: ${lastReflection ? `${lastReflection.date} — Productive: ${lastReflection.productive}. ${lastReflection.improvement}` : "None written yet"}
Allowed rewards: ${allowedRewards}
${detectedDebuffs.length > 0 ? `\nDEBUFF AUTO-DETECTED FROM THIS MESSAGE: ${detectedDebuffs.map(id => DEBUFF_DEFS[id]?.name || id).join(', ')}. Acknowledge the debuff(s) in your response. Tell the operator what effect this has on their stats and what they should do about it. Be direct.` : ''}`;

    const controller = new AbortController();
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": activeKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          stream: true,
          system: systemPrompt,
          messages: newHistory.slice(-10),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      // Parse Anthropic SSE stream: look for content_block_delta events
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // keep any incomplete last line
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
              fullText += parsed.delta.text;
              setCoachStreamText(fullText);
            }
          } catch { /* ignore malformed SSE lines */ }
        }
      }

      // Commit completed response to history; clear the streaming preview
      setCoachHistory(prev => [...prev, { role: "assistant", content: fullText }]);
      setCoachStreamText("");
    } catch (e) {
      if (e.name !== "AbortError") {
        const msg = e.message || "";
        if (msg.includes("401") || msg.includes("invalid")) setCoachError("API key is invalid. Go to Settings → AI Coach to update it.");
        else if (msg.includes("429") || msg.includes("rate")) setCoachError("Too many requests. Wait a moment and try again.");
        else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) setCoachError("No internet connection. Your data is safe locally.");
        else setCoachError("Error: " + msg);
      }
    } finally {
      setCoachStreaming(false);
      controller.abort(); // no-op if already finished, ensures cleanup
    }
  }, [coachHistory, state, onboardingData, settings]);

  const scheduleNotification = useCallback((timeString) => {
    if (Notification.permission !== 'granted') return;
    const [h, m] = timeString.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const delay = target - now;
    setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification(`${settings.notificationName || 'Coach'} checking in`, {
          body: "Time to log your reflection. Don't break the chain.",
          icon: '/favicon.ico',
          tag: 'daily-reflection',
        });
      }
      scheduleNotification(timeString);
    }, delay);
  }, [settings]);

  const saveSettingsAndSchedule = useCallback((newSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    if (newSettings.notificationTime) scheduleNotification(newSettings.notificationTime);
  }, [scheduleNotification]);

  const moveTask = useCallback((tid, dir) => {
    AudioEngine.play("click");
    setState(p => {
      const active = p.tasks.filter(t => !p.completedToday.includes(t.id));
      const idx = active.findIndex(t => t.id === tid); if (idx < 0) return p;
      const si = idx + dir; if (si < 0 || si >= active.length) return p;
      const i1 = p.tasks.findIndex(t => t.id === tid); const i2 = p.tasks.findIndex(t => t.id === active[si].id);
      const nt = [...p.tasks]; [nt[i1], nt[i2]] = [nt[i2], nt[i1]]; return { ...p, tasks: nt };
    });
  }, []);

  const removeTask = useCallback(id => {
    if (!window.confirm("Remove this quest?")) return;
    AudioEngine.play("click");
    // Save for undo
    const task = state.tasks.find(t => t.id === id);
    if (task) {
      setUndoTask(task);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setUndoTask(null), 5000);
    }
    setState(p => ({ ...p, tasks: p.tasks.filter(t => t.id !== id) }));
    showToast("✗ QUEST REMOVED — tap UNDO below", "#ff4444", 5000);
  }, [showToast, state.tasks]);

  const addCustomReward = useCallback(reward => { setState(p => ({ ...p, customRewards: [...(p.customRewards || []), reward] })); setShowAddReward(false); }, []);
  const deleteCustomReward = useCallback(id => { setState(p => ({ ...p, customRewards: (p.customRewards || []).filter(r => r.id !== id) })); }, []);

  // ── Investment Actions ──────────────────────────
  const investIn = useCallback((skill, amount) => {
    if (state.credits < amount || amount <= 0) return;
    const price = state.marketPrices?.[skill] || 100;
    const shares = Math.round((amount / price) * 1000) / 1000;
    AudioEngine.play("coin");
    setState(p => {
      const inv = { ...(p.investments || {}) };
      inv[skill] = (inv[skill] || 0) + shares;
      return { ...p, credits: p.credits - amount, investments: inv, investmentHistory: [...(p.investmentHistory || []), { type: "buy", skill, amount, shares, price, date: Date.now() }] };
    });
  }, [state.credits, state.marketPrices]);

  const sellInvestment = useCallback((skill, shares) => {
    const held = state.investments?.[skill] || 0;
    if (shares > held || shares <= 0) return;
    const price = state.marketPrices?.[skill] || 100;
    const payout = Math.floor(shares * price);
    AudioEngine.play("coin");
    setState(p => {
      const inv = { ...(p.investments || {}) };
      inv[skill] = Math.round((inv[skill] - shares) * 1000) / 1000;
      if (inv[skill] <= 0.001) inv[skill] = 0;
      return { ...p, credits: p.credits + payout, investments: inv, investmentHistory: [...(p.investmentHistory || []), { type: "sell", skill, amount: payout, shares, price, date: Date.now() }] };
    });
  }, [state.investments, state.marketPrices]);

  // ── Derived ─────────────────────────────────────
  const totalLevel = Object.values(state.skills).reduce((a, s) => a + s.level, 0);
  const overallLevel = Math.floor(totalLevel / 4);
  const doneTasks = state.tasks.filter(t => state.completedToday.includes(t.id));
  const now = new Date(); const timeStr = now.toLocaleTimeString("en-US", { hour12: false }); const dateStr = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const activeBosses = (state.bosses || []).filter(b => b.hp > 0);
  const defeatedBosses = (state.bosses || []).filter(b => b.hp <= 0);
  const activeBuffsList = (state.activeBuffs || []).filter(b => b.expiresAt > Date.now());
  const quote = getRandomQuote();
  const allTabs = [
    { id: "dashboard", label: "⟐ HQ" }, { id: "quests", label: "⚡ QUESTS" }, { id: "bosses", label: "☠ GOALS" },
    { id: "ai", label: "🤖 AI" }, { id: "market", label: "📈 MARKET" }, { id: "npcs", label: "★ NPCs" },
    { id: "shop", label: "🪙 SHOP" }, { id: "skills", label: "◈ STATS" }, { id: "settings", label: "⚙ SET" },
  ];
  const hiddenTabs = state.settingsConfig?.hiddenTabs || [];
  const mainTabs = allTabs.filter(t => !hiddenTabs.includes(t.id));
  const accentColor = state.settingsConfig?.accentColor || "#00ff41";
  const approvedRewards = onboardingData?.allowedRewards || [];
  const allShopRewards = [
    ...approvedRewards.map((r, i) => ({ id: `ob_${i}`, name: r, desc: "Onboarding approved", category: onboardingData?.classifications?.[r] === "upgrade" ? "UPGRADE" : "ENTERTAINMENT", cost: getOnboardingRewardCost(r, onboardingData?.classifications?.[r] || "entertainment"), icon: onboardingData?.classifications?.[r] === "upgrade" ? "◈" : "▣", isOnboarding: true })),
    ...(state.customRewards || []),
  ];
  const rewardGroups = {};
  allShopRewards.forEach(r => { const cat = r.category || "OTHER"; if (!rewardGroups[cat]) rewardGroups[cat] = []; rewardGroups[cat].push(r); });
  const obFull = { position: "fixed", inset: 0, background: "#000", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflowY: "auto" };
  const obBtn = (active) => ({ background: active ? "#00ff4112" : "#0a0a0a", border: `1px solid ${active ? "#00ff41" : "#222"}`, color: active ? "#00ff41" : "#333", padding: "16px 32px", fontFamily: "monospace", fontSize: 13, fontWeight: 900, cursor: active ? "pointer" : "not-allowed", letterSpacing: 3 });

  // ════════════════════════════════════════════════
  // DEEP ONBOARDING (7 SCREENS)
  // ════════════════════════════════════════════════
  if (!onboardingData) {
    // SCREEN 1 — MANIFESTO
    if (obStep === 0) {
      return (
        <div style={obFull}>
          <style>{globalStyles}</style>
          <div style={{ maxWidth: 500, width: "100%", textAlign: "center" }}>
            <div style={{ color: "#00ff41", fontSize: 18, fontWeight: 900, letterSpacing: 6, marginBottom: 8, fontFamily: "monospace" }}>⟐ SIMULATION OS ⟐</div>
            <div style={{ color: "#00ff4188", fontSize: 12, letterSpacing: 4, marginBottom: 40, fontFamily: "monospace" }}>v5.0</div>
            <div style={{ color: "#fff", fontSize: 22, fontWeight: 900, letterSpacing: 4, marginBottom: 24, fontFamily: "monospace" }}>THIS IS NOT FOR EVERYONE.</div>
            <div style={{ color: "#888", fontSize: 12, lineHeight: 1.9, fontFamily: "monospace", textAlign: "left", padding: "0 12px", marginBottom: 32 }}>
              This app works on one condition only. You never cheat. You never reward yourself without paying credits. You never reduce your tasks to make life easier. If you are the type of person who bends rules when no one is watching, close this app now. It will not work for you.
            </div>
            <div style={{ background: "#00ff4108", border: "1px solid #00ff4122", padding: 24, marginBottom: 40, textAlign: "left" }}>
              <div style={{ color: "#a8ffb8", fontSize: 13, lineHeight: 2, fontFamily: "monospace", fontWeight: 700 }}>ONE RULE ABOVE ALL RULES:</div>
              <div style={{ color: "#7ddf8d", fontSize: 13, lineHeight: 2, fontFamily: "monospace", marginTop: 8 }}>
                You are allowed to change the rules of your game only to make them harder. Never easier. The moment you lower the difficulty, reduce your tasks, or bend the rules for comfort — you have already lost.
              </div>
              <div style={{ color: "#7ddf8d", fontSize: 13, lineHeight: 2, fontFamily: "monospace", marginTop: 12 }}>
                This is not an app. This is a protocol. Follow it completely and it is mathematically impossible for you to not get everything you want. Cheat it and you will stay exactly where you are.
              </div>
            </div>
            <button onClick={() => { AudioEngine.play("click"); setObStep(1); }} style={{ ...obBtn(true), animation: "pulse 1.5s infinite" }}>I UNDERSTAND. LET ME IN.</button>
          </div>
        </div>
      );
    }

    // SCREEN 2 — USERNAME
    if (obStep === 1) {
      return (
        <div style={obFull}>
          <style>{globalStyles}</style>
          <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
            <div style={{ color: "#00ff41", fontSize: 14, fontWeight: 900, letterSpacing: 4, marginBottom: 32, fontFamily: "monospace" }}>⟐ IDENTITY ⟐</div>
            <div style={{ color: "#888", fontSize: 13, marginBottom: 16, fontFamily: "monospace" }}>What should the system call you?</div>
            <input placeholder="Username..." value={obUsername} onChange={e => setObUsername(e.target.value)} style={{ width: "100%", background: "#0a0a0a", border: "1px solid #00ff4133", color: "#00ff41", padding: 14, fontFamily: "monospace", fontSize: 16, textAlign: "center", letterSpacing: 2, marginBottom: 32 }} />
            <button onClick={() => { if (obUsername.trim()) { AudioEngine.play("click"); setObStep(2); } }} style={obBtn(!!obUsername.trim())}>CONTINUE</button>
          </div>
        </div>
      );
    }

    // SCREEN 3 — LIFE MISSION
    if (obStep === 2) {
      return (
        <div style={obFull}>
          <style>{globalStyles}</style>
          <div style={{ maxWidth: 500, width: "100%", textAlign: "center" }}>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 900, letterSpacing: 2, marginBottom: 16, fontFamily: "monospace", lineHeight: 1.8 }}>What do you want out of your life. What is your life's mission.</div>
            <div style={{ color: "#ff0040", fontSize: 13, lineHeight: 1.8, fontFamily: "monospace", marginBottom: 20, padding: "0 8px" }}>
              WARNING: Once you submit this answer you are locked in forever. You cannot change it. This is your mission. You either want it or you do not. Think right now. The time is now. There is no later.
            </div>
            <textarea placeholder="My life's mission is..." value={obMission} onChange={e => setObMission(e.target.value)} rows={5} style={{ width: "100%", background: "#0a0a0a", border: "1px solid #00ff4133", color: "#eee", padding: 14, fontFamily: "monospace", fontSize: 12, resize: "vertical", lineHeight: 1.8 }} />
            <button onClick={() => { if (obMission.trim()) { AudioEngine.play("click"); setObStep(3); } }} style={{ ...obBtn(!!obMission.trim()), marginTop: 24 }}>THIS IS MY MISSION. LOCK IT IN.</button>
          </div>
        </div>
      );
    }

    // SCREEN 4 — ENTERTAINMENT INTAKE
    if (obStep === 3) {
      return (
        <div style={obFull}>
          <style>{globalStyles}</style>
          <div style={{ maxWidth: 500, width: "100%", textAlign: "center" }}>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 900, letterSpacing: 2, marginBottom: 8, fontFamily: "monospace" }}>ENTERTAINMENT INTAKE</div>
            <div style={{ color: "#888", fontSize: 13, lineHeight: 1.8, fontFamily: "monospace", marginBottom: 24 }}>
              List every single thing you do for fun or entertainment on a normal day. Be honest. No one is watching.
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input placeholder="Activity..." value={obCurrentItem} onChange={e => setObCurrentItem(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && obCurrentItem.trim()) { setObItems(p => [...p, obCurrentItem.trim()]); setObCurrentItem(""); } }} style={{ flex: 1, background: "#0a0a0a", border: "1px solid #00ff4133", color: "#eee", padding: 10, fontFamily: "monospace", fontSize: 12 }} />
              <button onClick={() => { if (obCurrentItem.trim()) { setObItems(p => [...p, obCurrentItem.trim()]); setObCurrentItem(""); } }} style={{ background: "#00ff4112", border: "1px solid #00ff41", color: "#00ff41", fontFamily: "monospace", fontSize: 13, padding: "8px 16px", cursor: "pointer" }}>+ ADD</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24, justifyContent: "center" }}>
              {obItems.map((item, i) => (
                <div key={i} style={{ background: "#111", border: "1px solid #333", padding: "6px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#ccc", fontFamily: "monospace", fontSize: 13}}>{item}</span>
                  <button onClick={() => setObItems(p => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#ff4466", cursor: "pointer", fontSize: 12 }}>×</button>
                </div>
              ))}
            </div>
            {obItems.length < 3 && <div style={{ color: "#ff004088", fontSize: 12, fontFamily: "monospace", marginBottom: 16 }}>Add at least {3 - obItems.length} more item{3 - obItems.length !== 1 ? "s" : ""}</div>}
            <button onClick={() => { if (obItems.length >= 3) { AudioEngine.play("click"); setObStep(4); } }} style={obBtn(obItems.length >= 3)}>THIS IS MY HONEST LIST. CONTINUE.</button>
          </div>
        </div>
      );
    }

    // SCREEN 5 — CLASSIFICATION (Sort into UPGRADES vs ENTERTAINMENT)
    if (obStep === 4) {
      const unclassified = obItems.filter(item => !obClassifications[item]);
      const upgrades = obItems.filter(item => obClassifications[item] === "upgrade");
      const entertainment = obItems.filter(item => obClassifications[item] === "entertainment");
      const allDone = unclassified.length === 0;
      return (
        <div style={{ ...obFull, alignItems: "flex-start", paddingTop: 40 }}>
          <style>{globalStyles}</style>
          <div style={{ maxWidth: 600, width: "100%", textAlign: "center" }}>
            <div style={{ color: "#fff", fontSize: 16, fontWeight: 900, letterSpacing: 2, marginBottom: 8, fontFamily: "monospace" }}>SORT YOUR ACTIVITIES</div>
            <div style={{ color: "#999", fontSize: 13, lineHeight: 1.8, fontFamily: "monospace", marginBottom: 12 }}>Tap a button on each item to place it into the right column. Be honest.</div>
            <div style={{ background: "#ffaa0008", border: "1px solid #ffaa0033", padding: 12, marginBottom: 20, color: "#ffaa00", fontSize: 13, fontFamily: "monospace", lineHeight: 1.7 }}>⚠ Your allowed list is permanent. To add new entertainment in the future, you must go through this classification process again — so choose carefully.</div>
            {/* Unclassified items */}
            {unclassified.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ color: "#999", fontSize: 12, letterSpacing: 2, marginBottom: 12 }}>TAP TO SORT ({unclassified.length} remaining)</div>
                {unclassified.map(item => (
                  <div key={item} style={{ background: "#0a0a0a", border: "1px solid #333", padding: "12px", marginBottom: 8, animation: "fadeIn 0.3s ease" }}>
                    <div style={{ color: "#ccc", fontFamily: "monospace", fontSize: 14, marginBottom: 10, textAlign: "left" }}>{item}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setObClassifications(p => ({ ...p, [item]: "upgrade" }))} style={{ flex: 1, background: "#00ff4110", border: "2px solid #00ff4166", color: "#00ff41", fontFamily: "monospace", fontSize: 13, padding: "12px 8px", cursor: "pointer", letterSpacing: 1, fontWeight: 700 }}>↑ UPGRADE</button>
                      <button onClick={() => setObClassifications(p => ({ ...p, [item]: "entertainment" }))} style={{ flex: 1, background: "#ff004010", border: "2px solid #ff004066", color: "#ff0040", fontFamily: "monospace", fontSize: 13, padding: "12px 8px", cursor: "pointer", letterSpacing: 1, fontWeight: 700 }}>▶ ENTERTAINMENT</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Two columns */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
              <div>
                <div style={{ color: "#00ff41", fontSize: 13, letterSpacing: 3, marginBottom: 4, fontFamily: "monospace" }}>UPGRADES</div>
                <div style={{ color: "#00ff4199", fontSize: 12, marginBottom: 8, fontFamily: "monospace" }}>Makes you better at your goals.</div>
                {upgrades.map(item => (
                  <div key={item} style={{ background: "#00ff4108", border: "1px solid #00ff4122", padding: "8px 10px", marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#7ddf8d", fontFamily: "monospace", fontSize: 13, flex: 1, textAlign: "left" }}>{item}</span>
                    <button onClick={() => setObClassifications(p => { const n = { ...p }; delete n[item]; return n; })} style={{ background: "none", border: "none", color: "#00ff4188", cursor: "pointer", fontSize: 13}}>↩</button>
                  </div>
                ))}
                {upgrades.length === 0 && <div style={{ color: "#111", fontSize: 12, padding: 10, fontFamily: "monospace" }}>—</div>}
              </div>
              <div>
                <div style={{ color: "#ff0040", fontSize: 13, letterSpacing: 3, marginBottom: 4, fontFamily: "monospace" }}>ENTERTAINMENT</div>
                <div style={{ color: "#ff4466", fontSize: 12, marginBottom: 8, fontFamily: "monospace" }}>Does this serve your mission — or distract from it?</div>
                {entertainment.map(item => (
                  <div key={item} style={{ background: "#ff004008", border: "1px solid #ff004022", padding: "8px 10px", marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#ff6666", fontFamily: "monospace", fontSize: 13, flex: 1, textAlign: "left" }}>{item}</span>
                    <button onClick={() => setObClassifications(p => { const n = { ...p }; delete n[item]; return n; })} style={{ background: "none", border: "none", color: "#ff004088", cursor: "pointer", fontSize: 13}}>↩</button>
                  </div>
                ))}
                {entertainment.length === 0 && <div style={{ color: "#111", fontSize: 12, padding: 10, fontFamily: "monospace" }}>—</div>}
              </div>
            </div>
            <button onClick={() => { if (allDone) { AudioEngine.play("click"); setObStep(5); setObJustifyIdx(0); setObCurrentJustify(""); } }} style={obBtn(allDone)}>CLASSIFIED. CONTINUE.</button>
          </div>
        </div>
      );
    }

    // SCREEN 6 — JUSTIFICATION (one at a time)
    if (obStep === 5) {
      const currentItem = obItems[obJustifyIdx];
      const classification = obClassifications[currentItem];
      const isLast = obJustifyIdx >= obItems.length - 1;
      const hasText = obCurrentJustify.trim().length > 10;
      return (
        <div style={obFull}>
          <style>{globalStyles}</style>
          <div style={{ maxWidth: 500, width: "100%", textAlign: "center" }}>
            <div style={{ color: "#999", fontSize: 12, letterSpacing: 3, marginBottom: 16, fontFamily: "monospace" }}>{obJustifyIdx + 1} / {obItems.length}</div>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 900, letterSpacing: 2, marginBottom: 8, fontFamily: "monospace" }}>{currentItem}</div>
            <div style={{ color: classification === "upgrade" ? "#00ff41" : "#ff0040", fontSize: 13, letterSpacing: 3, marginBottom: 24, fontFamily: "monospace" }}>CLASSIFIED AS: {classification === "upgrade" ? "UPGRADE" : "ENTERTAINMENT"}</div>
            <div style={{ color: "#888", fontSize: 13, marginBottom: 16, fontFamily: "monospace" }}>Why did you classify this as {classification === "upgrade" ? "an upgrade" : "entertainment"}? Be specific.</div>
            <textarea placeholder="My reason..." value={obCurrentJustify} onChange={e => setObCurrentJustify(e.target.value)} rows={3} style={{ width: "100%", background: "#0a0a0a", border: "1px solid #333", color: "#eee", padding: 12, fontFamily: "monospace", fontSize: 12, resize: "vertical", lineHeight: 1.8 }} />
            <button onClick={() => {
              if (!hasText) return;
              const newJ = { ...obJustifications, [currentItem]: obCurrentJustify.trim() };
              setObJustifications(newJ);
              setObCurrentJustify("");
              if (isLast) { AudioEngine.play("click"); setObStep(6); }
              else { setObJustifyIdx(p => p + 1); }
            }} style={{ ...obBtn(hasText), marginTop: 20 }}>{isLast ? "DONE. CONTINUE." : "NEXT →"}</button>
          </div>
        </div>
      );
    }

    // SCREEN 7 — FINAL ALLOWED LIST
    if (obStep === 6) {
      return (
        <div style={{ ...obFull, alignItems: "flex-start", paddingTop: 40 }}>
          <style>{globalStyles}</style>
          <div style={{ maxWidth: 500, width: "100%", textAlign: "center" }}>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 900, letterSpacing: 2, marginBottom: 8, fontFamily: "monospace" }}>FINAL ALLOWED LIST</div>
            <div style={{ color: "#888", fontSize: 13, lineHeight: 1.8, fontFamily: "monospace", marginBottom: 24 }}>
              From everything you listed, select only the rewards you are allowing yourself from now until you reach your goal. These are the only things you are permitted to spend credits on. Choose carefully.
            </div>
            {obItems.map(item => {
              const selected = obAllowed.has(item);
              const cls = obClassifications[item];
              return (
                <button key={item} onClick={() => { setObAllowed(p => { const n = new Set(p); if (n.has(item)) n.delete(item); else n.add(item); return n; }); }} style={{ display: "block", width: "100%", background: selected ? (cls === "upgrade" ? "#00ff4112" : "#ff004012") : "#0a0a0a", border: `1px solid ${selected ? (cls === "upgrade" ? "#00ff41" : "#ff0040") : "#222"}`, padding: "12px 16px", marginBottom: 6, cursor: "pointer", textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 18, height: 18, border: `2px solid ${selected ? "#00ff41" : "#333"}`, background: selected ? "#00ff4122" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#00ff41", flexShrink: 0 }}>{selected ? "✓" : ""}</span>
                    <div>
                      <div style={{ color: selected ? "#fff" : "#666", fontFamily: "monospace", fontSize: 12 }}>{item}</div>
                      <div style={{ color: cls === "upgrade" ? "#00ff4166" : "#ff004066", fontFamily: "monospace", fontSize: 12, letterSpacing: 2 }}>{cls === "upgrade" ? "UPGRADE" : "ENTERTAINMENT"}</div>
                    </div>
                  </div>
                </button>
              );
            })}
            {obAllowed.size === 0 && <div style={{ color: "#ff004088", fontSize: 12, fontFamily: "monospace", marginTop: 8 }}>Select at least one reward</div>}
            <button onClick={() => {
              if (obAllowed.size === 0) return;
              const data = {
                username: obUsername.trim(),
                mission: obMission.trim(),
                items: obItems,
                classifications: obClassifications,
                justifications: obJustifications,
                allowedRewards: [...obAllowed],
                createdAt: Date.now(),
              };
              saveOnboardingData(data);
              setOnboardingData(data);
              AudioEngine.play("levelup");
            }} style={{ ...obBtn(obAllowed.size > 0), marginTop: 24 }}>THIS IS MY LIST. THE GAME BEGINS.</button>
          </div>
        </div>
      );
    }
  }

  // ════ RATING MODAL ════
  if (ratingTask) {
    return (<><style>{globalStyles}</style><RatingModal task={ratingTask} onRate={rateAndAward} /></>);
  }

  // ════ BOOT: INIT ════
  if (bootSequence && !systemReady) {
    return (
      <div style={{ background: "#000", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{globalStyles}</style>
        <button onClick={() => { AudioEngine.getCtx().resume(); AudioEngine.play("click"); setSystemReady(true); }} style={{ background: "transparent", border: "1px solid #00ff41", color: "#00ff41", padding: "20px 40px", fontFamily: "monospace", fontSize: 16, cursor: "pointer", letterSpacing: 4, boxShadow: "0 0 20px #00ff4133", animation: "pulse 1.5s infinite" }}>▶ BEGIN TRAINING</button>
      </div>
    );
  }

  // ════ BOOT: TERMINAL ════
  if (bootSequence) {
    return (
      <div style={{ background: "#000", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{globalStyles}</style>
        <div style={{ maxWidth: 500, width: "100%" }}>
          {bootLines.slice(0, bootLine + 1).map((line, i) => (
            <div key={i} style={{ color: i === bootLines.length - 1 ? "#00ff41" : i === 0 ? "#fff" : "#00ff4188", fontFamily: "'Courier New', monospace", fontSize: i === 0 ? 16 : i === bootLines.length - 1 ? 14 : 13, fontWeight: i === 0 || i === bootLines.length - 1 ? 700 : 400, letterSpacing: i === bootLines.length - 1 ? 3 : 1, marginBottom: 5 }}>{i < bootLines.length - 1 && i > 0 && line ? "► " : ""}{line}</div>
          ))}
          <div style={{ width: 8, height: 14, background: "#00ff41", marginTop: 8, animation: "blink 0.7s step-end infinite" }} />
        </div>
      </div>
    );
  }

  // ════ MAIN RENDER ════
  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#eee", fontFamily: "'Courier New', monospace", maxWidth: "100vw", overflowX: "hidden" }}>
      <style>{globalStyles}</style>
      <Particles active={showParticles} color={particleColor} />
      <ComboBanner data={comboBannerData} onDone={() => setComboBannerData(null)} />
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#0a0a0a", border: `1px solid ${toast.color}`, color: toast.color, fontFamily: "monospace", fontSize: 13, padding: "10px 20px", zIndex: 99999, letterSpacing: 2, animation: "fadeIn 0.2s ease", whiteSpace: "nowrap", pointerEvents: "none" }}>{toast.msg}</div>
      )}
      {showAddTask && <AddTaskModal onAdd={addTask} onClose={() => setShowAddTask(false)} />}
      {showAddBoss && <AddBossModal onAdd={addBoss} onClose={() => setShowAddBoss(false)} />}
      {showAddNPC && <AddNPCModal onAdd={addNPC} onClose={() => setShowAddNPC(false)} />}
      {showAddReward && <AddRewardModal onAdd={addCustomReward} onClose={() => setShowAddReward(false)} lifeMission={onboardingData?.mission || ""} avgDailyCredits={state.totalCreditsEarned > 0 && state.totalTasksCompleted > 0 ? Math.round(state.totalCreditsEarned / Math.max(1, (state.weeklyLog || []).length || 7)) : 50} anthropicKey={settings.anthropicKey} />}
      {showQuickLog && <QuickLogModal onLog={quickLog} onClose={() => setShowQuickLog(false)} />}
      {levelUpInfo && <LevelUpOverlay skill={levelUpInfo.skill} newLevel={levelUpInfo.newLevel} onClose={() => setLevelUpInfo(null)} />}
      {showEndOfDay && <EndOfDayModal onSubmit={submitEndOfDay} />}
      {/* SettingsModal removed — settings are now a full tab */}
      {showRewardReflection && state.pendingRewardReflection && <RewardReflectionModal reward={state.pendingRewardReflection} onSubmit={submitRewardReflection} />}
      {showDailyLogin && !state.dailyLoginClaimed && <DailyLoginModal loginStreak={state.loginStreak || 0} onClaim={claimDailyLogin} />}
      {showMorningPlan && !state.morningPlanDone && <MorningPlanModal onSubmit={submitMorningPlan} onSkip={() => { setShowMorningPlan(false); setState(p => ({ ...p, morningPlanDone: true })); }} />}
      {showAbsenceReport && absenceData && <AbsenceReportModal daysGone={absenceData.daysGone} xpLost={absenceData.xpLost} streakLost={absenceData.streakLost} potentialXpMissed={absenceData.potentialXpMissed} onDismiss={() => setShowAbsenceReport(false)} />}
      {showYesterdayReminder && state.yesterdayReflection && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", zIndex: 9500 }}>
          <div style={{ color: "#ffaa00bb", fontSize: 12, letterSpacing: 3, marginBottom: 8, fontFamily: "monospace" }}>YESTERDAY'S COMMITMENT</div>
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "monospace", marginBottom: 8 }}>You said you would improve by:</div>
          <div style={{ background: "#ffaa0008", border: "1px solid #ffaa0022", padding: 20, maxWidth: 420, marginBottom: 8 }}>
            <div style={{ color: "#ffaa00", fontSize: 13, fontFamily: "monospace", lineHeight: 1.8 }}>"{state.yesterdayReflection.improvement}"</div>
          </div>
          <div style={{ color: "#999", fontSize: 12, fontFamily: "monospace", marginBottom: 24 }}>Productive: {state.yesterdayReflection.productive?.toUpperCase()}</div>
          <button onClick={() => { setShowYesterdayReminder(false); setState(p => ({ ...p, yesterdayReflection: null })); }} style={{ background: "#ffaa0012", border: "1px solid #ffaa00", color: "#ffaa00", padding: "14px 32px", fontFamily: "monospace", fontSize: 13, fontWeight: 900, cursor: "pointer", letterSpacing: 3 }}>I REMEMBER. LET'S GO.</button>
        </div>
      )}

      {/* ── Reflection Banner (non-blocking) ── */}
      {reflectionBannerVisible && !showEndOfDay && (
        <div onClick={() => { setReflectionBannerVisible(false); setShowEndOfDay(true); }} style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: "#00ff4120", border: "1px solid #00ff41", padding: "12px 24px", zIndex: 7000, cursor: "pointer", whiteSpace: "nowrap", animation: "fadeSlide 0.4s ease" }}>
          <span style={{ color: "#00ff41", fontFamily: "monospace", fontSize: 13, letterSpacing: 2 }}>✓ All tasks complete — tap to reflect</span>
        </div>
      )}

      {/* ── HUD ── */}
      <div style={{ background: "#050505", borderBottom: "1px solid #111", padding: "12px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ color: accentColor, fontSize: 14, fontWeight: 900, letterSpacing: 3 }}>SIMULATION OS</span>
            <span style={{ color: "#555", fontSize: 12, marginLeft: 8 }}>v5.1</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* API status dot */}
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: (ANTHROPIC_API_KEY || settings.anthropicKey) ? "#00ff41" : "#333", boxShadow: (ANTHROPIC_API_KEY || settings.anthropicKey) ? "0 0 6px #00ff41" : "none" }} title={ANTHROPIC_API_KEY || settings.anthropicKey ? "AI Connected" : "No API Key"} />
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#666", fontSize: 11 }}>{dateStr}</div>
              <div style={{ color: accentColor, fontSize: 11, fontWeight: 700 }}>{timeStr}</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ color: "#fff", fontSize: 13}}>LV.{overallLevel}</span>
          <span style={{ color: playerClass.color, fontSize: 13}}>{playerClass.icon} {playerClass.name}</span>
          <span style={{ color: "#ffaa00", fontSize: 13}}>🪙 {state.credits}¢</span>
          {xpMult !== 1 && <span style={{ color: xpMult > 1 ? "#00ff41" : "#ff0040", fontSize: 12}}>XP ×{xpMult.toFixed(2)}</span>}
          {state.prestigeLevel > 0 && <span style={{ color: "#ff00ff", fontSize: 12}}>P{state.prestigeLevel}</span>}
          {(() => { const ct = getComboThreshold(state.consecutiveCompletions); return ct ? <span style={{ color: ct.color, fontSize: 12, border: `1px solid ${ct.color}44`, padding: "1px 6px", animation: "pulse 1.5s infinite" }}>🔥 {ct.label}</span> : null; })()}
          <span style={{ color: "#999", fontSize: 12}}>☠{activeBosses.length}</span>
          {(state.loginStreak || 0) > 0 && <span style={{ color: "#ffaa00", fontSize: 12 }}>📅{state.loginStreak}d</span>}
        </div>
        {((state.activeDebuffs||[]).length > 0 || activeBuffsList.length > 0) && (
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {(state.activeDebuffs||[]).map(d => DEBUFF_DEFS[d.id] && <span key={d.id} style={{ background: `${DEBUFF_DEFS[d.id].color}15`, border: `1px solid ${DEBUFF_DEFS[d.id].color}44`, color: DEBUFF_DEFS[d.id].color, fontSize: 12, padding: "2px 6px", letterSpacing: 1 }}>{DEBUFF_DEFS[d.id].icon} {DEBUFF_DEFS[d.id].name}</span>)}
            {activeBuffsList.map(b => BUFF_DEFS[b.id] && <span key={b.id+b.appliedAt} style={{ background: `${BUFF_DEFS[b.id].color}15`, border: `1px solid ${BUFF_DEFS[b.id].color}44`, color: BUFF_DEFS[b.id].color, fontSize: 12, padding: "2px 6px", letterSpacing: 1 }}>{BUFF_DEFS[b.id].icon} {BUFF_DEFS[b.id].name}</span>)}
          </div>
        )}
      </div>

      <div style={{ padding: "6px 16px", borderBottom: "1px solid #0a0a0a" }}>
        <div style={{ color: quote.color, fontSize: 12, opacity: 0.6, fontStyle: "italic", letterSpacing: 1 }}>"{quote.text}"</div>
      </div>

      <div style={{ display: "flex", overflowX: "auto", borderBottom: "1px solid #111", background: "#050505" }}>
        {mainTabs.map(t => (
          <button key={t.id} onClick={() => { setView(t.id); AudioEngine.play("click"); }} style={{ flex: "0 0 auto", padding: "10px 14px", background: view === t.id ? "#0a0a0a" : "transparent", border: "none", borderBottom: view === t.id ? `2px solid ${accentColor}` : "2px solid transparent", color: view === t.id ? accentColor : "#444", fontFamily: "monospace", fontSize: 13, cursor: "pointer", letterSpacing: 1, whiteSpace: "nowrap" }}>{t.label}</button>
        ))}
      </div>

      {tPopup && <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: "#00ff4115", border: "1px solid #00ff41", padding: "8px 20px", zIndex: 8000, animation: "fadeSlide 1.5s forwards" }}><span style={{ color: "#00ff41", fontFamily: "monospace", fontSize: 13, letterSpacing: 2 }}>⚡ QUEST COMPLETE</span></div>}

      <div style={{ padding: "16px", minHeight: "60vh" }}>

        {/* ══ HQ DASHBOARD ══ */}
        {view === "dashboard" && (
          <div>
            <div style={{ color: accentColor, fontSize: 14, letterSpacing: 4, marginBottom: 8, fontWeight: 900 }}>⟐ HEADQUARTERS</div>
            {/* XP Decay Warning */}
            {(() => {
              const lastTask = (state.completedHistory || []).slice(-1)[0];
              const hoursSinceTask = lastTask ? Math.floor((Date.now() - lastTask.timestamp) / 3600000) : 999;
              if (hoursSinceTask >= 20 && hoursSinceTask < 48) {
                return <div style={{ background: "#ff004010", border: "1px solid #ff004033", padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><div style={{ color: "#ff0040", fontSize: 12, fontFamily: "monospace", fontWeight: 700 }}>⚠ XP DECAY WARNING</div><div style={{ color: "#ff004088", fontSize: 11, fontFamily: "monospace" }}>No task logged in {hoursSinceTask}h — skills decay at 48h</div></div>
                  <div style={{ color: "#ff0040", fontSize: 16, fontWeight: 900, fontFamily: "monospace" }}>{Math.max(0, 48 - hoursSinceTask)}h</div>
                </div>;
              }
              if (hoursSinceTask >= 48) {
                return <div style={{ background: "#ff004015", border: "1px solid #ff0040", padding: "10px 14px", marginBottom: 12, animation: "pulse 2s infinite" }}>
                  <div style={{ color: "#ff0040", fontSize: 13, fontFamily: "monospace", fontWeight: 900 }}>💀 DECAY ACTIVE — Log a task NOW</div>
                </div>;
              }
              return null;
            })()}
            {onboardingData?.mission && (
              <div style={{ background: "#00ff4108", border: "1px solid #00ff4118", padding: 14, marginBottom: 12 }}>
                <div style={{ color: "#00ff4199", fontSize: 12, letterSpacing: 3, marginBottom: 4 }}>LIFE MISSION — {onboardingData.username}</div>
                <div style={{ color: "#7ddf8d", fontSize: 13, lineHeight: 1.8, fontFamily: "monospace" }}>{onboardingData.mission}</div>
              </div>
            )}
            {/* Yesterday's improvement reminder on HQ */}
            {(state.endOfDayReflections || []).length > 0 && (() => {
              const last = (state.endOfDayReflections || []).slice(-1)[0];
              return (
                <div style={{ background: "#ffaa0008", border: "1px solid #ffaa0018", padding: 12, marginBottom: 12 }}>
                  <div style={{ color: "#ffaa00bb", fontSize: 12, letterSpacing: 3, marginBottom: 4 }}>LAST REFLECTION — {last.date}</div>
                  <div style={{ color: "#aa8800", fontSize: 13, lineHeight: 1.8, fontFamily: "monospace" }}>Improve: {last.improvement}</div>
                  <div style={{ color: "#999", fontSize: 12, marginTop: 4 }}>Productive: {last.productive}</div>
                </div>
              );
            })()}
            {Object.entries(state.skills).map(([k, v]) => <XPBar key={k} xp={v.xp} level={v.level} def={SKILL_DEFS[k]} />)}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
              <div style={{ background: "#0a0a0a", border: "1px solid #111", padding: 12, textAlign: "center" }}>
                <div style={{ color: "#666", fontSize: 10, letterSpacing: 2 }}>TODAY</div>
                <div style={{ color: accentColor, fontSize: 22, fontWeight: 900 }}>{state.completedToday.length}</div>
              </div>
              <div style={{ background: "#0a0a0a", border: "1px solid #111", padding: 12, textAlign: "center" }}>
                <div style={{ color: "#666", fontSize: 10, letterSpacing: 2 }}>STREAK</div>
                <div style={{ color: state.streakDays > 0 ? "#ffaa00" : "#333", fontSize: 22, fontWeight: 900 }}>{state.streakDays}d</div>
              </div>
              <div style={{ background: "#0a0a0a", border: "1px solid #111", padding: 12, textAlign: "center" }}>
                <div style={{ color: "#666", fontSize: 10, letterSpacing: 2 }}>LOGINS</div>
                <div style={{ color: "#ff00ff", fontSize: 22, fontWeight: 900 }}>{state.loginStreak || 0}d</div>
              </div>
            </div>
            {/* Quick action row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <button onClick={() => setShowAddTask(true)} style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}33`, color: accentColor, fontFamily: "monospace", fontSize: 12, padding: "12px", cursor: "pointer", letterSpacing: 2, fontWeight: 700 }}>+ NEW QUEST</button>
              <button onClick={() => setShowQuickLog(true)} style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}33`, color: accentColor, fontFamily: "monospace", fontSize: 12, padding: "12px", cursor: "pointer", letterSpacing: 2, fontWeight: 700 }}>⚡ QUICK LOG</button>
            </div>
          </div>
        )}

        {/* ══ QUESTS (touch-friendly reorder) ══ */}
        {view === "quests" && (
          <div>
            <BackButton onClick={() => setView("dashboard")} color={accentColor} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ color: accentColor, fontSize: 14, letterSpacing: 4, fontWeight: 900 }}>⚡ ACTIVE QUESTS</div>
              <button onClick={() => setShowAddTask(true)} style={{ background: "#00ff4112", border: "1px solid #00ff41", color: "#00ff41", fontFamily: "monospace", fontSize: 13, padding: "8px 16px", cursor: "pointer", letterSpacing: 2 }}>+ NEW</button>
            </div>
            {activeTasks.length === 0 && state.completedToday.length > 0 && <div style={{ color: accentColor, fontSize: 13, textAlign: "center", padding: 40, fontFamily: "monospace" }}>🎯 ALL TASKS COMPLETE</div>}
            {activeTasks.length === 0 && state.completedToday.length === 0 && (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ color: "#555", fontSize: 36, marginBottom: 12 }}>⚡</div>
                <div style={{ color: "#888", fontSize: 13, fontFamily: "monospace", marginBottom: 8 }}>No active quests yet.</div>
                <div style={{ color: "#555", fontSize: 12, fontFamily: "monospace", marginBottom: 16 }}>Quests are daily tasks that earn XP and credits. Add your first one to start leveling up.</div>
                <button onClick={() => setShowAddTask(true)} style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}`, color: accentColor, fontFamily: "monospace", fontSize: 13, padding: "10px 24px", cursor: "pointer", letterSpacing: 2 }}>+ ADD FIRST QUEST</button>
              </div>
            )}
            {activeTasks.map((task, idx) => {
              const isBossTask = !!task.bossId;
              return (
              <div key={task.id} style={{ background: isBossTask ? "#ff004006" : "#0a0a0a", border: `2px solid ${isBossTask ? "#ff004033" : SKILL_DEFS[task.skill]?.color + "22" || "#22222222"}`, padding: "14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                {/* Large touch-friendly arrows */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button onClick={() => moveTask(task.id, -1)} style={{ background: "#111", border: "1px solid #222", color: "#999", cursor: "pointer", fontSize: 16, padding: "8px 10px", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>▲</button>
                  <button onClick={() => moveTask(task.id, 1)} style={{ background: "#111", border: "1px solid #222", color: "#999", cursor: "pointer", fontSize: 16, padding: "8px 10px", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>▼</button>
                </div>
                <button onClick={() => initiateComplete(task)} style={{ width: 36, height: 36, background: "transparent", border: `2px solid ${SKILL_DEFS[task.skill]?.color || "#00ff41"}44`, color: SKILL_DEFS[task.skill]?.color || "#00ff41", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: 4 }}>○</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#ccc", fontSize: 12, marginBottom: 3 }}>
                    {isBossTask && <span style={{ color: "#ff0040", fontSize: 12, marginRight: 6, border: "1px solid #ff004044", padding: "1px 4px", letterSpacing: 1 }}>GOAL</span>}
                    {task.text}
                  </div>
                  <div style={{ color: "#888", fontSize: 12}}>{SKILL_DEFS[task.skill]?.icon || "◈"} {SKILL_DEFS[task.skill]?.name || task.skill}{isBossTask ? ` · ${task.bossName}` : ""}</div>
                </div>
                {!isBossTask && <button onClick={() => removeTask(task.id)} style={{ minWidth: 44, minHeight: 44, background: "#ff000015", border: "1px solid #ff000044", color: "#ff4444", cursor: "pointer", fontSize: 18, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>}
              </div>
            );})}
            {doneTasks.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ color: "#999", fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>COMPLETED TODAY ({doneTasks.length})</div>
                {doneTasks.map(t => (
                  <div key={t.id} style={{ padding: "6px 14px", marginBottom: 3, color: "#1a1a1a", fontSize: 13, textDecoration: "line-through" }}>{t.text}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ GOALS (Boss Fights) ══ */}
        {view === "bosses" && (
          <div>
            <BackButton onClick={() => setView("dashboard")} color="#ff0040" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ color: "#ff0040", fontSize: 14, letterSpacing: 4, fontWeight: 900 }}>☠ LONG-TERM GOALS</div>
              <button onClick={() => setShowAddBoss(true)} style={{ background: "#ff004012", border: "1px solid #ff0040", color: "#ff0040", fontFamily: "monospace", fontSize: 13, padding: "8px 16px", cursor: "pointer", letterSpacing: 2 }}>+ NEW GOAL</button>
            </div>
            {activeBosses.length === 0 && (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ color: "#555", fontSize: 36, marginBottom: 12 }}>☠</div>
                <div style={{ color: "#888", fontSize: 13, fontFamily: "monospace", marginBottom: 8 }}>No active goals.</div>
                <div style={{ color: "#555", fontSize: 12, fontFamily: "monospace", marginBottom: 16 }}>Goals are long-term objectives with milestones. Set one to give your daily tasks a bigger purpose.</div>
                <button onClick={() => setShowAddBoss(true)} style={{ background: "#ff004012", border: "1px solid #ff0040", color: "#ff0040", fontFamily: "monospace", fontSize: 13, padding: "10px 24px", cursor: "pointer", letterSpacing: 2 }}>+ SET FIRST GOAL</button>
              </div>
            )}
            {activeBosses.map(boss => {
              const hpPct = (boss.hp / boss.maxHp) * 100;
              const daysLeft = Math.max(0, Math.ceil((boss.deadline - Date.now()) / 86400000));
              const dlDate = new Date(boss.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" });
              return (
                <div key={boss.id} style={{ background: "#0a0000", border: "1px solid #ff004022", padding: 16, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ color: "#ff0040", fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>{boss.name}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ color: daysLeft < 3 ? "#ff0040" : "#555", fontSize: 12}}>{dlDate} · {daysLeft}d</span>
                      <button onClick={() => removeBoss(boss.id)} style={{ background: "none", border: "none", color: "#331111", cursor: "pointer", fontSize: 12 }}>×</button>
                    </div>
                  </div>
                  <MatrixAgent boss={boss} isHit={bossHitId === boss.id} isDead={bossDeadId === boss.id} />
                  <div style={{ margin: "12px 0 8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ color: "#ff0040", fontSize: 12, letterSpacing: 2 }}>PROGRESS</span>
                      <span style={{ color: "#ff0040", fontSize: 13, fontWeight: 700 }}>{Math.round(100 - hpPct)}%</span>
                    </div>
                    <div style={{ height: 8, background: "#1a0000", border: "1px solid #ff004033", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${100 - hpPct}%`, background: "#00ff41", transition: "width 0.5s ease" }} />
                    </div>
                    <div style={{ color: "#999", fontSize: 12, marginTop: 3 }}>REWARD: {boss.reward}¢ · {daysLeft}d left</div>
                  </div>
                  {boss.subtasks.map(s => {
                    const today = new Date().toISOString().split("T")[0];
                    const isScheduled = s.scheduledDate && s.scheduledDate > today;
                    const dateLabel = s.scheduledDate ? new Date(s.scheduledDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "now";
                    return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid #110000" }}>
                      <span style={{ width: 20, height: 20, background: s.done ? "#00ff4115" : "transparent", border: `1px solid ${s.done ? "#00ff4144" : isScheduled ? "#555" : "#ff004066"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: s.done ? "#00ff41" : "#ff004044", flexShrink: 0 }}>{s.done ? "✓" : "○"}</span>
                      <span style={{ color: s.done ? "#333" : isScheduled ? "#555" : "#aa6666", fontSize: 13, textDecoration: s.done ? "line-through" : "none", flex: 1 }}>{s.text}</span>
                      <span style={{ color: isScheduled ? "#ffaa0066" : s.done ? "#333" : "#555", fontSize: 12, flexShrink: 0 }}>{s.done ? "done" : isScheduled ? `📅 ${dateLabel}` : "in quests"}</span>
                    </div>
                    );
                  })}
                </div>
              );
            })}
            {defeatedBosses.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ color: "#999", fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>ACHIEVED ({defeatedBosses.length})</div>
                {defeatedBosses.map(b => (
                  <div key={b.id} style={{ padding: "6px 10px", color: "#1a1a1a", fontSize: 13, marginBottom: 3, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ textDecoration: "line-through" }}>{b.name}</span>
                    <button onClick={() => removeBoss(b.id)} style={{ background: "none", border: "none", color: "#1a1a1a", cursor: "pointer", fontSize: 13}}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ NPCs ══ */}
        {view === "npcs" && (
          <div>
            <BackButton onClick={() => setView("dashboard")} color="#00d4ff" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ color: "#00d4ff", fontSize: 14, letterSpacing: 4, fontWeight: 900 }}>★ <Tip term="NPC">NPC</Tip> NETWORK</div>
              <button onClick={() => setShowAddNPC(true)} style={{ background: "#00d4ff12", border: "1px solid #00d4ff", color: "#00d4ff", fontFamily: "monospace", fontSize: 13, padding: "8px 16px", cursor: "pointer", letterSpacing: 2 }}>+ ADD</button>
            </div>
            {(state.npcs||[]).length === 0 && (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ color: "#555", fontSize: 36, marginBottom: 12 }}>★</div>
                <div style={{ color: "#888", fontSize: 13, fontFamily: "monospace", marginBottom: 8 }}>No NPCs in your network.</div>
                <div style={{ color: "#555", fontSize: 12, fontFamily: "monospace", marginBottom: 16 }}>NPCs are real people in your life — friends, mentors, rivals. Track interactions to level up your Social skill.</div>
                <button onClick={() => setShowAddNPC(true)} style={{ background: "#00d4ff12", border: "1px solid #00d4ff", color: "#00d4ff", fontFamily: "monospace", fontSize: 13, padding: "10px 24px", cursor: "pointer", letterSpacing: 2 }}>+ ADD FIRST NPC</button>
              </div>
            )}
            {(state.npcs||[]).map(npc => {
              const pct = (npc.relationshipXp / npc.maxXp) * 100;
              return (
                <div key={npc.id} style={{ background: "#0a0a0a", border: `1px solid ${npc.decayWarning ? "#ff004044" : "#00d4ff22"}`, padding: 14, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ color: "#00d4ff", fontSize: 12, fontWeight: 700 }}>{npc.name} <span style={{ color: "#888", fontSize: 12}}>({npc.category})</span></div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => interactNPC(npc.id)} style={{ background: "#00d4ff12", border: "1px solid #00d4ff44", color: "#00d4ff", fontFamily: "monospace", fontSize: 12, padding: "4px 10px", cursor: "pointer" }}>INTERACT</button>
                      <button onClick={() => removeNPC(npc.id)} style={{ background: "none", border: "none", color: "#331111", cursor: "pointer", fontSize: 12 }}>×</button>
                    </div>
                  </div>
                  <div style={{ height: 4, background: "#111", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: npc.decayWarning ? "#ff0040" : "#00d4ff", transition: "width 0.3s" }} />
                  </div>
                  {npc.decayWarning && <div style={{ color: "#ff004088", fontSize: 12, marginTop: 4 }}>⚠ RELATIONSHIP DECAYING</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ MARKET (Investment System) ══ */}
        {view === "market" && (() => {
          // Back button rendered inside the IIFE return
          const prices = state.marketPrices || { intelligence: 100, strength: 100, vitality: 100, social: 100 };
          const inv = state.investments || {};
          const totalValue = Object.keys(prices).reduce((sum, sk) => sum + (inv[sk] || 0) * prices[sk], 0);
          const totalInvested = (state.investmentHistory || []).filter(h => h.type === "buy").reduce((s, h) => s + h.amount, 0);
          const totalSold = (state.investmentHistory || []).filter(h => h.type === "sell").reduce((s, h) => s + h.amount, 0);
          const netPL = Math.round(totalValue + totalSold - totalInvested);
          return (
          <div>
            <BackButton onClick={() => setView("dashboard")} color="#00d4ff" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ color: "#00d4ff", fontSize: 14, letterSpacing: 4, fontWeight: 900 }}>📈 STAT MARKET</div>
              <span style={{ color: "#ffaa00", fontSize: 14, fontWeight: 900 }}>{state.credits}¢</span>
            </div>
            <div style={{ color: "#999", fontSize: 12, fontFamily: "monospace", marginBottom: 16, lineHeight: 1.8 }}>
              Invest credits in your stats. Prices rise when you level up, complete tasks, and maintain streaks. They crash when you're inactive.
            </div>
            {/* Portfolio Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
              <div style={{ background: "#0a0a0a", border: "1px solid #111", padding: 10, textAlign: "center" }}>
                <div style={{ color: "#999", fontSize: 7, letterSpacing: 1 }}>PORTFOLIO</div>
                <div style={{ color: "#00d4ff", fontSize: 16, fontWeight: 900 }}>{Math.round(totalValue)}¢</div>
              </div>
              <div style={{ background: "#0a0a0a", border: "1px solid #111", padding: 10, textAlign: "center" }}>
                <div style={{ color: "#999", fontSize: 7, letterSpacing: 1 }}>NET P/L</div>
                <div style={{ color: netPL >= 0 ? "#00ff41" : "#ff0040", fontSize: 16, fontWeight: 900 }}>{netPL >= 0 ? "+" : ""}{netPL}¢</div>
              </div>
              <div style={{ background: "#0a0a0a", border: "1px solid #111", padding: 10, textAlign: "center" }}>
                <div style={{ color: "#999", fontSize: 7, letterSpacing: 1 }}>CASH</div>
                <div style={{ color: "#ffaa00", fontSize: 16, fontWeight: 900 }}>{state.credits}¢</div>
              </div>
            </div>
            {/* Stat Stocks */}
            {Object.entries(SKILL_DEFS).map(([sk, def]) => {
              const price = prices[sk] || 100;
              const held = inv[sk] || 0;
              const value = Math.round(held * price);
              const prevPrice = 100; // baseline
              const change = ((price - prevPrice) / prevPrice * 100).toFixed(1);
              const isUp = price >= prevPrice;
              return (
                <div key={sk} style={{ background: "#0a0a0a", border: `1px solid ${def.color}22`, padding: 16, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <span style={{ color: def.color, fontSize: 16, marginRight: 8 }}>{def.icon}</span>
                      <span style={{ color: def.color, fontSize: 13, fontWeight: 900, fontFamily: "monospace", letterSpacing: 2 }}>${sk.toUpperCase().slice(0,3)}</span>
                      <span style={{ color: "#999", fontSize: 12, marginLeft: 8 }}>LV.{state.skills[sk]?.level || 1}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#fff", fontSize: 16, fontWeight: 900, fontFamily: "monospace" }}>{price.toFixed(1)}¢</div>
                      <div style={{ color: isUp ? "#00ff41" : "#ff0040", fontSize: 12, fontFamily: "monospace" }}>{isUp ? "▲" : "▼"} {change}% from base</div>
                    </div>
                  </div>
                  {held > 0 && (
                    <div style={{ background: "#111", padding: "6px 10px", marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#888", fontSize: 12, fontFamily: "monospace" }}>HOLDING: {held.toFixed(2)} shares</span>
                      <span style={{ color: "#00d4ff", fontSize: 12, fontFamily: "monospace" }}>VALUE: {value}¢</span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    {[25, 50, 100].map(amt => (
                      <button key={amt} onClick={() => investIn(sk, amt)} disabled={state.credits < amt} style={{ flex: 1, background: state.credits >= amt ? `${def.color}08` : "#0a0a0a", border: `1px solid ${state.credits >= amt ? def.color + "44" : "#222"}`, color: state.credits >= amt ? def.color : "#333", fontFamily: "monospace", fontSize: 12, padding: "8px 4px", cursor: state.credits >= amt ? "pointer" : "not-allowed", fontWeight: 700 }}>BUY {amt}¢</button>
                    ))}
                    {held > 0 && (
                      <button onClick={() => sellInvestment(sk, held)} style={{ flex: 1, background: "#ff004008", border: "1px solid #ff004044", color: "#ff0040", fontFamily: "monospace", fontSize: 12, padding: "8px 4px", cursor: "pointer", fontWeight: 700 }}>SELL ALL</button>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Recent Transactions */}
            {(state.investmentHistory || []).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ color: "#999", fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>RECENT TRANSACTIONS</div>
                {(state.investmentHistory || []).slice(-8).reverse().map((h, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #0a0a0a" }}>
                    <span style={{ color: h.type === "buy" ? "#00ff41" : "#ff0040", fontSize: 12, fontFamily: "monospace" }}>{h.type === "buy" ? "BUY" : "SELL"} ${h.skill.toUpperCase().slice(0,3)}</span>
                    <span style={{ color: "#999", fontSize: 12, fontFamily: "monospace" }}>{h.shares.toFixed(2)} @ {h.price.toFixed(1)}¢ = {h.amount}¢</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          );
        })()}

        {/* ══ SHOP ══ */}
        {view === "shop" && (
          <div>
            <BackButton onClick={() => setView("dashboard")} color="#ffaa00" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ color: "#ffaa00", fontSize: 14, letterSpacing: 4, fontWeight: 900 }}>🪙 REWARD SHOP</div>
              <span style={{ color: "#ffaa00", fontSize: 14, fontWeight: 900 }}>{state.credits}¢</span>
            </div>
            <div style={{ background: "#00ff4108", border: "1px solid #00ff4118", padding: 12, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ color: "#00ff4199", fontSize: 12, letterSpacing: 3 }}>CREDITS REFUSED</div><div style={{ color: "#999", fontSize: 12}}>Badge of discipline</div></div>
              <div style={{ color: "#00ff41", fontSize: 24, fontWeight: 900, fontFamily: "monospace" }}>{state.creditsRefused || 0}¢</div>
            </div>
            <>
              <button onClick={() => setShowAddReward(true)} style={{ width: "100%", background: "#ffaa0008", border: "1px dashed #ffaa0044", color: "#ffaa00", fontFamily: "monospace", fontSize: 13, padding: "12px", cursor: "pointer", letterSpacing: 3, marginBottom: 16 }}>+ ADD REWARD</button>
              {Object.entries(rewardGroups).map(([catName, rewards]) => (
                <div key={catName} style={{ marginBottom: 20 }}>
                  <div style={{ color: catName === "UPGRADE" ? "#00ff41" : catName === "ENTERTAINMENT" ? "#ff0040" : "#ff00ff", fontSize: 13, letterSpacing: 3, marginBottom: catName === "ENTERTAINMENT" ? 4 : 12, fontFamily: "monospace", borderBottom: catName !== "ENTERTAINMENT" ? `1px solid ${catName === "UPGRADE" ? "#00ff4122" : "#ff004022"}` : "none", paddingBottom: catName === "ENTERTAINMENT" ? 0 : 6 }}>{catName}</div>
                  {catName === "ENTERTAINMENT" && onboardingData?.mission && (
                    <div style={{ color: "#ff4466", fontSize: 12, fontFamily: "monospace", marginBottom: 12, borderBottom: "1px solid #ff004022", paddingBottom: 6, lineHeight: 1.6 }}>Earned through discipline · Mission: "{(onboardingData.mission || "").slice(0, 50)}{(onboardingData.mission || "").length > 50 ? '...' : ''}"</div>
                  )}
                  {rewards.map(item => {
                    const canBuy = state.credits >= item.cost;
                    return (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 4, background: "#0a0a0a", border: "1px solid #111" }}>
                        <span style={{ fontSize: 16 }}>{item.icon}</span>
                        <div style={{ flex: 1 }}><div style={{ color: "#ccc", fontSize: 13}}>{item.name}</div>{item.desc && <div style={{ color: "#888", fontSize: 12}}>{item.desc}</div>}</div>
                        <button onClick={() => purchaseReward(item)} disabled={!canBuy} style={{ background: canBuy ? "#ffaa0012" : "#0a0a0a", border: `1px solid ${canBuy ? "#ffaa00" : "#222"}`, color: canBuy ? "#ffaa00" : "#333", fontFamily: "monospace", fontSize: 13, padding: "8px 14px", cursor: canBuy ? "pointer" : "not-allowed", fontWeight: 700 }}>{item.cost}¢</button>
                        {item.isCustom && <button onClick={() => deleteCustomReward(item.id)} style={{ background: "none", border: "none", color: "#331111", cursor: "pointer", fontSize: 12 }}>×</button>}
                      </div>
                    );
                  })}
                </div>
              ))}
              {allShopRewards.length === 0 && <div style={{ color: "#999", fontSize: 13, textAlign: "center", padding: 40 }}>No rewards. Add one above.</div>}
            </>
            {/* Reflection Log */}
            {(state.rewardReflections||[]).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ color: "#999", fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>REWARD REFLECTIONS</div>
                {(state.rewardReflections||[]).slice(-5).reverse().map((r,i) => (
                  <div key={i} style={{ background: "#0a0a0a", border: "1px solid #111", padding: 10, marginBottom: 4 }}>
                    <div style={{ color: "#ffaa0088", fontSize: 12}}>{r.name}</div>
                    <div style={{ color: "#999", fontSize: 12, marginTop: 2 }}>{r.reflection}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ STATS ══ */}
        {view === "skills" && (
          <div>
            <BackButton onClick={() => setView("dashboard")} color={accentColor} />
            <div style={{ color: accentColor, fontSize: 14, letterSpacing: 4, marginBottom: 16, fontWeight: 900 }}>◈ OPERATOR STATS</div>
            <div style={{ background: "#0a0a0a", border: `1px solid ${playerClass.color}33`, padding: 16, marginBottom: 16, textAlign: "center" }}>
              <div style={{ color: playerClass.color, fontSize: 28 }}>{playerClass.icon}</div>
              <div style={{ color: playerClass.color, fontSize: 14, fontWeight: 900, letterSpacing: 3, marginTop: 4 }}>{playerClass.name}</div>
              <div style={{ color: "#999", fontSize: 12, marginTop: 4 }}>{playerClass.desc}</div>
              {onboardingData?.username && <div style={{ color: "#00ff4188", fontSize: 13, marginTop: 8, letterSpacing: 2 }}>OPERATOR: {onboardingData.username}</div>}
              {overallLevel >= 5 && <button onClick={prestige} style={{ marginTop: 12, background: "#ff00ff12", border: "1px solid #ff00ff", color: "#ff00ff", fontFamily: "monospace", fontSize: 13, padding: "8px 20px", cursor: "pointer", letterSpacing: 2 }}>⟐ PRESTIGE ⟐</button>}
            </div>
            {onboardingData?.mission && (
              <div style={{ background: "#00ff4108", border: "1px solid #00ff4118", padding: 14, marginBottom: 16 }}>
                <div style={{ color: "#00ff4199", fontSize: 12, letterSpacing: 3, marginBottom: 4 }}>LIFE MISSION (LOCKED)</div>
                <div style={{ color: "#7ddf8d", fontSize: 13, lineHeight: 1.8 }}>{onboardingData.mission}</div>
              </div>
            )}
            {(state.protocolViolations || []).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: "#ff0040", fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>⚠ PROTOCOL VIOLATIONS (PERMANENT)</div>
                {(state.protocolViolations || []).map((v, i) => (
                  <div key={i} style={{ background: "#ff004008", border: "1px solid #ff004033", padding: "10px 12px", marginBottom: 4, animation: "violationPulse 3s infinite" }}>
                    <div style={{ color: "#ff0040", fontSize: 13, fontWeight: 900 }}>VIOLATED — {v.date}</div>
                    <div style={{ color: "#ff004088", fontSize: 12, marginTop: 2 }}>{v.reason}</div>
                  </div>
                ))}
              </div>
            )}
            {/* ── Expandable Skill Tree ── */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: "#00ff4199", fontSize: 11, letterSpacing: 3, marginBottom: 10 }}>SKILL TREE — TAP TO EXPAND</div>
              {Object.entries(SKILL_DEFS).map(([skillKey, skillDef]) => {
                const mainSk = state.skills[skillKey] || { xp: 0, level: 1 };
                const isExpanded = expandedSkill === skillKey;
                const subDefs = SUB_SKILL_DEFS[skillKey] || [];
                return (
                  <div key={skillKey} style={{ marginBottom: 6 }}>
                    {/* Main skill row — clickable header */}
                    <div
                      onClick={() => setExpandedSkill(isExpanded ? null : skillKey)}
                      style={{ background: isExpanded ? `${skillDef.color}12` : "#0a0a0a", border: `1px solid ${isExpanded ? skillDef.color + "55" : "#1a1a1a"}`, padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "all 0.15s" }}
                    >
                      <span style={{ color: skillDef.color, fontSize: 16, minWidth: 20 }}>{skillDef.icon}</span>
                      <span style={{ color: skillDef.color, fontSize: 13, fontWeight: 900, letterSpacing: 2, flex: 1 }}>{skillDef.name}</span>
                      <span style={{ color: skillDef.color, fontSize: 12, letterSpacing: 1, minWidth: 40 }}>LV.{mainSk.level}</span>
                      {/* Mini XP bar */}
                      <div style={{ width: 80, height: 6, background: "#111", border: `1px solid ${skillDef.color}33`, position: "relative" }}>
                        <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${mainSk.xp}%`, background: skillDef.color, boxShadow: `0 0 4px ${skillDef.color}` }} />
                      </div>
                      <span style={{ color: isExpanded ? skillDef.color : "#555", fontSize: 11, minWidth: 12 }}>{isExpanded ? "▾" : "▸"}</span>
                    </div>
                    {/* Sub-skill rows — shown when expanded */}
                    {isExpanded && (
                      <div style={{ background: "#050505", border: `1px solid ${skillDef.color}22`, borderTop: "none", paddingTop: 4, paddingBottom: 4 }}>
                        {subDefs.map(sub => {
                          const ss = state.subSkills?.[skillKey]?.[sub.id] || { xp: 0, level: 1 };
                          return (
                            <div key={sub.id} style={{ padding: "7px 12px 7px 32px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${sub.color}11` }}>
                              <span style={{ color: sub.color, fontSize: 13, minWidth: 18 }}>{sub.icon}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                  <span style={{ color: sub.color, fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>{sub.name}</span>
                                  <span style={{ color: sub.color + "99", fontSize: 10 }}>LV.{ss.level}</span>
                                  <span style={{ color: "#555", fontSize: 10, marginLeft: "auto" }}>{ss.xp}/100 XP</span>
                                </div>
                                <div style={{ width: "100%", height: 4, background: "#111", border: `1px solid ${sub.color}22` }}>
                                  <div style={{ height: "100%", width: `${ss.xp}%`, background: sub.color, opacity: 0.85 }} />
                                </div>
                                <div style={{ color: "#444", fontSize: 10, marginTop: 2 }}>{sub.desc}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 20 }}>
              <div style={{ color: "#ff0040", fontSize: 12, letterSpacing: 2, marginBottom: 4 }}>ACTIVE DEBUFFS</div>
              <div style={{ color: "#555", fontSize: 11, fontFamily: "monospace", marginBottom: 8 }}>Auto-detected from coach chat · tap × to remove</div>
              {(state.activeDebuffs||[]).length === 0 && <div style={{ color: "#222", fontSize: 12, fontFamily: "monospace", padding: 8 }}>No active debuffs — clean status</div>}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(state.activeDebuffs||[]).map(d => {
                  const def = DEBUFF_DEFS[d.id];
                  if (!def) return null;
                  return (
                    <div key={d.id} style={{ background: `${def.color}15`, border: `1px solid ${def.color}44`, color: def.color, fontFamily: "monospace", fontSize: 12, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{def.icon} {def.name}</span>
                      <span style={{ color: `${def.color}88`, fontSize: 10 }}>{def.effect}</span>
                      <button onClick={() => toggleDebuff(d.id)} style={{ background: "none", border: "none", color: def.color, cursor: "pointer", fontSize: 14, padding: "0 2px", opacity: 0.6 }}>×</button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[{l:"TOTAL TASKS",v:state.totalTasksCompleted,c:"#00ff41"},{l:"TOTAL CREDITS",v:state.totalCreditsEarned+"¢",c:"#ffaa00"},{l:"PRESTIGE",v:state.prestigeLevel,c:"#ff00ff"},{l:"XP MULT",v:"×"+xpMult.toFixed(2),c:"#00d4ff"}].map(s => (
                <div key={s.l} style={{ background: "#0a0a0a", border: "1px solid #111", padding: 10, textAlign: "center" }}>
                  <div style={{ color: "#999", fontSize: 12, letterSpacing: 1 }}>{s.l}</div>
                  <div style={{ color: s.c, fontSize: 18, fontWeight: 900 }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ SETTINGS ══ */}
        {view === "settings" && (() => {
          const sc = state.settingsConfig || {};
          const settingSections = [
            { id: "account", label: "ACCOUNT", icon: "👤", color: "#00d4ff" },
            { id: "appearance", label: "APPEARANCE", icon: "🎨", color: "#ff00ff" },
            { id: "notifications", label: "NOTIFICATIONS", icon: "🔔", color: "#ffaa00" },
            { id: "sound", label: "SOUND", icon: "🔊", color: "#00ff41" },
            { id: "coach", label: "AI COACH", icon: "🤖", color: "#ff0040" },
            { id: "tabs", label: "TAB CUSTOMIZATION", icon: "📱", color: "#8844ff" },
            { id: "data", label: "DATA & DISCIPLINE", icon: "💾", color: "#ff0040" },
            { id: "help", label: "HOW TO PLAY", icon: "❓", color: "#888" },
          ];
          return (
          <div>
            <BackButton onClick={() => setView("dashboard")} color={accentColor} />
            <div style={{ color: accentColor, fontSize: 14, letterSpacing: 4, marginBottom: 4, fontWeight: 900 }}>⚙ SETTINGS</div>
            <div style={{ color: "#555", fontSize: 12, fontFamily: "monospace", marginBottom: 20 }}>Your data lives on this device only. Configure your experience.</div>

            {settingSections.map(sec => (
              <div key={sec.id} style={{ marginBottom: 6 }}>
                <div onClick={() => setExpandedSetting(expandedSetting === sec.id ? null : sec.id)} style={{ background: expandedSetting === sec.id ? `${sec.color}12` : "#0a0a0a", border: `1px solid ${expandedSetting === sec.id ? sec.color + "44" : "#1a1a1a"}`, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{sec.icon}</span>
                  <span style={{ color: expandedSetting === sec.id ? sec.color : "#888", fontSize: 13, fontWeight: 700, letterSpacing: 2, fontFamily: "monospace", flex: 1 }}>{sec.label}</span>
                  <span style={{ color: expandedSetting === sec.id ? sec.color : "#333", fontSize: 12 }}>{expandedSetting === sec.id ? "▾" : "▸"}</span>
                </div>

                {expandedSetting === sec.id && (
                  <div style={{ background: "#050505", border: `1px solid ${sec.color}22`, borderTop: "none", padding: 16 }}>

                    {/* ACCOUNT */}
                    {sec.id === "account" && (
                      <div>
                        <div style={{ color: "#fff", fontSize: 13, fontFamily: "monospace", marginBottom: 4 }}>OPERATOR: {onboardingData?.username || "Unknown"}</div>
                        <div style={{ color: "#555", fontSize: 12, fontFamily: "monospace", marginBottom: 16 }}>Life mission: {onboardingData?.mission?.slice(0, 60) || "Not set"}{(onboardingData?.mission?.length || 0) > 60 ? "..." : ""}</div>
                        <div style={{ color: "#00d4ff", fontSize: 12, letterSpacing: 2, marginBottom: 8, fontFamily: "monospace" }}>EMAIL (for future sync)</div>
                        <input value={sc.accountEmail || ""} onChange={e => setState(p => ({ ...p, settingsConfig: { ...p.settingsConfig, accountEmail: e.target.value } }))} placeholder="your@email.com" style={{ width: "100%", background: "#111", border: "1px solid #222", color: "#eee", padding: 12, fontFamily: "monospace", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }} />
                        <div style={{ color: "#00d4ff", fontSize: 12, letterSpacing: 2, marginBottom: 8, fontFamily: "monospace" }}>PASSWORD</div>
                        <input type="password" value={sc.accountPassword || ""} onChange={e => setState(p => ({ ...p, settingsConfig: { ...p.settingsConfig, accountPassword: e.target.value } }))} placeholder="Set password..." style={{ width: "100%", background: "#111", border: "1px solid #222", color: "#eee", padding: 12, fontFamily: "monospace", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
                        <div style={{ color: "#444", fontSize: 11, fontFamily: "monospace", lineHeight: 1.7 }}>⚠ Stored locally only. Cloud sync coming soon.</div>
                      </div>
                    )}

                    {/* APPEARANCE */}
                    {sec.id === "appearance" && (
                      <div>
                        <div style={{ color: "#ff00ff", fontSize: 12, letterSpacing: 2, marginBottom: 12, fontFamily: "monospace" }}>ACCENT COLOR</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
                          {ACCENT_COLORS.map(ac => (
                            <button key={ac.id} onClick={() => setState(p => ({ ...p, settingsConfig: { ...p.settingsConfig, accentColor: ac.color } }))} style={{ padding: "12px 8px", background: accentColor === ac.color ? `${ac.color}20` : "#0a0a0a", border: `2px solid ${accentColor === ac.color ? ac.color : "#222"}`, cursor: "pointer", textAlign: "center" }}>
                              <div style={{ width: 24, height: 24, background: ac.color, borderRadius: "50%", margin: "0 auto 6px", boxShadow: `0 0 12px ${ac.color}44` }} />
                              <div style={{ color: accentColor === ac.color ? ac.color : "#666", fontFamily: "monospace", fontSize: 11, letterSpacing: 2 }}>{ac.name}</div>
                            </button>
                          ))}
                        </div>
                        <div style={{ color: "#444", fontSize: 11, fontFamily: "monospace" }}>Accent color changes header and primary UI elements.</div>
                      </div>
                    )}

                    {/* NOTIFICATIONS */}
                    {sec.id === "notifications" && (
                      <div>
                        <div style={{ color: "#ffaa00", fontSize: 12, letterSpacing: 2, marginBottom: 8, fontFamily: "monospace" }}>DAILY REFLECTION REMINDER</div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
                          <span style={{ color: "#888", fontSize: 13, fontFamily: "monospace" }}>Remind at:</span>
                          <input type="time" value={settings.notificationTime || "21:00"} onChange={e => { const ns = { ...settings, notificationTime: e.target.value }; saveSettingsAndSchedule(ns); }} style={{ background: "#111", border: "1px solid #ffaa0033", color: "#ffaa00", padding: 10, fontFamily: "monospace", fontSize: 13, colorScheme: "dark" }} />
                        </div>
                        <div style={{ color: "#ffaa00", fontSize: 12, letterSpacing: 2, marginBottom: 8, fontFamily: "monospace" }}>COACH DISPLAY NAME</div>
                        <input value={settings.notificationName || "Coach"} onChange={e => { const ns = { ...settings, notificationName: e.target.value }; saveSettingsAndSchedule(ns); }} placeholder="Coach" style={{ width: "100%", background: "#111", border: "1px solid #222", color: "#eee", padding: 12, fontFamily: "monospace", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
                        <button onClick={() => { if (Notification.permission !== "granted") Notification.requestPermission(); else showToast("Notifications already enabled", "#00ff41"); }} style={{ width: "100%", background: "#ffaa0008", border: "1px solid #ffaa0033", color: "#ffaa00", fontFamily: "monospace", fontSize: 12, padding: "10px", cursor: "pointer", letterSpacing: 2 }}>ENABLE NOTIFICATIONS</button>
                      </div>
                    )}

                    {/* SOUND */}
                    {sec.id === "sound" && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                          <span style={{ color: "#00ff41", fontSize: 13, fontFamily: "monospace" }}>SOUND EFFECTS</span>
                          <button onClick={() => setState(p => ({ ...p, settingsConfig: { ...p.settingsConfig, soundEnabled: !(p.settingsConfig?.soundEnabled !== false) } }))} style={{ padding: "8px 20px", background: (sc.soundEnabled !== false) ? "#00ff4115" : "#ff004015", border: `1px solid ${(sc.soundEnabled !== false) ? "#00ff41" : "#ff0040"}`, color: (sc.soundEnabled !== false) ? "#00ff41" : "#ff0040", fontFamily: "monospace", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>{(sc.soundEnabled !== false) ? "ON" : "OFF"}</button>
                        </div>
                        <div style={{ color: "#00ff41", fontSize: 12, letterSpacing: 2, marginBottom: 8, fontFamily: "monospace" }}>SOUND TYPE</div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {["retro", "minimal", "heavy"].map(st => (
                            <button key={st} onClick={() => { setState(p => ({ ...p, settingsConfig: { ...p.settingsConfig, soundType: st } })); AudioEngine.play("click"); }} style={{ flex: 1, padding: "10px 4px", background: (sc.soundType || "retro") === st ? "#00ff4115" : "transparent", border: `1px solid ${(sc.soundType || "retro") === st ? "#00ff41" : "#222"}`, color: (sc.soundType || "retro") === st ? "#00ff41" : "#555", fontFamily: "monospace", fontSize: 12, cursor: "pointer", textTransform: "uppercase" }}>{st}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* COACH */}
                    {sec.id === "coach" && (
                      <div>
                        <div style={{ color: "#ff0040", fontSize: 12, letterSpacing: 2, marginBottom: 8, fontFamily: "monospace" }}>ANTHROPIC API KEY</div>
                        <div style={{ color: "#888", fontSize: 11, fontFamily: "monospace", marginBottom: 8, lineHeight: 1.7 }}>Get a key at console.anthropic.com. Stored only on this device.</div>
                        <input type="password" value={settings.anthropicKey || ""} onChange={e => { const ns = { ...settings, anthropicKey: e.target.value }; saveSettingsAndSchedule(ns); }} placeholder="sk-ant-..." style={{ width: "100%", background: "#111", border: `1px solid ${settings.anthropicKey ? "#00ff4133" : "#222"}`, color: "#00ff41", padding: 12, fontFamily: "monospace", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }} />
                        <div style={{ color: "#ff0040", fontSize: 12, letterSpacing: 2, marginBottom: 8, fontFamily: "monospace" }}>COACH PERSONALITY</div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {[["direct", "DIRECT"], ["gentle", "GENTLE"], ["drill", "DRILL SGT"]].map(([v, l]) => (
                            <button key={v} onClick={() => { const ns = { ...settings, coachPersonality: v }; saveSettingsAndSchedule(ns); }} style={{ flex: 1, padding: "10px 4px", background: (settings.coachPersonality || "direct") === v ? "#ff004012" : "transparent", border: `1px solid ${(settings.coachPersonality || "direct") === v ? "#ff0040" : "#222"}`, color: (settings.coachPersonality || "direct") === v ? "#ff0040" : "#555", fontFamily: "monospace", fontSize: 12, cursor: "pointer" }}>{l}</button>
                          ))}
                        </div>
                        {!ANTHROPIC_API_KEY && !settings.anthropicKey && (
                          <div style={{ marginTop: 12, background: "#ffaa0008", border: "1px solid #ffaa0033", padding: 12 }}>
                            <div style={{ color: "#ffaa00", fontSize: 12, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>⚠ NO API KEY SET</div>
                            <div style={{ color: "#888", fontSize: 11, fontFamily: "monospace", lineHeight: 1.8 }}>
                              1. Go to console.anthropic.com<br/>
                              2. Create an account (free tier available)<br/>
                              3. Generate an API key<br/>
                              4. Paste it above
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB CUSTOMIZATION */}
                    {sec.id === "tabs" && (
                      <div>
                        <div style={{ color: "#555", fontSize: 11, fontFamily: "monospace", marginBottom: 12 }}>Show or hide tabs. HQ and Settings cannot be hidden.</div>
                        {allTabs.map(tab => {
                          const locked = tab.id === "dashboard" || tab.id === "settings";
                          const hidden = hiddenTabs.includes(tab.id);
                          return (
                            <div key={tab.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #111" }}>
                              <button onClick={() => { if (locked) return; setState(p => { const ht = [...(p.settingsConfig?.hiddenTabs || [])]; const idx = ht.indexOf(tab.id); if (idx >= 0) ht.splice(idx, 1); else ht.push(tab.id); return { ...p, settingsConfig: { ...p.settingsConfig, hiddenTabs: ht } }; }); }} disabled={locked} style={{ width: 24, height: 24, background: hidden ? "transparent" : `${accentColor}22`, border: `2px solid ${locked ? "#333" : hidden ? "#444" : accentColor}`, color: hidden ? "transparent" : accentColor, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", cursor: locked ? "not-allowed" : "pointer" }}>{hidden ? "" : "✓"}</button>
                              <span style={{ color: hidden ? "#333" : "#ccc", fontFamily: "monospace", fontSize: 13 }}>{tab.label}</span>
                              {locked && <span style={{ color: "#333", fontSize: 10, fontFamily: "monospace" }}>LOCKED</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* DATA & DISCIPLINE */}
                    {sec.id === "data" && (
                      <div>
                        <div style={{ background: "#0a0a0a", border: "1px solid #111", padding: 14, marginBottom: 12 }}>
                          <div style={{ color: "#999", fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>SYSTEM REPORT</div>
                          <div style={{ color: "#aaa", fontSize: 12, lineHeight: 2, fontFamily: "monospace" }}>
                            Tasks: {state.totalTasksCompleted} · XP: {state.totalXpEarned} · Credits: {state.totalCreditsEarned}¢<br/>
                            Refused: {state.creditsRefused || 0}¢ · Streak: {state.streakDays}d · Class: {playerClass.name}<br/>
                            Prestige: {state.prestigeLevel} · Login streak: {state.loginStreak || 0}d<br/>
                            Goals: {activeBosses.length} active, {defeatedBosses.length} achieved<br/>
                            Violations: {(state.protocolViolations || []).length} · Reflections: {(state.endOfDayReflections || []).length}
                          </div>
                        </div>
                        <button onClick={() => { if (state.credits > 0 && window.confirm(`Refuse all ${state.credits}¢?`)) { AudioEngine.play("fear"); setState(p => ({ ...p, creditsRefused: (p.creditsRefused || 0) + p.credits, credits: 0 })); } }} disabled={state.credits <= 0} style={{ width: "100%", background: state.credits > 0 ? "#00ff4108" : "#0a0a0a", border: `1px solid ${state.credits > 0 ? "#00ff4133" : "#111"}`, color: state.credits > 0 ? "#00ff41" : "#333", fontFamily: "monospace", fontSize: 12, padding: "12px", cursor: state.credits > 0 ? "pointer" : "not-allowed", letterSpacing: 2, marginBottom: 8 }}>REFUSE ALL {state.credits}¢ — PROVE DISCIPLINE</button>
                        <button onClick={() => { const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `simulation-os-backup-${new Date().toISOString().split("T")[0]}.json`; a.click(); URL.revokeObjectURL(url); showToast("✓ DATA EXPORTED", "#00ff41"); }} style={{ width: "100%", background: "#00d4ff08", border: "1px solid #00d4ff33", color: "#00d4ff", fontFamily: "monospace", fontSize: 12, padding: "12px", cursor: "pointer", letterSpacing: 2, marginBottom: 8 }}>💾 EXPORT ALL DATA</button>
                        {/* Reflection Log */}
                        {(state.endOfDayReflections || []).length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ color: "#999", fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>REFLECTION LOG</div>
                            {(state.endOfDayReflections || []).slice(-5).reverse().map((r, i) => (
                              <div key={i} style={{ background: "#0a0a0a", border: "1px solid #111", padding: 10, marginBottom: 4 }}>
                                <div style={{ color: "#999", fontSize: 11 }}>{r.date} · {r.productive}</div>
                                <div style={{ color: "#888", fontSize: 11, marginTop: 2 }}>{r.improvement}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <button onClick={() => { if (window.confirm("⚠ FACTORY RESET: Delete ALL data permanently? This cannot be undone.")) { localStorage.clear(); window.location.reload(); } }} style={{ width: "100%", background: "#ff000008", border: "1px solid #ff000022", color: "#ff000044", fontFamily: "monospace", fontSize: 12, padding: "12px", cursor: "pointer", letterSpacing: 3, marginTop: 16 }}>☠ FACTORY RESET ☠</button>
                      </div>
                    )}

                    {/* HELP — HOW TO PLAY */}
                    {sec.id === "help" && (
                      <div style={{ color: "#888", fontSize: 12, fontFamily: "monospace", lineHeight: 2 }}>
                        <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>SIMULATION OS — HOW IT WORKS</div>
                        <div style={{ marginBottom: 12 }}>
                          <span style={{ color: accentColor }}>⚡ QUESTS</span> — Add daily tasks. Complete them and rate difficulty (1-7). Harder tasks earn more <Tip term="XP">XP</Tip> and <Tip term="Credits">credits</Tip>.<br/><br/>
                          <span style={{ color: "#ff0040" }}>☠ GOALS</span> — Long-term objectives with milestones. Each milestone becomes a quest on its scheduled date.<br/><br/>
                          <span style={{ color: accentColor }}>◈ SKILLS</span> — Four main skills (INT/STR/VIT/SOC) each with 4 sub-skills. Level up by completing related tasks.<br/><br/>
                          <span style={{ color: "#ffaa00" }}>🪙 SHOP</span> — Spend earned credits on approved rewards. Entertainment requires justification.<br/><br/>
                          <span style={{ color: "#00d4ff" }}>📈 MARKET</span> — Invest credits in skill stocks. Prices rise when you're active, crash when you're not.<br/><br/>
                          <span style={{ color: "#ff00ff" }}>🔥 COMBOS</span> — Complete tasks consecutively for escalating <Tip term="XP">XP</Tip> bonuses (10%-100%).<br/><br/>
                          <span style={{ color: accentColor }}>⟐ PRESTIGE</span> — At level 5+, reset for a permanent +10% XP multiplier.<br/><br/>
                          <span style={{ color: "#ff0040" }}>💀 DECAY</span> — If you don't log in, skills decay. The simulation doesn't wait for you.<br/><br/>
                          <span style={{ color: "#ffaa00" }}>☀ MORNING PLAN</span> — Plan your top priorities each morning to start the day with focus.
                        </div>
                        <div style={{ color: "#555", fontSize: 11, marginTop: 8 }}>Simulation OS v5.1 · © 2026 Tejas Ayyagari</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          );
        })()}

        {/* ══ AI ══ */}
        {view === "ai" && (
          <div style={{ padding: "16px 0px 100px" }}>
            <BackButton onClick={() => setView("dashboard")} color={accentColor} />
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ color: accentColor, fontSize: 14, letterSpacing: 4, fontFamily: "monospace", fontWeight: 900 }}>⟁ SIMULATION COACH</div>
              <button onClick={() => { setCoachHistory([]); setCoachStreamText(""); setCoachError(null); }} style={{ background: "transparent", border: "1px solid #ff004033", color: "#ff004088", fontFamily: "monospace", fontSize: 11, padding: "5px 10px", cursor: "pointer", letterSpacing: 2 }}>CLEAR SESSION</button>
            </div>

            {/* Life mission reminder — dim, always visible */}
            {onboardingData?.mission && (
              <div style={{ background: "#00ff4106", border: "1px solid #00ff4115", padding: "8px 12px", marginBottom: 12, fontFamily: "monospace", fontSize: 11, color: "#00ff4155", letterSpacing: 1, lineHeight: 1.6 }}>
                MISSION: {onboardingData.mission}
              </div>
            )}

            {/* No API key guide */}
            {!ANTHROPIC_API_KEY && !settings.anthropicKey && (
              <div style={{ background: "#ffaa0008", border: "1px solid #ffaa0033", padding: 16, marginBottom: 12 }}>
                <div style={{ color: "#ffaa00", fontSize: 13, fontFamily: "monospace", fontWeight: 700, marginBottom: 8 }}>⚠ AI COACH NEEDS SETUP</div>
                <div style={{ color: "#888", fontSize: 12, fontFamily: "monospace", lineHeight: 2 }}>
                  1. Go to <span style={{ color: "#00d4ff" }}>console.anthropic.com</span><br/>
                  2. Create a free account<br/>
                  3. Generate an API key<br/>
                  4. Go to <button onClick={() => { setView("settings"); setExpandedSetting("coach"); }} style={{ background: "none", border: "none", color: "#ffaa00", fontFamily: "monospace", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Settings → AI Coach</button> and paste it
                </div>
              </div>
            )}

            {/* Chat display */}
            <div style={{ background: "#030303", border: "1px solid #0f0f0f", padding: 16, marginBottom: 12, minHeight: 260, maxHeight: 440, overflowY: "auto", fontFamily: "monospace" }}>
              {coachHistory.length === 0 && !coachStreaming && (
                <div style={{ color: "#333", fontSize: 12, paddingTop: 30, textAlign: "center", lineHeight: 1.8 }}>
                  {">"} SESSION STARTED<br />
                  <span style={{ color: "#222" }}>The coach has full access to your data.<br />Speak or be judged by your silence.</span>
                </div>
              )}
              {coachHistory.map((msg, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ color: msg.role === "user" ? "#00ff4188" : "#ff000088", fontSize: 11, letterSpacing: 3, marginBottom: 4 }}>
                    {msg.role === "user" ? "> OPERATOR" : "> SYSTEM"}
                  </div>
                  <div style={{ color: msg.role === "user" ? "#88cc88" : "#cccccc", fontSize: 13, lineHeight: 1.75, paddingLeft: 10, borderLeft: `2px solid ${msg.role === "user" ? "#00ff4122" : "#ff000022"}`, whiteSpace: "pre-wrap" }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {/* Live streaming response */}
              {coachStreaming && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: "#ff000088", fontSize: 11, letterSpacing: 3, marginBottom: 4 }}>{"> SYSTEM"}</div>
                  <div style={{ color: "#cccccc", fontSize: 13, lineHeight: 1.75, paddingLeft: 10, borderLeft: "2px solid #ff000022", whiteSpace: "pre-wrap" }}>
                    {coachStreamText}
                    <span style={{ animation: "blink 0.5s step-end infinite", color: "#00ff41" }}>█</span>
                  </div>
                </div>
              )}
              {coachError && (
                <div style={{ color: "#ff4444", fontSize: 12, padding: "8px 12px", background: "#ff000010", border: "1px solid #ff000033", marginTop: 8 }}>{coachError}</div>
              )}
              <div ref={coachEndRef} />
            </div>

            {/* Quick prompts */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {[
                "Am I on track this week?",
                "Where am I slacking?",
                "What task should I do next?",
                "Assess my reward usage",
              ].map(prompt => (
                <button key={prompt} onClick={() => { if (!coachStreaming) sendToCoach(prompt); }} disabled={coachStreaming} style={{ padding: "7px 11px", background: "#00ff4106", border: "1px solid #00ff4122", color: "#00ff4177", fontFamily: "monospace", fontSize: 11, cursor: coachStreaming ? "not-allowed" : "pointer", letterSpacing: 1 }}>{prompt}</button>
              ))}
            </div>

            {/* Input row */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={coachInput}
                onChange={e => setCoachInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && coachInput.trim() && !coachStreaming) sendToCoach(coachInput.trim()); }}
                placeholder={coachStreaming ? "Coach responding..." : "Report to the system..."}
                disabled={coachStreaming}
                style={{ flex: 1, background: "#080808", border: "1px solid #00ff4122", color: "#ccc", padding: "11px 14px", fontFamily: "monospace", fontSize: 13, outline: "none", opacity: coachStreaming ? 0.5 : 1 }}
              />
              <button
                onClick={() => { if (coachInput.trim() && !coachStreaming) sendToCoach(coachInput.trim()); }}
                disabled={!coachInput.trim() || coachStreaming}
                style={{ padding: "11px 18px", background: coachInput.trim() && !coachStreaming ? "#ff000015" : "#0a0a0a", border: `1px solid ${coachInput.trim() && !coachStreaming ? "#ff0040" : "#1a1a1a"}`, color: coachInput.trim() && !coachStreaming ? "#ff0040" : "#333", fontFamily: "monospace", fontSize: 13, cursor: coachInput.trim() && !coachStreaming ? "pointer" : "not-allowed", fontWeight: 700, letterSpacing: 2 }}>
                SEND
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Undo Toast ── */}
      {undoTask && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: "#0a0a0a", border: "1px solid #ffaa00", padding: "10px 20px", zIndex: 8000, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ color: "#ffaa00", fontFamily: "monospace", fontSize: 12 }}>Removed: {undoTask.text.slice(0, 25)}{undoTask.text.length > 25 ? "..." : ""}</span>
          <button onClick={() => { setState(p => ({ ...p, tasks: [...p.tasks, undoTask] })); setUndoTask(null); showToast("✓ QUEST RESTORED", "#00ff41"); }} style={{ background: "#ffaa0012", border: "1px solid #ffaa00", color: "#ffaa00", fontFamily: "monospace", fontSize: 12, padding: "4px 12px", cursor: "pointer", fontWeight: 700 }}>UNDO</button>
        </div>
      )}

      {/* ── Quick Action FABs ── */}
      <div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 8, zIndex: 5000 }}>
        <button onClick={() => setShowQuickLog(true)} style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}`, color: accentColor, fontFamily: "monospace", fontSize: 12, fontWeight: 900, padding: "12px 18px", cursor: "pointer", letterSpacing: 2, boxShadow: `0 0 20px ${accentColor}22` }}>⚡ LOG</button>
        <button onClick={() => setShowAddTask(true)} style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}`, color: accentColor, fontFamily: "monospace", fontSize: 12, fontWeight: 900, padding: "12px 18px", cursor: "pointer", letterSpacing: 2, boxShadow: `0 0 20px ${accentColor}22` }}>+ TASK</button>
      </div>

    </div>
  );
}
