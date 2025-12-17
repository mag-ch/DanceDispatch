import pandas as pd
import csv
import sys
from pathlib import Path
from flask_sqlalchemy import SQLAlchemy
from flask_marshmallow import Marshmallow
from marshmallow import ValidationError

from src.data_pipeline import handle_event_entry

"""
/c:/Users/Maggi/DanceDispatch/read_from_csv.py

Usage:
    python read_from_csv.py path/to/events.csv [--dry-run] [--stop-on-error] [--commit-each]

This script reads rows from a CSV and uses the Marshmallow schema defined in event_entry.py
to validate & deserialize each row and insert resulting event objects into the database.

Expectations for event_entry.py (one of these):
- It exposes create_app() (Flask application factory), db (SQLAlchemy), Event (model)
    and EventSchema (flask_marshmallow / marshmallow schema).
OR
- It exposes db, Event, and EventSchema and is already configured to work without
    an app factory.

If your project layout differs, adjust imports below to match.
"""



# Try to import common names from event_entry.py
try:
        # Preferred: application factory present
        from event_entry import create_app, db, Event, EventSchema  # type: ignore
        _HAS_CREATE_APP = True
except Exception:
        try:
                from event_entry import db, Event, EventSchema  # type: ignore
                create_app = None
                _HAS_CREATE_APP = False
        except Exception as e:
                print("Failed to import expected names from event_entry.py:", e, file=sys.stderr)
                sys.exit(2)


def push_app_context():
        if _HAS_CREATE_APP and create_app is not None:
                app = create_app()
                ctx = app.app_context()
                ctx.push()
                return ctx
        return None


def read_rows_from_csv(path):
        path = Path(path)
        if not path.exists():
                print(f"CSV file not found: {path}", file=sys.stderr)
                sys.exit(2)
        df = pd.read_csv(path)  # adjust separator as needed
        print(df.head())

        for index, row in df.iterrows():
                handle_event_entry(row)
                # 'row' is a pandas Series containing the data for the current row
                print(row)


def process_csv(path, dry_run=False, stop_on_error=False, commit_each=False):
        ctx = push_app_context()

        # instantiate schema
        schema = EventSchema()

        added = 0
        errors = 0
        skipped = 0

        path = Path(path)
        if not path.exists():
                print(f"CSV file not found: {path}", file=sys.stderr)
                sys.exit(2)

        with path.open(newline="", encoding="utf-8-sig") as fh:
                reader = csv.DictReader(fh)
                for row_num, row in enumerate(reader, start=1):
                        # Skip empty rows
                        if not any((v or "").strip() for v in row.values()):
                                skipped += 1
                                continue

                        try:
                                obj_data = schema.load(row)
                        except ValidationError as ve:
                                errors += 1
                                print(f"[ROW {row_num}] Validation errors: {ve.messages}", file=sys.stderr)
                                if stop_on_error:
                                        break
                                continue

                        try:
                                # If schema already builds the model (e.g., SQLAlchemyAutoSchema with load_instance),
                                # it may return a model instance. Otherwise, construct one.
                                if isinstance(obj_data, Event):
                                        model_instance = obj_data
                                elif isinstance(obj_data, dict):
                                        model_instance = Event(**obj_data)
                                else:
                                        # fallback: try to pass dict-like
                                        model_instance = Event(**dict(obj_data))

                                if not dry_run:
                                        db.session.add(model_instance)
                                        if commit_each:
                                                db.session.commit()

                                added += 1
                                print(f"[ROW {row_num}] Added: {getattr(model_instance, 'id', '<unsaved>')}")

                        except Exception as e:
                                errors += 1
                                # Rollback to keep session clean if something went wrong during add/commit
                                try:
                                        db.session.rollback()
                                except Exception:
                                        pass
                                print(f"[ROW {row_num}] Failed to add row: {e}", file=sys.stderr)
                                if stop_on_error:
                                        break

        if not dry_run and not commit_each:
                try:
                        db.session.commit()
                except Exception as e:
                        print("Final commit failed:", e, file=sys.stderr)
                        try:
                                db.session.rollback()
                        except Exception:
                                pass
                        sys.exit(3)

        print(f"Done. Added: {added}, Skipped(empty): {skipped}, Errors: {errors}")

        if ctx is not None:
                # pop context if possible (only works if we kept a ref; we used push above without storing ctx variable)
                try:
                        ctx.pop()
                except Exception:
                        pass


def main():
        # filepath: Path to CSV file to import
        # dryrun: "Validate only, do not insert into DB")
        # stoponerror: "Stop the import on first validation/DB error")
        # commiteach: Commit the DB transaction after each row (slower)")

        filepath = "C:/Users/Maggi/Downloads/testdata.txt"
        dryrun = False
        stoponerror = False 
        commiteach = False

        # process_csv(filepath, dry_run=dryrun, stop_on_error=stoponerror, commit_each=commiteach)
        read_rows_from_csv(filepath)


if __name__ == "__main__":
        main()