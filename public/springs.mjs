// DesignBookmark's spring integrator: four substeps, capped at 1/30s.
// Values below retain the source stiffness, damping and mass.
export const MOTION={sidebar:[260,24],label:[300,26],highlight:[380,28],rollLink:[380,24],wordWidth:[320,30],wordLetter:[420,26],commandOpen:[300,28],commandPress:[520,34,.6],copyRoll:[260,20],copyIcon:[420,18],copyWidth:[300,24],barLabel:[300,26],barHighlight:[340,28],barIcon:[520,14]};
const active=new Set();let frame=0,last=0;const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function loop(now){const dt=Math.min((now-last)/1000,1/30);last=now;for(const s of active){for(let i=0;i<4;i++){const a=(-s.k*(s.x-s.t)-s.c*s.v)/s.mass;s.v+=a*dt/4;s.x+=s.v*dt/4;}s.draw(s.x);if(Math.abs(s.x-s.t)<.001&&Math.abs(s.v)<.001){s.x=s.t;s.draw(s.x);active.delete(s);}}frame=active.size?requestAnimationFrame(loop):0;}
export function spring(x,preset,draw){const[k,c,mass=1]=preset,s={x,t:x,v:0,k,c,mass,draw,set(t){s.t=t;if(reduced()){s.x=t;s.v=0;draw(t);return;}active.add(s);if(!frame){last=performance.now();frame=requestAnimationFrame(loop);}},jump(x){s.x=x;s.v=0;draw(x);},destroy(){active.delete(s);}};draw(x);return s;}
export function delay(seconds,fn){return setTimeout(fn,seconds*1000);}

export function bindButtonPress(button) {
  const press = spring(1, MOTION.commandPress, value => {
    button.style.scale = String(value);
  });
  const start = () => { if (!reduced()) press.set(.97); };
  const release = () => press.set(1);
  const isActivationKey = event => event.key === ' ' || event.key === 'Enter';
  button.addEventListener('pointerdown', event => { if (event.button === 0) start(); });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave', 'blur']) {
    button.addEventListener(type, release);
  }
  button.addEventListener('keydown', event => { if (isActivationKey(event)) start(); });
  button.addEventListener('keyup', event => { if (isActivationKey(event)) release(); });
}
