import { useState, useCallback } from 'react';
import type { Card } from '../types';
import { cards as starterCards } from '../data/cards';

const STORAGE_KEY = 'acki-rivals-save';
const MAX_STARS = 5;

interface GameState {
  collection: Card[];
  deck: Card[];
  credits: number;
  walletName: string | null;
  battlesWon: number;
  battlesLost: number;
}

const defaultState: GameState = {
  collection: [...starterCards],
  deck: [],
  credits: 1000,
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
      uid: crypto.randomUUID(),
      stars: card.stars ?? 0,
    };
    setCollection((prev) => [...prev, cardWithUid]);
  }, []);

  const addCredits = useCallback((amount: number) => {
    setCredits((prev) => prev + amount);
  }, []);

  const setWalletName = useCallback((name: string | null) => {
    setWalletNameState(name);
  }, []);

  /**
   * Upgrade a card by consuming duplicates.
   * Cost: N copies needed to go from star N-1 to star N.
   * Each star gives +1 power and +1 damage.
   */
  const upgradeCard = useCallback((cardUid: string, t?: (key: string) => string): { success: boolean; message: string } => {
    const card = collection.find((c) => c.uid === cardUid);
    if (!card) return { success: false, message: t ? t('game.cardNotFound') : 'Card not found' };

    const currentStars = card.stars ?? 0;
    if (currentStars >= MAX_STARS) {
      return { success: false, message: t ? t('game.maxStars') : 'Max star level reached' };
    }

    const copiesNeeded = currentStars === 0 ? 1 : currentStars;
    const duplicates = collection.filter(
      (c) => c.id === card.id && c.uid !== card.uid
    );

    if (duplicates.length < copiesNeeded) {
      return {
        success: false,
        message: t ? t('game.needCopies') : `Need ${copiesNeeded} copies, have ${duplicates.length}`,
      };
    }

    // Remove duplicates from collection
    const uidsToRemove = new Set(duplicates.slice(0, copiesNeeded).map((c) => c.uid));

    setCollection((prev) => {
      const newCollection = prev.filter((c) => !uidsToRemove.has(c.uid));
      return newCollection.map((c) =>
        c.uid === cardUid
          ? { ...c, stars: currentStars + 1, power: c.power + 1, damage: c.damage + 1 }
          : c
      );
    });

    // Update deck if card is there
    setDeck((prev) =>
      prev.map((c) =>
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
    setCredits((prev) => prev + 50);
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
    addCredits,
    upgradeCard,
    setWalletName,
    saveToStorage,
    recordWin,
    recordLoss,
    setWalletAddress,
  };
}
