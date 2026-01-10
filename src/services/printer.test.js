/* eslint-disable no-undef */
import { describe, it, expect } from 'vitest';
import { printerService } from './printer';

// Mock TextEncoder since it might not be in the test environment (jsdom/node)
if (typeof TextEncoder === 'undefined') {
    global.TextEncoder = class TextEncoder {
        encode(str) {
            return Buffer.from(str);
        }
    };
}

describe('PrinterService', () => {
    describe('isConnected', () => {
        it('should return false initially', () => {
            expect(printerService.isConnected()).toBe(false);
        });
    });

    // Strategy: We can't easily test the Bluetooth connection logic in unit tests 
    // without heavy mocking of navigator.bluetooth.
    // Instead, we will test the 'virtual' logic or internal helpers if any.
    // However, looking at printer.js, most logic is inside monolithic async functions.

    // We can at least ensure it fails gracefully if bluetooth is missing
    describe('connect', () => {
        it('should fail if navigator.bluetooth is undefined', async () => {
            // Ensure navigator is mocked or we can override it
            const originalNavigator = global.navigator;

            // Mock navigator without bluetooth
            Object.defineProperty(global, 'navigator', {
                value: { ...originalNavigator, bluetooth: undefined },
                writable: true
            });

            const result = await printerService.connect();
            expect(result.success).toBe(false);
            expect(result.error).toContain('not supported');

            // Restore
            global.navigator = originalNavigator;
        });
    });
});
