
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Send, MessageSquare, User, Paperclip, ShieldCheck, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';

export default function Chat() {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [team, setTeam] = useState(null);
    const [isCoach, setIsCoach] = useState(false);
    const [isChatLocked, setIsChatLocked] = useState(false);
    const [uploading, setUploading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        fetchChatData();

        const channel = supabase
            .channel('public:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                fetchOneMessage(payload.new.id);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchChatData = async () => {
        try {
            setLoading(true);
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            setUser(currentUser);

            let myTeamId = null;
            let coachStatus = false;

            const { data: ownedTeam } = await supabase.from('teams').select('id, is_chat_locked').eq('coach_id', currentUser.id).maybeSingle();
            if (ownedTeam) {
                myTeamId = ownedTeam.id;
                coachStatus = true;
                setIsChatLocked(ownedTeam.is_chat_locked);
            } else {
                const { data: membership } = await supabase.from('team_members').select('team_id, teams(is_chat_locked)').eq('user_id', currentUser.id).maybeSingle();
                if (membership) {
                    myTeamId = membership.team_id;
                    setIsChatLocked(membership.teams?.is_chat_locked);
                }

                const { data: profile } = await supabase.from('profiles').select('role').eq('id', currentUser.id).single();
                coachStatus = profile?.role === 'COACH';
            }

            setTeam(myTeamId);
            setIsCoach(coachStatus);

            if (myTeamId) {
                const { data: msgs, error } = await supabase
                    .from('messages')
                    .select(`
                        id, content, created_at, file_url, file_type,
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
                id, content, created_at, file_url, file_type,
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

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !team) return;

        try {
            setUploading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${team}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('chat_attachments')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('chat_attachments')
                .getPublicUrl(filePath);

            await supabase.from('messages').insert({
                team_id: team,
                sender_id: user.id,
                content: `Fichier : ${file.name}`,
                file_url: publicUrl,
                file_type: file.type.includes('image') ? 'IMAGE' : 'PDF'
            });

        } catch (error) {
            alert("Erreur upload: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    const deleteMessage = async (id) => {
        if (!confirm('Supprimer ce message ?')) return;
        try {
            const { error } = await supabase.from('messages').delete().eq('id', id);
            if (error) throw error;
            setMessages(prev => prev.filter(m => m.id !== id));
        } catch (error) {
            alert("Erreur suppression: " + error.message);
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
            if (data) fetchOneMessage(data.id);
        } catch (error) {
            alert("Erreur envoi: " + error.message);
        }
    };

    if (loading) return <div className="p-10 text-center">Chargement...</div>;
    if (!team) return <div className="p-10 text-center">Vous n'avez pas d'équipe pour discuter.</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] max-w-4xl mx-auto border-x bg-white">
            {/* Header */}
            <div className="bg-white border-b p-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <MessageSquare className="text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="font-bold text-gray-800">Discussion d'Équipe</h1>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Temps réel activé</p>
                    </div>
                </div>
                {isCoach && <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm"><ShieldCheck size={12} /> MODÉRATEUR</span>}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {messages.length === 0 && (
                    <div className="text-center py-20">
                        <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border shadow-sm">
                            <MessageSquare className="text-gray-200" size={32} />
                        </div>
                        <p className="text-gray-400 font-medium">Lancez la conversation !</p>
                    </div>
                )}
                {messages.map((msg, index) => {
                    const isMe = msg.user?.id === user.id;
                    const isCoachMsg = msg.user?.role === 'COACH';
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const showHeader = !prevMsg || prevMsg.user?.id !== msg.user?.id;

                    return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${showHeader ? 'mt-4' : 'mt-1'}`}>
                            {showHeader && !isMe && (
                                <div className="flex items-center gap-1.5 mb-1 ml-1">
                                    <span className="text-[10px] font-bold text-gray-500">{msg.user?.full_name || 'Inconnu'}</span>
                                    {isCoachMsg && <span className="bg-indigo-100 text-indigo-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">Coach</span>}
                                </div>
                            )}

                            <div className={`group relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm transition-all ${isMe
                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                : `bg-white text-gray-800 border-2 rounded-tl-none ${isCoachMsg ? 'border-indigo-100 bg-indigo-50/30' : 'border-gray-100'}`
                                }`}>
                                {msg.file_url && (
                                    <div className="mb-2">
                                        {msg.file_type === 'IMAGE' ? (
                                            <img src={msg.file_url} alt="Attachment" className="max-w-full rounded-lg border shadow-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all" />
                                        ) : (
                                            <a href={msg.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-white/10 rounded-lg border border-white/20 hover:bg-white/20 transition-all">
                                                <FileText className={isMe ? 'text-indigo-200' : 'text-indigo-600'} />
                                                <span className="text-sm font-semibold truncate underline">Voir le PDF</span>
                                            </a>
                                        )}
                                    </div>
                                )}
                                <p className="text-sm break-words leading-relaxed">{msg.content}</p>
                                <div className={`text-[9px] font-bold mt-1 text-right flex items-center justify-end gap-1 ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {isMe && <ShieldCheck size={10} className="text-indigo-300" />}
                                </div>
                                {isCoach && (
                                    <button
                                        onClick={() => deleteMessage(msg.id)}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white p-4 border-t sticky bottom-0">
                {isChatLocked && !isCoach ? (
                    <div className="bg-gray-100 p-3 rounded-xl text-center text-gray-500 text-xs font-bold flex items-center justify-center gap-2">
                        🔒 Chat verrouillé par le coach (Mode Diffusion)
                    </div>
                ) : (
                    <form onSubmit={sendMessage} className="flex items-center gap-2 bg-gray-100 p-2 rounded-2xl border-2 border-transparent focus-within:border-indigo-300 focus-within:bg-white transition-all">
                        <label className="cursor-pointer p-2 hover:bg-gray-200 rounded-full transition-colors relative">
                            {uploading ? <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent animate-spin rounded-full" /> : <Paperclip size={20} className="text-gray-500" />}
                            <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} accept="image/*,.pdf" />
                        </label>
                        <input
                            type="text"
                            className="flex-1 bg-transparent px-2 py-1.5 focus:outline-none text-sm font-medium"
                            placeholder={isChatLocked ? "Écrire en tant que coach..." : "Écrivez un message ou envoyez un fichier..."}
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim() || uploading}
                            className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100 active:scale-90"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
