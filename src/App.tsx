import { useEffect, useMemo, useState } from 'react';

type Player = {
  id: string;
  name: string;
  stack: number;
  committedRound: number;
  committedHand: number;
  folded: boolean;
  allIn: boolean;
};

type Pot = {
  id: string;
  amount: number;
  eligiblePlayerIds: string[];
};

type WinnerMap = Record<string, string[]>;
type StreetCommitments = Record<string, Partial<Record<Street, number>>>;

type CommitKind = 'call' | 'betOrRaise';
type Street = 'Preflop' | 'Flop' | 'Turn' | 'River' | 'Showdown';
type BettingStreet = Exclude<Street, 'Showdown'>;

const DEFAULT_STACK = 1000;
const streetOrder: Street[] = ['Preflop', 'Flop', 'Turn', 'River', 'Showdown'];
const bettingStreetOrder: BettingStreet[] = ['Preflop', 'Flop', 'Turn', 'River'];
const streetLabelJa: Record<Street, string> = {
  Preflop: 'プリフロップ',
  Flop: 'フロップ',
  Turn: 'ターン',
  River: 'リバー',
  Showdown: 'ショーダウン',
};
const streetTableLabelJa: Record<BettingStreet, string> = {
  Preflop: '前',
  Flop: 'フロップ',
  Turn: 'ターン',
  River: 'リバー',
};

const initialPlayers = Array.from({ length: 4 }, (_, i) => ({
  id: crypto.randomUUID(),
  name: `Player ${i + 1}`,
  stack: DEFAULT_STACK,
  committedRound: 0,
  committedHand: 0,
  folded: false,
  allIn: false,
}));

const keypad = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', '←'];

function safeEval(raw: string): number {
  if (!raw.trim()) return 0;
  const normalized = raw.replace(/\s+/g, '');
  if (!/^[0-9]+$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

function buildSidePots(players: Player[]): Pot[] {
  const contributors = players.filter((p) => p.committedHand > 0);
  if (contributors.length === 0) return [];

  const levels = [...new Set(contributors.map((p) => p.committedHand))].sort((a, b) => a - b);
  const pots: Pot[] = [];
  let prev = 0;

  levels.forEach((level) => {
    const inLevel = contributors.filter((p) => p.committedHand >= level);
    const amount = (level - prev) * inLevel.length;
    if (amount > 0) {
      const eligiblePlayerIds = inLevel.filter((p) => !p.folded).map((p) => p.id);
      pots.push({
        id: `pot-${prev}-${level}`,
        amount,
        eligiblePlayerIds,
      });
    }
    prev = level;
  });

  return pots;
}

const getCurrentBet = (players: Player[]) => players.reduce((m, p) => Math.max(m, p.committedRound), 0);

const nextActiveIdFrom = (players: Player[], fromId: string) => {
  const idx = players.findIndex((p) => p.id === fromId);
  if (idx === -1) return fromId;
  for (let i = 1; i <= players.length; i += 1) {
    const next = players[(idx + i) % players.length];
    if (!next.folded && !next.allIn) return next.id;
  }
  return fromId;
};

function App() {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [activePlayerId, setActivePlayerId] = useState<string>(initialPlayers[0].id);
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

  const evaluatedAmount = useMemo(() => {
    const value = safeEval(calcInput);
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
  const advancePromptKey = useMemo(
    () =>
      [
        streetIndex,
        actedPlayerIds.slice().sort().join(','),
        players.map((p) => `${p.id}:${p.committedRound}:${p.folded ? 'f' : '-'}:${p.allIn ? 'a' : '-'}`).join('|'),
      ].join('::'),
    [actedPlayerIds, players, streetIndex],
  );
  const winnerPreview = useMemo(() => {
    const payouts = new Map<string, number>();

    for (const pot of pots) {
      const winnersForPot = (winners[pot.id] ?? []).filter((id) => pot.eligiblePlayerIds.includes(id));
      if (winnersForPot.length === 0) continue;

      const share = Math.floor(pot.amount / winnersForPot.length);
      const remainder = pot.amount % winnersForPot.length;

      winnersForPot.forEach((id, index) => {
        const current = payouts.get(id) ?? 0;
        const bonus = index < remainder ? 1 : 0;
        payouts.set(id, current + share + bonus);
      });
    }

    return players.map((p) => ({
      id: p.id,
      name: p.name,
      currentStack: p.stack,
      gain: payouts.get(p.id) ?? 0,
      nextStack: p.stack + (payouts.get(p.id) ?? 0),
    }));
  }, [players, pots, winners]);

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

  const handleCall = () => {
    commitToAmount(activePlayer.id, currentBet, 'call');
  };

  const handleBetRaise = () => {
    if (!Number.isFinite(evaluatedAmount) || evaluatedAmount <= 0) return;
    if (evaluatedAmount < currentBet) return;
    if (evaluatedAmount === currentBet) {
      handleCall();
      return;
    }
    commitToAmount(activePlayer.id, evaluatedAmount, 'betOrRaise');
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
    setPlayers((prev) => prev.map((p) => ({ ...p, committedRound: 0 })));
    setStreetIndex((prev) => Math.min(prev + 1, streetOrder.length - 1));
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
    const payouts = new Map<string, number>();

    for (const pot of pots) {
      const winnersForPot = (winners[pot.id] ?? []).filter((id) => pot.eligiblePlayerIds.includes(id));
      if (winnersForPot.length === 0) continue;
      const share = Math.floor(pot.amount / winnersForPot.length);
      const remainder = pot.amount % winnersForPot.length;

      winnersForPot.forEach((id, index) => {
        const current = payouts.get(id) ?? 0;
        const bonus = index < remainder ? 1 : 0;
        payouts.set(id, current + share + bonus);
      });
    }

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
    setPlayers((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `Player ${prev.length + 1}`,
        stack: DEFAULT_STACK,
        committedRound: 0,
        committedHand: 0,
        folded: false,
        allIn: false,
      },
    ]);
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

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1.2fr_0.9fr_1fr]">
        <section className="rounded-xl bg-white p-4 shadow">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Players</h2>
            <div className="flex items-center gap-2">
              <button
                className="rounded border border-slate-300 px-3 py-1 text-sm"
                onClick={() => setIsPlayersCollapsed((prev) => !prev)}
              >
                {isPlayersCollapsed ? 'Expand' : 'Collapse'}
              </button>
              <button className="rounded bg-slate-900 px-3 py-1 text-sm text-white" onClick={addPlayer}>
                + Add
              </button>
            </div>
          </div>
          {!isPlayersCollapsed && (
            <div className="space-y-2">
              {players.map((p) => {
                const active = p.id === activePlayerId;
                return (
                  <div
                    key={p.id}
                    className={`rounded border p-2 ${active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}
                  >
                    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                      <input
                        aria-label={`${p.name} name`}
                        value={p.name}
                        onChange={(e) => patchPlayer(p.id, (x) => ({ ...x, name: e.target.value }))}
                        className="rounded border px-2 py-1"
                      />
                      <span className="text-xs text-slate-500">Stack</span>
                      <input
                        aria-label={`${p.name} stack`}
                        type="number"
                        min={0}
                        value={p.stack}
                        onChange={(e) =>
                          patchPlayer(p.id, (x) => ({ ...x, stack: Math.max(0, Number(e.target.value || 0)) }))
                        }
                        className="w-24 rounded border px-2 py-1"
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span>Committed: {p.committedHand}</span>
                      {p.folded && <span className="rounded bg-slate-200 px-2 py-0.5">Fold</span>}
                      {p.allIn && <span className="rounded bg-amber-200 px-2 py-0.5">All-in</span>}
                      <button
                        onClick={() => removePlayer(p.id)}
                        disabled={players.length <= 1}
                        className="ml-auto rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Delete
                      </button>
                      <button onClick={() => setActivePlayerId(p.id)} className="rounded border px-2 py-0.5 text-xs">
                        Select
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-xl bg-white p-4 shadow">
          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="w-full min-w-[420px] table-fixed border-collapse text-xs">
              <colgroup>
                <col style={{ width: '28%' }} />
                {bettingStreetOrder.map((street) => (
                  <col key={street} style={{ width: '18%' }} />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-slate-100 text-slate-600">
                  <th className="px-2 py-2 text-left font-semibold">名前</th>
                  {bettingStreetOrder.map((street) => (
                    <th
                      key={street}
                      className={`px-2 py-2 text-center font-semibold ${
                        street === currentStreet ? 'bg-blue-100 text-blue-800' : ''
                      }`}
                    >
                      {streetTableLabelJa[street]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((p) => {
                  const rowTone = p.folded
                    ? 'bg-slate-100 text-slate-400'
                    : p.allIn
                      ? 'bg-amber-50 text-amber-950'
                      : 'bg-white text-slate-800';
                  return (
                    <tr key={p.id} className={`border-t border-slate-200 ${rowTone}`}>
                      <th className="truncate px-2 py-2 text-left font-medium">{p.name}</th>
                      {bettingStreetOrder.map((street) => {
                        const currentColumn = street === currentStreet;
                        const activeCell = currentColumn && p.id === activePlayerId && !p.folded && !p.allIn;
                        const cellTone = p.folded
                          ? currentColumn
                            ? 'bg-slate-200'
                            : 'bg-slate-100'
                          : p.allIn
                            ? currentColumn
                              ? 'bg-amber-100'
                              : 'bg-amber-50'
                            : currentColumn
                              ? 'bg-blue-50 text-blue-900'
                              : 'bg-white';

                        return (
                          <td
                            key={street}
                            className={`border-l border-slate-200 px-2 py-2 text-center font-mono tabular-nums ${cellTone} ${
                              activeCell ? 'bg-blue-100 font-semibold ring-2 ring-inset ring-blue-500' : ''
                            }`}
                          >
                            {getStreetCommitmentDisplay(p, street)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-1">
            {pots.length === 0 && <p className="text-sm text-slate-500">ポットはまだありません。</p>}
            {pots.map((pot, index) => (
              <div key={pot.id} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1 text-sm">
                <span className="font-medium text-slate-700">{index === 0 ? 'Main pot' : `Side pot ${index}`}</span>
                <span className="font-semibold">{pot.amount}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {currentStreet === 'Showdown' && (
              <button className="rounded bg-green-600 px-3 py-1 text-white" onClick={() => setIsWinnerModalOpen(true)}>
                勝者を選択
              </button>
            )}
          </div>
        </section>

        <section className="rounded-xl bg-white p-4 shadow">
          <div className="mb-2 rounded border border-slate-300 bg-slate-50 p-3">
            <p className="truncate text-sm">{calcInput || '0'}</p>
          </div>

          <div className="mb-2 grid grid-cols-3 gap-2">
            {keypad.map((k) => (
              <button
                key={k}
                onClick={() => {
                  if (k === '←') {
                    setCalcInput((prev) => prev.slice(0, -1));
                    return;
                  }
                  setCalcInput((prev) => prev + k);
                }}
                className="rounded border border-slate-300 bg-slate-100 p-2 text-sm"
              >
                {k}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button className="rounded bg-indigo-700 p-2 text-white" onClick={handleBetRaise}>
              Bet / Raise
            </button>
            <button className="rounded bg-blue-700 p-2 text-white" onClick={handleCheckCallAllIn}>
              {middleActionLabel}
            </button>
            <button className="rounded bg-slate-700 p-2 text-white" onClick={handleFold}>
              Fold
            </button>
          </div>
        </section>
      </div>

      {isAdvanceStreetModalOpen && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold">次のストリートへ進みますか？</h3>
            <p className="mt-2 text-sm text-slate-700">
              {streetLabelJa[currentStreet]} → {streetLabelJa[nextStreet]}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={() => setIsAdvanceStreetModalOpen(false)}>
                キャンセル
              </button>
              <button
                className="rounded bg-blue-700 px-3 py-1 text-sm text-white"
                onClick={() => {
                  advanceStreet();
                  setIsAdvanceStreetModalOpen(false);
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {isWinnerModalOpen && currentStreet === 'Showdown' && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold">勝者選択</h3>
            <div className="mt-3 space-y-3">
              <p className="text-sm text-slate-700">ポットごとに勝者をリスト形式で選択します。</p>
              {pots.map((pot) => (
                <div key={pot.id} className="rounded border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-800">
                    {pot.id} - {pot.amount}
                  </p>
                  <div className="mt-2 overflow-hidden rounded border border-slate-200">
                    {players
                      .filter((p) => pot.eligiblePlayerIds.includes(p.id))
                      .map((p) => {
                        const selected = (winners[pot.id] ?? []).includes(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => handleWinnerToggle(pot.id, p.id)}
                            className={`flex w-full items-center justify-between border-b border-slate-200 px-3 py-2 text-left text-sm last:border-b-0 ${
                              selected ? 'bg-green-50' : 'bg-white'
                            }`}
                          >
                            <span className="font-medium text-slate-800">{p.name}</span>
                            <span
                              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                                selected ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {selected ? '選択中' : '未選択'}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={() => setIsWinnerModalOpen(false)}>
                キャンセル
              </button>
              <button
                className="rounded bg-green-700 px-3 py-1 text-sm text-white"
                onClick={() => setIsWinnerConfirmModalOpen(true)}
              >
                一覧確認へ
              </button>
            </div>
          </div>
        </div>
      )}

      {isWinnerConfirmModalOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold">これであってる？</h3>
            <div className="mt-3 space-y-1 text-sm">
              {winnerPreview.map((row) => (
                <p key={row.id}>
                  {row.name}: +{row.gain} ({row.currentStack} → {row.nextStack})
                </p>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded border border-slate-300 px-3 py-1 text-sm"
                onClick={() => setIsWinnerConfirmModalOpen(false)}
              >
                戻る
              </button>
              <button className="rounded bg-green-700 px-3 py-1 text-sm text-white" onClick={settleHand}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
