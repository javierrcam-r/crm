"""
Match mejorado para clientes de Camila.

Problema: En el CRM los nombres son "Nombre Apellido" (2 tokens),
en ventas son "APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2" (4 tokens).

Estrategia:
  1. Match exacto normalizado
  2. Todos los tokens del CRM existen en el nombre de ventas
  3. Similaridad por tokens >= 60% (token overlap)
  4. Match especial para empresas (SAS, SA, etc.)
"""
import httpx
import unicodedata
import re
import sys
import time

CRM_URL = "https://frwymnihodnxmoviuxtt.supabase.co"
CRM_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyd3ltbmlob2RueG1vdml1eHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzkwOTcsImV4cCI6MjA4MzU1NTA5N30.lj9rYLti3GCSReJU-sahHWWAAcZQF0RKTqgQwGPpsZM"

VENTAS_URL = "https://dqvrgcdttmbaujkkhngk.supabase.co"
VENTAS_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdnJnY2R0dG1iYXVqa2tobmdrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyMzI5NiwiZXhwIjoyMDkxNzk5Mjk2fQ.EEEUwCNVTc6vzG2ak7PtiB6-uCwj5196olsecjRWk6s"

CRM_H = {"apikey": CRM_KEY, "Authorization": f"Bearer {CRM_KEY}"}
VEN_H = {"apikey": VENTAS_KEY, "Authorization": f"Bearer {VENTAS_KEY}"}

CAMILA_USER_ID = "424646b2-c612-4ffc-b974-f01e42902082"
CAMILA_PROFILE_ID = "249f7d4e-7887-499c-aac5-d9a1287cfca1"
CAMILA_COD_VENTAS = 27

# ── Normalización ────────────────────────────────────────────

def normalize(name):
    """Normaliza: mayúscula, sin acentos, sin caracteres especiales."""
    if not name:
        return ""
    name = name.split("/")[0]
    name = unicodedata.normalize("NFD", name)
    name = "".join(c for c in name if unicodedata.category(c) != "Mn")
    name = re.sub(r"[^A-Za-z0-9\s]", " ", name)
    return " ".join(name.upper().split())

def tokens(name):
    """Extrae tokens significativos (>= 2 chars)."""
    return {t for t in normalize(name).split() if len(t) >= 2}

def is_business(name):
    """Detecta si el nombre es de una empresa."""
    biz_words = {"SAS", "SA", "CIA", "LTDA", "CORP", "INC", "LLC"}
    name_upper = normalize(name)
    return bool(biz_words & set(name_upper.split()))

# ── Algoritmo de match ───────────────────────────────────────

def match_score(crm_name, ventas_name):
    """
    Retorna (score, match_type) o (0, None) si no hay match.
    
    Score más alto = mejor match.
    """
    crm_norm = normalize(crm_name)
    ven_norm = normalize(ventas_name)
    
    # Exacto
    if crm_norm == ven_norm:
        return (100, "exacto")
    
    crm_toks = tokens(crm_name)
    ven_toks = tokens(ventas_name)
    
    if not crm_toks or not ven_toks:
        return (0, None)
    
    common = crm_toks & ven_toks
    
    # Todos los tokens del CRM están en ventas (ideal para "Nombre Apellido" vs "APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2")
    if crm_toks <= ven_toks:
        coverage = len(common) / max(len(crm_toks), len(ven_toks))
        score = 80 + int(coverage * 20)
        return (score, f"contenido({len(common)}/{len(crm_toks)})")
    
    # Todos los tokens de ventas están en CRM (raro pero posible)
    if ven_toks <= crm_toks:
        coverage = len(common) / max(len(crm_toks), len(ven_toks))
        score = 75 + int(coverage * 20)
        return (score, f"inverso({len(common)}/{len(ven_toks)})")
    
    # Overlap parcial >= 60%
    sim = len(common) / min(len(crm_toks), len(ven_toks))
    if sim >= 0.60 and len(common) >= 2:
        score = int(sim * 70)
        return (score, f"parcial({sim:.0%})")
    
    return (0, None)

def match_business(crm_name, ventas_name):
    """Match especial para empresas: normaliza eliminando sufijos legales."""
    biz_suffixes = {"SAS", "SA", "CIA", "LTDA", "CORP", "INC", "LLC"}
    
    def clean_biz(name):
        toks = normalize(name).split()
        return " ".join(t for t in toks if t not in biz_suffixes)
    
    crm_clean = clean_biz(crm_name)
    ven_clean = clean_biz(ventas_name)
    
    if not crm_clean or not ven_clean:
        return (0, None)
    
    if crm_clean == ven_clean:
        return (95, "empresa-exacto")
    
    crm_toks = set(crm_clean.split())
    ven_toks = set(ven_clean.split())
    
    common = crm_toks & ven_toks
    if common and (crm_toks <= ven_toks or ven_toks <= crm_toks):
        return (85, f"empresa-contenido({len(common)}tok)")
    
    if len(common) >= 1 and len(common) / min(len(crm_toks), len(ven_toks)) >= 0.5:
        return (60, f"empresa-parcial({len(common)}tok)")
    
    return (0, None)

# ── Fetch data ───────────────────────────────────────────────

def fetch_paginated(url, headers, timeout=30, max_retries=3):
    rows = []
    offset = 0
    page_size = 1000
    while True:
        sep = "&" if "?" in url else "?"
        full_url = f"{url}{sep}limit={page_size}&offset={offset}"
        for attempt in range(1, max_retries + 1):
            try:
                r = httpx.get(full_url, headers=headers, timeout=timeout)
                r.raise_for_status()
                data = r.json()
                break
            except Exception as e:
                if attempt < max_retries:
                    time.sleep(2 * attempt)
                else:
                    raise
        if not data:
            break
        rows.extend(data)
        if len(data) < page_size:
            break
        offset += page_size
    return rows

# ── Main ─────────────────────────────────────────────────────

print("=" * 70)
print("MATCH MEJORADO: CLIENTES DE CAMILA")
print("=" * 70)
sys.stdout.flush()

# 1. CRM customers de Camila (por user_id)
print("\n[1/4] Cargando clientes CRM de Camila...")
sys.stdout.flush()

crm_customers = fetch_paginated(
    f"{CRM_URL}/rest/v1/customers?select=id,nombre,codigo_cliente_ventas,num_identificacion&user_id=eq.{CAMILA_USER_ID}&deleted_at=is.null&order=nombre",
    CRM_H
)

# También incluir asignados
assignments = fetch_paginated(
    f"{CRM_URL}/rest/v1/customer_vendor_assignments?select=customer_id&vendor_user_id=eq.{CAMILA_PROFILE_ID}",
    CRM_H
)
assigned_ids = {a["customer_id"] for a in assignments}
owned_ids = {c["id"] for c in crm_customers}
extra_ids = assigned_ids - owned_ids

if extra_ids:
    ids_str = ",".join(f'"{x}"' for x in extra_ids)
    extra_custs = httpx.get(
        f"{CRM_URL}/rest/v1/customers?select=id,nombre,codigo_cliente_ventas,num_identificacion&id=in.({ids_str})&deleted_at=is.null",
        headers=CRM_H, timeout=15
    ).json()
    crm_customers.extend(extra_custs)

already_matched = [c for c in crm_customers if c.get("codigo_cliente_ventas")]
unmatched = [c for c in crm_customers if not c.get("codigo_cliente_ventas")]

print(f"  Total CRM: {len(crm_customers)} ({len(already_matched)} ya con match, {len(unmatched)} pendientes)")
sys.stdout.flush()

# 2. Clientes externos de Camila (codvendedor=27)
print("\n[2/4] Cargando clientes de ventas (codvendedor={})...".format(CAMILA_COD_VENTAS))
sys.stdout.flush()

ventas_clientes = httpx.get(
    f"{VENTAS_URL}/rest/v1/clientes?select=codigo,nombre,numero_identificacion,tipo_identificacion,fecha_nacimiento,codvendedor&codvendedor=eq.{CAMILA_COD_VENTAS}&order=nombre",
    headers=VEN_H, timeout=30
).json()
print(f"  Total ventas: {len(ventas_clientes)} clientes")
sys.stdout.flush()

# Excluir los que ya están matcheados
already_codes = {c["codigo_cliente_ventas"] for c in already_matched}
ventas_available = [vc for vc in ventas_clientes if vc["codigo"] not in already_codes]
print(f"  Disponibles para match: {len(ventas_available)} (excluidos {len(ventas_clientes) - len(ventas_available)} ya asignados)")
sys.stdout.flush()

# 3. Ejecutar match
print("\n[3/4] Ejecutando match...")
print("-" * 70)
sys.stdout.flush()

matches = []
no_match_crm = []
used_ventas_codes = set()

for crm_cust in sorted(unmatched, key=lambda x: x["nombre"]):
    crm_name = crm_cust["nombre"]
    crm_is_biz = is_business(crm_name)
    
    best_score = 0
    best_vc = None
    best_type = None
    
    for vc in ventas_available:
        if vc["codigo"] in used_ventas_codes:
            continue
        
        ven_name = vc.get("nombre", "")
        
        if crm_is_biz or is_business(ven_name):
            score, mtype = match_business(crm_name, ven_name)
        else:
            score, mtype = match_score(crm_name, ven_name)
        
        if score > best_score:
            best_score = score
            best_vc = vc
            best_type = mtype
    
    if best_vc and best_score >= 42:
        used_ventas_codes.add(best_vc["codigo"])
        
        fecha_nac = best_vc.get("fecha_nacimiento")
        if fecha_nac:
            fecha_nac = fecha_nac[:10]
        
        matches.append({
            "crm_id": crm_cust["id"],
            "crm_nombre": crm_name,
            "ventas_codigo": best_vc["codigo"],
            "ventas_nombre": best_vc.get("nombre", ""),
            "num_identificacion": best_vc.get("numero_identificacion"),
            "tipo_identificacion": best_vc.get("tipo_identificacion"),
            "fecha_nacimiento": fecha_nac,
            "match_type": best_type,
            "score": best_score,
        })
        tag = "OK" if best_score >= 80 else "??"
        print(f"  [{tag}] {crm_name:<35} -> {best_vc['nombre']:<45} ({best_type}, score={best_score})")
    else:
        no_match_crm.append(crm_cust)
        print(f"  [--] {crm_name:<35} -> SIN MATCH")
    
    sys.stdout.flush()

# Resumen
print("\n" + "=" * 70)
print("RESUMEN DEL MATCH")
print("=" * 70)
high_conf = [m for m in matches if m["score"] >= 80]
low_conf = [m for m in matches if m["score"] < 80]
print(f"  Matches alta confianza (>=80):  {len(high_conf)}")
print(f"  Matches baja confianza (<80):   {len(low_conf)}")
print(f"  Sin match:                      {len(no_match_crm)}")
print(f"  Ya tenian match previo:         {len(already_matched)}")
sys.stdout.flush()

if low_conf:
    print(f"\n  Matches de BAJA CONFIANZA (revisar manualmente):")
    for m in low_conf:
        print(f"    {m['crm_nombre']:<35} -> {m['ventas_nombre']:<45} ({m['match_type']}, score={m['score']})")
    sys.stdout.flush()

if no_match_crm:
    print(f"\n  SIN MATCH ({len(no_match_crm)}):")
    for c in no_match_crm:
        print(f"    {c['nombre']}")
    sys.stdout.flush()

if not matches:
    print("\nNo hay matches para aplicar.")
    sys.exit(0)

# 4. Aplicar solo alta confianza
to_apply = high_conf
print(f"\n[4/4] Aplicando {len(to_apply)} matches de alta confianza...")
sys.stdout.flush()

ok = 0
errors = 0
for m in to_apply:
    data = {
        "codigo_cliente_ventas": m["ventas_codigo"],
    }
    if m["num_identificacion"]:
        data["num_identificacion"] = m["num_identificacion"]
    if m["tipo_identificacion"]:
        data["tipo_identificacion"] = m["tipo_identificacion"]
    if m["fecha_nacimiento"]:
        data["fecha_nacimiento"] = m["fecha_nacimiento"]
    
    try:
        url = f"{CRM_URL}/rest/v1/customers?id=eq.{m['crm_id']}"
        headers = {**CRM_H, "Content-Type": "application/json", "Prefer": "return=minimal"}
        r = httpx.patch(url, headers=headers, json=data, timeout=15)
        r.raise_for_status()
        ok += 1
    except Exception as e:
        errors += 1
        print(f"  ERROR {m['crm_nombre']}: {str(e)[:80]}")
    
ok_str = f"{ok}/{len(to_apply)}"
print(f"\n  Actualizados: {ok_str} ({errors} errores)")

if low_conf:
    print(f"\n  PENDIENTE: {len(low_conf)} matches de baja confianza para revisión manual.")
    print("  Puedes asignarlos manualmente editando 'Código Sistema Ventas' en el CRM.")

print(f"\n{'=' * 70}")
print("LISTO")
print(f"{'=' * 70}")
