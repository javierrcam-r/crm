import httpx

VENTAS_URL = "https://dqvrgcdttmbaujkkhngk.supabase.co"
VENTAS_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdnJnY2R0dG1iYXVqa2tobmdrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyMzI5NiwiZXhwIjoyMDkxNzk5Mjk2fQ.EEEUwCNVTc6vzG2ak7PtiB6-uCwj5196olsecjRWk6s"

r = httpx.get(f"{VENTAS_URL}/rest/v1/vendedores?select=*&limit=30",
    headers={"apikey": VENTAS_KEY, "Authorization": f"Bearer {VENTAS_KEY}"}, timeout=60)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    if data:
        print(f"Columnas: {list(data[0].keys())}")
        print(f"Total: {len(data)}\n")
        for v in data:
            cols = {k: v for k, v in v.items() if v is not None and v != '' and v != 0 and v != False}
            print(f"  {cols}")
    else:
        print("Tabla vacia")
else:
    print(r.text[:300])
