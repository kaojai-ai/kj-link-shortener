export function render_admin_ui(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>KJ Link Shortener</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%23ffffff'/%3E%3Crect x='4' y='4' width='56' height='56' rx='10' fill='none' stroke='%230f8a56' stroke-width='4'/%3E%3Ctext x='32' y='40' text-anchor='middle' font-family='Arial,sans-serif' font-size='24' font-weight='700' fill='%230f8a56'%3EKJ%3C/text%3E%3C/svg%3E">
    <style>
      :root {
        color-scheme: light;
        --page: #f6f8f7;
        --panel: #ffffff;
        --panel-soft: #f9fbfa;
        --ink: #0b1110;
        --muted: #5f6b68;
        --soft: #8a9693;
        --line: #dce3e0;
        --line-strong: #c7d2ce;
        --accent: #0f8a56;
        --accent-strong: #07683f;
        --accent-soft: #e8f7ef;
        --accent-line: #a9dec4;
        --danger: #b42318;
        --danger-soft: #fff0ed;
        --shadow: 0 24px 70px rgb(15 38 29 / 10%);
        --fast: 160ms ease;
        --slow: 420ms cubic-bezier(.2,.8,.2,1);
      }

      * { box-sizing: border-box; }

      html { min-height: 100%; }

      body {
        min-height: 100vh;
        margin: 0;
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          linear-gradient(180deg, #fbfcfc 0%, var(--page) 100%);
      }

      button, input, summary { font: inherit; }

      button, summary { -webkit-tap-highlight-color: transparent; }

      .page-shell {
        width: min(92rem, calc(100vw - 2rem));
        margin: 0 auto;
        padding: 1.75rem 0 2.5rem;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.4rem;
      }

      .brand-mark {
        display: grid;
        place-items: center;
        width: 3.25rem;
        height: 3.25rem;
        border: 1.5px solid var(--accent);
        border-radius: 8px;
        color: var(--accent);
        background: #fff;
        font-size: 1.45rem;
        font-weight: 800;
        letter-spacing: 0;
        box-shadow: 0 10px 24px rgb(15 138 86 / 10%);
      }

      h1 {
        margin: 0;
        font-size: clamp(1.8rem, 2.6vw, 2.35rem);
        font-weight: 760;
        letter-spacing: 0;
        line-height: 1.05;
      }

      .workspace {
        display: grid;
        grid-template-columns: minmax(22rem, .88fr) minmax(24rem, 1.18fr);
        gap: 1.35rem;
        align-items: stretch;
      }

      .panel {
        min-width: 0;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgb(255 255 255 / 92%);
        box-shadow: var(--shadow);
      }

      .creator-panel {
        display: grid;
        padding: 1.65rem;
      }

      .form {
        display: grid;
        gap: 1.45rem;
      }

      .field {
        display: grid;
        gap: .55rem;
      }

      fieldset.field {
        min-inline-size: 0;
        margin: 0;
        border: 0;
        padding: 0;
      }

      legend.section-label {
        margin-bottom: .55rem;
        padding: 0;
      }

      .field-label,
      .section-label {
        color: var(--ink);
        font-size: .95rem;
        font-weight: 720;
        letter-spacing: 0;
      }

      .optional {
        color: var(--muted);
        font-weight: 520;
      }

      .input-shell {
        position: relative;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        min-height: 4.05rem;
        border: 1px solid var(--line-strong);
        border-radius: 8px;
        background: var(--panel);
        color: var(--muted);
        transition: border-color var(--fast), box-shadow var(--fast), background var(--fast);
      }

      .input-shell:focus-within {
        border-color: var(--accent);
        box-shadow: 0 0 0 4px rgb(15 138 86 / 12%);
        background: #fff;
      }

      .input-icon {
        display: grid;
        place-items: center;
        width: 3.35rem;
        color: var(--soft);
      }

      .input-icon svg,
      .button-icon,
      .chevron,
      .details-icon {
        width: 1.15rem;
        height: 1.15rem;
      }

      input {
        width: 100%;
        min-width: 0;
        min-height: 3.95rem;
        border: 0;
        padding: 0;
        color: var(--ink);
        background: transparent;
        outline: none;
        font-size: 1.02rem;
        letter-spacing: 0;
      }

      input::placeholder { color: #9aa4a1; opacity: 1; }

      .path-prefix {
        display: grid;
        place-items: center;
        align-self: stretch;
        min-width: max-content;
        border-right: 1px solid var(--line);
        padding: 0 .95rem;
        color: var(--muted);
        background: var(--panel-soft);
        font-size: .98rem;
        white-space: nowrap;
      }

      .custom-path-input { padding: 0 1rem; }

      .field-note {
        margin: 0;
        color: var(--muted);
        font-size: .86rem;
        line-height: 1.4;
      }

      .choice-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: .8rem;
      }

      .choice input {
        position: absolute;
        width: 1px;
        min-height: 0;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }

      .choice-shell {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: .75rem;
        align-items: center;
        min-height: 4.35rem;
        border: 1px solid var(--line-strong);
        border-radius: 8px;
        padding: .85rem 1rem;
        color: var(--ink);
        background: var(--panel);
        cursor: pointer;
        transition: border-color var(--fast), background var(--fast), box-shadow var(--fast), transform var(--fast);
      }

      .choice-shell:hover {
        border-color: var(--accent-line);
        transform: translateY(-1px);
      }

      .choice input:focus-visible + .choice-shell {
        outline: 3px solid rgb(15 138 86 / 16%);
        outline-offset: 2px;
      }

      .choice input:checked + .choice-shell {
        border-color: var(--accent);
        background: var(--accent-soft);
        box-shadow: inset 0 0 0 1px rgb(15 138 86 / 6%);
      }

      .radio-mark {
        display: grid;
        place-items: center;
        width: 1.3rem;
        height: 1.3rem;
        border: 1.5px solid #b9c4c0;
        border-radius: 50%;
        background: #fff;
      }

      .radio-mark::after {
        width: .56rem;
        height: .56rem;
        border-radius: 50%;
        background: var(--accent);
        transform: scale(0);
        transition: transform var(--fast);
        content: "";
      }

      .choice input:checked + .choice-shell .radio-mark {
        border-color: var(--accent);
      }

      .choice input:checked + .choice-shell .radio-mark::after {
        transform: scale(1);
      }

      .choice-title {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: .45rem;
        font-size: 1rem;
        font-weight: 650;
      }

      .default-pill {
        border-radius: 999px;
        padding: .22rem .5rem;
        color: var(--accent-strong);
        background: #d9f4e7;
        font-size: .78rem;
        font-weight: 720;
      }

      .disclosure {
        border-top: 1px solid var(--line);
        padding-top: .95rem;
      }

      .disclosure summary {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: .7rem;
        align-items: center;
        min-height: 3.9rem;
        border: 1px solid var(--line-strong);
        border-radius: 8px;
        padding: 0 1rem;
        color: var(--ink);
        background: var(--panel);
        cursor: pointer;
        list-style: none;
        transition: border-color var(--fast), background var(--fast);
      }

      .disclosure summary::-webkit-details-marker { display: none; }

      .disclosure summary:hover {
        border-color: var(--accent-line);
        background: var(--panel-soft);
      }

      .summary-text {
        display: grid;
        gap: .12rem;
      }

      .summary-title {
        font-size: .95rem;
        font-weight: 700;
      }

      .summary-state {
        color: var(--muted);
        font-size: .84rem;
      }

      .chevron {
        color: var(--muted);
        transition: transform var(--fast);
      }

      details[open] .chevron { transform: rotate(180deg); }

      .api-key-body {
        padding-top: .85rem;
      }

      .primary-button,
      .ghost-button,
      .icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: .6rem;
        border: 1px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        text-decoration: none;
        transition: transform var(--fast), box-shadow var(--fast), background var(--fast), border-color var(--fast), color var(--fast);
      }

      .primary-button {
        min-height: 4.1rem;
        width: 100%;
        margin-top: 0;
        color: #fff;
        background: linear-gradient(180deg, #11945d 0%, #087545 100%);
        font-size: 1.02rem;
        font-weight: 760;
        box-shadow: 0 14px 26px rgb(15 138 86 / 20%);
      }

      .primary-button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 18px 30px rgb(15 138 86 / 24%);
      }

      .primary-button:disabled,
      .ghost-button:disabled,
      .icon-button:disabled {
        opacity: .55;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      .result-panel {
        display: grid;
        min-height: 46.25rem;
        padding: 1.9rem;
      }

      .recent-panel {
        margin-top: 1.35rem;
        padding: 1.45rem;
      }

      .token-gate {
        width: min(28rem, 100%);
        margin: 6vh auto 0;
        padding: 1.65rem;
      }

      .token-gate h2 { margin: 0; font-size: 1.25rem; }
      .token-gate p { margin: .45rem 0 1.1rem; color: var(--muted); line-height: 1.45; }
      .token-form { display: grid; gap: .85rem; }
      .token-button { min-height: 3.4rem; }

      .recent-heading {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .recent-heading h2 {
        margin: 0;
        font-size: 1.1rem;
      }

      .recent-heading p {
        margin: 0;
        color: var(--muted);
        font-size: .9rem;
      }

      .table-scroll { overflow-x: auto; }

      .recent-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
      }

      .recent-table th,
      .recent-table td {
        border-top: 1px solid var(--line);
        padding: .85rem .75rem;
        vertical-align: middle;
      }

      .recent-table th {
        color: var(--muted);
        font-size: .76rem;
        font-weight: 760;
        letter-spacing: .04em;
        text-transform: uppercase;
      }

      .recent-table td { font-size: .9rem; }

      .recent-url,
      .recent-destination {
        display: block;
        max-width: 31rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .recent-url { color: var(--accent-strong); font-weight: 700; }
      .recent-destination { color: var(--muted); }
      .recent-empty { color: var(--muted); text-align: center; }

      .edit-button {
        min-height: 2.5rem;
        border: 1px solid var(--line-strong);
        border-radius: 7px;
        padding: 0 .8rem;
        color: var(--accent-strong);
        background: #fff;
        cursor: pointer;
        font-weight: 700;
      }

      .edit-button:hover { border-color: var(--accent-line); background: var(--panel-soft); }

      .empty-state,
      .confirmed-state {
        min-width: 0;
      }

      .empty-state {
        display: grid;
        place-items: center;
        min-height: 100%;
        color: var(--muted);
        text-align: center;
      }

      .empty-box {
        display: grid;
        gap: .75rem;
        justify-items: center;
        max-width: 24rem;
      }

      .empty-icon {
        display: grid;
        place-items: center;
        width: 4rem;
        height: 4rem;
        border: 1px solid var(--line);
        border-radius: 8px;
        color: var(--accent);
        background: var(--panel-soft);
      }

      .empty-icon svg {
        width: 1.55rem;
        height: 1.55rem;
      }

      .empty-title {
        margin: 0;
        color: var(--ink);
        font-size: 1.05rem;
        font-weight: 720;
      }

      .empty-copy {
        margin: 0;
        font-size: .95rem;
        line-height: 1.45;
      }

      .confirmed-state {
        display: grid;
        gap: 1.65rem;
        align-content: start;
        animation: state-enter var(--slow) both;
      }

      .success-row {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .success-mark {
        display: grid;
        place-items: center;
        width: 4.15rem;
        height: 4.15rem;
        border-radius: 50%;
        color: #fff;
        background: var(--accent);
        box-shadow:
          0 0 0 .75rem rgb(15 138 86 / 10%),
          0 16px 34px rgb(15 138 86 / 24%);
        animation: success-pop 520ms cubic-bezier(.2,.8,.2,1) both;
      }

      .success-mark svg {
        width: 2rem;
        height: 2rem;
      }

      .confirmed-title {
        margin: 0;
        color: var(--accent-strong);
        font-size: clamp(1.65rem, 3vw, 2.15rem);
        font-weight: 780;
        letter-spacing: 0;
        line-height: 1;
      }

      .confirmed-subtitle {
        margin: .35rem 0 0;
        color: var(--muted);
        font-size: 1rem;
      }

      .result-section {
        display: grid;
        gap: .75rem;
      }

      .short-url-bar {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: .75rem;
        align-items: center;
        border: 1px solid var(--accent-line);
        border-radius: 8px;
        padding: .72rem .72rem .72rem 1.1rem;
        background: linear-gradient(180deg, #fbfffd 0%, #f1fbf5 100%);
      }

      .short-url-link {
        min-width: 0;
        color: var(--accent-strong);
        font-size: clamp(1.2rem, 2.4vw, 1.8rem);
        font-weight: 760;
        line-height: 1.18;
        overflow-wrap: anywhere;
        text-decoration: none;
      }

      .short-url-link:hover { text-decoration: underline; }

      .icon-button {
        width: 3.25rem;
        min-width: 3.25rem;
        height: 3.25rem;
        border-color: var(--line-strong);
        color: var(--ink);
        background: #fff;
      }

      .icon-button:hover:not(:disabled) {
        border-color: var(--accent-line);
        color: var(--accent-strong);
        transform: translateY(-1px);
      }

      .qr-stage {
        display: grid;
        justify-items: center;
        gap: 1.15rem;
        padding: .1rem 0 .45rem;
      }

      .qr-frame {
        display: grid;
        place-items: center;
        width: min(19rem, 100%);
        aspect-ratio: 1;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 1.15rem;
        background: #fff;
        box-shadow: 0 16px 36px rgb(10 20 18 / 8%);
        animation: qr-reveal 520ms 120ms cubic-bezier(.2,.8,.2,1) both;
      }

      .qr-frame svg {
        width: 100%;
        height: 100%;
        display: block;
      }

      .ghost-button {
        min-height: 3.45rem;
        border-color: var(--line-strong);
        padding: 0 1.15rem;
        color: var(--accent-strong);
        background: #fff;
        font-weight: 700;
      }

      .ghost-button:hover:not(:disabled) {
        border-color: var(--accent-line);
        background: var(--panel-soft);
        transform: translateY(-1px);
      }

      .details-panel {
        border-top: 1px solid var(--line);
        padding-top: 1rem;
      }

      .details-panel summary {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: .7rem;
        align-items: center;
        border: 0;
        min-height: 3rem;
        padding: 0;
        background: transparent;
        cursor: pointer;
        list-style: none;
      }

      .details-panel summary::-webkit-details-marker { display: none; }

      .details-body {
        display: grid;
        gap: 1rem;
        padding-top: .85rem;
      }

      .metadata-grid {
        display: grid;
        gap: .6rem;
      }

      .metadata-row {
        display: grid;
        grid-template-columns: 9rem minmax(0, 1fr);
        gap: .8rem;
        align-items: start;
        border-bottom: 1px solid var(--line);
        padding-bottom: .6rem;
      }

      .metadata-row:last-child { border-bottom: 0; padding-bottom: 0; }

      .metadata-key {
        color: var(--muted);
        font-size: .78rem;
        font-weight: 760;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      .metadata-value {
        min-width: 0;
        color: var(--ink);
        font-size: .92rem;
        overflow-wrap: anywhere;
      }

      pre {
        max-height: 16rem;
        margin: 0;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 1rem;
        overflow: auto;
        color: #10231c;
        background: var(--panel-soft);
        font-size: .85rem;
        line-height: 1.55;
        white-space: pre-wrap;
      }

      .status-message {
        min-height: 1.35rem;
        margin: -.25rem 0 0;
        color: var(--muted);
        font-size: .9rem;
      }

      .status-message[data-tone="error"] { color: var(--danger); }

      .status-message[data-tone="success"] { color: var(--accent-strong); }

      .shake {
        animation: shake 260ms ease;
      }

      [hidden] { display: none !important; }

      @keyframes state-enter {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes success-pop {
        0% { transform: scale(.72); opacity: 0; }
        70% { transform: scale(1.05); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }

      @keyframes qr-reveal {
        from { opacity: 0; transform: scale(.96); }
        to { opacity: 1; transform: scale(1); }
      }

      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation-duration: .01ms !important;
          animation-iteration-count: 1 !important;
          scroll-behavior: auto !important;
          transition-duration: .01ms !important;
        }
      }

      @media (max-width: 900px) {
        .page-shell {
          width: min(42rem, calc(100vw - 1rem));
          padding-top: 1rem;
        }

        .workspace {
          grid-template-columns: 1fr;
        }

        .result-panel {
          min-height: 35rem;
        }

        .primary-button {
          margin-top: 1rem;
        }
      }

      @media (max-width: 560px) {
        .page-shell {
          width: min(100vw - .75rem, 42rem);
          padding-bottom: .75rem;
        }

        .brand {
          gap: .8rem;
          margin-bottom: .9rem;
        }

        .brand-mark {
          width: 2.7rem;
          height: 2.7rem;
          font-size: 1.16rem;
        }

        .creator-panel,
        .result-panel,
        .recent-panel {
          padding: 1rem;
        }

        .choice-grid,
        .short-url-bar,
        .metadata-row {
          grid-template-columns: 1fr;
        }

        .short-url-bar {
          gap: 1rem;
        }

        .icon-button {
          width: 100%;
        }

        .input-shell {
          grid-template-columns: auto minmax(0, 1fr);
        }

        .path-prefix {
          grid-column: 1 / -1;
          justify-content: start;
          min-height: 2.7rem;
          border-right: 0;
          border-bottom: 1px solid var(--line);
        }

        .custom-path-input {
          grid-column: 1 / -1;
          padding: 0 1rem;
        }
      }
    </style>
  </head>
  <body>
    <main class="page-shell">
      <header class="brand" aria-label="KJ Link Shortener">
        <div class="brand-mark" aria-hidden="true">KJ</div>
        <h1>KJ Link Shortener</h1>
      </header>

      <section id="token-gate" class="panel token-gate" aria-label="API token">
        <form id="token-form" class="token-form">
          <div>
            <h2>Enter API token</h2>
            <p>Enter your token to manage short links.</p>
          </div>
          <label class="field">
            <span class="input-shell">
              <span class="input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M15 7.5a4.5 4.5 0 1 0 1.5 8.74L18 18h2v2h2v-3.5l-3.26-3.26A4.5 4.5 0 0 0 15 7.5ZM15 11h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
              <input id="api-key" type="password" autocomplete="off" placeholder="API token" required>
            </span>
          </label>
          <p id="token-status" class="status-message" aria-live="polite"></p>
          <button id="token-submit" class="primary-button token-button" type="submit">Continue</button>
        </form>
      </section>

      <div id="app-content" hidden>
      <div class="workspace">
        <section class="panel creator-panel" aria-label="Create short link">
          <form id="link-form" class="form">
            <label class="field">
              <span class="field-label">Original URL</span>
              <span class="input-shell">
                <span class="input-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M10.5 13.5 13.5 10.5M9.5 7.5l1.05-1.05a4.25 4.25 0 0 1 6.01 6.01l-1.05 1.04M14.5 16.5l-1.05 1.05a4.25 4.25 0 0 1-6.01-6.01l1.05-1.04" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </span>
                <input id="destination-url" type="url" autocomplete="url" placeholder="https://kaojai.ai/docs/link-shortener" required>
                <span class="input-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="m7 12 3 3 7-7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              </span>
            </label>

            <label class="field">
              <span class="field-label">Custom path <span class="optional">(optional)</span></span>
              <span class="input-shell">
                <span id="path-prefix" class="path-prefix">/</span>
                <input id="custom-path" class="custom-path-input" type="text" inputmode="latin" autocomplete="off" placeholder="docs-link" maxlength="64" aria-describedby="custom-path-note">
              </span>
              <p id="custom-path-note" class="field-note">Letters, numbers, hyphens, and underscores. Use only the path.</p>
            </label>

            <fieldset class="field" aria-labelledby="lifetime-label">
              <legend id="lifetime-label" class="section-label">Link lifetime</legend>
              <div class="choice-grid">
                <label class="choice">
                  <input id="lifetime-ttl" type="radio" name="lifetime" value="ttl" checked>
                  <span class="choice-shell">
                    <span class="radio-mark" aria-hidden="true"></span>
                    <span class="choice-title">30 days <span class="default-pill">Default</span></span>
                  </span>
                </label>
                <label class="choice">
                  <input id="lifetime-permanent" type="radio" name="lifetime" value="permanent">
                  <span class="choice-shell">
                    <span class="radio-mark" aria-hidden="true"></span>
                    <span class="choice-title">Permanent</span>
                  </span>
                </label>
              </div>
            </fieldset>

            <p id="status-message" class="status-message" aria-live="polite"></p>

            <button id="submit-button" class="primary-button" type="submit">
              <svg class="button-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <path d="M10.5 13.5 13.5 10.5M9.5 7.5l1.05-1.05a4.25 4.25 0 0 1 6.01 6.01l-1.05 1.04M14.5 16.5l-1.05 1.05a4.25 4.25 0 0 1-6.01-6.01l1.05-1.04" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              Create short link
            </button>
          </form>
        </section>

        <section class="panel result-panel" aria-live="polite" aria-label="Short link result">
          <div id="empty-state" class="empty-state">
            <div class="empty-box">
              <div class="empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
              <p class="empty-title">Ready for a short link</p>
              <p class="empty-copy">Create a link to see the confirmed URL, QR code, and details here.</p>
            </div>
          </div>

          <div id="confirmed-state" class="confirmed-state" hidden>
            <div class="success-row">
              <div class="success-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="m6.5 12.5 3.4 3.4 7.8-8.3" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div>
                <p class="confirmed-title">Confirmed</p>
                <p id="confirmed-subtitle" class="confirmed-subtitle">Short link ready.</p>
              </div>
            </div>

            <div class="result-section">
              <div class="section-label">Short URL</div>
              <div class="short-url-bar">
                <a id="short-url-link" class="short-url-link" href="#" target="_blank" rel="noopener noreferrer"></a>
                <button id="copy-button" class="icon-button" type="button" aria-label="Copy short URL">
                  <svg class="button-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
                    <path d="M8 8V6.5A2.5 2.5 0 0 1 10.5 4h7A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <rect x="4" y="8" width="12" height="12" rx="2.5" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="result-section">
              <div class="section-label">QR code</div>
              <div class="qr-stage">
                <div id="qr-code" class="qr-frame"></div>
                <button id="download-qr-button" class="ghost-button" type="button">
                  <svg class="button-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
                    <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Download QR
                </button>
              </div>
            </div>

            <details id="details-panel" class="details-panel">
              <summary>
                <svg class="details-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <span class="summary-text">
                  <span class="summary-title">Details</span>
                  <span class="summary-state">Metadata and API response</span>
                </span>
                <svg class="chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none">
                  <path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </summary>
              <div class="details-body">
                <div id="metadata-grid" class="metadata-grid"></div>
                <pre id="raw-output"></pre>
              </div>
            </details>
          </div>
        </section>
      </div>

      <section class="panel recent-panel" aria-label="Recent short links">
        <div class="recent-heading">
          <h2>Last 20 generated URLs</h2>
          <p>Choose a link to edit it in the form above.</p>
        </div>
        <div class="table-scroll">
          <table class="recent-table">
            <thead>
              <tr><th>Short URL</th><th>Destination</th><th>Created</th><th><span class="sr-only">Edit</span></th></tr>
            </thead>
            <tbody id="recent-links-body"><tr><td class="recent-empty" colspan="4">Enter your API key to load recent links.</td></tr></tbody>
          </table>
        </div>
      </section>
      </div>
    </main>

    <script>
      const form = document.querySelector('#link-form');
      const token_form = document.querySelector('#token-form');
      const token_gate = document.querySelector('#token-gate');
      const app_content = document.querySelector('#app-content');
      const destination_url = document.querySelector('#destination-url');
      const custom_path = document.querySelector('#custom-path');
      const path_prefix = document.querySelector('#path-prefix');
      const lifetime_ttl = document.querySelector('#lifetime-ttl');
      const lifetime_permanent = document.querySelector('#lifetime-permanent');
      const api_key = document.querySelector('#api-key');
      const token_submit = document.querySelector('#token-submit');
      const token_status = document.querySelector('#token-status');
      const submit_button = document.querySelector('#submit-button');
      const status_message = document.querySelector('#status-message');
      const empty_state = document.querySelector('#empty-state');
      const confirmed_state = document.querySelector('#confirmed-state');
      const confirmed_subtitle = document.querySelector('#confirmed-subtitle');
      const short_url_link = document.querySelector('#short-url-link');
      const copy_button = document.querySelector('#copy-button');
      const qr_code = document.querySelector('#qr-code');
      const download_qr_button = document.querySelector('#download-qr-button');
      const details_panel = document.querySelector('#details-panel');
      const metadata_grid = document.querySelector('#metadata-grid');
      const raw_output = document.querySelector('#raw-output');
      const recent_links_body = document.querySelector('#recent-links-body');
      const storage_key = 'kj-link-shortener.api-key';
      const ttl_days = 30;
      let last_short_url = '';
      let current_code = '';
      let last_qr_svg = '';
      let editing_code = '';
      let recent_links = [];

      if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
        const events = new EventSource('/__dev/events');
        events.onerror = () => {
          setTimeout(() => {
            location.reload();
          }, 600);
        };
      }

      path_prefix.textContent = location.origin + '/';
      api_key.value = localStorage.getItem(storage_key) || '';
      if (api_key.value.trim()) void unlock();

      token_form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await unlock();
      });

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await submit_link();
      });

      destination_url.addEventListener('input', () => {
        const existing_link = recent_links.find((link) => link.destination_url === destination_url.value.trim());
        if (existing_link && existing_link.code !== editing_code) {
          select_link_for_edit(existing_link);
        }
      });

      custom_path.addEventListener('blur', () => {
        custom_path.value = normalize_custom_path(custom_path.value);
      });

      copy_button.addEventListener('click', async () => {
        if (!last_short_url) return;
        await navigator.clipboard.writeText(last_short_url);
        set_status('Copied short URL.', 'success');
        copy_button.setAttribute('aria-label', 'Copied');
        setTimeout(() => {
          copy_button.setAttribute('aria-label', 'Copy short URL');
        }, 1400);
      });

      download_qr_button.addEventListener('click', () => {
        if (!last_qr_svg) return;

        const blob = new Blob([last_qr_svg], { type: 'image/svg+xml;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = (current_code || 'kj-short-link') + '-qr.svg';
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);
      });

      async function submit_link() {
        const payload = { url: destination_url.value.trim() };
        const path = normalize_custom_path(custom_path.value);

        if (path) {
          payload.code = path;
          custom_path.value = path;
        }

        if (lifetime_permanent.checked) {
          payload.permanent = true;
        } else {
          payload.ttl_days = ttl_days;
        }

        await request_api(editing_code ? '/api/links/' + encodeURIComponent(editing_code) : '/api/links', {
          method: editing_code ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        });
      }

      async function request_api(path, options) {
        set_busy(true);
        set_status(editing_code ? 'Saving link...' : 'Creating short link...', '');

        try {
          const response = await fetch(path, {
            ...options,
            headers: {
              'content-type': 'application/json',
              'x-api-key': api_key.value,
            },
          });
          const body = await parse_response(response);

          if (!response.ok) {
            show_error(body.error || 'Request failed with ' + response.status);
            return;
          }

          update_result(body);
          set_status(editing_code ? 'Short link updated.' : 'Short link confirmed.', 'success');
          await load_recent_links();
        } catch (error) {
          show_error(error instanceof Error ? error.message : 'Request failed');
        } finally {
          set_busy(false);
        }
      }

      async function parse_response(response) {
        const text = await response.text();
        if (!text) return {};

        try {
          return JSON.parse(text);
        } catch {
          return { error: text };
        }
      }

      function show_error(message) {
        last_short_url = '';
        current_code = '';
        last_qr_svg = '';
        qr_code.replaceChildren();
        set_status(message, 'error');
        form.classList.remove('shake');
        void form.offsetWidth;
        form.classList.add('shake');
      }

      function update_result(body) {
        current_code = body.code || current_code;
        last_short_url = body.short_url || (current_code ? location.origin + '/' + encodeURIComponent(current_code) : '');

        if (!last_short_url) {
          show_error('Short URL was not returned.');
          return;
        }

        empty_state.hidden = true;
        confirmed_state.hidden = false;
        confirmed_state.style.animation = 'none';
        void confirmed_state.offsetWidth;
        confirmed_state.style.animation = '';
        details_panel.open = false;

        short_url_link.textContent = last_short_url;
        short_url_link.href = last_short_url;
        confirmed_subtitle.textContent = body.permanent ? 'Permanent short link ready.' : 'Short link ready for 30 days.';

        render_qr(last_short_url);
        render_details(body);
      }

      async function load_recent_links() {
        if (!api_key.value.trim()) return false;

        try {
          const response = await fetch('/api/links', {
            headers: { 'x-api-key': api_key.value },
          });
          const body = await parse_response(response);

          if (!response.ok) {
            recent_links_body.replaceChildren(recent_empty_row(body.error || 'Recent links could not be loaded.'));
            return false;
          }

          recent_links = Array.isArray(body.links) ? body.links : [];
          render_recent_links();
          return true;
        } catch {
          recent_links_body.replaceChildren(recent_empty_row('Recent links could not be loaded.'));
          return false;
        }
      }

      async function unlock() {
        const token = api_key.value.trim();

        if (!token) {
          set_token_status('Token required.', 'error');
          return;
        }

        token_submit.disabled = true;
        set_token_status('Checking token...', '');
        const is_authorized = await load_recent_links();
        token_submit.disabled = false;

        if (!is_authorized) {
          localStorage.removeItem(storage_key);
          set_token_status('Token is incorrect.', 'error');
          return;
        }

        localStorage.setItem(storage_key, token);
        token_gate.hidden = true;
        app_content.hidden = false;
      }

      function render_recent_links() {
        recent_links_body.replaceChildren();

        if (recent_links.length === 0) {
          recent_links_body.append(recent_empty_row('No generated links yet.'));
          return;
        }

        for (const link_data of recent_links) {
          const row = document.createElement('tr');
          const short_url_cell = document.createElement('td');
          const short_url = document.createElement('a');
          short_url.className = 'recent-url';
          short_url.href = link_data.short_url;
          short_url.target = '_blank';
          short_url.rel = 'noopener noreferrer';
          short_url.textContent = link_data.short_url;
          short_url_cell.append(short_url);

          const destination_cell = document.createElement('td');
          const destination = document.createElement('span');
          destination.className = 'recent-destination';
          destination.title = link_data.destination_url;
          destination.textContent = link_data.destination_url;
          destination_cell.append(destination);

          const created_cell = document.createElement('td');
          created_cell.textContent = format_datetime(link_data.created_at);

          const edit_cell = document.createElement('td');
          const edit_button = document.createElement('button');
          edit_button.className = 'edit-button';
          edit_button.type = 'button';
          edit_button.textContent = 'Edit';
          edit_button.addEventListener('click', () => select_link_for_edit(link_data));
          edit_cell.append(edit_button);

          row.append(short_url_cell, destination_cell, created_cell, edit_cell);
          recent_links_body.append(row);
        }
      }

      function recent_empty_row(message) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.className = 'recent-empty';
        cell.colSpan = 4;
        cell.textContent = message;
        row.append(cell);
        return row;
      }

      function select_link_for_edit(link_data) {
        editing_code = link_data.code;
        current_code = link_data.code;
        destination_url.value = link_data.destination_url;
        custom_path.value = link_data.code;
        lifetime_permanent.checked = Boolean(link_data.permanent);
        lifetime_ttl.checked = !link_data.permanent;
        submit_button.lastChild.textContent = ' Save changes';
        submit_button.setAttribute('aria-label', 'Save changes to ' + link_data.code);
        set_status('Editing ' + link_data.short_url, '');
        update_result(link_data);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      function render_details(body) {
        metadata_grid.replaceChildren();

        append_metadata_row('Code', body.code || current_code || 'Generated');
        append_metadata_row('Lifetime', body.permanent ? 'Permanent' : (body.expires_at ? format_datetime(body.expires_at) : '30 days'));
        append_metadata_row('Destination', body.destination_url || body.url || destination_url.value.trim());

        if (body.metadata) {
          for (const [key, value] of Object.entries(body.metadata)) {
            if (value !== undefined && value !== null && value !== '') {
              append_metadata_row(key.replaceAll('_', ' '), String(value));
            }
          }
        } else {
          append_metadata_row('Metadata', 'No metadata found');
        }

        raw_output.textContent = JSON.stringify(body, null, 2);
      }

      function append_metadata_row(key, value) {
        const row = document.createElement('div');
        row.className = 'metadata-row';

        const label = document.createElement('div');
        label.className = 'metadata-key';
        label.textContent = key;

        const content = document.createElement('div');
        content.className = 'metadata-value';
        content.textContent = value;

        row.append(label, content);
        metadata_grid.append(row);
      }

      function set_busy(is_busy) {
        form.querySelectorAll('button, input').forEach((element) => {
          element.disabled = is_busy;
        });
        submit_button.disabled = is_busy;
        copy_button.disabled = is_busy || !last_short_url;
        download_qr_button.disabled = is_busy || !last_qr_svg;
      }

      function set_status(message, tone) {
        status_message.textContent = message;
        status_message.dataset.tone = tone;
      }

      function set_token_status(message, tone) {
        token_status.textContent = message;
        token_status.dataset.tone = tone;
      }

      function normalize_custom_path(value) {
        return value
          .trim()
          .replace(/^https?:\\/\\/[^/]+\\/?/i, '')
          .replace(/^\\/+/, '');
      }

      function format_datetime(value) {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
          return value;
        }

        return date.toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      function render_qr(text) {
        try {
          const matrix = create_qr_matrix(text);
          last_qr_svg = qr_matrix_to_svg(matrix);
          qr_code.innerHTML = last_qr_svg;
          download_qr_button.disabled = false;
        } catch (error) {
          last_qr_svg = '';
          qr_code.textContent = error instanceof Error ? error.message : 'QR code unavailable';
          download_qr_button.disabled = true;
        }
      }

      function qr_matrix_to_svg(matrix) {
        const quiet = 4;
        const size = matrix.length + quiet * 2;
        let path = '';

        for (let y = 0; y < matrix.length; y += 1) {
          for (let x = 0; x < matrix.length; x += 1) {
            if (matrix[y][x]) {
              path += 'M' + (x + quiet) + ' ' + (y + quiet) + 'h1v1h-1z';
            }
          }
        }

        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="QR code" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path fill="#0b0f14" d="' + path + '"/></svg>';
      }

      function create_qr_matrix(text) {
        const version = 5;
        const size = 17 + version * 4;
        const data_codewords = 86;
        const block_data_codewords = 43;
        const ecc_codewords = 24;
        const bytes = Array.from(new TextEncoder().encode(text));

        if (bytes.length > 84) {
          throw new Error('QR code supports short URLs up to 84 bytes.');
        }

        const bits = [];
        append_bits(bits, 0x4, 4);
        append_bits(bits, bytes.length, 8);

        for (const byte of bytes) {
          append_bits(bits, byte, 8);
        }

        const capacity_bits = data_codewords * 8;
        const terminator_bits = Math.min(4, capacity_bits - bits.length);

        for (let i = 0; i < terminator_bits; i += 1) {
          bits.push(0);
        }

        while (bits.length % 8 !== 0) {
          bits.push(0);
        }

        const data = [];

        for (let i = 0; i < bits.length; i += 8) {
          data.push(bits_to_byte(bits, i));
        }

        for (let pad = 0; data.length < data_codewords; pad += 1) {
          data.push(pad % 2 === 0 ? 0xec : 0x11);
        }

        const blocks = [
          data.slice(0, block_data_codewords),
          data.slice(block_data_codewords, block_data_codewords * 2),
        ];
        const ecc_blocks = blocks.map((block) => reed_solomon_remainder(block, ecc_codewords));
        const codewords = [];

        for (let i = 0; i < block_data_codewords; i += 1) {
          for (const block of blocks) {
            codewords.push(block[i]);
          }
        }

        for (let i = 0; i < ecc_codewords; i += 1) {
          for (const block of ecc_blocks) {
            codewords.push(block[i]);
          }
        }

        const base = make_base_qr(size);
        draw_codewords(base.modules, base.is_function, codewords);
        draw_format_bits(base.modules, base.is_function, 0);
        return base.modules;
      }

      function append_bits(bits, value, length) {
        for (let i = length - 1; i >= 0; i -= 1) {
          bits.push((value >>> i) & 1);
        }
      }

      function bits_to_byte(bits, offset) {
        let value = 0;

        for (let i = 0; i < 8; i += 1) {
          value = (value << 1) | bits[offset + i];
        }

        return value;
      }

      function make_base_qr(size) {
        const modules = Array.from({ length: size }, () => Array(size).fill(false));
        const is_function = Array.from({ length: size }, () => Array(size).fill(false));

        draw_finder(modules, is_function, 0, 0);
        draw_finder(modules, is_function, size - 7, 0);
        draw_finder(modules, is_function, 0, size - 7);
        draw_alignment(modules, is_function, 30, 30);

        for (let i = 8; i < size - 8; i += 1) {
          const dark = i % 2 === 0;
          set_function_module(modules, is_function, 6, i, dark);
          set_function_module(modules, is_function, i, 6, dark);
        }

        draw_format_bits(modules, is_function, 0);
        set_function_module(modules, is_function, 8, size - 8, true);
        return { modules, is_function };
      }

      function draw_finder(modules, is_function, left, top) {
        for (let y = -1; y <= 7; y += 1) {
          for (let x = -1; x <= 7; x += 1) {
            const xx = left + x;
            const yy = top + y;

            if (xx < 0 || yy < 0 || yy >= modules.length || xx >= modules.length) {
              continue;
            }

            const in_finder = x >= 0 && x <= 6 && y >= 0 && y <= 6;
            const dark = in_finder && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
            set_function_module(modules, is_function, xx, yy, dark);
          }
        }
      }

      function draw_alignment(modules, is_function, center_x, center_y) {
        for (let y = -2; y <= 2; y += 1) {
          for (let x = -2; x <= 2; x += 1) {
            set_function_module(
              modules,
              is_function,
              center_x + x,
              center_y + y,
              Math.max(Math.abs(x), Math.abs(y)) === 2 || (x === 0 && y === 0),
            );
          }
        }
      }

      function draw_codewords(modules, is_function, codewords) {
        const size = modules.length;
        let bit_index = 0;
        let upward = true;

        for (let right = size - 1; right >= 1; right -= 2) {
          if (right === 6) {
            right -= 1;
          }

          for (let vertical = 0; vertical < size; vertical += 1) {
            const y = upward ? size - 1 - vertical : vertical;

            for (let dx = 0; dx < 2; dx += 1) {
              const x = right - dx;

              if (is_function[y][x]) {
                continue;
              }

              let dark = false;

              if (bit_index < codewords.length * 8) {
                dark = (((codewords[Math.floor(bit_index / 8)] >>> (7 - (bit_index % 8))) & 1) !== 0);
                bit_index += 1;
              }

              if ((x + y) % 2 === 0) {
                dark = !dark;
              }

              modules[y][x] = dark;
            }
          }

          upward = !upward;
        }
      }

      function draw_format_bits(modules, is_function, mask) {
        const size = modules.length;
        const bits = get_format_bits(mask);

        for (let i = 0; i <= 5; i += 1) {
          set_function_module(modules, is_function, 8, i, get_bit(bits, i));
        }

        set_function_module(modules, is_function, 8, 7, get_bit(bits, 6));
        set_function_module(modules, is_function, 8, 8, get_bit(bits, 7));
        set_function_module(modules, is_function, 7, 8, get_bit(bits, 8));

        for (let i = 9; i < 15; i += 1) {
          set_function_module(modules, is_function, 14 - i, 8, get_bit(bits, i));
        }

        for (let i = 0; i < 8; i += 1) {
          set_function_module(modules, is_function, size - 1 - i, 8, get_bit(bits, i));
        }

        for (let i = 8; i < 15; i += 1) {
          set_function_module(modules, is_function, 8, size - 15 + i, get_bit(bits, i));
        }

        set_function_module(modules, is_function, 8, size - 8, true);
      }

      function get_format_bits(mask) {
        const data = mask;
        let remainder = data << 10;

        for (let i = 14; i >= 10; i -= 1) {
          if (((remainder >>> i) & 1) !== 0) {
            remainder ^= 0x537 << (i - 10);
          }
        }

        return ((data << 10) | remainder) ^ 0x5412;
      }

      function get_bit(value, index) {
        return ((value >>> index) & 1) !== 0;
      }

      function set_function_module(modules, is_function, x, y, dark) {
        modules[y][x] = dark;
        is_function[y][x] = true;
      }

      function reed_solomon_remainder(data, degree) {
        const generator = reed_solomon_generator(degree);
        const result = data.concat(Array(degree).fill(0));

        for (let i = 0; i < data.length; i += 1) {
          const factor = result[i];

          if (factor === 0) {
            continue;
          }

          for (let j = 0; j < generator.length; j += 1) {
            result[i + j] ^= gf_multiply(generator[j], factor);
          }
        }

        return result.slice(data.length);
      }

      function reed_solomon_generator(degree) {
        let result = [1];

        for (let i = 0; i < degree; i += 1) {
          result = polynomial_multiply(result, [1, gf_pow(2, i)]);
        }

        return result;
      }

      function polynomial_multiply(left, right) {
        const result = Array(left.length + right.length - 1).fill(0);

        for (let i = 0; i < left.length; i += 1) {
          for (let j = 0; j < right.length; j += 1) {
            result[i + j] ^= gf_multiply(left[i], right[j]);
          }
        }

        return result;
      }

      function gf_pow(value, exponent) {
        let result = 1;

        for (let i = 0; i < exponent; i += 1) {
          result = gf_multiply(result, value);
        }

        return result;
      }

      function gf_multiply(left, right) {
        let result = 0;

        while (right > 0) {
          if ((right & 1) !== 0) {
            result ^= left;
          }

          right >>>= 1;
          left <<= 1;

          if ((left & 0x100) !== 0) {
            left ^= 0x11d;
          }
        }

        return result & 0xff;
      }
    </script>
  </body>
</html>`;
}
