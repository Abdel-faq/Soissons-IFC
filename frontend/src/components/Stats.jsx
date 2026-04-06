import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Users, CheckCircle, TrendingUp } from 'lucide-react';

export default function Stats({ teamId }) {
    const [stats, setStats] = useState({
        totalPlayers: 0,
        attendanceRate: 0,
        topPlayer: null
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (teamId) fetchStats();
    }, [teamId]);

    const fetchStats = async () => {
        try {
            setLoading(true);

            // 1. Total Players
            const { data: members } = await supabase
                .from('team_members')
                .select('player_id')
                .eq('team_id', teamId);

            const playerCount = members?.length || 0;

            // 2. Events (Last 3 Months)
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

            const { data: events } = await supabase
                .from('events')
                .select('id, visibility_type') // Need visibility for logic
                .eq('team_id', teamId)
                .gte('date', threeMonthsAgo.toISOString())
                .eq('is_deleted', false)
                .order('date', { ascending: false });

            let attendanceRate = 0;
            let topPlayerName = '-';
            let flopPlayerName = '-';

            if (events && events.length > 0) {
                const eventMap = {};
                events.forEach(e => eventMap[e.id] = e);
                const eventIds = events.map(e => e.id);

                // Fetch attendance for these events
                // Join on 'players' to get names
                const { data: attendance } = await supabase
                    .from('attendance')
                    .select('event_id, status, is_convoked, player_id, players(full_name)')
                    .in('event_id', eventIds)
                    .not('player_id', 'is', null); // Only players

                if (attendance && attendance.length > 0) {
                    // Filter meaningful statuses AND valid visibility
                    const validAttendance = attendance.filter(a => {
                        const evt = eventMap[a.event_id];
                        if (!evt) return false;

                        // [LOGIC] Logic: If Private + Not Convoked -> Ignore completely
                        if (evt.visibility_type === 'PRIVATE' && !a.is_convoked) {
                            return false;
                        }

                        return ['PRESENT', 'ABSENT', 'RETARD', 'MALADE', 'BLESSE'].includes(a.status);
                    });

                    const presentCount = validAttendance.filter(a => a.status === 'PRESENT' || a.status === 'RETARD').length;

                    if (validAttendance.length > 0) {
                        attendanceRate = Math.round((presentCount / validAttendance.length) * 100);
                    }

                    // Ranking Logic
                    const presenceCounts = {};
                    const absenceCounts = {};

                    validAttendance.forEach(a => {
                        const name = a.players?.full_name || 'Inconnu';

                        if (a.status === 'PRESENT') {
                            presenceCounts[name] = (presenceCounts[name] || 0) + 1;
                        }
                        // "Plus Absent" logic: Strictly ABSENT (red) or include Retard?
                        // Usually "Plus Absent" means ABSENT.
                        else if (a.status === 'ABSENT') {
                            absenceCounts[name] = (absenceCounts[name] || 0) + 1;
                        }
                    });

                    // Top Assidu
                    const sortedPresence = Object.entries(presenceCounts).sort((a, b) => b[1] - a[1]);
                    if (sortedPresence.length > 0) topPlayerName = `${sortedPresence[0][0]} (${sortedPresence[0][1]})`;

                    // Top Absent (Flop)
                    const sortedAbsence = Object.entries(absenceCounts).sort((a, b) => b[1] - a[1]);
                    if (sortedAbsence.length > 0) flopPlayerName = `${sortedAbsence[0][0]} (${sortedAbsence[0][1]})`;
                }
            }

            setStats({
                totalPlayers: playerCount,
                attendanceRate,
                topPlayer: topPlayerName,
                flopPlayer: flopPlayerName
            });

        } catch (error) {
            console.error("Stats error", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-4 bg-white rounded shadow-sm animate-pulse h-24"></div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-50 flex items-center gap-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full"><Users size={24} /></div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Effectif (Joueurs)</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalPlayers}</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-green-50 flex items-center gap-4">
                <div className="p-3 bg-green-100 text-green-600 rounded-full"><CheckCircle size={24} /></div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Présence (3 mois)</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.attendanceRate}%</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-purple-50 flex items-center gap-4">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-full"><TrendingUp size={24} /></div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Top Assidu</p>
                    <p className="text-lg font-bold text-gray-900 truncate max-w-[150px]" title={stats.topPlayer}>{stats.topPlayer || '-'}</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-red-50 flex items-center gap-4">
                <div className="p-3 bg-red-100 text-red-600 rounded-full"><TrendingUp size={24} className="rotate-180" /></div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Plus Absent</p>
                    <p className="text-lg font-bold text-gray-900 truncate max-w-[150px]" title={stats.flopPlayer}>{stats.flopPlayer || '-'}</p>
                </div>
            </div>
        </div>
    );
}
