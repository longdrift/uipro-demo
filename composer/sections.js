/* Section classifier + renderer registry
 *
 * We collapse the 96 unique section labels found in landing.csv into
 * ~40 named section types. Every renderer receives:
 *   (ctx) → HTML string
 * where ctx includes: {t, productName, prof, colors, primaryFg, ctaFg, headline, subhead, bgFinal}
 *   t is the i18n getter: t("key") or t("key", ["a","b"])
 */
(function () {
  "use strict";

  // ---------- Classifier ----------
  // Order matters: more specific patterns first.
  const RULES = [
    // hero variants
    [/hero.*video|video.*hero/i,                "hero_video"],
    [/hero.*device|hero.*mockup|device.*mockup/i,"hero_mockup"],
    [/hero.*search|search.*hero/i,              "hero_search"],
    [/hero.*countdown|countdown.*hero/i,        "hero_countdown"],
    [/dynamic hero/i,                           "hero"],
    [/hero/i,                                   "hero"],

    // narrative / story
    [/problem(?!.*solved)/i,                    "problem"],
    [/solution overview|solution(?!.*industry|.*role)/i, "solution"],
    [/value prop/i,                             "value_prop"],
    [/transformation/i,                         "transformation"],
    [/journey|chapter \d|the journey/i,         "chapters"],
    [/^intro$|intro hook|\bintro\b/i,           "intro"],

    // steps / how-it-works
    [/how it works|step \d|step-by-step|guided tour/i, "steps"],

    // features
    [/features with icons/i,                    "features_icons"],
    [/feature deep-dive|deep dive|feature breakdown/i, "features_deepdive"],
    [/key features overlay/i,                   "features_overlay"],
    [/(?:key |relevant |tailored |)features?(?!.*comparison)/i, "features"],
    [/benefits|key benefits/i,                  "benefits"],

    // social proof
    [/tailored testimonials|testimonial/i,      "testimonials"],
    [/individual reviews|reviews|rating breakdown/i, "reviews"],
    [/social proof/i,                           "social_proof"],
    [/client logos|logo bar|trust(?!\s*badge)/i,"client_logos"],
    [/trust badges|security badges/i,           "trust_badges"],

    // stats
    [/stats|metrics|numbers/i,                  "stats"],

    // pricing
    [/pricing cards|price comparison cards/i,   "pricing"],
    [/pricing|plans|tiers/i,                    "pricing"],

    // comparison
    [/comparison matrix|feature comparison table|price comparison/i, "comparison"],
    [/comparison/i,                             "comparison"],

    // faq
    [/faq accordion|faq section|faq|questions/i,"faq"],

    // demo / screenshots
    [/product video|product teaser|demo|video(?!.*background)/i, "demo"],
    [/screenshots|screenshot/i,                 "screenshots"],
    [/full-screen interactive|interactive element/i, "demo"],

    // forms
    [/email capture|lead capture|email form|newsletter subscribe/i, "email_capture"],
    [/^form$|contact form|signup form|sign up form/i, "email_capture"],
    [/contact sales/i,                          "contact_sales"],
    [/^contact$|contact us/i,                   "contact"],

    // lead magnet
    [/lead magnet|magnet preview/i,             "lead_magnet"],
    [/what you'll learn|what you will learn|curriculum/i, "curriculum"],

    // events
    [/speakers grid/i,                          "speakers_grid"],
    [/speaker bio/i,                            "speaker_bio"],
    [/agenda|schedule/i,                        "agenda"],
    [/sponsors/i,                               "sponsors"],
    [/register cta|register now/i,              "register_cta"],

    // ecommerce/marketplace
    [/popular categories|categories/i,          "categories"],
    [/featured listings|featured products/i,    "featured_listings"],
    [/project grid|portfolio grid/i,            "project_grid"],
    [/^buy$|buy now/i,                          "buy"],

    // community
    [/active members|members showcase|community/i, "community"],
    [/popular topics/i,                         "topics"],

    // newsletter
    [/recent issues|back issues/i,              "recent_issues"],

    // about / author
    [/about author|speaker bio|^about$|about us/i, "about"],

    // urgency
    [/urgency|countdown timer|limited time/i,   "urgency"],

    // CTA variants
    [/final cta|winner cta|climax cta|results cta|cta progression|smart cta|cta after|cta submit/i, "final_cta"],
    [/download ctas|download now/i,             "download_cta"],
    [/join cta|^cta$|^cta section$/i,           "cta"],

    // footer
    [/vertical footer/i,                        "footer_vertical"],
    [/footer/i,                                 "footer"],

    // short description / benefit bullets as generic
    [/short description|benefit bullets/i,      "bullets"],
  ];

  function classify(label) {
    const s = (label || "").trim();
    if (!s) return "generic";
    for (const [re, key] of RULES) if (re.test(s)) return key;
    return "generic";
  }

  function parseSectionOrder(str) {
    if (!str) return ["hero", "features", "cta", "footer"];
    const parts = str.split(/,\s*(?=\d+\.)/);
    const labels = parts.map(p => p.replace(/^\d+\.\s*/, "").trim()).filter(Boolean);
    return labels.map(classify);
  }

  // ---------- Renderers ----------
  // All renderers receive ctx and return HTML. Any variant NOT here falls back to "generic".

  const R = {};

  R.hero = (c) => `
    <section class="sec hero">
      <div class="container hero-inner">
        <div class="hero-main">
          <span class="kicker">${c.esc(c.productName)}</span>
          <h1>${c.esc(c.headline)}</h1>
          <p class="lede">${c.esc(c.subhead)}</p>
          <div class="cta-row">
            <a class="btn" href="#">${c.t("get_started")}</a>
            <a class="btn outline" href="#">${c.t("see_how")}</a>
          </div>
        </div>
        <div class="hero-mock">${c.t("live_preview")}</div>
      </div>
    </section>`;

  R.hero_video = (c) => `
    <section class="sec hero video">
      <div class="video-bg"></div>
      <div class="container">
        <span class="kicker">${c.esc(c.productName)}</span>
        <h1>${c.esc(c.headline)}</h1>
        <p class="lede">${c.esc(c.subhead)}</p>
        <a class="btn" href="#">${c.t("watch_now")}</a>
      </div>
    </section>`;

  R.hero_mockup = (c) => `
    <section class="sec hero">
      <div class="container hero-split">
        <div>
          <span class="kicker">${c.esc(c.productName)}</span>
          <h1>${c.esc(c.headline)}</h1>
          <p class="lede">${c.esc(c.subhead)}</p>
          <a class="btn" href="#">${c.t("try_free")}</a>
        </div>
        <div class="device">
          <div class="device-screen">${c.t("app_preview")}</div>
        </div>
      </div>
    </section>`;

  R.hero_search = (c) => `
    <section class="sec hero">
      <div class="container center">
        <h1>${c.esc(c.headline)}</h1>
        <p class="lede">${c.esc(c.subhead)}</p>
        <form class="search-bar" onsubmit="event.preventDefault();">
          <input type="text" placeholder="${c.t("search_placeholder")}" />
          <button class="btn" type="submit">${c.t("search")}</button>
        </form>
      </div>
    </section>`;

  R.hero_countdown = (c) => `
    <section class="sec hero urgency">
      <div class="container center">
        <span class="kicker">${c.t("launching_soon")}</span>
        <h1>${c.esc(c.headline)}</h1>
        <div class="countdown">
          <div><span>03</span><small>${c.t("days")}</small></div>
          <div><span>12</span><small>${c.t("hours")}</small></div>
          <div><span>45</span><small>${c.t("minutes")}</small></div>
          <div><span>22</span><small>${c.t("seconds")}</small></div>
        </div>
        <a class="btn" href="#">${c.t("notify_me")}</a>
      </div>
    </section>`;

  R.intro = (c) => `
    <section class="sec intro">
      <div class="container narrow">
        <span class="kicker">${c.t("introduction")}</span>
        <p class="lede">${c.esc(c.subhead)}</p>
      </div>
    </section>`;

  R.problem = (c) => `
    <section class="sec problem">
      <div class="container narrow">
        <h2>${c.t("problem_title")}</h2>
        <ul class="pain">
          ${c.list("problem_items").map(p => `<li>${c.esc(p)}</li>`).join("")}
        </ul>
      </div>
    </section>`;

  R.solution = (c) => `
    <section class="sec solution">
      <div class="container narrow">
        <h2>${c.t("solution_title")}</h2>
        <p>${c.t("solution_body", { product: c.productName })}</p>
      </div>
    </section>`;

  R.value_prop = (c) => `
    <section class="sec value-prop">
      <div class="container">
        <h2>${c.t("value_prop_title")}</h2>
        <div class="grid-3">
          ${c.list("value_prop_items").map((v,i) => `
            <div class="val">
              <div class="ico">0${i+1}</div>
              <h3>${c.esc(v[0])}</h3>
              <p>${c.esc(v[1])}</p>
            </div>`).join("")}
        </div>
      </div>
    </section>`;

  R.transformation = (c) => `
    <section class="sec transformation">
      <div class="container">
        <h2>${c.t("transformation_title")}</h2>
        <div class="before-after">
          <div class="ba-card before"><span class="tag">${c.t("before")}</span><p>${c.t("before_body")}</p></div>
          <div class="ba-card after"><span class="tag">${c.t("after")}</span><p>${c.t("after_body")}</p></div>
        </div>
      </div>
    </section>`;

  R.chapters = (c) => `
    <section class="sec chapters">
      <div class="container">
        <h2>${c.t("chapters_title")}</h2>
        <div class="chapters-list">
          ${c.list("chapters_items").map((ch, i) => `
            <article class="chapter">
              <span class="num">${String(i+1).padStart(2,"0")}</span>
              <h3>${c.esc(ch[0])}</h3>
              <p>${c.esc(ch[1])}</p>
            </article>`).join("")}
        </div>
      </div>
    </section>`;

  R.steps = (c) => `
    <section class="sec steps">
      <div class="container">
        <h2>${c.t("steps_title")}</h2>
        <div class="grid-3">
          ${c.list("steps_items").map((s, i) => `
            <div class="step">
              <div class="num">${i+1}</div>
              <h3>${c.esc(s[0])}</h3>
              <p>${c.esc(s[1])}</p>
            </div>`).join("")}
        </div>
      </div>
    </section>`;

  R.features = (c) => `
    <section class="sec features">
      <div class="container">
        <h2>${c.t("features_title")}</h2>
        <div class="grid-3">
          ${c.list("features_items").map((f, i) => `
            <div class="feat">
              <div class="ico">${String(i+1).padStart(2,"0")}</div>
              <h3>${c.esc(f[0])}</h3>
              <p>${c.esc(f[1])}</p>
            </div>`).join("")}
        </div>
      </div>
    </section>`;

  R.features_icons = (c) => `
    <section class="sec features icons">
      <div class="container">
        <h2>${c.t("features_title")}</h2>
        <div class="grid-4">
          ${c.list("features_items").concat(c.list("features_items")).slice(0,6).map((f, i) => `
            <div class="feat sm">
              <div class="ico-circle">●</div>
              <h3>${c.esc(f[0])}</h3>
              <p>${c.esc(f[1])}</p>
            </div>`).join("")}
        </div>
      </div>
    </section>`;

  R.features_deepdive = (c) => {
    const items = c.list("features_items");
    return `<section class="sec features-deep">
      <div class="container">
        <h2>${c.t("features_title")}</h2>
        ${items.map((f, i) => `
          <div class="deep-row ${i%2 ? 'reverse':''}">
            <div class="deep-copy">
              <span class="kicker">0${i+1}</span>
              <h3>${c.esc(f[0])}</h3>
              <p>${c.esc(f[1])}</p>
              <a class="btn outline" href="#">${c.t("learn_more")}</a>
            </div>
            <div class="deep-visual"></div>
          </div>`).join("")}
      </div>
    </section>`;
  };

  R.features_overlay = (c) => `
    <section class="sec features-overlay">
      <div class="container">
        <div class="overlay-media"></div>
        <div class="overlay-grid">
          ${c.list("features_items").slice(0,3).map((f, i) => `
            <div class="overlay-card">
              <strong>0${i+1} ${c.esc(f[0])}</strong>
              <p>${c.esc(f[1])}</p>
            </div>`).join("")}
        </div>
      </div>
    </section>`;

  R.benefits = (c) => `
    <section class="sec benefits">
      <div class="container">
        <h2>${c.t("benefits_title")}</h2>
        <ul class="bullets">
          ${c.list("benefits_items").map(b => `<li><span class="check">✓</span>${c.esc(b)}</li>`).join("")}
        </ul>
      </div>
    </section>`;

  R.bullets = R.benefits;

  R.testimonials = (c) => `
    <section class="sec testimonials">
      <div class="container">
        <h2>${c.t("testimonials_title")}</h2>
        <div class="grid-2">
          ${c.list("testimonials_items").map(t => `
            <blockquote>
              <p>${c.esc(t[0])}</p>
              <cite><span class="avatar">${c.esc(t[1].substring(0,1))}</span>${c.esc(t[1])}</cite>
            </blockquote>`).join("")}
        </div>
      </div>
    </section>`;

  R.reviews = (c) => `
    <section class="sec reviews">
      <div class="container">
        <div class="rating">
          <div class="big-score">4.9</div>
          <div><div class="stars">★★★★★</div><small>${c.t("rating_count", { n: "2,438" })}</small></div>
        </div>
        <div class="grid-3">
          ${c.list("testimonials_items").concat(c.list("testimonials_items")).slice(0,3).map(t => `
            <div class="review">
              <div class="stars">★★★★★</div>
              <p>${c.esc(t[0])}</p>
              <cite>— ${c.esc(t[1])}</cite>
            </div>`).join("")}
        </div>
      </div>
    </section>`;

  R.social_proof = (c) => `
    <section class="sec social-proof">
      <div class="container center">
        <p class="muted small">${c.t("trusted_by")}</p>
        <div class="logos">
          ${["ACME","NORTH","PRIME","VECTA","ELAN","FOLIO"].map(l => `<span class="logo-chip">${l}</span>`).join("")}
        </div>
      </div>
    </section>`;

  R.client_logos = R.social_proof;

  R.trust_badges = (c) => `
    <section class="sec trust-badges">
      <div class="container center">
        <p class="muted small">${c.t("certified")}</p>
        <div class="badges">
          <span class="badge">SOC 2</span>
          <span class="badge">GDPR</span>
          <span class="badge">ISO 27001</span>
          <span class="badge">HIPAA</span>
        </div>
      </div>
    </section>`;

  R.stats = (c) => `
    <section class="sec stats">
      <div class="container">
        <div class="grid-4">
          ${c.list("stats_items").map(s => `
            <div class="stat">
              <div class="num">${c.esc(s[0])}</div>
              <div class="lbl">${c.esc(s[1])}</div>
            </div>`).join("")}
        </div>
      </div>
    </section>`;

  R.pricing = (c) => {
    const tiers = c.list("pricing_items");
    return `<section class="sec pricing">
      <div class="container">
        <h2>${c.t("pricing_title")}</h2>
        <div class="grid-3">
          ${tiers.map((p, i) => `
            <div class="tier ${i===1 ? 'featured' : ''}">
              <h3>${c.esc(p[0])}</h3>
              <div class="price">${c.esc(p[1])}<small> ${c.t("per_month")}</small></div>
              <ul>
                ${p[2].map(feat => `<li>${c.esc(feat)}</li>`).join("")}
              </ul>
              <a class="btn ${i===1 ? '' : 'outline'}" href="#">${c.t("choose_plan")}</a>
            </div>`).join("")}
        </div>
      </div>
    </section>`;
  };

  R.comparison = (c) => `
    <section class="sec comparison">
      <div class="container">
        <h2>${c.t("comparison_title")}</h2>
        <table>
          <thead>
            <tr>
              <th>${c.t("feature")}</th>
              <th>${c.esc(c.productName)}</th>
              <th>${c.t("alt_a")}</th>
              <th>${c.t("alt_b")}</th>
            </tr>
          </thead>
          <tbody>
            ${c.list("comparison_items").map(row => `
              <tr>
                <td>${c.esc(row[0])}</td>
                <td class="check">✓</td>
                <td class="${row[1] ? 'check' : 'x'}">${row[1] ? '✓' : '—'}</td>
                <td class="${row[2] ? 'check' : 'x'}">${row[2] ? '✓' : '—'}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>`;

  R.faq = (c) => `
    <section class="sec faq">
      <div class="container narrow">
        <h2>${c.t("faq_title")}</h2>
        ${c.list("faq_items").map((q, i) => `
          <details ${i===0 ? "open" : ""}>
            <summary>${c.esc(q[0])}</summary>
            <p>${c.esc(q[1])}</p>
          </details>`).join("")}
      </div>
    </section>`;

  R.demo = (c) => `
    <section class="sec demo">
      <div class="container center">
        <h2>${c.t("demo_title")}</h2>
        <p class="muted">${c.t("demo_subtitle")}</p>
        <div class="demo-screen"><div class="play">▶</div></div>
      </div>
    </section>`;

  R.screenshots = (c) => `
    <section class="sec screenshots">
      <div class="container">
        <h2>${c.t("screenshots_title")}</h2>
        <div class="scroller">
          ${Array.from({length:5}).map((_,i) => `<div class="shot shot-${i+1}"></div>`).join("")}
        </div>
      </div>
    </section>`;

  R.email_capture = (c) => `
    <section class="sec form">
      <div class="container">
        <div class="wrap">
          <h2>${c.t("capture_title")}</h2>
          <p>${c.t("capture_body")}</p>
          <form class="row" onsubmit="event.preventDefault();">
            <input type="email" placeholder="${c.t("email_placeholder")}" />
            <button class="btn" type="submit">${c.t("subscribe")}</button>
          </form>
          <small class="muted">${c.t("no_spam")}</small>
        </div>
      </div>
    </section>`;

  R.contact = (c) => `
    <section class="sec form">
      <div class="container">
        <div class="wrap">
          <h2>${c.t("contact_title")}</h2>
          <p>${c.t("contact_body")}</p>
          <form class="col" onsubmit="event.preventDefault();">
            <input type="text" placeholder="${c.t("your_name")}" />
            <input type="email" placeholder="${c.t("email_placeholder")}" />
            <textarea rows="4" placeholder="${c.t("message_placeholder")}"></textarea>
            <button class="btn" type="submit">${c.t("send_message")}</button>
          </form>
        </div>
      </div>
    </section>`;

  R.contact_sales = (c) => `
    <section class="sec contact-sales">
      <div class="container">
        <div class="split">
          <div>
            <h2>${c.t("contact_sales_title")}</h2>
            <p>${c.t("contact_sales_body")}</p>
            <ul class="bullets">
              ${c.list("contact_sales_items").map(b => `<li><span class="check">✓</span>${c.esc(b)}</li>`).join("")}
            </ul>
          </div>
          <form class="card" onsubmit="event.preventDefault();">
            <input type="text" placeholder="${c.t("your_name")}" />
            <input type="text" placeholder="${c.t("company")}" />
            <input type="email" placeholder="${c.t("work_email")}" />
            <button class="btn" type="submit">${c.t("request_demo")}</button>
          </form>
        </div>
      </div>
    </section>`;

  R.lead_magnet = (c) => `
    <section class="sec lead-magnet">
      <div class="container">
        <div class="split">
          <div class="magnet-cover"><span>PDF</span></div>
          <div>
            <span class="kicker">${c.t("free_download")}</span>
            <h2>${c.t("lead_magnet_title")}</h2>
            <p>${c.t("lead_magnet_body")}</p>
            <form class="row" onsubmit="event.preventDefault();">
              <input type="email" placeholder="${c.t("email_placeholder")}" />
              <button class="btn" type="submit">${c.t("send_guide")}</button>
            </form>
          </div>
        </div>
      </div>
    </section>`;

  R.curriculum = (c) => `
    <section class="sec curriculum">
      <div class="container">
        <h2>${c.t("curriculum_title")}</h2>
        <div class="grid-2">
          ${c.list("curriculum_items").map((item, i) => `
            <div class="unit">
              <span class="module">${c.t("module")} ${String(i+1).padStart(2,"0")}</span>
              <h3>${c.esc(item[0])}</h3>
              <p>${c.esc(item[1])}</p>
            </div>`).join("")}
        </div>
      </div>
    </section>`;

  R.speakers_grid = (c) => `
    <section class="sec speakers">
      <div class="container">
        <h2>${c.t("speakers_title")}</h2>
        <div class="grid-4">
          ${c.list("speakers_items").map(s => `
            <div class="speaker">
              <div class="avatar"></div>
              <h3>${c.esc(s[0])}</h3>
              <small>${c.esc(s[1])}</small>
            </div>`).join("")}
        </div>
      </div>
    </section>`;

  R.speaker_bio = (c) => {
    const first = c.list("speakers_items")[0] || ["Jane Doe", "Keynote Speaker"];
    return `<section class="sec speaker-bio">
      <div class="container split">
        <div class="avatar big"></div>
        <div>
          <span class="kicker">${c.t("keynote")}</span>
          <h2>${c.esc(first[0])}</h2>
          <small>${c.esc(first[1])}</small>
          <p>${c.t("speaker_bio_body")}</p>
        </div>
      </div>
    </section>`;
  };

  R.agenda = (c) => `
    <section class="sec agenda">
      <div class="container">
        <h2>${c.t("agenda_title")}</h2>
        <ol class="timeline">
          ${c.list("agenda_items").map(a => `
            <li>
              <time>${c.esc(a[0])}</time>
              <div><strong>${c.esc(a[1])}</strong><p>${c.esc(a[2])}</p></div>
            </li>`).join("")}
        </ol>
      </div>
    </section>`;

  R.sponsors = (c) => `
    <section class="sec sponsors">
      <div class="container center">
        <p class="muted small">${c.t("sponsored_by")}</p>
        <div class="logos large">
          ${["NORTHWIND","PRIME","VECTA","FOLIO","ACME","ELAN"].map(l => `<span class="logo-chip big">${l}</span>`).join("")}
        </div>
      </div>
    </section>`;

  R.register_cta = (c) => `
    <section class="sec register-cta">
      <div class="container center">
        <h2>${c.t("register_title")}</h2>
        <p class="lede">${c.t("register_body")}</p>
        <a class="btn" href="#">${c.t("register_now")}</a>
      </div>
    </section>`;

  R.categories = (c) => `
    <section class="sec categories">
      <div class="container">
        <h2>${c.t("categories_title")}</h2>
        <div class="grid-4">
          ${c.list("categories_items").map(cat => `
            <a class="cat-card" href="#">
              <strong>${c.esc(cat[0])}</strong>
              <small>${c.esc(cat[1])}</small>
            </a>`).join("")}
        </div>
      </div>
    </section>`;

  R.featured_listings = (c) => `
    <section class="sec listings">
      <div class="container">
        <h2>${c.t("featured_title")}</h2>
        <div class="grid-3">
          ${Array.from({length:6}).map((_,i) => `
            <article class="listing">
              <div class="media"></div>
              <h3>${c.t("item_title_n", {n:i+1})}</h3>
              <small>${c.t("item_sub_n", {n:i+1})}</small>
            </article>`).join("")}
        </div>
      </div>
    </section>`;

  R.project_grid = (c) => `
    <section class="sec projects">
      <div class="container">
        <h2>${c.t("projects_title")}</h2>
        <div class="grid-3">
          ${Array.from({length:6}).map((_,i) => `
            <a class="proj" href="#">
              <div class="media"></div>
              <h3>${c.t("project_n", {n:i+1})}</h3>
            </a>`).join("")}
        </div>
      </div>
    </section>`;

  R.buy = (c) => `
    <section class="sec buy">
      <div class="container center">
        <h2>${c.t("buy_title")}</h2>
        <div class="price big">${c.t("buy_price")}</div>
        <a class="btn" href="#">${c.t("buy_now")}</a>
      </div>
    </section>`;

  R.community = (c) => `
    <section class="sec community">
      <div class="container center">
        <h2>${c.t("community_title")}</h2>
        <div class="avatars">
          ${Array.from({length:10}).map(() => `<span class="avatar sm"></span>`).join("")}
        </div>
        <p class="muted">${c.t("community_body")}</p>
        <a class="btn" href="#">${c.t("join_community")}</a>
      </div>
    </section>`;

  R.topics = (c) => `
    <section class="sec topics">
      <div class="container">
        <h2>${c.t("topics_title")}</h2>
        <div class="tag-cloud">
          ${c.list("topics_items").map(t => `<a class="tag" href="#">${c.esc(t)}</a>`).join("")}
        </div>
      </div>
    </section>`;

  R.recent_issues = (c) => `
    <section class="sec issues">
      <div class="container">
        <h2>${c.t("issues_title")}</h2>
        <ol class="issues-list">
          ${c.list("issues_items").map((iss, i) => `
            <li>
              <span class="num">#${String(c.list("issues_items").length - i).padStart(3,"0")}</span>
              <div><strong>${c.esc(iss[0])}</strong><small>${c.esc(iss[1])}</small></div>
            </li>`).join("")}
        </ol>
      </div>
    </section>`;

  R.about = (c) => `
    <section class="sec about">
      <div class="container split">
        <div class="avatar big"></div>
        <div>
          <span class="kicker">${c.t("about")}</span>
          <h2>${c.t("about_title")}</h2>
          <p>${c.t("about_body")}</p>
        </div>
      </div>
    </section>`;

  R.urgency = (c) => `
    <section class="sec urgency-bar">
      <div class="container center">
        <span class="pulse-dot"></span>
        <strong>${c.t("urgency_banner")}</strong>
        <a class="btn sm" href="#">${c.t("claim_now")}</a>
      </div>
    </section>`;

  R.final_cta = R.cta = (c) => `
    <section class="sec cta">
      <div class="container center">
        <h2>${c.t("cta_title", { product: c.productName.toLowerCase() })}</h2>
        <p>${c.t("cta_body")}</p>
        <a class="btn" href="#">${c.t("get_started")}</a>
      </div>
    </section>`;

  R.download_cta = (c) => `
    <section class="sec download">
      <div class="container center">
        <h2>${c.t("download_title")}</h2>
        <div class="stores">
          <a class="store" href="#">App Store</a>
          <a class="store" href="#">Google Play</a>
        </div>
      </div>
    </section>`;

  R.footer = (c) => `
    <footer class="site-footer">
      <div class="container foot-grid">
        <div class="foot-brand">
          <strong>${c.esc(c.productName)}</strong>
          <small>${c.t("footer_tagline")}</small>
        </div>
        <nav>
          <h4>${c.t("product")}</h4>
          <a>${c.t("features")}</a><a>${c.t("pricing")}</a><a>${c.t("changelog")}</a>
        </nav>
        <nav>
          <h4>${c.t("company")}</h4>
          <a>${c.t("about")}</a><a>${c.t("careers")}</a><a>${c.t("contact")}</a>
        </nav>
        <nav>
          <h4>${c.t("legal")}</h4>
          <a>${c.t("privacy")}</a><a>${c.t("terms")}</a>
        </nav>
      </div>
      <div class="container foot-bottom">
        <small>© 2026 ${c.esc(c.productName)}. ${c.t("all_rights")}</small>
      </div>
    </footer>`;

  R.footer_vertical = (c) => `
    <footer class="site-footer vertical">
      <div class="container center">
        <strong>${c.esc(c.productName)}</strong>
        <nav class="inline">
          <a>${c.t("about")}</a><a>${c.t("pricing")}</a><a>${c.t("contact")}</a><a>${c.t("privacy")}</a>
        </nav>
        <small>© 2026 ${c.esc(c.productName)}. ${c.t("all_rights")}</small>
      </div>
    </footer>`;

  R.generic = (c) => `
    <section class="sec generic">
      <div class="container narrow">
        <h2>${c.t("more_title")}</h2>
        <p>${c.t("more_body")}</p>
      </div>
    </section>`;

  window.UIPRO_SECTIONS = { classify, parseSectionOrder, renderers: R };
})();
