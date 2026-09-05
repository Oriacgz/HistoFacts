import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Coins,
  Zap,
  HelpCircle,
  Loader2,
  X,
} from 'lucide-react';

function StatChip({ icon, label, value, accent }) {
  return (
    <div className={`flex-1 rounded-xl border p-3 ${accent === "amber" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        {icon}
        <span className="text-xl font-bold text-slate-800">{value}</span>
      </div>
    </div>
  );
}

function PackCard({ pack, featured, onClick, disabled }) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-5 transition-all duration-150 hover:shadow-lg hover:-translate-y-0.5
        ${featured
          ? "border-amber-300 ring-1 ring-amber-300 bg-amber-50/40"
          : "border-gray-200 bg-white"}`}
    >
      {featured && (
        <span className="absolute -top-3 left-4 rounded-full bg-amber-400 px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
          Best Value
        </span>
      )}
      <h3 className="text-base font-semibold text-slate-800">{pack.name}</h3>
      <p className="mt-1 text-2xl font-bold text-blue-600">+{pack.token_amount.toLocaleString()}</p>
      <p className="mb-4 text-xs text-slate-500">tokens</p>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`mt-auto flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2.5 font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <Coins className="h-4 w-4" />
        {pack.histoin_cost}
      </button>
    </div>
  );
}

function EarnHistoinsDisclosure() {
  return (
    <details className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
      <summary className="cursor-pointer font-medium text-slate-600">How to earn Histoins</summary>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        <li>Daily login: +10 Histoins on first activity each day</li>
        <li>History quizzes: +20 Histoins per quiz (max 3/day)</li>
      </ul>
    </details>
  );
}

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
              className="bg-white border border-histo-dark/15 rounded-2xl shadow-deep max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Shop Header - UNCHANGED */}
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

              {/* Stats Bar — two distinct chips */}
              <div className="p-4 bg-white border-b border-histo-dark/10 flex gap-3">
                <StatChip
                  icon={<Coins className="h-5 w-5 text-amber-500" />}
                  label="Your Histoins"
                  value={wallet.histoin_balance.toLocaleString()}
                  accent="amber"
                />
                <StatChip
                  icon={<Zap className="h-5 w-5 text-blue-500" />}
                  label="Current Tokens"
                  value={wallet.token_balance.toLocaleString()}
                  accent="blue"
                />
              </div>

              {/* Pack Grid */}
              <div className="p-5 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {shopPacks.map((pack) => {
                    const canAfford = wallet.histoin_balance >= pack.histoin_cost;
                    const featured = pack.token_amount >= 350000; // Mega Pack = best value
                    return (
                      <PackCard
                        key={pack.id}
                        pack={pack}
                        featured={featured}
                        onClick={() => canAfford && onBuyPack(pack)}
                        disabled={!canAfford}
                      />
                    );
                  })}
                </div>

                {/* How to Earn Histoins — collapsed by default */}
                <EarnHistoinsDisclosure />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Confirmation Dialog - UNCHANGED functionality, updated colors */}
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
                  className="flex-1 py-2 rounded-lg bg-amber-500 text-white text-xs font-ui font-bold hover:bg-amber-600 transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
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