"""tokens.json -> CSS for the site.

tokens.json is the design system's file (Suraj Barthy design system artifact). To change a colour,
type style, radius or shadow site-wide, edit it there, copy its tokens.json here, and rebuild:
build.py appends this CSS last, so it wins over the older values still written in scene.css,
over.css and concrete.css.
"""
import json, pathlib

# where each type style lives on the site
TYPE_MAP = {
  "story-title":      (".head h1", None),
  "wall-title":       (".lab h2", None),
  "statement":        (".intro .state,.endw .state", "(min-width:641px)"),   # phones keep 29px
  "wall-title-small": (".it.k-line .lab h2", None),
  "caption-title":    (".cap h2", "(min-height:621px)"),                   # short screens keep 22px
  "section-title":    (".sec>h2.ser,.blk>h2.ser", None),
  "lede":             (".lede", None),
  "fact":             (".fact", None),
  "body":             (".body p", None),
  "label":            (".lab p,.lab .acts", None),
  "ui":               ("body", None),
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
    for sel in THEME_SEL.get(th, []):
      if sel.startswith("@media"): out.append(sel + "{" + decl + "}}")
      else: out.append(sel + "{" + decl + "}")
  fam = T["type"].get("families", {})
  if "sans" in fam: out.append(":root{--sans:%s}" % fam["sans"])
  for g in T["type"].get("groups", []):
    for s in g.get("styles", []):
      if s["name"] not in TYPE_MAP: continue
      sel, media = TYPE_MAP[s["name"]]
      fs = s["fontSize"]
      if s["name"] == "story-title": fs = "clamp(40px,5vw,%s)" % fs
      d = ["font-size:" + fs]
      if "lineHeight" in s: d.append("line-height:%s" % s["lineHeight"])
      if s["name"] != "ui":
        if "fontWeight" in s: d.append("font-weight:%s" % s["fontWeight"])
        if "letterSpacing" in s: d.append("letter-spacing:%s" % s["letterSpacing"])
      rule = sel + "{" + ";".join(d) + "}"
      out.append("@media %s{%s}" % (media, rule) if media else rule)
  for t in T.get("radius", {}).get("tokens", []):
    out.append(":root{--%s:%s}" % (t["name"], t["value"]))
    if t["name"] in RADIUS_MAP: out.append("%s{border-radius:var(--%s)}" % (RADIUS_MAP[t["name"]], t["name"]))
  for t in T.get("shadow", {}).get("tokens", []):
    out.append(":root{--%s:%s}" % (t["name"], t["value"]))
  out.append(".kb-box{box-shadow:var(--shadow-panel),0 0 0 1px var(--rule)}")
  return "\n".join(out) + "\n"
