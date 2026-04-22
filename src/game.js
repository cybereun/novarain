const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  stage: document.getElementById("stage"),
  score: document.getElementById("score"),
  wave: document.getElementById("wave"),
  bombs: document.getElementById("bombs"),
  weapon: document.getElementById("weapon"),
  multiplier: document.getElementById("multiplier"),
  threat: document.getElementById("threat"),
  healthFill: document.getElementById("health-fill"),
  energyFill: document.getElementById("energy-fill"),
  overlay: document.getElementById("overlay"),
  overlayTag: document.getElementById("overlay-tag"),
  overlayTitle: document.getElementById("overlay-title"),
  overlayBody: document.getElementById("overlay-body"),
  overlayButton: document.getElementById("overlay-button"),
};

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const TWO_PI = Math.PI * 2;
const WAVES_PER_STAGE = 4;

const keys = new Set();
const audio = createAudioSystem();
const spriteSheet = loadShipSprites();
const pickupSprites = loadPickupSprites();

const threatLabels = ["안정", "경계", "위험", "치명", "악몽"];

const weaponProfiles = {
  pulse: {
    label: "기본포",
    energyCost: 0,
    cadence: 0.11,
    fire(game, player) {
      [-10, 10].forEach((offset) => {
        spawnPlayerBullet(game, player.x + offset, player.y - 22, 0, -680, 11, "#9cf6ff");
      });
    },
  },
  spread: {
    label: "확산포",
    energyCost: 4,
    cadence: 0.16,
    fire(game, player) {
      [-0.34, -0.12, 0.12, 0.34].forEach((angle) => {
        const speed = 620;
        spawnPlayerBullet(
          game,
          player.x,
          player.y - 18,
          Math.sin(angle) * speed,
          -Math.cos(angle) * speed,
          10,
          "#ffe584"
        );
      });
    },
  },
  laser: {
    label: "레이저",
    energyCost: 8,
    cadence: 0.09,
    fire(game, player) {
      [-16, 0, 16].forEach((offset) => {
        spawnPlayerBullet(game, player.x + offset, player.y - 24, 0, -860, 12, "#ff7af6");
      });
    },
  },
  rail: {
    label: "레일건",
    energyCost: 11,
    cadence: 0.2,
    fire(game, player) {
      spawnPlayerBullet(game, player.x, player.y - 28, 0, -980, 42, "#7affbc", 8);
      spawnPlayerBullet(game, player.x - 18, player.y - 18, 0, -840, 14, "#7affbc", 4);
      spawnPlayerBullet(game, player.x + 18, player.y - 18, 0, -840, 14, "#7affbc", 4);
    },
  },
};

function createGameState() {
  return {
    mode: "menu",
    score: 0,
    time: 0,
    wave: 1,
    stage: 1,
    multiplier: 1,
    multiplierTimer: 0,
    screenShake: 0,
    flash: 0,
    enemySpawnTimer: 1,
    waveTimer: 0,
    patternIndex: 0,
    stageBanner: 0,
    stageBannerTag: "",
    stageBannerText: "",
    stageBannerSubtext: "",
    stageBannerColor: "#ffe584",
    stars: createStars(),
    particles: [],
    bullets: [],
    enemyBullets: [],
    enemies: [],
    items: [],
    bombEchoes: [],
    notifications: [],
    uiPulse: {
      stage: 0,
      weapon: 0,
      threat: 0,
      bombs: 0,
      health: 0,
      energy: 0,
      multiplier: 0,
    },
    player: {
      x: WIDTH / 2,
      y: HEIGHT - 88,
      radius: 18,
      speed: 300,
      health: 100,
      maxHealth: 100,
      energy: 100,
      maxEnergy: 100,
      weapon: "pulse",
      fireCooldown: 0,
      invuln: 0,
      bombs: 3,
      cheat: false,
      normalWeapon: "pulse",
    },
  };
}

let game = createGameState();
showOverlay(
  "파일럿 브리핑",
  "Nova Rain",
  "침공 함대를 격파하고, 장비 상자를 모아 무장을 교체하며, 점점 거세지는 전투 단계 속에서 3발의 비상 폭탄으로 끝까지 살아남으세요.",
  "작전 시작"
);

window.addEventListener("keydown", (event) => {
  audio.resume();
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }
  keys.add(event.code);

  if (event.code === "KeyP") {
    if (game.mode === "playing") {
      game.mode = "paused";
      showOverlay("일시정지", "작전 중지", "숨을 고르세요. 침공 편대가 다시 밀려옵니다.", "계속");
    } else if (game.mode === "paused") {
      hideOverlay();
      game.mode = "playing";
    }
  }

  if (event.code === "KeyH") {
    toggleCheatMode(game);
  }

  if ((event.code === "ShiftLeft" || event.code === "ShiftRight" || event.code === "KeyB") && game.mode === "playing") {
    triggerBomb(game);
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("pointerdown", () => {
  audio.resume();
});

canvas.addEventListener("pointerdown", () => {
  audio.resume();
});

ui.overlayButton.addEventListener("click", () => {
  audio.resume();
  if (game.mode === "gameover") {
    resetGame();
  } else if (game.mode === "menu" || game.mode === "paused") {
    hideOverlay();
    game.mode = "playing";
  }
});

function resetGame() {
  game = createGameState();
  hideOverlay();
  audio.resume();
  game.mode = "playing";
}

function showOverlay(tag, title, body, buttonText) {
  ui.overlayTag.textContent = tag;
  ui.overlayTitle.textContent = title;
  ui.overlayBody.textContent = body;
  ui.overlayButton.textContent = buttonText;
  ui.overlay.classList.remove("hidden");
}

function hideOverlay() {
  ui.overlay.classList.add("hidden");
}

function showEventBanner(gameState, tag, title, subtext, color = "#ffe584", duration = 2.8) {
  gameState.stageBanner = duration;
  gameState.stageBannerTag = tag;
  gameState.stageBannerText = title;
  gameState.stageBannerSubtext = subtext;
  gameState.stageBannerColor = color;
}

function pushNotification(gameState, x, y, text, color = "#ecf7ff", accent = "") {
  gameState.notifications.push({
    x,
    y,
    text,
    accent,
    color,
    life: 1.2,
    maxLife: 1.2,
  });
}

function triggerUiPulse(gameState, entries, amount = 1) {
  entries.forEach((entry) => {
    gameState.uiPulse[entry] = Math.max(gameState.uiPulse[entry] ?? 0, amount);
  });
}

function createStars() {
  return Array.from({ length: 90 }, () => ({
    x: Math.random() * WIDTH,
    y: Math.random() * HEIGHT,
    size: Math.random() * 2 + 0.6,
    speed: Math.random() * 90 + 40,
  }));
}

function spawnPlayerBullet(gameState, x, y, vx, vy, damage, color, width = 3) {
  gameState.bullets.push({
    x,
    y,
    vx,
    vy,
    radius: width,
    damage,
    color,
  });
}

function spawnEnemy(type, x, y, wave) {
  const stage = getStageInfo(wave);
  const base = {
    x,
    y,
    age: 0,
    shotTimer: Math.max(0.32, Math.random() * 1.2 + 0.6 - stage.fireRateBonus * 0.28),
    radius: 18,
    hp: Math.round((28 + wave * 4) * stage.hpScale),
    maxHp: Math.round((28 + wave * 4) * stage.hpScale),
    speedY: (70 + wave * 4) * stage.speedScale,
    speedX: 0,
    points: 100,
    color: "#ff8d78",
    pattern: "line",
    sprite: "line",
    spriteWidth: 64,
    spriteHeight: 78,
    lootChance: 0.18,
    bulletSpeedScale: stage.bulletSpeedScale,
    fireRateScale: stage.fireRateScale,
  };

  if (type === "zigzag") {
    return {
      ...base,
      radius: 19,
      hp: Math.round((22 + wave * 3) * stage.hpScale),
      maxHp: Math.round((22 + wave * 3) * stage.hpScale),
      speedY: (86 + wave * 5) * stage.speedScale,
      speedX: 95 * stage.speedScale,
      points: 120,
      color: "#ffd46a",
      pattern: "zigzag",
      sprite: "zigzag",
      spriteWidth: 74,
      spriteHeight: 86,
      fireMode: "spread",
    };
  }

  if (type === "turret") {
    return {
      ...base,
      radius: 24,
      hp: Math.round((54 + wave * 6) * stage.hpScale),
      maxHp: Math.round((54 + wave * 6) * stage.hpScale),
      speedY: 38 * stage.speedScale,
      points: 240,
      color: "#7db3ff",
      pattern: "drift",
      sprite: "turret",
      spriteWidth: 86,
      spriteHeight: 96,
      fireMode: "burst",
      lootChance: 0.34,
    };
  }

  if (type === "ace") {
    return {
      ...base,
      radius: 28,
      hp: Math.round((90 + wave * 12) * stage.hpScale),
      maxHp: Math.round((90 + wave * 12) * stage.hpScale),
      speedY: 46 * stage.speedScale,
      points: 500,
      color: "#ff79c8",
      pattern: "ace",
      sprite: "ace",
      spriteWidth: 98,
      spriteHeight: 108,
      fireMode: "ring",
      lootChance: 0.75,
      anchorX: x,
    };
  }

  return {
    ...base,
    fireMode: "line",
  };
}

function spawnWave(gameState) {
  const wave = gameState.wave;
  const stage = getStageInfo(wave);
  const pattern = gameState.patternIndex % 4;
  gameState.patternIndex += 1;

  if (pattern === 0) {
    const count = 5 + stage.formationBonus;
    const spacing = Math.min(72, 340 / Math.max(1, count - 1));
    for (let i = 0; i < count; i += 1) {
      gameState.enemies.push(spawnEnemy("line", 70 + i * spacing, -50 - i * 42, wave));
    }
  } else if (pattern === 1) {
    const count = 4 + stage.formationBonus;
    for (let i = 0; i < count; i += 1) {
      gameState.enemies.push(spawnEnemy("zigzag", 78 + i * 84, -40 - i * 56, wave));
    }
  } else if (pattern === 2) {
    gameState.enemies.push(spawnEnemy("turret", WIDTH * 0.25, -40, wave));
    gameState.enemies.push(spawnEnemy("turret", WIDTH * 0.75, -120, wave));
    for (let i = 0; i < 2 + stage.formationBonus; i += 1) {
      gameState.enemies.push(spawnEnemy("line", 110 + i * 120, -180 - i * 44, wave));
    }
  } else {
    gameState.enemies.push(spawnEnemy("ace", WIDTH / 2, -60, wave));
    for (let i = 0; i < 2 + stage.formationBonus; i += 1) {
      gameState.enemies.push(spawnEnemy("zigzag", 110 + i * 120, -140 - i * 44, wave));
    }
    if (stage.stage >= 4) {
      gameState.enemies.push(spawnEnemy("turret", WIDTH * 0.5, -220, wave));
    }
  }
}

function fireEnemyBullet(gameState, enemy, angle, speed, radius, color, damage = 12) {
  gameState.enemyBullets.push({
    x: enemy.x,
    y: enemy.y + enemy.radius * 0.7,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    damage,
    color,
  });
}

function spawnLoot(gameState, x, y) {
  const roll = Math.random();
  let kind = "weapon";
  if (roll > 0.88) {
    kind = "energy";
  } else if (roll > 0.58) {
    kind = "weapon";
  } else {
    kind = "health";
  }

  gameState.items.push({
    x,
    y,
    radius: kind === "health" ? 22 : 20,
    vy: 120,
    bob: Math.random() * TWO_PI,
    kind,
  });
}

function triggerBomb(gameState) {
  const player = gameState.player;
  if (!player.cheat && player.bombs <= 0) {
    return;
  }

  if (!player.cheat) {
    player.bombs -= 1;
  }
  gameState.flash = 0.65;
  gameState.screenShake = 16;
  gameState.bombEchoes.push({ radius: 10, alpha: 1 });
  audio.play("bomb");

  let bonus = 0;
  gameState.enemies = gameState.enemies.filter((enemy) => {
    bonus += enemy.points;
    explode(gameState, enemy.x, enemy.y, enemy.color, 16);
    if (Math.random() < enemy.lootChance) {
      spawnLoot(gameState, enemy.x, enemy.y);
    }
    return false;
  });

  gameState.enemyBullets = [];
  addScore(gameState, bonus + 250);
}

function addScore(gameState, points) {
  gameState.score += Math.floor(points * gameState.multiplier);
  gameState.multiplierTimer = Math.min(7, gameState.multiplierTimer + 0.6);
  gameState.multiplier = Math.min(8, 1 + Math.floor(gameState.multiplierTimer));
  if (gameState.multiplier >= 4 && Math.abs(gameState.multiplier - Math.round(gameState.multiplier)) < 0.1) {
    audio.play("combo");
  }
}

function explode(gameState, x, y, color, count = 10) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * TWO_PI;
    const speed = 50 + Math.random() * 200;
    gameState.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5 + Math.random() * 0.45,
      size: Math.random() * 3 + 1.4,
      color,
    });
  }
}

function damagePlayer(gameState, damage) {
  const player = gameState.player;
  if (player.cheat || player.invuln > 0) {
    return;
  }

  player.invuln = 1.1;
  gameState.screenShake = 10;
  audio.play("hit");
  const absorbed = Math.min(player.energy, damage * 0.7);
  player.energy -= absorbed;
  player.health -= Math.max(6, damage - absorbed);
  explode(gameState, player.x, player.y, "#ffffff", 14);

  if (player.health <= 0) {
    player.health = 0;
    gameState.mode = "gameover";
    showOverlay(
      "신호 두절",
      "작전 실패",
      `최종 점수 ${gameState.score}. 돌파한 웨이브 ${Math.max(1, gameState.wave - 1)}. 다시 투입하려면 버튼을 누르세요.`,
      "재시작"
    );
    audio.play("gameover");
  }
}

function update(dt) {
  updateStars(dt);
  updateNotifications(dt);
  updateUiPulseState(dt);
  if (game.mode !== "playing") {
    updateParticles(dt);
    updateBombEchoes(dt);
    render();
    updateUi();
    return;
  }

  const player = game.player;
  game.time += dt;
  game.waveTimer += dt;
  game.enemySpawnTimer -= dt;
  game.flash = Math.max(0, game.flash - dt * 1.4);
  game.screenShake = Math.max(0, game.screenShake - dt * 24);
  game.stageBanner = Math.max(0, game.stageBanner - dt);
  player.fireCooldown -= dt;
  player.invuln = Math.max(0, player.invuln - dt);
  player.energy = player.cheat ? player.maxEnergy : Math.min(player.maxEnergy, player.energy + dt * 10);
  if (player.cheat) {
    player.health = player.maxHealth;
    player.energy = player.maxEnergy;
    player.bombs = 3;
    player.weapon = "rail";
  }
  game.multiplierTimer = Math.max(0, game.multiplierTimer - dt * 0.18);
  game.multiplier = Math.max(1, 1 + Math.floor(game.multiplierTimer));

  if (game.enemySpawnTimer <= 0) {
    const nextStage = getStageInfo(game.wave).stage;
    if (nextStage > game.stage) {
      game.stage = nextStage;
      showEventBanner(
        game,
        `Stage ${game.stage}`,
        `${getThreatLabel(game.stage)} 구역 돌입`,
        "적 화력이 상승합니다",
        "#ffe584",
        3.1
      );
      triggerUiPulse(game, ["stage", "threat"], 1.2);
      pushNotification(game, WIDTH / 2, HEIGHT * 0.34, `WAVE ${game.wave}`, "#ffe584", "INBOUND");
      audio.play("stageUp");
    }
    spawnWave(game);
    const stageInfo = getStageInfo(game.wave);
    game.enemySpawnTimer = Math.max(2.4, 5.6 - game.wave * 0.08 - stageInfo.fireRateBonus * 0.12);
    game.wave += 1;
  }

  movePlayer(player, dt);
  handleShooting(game, player);
  updateBullets(game.bullets, dt);
  updateEnemyBullets(game.enemyBullets, dt);
  updateEnemies(dt);
  updateItems(dt);
  updateParticles(dt);
  updateBombEchoes(dt);
  checkCollisions();
  render();
  updateUi();
}

function updateStars(dt) {
  for (const star of game.stars) {
    star.y += star.speed * dt;
    if (star.y > HEIGHT + 2) {
      star.y = -4;
      star.x = Math.random() * WIDTH;
    }
  }
}

function movePlayer(player, dt) {
  let dx = 0;
  let dy = 0;

  if (keys.has("ArrowLeft") || keys.has("KeyA")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) dy += 1;

  const length = Math.hypot(dx, dy) || 1;
  player.x += (dx / length) * player.speed * dt;
  player.y += (dy / length) * player.speed * dt;
  player.x = Math.max(30, Math.min(WIDTH - 30, player.x));
  player.y = Math.max(60, Math.min(HEIGHT - 40, player.y));
}

function handleShooting(gameState, player) {
  if (!keys.has("Space")) {
    return;
  }

  const weapon = weaponProfiles[player.weapon];
  if (player.fireCooldown > 0 || (!player.cheat && player.energy < weapon.energyCost)) {
    return;
  }

  player.fireCooldown = weapon.cadence;
  if (player.cheat) {
    fireCheatVolley(gameState, player);
  } else {
    player.energy -= weapon.energyCost;
    weapon.fire(gameState, player);
  }
  audio.play(`shoot-${player.weapon}`);
}

function updateBullets(collection, dt) {
  for (const bullet of collection) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }

  for (let i = collection.length - 1; i >= 0; i -= 1) {
    const bullet = collection[i];
    if (bullet.x < -40 || bullet.x > WIDTH + 40 || bullet.y < -60 || bullet.y > HEIGHT + 60) {
      collection.splice(i, 1);
    }
  }
}

function updateEnemyBullets(collection, dt) {
  updateBullets(collection, dt);
}

function updateEnemies(dt) {
  for (const enemy of game.enemies) {
    enemy.age += dt;
    enemy.y += enemy.speedY * dt;

    if (enemy.pattern === "zigzag") {
      enemy.x += Math.sin(enemy.age * 2.7) * enemy.speedX * dt;
    } else if (enemy.pattern === "drift") {
      enemy.x += Math.sin(enemy.age * 1.2) * 40 * dt;
    } else if (enemy.pattern === "ace") {
      enemy.x = (enemy.anchorX ?? WIDTH / 2) + Math.sin(enemy.age * 1.9) * 120;
    }

    enemy.x = Math.max(28, Math.min(WIDTH - 28, enemy.x));

    enemy.shotTimer -= dt;
    if (enemy.shotTimer <= 0 && canEnemyFire(enemy)) {
      enemy.shotTimer =
        (enemy.fireMode === "ring" ? 1.4 : enemy.fireMode === "burst" ? 1.7 : 1.05) * enemy.fireRateScale;
      enemyFire(enemy);
    } else if (enemy.shotTimer <= -0.8) {
      enemy.shotTimer = 0.22;
    }
  }

  for (let i = game.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = game.enemies[i];
    if (enemy.y > HEIGHT + 80) {
      game.enemies.splice(i, 1);
    }
  }
}

function enemyFire(enemy) {
  if (game.enemyBullets.length > 16) {
    return;
  }

  const dx = game.player.x - enemy.x;
  const dy = game.player.y - enemy.y;
  const aim = Math.atan2(dy, dx);
  const speedScale = enemy.bulletSpeedScale;

  if (enemy.fireMode === "spread") {
    [-0.18, 0.18].forEach((offset) => {
      fireEnemyBullet(game, enemy, aim + offset, 180 * speedScale, 6, "#ffd36a");
    });
    audio.play("enemy-spread");
    return;
  }

  if (enemy.fireMode === "burst") {
    [-0.12, 0.12].forEach((offset) => {
      fireEnemyBullet(game, enemy, Math.PI / 2 + offset, 195 * speedScale, 8, "#73b4ff", 14);
    });
    audio.play("enemy-burst");
    return;
  }

  if (enemy.fireMode === "ring") {
    for (let i = 0; i < 4; i += 1) {
      const angle = (TWO_PI / 4) * i + enemy.age * 0.22;
      fireEnemyBullet(game, enemy, angle, 150 * speedScale, 7, "#ff7fd0", 15);
    }
    fireEnemyBullet(game, enemy, aim, 210 * speedScale, 8, "#ffffff", 18);
    audio.play("enemy-ring");
    return;
  }

  fireEnemyBullet(game, enemy, aim, 190 * speedScale, 6, "#ff8d78");
  audio.play("enemy-shot");
}

function canEnemyFire(enemy) {
  return enemy.y > 50 && enemy.y < HEIGHT * 0.72;
}

function updateItems(dt) {
  for (const item of game.items) {
    item.bob += dt * 4;
    item.y += item.vy * dt;
    item.x += Math.sin(item.bob) * 24 * dt;
  }

  for (let i = game.items.length - 1; i >= 0; i -= 1) {
    if (game.items[i].y > HEIGHT + 40) {
      game.items.splice(i, 1);
    }
  }
}

function updateParticles(dt) {
  for (const particle of game.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.985;
    particle.vy *= 0.985;
    particle.life -= dt;
  }

  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    if (game.particles[i].life <= 0) {
      game.particles.splice(i, 1);
    }
  }
}

function updateBombEchoes(dt) {
  for (const echo of game.bombEchoes) {
    echo.radius += 640 * dt;
    echo.alpha -= dt * 1.2;
  }

  for (let i = game.bombEchoes.length - 1; i >= 0; i -= 1) {
    if (game.bombEchoes[i].alpha <= 0) {
      game.bombEchoes.splice(i, 1);
    }
  }
}

function updateNotifications(dt) {
  for (const notification of game.notifications) {
    notification.y -= 42 * dt;
    notification.life -= dt;
  }

  for (let i = game.notifications.length - 1; i >= 0; i -= 1) {
    if (game.notifications[i].life <= 0) {
      game.notifications.splice(i, 1);
    }
  }
}

function updateUiPulseState(dt) {
  Object.keys(game.uiPulse).forEach((key) => {
    game.uiPulse[key] = Math.max(0, (game.uiPulse[key] ?? 0) - dt * 1.85);
  });
}

function checkCollisions() {
  for (let i = game.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = game.bullets[i];
    let hit = false;

    for (let j = game.enemies.length - 1; j >= 0; j -= 1) {
      const enemy = game.enemies[j];
      if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) <= bullet.radius + enemy.radius) {
        enemy.hp -= bullet.damage;
        hit = true;
        explode(game, bullet.x, bullet.y, bullet.color, 4);
        audio.play("impact");
        if (enemy.hp <= 0) {
          addScore(game, enemy.points);
          explode(game, enemy.x, enemy.y, enemy.color, 16);
          audio.play(enemy.pattern === "ace" ? "kill-ace" : "kill");
          if (Math.random() < enemy.lootChance) {
            spawnLoot(game, enemy.x, enemy.y);
          }
          game.enemies.splice(j, 1);
        }
        break;
      }
    }

    if (hit) {
      game.bullets.splice(i, 1);
    }
  }

  for (let i = game.enemyBullets.length - 1; i >= 0; i -= 1) {
    const bullet = game.enemyBullets[i];
    if (Math.hypot(bullet.x - game.player.x, bullet.y - game.player.y) <= bullet.radius + game.player.radius) {
      damagePlayer(game, bullet.damage);
      game.enemyBullets.splice(i, 1);
    }
  }

  for (const enemy of game.enemies) {
    if (Math.hypot(enemy.x - game.player.x, enemy.y - game.player.y) <= enemy.radius + game.player.radius) {
      damagePlayer(game, 22);
      enemy.hp = 0;
    }
  }

  game.enemies = game.enemies.filter((enemy) => {
    if (enemy.hp > 0) {
      return true;
    }
    explode(game, enemy.x, enemy.y, enemy.color, 18);
    return false;
  });

  for (let i = game.items.length - 1; i >= 0; i -= 1) {
    const item = game.items[i];
    if (Math.hypot(item.x - game.player.x, item.y - game.player.y) <= item.radius + game.player.radius) {
      collectItem(item);
      game.items.splice(i, 1);
    }
  }
}

function collectItem(item) {
  const player = game.player;
  if (item.kind === "energy") {
    player.energy = Math.min(player.maxEnergy, player.energy + 34);
    game.score += 50;
    triggerUiPulse(game, ["energy", "multiplier"], 1);
    pushNotification(game, item.x, item.y - 10, "ENERGY +34", "#63e6ff", "CORE");
    audio.play("pickup-energy");
    return;
  }

  if (item.kind === "health") {
    player.health = Math.min(player.maxHealth, player.health + 22);
    game.score += 50;
    triggerUiPulse(game, ["health", "multiplier"], 1);
    pushNotification(game, item.x, item.y - 10, "HULL +22", "#68f0a6", "REPAIR");
    audio.play("pickup-health");
    return;
  }

  const weaponRoll = Math.random();
  if (weaponRoll > 0.72) {
    player.weapon = "rail";
  } else if (weaponRoll > 0.4) {
    player.weapon = "laser";
  } else {
    player.weapon = "spread";
  }
  player.energy = Math.min(player.maxEnergy, player.energy + 30);
  addScore(game, 140);
  triggerUiPulse(game, ["weapon", "energy"], 1.25);
  pushNotification(
    game,
    item.x,
    item.y - 10,
    getWeaponBannerLabel(player.weapon),
    "#ffca62",
    "WEAPON"
  );
  audio.play("pickup-weapon");
}

function render() {
  ctx.save();
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  if (game.screenShake > 0) {
    ctx.translate((Math.random() - 0.5) * game.screenShake, (Math.random() - 0.5) * game.screenShake);
  }

  drawBackground();
  drawStars();
  drawBombEchoes();
  drawItems();
  drawBullets(game.bullets);
  drawBullets(game.enemyBullets);
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawStageBanner();
  drawNotifications();
  drawFlash();

  ctx.restore();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#040a16");
  gradient.addColorStop(0.45, "#071528");
  gradient.addColorStop(1, "#02050c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = `rgba(99, 230, 255, ${0.02 + i * 0.008})`;
    ctx.fillRect(0, (game.time * 120 + i * 140) % (HEIGHT + 160) - 160, WIDTH, 2);
  }
}

function drawStars() {
  for (const star of game.stars) {
    ctx.fillStyle = `rgba(255,255,255,${0.4 + star.size * 0.2})`;
    ctx.fillRect(star.x, star.y, star.size, star.size * 2.4);
  }
}

function drawPlayer() {
  const player = game.player;
  const bob = Math.sin(game.time * 7.5) * 1.8;
  ctx.save();
  if (player.invuln > 0 && Math.floor(player.invuln * 14) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }

  const drewSprite = drawShipSprite(
    spriteSheet.player,
    player.x,
    player.y + bob,
    96,
    112,
    0,
    "rgba(99, 230, 255, 0.55)"
  );
  if (!drewSprite) {
    drawPlayerFallback(player);
  }

  if (player.cheat) {
    ctx.strokeStyle = "rgba(99, 230, 255, 0.92)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(player.x, player.y + bob, 38 + Math.sin(game.time * 6) * 3, 0, TWO_PI);
    ctx.stroke();

    ctx.strokeStyle = "rgba(122, 255, 188, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y + bob, 48 + Math.cos(game.time * 4) * 2, 0, TWO_PI);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnemies() {
  for (const enemy of game.enemies) {
    const rotation =
      enemy.pattern === "zigzag" ? Math.sin(enemy.age * 2.7) * 0.18 :
      enemy.pattern === "drift" ? Math.sin(enemy.age * 1.2) * 0.07 :
      enemy.pattern === "ace" ? Math.sin(enemy.age * 1.9) * 0.12 :
      0;
    const sprite = spriteSheet[enemy.sprite] ?? spriteSheet.line;
    const drewSprite = drawShipSprite(
      sprite,
      enemy.x,
      enemy.y,
      enemy.spriteWidth ?? enemy.radius * 3.6,
      enemy.spriteHeight ?? enemy.radius * 4,
      rotation,
      enemy.color
    );
    if (!drewSprite) {
      drawEnemyFallback(enemy, rotation);
    }
    drawEnemyHealthBar(enemy);
  }
}

function loadShipSprites() {
  return {
    player: createSprite("../assets/ships/player-ship.png"),
    line: createSprite("../assets/ships/enemy-line.png"),
    zigzag: createSprite("../assets/ships/enemy-zigzag.png"),
    turret: createSprite("../assets/ships/enemy-turret.png"),
    ace: createSprite("../assets/ships/enemy-ace.png"),
  };
}

function loadPickupSprites() {
  return {
    health: createSprite("../assets/items/health.png"),
    energy: createSprite("../assets/items/energy.png"),
    weapon: createSprite("../assets/items/weapon.png"),
  };
}

function createSprite(src) {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  return image;
}

function getWeaponBannerLabel(weapon) {
  const labels = {
    pulse: "PULSE",
    spread: "SPREAD",
    laser: "LASER",
    rail: "RAIL",
  };
  return labels[weapon] ?? "POWER UP";
}

function drawShipSprite(sprite, x, y, width, height, rotation = 0, glowColor = "rgba(255,255,255,0.35)") {
  if (!sprite || !sprite.complete || sprite.naturalWidth === 0) {
    return false;
  }

  const scale = Math.min(width / sprite.naturalWidth, height / sprite.naturalHeight);
  const drawWidth = sprite.naturalWidth * scale;
  const drawHeight = sprite.naturalHeight * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.shadowBlur = 24;
  ctx.shadowColor = glowColor;
  ctx.drawImage(sprite, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
  return true;
}

function drawPlayerFallback(player) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = "#bff8ff";
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(18, 16);
  ctx.lineTo(0, 10);
  ctx.lineTo(-18, 16);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#63e6ff";
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(8, 12);
  ctx.lineTo(-8, 12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffca62";
  ctx.fillRect(-7, 14, 14, 11);
  ctx.restore();
}

function drawEnemyFallback(enemy, rotation = 0) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(rotation);
  ctx.fillStyle = enemy.color;

  if (enemy.pattern === "ace") {
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(30, 12);
    ctx.lineTo(0, 26);
    ctx.lineTo(-30, 12);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.pattern === "drift") {
    ctx.fillRect(-22, -18, 44, 36);
    ctx.clearRect(-8, -8, 16, 16);
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -enemy.radius);
    ctx.lineTo(enemy.radius, enemy.radius * 0.7);
    ctx.lineTo(-enemy.radius, enemy.radius * 0.7);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillRect(-8, -6, 16, 6);
  ctx.restore();
}

function drawEnemyHealthBar(enemy) {
  if (enemy.hp >= enemy.maxHp) {
    return;
  }

  const width = Math.max(26, enemy.radius * 2.1);
  const y = enemy.y + enemy.radius + 12;
  ctx.save();
  ctx.fillStyle = "rgba(3, 8, 15, 0.8)";
  ctx.fillRect(enemy.x - width / 2, y, width, 5);
  ctx.fillStyle = enemy.color;
  ctx.fillRect(enemy.x - width / 2, y, width * Math.max(0, enemy.hp / enemy.maxHp), 5);
  ctx.restore();
}

function drawBullets(collection) {
  for (const bullet of collection) {
    ctx.save();
    ctx.fillStyle = bullet.color;
    ctx.shadowBlur = 14;
    ctx.shadowColor = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }
}

function drawItems() {
  for (const item of game.items) {
    const pulse = 1 + Math.sin(item.bob * 2.2) * 0.04;
    const sprite = pickupSprites[item.kind];
    const glowColor =
      item.kind === "health" ? "rgba(104, 240, 166, 0.65)" :
      item.kind === "energy" ? "rgba(99, 230, 255, 0.65)" :
      "rgba(255, 202, 98, 0.72)";
    const width =
      item.kind === "health" ? 42 * pulse :
      item.kind === "energy" ? 44 * pulse :
      40 * pulse;
    const height =
      item.kind === "health" ? 56 * pulse :
      item.kind === "energy" ? 44 * pulse :
      44 * pulse;

    const drewSprite = drawPickupSprite(
      sprite,
      item.x,
      item.y + Math.sin(item.bob) * 4,
      width,
      height,
      item.bob * 0.18,
      glowColor
    );
    if (!drewSprite) {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.bob * 0.3);
      if (item.kind === "health") {
        drawCapsuleItem(item);
      } else {
        ctx.strokeStyle = item.kind === "weapon" ? "#ffe584" : "#63e6ff";
        ctx.lineWidth = 3;
        ctx.strokeRect(-10, -10, 20, 20);
      }
      ctx.restore();
    }
  }
}

function drawPickupSprite(sprite, x, y, width, height, rotation = 0, glowColor = "rgba(255,255,255,0.35)") {
  if (!sprite || !sprite.complete || sprite.naturalWidth === 0) {
    return false;
  }

  const scale = Math.min(width / sprite.naturalWidth, height / sprite.naturalHeight);
  const drawWidth = sprite.naturalWidth * scale;
  const drawHeight = sprite.naturalHeight * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.shadowBlur = 18;
  ctx.shadowColor = glowColor;
  ctx.drawImage(sprite, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
  return true;
}

function drawCapsuleItem(item) {
  ctx.save();
  ctx.beginPath();
  roundedRectPath(-16, -9, 32, 18, 9);
  ctx.fillStyle = "#dffff0";
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = "#68f0a6";
  ctx.fillRect(-16, -9, 16, 18);
  ctx.restore();

  ctx.beginPath();
  roundedRectPath(-16, -9, 32, 18, 9);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#68f0a6";
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(0, 8);
  ctx.strokeStyle = "rgba(4, 17, 26, 0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function roundedRectPath(x, y, width, height, radius) {
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

function drawParticles() {
  for (const particle of game.particles) {
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, TWO_PI);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBombEchoes() {
  for (const echo of game.bombEchoes) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${echo.alpha})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(game.player.x, game.player.y, echo.radius, 0, TWO_PI);
    ctx.stroke();
  }
}

function drawFlash() {
  if (game.flash <= 0) {
    return;
  }
  ctx.fillStyle = `rgba(255,255,255,${game.flash * 0.35})`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawStageBanner() {
  if (game.stageBanner <= 0) {
    return;
  }

  ctx.save();
  const alpha = Math.min(1, game.stageBanner * 0.8);
  const accent = game.stageBannerColor || "#ffe584";
  const pulse = 1 + Math.sin(game.time * 7.5) * 0.025;
  const bannerWidth = WIDTH - 160;
  const bannerHeight = 112;
  const x = (WIDTH - bannerWidth) / 2;
  const y = HEIGHT * 0.34;
  ctx.globalAlpha = alpha;
  ctx.translate(WIDTH / 2, y + bannerHeight / 2);
  ctx.scale(pulse, pulse);
  ctx.translate(-WIDTH / 2, -(y + bannerHeight / 2));
  ctx.fillStyle = "rgba(4, 17, 26, 0.82)";
  ctx.fillRect(x, y, bannerWidth, bannerHeight);
  const sweep = ctx.createLinearGradient(x, y, x + bannerWidth, y);
  sweep.addColorStop(0, "rgba(255,255,255,0)");
  sweep.addColorStop(0.5, "rgba(255,255,255,0.12)");
  sweep.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sweep;
  ctx.fillRect(x, y, bannerWidth, bannerHeight);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, bannerWidth, bannerHeight);
  ctx.fillStyle = accent;
  ctx.font = "700 15px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(game.stageBannerTag, WIDTH / 2, y + 26);
  ctx.font = "700 30px Trebuchet MS";
  ctx.fillText(game.stageBannerText, WIDTH / 2, y + 60);
  ctx.fillStyle = "rgba(236, 247, 255, 0.92)";
  ctx.font = "600 16px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(game.stageBannerSubtext, WIDTH / 2, y + 88);
  ctx.restore();
}

function drawNotifications() {
  for (const notification of game.notifications) {
    const alpha = Math.max(0, notification.life / notification.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.fillStyle = notification.color;
    ctx.font = "700 15px Trebuchet MS";
    if (notification.accent) {
      ctx.fillText(notification.accent, notification.x, notification.y - 22);
    }
    ctx.shadowBlur = 16;
    ctx.shadowColor = notification.color;
    ctx.font = "700 24px Trebuchet MS";
    ctx.fillText(notification.text, notification.x, notification.y);
    ctx.restore();
  }
}

function updateUi() {
  ui.stage.textContent = String(game.stage);
  ui.score.textContent = String(game.score);
  ui.wave.textContent = String(Math.max(1, game.wave - 1));
  ui.bombs.textContent = String(game.player.bombs);
  ui.weapon.textContent = game.player.cheat ? "풀파워" : weaponProfiles[game.player.weapon].label;
  ui.multiplier.textContent = `x${game.multiplier}`;
  ui.threat.textContent = game.player.cheat ? "무적" : getThreatLabel(game.stage);
  ui.healthFill.style.width = `${(game.player.health / game.player.maxHealth) * 100}%`;
  ui.energyFill.style.width = `${(game.player.energy / game.player.maxEnergy) * 100}%`;
  applyUiPulse(ui.stage, game.uiPulse.stage, "#ffe584");
  applyUiPulse(ui.weapon, game.uiPulse.weapon, "#ffca62");
  applyUiPulse(ui.threat, game.uiPulse.threat, "#63e6ff");
  applyUiPulse(ui.bombs, game.uiPulse.bombs, "#ff7af6");
  applyUiFillPulse(ui.healthFill, game.uiPulse.health, "#68f0a6");
  applyUiFillPulse(ui.energyFill, game.uiPulse.energy, "#63e6ff");
  applyUiPulse(ui.multiplier, game.uiPulse.multiplier, "#ffe584");
}

function applyUiPulse(element, amount, color) {
  const pulse = Math.max(0, amount || 0);
  element.style.transform = pulse > 0 ? `scale(${1 + pulse * 0.12})` : "scale(1)";
  element.style.textShadow = pulse > 0 ? `0 0 ${12 + pulse * 18}px ${color}` : "none";
  element.style.transition = "transform 120ms ease, text-shadow 120ms ease";
}

function applyUiFillPulse(element, amount, color) {
  const pulse = Math.max(0, amount || 0);
  element.style.boxShadow = pulse > 0 ? `0 0 ${10 + pulse * 14}px ${color}` : "none";
}

function toggleCheatMode(gameState) {
  const player = gameState.player;
  player.cheat = !player.cheat;

  if (player.cheat) {
    player.normalWeapon = player.weapon;
    player.weapon = "rail";
    player.health = player.maxHealth;
    player.energy = player.maxEnergy;
    player.invuln = 9999;
    player.bombs = 3;
    gameState.flash = 0.4;
    gameState.screenShake = 6;
    showEventBanner(gameState, "CHEAT MODE", "SUPER CHARGE ONLINE", "Rail cannon and infinite guard", "#63e6ff", 2.6);
    triggerUiPulse(gameState, ["weapon", "threat", "bombs", "health", "energy"], 1.4);
    pushNotification(gameState, player.x, player.y - 60, "OVERRIDE ACCEPTED", "#63e6ff", "H-CORE");
    audio.play("stageUp");
  } else {
    player.weapon = player.normalWeapon || "pulse";
    player.invuln = 0;
    showEventBanner(gameState, "CHEAT MODE", "SYSTEM NORMALIZED", "Standard combat limits restored", "#68f0a6", 2.1);
    triggerUiPulse(gameState, ["weapon", "threat"], 1);
    pushNotification(gameState, player.x, player.y - 60, "LIMITER RESTORED", "#68f0a6", "SAFE");
    audio.play("pickup-health");
  }
}

function fireCheatVolley(gameState, player) {
  player.fireCooldown = 0.07;

  [-0.42, -0.22, 0, 0.22, 0.42].forEach((angle) => {
    const speed = 760;
    spawnPlayerBullet(
      gameState,
      player.x,
      player.y - 24,
      Math.sin(angle) * speed,
      -Math.cos(angle) * speed,
      16,
      "#ffe584",
      4
    );
  });

  [-18, 0, 18].forEach((offset) => {
    spawnPlayerBullet(gameState, player.x + offset, player.y - 26, 0, -920, 16, "#ff7af6", 4);
  });

  spawnPlayerBullet(gameState, player.x, player.y - 30, 0, -1040, 54, "#7affbc", 8);
}

function getStageInfo(wave) {
  const stage = Math.floor((Math.max(1, wave) - 1) / WAVES_PER_STAGE) + 1;
  const stageDelta = stage - 1;
  return {
    stage,
    hpScale: 1 + stageDelta * 0.1,
    speedScale: 1 + stageDelta * 0.05,
    bulletSpeedScale: 1 + stageDelta * 0.04,
    fireRateScale: Math.max(0.8, 1 - stageDelta * 0.035),
    fireRateBonus: stageDelta,
    formationBonus: Math.min(2, Math.floor(stageDelta / 2)),
  };
}

function getThreatLabel(stage) {
  return threatLabels[Math.min(threatLabels.length - 1, stage - 1)];
}

function createAudioSystem() {
  let unlocked = false;
  const cooldowns = new Map();
  const urls = new Map();

  function resume() {
    unlocked = true;
  }

  function play(type) {
    if (!unlocked) {
      return;
    }

    const now = performance.now() / 1000;
    const previous = cooldowns.get(type) ?? -Infinity;
    const minGap =
      type.startsWith("shoot-") ? 0.04 :
      type === "impact" ? 0.03 :
      type.startsWith("enemy-") ? 0.08 :
      0.12;
    if (now - previous < minGap) {
      return;
    }
    cooldowns.set(type, now);

    const url = getSoundUrl(type);
    if (!url) {
      return;
    }

    const audio = new Audio(url);
    audio.volume = getVolume(type);
    audio.play().catch(() => {});
  }

  function getVolume(type) {
    if (type.startsWith("shoot-")) return 0.38;
    if (type.startsWith("enemy-")) return 0.26;
    if (type === "bomb") return 0.62;
    if (type === "kill-ace" || type === "gameover") return 0.55;
    if (type === "impact") return 0.22;
    return 0.42;
  }

  function getSoundUrl(type) {
    if (urls.has(type)) {
      return urls.get(type);
    }

    const spec = getSpec(type);
    if (!spec) {
      return null;
    }

    const samples = synthesize(spec);
    const wav = createWavBlob(samples, 44100);
    const url = URL.createObjectURL(wav);
    urls.set(type, url);
    return url;
  }

  function getSpec(type) {
    const specs = {
      "shoot-pulse": { kind: "tone", wave: "square", startFreq: 900, endFreq: 640, duration: 0.06, volume: 0.55 },
      "shoot-spread": { kind: "tone", wave: "saw", startFreq: 760, endFreq: 420, duration: 0.09, volume: 0.55 },
      "shoot-laser": { kind: "tone", wave: "triangle", startFreq: 1300, endFreq: 720, duration: 0.08, volume: 0.48 },
      "shoot-rail": { kind: "chord", wave: "saw", freqs: [220, 330, 440], duration: 0.18, volume: 0.58 },
      "enemy-shot": { kind: "tone", wave: "square", startFreq: 260, endFreq: 200, duration: 0.08, volume: 0.38 },
      "enemy-spread": { kind: "tone", wave: "triangle", startFreq: 300, endFreq: 180, duration: 0.12, volume: 0.34 },
      "enemy-burst": { kind: "chord", wave: "square", freqs: [180, 220], duration: 0.14, volume: 0.34 },
      "enemy-ring": { kind: "chord", wave: "saw", freqs: [220, 320, 420], duration: 0.22, volume: 0.34 },
      impact: { kind: "noise", duration: 0.05, volume: 0.42, cutoffStart: 1500, cutoffEnd: 500 },
      kill: { kind: "tone", wave: "triangle", startFreq: 260, endFreq: 80, duration: 0.18, volume: 0.5 },
      "kill-ace": { kind: "chord", wave: "saw", freqs: [520, 390, 260], duration: 0.34, volume: 0.6 },
      "pickup-energy": { kind: "tone", wave: "sine", startFreq: 420, endFreq: 760, duration: 0.16, volume: 0.44 },
      "pickup-health": { kind: "chord", wave: "sine", freqs: [320, 480, 640], duration: 0.18, volume: 0.44 },
      "pickup-weapon": { kind: "chord", wave: "triangle", freqs: [440, 660, 920], duration: 0.22, volume: 0.5 },
      hit: { kind: "noise", duration: 0.12, volume: 0.55, cutoffStart: 900, cutoffEnd: 220 },
      bomb: { kind: "chord", wave: "saw", freqs: [90, 140, 220], duration: 0.62, volume: 0.76 },
      stageUp: { kind: "melody", wave: "triangle", freqs: [440, 554, 660], step: 0.11, volume: 0.48 },
      combo: { kind: "melody", wave: "triangle", freqs: [660, 880], step: 0.08, volume: 0.38 },
      gameover: { kind: "melody", wave: "sine", freqs: [320, 220, 160], step: 0.16, volume: 0.46 },
    };
    return specs[type] ?? null;
  }

  function synthesize(spec) {
    const sampleRate = 44100;
    const totalDuration = spec.kind === "melody" ? spec.freqs.length * spec.step : spec.duration;
    const length = Math.max(1, Math.floor(sampleRate * totalDuration));
    const samples = new Float32Array(length);

    if (spec.kind === "tone") {
      fillTone(samples, sampleRate, spec.startFreq, spec.endFreq, spec.duration, spec.wave, spec.volume);
      return samples;
    }

    if (spec.kind === "chord") {
      spec.freqs.forEach((freq, index) => {
        fillTone(samples, sampleRate, freq, Math.max(20, freq * 0.7), spec.duration, spec.wave, spec.volume / (index + 1.2));
      });
      return samples;
    }

    if (spec.kind === "melody") {
      spec.freqs.forEach((freq, index) => {
        const start = Math.floor(index * spec.step * sampleRate);
        const chunk = new Float32Array(Math.floor(spec.step * sampleRate));
        fillTone(chunk, sampleRate, freq, Math.max(30, freq * 0.9), spec.step, spec.wave, spec.volume);
        mixInto(samples, chunk, start);
      });
      return samples;
    }

    if (spec.kind === "noise") {
      fillNoise(samples, sampleRate, spec.duration, spec.volume, spec.cutoffStart, spec.cutoffEnd);
      return samples;
    }

    return samples;
  }

  function fillTone(buffer, sampleRate, startFreq, endFreq, duration, wave, volume) {
    const length = Math.min(buffer.length, Math.floor(sampleRate * duration));
    let phase = 0;
    for (let i = 0; i < length; i += 1) {
      const t = i / Math.max(1, length - 1);
      const freq = startFreq + (endFreq - startFreq) * t;
      phase += TWO_PI * freq / sampleRate;
      const envelope = Math.pow(1 - t, 1.8);
      buffer[i] += waveform(phase, wave) * volume * envelope;
    }
  }

  function fillNoise(buffer, sampleRate, duration, volume, cutoffStart, cutoffEnd) {
    const length = Math.min(buffer.length, Math.floor(sampleRate * duration));
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const t = i / Math.max(1, length - 1);
      const cutoff = cutoffStart + (cutoffEnd - cutoffStart) * t;
      const smoothing = Math.min(0.98, cutoff / sampleRate);
      last = last * (1 - smoothing) + (Math.random() * 2 - 1) * smoothing;
      const envelope = Math.pow(1 - t, 2.4);
      buffer[i] += last * volume * envelope;
    }
  }

  function mixInto(target, source, start) {
    for (let i = 0; i < source.length && start + i < target.length; i += 1) {
      target[start + i] += source[i];
    }
  }

  function waveform(phase, wave) {
    if (wave === "square") {
      return Math.sign(Math.sin(phase));
    }
    if (wave === "triangle") {
      return (2 / Math.PI) * Math.asin(Math.sin(phase));
    }
    if (wave === "saw") {
      return 2 * (phase / TWO_PI - Math.floor(phase / TWO_PI + 0.5));
    }
    return Math.sin(phase);
  }

  function createWavBlob(floatSamples, sampleRate) {
    const pcm = new Int16Array(floatSamples.length);
    for (let i = 0; i < floatSamples.length; i += 1) {
      const clamped = Math.max(-1, Math.min(1, floatSamples[i]));
      pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }

    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + pcm.length * 2, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, "data");
    view.setUint32(40, pcm.length * 2, true);
    return new Blob([header, pcm], { type: "audio/wav" });
  }

  function writeString(view, offset, value) {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  }

  return { resume, play };
}

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  requestAnimationFrame(frame);
}

updateUi();
render();
requestAnimationFrame(frame);
