import { useState } from 'react';
import { Coins, CreditCard, Receipt } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  MetricCard,
  Modal,
  PageSkeleton
} from '@/components/ui';
import { apiRequest, apiRequestWithMeta } from '@/lib/api';
import { formatCurrencyInr, formatDateTime } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';

interface PlanItem {
  id: string;
  name: string;
  monthlyPriceInr: number;
  monthlyCredits: number;
  dailySendLimit: number;
}

interface PackItem {
  id: string;
  name: string;
  credits: number;
  amountInPaise: number;
}

export function BillingPage() {
  const queryClient = useQueryClient();
  const { organization, addToast, updateCreditBalance } = useAppStore();
  const [busy, setBusy] = useState(false);
  const [testCheckout, setTestCheckout] = useState<{
    orderId: string;
    amountInPaise: number;
    description: string;
    packId?: string;
    planId?: string;
    testPaymentPreview?: { paymentId: string; signature: string };
  } | null>(null);

  const { data: plansData, isLoading } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: () =>
      apiRequest<{ plans: PlanItem[]; creditPacks: PackItem[]; razorpayMode: string }>('/api/billing/plans')
  });

  const { data: balanceData, refetch: refetchBalance } = useQuery({
    queryKey: ['credits-balance', organization?._id],
    queryFn: () => apiRequest<{ creditBalance: number; plan: string; dailySendLimit: number }>('/api/credits/balance'),
    enabled: Boolean(organization?._id)
  });

  const { data: txRes, refetch: refetchTx } = useQuery({
    queryKey: ['credit-transactions', organization?._id],
    queryFn: () =>
      apiRequestWithMeta<
        Array<{ _id: string; type: string; operation: string; amount: number; balanceAfter: number; description: string; createdAt: string }>
      >('/api/credits/transactions?limit=20'),
    enabled: Boolean(organization?._id)
  });

  const { data: invoices = [], refetch: refetchInvoices } = useQuery({
    queryKey: ['invoices', organization?._id],
    queryFn: () =>
      apiRequest<Array<{ invoiceNumber: string; amountInPaise: number; status: string; description: string; issuedAt: string }>>(
        '/api/billing/invoices'
      ),
    enabled: Boolean(organization?._id)
  });

  const startCheckout = async (opts: { packId?: string; planId?: string }) => {
    setBusy(true);
    try {
      const order = await apiRequest<{
        mode: 'test' | 'live';
        keyId: string;
        orderId: string;
        amountInPaise: number;
        description: string;
        testPaymentPreview?: { paymentId: string; signature: string };
      }>('/api/billing/razorpay/order', {
        method: 'POST',
        body: JSON.stringify(opts)
      });

      setTestCheckout({
        orderId: order.orderId,
        amountInPaise: order.amountInPaise,
        description: order.description,
        packId: opts.packId,
        planId: opts.planId,
        testPaymentPreview: order.testPaymentPreview
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Checkout failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setBusy(false);
    }
  };

  const confirmTestPayment = async () => {
    if (!testCheckout?.testPaymentPreview) return;
    setBusy(true);
    try {
      const res = await apiRequest<{ verified: boolean; balanceAfter: number; creditsAdded: number }>(
        '/api/billing/razorpay/verify',
        {
          method: 'POST',
          body: JSON.stringify({
            razorpay_order_id: testCheckout.orderId,
            razorpay_payment_id: testCheckout.testPaymentPreview.paymentId,
            razorpay_signature: testCheckout.testPaymentPreview.signature,
            packId: testCheckout.packId,
            planId: testCheckout.planId
          })
        }
      );
      updateCreditBalance(res.balanceAfter);
      setTestCheckout(null);
      await Promise.all([
        refetchBalance(),
        refetchTx(),
        refetchInvoices(),
        queryClient.invalidateQueries({ queryKey: ['credits-balance'] })
      ]);
      addToast({ type: 'success', title: `Added ${res.creditsAdded} credits` });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Credits, Plans & Razorpay Billing</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Idempotent credit ledger with HMAC-verified Razorpay checkout and invoices.
          </p>
        </div>
        <Badge tone={plansData?.razorpayMode === 'configured' ? 'success' : 'indigo'}>
          Razorpay: {plansData?.razorpayMode === 'configured' ? 'Configured' : 'Test Sandbox Mode'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Available Balance" value={`${balanceData?.creditBalance ?? 0} credits`} icon={<Coins className="h-4 w-4" />} />
        <MetricCard label="Current Plan" value={(balanceData?.plan || 'free').toUpperCase()} icon={<CreditCard className="h-4 w-4" />} />
        <MetricCard label="Daily Send Cap" value={`${balanceData?.dailySendLimit ?? 50} / day`} icon={<Receipt className="h-4 w-4" />} />
      </div>

      {/* Credit Packs */}
      <Card>
        <CardHeader title="Purchase Credit Packs (Pay-As-You-Go)" />
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(plansData?.creditPacks || []).map((pack) => (
            <div key={pack.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="text-sm font-semibold">{pack.name}</div>
              <div className="mt-1 text-2xl font-bold">{formatCurrencyInr(pack.amountInPaise)}</div>
              <div className="mt-1 text-xs text-slate-500">+{pack.credits.toLocaleString()} AI & sending credits</div>
              <Button size="sm" className="mt-4 w-full" onClick={() => startCheckout({ packId: pack.id })} loading={busy}>
                Buy Pack
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Subscription Plans */}
      <Card>
        <CardHeader title="Subscription Tiers" />
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {(plansData?.plans || []).map((plan) => (
            <div key={plan.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="text-sm font-semibold">{plan.name}</div>
              <div className="mt-1 text-xl font-bold">
                {plan.monthlyPriceInr === 0 ? 'Free' : `₹${plan.monthlyPriceInr.toLocaleString('en-IN')}/mo`}
              </div>
              <div className="mt-1 text-xs text-slate-500">{plan.monthlyCredits} credits • {plan.dailySendLimit}/day</div>
              {plan.monthlyPriceInr > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => startCheckout({ planId: plan.id })}
                  loading={busy}
                >
                  Upgrade
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Credit Transaction Ledger" />
          <CardContent className="divide-y divide-slate-100 p-0 text-xs dark:divide-slate-800">
            {(txRes?.data || []).map((tx) => (
              <div key={tx._id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="font-medium">{tx.description}</div>
                  <div className="text-[11px] text-slate-500">{formatDateTime(tx.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className={`font-semibold ${tx.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                  </div>
                  <div className="text-[11px] text-slate-400">Bal: {tx.balanceAfter}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Invoices & Payment History" />
          <CardContent className="divide-y divide-slate-100 p-0 text-xs dark:divide-slate-800">
            {invoices.length === 0 ? (
              <div className="p-6 text-center text-slate-500">No paid invoices yet.</div>
            ) : (
              invoices.map((inv) => (
                <div key={inv.invoiceNumber} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="font-semibold">{inv.invoiceNumber}</div>
                    <div className="text-slate-500">{inv.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrencyInr(inv.amountInPaise)}</div>
                    <Badge tone="success">{inv.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Modal
        open={Boolean(testCheckout)}
        onClose={() => setTestCheckout(null)}
        title="Razorpay Checkout (Test / Sandbox Verification)"
      >
        {testCheckout && (
          <div className="space-y-4 text-xs">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
              <p><strong>Item:</strong> {testCheckout.description}</p>
              <p><strong>Amount:</strong> {formatCurrencyInr(testCheckout.amountInPaise)}</p>
              <p><strong>Order ID:</strong> <code>{testCheckout.orderId}</code></p>
            </div>
            {testCheckout.testPaymentPreview ? (
              <Button className="w-full" onClick={confirmTestPayment} loading={busy}>
                Complete HMAC-Signed Test Payment
              </Button>
            ) : (
              <p className="text-slate-500">
                Live Razorpay key detected. Connect the Razorpay JS widget with Order ID {testCheckout.orderId}.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
