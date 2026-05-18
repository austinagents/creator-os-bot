(function () {
  const STORAGE_KEY = 'partnerlinks_support_chat_v1';
  const DEFAULT_STATE = {
    expanded: false,
    messages: []
  };

  const SELECTORS = {
    root: 'partnerlinks-support-widget-root',
    panel: 'partnerlinks-support-panel',
    toggle: 'partnerlinks-support-toggle',
    close: 'partnerlinks-support-close',
    clear: 'partnerlinks-support-clear',
    info: 'partnerlinks-support-info',
    infoPopover: 'partnerlinks-support-info-popover',
    messages: 'partnerlinks-support-messages',
    form: 'partnerlinks-support-form',
    input: 'partnerlinks-support-input',
    quickReplies: 'partnerlinks-support-quick-replies'
  };

  function init() {
    if (document.getElementById(SELECTORS.root)) return;

    const knowledge = window.PartnerLinksSupportKnowledge || {};
    const state = loadState();
    if (!state.messages.length) {
      state.messages.push({
        role: 'agent',
        text: "Hi, I'm PartnerLinks support agent. I can assist with onboarding, referral links, Shopify setup, dashboards, earnings states, or any other questions you might have. What do you need help with?"
      });
      saveState(state);
    }

    const root = document.createElement('section');
    root.id = SELECTORS.root;
    root.className = 'pl-support-widget';
    root.setAttribute('aria-label', 'PartnerLinks support chat');
    root.innerHTML = renderWidget(knowledge, state);
    document.body.appendChild(root);

    wireEvents(root, knowledge, state);
    renderMessages(root, state);
    setExpanded(root, state.expanded);
  }

  function renderWidget(knowledge) {
    const quickReplies = Array.isArray(knowledge.quickReplies) ? knowledge.quickReplies : [];
    return `
      <button id="${SELECTORS.toggle}" class="pl-support-toggle" type="button" aria-expanded="false" aria-controls="${SELECTORS.panel}">
        <span class="pl-support-toggle-dot" aria-hidden="true"></span>
        <span>Support</span>
      </button>
      <div id="${SELECTORS.panel}" class="pl-support-panel" role="dialog" aria-modal="false" aria-labelledby="partnerlinks-support-title">
        <header class="pl-support-header">
          <div>
            <p class="pl-support-kicker">PartnerLinks</p>
            <div class="pl-support-title-row">
              <h2 id="partnerlinks-support-title">Support</h2>
              <button id="${SELECTORS.info}" class="pl-support-info-button" type="button" aria-label="Security reminder" aria-expanded="false" aria-controls="${SELECTORS.infoPopover}">ⓘ</button>
              <div id="${SELECTORS.infoPopover}" class="pl-support-info-popover" role="tooltip" aria-hidden="true">
                Security reminder: PartnerLinks support will never ask for passwords, private keys, webhook secrets, or full payment card details.
              </div>
            </div>
          </div>
          <div class="pl-support-header-actions">
            <button id="${SELECTORS.clear}" class="pl-support-icon-button" type="button" title="Clear chat" aria-label="Clear support chat">Clear</button>
            <button id="${SELECTORS.close}" class="pl-support-icon-button" type="button" title="Minimize" aria-label="Minimize support chat">×</button>
          </div>
        </header>
        <div id="${SELECTORS.messages}" class="pl-support-messages" aria-live="polite"></div>
        <div id="${SELECTORS.quickReplies}" class="pl-support-quick-replies">
          ${quickReplies.map((reply) => `<button type="button" data-support-reply="${escapeAttribute(reply)}">${escapeHtml(reply)}</button>`).join('')}
        </div>
        <form id="${SELECTORS.form}" class="pl-support-form">
          <label class="sr-only" for="${SELECTORS.input}">Ask PartnerLinks support</label>
          <input id="${SELECTORS.input}" type="text" autocomplete="off" maxlength="500" placeholder="Ask about links, Shopify, dashboards..." />
          <button type="submit">Send</button>
        </form>
      </div>
    `;
  }

  function wireEvents(root, knowledge, state) {
    const toggle = root.querySelector(`#${SELECTORS.toggle}`);
    const close = root.querySelector(`#${SELECTORS.close}`);
    const clear = root.querySelector(`#${SELECTORS.clear}`);
    const info = root.querySelector(`#${SELECTORS.info}`);
    const form = root.querySelector(`#${SELECTORS.form}`);
    const input = root.querySelector(`#${SELECTORS.input}`);
    const quickReplies = root.querySelector(`#${SELECTORS.quickReplies}`);

    toggle.addEventListener('click', () => {
      state.expanded = !state.expanded;
      saveState(state);
      setExpanded(root, state.expanded);
      if (state.expanded) setTimeout(() => input.focus(), 50);
    });

    close.addEventListener('click', () => {
      state.expanded = false;
      saveState(state);
      setExpanded(root, false);
      toggle.focus();
    });

    clear.addEventListener('click', () => {
      state.messages = [{
        role: 'agent',
        text: 'Chat cleared. I can help with PartnerLinks onboarding, referral links, Shopify setup, dashboards, and earnings state questions.'
      }];
      saveState(state);
      renderMessages(root, state);
      input.focus();
    });

    info.addEventListener('click', (event) => {
      event.stopPropagation();
      setInfoOpen(root, !root.classList.contains('is-info-open'));
    });

    info.addEventListener('mouseenter', () => {
      setInfoOpen(root, true);
    });

    root.querySelector(`#${SELECTORS.infoPopover}`).addEventListener('mouseleave', () => {
      setInfoOpen(root, false);
    });

    quickReplies.addEventListener('click', (event) => {
      const button = event.target.closest('[data-support-reply]');
      if (!button) return;
      handleUserMessage(root, knowledge, state, button.dataset.supportReply || '');
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) return;
      input.value = '';
      handleUserMessage(root, knowledge, state, value);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (root.classList.contains('is-info-open')) {
        setInfoOpen(root, false);
        info.focus();
        return;
      }
      if (!state.expanded) return;
      state.expanded = false;
      saveState(state);
      setExpanded(root, false);
    });

    document.addEventListener('click', (event) => {
      if (!root.classList.contains('is-info-open')) return;
      if (event.target.closest(`#${SELECTORS.info}`) || event.target.closest(`#${SELECTORS.infoPopover}`)) return;
      setInfoOpen(root, false);
    });
  }

  function handleUserMessage(root, knowledge, state, value) {
    state.messages.push({ role: 'user', text: value });
    state.messages.push({ role: 'agent', text: getAgentReply(knowledge, value) });
    state.messages = state.messages.slice(-40);
    saveState(state);
    renderMessages(root, state);
  }

  function getAgentReply(knowledge, value) {
    const normalized = normalize(value);
    const unsafe = [
      'password',
      'private key',
      'api key',
      'secret',
      'webhook secret',
      'card number',
      'credit card',
      'recovery code'
    ];
    if (unsafe.some((term) => normalized.includes(term))) {
      return findTopic(knowledge, 'privacy').answer;
    }

    const topic = bestTopicMatch(knowledge, normalized);
    if (topic) return topic.answer;

    if (/(money|paid|payment|earn|commission|claim|stripe|payout|settlement)/.test(normalized)) {
      return findTopic(knowledge, 'earnings_states').answer;
    }

    return knowledge.escalationMessage || 'I can flag this for PartnerLinks support. Please share only the account email and Shopify .myshopify.com store domain if relevant.';
  }

  function bestTopicMatch(knowledge, normalized) {
    const topics = Array.isArray(knowledge.topics) ? knowledge.topics : [];
    let best = null;
    let bestScore = 0;

    for (const topic of topics) {
      const keywords = Array.isArray(topic.keywords) ? topic.keywords : [];
      const score = keywords.reduce((sum, keyword) => {
        const normalizedKeyword = normalize(keyword);
        if (!normalizedKeyword) return sum;
        if (normalized.includes(normalizedKeyword)) return sum + 4;
        return normalizedKeyword.split(/\s+/).reduce((wordSum, word) => {
          return word.length > 3 && normalized.includes(word) ? wordSum + 1 : wordSum;
        }, sum);
      }, 0);

      if (score > bestScore) {
        best = topic;
        bestScore = score;
      }
    }

    return bestScore > 0 ? best : null;
  }

  function findTopic(knowledge, id) {
    const topics = Array.isArray(knowledge.topics) ? knowledge.topics : [];
    return topics.find((topic) => topic.id === id) || {
      answer: knowledge.escalationMessage || 'I can flag this for PartnerLinks support.'
    };
  }

  function renderMessages(root, state) {
    const container = root.querySelector(`#${SELECTORS.messages}`);
    container.innerHTML = '';
    for (const message of state.messages) {
      const bubble = document.createElement('div');
      bubble.className = `pl-support-message pl-support-message-${message.role === 'user' ? 'user' : 'agent'}`;
      bubble.textContent = cleanMessageText(message.text);
      container.appendChild(bubble);
    }
    container.scrollTop = container.scrollHeight;
  }

  function setExpanded(root, expanded) {
    const toggle = root.querySelector(`#${SELECTORS.toggle}`);
    const panel = root.querySelector(`#${SELECTORS.panel}`);
    root.classList.toggle('is-expanded', Boolean(expanded));
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    panel.setAttribute('aria-hidden', expanded ? 'false' : 'true');
    if (!expanded) setInfoOpen(root, false);
  }

  function setInfoOpen(root, open) {
    const info = root.querySelector(`#${SELECTORS.info}`);
    const popover = root.querySelector(`#${SELECTORS.infoPopover}`);
    root.classList.toggle('is-info-open', Boolean(open));
    info.setAttribute('aria-expanded', open ? 'true' : 'false');
    popover.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  function loadState() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
      if (!parsed || !Array.isArray(parsed.messages)) return { ...DEFAULT_STATE, messages: [] };
      return {
        expanded: Boolean(parsed.expanded),
        messages: parsed.messages
          .filter((message) => message && typeof message.text === 'string')
          .map((message) => ({
            role: message.role === 'user' ? 'user' : 'agent',
            text: message.text.slice(0, 1000)
          }))
          .slice(-40)
      };
    } catch (_error) {
      return { ...DEFAULT_STATE, messages: [] };
    }
  }

  function saveState(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        expanded: Boolean(state.expanded),
        messages: state.messages
      }));
    } catch (_error) {}
  }

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9./:_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function cleanMessageText(value) {
    return String(value || '').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
