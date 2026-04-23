/* uipro Composer — combine 5 picks into a rendered UI preview */
(() => {
  const DATA = window.UIPRO_DATA;
  const SECTIONS = ["products", "styles", "colors", "landing", "typography"];
  const LABELS = {
    products: "Product Type",
    styles: "UI Style",
    colors: "Color Palette",
    landing: "LP Pattern",
    typography: "Typography",
  };

  const state = SECTIONS.reduce((acc, k) => ((acc[k] = null), acc), {});
  let currentPickerSection = null;
  let activeResultIdx = 0;
  let filteredResults = [];

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  // ---------- helpers ----------
  const esc = (s) => (s ?? "").toString()
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");

  function hexesFrom(str) {
    if (!str) return [];
    const out = [];
    const re = /#([0-9a-f]{3}|[0-9a-f]{6})\b/gi;
    let m;
    while ((m = re.exec(str))) out.push("#" + m[1]);
    return [...new Set(out)];
  }

  function contrastText(hex) {
    if (!hex) return "#fff";
    const h = hex.replace("#","");
    const f = h.length === 3 ? h.split("").map(c=>c+c).join("") : h;
    const r = parseInt(f.slice(0,2),16), g = parseInt(f.slice(2,4),16), b = parseInt(f.slice(4,6),16);
    return (0.299*r + 0.587*g + 0.114*b)/255 > 0.6 ? "#1e1c17" : "#f5f2ec";
  }

  // ---------- Calmify transforms ----------
  // Pull a hex toward a calmer register: reduce saturation, nudge hue toward warm,
  // pin lightness within a narrow, contemplative band.
  function hexToRgb(hex) {
    let h = (hex || "").replace("#","");
    if (h.length === 3) h = h.split("").map(c=>c+c).join("");
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }
  function rgbToHex(r,g,b){
    const c = (n)=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,"0");
    return "#"+c(r)+c(g)+c(b);
  }
  function rgbToHsl(r,g,b){
    r/=255; g/=255; b/=255;
    const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
    let h, s, l=(mx+mn)/2;
    if(mx===mn){ h=s=0; }
    else {
      const d=mx-mn;
      s = l>0.5 ? d/(2-mx-mn) : d/(mx+mn);
      switch(mx){
        case r: h=(g-b)/d+(g<b?6:0); break;
        case g: h=(b-r)/d+2; break;
        default: h=(r-g)/d+4;
      }
      h*=60;
    }
    return [h,s,l];
  }
  function hslToRgb(h,s,l){
    h = ((h%360)+360)%360;
    const c=(1-Math.abs(2*l-1))*s;
    const x=c*(1-Math.abs(((h/60)%2)-1));
    const m=l-c/2;
    let r,g,b;
    if(h<60){[r,g,b]=[c,x,0];}
    else if(h<120){[r,g,b]=[x,c,0];}
    else if(h<180){[r,g,b]=[0,c,x];}
    else if(h<240){[r,g,b]=[0,x,c];}
    else if(h<300){[r,g,b]=[x,0,c];}
    else {[r,g,b]=[c,0,x];}
    return [(r+m)*255, (g+m)*255, (b+m)*255];
  }
  // Calmify: desaturate, pull toward warm hue, compress lightness band.
  function calmify(hex, opts = {}) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const [h,s,l] = rgbToHsl(...rgb);
    const satCap   = opts.satCap   ?? 0.28;   // hard ceiling on saturation
    const warmBias = opts.warmBias ?? 0.35;   // 0..1 lerp toward 35° (warm amber)
    const lMin     = opts.lMin     ?? 0.14;
    const lMax     = opts.lMax     ?? 0.82;
    const s2 = Math.min(s, satCap);
    // Hue lerp toward 35° along the short path
    let dh = 35 - h;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    const h2 = h + dh * warmBias;
    const l2 = Math.max(lMin, Math.min(lMax, l));
    const [r2,g2,b2] = hslToRgb(h2, s2, l2);
    return rgbToHex(r2,g2,b2);
  }

  function gfShareToCss(url) {
    if (!url) return null;
    try {
      const u = new URL(url);
      const fam = u.searchParams.get("selection.family");
      if (!fam) return null;
      const fonts = fam.split("|");
      const params = fonts.map(f => "family=" + encodeURIComponent(f)
        .replace(/%20/g,"+").replace(/%2C/g,",")
        .replace(/%3A/g,":").replace(/%3B/g,";").replace(/%40/g,"@"));
      return "https://fonts.googleapis.com/css2?" + params.join("&") + "&display=swap";
    } catch { return null; }
  }

  function titleOf(section, row) {
    if (!row) return "—";
    return row["Product Type"] || row["Style Category"] || row["Pattern Name"] || row["Font Pairing Name"] || "—";
  }

  function subtitleOf(section, row) {
    if (!row) return "";
    switch (section) {
      case "products":   return row["Primary Style Recommendation"] || "";
      case "styles":     return (row["Era/Origin"] || "") + " · " + (row["Type"] || "");
      case "colors":     return row["Notes"] || "";
      case "landing":    return (row["Primary CTA Placement"] || "").slice(0, 80);
      case "typography": return row["Heading Font"] + " + " + row["Body Font"];
    }
    return "";
  }

  // ---------- style profile inference ----------
  // Map style category name → rendering profile (radius / shadow / transition / glass)
  function styleProfile(styleRow) {
    const name = (styleRow?.["Style Category"] || "").toLowerCase();
    const kw = (styleRow?.["Keywords"] || "").toLowerCase();
    const combo = name + " " + kw;

    const has = (...words) => words.some(w => combo.includes(w));

    // defaults
    const p = {
      radius: "8px",
      radiusSoft: "14px",
      shadowSm: "0 1px 2px rgba(0,0,0,0.05)",
      shadowMd: "0 4px 8px rgba(0,0,0,0.08)",
      shadowLg: "0 20px 40px rgba(0,0,0,0.12)",
      transition: "all 220ms ease",
      letterSpacing: "-0.01em",
      fontWeightHead: "700",
      border: "1px solid",
      glass: false,
      noise: false,
      gradient: false,
      raw: false,
      uppercase: false,
    };

    if (has("brutalism", "brutalist", "raw", "anti-design")) {
      p.radius = "0"; p.radiusSoft = "0";
      p.shadowSm = "none"; p.shadowMd = "6px 6px 0 rgba(0,0,0,1)"; p.shadowLg = "10px 10px 0 rgba(0,0,0,1)";
      p.transition = "none";
      p.fontWeightHead = "900";
      p.letterSpacing = "-0.04em";
      p.border = "3px solid";
      p.raw = true;
      p.uppercase = true;
    } else if (has("minimal", "swiss")) {
      p.radius = "0"; p.radiusSoft = "2px";
      p.shadowSm = "none"; p.shadowMd = "none"; p.shadowLg = "0 1px 0 rgba(0,0,0,0.06)";
      p.fontWeightHead = "500";
      p.letterSpacing = "-0.015em";
      p.border = "1px solid";
    } else if (has("neumorph")) {
      p.radius = "14px"; p.radiusSoft = "18px";
      p.shadowSm = "inset 2px 2px 4px rgba(0,0,0,0.06), inset -2px -2px 4px rgba(255,255,255,0.9)";
      p.shadowMd = "-6px -6px 14px rgba(255,255,255,0.9), 6px 6px 14px rgba(0,0,0,0.08)";
      p.shadowLg = "-10px -10px 24px rgba(255,255,255,0.9), 10px 10px 24px rgba(0,0,0,0.1)";
      p.border = "0 solid transparent";
      p.transition = "all 180ms ease";
    } else if (has("glassmorph", "glass", "liquid")) {
      p.radius = "14px"; p.radiusSoft = "22px";
      p.shadowSm = "0 4px 20px rgba(0,0,0,0.08)";
      p.shadowMd = "0 12px 32px rgba(0,0,0,0.12)";
      p.shadowLg = "0 30px 60px rgba(0,0,0,0.18)";
      p.glass = true;
      p.gradient = true;
    } else if (has("aurora", "gradient mesh", "blob")) {
      p.radius = "18px";
      p.shadowLg = "0 30px 70px rgba(0,0,0,0.15)";
      p.gradient = true;
      p.fontWeightHead = "700";
    } else if (has("retro", "80s", "vapor", "synthwave", "y2k")) {
      p.radius = "2px";
      p.shadowMd = "4px 4px 0 currentColor";
      p.border = "2px solid";
      p.uppercase = true;
    } else if (has("editorial", "magazine", "newspaper")) {
      p.radius = "0";
      p.shadowMd = "none"; p.shadowLg = "none";
      p.fontWeightHead = "700";
      p.letterSpacing = "-0.03em";
      p.border = "1px solid";
    } else if (has("3d", "hyperreal", "skeuomorph")) {
      p.radius = "18px";
      p.shadowMd = "0 8px 20px rgba(0,0,0,0.18)";
      p.shadowLg = "0 40px 80px rgba(0,0,0,0.3)";
      p.gradient = true;
    } else if (has("playful", "cute", "organic", "soft", "rounded")) {
      p.radius = "20px"; p.radiusSoft = "28px";
      p.shadowMd = "0 6px 18px rgba(0,0,0,0.1)";
    } else if (has("flat", "material")) {
      p.radius = "6px";
      p.shadowMd = "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)";
    } else if (has("motion", "micro-interaction", "animated")) {
      p.radius = "10px";
      p.transition = "all 260ms cubic-bezier(.2,.8,.2,1)";
    } else if (has("dark", "cyber", "neon")) {
      p.radius = "4px";
      p.shadowMd = "0 0 0 1px rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.5)";
      p.gradient = true;
    } else if (has("vibrant", "block", "bold")) {
      p.radius = "4px";
      p.shadowMd = "8px 8px 0 rgba(0,0,0,0.12)";
      p.fontWeightHead = "800";
      p.uppercase = true;
    }

    return p;
  }

  // ---------- LP section parser ----------
  const SECTION_VOCAB = {
    hero:     ["hero", "headline", "header", "intro", "landing"],
    features: ["feature", "benefits", "value prop", "services", "capabilities"],
    testimonials: ["testimonial", "social proof", "review", "quotes"],
    pricing:  ["pricing", "plans", "tiers", "cost"],
    faq:      ["faq", "questions"],
    demo:     ["demo", "video", "mockup", "preview"],
    team:     ["team", "about us", "founders"],
    stats:    ["stats", "metrics", "numbers"],
    gallery:  ["gallery", "showcase", "portfolio", "grid"],
    form:     ["form", "sign up", "signup", "contact", "lead magnet", "newsletter", "subscribe", "email capture"],
    comparison: ["comparison", "versus", "vs"],
    cta:      ["cta", "call-to-action", "submit", "get started", "sign up now"],
    footer:   ["footer"],
  };
  function classifySection(label) {
    const low = (label || "").toLowerCase();
    for (const [key, words] of Object.entries(SECTION_VOCAB)) {
      if (words.some(w => low.includes(w))) return key;
    }
    return "generic";
  }
  function parseSectionOrder(str) {
    if (!str) return ["hero","features","cta","footer"];
    // Split on ", 1." pattern  then also support "1. X, 2. Y"
    const parts = str.split(/,\s*(?=\d+\.)/);
    const labels = parts.map(p => p.replace(/^\d+\.\s*/, "").trim()).filter(Boolean);
    return labels.map(classifySection);
  }

  // ---------- Copy generator ----------
  function pickHeadline(productRow) {
    const t = (productRow?.["Product Type"] || "Your Product");
    const lt = t.toLowerCase();
    const templates = [
      `${t}, quietly reconsidered.`,
      `A calmer way to ${lt}.`,
      `${t} — with room to breathe.`,
      `The thoughtful ${lt}.`,
      `${t}, carefully made.`,
      `A gentler ${lt}.`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }
  function pickSubhead(productRow) {
    const kws = (productRow?.["Keywords"] || "").split(",").map(s => s.trim()).filter(Boolean);
    const pick = kws.slice(0, 3).join(" · ");
    return pick ? `Built for people who value ${pick}.` : "Built for people who value the details.";
  }

  // ---------- Preview HTML builder ----------
  function buildPreview() {
    const P = state.products, S = state.styles, C = state.colors, L = state.landing, T = state.typography;
    if (!P || !S || !C || !L || !T) return placeholderDoc("Pick all 5 items and hit Render.");

    // Raw CSV palette
    const rawPrimary   = C["Primary (Hex)"] || "#2b2620";
    const rawSecondary = C["Secondary (Hex)"] || rawPrimary;
    const rawCta       = C["CTA (Hex)"] || rawPrimary;
    const rawBg        = C["Background (Hex)"] || "#f5f2ec";
    const rawText      = C["Text (Hex)"] || "#1e1c17";
    const rawBorder    = C["Border (Hex)"] || "#e3ddcf";

    // Calm pass — desaturate, shift toward warm, clamp lightness so the whole
    // preview lives in the same contemplative register as the app chrome.
    const primary   = calmify(rawPrimary,   { satCap: 0.24, warmBias: 0.35, lMin: 0.22, lMax: 0.48 });
    const secondary = calmify(rawSecondary, { satCap: 0.22, warmBias: 0.35, lMin: 0.28, lMax: 0.62 });
    const cta       = calmify(rawCta,       { satCap: 0.32, warmBias: 0.28, lMin: 0.34, lMax: 0.58 });
    const bg        = calmify(rawBg,        { satCap: 0.08, warmBias: 0.55, lMin: 0.92, lMax: 0.97 });
    const textc     = calmify(rawText,      { satCap: 0.10, warmBias: 0.35, lMin: 0.12, lMax: 0.22 });
    const borderc   = calmify(rawBorder,    { satCap: 0.06, warmBias: 0.45, lMin: 0.82, lMax: 0.92 });
    const muted     = blend(textc, bg, 0.48);

    const prof = styleProfile(S);
    // Cap heading weight so previews stay calm regardless of style pick.
    const capWeight = (w) => {
      const n = typeof w === "number" ? w : parseInt(w, 10) || 500;
      return Math.min(n, 560);
    };
    prof.fontWeightHead = capWeight(prof.fontWeightHead);
    // Dampen shadows — previews should whisper, not shout.
    if (/rgba?\([^)]*\b(0\.[3-9]|1)\b/i.test(prof.shadowLg)) {
      prof.shadowLg = "0 20px 50px rgba(30,28,23,0.12)";
    }
    // Never force ALL-CAPS at preview scale — too loud.
    prof.uppercase = false;
    prof.letterSpacing = prof.letterSpacing === "-0.04em" ? "-0.02em" : prof.letterSpacing;

    const heading = T["Heading Font"] || "Fraunces";
    const body    = T["Body Font"]    || "Inter";
    const fontUrl = gfShareToCss(T["Google Fonts URL"]);

    const sections = parseSectionOrder(L["Section Order"]);
    // trim to reasonable length
    const order = sections.slice(0, 8);

    const ctaFg = contrastText(cta);
    const primaryFg = contrastText(primary);

    // sanitize / reuse
    const headline = pickHeadline(P);
    const subhead = pickSubhead(P);

    const isRaw = prof.raw;
    const isGlass = prof.glass;

    const bgFinal = prof.gradient
      ? `radial-gradient(1200px 600px at 10% -10%, ${primary}14, transparent 60%), radial-gradient(900px 500px at 110% 20%, ${cta}18, transparent 60%), ${bg}`
      : bg;

    const css = `
      ${fontUrl ? `@import url('${fontUrl}');` : ""}
      :root {
        --primary: ${primary};
        --primary-fg: ${primaryFg};
        --secondary: ${secondary};
        --cta: ${cta};
        --cta-fg: ${ctaFg};
        --bg: ${bg};
        --text: ${textc};
        --muted: ${muted};
        --border: ${borderc};
        --radius: ${prof.radius};
        --radius-lg: ${prof.radiusSoft};
        --shadow-sm: ${prof.shadowSm};
        --shadow-md: ${prof.shadowMd};
        --shadow-lg: ${prof.shadowLg};
        --transition: ${prof.transition};
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: var(--bg); }
      body {
        font-family: "${body}", Georgia, serif;
        color: var(--text);
        background: ${bgFinal};
        line-height: 1.6;
        font-size: 16px;
        min-height: 100vh;
      }
      h1, h2, h3, h4 {
        font-family: "${heading}", Georgia, serif;
        font-weight: ${prof.fontWeightHead};
        letter-spacing: ${prof.letterSpacing};
        margin: 0;
        line-height: 1.08;
        ${prof.uppercase ? "text-transform: uppercase;" : ""}
      }
      a { color: var(--primary); }
      .container { max-width: 1180px; margin: 0 auto; padding: 0 28px; }

      /* Nav */
      nav.topnav {
        display: flex; align-items: center; justify-content: space-between;
        padding: 18px 28px;
        border-bottom: ${prof.border} var(--border);
        background: ${isGlass ? "rgba(255,255,255,0.35)" : "transparent"};
        ${isGlass ? "backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);" : ""}
        position: sticky; top: 0; z-index: 10;
      }
      nav.topnav .logo {
        font-family: "${heading}", serif; font-weight: ${prof.fontWeightHead};
        letter-spacing: 0.12em; text-transform: uppercase;
        font-size: 0.9rem;
      }
      nav.topnav .logo span { color: var(--cta); }
      nav.topnav ul { list-style: none; display: flex; gap: 24px; padding: 0; margin: 0; }
      nav.topnav ul a { color: var(--text); text-decoration: none; font-size: 0.88rem; opacity: 0.8; }
      nav.topnav .cta-btn { margin-left: 20px; }

      /* Buttons */
      .btn {
        display: inline-flex; align-items: center; gap: 10px;
        padding: 14px 26px;
        background: var(--cta);
        color: var(--cta-fg);
        border: ${prof.border} var(--cta);
        border-radius: var(--radius);
        font-family: "${heading}", serif;
        font-weight: 600;
        font-size: 0.92rem;
        ${prof.uppercase ? "letter-spacing: 0.18em; text-transform: uppercase;" : "letter-spacing: 0.02em;"}
        cursor: pointer;
        box-shadow: var(--shadow-sm);
        transition: var(--transition);
        text-decoration: none;
      }
      .btn:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
      .btn.outline {
        background: transparent;
        color: var(--text);
        border: ${prof.border} var(--text);
      }

      /* Hero */
      section.hero {
        padding: clamp(60px, 9vw, 130px) 0 clamp(50px, 7vw, 100px);
      }
      section.hero .kicker {
        display: inline-block;
        font-family: "${heading}", serif;
        font-size: 0.74rem; letter-spacing: 0.24em; text-transform: uppercase;
        color: var(--primary);
        padding: 6px 14px;
        border: ${prof.border} var(--primary);
        border-radius: 999px;
        margin-bottom: 24px;
      }
      section.hero h1 {
        font-size: clamp(2.4rem, 6vw, 4.8rem);
        max-width: 18ch;
        margin-bottom: 18px;
        color: var(--text);
      }
      section.hero p.lede {
        font-size: 1.2rem;
        max-width: 54ch;
        color: var(--muted);
        margin: 0 0 32px;
      }
      section.hero .cta-row { display: flex; gap: 14px; flex-wrap: wrap; }
      section.hero .mock {
        margin-top: 60px;
        aspect-ratio: 16/9;
        background: ${isGlass ? "rgba(255,255,255,0.35)" : "var(--primary)"};
        color: ${isGlass ? "var(--text)" : "var(--primary-fg)"};
        ${isGlass ? "backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); border: 1px solid rgba(255,255,255,0.4);" : ""}
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        padding: 28px;
        display: flex; align-items: flex-end;
        font-family: "${heading}", serif; font-size: 0.82rem; letter-spacing: 0.12em; text-transform: uppercase;
        opacity: 0.92;
      }

      /* Features */
      section.features { padding: 70px 0; border-top: ${prof.border} var(--border); }
      section.features h2 { font-size: clamp(1.8rem, 3.5vw, 2.6rem); margin-bottom: 40px; max-width: 20ch; }
      section.features .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
      section.features .feat {
        background: ${isGlass ? "rgba(255,255,255,0.35)" : "var(--bg)"};
        ${isGlass ? "backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);" : ""}
        border: ${prof.border} var(--border);
        border-radius: var(--radius);
        padding: 26px;
        box-shadow: var(--shadow-sm);
        transition: var(--transition);
      }
      section.features .feat:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
      section.features .feat .ico {
        width: 38px; height: 38px;
        border-radius: ${prof.radius};
        background: var(--primary); color: var(--primary-fg);
        display: flex; align-items: center; justify-content: center;
        font-weight: 800; font-family: "${heading}", serif;
        margin-bottom: 16px;
      }
      section.features .feat h3 { font-size: 1.1rem; margin-bottom: 8px; }
      section.features .feat p { color: var(--muted); font-size: 0.94rem; margin: 0; }

      /* Testimonials */
      section.testimonials { padding: 70px 0; background: ${isGlass ? "transparent" : blend(primary, bg, 0.95)}; border-top: ${prof.border} var(--border); }
      section.testimonials h2 { font-size: clamp(1.8rem, 3vw, 2.4rem); margin-bottom: 36px; }
      section.testimonials .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 22px; }
      section.testimonials blockquote {
        margin: 0;
        padding: 26px;
        background: var(--bg);
        border-left: 3px solid var(--cta);
        border-radius: var(--radius);
        box-shadow: var(--shadow-sm);
      }
      section.testimonials blockquote p { font-size: 1.02rem; margin: 0 0 16px; }
      section.testimonials blockquote cite { font-style: normal; font-size: 0.85rem; color: var(--muted); display: flex; align-items: center; gap: 10px; }
      section.testimonials blockquote cite .avatar {
        width: 28px; height: 28px; border-radius: 50%;
        background: var(--secondary);
        display: inline-flex; align-items: center; justify-content: center;
        color: ${contrastText(secondary)}; font-weight: 700; font-size: 0.75rem;
        font-family: "${heading}", serif;
      }

      /* Pricing */
      section.pricing { padding: 70px 0; border-top: ${prof.border} var(--border); }
      section.pricing h2 { font-size: clamp(1.8rem, 3vw, 2.4rem); margin-bottom: 36px; }
      section.pricing .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
      section.pricing .tier {
        border: ${prof.border} var(--border);
        border-radius: var(--radius-lg);
        padding: 28px;
        background: var(--bg);
        box-shadow: var(--shadow-sm);
      }
      section.pricing .tier.feat { border-color: var(--cta); box-shadow: var(--shadow-md); }
      section.pricing .tier h3 { font-size: 1.1rem; margin-bottom: 8px; }
      section.pricing .tier .price { font-family: "${heading}", serif; font-size: 2.4rem; font-weight: 800; margin: 14px 0; }
      section.pricing .tier .price small { font-size: 0.9rem; color: var(--muted); font-weight: 400; }
      section.pricing .tier ul { list-style: none; padding: 0; margin: 0 0 22px; font-size: 0.92rem; color: var(--muted); }
      section.pricing .tier ul li { padding: 6px 0; border-bottom: 1px dashed var(--border); }

      /* FAQ */
      section.faq { padding: 70px 0; border-top: ${prof.border} var(--border); }
      section.faq h2 { font-size: clamp(1.8rem, 3vw, 2.4rem); margin-bottom: 32px; }
      section.faq details {
        border-bottom: ${prof.border} var(--border);
        padding: 16px 0;
      }
      section.faq details summary {
        font-family: "${heading}", serif;
        font-weight: 600;
        cursor: pointer; list-style: none;
        font-size: 1.02rem;
        display: flex; justify-content: space-between; align-items: center;
      }
      section.faq details summary::-webkit-details-marker { display: none; }
      section.faq details summary::after { content: "+"; color: var(--cta); font-size: 1.3rem; font-weight: 300; }
      section.faq details[open] summary::after { content: "−"; }
      section.faq details p { color: var(--muted); margin: 10px 0 0; font-size: 0.95rem; }

      /* Demo */
      section.demo { padding: 70px 0; border-top: ${prof.border} var(--border); text-align: center; }
      section.demo h2 { font-size: clamp(1.8rem, 3vw, 2.4rem); margin-bottom: 20px; }
      section.demo .screen {
        margin: 30px auto 0;
        max-width: 860px;
        aspect-ratio: 16/10;
        background: var(--primary);
        color: var(--primary-fg);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        display: flex; align-items: center; justify-content: center;
        font-family: "${heading}", serif; letter-spacing: 0.12em; text-transform: uppercase;
        font-size: 0.82rem;
        position: relative;
      }
      section.demo .screen::before {
        content: "▶";
        width: 58px; height: 58px;
        border-radius: 50%;
        background: var(--cta); color: var(--cta-fg);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.2rem;
        box-shadow: var(--shadow-md);
      }

      /* Stats */
      section.stats { padding: 70px 0; border-top: ${prof.border} var(--border); }
      section.stats .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; text-align: left; }
      section.stats .stat .num { font-family: "${heading}", serif; font-size: clamp(2.2rem, 4vw, 3.4rem); font-weight: 800; color: var(--primary); line-height: 1; }
      section.stats .stat .lbl { color: var(--muted); font-size: 0.88rem; margin-top: 8px; }

      /* Gallery */
      section.gallery { padding: 70px 0; border-top: ${prof.border} var(--border); }
      section.gallery h2 { font-size: clamp(1.8rem, 3vw, 2.4rem); margin-bottom: 28px; }
      section.gallery .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      section.gallery .tile {
        aspect-ratio: 4/5;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        border-radius: var(--radius);
        box-shadow: var(--shadow-sm);
      }
      section.gallery .tile:nth-child(3n+2) { background: linear-gradient(135deg, var(--cta), var(--primary)); }
      section.gallery .tile:nth-child(3n+3) { background: linear-gradient(135deg, var(--secondary), var(--cta)); }

      /* Form */
      section.form { padding: 70px 0; border-top: ${prof.border} var(--border); }
      section.form .wrap {
        max-width: 600px; margin: 0 auto; text-align: center;
        padding: 40px;
        background: ${isGlass ? "rgba(255,255,255,0.5)" : "var(--bg)"};
        ${isGlass ? "backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);" : ""}
        border: ${prof.border} var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-md);
      }
      section.form h2 { font-size: clamp(1.6rem, 3vw, 2.2rem); margin-bottom: 12px; }
      section.form p { color: var(--muted); margin: 0 0 26px; }
      section.form .row { display: flex; gap: 8px; }
      section.form input {
        flex: 1;
        padding: 13px 16px;
        border: ${prof.border} var(--border);
        border-radius: var(--radius);
        font-family: "${body}", serif; font-size: 1rem;
        background: var(--bg); color: var(--text);
        outline: none;
      }
      section.form input:focus { border-color: var(--cta); }

      /* Comparison */
      section.comparison { padding: 70px 0; border-top: ${prof.border} var(--border); }
      section.comparison h2 { margin-bottom: 30px; font-size: clamp(1.8rem, 3vw, 2.4rem); }
      section.comparison table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
      section.comparison th, section.comparison td {
        padding: 14px 18px;
        border-bottom: ${prof.border} var(--border);
        text-align: left;
      }
      section.comparison th { font-family: "${heading}", serif; font-weight: 700; background: ${blend(primary, bg, 0.94)}; }
      section.comparison td.check { color: var(--cta); font-weight: 700; }
      section.comparison td.x { color: var(--muted); }

      /* CTA */
      section.cta {
        padding: 80px 0;
        background: var(--primary);
        color: var(--primary-fg);
        text-align: center;
      }
      section.cta h2 {
        font-size: clamp(2rem, 4.5vw, 3rem);
        color: var(--primary-fg);
        margin-bottom: 16px;
        max-width: 20ch;
        margin-left: auto; margin-right: auto;
      }
      section.cta p { opacity: 0.85; margin: 0 0 28px; font-size: 1.05rem; }

      /* Generic */
      section.generic { padding: 60px 0; border-top: ${prof.border} var(--border); }
      section.generic h2 { font-size: clamp(1.6rem, 3vw, 2.2rem); margin-bottom: 16px; }
      section.generic p { color: var(--muted); max-width: 56ch; }

      /* Footer */
      footer.site {
        padding: 40px 0;
        border-top: ${prof.border} var(--border);
        color: var(--muted);
        font-size: 0.84rem;
        text-align: center;
      }

      /* Mobile */
      @media (max-width: 860px) {
        nav.topnav ul { display: none; }
        section.features .grid,
        section.pricing .grid,
        section.gallery .grid,
        section.testimonials .grid { grid-template-columns: 1fr; }
        section.stats .grid { grid-template-columns: repeat(2, 1fr); }
      }
    `;

    // Section renderers
    const productName = P["Product Type"] || "Product";
    const renderers = {
      hero: () => `
        <section class="hero">
          <div class="container">
            <span class="kicker">${esc(productName)}</span>
            <h1>${esc(headline)}</h1>
            <p class="lede">${esc(subhead)}</p>
            <div class="cta-row">
              <a class="btn" href="#">Get started</a>
              <a class="btn outline" href="#">See how it works</a>
            </div>
            <div class="mock">Live preview</div>
          </div>
        </section>`,

      features: () => {
        const items = [
          ["01","Clarity","Designed for the signal, stripped of the noise."],
          ["02","Speed","From idea to production in a single afternoon."],
          ["03","Trust","Battle-tested defaults for every edge case."],
        ];
        return `<section class="features"><div class="container">
          <h2>Built for teams that ship.</h2>
          <div class="grid">
            ${items.map(([n,t,d]) => `<div class="feat"><div class="ico">${n}</div><h3>${t}</h3><p>${d}</p></div>`).join("")}
          </div>
        </div></section>`;
      },

      testimonials: () => `<section class="testimonials"><div class="container">
        <h2>Loved by builders.</h2>
        <div class="grid">
          <blockquote><p>“Cut our onboarding time in half. The defaults are genuinely sensible.”</p><cite><span class="avatar">K</span>K. Tanaka, Head of Eng</cite></blockquote>
          <blockquote><p>“It's the rare tool that feels thoughtful all the way down.”</p><cite><span class="avatar">M</span>M. Silva, Designer</cite></blockquote>
        </div>
      </div></section>`,

      pricing: () => `<section class="pricing"><div class="container">
        <h2>Simple pricing.</h2>
        <div class="grid">
          <div class="tier"><h3>Starter</h3><div class="price">$0<small> /mo</small></div><ul><li>Up to 3 projects</li><li>Community support</li><li>Basic exports</li></ul><a class="btn outline" href="#">Start free</a></div>
          <div class="tier feat"><h3>Pro</h3><div class="price">$19<small> /mo</small></div><ul><li>Unlimited projects</li><li>Priority support</li><li>All integrations</li></ul><a class="btn" href="#">Choose Pro</a></div>
          <div class="tier"><h3>Team</h3><div class="price">$49<small> /mo</small></div><ul><li>SAML SSO</li><li>Admin controls</li><li>Audit log</li></ul><a class="btn outline" href="#">Contact</a></div>
        </div>
      </div></section>`,

      faq: () => `<section class="faq"><div class="container">
        <h2>Frequently asked.</h2>
        <details open><summary>How do I get started?</summary><p>Sign up, confirm your email, and you're in. No credit card required.</p></details>
        <details><summary>Can I export my data?</summary><p>Yes — full JSON and CSV exports are available on every plan.</p></details>
        <details><summary>Do you support SSO?</summary><p>SAML SSO is available on the Team plan.</p></details>
      </div></section>`,

      demo: () => `<section class="demo"><div class="container">
        <h2>See it in motion.</h2>
        <p style="color:var(--muted); max-width:50ch; margin:0 auto;">A 90-second walkthrough of the end-to-end flow.</p>
        <div class="screen">Play demo</div>
      </div></section>`,

      stats: () => `<section class="stats"><div class="container">
        <div class="grid">
          <div class="stat"><div class="num">12k</div><div class="lbl">Teams shipping</div></div>
          <div class="stat"><div class="num">99.99%</div><div class="lbl">Uptime</div></div>
          <div class="stat"><div class="num">&lt; 40ms</div><div class="lbl">P95 latency</div></div>
          <div class="stat"><div class="num">4.9★</div><div class="lbl">Customer score</div></div>
        </div>
      </div></section>`,

      gallery: () => `<section class="gallery"><div class="container">
        <h2>From the field.</h2>
        <div class="grid">
          ${Array.from({length:6}).map(()=>`<div class="tile"></div>`).join("")}
        </div>
      </div></section>`,

      form: () => `<section class="form"><div class="container"><div class="wrap">
        <h2>Join the waitlist.</h2>
        <p>We'll email you when the next cohort opens.</p>
        <form class="row" onsubmit="event.preventDefault();">
          <input type="email" placeholder="you@work.com" />
          <button class="btn" type="submit">Join</button>
        </form>
      </div></div></section>`,

      comparison: () => `<section class="comparison"><div class="container">
        <h2>How we compare.</h2>
        <table>
          <thead><tr><th>Feature</th><th>Us</th><th>Alternative A</th><th>Alternative B</th></tr></thead>
          <tbody>
            <tr><td>Zero-config setup</td><td class="check">✓</td><td class="x">—</td><td class="x">—</td></tr>
            <tr><td>Role-based access</td><td class="check">✓</td><td class="check">✓</td><td class="x">—</td></tr>
            <tr><td>Audit log</td><td class="check">✓</td><td class="x">—</td><td class="check">✓</td></tr>
            <tr><td>Open source core</td><td class="check">✓</td><td class="x">—</td><td class="x">—</td></tr>
          </tbody>
        </table>
      </div></section>`,

      cta: () => `<section class="cta"><div class="container">
        <h2>Ready to ship ${esc(productName.toLowerCase())}?</h2>
        <p>Free while in beta. No card required.</p>
        <a class="btn" href="#">Get started</a>
      </div></section>`,

      footer: () => `<footer class="site"><div class="container">© 2026 ${esc(productName)} · uipro composer demo</div></footer>`,

      generic: () => `<section class="generic"><div class="container">
        <h2>More on the way.</h2>
        <p>Additional section content rendered here.</p>
      </div></section>`,
    };

    // top nav + hero fallback guarantee
    const navHtml = `<nav class="topnav">
      <div class="logo">${esc(productName.split(" ")[0] || "Brand")}<span>.</span></div>
      <ul>
        <li><a href="#">Product</a></li>
        <li><a href="#">Pricing</a></li>
        <li><a href="#">Docs</a></li>
      </ul>
      <a class="btn cta-btn" href="#">Start</a>
    </nav>`;

    // if hero not in order, prepend
    const finalOrder = order.includes("hero") ? order : ["hero", ...order];
    // ensure footer at end
    const withFooter = finalOrder.includes("footer") ? finalOrder : [...finalOrder, "footer"];

    const sectionsHtml = withFooter.map(k => (renderers[k] || renderers.generic)()).join("\n");

    return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(productName)} — preview</title>
<style>${css}</style>
</head><body>
${navHtml}
${sectionsHtml}
</body></html>`;
  }

  function placeholderDoc(msg) {
    return `<!DOCTYPE html><html><head>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400&display=swap" rel="stylesheet" />
      <style>
      body { margin:0; display:grid; place-items:center; min-height:100vh; background:#f5f2ec; color:#6b665c; font-family: 'Fraunces', Georgia, serif; font-style: italic; font-weight: 300; padding:40px; text-align:center; }
      h1 { font-size: 1.3rem; font-weight: 300; max-width: 32ch; line-height: 1.55; letter-spacing: -0.01em; margin: 0; }
    </style></head><body><h1>${esc(msg)}</h1></body></html>`;
  }

  // blend two hex colors with weight for b (0..1)
  function blend(aHex, bHex, w) {
    const parse = (h) => {
      h = h.replace("#","");
      if (h.length === 3) h = h.split("").map(c=>c+c).join("");
      return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
    };
    try {
      const [ar,ag,ab] = parse(aHex);
      const [br,bg,bb] = parse(bHex);
      const r = Math.round(ar*(1-w)+br*w);
      const g = Math.round(ag*(1-w)+bg*w);
      const b = Math.round(ab*(1-w)+bb*w);
      return `rgb(${r},${g},${b})`;
    } catch { return aHex; }
  }

  // ---------- UI wiring ----------
  function renderSlot(section) {
    const row = state[section];
    $("#pick-" + section + "-val").textContent = titleOf(section, row) || "Not selected";
    $("#pick-" + section + "-idx").textContent = row ? "#" + row["No"] : "#—";
    const subEl = $("#pick-" + section + "-sub");
    if (section === "colors" && row) {
      const hexes = [row["Primary (Hex)"], row["Secondary (Hex)"], row["CTA (Hex)"], row["Background (Hex)"], row["Text (Hex)"], row["Border (Hex)"]].filter(h => h && h.startsWith("#"));
      subEl.innerHTML = `<span class="mini-swatch">${hexes.map(h=>`<span style="background:${h};"></span>`).join("")}</span><span style="overflow:hidden; text-overflow:ellipsis;">${esc(row["Notes"] || "")}</span>`;
    } else {
      subEl.textContent = subtitleOf(section, row);
    }
  }

  function renderAll() {
    SECTIONS.forEach(renderSlot);
    $("#tag-style").textContent = state.styles ? (state.styles["Style Category"]) : "Style —";
    $("#tag-lp").textContent    = state.landing ? (state.landing["Pattern Name"]) : "Pattern —";
    $("#tag-type").textContent  = state.typography ? (state.typography["Font Pairing Name"]) : "Typography —";

    const parts = SECTIONS.map(s => state[s] ? titleOf(s, state[s]) : `⟨${LABELS[s]}⟩`);
    $("#recipe").innerHTML = `<strong>Recipe:</strong> ${parts.map(p => esc(p)).join(" × ")}`;
  }

  function openPicker(section) {
    currentPickerSection = section;
    $("#modal-title").textContent = "Pick " + LABELS[section];
    $("#search-input").value = "";
    applyFilter("");
    $("#modal-backdrop").classList.add("open");
    setTimeout(() => $("#search-input").focus(), 20);
  }

  function closePicker() {
    $("#modal-backdrop").classList.remove("open");
    currentPickerSection = null;
  }

  function applyFilter(q) {
    const rows = DATA[currentPickerSection] || [];
    const norm = q.toLowerCase().trim();
    filteredResults = norm ? rows.filter(r => Object.values(r).some(v => (v||"").toString().toLowerCase().includes(norm))) : rows;
    activeResultIdx = 0;
    renderResults();
  }

  function renderResults() {
    const rows = filteredResults;
    const el = $("#results");
    el.innerHTML = rows.map((r, i) => {
      const title = titleOf(currentPickerSection, r);
      const sub = subtitleOf(currentPickerSection, r);
      let thumb = "";
      if (currentPickerSection === "colors") {
        const hexes = [r["Primary (Hex)"], r["Secondary (Hex)"], r["CTA (Hex)"], r["Background (Hex)"]].filter(Boolean);
        thumb = `<div class="thumb">${hexes.map(h=>`<span style="background:${h};"></span>`).join("")}</div>`;
      } else if (currentPickerSection === "styles") {
        const hexes = hexesFrom(r["Primary Colors"]).slice(0, 3);
        thumb = hexes.length ? `<div class="thumb">${hexes.map(h=>`<span style="background:${h};"></span>`).join("")}</div>` : "";
      }
      return `<div class="result ${i===activeResultIdx?'active':''}" data-idx="${i}">
        <span class="badge">#${r["No"]}</span>
        <div class="main"><div class="title">${esc(title)}</div><div class="sub">${esc(sub)}</div></div>
        ${thumb}
      </div>`;
    }).join("") || `<div style="padding:40px; text-align:center; color:var(--dim);">No matches.</div>`;

    $$(".result").forEach(r => r.addEventListener("click", () => {
      activeResultIdx = parseInt(r.dataset.idx, 10);
      commitSelection();
    }));
  }

  function commitSelection() {
    const row = filteredResults[activeResultIdx];
    if (!row) return;
    state[currentPickerSection] = row;
    closePicker();
    renderAll();
  }

  function randomize() {
    SECTIONS.forEach(s => {
      const arr = DATA[s] || [];
      state[s] = arr[Math.floor(Math.random() * arr.length)];
    });
    renderAll();
    renderPreview();
  }

  function renderPreview() {
    const doc = buildPreview();
    $("#preview").setAttribute("srcdoc", doc);
  }

  async function copyHtml() {
    const doc = buildPreview();
    try {
      await navigator.clipboard.writeText(doc);
      const b = $("#btn-copy");
      const t = b.textContent;
      b.textContent = "Copied ✓";
      setTimeout(() => (b.textContent = t), 1400);
    } catch {
      alert("Clipboard API unavailable — you can still view-source the iframe.");
    }
  }

  // ---------- init ----------
  $$(".picker").forEach(el => el.addEventListener("click", () => openPicker(el.dataset.section)));
  $("#modal-close").addEventListener("click", closePicker);
  $("#modal-backdrop").addEventListener("click", (e) => { if (e.target.id === "modal-backdrop") closePicker(); });
  $("#search-input").addEventListener("input", (e) => applyFilter(e.target.value));
  $("#search-input").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeResultIdx = Math.min(filteredResults.length - 1, activeResultIdx + 1);
      renderResults();
      const act = document.querySelector(".result.active");
      act && act.scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeResultIdx = Math.max(0, activeResultIdx - 1);
      renderResults();
    } else if (e.key === "Enter") {
      e.preventDefault();
      commitSelection();
    } else if (e.key === "Escape") {
      closePicker();
    }
  });

  $("#btn-random").addEventListener("click", randomize);
  $("#btn-render").addEventListener("click", renderPreview);
  $("#btn-copy").addEventListener("click", copyHtml);

  $("#vp-switch").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-vp]");
    if (!btn) return;
    $$("#vp-switch button").forEach(b => b.classList.toggle("active", b === btn));
    $("#frame-wrap").dataset.vp = btn.dataset.vp;
  });

  // seed with first sensible picks
  state.products   = DATA.products[0];
  state.styles     = DATA.styles[0];
  state.colors     = DATA.colors[0];
  state.landing    = DATA.landing[0];
  state.typography = DATA.typography[0];
  renderAll();
  renderPreview();
})();
