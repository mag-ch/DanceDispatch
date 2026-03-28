import datetime
import os
import csv
from pathlib import Path
from typing import Any
import numpy
import supabase
from supabase import create_client, Client
from data_objects import Event

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


def check_if_event_exists(event: Event):
    eventIds = _fetch_existing_ids(get_supabase_client(), "Events", "google_cal_id")
    if (eventIds and event.id in eventIds):
        print("Skipping existing event with Google Cal ID: " + str(event.id))
        # EVENTS.loc[EVENTS['ID'] == event.id, ['Title', 'StartTime', 'EndTime']] = event.title, event.start_time, event.end_time
        return True
    return False

def _client() -> Client:
    """Return a fresh Supabase client to avoid stale connections (WinError 10054)."""
    return get_supabase_client()


import time

def _execute_with_retry(fn, retries: int = 3, delay: float = 2.0):
    """Call fn() retrying on httpx connection errors."""
    import httpx
    for attempt in range(retries):
        try:
            return fn()
        except (httpx.ConnectError, httpx.RemoteProtocolError) as exc:
            if attempt < retries - 1:
                print(f"Connection error ({exc}), retrying in {delay}s... ({attempt + 1}/{retries})")
                time.sleep(delay)
            else:
                raise


def get_venue_id(venue_name, venue_address):
    response_by_name = _execute_with_retry(lambda: _client().table("Venues").select("id").eq("name", venue_name).limit(1).execute())
    if response_by_name.data:
        return response_by_name.data[0]["id"]

    response_by_address = _execute_with_retry(lambda: _client().table("Venues").select("id").eq("address", venue_address).limit(1).execute())
    if response_by_address.data:
        return response_by_address.data[0]["id"]

    loc = input(f"Venue '{venue_name}' not found. Enter location for new venue, leave blank to use {venue_address}, or 'skip' to skip: ").strip()
    if loc == "":
        temp_json = {
            'name': venue_name,
            'address': venue_address,
            'temp_id': None,
        }
        response = _execute_with_retry(lambda: _client().table("Venues").insert(temp_json).execute())
        print(f"Added new venue: {venue_name} with ID {response.data[0]['id']}")
        return response.data[0]["id"]
    elif loc.lower() == "skip":
        print(f"Skipping adding venue for event at '{venue_name}'")
        return None
    else:
        temp_json = {
            'name': venue_name,
            'address': loc,
            'temp_id': None,
        }
        response = _execute_with_retry(lambda: _client().table("Venues").insert(temp_json).execute())
        print(f"Added new venue: {venue_name} with ID {response.data[0]['id']}")
        return response.data[0]["id"]
    
def get_host_id(hosts):
    host_ids = []
    if not hosts:
        return host_ids
    for host in hosts.strip("[]").split(","):
        if host.strip() == "":
            continue
        response = _execute_with_retry(lambda h=host: _client().table("Hosts").select("id").eq("name", h.strip()).execute())
        if response.data:
            host_ids.append(response.data[0]["id"])
        else:
            name = input(f"Host with name '{host.strip()}' not found. Type 'skip' to skip adding host or leave blank to use {host}: ").strip()
            if name.lower() == "skip":
                print(f"Skipping adding host with name '{host.strip()}'")
                continue
            elif name == "":
                name = host.strip()
                tags = input(f"Enter tags for host '{name}' (comma-separated) or leave blank: ").strip()
                temp_json = {
                    'name': name,
                    'bio': None,
                    'tags': "{" +  ",".join([s.replace("'", "") for s in tags.split(",")]) + "}" if tags else None,
                }
                response = _execute_with_retry(lambda tj=temp_json: _client().table("Hosts").insert(tj).execute())
                print(f"Added new host: {name} with ID {response.data[0]['id']}")
                host_ids.append(response.data[0]["id"])
            else:
                temp_json = {
                    'name': host.strip(),
                    'bio': None,
                    'tags': None,}
                response = _execute_with_retry(lambda tj=temp_json: _client().table("Hosts").insert(tj).execute())
                print(f"Added new host: {host.strip()} with ID {response.data[0]['id']}")
                host_ids.append(response.data[0]["id"])
    return host_ids

def handle_event_entry(event: Event):

    if check_if_event_exists(event):
        return event.id
    venue_id = get_venue_id(event.location, event.address)
    host_ids = get_host_id(event.hosts)
    new_event = {
        'google_cal_id': event.id,
        'title': event.title,
        'start': datetime.datetime.strptime(
            f"{event.start_date} {str(event.start_time)}".strip(),
            "%Y-%m-%d %H:%M:%S"
        ).isoformat(),
        'end': datetime.datetime.strptime(
            f"{event.end_date} {str(event.end_time)}".strip(),
            "%Y-%m-%d %H:%M:%S"
        ).isoformat(),
        'location': venue_id,
        'description': event.description,
        'flyer_url': event.photo_url,
        'price': event.price,
        'external_url': event.external_links.split(",") if event.external_links else []   
    }
    response = _execute_with_retry(lambda ev=new_event: _client().table("Events").insert(ev).execute())
    new_id = response.data[0]["id"]
    
    if len(host_ids) > 0:
        new_event_hosts = list(map(lambda host_id: {
            'event_id': new_id,
            'host_id': host_id,
        }, host_ids))
        response = _execute_with_retry(lambda eh=new_event_hosts: _client().table("event_hosts").insert(eh).execute())

    # new_event_tags = list(map(lambda tag: {
    #     'event_id': new_id,
    #     'tag': tag,
    # }, event.tags.strip("[]").split(","))) if event.tags else []

    # if new_event_tags:
    #     response = client.table("event_tags").insert(new_event_tags).execute()

    print(f"Added new event: {event.title} with ID {event.id}")
    return event.id

if __name__ == "__main__":
    migrate_csv_files()



