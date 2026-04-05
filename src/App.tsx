import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { gameConfig } from './game/config';

export default function App() {
  const gameRef = useRef<Phaser.Game | null>(null);
  
  const [energy, setEnergy] = useState(0);
  const maxEnergyReached = useRef(0);
  const pickedEvoCount = useRef(0);
  const [chaosSeconds, setChaosSeconds] = useState(35);
  const [gameSeconds, setGameSeconds] = useState(0);
  const [playerPos, setPlayerPos] = useState({ x: 1, y: 1 });
  const [activeTab, setActiveTab] = useState('energy');
  const [activeAction, setActiveAction] = useState('scan');
  const [hp, setHp] = useState(100);
  const [maxHp, setMaxHp] = useState(100);
  const [operatorName, setOperatorName] = useState('CONNECTING...');
  const [playerCount, setPlayerCount] = useState(1);
  const [isEliminated, setIsEliminated] = useState(false);
  const [isWinner, setIsWinner] = useState(false);
  const [showEvolutionPopup, setShowEvolutionPopup] = useState(false);
  const [evolutionOptions, setEvolutionOptions] = useState<any[]>([]);

  const [pickedEvolutions, setPickedEvolutions] = useState<string[]>([]);

  const EVOLUTION_POOL = [
    { name: 'KINETIC DASH', desc: 'movementSpeed + 30%, damage - 10%' },
    { name: 'TANK MODE', desc: 'maxHP + 40%, movementSpeed - 20%' },
    { name: 'BERSERKER', desc: 'damage + 40%, maxHP - 15%' },
    { name: 'VAMPIRE', desc: 'heal 10% of damage dealt' },
    { name: 'GHOST', desc: 'invisible 3s every 15s' },
    { name: 'ARCHITECT', desc: 'captureSpeed + 50%, damage - 10%' }
  ];

  const triggerEvolution = () => {
    if (pickedEvolutions.length >= 3) return;
    const shuffled = [...EVOLUTION_POOL].sort(() => 0.5 - Math.random());
    setEvolutionOptions(shuffled.slice(0, 2));
    setShowEvolutionPopup(true);
    window.dispatchEvent(new CustomEvent('popup-state', { detail: true }));
  };

  const pickEvolution = (evoName: string) => {
    setShowEvolutionPopup(false);
    setPickedEvolutions(prev => [...prev, evoName]);
    pickedEvoCount.current++;
    window.dispatchEvent(new CustomEvent('popup-state', { detail: false }));
    window.dispatchEvent(new CustomEvent('pick-evolution', { detail: evoName }));
  };

  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(gameConfig);
    }

    const handleEnergyUpdate = (e: any) => {
      setEnergy(prev => {
        const newEnergy = e.detail;
        if (newEnergy > maxEnergyReached.current) {
          if (Math.floor(newEnergy / 3) > Math.floor(maxEnergyReached.current / 3)) {
            if (pickedEvoCount.current < 3) {
              triggerEvolution();
            }
          }
          maxEnergyReached.current = newEnergy;
        }
        return newEnergy;
      });
    };
    const handlePosUpdate = (e: any) => setPlayerPos(e.detail);
    const handlePlayerInit = (e: any) => setOperatorName(e.detail.name);
    const handlePlayerCount = (e: any) => setPlayerCount(e.detail);
    const handleHpUpdate = (e: any) => {
      if (e.detail.hp !== undefined) setHp(e.detail.hp);
      if (e.detail.maxHP !== undefined) setMaxHp(e.detail.maxHP);
    };
    const handleEliminated = () => setIsEliminated(true);
    const handleGameOver = (e: any) => {
      if (e.detail.winner) {
        setIsWinner(true);
      }
    };

    window.addEventListener('energy-update', handleEnergyUpdate);
    window.addEventListener('player-pos', handlePosUpdate);
    window.addEventListener('player-init', handlePlayerInit);
    window.addEventListener('player-count', handlePlayerCount);
    window.addEventListener('hp-update', handleHpUpdate);
    window.addEventListener('player-eliminated', handleEliminated);
    window.addEventListener('game-over', handleGameOver);

    return () => {
      window.removeEventListener('energy-update', handleEnergyUpdate);
      window.removeEventListener('player-pos', handlePosUpdate);
      window.removeEventListener('player-init', handlePlayerInit);
      window.removeEventListener('player-count', handlePlayerCount);
      window.removeEventListener('hp-update', handleHpUpdate);
      window.removeEventListener('player-eliminated', handleEliminated);
      window.removeEventListener('game-over', handleGameOver);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setChaosSeconds(prev => {
        if (prev <= 1) {
          window.dispatchEvent(new CustomEvent('chaos-fire'));
          return 35;
        }
        return prev - 1;
      });
      setGameSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };



  return (
    <>
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-4 md:px-6 h-16 bg-[#131313] shadow-[0_0_15px_rgba(0,251,251,0.1)] border-b-0">
        <div className="flex items-center space-x-4 md:space-x-8">
          <h1 className="text-xl md:text-2xl font-black tracking-tighter text-[#00FBFB] font-headline">GRIDFALL</h1>
          <div className="hidden md:flex items-center space-x-6">
            <div className="flex flex-col">
              <span className="text-[10px] text-outline font-headline uppercase tracking-widest">System Status</span>
              <span className="text-xs font-bold text-[#00FBFB] font-headline uppercase tracking-widest">GRIDFALL LIVE</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4 md:space-x-12">
          <div className="hidden sm:flex items-center space-x-8">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-outline font-headline uppercase tracking-widest">Game Time</span>
              <span className="text-sm font-bold text-on-surface font-headline tracking-tighter">{formatTime(gameSeconds)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-outline font-headline uppercase tracking-widest">Active Players</span>
              <span className="text-sm font-bold text-on-surface font-headline tracking-tighter">{playerCount}/5</span>
            </div>
          </div>

        </div>
      </header>

      <aside className="hidden lg:flex fixed left-0 top-16 h-[calc(100%-128px)] z-40 flex-col w-64 bg-[#1C1B1B]">
        <div className="p-6 border-b border-outline-variant/10">
          <h2 className="text-[#00FBFB] font-black font-headline text-lg truncate">{operatorName}</h2>
          <p className={`text-[10px] font-headline uppercase tracking-[0.2em] ${isEliminated ? 'text-error' : 'text-outline'}`}>
            STATUS: {isEliminated ? 'ELIMINATED' : 'ACTIVE'}
          </p>
        </div>

        <div className="p-4 bg-error-container/20 border-b border-error-container/30">
          <div className="flex items-center space-x-2 text-error">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span className="text-[10px] font-headline uppercase tracking-widest">Chaos Event</span>
          </div>
          <div className="mt-1 text-xl font-black font-headline text-error tracking-tighter uppercase">
            T-MINUS {chaosSeconds}S
          </div>
        </div>

        <div className="p-6 space-y-8 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[10px] text-outline font-headline uppercase tracking-widest">Integrity (HP)</span>
              <span className="text-xs font-bold text-[#00FBFB] font-headline">{Math.floor(hp)}/{Math.floor(maxHp)}</span>
            </div>
            <div className="h-2 bg-surface-container-highest flex">
              <div className="bg-[#00FBFB] h-full transition-all duration-300" style={{ width: `${Math.min(100, (hp / maxHp) * 100)}%` }}></div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[10px] text-outline font-headline uppercase tracking-widest">Core Energy</span>
              <span className="text-xs font-bold text-on-surface font-headline">{energy}/36</span>
            </div>
            <div className="h-1 bg-surface-container-highest flex">
              <div className="bg-[#00FBFB] h-full transition-all duration-300" style={{ width: `${Math.min(100, (energy / 36) * 100)}%` }}></div>
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-[10px] text-outline font-headline uppercase tracking-widest">Active Evolutions</span>
            <div className="flex flex-col gap-2">
              {pickedEvolutions.length === 0 ? (
                <div className="p-3 border bg-surface-container-highest/30 border-outline-variant/20 flex items-center justify-center">
                  <span className="text-[10px] font-black tracking-widest uppercase text-outline-variant/50">NONE</span>
                </div>
              ) : (
                pickedEvolutions.map((evo, idx) => (
                  <div key={idx} className="p-3 border bg-[#00FBFB]/10 border-[#00FBFB] flex items-center justify-between transition-colors">
                    <span className="text-[10px] font-bold text-[#00FBFB]">0{idx + 1}</span>
                    <span className="text-[10px] font-black tracking-widest uppercase text-white">{evo}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </aside>

      <main className="ml-0 lg:ml-64 mt-16 relative h-[calc(100vh-64px)] lg:w-[calc(100%-256px)] flex items-center justify-center overflow-hidden px-4">
        <div className="absolute inset-0 scanline opacity-20 pointer-events-none z-50"></div>
        
        {isEliminated && !isWinner && (
          <div className="absolute inset-0 bg-error/20 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="text-center flex flex-col items-center">
              <h2 className="text-4xl md:text-6xl font-black text-error font-headline tracking-tighter uppercase mb-2">SYSTEM FAILURE</h2>
              <p className="text-outline font-headline tracking-widest uppercase mb-8">Operator Eliminated</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-8 py-4 border-2 border-error text-error font-black tracking-widest uppercase hover:bg-error/20 transition-colors"
              >
                PLAY AGAIN
              </button>
            </div>
          </div>
        )}

        {isWinner && (
          <div className="absolute inset-0 bg-[#00FBFB]/20 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="text-center flex flex-col items-center">
              <h2 className="text-4xl md:text-6xl font-black text-[#00FBFB] font-headline tracking-tighter uppercase mb-2">VICTORY</h2>
              <p className="text-outline font-headline tracking-widest uppercase mb-8">Grid Secured</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-8 py-4 border-2 border-[#00FBFB] text-[#00FBFB] font-black tracking-widest uppercase hover:bg-[#00FBFB]/20 transition-colors"
              >
                PLAY AGAIN
              </button>
            </div>
          </div>
        )}

        {showEvolutionPopup && (
          <div className="absolute inset-0 bg-[#131313]/80 z-50 flex items-center justify-center backdrop-blur-md p-4">
            <div className="bg-[#1C1B1B] border border-[#00FBFB]/30 p-6 md:p-8 max-w-lg w-full shadow-[0_0_30px_rgba(0,251,251,0.15)]">
              <h2 className="text-2xl md:text-3xl font-black text-[#00FBFB] font-headline tracking-tighter uppercase mb-2 text-center">EVOLUTION AVAILABLE</h2>
              <p className="text-outline font-headline tracking-widest uppercase text-xs text-center mb-8">Select enhancement protocol</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {evolutionOptions.map((opt, idx) => (
                  <button 
                    key={idx}
                    onClick={() => pickEvolution(opt.name)}
                    className="p-4 border border-outline-variant/30 hover:border-[#00FBFB] hover:bg-[#00FBFB]/10 transition-all text-left group flex flex-col h-full"
                  >
                    <span className="text-[#00FBFB] font-black font-headline text-lg mb-2 group-hover:scale-105 transition-transform origin-left">{opt.name}</span>
                    <span className="text-xs text-outline-variant font-headline uppercase tracking-wider leading-relaxed">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        
        <div className="hidden md:flex absolute bottom-8 left-8 items-center space-x-4 z-40">
          <div className="flex space-x-1">
            {['W', 'A', 'S', 'D'].map(key => (
              <div key={key} className="w-8 h-8 border border-outline-variant flex items-center justify-center text-xs font-black text-[#00FBFB] bg-surface-container-high">
                {key}
              </div>
            ))}
          </div>
          <span className="text-[10px] text-outline font-headline uppercase tracking-[0.3em]">To Move Unit</span>
        </div>
        
        <div className="absolute top-4 left-4 md:top-8 md:left-8 z-40">
          <div className="flex flex-col">
            <span className="text-[10px] text-outline font-headline uppercase tracking-widest">Coordinates</span>
            <span className="text-xs font-bold text-[#00FBFB] font-headline">SEC_4 / POS_{playerPos.x},{playerPos.y}</span>
          </div>
        </div>

        <div className="relative z-10 p-1 md:p-2 bg-surface-container-lowest border border-outline-variant/10 shadow-2xl w-full max-w-[424px] aspect-square flex items-center justify-center">
          <div id="game-container" className="w-full h-full" />
        </div>

        <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-outline-variant/5 pointer-events-none z-0"></div>
        <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-outline-variant/5 rounded-full pointer-events-none z-0"></div>
      </main>


    </>
  );
}
