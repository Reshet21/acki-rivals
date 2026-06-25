import { useState } from 'react';
import { useI18n } from '../i18n';

interface Props {
  walletAddress: string | null;
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
  const entries: LeaderboardEntry[] = [
    { rank: 0, name: 'NeoPhantom', wins: 847, losses: 123, winRate: 87.3, rating: 84500, isPlayer: false },
    { rank: 0, name: 'CyberMonk_X', wins: 712, losses: 98, winRate: 87.9, rating: 71200, isPlayer: false },
    { rank: 0, name: 'NeonSamurai', wins: 689, losses: 156, winRate: 81.6, rating: 68900, isPlayer: false },
    { rank: 0, name: 'BlockMaster', wins: 534, losses: 89, winRate: 85.7, rating: 53400, isPlayer: false },
    { rank: 0, name: 'CodeBuddha', wins: 467, losses: 201, winRate: 69.9, rating: 46700, isPlayer: false },
    { rank: 0, name: 'DarkRider', wins: 423, losses: 178, winRate: 70.3, rating: 42300, isPlayer: false },
    { rank: 0, name: 'ShadowWalker', wins: 389, losses: 145, winRate: 72.9, rating: 38900, isPlayer: false },
    { rank: 0, name: 'PixelMage', wins: 312, losses: 198, winRate: 61.2, rating: 31200, isPlayer: false },
    { rank: 0, name: 'CryptoKnight', wins: 287, losses: 167, winRate: 63.1, rating: 28700, isPlayer: false },
    { rank: 0, name: 'DataWitch', wins: 245, losses: 189, winRate: 56.5, rating: 24500, isPlayer: false },
  ];

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

export default function Leaderboard({ walletAddress, onBack }: Props) {
  const { t } = useI18n();
  const [wins] = useState(() => {
    try { return parseInt(localStorage.getItem('acki-wins') || '0'); } catch { return 0; }
  });
  const [losses] = useState(() => {
    try { return parseInt(localStorage.getItem('acki-losses') || '0'); } catch { return 0; }
  });

  const entries = getLeaderboard(wins, losses, walletAddress);

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden">
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="text-sm font-bold text-white mb-1">{t('leaderboard.title')}</div>
        <div className="text-[10px] text-white/40">{t('leaderboard.subtitle')}</div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        <div className="flex flex-col gap-1.5">
          {entries.map((entry) => (
            <div
              key={entry.name}
              className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                entry.isPlayer
                  ? 'bg-neon-blue/10 border border-neon-blue/30'
                  : 'bg-white/5 border border-white/5'
              }`}
            >
              {/* Rank */}
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                entry.rank === 1 ? 'bg-yellow-500 text-yellow-900' :
                entry.rank === 2 ? 'bg-gray-400 text-gray-900' :
                entry.rank === 3 ? 'bg-orange-600 text-orange-100' :
                'bg-white/10 text-white/40'
              }`}>
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
      </div>

      <div className="shrink-0 px-3 pb-3">
        <button onClick={onBack} className="w-full py-2.5 rounded-lg font-bold text-sm bg-white/5 border border-white/10 text-white/60 active:bg-white/10 active:scale-[0.98] transition-all">
          {t('deck.back')}
        </button>
      </div>
    </div>
  );
}
