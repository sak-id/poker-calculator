import { useMemo, useState } from 'react';

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

type CommitKind = 'call' | 'betOrRaise';
type Street = 'Preflop' | 'Flop' | 'Turn' | 'River' | 'Showdown';

const DEFAULT_STACK = 1000;
const streetOrder: Street[] = ['Preflop', 'Flop', 'Turn', 'River', 'Showdown'];
const streetLabelJa: Record<Street, string> = {
  Preflop: 'プリフロップ',
  Flop: 'フロップ',
  Turn: 'ターン',
  River: 'リバー',
  Showdown: 'ショーダウン',
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
  if (!/^[0-9+\-*/ ().]+$/.test(raw)) return Number.NaN;

  let index = 0;
  const skipWhitespace = () => {
    while (index < raw.length && /\s/.test(raw[index])) index += 1;
  };

  const parseNumber = (): number => {
    skipWhitespace();
    const start = index;
    while (index < raw.length && /[0-9]/.test(raw[index])) index += 1;
    if (start === index) throw new Error('Expected number');
    return Number(raw.slice(start, index));
  };

  const parseFactor = (): number => {
    skipWhitespace();
    if (raw[index] === '(') {
      index += 1;
      const value = parseExpression();
      skipWhitespace();
      if (raw[index] !== ')') throw new Error('Expected closing parenthesis');
      index += 1;
      return value;
    }
    if (raw[index] === '+' || raw[index] === '-') {
      const sign = raw[index] === '-' ? -1 : 1;
      index += 1;
      return sign * parseFactor();
    }
    return parseNumber();
  };

  const parseTerm = (): number => {
    let value = parseFactor();
    while (true) {
      skipWhitespace();
      if (raw[index] === '*') {
        index += 1;
        value *= parseFactor();
      } else if (raw[index] === '/') {
        index += 1;
        const divisor = parseFactor();
        if (divisor === 0) throw new Error('Division by zero');
        value /= divisor;
      } else {
        break;
      }
    }
    return value;
  };

  function parseExpression(): number {
    let value = parseTerm();
    while (true) {
      skipWhitespace();
      if (raw[index] === '+') {
        index += 1;
        value += parseTerm();
      } else if (raw[index] === '-') {
        index += 1;
        value -= parseTerm();
      } else {
        break;
      }
    }
    return value;
  }

  try {
    const value = parseExpression();
    skipWhitespace();
    return index === raw.length ? value : Number.NaN;
  } catch {
    return Number.NaN;
  }
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
  const [logs, setLogs] = useState<string[]>([]);
  const [winners, setWinners] = useState<WinnerMap>({});
  const [streetIndex, setStreetIndex] = useState(0);
  const [actedPlayerIds, setActedPlayerIds] = useState<string[]>([]);

  const evaluatedAmount = useMemo(() => {
    const value = safeEval(calcInput);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : Number.NaN;
  }, [calcInput]);

  const pots = useMemo(() => buildSidePots(players), [players]);
  const totalPot = useMemo(() => players.reduce((sum, p) => sum + p.committedHand, 0), [players]);
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

    let logLabel = '';
    let nextActedPlayerIds = actedPlayerIds.includes(id) ? actedPlayerIds : [...actedPlayerIds, id];
    if (kind === 'call') {
      if (needed === 0) {
        logLabel = 'Check';
      } else if (stackAfter === 0 && committedRoundAfter < betBeforeAction) {
        logLabel = `All-in Call ${committedRoundAfter}`;
      } else {
        logLabel = `Call ${committedRoundAfter}`;
      }
    } else if (kind === 'betOrRaise') {
      if (stackAfter === 0 && committedRoundAfter < safeTarget) {
        logLabel = `All-in ${committedRoundAfter}`;
      } else if (betBeforeAction === 0) {
        logLabel = `Bet ${committedRoundAfter}`;
      } else {
        logLabel = `Raise ${committedRoundAfter}`;
      }
      if (committedRoundAfter > betBeforeAction) {
        nextActedPlayerIds = [id];
      }
    }

    setPlayers(nextPlayers);
    setActivePlayerId(nextActive);
    setCalcInput('');
    setActedPlayerIds(nextActedPlayerIds);
    setLogs((prev) => [...prev, `${actorBefore.name}: ${logLabel}`]);
  };

  const handleFold = () => {
    if (activePlayer.folded || activePlayer.allIn) return;
    const nextPlayers = players.map((p) => (p.id === activePlayer.id ? { ...p, folded: true } : p));
    const nextActive = nextActiveIdFrom(nextPlayers, activePlayer.id);
    setPlayers(nextPlayers);
    setActivePlayerId(nextActive);
    setActedPlayerIds((prev) => (prev.includes(activePlayer.id) ? prev : [...prev, activePlayer.id]));
    setLogs((prev) => [...prev, `${activePlayer.name}: Fold`]);
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
    const fromStreet = currentStreet;
    const toStreet = nextStreet;
    setPlayers((prev) => prev.map((p) => ({ ...p, committedRound: 0 })));
    setStreetIndex((prev) => Math.min(prev + 1, streetOrder.length - 1));
    setActedPlayerIds([]);
    setCalcInput('');
    setLogs((prev) => [...prev, `--- ${fromStreet} -> ${toStreet} ---`]);
  };

  const handleCheckCallAllIn = () => {
    commitToAmount(activePlayer.id, currentBet, 'call');
  };

  const amountToCall = Math.max(0, currentBet - activePlayer.committedRound);
  const middleActionLabel = amountToCall === 0 ? 'Check' : amountToCall >= activePlayer.stack ? 'All-in' : 'Call';

  const handleWinnerToggle = (potId: string, playerId: string) => {
    setWinners((prev) => {
      const existing = prev[potId] ?? [];
      const next = existing.includes(playerId)
        ? existing.filter((x) => x !== playerId)
        : [...existing, playerId];
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
    setStreetIndex(0);
    setActedPlayerIds([]);
    setLogs((prev) => [...prev, '--- Hand settled ---']);
  };

  const resetHand = () => {
    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        stack: p.stack + p.committedHand,
        committedRound: 0,
        committedHand: 0,
        folded: false,
        allIn: false,
      })),
    );
    setWinners({});
    setCalcInput('');
    setStreetIndex(0);
    setActedPlayerIds([]);
    setLogs((prev) => [...prev, '--- Hand reset (refund committed chips) ---']);
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
    setPlayers((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((p) => p.id !== id);
      setWinners((winnerMap) =>
        Object.fromEntries(
          Object.entries(winnerMap).map(([potId, winnerIds]) => [potId, winnerIds.filter((winnerId) => winnerId !== id)]),
        ),
      );

      if (activePlayerId === id && next.length > 0) {
        setActivePlayerId(next[0].id);
      }
      return next;
    });
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

        <section className="space-y-4 rounded-xl bg-white p-4 shadow">
          <h2 className="text-lg font-semibold">Pot & Showdown</h2>
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm">Street: {streetLabelJa[currentStreet]}</p>
            <p className="text-sm">Current Bet: {currentBet}</p>
            <p className="text-sm font-medium">Total Pot: {totalPot}</p>
          </div>

          {canAdvanceStreet && (
            <div className="rounded border border-blue-300 bg-blue-50 p-3">
              <p className="text-sm font-medium">次: {streetLabelJa[nextStreet]}</p>
              <button className="mt-2 rounded bg-blue-700 px-3 py-1 text-sm text-white" onClick={advanceStreet}>
                OK
              </button>
            </div>
          )}

          <div className="space-y-2">
            {pots.length === 0 && <p className="text-sm text-slate-500">ポットはまだありません。</p>}
            {pots.map((pot) => (
              <div key={pot.id} className="rounded border border-slate-200 p-2">
                <p className="text-sm font-medium">
                  {pot.id} - {pot.amount}
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {players
                    .filter((p) => pot.eligiblePlayerIds.includes(p.id))
                    .map((p) => {
                      const selected = (winners[pot.id] ?? []).includes(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleWinnerToggle(pot.id, p.id)}
                          className={`rounded px-2 py-1 text-xs ${selected ? 'bg-green-600 text-white' : 'bg-slate-200'}`}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="rounded bg-green-600 px-3 py-1 text-white" onClick={settleHand}>
              Settle Hand
            </button>
            <button className="rounded bg-slate-700 px-3 py-1 text-white" onClick={resetHand}>
              Reset Hand
            </button>
          </div>

          <div className="rounded border border-slate-200 p-2">
            <h3 className="mb-1 text-sm font-semibold">Action Log</h3>
            <div className="max-h-48 space-y-1 overflow-auto text-xs">
              {logs.map((log, i) => (
                <p key={`${log}-${i}`}>{log}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-white p-4 shadow">
          <h2 className="mb-2 text-lg font-semibold">Calculator / Action</h2>
          <p className="mb-2 text-sm text-slate-600">Active: {activePlayer?.name}</p>

          <div className="mb-2 rounded border border-slate-300 bg-slate-50 p-3">
            <p className="truncate text-sm">{calcInput || '0'}</p>
            <p className="text-lg font-semibold">= {Number.isFinite(evaluatedAmount) ? evaluatedAmount : 'ERR'}</p>
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

          <div className="mb-3 grid grid-cols-4 gap-2">
            {['+', '-', '*', '/'].map((op) => (
              <button
                key={op}
                onClick={() => setCalcInput((prev) => prev + op)}
                className="rounded border border-slate-300 bg-slate-100 p-2"
              >
                {op}
              </button>
            ))}
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <button className="rounded border bg-slate-100 p-2" onClick={() => setCalcInput(String(Math.floor(totalPot / 2)))}>
              1/2 Pot
            </button>
            <button className="rounded border bg-slate-100 p-2" onClick={() => setCalcInput(String(Math.floor((totalPot * 2) / 3)))}>
              2/3 Pot
            </button>
            <button className="rounded border bg-slate-100 p-2" onClick={() => setCalcInput(String(totalPot))}>
              Pot
            </button>
            <button
              className="rounded border bg-slate-100 p-2"
              onClick={() => setCalcInput(String(activePlayer.committedRound + activePlayer.stack))}
            >
              All-in Amt
            </button>
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
    </main>
  );
}

export default App;
