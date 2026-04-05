# ⚡ GRIDFALL

**Fast. Brutal. No Second Chances.**

🎮 **Live Demo:** https://gridfall-io.vercel.app/

---

## 🧠 What is GRIDFALL?

**GRIDFALL** is a fast-paced **real-time multiplayer browser game** where 2–5 players fight for survival on a shrinking grid.

Capture territory, evolve your abilities mid-game, and eliminate opponents.

> 🏆 **Goal:** Be the last player alive.

No downloads. No login. Just open and play.

---

## 🎮 Core Gameplay

### 🗺️ The Grid

A **6×6 battlefield (36 tiles)** made of:

* 🟦 **Normal Tiles** → +1 Energy
* 🟨 **Power Tiles** → +2 Energy (rare)
* 🟥 **Hazard Tiles** → Damage over time but still give energy

---

### 🎯 Movement & Capture

* Move using **WASD** or **Arrow Keys**
* No diagonal movement
* Stand still for **1.5 seconds** to capture a tile
* Tiles turn into your color when captured

⚠️ If another player steps onto your tile → **combat starts instantly**

---

## ⚡ Energy & Evolution System

* Capturing tiles gives **energy**
* Every **3 energy**, choose **1 of 2 random upgrades**
* Maximum **3 evolutions per match**

### 🧬 Evolutions

| Evolution      | Benefit                    | Tradeoff            |
| -------------- | -------------------------- | ------------------- |
| ⚡ Kinetic Dash | +30% movement speed        | -10% damage         |
| 🛡️ Tank Mode  | +40% max HP                | -20% movement speed |
| 🔥 Berserker   | +40% damage                | -15% max HP         |
| 🩸 Vampire     | Heal 10% of damage dealt   | Rare                |
| 👻 Ghost       | Invisible for 3s every 15s | -10% HP             |
| 🏗️ Architect  | 50% faster tile capture    | -10% damage         |

> Every match creates a **different build and strategy**

---

## ⚔️ Combat System

* Triggered when two players stand on the same tile
* Players are locked in place
* Damage ticks every **0.5 seconds**
* Fight ends when one player reaches 0 HP

💀 No respawns.

---

## 🌪️ Chaos Events (Every 35s)

The game introduces dynamic events:

* 🌫️ Fog of War → Limited visibility
* ⚡ Power Surge → Extra energy from power tiles
* 🔄 Tile Flip → All tiles reset
* 🔃 Inversion → Speed stats reversed

> Events follow a fixed pattern → learn and adapt

---

## 🔻 Map Shrink (Every 45s)

* Outer grid collapses inward
* Standing there causes damage
* Forces player encounters

---

## 🎯 Rubber-Band Mechanic

If a player controls **40%+ of the map (14+ tiles)**:

👁️ Their position becomes visible to everyone.

---

## 🏆 Win Condition

Be the **last player alive**.

---

## ⏱️ Match Duration

**2–4 minutes** per game
Fast, intense, and replayable

---

## 🚀 Project Highlights

* ⚡ Real-time multiplayer using **Socket.io**
* 🧠 Dynamic **mid-game evolution system**
* 🗺️ **Territory control mechanics**
* ⚔️ Auto-resolving combat system
* 🌪️ Timed chaos events for unpredictability
* 🔻 Progressive map shrink system
* 🚀 Deployed using **Vercel (Frontend) + Railway (Backend)**

---

## 🛠️ Tech Stack

* **Frontend:** React + Phaser.js
* **Backend:** Node.js + Socket.io
* **Deployment:** Vercel + Railway

---

## 🔮 Future Improvements

* Matchmaking system
* Leaderboards
* Mobile optimization
* Custom rooms / private matches

---

## 👨‍💻 Author

**Kunal**
