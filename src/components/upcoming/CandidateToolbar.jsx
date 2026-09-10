import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { Select } from '../common/Select.jsx';

export default function CandidateToolbar({
  search,
  onSearchChange,
  selectedDept,
  onDeptChange,
  selectedOfferType = 'All',
  onOfferTypeChange,
  selectedEmailStatus = 'All',
  onEmailStatusChange,
  selectedResponse = 'All',
  onResponseChange,
  onResetFilters,
  departments = [],
  showResponseFilter = true,
  hasActiveFilters = false,
}) {
  return (
    <div className="directory-toolbar-card">
      <div className="toolbar-top-row">
        <div className="toolbar-search-box">
          <Search size={18} className="toolbar-search-icon" />
          <input
            type="text"
            className="toolbar-search-input"
            placeholder="Search candidate name, email, position..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="toolbar-bottom-row">
        <div className="filters-group">
          <div className="filter-item">
            <label htmlFor="cand-dept-filter">Department:</label>
            <Select
              id="cand-dept-filter"
              variant="filter"
              value={selectedDept}
              onChange={(e) => onDeptChange(e.target.value)}
              placeholder="All Departments"
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
          </div>

          <div className="filter-item">
            <label htmlFor="cand-offer-filter">Offer Type:</label>
            <Select
              id="cand-offer-filter"
              variant="filter"
              value={selectedOfferType}
              onChange={(e) => onOfferTypeChange(e.target.value)}
              options={[
                { value: 'All', label: 'All' },
                { value: 'Paid', label: 'Paid' },
                { value: 'Unpaid', label: 'Unpaid' },
              ]}
            />
          </div>

          <div className="filter-item">
            <label htmlFor="cand-email-status-filter">Email Status:</label>
            <Select
              id="cand-email-status-filter"
              variant="filter"
              value={selectedEmailStatus}
              onChange={(e) => onEmailStatusChange(e.target.value)}
              options={[
                { value: 'All', label: 'All' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Sent', label: 'Sent' },
                { value: 'Replied', label: 'Replied' },
              ]}
            />
          </div>

          {showResponseFilter && (
            <div className="filter-item">
              <label htmlFor="cand-response-filter">Response:</label>
              <Select
                id="cand-response-filter"
                variant="filter"
                value={selectedResponse}
                onChange={(e) => onResponseChange(e.target.value)}
                options={[
                  { value: 'All', label: 'All' },
                  { value: 'Awaiting Response', label: 'Awaiting Response' },
                  { value: 'Accepted', label: 'Accepted' },
                ]}
              />
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <button className="clear-filters-btn" onClick={onResetFilters} type="button">
            <RotateCcw size={14} />
            <span>Reset Filters</span>
          </button>
        )}
      </div>
    </div>
  );
}
