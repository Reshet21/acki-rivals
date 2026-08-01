import { useI18n } from '../i18n';
import { useHaptic } from '../hooks/useHaptic';

interface Props {
  walletAddress: string | null;
  wins: number;
  losses: number;
  onBack: () => void;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  wins: number;
  losses: number;
  winRate: number;
  rating: number;
  isPlayer: boolean;
}

function getLeaderboard(playerWins: number, playerLosses: number, walletName: string | null): LeaderboardEntry[] {
  const playerRating = playerWins * 100 - playerLosses * 50;
  const entries: LeaderboardEntry[] = [];

  if (walletName) {
    entries.push({
      rank: 0,
      name: walletName,
      wins: playerWins,
      losses: playerLosses,
      winRate: playerWins + playerLosses > 0 ? Math.round((playerWins / (playerWins + playerLosses)) * 100) : 0,
      rating: playerRating,
      isPlayer: true,
    });
  }

  entries.sort((a, b) => b.rating - a.rating);
  entries.forEach((e, i) => { e.rank = i + 1; });

  return entries;
}

export default function Leaderboard({ walletAddress, wins, losses, onBack }: Props) {
  const { t } = useI18n();
  const { impactOccurred } = useHaptic();

  const entries = getLeaderboard(wins, losses, walletAddress);

  return (
    <div className="flex flex-col h-full w-full max-w-lg mx-auto overflow-hidden" style={{ background: '#050508' }}>
      <div className="shrink-0 px-3 pt-3 pb-2" style={{ background: 'rgba(5,5,8,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="text-sm font-bold text-white mb-1">{t('leaderboard.title')}</div>
        <div className="text-[10px] text-white/40">{t('leaderboard.subtitle')}</div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {entries.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {entries.map((entry, idx) => (
              <div
                key={entry.name}
                className={`flex items-center gap-3 p-2.5 rounded-xl transition-all animate-card-pop ${
                  entry.isPlayer
                    ? 'border border-neon-blue/30'
                    : 'border border-white/5'
                }`}
                style={{
                  animationDelay: `${idx * 0.08}s`,
                  background: entry.isPlayer ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  boxShadow: entry.rank === 1 ? '0 0 20px rgba(255,215,0,0.15)' : undefined,
                }}
              >
                {/* Rank */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 relative overflow-hidden ${
                  entry.rank === 1 ? 'bg-yellow-500 text-yellow-900' :
                  entry.rank === 2 ? 'bg-gray-400 text-gray-900' :
                  entry.rank === 3 ? 'bg-orange-600 text-orange-100' :
                  'bg-white/10 text-white/40'
                }`} style={{ boxShadow: entry.rank === 1 ? '0 0 12px rgba(255,215,0,0.4)' : undefined }}>
                  {entry.rank === 1 && <span className="absolute inset-0 animate-shimmer pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />}
                  {entry.rank}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold truncate ${entry.isPlayer ? 'text-neon-blue' : 'text-white'}`}>
                      {entry.name}
                    </span>
                    {entry.isPlayer && <span className="text-[8px] text-neon-blue">{t('leaderboard.you')}</span>}
                  </div>
                  <div className="flex gap-2 text-[9px] text-white/40">
                    <span className="text-neon-green">✓{entry.wins}</span>
                    <span className="text-neon-red">✗{entry.losses}</span>
                    <span>{entry.winRate}%</span>
                  </div>
                </div>

                {/* Rating */}
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-white/70">{entry.rating.toLocaleString()}</div>
                  <div className="text-[8px] text-white/30">{t('leaderboard.rating')}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
            <div className="text-5xl mb-4 opacity-30">🏆</div>
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
