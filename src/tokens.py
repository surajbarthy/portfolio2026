"""tokens.json -> CSS for the site.

tokens.json is the design system's file (Suraj Barthy design system artifact). To change a colour,
type style, radius or shadow site-wide, edit it there, copy its tokens.json here, and rebuild:
build.py appends this CSS last, so it wins over the older values still written in scene.css,
over.css and concrete.css.
"""
import json, pathlib

# where each type style lives on the site: (selectors, media query or None)
TYPE_MAP = {
  "title-xl": [(".head h1", None)],
  "title-l":  [(".lab h2,.it.k-line .lab h2,.stats b", None)],
  "title-m":  [(".intro .state,.endw .state,.sec>h2.ser,.blk>h2.ser,.quote,.try-copy h3", None), (".cap h2", "(min-height:621px)"), (".stats b", "(max-width:640px)")],
  "text-l":   [(".lede,.fact,.big", None)],
  "text-m":   [(".body p,.lab p,.lab .acts,.intro .side,.blk .body ul,.try-copy p,.kb-t", None), (".calls .why p", "important")],
  "text-s":   [("body", None)],
}
# the site's CSS still uses its older colour names; point each at its Apple-named token
ALIASES = {
  "paper": "background", "wall": "hall-wall", "floor": "hall-floor",
  "ink": "label", "ink-2": "secondary-label", "ink-3": "secondary-label", "ink-far": "tertiary-label",
  "rule": "separator", "well": "fill",
  "leaf": "door-leaf", "reveal": "door-edge", "lamp": "room-light", "lamp-core": "room-light-core",
  "device": "device-bezel", "screen": "device-screen",
  "tbd-bg": "placeholder-bg", "tbd-ink": "placeholder-ink",
}
RADIUS_MAP = {
  "radius-pill":  ".switch,.switch button,.kb-btn",
  "radius-panel": ".kb-box",
  "radius-tile":  "#scene .map .lg",
  "radius-tag":   ".tbd",
}
THEME_SEL = {
  "light":    [":root:not([data-theme=\"dark\"])"],
  "dark":     [":root[data-theme=\"dark\"]", "@media (prefers-color-scheme:dark){:root:not([data-theme=\"light\"]):not([data-theme=\"dark\"])"],
  "concrete": ["html.concrete:root"],
  "sky":      ["html.concrete.sky:root"],
}

def _val(t, theme, first):
  v = t["value"]
  return v if isinstance(v, str) else v.get(theme, v.get(first))

def tokens_css(path, look=None):
  T = json.loads(pathlib.Path(path).read_text())
  out = ["/* ---- Design tokens, generated from src/tokens.json (the design system). Edit there, not here. ---- */"]
  themes = [th["id"] for th in T["color"]["themes"]]
  first = themes[0]
  names = {t["name"] for t in T["color"]["tokens"]}
  def resolve(s):
    return "var(--" + s[1:-1] + ")" if isinstance(s, str) and s.startswith("{") and s[1:-1] in names else s
  for th in themes:
    if th in ("concrete", "sky") and not look: continue
    decl = ";".join("--%s:%s" % (t["name"], resolve(_val(t, th, first))) for t in T["color"]["tokens"])
    decl += ";--dot:transparent;" + ";".join("--%s:var(--%s)" % (o, n) for o, n in ALIASES.items() if n in names)
    for sel in THEME_SEL.get(th, []):
      if sel.startswith("@media"): out.append(sel + "{" + decl + "}}")
      else: out.append(sel + "{" + decl + "}")
  fam = T["type"].get("families", {})
  if "sans" in fam: out.append(":root{--sans:%s}" % fam["sans"])
  for g in T["type"].get("groups", []):
    for s in g.get("styles", []):
      if s["name"] not in TYPE_MAP: continue
      for sel, media in TYPE_MAP[s["name"]]:
        fs = s["fontSize"]
        if sel == ".head h1": fs = "clamp(40px,5vw,%s)" % fs
        d = ["font-size:" + fs]
        if "lineHeight" in s: d.append("line-height:%s" % s["lineHeight"])
        if s["name"] != "text-s":
          if "fontWeight" in s: d.append("font-weight:%s" % s["fontWeight"])
          if "letterSpacing" in s: d.append("letter-spacing:%s" % s["letterSpacing"])
        if media == "important": d = [x + "!important" for x in d]; media = None
        rule = sel + "{" + ";".join(d) + "}"
        out.append("@media %s{%s}" % (media, rule) if media else rule)
  for t in T.get("radius", {}).get("tokens", []):
    out.append(":root{--%s:%s}" % (t["name"], t["value"]))
    if t["name"] in RADIUS_MAP: out.append("%s{border-radius:var(--%s)}" % (RADIUS_MAP[t["name"]], t["name"]))
  for t in T.get("shadow", {}).get("tokens", []):
    out.append(":root{--%s:%s}" % (t["name"], t["value"]))
  out.append(".kb-box{box-shadow:var(--shadow-panel),0 0 0 1px var(--rule)}")
  return "\n".join(out) + "\n"
