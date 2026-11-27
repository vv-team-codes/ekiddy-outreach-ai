import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { Button, EmptyState, StatusIndicator } from '@/components/ui';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/AuthPages';
import { useAppStore } from '@/stores/appStore';

function wrap(ui: React.ReactNode) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ekiddy Frontend Design System & Core Views', () => {
  it('renders landing page hero URL input and persists pending URL', async () => {
    const user = userEvent.setup();
    wrap(<LandingPage />);
    const input = screen.getByPlaceholderText(/Enter your company website/i);
    await user.type(input, 'https://ekiddy.com');
    await user.click(screen.getByRole('button', { name: /Analyze Company & Start/i }));
    expect(useAppStore.getState().pendingWebsiteUrl).toBe('https://ekiddy.com');
  });

  it('validates login form inputs via react-hook-form + zod', async () => {
    const user = userEvent.setup();
    wrap(<LoginPage />);
    await user.click(screen.getByRole('button', { name: /Sign In/i }));
    expect(await screen.findByText(/Invalid email/i)).toBeInTheDocument();
  });

  it('renders reusable design system components accurately', () => {
    render(
      <div>
        <Button>Launch Campaign</Button>
        <StatusIndicator status="verified" />
        <EmptyState title="No items" description="Nothing found yet." />
      </div>
    );
    expect(screen.getByRole('button', { name: /Launch Campaign/i })).toBeInTheDocument();
    expect(screen.getByText('verified')).toBeInTheDocument();
    expect(screen.getByText('No items')).toBeInTheDocument();
  });
});
