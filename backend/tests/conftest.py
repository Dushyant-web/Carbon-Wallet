import os
import tempfile

# Point the API at a throwaway SQLite file before app.db is imported.
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"
