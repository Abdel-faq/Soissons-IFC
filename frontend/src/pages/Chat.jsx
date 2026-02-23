import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    Send, MessageSquare, User, Paperclip, ShieldCheck, FileText,
    Image as ImageIcon, Trash2, Plus, Users, Radio, Lock, X, Settings,
    Bold, Italic, Underline, Palette, Type, CheckCheck
} from 'lucide-react';

export default function Chat() {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [team, setTeam] = useState(null);
    const [isCoach, setIsCoach] = useState(false);
    const [isChatLocked, setIsChatLocked] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [rooms, setRooms] = useState([]); // [{id, name, is_broadcast}]
    const [activeRoom, setActiveRoom] = useState(null); // null means Global Team Chat
    const [showRoomForm, setShowRoomForm] = useState(false);
    const [newRoomData, setNewRoomData] = useState({ name: '', is_broadcast: false, members: [] });
    const [isEditingRoom, setIsEditingRoom] = useState(false);
    const [editingRoomData, setEditingRoomData] = useState({ id: '', name: '', is_broadcast: false, members: [] });
    const [teamMembers, setTeamMembers] = useState([]);
    const [activePlayerId, setActivePlayerId] = useState(null);
    const [readReceipts, setReadReceipts] = useState({}); // { messageId: [readers] }
    const [showFormatting, setShowFormatting] = useState(false);
    const [selectedColor, setSelectedColor] = useState('#4f46e5'); // Indigo 600
    const [isMobile, setIsMobile] = useState(false);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
        };
        checkMobile();
        fetchChatData();

        const channel = supabase
            .channel('public:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                // Only push if message belongs to current room
                if (!activeRoom) {
                    if (!payload.new.group_id) fetchOneMessage(payload.new.id);
                } else {
                    if (payload.new.group_id === activeRoom.id) fetchOneMessage(payload.new.id);
                }
            })
            .subscribe();

        if (team) markAsRead();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeRoom, team]);

    const fetchChatData = async () => {
        try {
            setLoading(true);
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            setUser(currentUser);

            // Read Context
            const savedCtx = localStorage.getItem('sb-active-context');
            let context = null;
            if (savedCtx) {
                try {
                    context = JSON.parse(savedCtx);
                } catch (e) { console.error("Stale context", e); }
            }

            if (!context) return;

            setTeam(context.teamId);
            const isUserCoach = context.role === 'COACH';
            setIsCoach(isUserCoach);
            setActivePlayerId(context.playerId || null);

            if (context.teamId) {
                const { data: t } = await supabase.from('teams').select('is_chat_locked').eq('id', context.teamId).single();
                setIsChatLocked(t?.is_chat_locked);

                // Fetch Messages
                const query = supabase
                    .from('messages')
                    .select(`
                        id, content, created_at, file_url, file_type, group_id, player_id,
                        sender:sender_id ( id, full_name, role ),
                        player:player_id ( id, full_name )
                    `)
                    .eq('team_id', context.teamId)
                    .order('created_at', { ascending: true });

                if (activeRoom) {
                    query.eq('group_id', activeRoom.id);
                } else {
                    query.is('group_id', null);
                }

                const { data: msgs, error } = await query;
                if (error) throw error;
                setMessages(msgs || []);
                if (isUserCoach) fetchReadReceipts(msgs?.map(m => m.id) || []);

                // Fetch Rooms (Salons)
                const { data: myRooms } = await supabase
                    .from('custom_groups')
                    .select('*')
                    .eq('team_id', context.teamId);
                setRooms(myRooms || []);

                // Fetch Team Members (Players + Coaches)
                if (isUserCoach) {
                    const { data: members } = await supabase
                        .from('team_members')
                        .select('player_id, user_id, players(id, full_name)')
                        .eq('team_id', context.teamId);
                    // Store the richer member objects
                    setTeamMembers(members?.filter(m => m.players).map(m => ({
                        id: m.player_id,
                        user_id: m.user_id,
                        full_name: m.players.full_name
                    })) || []);
                }
            }
        } catch (error) {
            console.error("Chat Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async () => {
        if (!team) return;
        try {
            const { data: session } = await supabase.auth.getSession();
            await fetch(`${import.meta.env.VITE_API_URL || '/api'}/messages/read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.session?.access_token}`
                },
                body: JSON.stringify({
                    team_id: team,
                    group_id: activeRoom?.id || null
                })
            });
        } catch (e) { console.error("Error marking as read", e); }
    };

    const fetchReadReceipts = async (messageIds) => {
        if (!messageIds.length || !isCoach) return;
        try {
            const { data, error } = await supabase
                .from('message_reads')
                .select('message_id, user_id, profiles(full_name)')
                .in('message_id', messageIds);

            if (error) throw error;

            const mapping = {};
            data.forEach(r => {
                if (!mapping[r.message_id]) mapping[r.message_id] = [];
                mapping[r.message_id].push(r.profiles?.full_name || 'Inconnu');
            });
            setReadReceipts(prev => ({ ...prev, ...mapping }));
        } catch (e) { console.error("Error fetching read receipts", e); }
    };

    const applyFormatting = (type, value = null) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = newMessage.substring(start, end);

        if (!selectedText) return;

        let formatted = '';
        switch (type) {
            case 'bold': formatted = `<b>${selectedText}</b>`; break;
            case 'italic': formatted = `<i>${selectedText}</i>`; break;
            case 'underline': formatted = `<u>${selectedText}</u>`; break;
            case 'color': formatted = `<span style="color:${value}">${selectedText}</span>`; break;
            default: formatted = selectedText;
        }

        const news = newMessage.substring(0, start) + formatted + newMessage.substring(end);
        setNewMessage(news);

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + formatted.length, start + formatted.length);
        }, 0);
    };

    const fetchOneMessage = async (id) => {
        const { data } = await supabase
            .from('messages')
            .select(`
                id, content, created_at, file_url, file_type, player_id,
                sender:sender_id ( id, full_name, role ),
                player:player_id ( id, full_name )
            `)
            .eq('id', id)
            .single();
        if (data) {
            setMessages(prev => {
                if (prev.some(m => m.id === data.id)) return prev;
                return [...prev, data];
            });
            if (isCoach) fetchReadReceipts([data.id]);
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
                player_id: activePlayerId,
                content: `Fichier : ${file.name}`,
                file_url: publicUrl,
                file_type: file.type.includes('image') ? 'IMAGE' : 'PDF',
                group_id: activeRoom?.id || null
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
        if (e) e.preventDefault();
        if (!newMessage.trim() || !team) return;

        try {
            const { data, error } = await supabase.from('messages').insert({
                team_id: team,
                sender_id: user.id,
                player_id: activePlayerId,
                content: newMessage.trim(),
                group_id: activeRoom?.id || null
            }).select().single();

            if (error) throw error;
            setNewMessage('');
            if (data) fetchOneMessage(data.id);
        } catch (error) {
            alert("Erreur envoi: " + error.message);
        }
    };

    const deleteRoom = async (roomId) => {
        if (!confirm("Supprimer ce salon définitivement ? Tous les messages seront perdus.")) return;
        try {
            const { error } = await supabase
                .from('custom_groups')
                .delete()
                .eq('id', roomId);

            if (error) throw error;

            if (activeRoom?.id === roomId) setActiveRoom(null);
            fetchChatData();
        } catch (err) {
            alert("Erreur suppression salon: " + err.message);
        }
    };

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        try {
            const { data: newRoom, error: roomError } = await supabase
                .from('custom_groups')
                .insert({
                    team_id: team,
                    name: newRoomData.name,
                    is_broadcast: newRoomData.is_broadcast,
                    created_by: user.id
                })
                .select()
                .single();

            if (roomError) throw roomError;

            if (newRoom && newRoomData.members.length > 0) {
                const memberInserts = newRoomData.members.map(m => ({
                    group_id: newRoom.id,
                    user_id: m.user_id,
                    player_id: m.id
                }));
                const { error: memberError } = await supabase
                    .from('group_members')
                    .insert(memberInserts);
                if (memberError) throw memberError;
            }

            setShowRoomForm(false);
            setNewRoomData({ name: '', is_broadcast: false, members: [] });
            fetchChatData();
            alert("Salon créé avec succès !");
        } catch (err) {
            alert("Erreur création salon: " + err.message);
        }
    };

    const startEditingRoom = async (room) => {
        try {
            const { data: currentMembers, error } = await supabase
                .from('group_members')
                .select('player_id')
                .eq('group_id', room.id);

            if (error) throw error;

            // Map IDs back to full member objects from teamMembers
            const selectedMembers = teamMembers.filter(m =>
                currentMembers.some(cm => cm.player_id === m.id)
            );

            setEditingRoomData({
                id: room.id,
                name: room.name,
                is_broadcast: room.is_broadcast,
                members: selectedMembers
            });
            setIsEditingRoom(true);
        } catch (err) {
            alert("Erreur chargement membres: " + err.message);
        }
    };

    const handleUpdateRoom = async (e) => {
        e.preventDefault();
        try {
            // 1. Update Room Name/Broadcast
            const { error: roomError } = await supabase
                .from('custom_groups')
                .update({
                    name: editingRoomData.name,
                    is_broadcast: editingRoomData.is_broadcast
                })
                .eq('id', editingRoomData.id);

            if (roomError) throw roomError;

            // 2. Manage Members (simplest approach: wipe and re-insert)
            // Or more precise: find diff. Let's do wipe/re-insert for reliability.
            const { error: delError } = await supabase
                .from('group_members')
                .delete()
                .eq('group_id', editingRoomData.id);

            if (delError) throw delError;

            if (editingRoomData.members.length > 0) {
                const memberInserts = editingRoomData.members.map(m => ({
                    group_id: editingRoomData.id,
                    user_id: m.user_id,
                    player_id: m.id
                }));
                const { error: memberError } = await supabase
                    .from('group_members')
                    .insert(memberInserts);
                if (memberError) throw memberError;
            }

            setIsEditingRoom(false);
            fetchChatData();
            alert("Salon mis à jour !");
        } catch (err) {
            alert("Erreur mise à jour salon: " + err.message);
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

            {/* Room Selector */}
            <div className="flex bg-gray-50 border-b overflow-x-auto no-scrollbar p-2 gap-2">
                <button
                    onClick={() => setActiveRoom(null)}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${!activeRoom ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
                >
                    # Général
                </button>
                {rooms.map(room => (
                    <div
                        key={room.id}
                        className={`flex-shrink-0 flex items-center bg-white rounded-full transition-all border ${activeRoom?.id === room.id ? 'border-indigo-600' : 'border-gray-200'}`}
                    >
                        <button
                            onClick={() => setActiveRoom(room)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${activeRoom?.id === room.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
                        >
                            {room.is_broadcast ? <Radio size={12} /> : <span>#</span>} {room.name}
                        </button>
                        {isCoach && (
                            <div className="flex items-center">
                                <button
                                    onClick={() => startEditingRoom(room)}
                                    className={`p-1.5 hover:text-indigo-600 transition-colors ${activeRoom?.id === room.id ? 'text-indigo-200' : 'text-gray-300'}`}
                                    title="Gérer les membres"
                                >
                                    <Settings size={14} />
                                </button>
                                <button
                                    onClick={() => deleteRoom(room.id)}
                                    className={`pr-3 pl-1 hover:text-red-500 transition-colors ${activeRoom?.id === room.id ? 'text-indigo-200' : 'text-gray-300'}`}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
                {isCoach && (
                    <button
                        onClick={() => setShowRoomForm(true)}
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-all"
                        title="Créer un salon"
                    >
                        <Plus size={16} />
                    </button>
                )}
            </div>

            {/* Messages Area */}
            < div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50" >
                {
                    messages.length === 0 && (
                        <div className="text-center py-20">
                            <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border shadow-sm">
                                <MessageSquare className="text-gray-200" size={32} />
                            </div>
                            <p className="text-gray-400 font-medium">{activeRoom ? `Bienvenue dans le salon ${activeRoom.name} !` : 'Lancez la conversation !'}</p>
                        </div>
                    )
                }
                {
                    messages.map((msg, index) => {
                        const isMe = msg.sender?.id === user.id;
                        const isCoachMsg = msg.sender?.role === 'COACH';
                        const prevMsg = index > 0 ? messages[index - 1] : null;
                        const showHeader = !prevMsg || prevMsg.sender?.id !== msg.sender?.id;

                        return (
                            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${showHeader ? 'mt-4' : 'mt-1'}`}>
                                {showHeader && !isMe && (
                                    <div className="flex items-center gap-1.5 mb-1 ml-1">
                                        <span className="text-[10px] font-bold text-gray-500">{msg.player?.full_name || msg.sender?.full_name || 'Inconnu'}</span>
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
                                    <div
                                        className="text-sm break-words leading-relaxed rich-text-content"
                                        dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>') }}
                                    />
                                    {isCoach && readReceipts[msg.id] && readReceipts[msg.id].length > 0 && (
                                        <div className={`text-[8px] mt-1 flex items-center gap-1 font-bold ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                                            <CheckCheck size={10} /> Lu par : {readReceipts[msg.id].join(', ')}
                                        </div>
                                    )}

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
                    })
                }
                < div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white p-4 border-t sticky bottom-0">
                {(isChatLocked || (activeRoom?.is_broadcast)) && !isCoach ? (
                    <div className="bg-gray-100 p-3 rounded-xl text-center text-gray-500 text-xs font-bold flex items-center justify-center gap-2">
                        <Lock size={14} /> Salon en mode diffusion seule (Lecture seule)
                    </div>
                ) : (
                    <div className="space-y-2">
                        {showFormatting && (
                            <div className="flex items-center gap-2 p-2 bg-indigo-50/50 rounded-xl border border-indigo-100 flex-wrap animate-in slide-in-from-bottom-2">
                                <button onClick={() => applyFormatting('bold')} className="p-1.5 hover:bg-white rounded-lg text-indigo-600 transition-colors" title="Gras"><Bold size={16} /></button>
                                <button onClick={() => applyFormatting('italic')} className="p-1.5 hover:bg-white rounded-lg text-indigo-600 transition-colors" title="Italique"><Italic size={16} /></button>
                                <button onClick={() => applyFormatting('underline')} className="p-1.5 hover:bg-white rounded-lg text-indigo-600 transition-colors" title="Souligné"><Underline size={16} /></button>
                                <div className="w-[1px] h-4 bg-indigo-200 mx-1" />
                                <input
                                    type="color"
                                    value={selectedColor}
                                    onChange={e => setSelectedColor(e.target.value)}
                                    className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                                />
                                <button onClick={() => applyFormatting('color', selectedColor)} className="p-1.5 hover:bg-white rounded-lg text-indigo-600 transition-colors" title="Appliquer couleur"><Palette size={16} /></button>
                            </div>
                        )}

                        {/* Live Preview Bubble */}
                        {newMessage.trim() && (newMessage.includes('<') || newMessage.includes('\n')) && (
                            <div className="animate-in fade-in slide-in-from-bottom-2">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Aperçu du message :</p>
                                <div className="bg-white border-2 border-indigo-100 rounded-2xl px-4 py-2.5 shadow-sm inline-block max-w-[85%] mb-2">
                                    <div
                                        className="text-sm break-words leading-relaxed rich-text-content uppercase-none"
                                        dangerouslySetInnerHTML={{ __html: newMessage.replace(/\n/g, '<br/>') }}
                                    />
                                </div>
                            </div>
                        )}


                        <div className="flex items-end gap-2 bg-gray-100 p-2 rounded-2xl border-2 border-transparent focus-within:border-indigo-300 focus-within:bg-white transition-all">
                            <div className="flex flex-col gap-1 items-center">
                                <label className="cursor-pointer p-2 hover:bg-gray-200 rounded-full transition-colors relative">
                                    {uploading ? <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent animate-spin rounded-full" /> : <Paperclip size={20} className="text-gray-500" />}
                                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} accept="image/*,.pdf" />
                                </label>
                                <button
                                    onClick={() => setShowFormatting(!showFormatting)}
                                    className={`p-2 rounded-full transition-colors ${showFormatting ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-200 text-gray-500'}`}
                                >
                                    <Type size={18} />
                                </button>
                            </div>

                            <textarea
                                ref={textareaRef}
                                className="flex-1 bg-transparent px-2 py-2 focus:outline-none text-sm font-medium resize-none max-h-32 min-h-[40px]"
                                placeholder={activeRoom ? `Message dans #${activeRoom.name}...` : "Écrivez un message..."}
                                value={newMessage}
                                onChange={e => {
                                    setNewMessage(e.target.value);
                                    e.target.style.height = 'inherit';
                                    e.target.style.height = `${e.target.scrollHeight}px`;
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        if (isMobile) {
                                            // On mobile, Enter is always a newline
                                            return;
                                        } else {
                                            if (e.shiftKey) {
                                                // On desktop, Shift+Enter is a newline
                                                return;
                                            } else {
                                                // On desktop, Enter sends the message
                                                e.preventDefault();
                                                sendMessage();
                                            }
                                        }
                                    }
                                }}
                                rows={1}
                            />

                            <button
                                onClick={sendMessage}
                                disabled={!newMessage.trim() || uploading}
                                className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100 active:scale-90 mb-0.5"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Room Creation Modal */}
            {showRoomForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                            <h2 className="font-bold flex items-center gap-2"><Plus size={18} /> Nouveau Salon</h2>
                            <button onClick={() => setShowRoomForm(false)} className="hover:bg-white/10 p-1 rounded-lg"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreateRoom} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nom du salon</label>
                                <input
                                    type="text" required
                                    className="w-full border-2 border-gray-100 rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none bg-gray-50 font-medium"
                                    placeholder="Ex: Entraînement Gardiens"
                                    value={newRoomData.name}
                                    onChange={e => setNewRoomData({ ...newRoomData, name: e.target.value })}
                                />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg border group">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-indigo-600 rounded"
                                    checked={newRoomData.is_broadcast}
                                    onChange={e => setNewRoomData({ ...newRoomData, is_broadcast: e.target.checked })}
                                />
                                <span className="text-sm font-bold text-gray-700 group-hover:text-indigo-600 flex items-center gap-1">
                                    <Radio size={14} className="text-indigo-600" /> Mode Diffusion (Seul le coach peut écrire)
                                </span>
                            </label>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Inviter des membres</label>
                                <div className="max-h-40 overflow-y-auto border-2 border-gray-50 rounded-lg p-2 grid grid-cols-1 gap-1 bg-gray-50/50">
                                    {teamMembers.map(m => (
                                        <button
                                            key={m.id} type="button"
                                            onClick={() => {
                                                const isSelected = newRoomData.members.find(sm => sm.id === m.id);
                                                setNewRoomData({
                                                    ...newRoomData,
                                                    members: isSelected
                                                        ? newRoomData.members.filter(sm => sm.id !== m.id)
                                                        : [...newRoomData.members, m]
                                                });
                                            }}
                                            className={`p-2 rounded-lg text-left text-xs transition-all flex items-center gap-2 border ${newRoomData.members.find(sm => sm.id === m.id)
                                                ? 'bg-indigo-600 text-white border-indigo-700'
                                                : 'bg-white text-gray-600 border-gray-100 hover:border-indigo-200'
                                                }`}
                                        >
                                            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-[8px]">{m.full_name?.[0]}</div>
                                            <span className="truncate">{m.full_name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95 transition-all mt-4"
                            >
                                Créer le Salon
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Room Edit Modal */}
            {isEditingRoom && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                            <h2 className="font-bold flex items-center gap-2"><Settings size={18} /> Gérer le Salon</h2>
                            <button onClick={() => setIsEditingRoom(false)} className="hover:bg-white/10 p-1 rounded-lg"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleUpdateRoom} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nom du salon</label>
                                <input
                                    type="text" required
                                    className="w-full border-2 border-gray-100 rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none bg-gray-50 font-medium"
                                    value={editingRoomData.name}
                                    onChange={e => setEditingRoomData({ ...editingRoomData, name: e.target.value })}
                                />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg border group">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-indigo-600 rounded"
                                    checked={editingRoomData.is_broadcast}
                                    onChange={e => setEditingRoomData({ ...editingRoomData, is_broadcast: e.target.checked })}
                                />
                                <span className="text-sm font-bold text-gray-700 group-hover:text-indigo-600 flex items-center gap-1">
                                    <Radio size={14} className="text-indigo-600" /> Mode Diffusion (Seul le coach peut écrire)
                                </span>
                            </label>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Gérer les membres ({editingRoomData.members.length})</label>
                                <div className="max-h-40 overflow-y-auto border-2 border-gray-50 rounded-lg p-2 grid grid-cols-1 gap-1 bg-gray-50/50">
                                    {teamMembers.map(m => (
                                        <button
                                            key={m.id} type="button"
                                            onClick={() => {
                                                const isSelected = editingRoomData.members.find(sm => sm.id === m.id);
                                                setEditingRoomData({
                                                    ...editingRoomData,
                                                    members: isSelected
                                                        ? editingRoomData.members.filter(sm => sm.id !== m.id)
                                                        : [...editingRoomData.members, m]
                                                });
                                            }}
                                            className={`p-2 rounded-lg text-left text-xs transition-all flex items-center gap-2 border ${editingRoomData.members.find(sm => sm.id === m.id)
                                                ? 'bg-indigo-600 text-white border-indigo-700'
                                                : 'bg-white text-gray-600 border-gray-100 hover:border-indigo-200'
                                                }`}
                                        >
                                            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-[8px]">{m.full_name?.[0]}</div>
                                            <span className="truncate">{m.full_name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsEditingRoom(false)}
                                    className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition-all"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="flex-2 bg-indigo-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95 transition-all"
                                >
                                    Enregistrer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
