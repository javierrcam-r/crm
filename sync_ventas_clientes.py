"""
Sincroniza ventas por cliente desde la base ventas al CRM.
Agrupa por (anio, mes, codigo_cliente, codigo_vendedor).
Requiere tabla ventas_cliente_mensual en el CRM.
"""
import httpx
from datetime import datetime
import sys
import time

VENTAS_URL = "https://dqvrgcdttmbaujkkhngk.supabase.co"
VENTAS_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdnJnY2R0dG1iYXVqa2tobmdrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyMzI5NiwiZXhwIjoyMDkxNzk5Mjk2fQ.EEEUwCNVTc6vzG2ak7PtiB6-uCwj5196olsecjRWk6s"

CRM_URL = "https://frwymnihodnxmoviuxtt.supabase.co"
CRM_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyd3ltbmlob2RueG1vdml1eHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzkwOTcsImV4cCI6MjA4MzU1NTA5N30.lj9rYLti3GCSReJU-sahHWWAAcZQF0RKTqgQwGPpsZM"

SELECT_COLS = "fecha_emision,codvendedor,codcliente,total,anulada"
PAGE_SIZE = 1000
VENTAS_HEADERS = {"apikey": VENTAS_KEY, "Authorization": f"Bearer {VENTAS_KEY}"}
MAX_RETRIES = 5


def fetch_page(offset):
    url = (
        f"{VENTAS_URL}/rest/v1/ventas"
        f"?select={SELECT_COLS}"
        f"&order=id"
        f"&limit={PAGE_SIZE}&offset={offset}"
    )
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = httpx.get(url, headers=VENTAS_HEADERS, timeout=90)
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
    url = f"{CRM_URL}/rest/v1/ventas_cliente_mensual?on_conflict=anio,mes,codigo_cliente,codigo_vendedor"
    headers = {
        "apikey": CRM_KEY,
        "Authorization": f"Bearer {CRM_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    r = httpx.post(url, headers=headers, json=data, timeout=30)
    r.raise_for_status()


now = datetime.now()

print("Sincronizando ventas por cliente -> CRM")
print("=" * 60)
sys.stdout.flush()

print("\n[1/3] Descargando ventas...")
sys.stdout.flush()

try:
    raw_rows = fetch_all_ventas()
except Exception as e:
    print(f"  ERROR descargando: {e}")
    sys.exit(1)

print(f"  Descargados: {len(raw_rows)} registros")
sys.stdout.flush()

print("\n[2/3] Filtrando y agregando por cliente...")
sys.stdout.flush()

resumen = {}
skipped = 0
anuladas = 0
antiguas = 0
sin_cliente = 0

for row in raw_rows:
    if row.get("anulada"):
        anuladas += 1
        continue

    fecha = row.get("fecha_emision", "")
    cod_vendedor = row.get("codvendedor")
    cod_cliente = row.get("codcliente")

    if not fecha or cod_vendedor is None:
        skipped += 1
        continue

    if cod_cliente is None or cod_cliente == 0:
        sin_cliente += 1
        continue

    year = int(fecha[:4])
    month = int(fecha[5:7])
    if year < 2024:
        antiguas += 1
        continue

    total = float(row.get("total", 0) or 0)
    iva_rate = 0.15
    total_sin_iva = round(total / (1 + iva_rate), 2)
    iva_val = round(total - total_sin_iva, 2)

    try:
        cod_cliente = int(cod_cliente)
        cod_vendedor = int(cod_vendedor)
    except (ValueError, TypeError):
        skipped += 1
        continue

    key = (year, month, cod_cliente, cod_vendedor)
    if key not in resumen:
        resumen[key] = {"num_ventas": 0, "total_ventas": 0.0, "total_sin_iva": 0.0, "total_iva": 0.0}
    resumen[key]["num_ventas"] += 1
    resumen[key]["total_ventas"] += total
    resumen[key]["total_sin_iva"] += total_sin_iva
    resumen[key]["total_iva"] += iva_val

valid = sum(v["num_ventas"] for v in resumen.values())
clientes_unicos = len(set(k[2] for k in resumen.keys()))

print(f"  Válidas (desde 2024): {valid}")
print(f"  Clientes únicos: {clientes_unicos}")
print(f"  Combinaciones únicas: {len(resumen)}")
print(f"  Anuladas: {anuladas}")
print(f"  Sin cliente: {sin_cliente}")
print(f"  Anteriores a 2024: {antiguas}")
if skipped:
    print(f"  Sin fecha/vendedor/inválidas: {skipped}")
sys.stdout.flush()

print(f"\n[3/3] Subiendo {len(resumen)} registros al CRM...")
sys.stdout.flush()

upsert_data = []
for (anio, mes, cod_cli, cod_vend), vals in resumen.items():
    upsert_data.append({
        "anio": anio,
        "mes": mes,
        "codigo_cliente": cod_cli,
        "codigo_vendedor": cod_vend,
        "num_ventas": vals["num_ventas"],
        "total_ventas": round(vals["total_ventas"], 2),
        "total_sin_iva": round(vals["total_sin_iva"], 2),
        "total_iva": round(vals["total_iva"], 2),
        "updated_at": now.isoformat(),
    })

BATCH = 50
ok = 0
errors = 0
for i in range(0, len(upsert_data), BATCH):
    batch = upsert_data[i : i + BATCH]
    try:
        crm_upsert(batch)
        ok += len(batch)
        if (i // BATCH + 1) % 20 == 0 or i + BATCH >= len(upsert_data):
            print(f"  Progreso: {ok}/{len(upsert_data)}")
            sys.stdout.flush()
    except httpx.HTTPStatusError as e:
        errors += len(batch)
        print(f"  Batch {i // BATCH + 1}: HTTP {e.response.status_code} - {e.response.text[:200]}")
        sys.stdout.flush()
    except Exception as e:
        errors += len(batch)
        print(f"  Batch {i // BATCH + 1}: ERROR - {e}")
        sys.stdout.flush()

print(f"\nLISTO: {ok}/{len(upsert_data)} registros sincronizados ({errors} errores)")
print(f"Clientes únicos: {clientes_unicos}")
