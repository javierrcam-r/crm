import httpx
import sys

VENTAS_URL = "https://dqvrgcdttmbaujkkhngk.supabase.co"
VENTAS_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdnJnY2R0dG1iYXVqa2tobmdrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyMzI5NiwiZXhwIjoyMDkxNzk5Mjk2fQ.EEEUwCNVTc6vzG2ak7PtiB6-uCwj5196olsecjRWk6s"
HEADERS = {"apikey": VENTAS_KEY, "Authorization": f"Bearer {VENTAS_KEY}"}

# Probe more columns (timed-out ones and additional candidates)
extra_cols = [
    "codpais", "codzona", "codtipo", "codgrupo",
    "numidentificacion", "identificacion_numero",
    "ruc_cedula", "numero_identificacion",
    "dir1", "dir2", "tel1", "tel2", "fono", "fono1", "fono2",
    "e_mail", "e-mail", "correo_electronico",
    "codciudad2", "codparroquia", "codcanton",
    "tipoid", "tipo_id", "nro_identificacion", "nro_id",
    "cupo", "plazo_credito", "cupocredito",
    "codlista", "codlistaprecio", "lista",
    "formapago", "fpago",
    "razonsocial2", "nombre2", "nombre_fantasia",
    "codruta", "ruta", "frecuencia",
    "dia", "fecha_ultima_compra", "fecha_ultimo_pago",
    "limite", "credito_maximo",
    "observacion1", "obs", "nota",
    "especial", "retencion",
    "latitud", "longitud", "lat", "lng",
]
sys.stdout.flush()

found_extra = []
for col in extra_cols:
    try:
        r = httpx.get(
            f"{VENTAS_URL}/rest/v1/clientes?select={col}&limit=1",
            headers=HEADERS, timeout=20
        )
        if r.status_code == 200:
            data = r.json()
            val = data[0][col] if data else "EMPTY"
            found_extra.append((col, val))
            print(f"  EXISTS  {col:<30} sample: {repr(val)}")
            sys.stdout.flush()
        elif r.status_code == 400:
            pass  # doesn't exist
        else:
            print(f"  ???     {col:<30} -> {r.status_code}")
            sys.stdout.flush()
    except Exception as e:
        print(f"  TIMEOUT {col:<30}")
        found_extra.append((col, "TIMEOUT"))
        sys.stdout.flush()

print(f"\nExtra found: {len(found_extra)}")
for col, val in found_extra:
    print(f"  {col}: {repr(val)}")
sys.stdout.flush()

# Now get sample data with all confirmed columns
confirmed = [
    "codigo", "nombre", "tipo_identificacion", "fecha_nacimiento",
    "fecha_ingreso", "codvendedor", "estado", "saldo", "descuento",
    "codformapago", "tipo_contribuyente"
]
extra_found_names = [c for c, v in found_extra if v != "TIMEOUT"]
all_cols = confirmed + extra_found_names

print(f"\n{'='*60}")
print(f"Fetching sample data with {len(all_cols)} columns...")
select = ",".join(all_cols)
try:
    r = httpx.get(
        f"{VENTAS_URL}/rest/v1/clientes?select={select}&limit=5&order=codigo.asc",
        headers=HEADERS, timeout=30
    )
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"Rows: {len(data)}")
        for i, row in enumerate(data):
            print(f"\n--- Row {i+1} ---")
            for k, v in row.items():
                print(f"  {k:<30} = {repr(v)}")
    else:
        print(r.text[:300])
except Exception as e:
    print(f"Error: {e}")
sys.stdout.flush()
