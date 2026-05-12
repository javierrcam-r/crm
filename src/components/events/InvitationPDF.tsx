'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CalendarDays, Clock, MapPin, Shirt, X, Download, ZoomIn } from 'lucide-react';
import type { Event, EventParticipant } from '@/lib/services/events';
import samraWatermarkImage from '../../../samra_inv_persona.png';
import samraSignatureImage from '../../../samra letras.png';

interface InvitationPDFProps {
  participant: EventParticipant;
  event: Event;
  getCatColor: (cat: string | null) => string | null;
  baseUrl: string;
}

const DEFAULT_CAT = '#d4a843';
const GOLD = '#d4a843';
const W = 1200;
const H = 540;
const SAMRA_WATERMARK_SRC = typeof samraWatermarkImage === 'string' ? samraWatermarkImage : samraWatermarkImage.src;
const SAMRA_SIGNATURE_SRC = typeof samraSignatureImage === 'string' ? samraSignatureImage : samraSignatureImage.src;

function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return { day: '--', shortMonth: '---', year: '----', time: '--:--' };
  }
  const short = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return {
    day: String(d.getDate()).padStart(2, '0'),
    shortMonth: short[d.getMonth()],
    year: String(d.getFullYear()),
    time: d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase(),
  };
}

/* =========================================================
   Logo pre-loader: converts logo to base64 data URL so
   SVG foreignObject capture works reliably everywhere.
   ========================================================= */
let _logoCache: string | null = null;
function useLogoDataUrl() {
  const [src, setSrc] = useState(_logoCache || '/logo-disfero.png');
  useEffect(() => {
    if (_logoCache) { setSrc(_logoCache); return; }
    fetch('/logo-disfero.png')
      .then(r => r.blob())
      .then(blob => new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      }))
      .then(dataUrl => { _logoCache = dataUrl; setSrc(dataUrl); })
      .catch(() => {});
  }, []);
  return src;
}

/* =========================================================
   TICKET DESIGN (pure inline styles)
   QR uses SVG (not Canvas) for reliable PDF capture.
   ========================================================= */
function InvitationTicket({ participant: p, event: ev, catColor, date, qrValue, logoSrc, isSamraEvent }: {
  participant: EventParticipant; event: Event; catColor: string;
  date: ReturnType<typeof fmtDate>; qrValue: string; logoSrc: string; isSamraEvent: boolean;
}) {
  if (isSamraEvent) {
    return (
      <div style={{ width: `${W}px`, height: `${H}px`, display: 'flex', flexDirection: 'row', fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", background: '#0e0e0e', overflow: 'hidden', borderRadius: '20px', border: `2px solid ${GOLD}55`, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: '12px', border: `1px solid ${GOLD}22`, borderRadius: '15px', pointerEvents: 'none', zIndex: 5 }} />

        {/* ====== LEFT ====== */}
        <div style={{ width: '840px', height: `${H}px`, position: 'relative', padding: '26px 36px 24px', overflow: 'hidden', boxSizing: 'border-box', background: 'linear-gradient(155deg, #181818 0%, #0e0e0e 50%, #141414 100%)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SAMRA_WATERMARK_SRC} alt="" style={{ position: 'absolute', right: '-2px', bottom: '0px', width: '440px', height: 'auto', objectFit: 'contain', objectPosition: 'center bottom', opacity: 0.94, filter: 'saturate(92%) contrast(108%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(14,14,14,0.97) 0%, rgba(14,14,14,0.78) 36%, rgba(14,14,14,0.08) 60%, rgba(14,14,14,0.0) 100%)' }} />

          <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc} alt="" style={{ width: '42px', height: '42px', objectFit: 'contain', borderRadius: '8px' }} />
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#fff', letterSpacing: '5px', lineHeight: 1.35 }}>DISFERO<br />PRESENTA</div>
              </div>
              <div style={{ color: `${GOLD}75`, fontSize: '10px', fontWeight: 700, letterSpacing: '3px' }}>N° {(p.id || '').substring(0, 8).toUpperCase()}</div>
            </div>

            {/* Invitation label */}
            <div style={{ fontSize: '11px', fontWeight: 700, color: GOLD, letterSpacing: '9px', textAlign: 'center', maxWidth: '660px' }}>✦ INVITACIÓN ✦</div>

            {/* Signature — centered */}
            <div
              aria-label="Gabriel Samra"
              style={{
                width: '660px',
                height: '175px',
                margin: '4px auto 0',
                background: `linear-gradient(175deg, #fff 0%, #f2e2bf 40%, ${GOLD} 100%)`,
                WebkitMaskImage: `url("${SAMRA_SIGNATURE_SRC}")`,
                maskImage: `url("${SAMRA_SIGNATURE_SRC}")`,
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center center',
                maskPosition: 'center center',
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                filter: `drop-shadow(0 0 18px ${GOLD}35)`,
              }}
            />
            <div style={{ color: `${GOLD}68`, fontSize: '15px', letterSpacing: '20px', textAlign: 'center', marginTop: '-22px', maxWidth: '660px' }}>EXPERIENCE</div>

            {/* Info row */}
            <div style={{ marginTop: '14px', display: 'flex', gap: '0', alignItems: 'stretch', maxWidth: '660px' }}>
              <div style={{ flex: '0 0 90px', textAlign: 'center', padding: '0 8px' }}>
                <div style={{ width: '38px', height: '38px', border: `1.5px solid ${GOLD}60`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 7px', color: GOLD }}><CalendarDays size={19} strokeWidth={1.7} /></div>
                <div style={{ fontSize: '8px', color: `${GOLD}85`, fontWeight: 800, letterSpacing: '3px', marginBottom: '4px' }}>FECHA</div>
                <div style={{ fontSize: '30px', color: '#fff', fontWeight: 900, lineHeight: 0.88 }}>{date.day}</div>
                <div style={{ fontSize: '11px', color: '#fff', fontWeight: 800, letterSpacing: '3px', marginTop: '5px' }}>{date.shortMonth}</div>
                <div style={{ fontSize: '10px', color: `${GOLD}75`, fontWeight: 700, letterSpacing: '3px', marginTop: '3px' }}>{date.year}</div>
              </div>

              <div style={{ width: '1px', background: `linear-gradient(transparent, ${GOLD}40, transparent)`, alignSelf: 'stretch', margin: '8px 0' }} />

              <div style={{ flex: '0 0 100px', textAlign: 'center', padding: '0 12px' }}>
                <div style={{ width: '38px', height: '38px', border: `1.5px solid ${GOLD}60`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 7px', color: GOLD }}><Clock size={19} strokeWidth={1.7} /></div>
                <div style={{ fontSize: '8px', color: `${GOLD}85`, fontWeight: 800, letterSpacing: '3px', marginBottom: '8px' }}>HORA</div>
                <div style={{ fontSize: '15px', color: '#fff', fontWeight: 800, lineHeight: 1.2 }}>{date.time}</div>
              </div>

              <div style={{ width: '1px', background: `linear-gradient(transparent, ${GOLD}40, transparent)`, alignSelf: 'stretch', margin: '8px 0' }} />

              <div style={{ flex: '1 1 auto', textAlign: 'center', padding: '0 14px' }}>
                <div style={{ width: '38px', height: '38px', border: `1.5px solid ${GOLD}60`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 7px', color: GOLD }}><MapPin size={19} strokeWidth={1.7} /></div>
                <div style={{ fontSize: '8px', color: `${GOLD}85`, fontWeight: 800, letterSpacing: '3px', marginBottom: '8px' }}>LUGAR</div>
                <div style={{ fontSize: '12px', color: '#fff', fontWeight: 700, lineHeight: 1.3, maxHeight: '46px', overflow: 'hidden' }}>{ev.ubicacion || 'Por confirmar'}</div>
              </div>

              <div style={{ width: '1px', background: `linear-gradient(transparent, ${GOLD}40, transparent)`, alignSelf: 'stretch', margin: '8px 0' }} />

              <div style={{ flex: '0 0 110px', textAlign: 'center', padding: '0 8px' }}>
                <div style={{ width: '38px', height: '38px', border: `1.5px solid ${GOLD}60`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 7px', color: GOLD }}><Shirt size={19} strokeWidth={1.7} /></div>
                <div style={{ fontSize: '8px', color: `${GOLD}85`, fontWeight: 800, letterSpacing: '3px', marginBottom: '8px' }}>VESTIMENTA</div>
                <div style={{ fontSize: '14px', color: '#fff', fontWeight: 900, lineHeight: 1.3, letterSpacing: '3px' }}>NEGRO<br />CASUAL</div>
              </div>
            </div>

            {/* Bottom: participant + seat + category */}
            <div style={{ height: '1px', background: `linear-gradient(90deg, transparent, ${GOLD}40, transparent)`, margin: '14px 30px 0', maxWidth: '600px' }} />
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '20px', paddingLeft: '30px', paddingRight: '20px', maxWidth: '660px' }}>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: `${GOLD}85`, fontWeight: 800, letterSpacing: '4px', marginBottom: '8px' }}>PARTICIPANTE</div>
                <div style={{ color: '#fff', fontWeight: 900, fontSize: '15px', letterSpacing: '1px', lineHeight: 1.25, maxHeight: '40px', overflow: 'hidden' }}>{p.nombre}</div>
                {p.empresa && <div style={{ color: '#aaa', fontWeight: 700, fontSize: '11px', letterSpacing: '0.8px', lineHeight: 1.2, marginTop: '3px', maxHeight: '28px', overflow: 'hidden' }}>{p.empresa}</div>}
              </div>
              {p.numero_asiento && (
                <div style={{ width: '82px', border: `1.5px solid ${GOLD}55`, borderRadius: '11px', padding: '8px 6px', textAlign: 'center', background: `${GOLD}08` }}>
                  <div style={{ fontSize: '7px', color: `${GOLD}85`, fontWeight: 900, letterSpacing: '2px', marginBottom: '5px' }}>ASIENTO</div>
                  <div style={{ color: GOLD, fontSize: '20px', fontWeight: 900 }}>{p.numero_asiento}</div>
                </div>
              )}
              {p.categoria && (
                <div style={{ minWidth: '94px', background: catColor, borderRadius: '10px', padding: '12px 16px', textAlign: 'center', boxShadow: `0 8px 24px rgba(0,0,0,0.3)` }}>
                  <span style={{ color: '#fff', fontSize: '11px', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' }}>{p.categoria}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ====== PERFORATION ====== */}
        <div style={{ width: '2px', height: `${H}px`, position: 'relative', flexShrink: 0, zIndex: 4 }}>
          <div style={{ position: 'absolute', top: '-16px', left: '-14px', width: '30px', height: '30px', borderRadius: '50%', background: GOLD, boxShadow: `0 0 14px ${GOLD}50` }} />
          <div style={{ position: 'absolute', bottom: '-16px', left: '-14px', width: '30px', height: '30px', borderRadius: '50%', background: GOLD, boxShadow: `0 0 14px ${GOLD}50` }} />
          {Array.from({ length: 22 }).map((_, i) => (
            <div key={i} style={{ width: '3px', height: '8px', borderRadius: '3px', background: `${GOLD}70`, margin: '10px 0 0 -0.5px' }} />
          ))}
        </div>

        {/* ====== RIGHT — QR ====== */}
        <div style={{ width: '358px', height: `${H}px`, position: 'relative', padding: '40px 28px 30px', boxSizing: 'border-box', background: 'linear-gradient(160deg, #181818 0%, #0e0e0e 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: `${GOLD}88`, fontSize: '9px', fontWeight: 800, letterSpacing: '5px', marginBottom: '22px' }}>ESCANEA TU ENTRADA ✦</div>
          <div style={{ width: '290px', height: '290px', borderRadius: '20px', background: '#fff', padding: '15px', boxSizing: 'border-box', border: `2px solid ${GOLD}40`, boxShadow: `0 0 0 8px rgba(212,168,67,0.035), 0 16px 40px rgba(0,0,0,0.45)` }}>
            <div style={{ position: 'relative', width: '260px', height: '260px' }}>
              <QRCodeSVG value={qrValue} size={260} level="H" bgColor="#ffffff" fgColor="#111111" style={{ width: '260px', height: '260px', display: 'block' }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt="" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '48px', height: '48px', borderRadius: '8px', background: '#fff', padding: '5px', boxSizing: 'content-box' }} />
            </div>
          </div>
          <div style={{ marginTop: '34px', color: `${GOLD}65`, fontSize: '8px', fontWeight: 800, letterSpacing: '5px' }}>— ADMIT ONE —</div>
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '1px', background: `${GOLD}30` }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="" style={{ width: '20px', height: '20px', objectFit: 'contain', borderRadius: '4px', opacity: 0.85 }} />
            <div style={{ width: '34px', height: '1px', background: `${GOLD}30` }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: `${W}px`, height: `${H}px`, display: 'flex', flexDirection: 'row', fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", background: '#1a1a1a', overflow: 'hidden', borderRadius: '16px', border: `2px solid ${GOLD}40` }}>

      {/* ====== LEFT ====== */}
      <div style={{ width: '782px', height: `${H}px`, position: 'relative', padding: '30px 36px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(160deg, #232323 0%, #1a1a1a 50%, #181818 100%)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', background: `linear-gradient(90deg, ${GOLD}, ${GOLD}80, ${GOLD})` }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '3px', background: `linear-gradient(90deg, ${GOLD}, ${GOLD}80, ${GOLD})` }} />
        <div style={{ position: 'absolute', top: '10px', left: '10px', width: '28px', height: '28px', borderTop: `2px solid ${GOLD}50`, borderLeft: `2px solid ${GOLD}50` }} />
        <div style={{ position: 'absolute', top: '10px', right: '10px', width: '28px', height: '28px', borderTop: `2px solid ${GOLD}50`, borderRight: `2px solid ${GOLD}50` }} />
        <div style={{ position: 'absolute', bottom: '10px', left: '10px', width: '28px', height: '28px', borderBottom: `2px solid ${GOLD}50`, borderLeft: `2px solid ${GOLD}50` }} />
        <div style={{ position: 'absolute', top: '-80px', left: '50%', width: '400px', height: '250px', borderRadius: '50%', background: `radial-gradient(ellipse, ${GOLD}06, transparent 70%)`, transform: 'translateX(-50%)' }} />
        {isSamraEvent && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SAMRA_WATERMARK_SRC}
              alt=""
              style={{
                position: 'absolute',
                right: '-40px',
                bottom: '-88px',
                width: '390px',
                height: '540px',
                objectFit: 'cover',
                objectPosition: 'center top',
                opacity: 0.28,
                filter: 'grayscale(5%) saturate(95%) contrast(112%)',
                mixBlendMode: 'screen',
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(26,26,26,0.94) 0%, rgba(26,26,26,0.72) 48%, rgba(26,26,26,0.18) 100%)' }} />
          </>
        )}

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="" style={{ width: '38px', height: '38px', objectFit: 'contain', borderRadius: '6px' }} />
            <span style={{ fontSize: '9px', fontWeight: 600, color: `${GOLD}90`, letterSpacing: '3px' }}>DISFERO PRESENTA</span>
          </div>
          <span style={{ fontSize: '9px', fontWeight: 700, color: `${GOLD}50`, letterSpacing: '2.5px' }}>N° {(p.id || '').substring(0, 8).toUpperCase()}</span>
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
          {isSamraEvent && (
            <>
              <div style={{ width: '1px', height: '50px', background: `${GOLD}20`, alignSelf: 'center' }} />
              <div style={{ maxWidth: '120px' }}>
                <div style={{ fontSize: '8px', fontWeight: 700, color: `${GOLD}70`, letterSpacing: '2px', marginBottom: '3px' }}>VESTIMENTA</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#fff', lineHeight: 1.25, marginTop: '6px', letterSpacing: '0.4px' }}>NEGRO CASUAL</div>
              </div>
            </>
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
          <div style={{ position: 'relative', width: '260px', height: '260px' }}>
            <QRCodeSVG value={qrValue} size={260} level="H" bgColor="#ffffff" fgColor="#111111" style={{ width: '260px', height: '260px', display: 'block' }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt=""
              style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '48px', height: '48px', borderRadius: '6px', background: '#fff', padding: '4px', boxSizing: 'content-box' }}
            />
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 2, marginTop: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '7px', fontWeight: 700, color: `${GOLD}40`, letterSpacing: '3px', marginBottom: '6px' }}>— ADMIT ONE —</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '1px', background: `${GOLD}25` }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="" style={{ width: '16px', height: '16px', objectFit: 'contain', borderRadius: '3px', opacity: 0.4 }} />
            <div style={{ width: '16px', height: '1px', background: `${GOLD}25` }} />
          </div>
        </div>
      </div>
    </div>
  );
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
  const logoSrc = useLogoDataUrl();

  const catColor = getCatColor(participant.categoria) || DEFAULT_CAT;
  const eventDate = event.fecha_fin || event.fecha_inicio || new Date().toISOString();
  const date = fmtDate(eventDate);
  const qrValue = `${baseUrl || ''}/eventos/${event.id}/checkin/${participant.id}`;
  const normalizedEventName = (event.nombre || '').toLowerCase();
  const isSamraEvent = normalizedEventName.includes('gabriel') && normalizedEventName.includes('samra');

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
      const { width: cw, height: ch } = el.getBoundingClientRect();
      const sx = (cw - 32) / W;
      const sy = (ch - 16) / H;
      setScale(Math.max(0.28, Math.min(sx, sy, 1)));
    };
    const t = setTimeout(calc, 50);
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => { clearTimeout(t); ro.disconnect(); };
  }, [showPreview]);

  const captureViaForeignObject = useCallback(async (el: HTMLElement): Promise<string> => {
    const clone = el.cloneNode(true) as HTMLElement;
    const imgs = clone.querySelectorAll('img');
    await Promise.all(
      Array.from(imgs).map(async (img) => {
        const src = img.getAttribute('src') || '';
        if (src && !src.startsWith('data:')) {
          try {
            const r = await fetch(src);
            const blob = await r.blob();
            const du: string = await new Promise(res => {
              const fr = new FileReader();
              fr.onloadend = () => res(fr.result as string);
              fr.readAsDataURL(blob);
            });
            img.setAttribute('src', du);
          } catch { /* image won't appear */ }
        }
      }),
    );

    const xhtml = new XMLSerializer().serializeToString(clone);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<foreignObject width="100%" height="100%">${xhtml}</foreignObject>` +
      `</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('foreignObject render failed'));
        i.src = url;
      });
      const PX = 2;
      const canvas = document.createElement('canvas');
      canvas.width = W * PX;
      canvas.height = H * PX;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d ctx');
      ctx.drawImage(image, 0, 0, W * PX, H * PX);
      return canvas.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

  const captureViaHtmlToImage = useCallback(async (el: HTMLElement): Promise<string> => {
    const { toPng } = await import('html-to-image');
    const opts = { width: W, height: H, cacheBust: true };
    await toPng(el, { ...opts, pixelRatio: 1, skipAutoScale: true }).catch(() => {});
    return toPng(el, { ...opts, pixelRatio: 2, skipAutoScale: true });
  }, []);

  const handleDownload = useCallback(async () => {
    if (downloading || !ticketRef.current) return;
    setDownloading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const el = ticketRef.current;

      let pngDataUrl: string;
      try {
        pngDataUrl = await captureViaForeignObject(el);
      } catch {
        pngDataUrl = await captureViaHtmlToImage(el);
      }

      if (!pngDataUrl || !pngDataUrl.startsWith('data:image')) {
        throw new Error('La captura de imagen falló');
      }

      const pdfW = 280;
      const pdfH = Math.round(pdfW * (H / W));
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [pdfH, pdfW], compress: true });
      pdf.addImage({ imageData: pngDataUrl, format: 'PNG', x: 0, y: 0, width: pdfW, height: pdfH, compression: 'FAST' });

      const safeName = (participant.nombre || 'Invitado').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
      pdf.save(`Invitacion-${safeName}.pdf`);
    } catch (err: unknown) {
      console.error('PDF generation error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Error al generar PDF: ${msg}`);
    } finally {
      setDownloading(false);
    }
  }, [downloading, participant.nombre, captureViaForeignObject, captureViaHtmlToImage]);

  const ticketProps = { participant, event, catColor, date, qrValue, logoSrc, isSamraEvent };

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

          {/* Preview */}
          <div ref={previewContainerRef} className="flex-1 overflow-auto flex items-center justify-center px-4 pb-2">
            <div
              className="flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl"
              style={{ width: `${W * scale}px`, height: `${H * scale}px` }}
            >
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
