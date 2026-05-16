"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Link from "next/link";

type Filter = "unassigned" | "assigned" | "all";

interface Label {
  login: string;
  password: string;
  assignedName: string | null;
  qrUrl: string;
}

export function PrintLabelsClient({
  batchName,
  filter,
  labels,
}: {
  batchName: string;
  filter: Filter;
  labels: Label[];
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [renderedQrCount, setRenderedQrCount] = useState(0);

  useEffect(() => {
    if (!printRef.current) return;
    const canvases = printRef.current.querySelectorAll<HTMLCanvasElement>("canvas[data-qr]");
    let done = 0;
    canvases.forEach((c) => {
      const url = c.dataset.qr!;
      QRCode.toCanvas(c, url, { width: 110, margin: 0, errorCorrectionLevel: "M" }, (err) => {
        if (err) console.error("QR error:", err);
        done++;
        setRenderedQrCount(done);
      });
    });
  }, [labels]);

  function setFilter(f: Filter) {
    const url = new URL(window.location.href);
    url.searchParams.set("filter", f);
    window.location.href = url.toString();
  }

  return (
    <>
      {/* Toolbar — hidden when printing */}
      <div className="no-print">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link href={`/admin/kits`} className="text-sm text-text-secondary hover:text-primary">
            ← К партиям
          </Link>
          <h1 className="text-2xl font-bold mt-2 mb-1 text-text-primary">
            Этикетки 58×40 мм
          </h1>
          <p className="text-text-secondary text-sm mb-4">{batchName}</p>

          <div className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-2xl bg-bg-tertiary border border-border">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilter("unassigned")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filter === "unassigned" ? "bg-primary text-white" : "bg-white text-text-secondary border border-border"
                }`}
              >
                Только неактивированные
              </button>
              <button
                onClick={() => setFilter("assigned")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filter === "assigned" ? "bg-primary text-white" : "bg-white text-text-secondary border border-border"
                }`}
              >
                Только назначенные
              </button>
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filter === "all" ? "bg-primary text-white" : "bg-white text-text-secondary border border-border"
                }`}
              >
                Все
              </button>
            </div>

            <div className="ml-auto flex items-center gap-3 text-sm text-text-secondary">
              <span>
                Этикеток: <strong className="text-text-primary">{labels.length}</strong>
                {renderedQrCount < labels.length && labels.length > 0 && (
                  <span className="ml-2 text-text-muted">
                    (QR готовится: {renderedQrCount}/{labels.length})
                  </span>
                )}
              </span>
              <button
                onClick={() => window.print()}
                disabled={renderedQrCount < labels.length}
                className="px-5 py-2 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                🖨️ Печать
              </button>
            </div>
          </div>

          <p className="text-xs text-text-muted mb-4 leading-relaxed">
            <strong>Совет:</strong> в диалоге печати браузера установи: размер бумаги <strong>58×40 мм</strong> (или Custom), поля — <strong>0</strong>, масштаб — <strong>100%</strong>. На термопринтерах (Brother QL, Xprinter, Atol) выбери одноимённую этикетку.
          </p>
        </div>
      </div>

      {/* Print canvas */}
      <div ref={printRef} className="print-area">
        {labels.length === 0 ? (
          <p className="no-print text-center text-text-muted py-10">
            Нет этикеток для печати.
          </p>
        ) : (
          labels.map((l) => (
            <div key={l.login} className="label">
              <div className="label-left">
                <div className="label-brand">XimiLearn · ОГЭ-2026</div>
                <div className="label-line">
                  <span className="label-key">Логин:</span>
                  <span className="label-val">{l.login}</span>
                </div>
                <div className="label-line">
                  <span className="label-key">Пароль:</span>
                  <span className="label-val">{l.password}</span>
                </div>
                <div className="label-wish">Удачи на экзамене!</div>
              </div>
              <div className="label-qr">
                <canvas data-qr={l.qrUrl} />
                <div className="label-qr-hint">Сканируй → войти</div>
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx global>{`
        .print-area {
          display: grid;
          grid-template-columns: repeat(auto-fill, 58mm);
          gap: 2mm;
          padding: 8mm;
          background: #f5f5f5;
        }
        .label {
          width: 58mm;
          height: 40mm;
          background: white;
          box-sizing: border-box;
          padding: 2mm 2.5mm;
          display: flex;
          gap: 2mm;
          font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
          color: #1a1a1a;
          border: 1px dashed #ccc;
          overflow: hidden;
        }
        .label-left {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .label-brand {
          font-size: 6pt;
          font-weight: 700;
          color: #836efe;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .label-line {
          display: flex;
          flex-direction: column;
          margin-top: 1mm;
        }
        .label-key {
          font-size: 5.5pt;
          color: #666;
          line-height: 1;
        }
        .label-val {
          font-size: 9pt;
          font-weight: 700;
          font-family: "SF Mono", Menlo, Consolas, ui-monospace, monospace;
          letter-spacing: 0.02em;
          line-height: 1.15;
          color: #1a1a1a;
        }
        .label-wish {
          font-size: 5pt;
          color: #836efe;
          font-style: italic;
          margin-top: 1mm;
          line-height: 1;
        }
        .label-qr {
          width: 32mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .label-qr canvas {
          width: 30mm !important;
          height: 30mm !important;
          display: block;
        }
        .label-qr-hint {
          font-size: 5pt;
          color: #888;
          margin-top: 0.8mm;
          line-height: 1;
        }

        @media print {
          @page { size: 58mm 40mm; margin: 0; }
          html, body { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
          .print-area {
            display: block !important;
            padding: 0 !important;
            background: white !important;
          }
          .label {
            border: none !important;
            page-break-after: always;
            page-break-inside: avoid;
            break-after: page;
            break-inside: avoid;
          }
          .label:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>
    </>
  );
}
