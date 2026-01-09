import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from './badge';

describe('Badge', () => {
    it('renders correctly with default props', () => {
        render(<Badge>Default Badge</Badge>);
        const badge = screen.getByText('Default Badge');
        expect(badge).toBeInTheDocument();
        // Verify default styles class partial match
        expect(badge).toHaveClass('bg-primary');
    });

    it('renders secondary variant correctly', () => {
        render(<Badge variant="secondary">Secondary Badge</Badge>);
        const badge = screen.getByText('Secondary Badge');
        expect(badge).toHaveClass('bg-secondary');
    });

    it('renders destructive variant correctly', () => {
        render(<Badge variant="destructive">Destructive Badge</Badge>);
        const badge = screen.getByText('Destructive Badge');
        expect(badge).toHaveClass('bg-destructive');
    });

    it('renders outline variant correctly', () => {
        render(<Badge variant="outline">Outline Badge</Badge>);
        const badge = screen.getByText('Outline Badge');
        expect(badge).toHaveClass('border');
    });
});
