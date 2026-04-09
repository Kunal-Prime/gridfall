import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";

// 🌀 Constants
const GRID_SIZE = 6;
const GAME_TICK_RATE = 500; // ms
const SHRINK_INTERVAL = 45000; // ms
const COLORS = [0x00fbfb, 0xff0055, 0x00ff00, 0xffff00, 0xaa00ff];

// 🌀 Game State
let grid: any[][] = [];
let players: Record<string, any> = {};
let shrinkLevel = 0;
let operatorCounter = 1;
let shrinkTimer: NodeJS.Timeout | null = null;
let chaosTimer: NodeJS.Timeout | null = null;
let gameLoop: NodeJS.Timeout | null = null;
let chaosCountdown = 35;
let io: Server;

// 🌀 Core Initialization & Reset
const initializeGrid = () => {
  grid = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    grid[y] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      const rand = Math.random();
      let type = 'normal';
      if (rand < 0.15) type = 'power';
      else if (rand < 0.3) type = 'hazard';
      grid[y][x] = { type, owner: null };
    }
  }
};

const resetGameServer = () => {
  console.log("♻️ RE-INITIALIZING GRIDFALL...");
  if (shrinkTimer) clearInterval(shrinkTimer);
  if (gameLoop) clearInterval(gameLoop);

  initializeGrid();
  shrinkLevel = 0;
  operatorCounter = 1;
  players = {};

  startMapShrink();
  startChaosCountdown();
  startGameLoop();
};

const startMapShrink = () => {
  shrinkTimer = setInterval(() => {
    shrinkLevel++;
    const b = shrinkLevel - 1;
    if (b >= Math.floor(GRID_SIZE / 2)) {
      if (shrinkTimer) clearInterval(shrinkTimer);
      return;
    }

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (x === b || y === b || x === GRID_SIZE - 1 - b || y === GRID_SIZE - 1 - b) {
          grid[y][x].type = 'shrinking';
          grid[y][x].owner = null;
        }
      }
    }
    io.emit('map_shrink', { grid });
  }, SHRINK_INTERVAL);
};

const startChaosCountdown = () => {
  chaosCountdown = 35;
  if (chaosTimer) clearInterval(chaosTimer);
  chaosTimer = setInterval(() => {
    chaosCountdown--;
    if (chaosCountdown <= 0) {
      handleChaosEvent();
      chaosCountdown = 35;
    }
    io.emit('chaos_update', chaosCountdown);
  }, 1000);
};

const handleChaosEvent = () => {
  console.log("🔥 CHAOS EVENT TRIGGERED!");
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (!grid[y][x].owner && grid[y][x].type !== 'shrinking') {
        const rand = Math.random();
        let type = 'normal';
        if (rand < 0.15) type = 'power';
        else if (rand < 0.3) type = 'hazard';
        grid[y][x].type = type;
      }
    }
  }
  io.emit('chaos_fire', { grid });
};

// 🌀 Authoritative Game Tick (The Heartbeat)
const startGameLoop = () => {
  gameLoop = setInterval(() => {
    if (Object.keys(players).length === 0) return;

    let stateChanged = false;

    // 🩹 Hazard & Damage Logic
    Object.values(players).forEach(player => {
      if (!player) return;

      const tile = grid[player.y][player.x];
      
      // 1. Environmental Hazards
      if (tile.type === 'hazard' || tile.type === 'shrinking') {
        player.hp -= 5;
        stateChanged = true;
      }

      // 2. Combat Logic (Check every tile once)
      if (!player.isFighting) {
        const opponent = Object.values(players).find(p => 
          p.id !== player.id && 
          p.x === player.x && 
          p.y === player.y && 
          !p.isFighting
        );

        if (opponent) {
          player.isFighting = true;
          player.opponentId = opponent.id;
          opponent.isFighting = true;
          opponent.opponentId = player.id;
          
          io.to(player.id).emit("combat_start", { opponentId: opponent.id });
          io.to(opponent.id).emit("combat_start", { opponentId: player.id });
        }
      } else {
        // Active Fighting
        const opponent = players[player.opponentId];
        if (opponent) {
          const myDmg = player.stats.damage;
          opponent.hp -= myDmg;
          
          // Vampire Synergy
          if (player.stats.vampire) {
            player.hp = Math.min(player.stats.maxHP, player.hp + (myDmg * 0.1));
          }
          stateChanged = true;
        } else {
          // Opponent Disconnected or Left
          player.isFighting = false;
          player.opponentId = null;
        }
      }

      // 3. Health Clamping & Elimination
      if (player.hp <= 0) {
        if (player.isFighting && players[player.opponentId]) {
           const winner = players[player.opponentId];
           winner.isFighting = false;
           winner.opponentId = null;
           io.to(winner.id).emit("combat_end", { won: true });
        }
        handleElimination(player.id);
      }
    });

    if (stateChanged) {
      Object.values(players).forEach(p => {
        io.emit("hp_update", { id: p.id, hp: p.hp, maxHP: p.stats.maxHP });
      });
    }

    // Check Victory
    if (Object.keys(players).length === 1 && operatorCounter > 2) {
       const winnerId = Object.keys(players)[0];
       io.emit("game_over", { winner: winnerId });
    }
  }, GAME_TICK_RATE);
};

function handleElimination(playerId: string) {
  if (players[playerId]) {
    io.emit("player_eliminated", playerId);
    delete players[playerId];
    io.emit("playerLeft", playerId);
    io.emit("playerCount", Object.keys(players).length);
    
    if (Object.keys(players).length === 0) {
      resetGameServer();
    }
  }
}

// 🌀 Server Setup
async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  io = new Server(httpServer, { cors: { origin: "*" } });
  const PORT = Number(process.env.PORT) || 3000;

  initializeGrid();
  startMapShrink();
  startChaosCountdown();
  startGameLoop();

  io.on("connection", (socket) => {
    if (Object.keys(players).length === 0 && operatorCounter === 1) {
       // Logic for fresh game if server was previously abandoned
    }

    const operatorName = `OPERATOR_0${operatorCounter}`;
    const color = COLORS[(operatorCounter - 1) % COLORS.length];
    
    players[socket.id] = {
      id: socket.id,
      name: operatorName,
      color: color,
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
      energy: 0,
      hp: 100,
      evolutionCount: 0,
      stats: {
        moveDelay: 150,
        damage: 8,
        maxHP: 100,
        captureTime: 1500,
        vampire: false,
        ghost: false,
        visible: true
      },
      isFighting: false,
      lastMoveTime: 0
    };
    operatorCounter++;

    socket.emit("init", { id: socket.id, grid, players });
    socket.broadcast.emit("playerJoined", players[socket.id]);
    io.emit("playerCount", Object.keys(players).length);

    socket.on("move", (data: { x: number, y: number }) => {
      const player = players[socket.id];
      if (!player || player.isFighting) return;

      // 🛡️ RATE LIMITING
      const now = Date.now();
      if (now - player.lastMoveTime < player.stats.moveDelay - 10) return; // 10ms grace period

      // 🛡️ SANITIZATION
      const targetX = Math.max(0, Math.min(GRID_SIZE - 1, data.x));
      const targetY = Math.max(0, Math.min(GRID_SIZE - 1, data.y));
      const dx = Math.abs(targetX - player.x);
      const dy = Math.abs(targetY - player.y);

      if (dx + dy <= 1) { // Adjacency Check
        player.x = targetX;
        player.y = targetY;
        player.lastMoveTime = now;
        io.emit("playerMoved", { id: socket.id, x: player.x, y: player.y });
        
        // Anti-Snowball
        let owned = 0;
        grid.forEach(row => row.forEach(t => { if(t.owner === socket.id) owned++; }));
        if (owned > 14) io.emit('force_visible', { id: socket.id, x: player.x, y: player.y });
      }
    });

    socket.on("capture", (data: { x: number, y: number }) => {
      const player = players[socket.id];
      if (!player || player.isFighting) return;
      if (player.x !== data.x || player.y !== data.y) return;

      // Authoritative Energy
      const tile = grid[data.y][data.x];
      tile.owner = socket.id;
      const reward = tile.type === 'power' ? 3 : 1;
      player.energy += reward;

      io.emit("tileCaptured", { x: data.x, y: data.y, owner: socket.id, energy: player.energy });
    });

    socket.on("evolution_picked", (evoName: string) => {
      const player = players[socket.id];
      if (!player || player.evolutionCount >= 3) return;
      player.evolutionCount++;

      switch (evoName) {
        case 'KINETIC DASH': player.stats.moveDelay *= 0.7; player.stats.damage *= 0.9; break;
        case 'TANK MODE':
          player.stats.maxHP *= 1.4;
          player.hp += (player.stats.maxHP - player.stats.maxHP / 1.4); 
          player.stats.moveDelay *= 1.2;
          break;
        case 'BERSERKER': player.stats.damage *= 1.4; player.stats.maxHP *= 0.85; break;
        case 'VAMPIRE': player.stats.vampire = true; break;
        case 'ARCHITECT': player.stats.captureTime *= 0.5; player.stats.damage *= 0.9; break;
      }
      socket.emit("stats_updated", player.stats);
    });

    socket.on("disconnect", () => {
       if (players[socket.id]) handleElimination(socket.id);
    });
  });

  // Vite/Prod Setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (_, res) => res.sendFile(path.join(process.cwd(), 'dist', 'index.html')));
  }

  httpServer.listen(PORT, "0.0.0.0", () => console.log(`🚀 GRIDFALL LIVE: ${PORT}`));
}

startServer();
