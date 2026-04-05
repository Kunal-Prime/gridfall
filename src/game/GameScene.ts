import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';

export enum TileType {
  NORMAL = 'normal',
  POWER = 'power',
  HAZARD = 'hazard',
  SHRINKING = 'shrinking'
}

interface TileData {
  rect: Phaser.GameObjects.Rectangle;
  owner: string | null;
  captureProgress: number;
  progressRect: Phaser.GameObjects.Rectangle;
  type: TileType;
}

export class GameScene extends Phaser.Scene {
  private grid: TileData[][] = [];
  private player!: Phaser.GameObjects.Rectangle;
  private playerGlow!: Phaser.GameObjects.Rectangle;
  private otherPlayers: Record<string, { rect: Phaser.GameObjects.Rectangle, glow: Phaser.GameObjects.Rectangle }> = {};
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private socket!: Socket;
  private socketId: string = '';
  
  private readonly GRID_SIZE = 6;
  private readonly TILE_SIZE = 64;
  private readonly TILE_SPACING = 8;
  private readonly OFFSET_X = 0;
  private readonly OFFSET_Y = 0;
  private captureTime = 1500;
  private moveDelay = 150;

  private playerGridX = -1;
  private playerGridY = -1;
  private isMoving = false;
  private isFighting = false;
  private playerEnergy = 0;
  private isInitialized = false;
  private isPopupOpen = false;
  private myColor = 0x00fbfb;
  private playerColors: Record<string, number> = {};

  constructor() {
    super('GameScene');
  }

  create() {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();

      this.input.keyboard.on('keydown-W', () => this.movePlayer(0, -1));
      this.input.keyboard.on('keydown-S', () => this.movePlayer(0, 1));
      this.input.keyboard.on('keydown-A', () => this.movePlayer(-1, 0));
      this.input.keyboard.on('keydown-D', () => this.movePlayer(1, 0));
      this.input.keyboard.on('keydown-UP', () => this.movePlayer(0, -1));
      this.input.keyboard.on('keydown-DOWN', () => this.movePlayer(0, 1));
      this.input.keyboard.on('keydown-LEFT', () => this.movePlayer(-1, 0));
      this.input.keyboard.on('keydown-RIGHT', () => this.movePlayer(1, 0));
    }

    this.socket = io();

    const handlePickEvolution = ((e: CustomEvent) => {
      this.socket.emit('evolution_picked', e.detail);
    }) as EventListener;

    const handlePopupState = ((e: CustomEvent) => {
      this.isPopupOpen = e.detail;
    }) as EventListener;

    this.events.on('destroy', () => {
      window.removeEventListener('pick-evolution', handlePickEvolution);
      window.removeEventListener('popup-state', handlePopupState);
      if (this.socket) {
        this.socket.disconnect();
      }
    });

    this.socket.on('init', (data: any) => {
      if (!this.add) return;
      this.socketId = data.id;
      const me = data.players[this.socketId];
      this.playerGridX = me.x;
      this.playerGridY = me.y;
      this.myColor = me.color;
      
      if (me.stats) {
        this.captureTime = me.stats.captureTime;
        this.moveDelay = me.stats.moveDelay;
      }

      Object.keys(data.players).forEach(id => {
        this.playerColors[id] = data.players[id].color;
      });
      
      window.dispatchEvent(new CustomEvent('player-init', { detail: { name: me.name } }));
      window.dispatchEvent(new CustomEvent('player-pos', { detail: { x: this.playerGridX, y: this.playerGridY } }));

      // Listen for evolution picks from React
      window.addEventListener('pick-evolution', handlePickEvolution);
      window.addEventListener('popup-state', handlePopupState);
      window.addEventListener('chaos-fire', () => {
        this.cameras.main.shake(300, 0.02);
        // flip all uncaptured tiles to random types
        for (let y = 0; y < this.GRID_SIZE; y++) {
          for (let x = 0; x < this.GRID_SIZE; x++) {
            if (this.grid[y][x].owner !== this.socketId) {
              this.grid[y][x].captureProgress = 0;
              this.grid[y][x].progressRect.width = 0;
            }
          }
        }
      });

      // Create grid from server data
      for (let y = 0; y < this.GRID_SIZE; y++) {
        this.grid[y] = [];
        for (let x = 0; x < this.GRID_SIZE; x++) {
          const px = this.OFFSET_X + x * (this.TILE_SIZE + this.TILE_SPACING);
          const py = this.OFFSET_Y + y * (this.TILE_SIZE + this.TILE_SPACING);
          
          const serverTile = data.grid[y][x];
          const type = serverTile.type as TileType;
          let baseColor = 0x1c1b1b;
          
          if (type === TileType.POWER) baseColor = 0x6E560A; // Bright dark gold
          else if (type === TileType.HAZARD) baseColor = 0x5E0A0A; // Distinct dark red
          
          const tile = this.add.rectangle(px, py, this.TILE_SIZE, this.TILE_SIZE, baseColor);
          tile.setOrigin(0, 0);
          tile.setStrokeStyle(1, 0x3a4a49, 0.5);
          tile.setInteractive();
          
          tile.on('pointerover', () => {
            if (this.grid[y][x].owner !== this.socketId) {
              tile.setStrokeStyle(2, 0x00fbfb, 0.5);
            }
          });
          
          tile.on('pointerout', () => {
            if (this.grid[y][x].owner !== this.socketId) {
              tile.setStrokeStyle(1, 0x3a4a49, 0.5);
            }
          });

          const progressRect = this.add.rectangle(px, py + this.TILE_SIZE - 4, 0, 4, 0x00fbfb);
          progressRect.setOrigin(0, 0);

          this.grid[y][x] = {
            rect: tile,
            owner: serverTile.owner,
            captureProgress: 0,
            progressRect,
            type
          };

          // Apply captured state if already owned
          if (serverTile.owner) {
            this.applyCaptureVisuals(x, y, serverTile.owner);
          }
        }
      }

      // Create local player
      const px = this.OFFSET_X + this.playerGridX * (this.TILE_SIZE + this.TILE_SPACING) + this.TILE_SIZE / 2;
      const py = this.OFFSET_Y + this.playerGridY * (this.TILE_SIZE + this.TILE_SPACING) + this.TILE_SIZE / 2;
      
      this.playerGlow = this.add.rectangle(px, py, this.TILE_SIZE - 16, this.TILE_SIZE - 16, this.myColor, 0.3);
      this.playerGlow.setDepth(9);
      this.player = this.add.rectangle(px, py, this.TILE_SIZE - 16, this.TILE_SIZE - 16, this.myColor);
      this.player.setDepth(10);

      if (me.stats && me.stats.visible === false) {
        this.player.setAlpha(0.3);
        this.playerGlow.setAlpha(0.1);
      }

      // Create other players
      Object.keys(data.players).forEach(id => {
        if (id !== this.socketId) {
          this.addOtherPlayer(id, data.players[id].x, data.players[id].y, data.players[id].color);
          if (data.players[id].stats && data.players[id].stats.visible === false) {
            this.otherPlayers[id].rect.setAlpha(0);
            this.otherPlayers[id].glow.setAlpha(0);
          }
        }
      });

      this.isInitialized = true;
    });

    this.socket.on('playerJoined', (player: any) => {
      if (!this.add) return;
      this.playerColors[player.id] = player.color;
      if (player.id !== this.socketId) {
        this.addOtherPlayer(player.id, player.x, player.y, player.color);
      }
    });

    this.socket.on('playerMoved', (data: any) => {
      if (!this.tweens) return;
      if (data.id !== this.socketId && this.otherPlayers[data.id]) {
        const px = this.OFFSET_X + data.x * (this.TILE_SIZE + this.TILE_SPACING) + this.TILE_SIZE / 2;
        const py = this.OFFSET_Y + data.y * (this.TILE_SIZE + this.TILE_SPACING) + this.TILE_SIZE / 2;
        
        this.tweens.add({
          targets: [this.otherPlayers[data.id].rect, this.otherPlayers[data.id].glow],
          x: px,
          y: py,
          duration: 150,
          ease: 'Back.easeOut'
        });
      }
    });

    this.socket.on('playerLeft', (id: string) => {
      if (!this.add) return;
      if (this.otherPlayers[id]) {
        this.otherPlayers[id].rect.destroy();
        this.otherPlayers[id].glow.destroy();
        delete this.otherPlayers[id];
      }
    });

    this.socket.on('playerCount', (count: number) => {
      if (!this.add) return;
      window.dispatchEvent(new CustomEvent('player-count', { detail: count }));
    });

    this.socket.on('tileCaptured', (data: any) => {
      if (!this.add) return;
      if (this.grid[data.y] && this.grid[data.y][data.x]) {
        this.grid[data.y][data.x].owner = data.owner;
        this.applyCaptureVisuals(data.x, data.y, data.owner);
        
        if (data.owner === this.socketId) {
          this.playerEnergy = data.energy;
          window.dispatchEvent(new CustomEvent('energy-update', { detail: this.playerEnergy }));
        }
      }
    });

    this.socket.on('combat_start', (data: any) => {
      if (!this.add) return;
      this.isFighting = true;
      if (this.cameras && this.cameras.main) {
        this.cameras.main.shake(200, 0.01);
      }
    });

    this.socket.on('combat_end', (data: any) => {
      if (!this.add) return;
      this.isFighting = false;
    });

    this.socket.on('hp_update', (data: { id: string, hp: number, maxHP: number }) => {
      if (!this.add) return;
      if (data.id === this.socketId) {
        window.dispatchEvent(new CustomEvent('hp-update', { detail: { hp: data.hp, maxHP: data.maxHP } }));
        if (this.cameras && this.cameras.main) {
          this.cameras.main.shake(100, 0.005);
        }
      }
    });

    this.socket.on('player_eliminated', (id: string) => {
      if (!this.add) return;
      if (id === this.socketId) {
        this.isFighting = false;
        this.isInitialized = false;
        this.player.destroy();
        this.playerGlow.destroy();
        window.dispatchEvent(new CustomEvent('player-eliminated'));
      }
    });

    this.socket.on('game_over', (data: { winner: string }) => {
      if (!this.add) return;
      if (data.winner === this.socketId) {
        window.dispatchEvent(new CustomEvent('game-over', { detail: { winner: true } }));
      } else {
        window.dispatchEvent(new CustomEvent('game-over', { detail: { winner: false } }));
      }
    });

    this.socket.on('stats_updated', (stats: any) => {
      if (!this.add) return;
      this.captureTime = stats.captureTime;
      this.moveDelay = stats.moveDelay;
    });

    this.socket.on('map_shrink', (data: any) => {
      for (let y = 0; y < this.GRID_SIZE; y++) {
        for (let x = 0; x < this.GRID_SIZE; x++) {
          const serverTile = data.grid[y][x];
          if (serverTile.type === 'shrinking') {
            const tile = this.grid[y][x];
            tile.type = 'shrinking' as any;
            tile.owner = null;
            tile.captureProgress = 0;
            tile.progressRect.width = 0;
            // Flash red then go dark
            tile.rect.setFillStyle(0xff0000, 0.6);
            tile.rect.setStrokeStyle(2, 0xff0000, 1);
            this.tweens.add({
              targets: tile.rect,
              alpha: 0.3,
              duration: 1000,
              onComplete: () => {
                tile.rect.setFillStyle(0x1a0000, 1);
                tile.rect.setAlpha(1);
              }
            });
          }
        }
      }
    });

    this.socket.on('player_visibility', (data: { id: string, visible: boolean }) => {
      if (!this.add) return;
      if (data.id === this.socketId) {
        this.player.setAlpha(data.visible ? 1 : 0.3);
        this.playerGlow.setAlpha(data.visible ? 0.3 : 0.1);
      } else if (this.otherPlayers[data.id]) {
        this.otherPlayers[data.id].rect.setAlpha(data.visible ? 1 : 0);
        this.otherPlayers[data.id].glow.setAlpha(data.visible ? 0.3 : 0);
      }
    });

    this.socket.on('force_visible', (data: { id: string, x: number, y: number }) => {
      if (!this.add) return;
      if (data.id !== this.socketId && this.otherPlayers[data.id]) {
        const px = this.OFFSET_X + data.x * (this.TILE_SIZE + this.TILE_SPACING) + this.TILE_SIZE / 2;
        const py = this.OFFSET_Y + data.y * (this.TILE_SIZE + this.TILE_SPACING) + this.TILE_SIZE / 2;
        
        this.otherPlayers[data.id].rect.setAlpha(1);
        this.otherPlayers[data.id].glow.setAlpha(0.3);

        this.tweens.add({
          targets: [this.otherPlayers[data.id].rect, this.otherPlayers[data.id].glow],
          x: px,
          y: py,
          duration: 150,
          ease: 'Back.easeOut'
        });
      }
    });
  }

  addOtherPlayer(id: string, gridX: number, gridY: number, color: number) {
    const px = this.OFFSET_X + gridX * (this.TILE_SIZE + this.TILE_SPACING) + this.TILE_SIZE / 2;
    const py = this.OFFSET_Y + gridY * (this.TILE_SIZE + this.TILE_SPACING) + this.TILE_SIZE / 2;
    
    const glow = this.add.rectangle(px, py, this.TILE_SIZE - 16, this.TILE_SIZE - 16, color, 0.3);
    glow.setDepth(9);
    const rect = this.add.rectangle(px, py, this.TILE_SIZE - 16, this.TILE_SIZE - 16, color);
    rect.setDepth(10);

    this.otherPlayers[id] = { rect, glow };
  }

  applyCaptureVisuals(x: number, y: number, ownerId: string) {
    const tile = this.grid[y][x];
    let captureColor = this.playerColors[ownerId] || 0x00fbfb;
    
    tile.rect.setFillStyle(captureColor, 0.15);
    tile.rect.setStrokeStyle(1, captureColor, 1);
    tile.progressRect.width = 0;
    tile.progressRect.setFillStyle(captureColor);
    
    this.tweens.add({
      targets: tile.rect,
      alpha: 0.5,
      yoyo: true,
      duration: 150,
      onComplete: () => tile.rect.setAlpha(1)
    });
  }

  movePlayer(dx: number, dy: number) {
    if (!this.isInitialized || this.isMoving || this.isFighting || this.isPopupOpen) return;

    const newX = this.playerGridX + dx;
    const newY = this.playerGridY + dy;

    if (newX >= 0 && newX < this.GRID_SIZE && newY >= 0 && newY < this.GRID_SIZE) {
      const currentTile = this.grid[this.playerGridY][this.playerGridX];
      if (currentTile.owner !== this.socketId) {
        currentTile.captureProgress = 0;
        currentTile.progressRect.width = 0;
      }

      this.playerGridX = newX;
      this.playerGridY = newY;
      
      this.socket.emit('move', { x: newX, y: newY });
      this.updatePlayerPosition();
      
      window.dispatchEvent(new CustomEvent('player-pos', { detail: { x: this.playerGridX, y: this.playerGridY } }));
    }
  }

  updatePlayerPosition() {
    this.isMoving = true;
    const px = this.OFFSET_X + this.playerGridX * (this.TILE_SIZE + this.TILE_SPACING) + this.TILE_SIZE / 2;
    const py = this.OFFSET_Y + this.playerGridY * (this.TILE_SIZE + this.TILE_SPACING) + this.TILE_SIZE / 2;
    
    this.tweens.add({
      targets: [this.player, this.playerGlow],
      x: px,
      y: py,
      duration: this.moveDelay,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.isMoving = false;
      }
    });
  }

  update(time: number, delta: number) {
    if (!this.isInitialized || this.isMoving || this.isFighting || this.isPopupOpen) return;

    const currentTile = this.grid[this.playerGridY][this.playerGridX];
    
    if (currentTile.owner !== this.socketId && currentTile.type !== 'shrinking') {
      currentTile.captureProgress += delta;
      
      const progressRatio = Math.min(currentTile.captureProgress / this.captureTime, 1);
      currentTile.progressRect.width = this.TILE_SIZE * progressRatio;

      if (currentTile.captureProgress >= this.captureTime) {
        // Send capture request. Server will validate and send back tileCaptured.
        this.socket.emit('capture', { x: this.playerGridX, y: this.playerGridY });
        
        // Reset local progress immediately to prevent double-firing
        currentTile.captureProgress = 0;
        currentTile.progressRect.width = 0;
      }
    }
  }
}
