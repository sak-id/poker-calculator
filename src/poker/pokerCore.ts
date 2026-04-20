export type Player = {
  id: string;
  name: string;
  stack: number;
  committedRound: number;
  committedHand: number;
  folded: boolean;
  allIn: boolean;
};

export type Pot = {
  id: string;
  amount: number;
  eligiblePlayerIds: string[];
};

export type WinnerMap = Record<string, string[]>;
export type StreetCommitments = Record<string, Partial<Record<Street, number>>>;
export type Street = 'Preflop' | 'Flop' | 'Turn' | 'River' | 'Showdown';
export type BettingStreet = Exclude<Street, 'Showdown'>;

export type WinnerPreviewRow = {
  id: string;
  name: string;
  currentStack: number;
  gain: number;
  nextStack: number;
};

export const DEFAULT_STACK = 100;
export const DEFAULT_SMALL_BLIND = 5;
export const DEFAULT_BIG_BLIND = 10;

export const streetOrder: Street[] = ['Preflop', 'Flop', 'Turn', 'River', 'Showdown'];
export const bettingStreetOrder: BettingStreet[] = ['Preflop', 'Flop', 'Turn', 'River'];

export const streetLabelJa: Record<Street, string> = {
  Preflop: 'プリフロップ',
  Flop: 'フロップ',
  Turn: 'ターン',
  River: 'リバー',
  Showdown: 'ショーダウン',
};

export const streetTableLabelJa: Record<BettingStreet, string> = {
  Preflop: '前',
  Flop: 'フロップ',
  Turn: 'ターン',
  River: 'リバー',
};

export const createPlayer = (index: number, stack = DEFAULT_STACK): Player => ({
  id: crypto.randomUUID(),
  name: `Player ${index + 1}`,
  stack,
  committedRound: 0,
  committedHand: 0,
  folded: false,
  allIn: false,
});

export const createInitialPlayers = () => Array.from({ length: 4 }, (_, index) => createPlayer(index));

export function parseChipAmount(raw: string): number {
  if (!raw.trim()) return 0;
  const normalized = raw.replace(/\s+/g, '');
  if (!/^[0-9]+$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

export function buildSidePots(players: Player[]): Pot[] {
  const contributors = players.filter((p) => p.committedHand > 0);
  if (contributors.length === 0) return [];

  const levels = [...new Set(contributors.map((p) => p.committedHand))].sort((a, b) => a - b);
  const pots: Pot[] = [];
  let prev = 0;

  levels.forEach((level) => {
    const inLevel = contributors.filter((p) => p.committedHand >= level);
    const amount = (level - prev) * inLevel.length;
    if (amount > 0) {
      pots.push({
        id: `pot-${prev}-${level}`,
        amount,
        eligiblePlayerIds: inLevel.filter((p) => !p.folded).map((p) => p.id),
      });
    }
    prev = level;
  });

  return pots;
}

export const getCurrentBet = (players: Player[]) => players.reduce((max, player) => Math.max(max, player.committedRound), 0);

export const nextActiveIdAfterIndex = (players: Player[], fromIndex: number) => {
  if (players.length === 0) return '';
  for (let i = 1; i <= players.length; i += 1) {
    const next = players[(fromIndex + i) % players.length];
    if (!next.folded && !next.allIn) return next.id;
  }
  return players[fromIndex]?.id ?? players[0].id;
};

export const nextActiveIdFrom = (players: Player[], fromId: string) => {
  const index = players.findIndex((p) => p.id === fromId);
  if (index === -1) return fromId;
  return nextActiveIdAfterIndex(players, index);
};

export const getBlindSeatIndexes = (playerCount: number) => {
  if (playerCount < 2) return null;
  return {
    dealer: 0,
    smallBlind: playerCount === 2 ? 0 : 1,
    bigBlind: playerCount === 2 ? 1 : 2,
  };
};

export const getSeatLabels = (index: number, playerCount: number) => {
  const seats = getBlindSeatIndexes(playerCount);
  if (!seats) return [];

  const labels: string[] = [];
  if (index === seats.dealer) labels.push('D');
  if (index === seats.smallBlind) labels.push('SB');
  if (index === seats.bigBlind) labels.push('BB');
  return labels;
};

export function calculatePayouts(pots: Pot[], winners: WinnerMap) {
  const payouts = new Map<string, number>();

  for (const pot of pots) {
    const winnersForPot = (winners[pot.id] ?? []).filter((id) => pot.eligiblePlayerIds.includes(id));
    if (winnersForPot.length === 0) continue;

    const share = Math.floor(pot.amount / winnersForPot.length);
    const remainder = pot.amount % winnersForPot.length;

    winnersForPot.forEach((id, index) => {
      const bonus = index < remainder ? 1 : 0;
      payouts.set(id, (payouts.get(id) ?? 0) + share + bonus);
    });
  }

  return payouts;
}

export function calculateWinnerPreview(players: Player[], pots: Pot[], winners: WinnerMap): WinnerPreviewRow[] {
  const payouts = calculatePayouts(pots, winners);

  return players.map((player) => {
    const gain = payouts.get(player.id) ?? 0;
    return {
      id: player.id,
      name: player.name,
      currentStack: player.stack,
      gain,
      nextStack: player.stack + gain,
    };
  });
}
