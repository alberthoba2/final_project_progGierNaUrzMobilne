//hide apikeys later
firebase.initializeApp({
  apiKey: "AIzaSyDc3Xt4AB7tOiS4tr-OVbD5zOcWJHPU0bM",
  authDomain: "ballcatch-ab125.firebaseapp.com",
  projectId: "ballcatch-ab125",
  storageBucket: "ballcatch-ab125.firebasestorage.app",
  messagingSenderId: "302321297739",
  appId: "1:302321297739:web:0d4b789453d274699fe0ce"
});
const db = firebase.firestore(); 

class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.platform = new Platform(this.canvas, this);
    this.balls = [];
    this.effects = new EffectManager();
    this.score = 0;
    this.lives = 1;
    this.gameLoop = null;
    this.controlType = null;
    this.db = db;
    this.pixelRatio = window.devicePixelRatio || 1;
    this.setCanvasSize();
    this.setupEventListeners();
    this.ballSpawnInterval = null;
  }
  resetGame() {
    this.score = 0;
    this.lives = 1;
    this.balls = [];
    this.effects = new EffectManager();
    clearInterval(this.gameLoop);
    clearInterval(this.ballSpawnInterval);
    document.querySelector(".game-over").classList.add("hidden");
    document.querySelector(".game-container").classList.add("hidden");
    document.querySelector(".menu").classList.remove("hidden");
    this.disableTiltControls();
    this.setCanvasSize();
    this.platform.resetPosition();
  }
  enableTiltControls() {
    window.addEventListener(
      "deviceorientation",
      (this.handleTiltBound = (e) => {
        if (this.controlType === "tilt") this.handleTilt(e);
      })
    );
  }
  disableTiltControls() {
    window.removeEventListener("deviceorientation", this.handleTiltBound);
  }
  setCanvasSize() {
    const menuOffset = 50;
    const width = window.innerWidth;
    const height = window.innerHeight - menuOffset;
    this.gameWidth = width;
    this.gameHeight = height;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = width * this.pixelRatio;
    this.canvas.height = height * this.pixelRatio;
    this.ctx.scale(this.pixelRatio, this.pixelRatio);
    this.baseFontSize = Math.min(width * 0.03, 20);
    this.platform.baseWidth = width * 0.2; 
    this.ballBaseSize = width * 0.03;
    this.platform.resetPosition();
  }
  setupEventListeners() {
    window.addEventListener("resize", () => {
      this.setCanvasSize();
      this.platform.resetPosition();
    });
    window.addEventListener("deviceorientation", (e) => {
      if (this.controlType === "tilt") this.handleTilt(e);
    });
    this.canvas.addEventListener("touchmove", (e) => {
      if (this.controlType === "touch") this.handleTouch(e);
    });
  }
  startGame(controlType) {
    this.resetGame();
    document.querySelector(".menu").classList.add("hidden");
    document.querySelector(".game-container").classList.remove("hidden");
    if (controlType === "tilt") {
      this.enableTiltControls();
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        DeviceOrientationEvent.requestPermission();
      }
    }
    this.controlType = controlType;
    document.querySelector(".menu").classList.add("hidden");
    document.querySelector(".game-container").classList.remove("hidden");
    this.gameLoop = setInterval(() => this.update(), 1000 / 60);
    this.spawnBalls();
  }
  spawnBalls() {
    if (this.ballSpawnInterval) clearInterval(this.ballSpawnInterval);
    this.ballSpawnInterval = setInterval(() => {
      const types = [
        "normal",
        "bomb",
        "red",
        "purple",
        "yellow",
        "gray",
        "salmon",
        "gold"
      ];
      const type = types[Math.floor(Math.random() * types.length)];
      const ball = new Ball(this.canvas, type);
      const rect = this.canvas.getBoundingClientRect();
      if (this.effects.isActive("upsideDown")) {
        ball.y = (rect.height || (window.innerHeight - 50)) + ball.radius;
        ball.speed = -Math.abs(ball.speed);
      } else {
        ball.y = -ball.radius;
        ball.speed = Math.abs(ball.speed);
      }
      this.balls.push(ball);
    }, 1000 - Math.min(this.score * 10, 800));
  }
  update() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.platform.update(this.effects);
    this.balls.forEach((ball) => ball.update(this.effects));
    this.checkCollisions();
    this.platform.draw(this.ctx);
    this.balls.forEach((ball) => ball.draw(this.ctx));
    this.updateUI();
    this.balls = this.balls.filter((ball) => !ball.shouldRemove);
    if (this.lives <= 0) this.endGame();
  }
  checkCollisions() {
    this.balls.forEach((ball) => {
      if (ball.checkCollision(this.platform)) {
        this.handleBallCollision(ball);
        ball.shouldRemove = true;
      }
    });
  }
  handleBallCollision(ball) {
    switch (ball.type) {
      case "normal":
        if (!this.effects.isActive("reverse")) this.score += 10;
        else this.lives--;
        break;
      case "bomb":
        if (!this.effects.isActive("reverse")) this.lives--;
        else this.score += 10;
        break;
      case "red":
        this.effects.addEffect("smallPlatform", 15000);
        break;
      case "purple":
        this.effects.addEffect("invertControls", 12000);
        break;
      case "yellow":
        this.effects.addEffect("upsideDown", 10000);
        break;
      case "gray":
        this.effects.addEffect("reverse", 15000);
        break;
      case "salmon":
        this.effects.addEffect("chaos", 20000);
        break;
      case "gold":
        this.lives = Math.min(this.lives + 1, 5);
        break;
    }
  }
  updateUI() {
    document.getElementById("score").textContent = this.score;
    document.getElementById("lives").textContent = this.lives;
    this.effects.updateUI();
  }
  endGame() {
    clearInterval(this.gameLoop);
    document.querySelector(".game-container").classList.add("hidden");
    document.querySelector(".game-over").classList.remove("hidden");
    document.getElementById("final-score").textContent = this.score;
  }
  async saveScore() {
    const playerName =
      document.getElementById("player-name").value || "Anonim";
    await this.db.collection("scores").add({
      name: playerName,
      score: this.score,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    this.showHighscores();
  }
  async showHighscores() {
    const snapshot = await this.db
      .collection("scores")
      .orderBy("score", "desc")
      .limit(10)
      .get();
    const highscores = document.getElementById("highscores");
    highscores.innerHTML = "<h3>Najlepsze wyniki:</h3>";
    snapshot.forEach((doc) => {
      const data = doc.data();
      highscores.innerHTML += `<div>${data.name}: ${data.score}</div>`;
    });
  }
  handleTilt(e) {
    const sensitivity = 3;
    let tilt = e.gamma / 15;
    this.platform.move(tilt * sensitivity);
  }
  handleTouch(e) {
    const rect = this.canvas.getBoundingClientRect();
    let touchX = e.touches[0].clientX - rect.left;
    this.platform.moveTo(touchX);
  }
}

class Platform {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.baseWidth = 120;
    this.height = 15;
    this.color = "#4CAF50";
    this.resetPosition();
  }
  resetPosition() {
    const effectiveWidth = this.game.gameWidth || window.innerWidth;
    const effectiveHeight = this.game.gameHeight || (window.innerHeight - 50);
    this.baseWidth = effectiveWidth * 0.2; 
    this.width = this.baseWidth;
    this.x = (effectiveWidth - this.width) / 2;
    this.y = effectiveHeight - 30;
  }
  update(effects) {
    const effectiveWidth = this.game.gameWidth || window.innerWidth;
    const effectiveHeight = this.game.gameHeight || (window.innerHeight - 50);
    this.width = effects.isActive("smallPlatform")
      ? (effectiveWidth * 0.2) / 2
      : effectiveWidth * 0.2;
    this.y = effects.isActive("upsideDown") ? 30 : effectiveHeight - 30;
  }
  move(speed) {
    const effectiveWidth = this.game.gameWidth || window.innerWidth;
    if (this.game.effects.isActive("invertControls")) speed *= -1;
    this.x = Math.max(0, Math.min(this.x + speed, effectiveWidth - this.width));
  }
  moveTo(x) {
    const effectiveWidth = this.game.gameWidth || window.innerWidth;
    if (this.game.effects.isActive("invertControls")) x = effectiveWidth - x;
    this.x = Math.max(0, Math.min(x - this.width / 2, effectiveWidth - this.width));
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, 15, 10);
    ctx.fill();
  }
}

class Ball {
  constructor(canvas, type) {
    this.canvas = canvas;
    this.type = type;
    const rect = this.canvas.getBoundingClientRect();
    const effectiveWidth = rect.width || window.innerWidth;
    this.radius = effectiveWidth * 0.015;
    this.speed = 3 + Math.random() * 3;
    this.reset();
    this.shouldRemove = false;
  }
  reset() {
    const rect = this.canvas.getBoundingClientRect();
    const effectiveWidth = rect.width || window.innerWidth;
    this.x = Math.random() * (effectiveWidth - this.radius * 2);
    this.baseColor = this.getColor();
    this.color = this.baseColor;
  }
  getColor() {
    const colors = {
      normal: "#ffffff",
      bomb: "#000000",
      red: "#ff4444",
      purple: "#9c27b0",
      yellow: "#ffeb3b",
      gray: "#757575",
      salmon: "#ff8a80",
      gold: "#ffd700"
    };
    return colors[this.type];
  }
  update(effects) {
    this.y += this.speed * (effects.isActive("chaos") ? 1.5 : 1);
    const rect = this.canvas.getBoundingClientRect();
    const effectiveHeight = rect.height || (window.innerHeight - 50);
    if (
      (this.speed > 0 && this.y > effectiveHeight + this.radius) ||
      (this.speed < 0 && this.y < -this.radius)
    ) {
      this.shouldRemove = true;
    }
  }
  checkCollision(platform) {
    const platformTop = platform.y;
    const platformBottom = platform.y + 15;
    const platformLeft = platform.x;
    const platformRight = platform.x + platform.width;
    return (
      this.y + this.radius >= platformTop &&
      this.y - this.radius <= platformBottom &&
      this.x >= platformLeft &&
      this.x <= platformRight
    );
  }
  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

class EffectManager {
  constructor() {
    this.activeEffects = new Map();
  }
  addEffect(name, duration) {
    this.activeEffects.set(name, {
      endTime: Date.now() + duration,
      timer: setInterval(() => {
        if (Date.now() > this.activeEffects.get(name).endTime) {
          this.removeEffect(name);
        }
      }, 1000)
    });
  }
  removeEffect(name) {
    clearInterval(this.activeEffects.get(name).timer);
    this.activeEffects.delete(name);
    this.updateUI();
  }
  isActive(name) {
    return this.activeEffects.has(name);
  }
  updateUI() {
    const container = document.getElementById("active-effects");
    container.innerHTML = Array.from(this.activeEffects.keys())
      .map((effect) => `<div>${effect}</div>`)
      .join("");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const game = new Game();
  window.startGame = (controlType) => game.startGame(controlType);
  window.saveScore = async () => {
    await game.saveScore();
    window.location.href = "index.html";
  };
  game.showHighscores();
});
