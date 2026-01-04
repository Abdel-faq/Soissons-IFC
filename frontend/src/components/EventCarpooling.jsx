
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Car, UserPlus, Users, XCircle, Trash2 } from 'lucide-react';

export default function EventCarpooling({ eventId, currentUser }) {
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    const [children, setChildren] = useState([]);

    // New Ride Form
    const [seats, setSeats] = useState(3);
    const [location, setLocation] = useState('');
    const [depTime, setDepTime] = useState('');
    const [relation, setRelation] = useState('PAPA');
    const [restriction, setRestriction] = useState('NONE');

    useEffect(() => {
        fetchRides();
        fetchChildren();
    }, [eventId]);

    const fetchChildren = async () => {
        const { data } = await supabase.from('players').select('*').eq('parent_id', currentUser.id);
        setChildren(data || []);
    };

    const fetchRides = async () => {
        try {
            setLoading(true);
            const { data: ridesData, error: ridesError } = await supabase
                .from('rides')
                .select('*, driver:profiles(full_name, email)')
                .eq('event_id', eventId);

            if (ridesError) throw ridesError;

            const rideIds = ridesData.map(r => r.id);
            const { data: passengersData } = await supabase
                .from('ride_passengers')
                .select('*, player:players(full_name)')
                .in('ride_id', rideIds);

            const ridesWithData = ridesData.map(ride => ({
                ...ride,
                passengers: passengersData?.filter(p => p.ride_id === ride.id) || []
            }));

            setRides(ridesWithData);
        } catch (err) {
            console.error("Error fetching rides:", err);
        } finally {
            setLoading(false);
        }
    };

    const createRide = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('rides').insert({
                event_id: eventId,
                driver_id: currentUser.id,
                seats_available: seats,
                departure_location: location,
                departure_time: depTime,
                driver_relation: relation,
                restrictions: restriction
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
        if (children.length === 0) {
            alert("Veuillez d'abord ajouter un enfant à votre profil.");
            return;
        }

        let selectedChildId = children[0].id;
        if (children.length > 1) {
            const names = children.map((c, i) => `${i + 1}. ${c.full_name}`).join('\n');
            const choice = prompt(`Pour quel enfant ?\n${names}\n(Entrez le numéro)`);
            const index = parseInt(choice) - 1;
            if (children[index]) selectedChildId = children[index].id;
            else return;
        }

        const seatChoice = prompt("Combien de places ?\n1. Enfant seul\n2. Enfant + Parent");
        const seatCount = seatChoice === '2' ? 2 : 1;

        try {
            const { error } = await supabase.from('ride_passengers').insert({
                ride_id: rideId,
                player_id: selectedChildId,
                seat_count: seatCount
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
                <form onSubmit={createRide} className="bg-indigo-50 p-3 rounded-xl mb-3 text-sm shadow-sm border border-indigo-100">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <select
                            className="border p-1.5 rounded-lg bg-white font-bold text-xs"
                            value={relation} onChange={e => setRelation(e.target.value)}
                        >
                            <option value="PAPA">🧔 PAPA</option>
                            <option value="MAMAN">👩 MAMAN</option>
                            <option value="COACH">👔 COACH</option>
                            <option value="AUTRE">👤 AUTRE</option>
                        </select>
                        <select
                            className="border p-1.5 rounded-lg bg-white font-bold text-xs"
                            value={restriction} onChange={e => setRestriction(e.target.value)}
                        >
                            <option value="NONE">✅ Aucune restriction</option>
                            <option value="ONLY_CHILD">👪 Propre enfant uniquement</option>
                            <option value="NO_ADULTS">🚫 Pas d'adultes</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                            placeholder="Lieu départ"
                            className="border p-1.5 rounded-lg"
                            value={location} onChange={e => setLocation(e.target.value)}
                            required
                        />
                        <input
                            type="time"
                            className="border p-1.5 rounded-lg"
                            value={depTime} onChange={e => setDepTime(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex justify-between items-center">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
                            Places totales:
                            <input
                                type="number" min="1" max="9"
                                className="w-12 border rounded-lg p-1 text-center"
                                value={seats} onChange={e => setSeats(e.target.value)}
                            />
                        </label>
                        <button className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-black shadow-md hover:bg-indigo-700 transition-all">
                            Publier le trajet
                        </button>
                    </div>
                </form>
            )}

            <div className="space-y-2">
                {rides.length === 0 && !showForm && (
                    <p className="text-xs text-gray-400 italic">Aucune voiture proposée pour le moment.</p>
                )}

                {rides.map(ride => {
                    const passengers = ride.passengers || [];
                    const isDriver = ride.driver_id === currentUser.id;
                    const seatsOccupied = passengers.reduce((sum, p) => sum + (p.seat_count || 1), 0);
                    const seatsLeft = ride.seats_available - seatsOccupied;

                    // Driver Display Info
                    const driverBaseName = ride.driver?.full_name || 'Inconnu';
                    const driverDisplay = `${ride.driver_relation || ''} ${driverBaseName}`.trim();

                    return (
                        <div key={ride.id} className={`bg-white border rounded-xl p-3 text-sm shadow-sm transition-all ${isDriver ? 'border-indigo-300 ring-1 ring-indigo-50' : 'border-gray-200'}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-bold text-gray-900 flex items-center gap-1.5">
                                        <div className="bg-indigo-100 text-indigo-700 p-1 rounded">
                                            <Car size={14} />
                                        </div>
                                        <div className="leading-tight">
                                            <p>{driverDisplay}</p>
                                            <p className="text-[10px] text-gray-400 font-normal">
                                                {ride.departure_location || '?'} • {ride.departure_time?.slice(0, 5)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${seatsLeft > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                            {seatsLeft > 0 ? `🏃 ${seatsLeft} PLACES LIBRES` : 'FULL 🛑'}
                                        </span>
                                        {ride.restrictions !== 'NONE' && (
                                            <span className="text-[9px] font-black bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200 uppercase">
                                                ⚠️ {ride.restrictions === 'ONLY_CHILD' ? 'Propre enfant' : 'Pas d\'adultes'}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {isDriver ? (
                                        <button onClick={() => deleteRide(ride.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    ) : (
                                        seatsLeft > 0 && (
                                            <button
                                                onClick={() => joinRide(ride.id)}
                                                className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm transition-all active:scale-95"
                                            >
                                                Réserver
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Detailed Passenger List */}
                            {passengers.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-50 space-y-1.5">
                                    {passengers.map(p => (
                                        <div key={p.id} className="flex justify-between items-center text-xs group">
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>
                                                <span className="font-medium">{p.player?.full_name || 'Joueur'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] bg-gray-100 px-1.5 rounded font-bold text-gray-500">
                                                    {p.seat_count === 2 ? '👦+🧔 2p' : '👦 1p'}
                                                </span>
                                                {(p.player?.parent_id === currentUser.id || isDriver) && (
                                                    <button
                                                        onClick={() => leaveRide(ride.id)}
                                                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                        title="Annuler"
                                                    >
                                                        <XCircle size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
