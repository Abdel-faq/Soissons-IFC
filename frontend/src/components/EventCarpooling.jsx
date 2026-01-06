import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Car, UserPlus, Users, XCircle, Trash2 } from 'lucide-react';

export default function EventCarpooling({ eventId, currentUser, teamId, myAttendance = {}, isCoach, activePlayer, evAttendance = [], members = [], userName }) {
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [children, setChildren] = useState([]);

    // New Ride Form State
    const [location, setLocation] = useState('');
    const [depTime, setDepTime] = useState('');
    const [relation, setRelation] = useState('PAPA');
    const [restriction, setRestriction] = useState('NONE');
    const [selectedChildForRide, setSelectedChildForRide] = useState(activePlayer?.id || null);
    const [rideMode, setRideMode] = useState('PUBLIC'); // 'PUBLIC' or 'PRIVATE'
    const [extraSeats, setExtraSeats] = useState(2);

    useEffect(() => {
        if (eventId) fetchRides();
        if (currentUser?.id && teamId) fetchChildren();
    }, [eventId, teamId, currentUser?.id]);

    useEffect(() => {
        if (activePlayer?.id) {
            setSelectedChildForRide(activePlayer.id);
        }
    }, [activePlayer]);

    useEffect(() => {
        if (children.length > 0 && !selectedChildForRide) {
            setSelectedChildForRide(children[0].id);
        }
    }, [children]);

    const fetchChildren = async () => {
        if (!currentUser?.id || !teamId) return;
        const { data: myTeamKids } = await supabase
            .from('team_members')
            .select(`
                player_id,
                player:players(*)
            `)
            .eq('team_id', teamId);

        const myKids = myTeamKids
            ?.filter(m => m.player?.parent_id === currentUser.id)
            .map(m => m.player) || [];

        setChildren(myKids);
    };

    const fetchRides = async () => {
        try {
            setLoading(true);
            const { data: ridesData, error: ridesError } = await supabase
                .from('rides')
                .select('*, driver:profiles!driver_id(full_name)')
                .eq('event_id', eventId)
                .order('created_at', { ascending: true });

            if (ridesError) throw ridesError;

            const rideIds = ridesData.map(r => r.id);
            if (rideIds.length === 0) {
                setRides([]);
                return;
            }

            const { data: passengersData, error: passengersError } = await supabase
                .from('ride_passengers')
                .select('*, player:players(full_name, parent_id), passenger:profiles(full_name)')
                .in('ride_id', rideIds);

            if (passengersError) {
                console.error('Error fetching passengers:', passengersError);
            }

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
        if (!isCoach && !selectedChildForRide) {
            alert("Veuillez sélectionner l'enfant que vous conduisez.");
            return;
        }

        try {
            const availableForOthers = rideMode === 'PRIVATE' ? 0 : parseInt(extraSeats);

            const { data: rideData, error: rideError } = await supabase.from('rides').insert({
                event_id: eventId,
                driver_id: currentUser.id,
                seats_available: availableForOthers,
                departure_location: location,
                departure_time: depTime,
                driver_relation: relation,
                restrictions: rideMode === 'PRIVATE' ? 'CLOSED' : restriction
            }).select().single();

            if (rideError) throw rideError;

            const { error: passengerError } = await supabase.from('ride_passengers').insert({
                ride_id: rideData.id,
                player_id: selectedChildForRide || null, // Optional for Coach
                passenger_id: currentUser.id, // satisfying legacy constraint
                seat_count: 1
            });

            if (passengerError) {
                await supabase.from('rides').delete().eq('id', rideData.id);
                throw passengerError;
            }

            setShowForm(false);
            setLocation('');
            setDepTime('');
            setRideMode('PUBLIC');
            fetchRides();
        } catch (err) {
            console.error(err);
            alert("Erreur création voiture: " + err.message);
        }
    };

    const joinRide = async (rideId) => {
        let selectedChildId = null;
        let seatCount = 1;

        if (isCoach) {
            // Coach joining
            if (children.length > 0) {
                const choice = prompt("Qui voyage ?\n1. Moi (Coach)\n2. Un de mes enfants");
                if (choice === '2') {
                    const names = children.map((c, i) => `${i + 1}. ${c.full_name}`).join('\n');
                    const childChoice = prompt(`Pour quel enfant ?\n${names}\n(Entrez le numéro)`);
                    const index = parseInt(childChoice) - 1;
                    if (children[index]) selectedChildId = children[index].id;
                    else return;
                }
            }
            // If selectedChildId is still null, it's the coach himself
        } else {
            // Standard Parent joining
            if (children.length === 0) {
                alert("Veuillez d'abord ajouter un enfant à votre profil.");
                return;
            }

            selectedChildId = children[0].id;
            if (children.length > 1) {
                const names = children.map((c, i) => `${i + 1}. ${c.full_name}`).join('\n');
                const choice = prompt(`Pour quel enfant ?\n${names}\n(Entrez le numéro)`);
                const index = parseInt(choice) - 1;
                if (children[index]) selectedChildId = children[index].id;
                else return;
            }

            const seatChoice = prompt("Combien de places ?\n1. Enfant seul\n2. Enfant + Parent");
            seatCount = seatChoice === '2' ? 2 : 1;
        }

        // Attendance Check for the person joining
        const entityToCheck = selectedChildId || currentUser.id;
        const status = myAttendance[entityToCheck]?.[eventId]?.status;
        if (status !== 'PRESENT' && status !== 'RETARD') {
            alert("Impossible de réserver pour une personne absente.");
            return;
        }

        try {
            const { error } = await supabase.from('ride_passengers').insert({
                ride_id: rideId,
                player_id: selectedChildId,
                passenger_id: currentUser.id, // satisfying legacy constraint
                seat_count: seatCount
            });
            if (error) {
                if (error.code === '23505') {
                    alert("Vous faites déjà partie de ce trajet (en tant que chauffeur ou passager).");
                    await fetchRides(); // refresh to update UI
                    return;
                }
                throw error;
            }

            console.log('Reservation successful, refreshing rides...');
            // Immediate refresh after successful reservation
            await fetchRides();
            console.log('Rides refreshed');
        } catch (err) {
            console.error('Join ride error:', err);
            alert("Impossible de rejoindre : " + err.message);
        }
    };

    const leaveRide = async (rideId) => {
        const query = supabase.from('ride_passengers')
            .delete()
            .eq('ride_id', rideId)
            .eq('passenger_id', currentUser.id);

        const { error } = await query;
        if (error) alert("Erreur : " + error.message);
        else fetchRides();
    };

    const deleteRide = async (rideId) => {
        if (!confirm("Supprimer votre voiture ?")) return;
        const { error } = await supabase.from('rides').delete().eq('id', rideId);
        if (error) alert(error.message);
        else fetchRides();
    };

    const hasAlreadyProposed = rides.some(r => r.driver_id === currentUser.id);

    // Robust check for passenger status using backend-enriched evAttendance if available
    const isAlreadyPassenger = evAttendance.some(a => {
        const isMeOrMyChild = (a.user_id === currentUser.id || a.player_id === currentUser.id || children.some(c => c.id === a.player_id));
        return isMeOrMyChild && a.has_ride;
    }) || rides.some(r => r.passengers?.some(p => p.passenger_id === currentUser.id));

    let isAvailableToDrive = false;
    if (isCoach) {
        const s = myAttendance[currentUser.id]?.[eventId]?.status;
        isAvailableToDrive = s === 'PRESENT' || s === 'RETARD';
    } else {
        isAvailableToDrive = children.some(c => {
            const s = myAttendance[c.id]?.[eventId]?.status;
            return s === 'PRESENT' || s === 'RETARD';
        });
    }

    const canPropose = !hasAlreadyProposed && !isAlreadyPassenger && isAvailableToDrive;
    const canJoinAny = isAvailableToDrive && !hasAlreadyProposed && !isAlreadyPassenger;


    if (loading) return <div className="text-sm text-gray-400 font-bold p-2">Chargement covoiturage...</div>;

    return (
        <div className="mt-2 text-sm">
            <div className="flex justify-between items-center mb-2 px-1">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Car size={12} /> Covoiturage
                </h3>
                {canPropose && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded transition-colors ${showForm ? 'bg-gray-200 text-gray-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                    >
                        {showForm ? 'Annuler' : '+ Proposer une place'}
                    </button>
                )}
                {!isAvailableToDrive && !loading && (
                    <span className="text-[10px] text-gray-400 italic">Droit de proposer (Absent)</span>
                )}
                {hasAlreadyProposed && !showForm && (
                    <span className="text-[10px] text-indigo-400 font-bold">Ma voiture est publiée</span>
                )}
            </div>

            {showForm && (
                <form onSubmit={createRide} className="bg-indigo-50 p-3 rounded-xl mb-3 shadow-sm border border-indigo-100">
                    <div className="mb-3">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Je conduis :</label>
                        <div className="flex gap-2 bg-white p-1 rounded-lg border">
                            {children.map(child => (
                                <button
                                    key={child.id}
                                    type="button"
                                    onClick={() => setSelectedChildForRide(child.id)}
                                    className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${selectedChildForRide === child.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    {child.first_name}
                                </button>
                            ))}
                            {isCoach && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedChildForRide(null)}
                                    className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${selectedChildForRide === null ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    Moi seul (Coach)
                                </button>
                            )}
                            {children.length === 0 && !isCoach && <span className="text-xs text-red-500 p-1">Aucun enfant trouvé</span>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Lien</label>
                            <select className="w-full border p-1.5 rounded-lg bg-white font-bold text-xs" value={relation} onChange={e => setRelation(e.target.value)}>
                                <option value="PAPA">🧔 PAPA</option>
                                <option value="MAMAN">👩 MAMAN</option>
                                <option value="COACH">👔 COACH</option>
                                <option value="AUTRE">👤 AUTRE</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mode</label>
                            <select className="w-full border p-1.5 rounded-lg bg-white font-bold text-xs" value={rideMode} onChange={e => setRideMode(e.target.value)}>
                                <option value="PUBLIC">👋 Places partagées</option>
                                <option value="PRIVATE">🔒 Juste mon enfant</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <input placeholder="Lieu départ" className="border p-1.5 rounded-lg text-xs" value={location} onChange={e => setLocation(e.target.value)} required />
                        <input type="time" className="border p-1.5 rounded-lg text-xs" value={depTime} onChange={e => setDepTime(e.target.value)} required />
                    </div>

                    <div className="flex justify-between items-end">
                        {rideMode === 'PUBLIC' ? (
                            <label className="block">
                                <span className="block text-xs font-bold text-gray-500 uppercase mb-1">Places Libres</span>
                                <input type="number" min="1" max="9" className="w-16 border rounded-lg p-1.5 text-center font-bold" value={extraSeats} onChange={e => setExtraSeats(e.target.value)} />
                            </label>
                        ) : (
                            <p className="text-[10px] text-gray-500 italic max-w-[50%]">Aucun autre joueur ne pourra réserver.</p>
                        )}
                        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-black shadow-md hover:bg-indigo-700 transition-all">Publier le trajet</button>
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

                    // Calculation: seats_available (for OTHERS) minus total seats taken by other passengers
                    const totalSeatsTakenByOthers = passengers.reduce((sum, p) => {
                        // The driver's own initial record has passenger_id === driver_id
                        if (String(p.passenger_id) === String(ride.driver_id)) return sum;
                        return sum + (p.seat_count || 1);
                    }, 0);
                    const seatsLeft = Math.max(0, (ride.seats_available || 0) - totalSeatsTakenByOthers);

                    // -------------------------------------------------------------------------
                    // DRIVER DISPLAY LOGIC
                    // -------------------------------------------------------------------------

                    let driverDisplay = "Chauffeur";
                    const driverProfileName = ride.driver?.full_name || 'Inconnu';
                    let relation = ride.driver_relation; // PAPA, MAMAN, COACH, AUTRE

                    // 1. Try to find the driver's child in the team list (members)
                    // This is the most reliable way to say "Papa de ..." even if the child isn't in the car
                    const driverKidsInTeam = members.filter(m => String(m.parent_id) === String(ride.driver_id));

                    if (driverKidsInTeam.length > 0 && relation !== 'COACH') {
                        // It's a parent -> Display "Papa de [ChildName]"
                        const childName = driverKidsInTeam[0].full_name; // Use first child found

                        let label = "Parent";
                        if (relation === 'PAPA') label = "Papa de";
                        else if (relation === 'MAMAN') label = "Maman de";
                        else label = "Parent de";

                        driverDisplay = `${label} ${childName}`;
                    } else {
                        // It's a Coach or someone without kids in team -> Show Profile Name
                        if (relation === 'COACH') {
                            driverDisplay = userName && isDriver ? userName : driverProfileName;
                            if (!driverDisplay.toLowerCase().includes('coach')) driverDisplay = `Coach ${driverDisplay}`;
                        } else {
                            // Fallback for others
                            driverDisplay = driverProfileName;
                        }
                    }

                    return (
                        <div key={ride.id} className={`bg-white border rounded-xl p-3 shadow-sm transition-all ${isDriver ? 'border-indigo-300 ring-1 ring-indigo-50' : 'border-gray-200'}`}>
                            {/* DEBUG INFO - REMOVE LATER */}
                            {currentUser.email === 'debug@test.com' && (
                                <div className="text-[9px] text-red-500 bg-red-50 p-1 mb-1">
                                    DEBUG: Driver: {ride.driver_id} | Me: {currentUser.id} | Seats: {ride.seats_available}
                                </div>
                            )}

                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-bold text-gray-900 flex items-center gap-1.5">
                                        <div className="bg-indigo-100 text-indigo-700 p-1 rounded">
                                            <Car size={14} />
                                        </div>
                                        <div className="leading-tight">
                                            <p className="capitalize text-xs font-black">{driverDisplay}</p>
                                            <p className="text-[10px] text-gray-400 font-normal">
                                                {ride.departure_location || '?'} • {ride.departure_time?.slice(0, 5)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {ride.seats_available > 0 ? (
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${seatsLeft > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                {seatsLeft > 0 ? `🏃 ${seatsLeft} PLACES LIBRES` : 'Pleine 🛑'}
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">🔒 PRIVÉ</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isDriver ? (
                                        <button onClick={() => deleteRide(ride.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                                            <Trash2 size={16} />
                                        </button>
                                    ) : (
                                        ride.seats_available > 0 && seatsLeft > 0 && canJoinAny && (
                                            <button onClick={() => joinRide(ride.id)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm transition-all active:scale-95">Réserver</button>
                                        )
                                    )}
                                </div>
                            </div>

                            {passengers.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-50 space-y-1.5">
                                    {passengers.map(p => {
                                        const isMe = String(p.passenger_id) === String(currentUser.id);
                                        const myChild = children.find(c => String(c.id) === String(p.player_id));
                                        const otherChild = members.find(m => String(m.id) === String(p.player_id));

                                        let displayName = p.player?.full_name
                                            || myChild?.full_name
                                            || otherChild?.full_name
                                            || p.passenger?.full_name
                                            || (isMe ? (userName || currentUser.user_metadata?.full_name || 'Moi') : 'Passager (Inconnu)');

                                        // If it's a coach (no player_id), append "(Coach)" if not already there
                                        if (!p.player_id && !displayName.toLowerCase().includes('coach')) {
                                            displayName += ' (Coach)';
                                        }

                                        return (
                                            <div key={p.id} className="flex justify-between items-center text-[11px] group">
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>
                                                    <span className={`font-medium ${isMe ? 'text-indigo-600 font-bold' : ''}`}>{displayName}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] bg-gray-100 px-1.5 rounded font-bold text-gray-500">
                                                        {p.seat_count === 2 ? '👦+🧔 2p' : '👦 1p'}
                                                    </span>
                                                    {(String(p.passenger_id) === String(currentUser.id) || isDriver) && (
                                                        <button onClick={() => leaveRide(ride.id)} className="text-gray-300 hover:text-red-500 transition-all p-1">
                                                            <XCircle size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
                <div className="text-[9px] text-center text-gray-300 mt-4 flex justify-center gap-2">
                    <span>v2.7 Fix</span>
                    <button onClick={() => window.location.reload()} className="underline hover:text-gray-500">Forcer Actualisation</button>
                </div>
            </div>
        </div>
    );
}
