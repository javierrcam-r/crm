import httpx

VENTAS_URL = "https://dqvrgcdttmbaujkkhngk.supabase.co"
VENTAS_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdnJnY2R0dG1iYXVqa2tobmdrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyMzI5NiwiZXhwIjoyMDkxNzk5Mjk2fQ.EEEUwCNVTc6vzG2ak7PtiB6-uCwj5196olsecjRWk6s"
HEADERS = {"apikey": VENTAS_KEY, "Authorization": f"Bearer {VENTAS_KEY}"}

test_cols = [
    # IDs and codes
    "id", "codigo", "codcliente", "cod", "numero",
    # Name fields
    "nombre", "razonsocial", "razon_social", "nombre_comercial", "apellido",
    # Identification
    "identificacion", "num_identificacion", "tipo_identificacion",
    "ruc", "cedula", "ci", "nit",
    # Contact
    "direccion", "direccion1", "direccion2", "telefono", "telefono1", "telefono2",
    "celular", "fax", "email", "correo", "mail",
    # Location
    "ciudad", "provincia", "pais", "sector", "zona", "parroquia", "canton",
    "codciudad", "codprovincia", "codpais", "codsector", "codzona",
    # Dates
    "fecha_nacimiento", "fecha_registro", "fecha_ingreso", "fecha_creacion",
    "created_at", "updated_at", "fechaingreso",
    # Sales/vendor
    "codvendedor", "cod_vendedor", "vendedor",
    # Status
    "estado", "activo", "anulado", "eliminado",
    # Financial
    "cupo_credito", "credito", "saldo", "plazo", "descuento", "lista_precio",
    "codformapago", "forma_pago", "tipo_cliente", "tipocliente",
    "codtipocliente",
    # Tax
    "contribuyente_especial", "contribuyente", "obligado_contabilidad",
    "tipo_contribuyente", "cod_sri",
    # Other common ERP fields
    "observacion", "observaciones", "notas", "comentario",
    "codempleado", "codcobrador", "codtransportista",
    "web", "contacto", "cargo",
    "limit_credito", "limite_credito",
    "cod_tipo", "codtipo", "clasificacion", "categoria",
    "codcategoria", "grupo", "codgrupo",
    "sucursal", "codsucursal",
    "referencia",
    # Accounting
    "codcuenta", "cuenta_contable", "cuenta",
    # Legacy/import fields
    "index",
]

found = []
missing = []

for col in test_cols:
    try:
        r = httpx.get(
            f"{VENTAS_URL}/rest/v1/clientes?select={col}&limit=1",
            headers=HEADERS, timeout=15
        )
        if r.status_code == 200:
            data = r.json()
            val = data[0][col] if data else "EMPTY"
            found.append((col, val))
            print(f"  EXISTS  {col:<30} sample: {repr(val)}")
        elif r.status_code == 400:
            missing.append(col)
        else:
            print(f"  ???     {col:<30} -> {r.status_code}: {r.text[:100]}")
    except Exception as e:
        print(f"  TIMEOUT {col:<30} -> {str(e)[:60]}")

print(f"\n{'='*60}")
print(f"FOUND columns ({len(found)}):")
for col, val in found:
    print(f"  {col:<30} sample: {repr(val)}")
print(f"\nMISSING columns ({len(missing)}):")
print(f"  {missing}")
