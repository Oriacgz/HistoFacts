import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Coins,
  Zap,
  HelpCircle,
  Loader2,
  X,
} from 'lucide-react';

export default function ShopModal({
  isOpen,
  onClose,
  wallet,
  shopPacks,
  onBuyPack,
  confirmPack,
  onConfirmPurchase,
  onCancelConfirm,
  isPurchasing,
}) {
  return (
    <>
      {/* Main Shop Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-histo-dark/15 rounded-2xl shadow-deep max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Shop Header */}
              <div className="p-5 bg-gradient-to-r from-histo-dark to-histo-medium text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-histo-gold/20 flex items-center justify-center text-histo-gold">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold">Histoins Token Shop</h3>
                    <p className="font-ui text-xs text-histo-cream/80">Exchange Histoins for AI Generation Tokens</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Wallet Balances Banner */}
              <div className="p-4 bg-histo-cream/50 border-b border-histo-dark/10 flex items-center justify-around text-center">
                <div>
                  <span className="font-ui text-[11px] font-semibold text-histo-ink/60 uppercase block">Your Histoins</span>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <Coins className="h-4 w-4 text-amber-500" />
                    <span className="font-display text-lg font-bold text-histo-dark">{wallet.histoin_balance.toLocaleString()} 🪙</span>
                  </div>
                </div>
                <div className="h-8 w-[1px] bg-histo-dark/15" />
                <div>
                  <span className="font-ui text-[11px] font-semibold text-histo-ink/60 uppercase block">Current Tokens</span>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <Zap className="h-4 w-4 text-histo-copper" />
                    <span className="font-display text-lg font-bold text-histo-dark">{wallet.token_balance.toLocaleString()} ⚡</span>
                  </div>
                </div>
              </div>

              {/* Token Packs List */}
              <div className="p-5 overflow-y-auto space-y-3">
                <span className="font-ui text-xs font-bold text-histo-ink/50 uppercase tracking-wider block mb-1">
                  Available Token Packs
                </span>

                {shopPacks.map((pack) => {
                  const canAfford = wallet.histoin_balance >= pack.histoin_cost;
                  return (
                    <div
                      key={pack.id}
                      className="p-4 rounded-xl border border-histo-dark/15 bg-white hover:border-histo-copper transition-all shadow-xs flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-display text-sm font-bold text-histo-dark">{pack.name}</h4>
                          {pack.token_amount >= 350000 && (
                            <span className="text-[10px] font-ui font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                              Best Value
                            </span>
                          )}
                        </div>
                        <p className="font-ui text-xs text-histo-copper font-semibold mt-0.5">
                          +{pack.token_amount.toLocaleString()} Tokens
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onBuyPack(pack)}
                        disabled={!canAfford}
                        className={`px-4 py-2 rounded-lg font-ui text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                          canAfford
                            ? 'bg-histo-copper text-white hover:bg-histo-dark active:scale-95'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                        }`}
                      >
                        <Coins className="h-3.5 w-3.5" />
                        <span>{pack.histoin_cost} 🪙</span>
                      </button>
                    </div>
                  );
                })}

                {/* Info on how to earn Histoins */}
                <div className="p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-xl text-blue-900 mt-4 text-xs font-ui space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <HelpCircle className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>How to Earn Histoins:</span>
                  </div>
                  <p className="text-blue-800/80 leading-relaxed pl-5.5">
                    • <strong>Daily Login:</strong> +10 Histoins every day on first activity.<br />
                    • <strong>History Quizzes:</strong> +20 Histoins for completing quizzes (max 3/day).
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Confirmation Dialog */}
      <AnimatePresence>
        {confirmPack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full border border-histo-dark/15 shadow-deep text-center"
            >
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <Coins className="h-6 w-6" />
              </div>
              <h4 className="font-display text-base font-bold text-histo-dark">Confirm Token Purchase</h4>
              <p className="font-ui text-xs text-histo-ink/70 mt-1 mb-5">
                Spend <strong>{confirmPack.histoin_cost} Histoins</strong> to credit{' '}
                <strong>+{confirmPack.token_amount.toLocaleString()} Tokens</strong>?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onCancelConfirm}
                  disabled={isPurchasing}
                  className="flex-1 py-2 rounded-lg border border-histo-dark/15 text-xs font-ui font-semibold hover:bg-histo-cream transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirmPurchase}
                  disabled={isPurchasing}
                  className="flex-1 py-2 rounded-lg bg-histo-copper text-white text-xs font-ui font-bold hover:bg-histo-dark transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isPurchasing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
