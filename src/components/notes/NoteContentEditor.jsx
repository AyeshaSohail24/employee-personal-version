import React, { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Underline, Highlighter, List, ListOrdered } from 'lucide-react';
import { NOTE_HIGHLIGHT_COLORS } from '../../domain/noteDomain.js';

/**
 * Small shared contentEditable-based editor for note content, offering Bold/Italic/Underline,
 * a small fixed-palette Highlight, and Bulleted/Numbered lists — no heading/font/color/table/
 * link/image toolbar, no rich-text library. Reused identically by NoteEditorModal (Card View)
 * and NotesDocumentView (inline editing + new blank document) so there is exactly one
 * formatting implementation in the whole app.
 *
 * Controlled by `valueHtml` (already-sanitized-or-trusted HTML) / `onChangeHtml`. Callers are
 * responsible for sanitizing on SAVE (notesService does this centrally); this component only
 * sanitizes pasted content (converts to plain text) since raw clipboard HTML is the one input
 * source that isn't already our own trusted output.
 */
export default function NoteContentEditor({ valueHtml, onChangeHtml, placeholder = 'Write your note here...', className = '', minHeight }) {
  const editorRef = useRef(null);
  const skipNextSync = useRef(false);
  const highlightControlRef = useRef(null);
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false, bulletList: false, numberedList: false });
  const [isHighlightMenuOpen, setIsHighlightMenuOpen] = useState(false);

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
        // Bulleted/Numbered list toggle state — reliably supported by queryCommandState in every
        // browser this app targets. Highlight has no equivalent toggle query (there is no native
        // command backing our custom <mark> approach), so its button never shows an "active"
        // state — deliberately not over-engineering selection-based highlight detection.
        bulletList: document.queryCommandState('insertUnorderedList'),
        numberedList: document.queryCommandState('insertOrderedList'),
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

  // Bulleted/Numbered List reuse the browser's own native list commands, which produce real
  // semantic <ul>/<ol>/<li> markup and already implement Enter-to-continue /
  // Enter-on-empty-item-to-exit behavior natively — no custom Enter-key handling needed.
  const applyList = (command) => (e) => {
    e.preventDefault();
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, null);
    refreshActiveFormats();
    emitChange();
  };

  // Wraps the current selection in <mark data-highlight="color">, preserving any existing
  // formatting (bold/italic/underline/list) inside the selection so highlight always combines
  // rather than replaces. No-ops when nothing is selected — there is no "start typing
  // highlighted" mode, matching the toolbar's other one-shot formatting actions.
  const applyHighlightColor = (colorKey) => (e) => {
    e.preventDefault();
    setIsHighlightMenuOpen(false);
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    const mark = document.createElement('mark');
    mark.setAttribute('data-highlight', colorKey);
    try {
      range.surroundContents(mark);
    } catch (err) {
      // surroundContents throws when the range's boundaries don't cleanly wrap a single
      // subtree (e.g. a selection spanning across a <b> and plain text) — extract+reinsert
      // handles any arbitrary range instead.
      const contents = range.extractContents();
      mark.appendChild(contents);
      range.insertNode(mark);
    }

    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(mark);
    selection.addRange(newRange);

    emitChange();
  };

  // Removes highlight formatting from any <mark> that intersects the current selection, while
  // leaving the mark's own contents (text, and any bold/italic/underline/list structure inside
  // it) exactly where they were — only the highlight boundary itself is unwrapped.
  const removeHighlight = (e) => {
    e.preventDefault();
    setIsHighlightMenuOpen(false);
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    const marks = editorRef.current.querySelectorAll('mark');
    marks.forEach((markEl) => {
      if (range.collapsed ? markEl.contains(range.startContainer) || markEl === range.startContainer : range.intersectsNode(markEl)) {
        const parent = markEl.parentNode;
        if (!parent) return;
        while (markEl.firstChild) parent.insertBefore(markEl.firstChild, markEl);
        parent.removeChild(markEl);
      }
    });

    emitChange();
  };

  const toggleHighlightMenu = (e) => {
    e.preventDefault(); // keep the current text selection intact while the popover opens
    setIsHighlightMenuOpen((open) => !open);
  };

  // Closes the highlight popover on any click outside it — same pattern as Select.jsx's
  // click-outside handling, so behavior is consistent across the app's small popovers/menus.
  useEffect(() => {
    if (!isHighlightMenuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (highlightControlRef.current && !highlightControlRef.current.contains(event.target)) {
        setIsHighlightMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isHighlightMenuOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && isHighlightMenuOpen) {
      setIsHighlightMenuOpen(false);
    }
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

        <span className="note-format-divider" aria-hidden="true" />

        <div className="note-highlight-control" ref={highlightControlRef}>
          <button
            type="button"
            className={`note-format-btn ${isHighlightMenuOpen ? 'active' : ''}`}
            title="Highlight"
            aria-haspopup="menu"
            aria-expanded={isHighlightMenuOpen}
            onMouseDown={toggleHighlightMenu}
          >
            <Highlighter size={14} />
          </button>
          {isHighlightMenuOpen && (
            <div className="note-highlight-popover" role="menu">
              {Object.entries(NOTE_HIGHLIGHT_COLORS).map(([colorKey, meta]) => (
                <button
                  key={colorKey}
                  type="button"
                  role="menuitem"
                  className="note-highlight-option"
                  onMouseDown={applyHighlightColor(colorKey)}
                >
                  <span className="note-highlight-swatch" style={{ backgroundColor: meta.swatchColor }} aria-hidden="true" />
                  <span>{meta.label}</span>
                </button>
              ))}
              <div className="note-highlight-popover-divider" aria-hidden="true" />
              <button type="button" role="menuitem" className="note-highlight-option" onMouseDown={removeHighlight}>
                <span className="note-highlight-swatch note-highlight-swatch--none" aria-hidden="true" />
                <span>Remove Highlight</span>
              </button>
            </div>
          )}
        </div>

        <span className="note-format-divider" aria-hidden="true" />

        <button type="button" className={`note-format-btn ${activeFormats.bulletList ? 'active' : ''}`} title="Bulleted List" onMouseDown={applyList('insertUnorderedList')}>
          <List size={14} />
        </button>
        <button type="button" className={`note-format-btn ${activeFormats.numberedList ? 'active' : ''}`} title="Numbered List" onMouseDown={applyList('insertOrderedList')}>
          <ListOrdered size={14} />
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
