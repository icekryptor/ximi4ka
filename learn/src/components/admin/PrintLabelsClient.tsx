"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Link from "next/link";

type Filter = "unassigned" | "assigned" | "all";

interface Label {
  login: string;
  password: string;
  assignedName: string | null;
  qrUrl: string;
}

const PAGE_W = 58; // mm
const PAGE_H = 40; // mm

export function PrintLabelsClient({
  batchName,
  filter,
  labels,
}: {
  batchName: string;
  filter: Filter;
  labels: Label[];
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [renderedQrCount, setRenderedQrCount] = useState(0);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Render previews (DOM canvases, just for visual confirmation in tab)
  useEffect(() => {
    if (!previewRef.current) return;
    const canvases = previewRef.current.querySelectorAll<HTMLCanvasElement>("canvas[data-qr]");
    let done = 0;
    canvases.forEach((c) => {
      const url = c.dataset.qr!;
      QRCode.toCanvas(c, url, { width: 110, margin: 0, errorCorrectionLevel: "M" }, () => {
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

  async function generatePdf() {
    if (labels.length === 0) return;
    setGeneratingPdf(true);

    // Render each label as off-screen DOM (with real fonts incl. Cyrillic),
    // convert to canvas via html2canvas, then embed in PDF as image.
    // This guarantees fidelity with the on-screen preview and Cyrillic support.
    const pdf = new jsPDF({ unit: "mm", format: [PAGE_W, PAGE_H], orientation: "landscape" });

    // Off-screen container
    const offscreen = document.createElement("div");
    offscreen.style.cssText = "position:fixed;left:-99999px;top:0;background:white;";
    document.body.appendChild(offscreen);

    const PX_PER_MM = 12; // 58mm × 12 = 696px per label (3x density for crisp print)
    const labelW = PAGE_W * PX_PER_MM;
    const labelH = PAGE_H * PX_PER_MM;

    try {
      for (let i = 0; i < labels.length; i++) {
        const l = labels[i];
        const qrDataUrl = await QRCode.toDataURL(l.qrUrl, {
          width: 360,
          margin: 0,
          errorCorrectionLevel: "M",
        });

        offscreen.innerHTML = `
          <div style="
            width:${labelW}px;
            height:${labelH}px;
            background:white;
            padding:${2.5 * PX_PER_MM}px ${3 * PX_PER_MM}px;
            box-sizing:border-box;
            display:flex;
            gap:${2 * PX_PER_MM}px;
            font-family:-apple-system,'Segoe UI','PT Sans','Helvetica Neue',Helvetica,Arial,sans-serif;
            color:#1a1a1a;
            overflow:hidden;
          ">
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between;">
              <div>
                <div style="
                  font-size:${2.9 * PX_PER_MM}px;
                  font-weight:800;
                  color:#000000;
                  letter-spacing:0.02em;
                  line-height:1;
                  margin-bottom:${1.8 * PX_PER_MM}px;
                ">learn.ximi4ka.ru</div>
                <div style="font-size:${2.4 * PX_PER_MM}px;color:#333;font-weight:600;line-height:1.1;">Логин:</div>
                <div style="
                  font-size:${3.5 * PX_PER_MM}px;
                  font-weight:700;
                  font-family:ui-monospace,Menlo,Consolas,monospace;
                  line-height:1.1;
                  margin-bottom:${1.4 * PX_PER_MM}px;
                ">${l.login}</div>
                <div style="font-size:${2.4 * PX_PER_MM}px;color:#333;font-weight:600;line-height:1.1;">Пароль:</div>
                <div style="
                  font-size:${3.5 * PX_PER_MM}px;
                  font-weight:700;
                  font-family:ui-monospace,Menlo,Consolas,monospace;
                  line-height:1.1;
                ">${l.password}</div>
              </div>
              <div style="
                font-size:${2.5 * PX_PER_MM}px;
                color:#000000;
                font-weight:600;
                font-style:italic;
                line-height:1;
              ">Удачи на экзамене!</div>
            </div>
            <div style="
              width:${30 * PX_PER_MM}px;
              display:flex;
              flex-direction:column;
              align-items:center;
              justify-content:center;
              flex-shrink:0;
            ">
              <img src="${qrDataUrl}" style="width:${30 * PX_PER_MM}px;height:${30 * PX_PER_MM}px;display:block;" alt="" />
              <div style="
                font-size:${2.1 * PX_PER_MM}px;
                color:#555;
                font-weight:600;
                margin-top:${0.6 * PX_PER_MM}px;
                line-height:1;
              ">Сканируй → войти</div>
            </div>
          </div>
        `;

        // Wait for QR image to load inside the offscreen element
        await new Promise<void>((resolve) => {
          const img = offscreen.querySelector("img");
          if (!img) { resolve(); return; }
          if (img.complete) { resolve(); return; }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });

        const canvas = await html2canvas(offscreen.firstElementChild as HTMLElement, {
          backgroundColor: "#ffffff",
          scale: 1,
          logging: false,
        });
        const pngUrl = canvas.toDataURL("image/png");
        if (i > 0) pdf.addPage([PAGE_W, PAGE_H], "landscape");
        pdf.addImage(pngUrl, "PNG", 0, 0, PAGE_W, PAGE_H);
      }
    } finally {
      offscreen.remove();
    }

    const filterLabel = filter === "unassigned" ? "free" : filter === "assigned" ? "assigned" : "all";
    pdf.save(`labels-58x40-${filterLabel}-${labels.length}.pdf`);
    setGeneratingPdf(false);
  }

  return (
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
          </span>
          <button
            onClick={generatePdf}
            disabled={generatingPdf || labels.length === 0}
            className="px-5 py-2 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generatingPdf ? "Генерация…" : "📄 Скачать PDF"}
          </button>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-bg-secondary border border-border text-sm text-text-secondary leading-relaxed mb-6">
        <p className="mb-2">
          <strong className="text-text-primary">Как печатать:</strong>
        </p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Жми «Скачать PDF» — файл готов с точным размером 58×40 мм (альбомная)</li>
          <li>Открой PDF и отправь на печать</li>
          <li>В диалоге принтера: <strong>«размер из PDF»</strong> / <strong>«Actual size»</strong> (не «Fit to page»), масштаб 100%</li>
          <li>Для термопринтеров (Brother QL, Xprinter, Atol): выбери этикетку 58×40 в драйвере</li>
        </ol>
      </div>

      {/* Visual preview — first 6 labels */}
      <h2 className="text-sm font-semibold text-text-primary mb-3">
        Превью {labels.length > 6 ? `(первые 6 из ${labels.length})` : ""}
      </h2>
      <div ref={previewRef} className="grid grid-cols-2 gap-3">
        {labels.slice(0, 6).map((l) => (
          <div
            key={l.login}
            className="label-preview"
            style={{
              width: "232px", // 58mm × 4
              height: "160px", // 40mm × 4
              background: "white",
              padding: "8px 10px",
              display: "flex",
              gap: "8px",
              border: "1px dashed #ccc",
              borderRadius: "4px",
              fontFamily: "-apple-system, system-ui, sans-serif",
              color: "#1a1a1a",
            }}
          >
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 800, color: "#000000", letterSpacing: "0.02em", marginBottom: "7px" }}>
                  learn.ximi4ka.ru
                </div>
                <div style={{ fontSize: "10px", color: "#333", fontWeight: 600 }}>Логин:</div>
                <div style={{ fontSize: "14px", fontWeight: 700, fontFamily: "monospace", marginBottom: "4px" }}>{l.login}</div>
                <div style={{ fontSize: "10px", color: "#333", fontWeight: 600 }}>Пароль:</div>
                <div style={{ fontSize: "14px", fontWeight: 700, fontFamily: "monospace" }}>{l.password}</div>
              </div>
              <div style={{ fontSize: "10px", color: "#000000", fontWeight: 600, fontStyle: "italic" }}>
                Удачи на экзамене!
              </div>
            </div>
            <div style={{ width: "120px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <canvas data-qr={l.qrUrl} />
              <div style={{ fontSize: "9px", color: "#555", fontWeight: 600, marginTop: "3px" }}>Сканируй → войти</div>
            </div>
          </div>
        ))}
      </div>

      {renderedQrCount < Math.min(labels.length, 6) && labels.length > 0 && (
        <p className="text-xs text-text-muted mt-3">QR-коды в превью загружаются…</p>
      )}
    </div>
  );
}
