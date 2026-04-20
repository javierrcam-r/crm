from supabase import create_client

CRM_URL = "https://frwymnihodnxmoviuxtt.supabase.co"
CRM_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyd3ltbmlob2RueG1vdml1eHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzkwOTcsImV4cCI6MjA4MzU1NTA5N30.lj9rYLti3GCSReJU-sahHWWAAcZQF0RKTqgQwGPpsZM"

crm = create_client(CRM_URL, CRM_KEY)

# Matches confirmados (descartados: Javier Rojas, Administrador, Maribel Ortega)
# Camila usa codigo=24 (CAMILA F, codempleado=0056, activa)
updates = [
    {"nombre": "Xavier Naranjo",      "id": "b56d1435-c607-47a1-b100-3b430afa3045", "codigo_ventas": 30, "codempleado": "0055"},
    {"nombre": "Camila Fernandez",    "id": "249f7d4e-7887-499c-aac5-d9a1287cfca1", "codigo_ventas": 24, "codempleado": "0056"},
    {"nombre": "Miriam Rojas",        "id": "cefdb9c2-6d43-45b7-a1cf-3b3bb70b8b92", "codigo_ventas": 11, "codempleado": None},
    {"nombre": "Glenda Belduma",      "id": "78cfaefd-bff3-4b33-b914-6167185a6994", "codigo_ventas": 29, "codempleado": "0030"},
    {"nombre": "Bolívar Fernández",   "id": "5af556d3-c121-4cbf-8524-26468b66cd3f", "codigo_ventas": 19, "codempleado": None},
    {"nombre": "Lolita",              "id": "d85b1864-137c-4583-a0a8-655412f7b231", "codigo_ventas": 7,  "codempleado": None},
    {"nombre": "Paulina Fernández",   "id": "123a1682-9e1a-45d0-b2a1-d4d37920fa61", "codigo_ventas": 20, "codempleado": "0037"},
    {"nombre": "Sebastián Aguilar",   "id": "cb291494-9ff9-4e70-b193-047c23ec7f69", "codigo_ventas": 25, "codempleado": None},
    {"nombre": "Mónica Morales",      "id": "c32af35d-bc1c-42c0-96ef-2e190825756e", "codigo_ventas": 28, "codempleado": "0012"},
]

print("Actualizando users_profile en base CRM...")
print("=" * 70)

ok = 0
errores = []

for u in updates:
    data = {"codigo_ventas": u["codigo_ventas"]}
    if u["codempleado"]:
        data["codempleado"] = u["codempleado"]

    try:
        result = crm.table("users_profile").update(data).eq("id", u["id"]).execute()
        if result.data:
            cod = u["codempleado"] or "-"
            print(f"  OK  {u['nombre']:<25} codigo_ventas={u['codigo_ventas']}, codempleado={cod}")
            ok += 1
        else:
            print(f"  WARN {u['nombre']:<25} No se encontró el registro")
            errores.append(u["nombre"])
    except Exception as e:
        print(f"  ERR {u['nombre']:<25} {e}")
        errores.append(u["nombre"])

print("=" * 70)
print(f"Actualizados: {ok}/{len(updates)}")
if errores:
    print(f"Con error: {errores}")

# Verificación final
print("\nVERIFICACION - users_profile actualizado:")
print("=" * 70)
result = crm.table("users_profile").select("nombre_completo, codigo_ventas, codempleado, rol").execute()
for row in result.data:
    cod = row.get("codigo_ventas") or "-"
    emp = row.get("codempleado") or "-"
    print(f"  {row['nombre_completo']:<25} codigo_ventas={str(cod):>4}  codempleado={str(emp):>5}  rol={row['rol']}")
