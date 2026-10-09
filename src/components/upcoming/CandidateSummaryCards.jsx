import React from 'react';
import { Users, Mail, Send, MessageSquareReply, CheckCircle2, XCircle } from 'lucide-react';

const CARD_DEFS = [
  { key: 'shortlisted', label: 'Shortlisted', icon: Users, bg: 'var(--color-primary-light)', color: 'var(--primary)' },
  { key: 'pendingEmail', label: 'Pending Email', icon: Mail, bg: 'var(--warn-bg)', color: 'var(--warn-text)' },
  { key: 'emailSent', label: 'Email Sent', icon: Send, bg: 'var(--soft)', color: 'var(--navy-700)' },
  { key: 'replies', label: 'Replies', icon: MessageSquareReply, bg: 'var(--color-primary-light)', color: 'var(--primary-600)' },
  { key: 'accepted', label: 'Accepted', icon: CheckCircle2, bg: 'var(--ok-bg)', color: 'var(--ok-text)' },
  { key: 'rejected', label: 'Rejected', icon: XCircle, bg: 'var(--down-bg)', color: 'var(--down-text)' },
];

export default function CandidateSummaryCards({ summary = {}, loading = false }) {
  return (
    <div className="candidate-summary-grid">
      {CARD_DEFS.map(({ key, label, icon: Icon, bg, color }) => (
        <div key={key} className="candidate-summary-card">
          <div className="candidate-summary-icon" style={{ backgroundColor: bg, color }}>
            <Icon size={18} />
          </div>
          <div>
            <div className="candidate-summary-value">{loading ? '—' : (summary[key] ?? 0)}</div>
            <div className="candidate-summary-label">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
