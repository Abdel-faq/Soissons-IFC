
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Send, MessageSquare, User } from 'lucide-react';

export default function Chat() {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [team, setTeam] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        fetchChatData();

        // Subscribe to real-time messages
        // Simple filter might be hard if we don't have team_id yet, but we can filter globally or resubscribe.
        // For simplicity: Subscribe to ALL inserts on public.messages, then filter if needed or rely on RLS (which blocks invalid receives anyway?)
        // RLS for realtime is tricky, let's just fetch for now and add polling or channel subscription later.
        // Actually, let's try a channel immediately.

        const channel = supabase
            .channel('public:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                console.log('New msg:', payload);
                // Ideally we fetch the profile for this new message
                fetchOneMessage(payload.new.id);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchChatData = async () => {
        try {
            setLoading(true);
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            setUser(currentUser);

            // Get Team (Reusing logic is repetitive, ideally we have a Context, but sticking to page-isolation for now)
            let myTeamId = null;
            const { data: ownedTeam } = await supabase.from('teams').select('id').eq('coach_id', currentUser.id).maybeSingle();
            if (ownedTeam) myTeamId = ownedTeam.id;
            else {
                const { data: membership } = await supabase.from('team_members').select('team_id').eq('user_id', currentUser.id).maybeSingle();
                if (membership) myTeamId = membership.team_id;
            }

            setTeam(myTeamId);

            if (myTeamId) {
                const { data: msgs, error } = await supabase
                    .from('messages')
                    .select(`
                        id, content, created_at,
                        user:sender_id ( id, full_name, role )
                    `)
                    .eq('team_id', myTeamId)
                    .order('created_at', { ascending: true });

                if (error) throw error;
                setMessages(msgs || []);
            }

        } catch (error) {
            console.error("Chat Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchOneMessage = async (id) => {
        const { data } = await supabase
            .from('messages')
            .select(`
                id, content, created_at,
                user:sender_id ( id, full_name, role )
            `)
            .eq('id', id)
            .single();
        if (data) {
            setMessages(prev => {
                if (prev.some(m => m.id === data.id)) return prev;
                return [...prev, data];
            });
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !team) return;

        try {
            const { data, error } = await supabase.from('messages').insert({
                team_id: team,
                sender_id: user.id,
                content: newMessage.trim()
            }).select().single();

            if (error) throw error;
            setNewMessage('');

            // Manually fetch and display the new message immediately
            if (data) {
                fetchOneMessage(data.id);
            }
        } catch (error) {
            alert("Erreur envoi: " + error.message);
        }
    };

    if (loading) return <div className="p-10 text-center">Chargement...</div>;
    if (!team) return <div className="p-10 text-center">Vous n'avez pas d'équipe pour discuter.</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-100px)]">
            {/* Header */}
            <div className="bg-white border-b p-4 flex items-center gap-2 shadow-sm">
                <MessageSquare className="text-indigo-600" />
                <h1 className="font-bold text-gray-800">Discussion d'Équipe</h1>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.length === 0 && (
                    <div className="text-center text-gray-400 mt-10">
                        Aucun message. Lancez la conversation !
                    </div>
                )}
                {messages.map(msg => {
                    const isMe = msg.user?.id === user.id;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-lg p-3 shadow-sm ${isMe ? 'bg-indigo-600 text-white' : 'bg-white text-gray-800 border'}`}>
                                {!isMe && (
                                    <div className="text-xs font-bold text-indigo-600 mb-1 flex items-center gap-1">
                                        <User size={10} />
                                        {msg.user?.full_name || 'Inconnu'}
                                    </div>
                                )}
                                <p className="text-sm break-words">{msg.content}</p>
                                <span className={`text-[10px] block text-right mt-1 ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={sendMessage} className="bg-white p-4 border-t flex gap-2">
                <input
                    type="text"
                    className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:border-indigo-500"
                    placeholder="Votre message..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                />
                <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                    <Send size={20} />
                </button>
            </form>
        </div>
    );
}
