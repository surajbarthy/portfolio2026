"""Assemble the runner-and-doors site. Content, story pages, Short/Full, the NDA lock and the
Jones try-it are taken verbatim from V0 so nothing drifts between directions."""
import re, pathlib, os
here = pathlib.Path(__file__).parent
# V0 is the content source. In the project folder it is read live; in the repo a snapshot ships as src/v0.html.
_live = here.parent.parent / "portfolio-site-v0" / "index.html"
v0 = (_live if _live.exists() else here / "v0.html").read_text().split("\n")
L = lambda a, b: "\n".join(v0[a-1:b])  # 1-based inclusive

css_v0 = L(40, 45) + "\n" + L(108, 266)
phone = [l for l in v0[267:278] if not re.match(r"\s*\.(home|intro-in|toc|item)\b", l)]
css_v0 += "\n" + "\n".join(phone)

js_content = L(287, 558)          # ITEMS, STORIES, ORDER, JONES, helpers
js_about = L(631, 669)            # about, contact, footer
js_story = L(670, 760)            # heroDevice, calls, block, tryIt, story
js_bind = L(842, 894)             # bindStory, bindCommon, flash, applyNotes
js_try = L(895, 946)              # bindTry

# headings instead of styled paragraphs (WCAG 1.3.1)
js_about = js_about.replace("<p class='ser'>About</p>", "<h2 class='ser'>About</h2>").replace("<p class='ser'>Contact</p>", "<h2 class='ser'>Contact</h2>")
js_story = (js_story.replace("<p class='ser'>\"+b.k+\"</p>", "<h2 class='ser'>\"+b.k+\"</h2>")
            .replace("<p class='ser'>Full story</p>", "<h2 class='ser'>Full story</h2>")
            .replace("<p class='ser' style='font-size:22px;color:var(--ink-2);margin:0 0 6px'>Try it</p>", "<h2 class='ser' style='font-size:22px;color:var(--ink-2);margin:0 0 6px'>Try it</h2>"))
js_bind = js_bind.replace('app.innerHTML = story(lf.getAttribute("data-id")); bindStory(); applyNotes();',
                          'app.innerHTML = story(lf.getAttribute("data-id")); bindStory(); applyNotes(); decorate(); var fs = app.querySelector(".blk.full h2"); if(fs){ fs.setAttribute("tabindex","-1"); fs.focus({preventScroll:true}); }')
# story top: header on the left, the device on the right (desktop); phones keep the device first
js_story = js_story.replace('    heroDevice(s.hero)+\n    "<header class=\'head\'>', '    "<div class=\'top2\'><header class=\'head\'>')
js_story = js_story.replace('(s.noteTop?"<div class=\'note\'>"+s.noteTop+"</div>":"")+"</header>"+', '(s.noteTop?"<div class=\'note\'>"+s.noteTop+"</div>":"")+"</header>"+heroDevice(s.hero)+"</div>"+')
assert "<div class='top2'>" in js_story and 'heroDevice(s.hero)+"</div>"' in js_story
js_bind = js_bind.replace('location.hash = "home-"+s.getAttribute("data-id");', 'goHall(s.getAttribute("data-id"));')
js_bind = js_bind.replace('document.querySelectorAll("#notes-toggle")', 'document.querySelectorAll("#notes-toggle,.nt")')
assert 'goHall(s.getAttribute' in js_bind and '#notes-toggle,.nt' in js_bind
assert "<h2 class='ser'>About</h2>" in js_about and "<h2 class='ser'>\"+b.k" in js_story and "decorate();" in js_bind

for chunk, must in [(js_content, "var ITEMS"), (js_about, "function about"), (js_story, "function story"),
                    (js_bind, "function bindStory"), (js_try, "function bindTry")]:
    assert must in chunk, must

LOOK = os.environ.get("LOOK", "")   # LOOK=concrete builds the concrete test as concrete.html / artifact-concrete.html
# Now leads the navigation; About lives on the same page, below it
js_story = js_story.replace("<a href='#about'>About</a>", "<a href='#now'>Now</a>")
js_about = js_about.replace("<a href='#contact'>Contact</a>", "")   # Contact left the nav (2026-11-21)
js_story = js_story.replace('<a href=\'#now\'>Now</a><a href=\'"+RESUME+"\' data-resume>Resume</a><a href=\'#contact\'>Contact</a>', '<a href=\'"+RESUME+"\' data-resume>Resume</a><a href=\'#now\'>Now</a>"+ED_LINK+"')
css = (here / "scene.css").read_text() + css_v0 + "\n" + (here / "over.css").read_text()
if LOOK: css += "\n" + (here / (LOOK + ".css")).read_text()
import tokens as _tok
css += "\n" + _tok.tokens_css(here / "tokens.json", LOOK)
js = "\n".join([js_content, js_about, js_story, (here / "scene.js").read_text(), (here / "app.js").read_text(), (here / "extras.js").read_text(),
                js_bind, js_try, "buildScene();\nwindow.addEventListener('hashchange',onHash);\nroute();"])

# concrete look: the hall is always dark concrete; pages (stories, Now, Index…) are white. A deep link to a page starts white.
look = ('var r=document.documentElement,h=location.hash.slice(1);if(h&&h.indexOf("home-")!==0){{r.classList.add("pg");r.setAttribute("data-theme","light")}}else{{r.classList.add("' + LOOK + '");r.setAttribute("data-theme","dark")}}') if LOOK else ""
head = f"""<meta charset="utf-8">
<title>Suraj Barthy</title>
<script>try{{var t=localStorage.getItem("sb-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}}catch(e){{}}document.documentElement.lang="en";{look}try{{if(localStorage.getItem("sb-font")==="serif"){{document.documentElement.classList.add("serif");document.write('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap">')}}}}catch(e){{}}</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600&display=swap">
<style>
{css}
</style>"""
body = f"""<div id="scene"></div>
<main id="app"></main>
<div id="curtain" aria-hidden="true"></div>
<script>
(function(){{
"use strict";
document.body.classList.add("in-scene");
{js}
}})();
</script>
"""
# artifact.html: a fragment for the claude.ai artifact (it adds its own document skeleton)
# index.html: a complete document for any static host (GitHub Pages, Vercel, Netlify)
sfx = ("-" + LOOK) if LOOK else ""
(here.parent / ("artifact" + sfx + ".html")).write_text(head + "\n" + body)
full = "<!doctype html>\n<html lang=\"en\">\n<head>\n" + head + "\n</head>\n<body>\n" + body + "</body>\n</html>\n"
(here.parent / ((LOOK + ".html") if LOOK else "index.html")).write_text(full)
print(len(full))
