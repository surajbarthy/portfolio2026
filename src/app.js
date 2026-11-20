/* ===================== Pages + routing ===================== */
var app = document.getElementById("app");
var curtain = document.getElementById("curtain");
var depthPref = store("sb-depth")||"short";
var notesOn = store("sb-notes")!=="off";
var unlocked = {};
var homeScroll = null, pendingJump = null, busy = false, lastOpened = null, fromHall = false;
/* Back on a page: if we came straight from the hall, step back in history so the browser's own back agrees */
function goHall(id){ if(fromHall){ history.back(); } else location.hash = id ? "home-"+id : ""; }

function aboutPage(){
  return "<div class='wrap story' id='page'>"+
    "<div class='snav'><button class='back' type='button' id='back'>← Back to the work</button><nav><a href='#now'>Now</a><a href='"+RESUME+"' data-resume>Resume</a><a href='#contact'>Contact</a></nav></div>"+
    nowSection()+howSection()+about()+contact()+footer()+"</div>";
}
/* Now leads the page; About and Contact follow. After Derek Sivers' now pages. */
function nowSection(){
  return "<header class='head now-head' id='now'><p class='fact'>Updated November 2026 · Chennai × Brooklyn</p><h1>Now</h1>"+
    "<p class='lede'>What I'm doing at the moment. If the date above looks old, nudge me.</p></header>"+
    "<section class='blk'><h2 class='ser'>This month</h2><div class='body'><ul class='now-list'>"+
      "<li>Rebuilding this site from scratch: a hall you walk through, with a door for each project.</li>"+
      "<li>Looking for my next role, senior or staff product design. <a href='#contact'>Say hi</a>.</li>"+
      "<li>Building Thakaali Timer, a Pomodoro app for Mac. It's in alpha.</li>"+
      "<li>Year ten of my everyday project: something new, every day.</li>"+
      "<li><span class='tbd'>[Still true? Playing piano most days.]</span></li>"+
      "<li><span class='tbd'>[What you're reading, researching or learning right now.]</span></li>"+
    "</ul><p class='dim'>Learn something new every day.</p>"+
    "<div class='note'>Drafted from your Dec 2024 Now page and what you're doing this month. The surgery and illness lines are out since they're from last year. Edit freely.</div></div></section>";
}
/* the Playbook, kept to what can be shown: each line points at the story where it happened */
function howSection(){
  return "<section class='blk' id='how'><h2 class='ser'>How I work</h2><div class='body'><ul class='how'>"+
    "<li><b>Prototype the gesture, not the screen.</b> At Jones a tap replaced the long press for logging, and press-and-hold came back only for batch logging at the end of the day. <a href='#jones'>Track As You Go</a></li>"+
    "<li><b>Measure what people do.</b> Track As You Go is judged by 290K taps from 7K users, not by how the screens look. <a href='#jones'>The numbers</a></li>"+
    "<li><b>Accessibility from the first sketch.</b> <span class='tbd'>[One line from Viva Learning: what you designed in from day one.]</span> <a href='#viva-learning'>Viva Learning</a></li>"+
    "<li><b>Build it to know it.</b> Slop Stamp is live on the Chrome Web Store, and this site is hand-built.</li>"+
    "</ul><div class='note'>Your Playbook, cut to four lines you can back with work. The full version can live in your interview deck.</div></div></section>";
}

function indexPage(){
  var rows = ITEMS.map(function(it){
    var name = it.title.replace(/\s*\[.*\]/,"") || it.title;
    var link = STORIES[it.id] ? "<a href='#"+it.id+"'>"+t(it.title)+"</a>" : (it.href ? "<a href='"+it.href+"' target='_blank' rel='noopener'>"+esc(it.title)+" ↗</a>" : esc(it.title));
    return "<tr><td class='n'>"+it.n+"</td><td>"+link+"<p>"+t(it.out)+"</p></td><td>"+t(it.org)+"<br><span class='dim'>"+t(it.role)+"</span></td><td class='y'>"+t(it.year)+"</td></tr>";
  }).join("");
  return "<div class='wrap story' id='page'>"+
    "<div class='snav'><button class='back' type='button' id='back'>← Back to the hall</button><nav><a href='#now'>Now</a><a href='"+RESUME+"' data-resume>Resume</a><a href='#contact'>Contact</a></nav></div>"+
    "<header class='head'><h1>Index</h1><p class='lede'>Everything on the wall, as a list.</p></header>"+
    "<div class='ixl'><table><caption class='sr'>All work, in the order it hangs on the wall</caption><thead><tr><th scope='col'>No.</th><th scope='col'>Project</th><th scope='col'>Company and role</th><th scope='col'>Year</th></tr></thead><tbody>"+rows+"</tbody></table></div>"+
    footer()+"</div>";
}

function route(){
  var h = decodeURIComponent((location.hash||"").replace(/^#/,""));
  var nm = STORIES[h] ? STORIES[h].title : ({now:"Now", about:"About", contact:"Contact", index:"Index", accessibility:"Accessibility"})[h];
  document.title = nm ? nm+" · Suraj Barthy" : "Suraj Barthy";
  if(h==="index"){ showPage(indexPage(), function(){
      document.getElementById("back").addEventListener("click", function(){ goHall(); });
      bindCommon();
    }); return; }
  if(STORIES[h]){ showPage(story(h), function(){
      var jump = pendingJump; pendingJump = null;
      if(jump){ var el = document.getElementById(jump); if(el) setTimeout(function(){ el.scrollIntoView({behavior:REDUCE?"auto":"smooth"}); },250); }
      bindStory();
    }); return; }
  if(h==="accessibility"){ showPage(a11yPage(), function(){
      document.getElementById("back").addEventListener("click", function(){ goHall(); });
      bindCommon();
    }); return; }
  if(h==="now"||h==="about"||h==="contact"){ showPage(aboutPage(), function(){
      document.getElementById("back").addEventListener("click", function(){ goHall(); });
      bindCommon();
      if(h!=="now"){ var c = document.getElementById(h); if(c) setTimeout(function(){ c.scrollIntoView(); },0); }
    }); return; }
  showScene(h.indexOf("home-")===0 ? h.slice(5) : null);
}

function showPage(html, bind){
  fromHall = sceneOn;
  if(sceneOn){ homeScroll = window.scrollY; }
  sceneOn = false;
  document.documentElement.classList.remove("snapping");
  app.hidden = false;
  document.getElementById("scene").style.display = "none";
  document.body.classList.remove("in-scene");
  pageLight(true);
  app.innerHTML = html;
  window.scrollTo(0,0);
  bind();
  applyNotes();
  decorate();
  var h1 = app.querySelector("h1");
  if(h1){ h1.setAttribute("tabindex","-1"); h1.focus({preventScroll:true}); }
  reveal();
}
/* every page gets the Index link and the theme toggle */
function decorate(){
  var nav = app.querySelector(".snav nav");
  if(nav && !nav.querySelector(".theme")){
    nav.insertAdjacentHTML("afterbegin", "<a href='#index'>Index</a>");
    nav.insertAdjacentHTML("beforeend", FONT_SW + KB_BTN + plainBtn() + themeBtn()); syncFontSw();
  }
  collinsize();
  doorBack();
  var ft = app.querySelector(".foot > span"); if(ft && !ft.querySelector("[href='#accessibility']")) ft.insertAdjacentHTML("beforeend", " · <a href='#accessibility'>Accessibility</a>");
  buildToc();
  syncThemeBtn();
}

function showScene(id){
  var wasOn = sceneOn;
  app.innerHTML = "";
  app.hidden = true;
  document.getElementById("scene").style.display = "";
  document.body.classList.add("in-scene");
  pageLight(false);
  sceneOn = true;
  if(shapeChanged()){   // rotated while a page was open: rebuild for the new shape, place by item
    buildDom(); homeScroll = null; focus = null; F = 0; fTo = 0;
    if(!id) id = lastOpened;
  }
  resize();
  if(!wasOn){
    if(homeScroll!==null && (!id || id===lastOpened)) window.scrollTo(0, homeScroll);
    else if(id) scrollToItem(id, false);
    S = clamp(window.scrollY,0,SMAX); V = 0; prevS = S;
    if(focus){
      var o = focus;
      setTimeout(function(){ o.el.classList.remove("opening"); }, 120);
      setFocus(o, 0);
    }
  } else if(id){ scrollToItem(id, true); }
  if(!wasOn && lastOpened){
    if(COMPACT){
      // the wall labels are hidden on phones; land on the caption's title once it has filled in
      var want = lastOpened;
      setTimeout(function(){
        var c = document.querySelector("#cap h2 a");
        if(sceneOn && c && frame._cur && frame._cur.id===want) c.focus({preventScroll:true});
      }, 420);
    } else {
      var ln = document.querySelector(".it[data-id='"+lastOpened+"'] .lab h2 a");
      if(ln){ quietFocus = true; ln.focus({preventScroll:true}); setTimeout(function(){ quietFocus = false; }, 50); }
    }
  }
  startLoop();
  reveal();
  setTimeout(function(){ if(sceneOn) document.documentElement.classList.add("snapping"); }, 60);
}

function reveal(){
  if(flipParts){ flipLand(); return; }
  if(REDUCE || !curtain.animate){ curtain.style.opacity = 0; busy = false; return; }
  if(getComputedStyle(curtain).opacity==="0"){ busy = false; return; }
  var a = curtain.animate([{opacity:1},{opacity:0}],{duration:420,easing:"cubic-bezier(.2,.8,.2,1)",fill:"forwards"});
  a.onfinish = function(){ curtain.style.opacity = 0; curtain.style.clipPath = ""; a.cancel(); busy = false; };
}

/* Opening an item. In 3D the door swings and the camera walks into it.
   In 2D the line you clicked opens sideways into the page. */
function openItem(id, jump){
  if(!STORIES[id] || busy) return;
  pendingJump = jump || null; lastOpened = id;
  var o = SC.filter(function(x){ return x.id===id; })[0];
  if(REDUCE || !o || !curtain.animate){ location.hash = id; return; }
  busy = true;
  homeScroll = window.scrollY;
  if(M > 0.5 && o.door){
    hoverDoor = o;
    o.el.classList.add("opening");
    setFocus(o, 1);
    setTimeout(function(){
      var a = curtain.animate([{opacity:0},{opacity:1}],{duration:300,easing:"ease-in",fill:"forwards"});
      a.onfinish = function(){ curtain.style.opacity = 1; a.cancel(); hoverDoor = null; location.hash = id; };
    }, 480);
  } else if(!COMPACT && M < 0.5 && o.lab){
    if(VT){ vtParts = vtHall(id); location.hash = id; return; }
    flipOpen(o, id);
  } else {
    var p = project(o.x, -o.h/2, 0).x;
    p = clamp(p, 0, W);
    curtain.style.opacity = 1;
    var a = curtain.animate([
      {clipPath:"inset(0 "+(W-p-1)+"px 0 "+(p-1)+"px)"},
      {clipPath:"inset(0 0 0 0)"}
    ],{duration:560,easing:"cubic-bezier(.7,0,.2,1)",fill:"forwards"});
    a.onfinish = function(){ curtain.style.clipPath = "inset(0 0 0 0)"; a.cancel(); location.hash = id; };
  }
}

/* 2D open: everything else fades to the page colour while the title and meta line glide to the
   story's header on the left and the screen glides to the hero on the right. Then the page fades in
   under them and they hand over. */
var flipParts = null, flipLayer = null;
function flipOpen(o, id){
  flipLayer = document.createElement("div");
  flipLayer.setAttribute("aria-hidden", "true");
  flipLayer.style.cssText = "position:fixed;inset:0;z-index:45;pointer-events:none";
  document.body.appendChild(flipLayer);
  var parts = [], hid = [];
  function grab(el, to){
    if(!el) return;
    var r = el.getBoundingClientRect(), cs = getComputedStyle(el), w = el.offsetWidth || 1, s = r.width / w;
    var c = el.cloneNode(true);
    c.removeAttribute("id");
    Array.prototype.forEach.call(c.querySelectorAll("a"), function(x){ x.style.textDecoration = "none"; x.style.color = "inherit"; });
    c.style.cssText = "position:absolute;left:0;top:0;margin:0;box-sizing:border-box;width:"+w+"px;transform-origin:0 0;"+
      "transform:translate("+r.left+"px,"+r.top+"px) scale("+s+");color:"+cs.color+";font-family:"+cs.fontFamily+";font-size:"+cs.fontSize+
      ";font-weight:"+cs.fontWeight+";line-height:"+cs.lineHeight+";letter-spacing:"+cs.letterSpacing+";opacity:1";
    flipLayer.appendChild(c);
    el.style.visibility = "hidden";      // the clone stands in for it; restored when the hall comes back
    hid.push(el);
    parts.push({c:c, to:to, x:r.left, y:r.top, s:s, w:w, fs:parseFloat(cs.fontSize)});
  }
  // only the screen glides; the text fades with the page (Suraj, 2026-11-15)
  if(o.hang) grab(o.hang.querySelector(".art"), ".hero .phone,.hero .lap,.hero .win,.hero .tiles,.hero > *");
  flipParts = parts;
  setTimeout(function(){ hid.forEach(function(e){ e.style.visibility = ""; }); }, 1400);
  curtain.style.clipPath = "";
  var a = curtain.animate([{opacity:0},{opacity:1}],{duration:300,easing:"cubic-bezier(.4,0,.2,1)",fill:"forwards"});
  a.onfinish = function(){ curtain.style.opacity = 1; a.cancel(); location.hash = id; };
}
function flipLand(){
  var parts = flipParts; flipParts = null;
  var st = app.querySelector(".story"); if(st) st.style.animation = "none";
  app.style.opacity = "0";
  var E = "cubic-bezier(.4,0,.2,1)", n = parts.length, done = 0;
  function finish(){
    curtain.style.opacity = 0;
    var f = app.animate([{opacity:0},{opacity:1}],{duration:240,easing:"ease-out"});
    f.onfinish = function(){ app.style.opacity = ""; };
    var g = flipLayer.animate([{opacity:1},{opacity:0}],{duration:240,easing:"ease-out",fill:"forwards"});
    var L = flipLayer; flipLayer = null;
    g.onfinish = function(){ L.remove(); busy = false; };
  }
  if(!n){ finish(); return; }
  parts.forEach(function(p){
    var t = app.querySelector(p.to), from = "translate("+p.x+"px,"+p.y+"px) scale("+p.s+")", to = from;
    if(t){
      var r = t.getBoundingClientRect();
      var s = p.fs && t.matches("h1,p") ? parseFloat(getComputedStyle(t).fontSize)/p.fs : r.width/p.w;
      to = "translate("+r.left+"px,"+r.top+"px) scale("+s+")";
    }
    var a = p.c.animate([{transform:from},{transform:to}],{duration:550,easing:E,fill:"forwards"});
    a.onfinish = function(){ if(++done===n) finish(); };
  });
}
