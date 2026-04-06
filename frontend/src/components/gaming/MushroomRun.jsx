import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "tengacion.gaming.mushroom-run.progress";
const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 420;
const WORLD_WIDTH = 3520;
const GROUND_Y = 352;
const GOAL_X = WORLD_WIDTH - 160;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 54;
const CHECKPOINTS = [84, 1120, 2140, 3000];

const PLATFORM_LAYOUT = [
  { x: 210, y: 296, w: 120, h: 18, tint: "mint" },
  { x: 430, y: 252, w: 128, h: 18, tint: "gold" },
  { x: 704, y: 314, w: 140, h: 18, tint: "stone" },
  { x: 972, y: 264, w: 166, h: 18, tint: "violet" },
  { x: 1230, y: 226, w: 122, h: 18, tint: "mint" },
  { x: 1458, y: 286, w: 154, h: 18, tint: "gold" },
  { x: 1756, y: 246, w: 144, h: 18, tint: "stone" },
  { x: 2018, y: 308, w: 168, h: 18, tint: "violet" },
  { x: 2282, y: 254, w: 122, h: 18, tint: "mint" },
  { x: 2520, y: 206, w: 124, h: 18, tint: "gold" },
  { x: 2794, y: 274, w: 156, h: 18, tint: "stone" },
  { x: 3058, y: 232, w: 118, h: 18, tint: "mint" },
];

const COIN_LAYOUT = [
  { id: "c1", x: 174, y: 274 },
  { id: "c2", x: 272, y: 250 },
  { id: "c3", x: 492, y: 210 },
  { id: "c4", x: 548, y: 210 },
  { id: "c5", x: 738, y: 272 },
  { id: "c6", x: 1036, y: 222 },
  { id: "c7", x: 1100, y: 222 },
  { id: "c8", x: 1268, y: 184 },
  { id: "c9", x: 1510, y: 244 },
  { id: "c10", x: 1804, y: 204 },
  { id: "c11", x: 2064, y: 266 },
  { id: "c12", x: 2142, y: 266 },
  { id: "c13", x: 2334, y: 212 },
  { id: "c14", x: 2570, y: 164 },
  { id: "c15", x: 2830, y: 232 },
  { id: "c16", x: 2898, y: 232 },
  { id: "c17", x: 3096, y: 188 },
  { id: "c18", x: 3188, y: 188 },
  { id: "c19", x: 3340, y: 248 },
];

const ENEMY_LAYOUT = [
  { id: "e1", startX: 584, y: GROUND_Y - 28, minX: 510, maxX: 816, speed: 1.15 },
  { id: "e2", startX: 1326, y: GROUND_Y - 28, minX: 1240, maxX: 1510, speed: 1.25 },
  { id: "e3", startX: 1822, y: 218, minX: 1770, maxX: 1898, speed: 0.94 },
  { id: "e4", startX: 2388, y: GROUND_Y - 28, minX: 2304, maxX: 2596, speed: 1.35 },
  { id: "e5", startX: 3098, y: 204, minX: 3068, maxX: 3160, speed: 0.92 },
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const rectsOverlap = (a, b) =>
  a.x < b.x + b.w &&
  a.x + a.w > b.x &&
  a.y < b.y + b.h &&
  a.y + a.h > b.y;

const createCoins = () => COIN_LAYOUT.map((coin) => ({ ...coin, collected: false }));

const createEnemies = () =>
  ENEMY_LAYOUT.map((enemy) => ({
    ...enemy,
    x: enemy.startX,
    dir: 1,
    alive: true,
    w: 34,
    h: 28,
  }));

const readProgress = () => {
  if (typeof window === "undefined") {
    return { bestScore: 0, bestCoins: 0, bestDistance: 0, wins: 0 };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw || "{}");
    return {
      bestScore: Number(parsed.bestScore) || 0,
      bestCoins: Number(parsed.bestCoins) || 0,
      bestDistance: Number(parsed.bestDistance) || 0,
      wins: Number(parsed.wins) || 0,
    };
  } catch {
    return { bestScore: 0, bestCoins: 0, bestDistance: 0, wins: 0 };
  }
};

const createFreshState = (progress = readProgress()) => ({
  player: {
    x: 84,
    y: GROUND_Y - PLAYER_HEIGHT,
    w: PLAYER_WIDTH,
    h: PLAYER_HEIGHT,
    vx: 0,
    vy: 0,
    onGround: true,
    facing: 1,
  },
  coins: createCoins(),
  enemies: createEnemies(),
  cameraX: 0,
  score: 0,
  bestScore: progress.bestScore,
  coinsCollected: 0,
  bestCoins: progress.bestCoins,
  distance: 0,
  bestDistance: progress.bestDistance,
  hearts: 3,
  stage: 1,
  wins: progress.wins,
  jumps: 0,
  checkpointIndex: 0,
  checkpointX: CHECKPOINTS[0],
  recovering: 0,
  cleared: false,
  gameOver: false,
  paused: false,
  status: "Mushroom Run is live. Grab coins, dodge danger, and reach the finale.",
});

const getDistanceUnits = (x) => Math.max(0, Math.floor(x / 24));

const respawnPlayer = (state, nextHearts, status) => ({
  ...state,
  player: {
    ...state.player,
    x: state.checkpointX,
    y: GROUND_Y - PLAYER_HEIGHT,
    vx: 0,
    vy: 0,
    onGround: true,
  },
  hearts: nextHearts,
  recovering: nextHearts > 0 ? 1200 : 0,
  gameOver: nextHearts <= 0,
  paused: false,
  status:
    nextHearts <= 0
      ? "The course got the better of this run. Restart and try a cleaner route."
      : status,
});

const advanceFrame = (state, deltaMs, input, jumpQueued) => {
  if (state.paused || state.gameOver || state.cleared) {
    return state;
  }

  const delta = deltaMs / 16.6667;
  let status = state.status;
  let score = state.score;
  let coinsCollected = state.coinsCollected;
  let hearts = state.hearts;
  let jumps = state.jumps;
  let checkpointIndex = state.checkpointIndex;
  let checkpointX = state.checkpointX;
  let recovering = Math.max(0, state.recovering - deltaMs);
  let wins = state.wins;
  let cleared = state.cleared;
  let gameOver = state.gameOver;

  const player = { ...state.player };
  const enemies = state.enemies.map((enemy) => {
    if (!enemy.alive) {
      return enemy;
    }

    const nextX = enemy.x + enemy.speed * enemy.dir * delta;
    const reverse =
      nextX <= enemy.minX || nextX + enemy.w >= enemy.maxX;

    return {
      ...enemy,
      x: reverse ? enemy.x : nextX,
      dir: reverse ? enemy.dir * -1 : enemy.dir,
    };
  });

  const direction = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  if (direction !== 0) {
    player.vx = clamp(player.vx + direction * 0.58 * delta, -6.6, 6.6);
    player.facing = direction < 0 ? -1 : 1;
  } else {
    player.vx *= 0.82;
    if (Math.abs(player.vx) < 0.12) {
      player.vx = 0;
    }
  }

  if (jumpQueued && player.onGround) {
    player.vy = -11.4;
    player.onGround = false;
    jumps += 1;
    status = "Clean lift-off. Keep your rhythm through the gaps.";
  }

  player.vy = clamp(player.vy + 0.62 * delta, -20, 15);
  const previousBottom = player.y + player.h;
  player.x = clamp(player.x + player.vx * delta, 0, WORLD_WIDTH - player.w);
  player.y += player.vy * delta;
  player.onGround = false;

  if (player.y + player.h >= GROUND_Y) {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
  }

  for (const platform of PLATFORM_LAYOUT) {
    if (
      previousBottom <= platform.y + 6 &&
      player.y + player.h >= platform.y &&
      player.x + player.w > platform.x + 8 &&
      player.x < platform.x + platform.w - 8 &&
      player.vy >= 0
    ) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  }

  if (player.y > VIEW_HEIGHT + 120) {
    return respawnPlayer(state, hearts - 1, "You slipped off the course. Back to the last banner.");
  }

  if (checkpointIndex < CHECKPOINTS.length - 1 && player.x >= CHECKPOINTS[checkpointIndex + 1]) {
    checkpointIndex += 1;
    checkpointX = CHECKPOINTS[checkpointIndex];
    score += 140;
    status = `Checkpoint ${checkpointIndex + 1} secured. The run is still alive.`;
  }

  const coins = state.coins.map((coin) => {
    if (coin.collected) {
      return coin;
    }

    const dx = player.x + player.w / 2 - coin.x;
    const dy = player.y + player.h / 2 - coin.y;
    if (Math.hypot(dx, dy) < 26) {
      coinsCollected += 1;
      score += 110;
      status = "Coin trail collected. Keep threading the lane.";
      return { ...coin, collected: true };
    }

    return coin;
  });

  if (!recovering) {
    for (let index = 0; index < enemies.length; index += 1) {
      const enemy = enemies[index];
      if (!enemy.alive) {
        continue;
      }

      if (
        rectsOverlap(player, enemy) &&
        player.vy > 1.4 &&
        previousBottom <= enemy.y + 12
      ) {
        enemies[index] = {
          ...enemy,
          alive: false,
        };
        player.vy = -8.3;
        score += 180;
        status = "Enemy bounced. Keep your lane clean and moving.";
        continue;
      }

      if (rectsOverlap(player, enemy)) {
        return respawnPlayer(
          {
            ...state,
            score,
            coinsCollected,
            coins,
            enemies,
            checkpointIndex,
            checkpointX,
            jumps,
          },
          hearts - 1,
          "Rough collision. You dropped back to the last banner."
        );
      }
    }
  }

  const distance = Math.max(state.distance, getDistanceUnits(player.x));
  const bestDistance = Math.max(state.bestDistance, distance);
  const bestCoins = Math.max(state.bestCoins, coinsCollected);

  if (player.x >= GOAL_X) {
    const finishBonus = 1000 + hearts * 340 + coinsCollected * 32;
    score += finishBonus;
    wins += 1;
    cleared = true;
    status = "Course cleared. That run looked bright, smooth, and confident.";
  }

  const bestScore = Math.max(state.bestScore, score);
  const cameraX = clamp(player.x - VIEW_WIDTH * 0.28, 0, WORLD_WIDTH - VIEW_WIDTH);

  return {
    ...state,
    player,
    enemies,
    coins,
    cameraX,
    score,
    bestScore,
    coinsCollected,
    bestCoins,
    distance,
    bestDistance,
    hearts,
    wins,
    jumps,
    checkpointIndex,
    checkpointX,
    recovering,
    cleared,
    gameOver,
    status,
  };
};

const roundRect = (ctx, x, y, width, height, radius) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const drawCloud = (ctx, x, y, scale, alpha) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, 18 * scale, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(x + 20 * scale, y - 10 * scale, 22 * scale, Math.PI, Math.PI * 2);
  ctx.arc(x + 46 * scale, y - 2 * scale, 18 * scale, Math.PI * 1.5, Math.PI * 0.5);
  ctx.arc(x + 24 * scale, y + 12 * scale, 22 * scale, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const tintForPlatform = (platform) => {
  if (platform.tint === "gold") {
    return ["#f2ca67", "#b7762d"];
  }
  if (platform.tint === "violet") {
    return ["#8b92ff", "#5449d6"];
  }
  if (platform.tint === "mint") {
    return ["#72e3b0", "#25945d"];
  }
  return ["#d6d7de", "#6e7381"];
};

const renderStage = (canvas, state) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const isDark = document.documentElement.classList.contains("dark-mode");
  canvas.width = VIEW_WIDTH * dpr;
  canvas.height = VIEW_HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
  if (isDark) {
    sky.addColorStop(0, "#091a2e");
    sky.addColorStop(0.54, "#1a3358");
    sky.addColorStop(1, "#183b31");
  } else {
    sky.addColorStop(0, "#8fe5ff");
    sky.addColorStop(0.56, "#7cb7ff");
    sky.addColorStop(1, "#d6f5c7");
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  const cameraX = state.cameraX;

  ctx.fillStyle = isDark ? "rgba(255, 244, 190, 0.3)" : "rgba(255, 244, 190, 0.7)";
  ctx.beginPath();
  ctx.arc(826, 82, 34, 0, Math.PI * 2);
  ctx.fill();

  drawCloud(ctx, 120 - cameraX * 0.22, 76, 1.1, isDark ? 0.18 : 0.72);
  drawCloud(ctx, 430 - cameraX * 0.18, 104, 0.9, isDark ? 0.14 : 0.66);
  drawCloud(ctx, 790 - cameraX * 0.12, 66, 1.2, isDark ? 0.12 : 0.7);
  drawCloud(ctx, 1040 - cameraX * 0.26, 126, 1, isDark ? 0.11 : 0.64);

  ctx.fillStyle = isDark ? "#264b58" : "#66d1d4";
  ctx.beginPath();
  ctx.moveTo(-40, 312);
  ctx.bezierCurveTo(120, 232, 280, 284, 410, 248);
  ctx.bezierCurveTo(540, 214, 740, 298, 980, 224);
  ctx.lineTo(980, VIEW_HEIGHT);
  ctx.lineTo(-40, VIEW_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = isDark ? "#1c593f" : "#3ea767";
  ctx.beginPath();
  ctx.moveTo(-20, 344);
  ctx.bezierCurveTo(100, 298, 220, 322, 360, 278);
  ctx.bezierCurveTo(500, 238, 690, 344, 980, 288);
  ctx.lineTo(980, VIEW_HEIGHT);
  ctx.lineTo(-20, VIEW_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = isDark ? "#17442f" : "#2f934e";
  ctx.fillRect(0, GROUND_Y, VIEW_WIDTH, VIEW_HEIGHT - GROUND_Y);

  for (let stripeX = -cameraX % 72; stripeX < VIEW_WIDTH; stripeX += 72) {
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.16)";
    ctx.fillRect(stripeX, GROUND_Y, 36, VIEW_HEIGHT - GROUND_Y);
  }

  PLATFORM_LAYOUT.forEach((platform) => {
    const screenX = platform.x - cameraX;
    if (screenX + platform.w < -40 || screenX > VIEW_WIDTH + 40) {
      return;
    }

    const [topColor, baseColor] = tintForPlatform(platform);
    const gradient = ctx.createLinearGradient(screenX, platform.y, screenX, platform.y + platform.h);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(1, baseColor);
    roundRect(ctx, screenX, platform.y, platform.w, platform.h, 8);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  CHECKPOINTS.forEach((checkpoint, index) => {
    const screenX = checkpoint - cameraX;
    if (screenX < -40 || screenX > VIEW_WIDTH + 40 || index === 0) {
      return;
    }

    ctx.strokeStyle = "#fff2cb";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(screenX, GROUND_Y);
    ctx.lineTo(screenX, GROUND_Y - 88);
    ctx.stroke();

    ctx.fillStyle = index <= state.checkpointIndex ? "#ffd86f" : "rgba(255, 255, 255, 0.34)";
    roundRect(ctx, screenX, GROUND_Y - 88, 38, 22, 10);
    ctx.fill();
  });

  state.coins.forEach((coin) => {
    if (coin.collected) {
      return;
    }

    const screenX = coin.x - cameraX;
    if (screenX < -24 || screenX > VIEW_WIDTH + 24) {
      return;
    }

    ctx.save();
    ctx.translate(screenX, coin.y);
    ctx.fillStyle = "#ffd65f";
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f3a42c";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#fff6d8";
    ctx.fillRect(-2, -6, 4, 12);
    ctx.restore();
  });

  state.enemies.forEach((enemy) => {
    if (!enemy.alive) {
      return;
    }

    const screenX = enemy.x - cameraX;
    if (screenX + enemy.w < -40 || screenX > VIEW_WIDTH + 40) {
      return;
    }

    roundRect(ctx, screenX, enemy.y, enemy.w, enemy.h, 12);
    ctx.fillStyle = isDark ? "#b95d48" : "#d56c4f";
    ctx.fill();
    ctx.fillStyle = "#fff2de";
    ctx.fillRect(screenX + 8, enemy.y + 10, 6, 6);
    ctx.fillRect(screenX + 20, enemy.y + 10, 6, 6);
    ctx.fillStyle = "#35231d";
    ctx.fillRect(screenX + 9, enemy.y + 12, 4, 4);
    ctx.fillRect(screenX + 21, enemy.y + 12, 4, 4);
  });

  const goalScreenX = GOAL_X - cameraX;
  ctx.strokeStyle = "#fff1b8";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(goalScreenX, GROUND_Y);
  ctx.lineTo(goalScreenX, GROUND_Y - 144);
  ctx.stroke();
  ctx.fillStyle = "#f95757";
  roundRect(ctx, goalScreenX, GROUND_Y - 134, 48, 30, 10);
  ctx.fill();

  const playerX = state.player.x - cameraX;
  const playerY = state.player.y;
  ctx.save();
  ctx.globalAlpha = state.recovering ? (Math.sin(Date.now() / 80) * 0.3 + 0.7) : 1;
  roundRect(ctx, playerX + 6, playerY + 16, 28, 34, 10);
  ctx.fillStyle = "#2d8ca9";
  ctx.fill();
  roundRect(ctx, playerX + 9, playerY + 4, 22, 18, 8);
  ctx.fillStyle = "#f36f4b";
  ctx.fill();
  ctx.fillStyle = "#ffe1ca";
  ctx.beginPath();
  ctx.arc(playerX + 20, playerY + 24, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#35231d";
  ctx.fillRect(playerX + 14 + (state.player.facing < 0 ? -1 : 1), playerY + 22, 4, 4);
  ctx.fillRect(playerX + 22 + (state.player.facing < 0 ? -1 : 1), playerY + 22, 4, 4);
  ctx.fillRect(playerX + 17, playerY + 31, 10, 3);
  ctx.fillRect(playerX + 11, playerY + 40, 8, 10);
  ctx.fillRect(playerX + 23, playerY + 40, 8, 10);
  ctx.restore();

  ctx.fillStyle = "rgba(5, 18, 26, 0.3)";
  roundRect(ctx, 18, 16, 164, 56, 18);
  ctx.fill();
  ctx.fillStyle = "#f8fff9";
  ctx.font = "700 15px Segoe UI";
  ctx.fillText(`Coins ${state.coinsCollected}`, 34, 39);
  ctx.fillText(`Hearts ${state.hearts}`, 34, 60);
  ctx.fillText(`Run ${state.distance}`, 106, 39);
  ctx.fillText(`Goal ${Math.max(0, getDistanceUnits(GOAL_X) - state.distance)}`, 106, 60);
};

export default function MushroomRun({ onSessionChange }) {
  const [state, setState] = useState(() => createFreshState());
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const lastTimeRef = useRef(0);
  const inputRef = useRef({ left: false, right: false });
  const jumpQueuedRef = useRef(false);
  const lastBroadcastRef = useRef(0);

  const {
    score,
    bestScore,
    coinsCollected,
    bestCoins,
    distance,
    bestDistance,
    hearts,
    wins,
    jumps,
    cleared,
    gameOver,
    paused,
    status,
  } = state;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        bestScore,
        bestCoins,
        bestDistance,
        wins,
      })
    );
  }, [bestCoins, bestDistance, bestScore, wins]);

  useEffect(() => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (!gameOver && !cleared && now - lastBroadcastRef.current < 180) {
      return;
    }

    lastBroadcastRef.current = now;
    onSessionChange?.({
      game: "mushroom-run",
      score,
      bestScore,
      moves: jumps,
      coins: coinsCollected,
      distance,
      stage: 1,
      hearts,
      wins,
      gameOver,
      status,
    });
  }, [bestScore, cleared, coinsCollected, distance, gameOver, hearts, jumps, onSessionChange, score, status, wins]);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    renderStage(canvasRef.current, state);
  }, [state]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        event.preventDefault();
        inputRef.current.left = true;
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        event.preventDefault();
        inputRef.current.right = true;
      }

      if (
        event.key === "ArrowUp" ||
        event.key === " " ||
        event.code === "Space" ||
        event.key.toLowerCase() === "w"
      ) {
        event.preventDefault();
        jumpQueuedRef.current = true;
      }

      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        setState((currentState) =>
          currentState.gameOver || currentState.cleared
            ? currentState
            : {
                ...currentState,
                paused: !currentState.paused,
                status: currentState.paused
                  ? "Back in motion. Keep the course flowing."
                  : "Run paused.",
              }
        );
      }
    };

    const onKeyUp = (event) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        inputRef.current.left = false;
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        inputRef.current.right = false;
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (paused || gameOver || cleared) {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return undefined;
    }

    const animate = (time) => {
      const delta = lastTimeRef.current ? Math.min(30, time - lastTimeRef.current) : 16.6667;
      lastTimeRef.current = time;

      setState((currentState) => advanceFrame(currentState, delta, inputRef.current, jumpQueuedRef.current));
      jumpQueuedRef.current = false;
      frameRef.current = window.requestAnimationFrame(animate);
    };

    frameRef.current = window.requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      lastTimeRef.current = 0;
    };
  }, [paused, gameOver, cleared]);

  const restartRun = () => {
    setState((currentState) =>
      createFreshState({
        bestScore: Math.max(currentState.bestScore, currentState.score),
        bestCoins: Math.max(currentState.bestCoins, currentState.coinsCollected),
        bestDistance: Math.max(currentState.bestDistance, currentState.distance),
        wins: currentState.wins,
      })
    );
  };

  const togglePause = () => {
    setState((currentState) =>
      currentState.gameOver || currentState.cleared
        ? currentState
        : {
            ...currentState,
            paused: !currentState.paused,
            status: currentState.paused
              ? "Back in motion. Keep the course flowing."
              : "Run paused.",
          }
    );
  };

  const goalDistance = useMemo(() => getDistanceUnits(GOAL_X), []);
  const progressPercent = useMemo(
    () => clamp((distance / goalDistance) * 100, 0, 100),
    [distance, goalDistance]
  );

  const setHeldDirection = (direction, pressed) => {
    if (direction === "left") {
      inputRef.current.left = pressed;
      return;
    }

    if (direction === "right") {
      inputRef.current.right = pressed;
    }
  };

  const overlayVisible = paused || gameOver || cleared;

  return (
    <section className="game-mushroom-shell">
      <div className="game-mushroom-head">
        <div>
          <p className="game-mushroom-kicker">Original plumber lane</p>
          <h3>Mushroom Run</h3>
          <p>{status}</p>
        </div>

        <div className="game-mushroom-head-actions">
          <button type="button" className="btn-secondary" onClick={togglePause} disabled={gameOver || cleared}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button type="button" className="btn-secondary" onClick={restartRun}>
            New run
          </button>
        </div>
      </div>

      <div className="game-mushroom-stats">
        <div>
          <span>Score</span>
          <strong>{score}</strong>
        </div>
        <div>
          <span>Best</span>
          <strong>{bestScore}</strong>
        </div>
        <div>
          <span>Coins</span>
          <strong>{coinsCollected}</strong>
        </div>
        <div>
          <span>Hearts</span>
          <strong>{hearts}</strong>
        </div>
      </div>

      <div className="game-mushroom-stage">
        <div className="game-mushroom-canvas-shell">
          <canvas ref={canvasRef} className="game-mushroom-canvas" aria-label="Mushroom Run game stage" />

          {overlayVisible ? (
            <div className="game-mushroom-overlay">
              <strong>{cleared ? "Course cleared" : gameOver ? "Run over" : "Run paused"}</strong>
              <p>
                {cleared
                  ? "You reached the finale banner. Start another run and chase a cleaner score."
                  : gameOver
                    ? "The course pushed back this time. A fresh run is ready whenever you are."
                    : "Take a breath, then jump back in when you want the lane moving again."}
              </p>
              <div className="game-mushroom-overlay-actions">
                {paused ? (
                  <button type="button" className="btn-secondary" onClick={togglePause}>
                    Resume run
                  </button>
                ) : null}
                <button type="button" className="btn-secondary" onClick={restartRun}>
                  New run
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="game-mushroom-aside">
          <div className="game-mushroom-side-card">
            <span>Course progress</span>
            <strong>{distance} / {goalDistance}</strong>
            <p>The finale banner is closer than it looks. Keep the rhythm calm over the later platforms.</p>
            <div className="game-mushroom-progress" aria-hidden="true">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <div className="game-mushroom-side-card">
            <span>Best route</span>
            <strong>{bestDistance} distance</strong>
            <p>Local best score, coin haul, and course clears stay saved on this device.</p>
          </div>

          <div className="game-mushroom-side-card">
            <span>Course clears</span>
            <strong>{wins}</strong>
            <p>Each finish rewards coin discipline and clean checkpoint recovery.</p>
          </div>

          <div className="game-mushroom-side-card">
            <span>Controls</span>
            <strong>Move, jump, collect</strong>
            <p>Use Arrow keys or A and D to move, Up or Space to jump, and P to pause.</p>
          </div>

          <div className="game-mushroom-controls" aria-label="Mushroom Run touch controls">
            <button
              type="button"
              onPointerDown={() => setHeldDirection("left", true)}
              onPointerUp={() => setHeldDirection("left", false)}
              onPointerLeave={() => setHeldDirection("left", false)}
              onPointerCancel={() => setHeldDirection("left", false)}
            >
              Left
            </button>
            <button
              type="button"
              onPointerDown={() => {
                jumpQueuedRef.current = true;
              }}
            >
              Jump
            </button>
            <button
              type="button"
              onPointerDown={() => setHeldDirection("right", true)}
              onPointerUp={() => setHeldDirection("right", false)}
              onPointerLeave={() => setHeldDirection("right", false)}
              onPointerCancel={() => setHeldDirection("right", false)}
            >
              Right
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
