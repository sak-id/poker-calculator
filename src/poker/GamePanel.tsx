import { bettingStreetOrder, streetTableLabelJa } from './pokerCore';
import type { PokerGameState } from './usePokerGame';

const keypad = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', '←'];

type GamePanelProps = {
  game: PokerGameState;
};

export function GamePanel({ game }: GamePanelProps) {
  const {
    players,
    activePlayerId,
    calcInput,
    pots,
    currentStreet,
    middleActionLabel,
    setCalcInput,
    setIsWinnerModalOpen,
    getStreetCommitmentDisplay,
    handleBetRaise,
    handleCheckCallAllIn,
    handleFold,
  } = game;

  return (
    <>
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
              {players.map((player) => {
                const rowTone = player.folded
                  ? 'bg-slate-100 text-slate-400'
                  : player.allIn
                    ? 'bg-amber-50 text-amber-950'
                    : 'bg-white text-slate-800';
                return (
                  <tr key={player.id} className={`border-t border-slate-200 ${rowTone}`}>
                    <th className="truncate px-2 py-2 text-left font-medium">{player.name}</th>
                    {bettingStreetOrder.map((street) => {
                      const currentColumn = street === currentStreet;
                      const activeCell = currentColumn && player.id === activePlayerId && !player.folded && !player.allIn;
                      const cellTone = player.folded
                        ? currentColumn
                          ? 'bg-slate-200'
                          : 'bg-slate-100'
                        : player.allIn
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
                          {getStreetCommitmentDisplay(player, street)}
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
          {keypad.map((key) => (
            <button
              key={key}
              onClick={() => {
                if (key === '←') {
                  setCalcInput((prev) => prev.slice(0, -1));
                  return;
                }
                setCalcInput((prev) => prev + key);
              }}
              className="rounded border border-slate-300 bg-slate-100 p-2 text-sm"
            >
              {key}
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
    </>
  );
}
