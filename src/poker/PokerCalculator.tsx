import { GamePanel } from './GamePanel';
import { PlayersPanel } from './PlayersPanel';
import { streetLabelJa } from './pokerCore';
import { usePokerGame } from './usePokerGame';

export function PokerCalculator() {
  const game = usePokerGame();
  const {
    players,
    winners,
    pots,
    currentStreet,
    nextStreet,
    winnerPreview,
    isAdvanceStreetModalOpen,
    isWinnerModalOpen,
    isWinnerConfirmModalOpen,
    setIsAdvanceStreetModalOpen,
    setIsWinnerModalOpen,
    setIsWinnerConfirmModalOpen,
    handleWinnerToggle,
    advanceStreet,
    settleHand,
  } = game;

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900">
      <div className="mx-auto grid max-w-7xl items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1fr)]">
        <PlayersPanel game={game} />
        <GamePanel game={game} />
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
                      .filter((player) => pot.eligiblePlayerIds.includes(player.id))
                      .map((player) => {
                        const selected = (winners[pot.id] ?? []).includes(player.id);
                        return (
                          <button
                            key={player.id}
                            onClick={() => handleWinnerToggle(pot.id, player.id)}
                            className={`flex w-full items-center justify-between border-b border-slate-200 px-3 py-2 text-left text-sm last:border-b-0 ${
                              selected ? 'bg-green-50' : 'bg-white'
                            }`}
                          >
                            <span className="font-medium text-slate-800">{player.name}</span>
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
              <button className="rounded bg-green-700 px-3 py-1 text-sm text-white" onClick={() => setIsWinnerConfirmModalOpen(true)}>
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
              <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={() => setIsWinnerConfirmModalOpen(false)}>
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
