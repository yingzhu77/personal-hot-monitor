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
    <div className="export-btn-wrap">
      <button
        className="export-btn-trigger"
        onClick={() => setOpen(!open)}
      >
        <Download className="h-3.5 w-3.5" />
        导出报告
      </button>

      {open && (
        <>
          <div
            className="export-btn-overlay"
            onClick={() => setOpen(false)}
          />
          <div className="export-btn-dropdown">
            <button
              className="export-btn-item"
              onClick={() => downloadReport('daily')}
            >
              <FileText className="h-4 w-4 export-icon-blue" />
              <div>
                <div className="export-btn-label">今日日报 (Markdown)</div>
                <div className="export-btn-date">{today}</div>
              </div>
            </button>
            <button
              className="export-btn-item"
              onClick={() => downloadReport('weekly')}
            >
              <Calendar className="h-4 w-4 export-icon-green" />
              <div>
                <div className="export-btn-label">本周周报 (Markdown)</div>
                <div className="export-btn-date">{weekStartStr} ~ {today}</div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
