import pandas as pd
import os
from sqlalchemy import create_engine

# ⚠️ USA ESTO SOLO UNA VEZ Y LUEGO CAMBIA LA PASSWORD
engine = create_engine(
    "postgresql+psycopg2://postgres.dqvrgcdttmbaujkkhngk:Disfero11213@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
)
export_dir = r"D:\Descargas\EMPRESAC_export_final"

files = [f for f in os.listdir(export_dir) if f.endswith(".csv")]

errores = []

for file in files:
    print(f"Subiendo {file}...")

    path = os.path.join(export_dir, file)

    parts = file.split(".")
    if len(parts) >= 2:
        table_name = parts[1].lower()
    else:
        table_name = file.replace(".csv", "").lower()

    try:
        df = pd.read_csv(path, on_bad_lines="skip")

        df.columns = [c.lower().replace(" ", "_") for c in df.columns]

        for col in df.columns:
            try:
                df[col] = pd.to_numeric(df[col])
            except:
                try:
                    df[col] = pd.to_datetime(df[col])
                except:
                    pass

        df.to_sql(
            table_name,
            engine,
            schema="public",
            if_exists="replace",
            index=False,
            chunksize=5000
        )
        print(f"  OK: {table_name} ({len(df)} filas)")
    except Exception as e:
        print(f"  ERROR en {file}: {e}")
        errores.append(file)

print("\nLISTO TODO")
if errores:
    print(f"Archivos con error ({len(errores)}): {errores}")