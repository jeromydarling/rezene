/**
 * Promo-video composition engine. Produces a single self-contained HTML
 * document whose entire timeline is driven by a global render(t) clock.
 *
 * The same document powers two things, so "what you preview is what you
 * pay for" is literally true:
 *  - the free in-app preview plays it in real time in an <iframe>
 *  - the paid render seeks render(t) frame-by-frame and captures to MP4
 *
 * A shop's promo is about THEIR label — tagline, collection, their real
 * product photography, their shop URL — not about Verto.
 */

export interface VideoScene {
  opener: string; // line over the hero
  collection: string; // collection / season name
  story: string; // one brand-voice line over an editorial image
  cta: string; // closing call to action
}

export interface VideoProduct {
  img: string; // absolute or /media path
  name: string;
  price: string; // "$195"
}

export interface VideoSpec {
  brandName: string;
  url: string; // "yourlabel.com" or "verto.style/yourlabel"
  heroImg: string;
  editorialImg: string;
  products: VideoProduct[]; // up to 5 used
  scenes: VideoScene;
  palette?: { navy?: string; terra?: string; chalk?: string };
  durationSec?: number; // default 30
}

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Scene-by-scene labels the render reports back for the honest progress bar. */
export const SCENE_LABELS = [
  "Opening",
  "Collection title",
  "The pieces",
  "Brand story",
  "Closing",
];

export function buildCompositionHtml(spec: VideoSpec): string {
  const navy = spec.palette?.navy ?? "#1f2a44";
  const terra = spec.palette?.terra ?? "#c06e52";
  const chalk = spec.palette?.chalk ?? "#faf7f0";
  const dur = spec.durationSec ?? 30;
  const products = (spec.products ?? []).slice(0, 5);
  const specJson = JSON.stringify({
    brand: spec.brandName,
    url: spec.url,
    hero: spec.heroImg,
    editorial: spec.editorialImg,
    products,
    scenes: spec.scenes,
    dur,
  });

  return `<!doctype html><html><head><meta charset="utf-8"><style>
:root{--navy:${esc(navy)};--terra:${esc(terra)};--chalk:${esc(chalk)}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;background:#000}
#stage{position:relative;width:1920px;height:1080px;overflow:hidden;background:#000;font-family:'Helvetica Neue',Arial,sans-serif}
.scene{position:absolute;inset:0;overflow:hidden}
.fill{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.serif{font-family:Georgia,'Times New Roman',serif;font-weight:300}
.eyebrow{letter-spacing:.34em;text-transform:uppercase;font-size:24px;font-weight:600}
.grain{position:absolute;inset:0;pointer-events:none;opacity:.05;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='120' height='120' filter='url(%23n)'/></svg>")}
.vig{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 320px rgba(0,0,0,.5)}
</style></head><body>
<div id="stage">
  <div class="scene" id="s1"><img class="fill" id="s1img"><div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(20,29,49,.9),rgba(20,29,49,.15) 60%)"></div>
    <div id="s1t" style="position:absolute;left:120px;bottom:200px;max-width:1300px;color:var(--chalk)"><div class="eyebrow" id="s1eye" style="color:var(--terra);margin-bottom:20px"></div><div class="serif" id="s1line" style="font-size:104px;line-height:1.04"></div></div></div>
  <div class="scene" id="s2" style="background:var(--navy);display:flex;align-items:center;justify-content:center;text-align:center;color:var(--chalk)"><div><div class="eyebrow" style="color:var(--terra)" id="s2eye">The collection</div><div class="serif" id="s2t" style="font-size:150px;margin-top:20px"></div></div></div>
  <div class="scene" id="s3" style="background:#000"><img class="fill" id="s3img"><div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.78),rgba(0,0,0,0) 55%)"></div><div id="s3cap" style="position:absolute;left:120px;bottom:130px;color:var(--chalk)"><div class="serif" id="s3name" style="font-size:76px"></div><div id="s3price" style="font-size:40px;color:rgba(250,247,240,.8);margin-top:8px"></div></div></div>
  <div class="scene" id="s4"><img class="fill" id="s4img"><div style="position:absolute;inset:0;background:rgba(20,29,49,.55)"></div><div id="s4t" style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;color:var(--chalk);padding:0 200px"><div class="serif" id="s4line" style="font-size:92px;line-height:1.2"></div></div></div>
  <div class="scene" id="s5"><img class="fill" id="s5img"><div style="position:absolute;inset:0;background:rgba(20,29,49,.6)"></div><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--chalk)"><div class="serif" id="s5brand" style="font-size:160px"></div><div class="eyebrow" id="s5cta" style="font-size:32px;margin-top:24px"></div><div id="s5url" style="font-size:30px;color:rgba(250,247,240,.75);margin-top:16px;letter-spacing:.1em"></div></div></div>
  <div class="grain"></div><div class="vig"></div>
</div>
<script>
const SPEC=${specJson};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const lerp=(a,b,t)=>a+(b-a)*t;
const eOut=t=>1-Math.pow(1-clamp(t,0,1),3);const eInOut=t=>{t=clamp(t,0,1);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2};
const win=(t,a,b)=>clamp((t-a)/(b-a),0,1);const band=(t,s,e,d)=>clamp(Math.min((t-s)/d,(e-t)/d),0,1);
const $=id=>document.getElementById(id);const show=(id,on)=>{$(id).style.display=on?'':'none'};
const D=SPEC.dur;
// scene time boundaries scaled to duration D
const B=[0,.16,.30,.74,.88,1].map(f=>f*D); // s1..s5 starts + end
const P=SPEC.products.length?SPEC.products:[{img:SPEC.hero,name:SPEC.brand,price:''}];
$('s1img').src=SPEC.hero;$('s4img').src=SPEC.editorial;$('s5img').src=SPEC.editorial;
$('s1eye').textContent=SPEC.brand;$('s1line').textContent=SPEC.scenes.opener;
$('s2t').textContent=SPEC.scenes.collection;$('s4line').textContent=SPEC.scenes.story;
$('s5brand').textContent=SPEC.brand;$('s5cta').textContent=SPEC.scenes.cta;$('s5url').textContent=SPEC.url;
function render(t){
  ['s1','s2','s3','s4','s5'].forEach(s=>show(s,false));
  if(t<B[1]+.3){show('s1',true);$('s1').style.opacity=band(t,B[0],B[1]+.3,.3);
    $('s1img').style.transform='scale('+lerp(1.06,1.16,eInOut(win(t,B[0],B[1])))+')';
    $('s1t').style.opacity=eOut(win(t,.2,1.4));$('s1t').style.transform='translateY('+lerp(40,0,eOut(win(t,.2,1.4)))+'px)';}
  if(t>=B[1]&&t<B[2]+.3){show('s2',true);$('s2').style.opacity=band(t,B[1],B[2]+.3,.25);
    const p=eOut(win(t,B[1]+.1,B[1]+.9));$('s2t').style.opacity=p;$('s2t').style.letterSpacing=lerp(30,0,p)+'px';}
  if(t>=B[2]&&t<B[3]+.3){show('s3',true);$('s3').style.opacity=band(t,B[2],B[3]+.3,.25);
    const span=(B[3]-B[2])/P.length;const idx=clamp(Math.floor((t-B[2])/span),0,P.length-1);const lt=(t-B[2])-idx*span;const pr=P[idx];
    $('s3img').src=pr.img;$('s3img').style.transform='scale('+lerp(1.12,1.04,lt/span)+')';
    $('s3name').textContent=pr.name;$('s3price').textContent=pr.price||'';
    const ap=Math.min(eOut(clamp(lt/.5,0,1)),clamp((span-lt)/.35,0,1));$('s3cap').style.opacity=ap;$('s3cap').style.transform='translateY('+lerp(30,0,eOut(clamp(lt/.5,0,1)))+'px)';}
  if(t>=B[3]&&t<B[4]+.3){show('s4',true);$('s4').style.opacity=band(t,B[3],B[4]+.3,.3);
    $('s4t').style.opacity=eOut(win(t,B[3]+.2,B[3]+1.1));$('s4img').style.transform='scale('+lerp(1.05,1.12,win(t,B[3],B[4]))+')';}
  if(t>=B[4]){show('s5',true);$('s5').style.opacity=band(t,B[4],B[5],.35);
    const p=eOut(win(t,B[4]+.2,B[4]+1));$('s5brand').style.opacity=p;$('s5brand').style.transform='translateY('+lerp(24,0,p)+'px)';
    $('s5cta').style.opacity=eOut(win(t,B[4]+.8,B[4]+1.5));$('s5url').style.opacity=eOut(win(t,B[4]+1.1,B[4]+1.8));
    $('s5img').style.transform='scale('+lerp(1.04,1.1,win(t,B[4],B[5]))+')';}
}
window.__render=render;window.__DUR=D;
// Real-time playback for the in-app preview (render path calls __render directly).
let raf,start;
window.__play=()=>{cancelAnimationFrame(raf);start=null;const loop=(ts)=>{if(start==null)start=ts;let t=(ts-start)/1000;if(t>D){start=ts;t=0;}render(t);raf=requestAnimationFrame(loop);};raf=requestAnimationFrame(loop);};
window.__stop=()=>cancelAnimationFrame(raf);
render(0);
</script></body></html>`;
}

/** A sensible default spec from a shop's own data — the AI then refines the copy. */
export function defaultSpecFromShop(input: {
  brandName: string;
  tagline: string;
  url: string;
  products: VideoProduct[];
  heroImg: string;
  editorialImg: string;
}): VideoSpec {
  return {
    brandName: input.brandName,
    url: input.url,
    heroImg: input.heroImg,
    editorialImg: input.editorialImg,
    products: input.products,
    scenes: {
      opener: input.tagline || "New season.",
      collection: "The Collection",
      story: "Made in small runs, meant to last.",
      cta: "Shop the collection",
    },
  };
}
