'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Download, ZoomIn } from 'lucide-react';
import type { Event, EventParticipant } from '@/lib/services/events';

interface InvitationPDFProps {
  participant: EventParticipant;
  event: Event;
  getCatColor: (cat: string | null) => string | null;
  baseUrl: string;
}

const DEFAULT_CAT = '#d4a843';
const GOLD = '#d4a843';
const W = 1100;
const H = 460;

function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  const short = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return {
    day: String(d.getDate()).padStart(2, '0'),
    shortMonth: short[d.getMonth()],
    year: String(d.getFullYear()),
    time: d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase(),
  };
}

/* =========================================================
   TICKET DESIGN (pure inline styles)
   ========================================================= */
function InvitationTicket({ participant: p, event: ev, catColor, date, qrValue }: {
  participant: EventParticipant; event: Event; catColor: string;
  date: ReturnType<typeof fmtDate>; qrValue: string;
}) {
  return (
    <div style={{ width: `${W}px`, height: `${H}px`, display: 'flex', flexDirection: 'row', fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", background: '#1a1a1a', overflow: 'hidden', borderRadius: '16px', border: `2px solid ${GOLD}40` }}>

      {/* ====== LEFT ====== */}
      <div style={{ width: '680px', height: `${H}px`, position: 'relative', padding: '30px 36px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(160deg, #232323 0%, #1a1a1a 50%, #181818 100%)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', background: `linear-gradient(90deg, ${GOLD}, ${GOLD}80, ${GOLD})` }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '3px', background: `linear-gradient(90deg, ${GOLD}, ${GOLD}80, ${GOLD})` }} />
        <div style={{ position: 'absolute', top: '10px', left: '10px', width: '28px', height: '28px', borderTop: `2px solid ${GOLD}50`, borderLeft: `2px solid ${GOLD}50` }} />
        <div style={{ position: 'absolute', top: '10px', right: '10px', width: '28px', height: '28px', borderTop: `2px solid ${GOLD}50`, borderRight: `2px solid ${GOLD}50` }} />
        <div style={{ position: 'absolute', bottom: '10px', left: '10px', width: '28px', height: '28px', borderBottom: `2px solid ${GOLD}50`, borderLeft: `2px solid ${GOLD}50` }} />
        <div style={{ position: 'absolute', top: '-80px', left: '50%', width: '400px', height: '250px', borderRadius: '50%', background: `radial-gradient(ellipse, ${GOLD}06, transparent 70%)`, transform: 'translateX(-50%)' }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-disfero.png" alt="" style={{ width: '38px', height: '38px', objectFit: 'contain', borderRadius: '6px' }} />
            <span style={{ fontSize: '9px', fontWeight: 600, color: `${GOLD}90`, letterSpacing: '3px' }}>DISFERO PRESENTA</span>
          </div>
          <span style={{ fontSize: '9px', fontWeight: 700, color: `${GOLD}50`, letterSpacing: '2.5px' }}>N° {p.id.substring(0, 8).toUpperCase()}</span>
        </div>

        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: GOLD, letterSpacing: '6px', marginBottom: '5px' }}>✦ INVITACIÓN ✦</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.15, letterSpacing: '-0.3px' }}>{ev.nombre}</div>
        </div>

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          <div style={{ textAlign: 'center', minWidth: '85px' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, color: `${GOLD}70`, letterSpacing: '2px', marginBottom: '3px' }}>FECHA</div>
            <div style={{ border: `1.5px solid ${GOLD}35`, borderRadius: '10px', padding: '7px 10px', background: `${GOLD}08` }}>
              <div style={{ fontSize: '30px', fontWeight: 900, color: GOLD, lineHeight: 1 }}>{date.day}</div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#fff', letterSpacing: '2px' }}>{date.shortMonth} {date.year}</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '8px', fontWeight: 700, color: `${GOLD}70`, letterSpacing: '2px', marginBottom: '3px' }}>HORA</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginTop: '6px' }}>{date.time}</div>
          </div>
          <div style={{ width: '1px', height: '50px', background: `${GOLD}20`, alignSelf: 'center' }} />
          {ev.ubicacion && (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '8px', fontWeight: 700, color: `${GOLD}70`, letterSpacing: '2px', marginBottom: '3px' }}>LUGAR</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', lineHeight: 1.3, marginTop: '6px' }}>{ev.ubicacion}</div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ height: '1px', background: `linear-gradient(90deg, ${GOLD}30, ${GOLD}08, transparent)`, marginBottom: '12px' }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '8px', fontWeight: 700, color: `${GOLD}70`, letterSpacing: '2px', marginBottom: '3px' }}>PARTICIPANTE</div>
              <div style={{ fontSize: '17px', fontWeight: 800, color: '#fff', lineHeight: 1.2, maxHeight: '42px', overflow: 'hidden' }}>{p.nombre}</div>
              {p.empresa && <div style={{ fontSize: '10px', fontWeight: 600, color: '#888', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '350px' }}>{p.empresa}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {p.numero_asiento && (
                <div style={{ border: `1.5px solid ${GOLD}40`, borderRadius: '10px', padding: '6px 16px', textAlign: 'center', background: `${GOLD}08`, minWidth: '62px', boxSizing: 'border-box' }}>
                  <div style={{ fontSize: '7px', fontWeight: 700, color: `${GOLD}70`, letterSpacing: '1.5px', marginBottom: '2px' }}>ASIENTO</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: GOLD, lineHeight: 1, whiteSpace: 'nowrap' }}>{p.numero_asiento}</div>
                </div>
              )}
              {p.categoria && (
                <div style={{ background: catColor, borderRadius: '6px', padding: '6px 14px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#fff', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{p.categoria}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ====== PERFORATION ====== */}
      <div style={{ width: '2px', height: `${H}px`, position: 'relative', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ position: 'absolute', top: '-12px', left: '-11px', width: '24px', height: '24px', borderRadius: '50%', background: '#fff', zIndex: 3 }} />
        <div style={{ position: 'absolute', bottom: '-12px', left: '-11px', width: '24px', height: '24px', borderRadius: '50%', background: '#fff', zIndex: 3 }} />
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={{ width: '3px', height: '3px', borderRadius: '50%', background: `${GOLD}50`, margin: '5.5px 0' }} />
        ))}
      </div>

      {/* ====== RIGHT — QR ====== */}
      <div style={{ width: '416px', height: `${H}px`, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(160deg, #232323 0%, #1c1c1c 100%)', overflow: 'hidden', padding: '16px' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', background: `linear-gradient(90deg, ${GOLD}, ${GOLD}80, ${GOLD})` }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '3px', background: `linear-gradient(90deg, ${GOLD}, ${GOLD}80, ${GOLD})` }} />
        <div style={{ position: 'absolute', bottom: '10px', right: '10px', width: '28px', height: '28px', borderBottom: `2px solid ${GOLD}50`, borderRight: `2px solid ${GOLD}50` }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '300px', height: '300px', borderRadius: '50%', background: `radial-gradient(circle, ${GOLD}08, transparent 70%)`, transform: 'translate(-50%, -50%)' }} />

        <div style={{ position: 'relative', zIndex: 2, marginBottom: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '8px', fontWeight: 700, color: `${GOLD}60`, letterSpacing: '4px' }}>ESCANEA TU ENTRADA</span>
        </div>

        <div style={{ position: 'relative', zIndex: 2, background: '#fff', borderRadius: '14px', padding: '14px', boxShadow: `0 0 30px ${GOLD}12, 0 4px 20px rgba(0,0,0,0.3)`, border: `2px solid ${GOLD}25`, width: '288px', height: '288px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '260px', height: '260px', overflow: 'hidden' }}>
            <QRCodeCanvas value={qrValue} size={780} level="H" bgColor="#ffffff" fgColor="#111111" style={{ width: '260px', height: '260px' }} imageSettings={{ src: '/logo-disfero.png', x: undefined, y: undefined, height: 144, width: 144, excavate: true }} />
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 2, marginTop: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '7px', fontWeight: 700, color: `${GOLD}40`, letterSpacing: '3px', marginBottom: '6px' }}>— ADMIT ONE —</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '1px', background: `${GOLD}25` }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-disfero.png" alt="" style={{ width: '16px', height: '16px', objectFit: 'contain', borderRadius: '3px', opacity: 0.4 }} />
            <div style={{ width: '16px', height: '1px', background: `${GOLD}25` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Capture helper — clones the visible ticket, replaces
   <canvas> with <img>, then uses html-to-image (SVG-based,
   no canvas pattern bugs) to generate a PNG data URL.
   ========================================================= */
async function captureTicket(sourceEl: HTMLElement): Promise<string> {
  const { toPng } = await import('html-to-image');

  const clone = sourceEl.cloneNode(true) as HTMLElement;

  // Replace <canvas> elements (QR) with <img> for reliable serialization
  const srcCanvases = sourceEl.querySelectorAll('canvas');
  const cloneCanvases = clone.querySelectorAll('canvas');
  cloneCanvases.forEach((cc, i) => {
    const orig = srcCanvases[i];
    if (!orig || orig.width === 0 || orig.height === 0) return;
    try {
      const img = document.createElement('img');
      img.src = orig.toDataURL('image/png');
      img.width = orig.width;
      img.height = orig.height;
      img.style.width = `${orig.offsetWidth}px`;
      img.style.height = `${orig.offsetHeight}px`;
      img.style.display = 'block';
      cc.parentNode?.replaceChild(img, cc);
    } catch { /* tainted canvas — skip */ }
  });

  // Place clone in DOM at full size so html-to-image can serialize it
  clone.style.position = 'fixed';
  clone.style.top = '0';
  clone.style.left = '0';
  clone.style.width = `${W}px`;
  clone.style.height = `${H}px`;
  clone.style.zIndex = '99999';
  clone.style.transform = 'none';
  clone.style.pointerEvents = 'none';
  document.body.appendChild(clone);

  await new Promise(r => setTimeout(r, 200));

  try {
    // First call warms up font/image loading, second produces clean result
    await toPng(clone, { width: W, height: H, pixelRatio: 1, skipAutoScale: true }).catch(() => {});
    const dataUrl = await toPng(clone, { width: W, height: H, pixelRatio: 4, skipAutoScale: true });
    return dataUrl;
  } finally {
    document.body.removeChild(clone);
  }
}

/* =========================================================
   PREVIEW MODAL + DOWNLOAD
   ========================================================= */
export function InvitationDownloadButton({
  participant, event, getCatColor, baseUrl, children, className,
}: InvitationPDFProps & { children: React.ReactNode; className?: string }) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [scale, setScale] = useState(0.6);

  const catColor = getCatColor(participant.categoria) || DEFAULT_CAT;
  const eventDate = event.fecha_fin || event.fecha_inicio;
  const date = fmtDate(eventDate);
  const qrValue = `${baseUrl}/eventos/${event.id}/checkin/${participant.id}`;

  useEffect(() => {
    if (showPreview) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [showPreview]);

  useEffect(() => {
    if (!showPreview) return;
    const el = previewContainerRef.current;
    if (!el) return;
    const calc = () => {
      const w = el.getBoundingClientRect().width;
      setScale(Math.max(0.5, Math.min(w / W, 1)));
    };
    const t = setTimeout(calc, 50);
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => { clearTimeout(t); ro.disconnect(); };
  }, [showPreview]);

  const handleDownload = useCallback(async () => {
    if (downloading || !ticketRef.current) return;
    setDownloading(true);
    try {
      const imgData = await captureTicket(ticketRef.current);
      const { default: jsPDF } = await import('jspdf');

      const pdfW = 280;
      const pdfH = Math.round(pdfW * (H / W));
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [pdfH, pdfW], compress: false });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH, undefined, 'NONE');
      pdf.save(`Invitacion-${participant.nombre.replace(/\s+/g, '_')}.pdf`);
    } catch (err: unknown) {
      console.error('PDF generation error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Error al generar PDF: ${msg}`);
    } finally {
      setDownloading(false);
    }
  }, [downloading, participant.nombre]);

  const ticketProps = { participant, event, catColor, date, qrValue };

  return (
    <>
      <button onClick={() => setShowPreview(true)} className={className} type="button">
        {children}
      </button>

      {showPreview && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <div className="flex items-center gap-2 text-white/60 text-xs">
              <ZoomIn className="h-4 w-4" />
              <span className="hidden sm:inline">Desliza para ver completo</span>
              <span className="sm:hidden">Desliza horizontalmente</span>
            </div>
            <button
              onClick={() => setShowPreview(false)}
              className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Preview — single ticket, JS-scaled, horizontally scrollable on small screens */}
          <div ref={previewContainerRef} className="flex-1 overflow-auto flex items-start sm:items-center justify-start sm:justify-center px-4 pb-2">
            <div
              className="flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl"
              style={{ width: `${W * scale}px`, height: `${H * scale}px`, minWidth: '550px' }}
            >
              {/* Transform wrapper — ticketRef is INSIDE (no transform on it) */}
              <div style={{ width: `${W}px`, height: `${H}px`, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <div ref={ticketRef} style={{ width: `${W}px`, height: `${H}px` }}>
                  <InvitationTicket {...ticketProps} />
                </div>
              </div>
            </div>
          </div>

          {/* Download bar */}
          <div className="flex items-center justify-center gap-3 px-4 py-4 flex-shrink-0 bg-black/40">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 disabled:bg-amber-800 disabled:opacity-70 text-white font-bold rounded-xl transition-colors shadow-lg text-base"
            >
              {downloading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Generando PDF...
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  Descargar PDF
                </>
              )}
            </button>
            <button
              onClick={() => setShowPreview(false)}
              className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors text-base"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default InvitationDownloadButton;
