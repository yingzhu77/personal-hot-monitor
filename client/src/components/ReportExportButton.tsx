import { useState } from 'react';
import { Download, FileText, Calendar } from 'lucide-react';
import { publicApi } from '../services/api';

export interface ReportExportButtonProps {
  currentGame?: string;
}

export function ReportExportButton({ currentGame }: ReportExportButtonProps) {
  const [open, setOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  function downloadReport(type: 'daily' | 'weekly', date?: string, weekStart?: string) {
    const url = publicApi.exportReportUrl({
      type,
      date: date || today,
      weekStart: weekStart || weekStartStr,
      game: currentGame
    });
    window.open(url, '_blank');
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8,
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: '0.8rem',
          transition: 'background 0.15s'
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
      >
        <Download className="h-3.5 w-3.5" />
        导出报告
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 100,
              minWidth: 180, borderRadius: 10, overflow: 'hidden',
              background: 'rgba(20,20,30,0.95)', border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}
          >
            <button
              onClick={() => downloadReport('daily')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '10px 14px', background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: '0.82rem',
                textAlign: 'left'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <FileText className="h-4 w-4" style={{ color: '#6d8cff' }} />
              <div>
                <div style={{ fontWeight: 500 }}>今日日报 (Markdown)</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{today}</div>
              </div>
            </button>
            <button
              onClick={() => downloadReport('weekly')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '10px 14px', background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: '0.82rem',
                textAlign: 'left'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Calendar className="h-4 w-4" style={{ color: '#4ecf98' }} />
              <div>
                <div style={{ fontWeight: 500 }}>本周周报 (Markdown)</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{weekStartStr} ~ {today}</div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
