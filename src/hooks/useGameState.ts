import { useState, useCallback } from 'react';
import type { Card } from '../types';


const STORAGE_KEY = 'acki-rivals-save';
const MAX_STARS = 6;

interface GameState {
  collection: Card[];
  deck: Card[];
  credits: number;
  walletName: string | null;
  battlesWon: number;
  battlesLost: number;
}

// Новые игроки начинают с пустой коллекцией — карты получают из паков
const defaultState: GameState = {
  collection: [],
  deck: [],
  credits: 0,
  walletName: null,
  battlesWon: 0,
  battlesLost: 0,
};

function isValidCard(card: Card): boolean {
  return (
    typeof card === 'object' &&
    card !== null &&
    typeof card.id === 'number' &&
    typeof card.name === 'string' &&
    card.name.length > 0 &&
    typeof card.power === 'number' &&
    !isNaN(card.power) &&
    typeof card.damage === 'number' &&
    !isNaN(card.damage)
  );
}

function ensureUniqueUids(cards: Card[]): Card[] {
  const seen = new Set<string>();
  return cards
    .filter(isValidCard)
    .map((card) => {
      let uid = card.uid;
      if (!uid || seen.has(uid)) {
        uid = crypto.randomUUID();
      }
      seen.add(uid);
      return { ...card, uid, stars: card.stars ?? 0 };
    });
}

function migrateData(data: GameState): GameState {
  const collection = ensureUniqueUids(data.collection);

  const collectionUidSet = new Set(collection.map((c) => c.uid));

  const deck: Card[] = [];
  const deckUidSeen = new Set<string>();
  for (const card of data.deck) {
    if (!card.uid) continue;
    if (!collectionUidSet.has(card.uid)) continue;
    if (deckUidSeen.has(card.uid)) continue;
    const match = collection.find((c) => c.uid === card.uid);
    if (match) {
      deck.push(match);
      deckUidSeen.add(card.uid);
    }
  }

  return { ...data, collection, deck };
}

function getStorageKey(walletAddress: string | null): string {
  if (walletAddress) {
    return `${STORAGE_KEY}-${walletAddress}`;
  }
  return STORAGE_KEY;
}

function loadFromStorage(walletAddress: string | null): GameState | null {
  try {
    const key = getStorageKey(walletAddress);
    const raw = localStorage.getItem(key);
    if (!raw) {
      // Try to migrate from old generic key when first connecting a wallet
      if (walletAddress) {
        const oldRaw = localStorage.getItem(STORAGE_KEY);
        if (oldRaw) {
          const data = JSON.parse(oldRaw) as GameState;
          localStorage.setItem(key, oldRaw);
          return migrateData(data);
        }
      }
      return null;
    }
    const data = JSON.parse(raw) as GameState;
    return migrateData(data);
  } catch {
    return null;
  }
}

function saveToStorageInternal(data: GameState, walletAddress: string | null) {
  const key = getStorageKey(walletAddress);
  localStorage.setItem(key, JSON.stringify(data));
}

export function useGameState(initialWalletAddress?: string | null) {
  const [walletAddress, setWalletAddressState] = useState<string | null>(
    () => initialWalletAddress ?? null
  );

  const [collection, setCollection] = useState<Card[]>(() => {
    const saved = loadFromStorage(initialWalletAddress ?? null);
    return saved ? saved.collection : ensureUniqueUids(defaultState.collection);
  });

  const [deck, setDeck] = useState<Card[]>(() => {
    const saved = loadFromStorage(initialWalletAddress ?? null);
    return saved ? saved.deck : [];
  });

  const [credits, setCredits] = useState<number>(() => {
    const saved = loadFromStorage(initialWalletAddress ?? null);
    return saved?.credits ?? defaultState.credits;
  });

  const [walletName, setWalletNameState] = useState<string | null>(() => {
    const saved = loadFromStorage(initialWalletAddress ?? null);
    return saved?.walletName ?? defaultState.walletName;
  });

  const [battlesWon, setBattlesWon] = useState<number>(() => {
    const saved = loadFromStorage(initialWalletAddress ?? null);
    return saved?.battlesWon ?? defaultState.battlesWon;
  });

  const [battlesLost, setBattlesLost] = useState<number>(() => {
    const saved = loadFromStorage(initialWalletAddress ?? null);
    return saved?.battlesLost ?? defaultState.battlesLost;
  });

  const addCard = useCallback((card: Card) => {
    const cardWithUid: Card = {
      ...card,
      uid: card.uid || crypto.randomUUID(),
      stars: card.stars ?? 0,
    };
    setCollection((prev) => [...prev, cardWithUid]);
  }, []);

  /**
   * Remove a card from collection by uid (e.g. when listing on marketplace).
   * Also removes it from deck if present.
   */
  const removeCard = useCallback((cardUid: string) => {
    setCollection((prev) => prev.filter((c) => c.uid !== cardUid));
    setDeck((prev) => prev.filter((c) => c.uid !== cardUid));
  }, []);

  const addCredits = useCallback((amount: number) => {
    setCredits((prev) => prev + amount);
  }, []);

  const setWalletName = useCallback((name: string | null) => {
    setWalletNameState(name);
  }, []);

  /**
   * Upgrade a card by merging it with ANOTHER card of the SAME star level.
   * Rule: 2 cards ★N → 1 card ★(N+1). Max ★MAX_STARS.
   * Each star gives +1 power and +1 damage.
   */
  const upgradeCard = useCallback((cardUid: string, t?: (key: string) => string): { success: boolean; message: string } => {
    const card = collection.find((c) => c.uid === cardUid);
    if (!card) return { success: false, message: t ? t('game.cardNotFound') : 'Card not found' };

    const currentStars = card.stars ?? 0;
    if (currentStars >= MAX_STARS) {
      return { success: false, message: t ? t('game.maxStars') : 'Max star level reached' };
    }

    // Need a second card with the same id AND the same star level
    const partner = collection.find(
      (c) => c.id === card.id && c.uid !== card.uid && (c.stars ?? 0) === currentStars
    );

    if (!partner) {
      return {
        success: false,
        message: t ? t('game.needCopies') : `Need 2 cards ★${currentStars}, have 1`,
      };
    }

    // Remove the partner card, bump the base card's stars
    setCollection((prev) => {
      return prev
        .filter((c) => c.uid !== partner.uid)
        .map((c) =>
          c.uid === cardUid
            ? { ...c, stars: currentStars + 1, power: c.power + 1, damage: c.damage + 1 }
            : c
        );
    });

    // Update deck if card is there (remove merged partner, bump base)
    setDeck((prev) =>
      prev
        .filter((c) => c.uid !== partner.uid)
        .map((c) =>
          c.uid === cardUid
            ? { ...c, stars: currentStars + 1, power: c.power + 1, damage: c.damage + 1 }
            : c
        )
    );

    return { success: true, message: t ? t('game.starUpgraded') : 'Star upgraded' };
  }, [collection]);

  const saveToStorage = useCallback(() => {
    const data: GameState = { collection, deck, credits, walletName, battlesWon, battlesLost };
    saveToStorageInternal(data, walletAddress);
  }, [collection, deck, credits, walletName, battlesWon, battlesLost, walletAddress]);

  const recordWin = useCallback(() => {
    setBattlesWon((prev) => prev + 1);
  }, []);

  const recordLoss = useCallback(() => {
    setBattlesLost((prev) => prev + 1);
  }, []);

  /**
   * Switch the active wallet address and reload the appropriate saved state.
   * - saves current state to the old key first
   * - loads state from the new key (or defaults)
   */
  const setWalletAddress = useCallback((newAddress: string | null) => {
    // Save current state to old key before switching
    const oldData: GameState = { collection, deck, credits, walletName, battlesWon, battlesLost };
    saveToStorageInternal(oldData, walletAddress);

    // Update wallet address
    setWalletAddressState(newAddress);

    // Load state from new key
    const saved = loadFromStorage(newAddress);
    if (saved) {
      setCollection(saved.collection);
      setDeck(saved.deck);
      setCredits(saved.credits);
      setWalletNameState(saved.walletName);
      setBattlesWon(saved.battlesWon);
      setBattlesLost(saved.battlesLost);
    } else {
      // New wallet — start fresh
      setCollection(ensureUniqueUids(defaultState.collection));
      setDeck([]);
      setCredits(defaultState.credits);
      setWalletNameState(defaultState.walletName);
      setBattlesWon(defaultState.battlesWon);
      setBattlesLost(defaultState.battlesLost);
    }
  }, [collection, deck, credits, walletName, battlesWon, battlesLost, walletAddress]);

  return {
    collection,
    deck,
    setDeck,
    credits,
    walletName,
    battlesWon,
    battlesLost,
    walletAddress,
    addCard,
    removeCard,
    addCredits,
    upgradeCard,
    setWalletName,
    saveToStorage,
    recordWin,
    recordLoss,
    setWalletAddress,
  };
}
