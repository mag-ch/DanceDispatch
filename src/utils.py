import csv
import os
from io import StringIO 


CSV_PATH = 'dance_dispatch/data/csv_files/'

# Function to create (write) to a CSV file
def write_csv(filename, data):
    with open(filename, mode='w', newline='') as file:
        writer = csv.writer(file)
        writer.writerows(data)
    print(f"Data written to {filename}")

# Function to read (view) a CSV file
def read_csv(filename):
    if not os.path.exists(filename):
        print(f"{filename} does not exist.")
        raise FileNotFoundError(f"{filename} does not exist.")

    with open(filename, mode='r', newline='') as file:
        reader = csv.reader(file)
        rows = list(reader)
        for row in rows:
            print(row)
        return rows

# Function to update a specific row in the CSV file
def update_csv(filename, new_data, row_index = -1):
    if not os.path.exists(filename):
        print(f"{filename} does not exist.")
        return

    rows = []
    with open(filename, mode='r', newline='') as file:
        reader = csv.reader(file)
        rows = list(reader)

    if row_index >= 0 and row_index < len(rows):
        # Update specific row with first row from new_data
        if new_data:
            if not isinstance(new_data[0], list):
                new_data = [new_data]
            rows[row_index] = new_data[0]
        with open(filename, mode='w', newline='') as file:
            writer = csv.writer(file)
            writer.writerows(rows)
        print(f"Row {row_index} updated.")
    elif row_index == -1:
        # Append all rows from new_data to the end
        # Check if new_data is a list of lists or just a list
        if new_data and not isinstance(new_data[0], list):
            new_data = [new_data]
        with open(filename, mode='a', newline='') as file:
            writer = csv.writer(file)
            writer.writerows(new_data)
        print(f"{len(new_data)} row(s) appended.")
    else:
        raise IndexError(f"Row {row_index} not found.")
        
        

# Function to delete a specific row from the CSV file
def delete_csv_row(filename, row_index):
    if not os.path.exists(filename):
        print(f"{filename} does not exist.")
        raise FileNotFoundError(f"{filename} does not exist.")

    rows = []
    with open(filename, mode='r', newline='') as file:
        reader = csv.reader(file)
        rows = list(reader)

    if row_index < len(rows):
        del rows[row_index]
        with open(filename, mode='w', newline='') as file:
            writer = csv.writer(file)
            writer.writerows(rows)
        print(f"Row {row_index} deleted.")
    else:
        print(f"Row {row_index} not found.")
        raise IndexError(f"Row {row_index} does not exist.")



# Function to add a column to the CSV file
def add_column_csv(filename, new_column_name, position=None):
    if not os.path.exists(filename):
        print(f"{filename} does not exist.")
        return

    rows = []
    with open(filename, mode='r', newline='') as file:
        reader = csv.reader(file)
        rows = list(reader)

    # Insert the column header at the specified position
    if position is None:
        rows[0].append(new_column_name)  # Add to the end
    else:
        rows[0].insert(position, new_column_name)  # Insert at specific position

    # Add empty values for all data rows
    for row in rows[1:]:
        if position is None:
            row.append('')  # Add empty value to the end
        else:
            row.insert(position, '')  # Insert empty value at specific position

    with open(filename, mode='w', newline='') as file:
        writer = csv.writer(file)
        writer.writerows(rows)
    print(f"Column '{new_column_name}' added.")

# Function to delete a column from the CSV file
def delete_column_csv(filename, column_index):
    if not os.path.exists(filename):
        print(f"{filename} does not exist.")
        return

    rows = []
    with open(filename, mode='r', newline='') as file:
        reader = csv.reader(file)
        rows = list(reader)

    if column_index < len(rows[0]):
        # Remove the column from the header
        del rows[0][column_index]
        
        # Remove the corresponding column from each data row
        for row in rows[1:]:
            del row[column_index]

        with open(filename, mode='w', newline='') as file:
            writer = csv.writer(file)
            writer.writerows(rows)
        print(f"Column at index {column_index} deleted.")
    else:
        print(f"Column index {column_index} not found.")


def format_user_input(input_string, num_columns):
    # split an input string into a list of lists for CSV writing, ignore commas inside quotes
    f = StringIO(input_string)
    reader = csv.reader(f, skipinitialspace=True)
    data = []
    # if row has more columns than expected, append extra data into a new row
    for row in reader:
        row = [value.strip() for value in row]
        if len(row) > num_columns:
            data.append(row[:num_columns])
            extra = row[num_columns:]
            while extra:
                data.append(extra[:num_columns])
                extra = extra[num_columns:]
        else:
            data.append(row)
    return data

# Function to prompt for and execute user commands
def execute_command():
    while True:
        print("\n--- CSV Operations ---")
        print("Choose an operation:")
        print("1. Create (Write) CSV file")
        print("2. Read CSV file")
        print("3. Update CSV file")
        print("4. Delete CSV row")
        print("5. Add a Column to CSV")
        print("6. Delete a Column from CSV")
        print("7. Exit")

        filename = CSV_PATH + input("Enter the CSV filename: ").strip()+".csv"
        # print the number of columns in the csv file named if it exists
        if os.path.exists(filename):
            with open(filename, mode='r', newline='') as file:
                reader = csv.reader(file)
                rows = list(reader)
                if rows:
                    num_columns = len(rows[0])
                    print(f"{filename} has {num_columns} columns.")
                else:
                    num_columns = 0
                    print(f"{filename} is empty.")
        else:
            num_columns = 0
            print(f"{filename} does not exist yet.")
        choice = input("Enter your choice (1-7): ").strip()

        if choice == '1':
            data = input("Enter data to write (comma separated values): ").strip().split(',')
            write_csv(filename, [data])
        
        elif choice == '2':
            read_csv(filename)
        
        elif choice == '3':
            row_index = input("Enter row index to update: ").strip()
            try: 
                row_index = int(row_index)
            except:
                row_index = -1
            new_data = input("Enter new data (comma separated values): ").strip()
            new_data = format_user_input(new_data, num_columns)
            update_csv(filename, new_data, row_index)
        
        elif choice == '4':
            row_index = int(input("Enter row index to delete: ").strip())
            delete_csv_row(filename, row_index)
        
        elif choice == '5':
            new_column = input("Enter the new column name: ").strip()
            position = input("Enter position to add the column (default is last): ").strip()
            position = int(position) if position else None
            add_column_csv(filename, new_column, position)
        
        elif choice == '6':
            column_index = int(input("Enter column index to delete: ").strip())
            delete_column_csv(filename, column_index)
        
        elif choice == '7':
            print("Exiting the program.")
            break
        
        else:
            print("Invalid choice. Please enter a number between 1 and 7.")

# Main entry point
if __name__ == "__main__":
    execute_command()