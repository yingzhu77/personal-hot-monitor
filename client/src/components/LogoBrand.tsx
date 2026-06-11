import { useState } from 'react';
import { X } from 'lucide-react';

export function LogoBrand() {
  const [hidden, setHidden] = useState(false);

  if (hidden) {
    return (
      <div className="logo-brand-collapsed">
        <button
          className="logo-expand-btn"
          onClick={() => setHidden(false)}
          aria-label="展开 Logo"
          title="展开 Logo"
        >
          <img src="/logo.png" alt="ACG Pulse" className="logo-expand-img" />
        </button>
      </div>
    );
  }

  return (
    <div className="logo-brand glass-panel">
      <button
        className="logo-close-btn"
        onClick={() => setHidden(true)}
        aria-label="收起 Logo"
        title="收起 Logo"
      >
        <X className="h-4 w-4" />
      </button>
      <img src="/logo.png" alt="ACG Pulse" className="logo-brand-img" />
      <h1 className="logo-brand-title">ACG Pulse</h1>
      <p className="logo-brand-sub">AI 游戏情报雷达</p>
    </div>
  );
}
