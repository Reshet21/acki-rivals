import { useState, useEffect } from 'react';
import { useI18n } from '../i18n';
import { useHaptic } from '../hooks/useHaptic';
import { getLeaderboard, type PlayerEntry } from '../services/pvpService';
import Icon from './Icon';

interface Props {
  playerId: string;
  playerName: string | null;
  wins: number;
  losses: number;
  onBack: () => void;
}

export default function Leaderboard({ playerId, playerName, wins, losses, onBack }: Props) {
  const { t } = useI18n();
  const { impactOccurred } = useHaptic();
  const [entries, setEntries] = useState<PlayerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const data = await getLeaderboard(50);
      if (!cancelled) {
        setEntries(data);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Calculate local player stats for display (even if not in Supabase yet)
  const localRating = wins * 100 - losses * 50;
  const hasLocalPlayer = entries.some((e) => e.player_id === playerId);

  // Merge: show server entries, and add local player if not already present
  const displayEntries = [...entries];
  if (!hasLocalPlayer && (wins > 0 || losses > 0)) {
    displayEntries.push({
      id: 'local',
      player_id: playerId,
      player_name: playerName || playerId.slice(0, 10),
      wins,
      losses,
      rating: localRating,
      last_active: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
  }
  displayEntries.sort((a, b) => b.rating - a.rating);
  displayEntries.forEach((e, i) => { (e as any)._rank = i + 1; });

  const winRate = (w: number, l: number) => w + l > 0 ? Math.round((w / (w + l)) * 100) : 0;

  return (
    <div className="flex flex-col h-full w-full max-w-lg mx-auto overflow-hidden" style={{ background: '#050508' }}>
      <div className="shrink-0 px-3 pt-3 pb-2 relative" style={{ background: 'rgba(5,5,8,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => { impactOccurred('soft'); onBack(); }} className="absolute left-3 top-3 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all active:scale-95" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
          ←
        </button>
        <div className="inline-flex items-center justify-center gap-1.5 w-full text-sm font-bold text-white mb-1 text-center"><Icon name="trophy" size={14} /> {t('leaderboard.title').replace(/^[^\p{L}\p{N}]+/u, '').trim()}</div>
        <div className="text-[10px] text-white/40 text-center">{t('leaderboard.subtitle')}</div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full py-16">
            <span className="w-6 h-6 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin-slow" />
            <div className="text-xs text-white/30 mt-2">{t('pvp.loading')}</div>
          </div>
        ) : displayEntries.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {displayEntries.map((entry, idx) => {
              const isPlayer = entry.player_id === playerId;
              const rank = (entry as any)._rank || idx + 1;
              return (
                <div
                  key={entry.player_id}
                  className={`flex items-center gap-3 p-2.5 rounded-xl transition-all animate-card-pop ${
                    isPlayer ? 'border border-neon-blue/30' : 'border border-white/5'
                  }`}
                  style={{
                    animationDelay: `${idx * 0.06}s`,
                    background: isPlayer ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.03)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    boxShadow: rank === 1 ? '0 0 20px rgba(255,215,0,0.15)' : undefined,
                  }}
                >
                  {/* Rank */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 relative overflow-hidden ${
                    rank === 1 ? 'bg-yellow-500 text-yellow-900' :
                    rank === 2 ? 'bg-gray-400 text-gray-900' :
                    rank === 3 ? 'bg-orange-600 text-orange-100' :
                    'bg-white/10 text-white/40'
                  }`} style={{ boxShadow: rank === 1 ? '0 0 12px rgba(255,215,0,0.4)' : undefined }}>
                    {rank === 1 && <span className="absolute inset-0 animate-shimmer pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />}
                    {rank}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold truncate ${isPlayer ? 'text-neon-blue' : 'text-white'}`}>
                        {entry.player_name}
                      </span>
                      {isPlayer && <span className="text-[8px] text-neon-blue">{t('leaderboard.you')}</span>}
                    </div>
                    <div className="flex gap-2 text-[9px] text-white/40">
                      <span className="inline-flex items-center gap-0.5 text-neon-green"><Icon name="check" size={9} stroke={2.4} />{entry.wins}</span>
                      <span className="inline-flex items-center gap-0.5 text-neon-red"><Icon name="close" size={9} stroke={2.4} />{entry.losses}</span>
                      <span>{winRate(entry.wins, entry.losses)}%</span>
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-white/70">{entry.rating.toLocaleString()}</div>
                    <div className="text-[8px] text-white/30">{t('leaderboard.rating')}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
            <div className="flex justify-center mb-4 opacity-30"><Icon name="trophy" size={50} /></div>
            <div className="text-base font-bold mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('leaderboard.noPlayers')}</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>{t('leaderboard.connectWallet')}</div>
          </div>
        )}
      </div>

      <div className="shrink-0 px-3 pb-3">
        <button onClick={() => { impactOccurred('soft'); onBack(); }} className="w-full py-2.5 rounded-lg font-bold text-sm bg-white/5 border border-white/10 text-white/60 active:bg-white/10 active:scale-[0.98] transition-all">
          {t('deck.back')}
        </button>
      </div>
    </div>
  );
}
