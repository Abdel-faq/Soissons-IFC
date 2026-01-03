
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Car, UserPlus, Users, XCircle, Trash2 } from 'lucide-react';

export default function EventCarpooling({ eventId, currentUser }) {
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // New Ride Form
    const [seats, setSeats] = useState(3);
    const [location, setLocation] = useState('');
    const [depTime, setDepTime] = useState('');

    useEffect(() => {
        fetchRides();
    }, [eventId]);

    const fetchRides = async () => {
        try {
            // Fetch rides with driver info
            // Retry fetching with relationships now that we know data exists.
            const { data: ridesData, error } = await supabase
                .from('rides')
                .select(`
                    *,
                    driver:profiles!rides_driver_id_fkey ( id, email, full_name, role ),
                    passengers:ride_passengers (
                        passenger:profiles!ride_passengers_passenger_id_fkey ( id, email, full_name, role )
                    )
                `)
                .eq('event_id', eventId);


            if (error) {
                console.error("Error query rides:", error);
                alert("Erreur chargement covoiturage: " + error.message); // Added alert
                throw error;
            }

            console.log("Rides fetched for event", eventId, ridesData); // Added log
            setRides(ridesData || []);
        } catch (err) {
            console.error("Error fetching rides:", err);
            // alert("Erreur fetch: " + err.message); // Optional
        } finally {
            setLoading(false);
        }
    };

    const ensureProfileExists = async () => {
        // Check if profile exists
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', currentUser.id).maybeSingle();
        if (!profile) {
            console.log("Creating missing profile for", currentUser.email);
            const { error: createProfileError } = await supabase.from('profiles').insert([
                {
                    id: currentUser.id,
                    email: currentUser.email,
                    full_name: currentUser.email?.split('@')[0] || 'User',
                    role: 'PLAYER' // Default
                }
            ]);
            if (createProfileError) {
                console.error("Profile creation failed", createProfileError);
                throw new Error("Impossible de créer le profil utilisateur : " + createProfileError.message);
            }
        }
    };

    const createRide = async (e) => {
        e.preventDefault();
        try {
            await ensureProfileExists();

            const { error } = await supabase.from('rides').insert({
                event_id: eventId,
                driver_id: currentUser.id,
                seats_available: seats,
                departure_location: location,
                departure_time: depTime
            });

            if (error) throw error;

            setShowForm(false);
            setLocation('');
            setDepTime('');
            fetchRides();
        } catch (err) {
            alert("Erreur création voiture: " + err.message);
        }
    };

    const joinRide = async (rideId) => {
        try {
            await ensureProfileExists();

            const { error } = await supabase.from('ride_passengers').insert({
                ride_id: rideId,
                passenger_id: currentUser.id
            });
            if (error) throw error;
            fetchRides();
        } catch (err) {
            alert("Impossible de rejoindre : " + err.message);
        }
    };

    const leaveRide = async (rideId) => {
        const { error } = await supabase.from('ride_passengers')
            .delete()
            .eq('ride_id', rideId)
            .eq('passenger_id', currentUser.id);
        if (error) alert("Erreur : " + error.message);
        else fetchRides();
    };

    const deleteRide = async (rideId) => {
        if (!confirm("Supprimer votre voiture ?")) return;
        const { error } = await supabase.from('rides').delete().eq('id', rideId);
        if (error) alert(error.message);
        else fetchRides();
    };

    if (loading) return <div className="text-sm text-gray-400">Chargement covoiturage...</div>;

    return (
        <div className="mt-2">
            <div className="flex justify-between items-center mb-2 px-1">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Car size={12} /> Covoiturage
                </h3>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className={`text-[11px] font-bold px-2 py-0.5 rounded transition-colors ${showForm ? 'bg-gray-200 text-gray-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                        }`}
                >
                    {showForm ? 'Annuler' : '+ Proposer une place'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={createRide} className="bg-indigo-50 p-3 rounded mb-3 text-sm">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                            placeholder="Lieu départ"
                            className="border p-1 rounded"
                            value={location} onChange={e => setLocation(e.target.value)}
                            required
                        />
                        <input
                            type="time"
                            className="border p-1 rounded"
                            value={depTime} onChange={e => setDepTime(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex justify-between items-center">
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                            Places:
                            <input
                                type="number" min="1" max="9"
                                className="w-10 border rounded p-1"
                                value={seats} onChange={e => setSeats(e.target.value)}
                            />
                        </label>
                        <button className="bg-indigo-600 text-white px-3 py-1 rounded text-xs">Publier</button>
                    </div>
                </form>
            )}

            <div className="space-y-2">
                {rides.length === 0 && !showForm && (
                    <p className="text-xs text-gray-400 italic">Aucune voiture proposée pour le moment.</p>
                )}

                {rides.map(ride => {
                    // Check if current user is passenger
                    const passengers = ride.passengers || [];
                    const isPassenger = passengers.some(p => p.passenger.id === currentUser.id);
                    const isDriver = ride.driver_id === currentUser.id;
                    const seatsLeft = ride.seats_available - passengers.length;

                    // Safe access to driver info
                    const driverName = ride.driver?.full_name || ride.driver?.email?.split('@')[0] || 'Chauffeur Inconnu';

                    return (
                        <div key={ride.id} className="bg-gray-50 border border-gray-200 rounded p-3 text-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-medium text-gray-900 flex items-center gap-1">
                                        <Car size={14} className="text-red-600" />
                                        {driverName}
                                        <span className="text-gray-400 text-xs font-normal ml-1">
                                            ({ride.departure_location || '?'} à {ride.departure_time?.slice(0, 5)})
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                        <Users size={12} />
                                        Places: {passengers.length} / {ride.seats_available}
                                    </div>
                                </div>

                                {isDriver ? (
                                    <button onClick={() => deleteRide(ride.id)} className="text-red-500 hover:text-red-700">
                                        <Trash2 size={16} />
                                    </button>
                                ) : (
                                    isPassenger ? (
                                        <button onClick={() => leaveRide(ride.id)} className="text-red-500 border border-red-200 bg-white px-2 py-1 rounded text-xs hover:bg-red-50">
                                            Quitter
                                        </button>
                                    ) : (
                                        seatsLeft > 0 && (
                                            <button onClick={() => joinRide(ride.id)} className="text-green-600 border border-green-200 bg-white px-2 py-1 rounded text-xs hover:bg-green-50">
                                                Rejoindre
                                            </button>
                                        )
                                    )
                                )}
                            </div>

                            {/* Passenger List */}
                            {passengers.length > 0 && (
                                <div className="mt-2 pl-2 border-l-2 border-indigo-100">
                                    {passengers.map(p => {
                                        const pName = p.passenger?.full_name || p.passenger?.email?.split('@')[0] || 'Passager';
                                        return (
                                            <div key={p.passenger.id} className="text-xs text-gray-600">
                                                - {pName}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
