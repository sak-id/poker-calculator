import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_BIG_BLIND,
  DEFAULT_SMALL_BLIND,
  buildSidePots,
  calculatePayouts,
  calculateWinnerPreview,
  createInitialPlayers,
  createPlayer,
  getBlindSeatIndexes,
  getCurrentBet,
  nextActiveIdAfterIndex,
  nextActiveIdFrom,
  parseChipAmount,
  streetOrder,
} from './pokerCore';
import type { Player, Street, StreetCommitments, WinnerMap } from './pokerCore';

type CommitKind = 'call' | 'betOrRaise';

export function usePokerGame() {
  const [players, setPlayers] = useState<Player[]>(() => createInitialPlayers());
  const [activePlayerId, setActivePlayerId] = useState(() => players[0].id);
  const [isPlayersCollapsed, setIsPlayersCollapsed] = useState(false);
  const [calcInput, setCalcInput] = useState('');
  const [winners, setWinners] = useState<WinnerMap>({});
  const [streetCommitments, setStreetCommitments] = useState<StreetCommitments>({});
  const [isAdvanceStreetModalOpen, setIsAdvanceStreetModalOpen] = useState(false);
  const [isWinnerModalOpen, setIsWinnerModalOpen] = useState(false);
  const [isWinnerConfirmModalOpen, setIsWinnerConfirmModalOpen] = useState(false);
  const [streetIndex, setStreetIndex] = useState(0);
  const [actedPlayerIds, setActedPlayerIds] = useState<string[]>([]);
  const [lastAdvancePromptKey, setLastAdvancePromptKey] = useState('');
  const [smallBlind, setSmallBlind] = useState(DEFAULT_SMALL_BLIND);
  const [bigBlind, setBigBlind] = useState(DEFAULT_BIG_BLIND);

  const evaluatedAmount = useMemo(() => {
    const value = parseChipAmount(calcInput);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : Number.NaN;
  }, [calcInput]);

  const pots = useMemo(() => buildSidePots(players), [players]);
  const currentBet = useMemo(() => getCurrentBet(players), [players]);
  const activePlayer = players.find((p) => p.id === activePlayerId) ?? players[0];
  const currentStreet = streetOrder[streetIndex];
  const nextStreet = streetOrder[Math.min(streetIndex + 1, streetOrder.length - 1)];
  const activeNotAllInPlayers = players.filter((p) => !p.folded && !p.allIn);
  const activeNotAllInPlayerIds = activeNotAllInPlayers.map((p) => p.id);
  const isRoundBalanced =
    activeNotAllInPlayers.length <= 1 ||
    activeNotAllInPlayers.every((p) => p.committedRound === activeNotAllInPlayers[0].committedRound);
  const allActionablePlayersActed = activeNotAllInPlayerIds.every((id) => actedPlayerIds.includes(id));
  const canAdvanceStreet = allActionablePlayersActed && isRoundBalanced && streetIndex < streetOrder.length - 1;
  const canPostBlinds = currentStreet === 'Preflop' && players.length >= 2 && players.every((p) => p.committedHand === 0);
  const blindSeatIndexes = getBlindSeatIndexes(players.length);

  const advancePromptKey = useMemo(
    () =>
      [
        streetIndex,
        actedPlayerIds.slice().sort().join(','),
        players.map((p) => `${p.id}:${p.committedRound}:${p.folded ? 'f' : '-'}:${p.allIn ? 'a' : '-'}`).join('|'),
      ].join('::'),
    [actedPlayerIds, players, streetIndex],
  );

  const winnerPreview = useMemo(() => calculateWinnerPreview(players, pots, winners), [players, pots, winners]);

  useEffect(() => {
    if (!canAdvanceStreet || currentStreet === 'Showdown' || lastAdvancePromptKey === advancePromptKey) return;
    setLastAdvancePromptKey(advancePromptKey);
    setIsAdvanceStreetModalOpen(true);
  }, [advancePromptKey, canAdvanceStreet, currentStreet, lastAdvancePromptKey]);

  const patchPlayer = (id: string, updater: (p: Player) => Player) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));
  };

  const commitToAmount = (id: string, targetCommittedRound: number, kind: CommitKind) => {
    const actorBefore = players.find((p) => p.id === id);
    if (!actorBefore || actorBefore.folded) return;

    const safeTarget = Math.max(0, targetCommittedRound);
    const needed = Math.max(0, safeTarget - actorBefore.committedRound);
    const putIn = Math.min(needed, actorBefore.stack);
    const committedRoundAfter = actorBefore.committedRound + putIn;
    const committedHandAfter = actorBefore.committedHand + putIn;
    const stackAfter = actorBefore.stack - putIn;

    const nextPlayers = players.map((p) =>
      p.id === id
        ? {
            ...p,
            committedRound: committedRoundAfter,
            committedHand: committedHandAfter,
            stack: stackAfter,
            allIn: stackAfter === 0,
          }
        : p,
    );
    const nextActive = nextActiveIdFrom(nextPlayers, id);
    const betBeforeAction = getCurrentBet(players);

    let nextActedPlayerIds = actedPlayerIds.includes(id) ? actedPlayerIds : [...actedPlayerIds, id];
    if (kind === 'betOrRaise' && committedRoundAfter > betBeforeAction) {
      nextActedPlayerIds = [id];
    }

    setPlayers(nextPlayers);
    setActivePlayerId(nextActive);
    setCalcInput('');
    setActedPlayerIds(nextActedPlayerIds);
    setStreetCommitments((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? {}),
        [currentStreet]: committedRoundAfter,
      },
    }));
  };

  const handleFold = () => {
    if (activePlayer.folded || activePlayer.allIn) return;
    const nextPlayers = players.map((p) => (p.id === activePlayer.id ? { ...p, folded: true } : p));
    const nextActive = nextActiveIdFrom(nextPlayers, activePlayer.id);
    setPlayers(nextPlayers);
    setActivePlayerId(nextActive);
    setActedPlayerIds((prev) => (prev.includes(activePlayer.id) ? prev : [...prev, activePlayer.id]));
    setStreetCommitments((prev) => ({
      ...prev,
      [activePlayer.id]: {
        ...(prev[activePlayer.id] ?? {}),
        [currentStreet]: activePlayer.committedRound,
      },
    }));
  };

  const handleBetRaise = () => {
    if (!Number.isFinite(evaluatedAmount) || evaluatedAmount <= 0) return;
    if (evaluatedAmount < currentBet) return;
    commitToAmount(activePlayer.id, evaluatedAmount, evaluatedAmount === currentBet ? 'call' : 'betOrRaise');
  };

  const advanceStreet = () => {
    if (!canAdvanceStreet) return;
    setStreetCommitments((prev) => {
      const nextCommitments: StreetCommitments = { ...prev };
      players.forEach((p) => {
        nextCommitments[p.id] = {
          ...(nextCommitments[p.id] ?? {}),
          [currentStreet]: p.committedRound,
        };
      });
      return nextCommitments;
    });
    const nextPlayers = players.map((p) => ({ ...p, committedRound: 0 }));
    setPlayers(nextPlayers);
    setActivePlayerId(nextActiveIdAfterIndex(nextPlayers, 0));
    setStreetIndex((prev) => Math.min(prev + 1, streetOrder.length - 1));
    setActedPlayerIds([]);
    setCalcInput('');
  };

  const postBlinds = () => {
    if (!canPostBlinds || !blindSeatIndexes) return;
    const smallBlindPlayer = players[blindSeatIndexes.smallBlind];
    const bigBlindPlayer = players[blindSeatIndexes.bigBlind];
    const blindByPlayerId = new Map([
      [smallBlindPlayer.id, smallBlind],
      [bigBlindPlayer.id, bigBlind],
    ]);

    const nextPlayers = players.map((p) => {
      const blind = blindByPlayerId.get(p.id);
      if (blind === undefined) return p;
      const putIn = Math.min(Math.max(0, blind), p.stack);
      const stackAfter = p.stack - putIn;
      return {
        ...p,
        stack: stackAfter,
        committedRound: putIn,
        committedHand: putIn,
        allIn: stackAfter === 0,
      };
    });

    setPlayers(nextPlayers);
    setStreetCommitments((prev) => ({
      ...prev,
      [smallBlindPlayer.id]: {
        ...(prev[smallBlindPlayer.id] ?? {}),
        Preflop: Math.min(Math.max(0, smallBlind), smallBlindPlayer.stack),
      },
      [bigBlindPlayer.id]: {
        ...(prev[bigBlindPlayer.id] ?? {}),
        Preflop: Math.min(Math.max(0, bigBlind), bigBlindPlayer.stack),
      },
    }));
    setActivePlayerId(nextActiveIdFrom(nextPlayers, bigBlindPlayer.id));
    setActedPlayerIds([]);
    setCalcInput('');
  };

  const handleCheckCallAllIn = () => {
    commitToAmount(activePlayer.id, currentBet, 'call');
  };

  const amountToCall = Math.max(0, currentBet - activePlayer.committedRound);
  const middleActionLabel = amountToCall === 0 ? 'Check' : amountToCall >= activePlayer.stack ? 'All-in' : 'Call';

  const handleWinnerToggle = (potId: string, playerId: string) => {
    if (currentStreet !== 'Showdown') return;
    const target = players.find((p) => p.id === playerId);
    if (!target || target.folded) return;
    setWinners((prev) => {
      const existing = prev[potId] ?? [];
      const next = existing.includes(playerId) ? existing.filter((x) => x !== playerId) : [...existing, playerId];
      return { ...prev, [potId]: next };
    });
  };

  const settleHand = () => {
    const payouts = calculatePayouts(pots, winners);

    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        stack: p.stack + (payouts.get(p.id) ?? 0),
        committedRound: 0,
        committedHand: 0,
        folded: false,
        allIn: false,
      })),
    );

    setCalcInput('');
    setWinners({});
    setIsWinnerModalOpen(false);
    setIsWinnerConfirmModalOpen(false);
    setIsAdvanceStreetModalOpen(false);
    setStreetIndex(0);
    setActedPlayerIds([]);
    setStreetCommitments({});
  };

  const addPlayer = () => {
    setPlayers((prev) => [...prev, createPlayer(prev.length)]);
  };

  const movePlayer = (id: string, direction: -1 | 1) => {
    setPlayers((prev) => {
      const fromIndex = prev.findIndex((p) => p.id === id);
      const toIndex = fromIndex + direction;
      if (fromIndex === -1 || toIndex < 0 || toIndex >= prev.length) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const removePlayer = (id: string) => {
    if (players.length <= 1) return;
    const next = players.filter((p) => p.id !== id);
    setPlayers(next);
    setWinners((winnerMap) =>
      Object.fromEntries(
        Object.entries(winnerMap).map(([potId, winnerIds]) => [potId, winnerIds.filter((winnerId) => winnerId !== id)]),
      ),
    );
    setStreetCommitments((prev) => {
      const nextCommitments = { ...prev };
      delete nextCommitments[id];
      return nextCommitments;
    });

    if (activePlayerId === id && next.length > 0) {
      setActivePlayerId(next[0].id);
    }
  };

  const getStreetCommitmentDisplay = (player: Player, street: Street) => {
    if (street === 'Showdown') return '-';
    const targetStreetIndex = streetOrder.indexOf(street);
    if (targetStreetIndex > streetIndex) return '-';
    if (targetStreetIndex === streetIndex) return String(player.committedRound);
    const committed = streetCommitments[player.id]?.[street];
    return committed === undefined ? '-' : String(committed);
  };

  return {
    players,
    activePlayerId,
    isPlayersCollapsed,
    calcInput,
    winners,
    isAdvanceStreetModalOpen,
    isWinnerModalOpen,
    isWinnerConfirmModalOpen,
    smallBlind,
    bigBlind,
    pots,
    currentStreet,
    nextStreet,
    canPostBlinds,
    winnerPreview,
    middleActionLabel,
    setActivePlayerId,
    setIsPlayersCollapsed,
    setCalcInput,
    setIsAdvanceStreetModalOpen,
    setIsWinnerModalOpen,
    setIsWinnerConfirmModalOpen,
    setSmallBlind,
    setBigBlind,
    patchPlayer,
    handleFold,
    handleBetRaise,
    handleCheckCallAllIn,
    advanceStreet,
    postBlinds,
    handleWinnerToggle,
    settleHand,
    addPlayer,
    movePlayer,
    removePlayer,
    getStreetCommitmentDisplay,
  };
}

export type PokerGameState = ReturnType<typeof usePokerGame>;
