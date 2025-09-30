import React, { useEffect, useRef, useState } from "react";
import styles from "./QueryBot.module.css";

/**
 * QueryBotPopup
 *
 * Props:
 *  - whatsappNumber (string) — international number WITHOUT + or spaces, e.g. "919876543210"
 *  - whatsappDefaultMsg (string) — optional default text when opening WhatsApp
 *  - searchInputId (string) — optional id of a page input to copy last user query into
 *  - initialOpen (boolean) — whether the popup starts open (default false)
 */
export default function QueryBot({
  whatsappNumber = "919876543210",
  whatsappDefaultMsg = "Hi — I need help with the following:\n",
  searchInputId = undefined,
  initialOpen = false,
}) {
  const [open, setOpen] = useState(initialOpen);
  const [messages, setMessages] = useState([
    {
      id: 1,
      from: "bot",
      text:
        "Hello! 👋 I’m QueryBot — ask me anything about parts, compatibility or searching. If you'd prefer, I can open WhatsApp for a direct chat.",
    },
  ]);
  const [value, setValue] = useState("");
  const [typing, setTyping] = useState(false);
  const listRef = useRef(null);
  const nextIdRef = useRef(2);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, typing, open]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function isQuestion(text) {
    if (!text) return false;
    const t = text.trim().toLowerCase();
    if (t.endsWith("?")) return true;
    return [
      "what",
      "why",
      "how",
      "where",
      "when",
      "who",
      "is",
      "are",
      "can",
      "do",
      "does",
      "will",
    ].some((w) => t.startsWith(w + " "));
  }

  function addMessage(from, text) {
    const id = nextIdRef.current++;
    setMessages((m) => [...m, { id, from, text }]);
    return id;
  }

  function getLastUserText() {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].from === "user") return messages[i].text || "";
    }
    return "";
  }

  function openWhatsApp(prefill = "") {
    if (!whatsappNumber || !/^\d+$/.test(whatsappNumber)) {
      window.alert("WhatsApp number not configured correctly. Please check the component props.");
      return;
    }
    const msg = encodeURIComponent(prefill || whatsappDefaultMsg);
    const url = `https://wa.me/${whatsappNumber}?text=${msg}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleCopyToSearch(text) {
    if (!searchInputId) {
      return false;
    }
    const el = document.getElementById(searchInputId);
    if (!el) return false;
    el.value = text;
    el.focus();
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  function handleSubmit(e) {
    e?.preventDefault?.();
    const text = value.trim();
    if (!text) return;
    addMessage("user", text);
    setValue("");

    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      if (isQuestion(text)) {
        addMessage(
          "bot",
          `Good question — I can help with that. If you'd prefer, click "Chat on WhatsApp" and I'll prefill your message.`
        );
      } else if (/fit|compatib|part number|part no|model|year/i.test(text)) {
        addMessage(
          "bot",
          `Thanks — try searching by make / model / year in the search bar. Want me to copy "${text}" into the search box for you?`
        );
      } else {
        addMessage("bot", `Got it — I can also forward this to WhatsApp support for a quicker reply.`);
      }
    }, 700);
  }

  return (
    <>
      {/* Floating launcher button */}
      <button
        aria-label={open ? "Close chat" : "Open chat"}
        onClick={() => setOpen((s) => !s)}
        className={styles.launcher}
      >
        <span className={styles.launcherAvatar}>Q</span>
        <span className={styles.launcherText}>Chat</span>
        <span className={styles.launcherBadge} aria-hidden="true" />
      </button>

      {/* Popup panel */}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ""}`} role="dialog" aria-hidden={!open} aria-label="QueryBot chat">
        <div className={styles.panelHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.headerAvatar}>Q</div>
            <div>
              <div className={styles.headerTitle}>QueryBot</div>
              <div className={styles.headerSubtitle}>Support · WhatsApp available</div>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button onClick={() => openWhatsApp(getLastUserText() || "")} className={`${styles.iconBtn} ${styles.waBtn}`} title="Chat on WhatsApp">
              WhatsApp
            </button>
            <button onClick={() => setOpen(false)} className={styles.iconBtn} title="Close chat" aria-label="Close chat">✕</button>
          </div>
        </div>

        <div ref={listRef} className={styles.messages} aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`${styles.messageRow} ${m.from === "bot" ? styles.botRow : styles.userRow}`}>
              <div className={`${styles.bubble} ${m.from === "bot" ? styles.botBubble : styles.userBubble}`}>
                <div className={styles.messageText}>{m.text}</div>

                {m.from === "bot" && (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      onClick={() => openWhatsApp(getLastUserText() || "")}
                      className={`${styles.btn} ${styles.wa}`}
                    >
                      Chat on WhatsApp
                    </button>

                    {searchInputId && (
                      <button
                        type="button"
                        onClick={() => {
                          const lastUser = getLastUserText();
                          const ok = handleCopyToSearch(lastUser);
                          if (!ok) window.alert("Search input not found on page");
                        }}
                        className={styles.btn}
                      >
                        Copy to search
                      </button>
                    )}
                  </div>
                )}

                {m.from === "user" && (
                  <div className={styles.actionsUser}>
                    <button
                      type="button"
                      onClick={() => openWhatsApp(whatsappDefaultMsg + "\n" + m.text)}
                      className={`${styles.btn} ${styles.wa}`}
                    >
                      Ask on WhatsApp
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {typing && (
            <div className={`${styles.messageRow} ${styles.botRow}`}>
              <div className={`${styles.bubble} ${styles.botBubble}`}>
                <span className={styles.typing}>Typing</span>
                <span className={styles.pulse}>...</span>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className={styles.inputRow}>
          <input
            className={styles.input}
            placeholder="Type your question (e.g. Will this fit my 2016 Honda City?)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Type your message"
          />

          <button type="submit" className={styles.sendBtn} aria-label="Send message">
            Send
          </button>
        </form>

        <div className={styles.smallNote}>
          Pro tip: ask a full question — the bot detects questions automatically. Click the WhatsApp button for direct help.
        </div>
      </div>
    </>
  );
}
