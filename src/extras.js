/* ===================== Extras: door back link, side nav, ⌘K search, accessibility page ===================== */

/* a tiny door, ajar, for every "back to the hall" link */
var DOOR_ICON = "<svg class='dr' viewBox='0 0 14 18' width='14' height='18' aria-hidden='true' focusable='false'>"+
  "<path d='M1.5 17V1.5h11V17' fill='none' stroke='currentColor' stroke-width='1.4'/>"+
  "<path d='M1.5 1.5l6 1.6V17.6L1.5 17z' fill='currentColor'/></svg>";
function doorBack(){
  var b = app.querySelector(".snav .back");
  if(!b || b.querySelector(".dr")) return;
  b.innerHTML = DOOR_ICON + "<span>" + esc(b.textContent.replace(/^\s*←\s*/, "")) + "</span>";
}

/* ---------- sticky side navigation on story pages ---------- */
var tocObs = null;
function slug(s){ return String(s).toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function buildToc(){
  if(tocObs){ tocObs.disconnect(); tocObs = null; }
  var old = document.getElementById("toc"); if(old) old.remove();
  var st = app.querySelector(".story[data-id]"); if(!st) return;
  var secs = [];
  var top = st.querySelector(".top2") || st.querySelector(".head");
  if(top){ top.id = top.id || "sec-overview"; secs.push({el:top, label:"Overview"}); }
  Array.prototype.forEach.call(st.querySelectorAll("section.blk"), function(s){
    var h = s.querySelector("h2"), label = h ? h.textContent.trim() : (s.id==="try" ? "Try it" : "");
    if(!label) return;
    if(!s.id) s.id = "sec-" + slug(label);                        // ids on every section, so search can jump to them
    if(!s.offsetParent) return;                                   // hidden by Short/Full: not in the nav
    secs.push({el:s, label:label});
  });
  if(secs.length < 3) return;
  var nav = document.createElement("nav");
  nav.id = "toc"; nav.className = "toc"; nav.setAttribute("aria-label", "On this page");
  nav.innerHTML = "<ol>" + secs.map(function(s){ return "<li><a href='#"+s.el.id+"' data-sec='"+s.el.id+"'>"+esc(s.label)+"</a></li>"; }).join("") + "</ol>";
  app.appendChild(nav);
  nav.addEventListener("click", function(e){
    var a = e.target.closest("a[data-sec]"); if(!a) return;
    e.preventDefault();                                           // the hash is the router's: scroll instead
    var el = document.getElementById(a.getAttribute("data-sec")); if(!el) return;
    el.scrollIntoView({behavior: REDUCE ? "auto" : "smooth", block: "start"});
    var h = el.querySelector("h1,h2"); if(h){ h.setAttribute("tabindex", "-1"); h.focus({preventScroll:true}); }
  });
  var links = nav.querySelectorAll("a");
  function mark(){
    var y = window.innerHeight * 0.35, cur = secs[0];
    secs.forEach(function(s){ if(s.el.getBoundingClientRect().top < y) cur = s; });
    links.forEach(function(a){ var on = a.getAttribute("data-sec")===cur.el.id; a.classList.toggle("on", on); if(on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
    // show once the header has scrolled away, so it never sits on top of the title
    nav.classList.toggle("show", top ? top.getBoundingClientRect().bottom < 80 : true);
  }
  tocObs = { disconnect: function(){ window.removeEventListener("scroll", mark); } };
  window.addEventListener("scroll", mark, {passive:true});
  mark();
}
document.addEventListener("click", function(e){
  if(e.target.closest && e.target.closest("[data-depth]")) setTimeout(buildToc, 60);   // Short/Full changes the sections
});

/* ---------- ⌘K search ---------- */
var kb = null, kbList = [], kbSel = 0, kbBack = null;
function kbIndex(){
  var out = [];
  ITEMS.forEach(function(it){
    var name = it.title.replace(/\s*\[.*\]/, "") || it.title;
    var s = STORIES[it.id];
    var text = [name, it.org, it.role, it.out, it.year, s && s.lede, s && s.fact].join(" ").replace(/<[^>]+>/g, "");
    out.push({t:name, d:(it.org||"").replace(/<[^>]+>/g,"")+" · "+(it.n||""), k:"Project", text:text,
      go:function(){ if(STORIES[it.id]) location.hash = it.id; else if(it.href) window.open(it.href, "_blank", "noopener"); else location.hash = "home-"+it.id; }});
    if(s) (s.blocks||[]).concat(s.full||[]).forEach(function(b){
      if(!b.k) return;
      var body = (b.html||"").replace(/<[^>]+>/g, " ");
      out.push({t:b.k, d:name, k:"Section", text:b.k+" "+name+" "+body,
        go:function(){ pendingJump = "sec-"+slug(b.k); if(location.hash.slice(1)===it.id) route(); else location.hash = it.id; }});
    });
  });
  [["Now", "#now", "What I'm doing this month"], ["How I work", "#now", "Four principles, each tied to a project"], ["About", "#about", "Who I am, where I've worked"], ["Contact", "#contact", "Email and links"], ["Index", "#index", "Every project as a list"],
   ["Accessibility", "#accessibility", "Accessibility statement"], ["Resume", RESUME, "PDF"], ["Art and installations", "https://surajbarthy.com", "surajbarthy.com"]
  ].forEach(function(p){
    out.push({t:p[0], d:p[2], k:"Page", text:p[0]+" "+p[2], go:function(){ if(/^#/.test(p[1])) location.hash = p[1].slice(1); else window.open(p[1], "_blank", "noopener"); }});
  });
  return out;
}
function kbFilter(q){
  var all = kbIndex(); q = q.trim().toLowerCase();
  if(!q) return all.filter(function(r){ return r.k!=="Section"; }).slice(0, 12);
  var words = q.split(/\s+/);
  return all.map(function(r){
    var t = r.t.toLowerCase(), x = r.text.toLowerCase();
    if(!words.every(function(w){ return x.indexOf(w) >= 0; })) return null;
    var sc = (t.indexOf(q)===0 ? 0 : t.indexOf(q) >= 0 ? 1 : 2) + (r.k==="Section" ? 0.5 : 0);
    return {r:r, sc:sc};
  }).filter(Boolean).sort(function(a, b){ return a.sc - b.sc; }).slice(0, 12).map(function(x){ return x.r; });
}
function kbOpen(){
  if(kb) return;
  kbBack = document.activeElement;
  kb = document.createElement("div");
  kb.className = "kbar";
  kb.innerHTML = "<div class='kb-veil'></div><div class='kb-box' role='dialog' aria-modal='true' aria-label='Search the site'>"+
    "<input id='kb-in' type='text' role='combobox' aria-expanded='true' aria-controls='kb-list' aria-autocomplete='list' autocomplete='off' spellcheck='false' placeholder='Search projects, sections, pages' aria-label='Search'>"+
    "<ul id='kb-list' role='listbox' aria-label='Results'></ul>"+
    "<p class='kb-hint' aria-hidden='true'><span>↑ ↓ to move</span><span>Enter to open</span><span>Esc to close</span></p></div>";
  document.body.appendChild(kb);
  var inp = kb.querySelector("#kb-in");
  kbRender("");
  inp.focus();
  inp.addEventListener("input", function(){ kbRender(inp.value); });
  inp.addEventListener("keydown", function(e){
    if(e.key==="ArrowDown"){ e.preventDefault(); kbMove(1); }
    else if(e.key==="ArrowUp"){ e.preventDefault(); kbMove(-1); }
    else if(e.key==="Enter"){ e.preventDefault(); kbGo(kbSel); }
    else if(e.key==="Escape"){ e.preventDefault(); kbClose(true); }
    else if(e.key==="Tab"){ e.preventDefault(); }                 // the dialog holds focus
  });
  kb.querySelector(".kb-veil").addEventListener("click", function(){ kbClose(true); });
  kb.querySelector("#kb-list").addEventListener("click", function(e){ var li = e.target.closest("[data-i]"); if(li) kbGo(+li.getAttribute("data-i")); });
}
function kbRender(q){
  kbList = kbFilter(q); kbSel = 0;
  var ul = kb.querySelector("#kb-list");
  ul.innerHTML = kbList.length ? kbList.map(function(r, i){
    return "<li role='option' id='kb-o"+i+"' data-i='"+i+"'"+(i===0?" aria-selected='true'":" aria-selected='false'")+"><span class='kb-t'>"+esc(r.t)+"</span><span class='kb-d'>"+esc(r.k)+" · "+esc(r.d)+"</span></li>";
  }).join("") : "<li class='kb-none' role='option' aria-disabled='true'>Nothing matches. Try a company, a project or a word like onboarding.</li>";
  kb.querySelector("#kb-in").setAttribute("aria-activedescendant", kbList.length ? "kb-o0" : "");
}
function kbMove(d){
  if(!kbList.length) return;
  kbSel = (kbSel + d + kbList.length) % kbList.length;
  Array.prototype.forEach.call(kb.querySelectorAll("[data-i]"), function(li, i){ li.setAttribute("aria-selected", String(i===kbSel)); });
  var el = kb.querySelector("#kb-o"+kbSel); if(el) el.scrollIntoView({block:"nearest"});
  kb.querySelector("#kb-in").setAttribute("aria-activedescendant", "kb-o"+kbSel);
}
function kbGo(i){ var r = kbList[i]; if(!r) return; kbClose(false); r.go(); }
function kbClose(restore){
  if(!kb) return;
  kb.remove(); kb = null;
  if(restore && kbBack && kbBack.focus) kbBack.focus({preventScroll:true});
}
document.addEventListener("keydown", function(e){
  if((e.metaKey || e.ctrlKey) && (e.key==="k" || e.key==="K")){ e.preventDefault(); if(kb) kbClose(true); else kbOpen(); }
}, true);
document.addEventListener("click", function(e){ if(e.target.closest && e.target.closest(".kb-btn")){ e.preventDefault(); kbOpen(); } });
var KB_BTN = "<button type='button' class='kb-btn' aria-label='Search (Command K)'><svg viewBox='0 0 20 20' width='18' height='18' aria-hidden='true'><circle cx='8.5' cy='8.5' r='5.5' fill='none' stroke='currentColor' stroke-width='1.6'/><path d='M12.6 12.6L17 17' stroke='currentColor' stroke-width='1.6' stroke-linecap='round'/></svg><kbd>⌘K</kbd></button>";

/* ---------- accessibility statement ---------- */
function a11yPage(){
  var sec = function(k, html){ return "<section class='blk'><h2 class='ser'>"+k+"</h2><div class='body'>"+html+"</div></section>"; };
  return "<div class='wrap story' id='page'>"+
    "<div class='snav'><button class='back' type='button' id='back'>← Back to the hall</button><nav><a href='#now'>Now</a><a href='"+RESUME+"' data-resume>Resume</a><a href='#contact'>Contact</a></nav></div>"+
    "<header class='head'><h1>Accessibility</h1><p class='lede'>I want everyone to be able to read this work, whatever they use to browse. This site aims to meet WCAG 2.1 level AA.</p></header>"+
    sec("What I've done",
      "<ul>"+
      "<li>All text is at least 16px, and text and controls meet AA contrast in light and dark modes.</li>"+
      "<li>Everything works from the keyboard: the arrow keys move between projects, Enter opens the one in front of you, Tab reaches every link, and ⌘K or Ctrl+K opens search.</li>"+
      "<li>The <a href='#index'>Index</a> lists every project as a plain table. It holds the same content as the hall, with no motion and no 3D.</li>"+
      "<li>With reduced motion turned on in your system settings, the runner stops, the camera jumps instead of gliding, and the page transitions turn off.</li>"+
      "<li>Pages use landmarks and headings in order, a skip link, visible focus, and alt text on images that carry meaning. Decorative drawings are hidden from screen readers.</li>"+
      "</ul>")+
    sec("Known limits",
      "<ul>"+
      "<li>The hall itself is a visual layer. Screen readers get the project labels and links, not the scene. The Index is the full alternative.</li>"+
      "<li>Some images are still placeholders and don't have their final alt text yet.</li>"+
      "<li>The NDA lock is a simple password form. If it gets in your way, <a href='#contact'>ask me</a> and I'll send the story another way.</li>"+
      "<li><span class='tbd'>[Tested with: VoiceOver on macOS and iOS, NVDA on Windows, 200% zoom. Add dates once tested.]</span></li>"+
      "</ul>")+
    sec("Tell me",
      "<p>If something on this site doesn't work for you, <a href='#contact'>please tell me</a>. I'll fix it or send you the content in a format that works, usually within <span class='tbd'>[a few days]</span>.</p>")+
    "<p class='dim' style='margin-top:48px'>Last reviewed November 2026.</p>"+
    footer()+"</div>";
}
