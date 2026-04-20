"""
Match de clientes entre CRM y base de ventas.
- Usa customer_vendor_assignments para agrupar customers por vendedor
- Hace match por nombre normalizado, agrupado por codvendedor
- Actualiza CRM con: codigo_cliente_ventas, num_identificacion, tipo_identificacion, fecha_nacimiento
"""
import httpx
import unicodedata
import re
import sys
import time
from collections import Counter

VENTAS_URL = "https://dqvrgcdttmbaujkkhngk.supabase.co"
VENTAS_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdnJnY2R0dG1iYXVqa2tobmdrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyMzI5NiwiZXhwIjoyMDkxNzk5Mjk2fQ.EEEUwCNVTc6vzG2ak7PtiB6-uCwj5196olsecjRWk6s"

CRM_URL = "https://frwymnihodnxmoviuxtt.supabase.co"
CRM_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyd3ltbmlob2RueG1vdml1eHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzkwOTcsImV4cCI6MjA4MzU1NTA5N30.lj9rYLti3GCSReJU-sahHWWAAcZQF0RKTqgQwGPpsZM"

VENTAS_HEADERS = {"apikey": VENTAS_KEY, "Authorization": f"Bearer {VENTAS_KEY}"}
CRM_HEADERS = {"apikey": CRM_KEY, "Authorization": f"Bearer {CRM_KEY}"}

MAX_RETRIES = 5
PAGE_SIZE = 1000

# ── Utilidades ──────────────────────────────────────────

def normalize(name):
    if not name:
        return ""
    name = name.split("/")[0]
    name = unicodedata.normalize("NFD", name)
    name = "".join(c for c in name if unicodedata.category(c) != "Mn")
    name = re.sub(r"[^A-Za-z0-9\s]", " ", name)
    return " ".join(name.upper().split())

def name_tokens(name):
    return {t for t in normalize(name).split() if len(t) >= 2}

def token_similarity(tokens_a, tokens_b):
    if not tokens_a or not tokens_b:
        return 0.0
    common = len(tokens_a & tokens_b)
    return common / min(len(tokens_a), len(tokens_b))

# ── Descarga paginada ───────────────────────────────────

def fetch_crm(endpoint, extra_qs=""):
    all_rows = []
    offset = 0
    while True:
        url = f"{CRM_URL}/rest/v1/{endpoint}&limit={PAGE_SIZE}&offset={offset}"
        if extra_qs:
            url += f"&{extra_qs}"
        r = httpx.get(url, headers=CRM_HEADERS, timeout=30)
        r.raise_for_status()
        rows = r.json()
        if not rows:
            break
        all_rows.extend(rows)
        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return all_rows

def fetch_ventas_clientes():
    cols = "codigo,nombre,numero_identificacion,tipo_identificacion,fecha_nacimiento,codvendedor"
    all_rows = []
    offset = 0
    while True:
        url = f"{VENTAS_URL}/rest/v1/clientes?select={cols}&order=codigo&limit={PAGE_SIZE}&offset={offset}"
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                r = httpx.get(url, headers=VENTAS_HEADERS, timeout=90)
                r.raise_for_status()
                rows = r.json()
                break
            except Exception:
                if attempt < MAX_RETRIES:
                    wait = 3 * attempt
                    print(f"    (retry {attempt}, espera {wait}s...)")
                    sys.stdout.flush()
                    time.sleep(wait)
                else:
                    raise
        if not rows:
            break
        all_rows.extend(rows)
        print(f"    +{len(rows)} (total: {len(all_rows)})")
        sys.stdout.flush()
        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return all_rows

def crm_update(customer_id, data):
    url = f"{CRM_URL}/rest/v1/customers?id=eq.{customer_id}"
    headers = {**CRM_HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal"}
    r = httpx.patch(url, headers=headers, json=data, timeout=15)
    r.raise_for_status()

# ── Main ────────────────────────────────────────────────

print("=" * 70)
print("MATCH DE CLIENTES: CRM <-> BASE DE VENTAS")
print("=" * 70)
sys.stdout.flush()

# 1. Mapeo vendedores: users_profile.id -> codigo_ventas
print("\n[1/6] Cargando mapeo de vendedores...")
sys.stdout.flush()

vendors_raw = httpx.get(
    f"{CRM_URL}/rest/v1/users_profile?select=id,nombre_completo,codigo_ventas&codigo_ventas=not.is.null",
    headers=CRM_HEADERS, timeout=15,
).json()

# profile_id -> {codigo_ventas, nombre}
vendor_by_profile = {}
# codigo_ventas -> {profile_id, nombre}
vendor_by_code = {}
for v in vendors_raw:
    vendor_by_profile[v["id"]] = {"codigo_ventas": v["codigo_ventas"], "nombre": v["nombre_completo"]}
    vendor_by_code[v["codigo_ventas"]] = {"profile_id": v["id"], "nombre": v["nombre_completo"]}
    print(f"  cod={v['codigo_ventas']:>3} -> {v['nombre_completo']} (profile={v['id'][:8]}...)")

print(f"  {len(vendor_by_profile)} vendedores con codigo_ventas")
sys.stdout.flush()

# 2. Descargar customer_vendor_assignments
print("\n[2/6] Cargando asignaciones customer <-> vendedor...")
sys.stdout.flush()

assignments = fetch_crm("customer_vendor_assignments?select=customer_id,vendor_user_id")
print(f"  {len(assignments)} asignaciones totales")

# customer_id -> set of profile_ids (vendors)
customer_vendors = {}
# profile_id -> set of customer_ids
vendor_customers = {}
for a in assignments:
    cid = a["customer_id"]
    vid = a["vendor_user_id"]
    customer_vendors.setdefault(cid, set()).add(vid)
    vendor_customers.setdefault(vid, set()).add(cid)

for pid, cids in sorted(vendor_customers.items(), key=lambda x: len(x[1]), reverse=True):
    vinfo = vendor_by_profile.get(pid, {})
    vname = vinfo.get("nombre", "sin codigo_ventas")
    vcod = vinfo.get("codigo_ventas", "-")
    print(f"  vendor={pid[:8]}... ({vname}, cod={vcod}): {len(cids)} customers")
sys.stdout.flush()

# 3. Descargar clientes de ventas
print("\n[3/6] Descargando clientes de base de ventas...")
sys.stdout.flush()
ventas_clientes = fetch_ventas_clientes()
print(f"  Total: {len(ventas_clientes)} clientes de ventas")
sys.stdout.flush()

# 4. Descargar customers del CRM
print("\n[4/6] Descargando customers del CRM...")
sys.stdout.flush()
crm_customers = fetch_crm("customers?select=id,nombre,user_id,codigo_cliente_ventas", "deleted_at=is.null")
print(f"  Total: {len(crm_customers)} customers activos")

crm_by_id = {c["id"]: c for c in crm_customers}
sys.stdout.flush()

# 5. Match por vendedor
print("\n[5/6] Ejecutando match por vendedor...")
print("=" * 70)
sys.stdout.flush()

# Agrupar clientes de ventas por codvendedor
ventas_by_vendor = {}
for c in ventas_clientes:
    cod = c.get("codvendedor")
    if cod is not None:
        ventas_by_vendor.setdefault(cod, []).append(c)

matches = []
no_match_ventas = []
total_already = 0

for codvendedor in sorted(ventas_by_vendor.keys()):
    vendor_info = vendor_by_code.get(codvendedor)
    if not vendor_info:
        no_match_ventas.extend(ventas_by_vendor[codvendedor])
        continue

    vendor_name = vendor_info["nombre"]
    profile_id = vendor_info["profile_id"]
    v_clientes = ventas_by_vendor[codvendedor]

    # CRM customers asignados a este vendedor (via assignments)
    assigned_ids = vendor_customers.get(profile_id, set())
    c_customers = [crm_by_id[cid] for cid in assigned_ids if cid in crm_by_id]

    print(f"\n  VENDEDOR {codvendedor}: {vendor_name}")
    print(f"  Ventas: {len(v_clientes)} clientes | CRM asignados: {len(c_customers)} customers")

    if not c_customers:
        print(f"  (sin customers asignados en CRM)")
        no_match_ventas.extend(v_clientes)
        continue

    # Indexar CRM por nombre normalizado
    crm_by_norm = {}
    crm_with_tokens = []
    for cc in c_customers:
        norm = normalize(cc["nombre"])
        crm_by_norm[norm] = cc
        crm_with_tokens.append((cc, name_tokens(cc["nombre"])))

    matched_crm_ids = set()
    vendor_matched = 0
    vendor_skipped = 0
    vendor_nomatch = 0

    for vc in v_clientes:
        vc_norm = normalize(vc.get("nombre", ""))
        vc_tokens = name_tokens(vc.get("nombre", ""))

        best_match = None
        match_type = None

        # Pasada 1: exacto normalizado
        if vc_norm in crm_by_norm and crm_by_norm[vc_norm]["id"] not in matched_crm_ids:
            best_match = crm_by_norm[vc_norm]
            match_type = "exacto"
        else:
            # Pasada 2: tokens >=70%
            best_sim = 0
            for cc, cc_tokens in crm_with_tokens:
                if cc["id"] in matched_crm_ids:
                    continue
                sim = token_similarity(vc_tokens, cc_tokens)
                if sim > best_sim and sim >= 0.70:
                    best_sim = sim
                    best_match = cc
                    match_type = f"tokens({sim:.0%})"

        if best_match:
            if best_match.get("codigo_cliente_ventas"):
                vendor_skipped += 1
                matched_crm_ids.add(best_match["id"])
                total_already += 1
                continue

            matched_crm_ids.add(best_match["id"])
            vendor_matched += 1

            fecha_nac = vc.get("fecha_nacimiento")
            if fecha_nac:
                fecha_nac = fecha_nac[:10]

            matches.append({
                "crm_id": best_match["id"],
                "crm_nombre": best_match["nombre"],
                "ventas_codigo": vc["codigo"],
                "ventas_nombre": vc.get("nombre", ""),
                "num_identificacion": vc.get("numero_identificacion"),
                "tipo_identificacion": vc.get("tipo_identificacion"),
                "fecha_nacimiento": fecha_nac,
                "match_type": match_type,
                "codvendedor": codvendedor,
            })
        else:
            vendor_nomatch += 1

    print(f"  -> Matched: {vendor_matched} | Ya con codigo: {vendor_skipped} | Sin match: {vendor_nomatch}")
    sys.stdout.flush()

print("\n" + "=" * 70)
print("RESUMEN DE MATCH")
print(f"  Nuevos matches encontrados: {len(matches)}")
print(f"  Ya tenian codigo previo:    {total_already}")
print(f"  Sin vendedor en CRM:        {len(no_match_ventas)}")
print("=" * 70)
sys.stdout.flush()

if not matches:
    print("\nNo hay matches nuevos que aplicar.")
    sys.exit(0)

# Mostrar matches
print(f"\nMatches encontrados ({len(matches)}):")
for m in matches[:30]:
    fna = m["fecha_nacimiento"] or "-"
    nid = m["num_identificacion"] or "-"
    print(f"  [{m['match_type']:>12}] V{m['codvendedor']:>2} | CRM: {m['crm_nombre'][:30]:<30} <- Ventas: {m['ventas_nombre'][:30]:<30} cod={m['ventas_codigo']:<5} id={nid:<15} fnac={fna}")
if len(matches) > 30:
    print(f"  ... y {len(matches) - 30} mas")
sys.stdout.flush()

# 6. Aplicar
print(f"\n[6/6] Aplicando {len(matches)} actualizaciones al CRM...")
sys.stdout.flush()

ok = 0
errors = 0
for m in matches:
    data = {
        "codigo_cliente_ventas": m["ventas_codigo"],
        "num_identificacion": m["num_identificacion"],
        "tipo_identificacion": m["tipo_identificacion"],
    }
    if m["fecha_nacimiento"]:
        data["fecha_nacimiento"] = m["fecha_nacimiento"]

    try:
        crm_update(m["crm_id"], data)
        ok += 1
    except Exception as e:
        errors += 1
        print(f"  ERROR {m['crm_nombre']}: {str(e)[:80]}")

    if ok % 50 == 0 and ok > 0:
        print(f"  ... {ok}/{len(matches)}")
        sys.stdout.flush()

print(f"\n  Actualizados: {ok}/{len(matches)} ({errors} errores)")

# Resumen por vendedor
print("\n" + "=" * 70)
print("RESUMEN FINAL POR VENDEDOR")
print("=" * 70)
vcounts = Counter(m["codvendedor"] for m in matches)
for cod in sorted(vcounts.keys()):
    vname = vendor_by_code.get(cod, {}).get("nombre", f"#{cod}")
    print(f"  codvendedor={cod:>3} ({vname:<25}): {vcounts[cod]} matches")
print(f"\n  TOTAL: {ok} customers actualizados en el CRM")
