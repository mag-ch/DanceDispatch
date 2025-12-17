# a bunhc of functions that take in data regardless of format, and pipeliens it into csvs
import datetime
from zoneinfo import ZoneInfo
from dateutil import parser
import pandas as pd
from data_objects import Event, Venue, Host

PREFIX = "./dance_dispatch/data/csv_files/"
vfilepath = PREFIX + "venues.csv"
hfilepath = PREFIX + "hosts.csv"   
efilepath = PREFIX + "events.csv"
VENUES = pd.read_csv(vfilepath)
HOSTS = pd.read_csv(hfilepath)
EVENTS = pd.read_csv(efilepath)


def check_if_event_exists(event: Event):
    global EVENTS
    if (event.id != None):
        if (event.id in EVENTS['ID'].values):
                print("FOUND + UPDATE ")
                print( event)
                # EVENTS.loc[EVENTS['ID'] == event.id, ['Title', 'StartTime', 'EndTime']] = event.title, event.start_time, event.end_time
                print(f"Event with ID {event.id} already exists. Skipping.")
                return True
    return False

def handle_event_entry(event: Event):
    global EVENTS, VENUES, HOSTS
    if check_if_event_exists(event):
        return event.id
    venue_id = get_venue_id(event.location, event.address)
    host_ids = get_host_id(event.hosts)
    new_event = {
        'ID': event.id,
        'Title': event.title,
        'StartDate': event.start_date,
        'StartTime': event.start_time,
        'EndDate': event.end_date,
        'EndTime': event.end_time,
        'Location': venue_id,
        'Description': event.description,
        'Hosts': host_ids,
        'PhotoURL': event.photo_url,
        'Tags': event.tags,
        'Price': event.price,
        'ExternalURLs': event.external_links.split(",") if event.external_links else []   
    }
    print(EVENTS)
    new_event_df = pd.DataFrame([new_event])
    EVENTS = pd.concat([EVENTS, new_event_df], ignore_index=True)
    EVENTS.to_csv(efilepath, index=False)
    event.id = len(EVENTS)
    print(f"Added new event: {event.title} with ID {event.id}")
    return event.id

def get_venue_id(venue_name, venue_address):
    global VENUES
    if venue_name == "" and venue_address == "":
        print("No venue name or address provided; skipping venue addition.")
        return
    matched_venues = VENUES[(VENUES['Name'] == venue_name) | (VENUES['Address'] == venue_address)]
    if not matched_venues.empty:
        return matched_venues['ID'].values[0] 
    else:
        vname_inp = input(f"Venue '{venue_name}' not found. Enter venue name to add or leave blank to skip adding venue: ").strip()
        if vname_inp == "":
                print(f"Skipping adding venue for event at '{venue_name}'")
                return
        else:
                vaddress_inp = input(f"Enter address for venue '{vname_inp}' or leave blank to use '{venue_address}': ").strip()
        vid = max(VENUES['ID'].values) + 1 if not VENUES.empty else 0
        new_venue = {
            'ID': vid,
            'Name': vname_inp,
            'Address': vaddress_inp if vaddress_inp else venue_address,
            'Bio': '',
            'Tags': '',
            'Residents': '',
            'NearestStation': '',
            'DistanceFromStation': '',
            'NumberOfZones': '',
            'TotalArea': '',
            'ExternalLinks': '',
            'PhotoURLs': ''
        }
        VENUES = pd.concat([VENUES, pd.DataFrame([new_venue])], ignore_index=True)
        VENUES.to_csv(vfilepath, index=False)
        print(f"Added new venue: {venue_name} with ID {vid}")
        return vid

def get_host_id(listofhostnames):
    global HOSTS
    if not listofhostnames:
        return []
    hosts = listofhostnames.split(",")
    host_ids = []
    for host in hosts:
        if host.strip() == "":
            continue
        matched_hosts = HOSTS[HOSTS['Name'] == host.strip()]
        if not matched_hosts.empty:
            host_ids.append(matched_hosts['ID'].values[0])
        else:
            print(f"Adding Host '{host.strip()}'.")
            htags_inp = [x.strip() for x in input(f"List of tags (optional, comma-separated): ").split(",")]
            hid = max(HOSTS['ID'].values) + 1 if not HOSTS.empty else 0
            new_host = {
                'ID': hid,
                'Name': host.strip(),
                'Bio': '',
                'Tags': htags_inp,
                'ExternalLinks': '',
                'PhotoURLs': ''
            }
            HOSTS = pd.concat([HOSTS, pd.DataFrame([new_host])], ignore_index=True)
            HOSTS.to_csv(hfilepath, index=False)
            print(f"Added new host: {host.strip()} with ID {hid}")
            host_ids.append(hid)
    return host_ids

def get_max_date_for_events():
    global EVENTS
    if EVENTS.empty:
        return None
    max_date = EVENTS['StartDate'].max()
    dt = parser.parse(max_date)
    dt = dt.replace(tzinfo=ZoneInfo("America/New_York"))
    return dt.isoformat()
    # return datetime.datetime.strptime(max_date, "%Y-%m-%d").isoformat() + "T00:00:00Z"