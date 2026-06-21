interface Props {
  credits: number;
  onBuyPack: () => void;
  onBack: () => void;
}

export default function Shop({ credits, onBuyPack, onBack }: Props) {
  const canBuy = credits >= 100;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto p-4">
      <div className="text-xl font-bold text-neon-blue">
        💰 Кредиты: {credits}
      </div>

      <button
        onClick={onBuyPack}
        disabled={!canBuy}
        className={`
          w-full py-4 rounded-xl font-bold text-lg
          transition-all duration-150
          ${canBuy
            ? 'bg-gradient-to-r from-neon-purple to-neon-pink text-white shadow-[0_0_20px_rgba(183,66,255,0.3)] hover:opacity-90 active:scale-95'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        📦 Купить пак (100 кредитов)
      </button>

      {!canBuy && (
        <div className="text-sm text-neon-red/70">
          Недостаточно кредитов
        </div>
      )}

      <button
        onClick={onBack}
        className="w-full py-3 rounded-lg font-bold text-sm
          bg-white/5 border border-white/10 text-white/60
          hover:bg-white/10 active:scale-95
          transition-all duration-150"
      >
        Назад
      </button>
    </div>
  );
}
