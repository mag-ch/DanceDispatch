import datetime
import os.path
import hashlib
import signal
import sys
from flask import Flask, request, jsonify
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from data_objects import Event
from data_pipeline import get_max_date_for_events, handle_event_entry, check_if_event_exists


# app = Flask(__name__)
# If modifying these scopes, delete the file token.json.
SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
TOKEN_PATH = os.path.join(os.path.dirname(__file__), "json", "token.json")
CRED_PATH = os.path.join(os.path.dirname(__file__), "json", "credentials.json")
# read blacklisted events from blacklistedevents.txt
with open(os.path.join(os.path.dirname(__file__), "..", "dance_dispatch", "data", "csv_files", "blacklisted_events.txt"), "r") as f:
    BLACKLISTED_EVENTS = f.read().splitlines()
CALENDAR_ID = '0613c0971c5fa6576dbd6087615eb0ee1cd875e1c0e427a6f36f4ef1d6bc2a37@group.calendar.google.com'


def load_credentials():
    creds = None
    # The file token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception as e:
                print(f"Token refresh failed: {e}")
                # Delete the invalid token and re-authenticate
                if os.path.exists(TOKEN_PATH):
                    os.remove(TOKEN_PATH)
                flow = InstalledAppFlow.from_client_secrets_file(
                    CRED_PATH, SCOPES
                )
                creds = flow.run_local_server(port=0)
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                CRED_PATH, SCOPES
            )
            creds = flow.run_local_server(port=0)
        # Save the credentials for the next run
        with open(TOKEN_PATH, "w") as token:
            token.write(creds.to_json())
    return creds

def get_calendar_service():
    creds = load_credentials()
    service = build('calendar', 'v3', credentials=creds)
    return service


def get_synced_events(synctoken = None):
    global CALENDAR_ID
    try:
        service = get_calendar_service()
        page_token = None
        while True:
            if synctoken is None or synctoken == "":
                # now = get_max_date_for_events()
                # print("No sync token found, fetching all events.")
                synctoken = None
                events_result = service.events().list(
                    calendarId=CALENDAR_ID,
                    pageToken=page_token,
                ).execute()
            else:
                # now = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()
                # end = (datetime.datetime.now(tz=datetime.timezone.utc) + datetime.timedelta(days=90)).isoformat()
                events_result = service.events().list(
                    calendarId=CALENDAR_ID,
                    pageToken=page_token,
                    # timeMin=now,   
                    # timeMax=end,
                    # singleEvents=True,
                    syncToken=synctoken
                ).execute()
            if 'nextSyncToken' in events_result:
                with open('nextSyncToken', 'w') as file:
                    file.write(events_result['nextSyncToken'])
            events = events_result.get('items', [])
            page_token = events_result.get('nextPageToken')
            if not page_token:
                break
        return events
    except HttpError as error:
        print(f"An error occurred: {error}")    

def process_event(event):
    try:
        venue_name, venue_address = event['location'].split(", ", 1)
    except ValueError:
        venue_name, venue_address = None, event.get('location', None)
    except KeyError:
        venue_name, venue_address = None, None
    start = datetime.datetime.fromisoformat(event["start"].get("dateTime", event["start"].get("date")))
    end = datetime.datetime.fromisoformat(event["end"].get("dateTime", event["end"].get("date")))
    e = Event(
        id = event["id"],
        title=event["summary"],
        start_date = start.date(),
        start_time = start.time(),
        end_date= end.date(),
        end_time= end.time(),
        description=event.get("description", ""),
        location= venue_name,
        address= venue_address,
        hosts=None,
        photo_url=None,
        price=None,
        external_links=None,
        tags=None
    )
    editing = True
    while editing:
        print(f"Current event data:\n{e}")
        edit_field = input("Enter field to edit (or 'done' to finish): ").strip().lower()
        if edit_field == "done":
            editing = False
            # double checks that the venue and hosts are valid, then adds to CSV
            handle_event_entry(e)
        elif edit_field == "cancel":
            print("Event entry cancelled.")
            return
        elif edit_field == "skip":
            print("Event entry skipped.")
            editing = False
            continue
        elif hasattr(e, edit_field):
            new_value = input(f"Enter new value for {edit_field}: ").strip()
            setattr(e, edit_field, new_value)
        else:
            print(f"Field '{edit_field}' not found in Event.")


def main():
    sync_token = None
    with open('src/nextSyncToken', 'r') as file:
        sync_token = file.read().strip()
    events = get_synced_events(sync_token)
    print(f"Found {len(events)} events from sync.")
    # Prints the start and name of the next 10 events
    for event in events:
        if (check_if_event_exists(Event(id=event["id"]))):
            continue
        if (any(blacklisted_word in event['summary'].lower() for blacklisted_word in BLACKLISTED_EVENTS)):
            continue
        process_event(event)

if __name__ == "__main__":
    global CHANNEL_ID
    # CHANNEL_ID = set_watch()
    main()
    # app.run(debug=True, host='127.0.0.1', port=5001)