import httpx

CRM_URL = "https://frwymnihodnxmoviuxtt.supabase.co"
CRM_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyd3ltbmlob2RueG1vdml1eHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzkwOTcsImV4cCI6MjA4MzU1NTA5N30.lj9rYLti3GCSReJU-sahHWWAAcZQF0RKTqgQwGPpsZM"

# Fix Sebastián Aguilar: vendedores cod=26 emp=43 SEBASTIAN
users = httpx.get(f"{CRM_URL}/rest/v1/users_profile?select=id,nombre_completo&nombre_completo=like.*Sebasti*",
    headers={"apikey": CRM_KEY, "Authorization": f"Bearer {CRM_KEY}"}, timeout=30).json()

for u in users:
    print(f"Actualizando {u['nombre_completo']}: codigo_ventas=26, codempleado=0043")
    httpx.patch(f"{CRM_URL}/rest/v1/users_profile?id=eq.{u['id']}",
        headers={"apikey": CRM_KEY, "Authorization": f"Bearer {CRM_KEY}",
                 "Content-Type": "application/json", "Prefer": "return=minimal"},
        json={"codigo_ventas": 26, "codempleado": "0043"}, timeout=30)

# Verificar
print("\nEstado final:")
all_users = httpx.get(f"{CRM_URL}/rest/v1/users_profile?select=nombre_completo,codigo_ventas,codempleado,rol",
    headers={"apikey": CRM_KEY, "Authorization": f"Bearer {CRM_KEY}"}, timeout=30).json()
for u in all_users:
    cv = u.get('codigo_ventas') or '-'
    ce = u.get('codempleado') or '-'
    print(f"  {u['nombre_completo']:<25} rol={u['rol']:<20} codigo_ventas={cv:<5} codempleado={ce}")
