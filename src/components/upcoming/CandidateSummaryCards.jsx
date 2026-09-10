import React from 'react';
import { Users, Mail, Send, MessageSquareReply, CheckCircle2, XCircle } from 'lucide-react';

const CARD_DEFS = [
  { key: 'shortlisted', label: 'Shortlisted', icon: Users, bg: '#EFF6FF', color: '#2563EB' },
  { key: 'pendingEmail', label: 'Pending Email', icon: Mail, bg: '#FFFBEB', color: '#D97706' },
  { key: 'emailSent', label: 'Email Sent', icon: Send, bg: '#F1F5F9', color: '#475569' },
  { key: 'replies', label: 'Replies', icon: MessageSquareReply, bg: '#E6F7F8', color: '#0E848D' },
  { key: 'accepted', label: 'Accepted', icon: CheckCircle2, bg: '#ECFDF5', color: '#059669' },
  { key: 'rejected', label: 'Rejected', icon: XCircle, bg: '#FEF2F2', color: '#DC2626' },
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
