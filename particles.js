// particles.js : étincelles / poussières
const Particles = {
  list: [],
  spawnDust(x,y,dir=0) {
    for (let i=0;i<8;i++){
      this.list.push({ x, y, vx:(Math.random()*1-0.5)*2 + dir*0.8, vy:-Math.random()*1.5, life:0.4+Math.random()*0.2, t:0, c:"rgba(0,0,0,0.25)", r:2 });
    }
  },
  spawnSpark(x,y,color="#ffd166") {
    for (let i=0;i<10;i++){
      const a = Math.random()*Math.PI*2; const s = 1+Math.random()*2;
      this.list.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:0.5+Math.random()*0.3, t:0, c:color, r:2 });
    }
  },
  update(dt) {
    for (let i=this.list.length-1;i>=0;i--){
      const p=this.list[i]; p.t+=dt; if (p.t>=p.life){ this.list.splice(i,1); continue; }
      p.vy += 2.5*dt; // gravité légère
      p.x += p.vx; p.y += p.vy;
    }
  },
  render(ctx,camera) {
    for (const p of this.list){
      ctx.fillStyle = p.c;
      ctx.globalAlpha = Math.max(0, 1 - p.t/p.life);
      ctx.beginPath(); ctx.arc(p.x - camera.x, p.y - camera.y, p.r, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
};