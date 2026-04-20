import httpx
import json

VENTAS_URL = "https://dqvrgcdttmbaujkkhngk.supabase.co"
VENTAS_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdnJnY2R0dG1iYXVqa2tobmdrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyMzI5NiwiZXhwIjoyMDkxNzk5Mjk2fQ.EEEUwCNVTc6vzG2ak7PtiB6-uCwj5196olsecjRWk6s"
HEADERS = {"apikey": VENTAS_KEY, "Authorization": f"Bearer {VENTAS_KEY}", "Content-Type": "application/json"}

# Approach 1: Probe a single known column with limit=1
print("=== Approach 1: select=nombre limit=1 ===")
try:
    r = httpx.get(
        f"{VENTAS_URL}/rest/v1/clientes?select=nombre&limit=1",
        headers=HEADERS, timeout=30
    )
    print(f"Status: {r.status_code}")
    print(f"Body: {r.text[:300]}")
except Exception as e:
    print(f"Error: {e}")

# Approach 2: Try to get one row with select=* but add order and Range header
print("\n=== Approach 2: select=* with Range: 0-0 ===")
try:
    headers2 = {**HEADERS, "Range": "0-0"}
    r = httpx.get(
        f"{VENTAS_URL}/rest/v1/clientes?select=*&order=index.asc",
        headers=headers2, timeout=30
    )
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        if data:
            print(f"Columns ({len(data[0])}): {list(data[0].keys())}")
            for k, v in data[0].items():
                print(f"  {k}: {repr(v)}")
    else:
        print(f"Body: {r.text[:300]}")
except Exception as e:
    print(f"Error: {e}")

# Approach 3: Try common column names to discover what exists
print("\n=== Approach 3: Probing various column names ===")
test_cols = [
    "index", "nombre", "codcliente", "cod_cliente", "codigo",
    "num_identificacion", "tipo_identificacion", "ruc", "cedula",
    "direccion", "telefono", "email", "fecha_nacimiento",
    "codvendedor", "cod_vendedor", "ciudad", "provincia",
    "fecha_registro", "estado", "activo"
]
for col in test_cols:
    try:
        r = httpx.get(
            f"{VENTAS_URL}/rest/v1/clientes?select={col}&limit=1",
            headers=HEADERS, timeout=10
        )
        if r.status_code == 200:
            data = r.json()
            val = data[0][col] if data else "EMPTY"
            print(f"  EXISTS  {col:<25} sample: {repr(val)}")
        elif r.status_code == 400:
            print(f"  MISSING {col}")
        else:
            print(f"  ???     {col} -> {r.status_code}")
    except Exception as e:
        print(f"  ERROR   {col} -> {str(e)[:60]}")
