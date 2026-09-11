import React, { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Underline } from 'lucide-react';

/**
 * Small shared contentEditable-based editor for note content, offering Bold/Italic/Underline
 * only — no heading/font/color/table/link/image toolbar, no rich-text library. Reused
 * identically by NoteEditorModal (Card View) and NotesDocumentView (inline editing + new blank
 * document) so there is exactly one formatting implementation in the whole app.
 *
 * Controlled by `valueHtml` (already-sanitized-or-trusted HTML) / `onChangeHtml`. Callers are
 * responsible for sanitizing on SAVE (notesService does this centrally); this component only
 * sanitizes pasted content (converts to plain text) since raw clipboard HTML is the one input
 * source that isn't already our own trusted output.
 */
export default function NoteContentEditor({ valueHtml, onChangeHtml, placeholder = 'Write your note here...', className = '', minHeight }) {
  const editorRef = useRef(null);
  const skipNextSync = useRef(false);
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false });

  // Only push `valueHtml` into the DOM when it changes for a reason OTHER than this editor's
  // own onInput (switching notes, discarding a draft, loading a legacy plain note) — never on
  // every keystroke, which would fight the browser's own cursor position.
  useEffect(() => {
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    if (editorRef.current && editorRef.current.innerHTML !== (valueHtml || '')) {
      editorRef.current.innerHTML = valueHtml || '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueHtml]);

  const emitChange = () => {
    skipNextSync.current = true;
    onChangeHtml(editorRef.current ? editorRef.current.innerHTML : '');
  };

  const refreshActiveFormats = () => {
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      });
    } catch (err) {
      // queryCommandState can throw outside a focused editable context — safe to ignore.
    }
  };

  const applyFormat = (command) => (e) => {
    e.preventDefault(); // keep focus/selection in the editor instead of the toolbar button
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, null);
    refreshActiveFormats();
    emitChange();
  };

  const handleKeyDown = (e) => {
    const isMod = e.metaKey || e.ctrlKey;
    if (!isMod) return;
    const key = e.key.toLowerCase();
    if (key === 'b') { e.preventDefault(); applyFormat('bold')(e); }
    else if (key === 'i') { e.preventDefault(); applyFormat('italic')(e); }
    else if (key === 'u') { e.preventDefault(); applyFormat('underline')(e); }
  };

  // Pasting external content is converted to plain text — this sidesteps the hardest
  // sanitization case (arbitrary third-party HTML) entirely rather than trying to filter it.
  const handlePaste = (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
    emitChange();
  };

  return (
    <div className={`note-content-editor ${className}`}>
      <div className="note-content-toolbar" role="toolbar" aria-label="Text formatting">
        <button type="button" className={`note-format-btn ${activeFormats.bold ? 'active' : ''}`} title="Bold (Ctrl+B)" onMouseDown={applyFormat('bold')}>
          <Bold size={14} />
        </button>
        <button type="button" className={`note-format-btn ${activeFormats.italic ? 'active' : ''}`} title="Italic (Ctrl+I)" onMouseDown={applyFormat('italic')}>
          <Italic size={14} />
        </button>
        <button type="button" className={`note-format-btn ${activeFormats.underline ? 'active' : ''}`} title="Underline (Ctrl+U)" onMouseDown={applyFormat('underline')}>
          <Underline size={14} />
        </button>
      </div>
      <div
        ref={editorRef}
        className="note-content-editable"
        style={minHeight ? { minHeight } : undefined}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emitChange}
        onKeyDown={handleKeyDown}
        onKeyUp={refreshActiveFormats}
        onMouseUp={refreshActiveFormats}
        onFocus={refreshActiveFormats}
        onPaste={handlePaste}
      />
    </div>
  );
}
