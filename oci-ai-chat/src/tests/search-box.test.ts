import { render, fireEvent, waitFor } from '@testing-library/svelte';
import SearchBox from '../lib/components/ui/SearchBox.svelte';

describe('SearchBox', () => {
  it('should open AI dialog when user submits search query', async () => {
    const { getByPlaceholderText, getByText } = render(SearchBox);
    const input = getByPlaceholderText(/Ask AI/i);

    fireEvent.change(input, { target: { value: 'List my instances' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(getByText(/Executing|Loading/i)).toBeInTheDocument();
    });
  });

  it('should show loading state while processing', async () => {
    const { getByPlaceholderText } = render(SearchBox);
    const input = getByPlaceholderText(/Ask AI/i);

    fireEvent.change(input, { target: { value: 'test query' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(document.querySelector('[data-testid="loading-spinner"]')).toBeInTheDocument();
    });
  });

  it('should disable input while loading', async () => {
    const { getByPlaceholderText } = render(SearchBox);
    const input = getByPlaceholderText(/Ask AI/i) as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'test query' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(input.disabled).toBe(true);
    });
  });
});
