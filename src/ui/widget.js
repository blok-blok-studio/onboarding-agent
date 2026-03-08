(function() {
  "use strict";

  // ── Configuration ─────────────────────────────────────────
  // Detect the agent URL from this script's src attribute
  var scripts = document.getElementsByTagName("script");
  var thisScript = scripts[scripts.length - 1];
  var agentUrl = thisScript.getAttribute("data-url") ||
    thisScript.src.replace(/\/widget\.js.*$/, "");

  var position = thisScript.getAttribute("data-position") || "right";
  var greeting = thisScript.getAttribute("data-greeting") || "";
  var color = thisScript.getAttribute("data-color") || "";
  var delay = parseInt(thisScript.getAttribute("data-delay") || "3000", 10);

  // ── State ─────────────────────────────────────────────────
  var isOpen = false;
  var hasOpened = false;
  var brandColor = color || "#2563eb";
  var brandName = "Chat with us";
  var bubble, widget, iframe, badge, pulseEl;

  // ── Load branding from the agent ──────────────────────────
  function loadConfig() {
    fetch(agentUrl + "/api/config")
      .then(function(r) { return r.json(); })
      .then(function(cfg) {
        if (cfg.primaryColor && !color) brandColor = cfg.primaryColor;
        if (cfg.brandName) brandName = cfg.agentName || cfg.brandName;
        applyStyles();
      })
      .catch(function() {});
  }

  // ── Create elements ───────────────────────────────────────
  function create() {
    // Floating bubble button
    bubble = document.createElement("div");
    bubble.id = "onboarding-agent-bubble";
    bubble.setAttribute("role", "button");
    bubble.setAttribute("aria-label", "Open chat");
    bubble.setAttribute("tabindex", "0");
    bubble.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>' +
      '</svg>';

    // Notification badge
    badge = document.createElement("span");
    badge.id = "onboarding-agent-badge";
    badge.textContent = "1";
    bubble.appendChild(badge);

    // Pulse animation
    pulseEl = document.createElement("span");
    pulseEl.id = "onboarding-agent-pulse";
    bubble.appendChild(pulseEl);

    // Greeting tooltip
    if (greeting) {
      var tip = document.createElement("div");
      tip.id = "onboarding-agent-tip";
      tip.textContent = greeting;
      bubble.appendChild(tip);
    }

    // Widget container
    widget = document.createElement("div");
    widget.id = "onboarding-agent-widget";

    // Close button
    var closeBtn = document.createElement("button");
    closeBtn.id = "onboarding-agent-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.setAttribute("aria-label", "Close chat");
    widget.appendChild(closeBtn);

    // Chat iframe
    iframe = document.createElement("iframe");
    iframe.id = "onboarding-agent-iframe";
    iframe.setAttribute("title", "Chat");
    iframe.setAttribute("loading", "lazy");
    widget.appendChild(iframe);

    document.body.appendChild(bubble);
    document.body.appendChild(widget);

    // Events
    bubble.addEventListener("click", toggle);
    bubble.addEventListener("keydown", function(e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
    closeBtn.addEventListener("click", toggle);

    // Close on Escape
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && isOpen) toggle();
    });

    applyStyles();

    // Show greeting tip after delay
    if (greeting) {
      setTimeout(function() {
        var tip = document.getElementById("onboarding-agent-tip");
        if (tip && !isOpen) tip.classList.add("show");
        // Auto-hide after 8 seconds
        setTimeout(function() {
          if (tip) tip.classList.remove("show");
        }, 8000);
      }, delay);
    }
  }

  // ── Toggle open/close ─────────────────────────────────────
  function toggle() {
    isOpen = !isOpen;

    if (isOpen && !hasOpened) {
      // Load the chat on first open
      iframe.src = agentUrl + "/widget-chat.html";
      hasOpened = true;
    }

    widget.classList.toggle("open", isOpen);
    bubble.classList.toggle("open", isOpen);

    // Hide badge and pulse on first open
    if (isOpen) {
      badge.style.display = "none";
      pulseEl.style.display = "none";
      var tip = document.getElementById("onboarding-agent-tip");
      if (tip) tip.classList.remove("show");
    }

    // Update aria
    bubble.setAttribute("aria-label", isOpen ? "Close chat" : "Open chat");
    bubble.innerHTML = isOpen
      ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
      : '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  }

  // ── Inject styles ─────────────────────────────────────────
  function applyStyles() {
    var existing = document.getElementById("onboarding-agent-styles");
    if (existing) existing.remove();

    var isLeft = position === "left";
    var posRule = isLeft ? "left: 20px;" : "right: 20px;";
    var widgetPos = isLeft ? "left: 20px;" : "right: 20px;";
    var tipPos = isLeft ? "left: 72px; right: auto;" : "right: 72px; left: auto;";

    var style = document.createElement("style");
    style.id = "onboarding-agent-styles";
    style.textContent =
      "#onboarding-agent-bubble {" +
        "position: fixed; bottom: 20px; " + posRule +
        "width: 60px; height: 60px; border-radius: 50%;" +
        "background: " + brandColor + "; color: #fff;" +
        "display: flex; align-items: center; justify-content: center;" +
        "cursor: pointer; z-index: 999998;" +
        "box-shadow: 0 4px 20px rgba(0,0,0,0.3);" +
        "transition: transform 0.2s, box-shadow 0.2s;" +
      "}" +
      "#onboarding-agent-bubble:hover {" +
        "transform: scale(1.08); box-shadow: 0 6px 28px rgba(0,0,0,0.4);" +
      "}" +
      "#onboarding-agent-bubble.open {" +
        "background: #333;" +
      "}" +
      "#onboarding-agent-badge {" +
        "position: absolute; top: -4px; right: -4px;" +
        "background: #ef4444; color: #fff;" +
        "width: 22px; height: 22px; border-radius: 50%;" +
        "font-size: 12px; font-weight: 700;" +
        "display: flex; align-items: center; justify-content: center;" +
        "font-family: -apple-system, sans-serif;" +
        "border: 2px solid #fff;" +
      "}" +
      "#onboarding-agent-pulse {" +
        "position: absolute; top: 0; left: 0;" +
        "width: 60px; height: 60px; border-radius: 50%;" +
        "background: " + brandColor + ";" +
        "animation: onboarding-pulse 2s ease-in-out infinite;" +
        "z-index: -1;" +
      "}" +
      "@keyframes onboarding-pulse {" +
        "0% { transform: scale(1); opacity: 0.5; }" +
        "100% { transform: scale(1.6); opacity: 0; }" +
      "}" +
      "#onboarding-agent-tip {" +
        "position: absolute; bottom: 72px; " + tipPos +
        "background: #fff; color: #111;" +
        "padding: 12px 18px; border-radius: 12px;" +
        "font-size: 14px; font-family: -apple-system, sans-serif;" +
        "box-shadow: 0 4px 20px rgba(0,0,0,0.15);" +
        "white-space: nowrap; pointer-events: none;" +
        "opacity: 0; transform: translateY(8px);" +
        "transition: opacity 0.3s, transform 0.3s;" +
        "max-width: 260px; white-space: normal;" +
      "}" +
      "#onboarding-agent-tip.show {" +
        "opacity: 1; transform: translateY(0);" +
      "}" +
      "#onboarding-agent-tip::after {" +
        "content: ''; position: absolute; bottom: -6px;" +
        (isLeft ? "left: 16px;" : "right: 16px;") +
        "width: 12px; height: 12px; background: #fff;" +
        "transform: rotate(45deg);" +
      "}" +
      "#onboarding-agent-widget {" +
        "position: fixed; bottom: 92px; " + widgetPos +
        "width: 400px; height: 600px;" +
        "border-radius: 16px; overflow: hidden;" +
        "box-shadow: 0 20px 60px rgba(0,0,0,0.4);" +
        "z-index: 999999;" +
        "opacity: 0; transform: translateY(20px) scale(0.95);" +
        "pointer-events: none;" +
        "transition: opacity 0.3s, transform 0.3s;" +
      "}" +
      "#onboarding-agent-widget.open {" +
        "opacity: 1; transform: translateY(0) scale(1);" +
        "pointer-events: auto;" +
      "}" +
      "#onboarding-agent-close {" +
        "position: absolute; top: 8px; right: 8px;" +
        "width: 32px; height: 32px; border-radius: 50%;" +
        "background: rgba(0,0,0,0.5); color: #fff;" +
        "border: none; font-size: 20px; cursor: pointer;" +
        "display: flex; align-items: center; justify-content: center;" +
        "z-index: 10; opacity: 0; transition: opacity 0.2s;" +
      "}" +
      "#onboarding-agent-widget:hover #onboarding-agent-close {" +
        "opacity: 1;" +
      "}" +
      "#onboarding-agent-iframe {" +
        "width: 100%; height: 100%; border: none; background: #111;" +
      "}" +
      "@media (max-width: 480px) {" +
        "#onboarding-agent-widget {" +
          "position: fixed; top: 0; left: 0; right: 0; bottom: 0;" +
          "width: 100%; height: 100%; border-radius: 0;" +
        "}" +
        "#onboarding-agent-widget.open + #onboarding-agent-bubble," +
        "#onboarding-agent-bubble.open { display: none; }" +
        "#onboarding-agent-close { opacity: 1 !important; }" +
      "}";

    document.head.appendChild(style);
  }

  // ── Initialize ────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() { loadConfig(); create(); });
  } else {
    loadConfig();
    create();
  }
})();
