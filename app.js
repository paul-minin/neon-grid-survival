/* Neon Grid Survival - app.js
   Minimal, tile-based, responsive, touch + keyboard
*/
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  // defensive defaults for rendering
  canvas.scaleFactor = canvas.scaleFactor || 1;
  let drawError = null;
  const scoreEl = document.getElementById('score');
  const energyEl = document.getElementById('energy');
  const timeEl = document.getElementById('time');
  const highscoreEl = document.getElementById('highscore');

  const TILE = 28; // render size; canvas will scale
  const VIEW = 20; // 20x20 visible grid
  const MAPSIZE = 20; // repeating base map
  const TICK = 160; // ms per tile step

  const types = {EMPTY:0,BLOCK:1,SLOW:2,HOUSE:3,TRAP:4,TURRET:5};
  const colors = {};
  colors[types.EMPTY] = '#081017';
  colors[types.BLOCK] = '#203040';
  colors[types.SLOW] = '#13202a';
  colors[types.HOUSE] = '#062020';
  colors[types.TURRET] = '#102022';

  // base repeating map
  const baseMap = new Array(MAPSIZE).fill(0).map(()=>new Array(MAPSIZE).fill(types.EMPTY));
  // seed some static obstacles
  for(let i=0;i<60;i++){baseMap[Math.floor(Math.random()*MAPSIZE)][Math.floor(Math.random()*MAPSIZE)] = Math.random()<0.08?types.BLOCK:types.EMPTY}

  // territory & defenses
  let turrets = {}; // key -> {x,y,cool}
  let territory = {}; // claimed tiles by player (x,y) -> true

  // waves
  let waveNumber = 0;
  const WAVE_INTERVAL = 60 * 1000; // 1 minute default
  let nextWaveAt = Date.now() + WAVE_INTERVAL

  // game state
  let player = {x:10,y:10,px:10,py:10,moveProgress:0};
  let orbs = [];
  let aliens = [];
  let houses = {};// key->hp
  let score = 0;
  let energy = 0;
  let timePlayed = 0;
  let running = true;
  let lastTick = Date.now();
  let lastSpawnOrb = 0;
  let lastAlienSpawn = 0;
  let highscore = localStorage.getItem('neongrid_high')||0;
  highscoreEl.textContent = highscore;

  // UI bindings for new actions
  const waveEl = document.getElementById('wave');
  const waveTimerEl = document.getElementById('wave-timer');
  const buyBtn = document.getElementById('buy-tile');
  const upgradeBtn = document.getElementById('upgrade-tile');

  // camera center on player
  let cam = {x: player.x - Math.floor(VIEW/2), y: player.y - Math.floor(VIEW/2)};

  // resize handling
  function resize(){
    const size = Math.max(200, Math.min(window.innerWidth, window.innerHeight) - 40);
    const ratio = window.devicePixelRatio || 1;
    // Set CSS size (display size)
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    // Set actual canvas pixel size for sharp rendering
    canvas.width = Math.floor(size * ratio);
    canvas.height = Math.floor(size * ratio);
    // logical scale so that TILE units remain consistent
    canvas.scaleFactor = (size / (VIEW * TILE)) || 1;
    canvas.pixelRatio = ratio;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('load', resize);
  // ensure resize runs after a short delay to account for initial layout
  setTimeout(resize, 50);
  resize();

  function toMap(x,y){
    // repeating map
    const mx = ((x%MAPSIZE)+MAPSIZE)%MAPSIZE;
    const my = ((y%MAPSIZE)+MAPSIZE)%MAPSIZE;
    return {x:mx,y:my};
  }

  function getTile(x,y){
    const m = toMap(x,y);
    return baseMap[m.y][m.x];
  }
  function setTile(x,y, val){ const m=toMap(x,y); baseMap[m.y][m.x]=val }

  // spawn orb in random empty cell near player
  function spawnOrb(){
    for(let tries=0;tries<40;tries++){
      const x = player.x + Math.floor((Math.random()-0.5)*VIEW);
      const y = player.y + Math.floor((Math.random()-0.5)*VIEW);
      if(getTile(x,y)===types.EMPTY && !orbs.some(o=>o.x===x&&o.y===y) && !(aliens.some(a=>a.x===x&&a.y===y))){
        orbs.push({x,y,blink:Math.random()*Math.PI*2}); return;
      }
    }
  }

  // spawn alien at a random edge
  function spawnAlien(){
    const edge = Math.floor(Math.random()*4);
    let x,y;
    const range = Math.floor(VIEW/2);
    if(edge===0){x=player.x-range; y=player.y+Math.floor((Math.random()-0.5)*VIEW)}
    if(edge===1){x=player.x+range; y=player.y+Math.floor((Math.random()-0.5)*VIEW)}
    if(edge===2){y=player.y-range; x=player.x+Math.floor((Math.random()-0.5)*VIEW)}
    if(edge===3){y=player.y+range; x=player.x+Math.floor((Math.random()-0.5)*VIEW)}
    aliens.push({x,y,dir:0,hp:2});
  }

  function updateAliens(){
    aliens.forEach(a=>{
      if(Math.random()<0.4){
        const dx = Math.sign((player.x - a.x) + (Math.random()-0.5)*4);
        const dy = Math.sign((player.y - a.y) + (Math.random()-0.5)*4);
        if(Math.abs(dx)>Math.abs(dy)) a.x+=dx; else a.y+=dy;
      } else {
        const r = Math.floor(Math.random()*4);
        if(r===0) a.x--; if(r===1) a.x++; if(r===2) a.y--; if(r===3) a.y++;
      }
      // collisions with houses
      const hk = a.x+','+a.y;
      if(houses[hk]){ houses[hk].hp--; if(houses[hk].hp<=0){ delete houses[hk]; score -= 5; }}
    });
    // remove dead aliens and handle collisions with player
    const survivors = [];
    aliens.forEach(a=>{
      if(a.hp<=0){ score += 4; energy+=1; return; }
      if(a.x===player.x && a.y===player.y){ running=false; return; }
      survivors.push(a);
    });
    aliens = survivors;
  }

  function collectOrbAt(x,y){
    for(let i=0;i<orbs.length;i++){
      if(orbs[i].x===x && orbs[i].y===y){ orbs.splice(i,1); energy++; score+=2; break; }
    }
  }

  function gameTick(){
    if(!running) return;
    const now = Date.now();
    if(now - lastSpawnOrb > 1200){ spawnOrb(); lastSpawnOrb = now; }
    if(now - lastAlienSpawn > Math.max(1200, 6000 - Math.floor(timePlayed/10)*200)){ spawnAlien(); lastAlienSpawn = now }

    // move aliens every tick
    updateAliens();

    // houses generate points
    Object.keys(houses).forEach(k=>{ houses[k].timer=(houses[k].timer||0)+1; if(houses[k].timer>=10){ houses[k].timer=0; score+=2 } });

    // turrets attack
    Object.keys(turrets).forEach(k=>{
      const t = turrets[k]; t.cool = (t.cool||0) - 1;
      if(t.cool<=0){
        // find nearest alien within range
        let target = null; let bestDist = 999;
        aliens.forEach(a=>{
          const d = Math.max(Math.abs(a.x - t.x), Math.abs(a.y - t.y)); if(d<= (t.range||3) && d<bestDist){ bestDist=d; target=a }
        });
        if(target){ target.hp -= (t.damage||1); t.cool = 3; }
      }
    });

    // time, difficulty
    timePlayed += TICK/1000;
    score += 0.01;
    score = Math.floor(score);

    // highscore
    if(score>highscore){ highscore=score; localStorage.setItem('neongrid_high',highscore); highscoreEl.textContent=highscore }

    // update UI
    scoreEl.textContent = score; energyEl.textContent = energy; timeEl.textContent = Math.floor(timePlayed);

    // waves UI and spawn
    const now = Date.now();
    if(now >= nextWaveAt){ spawnWave(); }
    const rem = Math.max(0, nextWaveAt - now);
    const mm = String(Math.floor(rem/60000)).padStart(2,'0'), ss = String(Math.floor((rem%60000)/1000)).padStart(2,'0');
    waveEl.textContent = waveNumber; waveTimerEl.textContent = `${mm}:${ss}`;

    // enable/disable buy & upgrade buttons based on state
    const key = player.x+','+player.y;
    buyBtn.disabled = !(energy>=5 && !territory[key] && canBuyTile(player.x,player.y));
    upgradeBtn.disabled = !(energy>=8 && territory[key] && !turrets[key]);
  }

  // movement input
  let moveQueue = [];
  function tryMove(dx,dy){ if(!running) return; const nx=player.x+dx, ny=player.y+dy; const tile=getTile(nx,ny); if(tile===types.BLOCK) return; player.x=nx; player.y=ny; collectOrbAt(nx,ny); // traps
    const t = getTile(nx,ny); if(t===types.SLOW){ /* could slow next enemy tick */ }
  }

  // building
  let buildMode = 'block';
  document.getElementById('build-block').addEventListener('click',()=>{ buildMode='block' });
  document.getElementById('build-slow').addEventListener('click',()=>{ buildMode='slow' });
  document.getElementById('build-house').addEventListener('click',()=>{ buildMode='house' });
  document.getElementById('build-turret').addEventListener('click',()=>{ buildMode='turret' });
  document.getElementById('restart').addEventListener('click',()=>start());

  canvas.addEventListener('click', e=>{
    const rect = canvas.getBoundingClientRect();
    const mx = Math.floor(((e.clientX-rect.left)/rect.width) * VIEW);
    const my = Math.floor(((e.clientY-rect.top)/rect.height) * VIEW);
    const gx = cam.x + mx; const gy = cam.y + my;
    doBuildAt(gx,gy);
  });

  function isOwned(x,y){ if(territory[x+','+y]) return true; // owned
    // adjacent to houses also counts
    if(houses[(x+1)+','+y]||houses[(x-1)+','+y]||houses[x+','+(y+1)]||houses[x+','+(y-1)]) return true; return false; }

  function claimTerritory(cx,cy,rad=2){ for(let oy=-rad; oy<=rad; oy++){ for(let ox=-rad; ox<=rad; ox++){ territory[(cx+ox)+','+(cy+oy)]=true } } }

  function doBuildAt(x,y){
    const cost = buildMode==='block'?5: buildMode==='slow'?4: buildMode==='house'?10: buildMode==='turret'?6:999;
    if(energy<cost) return;
    if(getTile(x,y)!==types.EMPTY) return;
    if(buildMode==='block'){ setTile(x,y,types.BLOCK); }
    else if(buildMode==='slow'){ setTile(x,y,types.SLOW); }
    else if(buildMode==='house'){ houses[x+','+y]={hp:12}; setTile(x,y,types.HOUSE); claimTerritory(x,y,2); }
    else if(buildMode==='turret'){ // turrets only on owned tiles
      if(!isOwned(x,y)) return;
      turrets[x+','+y] = {x,y,cool:0,range:3,damage:1}; setTile(x,y,types.TURRET);
    }
    energy -= cost; score += 1;
  }

  // --- New actions: buy current tile and upgrade to turret ---
  function hasTerritory(){ return Object.keys(territory).length>0 }
  function canBuyTile(x,y){ if(!hasTerritory()) return true; const n = [[1,0],[-1,0],[0,1],[0,-1]]; for(let i=0;i<n.length;i++){ const nx=x+n[i][0], ny=y+n[i][1]; if(territory[nx+','+ny]) return true } return false }

  function buyCurrentTile(){ const x=player.x,y=player.y; const key = x+','+y; const cost = 5; if(energy<cost) return; if(territory[key]) return; if(!canBuyTile(x,y)) return; territory[key]=true; energy-=cost; score+=1 }

  function upgradeCurrentTile(){ const x=player.x,y=player.y; const key = x+','+y; const cost = 8; if(energy<cost) return; if(!territory[key]) return; if(turrets[key]) return; turrets[key] = {x,y,cool:0,range:4,damage:2}; setTile(x,y,types.TURRET); energy-=cost; score+=2 }

  buyBtn.addEventListener('click', buyCurrentTile);
  upgradeBtn.addEventListener('click', upgradeCurrentTile);

  function spawnWave(){
    waveNumber++;
    const count = 3 + Math.floor(waveNumber * 1.2);
    for(let i=0;i<count;i++){
      const angle = Math.random()*Math.PI*2; const dist = VIEW/2 + Math.random()*VIEW/2;
      const x = Math.floor(player.x + Math.cos(angle)*dist);
      const y = Math.floor(player.y + Math.sin(angle)*dist);
      aliens.push({x,y,hp: 2 + Math.floor(waveNumber/3)});
    }
    // next wave shortens slowly but not below 30s
    nextWaveAt = Date.now() + Math.max(30000, WAVE_INTERVAL - Math.floor(waveNumber/2)*5000);
  }

  // keyboard
  window.addEventListener('keydown', e=>{
    if(!running) return;
    const k = e.key.toLowerCase();
    if(k==='arrowup' || k==='w') tryMove(0,-1);
    if(k==='arrowdown' || k==='s') tryMove(0,1);
    if(k==='arrowleft' || k==='a') tryMove(-1,0);
    if(k==='arrowright' || k==='d') tryMove(1,0);
    if(k==='c'){ // claim current tile (cost 3)
      const cost = 3; const key = player.x+','+player.y; if(energy>=cost && !territory[key]){ territory[key]=true; energy-=cost; score+=1 }
    }
  });

  // mobile buttons
  document.querySelectorAll('#mobile-controls .dir').forEach(b=>b.addEventListener('click',()=>{
    const d = b.dataset.dir; if(d==='up') tryMove(0,-1); if(d==='down') tryMove(0,1); if(d==='left') tryMove(-1,0); if(d==='right') tryMove(1,0);
  }));

  // touch swipe for movement
  let touchStart = null;
  canvas.addEventListener('touchstart', e=>{ const t = e.touches[0]; touchStart = {x:t.clientX,y:t.clientY,time:Date.now()}; });
  canvas.addEventListener('touchend', e=>{
    if(!touchStart) return; const t = e.changedTouches[0]; const dx = t.clientX - touchStart.x; const dy = t.clientY - touchStart.y; if(Math.abs(dx)>30 || Math.abs(dy)>30){ if(Math.abs(dx)>Math.abs(dy)){ if(dx>0) tryMove(1,0); else tryMove(-1,0)} else { if(dy>0) tryMove(0,1); else tryMove(0,-1)} } else { // tap
      const rect = canvas.getBoundingClientRect(); const mx = Math.floor(((t.clientX-rect.left)/rect.width) * VIEW); const my = Math.floor(((t.clientY-rect.top)/rect.height) * VIEW); const gx = cam.x + mx; const gy = cam.y + my; doBuildAt(gx,gy);
    } touchStart=null;
  });

  // main loop & draw
  let lastFrame = Date.now();
  function draw(){
    if(!ctx){ return }
    ctx.save();
    // Use setTransform to correctly handle device pixel ratio + logical scale
    const s = (canvas.pixelRatio || 1) * (canvas.scaleFactor || 1);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.imageSmoothingEnabled = false;
    // clear using pixel-correct rectangle
    ctx.fillStyle = '#071018'; ctx.fillRect(0,0,VIEW*TILE, VIEW*TILE);
    // stronger grid lines so tiles are visible even at odd scales
    ctx.strokeStyle = 'rgba(127,255,220,0.06)'; ctx.lineWidth = 0.5;

    // center camera on player
    cam.x = player.x - Math.floor(VIEW/2);
    cam.y = player.y - Math.floor(VIEW/2);

    // draw tiles
    for(let gy=0; gy<VIEW; gy++){
      for(let gx=0; gx<VIEW; gx++){
        const wx = cam.x + gx; const wy = cam.y + gy; const t = getTile(wx,wy);
        const px = gx * TILE; const py = gy * TILE;
        // base
        ctx.fillStyle = '#071018'; ctx.fillRect(px,py,TILE,TILE);
        ctx.strokeStyle = 'rgba(127,255,220,0.03)'; ctx.strokeRect(px+0.5,py+0.5,TILE-1,TILE-1);
        if(t===types.BLOCK){ ctx.fillStyle = '#0f2330'; ctx.fillRect(px+2,py+2,TILE-4,TILE-4); }
        if(t===types.SLOW){ ctx.fillStyle = 'rgba(70,40,120,0.25)'; ctx.fillRect(px+2,py+2,TILE-4,TILE-4); }
        if(t===types.HOUSE){ ctx.fillStyle = '#083030'; ctx.fillRect(px+2,py+2,TILE-4,TILE-4); ctx.fillStyle='#00ffd5'; ctx.fillRect(px+6,py+6,6,6); }
      }
    }

    // draw territory overlay
    Object.keys(territory).forEach(k=>{
      const [tx,ty]=k.split(',').map(Number);
      const sx=(tx-cam.x)*TILE, sy=(ty-cam.y)*TILE;
      ctx.fillStyle='rgba(50,220,120,0.08)'; ctx.fillRect(sx,sy,TILE,TILE);
      ctx.strokeStyle='rgba(50,220,120,0.12)'; ctx.strokeRect(sx+0.5,sy+0.5,TILE-1,TILE-1);
    });

    // draw orbs
    orbs.forEach(o=>{
      const bx = (o.x - cam.x) * TILE + TILE/2; const by = (o.y - cam.y) * TILE + TILE/2;
      const b = Math.max(3, 3 + Math.sin(Date.now()/200 + o.blink)*1.6);
      ctx.beginPath(); ctx.fillStyle = '#00ffd5'; ctx.globalAlpha = 0.95; ctx.arc(bx,by,b,0,Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.strokeStyle = 'rgba(0,255,213,0.28)'; ctx.lineWidth=0.8; ctx.arc(bx,by,b+2.5,0,Math.PI*2); ctx.stroke();
    });

    // draw turrets
    Object.keys(turrets).forEach(k=>{
      const t=turrets[k]; const sx=(t.x-cam.x)*TILE, sy=(t.y-cam.y)*TILE;
      ctx.fillStyle='#ffd19a'; ctx.fillRect(sx+6,sy+6, TILE-12, TILE-12);
      ctx.fillStyle='#ff8f42'; ctx.fillRect(sx+TILE/2-3, sy+TILE/2-3,6,6);
      // turret range hint (subtle)
      if(t.range){ ctx.strokeStyle='rgba(255,140,80,0.06)'; ctx.lineWidth=1; ctx.strokeRect(sx-(t.range-1)*TILE+0.5, sy-(t.range-1)*TILE+0.5, TILE*(t.range*2-1)-1, TILE*(t.range*2-1)-1); }
    });

    // draw houses and their hp
    Object.keys(houses).forEach(k=>{
      const [hx,hy]=k.split(',').map(Number); const screenX=(hx-cam.x)*TILE; const screenY=(hy-cam.y)*TILE; ctx.fillStyle='#00b3a0'; ctx.fillRect(screenX+4,screenY+4,TILE-8,TILE-8);
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(screenX+4,screenY+TILE-8,TILE-8,4);
    });

    // draw aliens
    aliens.forEach(a=>{
      const ax = (a.x - cam.x) * TILE + TILE/2; const ay = (a.y - cam.y) * TILE + TILE/2;
      ctx.fillStyle = '#ff7a7a'; ctx.beginPath(); ctx.moveTo(ax,ay-8); ctx.lineTo(ax-7,ay+7); ctx.lineTo(ax+7,ay+7); ctx.fill();
    });
    // draw highlight for current tile (buy/upgrade)
    const curKey = player.x+','+player.y;
    const curSX = (player.x-cam.x)*TILE, curSY = (player.y-cam.y)*TILE;
    if(!territory[curKey] && canBuyTile(player.x,player.y)){
      ctx.strokeStyle='rgba(0,220,150,0.9)'; ctx.lineWidth=2; ctx.strokeRect(curSX+2,curSY+2,TILE-4,TILE-4);
    } else if(territory[curKey] && !turrets[curKey]){
      ctx.strokeStyle='rgba(255,220,120,0.9)'; ctx.lineWidth=2; ctx.strokeRect(curSX+2,curSY+2,TILE-4,TILE-4);
    }
    // draw player (bigger and high-contrast)
    const px = (player.x - cam.x)*TILE + TILE/2; const py = (player.y - cam.y) * TILE + TILE/2;
    const pr = Math.max(6, Math.floor(TILE * 0.36));
    ctx.fillStyle = '#7bf0ff'; ctx.beginPath(); ctx.arc(px,py,pr,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();

    // game over overlay
    if(!running){ ctx.save(); ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#fff'; ctx.font='20px sans-serif'; ctx.textAlign='center'; ctx.fillText('Game Over - Klick Restart', canvas.width/2, canvas.height/2); ctx.restore(); }

    // draw error overlay if something broke
    if(drawError){ ctx.save(); ctx.fillStyle='rgba(200,40,40,0.9)'; ctx.fillRect(10,10,VIEW*TILE-20,80); ctx.fillStyle='#000'; ctx.font='14px monospace'; ctx.textAlign='left'; ctx.fillText('Rendering error: '+String(drawError).slice(0,120), 18, 34); ctx.restore(); }
  }

  function loop(){
    try{
      const now = Date.now();
      if(now - lastTick >= TICK){ gameTick(); lastTick = now }
      draw();
    }catch(err){
      console.error('Game loop error', err); drawError = err.toString();
    }
    requestAnimationFrame(loop);
  }

  function start(){
    // reset state
    player = {x:10,y:10}; orbs = []; aliens=[]; houses={}; turrets={}; territory={}; score=0; energy=0; timePlayed=0; running = true; lastSpawnOrb=0; lastAlienSpawn=0; scoreEl.textContent=score; energyEl.textContent=energy; timeEl.textContent=0;
  }

  start(); loop();
})();

// register service worker (optional, improves offline load)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(()=>{/* ignored */});
}
