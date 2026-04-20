"""
Sincroniza datos de ventas desde la base ventas al CRM.
Usa subtotalb como base sin IVA, iva como IVA, codcomprobante como tipo.
Descarga todo sin filtros (la base externa no tiene índices) y filtra en Python.
"""
import httpx
from datetime import datetime
import sys
import time

VENTAS_URL = "https://dqvrgcdttmbaujkkhngk.supabase.co"
VENTAS_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdnJnY2R0dG1iYXVqa2tobmdrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyMzI5NiwiZXhwIjoyMDkxNzk5Mjk2fQ.EEEUwCNVTc6vzG2ak7PtiB6-uCwj5196olsecjRWk6s"

CRM_URL = "https://frwymnihodnxmoviuxtt.supabase.co"
CRM_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyd3ltbmlob2RueG1vdml1eHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzkwOTcsImV4cCI6MjA4MzU1NTA5N30.lj9rYLti3GCSReJU-sahHWWAAcZQF0RKTqgQwGPpsZM"

SELECT_COLS = "fecha_emision,codvendedor,total,subtotalb,iva,codcomprobante,anulada"
PAGE_SIZE = 1000
HEADERS = {"apikey": VENTAS_KEY, "Authorization": f"Bearer {VENTAS_KEY}"}

MAX_RETRIES = 5

def fetch_page(offset):
    """Descarga una página con reintentos."""
    url = (
        f"{VENTAS_URL}/rest/v1/ventas"
        f"?select={SELECT_COLS}"
        f"&order=id"
        f"&limit={PAGE_SIZE}&offset={offset}"
    )
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = httpx.get(url, headers=HEADERS, timeout=90)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            if attempt < MAX_RETRIES:
                wait = 3 * attempt
                print(f"    (retry {attempt}/{MAX_RETRIES}, espera {wait}s...)")
                sys.stdout.flush()
                time.sleep(wait)
            else:
                raise

def fetch_all_ventas():
    """Descarga todas las ventas paginadas con reintentos por página."""
    all_rows = []
    offset = 0
    while True:
        rows = fetch_page(offset)
        if not rows:
            break
        all_rows.extend(rows)
        print(f"  Página {offset // PAGE_SIZE + 1}: +{len(rows)} (total: {len(all_rows)})")
        sys.stdout.flush()
        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return all_rows

def crm_upsert(data):
    url = f"{CRM_URL}/rest/v1/ventas_resumen_mensual?on_conflict=anio,mes,codigo_vendedor,codcomprobante"
    headers = {
        "apikey": CRM_KEY,
        "Authorization": f"Bearer {CRM_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    r = httpx.post(url, headers=headers, json=data, timeout=30)
    r.raise_for_status()

now = datetime.now()

print("Sincronizando ventas -> CRM (subtotalb + iva + codcomprobante)")
print("=" * 60)
sys.stdout.flush()

print("\n[1/3] Descargando ventas (~57K registros, sin filtros server-side)...")
sys.stdout.flush()

try:
    raw_rows = fetch_all_ventas()
except Exception as e:
    print(f"  ERROR descargando: {e}")
    sys.exit(1)

print(f"  Descargados: {len(raw_rows)} registros")
sys.stdout.flush()

print("\n[2/3] Filtrando y agregando...")
sys.stdout.flush()

resumen = {}
skipped = 0
anuladas = 0
antiguas = 0

for row in raw_rows:
    if row.get("anulada"):
        anuladas += 1
        continue

    fecha = row.get("fecha_emision", "")
    cod = row.get("codvendedor")
    if not fecha or cod is None:
        skipped += 1
        continue

    year = int(fecha[:4])
    month = int(fecha[5:7])
    if year < 2024:
        antiguas += 1
        continue

    total = float(row.get("total", 0) or 0)
    subtotalb = float(row.get("subtotalb", 0) or 0)
    iva_val = float(row.get("iva", 0) or 0)
    raw_comp = row.get("codcomprobante", 1)
    try:
        codcomp = int(raw_comp)
    except (ValueError, TypeError):
        codcomp = 0

    key = (year, month, int(cod), codcomp)
    if key not in resumen:
        resumen[key] = {"num_ventas": 0, "total_ventas": 0.0, "total_sin_iva": 0.0, "total_iva": 0.0}
    resumen[key]["num_ventas"] += 1
    resumen[key]["total_ventas"] += total
    resumen[key]["total_sin_iva"] += subtotalb
    resumen[key]["total_iva"] += iva_val

print(f"  Válidas (desde 2024): {sum(v['num_ventas'] for v in resumen.values())}")
print(f"  Anuladas: {anuladas}")
print(f"  Anteriores a 2024: {antiguas}")
if skipped:
    print(f"  Sin fecha/vendedor: {skipped}")
print(f"  Combinaciones únicas: {len(resumen)}")
sys.stdout.flush()

print("\n[3/3] Subiendo al CRM...")
sys.stdout.flush()

upsert_data = []
for (anio, mes, cod_vendedor, codcomp), vals in resumen.items():
    upsert_data.append({
        "anio": anio,
        "mes": mes,
        "codigo_vendedor": cod_vendedor,
        "codcomprobante": codcomp,
        "num_ventas": vals["num_ventas"],
        "total_ventas": round(vals["total_ventas"], 2),
        "total_sin_iva": round(vals["total_sin_iva"], 2),
        "total_iva": round(vals["total_iva"], 2),
        "updated_at": now.isoformat(),
    })

BATCH = 30
ok = 0
for i in range(0, len(upsert_data), BATCH):
    batch = upsert_data[i:i + BATCH]
    try:
        crm_upsert(batch)
        ok += len(batch)
        print(f"  Batch {i // BATCH + 1}: {len(batch)} OK")
    except httpx.HTTPStatusError as e:
        print(f"  Batch {i // BATCH + 1}: HTTP {e.response.status_code} - {e.response.text[:200]}")
    except Exception as e:
        print(f"  Batch {i // BATCH + 1}: ERROR - {e}")
    sys.stdout.flush()

print(f"\nLISTO: {ok}/{len(upsert_data)} registros sincronizados")
