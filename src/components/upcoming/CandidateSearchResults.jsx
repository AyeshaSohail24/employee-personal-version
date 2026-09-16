import React from 'react';
import { Link } from 'react-router-dom';
import { splitByMatch, buildMessageSnippet } from '../../domain/candidateDomain.js';

function formatResultDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

function Highlighted({ text, query }) {
  return (
    <>
      {splitByMatch(text, query).map((part, i) =>
        part.match ? (
          <mark key={i} className="search-highlight">{part.text}</mark>
        ) : (
          <React.Fragment key={i}>{part.text}</React.Fragment>
        )
      )}
    </>
  );
}

/**
 * Gmail-style search results: one row per matching candidate (name + email searched directly,
 * message subject/body searched via each candidate's full thread), showing the matched
 * message's subject and a highlighted snippet. Rows link straight into the Candidate Thread
 * page — read-only list, all data comes from candidateEmailService.searchCandidates().
 */
export default function CandidateSearchResults({ results, query }) {
  if (results.length === 0) {
    return (
      <div className="directory-empty-card">
        <p className="empty-description">No results for &ldquo;{query}&rdquo;.</p>
      </div>
    );
  }

  return (
    <div className="search-results-card">
      {results.map(({ candidate, message }) => (
        <Link key={candidate.id} to={`/upcoming/${candidate.id}`} className="search-result-row">
          <div className="search-result-avatar">{candidate.photo || (candidate.fullName || '?').slice(0, 2).toUpperCase()}</div>
          <div className="search-result-body">
            <div className="search-result-top">
              <span className="search-result-name">
                <Highlighted text={candidate.fullName} query={query} />
              </span>
              {message && <span className="search-result-date">{formatResultDate(message.at)}</span>}
            </div>
            {message ? (
              <>
                <div className="search-result-subject">
                  <Highlighted text={message.subject} query={query} />
                </div>
                <div className="search-result-snippet">
                  <Highlighted text={buildMessageSnippet(message.body, query)} query={query} />
                </div>
              </>
            ) : (
              <div className="search-result-snippet">No messages yet — {candidate.email}</div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
