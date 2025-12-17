from dataclasses import dataclass
from datetime import datetime
from typing import Optional, List

@dataclass
class Venue:
    #Name, Address, Bio, Tags, Residents, NearestStation, DistanceFromStation, NumberOfZones, TotalArea, ExternalLinks,PhotoURLs

    """Represents a dance venue"""
    id: Optional[int] = None
    name: str = ""
    address: str = ""
    tags: List[str] = None
    residents: List[str] = None
    nearest_station: str = ""
    distance_from_station: Optional[float] = None
    number_of_zones: Optional[int] = None
    total_area: Optional[float] = None
    external_links: List[str] = None
    photo_urls: List[str] = None
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = []
        if self.residents is None:
            self.residents = []
        if self.external_links is None:
            self.external_links = []
        if self.photo_urls is None:
            self.photo_urls = []

@dataclass
class Host:
    #Name, Bio, ExternalLinks, PhotoURLs

    """Represents an event host/organizer"""
    id: Optional[int] = None
    name: str = ""
    bio: Optional[str] = None
    external_links: List[str] = None
    photo_urls: List[str] = None

    def __post_init__(self):
        if self.external_links is None:
            self.external_links = []
        if self.photo_urls is None:
            self.photo_urls = []

@dataclass
class Event:
    #Title, StartDate, StartTime, EndDate,EndTime, Location, Description, Hosts, PhotoURL, Tags, Price, ExternalURLs
    """Represents a dance event"""
    id: Optional[int] = None
    title: str = ""
    description: str = ""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location: Optional[str] = None
    address: Optional[str] = None
    hosts: Optional[str] = None
    photo_url: Optional[str] = None
    price: Optional[float] = None
    external_links: List[str] = None
    tags: List[str] = None
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = []
        if self.external_links is None:
            self.external_links = []