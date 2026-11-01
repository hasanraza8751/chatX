import { useCallback, useEffect, useRef, useState } from 'react';
import { translateMessage } from '../api/translation.js';

// Isolated per-message translation state for the chat window.
// Never touches sending, sockets, history, receipts or uploads.
// Repeat protection: backend cache (messageId+target) + in-flight dedupe +
// completed-key set, so the same message is never translated twice.
//
// Per-message state: { status: 'loading'|'done'|'error'|'skipped', text?,
// source?, target, hidden? }. Same-language responses become 'skipped'
// (renders nothing, hiding Translate via the existing backend detector).
export function useMessageTranslation(convId, target) {
  const [states, setStates] = useState({});
  const inflight = useRef(new Map());
  const doneKeys = useRef(new Set());
  const autoQueue = useRef([]);

  // New conversation or new target: drop UI state (backend cache keeps repeats free).
  useEffect(() => {
    setStates({});
    inflight.current.clear();
    doneKeys.current.clear();
    autoQueue.current = [];
  }, [convId, target]);

  const request = useCallback((message, targetLanguage) => {
    const id = String(message?._id || '');
    if (!id || !targetLanguage) return;
    if (message.messageType !== 'text' || !message.content) return;
    const key = `${id}:${targetLanguage}`;
    if (inflight.current.has(key) || doneKeys.current.has(key)) return;
    setStates((prev) => ({ ...prev, [id]: { status: 'loading', target: targetLanguage } }));
    const p = translateMessage(id, targetLanguage)
      .then((data) => {
        if (data && data.isTranslated) {
          doneKeys.current.add(key);
          setStates((prev) => ({
            ...prev,
            [id]: { status: 'done', text: data.translatedText, source: data.sourceLanguage, target: targetLanguage, hidden: false },
          }));
        } else {
          // Same-language or nothing to translate: hide the Translate action.
          doneKeys.current.add(key);
          setStates((prev) => ({ ...prev, [id]: { status: 'skipped', target: targetLanguage } }));
        }
      })
      .catch(() => {
        setStates((prev) => ({ ...prev, [id]: { status: 'error', target: targetLanguage } }));
      })
      .finally(() => {
        inflight.current.delete(key);
      });
    inflight.current.set(key, p);
  }, []);

  const retry = useCallback((message, targetLanguage) => {
    const id = String(message?._id || '');
    doneKeys.current.delete(`${id}:${targetLanguage}`);
    request(message, targetLanguage);
  }, [request]);

  const toggle = useCallback((id) => {
    setStates((prev) => {
      const cur = prev[String(id)];
      if (!cur || cur.status !== 'done') return prev;
      return { ...prev, [String(id)]: { ...cur, hidden: !cur.hidden } };
    });
  }, []);

  // Auto-translate queue: render phase only enqueues ids (dedupe by id);
  // flushAuto() performs the requests from an effect.
  const queueAuto = useCallback((message) => {
    const id = String(message?._id || '');
    if (!id) return;
    if (!autoQueue.current.includes(id)) autoQueue.current.push(id);
  }, []);

  const flushAuto = useCallback((messagesById, targetLanguage) => {
    if (autoQueue.current.length === 0) return;
    const ids = autoQueue.current;
    autoQueue.current = [];
    ids.forEach((mid) => {
      const m = messagesById[String(mid)];
      if (m) request(m, targetLanguage);
    });
  }, [request]);

  return { states, request, retry, toggle, queueAuto, flushAuto };
}
