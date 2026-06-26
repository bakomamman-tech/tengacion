import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "tengacion.gaming.tengacion-racer.progress";
const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 520;
const ROAD_WIDTH = 500;
const ROAD_X = (VIEW_WIDTH - ROAD_WIDTH) / 2;
const LANE_COUNT = 4;
const LANE_WIDTH = ROAD_WIDTH / LANE_COUNT;
const PLAYER_WIDTH = 58;
const PLAYER_HEIGHT = 92;
const PLAYER_Y = VIEW_HEIGHT - PLAYER_HEIGHT - 34;
const PLAYER_START_X = ROAD_X + LANE_WIDTH * 1.5 - PLAYER_WIDTH / 2;
const TRAFFIC_WIDTH = 54;
const TRAFFIC_HEIGHT = 88;
const PICKUP_SIZE = 30;

const TRAFFIC_PAINTS = ["#ff6b55", "#45a3ff", "#ffd35c", "#a66cff", "#49d894"];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const rectsOverlap = (a, b) =>
  a.x < b.x + b.w &&
  a.x + a.w > b.x &&
  a.y < b.y + b.h &&
  a.y + a.h > b.y;

const randomLane = () => Math.floor(Math.random() * LANE_COUNT);

const laneCenterX = (lane) => ROAD_X + lane * LANE_WIDTH + LANE_WIDTH / 2;

const createId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const readProgress = () => {
  if (typeof window === "undefined") {
    return { bestScore: 0, bestDistance: 0, bestOvertakes: 0, bestCoins: 0 };
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      bestScore: Number(parsed.bestScore) || 0,
      bestDistance: Number(parsed.bestDistance) || 0,
      bestOvertakes: Number(parsed.bestOvertakes) || 0,
      bestCoins: Number(parsed.bestCoins) || 0,
    };
  } catch {
    return { bestScore: 0, bestDistance: 0, bestOvertakes: 0, bestCoins: 0 };
  }
};

const createFreshState = (progress = readProgress()) => ({
  playerX: PLAYER_START_X,
  velocityX: 0,
  speed: 6.2,
  roadOffset: 0,
  score: 0,
  bestScore: progress.bestScore,
  distance: 0,
  bestDistance: progress.bestDistance,
  overtakes: 0,
  bestOvertakes: progress.bestOvertakes,
  coins: 0,
  bestCoins: progress.bestCoins,
  streak: 0,
  boost: 72,
  damage: 0,
  traffic: [],
  pickups: [],
  trafficTimer: 360,
  pickupTimer: 760,
  paused: false,
  gameOver: false,
  status: "Tengacion Racer is live. Hold the racing line, dodge traffic, and use boost wisely.",
});

const makeTrafficCar = (traffic = []) => {
  let lane = randomLane();
  const blockedLanes = new Set(
    traffic
      .filter((car) => car.y < 160)
      .map((car) => car.lane)
  );

  if (blockedLanes.has(lane)) {
    const openLanes = Array.from({ length: LANE_COUNT }, (_, index) => index).filter(
      (entry) => !blockedLanes.has(entry)
    );
    lane = openLanes.length ? openLanes[Math.floor(Math.random() * openLanes.length)] : lane;
  }

  return {
    id: createId("traffic"),
    lane,
    x: laneCenterX(lane) - TRAFFIC_WIDTH / 2 + (Math.random() - 0.5) * 12,
    y: -TRAFFIC_HEIGHT - Math.random() * 80,
    w: TRAFFIC_WIDTH,
    h: TRAFFIC_HEIGHT,
    speed: 1.2 + Math.random() * 1.8,
    paint: TRAFFIC_PAINTS[Math.floor(Math.random() * TRAFFIC_PAINTS.length)],
    passed: false,
  };
};

const makePickup = (pickups = []) => {
  let lane = randomLane();
  const crowdedLane = pickups.find((pickup) => pickup.lane === lane && pickup.y < 180);
  if (crowdedLane) {
    lane = (lane + 1 + Math.floor(Math.random() * (LANE_COUNT - 1))) % LANE_COUNT;
  }

  return {
    id: createId("boost"),
    lane,
    x: laneCenterX(lane) - PICKUP_SIZE / 2,
    y: -PICKUP_SIZE - Math.random() * 120,
    w: PICKUP_SIZE,
    h: PICKUP_SIZE,
  };
};

const getStatusForOvertake = (streak) => {
  if (streak >= 8) {
    return "Hot streak. The traffic line is opening up beautifully.";
  }
  if (streak >= 4) {
    return "Clean overtakes are stacking. Keep breathing through the corners.";
  }
  return "Traffic cleared. Stay centered and watch the next lane.";
};

const advanceFrame = (state, deltaMs, input) => {
  if (state.paused || state.gameOver) {
    return state;
  }

  const delta = Math.min(deltaMs, 34) / 16.6667;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const accelerating = input.up ? 1 : 0;
  const braking = input.down ? 1 : 0;
  let boost = state.boost;
  const usingBoost = Boolean(input.boost && boost > 1 && !braking);
  boost = clamp(boost + (usingBoost ? -1.28 * delta : 0.24 * delta), 0, 100);

  let velocityX = state.velocityX;
  if (steer) {
    velocityX = clamp(velocityX + steer * 1.05 * delta, -10.5, 10.5);
  } else {
    velocityX *= 0.82;
    if (Math.abs(velocityX) < 0.06) {
      velocityX = 0;
    }
  }

  const playerX = clamp(
    state.playerX + velocityX * delta,
    ROAD_X + 16,
    ROAD_X + ROAD_WIDTH - PLAYER_WIDTH - 16
  );
  const speedLift = Math.min(state.distance / 2600, 2.6);
  const targetSpeed = clamp(
    5.2 + accelerating * 2.7 - braking * 2.4 + (usingBoost ? 4.4 : 0) + speedLift,
    2.8,
    13.6
  );
  const speed = state.speed + (targetSpeed - state.speed) * 0.09 * delta;
  const roadOffset = (state.roadOffset + speed * 7.8 * delta) % 96;
  const distance = state.distance + speed * 0.72 * delta;
  let score = state.score + speed * 0.22 * delta + state.streak * 0.018 * delta;
  let overtakes = state.overtakes;
  let coins = state.coins;
  let streak = state.streak;
  let damage = state.damage;
  let trafficTimer = state.trafficTimer - deltaMs;
  let pickupTimer = state.pickupTimer - deltaMs;
  let status = state.status;
  let gameOver = false;

  const playerRect = {
    x: playerX + 8,
    y: PLAYER_Y + 8,
    w: PLAYER_WIDTH - 16,
    h: PLAYER_HEIGHT - 16,
  };

  let nextTraffic = state.traffic.map((car) => ({
    ...car,
    y: car.y + (speed * 6.1 + car.speed * 3.8) * delta,
  }));

  if (trafficTimer <= 0) {
    nextTraffic = [...nextTraffic, makeTrafficCar(nextTraffic)];
    trafficTimer = 560 + Math.random() * 560 - Math.min(distance / 18, 260);
  }

  nextTraffic = nextTraffic
    .map((car) => {
      if (rectsOverlap(playerRect, car)) {
        damage = clamp(damage + 34, 0, 100);
        streak = 0;
        score = Math.max(0, score - 140);
        status =
          damage >= 100
            ? "The car is too damaged to continue. Start a fresh race."
            : "Contact on the lane. Recover speed and rebuild the streak.";
        return null;
      }

      if (!car.passed && car.y > PLAYER_Y + PLAYER_HEIGHT + 8) {
        overtakes += 1;
        streak += 1;
        score += 90 + streak * 10;
        boost = clamp(boost + 4, 0, 100);
        status = getStatusForOvertake(streak);
        return { ...car, passed: true };
      }

      return car;
    })
    .filter((car) => car && car.y < VIEW_HEIGHT + 150);

  let nextPickups = state.pickups.map((pickup) => ({
    ...pickup,
    y: pickup.y + speed * 6.3 * delta,
  }));

  if (pickupTimer <= 0) {
    nextPickups = [...nextPickups, makePickup(nextPickups)];
    pickupTimer = 1180 + Math.random() * 900;
  }

  nextPickups = nextPickups
    .map((pickup) => {
      if (rectsOverlap(playerRect, pickup)) {
        coins += 1;
        streak += 1;
        score += 140 + streak * 8;
        boost = clamp(boost + 16, 0, 100);
        status = "Boost token banked. Hit the straight and spend it with intent.";
        return null;
      }

      return pickup;
    })
    .filter((pickup) => pickup && pickup.y < VIEW_HEIGHT + 80);

  if (damage >= 100) {
    gameOver = true;
  }

  const roundedScore = Math.floor(score);
  const roundedDistance = Math.floor(distance);

  return {
    ...state,
    playerX,
    velocityX,
    speed,
    roadOffset,
    score: roundedScore,
    bestScore: Math.max(state.bestScore, roundedScore),
    distance: roundedDistance,
    bestDistance: Math.max(state.bestDistance, roundedDistance),
    overtakes,
    bestOvertakes: Math.max(state.bestOvertakes, overtakes),
    coins,
    bestCoins: Math.max(state.bestCoins, coins),
    streak,
    boost,
    damage,
    traffic: nextTraffic,
    pickups: nextPickups,
    trafficTimer,
    pickupTimer,
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

const drawCar = (ctx, car, isPlayer = false) => {
  const paint = isPlayer ? "#f05f42" : car.paint;
  const highlight = isPlayer ? "#ffe36f" : "#f7fbff";
  const x = car.x;
  const y = car.y;
  const w = car.w;
  const h = car.h;

  ctx.save();
  ctx.shadowColor = isPlayer ? "rgba(240, 95, 66, 0.36)" : "rgba(7, 14, 24, 0.28)";
  ctx.shadowBlur = isPlayer ? 24 : 16;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = paint;
  ctx.fill();
  ctx.restore();

  roundRect(ctx, x + 7, y + 12, w - 14, h - 24, 13);
  ctx.fillStyle = paint;
  ctx.fill();

  const glass = ctx.createLinearGradient(x, y + 10, x, y + h - 12);
  glass.addColorStop(0, "rgba(244, 252, 255, 0.9)");
  glass.addColorStop(0.48, "rgba(92, 170, 205, 0.66)");
  glass.addColorStop(1, "rgba(16, 44, 66, 0.78)");
  roundRect(ctx, x + 13, y + 18, w - 26, h * 0.34, 10);
  ctx.fillStyle = glass;
  ctx.fill();

  roundRect(ctx, x + 15, y + h * 0.58, w - 30, h * 0.22, 9);
  ctx.fillStyle = isPlayer ? "rgba(255, 229, 111, 0.7)" : "rgba(255, 255, 255, 0.34)";
  ctx.fill();

  ctx.fillStyle = "#111827";
  roundRect(ctx, x - 4, y + 18, 10, 24, 5);
  ctx.fill();
  roundRect(ctx, x + w - 6, y + 18, 10, 24, 5);
  ctx.fill();
  roundRect(ctx, x - 4, y + h - 42, 10, 24, 5);
  ctx.fill();
  roundRect(ctx, x + w - 6, y + h - 42, 10, 24, 5);
  ctx.fill();

  ctx.fillStyle = highlight;
  roundRect(ctx, x + 8, isPlayer ? y + 5 : y + h - 14, 11, 7, 4);
  ctx.fill();
  roundRect(ctx, x + w - 19, isPlayer ? y + 5 : y + h - 14, 11, 7, 4);
  ctx.fill();
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
  sky.addColorStop(0, isDark ? "#081426" : "#76d7ff");
  sky.addColorStop(0.42, isDark ? "#152b3d" : "#b8ebff");
  sky.addColorStop(1, isDark ? "#102316" : "#dff8d5");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  ctx.fillStyle = isDark ? "rgba(255, 224, 119, 0.24)" : "rgba(255, 224, 119, 0.72)";
  ctx.beginPath();
  ctx.arc(800, 76, 34, 0, Math.PI * 2);
  ctx.fill();

  for (let index = 0; index < 7; index += 1) {
    const x = (index * 168 + state.roadOffset * 0.8) % (VIEW_WIDTH + 160) - 80;
    const hillHeight = 72 + (index % 3) * 18;
    ctx.fillStyle = isDark ? "rgba(42, 96, 73, 0.72)" : "rgba(70, 164, 104, 0.62)";
    ctx.beginPath();
    ctx.moveTo(x - 70, VIEW_HEIGHT);
    ctx.lineTo(x + 58, VIEW_HEIGHT - 206 - hillHeight);
    ctx.lineTo(x + 188, VIEW_HEIGHT);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = isDark ? "#12351f" : "#4fad64";
  ctx.fillRect(0, 220, VIEW_WIDTH, VIEW_HEIGHT - 220);

  for (let y = -80 + state.roadOffset; y < VIEW_HEIGHT + 80; y += 96) {
    ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(255, 255, 255, 0.22)";
    ctx.fillRect(68, y, 84, 18);
    ctx.fillRect(VIEW_WIDTH - 152, y + 42, 84, 18);
  }

  const shoulder = ctx.createLinearGradient(ROAD_X - 54, 0, ROAD_X, 0);
  shoulder.addColorStop(0, isDark ? "#6f562f" : "#d0a45b");
  shoulder.addColorStop(1, isDark ? "#2d2f31" : "#707474");
  ctx.fillStyle = shoulder;
  ctx.fillRect(ROAD_X - 52, 0, 52, VIEW_HEIGHT);

  const shoulderRight = ctx.createLinearGradient(ROAD_X + ROAD_WIDTH, 0, ROAD_X + ROAD_WIDTH + 54, 0);
  shoulderRight.addColorStop(0, isDark ? "#2d2f31" : "#707474");
  shoulderRight.addColorStop(1, isDark ? "#6f562f" : "#d0a45b");
  ctx.fillStyle = shoulderRight;
  ctx.fillRect(ROAD_X + ROAD_WIDTH, 0, 52, VIEW_HEIGHT);

  const road = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
  road.addColorStop(0, isDark ? "#202733" : "#6b7178");
  road.addColorStop(1, isDark ? "#0e141d" : "#343a42");
  ctx.fillStyle = road;
  ctx.fillRect(ROAD_X, 0, ROAD_WIDTH, VIEW_HEIGHT);

  ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.13)" : "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(ROAD_X + 10, 0, 7, VIEW_HEIGHT);
  ctx.fillRect(ROAD_X + ROAD_WIDTH - 17, 0, 7, VIEW_HEIGHT);

  for (let lane = 1; lane < LANE_COUNT; lane += 1) {
    const x = ROAD_X + lane * LANE_WIDTH;
    for (let y = -80 + state.roadOffset; y < VIEW_HEIGHT + 80; y += 96) {
      roundRect(ctx, x - 4, y, 8, 46, 4);
      ctx.fillStyle = "#fff4ca";
      ctx.fill();
    }
  }

  state.pickups.forEach((pickup) => {
    ctx.save();
    ctx.translate(pickup.x + PICKUP_SIZE / 2, pickup.y + PICKUP_SIZE / 2);
    ctx.rotate((Date.now() / 420) % (Math.PI * 2));
    ctx.fillStyle = "#ffe36f";
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f08a24";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "#fff8d8";
    ctx.fillRect(-3, -10, 6, 20);
    ctx.restore();
  });

  state.traffic.forEach((car) => drawCar(ctx, car, false));
  drawCar(
    ctx,
    {
      x: state.playerX,
      y: PLAYER_Y,
      w: PLAYER_WIDTH,
      h: PLAYER_HEIGHT,
      paint: "#f05f42",
    },
    true
  );

  if (state.boost > 18 && !state.gameOver && !state.paused) {
    ctx.save();
    ctx.globalAlpha = clamp(state.speed / 15, 0.25, 0.8);
    const flame = ctx.createLinearGradient(0, PLAYER_Y + PLAYER_HEIGHT, 0, PLAYER_Y + PLAYER_HEIGHT + 50);
    flame.addColorStop(0, "rgba(255, 238, 122, 0.86)");
    flame.addColorStop(1, "rgba(255, 99, 71, 0)");
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(state.playerX + PLAYER_WIDTH * 0.3, PLAYER_Y + PLAYER_HEIGHT - 4);
    ctx.lineTo(state.playerX + PLAYER_WIDTH * 0.5, PLAYER_Y + PLAYER_HEIGHT + 44);
    ctx.lineTo(state.playerX + PLAYER_WIDTH * 0.7, PLAYER_Y + PLAYER_HEIGHT - 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = "rgba(7, 13, 24, 0.56)";
  roundRect(ctx, 24, 22, 218, 72, 20);
  ctx.fill();
  ctx.fillStyle = "#f8fff6";
  ctx.font = "800 17px Segoe UI";
  ctx.fillText(`Score ${state.score}`, 42, 50);
  ctx.fillText(`Speed ${Math.round(state.speed * 18)} km/h`, 42, 75);
  ctx.font = "700 13px Segoe UI";
  ctx.fillStyle = "rgba(248, 255, 246, 0.78)";
  ctx.fillText(`Distance ${state.distance}  Boost ${Math.round(state.boost)}%`, 42, 92);
};

export default function TengacionRacer({ onSessionChange }) {
  const [state, setState] = useState(() => createFreshState());
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const lastTimeRef = useRef(0);
  const inputRef = useRef({
    left: false,
    right: false,
    up: false,
    down: false,
    boost: false,
  });
  const lastBroadcastRef = useRef(0);

  const {
    score,
    bestScore,
    distance,
    bestDistance,
    overtakes,
    bestOvertakes,
    coins,
    bestCoins,
    streak,
    boost,
    damage,
    speed,
    paused,
    gameOver,
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
        bestDistance,
        bestOvertakes,
        bestCoins,
      })
    );
  }, [bestCoins, bestDistance, bestOvertakes, bestScore]);

  useEffect(() => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (!gameOver && now - lastBroadcastRef.current < 180) {
      return;
    }

    lastBroadcastRef.current = now;
    onSessionChange?.({
      game: "tengacion-racer",
      score,
      bestScore,
      moves: overtakes,
      distance,
      bestDistance,
      speed: Math.round(speed * 18),
      overtakes,
      coins,
      streak,
      boost: Math.round(boost),
      damage,
      integrity: Math.max(0, 100 - damage),
      gameOver,
      status,
    });
  }, [
    bestDistance,
    bestScore,
    boost,
    coins,
    damage,
    distance,
    gameOver,
    onSessionChange,
    overtakes,
    score,
    speed,
    status,
    streak,
  ]);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    renderStage(canvasRef.current, state);
  }, [state]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key?.toLowerCase?.();

      if (event.key === "ArrowLeft" || key === "a") {
        event.preventDefault();
        inputRef.current.left = true;
        return;
      }

      if (event.key === "ArrowRight" || key === "d") {
        event.preventDefault();
        inputRef.current.right = true;
        return;
      }

      if (event.key === "ArrowUp" || key === "w") {
        event.preventDefault();
        inputRef.current.up = true;
        return;
      }

      if (event.key === "ArrowDown" || key === "s") {
        event.preventDefault();
        inputRef.current.down = true;
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        inputRef.current.boost = true;
        return;
      }

      if (key === "p") {
        event.preventDefault();
        setState((currentState) =>
          currentState.gameOver
            ? currentState
            : {
                ...currentState,
                paused: !currentState.paused,
                status: currentState.paused ? "Race resumed. Find the next open lane." : "Race paused.",
              }
        );
      }
    };

    const onKeyUp = (event) => {
      const key = event.key?.toLowerCase?.();
      if (event.key === "ArrowLeft" || key === "a") {
        inputRef.current.left = false;
      }
      if (event.key === "ArrowRight" || key === "d") {
        inputRef.current.right = false;
      }
      if (event.key === "ArrowUp" || key === "w") {
        inputRef.current.up = false;
      }
      if (event.key === "ArrowDown" || key === "s") {
        inputRef.current.down = false;
      }
      if (event.code === "Space") {
        inputRef.current.boost = false;
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
    if (paused || gameOver) {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return undefined;
    }

    const animate = (time) => {
      const delta = lastTimeRef.current ? time - lastTimeRef.current : 16.6667;
      lastTimeRef.current = time;
      setState((currentState) => advanceFrame(currentState, delta, inputRef.current));
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
  }, [gameOver, paused]);

  const restartRace = () => {
    setState((currentState) =>
      createFreshState({
        bestScore: Math.max(currentState.bestScore, currentState.score),
        bestDistance: Math.max(currentState.bestDistance, currentState.distance),
        bestOvertakes: Math.max(currentState.bestOvertakes, currentState.overtakes),
        bestCoins: Math.max(currentState.bestCoins, currentState.coins),
      })
    );
  };

  const togglePause = () => {
    setState((currentState) =>
      currentState.gameOver
        ? currentState
        : {
            ...currentState,
            paused: !currentState.paused,
            status: currentState.paused ? "Race resumed. Find the next open lane." : "Race paused.",
          }
    );
  };

  const setHeldControl = (control, pressed) => {
    inputRef.current[control] = pressed;
  };

  const integrity = Math.max(0, 100 - damage);
  const speedLabel = Math.round(speed * 18);
  const boostPercent = useMemo(() => clamp(boost, 0, 100), [boost]);
  const overlayVisible = paused || gameOver;

  return (
    <section className="game-racer-shell">
      <div className="game-racer-head">
        <div>
          <p className="game-racer-kicker">Tengacion speed lane</p>
          <h3>Tengacion Racer</h3>
          <p>{status}</p>
        </div>
      </div>

      <div className="game-racer-stats">
        <div>
          <span>Score</span>
          <strong>{score}</strong>
        </div>
        <div>
          <span>Best</span>
          <strong>{bestScore}</strong>
        </div>
        <div>
          <span>Distance</span>
          <strong>{distance}</strong>
        </div>
        <div>
          <span>Integrity</span>
          <strong>{integrity}%</strong>
        </div>
      </div>

      <div className="game-racer-stage">
        <div className="game-live-play-column">
          <div className="game-live-control-dock" role="region" aria-label="Tengacion Racer play controls">
            <div className="game-live-control-dock__head">
              <strong>Play controls</strong>
              <span>Steer, brake, accelerate, and fire boost beside the live road.</span>
            </div>
            <div className="game-live-control-dock__body">
              <div className="game-racer-controls" aria-label="Tengacion Racer touch controls">
                <button
                  type="button"
                  onPointerDown={() => setHeldControl("left", true)}
                  onPointerUp={() => setHeldControl("left", false)}
                  onPointerLeave={() => setHeldControl("left", false)}
                  onPointerCancel={() => setHeldControl("left", false)}
                >
                  Left
                </button>
                <button
                  type="button"
                  onPointerDown={() => setHeldControl("up", true)}
                  onPointerUp={() => setHeldControl("up", false)}
                  onPointerLeave={() => setHeldControl("up", false)}
                  onPointerCancel={() => setHeldControl("up", false)}
                >
                  Accelerate
                </button>
                <button
                  type="button"
                  onPointerDown={() => setHeldControl("right", true)}
                  onPointerUp={() => setHeldControl("right", false)}
                  onPointerLeave={() => setHeldControl("right", false)}
                  onPointerCancel={() => setHeldControl("right", false)}
                >
                  Right
                </button>
                <button
                  type="button"
                  onPointerDown={() => setHeldControl("down", true)}
                  onPointerUp={() => setHeldControl("down", false)}
                  onPointerLeave={() => setHeldControl("down", false)}
                  onPointerCancel={() => setHeldControl("down", false)}
                >
                  Brake
                </button>
                <button
                  type="button"
                  onPointerDown={() => setHeldControl("boost", true)}
                  onPointerUp={() => setHeldControl("boost", false)}
                  onPointerLeave={() => setHeldControl("boost", false)}
                  onPointerCancel={() => setHeldControl("boost", false)}
                >
                  Boost
                </button>
              </div>
              <div className="game-live-session-actions">
                <button type="button" className="btn-secondary" onClick={togglePause} disabled={gameOver}>
                  {paused ? "Resume" : "Pause"}
                </button>
                <button type="button" className="btn-secondary" onClick={restartRace}>
                  New race
                </button>
              </div>
            </div>
          </div>

          <div className="game-racer-canvas-shell">
            <canvas ref={canvasRef} className="game-racer-canvas" aria-label="Tengacion Racer game stage" />

            {overlayVisible ? (
              <div className="game-racer-overlay">
                <strong>{gameOver ? "Race ended" : "Race paused"}</strong>
                <p>
                  {gameOver
                    ? "The car took too much damage. Start a fresh race and chase a cleaner line."
                    : "Take a breath, then resume when you are ready to get back on the road."}
                </p>
                <div className="game-racer-overlay-actions">
                  {paused ? (
                    <button type="button" className="btn-secondary" onClick={togglePause}>
                      Resume race
                    </button>
                  ) : null}
                  <button type="button" className="btn-secondary" onClick={restartRace}>
                    New race
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="game-racer-aside">
          <div className="game-racer-side-card">
            <span>Road speed</span>
            <strong>{speedLabel} km/h</strong>
            <p>Hold accelerate on clean stretches, then tap brake when a lane gets crowded.</p>
          </div>

          <div className="game-racer-side-card">
            <span>Boost tank</span>
            <strong>{Math.round(boostPercent)}%</strong>
            <p>Collect yellow tokens and clean overtakes to refill boost.</p>
            <div className="game-racer-progress" aria-hidden="true">
              <span style={{ width: `${boostPercent}%` }} />
            </div>
          </div>

          <div className="game-racer-side-card">
            <span>Overtakes</span>
            <strong>{overtakes}</strong>
            <p>Best run: {bestOvertakes} overtakes, {bestDistance} distance, {bestCoins} boost tokens.</p>
          </div>

          <div className="game-racer-side-card">
            <span>Controls</span>
            <strong>Steer, boost, recover</strong>
            <p>Use Arrow keys or WASD to drive, Space for boost, and P to pause.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
