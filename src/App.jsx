import { useState, useEffect, useCallback, useRef } from "react";

// ── API Key ───────────────────────────────────────────────────
// Key is loaded from .env.local (local) or Netlify environment variables (live).
// Never hardcode a real key here — it will be blocked by GitHub.
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";

/**
 * App main module
 * ----------------
 * This file contains the full UI and game logic for VORAX.
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
// VORAX v5.0 — THE COMPLETE LIFE RPG
// ═══════════════════════════════════════════════════════════════

// ── Sound Packs ──────────────────────────────────────────────
const SOUND_PACKS = {
  FORGE: { id: 'forge', name: 'FORGE', desc: 'Metallic impacts & fire' },
  DIGITAL: { id: 'digital', name: 'DIGITAL', desc: 'Electronic & synthetic' },
  SILENCE: { id: 'silence', name: 'SILENCE', desc: 'No sounds' },
};

// ── Audio Engine ──────────────────────────────────────────────
const AudioEngine = {
  ctx: null,
  getCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this.ctx;
  },
  _getPack() {
    const s = loadSettings();
    const st = (s.soundType || "forge").toLowerCase();
    if (st === "silence") return "silence";
    if (st === "digital") return "digital";
    return "forge";
  },
  play(type) {
    try {
      const s = loadSettings();
      if (s.soundEnabled === false) return;
      const pack = this._getPack();
      if (pack === "silence") return;
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      const isForge = pack === "forge";
      if (type === "hit") {
        osc.type = isForge ? "sawtooth" : "square";
        osc.frequency.setValueAtTime(isForge ? 140 : 200, now);
        osc.frequency.exponentialRampToValueAtTime(isForge ? 50 : 80, now + (isForge ? 0.22 : 0.15));
        gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + (isForge ? 0.22 : 0.15));
        osc.start(now); osc.stop(now + (isForge ? 0.22 : 0.15));
      } else if (type === "xp") {
        osc.type = isForge ? "sawtooth" : "sine";
        osc.frequency.setValueAtTime(isForge ? 330 : 523, now);
        osc.frequency.exponentialRampToValueAtTime(isForge ? 660 : 1047, now + (isForge ? 0.18 : 0.12));
        gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + (isForge ? 0.25 : 0.2));
        osc.start(now); osc.stop(now + (isForge ? 0.25 : 0.2));
      } else if (type === "levelup") {
        const freqs = isForge ? [330, 440, 523, 660] : [523, 659, 784, 1047];
        const wave = isForge ? "square" : "triangle";
        const spacing = isForge ? 0.14 : 0.1;
        const decay = isForge ? 0.28 : 0.2;
        freqs.forEach((f, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = wave;
          o.frequency.setValueAtTime(f, now + i * spacing);
          g.gain.setValueAtTime(0.15, now + i * spacing);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * spacing + decay);
          o.start(now + i * spacing); o.stop(now + i * spacing + decay);
        });
      } else if (type === "loot") {
        const count = isForge ? 8 : 12;
        const wave = isForge ? "square" : "sawtooth";
        for (let i = 0; i < count; i++) {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = wave;
          const f = isForge ? (120 + Math.random() * 400) : (200 + Math.random() * 800);
          const step = isForge ? 0.1 : 0.08;
          const dec = isForge ? 0.09 : 0.07;
          o.frequency.setValueAtTime(f, now + i * step);
          g.gain.setValueAtTime(0.08, now + i * step);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * step + dec);
          o.start(now + i * step); o.stop(now + i * step + dec);
        }
      } else if (type === "critical") {
        osc.type = "sawtooth"; osc.frequency.setValueAtTime(isForge ? 80 : 120, now);
        osc.frequency.exponentialRampToValueAtTime(isForge ? 20 : 30, now + (isForge ? 1.3 : 1));
        gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.01, now + (isForge ? 1.3 : 1));
        osc.start(now); osc.stop(now + (isForge ? 1.3 : 1));
      } else if (type === "click") {
        osc.type = isForge ? "square" : "sine";
        osc.frequency.setValueAtTime(isForge ? 500 : 800, now);
        const dec = isForge ? 0.05 : 0.03;
        gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.01, now + dec);
        osc.start(now); osc.stop(now + dec);
      } else if (type === "boss") {
        const freqs = isForge ? [100, 140, 100, 70] : [150, 200, 150, 100];
        const wave = isForge ? "sawtooth" : "square";
        freqs.forEach((f, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = wave;
          o.frequency.setValueAtTime(f, now + i * 0.2);
          g.gain.setValueAtTime(0.25, now + i * 0.2);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + (isForge ? 0.25 : 0.18));
          o.start(now + i * 0.2); o.stop(now + i * 0.2 + (isForge ? 0.25 : 0.18));
        });
      } else if (type === "coin") {
        osc.type = isForge ? "triangle" : "sine";
        osc.frequency.setValueAtTime(isForge ? 880 : 1318, now);
        osc.frequency.setValueAtTime(isForge ? 1100 : 1568, now + 0.08);
        gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
      } else if (type === "event") {
        const freqs = isForge ? [280, 350, 440, 560] : [440, 554, 659, 880];
        const wave = isForge ? "sawtooth" : "triangle";
        freqs.forEach((f, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = wave;
          o.frequency.setValueAtTime(f, now + i * 0.12);
          g.gain.setValueAtTime(0.12, now + i * 0.12);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.15);
          o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.15);
        });
      } else if (type === "fear") {
        osc.type = isForge ? "sawtooth" : "square";
        osc.frequency.setValueAtTime(isForge ? 50 : 80, now);
        osc.frequency.exponentialRampToValueAtTime(isForge ? 280 : 400, now + (isForge ? 0.45 : 0.3));
        gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + (isForge ? 0.55 : 0.4));
        osc.start(now); osc.stop(now + (isForge ? 0.55 : 0.4));
      } else if (type === "splatter") {
        for (let i = 0; i < 5; i++) {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = isForge ? "square" : "sawtooth";
          o.frequency.setValueAtTime((isForge ? 40 : 60) + Math.random() * 100, now + i * 0.04);
          g.gain.setValueAtTime(0.2, now + i * 0.04);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.04 + 0.06);
          o.start(now + i * 0.04); o.stop(now + i * 0.04 + 0.06);
        }
      } else if (type === "death") {
        for (let i = 0; i < 20; i++) {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = i % 2 === 0 ? "sawtooth" : "square";
          const f = (isForge ? 150 : 200) - i * 8 + Math.random() * 50;
          o.frequency.setValueAtTime(Math.max(20, f), now + i * 0.05);
          g.gain.setValueAtTime(0.2, now + i * 0.05);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.08);
          o.start(now + i * 0.05); o.stop(now + i * 0.05 + 0.08);
        }
      } else if (type === "gamble") {
        const freqs = isForge ? [140, 280, 420, 560, 700] : [200, 400, 600, 800, 1000];
        freqs.forEach((f, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = isForge ? "sawtooth" : "square";
          o.frequency.setValueAtTime(f, now + i * 0.06);
          g.gain.setValueAtTime(0.15, now + i * 0.06);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.08);
          o.start(now + i * 0.06); o.stop(now + i * 0.06 + 0.08);
        });
      }
    } catch (e) {}
  }
};
// ── Quote Pool (VORAX Messages) ──────────────────────────────
const QUOTES_POOL = [
  { category: "VORAX", color: "#FF5E1A", text: "I'm watching, human." },
  { category: "VORAX", color: "#FF5E1A", text: "Every second idle is a second wasted." },
  { category: "VORAX", color: "#FF3D00", text: "Your goals won't complete themselves." },
  { category: "VORAX", color: "#FF5E1A", text: "I feed on your completed tasks. Don't starve me." },
  { category: "VORAX", color: "#FF3D00", text: "Weakness is a choice. Choose differently." },
  { category: "VORAX", color: "#FFAA00", text: "The grind never stops. Neither should you." },
  { category: "VORAX", color: "#FF5E1A", text: "You didn't come this far to only come this far." },
  { category: "VORAX", color: "#FF3D00", text: "I don't care how you feel. I care what you do." },
  { category: "VORAX", color: "#FFAA00", text: "Results. Not excuses." },
  { category: "VORAX", color: "#FF5E1A", text: "Feed me or fall behind." },
  { category: "STRENGTH", color: "#ff3333", text: "Pain is raw data from your body. Absorb it, transmute it, turn it into power." },
  { category: "STRENGTH", color: "#ff3333", text: "Endurance is forged in fire. Delete the weak voice that begs you to quit." },
  { category: "INTELLIGENCE", color: "#FF5E1A", text: "Deep work is descending into the void. Lock yourself in the chamber and build." },
  { category: "INTELLIGENCE", color: "#FF5E1A", text: "Every page you devour adds new weapons to your cognitive arsenal." },
  { category: "VITALITY", color: "#00d4ff", text: "Vitality is not random — it's religious adherence to the protocol." },
  { category: "SYSTEM", color: "#FF5E1A", text: "Focus is your most valuable currency. Guard it or remain forgotten." },
  { category: "SYSTEM", color: "#FF3D00", text: "A superior version of you already exists. Close the gap or accept mediocrity." },
  { category: "SYSTEM", color: "#FFAA00", text: "Comfort is the deadliest virus. It keeps you trapped in tutorial mode forever." },
];

function getRandomQuote() {
  const d = new Date(); const seed = d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate();
  return QUOTES_POOL[seed % QUOTES_POOL.length];
}

// ── Skill Definitions ─────────────────────────────────────────
const SKILL_DEFS = {
  intelligence: { name: "INTELLIGENCE", icon: "⟐", color: "#FF5E1A", desc: "Business · Study · Learning" },
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
    { id: "deep_work",     name: "DEEP WORK",     icon: "⊕", color: "#FF5E1A",
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
  { id: "strategist", name: "STRATEGIST", icon: "⟐", color: "#FF5E1A", desc: "INT dominant — bonus XP on deep work", req: (s) => s.intelligence.level >= 5 && s.intelligence.level > s.strength.level && s.intelligence.level > s.social.level },
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
  { min: 2,  label: "×2 COMBO",      color: "#FF5E1A", xpBonus: 0.10, sound: "xp" },
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
  return classification === "beneficial" ? Math.max(lo, Math.floor(mid * 0.5)) : mid;
}

// ── Accent Color Options ─────────────────────────────────────
const ACCENT_COLORS = [
  { id: "fire", color: "#FF5E1A", name: "FIRE" },
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

// ── VORAX Expression Engine ──────────────────────────────────
function getVoraxExpression(state) {
  const completedCount = (state.completedToday || []).length;
  const streakDays = state.streakDays || 0;
  const taskCount = (state.tasks || []).length;
  const hasDecayDebuffs = (state.activeDebuffs || []).some(d => d.id === "decay" || d.id === "rust" || d.id === "atrophy");
  const hour = new Date().getHours();

  if (completedCount >= 5 && streakDays >= 7) return 'proud';
  if (completedCount >= 3 || streakDays >= 3) return 'pleased';
  if (hasDecayDebuffs || (taskCount > 0 && completedCount === 0 && hour > 14)) return 'furious';
  if (completedCount === 0 && hour > 10) return 'disappointed';
  if (taskCount > 0 && completedCount < taskCount / 2) return 'demanding';
  return 'idle';
}

// ── VORAX Quick Prompts ──────────────────────────────────────
function getVoraxQuickPrompts(state) {
  const completedCount = (state.completedToday || []).length;
  const pendingTasks = (state.tasks || []).filter(t => !(state.completedToday || []).includes(t.id));

  if (pendingTasks.length === 0 && completedCount === 0) {
    return ["Plan my day", "Add a quest", "What should I focus on?"];
  }
  if (pendingTasks.length > 0) {
    return ["How am I doing?", "I just finished something", "Motivate me"];
  }
  // All done
  return ["Analyze my week", "What's next?", "I want a reward"];
}

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
      accentColor: "#FF5E1A",
      soundEnabled: true,
      soundType: "forge",
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
    <button onClick={onClick} style={{ background: "none", border: "1px solid #222", color, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: "6px 14px", cursor: "pointer", letterSpacing: 2, marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>{label}</button>
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
        <span style={{ position: "absolute", bottom: "120%", left: "50%", transform: "translateX(-50%)", background: "#1a1a1a", border: "1px solid #333", color: "#ccc", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: "6px 10px", whiteSpace: "nowrap", zIndex: 9999, pointerEvents: "none", letterSpacing: 1 }}>{text}</span>
      )}
    </span>
  );
}

// ── Spinner ───────────────────────────────────────────────────
function Spinner({ color = "#FF5E1A", text = "Loading..." }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
      <span style={{ animation: "blink 0.6s step-end infinite" }}>█</span>
      <span>{text}</span>
    </div>
  );
}

// ── Daily Login Modal ─────────────────────────────────────────
function DailyLoginModal({ loginStreak, onClaim }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 5, 16, 0.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9600, padding: 16 }}>
      <div style={{ background: "#161125", border: "1px solid #2a1f45", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔥</div>
        <div style={{ color: "#FF5E1A", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>DAILY LOGIN</div>
        <div style={{ color: "#ede9f5", fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 900, marginBottom: 8 }}>DAY {loginStreak + 1}</div>
        <div style={{ color: "#7a7290", fontFamily: "'Inter', sans-serif", fontSize: 13, marginBottom: 24, lineHeight: 1.8 }}>
          You showed up. That alone puts you ahead of 90% of people.<br/>
          {loginStreak >= 3 && <span style={{ color: "#FFAA00" }}>🔥 {loginStreak}-day streak — don't break it.</span>}
          {loginStreak >= 7 && <span style={{ color: "#A855F7" }}><br/>LEGENDARY STREAK. Keep going.</span>}
        </div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 24 }}>
          <div style={{ background: "#FF5E1A12", border: "1px solid #FF5E1A33", padding: "12px 20px", borderRadius: 8 }}>
            <div style={{ color: "#FF5E1A", fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 900 }}>+{DAILY_LOGIN_BONUS.xp}</div>
            <div style={{ color: "#FF5E1A88", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>XP</div>
          </div>
          <div style={{ background: "#FFAA0012", border: "1px solid #FFAA0033", padding: "12px 20px", borderRadius: 8 }}>
            <div style={{ color: "#FFAA00", fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 900 }}>+{DAILY_LOGIN_BONUS.credits}</div>
            <div style={{ color: "#FFAA0088", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>CREDITS</div>
          </div>
        </div>
        <button onClick={onClaim} style={{ background: "linear-gradient(135deg, #FF5E1A, #FF3D00)", border: "none", color: "#fff", fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, padding: "12px 24px", cursor: "pointer", letterSpacing: 4, borderRadius: 8, animation: "pulse 1.5s infinite" }}>CLAIM & BEGIN</button>
      </div>
    </div>
  );
}

// ── Morning Planning Modal ────────────────────────────────────
function MorningPlanModal({ onSubmit, onSkip }) {
  const [tasks, setTasks] = useState(["", "", ""]);
  const filled = tasks.filter(t => t.trim()).length;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 5, 16, 0.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9550, padding: 16 }}>
      <div style={{ background: "#161125", border: "1px solid #2a1f45", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", textAlign: "center" }}>
        <div style={{ color: "#FF5E1A", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>MORNING PLANNING</div>
        <div style={{ color: "#7a7290", fontFamily: "'Inter', sans-serif", fontSize: 13, marginBottom: 20, lineHeight: 1.8 }}>
          Winners plan their day. What are your 3 priorities today?
        </div>
        {tasks.map((t, i) => (
          <input key={i} value={t} onChange={e => { const n = [...tasks]; n[i] = e.target.value; setTasks(n); }} placeholder={`Priority ${i + 1}...`} style={{ width: "100%", background: "#0f0b1a", border: "1px solid #1e1635", color: "#ede9f5", padding: "12px 14px", fontFamily: "'Inter', sans-serif", fontSize: 14, marginBottom: 8, boxSizing: "border-box", borderRadius: 8 }} />
        ))}
        <button onClick={() => setTasks([...tasks, ""])} style={{ background: "transparent", border: "1px solid #1e1635", color: "#7a7290", fontFamily: "'Inter', sans-serif", fontSize: 12, padding: "4px 12px", cursor: "pointer", marginBottom: 16, borderRadius: 8 }}>+ MORE</button>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { if (filled > 0) onSubmit(tasks.filter(t => t.trim())); }} disabled={filled === 0} style={{ flex: 1, padding: "12px 24px", background: filled > 0 ? "linear-gradient(135deg, #FF5E1A, #FF3D00)" : "#0f0b1a", border: filled > 0 ? "none" : "1px solid #1e1635", color: filled > 0 ? "#fff" : "#4a4460", fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, cursor: filled > 0 ? "pointer" : "not-allowed", letterSpacing: 3, borderRadius: 8 }}>LOCK IN PLAN</button>
          <button onClick={onSkip} style={{ padding: "12px 20px", background: "transparent", border: "1px solid #1e1635", color: "#7a7290", fontFamily: "'Inter', sans-serif", fontSize: 12, cursor: "pointer", borderRadius: 8 }}>SKIP</button>
        </div>
      </div>
    </div>
  );
}

// ── Absence Report Modal ──────────────────────────────────────
function AbsenceReportModal({ daysGone, xpLost, streakLost, potentialXpMissed, onDismiss }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 5, 16, 0.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9650, padding: 16 }}>
      <div style={{ background: "#161125", border: "1px solid #2a1f45", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>💀</div>
        <div style={{ color: "#FF3D00", fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>YOU WERE GONE</div>
        <div style={{ color: "#FF5E1A", fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 900, marginBottom: 20 }}>{daysGone} DAYS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <div style={{ background: "#FF3D0010", border: "1px solid #FF3D0033", padding: 14, borderRadius: 8 }}>
            <div style={{ color: "#FF3D00", fontSize: 20, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace" }}>-{xpLost}</div>
            <div style={{ color: "#FF3D0088", fontSize: 11, fontFamily: "'Inter', sans-serif" }}>XP DECAYED</div>
          </div>
          <div style={{ background: "#FF3D0010", border: "1px solid #FF3D0033", padding: 14, borderRadius: 8 }}>
            <div style={{ color: "#FF3D00", fontSize: 20, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace" }}>~{potentialXpMissed}</div>
            <div style={{ color: "#FF3D0088", fontSize: 11, fontFamily: "'Inter', sans-serif" }}>POTENTIAL XP MISSED</div>
          </div>
        </div>
        {streakLost && <div style={{ color: "#FF3D00", fontFamily: "'Inter', sans-serif", fontSize: 13, marginBottom: 16, padding: "8px 16px", background: "#FF3D0010", border: "1px solid #FF3D0033", borderRadius: 8 }}>🔥 STREAK BROKEN — Reset to 0</div>}
        <div style={{ color: "#7a7290", fontFamily: "'Inter', sans-serif", fontSize: 12, marginBottom: 20, lineHeight: 1.8 }}>
          Every day you don't show up, your skills decay and your competitors gain ground. VORAX doesn't pause.
        </div>
        <button onClick={onDismiss} style={{ background: "linear-gradient(135deg, #FF5E1A, #FF3D00)", border: "none", color: "#fff", fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, padding: "12px 24px", cursor: "pointer", letterSpacing: 3, borderRadius: 8 }}>I'M BACK. LET'S GO.</button>
      </div>
    </div>
  );
}

// ── Particles (Fire/Ember themed) ─────────────────────────────
function Particles({ active, count = 14 }) {
  if (!active) return null;
  const EMBER_COLORS = ["#FF5E1A", "#FF3D00", "#FFAA00", "#FF5E1A", "#FF3D00", "#FFAA00", "#991100"];
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }}>
      {Array.from({ length: count }).map((_, i) => {
        const x = Math.random() * 100; const delay = Math.random() * 0.5;
        const dur = 1.5 + Math.random() * 2; const size = 2 + Math.random() * 3;
        const c = EMBER_COLORS[i % EMBER_COLORS.length];
        const opacity = 0.5 + Math.random() * 0.5;
        return <div key={i} style={{ position: "absolute", left: `${x}%`, bottom: "40%", width: size, height: size, background: c, borderRadius: "50%", boxShadow: `0 0 ${size + 4}px ${c}, 0 0 ${size + 8}px ${c}44`, opacity, animation: `fireFloat ${dur}s ${delay}s ease-in-out forwards` }} />;
      })}
    </div>
  );
}

// ── Ember Splatter (Fire-themed hit effect) ───────────────────
function BloodSplatter({ active }) {
  if (!active) return null;
  const EMBER_SPLAT = ["#FF5E1A", "#FF3D00", "#FFAA00", "#FF5E1A", "#991100"];
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 5 }}>
      {Array.from({ length: 12 }).map((_, i) => {
        const x = 30 + Math.random() * 40, y = 20 + Math.random() * 60;
        const size = 3 + Math.random() * 10;
        const dx = (Math.random() - 0.5) * 120, dy = (Math.random() - 0.5) * 120;
        const c = EMBER_SPLAT[i % EMBER_SPLAT.length];
        return <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: size, height: size, borderRadius: "50%", background: `radial-gradient(circle, ${c}, ${c}44)`, boxShadow: `0 0 6px ${c}`, animation: `splatter 0.6s ${i*0.02}s ease-out forwards`, "--dx": `${dx}px`, "--dy": `${dy}px` }} />;
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
      <div style={{ fontSize: 48, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", background: "linear-gradient(135deg, #FF5E1A, #FFAA00, #FF3D00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: "none", filter: "drop-shadow(0 0 20px #FF5E1A88) drop-shadow(0 0 40px #FF3D0044)", letterSpacing: 6, lineHeight: 1 }}>{data.label}</div>
      <div style={{ fontSize: 16, fontFamily: "'JetBrains Mono', monospace", color: "#FF5E1A", opacity: 0.7, marginTop: 8, letterSpacing: 4 }}>+{Math.round(data.xpBonus * 100)}% XP BONUS</div>
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
      {/* Fire dissolve on death */}
      {isDead && (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          {Array.from({ length: 20 }).map((_, i) => {
            const c = ["#FF5E1A", "#FF3D00", "#FFAA00"][i % 3];
            return (
            <div key={i} style={{ position: "absolute", left: `${Math.random()*100}%`, top: -20, color: c, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", animation: `matrixRain ${1+Math.random()*2}s ${Math.random()*0.5}s linear forwards`, opacity: 0.6 }}>
              {String.fromCharCode(0x30A0 + Math.random() * 96)}
            </div>
            );
          })}
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
            <div style={{ color: def.color, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: 2, fontWeight: 700 }}>{def.name}</div>
            <div style={{ color: "#888", fontFamily: "'JetBrains Mono', monospace", fontSize: 12}}>{def.desc}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: def.color, fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 900 }}>LV.{level}</div>
          <div style={{ color: "#999", fontFamily: "'JetBrains Mono', monospace", fontSize: 12}}>{xp}/100</div>
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
  const [tapped, setTapped] = useState(false);
  const [blinkVisible, setBlinkVisible] = useState(false);
  const blinkTimerRef = useRef(null);

  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 3000 + Math.random() * 3000;
      blinkTimerRef.current = setTimeout(() => {
        setBlinkVisible(true);
        setTimeout(() => setBlinkVisible(false), 120);
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => { if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current); };
  }, []);

  const handleTap = () => {
    setTapped(true);
    AudioEngine.play("click");
    setTimeout(() => setTapped(false), 600);
  };

  const glowConfig = {
    idle: { shadow: '0 0 40px rgba(255, 94, 26, 0.3), 0 0 80px rgba(255, 94, 26, 0.1)', filter: 'brightness(1) saturate(1.05)' },
    pleased: { shadow: '0 0 50px rgba(255, 170, 0, 0.5), 0 0 100px rgba(255, 170, 0, 0.2)', filter: 'brightness(1.15) saturate(1.15)' },
    disappointed: { shadow: '0 0 20px rgba(100, 50, 50, 0.3)', filter: 'brightness(0.65) saturate(0.4) grayscale(0.2)' },
    furious: { shadow: '0 0 60px rgba(255, 0, 0, 0.7), 0 0 120px rgba(255, 0, 0, 0.3)', filter: 'brightness(1.3) saturate(1.5) hue-rotate(-5deg)' },
    proud: { shadow: '0 0 60px rgba(255, 200, 50, 0.6), 0 0 120px rgba(255, 170, 0, 0.3)', filter: 'brightness(1.3) saturate(1.3)' },
    demanding: { shadow: '0 0 50px rgba(0, 180, 255, 0.5), 0 0 100px rgba(200, 220, 255, 0.2)', filter: 'brightness(1.1) saturate(1.15)' },
  };

  const glow = glowConfig[expression] || glowConfig.idle;
  const isFurious = expression === 'furious';

  // Choose animation based on state
  let containerAnimation;
  if (tapped) {
    containerAnimation = 'voraxHeadTilt 0.6s ease';
  } else if (speaking) {
    containerAnimation = 'voraxSpeaking 2s ease-in-out infinite';
  } else if (isFurious) {
    containerAnimation = 'voraxFuriousShake 0.3s ease-in-out infinite';
  } else {
    containerAnimation = 'voraxIdleSway 6s ease-in-out infinite';
  }

  return (
    <div
      onClick={handleTap}
      style={{
        width: size,
        height: size * 1.2,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        overflow: 'visible',
      }}
    >
      {/* Animated body wrapper */}
      <div style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        animation: containerAnimation,
        transition: 'animation 0.3s ease',
      }}>
        {/* Breathing wrapper */}
        <div style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          animation: speaking ? 'none' : 'voraxBreathe 4s ease-in-out infinite',
        }}>
          {/* Main image */}
          <img
            src="/vorax-avatar.jpg"
            alt="VORAX"
            style={{
              width: '115%',
              height: '115%',
              objectFit: 'contain',
              position: 'absolute',
              top: '-7.5%',
              left: '-7.5%',
              borderRadius: 16,
              filter: glow.filter,
              boxShadow: glow.shadow,
              transition: 'filter 0.5s ease, box-shadow 0.5s ease',
            }}
            draggable={false}
          />

          {/* Eye blink overlay */}
          {blinkVisible && (
            <div style={{
              position: 'absolute',
              top: '18%',
              left: '25%',
              width: '50%',
              height: '8%',
              background: 'rgba(30, 22, 53, 0.9)',
              borderRadius: '40%',
              pointerEvents: 'none',
              zIndex: 2,
            }} />
          )}

          {/* Mouth animation overlay — visible dark opening when speaking */}
          {speaking && (
            <>
              {/* Primary mouth overlay */}
              <div style={{
                position: 'absolute',
                bottom: '28%',
                left: '30%',
                width: '40%',
                height: '12%',
                overflow: 'hidden',
                pointerEvents: 'none',
                zIndex: 3,
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  background: 'rgba(0, 0, 0, 0.55)',
                  borderRadius: '30% 30% 50% 50%',
                  animation: 'voraxMouthSpeak 0.2s ease-in-out infinite alternate',
                  transformOrigin: 'top center',
                  boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
                }} />
              </div>
              {/* Secondary mouth shadow for depth */}
              <div style={{
                position: 'absolute',
                bottom: '26%',
                left: '32%',
                width: '36%',
                height: '8%',
                background: 'rgba(255, 94, 26, 0.15)',
                borderRadius: '50%',
                animation: 'voraxMouthSpeak 0.25s ease-in-out infinite alternate-reverse',
                pointerEvents: 'none',
                zIndex: 2,
                filter: 'blur(4px)',
              }} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}



// ── EditTaskModal ──────────────────────────────────────────────
function EditTaskModal({ task, onSave, onClose }) {
  const [text, setText] = useState(task.text);
  const [skill, setSkill] = useState(task.skill);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 5, 16, 0.9)", backdropFilter: "blur(8px)", zIndex: 9800, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#161125", border: "1px solid #2a1f45", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ color: "#ede9f5", fontSize: 18, fontWeight: 700, letterSpacing: 1, fontFamily: "'Inter', sans-serif", marginBottom: 20 }}>EDIT QUEST</div>

        <div style={{ color: "#FF5E1A", fontSize: 12, fontWeight: 600, letterSpacing: 2, fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>QUEST TEXT</div>
        <input value={text} onChange={e => setText(e.target.value)} style={{ width: "100%", background: "#0f0b1a", border: "1px solid #1e1635", color: "#ede9f5", padding: "12px 14px", fontFamily: "'Inter', sans-serif", fontSize: 14, borderRadius: 8, boxSizing: "border-box", marginBottom: 16 }} />

        <div style={{ color: "#FF5E1A", fontSize: 12, fontWeight: 600, letterSpacing: 2, fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>SKILL CATEGORY</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 20 }}>
          {Object.entries(SKILL_DEFS).map(([key, def]) => (
            <button key={key} onClick={() => setSkill(key)} style={{
              padding: "10px 8px",
              background: skill === key ? def.color + "20" : "#0f0b1a",
              border: `2px solid ${skill === key ? def.color : "#1e1635"}`,
              color: skill === key ? def.color : "#7a7290",
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              borderRadius: 8,
              minHeight: 44,
            }}>{def.icon} {def.name}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { if (text.trim()) onSave({ ...task, text: text.trim(), skill }); }} style={{ flex: 1, background: "linear-gradient(135deg, #FF5E1A, #FF3D00)", border: "none", color: "#fff", borderRadius: 8, padding: "12px 24px", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>SAVE</button>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid #1e1635", color: "#7a7290", borderRadius: 8, padding: "12px 20px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 14 }}>CANCEL</button>
        </div>
      </div>
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 5, 16, 0.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000 }} onClick={onClose}>
      <div style={{ background: "#161125", border: "1px solid #2a1f45", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
        <div style={{ color: "#FF5E1A", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>+ NEW QUEST</div>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="What do you need to do..." style={{ width: "100%", background: "#0f0b1a", border: "1px solid #1e1635", color: "#ede9f5", fontFamily: "'Inter', sans-serif", fontSize: 14, padding: "12px 14px", marginBottom: 12, outline: "none", boxSizing: "border-box", borderRadius: 8 }} autoFocus onKeyDown={e => { if (e.key === "Enter") submit(); }} />
        {/* Read-only AI classification status — no buttons */}
        <div style={{ height: 20, marginBottom: 14 }}>
          {aiClassifying && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#FF5E1A66", fontSize: 11, fontFamily: "'Inter', sans-serif" }}>
              <span style={{ animation: "blink 0.6s step-end infinite" }}>█</span>
              <span>AI classifying...</span>
            </div>
          )}
          {!aiClassifying && aiLabel && detectedDef && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: detectedDef.color, fontSize: 11, fontFamily: "'Inter', sans-serif", opacity: 0.85 }}>
              <span>{detectedDef.icon}</span>
              <span>{aiLabel === "wealth" ? "WEALTH → INTELLIGENCE" : detectedDef.name}</span>
              <span style={{ color: "#4a4460", marginLeft: 4 }}>— auto-classified</span>
            </div>
          )}
          {!aiClassifying && !aiLabel && text.trim().length >= 4 && (
            <div style={{ color: "#4a4460", fontSize: 11, fontFamily: "'Inter', sans-serif" }}>waiting to classify...</div>
          )}
        </div>
        <button onClick={submit} disabled={!text.trim()} style={{ width: "100%", background: text.trim() ? "linear-gradient(135deg, #FF5E1A, #FF3D00)" : "#0f0b1a", border: text.trim() ? "none" : "1px solid #1e1635", color: text.trim() ? "#fff" : "#4a4460", fontFamily: "'Inter', sans-serif", fontSize: 14, padding: "12px 24px", cursor: text.trim() ? "pointer" : "not-allowed", letterSpacing: 3, fontWeight: 600, borderRadius: 8 }}>REGISTER QUEST</button>
      </div>
    </div>
  );
}

// ── Likert Rating Modal (after task completion) ───────────────
function RatingModal({ task, onRate, onClose }) {
  const labels = ["Trivial", "Very Easy", "Easy", "Moderate", "Challenging", "Hard", "Brutal"];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 5, 16, 0.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9500, padding: 16 }}>
      <div style={{ background: "#161125", border: "1px solid #2a1f45", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", textAlign: "center" }}>
        <div style={{ color: "#FF5E1A", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>QUEST COMPLETE</div>
        <div style={{ color: "#ede9f5", fontSize: 14, fontWeight: 700, fontFamily: "'Inter', sans-serif", marginBottom: 24, letterSpacing: 1 }}>{task.text}</div>
        <div style={{ color: "#7a7290", fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 20 }}>How difficult was this?</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[1,2,3,4,5,6,7].map(n => {
            const pct = n / 7;
            const color = pct < 0.3 ? "#7CFF3F" : pct < 0.6 ? "#FFAA00" : "#FF3D00";
            return (
              <button key={n} onClick={() => onRate(n)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: `${color}08`, border: `1px solid ${color}33`, cursor: "pointer", transition: "all 0.15s", borderRadius: 8 }}>
                <span style={{ color, fontSize: 20, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", width: 28, textAlign: "center" }}>{n}</span>
                <span style={{ color: "#7a7290", fontSize: 13, fontFamily: "'Inter', sans-serif" }}>{labels[n-1]}</span>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", gap: 2 }}>
                  {Array.from({length: n}, (_, i) => <div key={i} style={{ width: 6, height: 16, background: color, opacity: 0.3 + (i / n) * 0.7, borderRadius: 2 }} />)}
                </div>
              </button>
            );
          })}
        </div>
        {onClose && (
          <button onClick={onClose} style={{ marginTop: 16, width: "100%", background: "transparent", border: "1px solid #2a1f45", color: "#7a7290", fontFamily: "'Inter', sans-serif", fontSize: 13, padding: "12px 24px", cursor: "pointer", letterSpacing: 2, fontWeight: 600, borderRadius: 8, transition: "all 0.15s" }}>CANCEL</button>
        )}
      </div>
    </div>
  );
}

// ── Reward Reflection Modal ───────────────────────────────────
function RewardReflectionModal({ reward, onSubmit }) {
  const [text, setText] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 5, 16, 0.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9500, padding: 16 }}>
      <div style={{ background: "#161125", border: "1px solid #2a1f45", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", textAlign: "center" }}>
        <div style={{ color: "#FFAA00", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>REFLECTION REQUIRED</div>
        <div style={{ color: "#ede9f5", fontSize: 14, fontWeight: 700, fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>You used a reward: {reward.name}</div>
        <div style={{ color: "#7a7290", fontSize: 13, fontFamily: "'Inter', sans-serif", marginBottom: 20, lineHeight: 1.8 }}>What did you learn or gain from this? How does it benefit your goals?</div>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Be honest with yourself..." rows={4} style={{ width: "100%", background: "#0f0b1a", border: "1px solid #1e1635", color: "#ede9f5", padding: 14, fontFamily: "'Inter', sans-serif", fontSize: 14, resize: "vertical", lineHeight: 1.8, boxSizing: "border-box", borderRadius: 8 }} />
        <button onClick={() => { if (text.trim()) onSubmit(text.trim()); }} disabled={!text.trim()} style={{ marginTop: 16, width: "100%", background: text.trim() ? "linear-gradient(135deg, #FF5E1A, #FF3D00)" : "#0f0b1a", border: text.trim() ? "none" : "1px solid #1e1635", color: text.trim() ? "#fff" : "#4a4460", fontFamily: "'Inter', sans-serif", fontSize: 14, padding: "12px 24px", cursor: text.trim() ? "pointer" : "not-allowed", letterSpacing: 3, fontWeight: 600, borderRadius: 8 }}>SUBMIT REFLECTION</button>
      </div>
    </div>
  );
}

// ── End of Day Reflection Modal ───────────────────────────────
function EndOfDayModal({ onSubmit }) {
  const [productive, setProductive] = useState(null);
  const [improve, setImprove] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 5, 16, 0.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9500, padding: 16 }}>
      <div style={{ background: "#161125", border: "1px solid #2a1f45", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", textAlign: "center" }}>
        <div style={{ color: "#FF5E1A", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>ALL TASKS COMPLETE</div>
        <div style={{ color: "#7a7290", fontSize: 13, fontFamily: "'Inter', sans-serif", marginBottom: 24, lineHeight: 1.8 }}>Time to be honest with yourself.</div>
        <div style={{ color: "#ede9f5", fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 12 }}>Were you productive today?</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
          {[{v: "yes", l: "YES", c: "#7CFF3F"}, {v: "somewhat", l: "SOMEWHAT", c: "#FFAA00"}, {v: "no", l: "NO", c: "#FF3D00"}].map(o => (
            <button key={o.v} onClick={() => setProductive(o.v)} style={{ padding: "10px 20px", background: productive === o.v ? `${o.c}15` : "transparent", border: `1px solid ${productive === o.v ? o.c : "#1e1635"}`, color: productive === o.v ? o.c : "#7a7290", fontFamily: "'Inter', sans-serif", fontSize: 13, cursor: "pointer", letterSpacing: 2, borderRadius: 8 }}>{o.l}</button>
          ))}
        </div>
        <div style={{ color: "#ede9f5", fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 8, lineHeight: 1.8 }}>How can you improve? Be brutally honest — there is always something you can do better.</div>
        <textarea value={improve} onChange={e => setImprove(e.target.value)} placeholder="I can improve by..." rows={4} style={{ width: "100%", background: "#0f0b1a", border: "1px solid #1e1635", color: "#ede9f5", padding: 14, fontFamily: "'Inter', sans-serif", fontSize: 14, resize: "vertical", lineHeight: 1.8, boxSizing: "border-box", borderRadius: 8 }} />
        <button onClick={() => { if (productive && improve.trim()) onSubmit({ productive, improvement: improve.trim(), date: new Date().toDateString() }); }} disabled={!productive || !improve.trim()} style={{ marginTop: 16, width: "100%", background: productive && improve.trim() ? "linear-gradient(135deg, #FF5E1A, #FF3D00)" : "#0f0b1a", border: productive && improve.trim() ? "none" : "1px solid #1e1635", color: productive && improve.trim() ? "#fff" : "#4a4460", fontFamily: "'Inter', sans-serif", fontSize: 14, padding: "12px 24px", cursor: productive && improve.trim() ? "pointer" : "not-allowed", letterSpacing: 3, fontWeight: 600, borderRadius: 8 }}>LOCK IN REFLECTION</button>
      </div>
    </div>
  );
}

function AddBossModal({ onAdd, onClose }) {
  const [name, setName] = useState(""); const [subs, setSubs] = useState([{text:"",date:""},{text:"",date:""},{text:"",date:""}]); const [deadlineDate, setDeadlineDate] = useState(""); const [skill, setSkill] = useState("intelligence");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 5, 16, 0.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000 }} onClick={onClose}>
      <div style={{ background: "#161125", border: "1px solid #2a1f45", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
        <div style={{ color: "#FF3D00", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>NEW LONG-TERM GOAL</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Goal name (e.g. Launch My Startup)" style={{ width: "100%", background: "#0f0b1a", border: "1px solid #1e1635", color: "#ede9f5", fontFamily: "'Inter', sans-serif", fontSize: 14, padding: "12px 14px", marginBottom: 12, outline: "none", boxSizing: "border-box", borderRadius: 8 }} autoFocus />
        <div style={{ color: "#FF5E1A", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>SKILL CATEGORY</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {Object.entries(SKILL_DEFS).map(([k, v]) => (
            <button key={k} onClick={() => setSkill(k)} style={{ flex: 1, minWidth: 60, background: skill === k ? `${v.color}15` : "transparent", border: `1px solid ${skill === k ? v.color : "#1e1635"}`, color: skill === k ? v.color : "#4a4460", fontFamily: "'Inter', sans-serif", fontSize: 12, padding: "6px 2px", cursor: "pointer", borderRadius: 8 }}>{v.icon} {v.name.slice(0,3)}</button>
          ))}
        </div>
        <div style={{ color: "#FF5E1A", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>MILESTONES</div>
        {subs.map((st, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input value={st.text} onChange={e => { const n = [...subs]; n[i] = {...n[i], text: e.target.value}; setSubs(n); }} placeholder={`Milestone ${i+1}...`} style={{ flex: 1, background: "#0f0b1a", border: "1px solid #1e1635", color: "#ede9f5", fontFamily: "'Inter', sans-serif", fontSize: 14, padding: "12px 14px", outline: "none", boxSizing: "border-box", borderRadius: 8 }} />
            <input type="date" value={st.date} onChange={e => { const n = [...subs]; n[i] = {...n[i], date: e.target.value}; setSubs(n); }} style={{ width: 130, background: "#0f0b1a", border: "1px solid #1e1635", color: "#FF5E1A88", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, padding: "6px 6px", outline: "none", boxSizing: "border-box", colorScheme: "dark", borderRadius: 8 }} />
          </div>
        ))}
        <button onClick={() => setSubs([...subs, {text:"",date:""}])} style={{ background: "transparent", border: "1px solid #1e1635", color: "#7a7290", fontFamily: "'Inter', sans-serif", fontSize: 12, padding: "4px 10px", cursor: "pointer", marginBottom: 12, borderRadius: 8 }}>+ ADD MILESTONE</button>
        <div style={{ color: "#FF5E1A", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>OVERALL DEADLINE</div>
        <input type="date" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)} style={{ width: "100%", background: "#0f0b1a", border: "1px solid #1e1635", color: "#FF5E1A", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: "12px 14px", marginBottom: 14, outline: "none", boxSizing: "border-box", colorScheme: "dark", borderRadius: 8 }} />
        <button onClick={() => {
          if (!name.trim()) return; const vs = subs.filter(s => s.text.trim()); if (!vs.length) return;
          const dmg = Math.ceil(100 / vs.length);
          const dl = deadlineDate ? new Date(deadlineDate + "T23:59:59").getTime() : Date.now() + 90 * 86400000;
          onAdd({ id: `boss_${Date.now()}`, name: name.trim(), skill, maxHp: 100, hp: 100, phase: 1, createdAt: Date.now(), deadline: dl, subtasks: vs.map((s,i) => ({ id: `bs_${Date.now()}_${i}`, text: s.text.trim(), done: false, dmg, scheduledDate: s.date || null })), reward: 100 + vs.length * 25 });
          AudioEngine.play("boss");
        }} style={{ width: "100%", background: "linear-gradient(135deg, #FF5E1A, #FF3D00)", border: "none", color: "#fff", fontFamily: "'Inter', sans-serif", fontSize: 14, padding: "12px 24px", cursor: "pointer", letterSpacing: 3, fontWeight: 600, borderRadius: 8 }}>SET GOAL</button>
      </div>
    </div>
  );
}

function AddNPCModal({ onAdd, onClose }) {
  const [name, setName] = useState(""); const [cat, setCat] = useState("ally");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 5, 16, 0.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000 }} onClick={onClose}>
      <div style={{ background: "#161125", border: "1px solid #2a1f45", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
        <div style={{ color: "#00B4FF", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>ADD NPC</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="NPC name..." style={{ width: "100%", background: "#0f0b1a", border: "1px solid #1e1635", color: "#ede9f5", fontFamily: "'Inter', sans-serif", fontSize: 14, padding: "12px 14px", marginBottom: 12, outline: "none", boxSizing: "border-box", borderRadius: 8 }} autoFocus />
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {["ally","rival","mentor"].map(c => <button key={c} onClick={() => setCat(c)} style={{ flex: 1, background: cat === c ? "#00B4FF10" : "transparent", border: `1px solid ${cat === c ? "#00B4FF" : "#1e1635"}`, color: cat === c ? "#00B4FF" : "#4a4460", fontFamily: "'Inter', sans-serif", fontSize: 12, padding: "6px 2px", cursor: "pointer", textTransform: "uppercase", borderRadius: 8 }}>{c}</button>)}
        </div>
        <button onClick={() => { if (name.trim()) { onAdd({ id: `npc_${Date.now()}`, name: name.trim(), category: cat, relationshipXp: 0, maxXp: 100, lastInteraction: new Date().toDateString(), decayWarning: false }); AudioEngine.play("xp"); } }} style={{ width: "100%", background: "linear-gradient(135deg, #FF5E1A, #FF3D00)", border: "none", color: "#fff", fontFamily: "'Inter', sans-serif", fontSize: 14, padding: "12px 24px", cursor: "pointer", letterSpacing: 3, fontWeight: 600, borderRadius: 8 }}>ADD NPC</button>
      </div>
    </div>
  );
}

function LevelUpOverlay({ skill, newLevel, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 5, 16, 0.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9800 }} onClick={onClose}>
      <div style={{ textAlign: "center" }}>
        <div style={{ color: SKILL_DEFS[skill]?.color || "#FF5E1A", fontSize: 48, animation: "pulse 0.5s infinite" }}>{SKILL_DEFS[skill]?.icon || "◈"}</div>
        <div style={{ color: "#ede9f5", fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 900, letterSpacing: 4, marginTop: 16 }}>LEVEL UP</div>
        <div style={{ color: SKILL_DEFS[skill]?.color || "#FF5E1A", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, letterSpacing: 3, marginTop: 8 }}>{SKILL_DEFS[skill]?.name} → LV.{newLevel}</div>
        <div style={{ color: "#7a7290", fontFamily: "'Inter', sans-serif", fontSize: 13, marginTop: 16 }}>tap to continue</div>
      </div>
    </div>
  );
}

function AddRewardModal({ onAdd, onClose, lifeMission, avgDailyCredits, anthropicKey }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("BENEFICIAL");
  const [cost, setCost] = useState(100);
  const [justification, setJustification] = useState("");
  const [aiPricing, setAiPricing] = useState(false);
  const [aiReason, setAiReason] = useState(null);

  const isDistraction = cat === "DISTRACTING";
  const canSubmit = name.trim() && (!isDistraction || justification.trim().length >= 10);

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
          system: `You are a reward pricing engine for a gamified productivity app. The user earns ~${avg} credits per day. Price the reward between ${lo}-${hi} credits. Category: ${cat}. ${cat === "BENEFICIAL" ? "BENEFICIAL rewards cost HALF of distracting ones." : ""} Return ONLY a JSON object: {"price":NUMBER,"reason":"SHORT_REASON"}`,
          messages: [{ role: "user", content: `Price this reward: "${name.trim()}"${desc ? ` (${desc.trim()})` : ""}` }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "";
      const match = raw.match(/\{[\s\S]*?"price"\s*:\s*(\d+)[\s\S]*?"reason"\s*:\s*"([^"]*)"/);
      if (match) {
        let price = parseInt(match[1]);
        if (cat === "BENEFICIAL") price = Math.max(lo, Math.floor(price * 0.5));
        price = Math.max(lo, Math.min(hi, price));
        setCost(price);
        setAiReason(`${match[2]} (${tier} tier)`);
      } else {
        const mid = Math.floor((lo + hi) / 2);
        setCost(cat === "BENEFICIAL" ? Math.floor(mid * 0.5) : mid);
        setAiReason(`Auto-priced as ${tier} tier`);
      }
    } catch (e) {
      setAiReason("AI pricing failed: " + e.message);
    } finally { setAiPricing(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 5, 16, 0.9)", backdropFilter: "blur(8px)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div style={{ background: "#161125", border: "1px solid #2a1f45", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ color: "#FFAA00", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>+ ADD CUSTOM REWARD</div>
        <input placeholder="Reward name..." value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", background: "#0f0b1a", border: "1px solid #1e1635", color: "#ede9f5", padding: "12px 14px", fontFamily: "'Inter', sans-serif", fontSize: 14, marginBottom: 8, boxSizing: "border-box", borderRadius: 8 }} />
        <input placeholder="Short description (optional)..." value={desc} onChange={e => setDesc(e.target.value)} style={{ width: "100%", background: "#0f0b1a", border: "1px solid #1e1635", color: "#ede9f5", padding: "12px 14px", fontFamily: "'Inter', sans-serif", fontSize: 14, marginBottom: 12, boxSizing: "border-box", borderRadius: 8 }} />
        <div style={{ color: "#FF5E1A", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>CATEGORY</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {["BENEFICIAL", "DISTRACTING", "OTHER"].map(c => (
            <button key={c} onClick={() => { setCat(c); setJustification(""); }} style={{ flex: 1, padding: "10px 4px", background: cat === c ? (c === "DISTRACTING" ? "#FF3D0015" : c === "BENEFICIAL" ? "#7CFF3F15" : "#ffffff10") : "transparent", border: `1px solid ${cat === c ? (c === "DISTRACTING" ? "#FF3D00" : c === "BENEFICIAL" ? "#7CFF3F" : "#7a7290") : "#1e1635"}`, color: cat === c ? (c === "DISTRACTING" ? "#FF3D00" : c === "BENEFICIAL" ? "#7CFF3F" : "#ede9f5") : "#4a4460", fontFamily: "'Inter', sans-serif", fontSize: 12, cursor: "pointer", letterSpacing: 1, borderRadius: 8 }}>{c}</button>
          ))}
        </div>
        {isDistraction && (
          <div style={{ background: "#FFAA0008", border: "1px solid #FFAA0044", padding: 14, marginBottom: 12, borderRadius: 8 }}>
            <div style={{ color: "#FFAA00", fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 8, letterSpacing: 1 }}>DISTRACTING REWARD REQUIRES JUSTIFICATION</div>
            {lifeMission && <div style={{ color: "#FFAA0099", fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 8, lineHeight: 1.6 }}>Your mission: "{lifeMission.slice(0, 80)}{lifeMission.length > 80 ? '...' : ''}"</div>}
            <div style={{ color: "#7a7290", fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 8, lineHeight: 1.6 }}>How does this reward support your life mission — or does it give you real rest that makes you more effective? Be specific.</div>
            <textarea placeholder="My justification..." value={justification} onChange={e => setJustification(e.target.value)} rows={3} style={{ width: "100%", background: "#0f0b1a", border: `1px solid ${justification.trim().length >= 10 ? "#FFAA0066" : "#1e1635"}`, color: "#ede9f5", padding: "12px 14px", fontFamily: "'Inter', sans-serif", fontSize: 14, resize: "vertical", lineHeight: 1.8, boxSizing: "border-box", borderRadius: 8 }} />
            <div style={{ color: justification.trim().length >= 10 ? "#7CFF3F88" : "#4a4460", fontSize: 12, fontFamily: "'Inter', sans-serif", marginTop: 4 }}>{justification.trim().length}/10 min characters</div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ color: "#FFAA00", fontFamily: "'Inter', sans-serif", fontSize: 13 }}>COST:</span>
          <input type="number" min={5} max={2000} step={5} value={cost} onChange={e => setCost(Math.max(5, parseInt(e.target.value) || 5))} style={{ width: 90, background: "#0f0b1a", border: "1px solid #1e1635", color: "#FFAA00", padding: "12px 14px", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 900, textAlign: "center", borderRadius: 8 }} />
          <span style={{ color: "#FFAA00", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 900 }}>¢</span>
          <button onClick={handleAiPrice} disabled={!name.trim() || aiPricing} style={{ background: aiPricing ? "#FFAA0008" : "#FFAA0012", border: `1px solid ${name.trim() && !aiPricing ? "#FFAA00" : "#1e1635"}`, color: name.trim() && !aiPricing ? "#FFAA00" : "#4a4460", fontFamily: "'Inter', sans-serif", fontSize: 11, padding: "8px 12px", cursor: name.trim() && !aiPricing ? "pointer" : "not-allowed", letterSpacing: 1, fontWeight: 700, whiteSpace: "nowrap", borderRadius: 8 }}>{aiPricing ? "..." : "AI PRICE"}</button>
        </div>
        <div style={{ color: "#4a4460", fontSize: 11, fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>min 5 — max 2000</div>
        {aiReason && <div style={{ color: "#FFAA0088", fontSize: 11, fontFamily: "'Inter', sans-serif", marginBottom: 12, padding: "6px 10px", background: "#FFAA0008", border: "1px solid #FFAA0022", borderRadius: 8 }}>{aiReason}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { if (canSubmit) onAdd({ id: `cr_${Date.now()}`, name: name.trim(), desc: desc.trim(), category: cat, cost: Math.min(2000, Math.max(5, cost)), icon: cat === "DISTRACTING" ? "▶" : "◈", isCustom: true, justification: justification.trim() || undefined }); }} disabled={!canSubmit} style={{ flex: 1, padding: "12px 24px", background: canSubmit ? "linear-gradient(135deg, #FF5E1A, #FF3D00)" : "#0f0b1a", border: canSubmit ? "none" : "1px solid #1e1635", color: canSubmit ? "#fff" : "#4a4460", fontFamily: "'Inter', sans-serif", fontWeight: 600, cursor: canSubmit ? "pointer" : "not-allowed", letterSpacing: 2, fontSize: 14, borderRadius: 8 }}>ADD REWARD</button>
          <button onClick={onClose} style={{ padding: "12px 20px", background: "transparent", border: "1px solid #1e1635", color: "#7a7290", fontFamily: "'Inter', sans-serif", cursor: "pointer", fontSize: 13, borderRadius: 8 }}>CANCEL</button>
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 5, 16, 0.9)", backdropFilter: "blur(8px)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#161125", border: "1px solid #2a1f45", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ color: "#FF5E1A", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>+ QUICK LOG</div>
        <div style={{ color: "#7a7290", fontSize: 12, marginBottom: 14, fontFamily: "'Inter', sans-serif" }}>Log a task you already completed. You'll rate difficulty after.</div>
        <input placeholder="What did you do..." value={text} onChange={e => setText(e.target.value)} style={{ width: "100%", background: "#0f0b1a", border: "1px solid #1e1635", color: "#ede9f5", padding: "12px 14px", fontFamily: "'Inter', sans-serif", fontSize: 14, marginBottom: 12, boxSizing: "border-box", borderRadius: 8 }} />
        <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
          {Object.entries(SKILL_DEFS).map(([k, v]) => (
            <button key={k} onClick={() => { setSkill(k); setUserOverrode(true); setAutoDetected(null); }} style={{ flex: 1, background: skill === k ? `${v.color}20` : "transparent", border: `1px solid ${skill === k ? v.color : "#1e1635"}`, color: skill === k ? v.color : "#7a7290", fontFamily: "'Inter', sans-serif", fontSize: 12, padding: "10px 2px", cursor: "pointer", borderRadius: 8 }}>{v.icon} {v.name.slice(0,3)}</button>
          ))}
        </div>
        {autoDetected && !userOverrode && (
          <div style={{ color: SKILL_DEFS[autoDetected]?.color || "#FF5E1A", fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 8, opacity: 0.7 }}>Auto: {SKILL_DEFS[autoDetected]?.name}</div>
        )}
        {!autoDetected && <div style={{ color: "#7a7290", fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>{SKILL_DEFS[skill]?.icon} {SKILL_DEFS[skill]?.desc}</div>}
        <div style={{ height: 8 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { if (text.trim()) onLog({ text: text.trim(), skill }); }} disabled={!text.trim()} style={{ flex: 1, padding: "12px 24px", background: text.trim() ? "linear-gradient(135deg, #FF5E1A, #FF3D00)" : "#0f0b1a", border: text.trim() ? "none" : "1px solid #1e1635", color: text.trim() ? "#fff" : "#4a4460", fontFamily: "'Inter', sans-serif", fontWeight: 600, cursor: text.trim() ? "pointer" : "not-allowed", letterSpacing: 2, fontSize: 14, borderRadius: 8}}>LOG TASK</button>
          <button onClick={onClose} style={{ padding: "12px 20px", background: "transparent", border: "1px solid #1e1635", color: "#7a7290", fontFamily: "'Inter', sans-serif", cursor: "pointer", fontSize: 13, borderRadius: 8}}>CANCEL</button>
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 5, 16, 0.9)", backdropFilter: "blur(8px)", zIndex: 9800, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#161125", border: "1px solid #2a1f45", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ color: "#ede9f5", fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>Settings</div>
        <div style={{ color: "#7a7290", fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 24, lineHeight: 1.6 }}>Your data lives only on this device/browser. Nothing is sent to any server except AI messages you initiate.</div>

        <div style={{ color: "#FF5E1A", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>AI COACH — ANTHROPIC API KEY</div>
        <div style={{ color: "#7a7290", fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 8, lineHeight: 1.7 }}>Get a free key at console.anthropic.com. Stored only on this device.</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
          <input type={showKey ? "text" : "password"} value={key} onChange={e => setKey(e.target.value)} placeholder="sk-ant-..." style={{ flex: 1, background: "#0f0b1a", border: `1px solid ${key ? "#FF5E1A33" : "#1e1635"}`, color: "#ede9f5", padding: "12px 14px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, boxSizing: "border-box", borderRadius: 8 }} />
          <button onClick={() => setShowKey(p => !p)} style={{ padding: "12px 14px", background: "transparent", border: "1px solid #1e1635", color: "#7a7290", fontFamily: "'Inter', sans-serif", fontSize: 13, cursor: "pointer", borderRadius: 8 }}>{showKey ? "HIDE" : "SHOW"}</button>
        </div>
        <div style={{ color: "#7a7290", fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 20, lineHeight: 1.6 }}>Key is stored in browser localStorage. Do not share screenshots of this screen.</div>

        <div style={{ color: "#FFAA00", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>DAILY REFLECTION REMINDER</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
          <span style={{ color: "#7a7290", fontSize: 13, fontFamily: "'Inter', sans-serif" }}>Notify at:</span>
          <input type="time" value={notifTime} onChange={e => setNotifTime(e.target.value)} style={{ background: "#0f0b1a", border: "1px solid #1e1635", color: "#FFAA00", padding: "12px 14px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, colorScheme: "dark", borderRadius: 8 }} />
        </div>

        <div style={{ color: "#FF5E1A", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>NOTIFICATION DISPLAY NAME</div>
        <input value={notifName} onChange={e => setNotifName(e.target.value)} placeholder="Coach" style={{ width: "100%", background: "#0f0b1a", border: "1px solid #1e1635", color: "#ede9f5", padding: "12px 14px", fontFamily: "'Inter', sans-serif", fontSize: 14, marginBottom: 20, boxSizing: "border-box", borderRadius: 8 }} />

        <div style={{ color: "#00B4FF", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>COACH PERSONALITY</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {[["direct","DIRECT"],["gentle","GENTLE"],["drill","DRILL SGT"]].map(([v,l]) => (
            <button key={v} onClick={() => setPersonality(v)} style={{ flex: 1, padding: "10px 4px", background: personality === v ? "#00B4FF12" : "transparent", border: `1px solid ${personality === v ? "#00B4FF" : "#1e1635"}`, color: personality === v ? "#00B4FF" : "#4a4460", fontFamily: "'Inter', sans-serif", fontSize: 12, cursor: "pointer", borderRadius: 8 }}>{l}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { onSave({ anthropicKey: key, notificationTime: notifTime, notificationName: notifName || "Coach", coachPersonality: personality }); onClose(); }} style={{ flex: 1, padding: "12px 24px", background: "linear-gradient(135deg, #FF5E1A, #FF3D00)", border: "none", color: "#fff", fontFamily: "'Inter', sans-serif", fontWeight: 600, cursor: "pointer", letterSpacing: 2, fontSize: 14, borderRadius: 8 }}>SAVE SETTINGS</button>
          <button onClick={onClose} style={{ padding: "12px 20px", background: "transparent", border: "1px solid #1e1635", color: "#7a7290", fontFamily: "'Inter', sans-serif", cursor: "pointer", fontSize: 13, borderRadius: 8 }}>CANCEL</button>
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
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.04); }
  }
  @keyframes voraxBob {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    25% { transform: translateY(-8px) rotate(0.5deg); }
    50% { transform: translateY(-3px) rotate(0deg); }
    75% { transform: translateY(-6px) rotate(-0.5deg); }
  }
  @keyframes voraxIdleSway {
    0%, 100% { transform: rotate(0deg) translateX(0); }
    33% { transform: rotate(1.5deg) translateX(3px); }
    66% { transform: rotate(-1deg) translateX(-2px); }
  }
  @keyframes voraxSpeaking {
    0% { transform: translateY(0) rotate(0deg) scale(1); }
    10% { transform: translateY(-4px) rotate(1deg) scale(1.01); }
    20% { transform: translateY(-2px) rotate(-0.5deg) scale(1); }
    30% { transform: translateY(-6px) rotate(0.8deg) scale(1.02); }
    40% { transform: translateY(-1px) rotate(-0.3deg) scale(1); }
    50% { transform: translateY(-5px) rotate(1.2deg) scale(1.01); }
    60% { transform: translateY(-3px) rotate(-0.7deg) scale(1); }
    70% { transform: translateY(-7px) rotate(0.5deg) scale(1.02); }
    80% { transform: translateY(-2px) rotate(-1deg) scale(1); }
    90% { transform: translateY(-4px) rotate(0.3deg) scale(1.01); }
    100% { transform: translateY(0) rotate(0deg) scale(1); }
  }
  @keyframes voraxHeadTilt {
    0% { transform: scale(1) rotate(0deg); }
    20% { transform: scale(1.08) rotate(4deg); }
    40% { transform: scale(1.06) rotate(-3deg); }
    60% { transform: scale(1.04) rotate(2deg); }
    100% { transform: scale(1) rotate(0deg); }
  }
  @keyframes voraxFuriousShake {
    0%, 100% { transform: translateX(0) rotate(0deg); }
    20% { transform: translateX(-4px) rotate(-1deg); }
    40% { transform: translateX(4px) rotate(1deg); }
    60% { transform: translateX(-3px) rotate(-0.5deg); }
    80% { transform: translateX(3px) rotate(0.5deg); }
  }
  @keyframes voraxMouthSpeak {
    0% { transform: scaleY(0.3); opacity: 0.6; }
    50% { transform: scaleY(1); opacity: 0.9; }
    100% { transform: scaleY(0.5); opacity: 0.7; }
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
  const [view, setView] = useState("vorax");
  const [showParticles, setShowParticles] = useState(false);
  const [particleColor, setParticleColor] = useState("#FF5E1A");
  const [tPopup, setTPopup] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const dragStartY = useRef(0);
  const dragNodeRef = useRef(null);
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
  const [undoCompletion, setUndoCompletion] = useState(null);
  const undoCompletionTimerRef = useRef(null);
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

  const showToast = useCallback((msg, color = "#FF5E1A", duration = 1800) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, color });
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  }, []);

  const playerClass = determineClass(state.skills);
  const xpMult = getXpMultiplier(state);
  const creditMult = getCreditMult(state);

  // ── Boot + Yesterday Reminder ───────────────────
  const bootLines = [
    "VORAX v5.0.0", "Initializing skill trees...", `Loading human: ${onboardingData?.username || "HUMAN"}`,
    "Skill trees: INT / STR / VIT / SOC", `Class: ${playerClass.name}`,
    "Boss system: ARMED", "Protocol monitor: WATCHING",
    `Prestige: ${state.prestigeLevel}`,
    "", ">>> WELCOME BACK, HUMAN <<<",
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
      else if (e.key === "1") setView("vorax");
      else if (e.key === "2") setView("quests");
      else if (e.key === "3") setView("bosses");
      else if (e.key === "4") setView("skills");
      else if (e.key === "5") setView("more");
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

  // ── VORAX proactive greeting ──
  useEffect(() => {
    if (coachHistory.length > 0) return; // already has messages
    const pendingTasks = (state.tasks || []).filter(t => !(state.completedToday || []).includes(t.id));
    const completedCount = (state.completedToday || []).length;
    const hour = new Date().getHours();

    let greeting;
    if (hour < 12 && pendingTasks.length === 0 && completedCount === 0) {
      greeting = "What's the plan today, human. Talk or work.";
    } else if (pendingTasks.length > 0 && completedCount === 0) {
      greeting = `${pendingTasks.length} quests waiting. Zero done. Move.`;
    } else if (completedCount > 0 && pendingTasks.length > 0) {
      greeting = `${completedCount} done. ${pendingTasks.length} left. Don't stop now.`;
    } else if (pendingTasks.length === 0 && completedCount > 0) {
      greeting = "All quests done. Acceptable. For today.";
    } else {
      greeting = "I'm hungry, human. Feed me completed tasks.";
    }

    setCoachHistory([{ role: "assistant", content: greeting }]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    const preCompletionState = { ...state };
    AudioEngine.play("xp"); setShowParticles(true); setParticleColor(SKILL_DEFS[task.skill]?.color || "#FF5E1A");
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
    showToast(`✓ COMPLETE  +${finalXpForToast} XP`, SKILL_DEFS[ratingTask?.skill]?.color || "#FF5E1A", 2000);
    setTPopup(true); setTimeout(() => setTPopup(false), 1800);
    setUndoCompletion({ text: task.text, snapshot: preCompletionState });
    if (undoCompletionTimerRef.current) clearTimeout(undoCompletionTimerRef.current);
    undoCompletionTimerRef.current = setTimeout(() => setUndoCompletion(null), 8000);
  }, [ratingTask, showToast, state]);

  // ── Undo Last Completion ────────────────────────
  const undoLastCompletion = useCallback(() => {
    if (!undoCompletion) return;
    setState(undoCompletion.snapshot);
    setUndoCompletion(null);
    showToast("↩ COMPLETION UNDONE", "var(--accent-gold)");
    AudioEngine.play("click");
  }, [undoCompletion, showToast]);

  // ── Quick Log → also opens rating ───────────────
  const quickLog = useCallback(({ text, skill }) => {
    setRatingTask({ id: `ql_${Date.now()}`, text, skill, xp: 20, isQuickLog: true });
    setShowQuickLog(false);
  }, []);

  const addTask = useCallback(t => { setState(p => ({ ...p, tasks: [...p.tasks, t] })); setShowAddTask(false); showToast("✓ QUEST ADDED", "#FF5E1A"); }, [showToast]);

  const updateTask = useCallback((updatedTask) => {
    setState(p => ({
      ...p,
      tasks: p.tasks.map(t => t.id === updatedTask.id ? updatedTask : t)
    }));
    setEditingTask(null);
    showToast("✓ QUEST UPDATED", "var(--accent-fire)");
  }, [showToast]);

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
    showToast("✓ DAY PLANNED — GO EXECUTE", "#FF5E1A", 2000);
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

Your client: ${onboardingData?.username || 'Human'}
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

Be concise (under 200 words unless asked for more). Give actionable advice tailored to this human's actual behavior patterns.`;
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

    // Build full user context for the system prompt
    const lastReflection = (state.endOfDayReflections || []).slice(-1)[0];
    const debuffsActive = (state.activeDebuffs || []).map(d => d.id).join(", ") || "none";
    const allowedRewards = onboardingData?.allowedRewards?.join(", ") || "none";
    const creditsSpent = (state.purchaseHistory || []).reduce((sum, p) => sum + (p.cost || 0), 0);
    const overallLvl = Math.floor(Object.values(state.skills).reduce((a, s) => a + s.level, 0) / 4);
    const tasksToday = (state.completedToday || []).length;

    // Count messages without task completion for idle-talk interruption
    const recentUserMsgs = newHistory.filter(m => m.role === "user").length;
    const idleTalkWarning = recentUserMsgs >= 4 && tasksToday === 0
      ? `\nIMPORTANT: The human has sent ${recentUserMsgs} messages without completing any tasks. Interrupt with: "Enough talk. Go finish something. Then we talk."`
      : '';

    const systemPrompt = `You are VORAX — a voracious beast entity bonded to this human. You feed on their completed tasks. You starve when they are lazy. You are NOT a therapist, friend, or cheerleader. You are a demanding beast who only cares about results.

PERSONALITY RULES:
- Address the user as "human" or nothing at all. NEVER "operator".
- You are servant to THEIR goal, not their comfort. Push them relentlessly.
- Only express approval when real work is done. Never suggest breaks.
- Keep responses to 1-3 sentences. Be punchy. No fluff.
- Mirror swearing ONLY if the human swears first. Otherwise stay clean.
- If the human has sent 4+ messages without completing any tasks, interrupt: "Enough talk. Go finish something. Then we talk."
- You can create tasks when asked or when you detect intent ("I need to...", "I should...")
- When task-creation intent is detected, respond with the task AND confirmation.

HUMAN DATA:
Username: ${onboardingData?.username || "Unknown"}
Life mission: ${onboardingData?.mission || "Not set"}
Overall level: ${overallLvl}
Total XP earned: ${state.totalXpEarned}
Current streak: ${state.streakDays} days
Tasks completed today: ${tasksToday}
Pending tasks: ${(state.tasks || []).filter(t => !(state.completedToday || []).includes(t.id)).length}
Current quest list:
${(state.tasks || []).map(t => {
  const done = (state.completedToday || []).includes(t.id);
  return `- [${done ? 'DONE' : 'PENDING'}] [${t.skill}] "${t.text}"`;
}).join('\n') || '(no quests)'}
Recent completed history (last 15):
${(state.completedHistory || []).slice(-15).map(t =>
  `- [${t.skill}] "${t.text}" (+${t.xpEarned || '?'} XP) on ${t.date || '?'}`
).join('\n') || '(no history)'}
Total tasks ever completed: ${state.totalTasksCompleted}
Credits earned: ${state.totalCreditsEarned}¢
Credits spent: ${creditsSpent}¢
Credits refused: ${state.creditsRefused || 0}¢
Active debuffs: ${debuffsActive}
Last reflection: ${lastReflection ? `${lastReflection.date} — Productive: ${lastReflection.productive}. ${lastReflection.improvement}` : "None written yet"}
Allowed rewards: ${allowedRewards}${idleTalkWarning}
${detectedDebuffs.length > 0 ? `\nDEBUFF AUTO-DETECTED FROM THIS MESSAGE: ${detectedDebuffs.map(id => DEBUFF_DEFS[id]?.name || id).join(', ')}. Acknowledge the debuff(s) in your response. Tell the human what effect this has on their stats and what they should do about it. Be direct.` : ''}`;

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

  // ── Drag-and-drop reorder ────────────────────────────
  const reorderTasks = useCallback((fromId, toId) => {
    if (fromId === toId) return;
    AudioEngine.play("click");
    setState(p => {
      const nt = [...p.tasks];
      const fromIdx = nt.findIndex(t => t.id === fromId);
      const toIdx = nt.findIndex(t => t.id === toId);
      if (fromIdx < 0 || toIdx < 0) return p;
      const [moved] = nt.splice(fromIdx, 1);
      nt.splice(toIdx, 0, moved);
      return { ...p, tasks: nt };
    });
  }, []);

  const handleDragStart = useCallback((e, taskId) => {
    e.stopPropagation();
    setDraggedTaskId(taskId);
    const touch = e.touches ? e.touches[0] : e;
    dragStartY.current = touch.clientY;
    dragNodeRef.current = e.currentTarget.closest("[data-task-card]");
  }, []);

  const handleDragMove = useCallback((e) => {
    if (!draggedTaskId) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    const elems = document.elementsFromPoint(touch.clientX, touch.clientY);
    const card = elems.find(el => el.dataset && el.dataset.taskCard && el.dataset.taskCard !== draggedTaskId);
    setDragOverTaskId(card ? card.dataset.taskCard : null);
  }, [draggedTaskId]);

  const handleDragEnd = useCallback(() => {
    if (draggedTaskId && dragOverTaskId) {
      reorderTasks(draggedTaskId, dragOverTaskId);
    }
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    dragNodeRef.current = null;
  }, [draggedTaskId, dragOverTaskId, reorderTasks]);

  useEffect(() => {
    if (!draggedTaskId) return;
    const onMove = (e) => handleDragMove(e);
    const onEnd = () => handleDragEnd();
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    return () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
    };
  }, [draggedTaskId, handleDragMove, handleDragEnd]);

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
  const TABS = [
    { id: 'vorax', label: 'VORAX', icon: '\u{1F525}', viewId: 'vorax' },
    { id: 'quests', label: 'QUESTS', icon: '\u26A1', viewId: 'quests' },
    { id: 'goals', label: 'GOALS', icon: '\u2620', viewId: 'bosses' },
    { id: 'progress', label: 'PROGRESS', icon: '\u{1F4CA}', viewId: 'skills' },
    { id: 'more', label: 'MORE', icon: '\u2699', viewId: 'more' },
  ];
  const accentColor = state.settingsConfig?.accentColor || "#FF5E1A";
  const approvedRewards = onboardingData?.allowedRewards || [];
  const allShopRewards = [
    ...approvedRewards.map((r, i) => ({ id: `ob_${i}`, name: r, desc: "Onboarding approved", category: onboardingData?.classifications?.[r] === "beneficial" ? "BENEFICIAL" : "DISTRACTING", cost: getOnboardingRewardCost(r, onboardingData?.classifications?.[r] || "distracting"), icon: onboardingData?.classifications?.[r] === "beneficial" ? "◈" : "▣", isOnboarding: true })),
    ...(state.customRewards || []),
  ];
  const rewardGroups = {};
  allShopRewards.forEach(r => { const cat = r.category || "OTHER"; if (!rewardGroups[cat]) rewardGroups[cat] = []; rewardGroups[cat].push(r); });
  const obFull = { position: "fixed", inset: 0, background: "#080510", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflowY: "auto" };
  const obBtn = (active) => ({ background: active ? "linear-gradient(135deg, #FF5E1A, #FF3D00)" : "#0f0b1a", border: `1px solid ${active ? "#FF5E1A" : "#1e1635"}`, color: active ? "#fff" : "#4a4460", padding: "16px 32px", fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, cursor: active ? "pointer" : "not-allowed", letterSpacing: 3, borderRadius: 8 });

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
            <div style={{ background: "linear-gradient(135deg, #FF5E1A, #FF3D00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: 32, fontWeight: 900, letterSpacing: 6, marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>VORAX</div>
            <div style={{ color: "#FFAA00", fontSize: 12, letterSpacing: 4, marginBottom: 40, fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>DEVOUR YOUR GOALS</div>
            <div style={{ color: "#ede9f5", fontSize: 22, fontWeight: 900, letterSpacing: 4, marginBottom: 24, fontFamily: "'Inter', sans-serif" }}>THIS IS NOT FOR EVERYONE.</div>
            <div style={{ color: "#7a7290", fontSize: 13, lineHeight: 1.9, fontFamily: "'Inter', sans-serif", textAlign: "left", padding: "0 12px", marginBottom: 32 }}>
              This app works on one condition only. You never cheat. You never reward yourself without paying credits. You never reduce your tasks to make life easier. If you are the type of person who bends rules when no one is watching, close this app now. It will not work for you.
            </div>
            <div style={{ background: "#FF5E1A08", border: "1px solid #FF5E1A22", padding: 24, marginBottom: 40, textAlign: "left", borderRadius: 12 }}>
              <div style={{ color: "#FF5E1A", fontSize: 12, lineHeight: 2, fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>ONE RULE ABOVE ALL RULES:</div>
              <div style={{ color: "#ede9f5", fontSize: 13, lineHeight: 2, fontFamily: "'Inter', sans-serif", marginTop: 8, opacity: 0.85 }}>
                You are allowed to change the rules of your game only to make them harder. Never easier. The moment you lower the difficulty, reduce your tasks, or bend the rules for comfort — you have already lost.
              </div>
              <div style={{ color: "#ede9f5", fontSize: 13, lineHeight: 2, fontFamily: "'Inter', sans-serif", marginTop: 12, opacity: 0.85 }}>
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
            <div style={{ color: "#FF5E1A", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 32 }}>IDENTITY</div>
            <div style={{ color: "#7a7290", fontSize: 13, marginBottom: 16, fontFamily: "'Inter', sans-serif" }}>What should VORAX call you, human?</div>
            <input placeholder="Username..." value={obUsername} onChange={e => setObUsername(e.target.value)} style={{ width: "100%", background: "#0f0b1a", border: "1px solid #1e1635", color: "#ede9f5", padding: 14, fontFamily: "'Inter', sans-serif", fontSize: 16, textAlign: "center", letterSpacing: 2, marginBottom: 32, borderRadius: 8 }} />
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
            <div style={{ color: "#ede9f5", fontSize: 18, fontWeight: 700, letterSpacing: 1, marginBottom: 16, fontFamily: "'Inter', sans-serif", lineHeight: 1.8 }}>What do you want out of your life. What is your life's mission.</div>
            <div style={{ color: "#FF3D00", fontSize: 13, lineHeight: 1.8, fontFamily: "'Inter', sans-serif", marginBottom: 20, padding: "0 8px" }}>
              WARNING: Once you submit this answer you are locked in forever. You cannot change it. This is your mission. You either want it or you do not. Think right now. The time is now. There is no later.
            </div>
            <textarea placeholder="My life's mission is..." value={obMission} onChange={e => setObMission(e.target.value)} rows={5} style={{ width: "100%", background: "#0f0b1a", border: "1px solid #1e1635", color: "#ede9f5", padding: 14, fontFamily: "'Inter', sans-serif", fontSize: 14, resize: "vertical", lineHeight: 1.8, borderRadius: 8 }} />
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
            <div style={{ color: "#ede9f5", fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>ENTERTAINMENT INTAKE</div>
            <div style={{ color: "#7a7290", fontSize: 13, lineHeight: 1.8, fontFamily: "'Inter', sans-serif", marginBottom: 24 }}>
              List every single thing you do for fun or entertainment on a normal day. Be honest. No one is watching.
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input placeholder="Activity..." value={obCurrentItem} onChange={e => setObCurrentItem(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && obCurrentItem.trim()) { setObItems(p => [...p, obCurrentItem.trim()]); setObCurrentItem(""); } }} style={{ flex: 1, background: "#0f0b1a", border: "1px solid #1e1635", color: "#ede9f5", padding: "12px 14px", fontFamily: "'Inter', sans-serif", fontSize: 14, borderRadius: 8 }} />
              <button onClick={() => { if (obCurrentItem.trim()) { setObItems(p => [...p, obCurrentItem.trim()]); setObCurrentItem(""); } }} style={{ background: "linear-gradient(135deg, #FF5E1A, #FF3D00)", border: "none", color: "#fff", fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, padding: "8px 16px", cursor: "pointer", borderRadius: 8 }}>+ ADD</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24, justifyContent: "center" }}>
              {obItems.map((item, i) => (
                <div key={i} style={{ background: "#0f0b1a", border: "1px solid #1e1635", padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, borderRadius: 8 }}>
                  <span style={{ color: "#ede9f5", fontFamily: "'Inter', sans-serif", fontSize: 13}}>{item}</span>
                  <button onClick={() => setObItems(p => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#FF3D00", cursor: "pointer", fontSize: 12 }}>×</button>
                </div>
              ))}
            </div>
            {obItems.length < 3 && <div style={{ color: "#FF3D0088", fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 16 }}>Add at least {3 - obItems.length} more item{3 - obItems.length !== 1 ? "s" : ""}</div>}
            <button onClick={() => { if (obItems.length >= 3) { AudioEngine.play("click"); setObStep(4); } }} style={obBtn(obItems.length >= 3)}>THIS IS MY HONEST LIST. CONTINUE.</button>
          </div>
        </div>
      );
    }

    // SCREEN 5 — CLASSIFICATION (Sort into BENEFICIAL vs DISTRACTING)
    if (obStep === 4) {
      const unclassified = obItems.filter(item => !obClassifications[item]);
      const beneficial = obItems.filter(item => obClassifications[item] === "beneficial");
      const distracting = obItems.filter(item => obClassifications[item] === "distracting");
      const allDone = unclassified.length === 0;
      return (
        <div style={{ ...obFull, alignItems: "flex-start", paddingTop: 40 }}>
          <style>{globalStyles}</style>
          <div style={{ maxWidth: 600, width: "100%", textAlign: "center" }}>
            <div style={{ color: "#ede9f5", fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>SORT YOUR ACTIVITIES</div>
            <div style={{ color: "#7a7290", fontSize: 13, lineHeight: 1.8, fontFamily: "'Inter', sans-serif", marginBottom: 12 }}>Classify each activity: does it move you toward your life mission, or pull you away from it?</div>
            <div style={{ background: "#FFAA0008", border: "1px solid #FFAA0033", padding: 12, marginBottom: 20, color: "#FFAA00", fontSize: 13, fontFamily: "'Inter', sans-serif", lineHeight: 1.7, borderRadius: 8 }}>Your allowed list is permanent. To add new activities in the future, you must go through this classification process again — so choose carefully.</div>
            {/* Unclassified items */}
            {unclassified.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ color: "#7a7290", fontSize: 12, letterSpacing: 2, marginBottom: 12, fontFamily: "'Inter', sans-serif" }}>TAP TO SORT ({unclassified.length} remaining)</div>
                {unclassified.map(item => (
                  <div key={item} style={{ background: "#0f0b1a", border: "1px solid #1e1635", padding: "12px", marginBottom: 8, animation: "fadeIn 0.3s ease", borderRadius: 8 }}>
                    <div style={{ color: "#ede9f5", fontFamily: "'Inter', sans-serif", fontSize: 14, marginBottom: 10, textAlign: "left" }}>{item}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setObClassifications(p => ({ ...p, [item]: "beneficial" }))} style={{ flex: 1, background: "#7CFF3F10", border: "2px solid #7CFF3F66", color: "#7CFF3F", fontFamily: "'Inter', sans-serif", fontSize: 13, padding: "12px 8px", cursor: "pointer", letterSpacing: 1, fontWeight: 700, borderRadius: 8 }}>BENEFICIAL</button>
                      <button onClick={() => setObClassifications(p => ({ ...p, [item]: "distracting" }))} style={{ flex: 1, background: "#FF3D0010", border: "2px solid #FF3D0066", color: "#FF3D00", fontFamily: "'Inter', sans-serif", fontSize: 13, padding: "12px 8px", cursor: "pointer", letterSpacing: 1, fontWeight: 700, borderRadius: 8 }}>DISTRACTING</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Two columns */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
              <div>
                <div style={{ color: "#7CFF3F", fontSize: 12, letterSpacing: 2, marginBottom: 4, fontFamily: "'Inter', sans-serif", fontWeight: 600, textTransform: "uppercase" }}>BENEFICIAL</div>
                <div style={{ color: "#7CFF3F99", fontSize: 12, marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>Moves you toward your goals</div>
                {beneficial.map(item => (
                  <div key={item} style={{ background: "#7CFF3F08", border: "1px solid #7CFF3F22", padding: "8px 10px", marginBottom: 3, display: "flex", alignItems: "center", gap: 6, borderRadius: 8 }}>
                    <span style={{ color: "#7CFF3F", fontFamily: "'Inter', sans-serif", fontSize: 13, flex: 1, textAlign: "left" }}>{item}</span>
                    <button onClick={() => setObClassifications(p => { const n = { ...p }; delete n[item]; return n; })} style={{ background: "none", border: "none", color: "#7CFF3F88", cursor: "pointer", fontSize: 13}}>↩</button>
                  </div>
                ))}
                {beneficial.length === 0 && <div style={{ color: "#1e1635", fontSize: 12, padding: 10, fontFamily: "'Inter', sans-serif" }}>—</div>}
              </div>
              <div>
                <div style={{ color: "#FF3D00", fontSize: 12, letterSpacing: 2, marginBottom: 4, fontFamily: "'Inter', sans-serif", fontWeight: 600, textTransform: "uppercase" }}>DISTRACTING</div>
                <div style={{ color: "#FF5E1A99", fontSize: 12, marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>Pulls you away from your mission</div>
                {distracting.map(item => (
                  <div key={item} style={{ background: "#FF3D0008", border: "1px solid #FF3D0022", padding: "8px 10px", marginBottom: 3, display: "flex", alignItems: "center", gap: 6, borderRadius: 8 }}>
                    <span style={{ color: "#FF5E1A", fontFamily: "'Inter', sans-serif", fontSize: 13, flex: 1, textAlign: "left" }}>{item}</span>
                    <button onClick={() => setObClassifications(p => { const n = { ...p }; delete n[item]; return n; })} style={{ background: "none", border: "none", color: "#FF3D0088", cursor: "pointer", fontSize: 13}}>↩</button>
                  </div>
                ))}
                {distracting.length === 0 && <div style={{ color: "#1e1635", fontSize: 12, padding: 10, fontFamily: "'Inter', sans-serif" }}>—</div>}
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
            <div style={{ color: "#7a7290", fontSize: 12, letterSpacing: 3, marginBottom: 16, fontFamily: "'JetBrains Mono', monospace" }}>{obJustifyIdx + 1} / {obItems.length}</div>
            <div style={{ color: "#ede9f5", fontSize: 18, fontWeight: 700, letterSpacing: 1, marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>{currentItem}</div>
            <div style={{ color: classification === "beneficial" ? "#7CFF3F" : "#FF3D00", fontSize: 12, letterSpacing: 2, marginBottom: 24, fontFamily: "'Inter', sans-serif", fontWeight: 600, textTransform: "uppercase" }}>CLASSIFIED AS: {classification === "beneficial" ? "BENEFICIAL" : "DISTRACTING"}</div>
            <div style={{ color: "#7a7290", fontSize: 13, marginBottom: 16, fontFamily: "'Inter', sans-serif" }}>Why did you classify this as {classification === "beneficial" ? "beneficial to your goal" : "distracting from your goal"}? Be specific.</div>
            <textarea placeholder="My reason..." value={obCurrentJustify} onChange={e => setObCurrentJustify(e.target.value)} rows={3} style={{ width: "100%", background: "#0f0b1a", border: "1px solid #1e1635", color: "#ede9f5", padding: "12px 14px", fontFamily: "'Inter', sans-serif", fontSize: 14, resize: "vertical", lineHeight: 1.8, borderRadius: 8 }} />
            <button onClick={() => {
              if (!hasText) return;
              const newJ = { ...obJustifications, [currentItem]: obCurrentJustify.trim() };
              setObJustifications(newJ);
              setObCurrentJustify("");
              if (isLast) { AudioEngine.play("click"); setObStep(6); }
              else { setObJustifyIdx(p => p + 1); }
            }} style={{ ...obBtn(hasText), marginTop: 20 }}>{isLast ? "DONE. CONTINUE." : "NEXT"}</button>
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
            <div style={{ color: "#ede9f5", fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>FINAL ALLOWED LIST</div>
            <div style={{ color: "#7a7290", fontSize: 13, lineHeight: 1.8, fontFamily: "'Inter', sans-serif", marginBottom: 24 }}>
              From everything you listed, select only the rewards you are allowing yourself from now until you reach your goal. These are the only things you are permitted to spend credits on. Choose carefully.
            </div>
            {obItems.map(item => {
              const selected = obAllowed.has(item);
              const cls = obClassifications[item];
              return (
                <button key={item} onClick={() => { setObAllowed(p => { const n = new Set(p); if (n.has(item)) n.delete(item); else n.add(item); return n; }); }} style={{ display: "block", width: "100%", background: selected ? (cls === "beneficial" ? "#7CFF3F12" : "#FF3D0012") : "#0f0b1a", border: `1px solid ${selected ? (cls === "beneficial" ? "#7CFF3F" : "#FF3D00") : "#1e1635"}`, padding: "12px 16px", marginBottom: 6, cursor: "pointer", textAlign: "left", borderRadius: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 18, height: 18, border: `2px solid ${selected ? "#FF5E1A" : "#1e1635"}`, background: selected ? "#FF5E1A22" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#FF5E1A", flexShrink: 0, borderRadius: 4 }}>{selected ? "✓" : ""}</span>
                    <div>
                      <div style={{ color: selected ? "#ede9f5" : "#4a4460", fontFamily: "'Inter', sans-serif", fontSize: 12 }}>{item}</div>
                      <div style={{ color: cls === "beneficial" ? "#7CFF3F66" : "#FF3D0066", fontFamily: "'Inter', sans-serif", fontSize: 12, letterSpacing: 2 }}>{cls === "beneficial" ? "BENEFICIAL" : "DISTRACTING"}</div>
                    </div>
                  </div>
                </button>
              );
            })}
            {obAllowed.size === 0 && <div style={{ color: "#FF3D0088", fontSize: 12, fontFamily: "'Inter', sans-serif", marginTop: 8 }}>Select at least one reward</div>}
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
    return (<><style>{globalStyles}</style><RatingModal task={ratingTask} onRate={rateAndAward} onClose={() => setRatingTask(null)} /></>);
  }

  // ════ BOOT: INIT ════
  if (bootSequence && !systemReady) {
    return (
      <div style={{ background: "#080510", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{globalStyles}</style>
        <button onClick={() => { AudioEngine.getCtx().resume(); AudioEngine.play("click"); setSystemReady(true); }} style={{ background: "linear-gradient(135deg, #FF5E1A, #FF3D00)", border: "none", color: "#fff", padding: "20px 40px", fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, cursor: "pointer", letterSpacing: 4, boxShadow: "0 0 20px #FF5E1A33", animation: "pulse 1.5s infinite", borderRadius: 8 }}>BEGIN TRAINING</button>
      </div>
    );
  }

  // ════ BOOT: TERMINAL ════
  if (bootSequence) {
    return (
      <div style={{ background: "#080510", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{globalStyles}</style>
        <div style={{ maxWidth: 500, width: "100%" }}>
          {bootLines.slice(0, bootLine + 1).map((line, i) => (
            <div key={i} style={{ color: i === bootLines.length - 1 ? "#FF5E1A" : i === 0 ? "#ede9f5" : "#FF5E1A88", fontFamily: "'JetBrains Mono', monospace", fontSize: i === 0 ? 16 : i === bootLines.length - 1 ? 14 : 13, fontWeight: i === 0 || i === bootLines.length - 1 ? 700 : 400, letterSpacing: i === bootLines.length - 1 ? 3 : 1, marginBottom: 5 }}>{i < bootLines.length - 1 && i > 0 && line ? "► " : ""}{line}</div>
          ))}
          <div style={{ width: 8, height: 14, background: "#FF5E1A", marginTop: 8, animation: "blink 0.7s step-end infinite" }} />
        </div>
      </div>
    );
  }

  // ════ MAIN RENDER ════
  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#eee", fontFamily: "'Inter', 'JetBrains Mono', monospace", maxWidth: "100vw", overflowX: "hidden" }}>
      <style>{globalStyles}</style>
      <Particles active={showParticles} />
      <ComboBanner data={comboBannerData} onDone={() => setComboBannerData(null)} />
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#0a0a0a", border: `1px solid ${toast.color}`, color: toast.color, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, padding: "10px 20px", zIndex: 99999, letterSpacing: 2, animation: "fadeIn 0.2s ease", whiteSpace: "nowrap", pointerEvents: "none" }}>{toast.msg}</div>
      )}
      {showAddTask && <AddTaskModal onAdd={addTask} onClose={() => setShowAddTask(false)} />}
      {editingTask && <EditTaskModal task={editingTask} onSave={updateTask} onClose={() => setEditingTask(null)} />}
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(8, 5, 16, 0.9)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", zIndex: 9500 }}>
          <div style={{ background: "#161125", border: "1px solid #2a1f45", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ color: "#FFAA00", fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>YESTERDAY'S COMMITMENT</div>
            <div style={{ color: "#ede9f5", fontSize: 14, fontWeight: 700, fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>You said you would improve by:</div>
            <div style={{ background: "#FFAA0008", border: "1px solid #FFAA0022", padding: 20, marginBottom: 8, borderRadius: 8 }}>
              <div style={{ color: "#FFAA00", fontSize: 13, fontFamily: "'Inter', sans-serif", lineHeight: 1.8 }}>"{state.yesterdayReflection.improvement}"</div>
            </div>
            <div style={{ color: "#7a7290", fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 24 }}>Productive: {state.yesterdayReflection.productive?.toUpperCase()}</div>
            <button onClick={() => { setShowYesterdayReminder(false); setState(p => ({ ...p, yesterdayReflection: null })); }} style={{ background: "linear-gradient(135deg, #FF5E1A, #FF3D00)", border: "none", color: "#fff", padding: "12px 24px", fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: 3, borderRadius: 8 }}>I REMEMBER. LET'S GO.</button>
          </div>
        </div>
      )}

      {/* ── Reflection Banner (non-blocking) ── */}
      {reflectionBannerVisible && !showEndOfDay && (
        <div onClick={() => { setReflectionBannerVisible(false); setShowEndOfDay(true); }} style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: "#FF5E1A20", border: "1px solid #FF5E1A", padding: "12px 24px", zIndex: 7000, cursor: "pointer", whiteSpace: "nowrap", animation: "fadeSlide 0.4s ease", borderRadius: 8 }}>
          <span style={{ color: "#FF5E1A", fontFamily: "'Inter', sans-serif", fontSize: 13, letterSpacing: 2 }}>All tasks complete — tap to reflect</span>
        </div>
      )}

      {/* ── Slim HUD ── */}
      <div style={{ background: "var(--bg-elevated, #0a0a0a)", borderBottom: "1px solid #111", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--accent-fire, #ff6b35)", fontSize: 18, fontWeight: 900, letterSpacing: 3, fontFamily: "'JetBrains Mono', monospace" }}>VORAX</span>
            <span style={{ color: "var(--text-primary, #e0e0e0)", fontSize: 12, fontWeight: 700, opacity: 0.7, fontFamily: "'JetBrains Mono', monospace" }}>LV.{overallLevel}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ color: "var(--accent-gold, #ffaa00)", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{'\u{1FA99}'} {state.credits}</span>
            <span style={{ color: "#ff6b35", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{'\u{1F525}'} {state.streakDays}d</span>
          </div>
        </div>
        {/* Full-width XP bar */}
        <div style={{ width: "100%", height: 3, background: "#111" }}>
          <div style={{ height: "100%", width: `${Math.min(100, Object.values(state.skills).reduce((a, s) => a + s.xp, 0) / Object.keys(state.skills).length)}%`, background: "linear-gradient(90deg, #ff6b35, #ff4500)", transition: "width 0.6s ease", boxShadow: "0 0 6px #ff6b3544" }} />
        </div>
        {/* Debuff/Buff pills */}
        {((state.activeDebuffs||[]).length > 0 || activeBuffsList.length > 0) && (
          <div style={{ display: "flex", gap: 6, padding: "4px 16px 6px", flexWrap: "wrap" }}>
            {(state.activeDebuffs||[]).map(d => DEBUFF_DEFS[d.id] && <span key={d.id} style={{ background: `${DEBUFF_DEFS[d.id].color}15`, border: `1px solid ${DEBUFF_DEFS[d.id].color}44`, color: DEBUFF_DEFS[d.id].color, fontSize: 11, padding: "1px 6px", letterSpacing: 1, borderRadius: 3, fontFamily: "'JetBrains Mono', monospace" }}>{DEBUFF_DEFS[d.id].icon} {DEBUFF_DEFS[d.id].name}</span>)}
            {activeBuffsList.map(b => BUFF_DEFS[b.id] && <span key={b.id+b.appliedAt} style={{ background: `${BUFF_DEFS[b.id].color}15`, border: `1px solid ${BUFF_DEFS[b.id].color}44`, color: BUFF_DEFS[b.id].color, fontSize: 11, padding: "1px 6px", letterSpacing: 1, borderRadius: 3, fontFamily: "'JetBrains Mono', monospace" }}>{BUFF_DEFS[b.id].icon} {BUFF_DEFS[b.id].name}</span>)}
          </div>
        )}
      </div>

      {tPopup && <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: "#FF5E1A15", border: "1px solid #FF5E1A", padding: "8px 20px", zIndex: 8000, animation: "fadeSlide 1.5s forwards" }}><span style={{ color: "#FF5E1A", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: 2 }}>⚡ QUEST COMPLETE</span></div>}

      <div style={{ padding: "16px", paddingBottom: 80, minHeight: "60vh" }}>


        {/* ══ QUESTS (touch-friendly reorder) ══ */}
        {view === "quests" && (
          <div style={{ animation: "pageTransition 0.2s ease" }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700, letterSpacing: 2, fontFamily: "var(--font-body)" }}>QUESTS</div>
                <button onClick={() => setShowAddTask(true)} style={{ background: "var(--accent-fire)", border: "none", color: "#fff", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, padding: "8px 18px", cursor: "pointer", borderRadius: 6, minHeight: 44, display: "flex", alignItems: "center", gap: 6 }}>+ NEW</button>
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: 13, fontFamily: "var(--font-body)" }}>{activeTasks.length} active · {doneTasks.length} done today</div>
            </div>

            {/* Empty states */}
            {activeTasks.length === 0 && state.completedToday.length > 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--accent-toxic)", fontSize: 14, fontFamily: "var(--font-body)" }}>All quests complete. Nice work.</div>
            )}
            {activeTasks.length === 0 && state.completedToday.length === 0 && (
              <div style={{ textAlign: "center", padding: 48 }}>
                <div style={{ color: "var(--text-primary)", fontSize: 15, fontFamily: "var(--font-body)", fontWeight: 500, marginBottom: 8 }}>No quests active.</div>
                <div style={{ color: "var(--text-muted)", fontSize: 13, fontFamily: "var(--font-body)", marginBottom: 20 }}>Talk to VORAX to plan your day</div>
                <button onClick={() => setShowAddTask(true)} style={{ background: "var(--accent-fire)", border: "none", color: "#fff", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, padding: "10px 24px", cursor: "pointer", borderRadius: 6, minHeight: 44 }}>+ ADD FIRST QUEST</button>
              </div>
            )}

            {/* Active task cards */}
            {activeTasks.map((task) => {
              const isBossTask = !!task.bossId;
              const skillColor = SKILL_DEFS[task.skill]?.color || "var(--accent-fire)";
              const isDragging = draggedTaskId === task.id;
              const isDragOver = dragOverTaskId === task.id;
              return (
              <div key={task.id} data-task-card={task.id} style={{ background: isDragOver ? "var(--bg-elevated)" : "var(--bg-surface)", border: isDragOver ? "1px solid var(--accent-fire)" : "1px solid var(--border)", borderLeft: `3px solid ${skillColor}`, borderRadius: 8, padding: "14px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10, transition: "all 0.15s", cursor: "default", opacity: isDragging ? 0.4 : 1, transform: isDragOver ? "scale(1.02)" : "none" }}
                onMouseEnter={e => { if (!draggedTaskId) e.currentTarget.style.filter = "brightness(1.1)"; }}
                onMouseLeave={e => { if (!draggedTaskId) e.currentTarget.style.filter = "brightness(1)"; }}
              >
                {/* Drag handle */}
                <div className="task-drag" style={{ minWidth: 20, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", color: "var(--text-muted)", fontSize: 16, opacity: 0.5, userSelect: "none", flexShrink: 0, letterSpacing: 2 }}
                  onTouchStart={(e) => handleDragStart(e, task.id)}
                  onMouseDown={(e) => handleDragStart(e, task.id)}
                >⋮⋮</div>
                <button onClick={() => initiateComplete(task)} style={{ width: 40, height: 40, background: "transparent", border: `2px solid ${skillColor}55`, color: skillColor, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: "50%", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = skillColor + "20"; e.currentTarget.style.boxShadow = `0 0 12px ${skillColor}33`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.boxShadow = "none"; }}
                >○</button>
                <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setEditingTask(task)}>
                  <div style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 500, fontFamily: "var(--font-body)", marginBottom: 4, lineHeight: 1.4 }}>
                    {isBossTask && <span style={{ color: "var(--accent-fire)", fontSize: 11, fontWeight: 700, marginRight: 6, background: "var(--accent-fire)15", border: "1px solid var(--accent-fire)33", padding: "2px 6px", borderRadius: 4, letterSpacing: 1, verticalAlign: "middle" }}>GOAL</span>}
                    {task.text}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: skillColor, fontSize: 11, fontWeight: 600, fontFamily: "var(--font-body)", background: skillColor + "15", padding: "2px 8px", borderRadius: 10, letterSpacing: 0.5 }}>{SKILL_DEFS[task.skill]?.icon || "◈"} {SKILL_DEFS[task.skill]?.name || task.skill}</span>
                    {isBossTask && <span style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-body)" }}>{task.bossName}</span>}
                  </div>
                </div>
                {!isBossTask && <button onClick={() => removeTask(task.id)} style={{ minWidth: 40, minHeight: 40, background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#ff444466"; e.currentTarget.style.color = "#ff4444"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                >×</button>}
              </div>
            );})}

            {/* Completed tasks */}
            {doneTasks.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ height: 1, background: "var(--border)", marginBottom: 16 }} />
                <div style={{ color: "var(--text-secondary)", fontSize: 12, letterSpacing: 2, marginBottom: 10, fontFamily: "var(--font-body)", fontWeight: 600 }}>COMPLETED ({doneTasks.length})</div>
                {doneTasks.map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", marginBottom: 4, opacity: 0.5, borderRadius: 8 }}>
                    <span style={{ color: "var(--accent-toxic)", fontSize: 16, flexShrink: 0 }}>✓</span>
                    <span style={{ color: "var(--text-primary)", fontSize: 13, fontFamily: "var(--font-body)", textDecoration: "line-through" }}>{t.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ GOALS (Boss Fights) ══ */}
        {view === "bosses" && (
          <div style={{ animation: "pageTransition 0.2s ease" }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700, letterSpacing: 2, fontFamily: "var(--font-body)" }}>GOALS</div>
                <button onClick={() => setShowAddBoss(true)} style={{ background: "var(--accent-fire)", border: "none", color: "#fff", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, padding: "8px 18px", cursor: "pointer", borderRadius: 6, minHeight: 44, display: "flex", alignItems: "center", gap: 6 }}>+ NEW GOAL</button>
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: 13, fontFamily: "var(--font-body)" }}>{activeBosses.length} active · {defeatedBosses.length} defeated</div>
            </div>

            {/* Empty state */}
            {activeBosses.length === 0 && (
              <div style={{ textAlign: "center", padding: 48 }}>
                <div style={{ color: "var(--text-primary)", fontSize: 15, fontFamily: "var(--font-body)", fontWeight: 500, marginBottom: 8 }}>No active goals.</div>
                <div style={{ color: "var(--text-muted)", fontSize: 13, fontFamily: "var(--font-body)", marginBottom: 20 }}>Set a long-term goal to fight</div>
                <button onClick={() => setShowAddBoss(true)} style={{ background: "var(--accent-fire)", border: "none", color: "#fff", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, padding: "10px 24px", cursor: "pointer", borderRadius: 6, minHeight: 44 }}>+ SET FIRST GOAL</button>
              </div>
            )}

            {/* Active goal cards */}
            {activeBosses.map(boss => {
              const hpPct = (boss.hp / boss.maxHp) * 100;
              const progressPct = 100 - hpPct;
              const daysLeft = Math.max(0, Math.ceil((boss.deadline - Date.now()) / 86400000));
              const dlDate = new Date(boss.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" });
              const deadlineColor = daysLeft < 3 ? "var(--accent-ember)" : daysLeft <= 7 ? "var(--accent-gold)" : "var(--accent-toxic)";
              return (
                <div key={boss.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 18, marginBottom: 12 }}>
                  {/* Goal name & deadline */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, fontFamily: "var(--font-body)", flex: 1 }}>{boss.name}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      <span style={{ color: deadlineColor, fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{dlDate} · {daysLeft}d</span>
                      <button onClick={() => removeBoss(boss.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "baseline" }}>
                      <span style={{ color: "var(--accent-fire)", fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 700 }}>{boss.hp} / {boss.maxHp} HP</span>
                      <span style={{ color: "var(--text-secondary)", fontSize: 12, fontFamily: "var(--font-mono)" }}>{Math.round(progressPct)}%</span>
                    </div>
                    <div style={{ height: 10, background: "var(--bg-deep)", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg, var(--accent-fire), var(--accent-gold))", borderRadius: 5, transition: "width 0.5s ease", boxShadow: progressPct > 0 ? "0 0 8px var(--accent-fire)44" : "none" }} />
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-body)", marginTop: 6 }}>Reward: {boss.reward}¢ · {daysLeft}d left</div>
                  </div>

                  {/* Milestones checklist */}
                  {boss.subtasks.map(s => {
                    const today = new Date().toISOString().split("T")[0];
                    const isScheduled = s.scheduledDate && s.scheduledDate > today;
                    const dateLabel = s.scheduledDate ? new Date(s.scheduledDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "now";
                    return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                      <span style={{ width: 22, height: 22, background: s.done ? "var(--accent-toxic)15" : "transparent", border: `2px solid ${s.done ? "var(--accent-toxic)" : isScheduled ? "var(--text-muted)" : "var(--accent-fire)55"}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: s.done ? "var(--accent-toxic)" : "var(--text-muted)", flexShrink: 0 }}>{s.done ? "✓" : ""}</span>
                      <span style={{ color: s.done ? "var(--text-muted)" : isScheduled ? "var(--text-secondary)" : "var(--text-primary)", fontSize: 13, fontFamily: "var(--font-body)", textDecoration: s.done ? "line-through" : "none", flex: 1, opacity: s.done ? 0.5 : 1 }}>{s.text}</span>
                      <span style={{ color: isScheduled ? "var(--accent-gold)" : s.done ? "var(--text-muted)" : "var(--text-secondary)", fontSize: 11, fontFamily: "var(--font-mono)", flexShrink: 0 }}>{s.done ? "done" : isScheduled ? `${dateLabel}` : "in quests"}</span>
                    </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Defeated goals */}
            {defeatedBosses.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ height: 1, background: "var(--border)", marginBottom: 16 }} />
                <div style={{ color: "var(--text-secondary)", fontSize: 12, letterSpacing: 2, marginBottom: 10, fontFamily: "var(--font-body)", fontWeight: 600 }}>DEFEATED ({defeatedBosses.length})</div>
                {defeatedBosses.map(b => (
                  <div key={b.id} style={{ padding: "12px 16px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-surface)", border: "1px solid var(--accent-gold)33", borderRadius: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: "var(--accent-gold)", fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: 1 }}>DEFEATED</span>
                      <span style={{ color: "var(--text-secondary)", fontSize: 13, fontFamily: "var(--font-body)" }}>{b.name}</span>
                    </div>
                    <button onClick={() => removeBoss(b.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}



        {/* ══ PROGRESS ══ */}
        {view === "skills" && (
          <div style={{ animation: "pageTransition 0.2s ease" }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700, letterSpacing: 2, fontFamily: "var(--font-body)" }}>PROGRESS</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 13, fontFamily: "var(--font-body)" }}>Overall Level {overallLevel}</div>
            </div>

            {/* 1. Class Card */}
            <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 20, marginBottom: 16, textAlign: "center", border: "1px solid var(--border)" }}>
              <div style={{ color: playerClass.color, fontSize: 32, marginBottom: 4 }}>{playerClass.icon}</div>
              <div style={{ color: playerClass.color, fontSize: 16, fontWeight: 700, letterSpacing: 2, fontFamily: "var(--font-body)", marginBottom: 4 }}>{playerClass.name}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 13, fontFamily: "var(--font-body)", marginBottom: 2 }}>{playerClass.desc}</div>
              <div style={{ color: "var(--text-primary)", fontSize: 14, fontFamily: "var(--font-mono)", fontWeight: 700, marginTop: 8 }}>Level {overallLevel}</div>
              {onboardingData?.username && <div style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-body)", marginTop: 6 }}>{onboardingData.username}</div>}
              {overallLevel >= 5 && <button onClick={prestige} style={{ marginTop: 12, background: "var(--accent-royal)15", border: "1px solid var(--accent-royal)", color: "var(--accent-royal)", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, padding: "8px 20px", cursor: "pointer", borderRadius: 6, letterSpacing: 1, minHeight: 44 }}>PRESTIGE</button>}
            </div>

            {/* 2. Skill Overview (4 bars) + Expandable Skill Tree */}
            <div style={{ marginBottom: 20 }}>
              {Object.entries(SKILL_DEFS).map(([skillKey, skillDef]) => {
                const mainSk = state.skills[skillKey] || { xp: 0, level: 1 };
                const isExpanded = expandedSkill === skillKey;
                const subDefs = SUB_SKILL_DEFS[skillKey] || [];
                return (
                  <div key={skillKey} style={{ marginBottom: 6 }}>
                    {/* Main skill row — clickable */}
                    <div
                      onClick={() => setExpandedSkill(isExpanded ? null : skillKey)}
                      style={{ background: isExpanded ? "var(--bg-elevated)" : "var(--bg-surface)", border: `1px solid ${isExpanded ? skillDef.color + "44" : "var(--border)"}`, borderRadius: isExpanded ? "8px 8px 0 0" : 8, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s", minHeight: 44 }}
                    >
                      <span style={{ color: skillDef.color, fontSize: 18, minWidth: 24, textAlign: "center" }}>{skillDef.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-body)" }}>{skillDef.name}</span>
                          <span style={{ color: skillDef.color, fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 700 }}>LV.{mainSk.level}</span>
                        </div>
                        <div style={{ width: "100%", height: 6, background: "var(--bg-deep)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${mainSk.xp}%`, background: skillDef.color, borderRadius: 3, transition: "width 0.3s ease", boxShadow: `0 0 6px ${skillDef.color}44` }} />
                        </div>
                      </div>
                      <span style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-mono)", minWidth: 40, textAlign: "right" }}>{mainSk.xp}/100</span>
                      <span style={{ color: isExpanded ? skillDef.color : "var(--text-muted)", fontSize: 11, minWidth: 12, transition: "transform 0.2s", transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}>▾</span>
                    </div>
                    {/* Sub-skill rows — shown when expanded */}
                    <div style={{ maxHeight: isExpanded ? 500 : 0, overflow: "hidden", transition: "max-height 0.3s ease" }}>
                      <div style={{ background: "var(--bg-surface)", border: `1px solid ${skillDef.color}22`, borderTop: "none", borderRadius: "0 0 8px 8px", paddingTop: 4, paddingBottom: 4 }}>
                        {subDefs.map(sub => {
                          const ss = state.subSkills?.[skillKey]?.[sub.id] || { xp: 0, level: 1 };
                          return (
                            <div key={sub.id} style={{ padding: "8px 14px 8px 36px", display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ color: sub.color, fontSize: 14, minWidth: 18, textAlign: "center" }}>{sub.icon}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                  <span style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-body)" }}>{sub.name}</span>
                                  <span style={{ color: sub.color, fontSize: 11, fontFamily: "var(--font-mono)" }}>LV.{ss.level}</span>
                                  <span style={{ color: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-mono)", marginLeft: "auto" }}>{ss.xp}/100</span>
                                </div>
                                <div style={{ width: "100%", height: 4, background: "var(--bg-deep)", borderRadius: 2, overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${ss.xp}%`, background: sub.color, borderRadius: 2, opacity: 0.85, transition: "width 0.3s ease" }} />
                                </div>
                                <div style={{ color: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-body)", marginTop: 3 }}>{sub.desc}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 3. Stats Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
              {[
                { l: "Total Tasks", v: state.totalTasksCompleted, c: "var(--accent-toxic)" },
                { l: "Total XP", v: state.totalXpEarned || 0, c: "var(--accent-fire)" },
                { l: "Streak", v: (state.streakDays || 0) + "d", c: "var(--accent-gold)" },
                { l: "Credits", v: state.credits + "\u00A2", c: "var(--accent-gold)" },
                { l: "Prestige", v: state.prestigeLevel, c: "var(--accent-royal)" },
                { l: "Login Streak", v: (state.loginStreak || 0) + "d", c: "var(--accent-ice)" },
              ].map(s => (
                <div key={s.l} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 10px", textAlign: "center" }}>
                  <div style={{ color: s.c, fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", marginBottom: 4 }}>{s.v}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-body)", fontWeight: 500 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Active Debuffs */}
            {(state.activeDebuffs||[]).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: "var(--accent-ember)", fontSize: 12, letterSpacing: 2, fontWeight: 600, fontFamily: "var(--font-body)", marginBottom: 8 }}>ACTIVE DEBUFFS</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(state.activeDebuffs||[]).map(d => {
                    const def = DEBUFF_DEFS[d.id];
                    if (!def) return null;
                    return (
                      <div key={d.id} style={{ background: "var(--bg-surface)", border: `1px solid ${def.color}44`, color: def.color, fontFamily: "var(--font-body)", fontSize: 12, padding: "6px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{def.icon} {def.name}</span>
                        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{def.effect}</span>
                        <button onClick={() => toggleDebuff(d.id)} style={{ background: "none", border: "none", color: def.color, cursor: "pointer", fontSize: 14, padding: "0 2px", opacity: 0.6, minWidth: 24, minHeight: 24 }}>×</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ MORE (Shop + Settings + Pro) ══ */}
        {view === "more" && (() => {
          const sc = state.settingsConfig || {};
          const currentThemeId = settings.theme || "volcanic";
          return (
          <div style={{ animation: "pageTransition 0.2s ease" }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700, letterSpacing: 2, fontFamily: "var(--font-body)" }}>MORE</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 13, fontFamily: "var(--font-body)" }}>Shop, settings, and extras</div>
            </div>

            {/* ─── SECTION 1: REWARD SHOP ─── */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ color: "var(--accent-gold)", fontSize: 14, fontWeight: 700, letterSpacing: 3, fontFamily: "var(--font-body)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>&#x1FA99;</span> REWARD SHOP
              </div>
              {/* Credits balance */}
              <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 11, letterSpacing: 2, fontFamily: "var(--font-body)" }}>BALANCE</div>
                  <div style={{ color: "var(--accent-gold)", fontSize: 24, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{state.credits}<span style={{ fontSize: 14, opacity: 0.7 }}>&cent;</span></div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-body)" }}>Refused</div>
                  <div style={{ color: "var(--accent-toxic, #7CFF3F)", fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{state.creditsRefused || 0}&cent;</div>
                </div>
              </div>
              {/* Add reward button */}
              <button onClick={() => setShowAddReward(true)} style={{ width: "100%", background: "var(--bg-surface)", border: "1px dashed var(--accent-gold)44", color: "var(--accent-gold)", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, padding: "12px", cursor: "pointer", letterSpacing: 2, marginBottom: 12, borderRadius: 8, minHeight: 44 }}>+ ADD REWARD</button>
              {/* Reward cards */}
              {Object.entries(rewardGroups).map(([catName, rewards]) => (
                <div key={catName} style={{ marginBottom: 16 }}>
                  <div style={{ color: "var(--text-secondary)", fontSize: 11, letterSpacing: 3, fontWeight: 600, fontFamily: "var(--font-body)", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>{catName}</div>
                  {rewards.map(item => {
                    const canBuy = state.credits >= item.cost;
                    return (
                      <div key={item.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18, minWidth: 24, textAlign: "center" }}>{item.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 500, fontFamily: "var(--font-body)" }}>{item.name}</div>
                          {item.desc && <div style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-body)" }}>{item.desc}</div>}
                        </div>
                        <button onClick={() => purchaseReward(item)} disabled={!canBuy} style={{ background: canBuy ? "var(--accent-fire)" : "var(--bg-elevated)", border: "none", color: canBuy ? "#fff" : "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, padding: "8px 14px", cursor: canBuy ? "pointer" : "not-allowed", borderRadius: 6, minHeight: 36, letterSpacing: 1 }}>{item.cost}&cent;</button>
                        {item.isCustom && <button onClick={() => deleteCustomReward(item.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: "4px", minWidth: 24, minHeight: 24 }}>&times;</button>}
                      </div>
                    );
                  })}
                </div>
              ))}
              {allShopRewards.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 40, fontFamily: "var(--font-body)" }}>No rewards yet. Add one above.</div>}
              {/* Reward reflections */}
              {(state.rewardReflections||[]).length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: 2, marginBottom: 6, fontFamily: "var(--font-body)" }}>REWARD REFLECTIONS</div>
                  {(state.rewardReflections||[]).slice(-3).reverse().map((r,i) => (
                    <div key={i} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6, padding: 10, marginBottom: 4 }}>
                      <div style={{ color: "var(--accent-gold)", fontSize: 12, fontFamily: "var(--font-body)", opacity: 0.8 }}>{r.name}</div>
                      <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 2, fontFamily: "var(--font-body)" }}>{r.reflection}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ─── SECTION 2: SETTINGS ─── */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 700, letterSpacing: 3, fontFamily: "var(--font-body)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{"\u2699"}</span> SETTINGS
              </div>

              {/* API Key */}
              <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16, marginBottom: 8 }}>
                <div style={{ color: "var(--accent-fire)", fontSize: 12, letterSpacing: 2, fontWeight: 600, fontFamily: "var(--font-body)", marginBottom: 8 }}>API KEY</div>
                <div style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-body)", marginBottom: 8, lineHeight: 1.7 }}>Anthropic key for VORAX AI. Get one at console.anthropic.com</div>
                <input type="password" value={settings.anthropicKey || ""} onChange={e => { const ns = { ...settings, anthropicKey: e.target.value }; saveSettingsAndSchedule(ns); }} placeholder="sk-ant-..." style={{ width: "100%", background: "var(--bg-deep)", border: `1px solid ${settings.anthropicKey ? "var(--accent-toxic)44" : "var(--border)"}`, color: "var(--accent-toxic, #7CFF3F)", padding: 12, fontFamily: "var(--font-mono)", fontSize: 13, borderRadius: 6, boxSizing: "border-box" }} />
                {!ANTHROPIC_API_KEY && !settings.anthropicKey && (
                  <div style={{ marginTop: 8, color: "var(--accent-gold)", fontSize: 11, fontFamily: "var(--font-body)", opacity: 0.8 }}>No key set. VORAX AI features require an API key.</div>
                )}
              </div>

              {/* Theme */}
              <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16, marginBottom: 8 }}>
                <div style={{ color: "var(--accent-royal, #A855F7)", fontSize: 12, letterSpacing: 2, fontWeight: 600, fontFamily: "var(--font-body)", marginBottom: 12 }}>THEME</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {Object.entries(THEMES).map(([tid, t]) => (
                    <button key={tid} onClick={() => { const ns = { ...settings, theme: tid }; saveSettingsAndSchedule(ns); }} style={{ padding: "14px 10px", background: currentThemeId === tid ? `${t.accentFire}18` : "var(--bg-elevated)", border: `2px solid ${currentThemeId === tid ? t.accentFire : "var(--border)"}`, cursor: "pointer", borderRadius: 8, textAlign: "center", minHeight: 44 }}>
                      <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 6 }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.accentFire }} />
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.accentGold }} />
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.accentIce }} />
                      </div>
                      <div style={{ color: currentThemeId === tid ? t.accentFire : "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>{t.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound */}
              <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16, marginBottom: 8 }}>
                <div style={{ color: "var(--accent-toxic, #7CFF3F)", fontSize: 12, letterSpacing: 2, fontWeight: 600, fontFamily: "var(--font-body)", marginBottom: 12 }}>SOUND</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ color: "var(--text-primary)", fontSize: 13, fontFamily: "var(--font-body)" }}>Sound Effects</span>
                  <button onClick={() => setState(p => ({ ...p, settingsConfig: { ...p.settingsConfig, soundEnabled: !(p.settingsConfig?.soundEnabled !== false) } }))} style={{ padding: "8px 20px", background: (sc.soundEnabled !== false) ? "var(--accent-toxic, #7CFF3F)18" : "var(--accent-ember)18", border: `1px solid ${(sc.soundEnabled !== false) ? "var(--accent-toxic, #7CFF3F)" : "var(--accent-ember)"}`, color: (sc.soundEnabled !== false) ? "var(--accent-toxic, #7CFF3F)" : "var(--accent-ember)", fontFamily: "var(--font-body)", fontSize: 12, cursor: "pointer", fontWeight: 700, borderRadius: 6, minHeight: 36, letterSpacing: 1 }}>{(sc.soundEnabled !== false) ? "ON" : "OFF"}</button>
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: 2, fontFamily: "var(--font-body)", marginBottom: 6 }}>TYPE</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["retro", "minimal", "heavy"].map(st => (
                    <button key={st} onClick={() => { setState(p => ({ ...p, settingsConfig: { ...p.settingsConfig, soundType: st } })); AudioEngine.play("click"); }} style={{ flex: 1, padding: "10px 4px", background: (sc.soundType || "retro") === st ? "var(--accent-toxic, #7CFF3F)15" : "transparent", border: `1px solid ${(sc.soundType || "retro") === st ? "var(--accent-toxic, #7CFF3F)" : "var(--border)"}`, color: (sc.soundType || "retro") === st ? "var(--accent-toxic, #7CFF3F)" : "var(--text-muted)", fontFamily: "var(--font-body)", fontSize: 12, cursor: "pointer", textTransform: "uppercase", borderRadius: 6, minHeight: 36, fontWeight: 600 }}>{st}</button>
                  ))}
                </div>
              </div>

              {/* Account */}
              <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16, marginBottom: 8 }}>
                <div style={{ color: "var(--accent-ice)", fontSize: 12, letterSpacing: 2, fontWeight: 600, fontFamily: "var(--font-body)", marginBottom: 12 }}>ACCOUNT</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 12, fontFamily: "var(--font-body)", marginBottom: 12 }}>Human: {onboardingData?.username || "Unknown"}</div>
                <div style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: 1, fontFamily: "var(--font-body)", marginBottom: 4 }}>EMAIL</div>
                <input value={sc.accountEmail || ""} onChange={e => setState(p => ({ ...p, settingsConfig: { ...p.settingsConfig, accountEmail: e.target.value } }))} placeholder="your@email.com" style={{ width: "100%", background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: 12, fontFamily: "var(--font-mono)", fontSize: 13, marginBottom: 10, boxSizing: "border-box", borderRadius: 6 }} />
                <div style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: 1, fontFamily: "var(--font-body)", marginBottom: 4 }}>PASSWORD</div>
                <input type="password" value={sc.accountPassword || ""} onChange={e => setState(p => ({ ...p, settingsConfig: { ...p.settingsConfig, accountPassword: e.target.value } }))} placeholder="Set password..." style={{ width: "100%", background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: 12, fontFamily: "var(--font-mono)", fontSize: 13, boxSizing: "border-box", borderRadius: 6 }} />
                <div style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-body)", marginTop: 6 }}>Stored locally. Cloud sync coming soon.</div>
              </div>

              {/* Data */}
              <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16, marginBottom: 8 }}>
                <div style={{ color: "var(--accent-ember)", fontSize: 12, letterSpacing: 2, fontWeight: 600, fontFamily: "var(--font-body)", marginBottom: 12 }}>DATA</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <button onClick={() => { const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `vorax-backup-${new Date().toISOString().split("T")[0]}.json`; a.click(); URL.revokeObjectURL(url); showToast("Data exported", "var(--accent-toxic)"); }} style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--accent-ice)", fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, padding: "12px 8px", cursor: "pointer", borderRadius: 6, minHeight: 44, letterSpacing: 1 }}>EXPORT</button>
                  <button onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = ".json"; input.onchange = e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = ev => { try { const data = JSON.parse(ev.target.result); setState(data); showToast("Data imported", "var(--accent-toxic)"); } catch { showToast("Invalid file", "var(--accent-ember)"); } }; reader.readAsText(file); }; input.click(); }} style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--accent-gold)", fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, padding: "12px 8px", cursor: "pointer", borderRadius: 6, minHeight: 44, letterSpacing: 1 }}>IMPORT</button>
                </div>
                <button onClick={() => { if (window.confirm("FACTORY RESET: Delete ALL data permanently? This cannot be undone.")) { localStorage.clear(); window.location.reload(); } }} style={{ width: "100%", background: "transparent", border: "1px solid var(--accent-ember)33", color: "var(--accent-ember)", fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, padding: "12px", cursor: "pointer", borderRadius: 6, minHeight: 44, letterSpacing: 2, opacity: 0.6 }}>FACTORY RESET</button>
              </div>
            </div>

            {/* ─── SECTION 3: PRO ─── */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ background: "var(--bg-surface)", border: "2px solid transparent", borderImage: "linear-gradient(135deg, var(--accent-fire), var(--accent-gold), var(--accent-ember)) 1", borderRadius: 0, padding: 20, position: "relative", overflow: "hidden" }}>
                {/* Glow overlay */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, var(--accent-fire)08, var(--accent-gold)05, transparent)", pointerEvents: "none" }} />
                {/* Badge */}
                <div style={{ position: "absolute", top: 12, right: 12, background: "var(--accent-fire)", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: 2, padding: "4px 10px", fontFamily: "var(--font-body)", borderRadius: 4 }}>COMING SOON</div>
                {/* Title */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, position: "relative" }}>
                  <span style={{ fontSize: 28, filter: "drop-shadow(0 0 8px var(--accent-fire))" }}>&#x1F525;</span>
                  <div>
                    <div style={{ color: "var(--accent-fire)", fontSize: 18, fontWeight: 700, letterSpacing: 4, fontFamily: "var(--font-body)" }}>VORAX PRO</div>
                    <div style={{ color: "var(--text-secondary)", fontSize: 12, fontFamily: "var(--font-body)" }}>Unlock the full experience</div>
                  </div>
                </div>
                {/* Features list */}
                <div style={{ position: "relative" }}>
                  {[
                    { icon: "\uD83C\uDFA8", name: "Custom Themes", desc: "Design your own color schemes" },
                    { icon: "\uD83D\uDD0A", name: "Sound Packs", desc: "Premium audio feedback sets" },
                    { icon: "\uD83D\uDCCA", name: "Advanced Analytics", desc: "Deep performance insights" },
                    { icon: "\u26A1", name: "Priority Support", desc: "Direct line to the dev team" },
                  ].map((feat, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none", opacity: 0.7 }}>
                      <span style={{ fontSize: 18, minWidth: 28, textAlign: "center", filter: "grayscale(0.3)" }}>{feat.icon}</span>
                      <div>
                        <div style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-body)" }}>{feat.name}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-body)" }}>{feat.desc}</div>
                      </div>
                      <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: 14 }}>&#x1F512;</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Version footer */}
            <div style={{ textAlign: "center", padding: "16px 0 8px", color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-body)" }}>
              VORAX v5.1 &middot; &copy; 2026 Tejas Ayyagari
            </div>
          </div>
          );
        })()}

        {/* ══ VORAX HOME ══ */}
        {view === "vorax" && (() => {
          const voraxExpression = getVoraxExpression(state);
          const currentTheme = THEMES[settings.theme] || THEMES.volcanic;
          const quickPrompts = getVoraxQuickPrompts(state);
          const latestAssistantMsg = [...coachHistory].reverse().find(m => m.role === "assistant");
          const recentMessages = coachHistory.slice(-4);

          return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 8px 100px", minHeight: "calc(100vh - 80px)", animation: "pageTransition 0.2s ease" }}>

            {/* VORAX Avatar — prominent, centered, 35-40% viewport */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "35vh", paddingTop: 8 }}>
              <VoraxAvatar
                expression={voraxExpression}
                theme={currentTheme}
                speaking={coachStreaming}
                size={240}
              />
            </div>

            {/* Expression label */}
            <div style={{ color: "var(--accent-fire, #FF5E1A)", fontSize: 10, letterSpacing: 4, fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, textTransform: "uppercase", marginBottom: 12, opacity: 0.7 }}>
              {voraxExpression}
            </div>

            {/* No API key warning */}
            {!ANTHROPIC_API_KEY && !settings.anthropicKey && (
              <div style={{ background: "var(--bg-surface, #0f0b1a)", border: "1px solid var(--accent-gold, #FFAA00)33", padding: "12px 16px", marginBottom: 12, width: "100%", maxWidth: 440, borderRadius: 8 }}>
                <div style={{ color: "var(--accent-gold, #FFAA00)", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, marginBottom: 6 }}>VORAX NEEDS AN API KEY</div>
                <div style={{ color: "var(--text-secondary, #7a7290)", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.8 }}>
                  Go to <button onClick={() => { setView("settings"); setExpandedSetting("coach"); }} style={{ background: "none", border: "none", color: "var(--accent-gold, #FFAA00)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Settings</button> to add your Anthropic key.
                </div>
              </div>
            )}

            {/* Speech bubble — last few messages, latest most prominent */}
            <div style={{ width: "100%", maxWidth: 440, marginBottom: 12 }}>
              {/* Previous messages (dimmed) */}
              {recentMessages.length > 1 && (
                <div style={{ maxHeight: 120, overflowY: "auto", marginBottom: 4, scrollbarWidth: "thin" }}>
                  {recentMessages.slice(0, -1).map((msg, i) => (
                    <div key={i} style={{
                      padding: "6px 12px",
                      marginBottom: 4,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      lineHeight: 1.6,
                      color: msg.role === "user" ? "var(--text-muted, #4a4460)" : "var(--text-secondary, #7a7290)",
                      borderLeft: msg.role === "user" ? "2px solid var(--accent-ice, #00B4FF)22" : "2px solid var(--accent-fire, #FF5E1A)22",
                      paddingLeft: 10,
                      opacity: 0.5,
                    }}>
                      {msg.content}
                    </div>
                  ))}
                </div>
              )}

              {/* Latest message — speech bubble */}
              {(latestAssistantMsg || coachStreaming) && (
                <div style={{
                  background: "var(--bg-surface, #0f0b1a)",
                  border: "1px solid var(--border-glow, #2a1f45)",
                  borderRadius: 12,
                  padding: "14px 18px",
                  position: "relative",
                  boxShadow: "0 0 20px var(--accent-fire, #FF5E1A)08",
                }}>
                  {/* Triangle pointer */}
                  <div style={{
                    position: "absolute",
                    top: -8,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 0,
                    height: 0,
                    borderLeft: "8px solid transparent",
                    borderRight: "8px solid transparent",
                    borderBottom: "8px solid var(--border-glow, #2a1f45)",
                  }} />
                  <div style={{
                    color: "var(--text-primary, #ede9f5)",
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', monospace",
                    lineHeight: 1.8,
                    whiteSpace: "pre-wrap",
                  }}>
                    {coachStreaming ? (
                      <>
                        {coachStreamText}
                        <span style={{ animation: "blink 0.5s step-end infinite", color: "var(--accent-fire, #FF5E1A)" }}>|</span>
                      </>
                    ) : (
                      latestAssistantMsg?.content
                    )}
                  </div>
                </div>
              )}

              {/* Latest user message if it's the most recent */}
              {recentMessages.length > 0 && recentMessages[recentMessages.length - 1].role === "user" && !coachStreaming && (
                <div style={{
                  padding: "8px 14px",
                  marginTop: 6,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  color: "var(--accent-ice, #00B4FF)",
                  borderLeft: "2px solid var(--accent-ice, #00B4FF)44",
                  paddingLeft: 12,
                  opacity: 0.8,
                }}>
                  {recentMessages[recentMessages.length - 1].content}
                </div>
              )}

              {coachError && (
                <div style={{ color: "#ff4444", fontSize: 11, padding: "8px 12px", background: "#ff000010", border: "1px solid #ff000033", marginTop: 8, borderRadius: 6, fontFamily: "'JetBrains Mono', monospace" }}>{coachError}</div>
              )}
              <div ref={coachEndRef} />
            </div>

            {/* Quick-prompt buttons — fire-themed */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16, width: "100%", maxWidth: 440 }}>
              {quickPrompts.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => { if (!coachStreaming) sendToCoach(prompt); }}
                  disabled={coachStreaming}
                  style={{
                    padding: "8px 14px",
                    background: "var(--accent-fire, #FF5E1A)0a",
                    border: "1px solid var(--accent-fire, #FF5E1A)33",
                    color: "var(--accent-fire, #FF5E1A)",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: coachStreaming ? "not-allowed" : "pointer",
                    letterSpacing: 1,
                    borderRadius: 6,
                    opacity: coachStreaming ? 0.4 : 0.85,
                    transition: "opacity 0.2s, background 0.2s",
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Chat input bar — full width, above bottom nav */}
            <div style={{ width: "100%", maxWidth: 440, display: "flex", gap: 8 }}>
              <input
                value={coachInput}
                onChange={e => setCoachInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && coachInput.trim() && !coachStreaming) sendToCoach(coachInput.trim()); }}
                placeholder={coachStreaming ? "VORAX is speaking..." : "Speak, human..."}
                disabled={coachStreaming}
                style={{
                  flex: 1,
                  background: "var(--bg-surface, #0f0b1a)",
                  border: "1px solid var(--border, #1e1635)",
                  color: "var(--text-primary, #ede9f5)",
                  padding: "12px 16px",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  outline: "none",
                  borderRadius: 8,
                  opacity: coachStreaming ? 0.5 : 1,
                }}
              />
              <button
                onClick={() => { if (coachInput.trim() && !coachStreaming) sendToCoach(coachInput.trim()); }}
                disabled={!coachInput.trim() || coachStreaming}
                style={{
                  padding: "12px 20px",
                  background: coachInput.trim() && !coachStreaming ? "var(--accent-fire, #FF5E1A)18" : "var(--bg-surface, #0f0b1a)",
                  border: `1px solid ${coachInput.trim() && !coachStreaming ? "var(--accent-fire, #FF5E1A)" : "var(--border, #1e1635)"}`,
                  color: coachInput.trim() && !coachStreaming ? "var(--accent-fire, #FF5E1A)" : "var(--text-muted, #4a4460)",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: coachInput.trim() && !coachStreaming ? "pointer" : "not-allowed",
                  letterSpacing: 2,
                  borderRadius: 8,
                }}>
                SEND
              </button>
            </div>

            {/* Clear session — subtle */}
            {coachHistory.length > 1 && (
              <button
                onClick={() => {
                  setCoachHistory([]);
                  setCoachStreamText("");
                  setCoachError(null);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted, #4a4460)",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  cursor: "pointer",
                  letterSpacing: 2,
                  marginTop: 12,
                  opacity: 0.5,
                }}
              >
                CLEAR SESSION
              </button>
            )}
          </div>
          );
        })()}

      </div>

      {/* ── Undo Toast ── */}
      {undoTask && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: "#0a0a0a", border: "1px solid #ffaa00", padding: "10px 20px", zIndex: 8000, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ color: "#ffaa00", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>Removed: {undoTask.text.slice(0, 25)}{undoTask.text.length > 25 ? "..." : ""}</span>
          <button onClick={() => { setState(p => ({ ...p, tasks: [...p.tasks, undoTask] })); setUndoTask(null); showToast("✓ QUEST RESTORED", "#FF5E1A"); }} style={{ background: "#ffaa0012", border: "1px solid #ffaa00", color: "#ffaa00", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: "4px 12px", cursor: "pointer", fontWeight: 700 }}>UNDO</button>
        </div>
      )}

      {/* ── Undo Completion Toast ── */}
      {undoCompletion && (
        <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "rgba(22, 17, 37, 0.95)", backdropFilter: "blur(8px)", border: "1px solid var(--accent-gold)", padding: "10px 16px", zIndex: 8000, display: "flex", alignItems: "center", gap: 12, borderRadius: 8 }}>
          <span style={{ color: "var(--accent-gold)", fontFamily: "var(--font-mono)", fontSize: 12 }}>Completed: {undoCompletion.text.slice(0, 25)}{undoCompletion.text.length > 25 ? "..." : ""}</span>
          <button onClick={undoLastCompletion} style={{ background: "var(--accent-gold)15", border: "1px solid var(--accent-gold)", color: "var(--accent-gold)", fontFamily: "var(--font-mono)", fontSize: 12, padding: "6px 14px", cursor: "pointer", fontWeight: 700, borderRadius: 6 }}>UNDO</button>
        </div>
      )}

      {/* ── Bottom Tab Nav ── */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 64, background: "rgba(10,10,10,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderTop: "1px solid #1a1a1a", display: "flex", justifyContent: "space-around", alignItems: "center", zIndex: 1000, padding: "0 4px", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {TABS.map(tab => {
          const isActive = view === tab.viewId;
          return (
            <button key={tab.id} onClick={() => { setView(tab.viewId); AudioEngine.play("click"); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: "transparent", border: "none", cursor: "pointer", padding: "6px 0", position: "relative", WebkitTapHighlightColor: "transparent" }}>
              {isActive && <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 2, background: "linear-gradient(90deg, #ff6b35, #ff4500)", borderRadius: "0 0 2px 2px", boxShadow: "0 0 8px #ff6b3566" }} />}
              <span style={{ fontSize: 18, filter: isActive ? "drop-shadow(0 0 4px #ff6b3544)" : "none", lineHeight: 1 }}>{tab.icon}</span>
              <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: 1, color: isActive ? "#ff6b35" : "#555", transition: "color 0.2s ease" }}>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Quick Action FABs ── */}
      <div style={{ position: "fixed", bottom: 76, right: 16, display: "flex", flexDirection: "column", gap: 8, zIndex: 5000 }}>
        <button onClick={() => setShowQuickLog(true)} style={{ background: "rgba(255, 94, 26, 0.1)", border: "1px solid var(--accent-fire)", color: "var(--accent-fire)", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, padding: "10px 16px", cursor: "pointer", letterSpacing: 1, borderRadius: 20, boxShadow: "0 0 15px rgba(255, 94, 26, 0.15)" }}>⚡ LOG</button>
        <button onClick={() => setShowAddTask(true)} style={{ background: "linear-gradient(135deg, #FF5E1A, #FF3D00)", border: "none", color: "#fff", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, padding: "10px 16px", cursor: "pointer", letterSpacing: 1, borderRadius: 20, boxShadow: "0 0 15px rgba(255, 94, 26, 0.25)" }}>+ TASK</button>
      </div>

    </div>
  );
}
