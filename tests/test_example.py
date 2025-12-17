import pytest
import os
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.utils import (
    write_csv,
    read_csv,
    update_csv,
    delete_csv_row,
    format_user_input,
)


@pytest.fixture
def temp_csv_file(tmp_path):
    """Fixture to create a temporary CSV file path."""
    return tmp_path / "test_data.csv"


@pytest.fixture
def sample_data():
    """Fixture with sample CSV data."""
    return [
        ["Name", "Age", "City"],
        ["Alice", "30", "New York"],
        ["Bob", "25", "Los Angeles"],
        ["Charlie", "35", "Chicago"]
    ]

def test_format_user_input():
    """Test formatting of user input for CSV operations."""
    input_data = "  Alice , 30 , New York, Bob,25,Los Angeles,  Charlie , 35 , Chicago"
    
    expected_output = [
        ["Alice", "30", "New York"],
        ["Bob", "25", "Los Angeles"],
        ["Charlie", "35", "Chicago"]
    ]
    
    formatted_data = format_user_input(input_data, 3)

    assert formatted_data == expected_output

def test_write_csv(temp_csv_file, sample_data):
    """Test creating a new CSV file."""
    write_csv(temp_csv_file, sample_data)
    assert os.path.exists(temp_csv_file)
    with open(temp_csv_file, 'r') as f:
        reader = csv.reader(f)
        data = list(reader)
        assert data == sample_data


def test_read_csv(temp_csv_file, sample_data):
    """Test reading data from CSV file."""
    write_csv(temp_csv_file, sample_data)
    data = read_csv(temp_csv_file)
    assert data == sample_data


def test_read_csv_nonexistent_file():
    """Test reading from a non-existent CSV file."""
    with pytest.raises(FileNotFoundError):
        read_csv("nonexistent_file.csv")


def test_append_to_csv(temp_csv_file, sample_data):
    """Test appending a row to existing CSV."""
    write_csv(temp_csv_file, sample_data)
    new_row = ["David", "40", "Boston"]
    update_csv(temp_csv_file, new_row)
    
    data = read_csv(temp_csv_file)
    assert len(data) == len(sample_data) + 1
    assert data[-1] == new_row


def test_update_csv(temp_csv_file, sample_data):
    """Test updating a specific row in CSV."""
    write_csv(temp_csv_file, sample_data)
    updated_row = ["Bob", "26", "San Francisco"]
    update_csv(temp_csv_file, row_index=2, new_data=updated_row)
    
    data = read_csv(temp_csv_file)
    assert data[2] == updated_row


def test_update_csv_invalid_index(temp_csv_file, sample_data):
    """Test updating with invalid row index."""
    write_csv(temp_csv_file, sample_data)
    with pytest.raises(IndexError):
        update_csv(temp_csv_file, row_index=10, new_data=["Test", "0", "Test"])


def test_delete_csv_row(temp_csv_file, sample_data):
    """Test deleting a row from CSV."""
    write_csv(temp_csv_file, sample_data)
    delete_csv_row(temp_csv_file, row_index=2)
    
    data = read_csv(temp_csv_file)
    assert len(data) == len(sample_data) - 1
    assert ["Bob", "25", "Los Angeles"] not in data


def test_delete_csv_row_invalid_index(temp_csv_file, sample_data):
    """Test deleting with invalid row index."""
    write_csv(temp_csv_file, sample_data)
    with pytest.raises(IndexError):
        delete_csv_row(temp_csv_file, row_index=10)


def test_write_csv_empty_data(temp_csv_file):
    """Test creating CSV with empty data."""
    write_csv(temp_csv_file, [])
    assert os.path.exists(temp_csv_file)
    data = read_csv(temp_csv_file)
    assert data == []


def test_append_multiple_rows(temp_csv_file, sample_data):
    """Test appending multiple rows sequentially."""
    write_csv(temp_csv_file, sample_data)
    new_rows = [
        ["Eve", "28", "Seattle"],
        ["Frank", "32", "Austin"]
    ]
    update_csv(temp_csv_file, new_rows)
    
    data = read_csv(temp_csv_file)
    assert len(data) == len(sample_data) + len(new_rows)
    assert data[-2:] == new_rows