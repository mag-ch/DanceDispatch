import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import src.data_pipeline
from src.data_pipeline import handle_event_entry, get_venue_id, get_host_id

@pytest.fixture
def sample_venues_df():
    """Fixture with sample venues dataframe."""
    return pd.DataFrame({
        'Name': ['Venue A', 'Venue B', 'Venue C'],
        'Address': ['123 Main St', '456 Oak Ave', '789 Pine Rd'],
        'Bio': ['', '', ''],
        'Tags': ['', '', ''],
        'Residents': ['', '', ''],
        'NearestStation': ['', '', ''],
        'DistanceFromStation': ['', '', ''],
        'NumberOfZones': ['', '', ''],
        'TotalArea': ['', '', ''],
        'ExternalLinks': ['', '', ''],
        'PhotoURLs': ['', '', '']
    })


@pytest.fixture
def sample_hosts_df():
    """Fixture with sample hosts dataframe."""
    return pd.DataFrame({
        'Name': ['Host A', 'Host B', 'Host C'],
        'Bio': ['', '', ''],
        'Tags': ['tag1', 'tag2', 'tag3'],
        'ExternalLinks': ['', '', ''],
        'PhotoURLs': ['', '', '']
    })


@pytest.fixture
def sample_event():
    """Fixture with sample event data."""
    return {
        'id': None,
        'title': 'Test Event',
        'start_date': '2024-01-01',
        'start_time': '18:00',
        'end_date': '2024-01-01',
        'end_time': '22:00',
        'Location': 'Venue A',
        'Address': '123 Main St',
        'description': 'Test description',
        'Hosts': 'Host A,Host B',
        'photo_url': 'http://example.com/photo.jpg',
        'tags': 'music,art',
        'price': '10',
        'external_links': 'http://example.com'
    }


def test_get_venue_id_exact_name_match(sample_venues_df):
    """Test finding venue by exact name match."""
    venue_id = get_venue_id(sample_venues_df, 'Venue A', '999 Unknown St')
    assert venue_id == 0


def test_get_venue_id_address_match(sample_venues_df):
    """Test finding venue by address match."""
    venue_id = get_venue_id(sample_venues_df, 'Unknown Venue', '456 Oak Ave')
    assert venue_id == 1


def test_get_venue_id_both_match(sample_venues_df):
    """Test finding venue when both name and address match."""
    venue_id = get_venue_id(sample_venues_df, 'Venue B', '456 Oak Ave')
    assert venue_id == 1


@patch('builtins.input', side_effect=[''])
def test_get_venue_id_not_found_skip(mock_input, sample_venues_df, capsys):
    """Test skipping venue addition when not found."""
    venue_id = get_venue_id(sample_venues_df, 'New Venue', 'New Address')
    assert venue_id is None
    captured = capsys.readouterr()
    assert "Skipping adding venue" in captured.out


@patch('builtins.input', side_effect=['New Venue Name', ''])
@patch('data_pipeline.VENUES')
def test_get_venue_id_add_new_venue_default_address(mock_venues, mock_input, sample_venues_df, capsys):
    """Test adding new venue with default address."""
    with patch('pandas.DataFrame.to_csv'):
        venue_id = get_venue_id(sample_venues_df, 'Nonexistent', 'Default Address')
        assert venue_id == 3
        captured = capsys.readouterr()
        assert "Added new venue" in captured.out


@patch('builtins.input', side_effect=['New Venue', 'Custom Address'])
@patch('data_pipeline.VENUES')
def test_get_venue_id_add_new_venue_custom_address(mock_venues, mock_input, sample_venues_df, capsys):
    """Test adding new venue with custom address."""
    with patch('pandas.DataFrame.to_csv'):
        venue_id = get_venue_id(sample_venues_df, 'Unknown', 'Old Address')
        assert venue_id == 3
        captured = capsys.readouterr()
        assert "Added new venue" in captured.out


def test_get_host_id_all_existing(sample_hosts_df):
    """Test getting IDs for all existing hosts."""
    host_ids = get_host_id(sample_hosts_df, "Host A,Host B")
    assert host_ids == [0, 1]


def test_get_host_id_empty_string(sample_hosts_df):
    """Test handling empty host string."""
    host_ids = get_host_id(sample_hosts_df, "")
    assert host_ids == []


def test_get_host_id_with_spaces(sample_hosts_df):
    """Test handling host names with extra spaces."""
    host_ids = get_host_id(sample_hosts_df, " Host A , Host C ")
    assert host_ids == [0, 2]


@patch('builtins.input', return_value='tag1,tag2')
@patch('data_pipeline.HOSTS')
def test_get_host_id_add_new_host(mock_hosts, mock_input, sample_hosts_df, capsys):
    """Test adding a new host."""
    with patch('pandas.DataFrame.to_csv'):
        host_ids = get_host_id(sample_hosts_df, "Host A,New Host")
        assert len(host_ids) == 2
        assert host_ids[0] == 0
        assert host_ids[1] == 3
        captured = capsys.readouterr()
        assert "Added new host" in captured.out


def test_get_host_id_mixed_empty_entries(sample_hosts_df):
    """Test handling comma-separated list with empty entries."""
    host_ids = get_host_id(sample_hosts_df, "Host A,,Host B,")
    assert host_ids == [0, 1]


@patch('data_pipeline.VENUES')
@patch('data_pipeline.HOSTS')
@patch('data_pipeline.EVENTS')
@patch('data_pipeline.get_venue_id', return_value=0)
@patch('data_pipeline.get_host_id', return_value=[0, 1])
def test_handle_event_entry_new_event(mock_get_host, mock_get_venue, mock_events, mock_hosts, mock_venues, sample_event, capsys):
    """Test adding a new event."""
    mock_events_df = pd.DataFrame(columns=['id', 'Title'])
    mock_events.return_value = mock_events_df
    
    with patch('pandas.DataFrame.to_csv'):
        result = handle_event_entry(mock_events_df, sample_event)
        assert result == 0
        captured = capsys.readouterr()
        assert "Added new event" in captured.out