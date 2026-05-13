export function render_admin_ui(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>KJ Link Shortener</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
      :root {
        color-scheme: light;
        --background: #f4f1ea;
        --ink: #1f2523;
        --muted: #66716c;
        --line: #cfc7b8;
        --panel: #fffaf0;
        --accent: #0f6b55;
        --accent-strong: #094335;
        --shadow: 0 24px 80px rgb(31 37 35 / 14%);
      }

      * { box-sizing: border-box; }

      body {
        min-height: 100vh;
        margin: 0;
        color: var(--ink);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at 10% 20%, rgb(15 107 85 / 14%), transparent 28rem),
          linear-gradient(145deg, #f7f0df 0%, #eef4ef 55%, #f4f1ea 100%);
      }

      button, input { font: inherit; }

      .shell {
        display: grid;
        grid-template-columns: minmax(20rem, 29rem) minmax(20rem, 1fr);
        gap: 1rem;
        width: min(72rem, calc(100vw - 2rem));
        margin: 0 auto;
        padding: 3rem 0;
      }

      .panel, .result {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgb(255 250 240 / 88%);
        box-shadow: var(--shadow);
      }

      .panel { padding: 1.5rem; }

      .result {
        display: grid;
        grid-template-rows: auto auto 1fr;
        min-height: 32rem;
        overflow: hidden;
      }

      .masthead { margin-bottom: 1.5rem; }

      .eyebrow {
        margin: 0 0 0.4rem;
        color: var(--accent);
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        max-width: 13ch;
        font-family: "Outfit", ui-sans-serif, system-ui, sans-serif;
        font-size: clamp(2.45rem, 6vw, 4.9rem);
        font-weight: 800;
        line-height: 0.9;
        letter-spacing: 0;
      }

      .form, label {
        display: grid;
        gap: 1rem;
      }

      label {
        gap: 0.4rem;
        color: var(--muted);
        font-size: 0.88rem;
        font-weight: 600;
      }

      input {
        width: 100%;
        min-height: 2.8rem;
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 0 0.8rem;
        color: var(--ink);
        background: #fffdf8;
        outline: none;
      }

      input:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgb(15 107 85 / 14%);
      }

      .ttl-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: end;
        gap: 0.8rem;
      }

      .check {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        min-height: 2.8rem;
        color: var(--ink);
        font-weight: 650;
      }

      .check input {
        width: 1.1rem;
        min-height: 1.1rem;
        accent-color: var(--accent);
      }

      .actions, .result-header, .card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.8rem;
      }

      .actions { margin-top: 0.5rem; }

      button {
        min-height: 2.75rem;
        border: 1px solid var(--accent);
        border-radius: 6px;
        padding: 0 1rem;
        color: #fff;
        background: var(--accent);
        cursor: pointer;
      }

      button:hover:not(:disabled) { background: var(--accent-strong); }

      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .secondary {
        color: var(--accent-strong);
        background: transparent;
      }

      .secondary:hover:not(:disabled) { color: #fff; }

      .result-header {
        border-bottom: 1px solid var(--line);
        padding: 1rem;
      }

      .result-header .eyebrow { margin: 0; }

      .short-url-card {
        position: relative;
        display: grid;
        gap: 0.9rem;
        margin: 1rem;
        border: 1px solid rgb(15 107 85 / 26%);
        border-radius: 8px;
        padding: 1rem 1rem 1.1rem;
        background: #f8fff9;
      }

      .card-top {
        align-items: start;
      }

      .short-url-label {
        margin: 0;
        color: var(--muted);
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .copy-icon {
        display: inline-grid;
        place-items: center;
        width: 2.35rem;
        min-height: 2.35rem;
        border-radius: 999px;
        padding: 0;
      }

      .copy-icon svg {
        width: 1rem;
        height: 1rem;
      }

      .short-url {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 0;
        color: var(--ink);
        font-size: clamp(1.7rem, 4vw, 3.1rem);
        font-weight: 800;
        line-height: 1;
        overflow-wrap: anywhere;
      }

      .code-button {
        min-height: auto;
        border: 0;
        border-radius: 0;
        padding: 0;
        color: var(--accent-strong);
        background: transparent;
        font-size: inherit;
        font-weight: inherit;
        line-height: inherit;
        text-decoration: underline;
        text-decoration-thickness: 0.08em;
        text-underline-offset: 0.12em;
      }

      .code-edit-form {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
      }

      .code-edit-form[hidden] {
        display: none;
      }

      .code-edit-input {
        width: min(13rem, 55vw);
        min-height: 2.3rem;
        font-size: 1rem;
        font-weight: 700;
      }

      .code-button:hover:not(:disabled) {
        color: var(--accent);
        background: transparent;
      }

      .hint {
        margin: 0;
        color: var(--muted);
        font-size: 0.9rem;
      }

      .metadata-card {
        display: grid;
        gap: 0.7rem;
        margin: 0 1rem 1rem;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 1rem;
        background: rgb(255 253 248 / 78%);
      }

      .metadata-grid {
        display: grid;
        gap: 0.65rem;
      }

      .metadata-row {
        display: grid;
        gap: 0.18rem;
      }

      .metadata-key {
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .metadata-value {
        color: var(--ink);
        overflow-wrap: anywhere;
      }

      pre {
        margin: 0;
        padding: 1rem;
        overflow: auto;
        color: #173228;
        font-size: 0.9rem;
        line-height: 1.55;
        white-space: pre-wrap;
      }

      @media (max-width: 820px) {
        .shell {
          grid-template-columns: 1fr;
          padding: 1rem 0;
        }

        .ttl-row, .actions {
          display: grid;
          grid-template-columns: 1fr;
        }

        h1 { max-width: 14ch; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="panel">
        <div class="masthead">
          <h1>KJ Link Shortener</h1>
        </div>

        <form id="link-form" class="form">
          <label>
            API key
            <input id="api-key" type="password" autocomplete="off" placeholder="Stored only in this browser" required>
          </label>

          <label>
            Destination URL
            <input id="destination-url" type="url" autocomplete="url" placeholder="https://example.org/docs" required>
          </label>

          <div class="ttl-row">
            <label>
              TTL days
              <input id="ttl-days" type="number" min="1" step="1" placeholder="30">
            </label>
            <label class="check">
              <input id="permanent" type="checkbox">
              Permanent
            </label>
          </div>

          <label>
            Expires at
            <input id="expires-at" type="datetime-local">
          </label>

          <div class="actions">
            <button type="submit">Create link</button>
          </div>
        </form>
      </section>

      <section class="result" aria-live="polite">
        <div class="result-header">
          <p class="eyebrow">Result</p>
        </div>
        <div id="short-url-card" class="short-url-card" hidden>
          <div class="card-top">
            <p class="short-url-label">Short URL</p>
            <button id="copy-button" type="button" class="secondary copy-icon" aria-label="Copy short URL" disabled>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <path d="M8 8V6.5A2.5 2.5 0 0 1 10.5 4h7A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <rect x="4" y="8" width="12" height="12" rx="2.5" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
          </div>
          <div class="short-url">
            <span id="short-url-base"></span><button id="code-button" type="button" class="code-button"></button>
            <form id="code-edit-form" class="code-edit-form" hidden>
              <input id="code-edit-input" class="code-edit-input" type="text" inputmode="latin" autocomplete="off">
              <button type="submit">Save</button>
            </form>
          </div>
          <p class="hint">Click the underlined code to change it.</p>
        </div>
        <div id="metadata-card" class="metadata-card" hidden>
          <p class="short-url-label">Metadata</p>
          <div id="metadata-grid" class="metadata-grid"></div>
        </div>
        <pre id="output">Submit a link to see the API response.</pre>
      </section>
    </main>

    <script>
      const form = document.querySelector('#link-form');
      const output = document.querySelector('#output');
      const short_url_card = document.querySelector('#short-url-card');
      const short_url_base = document.querySelector('#short-url-base');
      const code_button = document.querySelector('#code-button');
      const code_edit_form = document.querySelector('#code-edit-form');
      const code_edit_input = document.querySelector('#code-edit-input');
      const metadata_card = document.querySelector('#metadata-card');
      const metadata_grid = document.querySelector('#metadata-grid');
      const copy_button = document.querySelector('#copy-button');
      const api_key = document.querySelector('#api-key');
      const destination_url = document.querySelector('#destination-url');
      const ttl_days = document.querySelector('#ttl-days');
      const expires_at = document.querySelector('#expires-at');
      const permanent = document.querySelector('#permanent');
      const storage_key = 'kj-link-shortener.api-key';
      let last_short_url = '';
      let current_code = '';

      if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
        const events = new EventSource('/__dev/events');
        events.onerror = () => {
          setTimeout(() => {
            location.reload();
          }, 600);
        };
      }

      api_key.value = localStorage.getItem(storage_key) || '';

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await create_link();
      });

      code_button.addEventListener('click', async () => {
        show_code_editor();
      });

      code_edit_form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await update_code();
      });

      permanent.addEventListener('change', () => {
        sync_expiry_controls(false);
      });

      expires_at.addEventListener('input', () => {
        sync_expiry_controls(false);
      });

      copy_button.addEventListener('click', async () => {
        if (!last_short_url) return;
        await navigator.clipboard.writeText(last_short_url);
        copy_button.setAttribute('aria-label', 'Copied');
        setTimeout(() => {
          copy_button.setAttribute('aria-label', 'Copy short URL');
        }, 1400);
      });

      async function create_link() {
        const payload = { url: destination_url.value.trim() };
        const expires_at_value = expires_at.value.trim();

        if (permanent.checked) payload.permanent = true;
        else if (expires_at_value) payload.expires_at = new Date(expires_at_value).toISOString();
        else if (ttl_days.value.trim()) payload.ttl_days = Number(ttl_days.value);

        await request_api('/api/links', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      async function update_code() {
        if (!current_code) return;

        const next_code = code_edit_input.value.trim();

        if (!next_code || next_code === current_code) {
          hide_code_editor();
          return;
        }

        await request_api('/api/links/' + encodeURIComponent(current_code), {
          method: 'PATCH',
          body: JSON.stringify({ code: next_code.trim() }),
        });
      }

      async function request_api(path, options) {
        localStorage.setItem(storage_key, api_key.value);
        set_busy(true);

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
          output.textContent = JSON.stringify(body, null, 2);
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
        short_url_card.hidden = true;
        metadata_card.hidden = true;
        copy_button.disabled = true;
        output.textContent = JSON.stringify({ error: message }, null, 2);
      }

      function update_result(body) {
        current_code = body.code || current_code;
        last_short_url = body.short_url || (current_code ? location.origin + '/' + encodeURIComponent(current_code) : '');

        if (last_short_url && current_code) {
          short_url_base.textContent = last_short_url.slice(0, -current_code.length);
          code_button.textContent = current_code;
          short_url_card.hidden = false;
          hide_code_editor();
        }

        render_metadata(body.metadata);
        copy_button.disabled = !last_short_url;
      }

      function show_code_editor() {
        if (!current_code) return;

        code_edit_input.value = current_code;
        code_button.hidden = true;
        code_edit_form.hidden = false;
        code_edit_input.focus();
        code_edit_input.select();
      }

      function hide_code_editor() {
        code_button.hidden = false;
        code_edit_form.hidden = true;
      }

      function render_metadata(metadata) {
        metadata_grid.replaceChildren();

        if (!metadata) {
          metadata_card.hidden = false;
          append_metadata_row('Status', 'No metadata found');
          return;
        }

        metadata_card.hidden = false;

        for (const [key, value] of Object.entries(metadata)) {
          if (value !== undefined && value !== null && value !== '') {
            append_metadata_row(key, String(value));
          }
        }
      }

      function append_metadata_row(key, value) {
        const row = document.createElement('div');
        row.className = 'metadata-row';

        const label = document.createElement('div');
        label.className = 'metadata-key';
        label.textContent = key.replaceAll('_', ' ');

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
        code_button.disabled = is_busy || !current_code;
        code_edit_input.disabled = is_busy;
        copy_button.disabled = is_busy || !last_short_url;
        sync_expiry_controls(is_busy);
      }

      function sync_expiry_controls(is_busy) {
        const has_explicit_expiry = expires_at.value.trim() !== '';
        expires_at.disabled = is_busy || permanent.checked;
        ttl_days.disabled = is_busy || permanent.checked || has_explicit_expiry;
      }
    </script>
  </body>
</html>`;
}
