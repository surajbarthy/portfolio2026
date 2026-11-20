/* ===================== Scene ===================== */
/* World units are CSS px on the wall plane (z = 0). y points down, the floor is y = 0, z points
   out of the wall toward the corridor. The runner lives at z = RZ. One camera, two setups. */

var LOOK = /\b(concrete|pg)\b/.test(document.documentElement.className) ? "concrete" : "";
var REDUCE = false; try{ REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){}
var DIMS = {full:{h:250,w:124}, short:{h:200,w:100}, build:{h:200,w:100}, line:{h:170,w:0}};
var TILE = LOOK ? 480 : 24;
var LABW = 340, RZ = 118, X0 = 760, LT = -262;
/* The work hangs on the wall beside each label. Same screens and placeholders as V0's stream. */
var ART = {
  "jones":{type:"phone", img:"img/jones-home.jpg", alt:"Jones Home with the Track As You Go card"},
  "castle":{type:"laptop", ph:"[Castle homebuyer app or escrow portal, screen recording]"},
  "viva-learning":{type:"phone", ph:"[Viva Learning: home]"},
  "todo":{type:"phone", ph:"[To Do onboarding, in motion]"},
  "everydays":{type:"tile", img:"img/everydays.jpg", alt:"Everydays: a collage of faces, Pinhead to Mona Lisa, on mint green"},
  "slop-stamp":{type:"laptop", ph:"[Slop Stamp stamping a post]"},
  "castle-website":{type:"laptop", ph:"[Castle website, landing page]"},
  "creative-tech":{type:"obj", ph:"[Us, photographed as an object on white]"}
};
var ARTW = {phone:110, laptop:330, tile:130, obj:180};
var ARTH = {phone:236, laptop:181, tile:130, obj:135}, ARTB = -26;   // 1x heights; every device stands on the same line, 26 above the floor
/* In 2D the work hangs larger so it reads, and shrinks back as the camera turns.
   Laptop and phone keep Mike Matas's proportions: a phone stands about 0.73 of the laptop's height. */
var ARTX = {phone:392/236, laptop:528/181, tile:2, obj:2};   // 2D heights: phone 392, laptop 528 (screen + base), sized from Suraj's 2026-11-15 reference shots
/* Each room glows with a blurred tone of its project's image (Molly-style), never the image itself.
   Only Jones has an image so far; the rest fall back to lamplight until Suraj sends one each. */
var TONE = {"jones":"img/tone-jones.jpg", "everydays":"img/tone-everydays.jpg"};   // made from the Jones Home screen: its saturated colours, spread and blurred
var SC = [];          // scene items
var XEND = 0, SMAX = 0;
var stage, world, cv, ctx, track, mapMe, hintEl;
var W = 0, H = 0, DPR = 1, narrow = false;

function kindOf(it){
  if(it.id==="now") return "build";
  if(it.line) return "line";
  var s = STORIES[it.id];
  return s && !s.short ? "full" : "short";
}

/* Phones in portrait: the hall takes the top half, the floor below carries a flat caption. */
/* Phones on their side: the hall takes the left, the caption sits in a panel on the right. */
var COMPACT = false, CL = false;
function isCompact(){
  var w = window.innerWidth, h = window.innerHeight;
  return (w < 700 && h > w) || (h < 500 && w > h && w < 1000);
}
function shapeChanged(){ var c = isCompact(); return c!==COMPACT || (c && (window.innerWidth > window.innerHeight)!==CL); }
function gf(){ return H < 620 ? 0.45 : H < 760 ? 0.47 : 0.54; }   // where the ground sits on a portrait phone
function stopY(o){
  var y = COMPACT ? o.x - (CL ? 100 : Math.round(window.innerWidth*0.24)) : o.x - (o.kind==="line"?150:230);
  return clamp(y, 0, SMAX);
}

function layout(){
  COMPACT = isCompact(); CL = COMPACT && window.innerWidth > window.innerHeight;
  var x = X0;
  SC = ITEMS.map(function(it){
    var k = kindOf(it), d = DIMS[k], art = ART[it.id];
    var o = {it:it, id:it.id, kind:k, x:x, h:d.h, w:d.w, pl:-9, aw: art ? ARTW[art.type] : 0};
    x += COMPACT ? (k==="line" ? 420 : d.w + 40 + (o.aw ? o.aw + 28 : 0) + 300)
                 : (k==="line" ? 520 : d.w + 30 + LABW + (o.aw ? o.aw*ARTX[ART[it.id].type] + 36 : 0) + 170);
    return o;
  });
  XEND = x + 60;
  SMAX = XEND - 140;
}

function snapsHtml(){
  if(!COMPACT) return "";
  return "<div class='snap' style='top:0'></div>"+SC.map(function(o){ return "<div class='snap' style='top:"+stopY(o)+"px'></div>"; }).join("")+
    "<div class='snap' style='top:"+SMAX+"px'></div>";
}
/* the caption on the floor, phones only: flat 16px text for the item the runner is standing at */
function capHtml(o){
  if(!o){
    if(S > SMAX - 200) return "<p class='m'>End of the hall</p><p class='links'><a href='#index'>Index</a><a href='#now'>Now</a><a href='"+RESUME+"' data-resume>Resume</a><a href='#contact'>Contact</a><a href='https://surajbarthy.com' target='_blank' rel='noopener'>Art and installations ↗</a><a href='#accessibility'>Accessibility</a></p>"+
      "<p class='links'><button type='button' class='nt'>"+(notesOn?"Hide review notes":"Show review notes")+"</button></p>";
    return "<p class='m'>"+ITEMS.length+" projects on this wall</p><p class='lead'>Swipe up to run to the first door.</p>";
  }
  var it = o.it, open = !!STORIES[it.id];
  var title = open ? "<a href='#"+it.id+"' data-open='"+it.id+"'>"+t(it.title)+"</a>"
    : (it.href ? "<a href='"+it.href+"' target='_blank' rel='noopener'>"+esc(it.title)+" ↗</a>" : esc(it.title));
  var acts = open ? "<div class='acts'>"+(it.acts||[]).map(function(a){
      if(/^https?:/.test(a[1])) return "<a href='"+a[1]+"' target='_blank' rel='noopener' aria-label='"+a[0]+": "+esc(it.title)+" (opens in a new tab)'>"+a[0]+" ↗</a>";
      var p = a[1].split("#");
      return "<a href='#"+p[0]+"' data-open='"+p[0]+"' data-jump='"+(p[1]||"")+"' aria-label='"+a[0]+": "+esc(it.title.replace(/\s*\[.*\]/,""))+"'>"+a[0]+" →</a>";
    }).join("")+"</div>" : "";
  return "<p class='m'><span>"+it.n+"</span><span>"+t(it.org)+"</span><span>"+t(it.role)+"</span><span>"+t(it.year)+"</span></p>"+
    "<h2>"+title+"</h2><p>"+t(it.out)+"</p>"+acts;
}

function artHtml(id){
  var a = ART[id]; if(!a) return "";
  var inner = a.img ? "<img src='"+a.img+"' alt='"+esc(a.alt||"")+"'>" : "<span class='ph'>"+t(a.ph)+"</span>";
  return "<div class='art "+a.type+"' data-open='"+id+"'><div class='scr'>"+inner+"</div></div>";
}

/* Company marks for the timeline. Microsoft, Jones and Castle are real marks; the rest are placeholders. */
var MSFT = "<svg viewBox='0 0 23 23' aria-hidden='true'><rect x='1' y='1' width='10' height='10' fill='#F25022'/><rect x='12' y='1' width='10' height='10' fill='#7FBA00'/><rect x='1' y='12' width='10' height='10' fill='#00A4EF'/><rect x='12' y='12' width='10' height='10' fill='#FFB900'/></svg>";
var LOGO_JONES = "<svg viewBox='0 0 350 492' aria-hidden='true'><path fill='currentColor' d='M349.7,0v361.3l-126.6,129.9c-156.4,0-260.7-114.2-210.1-209.1,25.4-47.3,89.7-58.2,134.1-35.3,10.2,5.3,19.4,12.3,26.8,21.2-83.4,10.4-78.2,184.4-28.3,195.6,38.7,8.2,84.2-35.8,84.2-128.4V101.3c0-28.7-8.3-47.7-32.1-62.4-17.1-10.6-43.6-19-43.6-19v-3.8s35.7,6.1,43.9,6.9c24.5,2.4,125,9.1,151.7-22.9h0Z'/></svg>";
var LOGO_CASTLE = "<svg viewBox='0 0 28 26' aria-hidden='true'><path fill='currentColor' d='M28 9.93087L26.8387 13.4188L13.9991 4.31097L1.15936 13.4169L0 9.93087L13.9991 0L28 9.93087Z'/><path fill='currentColor' d='M25.6794 16.9091L22.6527 26H5.34728L2.32063 16.9072L5.3608 14.7508L7.94376 22.5102H20.0562L22.6392 14.7527L25.6794 16.9091Z'/></svg>";
var LOGO_IMG = {"slop-stamp":"img/logos/slop-stamp.png", "everydays":"img/logos/everydays.jpg"};   // project marks that beat the company mark
function logoHtml(org, id){
  if(LOGO_IMG[id]) return "<span class='lg mk im'><img src='"+LOGO_IMG[id]+"' alt=''></span>";
  var o = (org||"").replace(/\s*\[.*\]/,"");
  if(/microsoft/i.test(o)) return "<span class='lg ms'>"+MSFT+"</span>";
  if(/^jones/i.test(o)) return "<span class='lg mk jo'>"+LOGO_JONES+"</span>";
  if(/^castle/i.test(o)) return "<span class='lg mk ca'>"+LOGO_CASTLE+"</span>";
  var ch = /personal/i.test(o) ? "SB" : (o.trim().charAt(0) || "·");
  return "<span class='lg ph' aria-hidden='true'>"+esc(ch)+"</span>";
}
/* Where the building section starts: just before the first item that is something Suraj built
   (Art critic agent onward: agents, games, installations, Thakaali Timer, small builds). */
var BUILD_FROM = "critique";
var BRK = 360, BXG = Infinity, floorEls = null, floorH = 0;   // concrete build: the brick photo tiles at 360px (75% of the concrete tile, Suraj 2026-11-15)
function buildX(){
  var i = SC.map(function(o){ return o.id; }).indexOf(BUILD_FROM);
  if(i < 1) return Infinity;
  var o = SC[i];
  return Math.round(o.x - 140);
}
function sceneHtml(){
  var segs = "", holes = SC.filter(function(o){ return o.w; }), from = -2400, BX = buildX(); BXG = BX;
  function tile(x0,x1,bottom){
    for(var a=x0; a<x1; ){
      var b = Math.min(x1, a+300);
      if(a < BX && b > BX) b = BX;            // the building section starts on a clean vertical joint
      var bk = a >= BX, T = bk ? (LOOK ? BRK : 240) : TILE;
      segs += "<div class='seg"+(bk?" brk":"")+"' style='left:"+a+"px;width:"+(b-a+0.6)+"px;top:-1800px;height:"+(1800+bottom)+"px;"+
        "background-position:"+(-(((a%T)+T)%T))+"px 0'></div>";
      a = b;
    }
  }
  holes.forEach(function(o){ tile(from, o.x, 0); tile(o.x, o.x+o.w, -o.h); from = o.x+o.w; });
  tile(from, XEND+2400, 0);
  var items = SC.map(function(o){
    var it = o.it, k = o.kind, open = k==="full"||k==="short";
    var meta = "<span>"+t(it.org)+"</span><span>·</span><span>"+t(it.role)+"</span><span>·</span><span>"+t(it.year)+"</span>";
    var title, acts = "";
    if(open){
      title = "<a href='#"+it.id+"' data-open='"+it.id+"'>"+t(it.title)+"</a>";
      acts = "<div class='acts'>"+(it.acts||[]).map(function(a){
        if(/^https?:/.test(a[1])) return "<a href='"+a[1]+"' target='_blank' rel='noopener' aria-label='"+a[0]+": "+esc(it.title)+" (opens in a new tab)'>"+a[0]+" ↗</a>";
        var p = a[1].split("#");
        return "<a href='#"+p[0]+"' data-open='"+p[0]+"' data-jump='"+(p[1]||"")+"' aria-label='"+a[0]+": "+esc(it.title.replace(/\s*\[.*\]/,""))+"'>"+a[0]+" →</a>";
      }).join("")+"</div>";
    } else {
      title = it.href ? "<a href='"+it.href+"' target='_blank' rel='noopener'>"+esc(it.title)+" ↗</a>" : esc(it.title);
    }
    var door = "";
    if(k!=="line"){
      var tag = (!open && it.href) ? "a" : "div";
      var tone = TONE[it.id] ? "<div class='tone' style=\"background-image:url('"+TONE[it.id]+"')\"></div>" : "";
      door = "<"+tag+" class='door"+(k==="build"?" dash":"")+(TONE[it.id]?" toned":"")+"' style='"+(TONE[it.id]?"--tone:url("+TONE[it.id]+");":"")+"top:"+(-o.h)+"px;width:"+o.w+"px;height:"+o.h+"px'"+
        (open?" data-open='"+it.id+"'":(it.href?" href='"+it.href+"' target='_blank' rel='noopener' tabindex='-1' aria-hidden='true'":""))+">"+
        "<div class='box'><div class='back'>"+tone+"</div><div class='rv l'></div><div class='rv r'></div><div class='rv t'></div><div class='rv b'></div><div class='leaf'></div></div>"+
        (o.x >= BX ? "<div class='patch brk' style='--pl:"+(1-(((o.x%240)+240)%240))+"px "+(1-((1800-o.h)%88))+"px;--pc:"+(1-(((o.x%BRK)+BRK)%BRK))+"px "+(1-((1800-o.h)%BRK))+"px'></div>"
                   : "<div class='patch' style='background-position:"+(1-(((o.x%TILE)+TILE)%TILE))+"px "+(1-((1800-o.h)%TILE))+"px'></div>")+
        "<div class='jt'></div><div class='jr'></div></"+tag+">";
    }
    return "<div class='it k-"+k+"' data-id='"+it.id+"' style='transform:translate3d("+o.x+"px,0,0)'>"+
      door+
      "<div class='post"+(k==="build"?" dash":"")+"' style='top:"+(-o.h)+"px;height:"+o.h+"px'></div>"+
      (open?"<button class='hit' type='button' tabindex='-1' aria-hidden='true' data-open='"+it.id+"' style='top:"+(-o.h)+"px;height:"+o.h+"px'></button>":"")+
      "<span class='pn' style='top:"+(-o.h)+"px'>"+it.n+"</span>"+
      "<div class='lab' style='top:"+LT+"px;left:24px'><div class='m'>"+meta+"</div><h2>"+title+"</h2><p>"+t(it.out)+"</p>"+acts+"</div>"+
      (o.aw ? "<div class='hang' style='top:"+(ARTB - ARTH[ART[it.id].type])+"px;left:"+(24+LABW+28)+"px'>"+artHtml(it.id)+"</div>" : "")+
    "</div>";
  }).join("");
  // the everydays count: day 1 was 22 Jan 2016 (3,955 on 19 Nov 2026, matching surajbarthy.com/everyday); local date, so it ticks at midnight
  function edDays(){ var n = new Date(); return Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(2016, 0, 22))/864e5) + 1; }
  var intro = "<div class='wallText intro' style='left:-150px;top:-500px'>"+
    "<h1 class='sr'>Suraj Barthy</h1>"+
    "<p class='state'>I design products and build them, from zero to one.</p>"+
    "<p class='state dim'>Most recently at Jones, Castle and Microsoft.</p>"+
    "<p class='side'>I've been making <a href='#everydays' data-open='everydays'>something new every day for <span class='edn'>"+edDays().toLocaleString("en-US")+"</span> days</a>.</p>"+
    "<p class='side'>I also make <a href='#creative-tech' data-open='creative-tech'>clocks</a>.</p>"+
    "<p class='side dim'>Taught at NYU. Chennai × Brooklyn.</p>"+
    "<div class='note'><b>Review notes are on.</b> Blue boxes are for you and won't ship. Yellow highlights are placeholders waiting on your input. Turn notes off at the end of the wall to see the clean page.</div>"+
  "</div>";
  var end = "<div class='wallText endw' style='left:"+(XEND-60)+"px;top:-300px'>"+
    "<p class='state'><span class='tbd'>[A closing line in your voice]</span></p>"+
    "<p class='links'><a href='#now'>Now</a><a href='"+RESUME+"' data-resume>Resume</a><a href='#contact'>Contact</a><a href='https://surajbarthy.com' target='_blank' rel='noopener'>Art and installations ↗</a><a href='#accessibility'>Accessibility</a></p>"+
    "<p class='foot-n'><button type='button' id='notes-toggle'></button></p>"+
  "</div>";
  var ground = "<div class='ground' style='left:-2400px;width:"+(XEND+4800)+"px'></div>";
  // the building section: brick wall (segs above) and a boarded floor laid flat on y = 0
  // a timber post marks where the concrete ends and the brick starts
  if(BX < Infinity) segs += "<div class='bpost' aria-hidden='true' style='left:"+(BX-14)+"px'></div>";
  // floors are laid in 1200px pieces so only the ones near the camera are drawn (one huge textured plane
  // exhausted the browser's tile memory and left wall tiles blank)
  function floorRun(cls, x0, x1, tw){
    var h = "";
    for(var a = x0; a < x1; a += 1200){
      var b = Math.min(x1, a + 1200);
      h += "<div class='"+cls+" fc' aria-hidden='true' data-x0='"+a+"' data-x1='"+b+"' style='left:"+a+"px;width:"+(b-a+0.6)+"px;background-position-x:"+(-(((a%tw)+tw)%tw))+"px'></div>";
    }
    return h;
  }
  if(BX < Infinity) ground = floorRun("bfloor", BX, XEND+2400, LOOK ? 400 : 480) + ground;
  // sky world: a grass floor laid flat on y = 0, running out toward the viewer
  if(LOOK) ground = floorRun("turf", -2400, Math.min(BX, XEND+2400), 480) + ground;
  var map = SC.map(function(o){
    var nm = o.it.title.replace(/\s*\[.*\]/,"");
    return "<button type='button' data-go='"+o.id+"' data-t='"+esc(nm)+"' style='left:"+(toMap(o.x)*100).toFixed(3)+"%' aria-label='"+o.it.n+" "+esc(nm)+", "+esc(o.it.org)+"'>"+logoHtml(o.it.org, o.id)+"</button>";
  }).join("");
  return "<a class='skip' href='#index'>Skip to the list of work</a>"+
    "<header class='top'><button class='who' type='button' id='to-start'>Suraj Barthy</button>"+
      "<nav><div class='switch' role='group' aria-label='View'><button type='button' data-mode='0'>2D</button><button type='button' data-mode='1'>3D</button></div>"+
      "<a href='#index'>Index</a><a href='#now'>Now</a><a class='hide-s' href='"+RESUME+"' data-resume>Resume</a><a href='#contact'>Contact</a>"+FONT_SW+KB_BTN+plainBtn()+themeBtn()+"</nav></header>"+
    "<main id='track'><div id='stage'>"+(LOOK ? "<div class='torch' aria-hidden='true'></div><div class='sky-l' aria-hidden='true'><i class='bow'></i><i class='cl c1'></i><i class='cl c2'></i><i class='cl c3'></i><i class='cl c4'></i><i class='cl c5'></i></div>" : "")+
      "<div id='world'>"+segs+ground+intro+items+end+"</div>"+
      "<canvas id='runner' aria-hidden='true'></canvas>"+(R3cv ? "" : "<canvas id='runner3d' aria-hidden='true'></canvas>")+
      "<p class='hint' id='hint'>"+(NOHOVER ? "Swipe to run" : "Scroll or use arrow keys to run")+"</p>"+
      "<section class='cap' id='cap' aria-label='Current project'></section>"+
    "</div>"+snapsHtml()+"</main>"+
    "<nav class='map' aria-label='Jump to a project'><div class='ln'></div>"+map+"<span class='me' id='map-me'></span></nav>";
}


// timeline: items sit at equal steps; the runner dot moves piecewise between them
function mapKnots(){
  var k = [[0,0]], n = SC.length;
  SC.forEach(function(o, i){ k.push([o.x, (i+1)/(n+1)]); });
  k.push([SMAX, 1]);
  return k;
}
function toMap(x){
  var k = mapKnots();
  for(var i = 1; i < k.length; i++) if(x <= k[i][0] || i === k.length-1){
    var a = k[i-1], b = k[i], t = b[0] > a[0] ? clamp((x - a[0])/(b[0] - a[0]), 0, 1) : 1;
    return a[1] + (b[1] - a[1])*t;
  }
  return 1;
}

/* Concrete build only: a second light option, the plain white hall of the first iteration.
   It drops .concrete from <html>, so every concrete and sky rule switches off and the base light theme shows. */
function CONC(){ return LOOK && document.documentElement.classList.contains("concrete"); }
function plainBtn(){
  return LOOK ? "<div class='switch sw1'><button type='button' class='plainbtn' aria-pressed='"+document.documentElement.classList.contains("plainw")+"' title='Plain white hall'>White</button></div>" : "";
}
function setPlain(on){
  var r = document.documentElement;
  r.classList.toggle("concrete", !on && !r.classList.contains("pg")); r.classList.toggle("plainw", on); store("sb-look", on ? "plain" : "");
  if(!on && !r.classList.contains("pg")) r.setAttribute("data-theme","dark");
  if(on){ r.setAttribute("data-theme","light"); r.classList.remove("sky"); store("sb-theme","light"); }
  document.querySelectorAll(".plainbtn").forEach(function(b){ b.setAttribute("aria-pressed", String(on)); });
  syncThemeBtn();
  if(typeof readColors==="function") readColors();
}
/* concrete look: the hall is dark, every page is white (Collins-style), so there's no theme toggle.
   Pages drop the concrete class and read the light tokens; going back to the hall puts it back. */
function pageLight(on){
  if(!LOOK) return;
  var r = document.documentElement;
  if(on){ r.classList.remove("concrete","sky"); r.classList.add("pg"); r.setAttribute("data-theme","light"); return; }
  if(!r.classList.contains("pg")) return;
  r.classList.remove("pg");
  if(!r.classList.contains("plainw")){ r.classList.add("concrete"); r.setAttribute("data-theme","dark"); }
  if(typeof readColors==="function") readColors();
}
function themeBtn(){
  if(LOOK) return "";
  return "<button type='button' class='theme' aria-label='Dark mode' aria-pressed='false'>"+
    "<svg viewBox='0 0 20 20' width='22' height='22' aria-hidden='true'><circle cx='10' cy='10' r='7' fill='none' stroke='currentColor' stroke-width='1.6'/><path d='M10 3a7 7 0 0 1 0 14z' fill='currentColor'/></svg></button>";
}
function isDark(){
  var t = document.documentElement.getAttribute("data-theme");
  if(t) return t==="dark";
  try{ return matchMedia("(prefers-color-scheme: dark)").matches; }catch(e){ return false; }
}
function syncThemeBtn(){
  document.querySelectorAll(".theme").forEach(function(b){ b.setAttribute("aria-pressed", String(isDark())); });
}
function setTheme(next){
  document.documentElement.setAttribute("data-theme", next); store("sb-theme", next); syncThemeBtn();
  if(LOOK) document.documentElement.classList.toggle("sky", next==="light");
  if(typeof readColors==="function") readColors();
}
// concrete look: the pointer carries a soft light across the wall (dark only, fine pointers only)
if(LOOK) document.addEventListener("pointermove", function(e){
  if(e.pointerType !== "mouse") return;
  var st = document.getElementById("stage"); if(!st) return;
  st.style.setProperty("--mx", e.clientX+"px"); st.style.setProperty("--my", e.clientY+"px");
  st.classList.add("lit");
}, {passive:true});
/* the runner notices you: hover (or tap on touch screens) and he turns to look (decorative, so pointer only) */
var R3look = false;
document.addEventListener("pointermove", function(e){
  if(!R3 || !sceneOn || e.pointerType !== "mouse") return;
  var over = !(e.target.closest && e.target.closest("a,button,.snav,header,.map")) && R3.hit(e.clientX, e.clientY);
  if(over !== R3look){ R3look = over; R3.look(over); }
  r3bubble(over);
}, {passive:true});
/* a thought bubble over his head says what a click does: he takes you to Now (where About lives).
   Mouse: hover shows it, click goes. Touch: first tap shows it and he looks, a second tap goes. */
var bubT = null;
["wheel","keydown","touchmove"].forEach(function(t){ document.addEventListener(t, function(){ if(R3look && R3){ R3look = false; R3.look(false); r3bubble(false); } }, {passive:true}); });
function r3bubble(on){
  var b = document.getElementById("r3bub");
  if(!b){ b = document.createElement("div"); b.id = "r3bub"; b.setAttribute("aria-hidden","true"); b.innerHTML = "<span>That's me. Click to see what I'm up to now.</span><i></i><i></i>"; document.body.appendChild(b); }
  if(NOHOVER) b.firstChild.textContent = "That's me. Tap again to see what I'm up to now.";
  document.documentElement.classList.toggle("r3over", !!on);
  if(on){ var h = R3.head && R3.head(); if(h){ b.style.left = h[0]+"px"; b.style.top = h[1]+"px"; } }
  b.classList.toggle("on", !!on);
}
document.addEventListener("click", function(e){
  if(!R3 || !sceneOn || (e.target.closest && e.target.closest("a,button,input,.map"))) return;
  if(!R3.hit(e.clientX, e.clientY)) return;
  if(NOHOVER && !R3look){ R3look = true; R3.peek(); r3bubble(true); clearTimeout(bubT); bubT = setTimeout(function(){ R3look = false; r3bubble(false); }, 3000); return; }
  clearTimeout(bubT); R3look = false; R3.look(false); r3bubble(false);
  location.hash = "#now";
});
document.addEventListener("click", function(e){
  if(e.target.closest && e.target.closest(".plainbtn")){ setPlain(!document.documentElement.classList.contains("plainw")); return; }
  if(!e.target.closest || !e.target.closest(".theme")) return;
  // from the plain white hall, the theme button goes back to the concrete hall
  if(LOOK && document.documentElement.classList.contains("plainw")){ setPlain(false); setTheme("dark"); return; }
  var next = isDark() ? "light" : "dark";
  // concrete look: dark is the concrete hall, light is open sky; the world glitches between them
  if(LOOK && !REDUCE){
    var root = document.documentElement;
    root.classList.remove("glitch"); void root.offsetWidth; root.classList.add("glitch");
    setTimeout(function(){ setTheme(next); }, 220);
    setTimeout(function(){ root.classList.remove("glitch"); }, 560);
    return;
  }
  setTheme(next);
});
(function(){ var t = store("sb-theme"); if(LOOK) t = document.documentElement.classList.contains("pg") ? "light" : "dark"; if(t==="dark"||t==="light") document.documentElement.setAttribute("data-theme", t); if(LOOK) document.documentElement.classList.remove("sky"); document.documentElement.lang = "en"; if(LOOK && store("sb-look")==="plain"){ var r = document.documentElement; r.classList.remove("concrete","sky"); r.classList.add("plainw"); r.setAttribute("data-theme","light"); } })();

/* ---------- small math ---------- */
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function lerp(a,b,k){ return a+(b-a)*k; }
function sstep(a,b,v){ var x = clamp((v-a)/(b-a),0,1); return x*x*(3-2*x); }
/* moves on the first frame, settles slowly */
function easeCam(x){ return 0.6*(1-Math.pow(1-x,3)) + 0.4*easeIO(x); }
function easeIO(x){ return x<.5 ? 4*x*x*x : 1-Math.pow(-2*x+2,3)/2; }
var D2R = Math.PI/180;

/* Periodic Catmull-Rom through keyframes [[phase, value], ...], phase in [0,1). Keyed the way
   you'd key a graph editor: poses at contact, down, passing, up. */
function curve(keys){
  return function(p){
    p = ((p%1)+1)%1;
    var n = keys.length, i = 0;
    while(i<n-1 && keys[i+1][0]<=p) i++;
    var k0 = keys[(i-1+n)%n], k1 = keys[i], k2 = keys[(i+1)%n], k3 = keys[(i+2)%n];
    var t0 = k1[0], t1 = k2[0] + (i+1>=n?1:0);
    var u = (p - t0)/(t1 - t0);
    var a = k0[1], b = k1[1], c = k2[1], d = k3[1];
    return 0.5*((2*b) + (-a+c)*u + (2*a-5*b+4*c-d)*u*u + (-a+3*b-3*c+d)*u*u*u);
  };
}
/* Run, keyed from contact: 0.12 down, 0.25 mid-stance, 0.38 toe-off, 0.44 flight, 0.62 passing, 0.78 knee drive */
var THIGH = curve([[0,27],[.12,17],[.25,-2],[.38,-27],[.5,-20],[.62,8],[.78,40],[.9,33]]);
var KNEE  = curve([[0,10],[.12,36],[.25,24],[.38,10],[.5,72],[.62,118],[.78,78],[.9,22]]);
var FOOT  = curve([[0,-14],[.12,0],[.25,0],[.38,34],[.5,58],[.62,40],[.78,8],[.9,-12]]);
/* Walk, keyed from heel strike: 0.12 loading, 0.3 mid-stance, 0.6 toe-off, 0.72 passing */
var WTHIGH = curve([[0,20],[.15,11],[.3,-2],[.5,-17],[.6,-14],[.75,6],[.9,20]]);
var WKNEE  = curve([[0,4],[.12,15],[.3,5],[.5,12],[.62,40],[.72,60],[.85,25],[.95,4]]);
var WFOOT  = curve([[0,-18],[.12,0],[.4,0],[.55,20],[.62,34],[.75,6],[.9,-12]]);
/* Flight: one lift per step, so both feet are off the floor only between toe-off and the next contact */
var LIFT  = curve([[0,0],[.12,0],[.25,0],[.38,0],[.44,6],[.5,0],[.62,0],[.75,0],[.88,0],[.94,6]]);
var gaitRun = 0;
/* pace: lower follow = the runner trails the scroll and moves slower; the run thresholds are hall
   speeds (units/s) where he breaks from a walk into a run, and from a run into a sprint */
/* two paces. RUN: the original feel, for jumps (left/right arrows, the map, phone swipes).
   WALK: scroll and up/down arrows; never breaks into a run, speed capped near the walk cycle's own pace. */
var PACE_RUN = {follow:7.5, run:[140, 300], sprint:[500, 1200], vmax:1e9};
var PACE_WALK = {follow:4, run:[1e9, 2e9], sprint:[1e9, 2e9], vmax:260};
var PACE = PACE_RUN;
function setPace(run){ PACE = PACE_RUN; }   // back to the original: speed alone picks walk or run (PACE_WALK kept for later)

/* ---------- state ---------- */
var S = 0, V = 0, target = 0;         // runner x (world), speed
var phase = 0, amp = 0, face = 1, faceA = 0, sprint = 0, idleFor = 0;
var M = 0, mFrom = 0, mTo = 0, mT0 = 0, MDUR = 1150;
var focus = null, F = 0, fFrom = 0, fTo = 0, fT0 = 0, FDUR = 800;
var NOHOVER = false; try{ NOHOVER = matchMedia("(hover: none)").matches; }catch(e){}
var hoverPointer = false, capT = null;
function setCap(o){
  var c = document.getElementById("cap"); if(!c) return;
  c.classList.add("out");
  clearTimeout(capT);
  capT = setTimeout(function(){ c.innerHTML = capHtml(o); c.classList.remove("out"); }, REDUCE ? 0 : 140);
}
var introEl0 = null, introM = -1;
var quietFocus = false, lastT = 0, running = false, sceneOn = false, hoverDoor = null, hoverAmt = 0;
var cam = null;
var COL = {};

function readColors(){
  var cs = getComputedStyle(document.documentElement);
  ["--ink","--ink-far","--wall","--floor","--lamp"].forEach(function(k){ COL[k] = cs.getPropertyValue(k).trim(); });
}

/* ---------- camera ---------- */
function camCY(){ return !COMPACT ? H/2 : CL ? H*0.5 : H*(gf()-0.24); }
function camSetup(m){
  // step back until ~560 units of wall show between the floor and the header, so the large 2D screens fit
  var sc2 = Math.max(0.45, Math.min(1, (H*0.72 - 70)/560));
  if(COMPACT){
    var cy = camCY(), A2, B2;
    if(CL){
      A2 = {yaw:0, pitch:0, f:3600, D:3600/0.72, lead:W*0.32, ty:(cy - H*0.8)/0.72};
      B2 = {yaw:20, pitch:4, f:W*0.62, D:760, lead:260, ty:-120};
    } else {
      var s2 = Math.min(1, H/(H < 620 ? 980 : 820));   // shorter phones: step back so tall screens on the wall clear the header
      A2 = {yaw:0, pitch:0, f:3600, D:3600/s2, lead:W*0.38/s2, ty:(cy - H*gf())/s2};
      B2 = {yaw:20, pitch:4, f:W*1.4, D:860, lead:250, ty:-150};
    }
    return {yaw:lerp(A2.yaw,B2.yaw,m), pitch:lerp(A2.pitch,B2.pitch,m),
      f:Math.exp(lerp(Math.log(A2.f),Math.log(B2.f),m)), D:Math.exp(lerp(Math.log(A2.D),Math.log(B2.D),m)),
      lead:lerp(A2.lead,B2.lead,m), ty:lerp(A2.ty,B2.ty,m), tz:0};
  }
  var A = {yaw:0, pitch:0, f:3600, D:3600/sc2, lead:(W*(narrow?0.38:0.28))/sc2, ty:-(H*(narrow?0.2:0.22))/sc2, tz:0};
  var B = narrow
    ? {yaw:30, pitch:5, f:W*1.25, D:560/sc2, lead:200/sc2, ty:-150/sc2, tz:0}
    : {yaw:36, pitch:5.5, f:Math.max(W*0.72,760), D:760/sc2, lead:350/sc2, ty:-112, tz:0};
  var k = m;
  return {
    yaw: lerp(A.yaw,B.yaw,k), pitch: lerp(A.pitch,B.pitch,k),
    f: Math.exp(lerp(Math.log(A.f),Math.log(B.f),k)), D: Math.exp(lerp(Math.log(A.D),Math.log(B.D),k)),
    lead: lerp(A.lead,B.lead,k), ty: lerp(A.ty,B.ty,k), tz:0
  };
}
function buildCam(){
  var c = camSetup(M);
  var tx = S + c.lead, ty = c.ty, tz = c.tz;
  if(focus && F>0){
    var k = easeIO(F);
    var fx = focus.x + focus.w/2, fy = -focus.h*0.5;
    tx = lerp(tx, fx, k); ty = lerp(ty, fy, k); tz = lerp(tz, 0, k);
    c.yaw = lerp(c.yaw, 0, k); c.pitch = lerp(c.pitch, 0, k);
    c.D = Math.exp(lerp(Math.log(c.D), Math.log(focus.h*1.55), k));
  }
  var ya = c.yaw*D2R, pa = c.pitch*D2R;
  var d = [Math.sin(ya)*Math.cos(pa), Math.sin(pa), -Math.cos(ya)*Math.cos(pa)];
  var r = [Math.cos(ya), 0, Math.sin(ya)];
  var u = [r[1]*d[2]-r[2]*d[1], r[2]*d[0]-r[0]*d[2], r[0]*d[1]-r[1]*d[0]];
  var b = [-d[0],-d[1],-d[2]];
  var C = [tx - c.D*d[0], ty - c.D*d[1], tz - c.D*d[2]];
  var cx = CL ? W*0.29 : W/2, cy = camCY();   // phones: shift the lens so the hall sits in its own part of the screen
  function dot(a,p){ return a[0]*p[0]+a[1]*p[1]+a[2]*p[2]; }
  cam = {r:r,u:u,b:b,d:d,C:C,f:c.f,cx:cx,cy:cy,
    tx: cx - dot(r,C), ty: cy - dot(u,C), tz: c.f - dot(b,C)};
  return cam;
}
function project(x,y,z){
  var px = x-cam.C[0], py = y-cam.C[1], pz = z-cam.C[2];
  var X = cam.r[0]*px+cam.r[1]*py+cam.r[2]*pz;
  var Y = cam.u[0]*px+cam.u[1]*py+cam.u[2]*pz;
  var depth = cam.d[0]*px+cam.d[1]*py+cam.d[2]*pz;
  var s = cam.f/Math.max(depth,1);
  return {x:cam.cx+X*s, y:cam.cy+Y*s, s:s, d:depth};
}
function depthOf(x,y,z){ return cam.d[0]*(x-cam.C[0])+cam.d[1]*(y-cam.C[1])+cam.d[2]*(z-cam.C[2]); }

/* ---------- the runner ---------- */
/* Proportions: 132 units tall against a 250 door. Thigh 34, shin 33, torso 40, head r 9. */
function pose(time){
  var a = amp, g = gaitRun, spr = sprint;
  var settle = 1 - sstep(4, 5, idleFor);           // idle motion stops after five seconds (WCAG 2.2.2)
  var lean = (4 + 3*a + 8*g*a + 4*spr)*D2R, breathe = Math.sin(time*1.6)*0.7*(1-a)*settle;
  var sway = Math.sin(time*0.55)*(1-a)*settle;     // idle: weight drifts between feet
  var legs = [], arms = [];
  for(var side=0; side<2; side++){
    var p = phase + side*0.5;
    var idleT = side ? 2 + sway*2 : -3 + sway*2;
    var idleK = side ? 3 : 9 - sway*4;               // one knee relaxed
    var th = lerp(idleT, lerp(WTHIGH(p), THIGH(p)*(1+0.22*spr), g), a)*D2R;
    var kn = lerp(idleK, lerp(WKNEE(p), KNEE(p), g), a)*D2R;
    var fa = lerp(0, lerp(WFOOT(p), FOOT(p), g), a)*D2R;
    var knee = [Math.sin(th)*34, Math.cos(th)*34];
    var sh = th - kn;
    var ank = [knee[0]+Math.sin(sh)*33, knee[1]+Math.cos(sh)*33];
    var toe = [ank[0]+Math.cos(fa)*11, ank[1]+Math.sin(fa)*11];
    var heel = [ank[0]-Math.cos(fa)*2.5, ank[1]-Math.sin(fa)*2.5];
    legs.push({knee:knee, ank:ank, toe:toe, heel:heel, z:side? 5.5:-5.5});
    var swing = lerp(-0.6*WTHIGH(p) + 3, -0.95*THIGH(p)*(1+0.2*spr) + 6, g);
    var arm = lerp(4 + sway*1.5, swing, a)*D2R;
    var el = lerp(12, lerp(20 + 6*Math.sin(p*2*Math.PI), 88 + 14*Math.sin((p+0.1)*2*Math.PI), g), a)*D2R;
    arms.push({a:arm, e:el, z:side? 9:-9});
  }
  var low = -1e9;
  legs.forEach(function(l){ low = Math.max(low, l.ank[1]+2.2, l.toe[1]+1.2, l.heel[1]+1.6); });
  var lift = LIFT(phase)*g*a;
  var ph = low + lift;
  var pel = [sway*1.2, -ph];
  var neck = [pel[0]+Math.sin(lean)*40, pel[1]-Math.cos(lean)*40 + breathe];
  var head = [neck[0]+Math.sin(lean*0.6)*13, neck[1]-Math.cos(lean*0.6)*13];
  var shoulder = [neck[0]-Math.sin(lean)*4, neck[1]+Math.cos(lean)*4];
  var J = {pel:pel, neck:neck, head:head, legs:[], arms:[], lift:lift};
  legs.forEach(function(l){
    J.legs.push({z:l.z, w:[4.8,3.7,2.8], pts:[[pel[0],pel[1],l.z*0.8],[pel[0]+l.knee[0],pel[1]+l.knee[1],l.z],[pel[0]+l.ank[0],pel[1]+l.ank[1],l.z],[pel[0]+l.toe[0],pel[1]+l.toe[1],l.z]]});
  });
  arms.forEach(function(r){
    var el = [shoulder[0]+Math.sin(r.a)*22, shoulder[1]+Math.cos(r.a)*22];
    var fa = r.a + r.e;
    var hand = [el[0]+Math.sin(fa)*20, el[1]+Math.cos(fa)*20];
    J.arms.push({z:r.z, w:[3.6,2.9], pts:[[shoulder[0],shoulder[1],r.z*0.7],[el[0],el[1],r.z],[hand[0],hand[1],r.z*0.9]]});
  });
  return J;
}
function toWorld(p){
  // turn about the vertical axis (faceA: 0 = facing +x, PI = facing -x), then place at the runner
  var c = Math.cos(faceA), s = Math.sin(faceA);
  return project(S + p[0]*c - p[2]*s, p[1], RZ + p[0]*s + p[2]*c);
}
function drawRunner(time){
  // once the 3D figure has fully taken over, only the airborne lift is needed (for the shadow)
  var J = R3 && R3k>=1 ? {lift:LIFT(phase)*gaitRun*amp} : pose(time);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,W,H);
  // light from an open door, pooled on the floor in front of the threshold
  if(hoverAmt>0.01 && hoverDoor && M>0.5){
    var o = hoverDoor, k = hoverAmt*sstep(.5,1,M);
    var q = [project(o.x+2,0,1), project(o.x+o.w-2,0,1), project(o.x+o.w+46,0,190), project(o.x-46,0,190)];
    var m0 = project(o.x+o.w/2,0,1), m1 = project(o.x+o.w/2,0,190);
    var g = ctx.createLinearGradient(m0.x,m0.y,m1.x,m1.y);
    var lc = o.tc || COL["--lamp"];
    g.addColorStop(0, hexA(lc, .7*k)); g.addColorStop(.45, hexA(lc, .28*k)); g.addColorStop(1, hexA(lc, 0));
    ctx.save(); ctx.filter = "blur("+(6*m0.s).toFixed(1)+"px)";
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(q[0].x,q[0].y); q.forEach(function(p){ ctx.lineTo(p.x,p.y); }); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // concrete look: the figure is a red light, so it pools on the floor and washes the wall behind
  if(CONC() && !document.documentElement.classList.contains("sky")){
    var lk = R3 ? Math.min(1, R3k) : 0;
    if(lk > 0){
      var glow = function(cx, cy, cz, ax, ay, az, bx, by, bz, a){
        var p0 = project(cx,cy,cz), pa = project(cx+ax,cy+ay,cz+az), pb = project(cx+bx,cy+by,cz+bz);
        if(p0.s <= 0) return;
        ctx.save();
        ctx.setTransform(DPR*(pa.x-p0.x), DPR*(pa.y-p0.y), DPR*(pb.x-p0.x), DPR*(pb.y-p0.y), DPR*p0.x, DPR*p0.y);
        var g = ctx.createRadialGradient(0,0,0,0,0,1);
        g.addColorStop(0, "rgba(255,40,24,"+(a*lk).toFixed(3)+")"); g.addColorStop(.35, "rgba(255,30,16,"+(a*.45*lk).toFixed(3)+")"); g.addColorStop(1, "rgba(255,20,10,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0,0,1,0,Math.PI*2); ctx.fill();
        ctx.restore();
      };
      glow(S, 0, RZ, 120,0,0, 0,0,120, .5);            // pool on the floor around his feet
      glow(S, -70, 0, 170,0,0, 0,170,0, .2);           // wash on the wall behind him
    }
  }
  // contact shadow, lighter while in the air
  var c0 = project(S,0,RZ), ca = project(S+24,0,RZ), cb = project(S,0,RZ+9);
  ctx.save();
  ctx.globalAlpha = clamp(0.16*(1 - J.lift/10), 0, 0.16);
  ctx.fillStyle = CONC() ? "#000" : COL["--ink"];
  ctx.setTransform(DPR*(ca.x-c0.x), DPR*(ca.y-c0.y), DPR*(cb.x-c0.x), DPR*Math.max(cb.y-c0.y, .9), DPR*c0.x, DPR*c0.y);
  ctx.beginPath(); ctx.arc(0,0,1,0,Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.setTransform(DPR,0,0,DPR,0,0);

  if(R3){
    R3k = Math.min(1, R3k + 1/36);
    R3.render({cam:cam, W:W, H:H, x:S, z:RZ, faceA:faceA, amp:amp, gait:gaitRun, sprint:sprint, spd:Math.abs(V),
      dt:Math.min(0.05, R3dt), idleRate:REDUCE ? 0 : 1 - sstep(4, 5, idleFor), dark:isDark(),
      still:idleFor, reduce:REDUCE});
    if(R3k>=1) return;
    ctx.globalAlpha = 1 - R3k;
  }
  var segs = [];
  J.legs.forEach(function(l){ segs.push({pts:l.pts.map(toWorld), z:l.z, w:l.w}); });
  J.arms.forEach(function(a){ segs.push({pts:a.pts.map(toWorld), z:a.z, w:a.w}); });
  var pel = toWorld([J.pel[0],J.pel[1],0]), neck = toWorld([J.neck[0],J.neck[1],0]), head = toWorld([J.head[0],J.head[1],0]);
  var farZ = toWorld([0,-60,-6]).d > toWorld([0,-60,6]).d ? -1 : 1;
  segs.forEach(function(s){ s.far = (s.z<0?-1:1)===farZ; });
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  function limb(s,col){
    ctx.strokeStyle = col;
    for(var i=1;i<s.pts.length;i++){
      var p0 = s.pts[i-1], p1 = s.pts[i];
      ctx.lineWidth = s.w[i-1]*p0.s;
      ctx.beginPath(); ctx.moveTo(p0.x,p0.y); ctx.lineTo(p1.x,p1.y); ctx.stroke();
    }
  }
  segs.filter(function(s){ return s.far; }).forEach(function(s){ limb(s, COL["--ink-far"]); });
  limb({pts:[pel,neck], w:[5.2]}, COL["--ink"]);
  ctx.fillStyle = COL["--ink"];
  ctx.beginPath(); ctx.arc(head.x, head.y, 9.6*head.s, 0, Math.PI*2); ctx.fill();
  segs.filter(function(s){ return !s.far; }).forEach(function(s){ limb(s, COL["--ink"]); });
  ctx.globalAlpha = 1;
}

/* ---------- the 3D runner (Three.js), loaded after the hall is up; the stick figure stays as the fallback ---------- */
var R3 = null, R3cv = null, R3k = 0, R3dt = 0, R3state = "";
function loadRunner3D(){
  if(R3state) return;
  R3state = "loading";
  var go = function(){
    window.createRunner3D({canvas:R3cv, url:"models/runner.glb.wasm", look:LOOK}).then(function(api){
      R3 = api; R3state = "ready"; R3.resize(W, H, DPR); R3cv.classList.add("on");
    }, function(e){ R3state = "failed"; if(R3cv) R3cv.remove(); R3cv = null; if(window.console) console.warn("3D runner unavailable:", e && e.message); });
  };
  if(window.createRunner3D){ go(); return; }
  var sc = document.createElement("script");
  sc.src = "js/runner3d.js"; sc.async = true;
  sc.onload = function(){ if(window.createRunner3D) go(); else sc.onerror(); };
  sc.onerror = function(){ R3state = "failed"; if(R3cv){ R3cv.remove(); R3cv = null; } };
  document.head.appendChild(sc);
}
function hexA(c,a){
  var m = /^#([0-9a-f]{6})$/i.exec(c||"");
  if(!m) return "rgba(255,244,218,"+a+")";
  var n = parseInt(m[1],16); return "rgba("+(n>>16&255)+","+(n>>8&255)+","+(n&255)+","+a+")";
}

/* ---------- per frame ---------- */
var itEls = [], segEls = [], prevS = 0, wallTexts = [];
function frame(now){
  if(!sceneOn){ running = false; return; }
  requestAnimationFrame(frame);
  var dt = Math.min(0.05, (now - (lastT||now))/1000); lastT = now; R3dt = dt;
  var time = now/1000;

  // follow the scroll with a critically damped spring: the runner accelerates, never teleports
  target = clamp(window.scrollY, 0, SMAX);
  if(COMPACT) PACE = PACE_RUN;      // phones move one item per swipe: always the run
  if(REDUCE){ S = target; V = 0; }
  else {
    var w = PACE.follow, acc = w*w*(target - S) - 2*w*V;
    V += acc*dt; V = clamp(V, -PACE.vmax, PACE.vmax); S += V*dt;
    if(Math.abs(target-S)<0.05 && Math.abs(V)<0.5){ S = target; V = 0; }
  }
  var spd = Math.abs(V);
  var want = REDUCE ? 0 : sstep(3, 50, spd);
  amp += (want - amp)*Math.min(1, dt*(want>amp?8:5));
  gaitRun += ((REDUCE?0:sstep(PACE.run[0], PACE.run[1], spd)) - gaitRun)*Math.min(1, dt*5);
  sprint += (sstep(PACE.sprint[0], PACE.sprint[1], spd) - sprint)*Math.min(1, dt*4);
  // cadence follows the distance covered by the stride he is actually taking, so feet don't slide
  var stride = lerp(73, 160, gaitRun)*(1 + 0.22*sprint)*Math.max(amp, 0.2);
  var cad = Math.min(spd/stride, 3.4);
  phase = (phase + cad*dt)%1;
  idleFor = (amp < 0.02 && F===0 && M===mTo) ? idleFor + dt : 0;
  if(spd>30){ var nf = V>0?1:-1; if(nf!==face) face = nf; }
  var fa = face>0 ? 0 : Math.PI;
  faceA += (fa - faceA)*Math.min(1, dt*10);

  // camera mode and door focus
  if(M!==mTo){ var k = REDUCE?1:clamp((now - mT0)/MDUR,0,1); M = lerp(mFrom, mTo, easeCam(k)); if(k>=1) M = mTo; }
  if(F!==fTo){ var kf = REDUCE?1:clamp((now - fT0)/FDUR,0,1); F = lerp(fFrom, fTo, kf); if(kf>=1){ F = fTo; if(F===0) focus = null; } }
  hoverAmt += ((hoverDoor?1:0) - hoverAmt)*Math.min(1, dt*6);
  // the intro sits up and left in 2D (Suraj, 2026-11-19); in 3D that spot is right at the camera, so it slides back to its old place
  var introEl = introEl0 || (introEl0 = document.querySelector("#world .intro"));
  if(introEl){ var im = Math.round(M*1000)/1000; if(im !== introM){ introM = im; introEl.style.transform = "translate3d("+(220*im)+"px,"+(140*im)+"px,3px)"; } }

  buildCam();
  stage.style.perspective = cam.f.toFixed(2)+"px";
  stage.style.perspectiveOrigin = cam.cx+"px "+cam.cy+"px";
  world.style.transform = "matrix3d("+[cam.r[0],cam.u[0],cam.b[0],0, cam.r[1],cam.u[1],cam.b[1],0, cam.r[2],cam.u[2],cam.b[2],0, cam.tx,cam.ty,cam.tz,1].map(function(v){ return +v.toFixed(6); }).join(",")+")";

  // the floor planes (concrete turf, building boards) run out toward the camera far enough to fill the screen
  // below the ground line, so the floor is real perspective in 2D too; kept short of the camera so nothing crosses it
  if(!floorEls || !floorEls.length || !floorEls[0].isConnected){
    floorEls = Array.prototype.slice.call(document.querySelectorAll(".fc")).map(function(el){ return {el:el, x0:+el.getAttribute("data-x0"), x1:+el.getAttribute("data-x1"), on:null}; });
    floorH = 0;
  }
  // just deep enough to reach the bottom of the screen, and always short of the camera
  var camH = Math.max(1, -cam.C[1]), need = cam.C[2] - camH*cam.f/Math.max(1, H - cam.cy) + 240;
  var fh = Math.round(clamp(Math.min(cam.C[2]*0.85, Math.max(640, need)), 400, 4200) / 20) * 20;
  if(fh !== floorH){ floorH = fh; floorEls.forEach(function(f){ f.el.style.height = fh+"px"; }); }
  var vx0 = S - 2600, vx1 = S + (M > 0.05 ? 7000 : 3400);
  floorEls.forEach(function(f){ var on = f.x1 > vx0 && f.x0 < vx1; if(on !== f.on){ f.on = on; f.el.style.display = on ? "" : "none"; } });

  // items: unfold doors with a stagger that starts at the runner, fog the far ones, pluck lines in 2D
  var cur = null;
  SC.forEach(function(o,i){
    var el = itEls[i];
    var dep = depthOf(o.x + o.w/2, -o.h/2, 0);
    var dep2 = depthOf(o.x + 24 + LABW + 28 + (o.aw || 0) + 40, -o.h/2, 0);   // the far edge of the hung art
    var vis = (dep > 30 || dep2 > 30) && (project(o.x,0,0).x < W+400 || M<0.5);
    if(el._vis!==vis){ el.style.visibility = vis?"":"hidden"; el._vis = vis; }
    if(!vis) return;
    var dist = Math.max(0, o.x - S);
    var off = Math.min(0.15, dist/9000);
    var mi = clamp((M - off)/(1-0.15), 0, 1);
    if(el._mi!==mi){
      el._mi = mi;
      if(o.door){
        o.jt.style.transform = "translateZ(1px) scaleX("+sstep(.06,.4,mi).toFixed(3)+")";
        o.jr.style.transform = "translateZ(1px) scaleY("+sstep(.22,.55,mi).toFixed(3)+")";
        o.lo = sstep(.38,.75,mi);
        o.door.style.pointerEvents = mi>.6 ? "" : "none";
      }
      var sh = (o.w ? (o.w + 10)*sstep(.05,.45,mi) : 0);
      o.lab.style.left = (24 + sh).toFixed(1)+"px";
      if(o.hang) o.hang.style.left = (COMPACT ? 24 + sh : 24 + LABW + 28 + sh).toFixed(1)+"px";
      if(o.hang) o.hang.style.transform = "translateZ(3px) scale("+(COMPACT ? 1 : lerp(ARTX[ART[o.id].type], 1, sstep(0, 1, M))).toFixed(4)+")";
    }
    var fog = 1 - 0.88*sstep(1300, 3600, dep)*M;
    var pass = 1 - M*sstep(-40, 200, S - (o.x + o.w));      // in 3D, art the runner has passed steps aside
    var passT = 1 - M*sstep(330, 520, S - (o.x + o.w));     // text only once it is no longer the current item
    fog = Math.round(fog*100)/100; pass = Math.round(pass*100)/100;
    passT = Math.round(passT*100)/100;
    if(fog!==o._fog || pass!==o._pass || passT!==o._passT || o._lo!==o.lo){
      o._passT = passT;
      o._fog = fog; o._pass = pass; o._lo = o.lo;
      o.flat.forEach(function(e){ e.style.opacity = fog; });
      o.side.forEach(function(e){ e.style.opacity = (e.classList.contains("hang") ? fog : passT).toFixed(3); });
      if(o.door){
        o.box.forEach(function(e){ e.style.opacity = (fog*o.lo).toFixed(3); });
        o.patch.style.opacity = (1-o.lo).toFixed(3);
        o.patch.style.visibility = o.lo>=1 ? "hidden" : "";
      }
    }
    var on = S >= o.x - 260 && S < o.x + (o.w||0) + 330;
    if(on) cur = o;
    if(el._on!==on){ el.classList.toggle("on", on); el._on = on; }
    // a line plucked by the runner rings like a string, only in the side view
    if((prevS < o.x) !== (S < o.x) && spd>40 && !REDUCE) { o.pl = time; o.pa = Math.min(1, spd/500); }
    var age = time - o.pl;
    var sk = age < 1.2 ? 5.5*o.pa*Math.exp(-age*4.2)*Math.sin(age*2*Math.PI*6.5)*(1-M)*(V>0?1:-1) : 0;
    if(Math.abs(sk - (o._sk||0))>0.001){ o.post.style.transform = "translateZ(1px) skewX("+(-sk).toFixed(3)+"deg)"; o._sk = sk; }
  });
  prevS = S;
  segEls.forEach(function(e){
    var x0 = e._x, ok = depthOf(x0,0,0) > 2 || depthOf(x0+300,0,0) > 2;
    if(e._ok!==ok){ e.style.visibility = ok?"":"hidden"; e._ok = ok; }
  });

  drawRunner(time);

  // hint and map
  var hp = toWorld([-30, 34, 0]);
  hintEl.style.opacity = !COMPACT && S < 30 && F===0 ? (1-M).toFixed(2) : 0;
  hintEl.style.transform = "translate("+(hp.x).toFixed(1)+"px,"+(hp.y).toFixed(1)+"px)";
  mapMe.style.left = (toMap(S)*100).toFixed(3)+"%";
  var endish = S > SMAX - 200;
  if(cur!==frame._cur || (COMPACT && !cur && endish!==frame._end)){
    document.querySelectorAll(".map [data-go]").forEach(function(b){ b.classList.toggle("on", cur && b.getAttribute("data-go")===cur.id); });
    frame._cur = cur; frame._end = endish;
    if(COMPACT) setCap(cur);
  }
  // no hover on a phone: arriving at a door opens it a little and lets its colour out
  var arrive = (COMPACT || NOHOVER) && cur && cur.door && cur.kind!=="build" && M>0.5 && spd<25 && F===0 ? cur : null;
  if(arrive!==frame._arr){
    if(frame._arr) frame._arr.el.classList.remove("arrived");
    if(arrive) arrive.el.classList.add("arrived");
    frame._arr = arrive;
    if(!hoverPointer) hoverDoor = arrive;
  }
}

function resize(){
  W = stage.clientWidth; H = stage.clientHeight; narrow = W < 700;
  DPR = Math.min(window.devicePixelRatio||1, 2);
  cv.width = Math.round(W*DPR); cv.height = Math.round(H*DPR);
  cv.style.width = W+"px"; cv.style.height = H+"px";
  if(R3) R3.resize(W, H, DPR);
  track.style.height = (H + SMAX)+"px";
  if(COMPACT && !CL) stage.style.setProperty("--cap-top", ((gf()+0.05)*100).toFixed(1)+"%");
}

function setMode(v, instant){
  mFrom = M; mTo = v; mT0 = performance.now();
  if(instant){ M = v; mFrom = v; }
  store("sb-mode", String(v));
  document.querySelectorAll("[data-mode]").forEach(function(b){ b.setAttribute("aria-pressed", String(+b.getAttribute("data-mode")===v)); });
}
function setFocus(o, to, instant){
  if(o) focus = o;
  fFrom = F; fTo = to; fT0 = performance.now();
  if(instant){ F = to; fFrom = to; }
}
function startLoop(){ if(!running){ running = true; lastT = 0; requestAnimationFrame(frame); } }
function scrollToItem(id, smooth){
  var o = SC.filter(function(x){ return x.id===id; })[0]; if(!o) return;
  setPace(true);
  var y = stopY(o);
  window.scrollTo({top:y, behavior: smooth && !REDUCE ? "smooth" : "auto"});
}

function buildScene(){
  buildDom(); if(typeof syncFontSw==="function") syncFontSw();
  bindOnce();
  setTimeout(loadRunner3D, 300);
}
function buildDom(){ introEl0 = null; introM = -1;
  layout();
  document.documentElement.classList.toggle("compact", COMPACT);
  document.documentElement.classList.toggle("cl", CL);
  var host = document.getElementById("scene");
  host.innerHTML = sceneHtml();
  frame._cur = undefined; frame._arr = null;
  stage = document.getElementById("stage"); world = document.getElementById("world");
  cv = document.getElementById("runner"); ctx = cv.getContext("2d");
  if(R3cv) cv.insertAdjacentElement("afterend", R3cv); else if(R3state!=="failed") R3cv = document.getElementById("runner3d");
  track = document.getElementById("track"); mapMe = document.getElementById("map-me"); hintEl = document.getElementById("hint");
  itEls = Array.prototype.slice.call(world.querySelectorAll(".it"));
  SC.forEach(function(o,i){
    var el = itEls[i];
    o.el = el; o.post = el.querySelector(".post"); o.lab = el.querySelector(".lab");
    o.door = el.querySelector(".door");
    o.flat = Array.prototype.slice.call(el.querySelectorAll(".post"));
    o.side = Array.prototype.slice.call(el.querySelectorAll(".pn,.lab,.hang"));
    o.hang = el.querySelector(".hang");
    if(o.door){
      o.jt = o.door.querySelector(".jt"); o.jr = o.door.querySelector(".jr"); o.patch = o.door.querySelector(".patch");
      o.flat.push(o.jt, o.jr);
      o.box = Array.prototype.slice.call(o.door.querySelectorAll(".back,.rv,.leaf"));
      o.lo = 0;
    }
  });
  segEls = Array.prototype.slice.call(world.querySelectorAll(".seg"));
  segEls.forEach(function(e){ e._x = parseFloat(e.style.left); });
  wallTexts = Array.prototype.slice.call(world.querySelectorAll(".wallText"));
  wallTexts.forEach(function(e){ e._x = parseFloat(e.style.left)+200; });
  readColors();
  SC.forEach(function(o){
    if(!TONE[o.id]) return;
    var im = new Image();
    im.onload = function(){
      try{
        var c = document.createElement("canvas"); c.width = c.height = 8;
        var x = c.getContext("2d"); x.drawImage(im,0,0,8,8);
        var d = x.getImageData(0,0,8,8).data, r=0,g=0,b=0;
        for(var i=0;i<d.length;i+=4){ r+=d[i]; g+=d[i+1]; b+=d[i+2]; }
        var n = d.length/4, hx = function(v){ return ("0"+Math.round(Math.min(255,v/n*1.08)).toString(16)).slice(-2); };
        o.tc = "#"+hx(r)+hx(g)+hx(b);
      }catch(e){}
    };
    im.src = TONE[o.id];
  });
  world.addEventListener("pointerover", function(e){
    var d = e.target.closest(".door[data-open]");
    if(d){ var id = d.getAttribute("data-open"); hoverDoor = SC.filter(function(x){ return x.id===id; })[0]; hoverPointer = true; }
  });
  world.addEventListener("pointerout", function(e){
    if(e.target.closest(".door") && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(".door"))){ hoverDoor = frame._arr || null; hoverPointer = false; }
  });
  world.addEventListener("focusin", function(e){
    if(quietFocus) return;
    if(e.target.closest(".intro")){ stage.scrollLeft = 0; stage.scrollTop = 0; window.scrollTo({top:0, behavior:REDUCE?"auto":"smooth"}); return; }
    var it = e.target.closest(".it"); if(!it) return;
    stage.scrollLeft = 0; stage.scrollTop = 0;
    scrollToItem(it.getAttribute("data-id"), true);
  });
  var nt = document.getElementById("notes-toggle");
  if(nt) nt.addEventListener("click", function(){ notesOn=!notesOn; store("sb-notes",notesOn?"on":"off"); applyNotes(); });
  if(COMPACT) setCap(null);
  syncThemeBtn();
  document.querySelectorAll("[data-mode]").forEach(function(b){ b.setAttribute("aria-pressed", String(+b.getAttribute("data-mode")===mTo)); });
}
function bindOnce(){
  var host = document.getElementById("scene");
  try{ matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColors); }catch(e){}
  try{ new MutationObserver(readColors).observe(document.documentElement, {attributes:true, attributeFilter:["data-theme","class","style"]}); }catch(e){}

  host.addEventListener("click", function(e){
    var a = e.target.closest("[data-open]");
    if(a){ e.preventDefault(); openItem(a.getAttribute("data-open"), a.getAttribute("data-jump")); return; }
    var g = e.target.closest("[data-go]");
    if(g){ scrollToItem(g.getAttribute("data-go"), true); return; }
    if(e.target.closest(".nt")){ notesOn=!notesOn; store("sb-notes",notesOn?"on":"off"); applyNotes(); return; }
    var mp = e.target.closest(".map");
    if(mp){
      var r = mp.getBoundingClientRect(), fx = clamp((e.clientX - r.left)/r.width, 0, 1), best = null;
      SC.forEach(function(o){ if(!best || Math.abs(toMap(o.x)-fx) < Math.abs(toMap(best.x)-fx)) best = o; });
      if(best) scrollToItem(best.id, true);
      return;
    }
    var m = e.target.closest("[data-mode]");
    if(m){ setMode(+m.getAttribute("data-mode")); return; }
    if(e.target.closest("#to-start")){ setPace(true); window.scrollTo({top:0, behavior:REDUCE?"auto":"smooth"}); }
  });
  // horizontal trackpad swipes scroll too
  window.addEventListener("wheel", function(e){
    if(!sceneOn) return;
    setPace(false);
    if(Math.abs(e.deltaX) > Math.abs(e.deltaY)){ e.preventDefault(); window.scrollBy(0, e.deltaX); }
  }, {passive:false});
  window.addEventListener("keydown", function(e){
    if(!sceneOn || e.target.closest("input,textarea,select")) return;
    if(e.key==="Enter" && !e.target.closest("a,button") && frame._cur && STORIES[frame._cur.id]){ e.preventDefault(); openItem(frame._cur.id); return; }
    if(e.key==="ArrowUp"||e.key==="ArrowDown"||e.key==="PageUp"||e.key==="PageDown"||e.key===" ") setPace(false);
    if(e.key==="ArrowRight"||e.key==="ArrowLeft"){
      e.preventDefault(); setPace(true);
      var dir = e.key==="ArrowRight"?1:-1, x = window.scrollY;
      var list = SC.map(function(o){ return {id:o.id, y:stopY(o)}; });
      var nx = dir>0 ? list.filter(function(o){ return o.y > x+8; })[0] : list.filter(function(o){ return o.y < x-8; }).pop();
      if(nx) window.scrollTo({top:nx.y, behavior:REDUCE?"auto":"smooth"});
      else window.scrollTo({top:dir>0?SMAX:0, behavior:REDUCE?"auto":"smooth"});
    }
  });
  window.addEventListener("resize", function(){
    if(!sceneOn) return;
    if(shapeChanged()){
      var id = frame._cur && frame._cur.id;
      buildDom(); resize();
      if(id) scrollToItem(id, false);
      S = clamp(window.scrollY,0,SMAX); V = 0; prevS = S;
    } else resize();
  });
  try{ matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeBtn); }catch(e){}
  var saved = store("sb-mode");
  setMode(saved==="1"?1:0, true);
}
