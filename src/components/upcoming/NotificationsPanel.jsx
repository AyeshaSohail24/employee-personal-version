import React, { useEffect } from 'react';
import { X, MessageSquareReply } from 'lucide-react';
import { formatDateDisplay } from '../../utils/dateUtils.js';

export default function NotificationsPanel({ isOpen, onClose, candidates = [], onView }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const replied = candidates.filter((c) => c.emailStatus === 'Replied');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-scroll-shell" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <MessageSquareReply size={20} />
            </div>
            <div>
              <h3 className="modal-title">Candidate Replies</h3>
              <p className="modal-subtitle">Replies awaiting HR review</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {replied.length === 0 ? (
            <p className="modal-subtitle">No candidate replies yet.</p>
          ) : (
            <div className="notification-list app-scroll-area">
              {replied.map((c) => (
                <div key={c.id} className={`notification-item ${c.notificationRead ? '' : 'unread'}`}>
                  <div>
                    <div className="table-user-name">{c.fullName}</div>
                    <div className="table-text-secondary" style={{ fontSize: '0.8rem' }}>{c.positionName}</div>
                    <div className="table-text-secondary" style={{ fontSize: '0.75rem' }}>
                      Reply received {formatDateDisplay(c.repliedAt ? c.repliedAt.slice(0, 10) : null)}
                    </div>
                  </div>
                  <button type="button" className="btn-primary" onClick={() => onView(c.id)}>
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
