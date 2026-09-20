import { useState } from 'react';

/**
 * Drop-in replacement for a bare `<div className="emp-avatar-circle">{initials}</div>` (or the
 * card/table-avatar variants) — renders the person's real photo when one is available (currently
 * only ever a real intern's `photo_url` from the Interns DB), falling back to the existing
 * initials circle otherwise, including if the image URL fails to load. `className` selects which
 * existing avatar CSS class supplies the size/gradient/font (emp-avatar-circle, emp-card-avatar,
 * table-avatar, ...) — this component adds no new sizing of its own, it only chooses img vs text.
 */
export default function Avatar({ photoUrl, initials, className = 'emp-avatar-circle', style }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (photoUrl && !imageFailed) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={className}
        style={{ objectFit: 'cover', ...style }}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div className={className} style={style}>
      {initials}
    </div>
  );
}
