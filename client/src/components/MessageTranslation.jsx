import { languageName } from '../utils/languages.js';
import { TranslateIcon } from './icons.jsx';

// Small translation block rendered inside a text bubble, under the original.
// Original message is always preserved; translation animates in below it.
// Matches the neumorphic/glass system; no heavy panels.
// variant="ask-prompt": fresh foreign incoming message in ASK mode renders a
// subtle "Translate to X?" prompt instead of the plain button.
export default function MessageTranslation({ state, target, variant, onTranslate, onToggle, onRetry }) {
  const targetName = languageName(target) || 'English';
  if (!state && variant === 'ask-prompt') {
    return (
      <span className="tr-ask">
        Translate to {targetName}?{' '}
        <button type="button" className="tr-action" onClick={onTranslate}>
          <TranslateIcon />Translate
        </button>
      </span>
    );
  }
  if (!state) {
    return (
      <button type="button" className="tr-action" onClick={onTranslate}>
        <TranslateIcon />Translate to {targetName}
      </button>
    );
  }
  if (state.status === 'loading') {
    return (
      <span className="tr-loading" aria-live="polite">
        <span className="tr-spinner" aria-hidden="true" />Translating…
      </span>
    );
  }
  if (state.status === 'error') {
    return (
      <span className="tr-error" role="alert">
        Translation unavailable.{' '}
        <button type="button" className="tr-retry" onClick={onRetry}>Retry</button>
      </span>
    );
  }
  if (state.status === 'done' && !state.hidden) {
    return (
      <span className="tr-block">
        <span className="tr-text">{state.text}</span>
        <span className="tr-meta">
          Translated · {languageName(state.source)} → {languageName(target)}{' '}
          <button type="button" className="tr-toggle" onClick={onToggle}>Show original</button>
        </span>
      </span>
    );
  }
  if (state.status === 'done' && state.hidden) {
    return (
      <button type="button" className="tr-action" onClick={onToggle}>
        <TranslateIcon />Show translation
      </button>
    );
  }
  return null;
}
