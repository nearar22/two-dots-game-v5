import React, { useState, useEffect, useRef } from 'react';
import { Bomb, Shuffle, Plus, Star, Trophy, Zap } from 'lucide-react';

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
const MOVES_LIMIT = 30;
const MAX_LEVELS = 10;
const GAME_MODES = { Classic: 'Classic', Daily: 'Daily', Robo: 'PvP', RoboTimed: 'PvP (Timed)', Speed: 'Speed' };

function TwoDotsGame() {
  const [grid, setGrid] = useState([]);
  const [selectedDots, setSelectedDots] = useState([]);
  const [score, setScore] = useState(0);
  const [roboScore, setRoboScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [moves, setMoves] = useState(MOVES_LIMIT);
  const [gameOver, setGameOver] = useState(false);
  const [targets, setTargets] = useState({});
  const [collected, setCollected] = useState({});
  const [level, setLevel] = useState(1);
  const [levelComplete, setLevelComplete] = useState(false);
  const [gridSize, setGridSize] = useState(4);
  const [gameWon, setGameWon] = useState(false);
  const [gameMode, setGameMode] = useState(GAME_MODES.Classic);
  const [combo, setCombo] = useState(0);
  const [powerUps, setPowerUps] = useState({ bomb: 2, shuffle: 1, extraMoves: 1 });
  const [stars, setStars] = useState(0);
  const [explosions, setExplosions] = useState([]);
  const [poppingDots, setPoppingDots] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [paused, setPaused] = useState(false);
  // Matchmaking overlay for PvP
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [matchmakingSeconds, setMatchmakingSeconds] = useState(3);
  const [matchmakingRemaining, setMatchmakingRemaining] = useState(0);
  const [opponentFound, setOpponentFound] = useState(false);
  const [searchRemaining, setSearchRemaining] = useState(0);
  // PvP rules selection and targets
  const [showRuleSelect, setShowRuleSelect] = useState(false);
  const [pvpRule, setPvpRule] = useState(null); // 'level' | 'score' | null
  const pvpTargetLevel = 3;
  const pvpTargetScore = 2000;
  const [roboLevel, setRoboLevel] = useState(1);
  const [toasts, setToasts] = useState([]);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showMenu, setShowMenu] = useState(true);
  const [menuView, setMenuView] = useState('home'); // 'home' | 'select'
  const [showHowTo, setShowHowTo] = useState(false);
  const [speedLevel, setSpeedLevel] = useState(1);
  const [baseMoveTime, setBaseMoveTime] = useState(8);
  const [timeLeft, setTimeLeft] = useState(8);
  const [matchBaseTime, setMatchBaseTime] = useState(45);
  const [matchTimeLeft, setMatchTimeLeft] = useState(45);
  const [duelResult, setDuelResult] = useState(null);
  // Wallet & payment
  const [walletAddress, setWalletAddress] = useState(null);
  const [fid, setFid] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [txPending, setTxPending] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('');

  const DEV_WALLET = import.meta.env.VITE_DEV_WALLET || '0xYourDevWalletHere';
  const WEI_0_00001_ETH = 10000000000000n; // 0.00001 ETH in wei
  const shortAddr = (addr) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';
  const isDevWalletConfigured = () => DEV_WALLET && DEV_WALLET.startsWith('0x') && DEV_WALLET.length === 42 && !DEV_WALLET.includes('YourDevWallet');
  const getPaymentRecipient = () => (isDevWalletConfigured() ? DEV_WALLET : walletAddress);
  // Lock winner synchronously to avoid race conditions between player and robo updates
  const duelLockedRef = useRef(null); // 'player' | 'robo' | null
  // Attempt to lock winner deterministically for PvP Score race
  const attemptLockWinner = (source, nextScoreCandidate = null) => {
    if (gameMode !== GAME_MODES.Robo || pvpRule !== 'score') return;
    if (gameOver || levelComplete || gameWon || showMenu) return;
    if (duelLockedRef.current || duelResult !== null) return;
    const playerNext = source === 'player' && nextScoreCandidate != null ? nextScoreCandidate : score;
    const roboNext = source === 'robo' && nextScoreCandidate != null ? nextScoreCandidate : roboScore;
    const playerHits = playerNext >= pvpTargetScore;
    const roboHits = roboNext >= pvpTargetScore;
    if (!playerHits && !roboHits) return;
    let winner;
    if (playerHits && roboHits) {
      winner = source;
    } else if (playerHits) {
      winner = 'player';
    } else {
      winner = 'robo';
    }
    duelLockedRef.current = winner;
    setDuelResult(winner);
    setGameOver(true);
    setCombo(0);
  };
  const [opponentName, setOpponentName] = useState('');
  const [pvpPlayerRounds, setPvpPlayerRounds] = useState(0);
  const [pvpRoboRounds, setPvpRoboRounds] = useState(0);
  const [pvpRound, setPvpRound] = useState(1);

  const randFnRef = useRef(() => Math.random());

  // Seeded PRNG for Daily mode
  const mulberry32 = (a) => {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const getDailySeed = (lvl = 1) => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return parseInt(`${y}${String(m).padStart(2,'0')}${String(day).padStart(2,'0')}${String(lvl).padStart(2,'0')}`);
  };

  // Opponent name generator for PvP modes (European names)
  const OPPONENT_NAMES = [
    'Luca','Giulia','Marco','Chiara','Sofia','Elena',
    'Hugo','Chloe','Louis','Camille','Pierre','Amelie',
    'Theo','Antoine','Julia','Peter','Lukas','Marta',
    'Pablo','Miguel','Joao','Ines','Tomas','Zofia'
  ];
  const getRandomOpponentName = () => OPPONENT_NAMES[Math.floor(Math.random() * OPPONENT_NAMES.length)];

  // Helper: consistently decide winner given player/opponent scores
  const decideWinner = (playerScore, opponentScore) => (
    playerScore > opponentScore ? 'player' : (opponentScore > playerScore ? 'robo' : 'draw')
  );

  useEffect(() => {
    initializeGrid();
    const saved = localStorage.getItem('twodots_highscore');
    if (saved) setHighScore(parseInt(saved));
    // Enable debug when query param matches key or saved key exists
    const expected = import.meta.env.VITE_DEBUG_KEY || 'twodots-dev';
    const params = new URLSearchParams(window.location.search);
    const key = params.get('debug');
    if (key && key === expected) {
      localStorage.setItem('twodots_debug_key', key);
      setDebugEnabled(true);
    } else {
      const savedKey = localStorage.getItem('twodots_debug_key');
      if (savedKey && savedKey === expected) setDebugEnabled(true);
    }
  }, []);

  // Farcaster Miniapp SDK: import dynamically and signal readiness
  useEffect(() => {
    (async () => {
      try {
        const mod = await import('https://esm.sh/@farcaster/miniapp-sdk');
        const sdk = mod?.sdk ?? mod?.default ?? mod;
        if (sdk?.actions?.ready) {
          sdk.actions.ready();
          // Optional: expose for debugging/inspection
          window.__farcasterMiniappSDK = sdk;
          // Try to extract FID safely
          const tryGetFid = async () => {
            try {
              if (typeof sdk?.actions?.getFid === 'function') {
                const f = await sdk.actions.getFid();
                if (typeof f === 'number' || typeof f === 'string') { setFid(f); return; }
              }
              const fields = [sdk?.user?.fid, sdk?.context?.fid, sdk?.state?.user?.fid];
              for (const val of fields) {
                if (typeof val === 'number' || typeof val === 'string') { setFid(val); return; }
              }
            } catch {}
          };
          tryGetFid();
        }
      } catch (err) {
        console.warn('Farcaster Miniapp SDK load/ready failed:', err);
      }
    })();
  }, []);

  // Connect wallet via Farcaster or window.ethereum
  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      setPaymentStatus('');
      const sdk = window.__farcasterMiniappSDK;
      // Prefer window.ethereum
      const eth = window.ethereum || sdk?.ethereum || sdk?.wallet?.ethereum || null;
      if (!eth) {
        setPaymentStatus('⚠️ No wallet provider found. Install MetaMask or use Farcaster Miniapp.');
        return;
      }
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0]);
      }
      // Try read FID if available (safe types)
      try {
        if (typeof sdk?.actions?.getFid === 'function') {
          const f = await sdk.actions.getFid();
          if (typeof f === 'number' || typeof f === 'string') setFid(f);
        } else {
          const fields = [sdk?.user?.fid, sdk?.context?.fid, sdk?.state?.user?.fid];
          for (const val of fields) {
            if (typeof val === 'number' || typeof val === 'string') { setFid(val); break; }
          }
        }
      } catch {}
    } catch (err) {
      console.warn('connectWallet error:', err);
      setPaymentStatus(`❌ Connect failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const sleep = (ms) => new Promise(res => setTimeout(res, ms));
  const waitForReceipt = async (eth, hash, tries = 20, intervalMs = 1500) => {
    for (let i = 0; i < tries; i++) {
      try {
        const receipt = await eth.request({ method: 'eth_getTransactionReceipt', params: [hash] });
        if (receipt) return receipt;
      } catch (e) {}
      await sleep(intervalMs);
    }
    return null;
  };

  const payAndStartGame = async () => {
    try {
      setPaymentStatus('');
      if (!walletAddress) {
        await connectWallet();
        if (!walletAddress) return;
      }
      const sdk = window.__farcasterMiniappSDK;
      const eth = window.ethereum || sdk?.ethereum || sdk?.wallet?.ethereum || null;
      if (!eth) {
        setPaymentStatus('⚠️ No wallet provider found.');
        return;
      }
      // If DEV wallet not configured (e.g., on Vercel), fallback to self-payment for testing
      if (!isDevWalletConfigured()) {
        setPaymentStatus('⚠️ VITE_DEV_WALLET ما مضبوطاش فـ .env ديال Vercel. غادي نرسل الدفع لعنوان محفظتك باش التجربة تكمل.');
      }
      // Ensure we are on Base mainnet (chainId 0x2105)
      try {
        const BASE_CHAIN_ID = '0x2105';
        let chainId = await eth.request({ method: 'eth_chainId' });
        if (chainId !== BASE_CHAIN_ID) {
          setPaymentStatus('🔄 Switching to Base network…');
          try {
            await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
            chainId = BASE_CHAIN_ID;
          } catch (switchErr) {
            try {
              await eth.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: BASE_CHAIN_ID,
                  chainName: 'Base',
                  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['https://mainnet.base.org'],
                  blockExplorerUrls: ['https://basescan.org']
                }]
              });
              await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
              chainId = BASE_CHAIN_ID;
            } catch (addErr) {
              console.warn('Failed to switch/add Base network:', addErr);
              setPaymentStatus('⚠️ Could not switch to Base network. Please switch manually in your wallet.');
              return;
            }
          }
        }
      } catch (chainErr) {
        console.warn('chainId check/switch failed:', chainErr);
      }
      const valueHex = '0x' + WEI_0_00001_ETH.toString(16);
      const toAddr = getPaymentRecipient();
      if (!toAddr) {
        setPaymentStatus('❌ No recipient address available.');
        return;
      }
      setTxPending(true);
      const txHash = await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from: walletAddress, to: toAddr, value: valueHex }]
      });
      setTxHash(txHash);
      setPaymentStatus('⏳ Payment sent. اختر الوضع Classic/PvP/Speed…');
      // Go to mode selection menu immediately
      setMenuView('select');
      setShowHowTo(false);
      setShowMenu(true);
      const receipt = await waitForReceipt(eth, txHash);
      if (!receipt) {
        setPaymentStatus('⚠️ Payment pending. التأكيد قريباً…');
        return;
      }
      setPaymentStatus('✅ Payment confirmed! Enjoy the game.');
    } catch (err) {
      console.warn('payAndStartGame error:', err);
      setPaymentStatus(`❌ Payment failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setTxPending(false);
    }
  };

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('twodots_highscore', score.toString());
    }
  }, [score, highScore]);

  // Prevent page scroll while dragging/selecting
  useEffect(() => {
    if (isDragging) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow || '';
      };
    }
  }, [isDragging]);

  useEffect(() => {
    const expected = import.meta.env.VITE_DEBUG_KEY || 'twodots-dev';
    const onKey = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        if (!debugEnabled) {
          const input = window.prompt('Enter debug key');
          if (input === expected) {
            localStorage.setItem('twodots_debug_key', input);
            setDebugEnabled(true);
          }
        }
        setShowDebug((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [debugEnabled]);

  const forceCompleteLevel = () => {
    // Mark all targets as collected and set level complete
    const newCollected = { ...collected };
    Object.keys(targets).forEach((c) => {
      newCollected[c] = targets[c];
    });
    setCollected(newCollected);
    const movesLeft = moves; // don't consume a move for debug
    setStars(movesLeft > MOVES_LIMIT * 0.5 ? 3 : movesLeft > MOVES_LIMIT * 0.25 ? 2 : 1);
    setLevelComplete(true);
  };

  const winGame = () => {
    setLevel(MAX_LEVELS);
    setGameWon(true);
    setLevelComplete(false);
  };

  const addMoves = (n = 10) => setMoves(moves + n);
  const addScore = (n = 100) => {
    setScore(prev => {
      const next = prev + n;
      attemptLockWinner('player', next);
      return next;
    });
  };
  const disableDebug = () => {
    localStorage.removeItem('twodots_debug_key');
    setDebugEnabled(false);
    setShowDebug(false);
  };


  const initializeGrid = (opts = undefined) => {
    const keepPvp = !!(opts && typeof opts === 'object' && opts.keepPvp);
    const size = 4;
    // choose random function based on mode
    const rand = gameMode === GAME_MODES.Daily ? mulberry32(getDailySeed(1)) : () => Math.random();
    randFnRef.current = rand;
    const newGrid = [];
    for (let i = 0; i < size; i++) {
      const row = [];
      for (let j = 0; j < size; j++) {
        const R = rand;
        row.push({
          color: COLORS[Math.floor(R() * COLORS.length)],
          row: i, col: j,
          isRainbow: R() > 0.92,
          isGem: R() > 0.95,
          isBomb: R() > 0.97,
          isLightning: R() > 0.96
        });
      }
      newGrid.push(row);
    }
    setGrid(newGrid);
    setGridSize(size);
    setSelectedDots([]);
    setScore(0);
    setRoboScore(0);
    setMoves(MOVES_LIMIT);
    setGameOver(false);
    setLevel(1);
    setLevelComplete(false);
    setGameWon(false);
    setCombo(0);
    setStars(0);
    setPowerUps({ bomb: 2, shuffle: 1, extraMoves: 1 });
    setDuelResult(null);
    duelLockedRef.current = null;
    // reset speed mode state
    setSpeedLevel(1);
    setBaseMoveTime(8);
    setTimeLeft(8);
    if (!keepPvp) {
      setPvpPlayerRounds(0);
      setPvpRoboRounds(0);
      setPvpRound(1);
    }
    
    const shuffledColors = (() => {
      if (gameMode === GAME_MODES.Daily) {
        const R = rand;
        const picked = [];
        const pool = COLORS.slice();
        while (picked.length < 2 && pool.length) {
          const idx = Math.floor(R() * pool.length);
          picked.push(pool.splice(idx, 1)[0]);
        }
        return picked;
      }
      return COLORS.slice().sort(() => Math.random() - 0.5).slice(0, 2);
    })();
    const newTargets = {};
    const newCollected = {};
    shuffledColors.forEach(color => {
      const R = rand;
      newTargets[color] = gameMode === GAME_MODES.Daily ? (Math.floor(R() * 3) + 3) : (Math.floor(Math.random() * 3) + 3);
      newCollected[color] = 0;
    });
    setTargets(newTargets);
    setCollected(newCollected);
  };

  const startNextLevel = () => {
    const newLevel = level + 1;
    if (newLevel > MAX_LEVELS) {
      setGameWon(true);
      return;
    }
    
    // Clamp grid size to avoid overflow and very small dots
    let size = Math.min(4 + (newLevel - 1), 8);
    const rand = gameMode === GAME_MODES.Daily ? mulberry32(getDailySeed(newLevel)) : () => Math.random();
    randFnRef.current = rand;
    const newGrid = [];
    for (let i = 0; i < size; i++) {
      const row = [];
      for (let j = 0; j < size; j++) {
        const R = rand;
        row.push({
          color: COLORS[Math.floor(R() * COLORS.length)],
          row: i, col: j,
          isRainbow: R() > 0.90,
          isGem: R() > 0.93,
          isBomb: R() > 0.95,
          isLightning: R() > 0.94
        });
      }
      newGrid.push(row);
    }
    setGrid(newGrid);
    setGridSize(size);
    setSelectedDots([]);
    setMoves(MOVES_LIMIT);
    setLevelComplete(false);
    setLevel(newLevel);
    setCombo(0);
    
    const numColors = Math.min(2 + Math.floor(newLevel / 3), 5);
    const shuffledColors = (() => {
      if (gameMode === GAME_MODES.Daily) {
        const R = rand;
        const picked = [];
        const pool = COLORS.slice();
        while (picked.length < numColors && pool.length) {
          const idx = Math.floor(R() * pool.length);
          picked.push(pool.splice(idx, 1)[0]);
        }
        return picked;
      }
      return COLORS.slice().sort(() => Math.random() - 0.5).slice(0, numColors);
    })();
    const newTargets = {};
    const newCollected = {};
    shuffledColors.forEach(color => {
      const R = rand;
      newTargets[color] = gameMode === GAME_MODES.Daily ? (Math.floor(R() * 5) + 5 + newLevel * 3) : (Math.floor(Math.random() * 5) + 5 + newLevel * 3);
      newCollected[color] = 0;
    });
    setTargets(newTargets);
    setCollected(newCollected);
  };

  // Start next PvP round (best-of-3). Preserve rounds and opponent.
  const startNextPvpRound = () => {
    setPvpRound(r => r + 1);
    initializeGrid({ keepPvp: true });
  };

  const usePowerUp = (type) => {
    if (paused || powerUps[type] <= 0) return;
    const newPowerUps = {...powerUps};
    newPowerUps[type] = newPowerUps[type] - 1;
    setPowerUps(newPowerUps);
    
    if (type === 'bomb') {
      const centerRow = Math.floor(gridSize / 2);
      const centerCol = Math.floor(gridSize / 2);
      const newGrid = grid.map(row => row.slice());
      for (let i = Math.max(0, centerRow - 1); i <= Math.min(gridSize - 1, centerRow + 1); i++) {
        for (let j = Math.max(0, centerCol - 1); j <= Math.min(gridSize - 1, centerCol + 1); j++) {
          newGrid[i][j] = null;
        }
      }
      applyGravity(newGrid, randFnRef.current);
      setScore(score + 50);
    } else if (type === 'shuffle') {
      const allDots = grid.flat().filter(d => d !== null);
      for (let i = allDots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = allDots[i];
        allDots[i] = allDots[j];
        allDots[j] = temp;
      }
      const newGrid = [];
      let index = 0;
      for (let i = 0; i < gridSize; i++) {
        const row = [];
        for (let j = 0; j < gridSize; j++) {
          if (index < allDots.length) {
            row.push({ ...allDots[index], row: i, col: j });
            index++;
          } else {
            const R = randFnRef.current;
            row.push({
              color: COLORS[Math.floor(R() * COLORS.length)],
              row: i, col: j,
              isRainbow: R() > 0.92,
              isGem: R() > 0.95,
              isBomb: R() > 0.97,
              isLightning: R() > 0.96
            });
          }
        }
        newGrid.push(row);
      }
      setGrid(newGrid);
    } else if (type === 'extraMoves') {
      setMoves(moves + 5);
    }
  };

  const isAdjacent = (dot1, dot2) => Math.abs(dot1.row - dot2.row) + Math.abs(dot1.col - dot2.col) === 1;
  const isDotSelected = (row, col) => selectedDots.some(dot => dot.row === row && dot.col === col);

  // Simple robo move finder: build a short chain of adjacent same-color dots
  const findRoboChain = () => {
    const maxTries = 30;
    for (let t = 0; t < maxTries; t++) {
      const i = Math.floor(Math.random() * gridSize);
      const j = Math.floor(Math.random() * gridSize);
      const start = grid[i]?.[j];
      if (!start) continue;
      const chain = [start];
      const targetColor = start.color;
      const visited = new Set([`${start.row},${start.col}`]);
      for (let step = 0; step < 4; step++) {
        const last = chain[chain.length - 1];
        const neighbors = [
          { r: last.row - 1, c: last.col },
          { r: last.row + 1, c: last.col },
          { r: last.row, c: last.col - 1 },
          { r: last.row, c: last.col + 1 }
        ].filter(n => n.r >= 0 && n.r < gridSize && n.c >= 0 && n.c < gridSize);
        const candidates = neighbors
          .map(n => grid[n.r][n.c])
          .filter(d => d && !visited.has(`${d.row},${d.col}`) && (d.isRainbow || d.color === targetColor));
        if (candidates.length === 0) break;
        const choice = candidates[Math.floor(Math.random() * candidates.length)];
        chain.push(choice);
        visited.add(`${choice.row},${choice.col}`);
        if (chain.length >= 3) break;
      }
      if (chain.length >= 2) return chain;
    }
    return [];
  };

  const isSquare = (dots) => {
    if (dots.length < 4) return false;
    for (let i = 0; i < dots.length - 3; i++) {
      for (let j = i + 1; j < dots.length - 2; j++) {
        for (let k = j + 1; k < dots.length - 1; k++) {
          for (let l = k + 1; l < dots.length; l++) {
            const fourDots = [dots[i], dots[j], dots[k], dots[l]];
            const rows = fourDots.map(d => d.row).sort((a, b) => a - b);
            const cols = fourDots.map(d => d.col).sort((a, b) => a - b);
            if (rows[0] === rows[1] && rows[2] === rows[3] && cols[0] === cols[1] && cols[2] === cols[3]) {
              const positions = new Set(fourDots.map(d => `${d.row},${d.col}`));
              if (positions.size === 4 && positions.has(`${rows[0]},${cols[0]}`) && 
                  positions.has(`${rows[0]},${cols[2]}`) && positions.has(`${rows[2]},${cols[0]}`) && 
                  positions.has(`${rows[2]},${cols[2]}`)) return true;
            }
          }
        }
      }
    }
    return false;
  };

  const handleDotClick = (row, col) => {
    if (gameOver || levelComplete || gameWon || paused) return;
    const clickedDot = grid[row][col];
    if (!clickedDot) return;
    
    if (selectedDots.length === 0) {
      setSelectedDots([clickedDot]);
      return;
    }

    const lastDot = selectedDots[selectedDots.length - 1];
    if (selectedDots.length > 1) {
      const secondLastDot = selectedDots[selectedDots.length - 2];
      if (secondLastDot.row === row && secondLastDot.col === col) {
        setSelectedDots(selectedDots.slice(0, -1));
        return;
      }
    }

    if (isDotSelected(row, col)) return;
    const canConnect = clickedDot.isRainbow || lastDot.isRainbow || clickedDot.color === lastDot.color;
    if (!canConnect || !isAdjacent(clickedDot, lastDot)) return;
    setSelectedDots([...selectedDots, clickedDot]);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    completePath();
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    completePath();
  };

  const completePath = (forRobo = false) => {
    if (paused) return;
    if (selectedDots.length < 2) {
      setSelectedDots([]);
      return;
    }

    const isSquareConnection = isSquare(selectedDots);
    const newGrid = grid.map(row => row.slice());
    const color = selectedDots[0].color;
    let dotsCleared = 0;
    const hasGem = selectedDots.some(d => d.isGem);
    const hasBomb = selectedDots.some(d => d.isBomb);
    const hasLightning = selectedDots.some(d => d.isLightning);
    let multiplier = hasGem ? 3 : (isSquareConnection ? 2 : 1);

    const dotsToRemove = [];
    
    if (hasBomb) {
      selectedDots.filter(d => d.isBomb).forEach(bombDot => {
        for (let i = Math.max(0, bombDot.row - 1); i <= Math.min(gridSize - 1, bombDot.row + 1); i++) {
          for (let j = Math.max(0, bombDot.col - 1); j <= Math.min(gridSize - 1, bombDot.col + 1); j++) {
            if (newGrid[i][j] && !dotsToRemove.some(d => d.row === i && d.col === j)) {
              dotsToRemove.push({ row: i, col: j });
            }
          }
        }
      });
    } else if (hasLightning) {
      selectedDots.filter(d => d.isLightning).forEach(lightDot => {
        for (let i = 0; i < gridSize; i++) {
          if (newGrid[i][lightDot.col] && !dotsToRemove.some(d => d.row === i && d.col === lightDot.col)) {
            dotsToRemove.push({ row: i, col: lightDot.col });
          }
          if (newGrid[lightDot.row][i] && !dotsToRemove.some(d => d.row === lightDot.row && d.col === i)) {
            dotsToRemove.push({ row: lightDot.row, col: i });
          }
        }
      });
    } else if (isSquareConnection) {
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          if (newGrid[i][j] && (newGrid[i][j].color === color || newGrid[i][j].isRainbow)) {
            dotsToRemove.push({ row: i, col: j });
          }
        }
      }
    } else {
      selectedDots.forEach(dot => {
        if (newGrid[dot.row][dot.col]) {
          dotsToRemove.push({ row: dot.row, col: dot.col });
        }
      });
    }

    dotsCleared = dotsToRemove.length;
    setPoppingDots(dotsToRemove);
    setExplosions(dotsToRemove.map(dot => {
      const cx = dot.col * dotSize + dotSize / 2;
      const cy = dot.row * dotSize + dotSize / 2;
      // position explosion beside the dot (jnab), avoid covering selection
      const offsetX = dot.col < gridSize - 1 ? dotSize * 0.35 : -dotSize * 0.35;
      const offsetY = 0;
      return {
        id: Math.random(),
        x: cx + offsetX,
        y: cy + offsetY,
        color: newGrid[dot.row][dot.col]?.color || color
      };
    }));

    setTimeout(() => {
      dotsToRemove.forEach(dot => newGrid[dot.row][dot.col] = null);
      applyGravity(newGrid, randFnRef.current);
      setPoppingDots([]);
    }, 300);
    setTimeout(() => setExplosions([]), 600);

    const pointsEarned = dotsCleared * multiplier * 10 + combo * 5;
    if (forRobo) {
      setRoboScore(rs => {
        const next = rs + pointsEarned;
        attemptLockWinner('robo', next);
        return next;
      });
    } else {
      setScore(prev => {
        const next = prev + pointsEarned;
        attemptLockWinner('player', next);
        return next;
      });
      // Toast points popup near the chain center
      const avgCol = selectedDots.reduce((sum, d) => sum + d.col, 0) / selectedDots.length;
      const avgRow = selectedDots.reduce((sum, d) => sum + d.row, 0) / selectedDots.length;
      const x = Math.floor(avgCol * dotSize + dotSize / 2);
      const y = Math.floor(avgRow * dotSize + dotSize / 2);
      const id = Math.random();
      setToasts(ts => [...ts, { id, x, y, text: `+${pointsEarned}` }]);
      setTimeout(() => {
        setToasts(ts => ts.filter(t => t.id !== id));
      }, 1000);
    }
    setCombo(combo + 1);

    if (!forRobo && targets[color] !== undefined) {
      const newCollected = { ...collected, [color]: Math.min(collected[color] + dotsCleared, targets[color]) };
      setCollected(newCollected);
      if (Object.keys(targets).every(c => newCollected[c] >= targets[c]) && !levelComplete) {
        const movesLeft = moves - 1;
        setStars(movesLeft > MOVES_LIMIT * 0.5 ? 3 : movesLeft > MOVES_LIMIT * 0.25 ? 2 : 1);
        setLevelComplete(true);
      }
    }

    setSelectedDots([]);
    if (!forRobo) {
      setMoves(moves - 1);
      if (gameMode === GAME_MODES.Speed) {
        setTimeLeft(baseMoveTime);
      }
      if (moves - 1 <= 0) {
        if (gameMode === GAME_MODES.Robo && !pvpRule) {
          // End of PvP round: decide round winner
          const finalPlayer = score + pointsEarned;
          const finalRobo = roboScore;
          const result = decideWinner(finalPlayer, finalRobo);
          setDuelResult(result);
          if (result === 'player') setPvpPlayerRounds(r => r + 1);
          else if (result === 'robo') setPvpRoboRounds(r => r + 1);
        }
        setGameOver(true);
        setCombo(0);
      }
    }
  };

  const applyGravity = (newGrid, randFnParam = () => Math.random()) => {
    for (let col = 0; col < newGrid.length; col++) {
      let emptySpaces = 0;
      for (let row = newGrid.length - 1; row >= 0; row--) {
        if (newGrid[row][col] === null) {
          emptySpaces++;
        } else if (emptySpaces > 0) {
          newGrid[row + emptySpaces][col] = { ...newGrid[row][col], row: row + emptySpaces };
          newGrid[row][col] = null;
        }
      }
      for (let row = 0; row < emptySpaces; row++) {
        const R = randFnParam;
        newGrid[row][col] = {
          color: COLORS[Math.floor(R() * COLORS.length)],
          row, col,
          isRainbow: R() > 0.92,
          isGem: R() > 0.95,
          isBomb: R() > 0.97,
          isLightning: R() > 0.96
        };
      }
    }
    setGrid(newGrid);
  };

  // Calculate responsive dot size based on available width AND height
  const getDotSize = (gs = gridSize) => {
    const cardMaxWidth = 768; // Tailwind max-w-3xl ≈ 768px
    const gridViewportEl = document.querySelector('.grid-viewport');
    const containerEl = document.querySelector('.game-container');
    const isMobile = window.innerWidth < 640;
    const gridGap = isMobile ? 4 : 8; // match Tailwind gap-1 (4px) / sm:gap-2 (8px)

    const containerWidth = containerEl?.clientWidth || Math.min(window.innerWidth, cardMaxWidth);
    const availWidth = gridViewportEl?.clientWidth || containerWidth;
    const availHeight = gridViewportEl?.clientHeight || Math.max(320, Math.floor(window.innerHeight * 0.5));

    const sizeByWidth = Math.floor((availWidth - gridGap * (gs - 1)) / gs);
    const sizeByHeight = Math.floor((availHeight - gridGap * (gs - 1)) / gs);

    const size = Math.min(sizeByWidth, sizeByHeight, 64);
    return Math.max(24, size);
  };

  const [dotSize, setDotSize] = useState(getDotSize(gridSize));
  const gridRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setDotSize(getDotSize(gridSize));
    };
    // initial calculation after mount
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridSize]);

  // Recompute dotSize whenever the grid viewport resizes
  useEffect(() => {
    const el = document.querySelector('.grid-viewport');
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setDotSize(getDotSize(gridSize)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridSize]);

  // Fallback: derive grid cell by pointer coordinates if elementFromPoint fails
  // Read current grid gap (px); fallback to Tailwind defaults
  const getGridGapPx = () => {
    const el = gridRef.current;
    const isMobile = window.innerWidth < 640;
    if (!el) return isMobile ? 4 : 8;
    const styles = window.getComputedStyle(el);
    const colGap = parseFloat(styles.getPropertyValue('column-gap'));
    const rowGap = parseFloat(styles.getPropertyValue('row-gap'));
    const g = Math.max(isNaN(colGap) ? 0 : colGap, isNaN(rowGap) ? 0 : rowGap);
    return g || (isMobile ? 4 : 8);
  };

  const getGridCellFromPoint = (clientX, clientY) => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    const gridGap = getGridGapPx();
    const cellSpan = dotSize + gridGap;
    const col = Math.floor(x / cellSpan);
    const row = Math.floor(y / cellSpan);
    if (row < 0 || col < 0 || row >= gridSize || col >= gridSize) return null;
    return { row, col };
  };

  // Robo plays periodically (Robo & Robo Timed). Faster with higher speedLevel in Robo Timed.
  useEffect(() => {
    if (gameMode !== GAME_MODES.Robo && gameMode !== GAME_MODES.RoboTimed) return;
    const base = 2500;
    const step = 200;
    const intervalMs = gameMode === GAME_MODES.RoboTimed ? Math.max(800, base - (speedLevel - 1) * step) : base;
    const id = setInterval(() => {
      if (isDragging || selectedDots.length > 0 || gameOver || levelComplete || gameWon || showMenu || paused) return;
      const chain = findRoboChain();
      if (chain.length >= 2) {
        // Invisible robo move: only update roboScore, do not modify grid or selection
        const hasGem = chain.some(d => d.isGem);
        const multiplier = hasGem ? 3 : 1;
        const points = chain.length * multiplier * 10;
        setRoboScore(rs => rs + points);
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [gameMode, grid, isDragging, selectedDots, gameOver, levelComplete, gameWon, showMenu, speedLevel, paused]);

  // Speed Mode: increase speed every 10s and penalize idle time
  useEffect(() => {
    if (gameMode !== GAME_MODES.Speed) return;
    setSpeedLevel(1);
    setBaseMoveTime(8);
    setTimeLeft(8);
    const incId = setInterval(() => {
      setSpeedLevel(s => Math.min(s + 1, 10));
      setBaseMoveTime(t => Math.max(3, t - 1));
    }, 10000);
    const tickId = setInterval(() => {
      setTimeLeft(prev => {
        if (gameOver || levelComplete || gameWon || showMenu || paused) return prev;
        const nt = prev - 0.25;
        if (nt <= 0) {
          // Time's up -> immediate loss in Speed mode
          setGameOver(true);
          setCombo(0);
          return baseMoveTime;
        }
        return nt;
      });
    }, 250);
    return () => { clearInterval(incId); clearInterval(tickId); };
  }, [gameMode, baseMoveTime, gameOver, levelComplete, gameWon, showMenu, paused]);

  // Robo Timed: shared match timer and speed up every 10s
  useEffect(() => {
    if (gameMode !== GAME_MODES.RoboTimed) return;
    setSpeedLevel(1);
    setMatchBaseTime(45);
    setMatchTimeLeft(45);
    setDuelResult(null);
    const incId = setInterval(() => {
      setSpeedLevel(s => Math.min(s + 1, 10));
    }, 10000);
    const tickId = setInterval(() => {
      setMatchTimeLeft(prev => {
        if (gameOver || levelComplete || gameWon || showMenu || paused) return prev;
        const nt = prev - 0.25;
        if (nt <= 0) {
          // Time's up -> decide winner
          setGameOver(true);
          setCombo(0);
          setDuelResult(score > roboScore ? 'player' : roboScore > score ? 'robo' : 'draw');
          return 0;
        }
        return nt;
      });
    }, 250);
    return () => { clearInterval(incId); clearInterval(tickId); };
  }, [gameMode, gameOver, levelComplete, gameWon, showMenu, score, roboScore, paused]);

  // Robo plays periodically (Robo & Robo Timed). Faster tick in Robo to feel active.
  useEffect(() => {
    if (gameMode !== GAME_MODES.Robo && gameMode !== GAME_MODES.RoboTimed) return;
    const base = gameMode === GAME_MODES.Robo ? 1500 : 2500;
    const step = 200;
    const intervalMs = gameMode === GAME_MODES.RoboTimed ? Math.max(800, base - (speedLevel - 1) * step) : base;
    const id = setInterval(() => {
      if (isDragging || selectedDots.length > 0 || gameOver || levelComplete || gameWon || showMenu || paused) return;
      const chain = findRoboChain();
      if (chain.length >= 2) {
        const hasGem = chain.some(d => d.isGem);
        const multiplier = hasGem ? 3 : 1;
        const points = chain.length * multiplier * 10;
        setRoboScore(rs => {
          const next = rs + points;
          attemptLockWinner('robo', next);
          return next;
        });
      } else {
        // tiny fallback progress so bot never feels idle
        setRoboScore(rs => {
          const next = rs + 5;
          attemptLockWinner('robo', next);
          return next;
        });
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [gameMode, grid, isDragging, selectedDots, gameOver, levelComplete, gameWon, showMenu, speedLevel, paused]);

  // PvP Matchmaking: search phase (7–10s), then reveal opponent and start countdown
  useEffect(() => {
    if (!showMatchmaking || opponentFound) return;
    const t = setInterval(() => {
      setSearchRemaining(prev => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(t);
          setOpponentFound(true);
          setMatchmakingRemaining(matchmakingSeconds);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [showMatchmaking, opponentFound, matchmakingSeconds]);

  // PvP Matchmaking: start countdown after opponent is found
  useEffect(() => {
    if (!showMatchmaking || !opponentFound) return;
    const t = setInterval(() => {
      setMatchmakingRemaining(prev => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(t);
          setShowMatchmaking(false);
          initializeGrid();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [showMatchmaking, opponentFound]);

  // PvP Rule: Score race — first to reach target score wins
  useEffect(() => {
    if (gameMode !== GAME_MODES.Robo || !pvpRule || pvpRule !== 'score') return;
    if (gameOver || levelComplete || gameWon || showMenu) return;
    if (duelResult !== null || duelLockedRef.current) return; // locked by player/robo update
    if (score >= pvpTargetScore || roboScore >= pvpTargetScore) {
      duelLockedRef.current = score >= pvpTargetScore ? 'player' : 'robo';
      setDuelResult(score >= pvpTargetScore ? 'player' : 'robo');
      setGameOver(true);
      setCombo(0);
    }
  }, [gameMode, pvpRule, score, roboScore, gameOver, levelComplete, gameWon, showMenu, duelResult]);

  // PvP Rule: Level race — first to reach target level wins
  useEffect(() => {
    if (gameMode !== GAME_MODES.Robo || !pvpRule || pvpRule !== 'level') return;
    if (gameOver || gameWon || showMenu) return;
    if (duelResult !== null) return; // don’t flip winner after it’s decided
    const rLevel = Math.floor(roboScore / 1000) + 1; // simple proxy for robo level-ups
    if (rLevel !== roboLevel) setRoboLevel(rLevel);
    if (level >= pvpTargetLevel || rLevel >= pvpTargetLevel) {
      setDuelResult(level >= pvpTargetLevel ? 'player' : 'robo');
      setGameOver(true);
      setCombo(0);
    }
  }, [gameMode, pvpRule, level, roboScore, roboLevel, gameOver, gameWon, showMenu, duelResult]);

  // Auto-advance level when racing by level to avoid blocking on modal
  useEffect(() => {
    if (pvpRule === 'level' && levelComplete && !gameOver) {
      const id = setTimeout(() => startNextLevel(), 700);
      return () => clearTimeout(id);
    }
  }, [pvpRule, levelComplete, gameOver]);
  // PvP (Robo): match progresses by rounds; winner decided when someone reaches 2 rounds.

  // Clear current selection and dragging when paused activates
  useEffect(() => {
    if (paused) {
      setIsDragging(false);
      setSelectedDots([]);
    }
  }, [paused]);

  // Reset speed UI when leaving Speed mode
  useEffect(() => {
    if (gameMode !== GAME_MODES.Speed) {
      setSpeedLevel(1);
      setBaseMoveTime(8);
      setTimeLeft(8);
    }
  }, [gameMode]);

  return (
    <div className="app-viewport flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-2 sm:p-4">
      <style>{`
        @keyframes rainbow { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes pop { 0% { transform: scale(1); } 50% { transform: scale(1.5) rotate(180deg); } 100% { transform: scale(0); opacity: 0; } }
        @keyframes explode { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(4); opacity: 0; } }
        @keyframes particle { 0% { transform: translate(0, 0); opacity: 1; } 100% { transform: translate(var(--tx), var(--ty)); opacity: 0; } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes leadFlash { 0%, 100% { transform: scale(1); box-shadow: 0 0 0px rgba(34,197,94,0); } 50% { transform: scale(1.05); box-shadow: 0 0 18px rgba(34,197,94,0.7); } }
        @keyframes toastUp { 0% { transform: translate(-50%, -50%) translateY(0) scale(0.95); opacity: 0; } 10% { opacity: 1; } 100% { transform: translate(-50%, -50%) translateY(-40px) scale(1.08); opacity: 0; } }
        * { -webkit-tap-highlight-color: transparent; outline: none !important; }
        html, body { overscroll-behavior: none; }
        @media (max-width: 640px) {
          .game-container { padding: 1rem; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .power-ups-container { flex-wrap: wrap; gap: 0.5rem; }
          .targets-container { gap: 0.5rem; }
        }
      `}</style>
      
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-3 sm:p-6 w-full max-w-3xl mx-auto game-container">
        {debugEnabled && (
          <div className="fixed top-3 right-3 z-50">
            <button onClick={() => setShowDebug((v) => !v)} className="px-3 py-2 rounded-xl bg-black/80 text-white text-sm font-bold hover:scale-105 transition">🐞 Debug</button>
            {showDebug && (
              <div className="mt-2 p-3 rounded-2xl bg-white shadow-2xl text-sm space-y-2 w-64">
                <div className="font-bold mb-1">Debug Panel</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={forceCompleteLevel} className="px-2 py-2 rounded-lg bg-emerald-500 text-white font-semibold">Complete Level</button>
                  <button onClick={() => addMoves(10)} className="px-2 py-2 rounded-lg bg-blue-500 text-white font-semibold">+10 Moves</button>
                  <button onClick={() => addScore(100)} className="px-2 py-2 rounded-lg bg-yellow-500 text-white font-semibold">+100 Score</button>
                  <button onClick={startNextLevel} className="px-2 py-2 rounded-lg bg-indigo-500 text-white font-semibold">Next Level</button>
                  <button onClick={winGame} className="px-2 py-2 rounded-lg bg-purple-600 text-white font-semibold">Win Game</button>
                  <button onClick={initializeGrid} className="px-2 py-2 rounded-lg bg-gray-200 text-gray-800 font-semibold">Reset Grid</button>
                  <button onClick={disableDebug} className="px-2 py-2 rounded-lg bg-red-600 text-white font-semibold">Disable Debug</button>
                </div>
                <div className="text-xs text-gray-600 mt-2">Level {level} / {MAX_LEVELS} • Moves {moves} • Score {score}</div>
              </div>
            )}
          </div>
        )}
        {/* Game Logo */}
        <div className="flex justify-center mb-1">
          <svg width="96" height="40" viewBox="0 0 120 48" role="img" aria-label="Two Dots logo" style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.12))', animation: 'pulse 3s infinite' }}>
            <defs>
              <linearGradient id="dotA" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF6B6B" />
                <stop offset="100%" stopColor="#FFA07A" />
              </linearGradient>
              <linearGradient id="dotB" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4ECDC4" />
                <stop offset="100%" stopColor="#45B7D1" />
              </linearGradient>
            </defs>
            <circle cx="40" cy="24" r="12" fill="url(#dotA)" />
            <circle cx="80" cy="24" r="12" fill="url(#dotB)" />
          </svg>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight mb-1 sm:mb-2 bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent" style={{animation: 'pulse 3s infinite'}}>
          Two Dots ✨
        </h1>
        {/* Open Menu button */}
        <div className="fixed top-3 left-3 z-50">
          <button onClick={() => { setMenuView('home'); setShowHowTo(false); setShowMenu(true); }} className="px-3 py-2 rounded-xl bg-black/80 text-white text-sm font-bold hover:scale-105 transition">🎮 Menu</button>
        </div>
        
        {/* Game Modes selector removed from header; available in Start Menu only */}
        
        <div className="text-center mb-4">
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Level {level} / {MAX_LEVELS}</span>
          <span className="text-lg text-gray-500 ml-2">({gridSize}×{gridSize})</span>
        </div>
        {gameMode === GAME_MODES.Speed && (
          <div className="mb-4 px-3">
            <div className="flex items-center justify-between mb-1 text-sm font-semibold text-gray-700"><span>Speed Lv{speedLevel}</span><span>{Math.ceil(timeLeft)}s</span></div>
            <div className="h-2 bg-gray-300 rounded-full">
              <div className="h-2 bg-gradient-to-r from-pink-500 to-red-600 rounded-full" style={{ width: `${Math.max(0, Math.min(100, (timeLeft / baseMoveTime) * 100))}%` }} />
            </div>
          </div>
        )}
        {gameMode === GAME_MODES.RoboTimed && (
          <div className="mb-4 px-3">
            <div className="flex items-center justify-between mb-1 text-sm font-semibold text-gray-700"><span>Match Lv{speedLevel}</span><span>{Math.ceil(matchTimeLeft)}s</span></div>
            <div className="h-2 bg-gray-300 rounded-full">
              <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full" style={{ width: `${Math.max(0, Math.min(100, (matchTimeLeft / matchBaseTime) * 100))}%` }} />
            </div>
          </div>
        )}
        
        <div className="flex justify-center gap-2 mb-4 flex-wrap targets-container">
          {Object.entries(targets).map(([color, target]) => {
            const isComplete = collected[color] >= target;
            const progress = (collected[color] / target) * 100;
            return (
              <div key={color} className={`px-3 py-2 rounded-xl flex flex-col items-center gap-1 transition-all ${isComplete ? 'bg-gradient-to-r from-green-400 to-emerald-500 scale-110 shadow-xl' : 'bg-gradient-to-r from-gray-100 to-gray-200'}`}>
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full shadow-lg" style={{ backgroundColor: color, boxShadow: `0 0 15px ${color}` }} />
                <span className={`font-bold text-xs sm:text-sm ${isComplete ? 'text-white' : 'text-gray-700'}`}>{collected[color]} / {target}</span>
                <div className="w-14 sm:w-16 bg-gray-300 rounded-full h-2">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>
                {isComplete && <span className="text-white text-lg sm:text-xl">✓</span>}
              </div>
            );
          })}
        </div>
        
        {/* Compact stats bar to save vertical space */}
        <div className="flex justify-center mb-3">
          <div className="stats-bar">
            <span>🏆 Score: {score}</span>
            <span className="divider" />
            <span>⚡ Moves: {moves}</span>
            <span className="divider" />
            <span>🥇 Best: {highScore}</span>
          </div>
        </div>

        {gameMode === GAME_MODES.Robo && !pvpRule && (
          <div className="flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 sm:px-4 py-2 rounded-full mb-2">
            <span>🏅 Rounds: 🙂 {pvpPlayerRounds} - {pvpRoboRounds} 👤</span>
            <span className="opacity-80">•</span>
            <span>Round {pvpRound}</span>
          </div>
        )}
        {gameMode === GAME_MODES.Robo && pvpRule && (
          <div className="flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 sm:px-4 py-2 rounded-full mb-2">
            <span>⚖️ Rule: {pvpRule==='level' ? `First to reach level ${pvpTargetLevel}` : `First to reach ${pvpTargetScore} points`}</span>
          </div>
        )}

        {gameMode === GAME_MODES.Robo && !pvpRule && Math.abs(pvpPlayerRounds - pvpRoboRounds) >= 2 && (
          <div className="flex items-center justify-center mb-2">
            <div className="px-3 py-2 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-green-600" style={{ animation: 'leadFlash 1.5s infinite' }}>
              {pvpPlayerRounds > pvpRoboRounds ? '🙂 You are ahead by 2 rounds!' : `👤 ${(opponentName || 'Opponent')} is ahead by 2 rounds!`}
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-4 justify-center flex-wrap power-ups-container">
          {[{type:'bomb', Icon:Bomb, color:'red'}, {type:'shuffle', Icon:Shuffle, color:'blue'}, {type:'extraMoves', Icon:Plus, color:'green'}].map(({type, Icon, color}) => (
            <button key={type} onClick={() => usePowerUp(type)} disabled={powerUps[type] <= 0}
              className={`flex items-center gap-1 px-3 sm:px-4 py-2 rounded-xl font-bold text-sm shadow-lg transition-all ${powerUps[type] > 0 ? `bg-gradient-to-r from-${color}-500 to-${color}-600 text-white hover:scale-110` : 'bg-gray-300 text-gray-500'}`}>
              <Icon className="w-4 h-4 sm:w-5 sm:h-5" /> {powerUps[type]}
            </button>
          ))}
        </div>

        <>
          {gameWon && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"><div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 text-center max-w-md w-full mx-auto"><div className="text-6xl mb-4">🏆</div><h2 className="text-2xl sm:text-3xl font-bold mb-4 text-gray-800">CHAMPION!</h2><p className="text-base sm:text-lg text-gray-600 mb-6">All {MAX_LEVELS} Levels Complete!<br/>Final Score: <span className="font-bold text-purple-600">{score}</span></p><div className="flex justify-center gap-1 mb-3">{Array(stars).fill(0).map((_, i) => <Star key={i} className="w-7 h-7 fill-yellow-300 text-yellow-300" />)}</div><button onClick={initializeGrid} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 sm:px-6 py-3 rounded-xl font-bold hover:shadow-xl transform hover:scale-105 transition-all">🔄 Play Again</button></div></div>}
          {levelComplete && !gameWon && <div className="mb-4 p-5 bg-gradient-to-r from-green-400 to-teal-500 rounded-2xl text-center shadow-2xl" style={{animation:'pulse 1s infinite'}}><p className="text-3xl font-bold text-white mb-2">🎉 Level Complete! 🎉</p><div className="flex justify-center gap-1 mb-3">{Array(stars).fill(0).map((_, i) => <Star key={i} className="w-7 h-7 fill-yellow-300 text-yellow-300" />)}</div><button onClick={startNextLevel} className="bg-white text-green-600 font-bold py-3 px-8 rounded-xl hover:scale-110 transition-all">Next Level →</button></div>}
        {gameOver && !levelComplete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 text-center max-w-md w-full mx-auto">
              <div className="text-6xl mb-4">{(gameMode === GAME_MODES.Robo || gameMode === GAME_MODES.RoboTimed) ? (duelResult === 'player' ? '🏆' : duelResult === 'robo' ? '😢' : '🤝') : '😢'}</div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-800">{(gameMode === GAME_MODES.Robo || gameMode === GAME_MODES.RoboTimed) ? (duelResult === 'player' ? 'Congrats! You Won' : duelResult === 'robo' ? 'Game Over!' : 'Draw') : 'Game Over!'}</h2>
              {gameMode === GAME_MODES.Speed && (
                <p className="text-red-600 font-bold mb-2">⏱️ Time’s up!</p>
              )}
              {gameMode === GAME_MODES.RoboTimed && (
                <>
                  <p className="text-red-600 font-bold mb-2">⏱️ Time’s up!</p>
                  <p className="text-lg sm:text-xl text-gray-800 font-bold mb-2">Winner: {duelResult === 'player' ? 'You' : duelResult === 'robo' ? (opponentName || 'Opponent') : 'Draw'}</p>
                  <p className="text-base sm:text-lg text-gray-700 mb-1">🙂 <span className="font-bold text-emerald-600">You: {score}</span></p>
                  <p className="text-base sm:text-lg text-gray-700 mb-1">👤 <span className="font-bold text-purple-600">{opponentName || 'Opponent'}: {roboScore}</span></p>
                </>
              )}
              {gameMode === GAME_MODES.Robo && !pvpRule && (
                <>
                  <p className="text-base sm:text-lg text-gray-700 mb-1">🏁 Round {pvpRound} finished</p>
                  <p className="text-base sm:text-lg text-gray-700 mb-1">👤 <span className="font-bold text-purple-600">{opponentName || 'Opponent'}: {roboScore}</span></p>
                  <p className="text-lg sm:text-xl text-gray-800 font-bold mb-2">Round Winner: {duelResult === 'player' ? 'You' : duelResult === 'robo' ? (opponentName || 'Opponent') : 'Draw'}</p>
                  <p className="text-base sm:text-lg text-gray-700 mb-2">🏅 Rounds: 🙂 You {pvpPlayerRounds} - {pvpRoboRounds} 👤 {opponentName || 'Opponent'}</p>
                  {Math.abs(pvpPlayerRounds - pvpRoboRounds) >= 2 ? (
                    <p className="text-lg sm:text-xl text-green-700 font-bold mb-2">Match Winner: {pvpPlayerRounds > pvpRoboRounds ? 'You' : (opponentName || 'Opponent')}</p>
                  ) : (
                    <p className="text-sm sm:text-base text-gray-600 mb-2">Win condition: lead by 2 rounds</p>
                  )}
                </>
              )}
              {gameMode === GAME_MODES.Robo && pvpRule && (
                <>
                  <p className="text-lg sm:text-xl text-gray-800 font-bold mb-2">Winner: {duelResult === 'player' ? 'You' : duelResult === 'robo' ? (opponentName || 'Opponent') : 'Draw'}</p>
                  <p className="text-base sm:text-lg text-gray-700 mb-1">🙂 <span className="font-bold text-emerald-600">You: {score}</span></p>
                  <p className="text-base sm:text-lg text-gray-700 mb-1">👤 <span className="font-bold text-purple-600">{opponentName || 'Opponent'}: {roboScore}</span></p>
                  <p className="text-sm sm:text-base text-gray-600 mb-2">Rule: {pvpRule==='level' ? `First to reach level ${pvpTargetLevel}` : `First to reach ${pvpTargetScore} points`}</p>
                </>
              )}
              <p className="text-base sm:text-lg text-gray-600 mb-2">Level {level}</p>
              <p className="text-lg sm:text-xl text-gray-700 mb-6">Final Score: <span className="font-bold text-purple-600">{score}</span></p>
              <div className="flex gap-2 justify-center">
                {gameMode === GAME_MODES.Robo ? (
                  pvpRule ? (
                    <>
                      <button onClick={initializeGrid} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 sm:px-6 py-3 rounded-xl font-bold hover:shadow-xl transform hover:scale-105 transition-all">🔄 Play Again</button>
                      <button onClick={() => { setMenuView('home'); setShowHowTo(false); setShowMenu(true); }} className="bg-gray-200 text-gray-800 px-4 sm:px-6 py-3 rounded-xl font-bold hover:scale-105 transition-all">🏠 Menu</button>
                    </>
                  ) : (
                    (Math.abs(pvpPlayerRounds - pvpRoboRounds) >= 2) ? (
                      <>
                        <button onClick={initializeGrid} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 sm:px-6 py-3 rounded-xl font-bold hover:shadow-xl transform hover:scale-105 transition-all">🔄 Play Again</button>
                        <button onClick={() => { setMenuView('home'); setShowHowTo(false); setShowMenu(true); }} className="bg-gray-200 text-gray-800 px-4 sm:px-6 py-3 rounded-xl font-bold hover:scale-105 transition-all">🏠 Menu</button>
                      </>
                    ) : (
                      <>
                        <button onClick={startNextPvpRound} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 sm:px-6 py-3 rounded-xl font-bold hover:shadow-xl transform hover:scale-105 transition-all">➡️ Next Round</button>
                        <button onClick={() => setShowMenu(true)} className="bg-gray-200 text-gray-800 px-4 sm:px-6 py-3 rounded-xl font-bold hover:scale-105 transition-all">🏠 Menu</button>
                      </>
                    )
                  )
                ) : (
                  <>
                    <button onClick={initializeGrid} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 sm:px-6 py-3 rounded-xl font-bold hover:shadow-xl transform hover:scale-105 transition-all">🔄 Play Again</button>
                    <button onClick={() => setShowMenu(true)} className="bg-gray-200 text-gray-800 px-4 sm:px-6 py-3 rounded-xl font-bold hover:scale-105 transition-all">🏠 Menu</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        </>

        <div className="grid-viewport relative flex justify-center items-center">
          <div ref={gridRef} className="grid gap-1 sm:gap-2 relative" style={{ gridTemplateColumns: `repeat(${gridSize}, ${dotSize}px)`, gridTemplateRows: `repeat(${gridSize}, ${dotSize}px)`, touchAction: 'none', overscrollBehavior: 'contain' }} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave} onWheel={(e) => e.preventDefault()} onTouchEnd={() => { setIsDragging(false); completePath(); }} onTouchCancel={() => { setIsDragging(false); completePath(); }}>
            {grid.map((row, rowIndex) =>
              row.map((dot, colIndex) => {
                if (!dot) return <div key={`${rowIndex}-${colIndex}`} style={{width: `${dotSize}px`, height: `${dotSize}px`}} />;
                const isSelected = isDotSelected(rowIndex, colIndex);
                const isPopping = poppingDots.some(p => p.row === rowIndex && p.col === colIndex);
                let style = {
                  width: `${dotSize}px`, 
                  height: `${dotSize}px`, 
                  backgroundColor: dot.color, 
                  transition: 'all 0.3s ease', 
                  cursor: 'pointer', 
                  userSelect: 'none',
                  borderRadius: '50%',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
                  border: '2px solid rgba(255,255,255,0.3)',
                  position: 'relative',
                  overflow: 'hidden'
                };
                
                // Add gradient overlay for depth
                if (!dot.isRainbow) {
                  style.background = `linear-gradient(135deg, ${dot.color} 0%, ${dot.color}dd 50%, ${dot.color} 100%)`;
                }
                
                if (dot.isRainbow) { 
                  style.background = 'linear-gradient(45deg, #FF6B6B, #4ECDC4, #45B7D1, #FFA07A, #98D8C8)'; 
                  style.backgroundSize = '200% 200%'; 
                  style.animation = 'rainbow 2s infinite'; 
                }
                
                if (dot.isGem) { 
                  style.boxShadow = `0 0 25px ${dot.color}, inset 0 0 10px rgba(255,255,255,0.5)`; 
                  style.border = '3px solid rgba(255, 255, 255, 0.9)'; 
                  style.transform = 'rotate(45deg)';
                  style.borderRadius = '15%';
                }
                
                if (dot.isBomb) { 
                  style.boxShadow = `0 0 30px red, 0 0 40px orange, inset 0 0 10px rgba(255,0,0,0.3)`; 
                  style.border = '3px solid red'; 
                  style.animation = 'pulse 1s infinite';
                }
                
                if (dot.isLightning) { 
                  style.boxShadow = `0 0 30px yellow, 0 0 40px gold, inset 0 0 10px rgba(255,255,0,0.3)`; 
                  style.border = '3px solid yellow'; 
                  style.animation = 'pulse 0.5s infinite';
                }
                
                if (isSelected) { 
                  style.boxShadow = `0 0 35px ${dot.color}, 0 0 50px ${dot.color}aa`; 
                  style.transform = 'scale(1.3) rotate(5deg)'; 
                  style.zIndex = '25';
                  style.border = '3px solid white';
                }
                
                if (isPopping) { 
                  style.animation = 'pop 0.3s forwards'; 
                  style.zIndex = '30'; 
                }
                
                return (
                  <div key={`${rowIndex}-${colIndex}`} 
                     className="rounded-full hover:scale-110 hover:shadow-lg" 
                     style={style}
                     data-row={rowIndex}
                     data-col={colIndex}
                    onMouseDown={() => { setIsDragging(true); handleDotClick(rowIndex, colIndex); }}
                    onMouseEnter={() => { if (isDragging) handleDotClick(rowIndex, colIndex); }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                      handleDotClick(rowIndex, colIndex);
                    }}
                    onTouchMove={(e) => {
                      e.preventDefault();
                      const touch = e.touches[0];
                      let element = document.elementFromPoint(touch.clientX, touch.clientY);
                      if (element && element.hasAttribute('data-row') && element.hasAttribute('data-col')) {
                        const row = parseInt(element.getAttribute('data-row'));
                        const col = parseInt(element.getAttribute('data-col'));
                        if (!isNaN(row) && !isNaN(col)) {
                          handleDotClick(row, col);
                          return;
                        }
                      }
                      const cell = getGridCellFromPoint(touch.clientX, touch.clientY);
                      if (cell) handleDotClick(cell.row, cell.col);
                    }}>
                    {isSelected && <div className="w-full h-full flex items-center justify-center text-white font-bold text-xl" style={{textShadow: '0 0 10px rgba(0,0,0,0.5)'}}>{selectedDots.findIndex(d => d.row === rowIndex && d.col === colIndex) + 1}</div>}
                    {dot.isGem && !isSelected && <div className="w-full h-full flex items-center justify-center text-2xl">💎</div>}
                    {dot.isBomb && !isSelected && <div className="w-full h-full flex items-center justify-center text-2xl">💣</div>}
                    {dot.isLightning && !isSelected && <div className="w-full h-full flex items-center justify-center text-2xl">⚡</div>}
                  </div>
                );
              })
            )}
            <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: '100%', height: '100%', zIndex: 20 }}>
              {selectedDots.length > 1 && <>
                <path d={selectedDots.map((d, i) => {
                  const g = getGridGapPx();
                  const x = d.col * (dotSize + g) + dotSize/2;
                  const y = d.row * (dotSize + g) + dotSize/2;
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ')} stroke={selectedDots[0].color} strokeWidth={dotSize/5} strokeLinecap="round" fill="none" opacity="0.7" />
                <path d={selectedDots.map((d, i) => {
                  const g = getGridGapPx();
                  const x = d.col * (dotSize + g) + dotSize/2;
                  const y = d.row * (dotSize + g) + dotSize/2;
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ')} stroke="white" strokeWidth={dotSize/10} strokeLinecap="round" fill="none" opacity="0.95" />
              </>}
            </svg>
            {explosions.map(exp => {
              const radius = Math.max(24, Math.floor(dotSize * 0.9));
              const particleSize = Math.max(8, Math.floor(dotSize * 0.2));
              const particleTravel = Math.floor(dotSize * 0.8);
              return (
                <div key={exp.id} style={{ position: 'absolute', left: exp.x, top: exp.y, pointerEvents: 'none', zIndex: 10 }}>
                  <div style={{
                    width: `${radius}px`, height: `${radius}px`, borderRadius: '50%', backgroundColor: exp.color,
                    position: 'absolute', left: `-${radius/2}px`, top: `-${radius/2}px`,
                    animation: 'explode 0.6s forwards', boxShadow: `0 0 ${Math.floor(radius * 0.7)}px ${exp.color}`
                  }} />
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
                    const rad = angle * Math.PI / 180;
                    const tx = Math.cos(rad) * particleTravel;
                    const ty = Math.sin(rad) * particleTravel;
                    return (
                      <div key={i} style={{
                        width: `${particleSize}px`, height: `${particleSize}px`, borderRadius: '50%', backgroundColor: exp.color,
                        position: 'absolute', left: `-${particleSize/2}px`, top: `-${particleSize/2}px`,
                        animation: 'particle 0.6s forwards', '--tx': `${tx}px`, '--ty': `${ty}px`
                      }} />
                    );
                  })}
                  <div style={{position: 'absolute', left: `-${Math.floor(radius/4)}px`, top: `-${Math.floor(radius/4)}px`, fontSize: `${Math.floor(radius/2)}px`, animation: 'explode 0.6s forwards'}}>✨</div>
                </div>
              );
            })}
            {toasts.map(t => (
              <div key={t.id} style={{ position: 'absolute', left: t.x, top: t.y, pointerEvents: 'none', zIndex: 40 }}>
                <div className="px-2 py-1 rounded-lg text-white text-sm font-bold shadow-lg" style={{ background: 'rgba(0,0,0,0.65)', animation: 'toastUp 1s ease-out forwards', color: '#fff', textShadow: '0 0 6px rgba(255,255,255,0.6)' }}>{t.text}</div>
              </div>
            ))}
          </div>
          {/* Paused overlay removed */}
        </div>

        {/* Start Menu Overlay */}
        {showMenu && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 text-center max-w-2xl w-full mx-auto">
              {menuView === 'home' ? (
                <>
                  <div className="flex justify-center mb-2">
                    <svg width="140" height="56" viewBox="0 0 120 48" role="img" aria-label="Two Dots logo" style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.15))' }}>
                      <defs>
                        <linearGradient id="dotA2" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#FF6B6B" />
                          <stop offset="100%" stopColor="#FFA07A" />
                        </linearGradient>
                        <linearGradient id="dotB2" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#4ECDC4" />
                          <stop offset="100%" stopColor="#45B7D1" />
                        </linearGradient>
                      </defs>
                      <circle cx="40" cy="24" r="12" fill="url(#dotA2)" />
                      <circle cx="80" cy="24" r="12" fill="url(#dotB2)" />
                    </svg>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-gray-800">Two Dots</h2>
                  <div className="space-y-3 mb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button onClick={connectWallet} disabled={isConnecting} className={`w-full ${walletAddress? 'bg-green-600 hover:bg-green-700 text-white':'bg-blue-600 hover:bg-blue-700 text-white'} font-bold py-3 px-6 rounded-xl transition-all`}>
                        {walletAddress ? `✅ Connected: ${shortAddr(walletAddress)}` : (isConnecting ? '⏳ Connecting…' : '🔗 Connect Wallet')}
                      </button>
                      <button onClick={payAndStartGame} disabled={!walletAddress || txPending} className={`w-full ${(!walletAddress || txPending) ? 'bg-gray-400 cursor-not-allowed':'bg-gradient-to-r from-purple-600 to-pink-600'} text-white font-bold py-3 px-6 rounded-xl hover:scale-105 transition-all shadow-lg`}>
                        ▶️ Play Game
                      </button>
                    </div>
                    {!isDevWalletConfigured() && (
                      <div className="text-xs text-orange-600 mt-2">
                        ملاحظة: <span className="font-mono">VITE_DEV_WALLET</span> ما مضبوطاش. الدفع غادي يمشي لعنوان محفظتك للتجربة. باش الدفع يمشي لعنوان المطوّر فالنشر، زيد المتغيّر فـ Vercel.
                      </div>
                    )}
                    <button onClick={() => setShowHowTo(v => !v)} className="w-full bg-gray-100 text-gray-800 font-bold py-3 px-6 rounded-xl hover:scale-105 transition-all border">📘 How to Play</button>
                  </div>
                  {showHowTo && (
                    <div className="text-left bg-gray-50 border rounded-2xl p-4 mb-4">
                      <p className="font-bold mb-2">Basics:</p>
                      <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                        <li>Connect adjacent dots of the same color.</li>
                        <li>Make a square to clear all dots of that color.</li>
                        <li>Specials: 🌈 any color • 💎 3x points • 💣 3×3 area • ⚡ row+column.</li>
                        <li>Finish level targets before moves run out.</li>
                      </ul>
                      <p className="font-bold mt-3 mb-1">Modes:</p>
                      <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                        <li>Classic: normal play with move limit.</li>
                        <li>PvP (Rounds): invisible opponent; each round ends when moves hit zero; match winner needs a 2-round lead.</li>
                        <li>PvP (Score): first to reach {pvpTargetScore} points wins.</li>
                        <li>PvP (Level): first to reach level {pvpTargetLevel} wins.</li>
                        <li>PvP (Timed): shared timer; when time’s up, highest score wins.</li>
                        <li>Speed: make a move before the timer resets.</li>
                      </ul>
                    </div>
                  )}
                  {/* Back to Game removed as requested */}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center mb-2">
                    <div className="text-2xl">🎮</div>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-gray-800">Choose a mode to play</h2>
                  <div className="mb-3">
                    <button onClick={() => { setMenuView('home'); }} className="w-full bg-gradient-to-r from-gray-200 to-gray-300 text-gray-800 font-bold py-3 px-6 rounded-xl hover:scale-105 transition-all border">⬅️ Back to Menu</button>
                  </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {[{m:GAME_MODES.Classic, title:'Classic', desc:'Normal play'}, {m:GAME_MODES.Robo, title:'PvP', desc:'Invisible opponent • choose rules: Rounds • Score • Level • Timed'}, {m:GAME_MODES.Speed, title:'Speed', desc:'Speed increases • time is limited'}].map(({m, title, desc}) => (
                        <button key={m} onClick={() => {
                          if (m===GAME_MODES.Robo) {
                            setOpponentName(getRandomOpponentName());
                            setGameMode(m);
                            setPvpRule(null);
                            setShowRuleSelect(true);
                            setMenuView('home');
                            setShowHowTo(false);
                            setShowMenu(false);
                          } else {
                            setGameMode(m);
                            initializeGrid();
                            setMenuView('home');
                            setShowHowTo(false);
                            setShowMenu(false);
                          }
                        }} className={`p-4 rounded-2xl border-2 ${gameMode===m?'border-black':'border-gray-300'} hover:border-purple-500 transition text-left bg-gray-50 hover:bg-gray-100`}>
                          <div className="text-lg font-bold">{title}</div>
                          <div className="text-sm text-gray-600">{desc}</div>
                        </button>
                      ))}
                   </div>
                 </>
               )}
            </div>
          </div>
        )}

        {showRuleSelect && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 text-center max-w-2xl w-full mx-auto">
              <div className="text-2xl sm:text-3xl font-bold mb-2 text-gray-800">⚔️ Choose PvP Rules</div>
              <p className="text-gray-600 mb-4 text-sm">Before matchmaking, choose whether to race by level or points:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                <button onClick={() => setPvpRule('level')} className={`p-4 rounded-2xl border-2 ${pvpRule==='level'?'border-purple-600 bg-purple-50':'border-gray-300 bg-gray-50'} hover:border-purple-500 transition text-left`}>
                  <div className="text-lg font-bold">🏆 Race to level {pvpTargetLevel}</div>
                  <div className="text-sm text-gray-600">First to reach level {pvpTargetLevel} wins</div>
                </button>
                <button onClick={() => setPvpRule('score')} className={`p-4 rounded-2xl border-2 ${pvpRule==='score'?'border-purple-600 bg-purple-50':'border-gray-300 bg-gray-50'} hover:border-purple-500 transition text-left`}>
                  <div className="text-lg font-bold">🎯 Race to {pvpTargetScore} points</div>
                  <div className="text-sm text-gray-600">First to reach {pvpTargetScore} wins</div>
                </button>
              </div>
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => {
                  if (!pvpRule) return;
                  setShowRuleSelect(false);
                  const d = Math.floor(Math.random() * 4) + 7; // 7–10s search
                  setOpponentFound(false);
                  setSearchRemaining(d);
                  setMatchmakingSeconds(3);
                  setShowMatchmaking(true);
                }} disabled={!pvpRule} className={`px-4 sm:px-6 py-3 rounded-xl font-bold text-white transition-all ${pvpRule? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-105' : 'bg-gray-400 cursor-not-allowed'}`}>🚀 Start</button>
                <button onClick={() => { setShowRuleSelect(false); setMenuView('home'); setShowHowTo(false); setShowMenu(true); }} className="px-4 sm:px-6 py-3 rounded-xl font-bold bg-gray-200 text-gray-800 hover:scale-105 transition-all">⬅️ Back</button>
              </div>
            </div>
          </div>
        )}

        {showMatchmaking && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 text-center max-w-2xl w-full mx-auto">
              <div className="text-2xl sm:text-3xl font-bold mb-2 text-gray-800">🕹️ PvP Matchmaking</div>
              {!opponentFound ? (
                <>
                  <p className="text-gray-600 mb-4">Finding opponent…</p>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="border rounded-2xl p-4 bg-gray-50">
                      <div className="text-sm text-gray-500 mb-1">You</div>
                      <div className="text-2xl">🙂</div>
                      <div className="text-xs text-gray-500 mt-2">Ready</div>
                    </div>
                    <div className="border rounded-2xl p-4 bg-gray-50">
                      <div className="text-sm text-gray-500 mb-1">Opponent</div>
                      <div className="text-2xl">🤖</div>
                      <div className="text-xs text-gray-500 mt-2 flex items-center justify-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Searching…</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">Searching…</div>
                </>
              ) : (
                <>
                  <p className="text-gray-600 mb-4">Opponent found!</p>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="border rounded-2xl p-4 bg-gray-50">
                      <div className="text-sm text-gray-500 mb-1">You</div>
                      <div className="text-2xl">🙂</div>
                      <div className="text-xs text-gray-500 mt-2">Ready</div>
                    </div>
                    <div className="border rounded-2xl p-4 bg-gray-50">
                      <div className="text-sm text-gray-500 mb-1">Opponent</div>
                      <div className="text-lg font-bold">{opponentName || 'Opponent'}</div>
                      <div className="text-xs text-gray-500 mt-2">Matched</div>
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-gray-800 mb-3">Starting in {matchmakingRemaining}s</div>
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <button onClick={() => { setMatchmakingSeconds(3); setMatchmakingRemaining(3); }} className={`px-3 py-2 rounded-xl border ${matchmakingSeconds===3?'bg-gray-200':'bg-white'} text-gray-800 font-bold`}>⏱ 3s</button>
                    <button onClick={() => { setMatchmakingSeconds(5); setMatchmakingRemaining(5); }} className={`px-3 py-2 rounded-xl border ${matchmakingSeconds===5?'bg-gray-200':'bg-white'} text-gray-800 font-bold`}>⏱ 5s</button>
                  </div>
                  <div className="text-xs text-gray-500">The match will start automatically.</div>
                </>
              )}
            </div>
          </div>
        )}

        {(gameMode === GAME_MODES.Robo || gameMode === GAME_MODES.RoboTimed) ? (
          <button onClick={() => { setGameMode(GAME_MODES.Classic); setOpponentName(''); initializeGrid(); setMenuView('home'); setShowHowTo(false); setShowMenu(true); }} className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold py-3 px-6 rounded-xl hover:scale-105 transition-all shadow-lg">🚪 Quit PvP</button>
        ) : (
          <button onClick={initializeGrid} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-6 rounded-xl hover:scale-105 transition-all shadow-lg">🔄 New Game</button>
        )}

        {/* Legend removed to gain space in Farcaster/Base mini app */}
      </div>
    </div>
  );
}

export default TwoDotsGame;