import { getSeatLabels } from './pokerCore';
import type { PokerGameState } from './usePokerGame';

type PlayersPanelProps = {
  game: PokerGameState;
};

export function PlayersPanel({ game }: PlayersPanelProps) {
  const {
    players,
    activePlayerId,
    isPlayersCollapsed,
    smallBlind,
    bigBlind,
    canPostBlinds,
    setIsPlayersCollapsed,
    setSmallBlind,
    setBigBlind,
    patchPlayer,
    postBlinds,
    addPlayer,
    movePlayer,
    removePlayer,
    setActivePlayerId,
  } = game;

  return (
    <section className="min-w-0 rounded-xl bg-white p-4 shadow">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Players</h2>
        <div className="flex items-center gap-2">
          <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={() => setIsPlayersCollapsed((prev) => !prev)}>
            {isPlayersCollapsed ? 'Expand' : 'Collapse'}
          </button>
          <button className="rounded bg-slate-900 px-3 py-1 text-sm text-white" onClick={addPlayer}>
            + Add
          </button>
        </div>
      </div>
      <div className="mb-3 grid grid-cols-[1fr_1fr_auto] gap-2 text-sm">
        <label className="grid gap-1">
          <span className="text-xs font-medium text-slate-500">SB</span>
          <input
            aria-label="Small blind"
            type="number"
            min={0}
            value={smallBlind}
            onChange={(e) => setSmallBlind(Math.max(0, Number(e.target.value || 0)))}
            className="min-w-0 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-medium text-slate-500">BB</span>
          <input
            aria-label="Big blind"
            type="number"
            min={0}
            value={bigBlind}
            onChange={(e) => setBigBlind(Math.max(0, Number(e.target.value || 0)))}
            className="min-w-0 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <button
          className="self-end rounded bg-slate-900 px-3 py-1 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
          onClick={postBlinds}
          disabled={!canPostBlinds}
        >
          Blinds
        </button>
      </div>
      {!isPlayersCollapsed && (
        <div className="space-y-2">
          {players.map((player, index) => {
            const active = player.id === activePlayerId;
            const seatLabels = getSeatLabels(index, players.length);
            return (
              <div
                key={player.id}
                className={`rounded border p-2 ${active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}
              >
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                  <input
                    aria-label={`${player.name} name`}
                    value={player.name}
                    onChange={(e) => patchPlayer(player.id, (current) => ({ ...current, name: e.target.value }))}
                    className="min-w-0 rounded border px-2 py-1"
                  />
                  <span className="text-xs text-slate-500">Stack</span>
                  <input
                    aria-label={`${player.name} stack`}
                    type="number"
                    min={0}
                    value={player.stack}
                    onChange={(e) =>
                      patchPlayer(player.id, (current) => ({ ...current, stack: Math.max(0, Number(e.target.value || 0)) }))
                    }
                    className="w-24 rounded border px-2 py-1"
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  {seatLabels.map((label) => (
                    <span key={label} className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                      {label}
                    </span>
                  ))}
                  <span>Committed: {player.committedHand}</span>
                  {player.folded && <span className="rounded bg-slate-200 px-2 py-0.5">Fold</span>}
                  {player.allIn && <span className="rounded bg-amber-200 px-2 py-0.5">All-in</span>}
                  <button
                    onClick={() => removePlayer(player.id)}
                    disabled={players.length <= 1}
                    className="ml-auto rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => movePlayer(player.id, -1)}
                    disabled={index === 0}
                    className="rounded border px-2 py-0.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Move ${player.name} up`}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => movePlayer(player.id, 1)}
                    disabled={index === players.length - 1}
                    className="rounded border px-2 py-0.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Move ${player.name} down`}
                  >
                    ↓
                  </button>
                  <button onClick={() => setActivePlayerId(player.id)} className="rounded border px-2 py-0.5 text-xs">
                    Select
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
