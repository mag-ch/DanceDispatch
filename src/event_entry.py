# Generates the schema for the DB
# writes specific queries (by id, by location, date, etc.)
# also schema for location
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_marshmallow import Marshmallow
import datetime

from marshmallow_sqlalchemy import SQLAlchemySchema

# Initialize Flask app, database, and marshmallow
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///events.db'  # Use SQLite for now
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
ma = Marshmallow(app)

# Model for locations (aka Venues)
class Location(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(100), nullable=False)
    bio = db.Column(db.String(250), nullable=False)

# Marshmallow schema for locations
class LocationSchema(SQLAlchemySchema):
    class Meta:
        model = Location

# Model for Dance Event
class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    start_date = db.Column(db.String(50), nullable=False)
    start_time = db.Column(db.String(50), nullable=False)
    end_date = db.Column(db.String(50), nullable=False)
    end_time = db.Column(db.String(50), nullable=False)
    location_id = db.Column(db.Integer, db.ForeignKey('location.id'), nullable=False)
    location = db.relationship('Location', backref='events')  # Relationship to Location table
    image_url = db.Column(db.String(100), nullable = True)  # Relationship to Location table
    entry_fee = db.Column(db.Float, nullable=True)
    organizer_id = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.now)

    def __init__(self, title, start_date, start_time, end_date, end_time, location_id,image_url, entry_fee, organizer_id):
        self.title = title
        self.start_date = start_date
        self.start_time = start_time
        self.end_date = end_date
        self.end_time = end_time
        self.location_id = location_id
        self.image_url = image_url
        self.entry_fee = entry_fee
        self.organizer_id = organizer_id
        
# Marshmallow schema for Event
class EventSchema(SQLAlchemySchema):
    location = ma.Nested('LocationSchema', only=['title', 'address'])  # Embed location details
    
    class Meta:
        model = Event

# Create DB tables (run this once in the shell or app startup)
with app.app_context():
    db.create_all()
    
# Route to manually add a new event
@app.route('/events', methods=['POST'])
def add_event():
    title = request.json['title']
    start_date = request.json['start_date']
    start_time = request.json['start_time']
    end_date = request.json['end_date']
    end_time = request.json['end_time']
    location_id = request.json['location_id']
    image_url = request.json['image_url']
    entry_fee = request.json['entry_fee']
    organizer_id = request.json['organizer_id']
    
    # Create new event object
    new_event = Event(title, start_date, start_time, end_date, end_time, location_id, image_url, entry_fee, organizer_id)
    
    try:
        db.session.add(new_event)
        db.session.commit()
        return jsonify({"message": "Event added successfully!"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# Route to get all events
@app.route('/events', methods=['GET'])
def get_events():
    events = Event.query.all()
    event_schema = EventSchema(many=True)
    return jsonify(event_schema.dump(events))

# Route to get events by date or location filter (e.g. future feature: automated filters)
@app.route('/events/filter', methods=['GET'])
def get_filtered_events():
    date = request.args.get('date')  # Example: '2025-11-05'
    location = request.args.get('location')  # Example: 'Manhattan'
    
    query = Event.query
    if date:
        query = query.filter(Event.date == date)
    if location:
        query = query.filter(Event.location == location)
        # query = query.filter(Event.location.ilike(f'%{location}%'))
    
    events = query.all()
    event_schema = EventSchema(many=True)
    return jsonify(event_schema.dump(events))

# Route to get a specific event by ID
@app.route('/events/<int:id>', methods=['GET'])
def get_event_by_id(id):
    event = Event.query.get_or_404(id)
    event_schema = EventSchema()
    return jsonify(event_schema.dump(event))

# Route for updating an event (could be part of future admin tools)
@app.route('/events/<int:id>', methods=['PUT'])
def update_event(id):
    event = Event.query.get_or_404(id)
    title = request.json.get('title', event.title)
    start_date = request.json.get('start_date', event.start_date)
    start_time = request.json.get('start_time', event.start_time)
    end_date = request.json.get('end_date', event.end_date)
    end_time = request.json.get('end_time', event.end_time)
    image_url = request.json.get('image_url', event.image_url)
    location = request.json.get('location', event.location)
    entry_fee = request.json.get('entry_fee', event.entry_fee)
    organizer_id = request.json.get('organizer_id', event.organizer_id)

    event.title = title
    event.start_date = start_date
    event.start_time = start_time
    event.end_date = end_date
    event.end_time = end_time
    event.location = location
    event.image_url = image_url
    event.entry_fee = entry_fee
    event.organizer_id = organizer_id
    
    try:
        db.session.commit()
        return jsonify({"message": "Event updated successfully!"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# Route to delete an event
@app.route('/events/<int:id>', methods=['DELETE'])
def delete_event(id):
    event = Event.query.get_or_404(id)
    try:
        db.session.delete(event)
        db.session.commit()
        return jsonify({"message": "Event deleted successfully!"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# Run the Flask app
if __name__ == '__main__':
    app.run(debug=True)


""" $headers = @{
    "Content-Type" = "application/json"
}

$body = '{
    "title": "Dance Party",
    "start_date": "2025-11-10",
    "start_time": "18:00",
    "end_date": "2025-11-10",
    "end_time": "23:00",
    "location_id": 1,
    "entry_fee": 15.50,
    "organizer_id": 2
}'

Invoke-WebRequest -Uri "http://localhost:5000/events" -Method POST -Headers $headers -Body $body
"""