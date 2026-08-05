import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCheck, Droplet, Phone, Mail, Paperclip, Unlock, ArrowLeft } from 'lucide-react';
import { api, unwrap } from '../lib/api.js';
import { uploadFile } from '../lib/upload.js';
import { getSocket } from '../lib/socket.js';
import { useAuth } from '../context/AuthContext.jsx';

/** Delivery ticks for the sender's own messages. */
function Ticks({ status }) {
  if (status === 'read') return <CheckCheck className="h-3.5 w-3.5 text-sky-300" aria-label="Read" />;
  if (status === 'delivered') return <CheckCheck className="h-3.5 w-3.5 text-white/40" aria-label="Delivered" />;
  return <Check className="h-3.5 w-3.5 text-white/40" aria-label="Sent" />;
}

export default function Chat() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const myId = String(user?.id || user?._id || '');
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const [text, setText] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const [contact, setContact] = useState(null);
  const [contactMsg, setContactMsg] = useState('');

  // Peer header info from the (cached) conversation list.
  const { data: convData } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => unwrap(api.get('/chat/conversations')),
  });
  const conversation = convData?.conversations?.find((c) => String(c.id) === String(id));
  const peer = conversation?.peer;

  // Messages. Fetching marks the peer's messages read server-side.
  const { data, isLoading, error } = useQuery({
    queryKey: ['messages', id],
    queryFn: () => unwrap(api.get(`/chat/conversations/${id}/messages`, { params: { limit: 50 } })),
  });
  const messages = data?.messages || [];
  const contactUnlocked = data?.contactUnlocked;

  const send = useMutation({
    mutationFn: (body) => unwrap(api.post(`/chat/conversations/${id}/messages`, body)),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['messages', id] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const uploadAttachment = useMutation({
    mutationFn: async (file) => {
      const attachment = await uploadFile(file, 'chat_attachment');
      return unwrap(api.post(`/chat/conversations/${id}/messages`, { attachment }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', id] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e) => setContactMsg(e.message),
  });

  const revealContact = useMutation({
    mutationFn: () => unwrap(api.get(`/chat/conversations/${id}/contact`)),
    onSuccess: (d) => setContact(d.contact),
    onError: (e) => setContactMsg(e.message),
  });
  const consent = useMutation({
    mutationFn: () => unwrap(api.post(`/chat/conversations/${id}/consent`)),
    onSuccess: (d) =>
      setContactMsg(
        d.contactUnlocked
          ? 'Contact sharing unlocked — tap "Show contact".'
          : 'Consent recorded. Waiting for the other person to agree.'
      ),
    onError: (e) => setContactMsg(e.message),
  });

  // Live updates for this thread.
  useEffect(() => {
    const socket = getSocket();
    const onMessage = (p) => {
      if (String(p.conversationId) === String(id)) {
        qc.invalidateQueries({ queryKey: ['messages', id] });
        socket.emit('chat:read', { conversationId: id });
      }
    };
    const onReceipt = (p) => {
      if (String(p.conversationId) === String(id))
        qc.invalidateQueries({ queryKey: ['messages', id] });
    };
    const onTyping = (p) => {
      if (String(p.conversationId) === String(id)) {
        setPeerTyping(p.typing);
        if (p.typing) setTimeout(() => setPeerTyping(false), 4000);
      }
    };
    socket.on('chat:message', onMessage);
    socket.on('chat:receipt', onReceipt);
    socket.on('chat:typing', onTyping);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:receipt', onReceipt);
      socket.off('chat:typing', onTyping);
    };
  }, [id, qc]);

  // Auto-scroll to newest.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, peerTyping]);

  // Broadcast typing (debounced by the browser event cadence).
  const onType = (e) => {
    setText(e.target.value);
    if (peer?.id) getSocket().emit('chat:typing', { conversationId: id, to: peer.id, typing: true });
  };

  const submit = (e) => {
    e.preventDefault();
    if (text.trim()) send.mutate({ text: text.trim() });
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/dashboard/messages" className="btn-ghost px-3 py-1.5 text-sm"><ArrowLeft className="h-4 w-4" aria-hidden /> Back</Link>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5">
              {peer?.avatarUrl ? <img src={peer.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-brand-300">{peer?.bloodGroup || <Droplet className="h-4 w-4" fill="currentColor" aria-hidden />}</span>}
            </div>
            <div>
              <div className="font-semibold leading-tight">{peer?.fullName || 'Conversation'}</div>
              <div className="text-xs text-white/40">{peerTyping ? 'typing…' : peer?.role}</div>
            </div>
          </div>
        </div>
        <ContactButton
          contactUnlocked={contactUnlocked}
          contact={contact}
          onReveal={() => revealContact.mutate()}
          onConsent={() => consent.mutate()}
          busy={revealContact.isPending || consent.isPending}
        />
      </div>
      {contactMsg && <p className="mb-2 text-xs text-brand-300">{contactMsg}</p>}
      {contact && (
        <div className="card mb-2 space-y-1.5 border-emerald-500/30 py-3 text-sm">
          <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-emerald-300" aria-hidden /> <a href={`tel:${contact.mobile}`} className="text-emerald-300 hover:underline">{contact.mobile}</a></div>
          <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-emerald-300" aria-hidden /> <a href={`mailto:${contact.email}`} className="text-emerald-300 hover:underline">{contact.email}</a></div>
          {contact.emergencyContact && <div className="text-white/50">Emergency: {contact.emergencyContact}</div>}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        {isLoading && <p className="text-white/40">Loading…</p>}
        {error && <p className="text-brand-300">{error.message}</p>}
        {!isLoading && messages.length === 0 && (
          <p className="py-8 text-center text-sm text-white/40">No messages yet — say hello.</p>
        )}
        {messages.map((m) => {
          const mine = String(m.sender) === myId;
          return (
            <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-brand-600/30 text-white' : 'bg-white/10 text-white/90'}`}>
                {m.attachment && (
                  <a href={m.attachment.url} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-1 text-brand-200 underline">
                    <Paperclip className="h-3.5 w-3.5" aria-hidden /> {m.attachment.name || 'Attachment'}
                  </a>
                )}
                {m.text && <span>{m.text}</span>}
                <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-white/40">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {mine && <Ticks status={m.status} />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadAttachment.mutate(e.target.files[0])}
        />
        <button
          type="button"
          className="btn-ghost px-3"
          title="Attach a file"
          aria-label="Attach a file"
          disabled={uploadAttachment.isPending}
          onClick={() => fileRef.current?.click()}
        >
          {uploadAttachment.isPending ? <span aria-hidden>…</span> : <Paperclip className="h-[18px] w-[18px]" aria-hidden />}
        </button>
        <input
          className="input flex-1"
          placeholder="Type a message…"
          aria-label="Type a message"
          value={text}
          onChange={onType}
        />
        <button className="btn-primary" disabled={send.isPending || !text.trim()}>Send</button>
      </form>
    </div>
  );
}

function ContactButton({ contactUnlocked, contact, onReveal, onConsent, busy }) {
  if (contact) return null;
  if (contactUnlocked)
    return <button className="btn-ghost text-sm" disabled={busy} onClick={onReveal}><Phone className="h-4 w-4" aria-hidden /> Show contact</button>;
  return <button className="btn-ghost text-sm" disabled={busy} onClick={onConsent}><Unlock className="h-4 w-4" aria-hidden /> Share contact</button>;
}
