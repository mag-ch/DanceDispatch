import os
import csv
from pathlib import Path
from typing import Any
import numpy
import supabase
from supabase import create_client, Client

# Load environment variables

CSV_DIR = Path("dance_dispatch/data/csv_files")
NEXT_PUBLIC_SUPABASE_URL = "https://gkiwxeqrcmqotegowgil.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_c1FPKFoUxmpCV7SBnRQV0A_VHFVfwn2"

def get_supabase_client() -> Client:
    """Initialize and return Supabase client"""
    return create_client(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)


def _fetch_existing_ids(
    client: Client,
    table_name: str,
    id_column: str,
    page_size: int = 1000,
) -> set[str]:
    """Fetch all existing IDs from a Supabase table."""
    existing_ids: set[str] = set()
    start = 0

    while True:
        end = start + page_size - 1
        response = (
            client.table(table_name)
            .select(id_column)
            .range(start, end)
            .execute()
        )

        rows = response.data or []
        if not rows:
            break

        for row in rows:
            value = row.get(id_column)
            if value is not None:
                existing_ids.add(str(value).strip())

        if len(rows) < page_size:
            break

        start += page_size

    return existing_ids


def sync_events_csv_to_supabase(
    csv_path: Path | None = None,
    table_name: str = "events",
    csv_id_column: str = "ID",
    db_id_column: str = "id",
    batch_size: int = 500,
) -> dict[str, int]:
    """
    Sync events from events.csv to Supabase, skipping rows where event ID already exists.

    Returns summary counts: read, inserted, skipped_existing, skipped_missing_id.
    """
    client = get_supabase_client()
    csv_file = csv_path or (CSV_DIR / "events.csv")

    if not csv_file.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_file}")

    existing_ids = _fetch_existing_ids(client, table_name, db_id_column)

    rows_to_insert: list[dict[str, Any]] = []
    seen_in_csv: set[str] = set()
    read_count = 0
    skipped_existing = 0
    skipped_missing_id = 0

    with open(csv_file, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)

        for row in reader:
            read_count += 1
            raw_id = row.get(csv_id_column)
            event_id = str(raw_id).strip() if raw_id is not None else ""

            if not event_id:
                skipped_missing_id += 1
                continue

            if event_id in existing_ids or event_id in seen_in_csv:
                skipped_existing += 1
                continue

            payload = dict(row)
            if csv_id_column != db_id_column:
                payload.pop(csv_id_column, None)
            payload[db_id_column] = event_id

            rows_to_insert.append(payload)
            seen_in_csv.add(event_id)

    inserted = 0
    for index in range(0, len(rows_to_insert), batch_size):
        chunk = rows_to_insert[index:index + batch_size]
        if not chunk:
            continue
        client.table(table_name).insert(chunk).execute()
        inserted += len(chunk)

    summary = {
        "read": read_count,
        "inserted": inserted,
        "skipped_existing": skipped_existing,
        "skipped_missing_id": skipped_missing_id,
    }

    print(
        f"Events sync complete: read={summary['read']}, inserted={summary['inserted']}, "
        f"skipped_existing={summary['skipped_existing']}, "
        f"skipped_missing_id={summary['skipped_missing_id']}"
    )

    return summary

def migrate_csv_files():
    """Migrate all CSV files from directory to Supabase"""
    client = get_supabase_client()
    
    if not CSV_DIR.exists():
        print(f"CSV directory not found: {CSV_DIR}")
        return
    

    # existing_venues = _fetch_existing_ids(client, "Venues", "temp_id")
    # with open(CSV_DIR / "venues.csv", "r", encoding="utf-8") as f:
    #     reader = csv.DictReader(f)
    #     venues = list(reader)
    #     print(f"Read {len(venues)} venues from CSV")
    #     for venue in venues:
    #         if venue["ID"] in existing_venues:
    #             print(f"Skipping existing venue: {venue['Name']} (ID: {venue['ID']})")
    #             continue
    #         temp_json = {
    #             'name': venue["Name"],
    #             'address': venue["Address"],
    #             'bio': venue["Bio"],
    #             'type': venue["Type"],
                
    #             'temp_id': venue["ID"],
    #         }
    #         response = client.table("Venues").insert(temp_json).execute()
    #         input("Inserted venue: " + venue["Name"] + " - Press Enter to continue...")
    

    # existing_hosts = _fetch_existing_ids(client, "Hosts", "temp_id")
    # with open(CSV_DIR / "hosts.csv", "r", encoding="utf-8") as f:
    #     reader = csv.DictReader(f)
    #     hosts = list(reader)
    #     print(f"Read {len(hosts)} hosts from CSV")
    #     for host in hosts:
    #         if host["ID"] in existing_hosts:
    #             print(f"Skipping existing host: {host['Name']} (ID: {host['ID']})")
    #             continue
    #         temp_json = {
    #             'name': host["Name"],
    #             'bio': host["Bio"],
    #             'tags': "{" +  ",".join([s.replace("'", "") for s in host["Tags"].strip("[]").split(",")]) + "}" if host["Tags"] else None,
    #             'temp_id': host["ID"],
    #         }
    #         response = client.table("Hosts").insert(temp_json).execute()
    #         input("Inserted host: " + host["Name"] + " - Press Enter to continue...")
    

    existing_events = _fetch_existing_ids(client, "Events", "google_cal_id")

    with open(CSV_DIR / "events.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        events = list(reader)
        print(f"Read {len(events)} events from CSV")
        for event in events:
            if event["ID"] in existing_events:
                print(f"Skipping existing event: {event['Title']} (Google Cal ID: {event['ID']})")
                continue
            temp_json = {
                'title': event["Title"],
                'start': event["StartDate"] + " " + event["StartTime"],
                'end': event["EndDate"] + " " + event["EndTime"],
                'location': client.table("Venues").select("id").eq("temp_id", int(float(event["Location"]))).execute().data[0]["id"] if client.table("Venues").select("id").eq("temp_id", int(float(event["Location"]))).execute().data else None,
                'description': event["Description"],
                'price': event["Price"] if event["Price"] != "" else None,
                'flyer_url': event["PhotoURL"],
                'external_url': event["ExternalURLs"],
                'google_cal_id': event["ID"],
            }
            response = client.table("Events").insert(temp_json).execute()
            # once event is input, create an entry into event_hosts, querying the host id from the Hosts table using the temp_id from the events csv
            host_ids = []
            print(f"Processing hosts for event: {event['Title']} with host temp IDs: {event['Hosts']}")
            for host_temp_id in event["Hosts"].strip("[]").split(","):
                if host_temp_id.strip() == "":
                    continue
                temp_id = int(float(host_temp_id.replace("np.int64(", "").replace(")", "").strip()))
                host_response = client.table("Hosts").select("id").eq("temp_id", temp_id).execute()
                if host_response.data:
                    host_ids.append(host_response.data[0]["id"])
            for host_id in host_ids:
                client.table("event_hosts").insert({
                    'event_id': response.data[0]["id"],
                    'host_id': host_id,
                }).execute()


    # for csv_file in CSV_DIR.glob("*.csv"):
    #     table_name = csv_file.stem
    #     print(f"Migrating {csv_file.name} to table '{table_name}'...")
        
    #     with open(csv_file, "r", encoding="utf-8") as f:
    #         reader = csv.DictReader(f)
    #         rows = list(reader)
            
    #         if rows:
    #             response = client.table(table_name).insert(rows).execute()
    #             print(f"✓ Inserted {len(rows)} rows into '{table_name}'")
    #         else:
    #             print(f"✗ No data found in {csv_file.name}")

if __name__ == "__main__":
    migrate_csv_files()