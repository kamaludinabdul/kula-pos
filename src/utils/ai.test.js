import { describe, it, expect } from 'vitest';
import { formatDataForAI, parseAIResponse } from './ai';

describe('AI Utilities', () => {
    describe('formatDataForAI', () => {
        it('should format transaction data correctly for AI prompt', () => {
            const mockData = [
                { date: '2024-03-01', total_sales: 1000000, total_profit: 200000 },
                { date: '2024-03-02', total_sales: 1200000, total_profit: 250000 }
            ];
            const formatted = formatDataForAI(mockData);

            expect(formatted).toContain('2024-03-01');
            expect(formatted).toContain('1,000,000');
            expect(formatted).toContain('200,000');
        });

        it('should handle empty data gracefully', () => {
            expect(formatDataForAI([])).toBe('');
            expect(formatDataForAI(null)).toBe('');
        });
    });

    describe('parseAIResponse', () => {
        it('should parse valid JSON response from AI', () => {
            const mockResponse = '```json\n{"summary": "Sales are up", "trend": "positive"}\n```';
            const parsed = parseAIResponse(mockResponse);
            expect(parsed.summary).toBe('Sales are up');
            expect(parsed.trend).toBe('positive');
        });

        it('should parse raw JSON without markdown blocks', () => {
            const mockResponse = '{"summary": "Sales are up"}';
            const parsed = parseAIResponse(mockResponse);
            expect(parsed.summary).toBe('Sales are up');
        });

        it('should return null or default for invalid JSON', () => {
            const mockResponse = 'This is not JSON';
            const parsed = parseAIResponse(mockResponse);
            expect(parsed).toBeNull();
        });
    });
});
