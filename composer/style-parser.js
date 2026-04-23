/* Style parser — derive a rendering profile from styles.csv CSS columns
 *
 * Input: a row from DATA.styles
 * Output: a profile object used by the composer to emit CSS variables & effects.
 *
 * We intentionally use regex over the human-written CSS/Effects/Vars columns.
 * Values are approximate — this is visual representation, not pixel-perfect.
 */
(function () {
  "use strict";

  // --------- helpers ---------
  function allText(row) {
    return [
      row["Effects & Animation"] || "",
      row["CSS/Technical Keywords"] || "",
      row["Design System Variables"] || "",
      row["Keywords"] || "",
      row["Style Category"] || "",
      row["Primary Colors"] || "",
      row["Secondary Colors"] || "",
    ].join(" \n ");
  }

  function pickFirst(text, re) {
    const m = re.exec(text);
    return m ? m[1].trim() : null;
  }
  function pickAll(text, re) {
    const out = [];
    let m;
    const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    while ((m = r.exec(text))) out.push(m[1].trim());
    return out;
  }

  // "12-16px" → "14px"; "400-700" → 600; keeps "0px" etc.
  function normalizePx(v) {
    if (!v) return null;
    v = v.trim();
    const m = v.match(/^(\d+)\s*[-–]\s*(\d+)\s*(px|rem|em)?/);
    if (m) {
      const avg = Math.round((+m[1] + +m[2]) / 2);
      return avg + (m[3] || "px");
    }
    const m2 = v.match(/^(\d+)\s*(px|rem|em)?/);
    if (m2) return m2[1] + (m2[2] || "px");
    if (/^(0|none)$/i.test(v)) return "0px";
    return v;
  }

  function normalizeWeight(v) {
    if (!v) return null;
    const m = v.match(/(\d+)\s*[-–+]\s*(\d+)?/);
    if (m) {
      const a = +m[1];
      const b = m[2] ? +m[2] : 900;
      return Math.min(900, Math.round((a + b) / 2));
    }
    const plus = v.match(/(\d+)\s*\+/);
    if (plus) return Math.min(900, +plus[1] + 100);
    const single = v.match(/(\d+)/);
    return single ? +single[1] : null;
  }

  function normalizeDuration(v) {
    if (!v) return null;
    const m = v.match(/(\d+(?:\.\d+)?)\s*(ms|s)/i);
    if (!m) return null;
    const num = +m[1];
    const unit = m[2].toLowerCase();
    return unit === "s" ? Math.round(num * 1000) + "ms" : Math.round(num) + "ms";
  }

  function normalizeGap(v) {
    if (!v) return null;
    const m = v.match(/(\d+)\s*(px|rem|em)?/);
    if (!m) return null;
    return m[1] + (m[2] || "px");
  }

  // --------- main ---------
  function parseStyle(row) {
    if (!row) return defaultProfile();
    const text = allText(row);

    const has = (re) => re.test(text);
    const hasWord = (...words) =>
      words.some(w => text.toLowerCase().includes(w.toLowerCase()));

    // radius
    let radius =
      normalizePx(pickFirst(text, /border-radius:\s*([^,;\n]+?)(?:[,;\n]|$)/i)) ||
      normalizePx(pickFirst(text, /--border-radius:\s*([^,;\n]+?)(?:[,;\n]|$)/i)) ||
      "8px";

    // If the text declares sharp corners or brutalism, force 0
    if (hasWord("sharp corners", "brutalism", "brutalist", "anti-design") && radius !== "0px") {
      radius = "0px";
    }

    const radiusNum = parseInt(radius, 10) || 0;
    const radiusSoft = (radiusNum === 0 ? "0" : Math.min(radiusNum * 2, 32)) + "px";

    // shadow — multiple layers possible
    const shadowSpecs = pickAll(text, /box-shadow:\s*([^;{}\n]+?)(?:[;\n]|$)/gi);
    const shadowInline = shadowSpecs.length ? shadowSpecs.join(", ") : null;

    let shadowMd = "0 4px 8px rgba(0,0,0,0.08)";
    let shadowLg = "0 20px 40px rgba(0,0,0,0.12)";
    let shadowSm = "0 1px 2px rgba(0,0,0,0.05)";

    if (shadowInline) {
      shadowMd = shadowInline;
      // derive a larger variant by doubling blur/offset where possible
      shadowLg = shadowInline.replace(/(\d+)px/g, (m, p) => Math.min(+p * 2, 80) + "px");
      shadowSm = shadowInline.replace(/(\d+)px/g, (m, p) => Math.max(Math.round(+p / 2), 1) + "px");
    }
    if (hasWord("no box-shadow", "no shadow", "sharp shadows if any", "flat")) {
      shadowSm = "none"; shadowMd = "none"; shadowLg = "0 1px 0 rgba(0,0,0,0.06)";
    }
    if (hasWord("brutalism", "brutalist") || has(/transition:\s*none/i)) {
      shadowSm = "none";
      shadowMd = "6px 6px 0 rgba(0,0,0,1)";
      shadowLg = "12px 12px 0 rgba(0,0,0,1)";
    }
    if (hasWord("neumorphism", "neumorphic", "soft ui")) {
      shadowSm = "inset 2px 2px 4px rgba(0,0,0,0.06), inset -2px -2px 4px rgba(255,255,255,0.9)";
      shadowMd = "-6px -6px 14px rgba(255,255,255,0.9), 6px 6px 14px rgba(0,0,0,0.08)";
      shadowLg = "-10px -10px 24px rgba(255,255,255,0.9), 10px 10px 24px rgba(0,0,0,0.1)";
    }

    // transition
    let duration = normalizeDuration(pickFirst(text, /(\d+(?:\.\d+)?\s*(?:ms|s))/i)) || "220ms";
    let transition = `all ${duration} cubic-bezier(0.2, 0.8, 0.2, 1)`;
    if (has(/transition:\s*(none|0s|instant)/i) || hasWord("no smooth transitions", "instant", "no transitions")) {
      transition = "none";
      duration = "0ms";
    } else if (hasWord("smooth", "ease")) {
      transition = `all ${duration} ease`;
    }

    // font-weight
    const weightText = pickFirst(text, /--font-weight:\s*([^,;\n]+)/i) ||
                       pickFirst(text, /font-weight:\s*([^,;\n]+)/i) ||
                       (hasWord("bold", "heavy") ? "700" : null);
    const headingWeight = normalizeWeight(weightText) || 700;

    // letter-spacing
    let letterSpacing = "-0.01em";
    if (hasWord("brutal", "heavy")) letterSpacing = "-0.04em";
    if (hasWord("spacious", "editorial", "magazine")) letterSpacing = "-0.03em";
    if (hasWord("uppercase", "text-transform")) letterSpacing = "0.08em";

    // border width
    const borderWidth = pickFirst(text, /border:\s*(?:visible\s*)?(\d+)(?:-\d+)?\s*px/i) ||
                        (hasWord("visible borders", "3-4px", "2-4px") ? "3" : "1");
    const border = `${Math.min(+borderWidth || 1, 6)}px solid`;

    // backdrop blur (glass)
    const blurValue = pickFirst(text, /backdrop[- ]filter:\s*blur\((\d+)(?:-(\d+))?px/i);
    const blurAmount = blurValue ? blurValue.split(",")[0].trim() : null;
    const glass = hasWord("glass", "frosted", "backdrop") || !!blurValue;

    // gradient flag
    const gradient = hasWord("gradient", "linear-gradient", "radial-gradient", "aurora", "mesh");

    // animation / motion flag
    const animated = hasWord("animation", "continuous", "kinetic", "motion-driven", "micro-interaction");

    // 3D flag
    const threeD = hasWord("perspective", "translate3d", "webgl", "three.js", "3d", "parallax");

    // noise
    const noise = hasWord("noise", "grain", "film grain");

    // uppercase
    const uppercase = hasWord("uppercase", "bold typography", "statement") && hasWord("text-transform", "loud", "swiss type") === false
      ? hasWord("uppercase", "statement", "loud minimal", "bold minimalism")
      : hasWord("uppercase", "all caps");

    // spacing / block gap
    const gap = normalizeGap(pickFirst(text, /gap:\s*([^,;\n]+)/i)) || "24px";

    // font family override from text
    let fontOverride = null;
    if (hasWord("system-ui", "system font")) fontOverride = "system-ui";
    else if (hasWord("monospace", "mono font")) fontOverride = "ui-monospace, 'JetBrains Mono', monospace";
    else if (hasWord("serif only", "serif based")) fontOverride = "serif";

    // raw (brutalist) flag
    const raw = hasWord("brutal", "anti-design", "raw", "unpolished");

    // press / hover transform patterns
    const hoverLift = hasWord("hover lift", "translate", "rise") || !raw;

    return {
      radius,
      radiusSoft,
      shadowSm,
      shadowMd,
      shadowLg,
      transition,
      duration,
      headingWeight,
      letterSpacing,
      border,
      borderWidth: +borderWidth || 1,
      glass,
      blurAmount,
      gradient,
      animated,
      threeD,
      noise,
      uppercase,
      gap,
      fontOverride,
      raw,
      hoverLift,
      // raw row for debugging
      _row: row,
    };
  }

  function defaultProfile() {
    return {
      radius: "8px",
      radiusSoft: "14px",
      shadowSm: "0 1px 2px rgba(0,0,0,0.05)",
      shadowMd: "0 4px 8px rgba(0,0,0,0.08)",
      shadowLg: "0 20px 40px rgba(0,0,0,0.12)",
      transition: "all 220ms ease",
      duration: "220ms",
      headingWeight: 700,
      letterSpacing: "-0.01em",
      border: "1px solid",
      borderWidth: 1,
      glass: false,
      blurAmount: null,
      gradient: false,
      animated: false,
      threeD: false,
      noise: false,
      uppercase: false,
      gap: "24px",
      fontOverride: null,
      raw: false,
      hoverLift: true,
    };
  }

  window.UIPRO_STYLE = { parseStyle, defaultProfile };
})();
