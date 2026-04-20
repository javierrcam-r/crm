import httpx
import sys

VENTAS_URL = "https://dqvrgcdttmbaujkkhngk.supabase.co"
VENTAS_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdnJnY2R0dG1iYXVqa2tobmdrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyMzI5NiwiZXhwIjoyMDkxNzk5Mjk2fQ.EEEUwCNVTc6vzG2ak7PtiB6-uCwj5196olsecjRWk6s"
HEADERS = {"apikey": VENTAS_KEY, "Authorization": f"Bearer {VENTAS_KEY}"}

# More columns to probe
extra_cols = [
    "dir1", "dir2", "tel1", "tel2",
    "direccion1", "direccion2", "telefono1", "telefono2",
    "nombre_comercial", "razon_social",
    "codciudad", "codprovincia", "codparroquia", "codcanton",
    "plazo", "plazo_credito",
    "observacion", "observaciones",
    "retencion", "especial",
    "contribuyente_especial", "obligado_contabilidad",
    "activo",
    "fecha_ultima_compra", "fecha_ultimo_pago",
    "limite_credito",
    "clasificacion", "categoria",
    "sucursal", "codsucursal",
    "codempleado", "codcobrador",
    "diascredito", "diasplazo",
    "tarjeta", "tipo_precio",
    "porcdescuento", "porcretencion",
    "formapago",
    "sexo", "genero",
    "relacion", "profesion",
]
sys.stdout.flush()

found_extra = []
for col in extra_cols:
    try:
        r = httpx.get(
            f"{VENTAS_URL}/rest/v1/clientes?select={col}&limit=1",
            headers=HEADERS, timeout=15
        )
        if r.status_code == 200:
            data = r.json()
            val = data[0][col] if data else "EMPTY"
            found_extra.append((col, val))
            print(f"  EXISTS  {col:<30} sample: {repr(val)}")
            sys.stdout.flush()
        elif r.status_code == 400:
            pass
    except Exception as e:
        print(f"  TIMEOUT {col:<30}")
        found_extra.append((col, "TIMEOUT"))
        sys.stdout.flush()

print(f"\nNew extra found: {len(found_extra)}")
for col, val in found_extra:
    print(f"  {col}: {repr(val)}")
sys.stdout.flush()

# Get sample data filtering by codigo (should use index if exists)
print(f"\n{'='*60}")
print("Sample data: filtering by codigo=1..5 individually")
key_cols = "codigo,nombre,numero_identificacion,tipo_identificacion,codvendedor,fecha_nacimiento,fecha_ingreso,estado,tipo_contribuyente,correo_electronico,codpais,cupo"

for cod in [1, 2, 3, 4, 5]:
    try:
        r = httpx.get(
            f"{VENTAS_URL}/rest/v1/clientes?select={key_cols}&codigo=eq.{cod}",
            headers=HEADERS, timeout=30
        )
        if r.status_code == 200:
            data = r.json()
            if data:
                print(f"\n  codigo={cod}: {data[0]}")
            else:
                print(f"\n  codigo={cod}: NOT FOUND")
        else:
            print(f"\n  codigo={cod}: ERROR {r.status_code}")
        sys.stdout.flush()
    except Exception as e:
        print(f"\n  codigo={cod}: TIMEOUT")
        sys.stdout.flush()

# Also get a count
print(f"\n{'='*60}")
print("Total count...")
try:
    r = httpx.get(
        f"{VENTAS_URL}/rest/v1/clientes?select=codigo",
        headers={**HEADERS, "Prefer": "count=exact", "Range": "0-0"},
        timeout=30
    )
    content_range = r.headers.get("content-range", "unknown")
    print(f"Content-Range: {content_range}")
except Exception as e:
    print(f"Count error: {e}")
sys.stdout.flush()
