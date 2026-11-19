import { useState } from 'react';
import { Icon } from './icons';
import { useStore } from '../hooks/useStore';

/**
 * A small persisted notepad: free-text notes plus a checklist. Toggled from the
 * control panel (or the greeting prompt); everything survives reloads.
 */
export function Notepad() {
  const show = useStore((s) => s.state.showNotepad);
  const text = useStore((s) => s.state.notepad);
  const setNotepad = useStore((s) => s.setNotepad);
  const toggle = useStore((s) => s.toggleNotepad);
  const items = useStore((s) => s.state.notepadItems);
  const addItem = useStore((s) => s.addNotepadItem);
  const toggleItem = useStore((s) => s.toggleNotepadItem);
  const removeItem = useStore((s) => s.removeNotepadItem);
  const [draft, setDraft] = useState('');

  if (!show) return null;

  const submit = () => {
    addItem(draft);
    setDraft('');
  };

  return (
    <div className="notepad">
      <div className="notepad-h">
        <span>notes</span>
        <button className="notepad-x" onClick={toggle} aria-label="hide notes">
          {Icon.x}
        </button>
      </div>

      <textarea
        className="notepad-area"
        value={text}
        onChange={(e) => setNotepad(e.target.value)}
        placeholder="a quick thought…"
        spellCheck={false}
        aria-label="notepad"
      />

      {items.length > 0 && (
        <div className="checklist">
          {items.map((it) => (
            <div className={'check-row' + (it.done ? ' done' : '')} key={it.id}>
              <button
                className="check-box"
                onClick={() => toggleItem(it.id)}
                role="checkbox"
                aria-checked={it.done}
                aria-label={it.text}
              >
                {it.done ? Icon.check : null}
              </button>
              <span className="check-text">{it.text}</span>
              <button className="check-del" onClick={() => removeItem(it.id)} aria-label="remove task">
                {Icon.x}
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        className="check-add"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className="check-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="add a task…"
          aria-label="add a task"
          maxLength={200}
        />
        <button className="check-add-btn" type="submit" aria-label="add task">
          +
        </button>
      </form>
    </div>
  );
}
