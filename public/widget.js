(function () {
  var currentScript = document.currentScript;
  var apiUrl = (currentScript && currentScript.getAttribute('data-api-url')) || '/api/chat';
  var title = (currentScript && currentScript.getAttribute('data-title')) || 'Chat with us';
  var greeting =
    (currentScript && currentScript.getAttribute('data-greeting')) ||
    "Hi! Ask me anything about this site or business.";

  var css =
    '.wcb-btn{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;' +
    'background:#4f46e5;color:#fff;border:none;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer;' +
    'font-size:24px;z-index:999999;display:flex;align-items:center;justify-content:center;}' +
    '.wcb-panel{position:fixed;bottom:88px;right:20px;width:340px;max-width:90vw;height:460px;' +
    'max-height:70vh;background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.3);' +
    'display:none;flex-direction:column;overflow:hidden;z-index:999999;font-family:system-ui,sans-serif;}' +
    '.wcb-panel.wcb-open{display:flex;}' +
    '.wcb-header{background:#4f46e5;color:#fff;padding:14px 16px;font-weight:600;display:flex;' +
    'justify-content:space-between;align-items:center;}' +
    '.wcb-close{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;}' +
    '.wcb-messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;' +
    'background:#f7f7fb;}' +
    '.wcb-msg{max-width:80%;padding:8px 12px;border-radius:14px;font-size:14px;line-height:1.4;' +
    'white-space:pre-wrap;word-wrap:break-word;}' +
    '.wcb-msg.wcb-user{align-self:flex-end;background:#4f46e5;color:#fff;border-bottom-right-radius:2px;}' +
    '.wcb-msg.wcb-bot{align-self:flex-start;background:#fff;color:#111;border:1px solid #e5e5ef;' +
    'border-bottom-left-radius:2px;}' +
    '.wcb-msg.wcb-typing{align-self:flex-start;color:#888;font-style:italic;font-size:13px;}' +
    '.wcb-inputrow{display:flex;border-top:1px solid #eee;padding:8px;gap:6px;background:#fff;}' +
    '.wcb-input{flex:1;border:1px solid #ddd;border-radius:8px;padding:8px 10px;font-size:14px;' +
    'outline:none;resize:none;font-family:inherit;}' +
    '.wcb-send{background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:0 14px;' +
    'font-size:14px;cursor:pointer;}' +
    '.wcb-send:disabled{opacity:.5;cursor:default;}';

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  var btn = document.createElement('button');
  btn.className = 'wcb-btn';
  btn.setAttribute('aria-label', 'Open chat');
  btn.textContent = '💬';

  var panel = document.createElement('div');
  panel.className = 'wcb-panel';
  panel.innerHTML =
    '<div class="wcb-header"><span>' + escapeHtml(title) + '</span>' +
    '<button class="wcb-close" aria-label="Close chat">✕</button></div>' +
    '<div class="wcb-messages"></div>' +
    '<div class="wcb-inputrow">' +
    '<textarea class="wcb-input" rows="1" placeholder="Type a message..."></textarea>' +
    '<button class="wcb-send">Send</button>' +
    '</div>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var messagesEl = panel.querySelector('.wcb-messages');
  var inputEl = panel.querySelector('.wcb-input');
  var sendBtn = panel.querySelector('.wcb-send');
  var closeBtn = panel.querySelector('.wcb-close');

  var history = [];
  var opened = false;

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function addMessage(text, role) {
    var el = document.createElement('div');
    el.className = 'wcb-msg ' + (role === 'user' ? 'wcb-user' : 'wcb-bot');
    el.textContent = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function toggle() {
    opened = !opened;
    panel.classList.toggle('wcb-open', opened);
    if (opened && messagesEl.children.length === 0) {
      addMessage(greeting, 'bot');
    }
    if (opened) inputEl.focus();
  }

  btn.addEventListener('click', toggle);
  closeBtn.addEventListener('click', toggle);

  async function send() {
    var text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    sendBtn.disabled = true;
    addMessage(text, 'user');

    var typingEl = document.createElement('div');
    typingEl.className = 'wcb-msg wcb-typing';
    typingEl.textContent = 'Typing...';
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      var res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: history }),
      });
      var data = await res.json();
      typingEl.remove();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      addMessage(data.reply, 'bot');
      history.push({ role: 'user', text: text });
      history.push({ role: 'assistant', text: data.reply });
      if (history.length > 20) history = history.slice(-20);
    } catch (err) {
      typingEl.remove();
      addMessage("Sorry, I couldn't reach the assistant. Please try again shortly.", 'bot');
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
})();
