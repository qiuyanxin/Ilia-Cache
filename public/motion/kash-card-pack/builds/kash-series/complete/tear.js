const colors = ['#ff5485','#ff9d53','#ffdf64','#65e5a9','#5ac3fc','#a58aff','#fa71cb'];
const clamp = (value, max = 1) => Math.max(0, Math.min(max, value));

export function bindTear(wrapper, canvas, callbacks) {
  const front = wrapper.querySelector('.wrap-front');
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const strip = document.createElement('div');
  strip.className = 'loose-seal';
  strip.setAttribute('aria-hidden', 'true');
  const segments = Array.from({length: 12}, () => {
    const segment = document.createElement('span');
    segment.className = 'seal-segment';
    strip.append(segment);
    return segment;
  });
  document.body.append(strip);
  let frame = 0, drag, progress, target, direction, openedAt, last, bounds, shape, particles, active;
  let tangent = 0;
  let pointer = null;
  let lastIdleFrame = 0;
  const lean = { value: 0, velocity: 0 };
  let matrix = new DOMMatrix();
  const squeeze = { value: 0, velocity: 0 };
  const tug = { value: 0, velocity: 0 };

  function elasticallyFollow(spring, target, dt) {
    const substep = dt / 4;
    for (let i = 0; i < 4; i++) {
      spring.velocity += (260 * (target - spring.value) - 24 * spring.velocity) * substep;
      spring.value += spring.velocity * substep;
    }
  }

  function updatePose(delta, dt, now) {
    if (reduced.matches) return;
    const verticalPull = drag && !target ? drag.vertical : 0;
    const stretch = Math.sign(verticalPull) * 65 * (1 - 1 / (1 + Math.abs(verticalPull) / 65));
    const pressure = target === 1 && !openedAt ? .88 : drag ? (target ? 1 : .18 - Math.abs(stretch) / 58) : 0;
    squeeze.velocity += delta * 9;
    elasticallyFollow(squeeze, pressure, dt);
    elasticallyFollow(tug, stretch, dt);
    const idle = !openedAt && !drag && !target;
    const drift = idle ? Math.sin(now / 810) * 4 : 0;
    const pointerLean = idle && pointer ? Math.max(-1, Math.min(1, (pointer.x - bounds.left - bounds.width / 2) / 330)) : 0;
    elasticallyFollow(lean, pointerLean, dt);
    const pivot = bounds.width / 2;
    const roll = -direction * squeeze.value * progress * 4 + lean.value * 5;
    matrix = new DOMMatrix()
      .translate(pivot, tug.value + drift)
      .rotate(roll)
      .skewY(lean.value * 3)
      .scale(1 + squeeze.value * .047 - Math.abs(lean.value) * .045, 1 - squeeze.value * .089)
      .translate(-pivot, 0);
    front.style.transform = matrix.toString();
    front.style.setProperty('--pack-pressure', clamp(squeeze.value));
  }

  function onPack(u, v) {
    return {
      x: bounds.left + matrix.a * bounds.width * u + matrix.c * bounds.height * v + matrix.e,
      y: bounds.top + matrix.b * bounds.width * u + matrix.d * bounds.height * v + matrix.f,
    };
  }

  function makeEdge() {
    return Array.from({length: 97}, (_, i) => [
      i / 96, .10 + .029 * Math.sin(i / 13.5 + Math.random() * .5) + Math.random() * .018,
    ]);
  }

  function reset() {
    cancelAnimationFrame(frame);
    frame = 0;
    drag = null;
    progress = target = openedAt = tangent = lastIdleFrame = 0;
    direction = 1;
    active = false;
    shape = makeEdge();
    particles = [];
    strip.hidden = true;
    front.style.clipPath = '';
    front.style.removeProperty('transform');
    front.style.removeProperty('--pack-pressure');
    matrix = new DOMMatrix();
    for (const spring of [squeeze, tug, lean]) spring.value = spring.velocity = 0;
    for (const animation of strip.getAnimations()) animation.cancel();
    if (ctx) ctx.clearRect(0, 0, innerWidth, innerHeight);
    callbacks.velocity(0);
    if (!reduced.matches) { captureBounds(); wake(); }
  }

  function captureBounds() {
    bounds = wrapper.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio);
    if (ctx && (canvas.width !== Math.round(innerWidth * dpr) || canvas.height !== Math.round(innerHeight * dpr))) {
      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function edgeAt(t) {
    const step = clamp(t) * 96;
    const i = Math.min(95, Math.floor(step));
    return shape[i][1] + (shape[i+1][1] - shape[i][1]) * (step-i);
  }

  function drawSeal() {
    const x = t => direction > 0 ? t : 1-t;
    const point = ([u,v]) => (x(u)*100).toFixed(2) + '% ' + (v*100).toFixed(2) + '%';
    const line = [...shape.filter(([u])=>u < progress), [progress,edgeAt(progress)]];
    const p = (u,v) => point([u,v]);
    const lower = [p(0,1), ...line.map(point), p(progress,0), p(1,0), p(1,1)];
    front.style.clipPath = 'polygon(' + lower.join(',') + ')';
    strip.hidden = false;
    strip.style.left = bounds.left + 'px';
    strip.style.top = bounds.top + 'px';
    strip.style.width = bounds.width + 'px';
    strip.style.height = bounds.height + 'px';
    strip.style.setProperty('--paper', wrapper.style.getPropertyValue('--paper'));
    const count = innerWidth < 620 ? 8 : segments.length;
    for (const [index, segment] of segments.entries()) {
      const start = Math.max(0, index / count - .003);
      const end = Math.min(progress, (index + 1) / count + .003);
      segment.hidden = index >= count || end <= start;
      if (segment.hidden) continue;
      const edge = line.filter(([u]) => u > start && u < end).toReversed();
      const upper = [p(start, 0), p(end, 0), p(end, edgeAt(end)), ...edge.map(point), p(start, edgeAt(start))];
      segment.style.clipPath = 'polygon(' + upper.join(',') + ')';
    }
  }

  function poseStrip() {
    const hingeX = (direction > 0 ? progress : 1 - progress) * bounds.width;
    const hingeY = edgeAt(progress) * bounds.height;
    strip.style.transform = matrix.toString();
    const count = innerWidth < 620 ? 8 : segments.length;
    for (const [index, segment] of segments.entries()) {
      if (segment.hidden) continue;
      if (reduced.matches) {
        segment.style.transform = '';
        continue;
      }
      const middle = (index / count + Math.min(progress, (index + 1) / count)) / 2;
      const x = (direction > 0 ? middle : 1 - middle) * bounds.width;
      const y = edgeAt(middle) * bounds.height;
      const distance = (progress - middle) * bounds.width;
      const radius = bounds.width * .72;
      const bend = distance / radius;
      const peel = (9 + progress * 12 + tangent) * Math.PI / 180;
      const mappedX = hingeX - direction * radius * (Math.sin(bend + peel) - Math.sin(peel));
      const mappedY = hingeY - radius * (Math.cos(peel) - Math.cos(bend + peel));
      segment.style.transform = `translate(${mappedX}px,${mappedY}px)
        rotate(${direction * (bend + peel) * 180 / Math.PI}deg)
        rotateX(${-14 - bend * 34}deg) translate(${-x}px,${-y}px)`;
    }
  }

  function paint(now) {
    if (!ctx) return;
    if (reduced.matches || !progress) return;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const seconds = now / 1000;
    const age = openedAt ? (now - openedAt) / 1000 : 0;
    const mouth = onPack(.5, .119).y;
    const mouthAt = u => onPack(u, edgeAt(direction > 0 ? u : 1 - u));
    const ribbonY = (u, distance) => mouth - distance + (mouthAt(u).y - mouth + 3.2) * Math.exp(-distance / 58);
    const lanes = 28;
    const reach = Math.max(mouth + 150, 280);
    const jetTail = openedAt ? age ** 1.6 * reach * 1.8 : 0;
    const upper = reach * (.85 + progress * .32);
    const edge = (u, distance) => {
      const spread = bounds.width * (.50 + distance / reach * 1.02);
      const rootShift = mouthAt(u).x - (bounds.left + bounds.width * u);
      return bounds.left + bounds.width / 2 + (u-.5)*2*spread + rootShift * Math.exp(-distance / 90) +
        Math.sin(distance*.035 - seconds*12 + u*7) * (5+distance*.042) * Math.min(1,distance/60);
    };
    if (jetTail < upper) {
      for (let i=0; i<lanes; i++) {
        const a=i/lanes, b=(i+1)/lanes;
        if ((direction>0 ? a : 1-b) >= progress) continue;
        const x = u => direction>0 ? Math.min(u,progress) : Math.max(u,1-progress);
        const startX = (a+b)/2;
        const angleHeight = upper * (1-Math.abs(startX-.5)*.33);
        if (jetTail >= angleHeight) continue;
        ctx.beginPath();
        for (let j=0;j<=25;j++) {
          const d=jetTail+(angleHeight-jetTail)*j/25;
          const pos=[edge(x(a),d),ribbonY(x(a),d)];
          if (j) ctx.lineTo(...pos); else ctx.moveTo(...pos);
        }
        for (let j=25;j>=0;j--) {
          const d=jetTail+(angleHeight-jetTail)*j/25;
          ctx.lineTo(edge(x(b),d),ribbonY(x(b),d));
        }
        ctx.closePath();
        const mouthStart = mouthAt((x(a) + x(b)) / 2).y + 3.2;
        const tint=ctx.createLinearGradient(0,mouthStart,0,mouth-angleHeight);
        tint.addColorStop(0,'#fff8e8');
        tint.addColorStop(.15,colors[i%colors.length]);
        tint.addColorStop(.81,colors[i%colors.length]+'f0');
        tint.addColorStop(1,colors[i%colors.length]+'54');
        ctx.fillStyle=tint;
        ctx.fill();
        ctx.lineWidth=1.15;
        ctx.strokeStyle='#fff8e7a8';
        ctx.stroke();
      }
      ctx.fillStyle='#fff6dc';
      for(let i=0;i<46;i++){
        const u=((i*73)%101)/101;
        if ((direction>0?u:1-u)>progress) continue;
        const d=(i*43+seconds*(160+i%9*21))%upper;
        if(d<jetTail)continue;
        ctx.globalAlpha=.2+(1-d/upper)*.7;
        ctx.beginPath();
        ctx.arc(edge(u,d),ribbonY(u,d), .85+i%4*.42,0,Math.PI*2);
        ctx.fill();
      }
      ctx.globalAlpha=1;
    }
    for (const piece of particles) {
      const t=age-piece.delay;
      if(t<=0 || t>1.7) continue;
      const air=1-Math.exp(-t*4);
      const x=piece.x+piece.vx*air + Math.sin(t*10+piece.spin)*t*11;
      const y=mouth-piece.lift*air+210*t*t;
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(piece.spin+t*piece.turn);
      ctx.globalAlpha=Math.min(1, (1.7-t)*2);
      const glint=Math.cos(t*18+piece.spin);
      ctx.fillStyle=glint>.78?'#fff4ce':piece.color;
      ctx.fillRect(-piece.size/2,-2,piece.size,Math.max(1,Math.abs(glint)*piece.size*.62));
      ctx.restore();
    }
  }

  function step(now) {
    frame = 0;
    if (!drag && !target && !reduced.matches && now - lastIdleFrame < 29) {
      frame = requestAnimationFrame(step);
      return;
    }
    lastIdleFrame = now;
    const dt = Math.min(.038,(now-last)/1000);
    last=now;
    if (!openedAt) {
      const before=progress;
      progress=target-(target-progress)*Math.exp(-Math.max(.001,dt)*(drag?28:target===1?9:16));
      if(target-progress<.006)progress=target;
      callbacks.velocity(clamp(((progress-before)/Math.max(.001,dt)) / 3.2) ** .74);
      updatePose(progress - before, dt, now);
      if (progress > 0) {
        if (before !== progress) drawSeal();
        poseStrip();
      }
      if (progress===1) {
        openedAt=now;
        callbacks.velocity(0);
        const origin = onPack(.5, .12);
        squeeze.velocity -= 7;
        particles=Array.from({length:innerWidth<620?85:155},(_,i)=>({
          x:bounds.left+bounds.width*(.05+Math.random()*.9), vx:(Math.random()-.5)*(110+Math.random()*Math.min(760,innerWidth)),
          lift:74+Math.random()*Math.min(390,origin.y+32), spin:Math.random()*7,turn:(Math.random()-.5)*24,
          size:3+Math.random()*8,delay:Math.random()*.24,color:colors[i%colors.length],
        }));
        if (!reduced.matches) {
          const initial=strip.style.transform;
          strip.animate([
            {transform:initial,opacity:1},
            {transform:`translate(${direction*125}px,-210px) rotate(${direction*110}deg) rotateX(58deg)`,opacity:1,offset:.48},
            {transform:`translate(${direction*235}px,35px) rotate(${direction*307}deg) rotateX(125deg)`,opacity:0},
          ],{duration:690,fill:'forwards'}).finished.then(()=>{ if (openedAt) strip.hidden=true; }).catch(()=>{});
        } else strip.hidden=true;
        callbacks.finish(origin);
      }
    } else {
      updatePose(0, dt, now);
    }
    paint(now);
    const settling = Math.abs(squeeze.value) + Math.abs(tug.value) + Math.abs(squeeze.velocity) + Math.abs(tug.velocity) > .012;
    if ((!openedAt && (drag || target!==progress || (!reduced.matches && (progress > 0 || settling || !wrapper.disabled)))) || (openedAt && now-openedAt<1970 && !reduced.matches)) {
      frame=requestAnimationFrame(step);
    }
  }

  function wake() {
    if(frame)return;
    last=performance.now();
    frame=requestAnimationFrame(step);
  }
  function finish() {
    if(target===1 || openedAt)return;
    if(!target)callbacks.pull();
    target=1;
    wake();
  }

  wrapper.addEventListener('pointerdown',event=>{
    if(event.button!==0 || drag || active && target===1)return;
    callbacks.start();
    captureBounds();
    active=true;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,base:target,moved:false,vertical:0};
    wrapper.setPointerCapture(event.pointerId);
    wake();
  });
  window.addEventListener('pointermove',event=>{
    if (event.pointerType === 'mouse') pointer = { x: event.clientX };
    if(!drag || event.pointerId!==drag.id || target===1)return;
    const dx=event.clientX-drag.x;
    drag.vertical = event.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) < Math.max(7, Math.abs(drag.vertical) * .55)) return;
    if(!drag.moved){
      drag.moved=true;
      if(!target){direction=dx<0?-1:1;callbacks.pull();}
    }
    tangent=Math.max(-8,Math.min(15,(drag.y-event.clientY)*.21));
    target=Math.max(target,clamp(drag.base+Math.abs(dx)/(bounds.width*.85)));
    wake();
  });
  for(const type of ['pointerup','pointercancel']){
    window.addEventListener(type,event=>{
      if(event.pointerId!==drag?.id)return;
      const wasTap = !drag.moved && Math.abs(drag.vertical) < 7;
      drag=null;
      if(type==='pointerup' && (wasTap || target>.54))finish();
      else {
        callbacks.velocity(0);
        if (type === 'pointerup') callbacks.release(target > 0);
      }
    });
  }
  document.documentElement.addEventListener('pointerleave', () => { pointer = null; });
  window.addEventListener('resize', () => { if (!openedAt) { captureBounds(); if (progress) drawSeal(); } });
  window.addEventListener('blur',()=>{ drag=null; pointer=null; callbacks.velocity(0); });
  wrapper.addEventListener('click',event=>{
    if(event.detail!==0 || target===1)return;
    callbacks.start();
    captureBounds();
    finish();
  });
  reset();
  return { reset };
}
