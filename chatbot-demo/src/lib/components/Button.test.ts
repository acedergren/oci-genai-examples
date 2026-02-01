import { render } from '@testing-library/svelte/svelte5';
import { describe, it, expect } from 'vitest';
import Button from './Button.svelte';

describe('Button Component', () => {
  it('renders as a button element', () => {
    const { container } = render(Button);
    const button = container.querySelector('button');
    expect(button).toBeTruthy();
  });

  it('applies accent variant by default', () => {
    const { container } = render(Button);
    const button = container.querySelector('button');
    expect(button?.className).toContain('accent-gradient');
  });

  it('applies ghost variant when specified', () => {
    const { container } = render(Button, {
      props: { variant: 'ghost' }
    });
    const button = container.querySelector('button');
    expect(button?.className).toContain('text-text-secondary');
  });

  it('disables button when disabled prop is true', () => {
    const { container } = render(Button, {
      props: { disabled: true }
    });
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('sets correct button type', () => {
    const { container } = render(Button, {
      props: { type: 'submit' }
    });
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.type).toBe('submit');
  });
});
