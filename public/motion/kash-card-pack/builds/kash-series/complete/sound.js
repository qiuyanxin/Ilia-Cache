let context, output, crackle, breath, tearGain, tearFilter, tearLoop;
let quiet = false;

function noiseBuffer(seconds, fiber) {
  const buffer = context.createBuffer(1, seconds * context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  if (!fiber) {
    for (let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
    return buffer;
  }
  for (let i=0;i<1220;i++) {
    const width=34+Math.floor(Math.random()*210);
    const start=Math.floor(Math.random()*(data.length-width));
    const force=Math.random()**2.5;
    for(let j=0;j<width;j++) data[start+j]+=(Math.random()*2-1)*force*Math.exp(-j*5/width);
  }
  return buffer;
}

export function unlockSound() {
  try {
    if (!context) {
      context = new AudioContext();
      output = context.createGain();
      const compressor=context.createDynamicsCompressor();
      compressor.threshold.value=-12;
      compressor.ratio.value=6;
      output.gain.value=quiet?0:2.5;
      output.connect(compressor).connect(context.destination);
      crackle=noiseBuffer(2.2,true);
      breath=noiseBuffer(1.6,false);
      tearLoop=context.createBufferSource();
      tearLoop.buffer=crackle;
      tearLoop.loop=true;
      tearFilter=context.createBiquadFilter();
      tearFilter.type='bandpass';
      tearFilter.Q.value=.76;
      tearGain=context.createGain();
      tearGain.gain.value=0;
      tearLoop.connect(tearFilter).connect(tearGain).connect(output);
      tearLoop.start();
    }
    if(context.state==='suspended')context.resume().catch(()=>{});
  }catch{
    // Playback depends on the browser's Web Audio support.
  }
}

export function muteSound(value) {
  quiet=value;
  if(output)output.gain.setTargetAtTime(value?0:2.5,context.currentTime,.025);
}

export function rip(speed) {
  if(!tearGain)return;
  const time=context.currentTime;
  tearGain.gain.setTargetAtTime(speed ** .74 * .39,time,speed?.014:.043);
  tearFilter.frequency.setTargetAtTime(1500+speed*2450,time,.025);
  tearLoop.playbackRate.setTargetAtTime(.72+speed*.86,time,.03);
}

function envelope(param, time, peak, attack, release) {
  param.setValueAtTime(.0001,time);
  param.exponentialRampToValueAtTime(peak,time+attack);
  param.exponentialRampToValueAtTime(.0001,time+release);
}
function air({ from, to, gain, attack=.008, duration, delay=0, foil=false, pan=0, endPan=pan }) {
  if(!context || quiet)return;
  const time=context.currentTime+delay;
  const source=context.createBufferSource();
  const filter=context.createBiquadFilter();
  const level=context.createGain();
  const stereo=context.createStereoPanner();
  source.buffer=foil?crackle:breath;
  source.loop=true;
  filter.type='bandpass';
  filter.Q.value=.74;
  filter.frequency.setValueAtTime(from,time);
  filter.frequency.exponentialRampToValueAtTime(to,time+duration);
  envelope(level.gain,time,gain,attack,duration);
  stereo.pan.setValueAtTime(pan,time);
  stereo.pan.linearRampToValueAtTime(endPan,time+duration);
  source.connect(filter).connect(level).connect(stereo).connect(output);
  source.start(time+0.002,Math.random());
  source.stop(time+duration+.02);
}
function tone({ from, to=from, gain, attack=.006, duration, delay=0, type='triangle' }) {
  if(!context || quiet)return;
  const time=context.currentTime+delay;
  const voice=context.createOscillator();
  const level=context.createGain();
  voice.type=type;
  voice.frequency.setValueAtTime(from,time);
  voice.frequency.exponentialRampToValueAtTime(to,time+duration*.7);
  envelope(level.gain,time,gain,attack,duration);
  voice.connect(level).connect(output);
  voice.start(time);
  voice.stop(time+duration+.01);
}
export function grab() { air({from:3100,to:1750,gain:.48,duration:.12,foil:true}); }
export function yelp() {
  tone({from:930,to:1395,gain:.027,duration:.145});
}
export function pop(flying) {
  air({from:4850,to:1680,gain:.25,duration:.105,foil:true});
  tone({from:275,to:920,gain:.105,duration:.085});
  if (flying) {
    air({from:690,to:3180,gain:.055,attack:.13,duration:.64,delay:.025});
    tone({from:510,to:1390,gain:.014,attack:.17,duration:.61,delay:.06,type:'sine'});
    tone({from:2093,gain:.018,duration:.27,delay:.31,type:'sine'});
  }
}
export function swirl() {
  air({from:870,to:1810,gain:.064,attack:.23,duration:.61,delay:.22,pan:-.57,endPan:.62});
  air({from:1700,to:1000,gain:.044,attack:.15,duration:.57,delay:.53,pan:.55,endPan:0});
}
export function land(slot) {
  air({from:2650,to:1020,gain:.095,duration:.067,pan:(slot-1)*.32});
}
export function lift() {
  air({from:690,to:430,gain:.031,attack:.055,duration:.21});
}
export function angelChime() {
  for(const [i,pitch] of [880,1174.66,1396.91,1760].entries()){
    tone({from:pitch,gain:.052,duration:.59,delay:i*.076,type:'sine'});
    tone({from:pitch*3.68,gain:.011,duration:.20,delay:i*.076,type:'sine'});
  }
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)rip(0);});

export function settlePack() {
  air({ from: 870, to: 2320, gain: .055, attack: .21, duration: .62, pan: .62, endPan: 0 });
  air({ from: 3300, to: 1910, gain: .19, duration: .09, delay: .55, foil: true });
}

export function releasePack(torn) {
  if (torn) {
    air({ from: 1350, to: 690, gain: .057, attack: .019, duration: .21 });
    tone({ from: 890, to: 550, gain: .019, duration: .18 });
  } else {
    tone({ from: 435, to: 312, gain: .046, duration: .138 });
  }
}
