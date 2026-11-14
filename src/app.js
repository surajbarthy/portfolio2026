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
    "<div class='snav'><button class='back' type='button' id='back'>← Back to the work</button><nav><a href='#about'>About</a><a href='"+RESUME+"' data-resume>Resume</a><a href='#contact'>Contact</a></nav></div>"+
    "<h1 class='sr'>About Suraj Barthy</h1>"+about()+contact()+footer()+"</div>";
}

function indexPage(){
  var rows = ITEMS.map(function(it){
    var name = it.title.replace(/\s*\[.*\]/,"") || it.title;
    var link = STORIES[it.id] ? "<a href='#"+it.id+"'>"+t(it.title)+"</a>" : (it.href ? "<a href='"+it.href+"' target='_blank' rel='noopener'>"+esc(it.title)+" ↗</a>" : esc(it.title));
    return "<tr><td class='n'>"+it.n+"</td><td>"+link+"<p>"+t(it.out)+"</p></td><td>"+t(it.org)+"<br><span class='dim'>"+t(it.role)+"</span></td><td class='y'>"+t(it.year)+"</td></tr>";
  }).join("");
  return "<div class='wrap story' id='page'>"+
    "<div class='snav'><button class='back' type='button' id='back'>← Back to the hall</button><nav><a href='#about'>About</a><a href='"+RESUME+"' data-resume>Resume</a><a href='#contact'>Contact</a></nav></div>"+
    "<header class='head'><h1>Index</h1><p class='lede'>Everything on the wall, as a list.</p></header>"+
    "<div class='ixl'><table><caption class='sr'>All work, in the order it hangs on the wall</caption><thead><tr><th scope='col'>No.</th><th scope='col'>Project</th><th scope='col'>Company and role</th><th scope='col'>Year</th></tr></thead><tbody>"+rows+"</tbody></table></div>"+
    footer()+"</div>";
}

function route(){
  var h = decodeURIComponent((location.hash||"").replace(/^#/,""));
  var nm = STORIES[h] ? STORIES[h].title : ({about:"About", contact:"Contact", index:"Index"})[h];
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
  if(h==="about"||h==="contact"){ showPage(aboutPage(), function(){
      document.getElementById("back").addEventListener("click", function(){ goHall(); });
      bindCommon();
      if(h==="contact"){ var c = document.getElementById("contact"); if(c) setTimeout(function(){ c.scrollIntoView(); },0); }
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
    nav.insertAdjacentHTML("beforeend", themeBtn());
  }
  syncThemeBtn();
}

function showScene(id){
  var wasOn = sceneOn;
  app.innerHTML = "";
  app.hidden = true;
  document.getElementById("scene").style.display = "";
  document.body.classList.add("in-scene");
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
