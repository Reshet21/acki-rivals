import { useState, useEffect, useCallback } from 'react';
import { useHaptic } from '../hooks/useHaptic';
import { useI18n } from '../i18n';
import Icon from './Icon';
import {
  listClans, fetchMyClan, createClan, joinClan, leaveClan, kickMember,
  fetchInvites, acceptInvite, declineInvite, cancelInvite,
  type ClanSummary, type ClanMember, type ClanInvite,
} from '../services/chatService';

interface Props {
  playerId: string;
  onBack: () => void;
}

export default function ClansScreen({ playerId, onBack }: Props) {
  const { impactOccurred } = useHaptic();
  const { t } = useI18n();

  const [clans, setClans] = useState<ClanSummary[]>([]);
  const [myClan, setMyClan] = useState<{ clan: ClanSummary | null; members: ClanMember[]; myRole?: string }>({ clan: null, members: [], myRole: 'member' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [clanName, setClanName] = useState('');
  const [clanTag, setClanTag] = useState('');
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [invites, setInvites] = useState<{ incoming: ClanInvite[]; outgoing: ClanInvite[] }>({ incoming: [], outgoing: [] });

  const reload = useCallback(async () => {
    setBusy(true);
    setError(null);
    const [listResult, myResult, invitesResult] = await Promise.all([
      listClans(playerId),
      fetchMyClan(playerId),
      fetchInvites(playerId),
    ]);
    setBusy(false);
    setClans(listResult.clans);
    setMyClan({ clan: myResult.clan, members: myResult.members || [], myRole: myResult.myRole });
    setInvites(invitesResult);
  }, [playerId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleCreate = async () => {
    if (!clanName.trim() || !clanTag.trim()) return;
    impactOccurred('medium');
    setBusy(true);
    setError(null);
    const result = await createClan(playerId, clanName.trim(), clanTag.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error || 'Ошибка создания клана');
      return;
    }
    setCreateOpen(false);
    setClanName('');
    setClanTag('');
    reload();
  };

  const handleJoin = async (clanId: string) => {
    impactOccurred('medium');
    setActionTarget(clanId);
    setError(null);
    const result = await joinClan(playerId, clanId);
    setActionTarget(null);
    if (!result.ok) {
      setError(result.error || 'Ошибка вступления');
      return;
    }
    reload();
  };

  const handleLeave = async () => {
    impactOccurred('medium');
    setError(null);
    const result = await leaveClan(playerId);
    if (!result.ok) {
      setError(result.error || 'Ошибка выхода');
      return;
    }
    reload();
  };

  const handleKick = async (target: string) => {
    impactOccurred('medium');
    setActionTarget(target);
    setError(null);
    const result = await kickMember(playerId, target);
    setActionTarget(null);
    if (!result.ok) {
      setError(result.error || 'Ошибка кика');
      return;
    }
    reload();
  };

  const isLeader = myClan.myRole === 'owner' || myClan.myRole === 'admin';
  const canKick = (role?: string) =>
    myClan.myRole === 'owner' || (myClan.myRole === 'admin' && role !== 'admin' && role !== 'owner');

  const handleInviteAction = async (inviteId: string, accept: boolean) => {
    impactOccurred('medium');
    setActionTarget(inviteId);
    setError(null);
    const result = accept ? await acceptInvite(playerId, inviteId) : await declineInvite(playerId, inviteId);
    setActionTarget(null);
    if (!result.ok) {
      setError(result.error || (accept ? 'Ошибка принятия' : 'Ошибка отклонения'));
      return;
    }
    reload();
  };

  const handleInviteCancel = async (inviteId: string) => {
    impactOccurred('medium');
    setActionTarget(inviteId);
    setError(null);
    const result = await cancelInvite(playerId, inviteId);
    setActionTarget(null);
    if (!result.ok) {
      setError(result.error || 'Ошибка отмены');
      return;
    }
    reload();
  };

  return (
    <div className="flex flex-col h-full w-full max-w-lg mx-auto px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="relative flex items-center mb-3 h-9">
        <button onClick={onBack} className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] active:scale-90 transition-all">
          <Icon name="back" size={16} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 text-base font-black text-white whitespace-nowrap"><Icon name="castle" size={16} /> {t('clan.title').replace(/^[^\p{L}\p{N}]+/u, '').trim()}</div>
      </div>
      {!myClan.clan && (
        <button onClick={() => { impactOccurred('light'); setCreateOpen(true); setClanName(''); setClanTag(''); }}
          className="w-full mb-3 py-2 text-sm font-bold bg-white/[0.06] border border-white/[0.12] text-white active:scale-[0.98] transition-all"
          style={{ borderRadius: 9 }}>
          <span className="inline-flex items-center gap-1.5 justify-center"><Icon name="plus" size={15} /> {t('clan.create')}</span>
        </button>
      )}

      {error && (
        <div className="mb-2 px-3 py-2 rounded-xl text-[11px] font-medium" style={{ background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.25)', color: '#ff9b9b' }}>
          {error}
        </div>
      )}

      {!myClan.clan && invites.incoming.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-neon-blue/70 mb-1.5 flex items-center gap-1.5">
            <Icon name="gift" size={11} /> {t('clan.invitesIncoming')} ({invites.incoming.length})
          </div>
          <div className="space-y-1.5">
            {invites.incoming.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2.5 px-3 py-2 rounded-2xl border border-neon-blue/25" style={{ background: 'rgba(0,212,255,0.06)' }}>
                <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.25)' }}>
                  <Icon name="castle" size={14} style={{ color: '#00d4ff' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-white truncate flex items-center gap-1.5">
                    {inv.clan_name}
                    {inv.clan_tag && <span className="px-1 py-0.5 rounded text-[9px] font-black tracking-widest" style={{ background: 'rgba(255,215,0,0.12)', color: '#FFD700' }}>{inv.clan_tag}</span>}
                  </div>
                  <div className="text-[10px] text-white/35 truncate">{t('clan.invitedBy')} {inv.inviter}</div>
                </div>
                <button onClick={() => handleInviteAction(inv.id, false)} disabled={actionTarget === inv.id}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-white/[0.05] border border-white/[0.1] text-white/50 active:scale-90 transition-all disabled:opacity-40">
                  {t('clan.decline')}
                </button>
                <button onClick={() => handleInviteAction(inv.id, true)} disabled={actionTarget === inv.id}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-black text-white active:scale-90 transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.6), rgba(139,92,246,0.6))' }}>
                  {actionTarget === inv.id ? t('pvp.loading') : t('clan.accept')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {busy && clans.length === 0 && !myClan.clan ? (
        <div className="flex-1 flex items-center justify-center text-xs text-white/30">{t('pvp.loading')}</div>
      ) : myClan.clan ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* My clan card */}
          <div className="mb-3 p-4 rounded-2xl border border-orange-400/25" style={{ background: 'linear-gradient(135deg, rgba(255,100,0,0.08), rgba(255,180,0,0.04))' }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-black text-white flex items-center gap-2">
                  {myClan.clan.name}
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black tracking-widest" style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700' }}>
                    {myClan.clan.tag}
                  </span>
                </div>
                <div className="text-[11px] text-white/40 mt-0.5">
                  {t('clan.members')}: {myClan.members.length} · {t('clan.rating')}: {myClan.clan.rating}
                </div>
                <div className="inline-flex items-center gap-1 text-[10px] text-white/30 mt-1">
                  <Icon name={myClan.myRole === 'owner' ? 'crown' : myClan.myRole === 'admin' ? 'shield' : 'sword'} size={11} />
                  {myClan.myRole === 'owner' ? t('clan.roleOwner') : myClan.myRole === 'admin' ? t('clan.roleAdmin') : t('clan.roleMember')}
                </div>
              </div>
              <button onClick={handleLeave}
                className="shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-white/[0.05] border border-white/[0.1] text-white/50 active:scale-90 transition-all">
                {myClan.myRole === 'owner' ? t('clan.disband') : t('clan.leave')}
              </button>
            </div>
          </div>

          {/* Outgoing invites */}
          {invites.outgoing.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1.5">{t('clan.invitesOutgoing')}</div>
              <div className="space-y-1.5">
                {invites.outgoing.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black"
                      style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}>
                      {(inv.invitee || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold text-white truncate font-mono">{inv.invitee}</div>
                      <div className="text-[10px] text-white/35">{inv.status === 'declined' ? t('clan.inviteDeclined') : t('clan.invitePending')}</div>
                    </div>
                    <button onClick={() => handleInviteCancel(inv.id)} disabled={actionTarget === inv.id || inv.status !== 'pending'}
                      className="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/15 border border-red-500/25 text-red-300 active:scale-90 transition-all disabled:opacity-40">
                      {t('clan.inviteCancel')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members */}
          <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1.5 mt-3">{t('clan.members')}</div>
          <div className="space-y-1.5">
            {myClan.members.map((m) => (
              <div key={m.player} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black"
                  style={{ background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.25)', color: '#FFD700' }}>
                  {(m.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-white truncate flex items-center gap-1.5">
                    {m.name}
                    {m.player === playerId && <span className="text-[9px] text-neon-blue">({t('clan.you')})</span>}
                  </div>
                  <div className="text-[10px] text-white/35">
                    {m.role === 'owner' ? t('clan.roleOwner') : m.role === 'admin' ? t('clan.roleAdmin') : t('clan.roleMember')}
                    {' · '}{t('clan.rating')} {m.rating}
                  </div>
                </div>
                {isLeader && m.player !== playerId && canKick(m.role) && (
                  <button onClick={() => handleKick(m.player)} disabled={actionTarget === m.player}
                    className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-500/15 border border-red-500/25 text-red-300 active:scale-90 transition-all disabled:opacity-40">
                    {t('clan.kick')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Clan list */}
          <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1.5">{t('clan.allClans')}</div>
          {clans.length === 0 ? (
            <div className="text-center py-10">
              <div className="flex justify-center mb-2 text-white/30"><Icon name="castle" size={30} /></div>
              <div className="text-white/40 text-sm">{t('clan.noClans')}</div>
              <div className="text-white/20 text-[10px] mt-1">{t('clan.noClansHint')}</div>
            </div>
          ) : (
            <div className="space-y-2">
              {clans.map((c, idx) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[13px] font-black"
                    style={{ background: 'rgba(255,100,0,0.1)', border: '1px solid rgba(255,100,0,0.2)', color: 'rgba(255,150,80,0.9)' }}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-white truncate flex items-center gap-1.5">
                      {c.name}
                      <span className="px-1 py-0.5 rounded text-[9px] font-black tracking-widest" style={{ background: 'rgba(255,215,0,0.12)', color: '#FFD700' }}>
                        {c.tag}
                      </span>
                    </div>
                    <div className="text-[10px] text-white/35 mt-0.5">
                      {t('clan.members')}: {c.members} · {t('clan.rating')}: {c.rating}
                    </div>
                  </div>
                  <button onClick={() => handleJoin(c.id)} disabled={actionTarget === c.id}
                    className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold text-white active:scale-90 transition-all disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, rgba(255,100,0,0.35), rgba(255,145,0,0.25))', border: '1px solid rgba(255,100,0,0.3)' }}>
                    {actionTarget === c.id ? t('pvp.loading') : t('clan.join')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create clan modal */}
      {createOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-xs rounded-2xl border border-white/[0.1] p-5 animate-slide-up" style={{ background: '#101013' }}>
            <div className="text-base font-black text-white mb-3">{t('clan.create')}</div>
            <input
              value={clanName}
              onChange={(e) => setClanName(e.target.value)}
              placeholder={t('clan.namePlaceholder')}
              maxLength={24}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder-white/25 outline-none focus:border-white/30 mb-2"
            />
            <input
              value={clanTag}
              onChange={(e) => setClanTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
              placeholder={t('clan.tagPlaceholder')}
              maxLength={5}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder-white/25 outline-none focus:border-white/30 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setCreateOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-white/[0.05] border border-white/[0.08] text-white/60 active:scale-95 transition-all">
                {t('settings.cancel')}
              </button>
              <button onClick={handleCreate} disabled={busy || clanName.trim().length < 2 || clanTag.length < 2}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-white/[0.1] border border-white/[0.15] active:scale-95 transition-all disabled:opacity-30">
                {busy ? t('pvp.loading') : t('clan.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
