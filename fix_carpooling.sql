-- Create tables if they don't exist (matching EventCarpooling.jsx)
CREATE TABLE IF NOT EXISTS rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    seats_available INTEGER DEFAULT 4,
    departure_location TEXT,
    departure_time TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ride_passengers (
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
    passenger_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (ride_id, passenger_id)
);

-- Enable RLS
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_passengers ENABLE ROW LEVEL SECURITY;

-- Policies for RIDES
DROP POLICY IF EXISTS "Enable read access for all users" ON rides;
CREATE POLICY "Enable read access for all users" ON rides FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON rides;
CREATE POLICY "Enable insert for authenticated users" ON rides FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable delete for driver" ON rides;
CREATE POLICY "Enable delete for driver" ON rides FOR DELETE USING (auth.uid() = driver_id);

-- Policies for PASSENGERS
DROP POLICY IF EXISTS "Enable read access for all users" ON ride_passengers;
CREATE POLICY "Enable read access for all users" ON ride_passengers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON ride_passengers;
CREATE POLICY "Enable insert for authenticated users" ON ride_passengers FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable delete for passenger" ON ride_passengers;
CREATE POLICY "Enable delete for passenger" ON ride_passengers FOR DELETE USING (auth.uid() = passenger_id);
