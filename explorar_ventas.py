from supabase import create_client
import pandas as pd

VENTAS_URL = "https://dqvrgcdttmbaujkkhngk.supabase.co"
VENTAS_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdnJnY2R0dG1iYXVqa2tobmdrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIyMzI5NiwiZXhwIjoyMDkxNzk5Mjk2fQ.EEEUwCNVTc6vzG2ak7PtiB6-uCwj5196olsecjRWk6s"

ventas = create_client(VENTAS_URL, VENTAS_KEY)
cols = "fecha_emision,total,codvendedor,anulada,codcomprobante"

# Try month by month to avoid timeout
all_data = []
for year in [2024, 2025, 2026]:
    for month in range(1, 13):
        start = f"{year}-{month:02d}-01"
        if month == 12:
            end = f"{year+1}-01-01"
        else:
            end = f"{year}-{month+1:02d}-01"
        
        try:
            r = ventas.table("ventas").select(cols).gte("fecha_emision", start).lt("fecha_emision", end).eq("anulada", False).limit(1000).execute()
            if r.data:
                print(f"{start}: {len(r.data)} ventas")
                all_data.extend(r.data)
            else:
                if year <= 2025:
                    print(f"{start}: 0 ventas")
                else:
                    break
        except Exception as e:
            print(f"{start}: ERROR - {str(e)[:80]}")
        
        if year == 2026 and month >= 6:
            break

print(f"\nTotal registros: {len(all_data)}")

if all_data:
    df = pd.DataFrame(all_data)
    df['fecha_emision'] = pd.to_datetime(df['fecha_emision'])
    df['mes'] = df['fecha_emision'].dt.to_period('M')

    print(f"\ncodvendedor unicos: {sorted(df['codvendedor'].dropna().unique().tolist())}")
    print(f"codcomprobante unicos: {sorted(df['codcomprobante'].dropna().unique().tolist())}")

    print("\nResumen por codvendedor:")
    resumen = df.groupby('codvendedor').agg(
        num_ventas=('total', 'count'),
        total_ventas=('total', 'sum')
    ).sort_values('total_ventas', ascending=False)
    print(resumen.to_string())

    print("\nResumen mensual global:")
    mensual = df.groupby('mes').agg(
        num_ventas=('total', 'count'),
        total_ventas=('total', 'sum')
    )
    pd.set_option('display.float_format', '{:,.2f}'.format)
    print(mensual.to_string())
